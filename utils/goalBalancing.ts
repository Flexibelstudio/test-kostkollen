import { GoalSettings } from '../types';
import { CALORIES_PER_GRAM } from '../constants';

/**
 * Manuella mål: kalorimålet är låset.
 *
 * Fyra fält men bara en ekvation (kcal = 4P + 4K + 9F), så när användaren ändrar
 * ett värde måste ett annat ge vika. Regeln är att kaloritaket alltid håller och
 * att kolhydraterna absorberar skillnaden. Fettet har ett golv så det inte kan
 * pressas ner till noll när kolhydraterna höjs.
 */

/** Fettets nedre gräns, andel av dagens kalorier. */
export const FAT_MIN_PERCENTAGE_OF_CALORIES = 0.20;

/** Över den här andelen av energin flaggas proteinet som ovanligt högt. */
export const PROTEIN_HIGH_PERCENTAGE_OF_CALORIES = 0.40;

export type ManualGoalField = 'calorieGoal' | 'proteinGoal' | 'carbohydrateGoal' | 'fatGoal';

const clampToZero = (value: number): number => (isNaN(value) || value < 0 ? 0 : value);

export const macroCalories = (goals: GoalSettings): number =>
  goals.proteinGoal * CALORIES_PER_GRAM.protein +
  goals.carbohydrateGoal * CALORIES_PER_GRAM.carbohydrates +
  goals.fatGoal * CALORIES_PER_GRAM.fat;

export const minimumFatGrams = (calorieGoal: number): number =>
  Math.round((calorieGoal * FAT_MIN_PERCENTAGE_OF_CALORIES) / CALORIES_PER_GRAM.fat);

/**
 * Räknar om målen så att summan av makronäringsämnena matchar kalorimålet.
 * Returnerar alltid ett komplett och konsekvent objekt.
 */
export function rebalanceManualGoals(
  current: GoalSettings,
  changedField: ManualGoalField,
  rawValue: number
): GoalSettings {
  const next: GoalSettings = { ...current, [changedField]: clampToZero(Math.round(rawValue)) };

  const calories = clampToZero(next.calorieGoal);
  if (calories === 0) {
    return { ...next, calorieGoal: 0, proteinGoal: 0, carbohydrateGoal: 0, fatGoal: 0 };
  }

  const fatFloor = minimumFatGrams(calories);

  if (changedField === 'carbohydrateGoal') {
    // Användaren har uttryckligen satt kolhydraterna, så fettet får ge vika -
    // men aldrig under golvet. Räcker inte utrymmet kapas kolhydraterna i stället.
    const caloriesLeftForFat =
      calories -
      next.proteinGoal * CALORIES_PER_GRAM.protein -
      next.carbohydrateGoal * CALORIES_PER_GRAM.carbohydrates;
    const fatFromRest = Math.round(caloriesLeftForFat / CALORIES_PER_GRAM.fat);

    if (fatFromRest >= fatFloor) {
      return { ...next, fatGoal: clampToZero(fatFromRest) };
    }

    const caloriesLeftForCarbs =
      calories -
      next.proteinGoal * CALORIES_PER_GRAM.protein -
      fatFloor * CALORIES_PER_GRAM.fat;
    return {
      ...next,
      fatGoal: fatFloor,
      carbohydrateGoal: clampToZero(Math.round(caloriesLeftForCarbs / CALORIES_PER_GRAM.carbohydrates)),
    };
  }

  // Kalorier, protein eller fett ändrades -> kolhydraterna absorberar skillnaden.
  const fatGoal = Math.max(next.fatGoal, 0);
  const caloriesLeftForCarbs =
    calories -
    next.proteinGoal * CALORIES_PER_GRAM.protein -
    fatGoal * CALORIES_PER_GRAM.fat;

  const carbohydrateGoal = Math.round(caloriesLeftForCarbs / CALORIES_PER_GRAM.carbohydrates);

  if (carbohydrateGoal >= 0) {
    return { ...next, fatGoal, carbohydrateGoal };
  }

  // Protein och fett äter redan upp hela kaloritaket. Sänk fettet till golvet
  // innan kolhydraterna nollas - proteinet rör vi aldrig, det är användarens val.
  const caloriesLeftWithFatFloor =
    calories - next.proteinGoal * CALORIES_PER_GRAM.protein - fatFloor * CALORIES_PER_GRAM.fat;

  return {
    ...next,
    fatGoal: Math.min(fatGoal, fatFloor),
    carbohydrateGoal: clampToZero(Math.round(caloriesLeftWithFatFloor / CALORIES_PER_GRAM.carbohydrates)),
  };
}

export interface ManualGoalWarnings {
  /** Makronäringsämnenas summa i kcal. */
  macroCalories: number;
  /** Summan går inte ihop med kalorimålet. */
  exceedsCalorieGoal: boolean;
  /** Proteinets andel av energin. */
  proteinShare: number;
  /** Proteinet tar ovanligt stor del av energin. */
  proteinIsHigh: boolean;
  /** Fettet ligger på sin nedre gräns och kan inte sänkas mer. */
  fatAtFloor: boolean;
}

export function getManualGoalWarnings(goals: GoalSettings): ManualGoalWarnings {
  const calories = clampToZero(goals.calorieGoal);
  const total = macroCalories(goals);
  const proteinShare = calories > 0 ? (goals.proteinGoal * CALORIES_PER_GRAM.protein) / calories : 0;

  return {
    macroCalories: total,
    exceedsCalorieGoal: calories > 0 && total > calories + 10,
    proteinShare,
    proteinIsHigh: proteinShare > PROTEIN_HIGH_PERCENTAGE_OF_CALORIES,
    fatAtFloor: calories > 0 && goals.fatGoal <= minimumFatGrams(calories),
  };
}
