import { LoggedMeal, NutritionalInfo } from '../types';
import { MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL } from '../constants';
import { getDateUID } from './dateUtils';

export interface NutrientTotals {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}

export interface RemainingCaloriesResult {
  calorieGoal: number;
  consumedCalories: number;
  availableBank: number;
  rawCaloriesOver: number;
  calculatedBankUsage: number;
  netCaloriesOver: number;
  remainingBankDisplay: number;
  caloriesRemaining: number;
  minSafeCalories: number;
  isOverBudget: boolean;
  isFullyCoveredByBank: boolean;
  isNetOverBudget: boolean;
  goalMet: boolean;
  progressColor: string;
}

export interface WeeklyTotalsResult {
  totalConsumed: number;
  totalGoal: number;
  daysCount: number;
  averageDailyConsumed: number;
  averageDailyGoal: number;
  surplusOrDeficit: number;
  isOverBudget: boolean;
  displayTotalConsumed: number;
  displayTotalGoal: number;
}

/**
 * 1. Summera måltider till råvärden för kalorier och makron.
 * Tar hänsyn till eventuell `count` multiplikator för grupperade måltider.
 * Avrundar ALDRIG råvärden under aggregering.
 */
export function sumMealNutrients(
  meals: Array<{ nutritionalInfo: NutritionalInfo; count?: number } | LoggedMeal>
): NutrientTotals {
  return meals.reduce(
    (acc, meal) => {
      const count = meal.count || 1;
      return {
        calories: acc.calories + (meal.nutritionalInfo.calories * count),
        protein: acc.protein + (meal.nutritionalInfo.protein * count),
        carbohydrates: acc.carbohydrates + (meal.nutritionalInfo.carbohydrates * count),
        fat: acc.fat + (meal.nutritionalInfo.fat * count),
      };
    },
    { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
  );
}

/**
 * 2. Beräkna återstående kalorier utifrån mål, intag och Sparpott.
 * Sparpotten adderas ALDRIG till dagsmålet och dubbelräknas inte. Den används enbart
 * för att absorbera överskott utöver det fasta dagsmålet.
 */
export function calculateRemainingCalories(
  calorieGoal: number,
  consumedCalories: number,
  availableBank: number = 0,
  goalType?: string
): RemainingCaloriesResult {
  const rawCaloriesOver = Math.max(0, consumedCalories - calorieGoal);
  const calculatedBankUsage = Math.min(rawCaloriesOver, availableBank);
  const netCaloriesOver = Math.max(0, rawCaloriesOver - calculatedBankUsage);
  const remainingBankDisplay = Math.max(0, availableBank - calculatedBankUsage);
  const minSafeCalories = calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
  const caloriesRemaining = Math.max(0, calorieGoal - consumedCalories);

  const isOverBudget = rawCaloriesOver > 0;
  const isFullyCoveredByBank = isOverBudget && netCaloriesOver === 0;
  const isNetOverBudget = netCaloriesOver > 0;

  let goalMet = false;
  if (consumedCalories >= minSafeCalories) {
    if (goalType === 'gain_muscle') {
      goalMet = consumedCalories >= (calorieGoal - 300);
    } else {
      goalMet = consumedCalories <= (calorieGoal + availableBank);
    }
  }

  // Ringens färg följer samma mållogik som goalMet ovan, dvs den är beroende av måltyp:
  // - lose_fat/maintain: grön redan från minimigränsen (80% av målet) upp till målet (+ sparpott)
  // - gain_muscle: grön från målet minus 300 kcal upp till målet
  let progressColor = '#D96E4A';
  if (consumedCalories < minSafeCalories) {
    progressColor = '#D96E4A';
  } else if (isNetOverBudget) {
    progressColor = '#C05A38';
  } else if (goalMet || isFullyCoveredByBank) {
    progressColor = '#7BA05B';
  }

  return {
    calorieGoal,
    consumedCalories,
    availableBank,
    rawCaloriesOver,
    calculatedBankUsage,
    netCaloriesOver,
    remainingBankDisplay,
    caloriesRemaining,
    minSafeCalories,
    isOverBudget,
    isFullyCoveredByBank,
    isNetOverBudget,
    goalMet,
    progressColor,
  };
}

/**
 * 3. Beräkna veckototal och veckobudget.
 * Summerar råvärden över alla ingående dagar utan avrundning och jämför mot total budget.
 */
export function calculateWeeklyTotals(
  days: Array<{ consumedCalories: number; calorieGoal?: number }>,
  defaultDailyGoal: number = 2000
): WeeklyTotalsResult {
  const totalConsumed = days.reduce((sum, d) => sum + (d.consumedCalories || 0), 0);
  const totalGoal = days.reduce((sum, d) => sum + (d.calorieGoal ?? defaultDailyGoal), 0);
  const daysCount = days.length;
  const averageDailyConsumed = daysCount > 0 ? totalConsumed / daysCount : 0;
  const averageDailyGoal = daysCount > 0 ? totalGoal / daysCount : defaultDailyGoal;
  const surplusOrDeficit = totalConsumed - totalGoal;

  return {
    totalConsumed,
    totalGoal,
    daysCount,
    averageDailyConsumed,
    averageDailyGoal,
    surplusOrDeficit,
    isOverBudget: totalConsumed > totalGoal,
    displayTotalConsumed: Math.round(totalConsumed),
    displayTotalGoal: Math.round(totalGoal),
  };
}

/**
 * 4. Avgöra vilken dag en måltid tillhör utifrån tidsstämpel och användarens lokala tid.
 * Använder klientens lokala år, månad och dag så att tidsstämplar sent på kvällen
 * inte förskjuts till fel dygn på grund av UTC-konvertering.
 */
export function getMealDateUID(
  timestampOrDate: number | Date | string
): string {
  if (typeof timestampOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timestampOrDate)) {
    return timestampOrDate;
  }
  const dateObj = typeof timestampOrDate === 'number' || typeof timestampOrDate === 'string'
    ? new Date(timestampOrDate)
    : timestampOrDate;

  return getDateUID(dateObj);
}

/**
 * 5. Bevara ursprungligt råvärde om användaren inte ändrat fältet från dess avrundade visningsvärde.
 * Om användaren har skrivit in ett nytt värde används det inmatade värdet som det är (utan avrundning).
 */
export function resolveNutritionalFieldValue(
  originalRawValue: number,
  editedStringValue: string
): number {
  const roundedDisplayStr = Math.round(originalRawValue).toString();
  // Om texten i inmatningsfältet fortfarande matchar det avrundade visningsvärdet för originalet,
  // behåll det exakta ursprungliga råvärdet.
  if (editedStringValue.trim() === roundedDisplayStr) {
    return originalRawValue;
  }
  const parsed = parseFloat(editedStringValue.replace(',', '.'));
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

export function resolveUpdatedNutrients(
  original: NutritionalInfo,
  edited: {
    calories: string;
    protein: string;
    carbohydrates: string;
    fat: string;
    foodItem?: string;
  }
): NutritionalInfo {
  return {
    foodItem: edited.foodItem !== undefined ? edited.foodItem.trim() : original.foodItem,
    calories: resolveNutritionalFieldValue(original.calories, edited.calories),
    protein: resolveNutritionalFieldValue(original.protein, edited.protein),
    carbohydrates: resolveNutritionalFieldValue(original.carbohydrates, edited.carbohydrates),
    fat: resolveNutritionalFieldValue(original.fat, edited.fat),
  };
}

