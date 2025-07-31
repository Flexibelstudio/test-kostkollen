import { UserProfileData, Gender, ActivityLevel, GoalType, CalculatedNutritionalRecommendations } from '../types.ts';
import { ACTIVITY_MULTIPLIERS, PROTEIN_PER_KG_TARGET, FAT_PERCENTAGE_OF_CALORIES, CALORIES_PER_GRAM, CALORIE_ADJUSTMENT } from '../constants.ts';

/**
 * Calculates Basal Metabolic Rate (BMR) using the Mifflin-St Jeor equation.
 * @param weightKg Weight in kilograms.
 * @param heightCm Height in centimeters.
 * @param ageYears Age in years.
 * @param gender Gender ('male' or 'female').
 * @returns BMR in calories.
 */
export const calculateMifflinStJeorBMR = (
  weightKg: number,
  heightCm: number,
  ageYears: number,
  gender: Gender
): number => {
  if (gender === 'male') {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) + 5;
  } else { // 'female'
    return (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) - 161;
  }
};

/**
 * Calculates Total Daily Energy Expenditure (TDEE).
 * @param bmr Basal Metabolic Rate.
 * @param activityLevel Activity level multiplier.
 * @returns TDEE in calories.
 */
export const calculateTDEE = (bmr: number, activityLevel: ActivityLevel): number => {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
};

/**
 * Derives the effective GoalType based on desired changes in fat and muscle mass.
 * @param profile A partial UserProfileData object containing goal information.
 * @returns The derived GoalType.
 */
export const deriveEffectiveGoalType = (
  profile: Partial<UserProfileData>
): GoalType => {
  const { measurementMethod, desiredWeightChangeKg, desiredFatMassChangeKg, desiredMuscleMassChangeKg } = profile;

  if (measurementMethod === 'scale') {
    if (desiredWeightChangeKg !== undefined && desiredWeightChangeKg < 0) {
      return 'lose_fat';
    } else if (desiredWeightChangeKg !== undefined && desiredWeightChangeKg > 0) {
      return 'gain_muscle'; // Assume weight gain is for muscle
    }
  } else { // Default to 'inbody' for legacy users or if explicitly set
    if (desiredFatMassChangeKg !== undefined && desiredFatMassChangeKg < 0) {
      return 'lose_fat';
    } else if (desiredMuscleMassChangeKg !== undefined && desiredMuscleMassChangeKg > 0) {
      return 'gain_muscle';
    }
  }
  
  return 'maintain';
};


/**
 * Calculates recommended daily nutritional intake based on user profile.
 * The goalType within the profile is now expected to be derived from body composition goals.
 * @param profile UserProfileData object.
 * @returns CalculatedNutritionalRecommendations object.
 */
export const calculateRecommendations = (profile: UserProfileData): CalculatedNutritionalRecommendations => {
  const { currentWeightKg, heightCm, ageYears, gender, activityLevel, goalType } = profile;

  if (!currentWeightKg || !heightCm || !ageYears ) {
    // Return zeroed or default recommendations if essential data is missing
    return {
        bmr: 0, tdee: 0, recommendedCalories: 0,
        recommendedProteinGrams: 0, recommendedFatGrams: 0, recommendedCarbsGrams: 0
    };
  }
  
  const bmr = calculateMifflinStJeorBMR(currentWeightKg, heightCm, ageYears, gender);
  const tdee = calculateTDEE(bmr, activityLevel);

  // Use the goalType from the profile, which should now be the derived one.
  const calorieAdjustment = CALORIE_ADJUSTMENT[goalType];
  const recommendedCalories = tdee + calorieAdjustment;

  const recommendedProteinGrams = currentWeightKg * PROTEIN_PER_KG_TARGET;
  const proteinCalories = recommendedProteinGrams * CALORIES_PER_GRAM.protein;

  const fatCalories = recommendedCalories * FAT_PERCENTAGE_OF_CALORIES;
  const recommendedFatGrams = fatCalories / CALORIES_PER_GRAM.fat;

  const remainingCaloriesForCarbs = recommendedCalories - proteinCalories - fatCalories;
  const recommendedCarbsGrams = Math.max(0, remainingCaloriesForCarbs / CALORIES_PER_GRAM.carbohydrates); // Ensure non-negative

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    recommendedCalories: Math.round(recommendedCalories),
    recommendedProteinGrams: Math.round(recommendedProteinGrams),
    recommendedFatGrams: Math.round(recommendedFatGrams),
    recommendedCarbsGrams: Math.round(recommendedCarbsGrams),
  };
};