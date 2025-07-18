


import { GoalSettings, NutritionalInfo, UserProfileData, Level, Achievement } from './types.ts';

export const GEMINI_MODEL_NAME_TEXT = 'gemini-2.5-flash';

export const DEFAULT_GOALS: GoalSettings = {
  calorieGoal: (100 * 4) + (250 * 4) + (67 * 9), // 2003 kcal, sum of default macros
  proteinGoal: 100, // 400 kcal
  carbohydrateGoal: 250, // 1000 kcal
  fatGoal: 67,          // 603 kcal (approx 30% of ~2000 kcal)
};

export const DEFAULT_WATER_GOAL_ML = 2000; // Default daily water goal in ml

export const LOCAL_STORAGE_KEYS = {
  // Most keys are removed as data is now persisted in Firestore.
  // Only non-critical, ephemeral data that doesn't need to be synced should remain.
  RECENT_RECIPE_SEARCHES: 'foodLoggerRecentRecipeSearches_v1',
  LAST_BUDDY_VIEW_TIMESTAMP: 'foodLoggerLastBuddyViewTimestamp_v1',
  LAST_MY_PEPPS_VIEW_TIMESTAMP: 'foodLoggerLastMyPeppsViewTimestamp_v1',
};

export const MANUAL_LOG_FOOD_ICON_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M7.75 2.75a.75.75 0 0 0-1.5 0V4.5h-.5A.75.75 0 0 0 4 5.25v9.5A.75.75 0 0 0 4.75 15.5h.5V17.25a.75.75 0 0 0 1.5 0V15.5h.5A.75.75 0 0 0 8 14.75V5.25A.75.75 0 0 0 7.25 4.5h-.5V2.75Z" /><path d="M12.25 2.75a.75.75 0 0 0-1.5 0V17.25a.75.75 0 0 0 1.5 0V2.75Z" /><path d="M15.5 5.5A1.5 1.5 0 0 0 14 4H9.75a.75.75 0 0 0 0 1.5H14a1.5 1.5 0 0 1 1.5 1.5v2.25a.75.75 0 0 0 1.5 0v-2.25A2.5 2.5 0 0 0 14.5 4H14c0-1.052.284-2.02.787-2.822a.75.75 0 0 0-.895-1.085A4.002 4.002 0 0 0 9.75 2H9.5a.75.75 0 0 0 0 1.5h.25a2.5 2.5 0 0 1 2.5 2.5V14.5a2.5 2.5 0 0 1-2.5 2.5h-.25a.75.75 0 0 0 0 1.5h.25a4.002 4.002 0 0 0 4.032-3.678A.75.75 0 0 0 15.5 14.5V5.5Z" /></svg>`;
export const COMMON_MEAL_LOG_ICON_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clip-rule="evenodd" /><path d="M12.878 2.553a.75.75 0 0 0-.53-.223H12v3.75h3.75V6.12A.75.75 0 0 0 15.45 5.59l-2.572-2.572Z" /></svg>`;

// Constants for User Profile feature
export const DEFAULT_USER_PROFILE: UserProfileData = {
  name: undefined,
  photoURL: undefined,
  currentWeightKg: 70,
  heightCm: 170,
  ageYears: 30,
  gender: 'female', // Default, can be changed by user
  activityLevel: 'moderate',
  goalType: 'maintain', // Default, will be derived based on desired changes
  measurementMethod: 'inbody',
  desiredWeightChangeKg: undefined,
  skeletalMuscleMassKg: undefined,
  bodyFatMassKg: undefined,
  desiredFatMassChangeKg: undefined,
  desiredMuscleMassChangeKg: undefined,
  goalCompletionDate: undefined,
  isCourseActive: false, // Default course status
  goalStartWeight: undefined,
};

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,       // Little or no exercise
  light: 1.375,         // Light exercise/sports 1-3 days/week
  moderate: 1.55,       // Moderate exercise/sports 3-5 days/week
  active: 1.725,        // Hard exercise/sports 6-7 days a week
  very_active: 1.9,     // Very hard exercise/sports & physical job
};

export const PROTEIN_PER_KG_TARGET = 1.5; // g per kg of body weight
export const FAT_PERCENTAGE_OF_CALORIES = 0.25; // 25% of calories from fat

export const CALORIES_PER_GRAM = {
  protein: 4,
  carbohydrates: 4,
  fat: 9,
};

export const CALORIE_ADJUSTMENT = {
  lose_fat: -500, // Deficit for fat loss
  maintain: 0,
  gain_muscle: 300, // Surplus for muscle gain
};

// Gamification Level Definitions
export const LEVEL_DEFINITIONS: Level[] = [
  { id: 'level0', name: 'Nystartad', requiredStreak: 0, icon: '🌱', description: 'Du har precis börjat din resa!' },
  { id: 'level1', name: 'Veckoutmanare', requiredStreak: 7, icon: '🥉', description: 'En hel vecka, starkt jobbat!' },
  { id: 'level2', name: 'Tvåveckorssegrare', requiredStreak: 14, icon: '🥈', description: 'Två veckor i rad, imponerande!' },
  { id: 'level3', name: 'Treveckorstriumf', requiredStreak: 21, icon: '🏅', description: 'Tre veckors konsekvens!' },
  { id: 'level4', name: 'Månadsmästare', requiredStreak: 30, icon: '🥇', description: 'En hel månad, du är en stjärna!' },
  { id: 'level5', name: 'Tvåmånadersuthållighet', requiredStreak: 60, icon: '🏆', description: 'Två månader, vilken disciplin!' },
  { id: 'level6', name: 'Kvartalshjälte', requiredStreak: 90, icon: '🌟', description: 'Ett helt kvartal, otroligt!' },
  { id: 'level7', name: 'Fyramånadersfenomen', requiredStreak: 120, icon: '🚀', description: 'Fyra månader, du flyger fram!' },
  { id: 'level8', name: 'Femmånadersfighter', requiredStreak: 150, icon: '💪', description: 'Fem månader av framsteg!' },
  { id: 'level9', name: 'Halvårslegend', requiredStreak: 180, icon: '✨', description: 'Ett halvt år, du är en legend!' },
  { id: 'level10', name: 'Sjumånaderssuperhjälte', requiredStreak: 210, icon: '🦸', description: 'Sju månader, en sann superhjälte!' },
  { id: 'level11', name: 'Åttamånadersmästare', requiredStreak: 240, icon: '🌠', description: 'Åtta månader, du når stjärnorna!' },
  { id: 'level12', name: 'Niomånadersninja', requiredStreak: 270, icon: '🥷', description: 'Nio månader, smidig som en ninja!' },
  { id: 'level13', name: 'Tiomånaderstitan', requiredStreak: 300, icon: '🛡️', description: 'Tio månader, stark som en titan!' },
  { id: 'level14', name: 'Elvamånaderselit', requiredStreak: 330, icon: '💫', description: 'Elva månader, du är elit!' },
  { id: 'level15', name: 'Årsidol', requiredStreak: 365, icon: '💎', description: 'Ett helt år! Du är en sann idol!' },
  // New levels for continued progression beyond one year
  { id: 'level16', name: 'Evighetsstreaker (1Å 1M)', requiredStreak: 365 + 30, icon: '🌌', description: 'Över ett år och en månad! Vilken uthållighet!' },
  { id: 'level17', name: 'Disciplinmästare (1Å 3M)', requiredStreak: 365 + 90, icon: '🌠', description: 'Ett och ett kvarts år! Din disciplin är beundransvärd!' },
  { id: 'level18', name: 'Hälsoguru (1Å 6M)', requiredStreak: 365 + 180, icon: '🧘', description: 'Ett och ett halvt år! Du är en sann hälsoguru!' },
  { id: 'level19', name: 'Järnvilja (1Å 9M)', requiredStreak: 365 + 270, icon: '🦾', description: 'Ett och trekvarts år! Din viljestyrka är av järn!' },
  { id: 'level20', name: 'Tvåårslegend', requiredStreak: 365 * 2, icon: '🏆✨', description: 'TVÅ HELA ÅR! Du är en levande legend!' },
  { id: 'level21', name: 'Bronsstreaker (2Å 3M)', requiredStreak: (365 * 2) + 90, icon: '🥉🥉', description: 'Två år och tre månader! Din streak fortsätter glänsa!' },
  { id: 'level22', name: 'Silverstreaker (2Å 6M)', requiredStreak: (365 * 2) + 180, icon: '🥈🥈', description: 'Två och ett halvt år! Imponerande konsekvens!' },
  { id: 'level23', name: 'Guldstreaker (2Å 9M)', requiredStreak: (365 * 2) + 270, icon: '🥇🥇', description: 'Två år och nio månader! Du siktar mot stjärnorna!' },
  { id: 'level24', name: 'TreårsTitan', requiredStreak: 365 * 3, icon: '💎💎💎', description: 'TRE ÅR AV STREAK! En sann titan av hälsa!' },
];


// Constants for Calorie Banking and Healthy Range
export const MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL = 0.80; // 80% of calorie goal as minimum safe intake
export const MIN_ABSOLUTE_CALORIES_THRESHOLD = 1200; // An absolute minimum, could be used additionally
export const BANK_ICON_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21V3m0 0H9m3 0h3m-3 0V1.5M12 3v1.5m0 0V3m0 0H6.75m10.5 0H21m-1.5 0H21m-1.5 0H21m-1.5 0h1.5m-1.5 0H21m0 0v1.5m0 0v1.5m0 0V3m0 0v1.5m0 0v1.5m0 0v1.5m0 0v1.5M4.5 12v6A4.5 4.5 0 0 0 9 22.5h6a4.5 4.5 0 0 0 4.5-4.5v-6M4.5 12H3m1.5 0H4.5m0 0H3m1.5 0H4.5m0 0H3m1.5 0H4.5m0 0H6m-1.5 0H6M4.5 12V9m0 3v3m0-3V9m0 3v3m0-3V9m0 3v3M19.5 12v6a4.5 4.5 0 0 1-4.5 4.5H9a4.5 4.5 0 0 1-4.5-4.5v-6M19.5 12H21m-1.5 0H19.5m0 0H21m-1.5 0H19.5m0 0H21m-1.5 0H19.5m0 0H18m1.5 0H18M19.5 12V9m0 3v3m0-3V9m0 3v3m0-3V9m0 3v3m-7.5-9h3M9 6H6.75M9 6h2.25m-2.25 0H9m0 0H6.75M9 6H9.75M9 6v1.5M9 6v1.5m0-1.5V6M9 7.5V6m0 1.5V6m0 1.5V6m2.25-1.5h-3m3 0h-3M15 6h-3m3 0h-3m-2.25 0h2.25m5.25 0H15m2.25 0h-2.25m2.25 0H15m2.25 0h-2.25m2.25 0H15m2.25 0H15m-2.25-1.5v1.5m0-1.5v1.5m0-1.5V6m0 1.5V6m0 1.5V6m-3-1.5h3M6.75 6H9m2.25 0h2.25M12 6h2.25m-2.25 0h2.25m2.25 0h-2.25M15 6H9.75M12 6H9.75m2.25 0H9.75M12 6H9.75m2.25 0H9.75m2.25 0H9.75m2.25 0H9.75" /></svg>`;
// Simpler Bank Icon: Piggy bank
export const PIGGY_BANK_ICON_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path d="M10.5 18.75a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" /><path fill-rule="evenodd" d="M8.625 2.25A.75.75 0 0 0 7.875 3v.498c-.464.204-.897.458-1.284.743A4.495 4.495 0 0 0 2.25 7.5c0 1.518.91 2.827 2.196 3.429.07.034.14.068.21.1V15A4.5 4.5 0 0 0 9 19.5h6A4.5 4.5 0 0 0 19.5 15v-4.072c.07-.032.14-.066.21-.1 1.287-.602 2.196-1.911 2.196-3.429 0-1.677-1.026-3.097-2.433-3.71.05-.16.083-.326.083-.5V3a.75.75 0 0 0-.75-.75h-9ZM9.75 3.75H12V3h2.25v.75H12v2.25H9.75V3.75Zm-.73 6.027A3.001 3.001 0 1 0 4.5 7.5a2.986 2.986 0 0 0 .041.442A.753.753 0 0 0 4.5 8.25c0 .198.077.383.21.524a2.986 2.986 0 0 0 3.759 1.011.75.75 0 1 0-.96-1.158A1.488 1.488 0 0 1 5.02 8.35a.75.75 0 0 0-1.48-.22A1.485 1.485 0 0 1 4.5 6a1.5 1.5 0 0 1 2.607-1.096A1.486 1.486 0 0 1 9 6a1.5 1.5 0 0 1-.98 1.378c-.02.012-.04.025-.061.038Zm9.469-1.066A1.5 1.5 0 1 0 15 6a1.486 1.486 0 0 1 1.893-1.096A1.5 1.5 0 0 1 19.5 6a1.486 1.486 0 0 1-.98 1.378c-.02.012-.04.025-.061.038a.75.75 0 1 0 .96 1.158 2.986 2.986 0 0 0-3.76-1.011.75.75 0 1 0-.96 1.158 2.986 2.986 0 0 0 .042-.442 3 3 0 1 0-4.48 2.215.75.75 0 1 0 .96 1.158 1.5 1.5 0 0 1 2.24-1.107.75.75 0 0 0 .25-.065c.01-.005.021-.009.031-.014a1.492 1.492 0 0 1 .718-.186 1.5 1.5 0 0 1 .282 2.969.75.75 0 1 0 .424 1.408 3 3 0 0 0-.282-5.938 2.992 2.992 0 0 0-.718.187c-.01.005-.021-.009-.031-.014a.75.75 0 0 0-.25.065Z" clip-rule="evenodd" /></svg>`;
export const MAX_RECENT_RECIPE_SEARCHES = 5; // Max number of recent recipe searches to store
export const MAX_INGREDIENT_IMAGES = 5; // Max images for recipe from ingredients feature

// Achievement (Bragder) Definitions
export const ACHIEVEMENT_DEFINITIONS: Achievement[] = [
  // Streak Achievements
  { id: 'streak_10', name: '10 Dagar i Följd', description: 'Du har hållit din streak i 10 dagar. Imponerande start!', type: 'streak', requiredValue: 10, icon: '🔥' },
  { id: 'streak_20', name: '20 Dagar i Följd', description: '20 dagar av konsekvens. Bra jobbat!', type: 'streak', requiredValue: 20, icon: '🔥' },
  { id: 'streak_30', name: 'Månadsstreak!', description: 'En hel månad av dedikation. Du är på rätt väg!', type: 'streak', requiredValue: 30, icon: '🗓️' },
  { id: 'streak_40', name: '40 Dagar i Följd', description: 'Starkt jobbat med 40 dagar!', type: 'streak', requiredValue: 40, icon: '💪' },
  { id: 'streak_50', name: '50 Dagar i Följd', description: 'Halvvägs till hundra, fantastiskt!', type: 'streak', requiredValue: 50, icon: '💪' },
  { id: 'streak_60', name: 'Tvåmånadersstreak!', description: 'Två månader i rad, vilken uthållighet!', type: 'streak', requiredValue: 60, icon: '🏆' },
  { id: 'streak_70', name: '70 Dagar i Följd', description: '70 dagar av fokus och beslutsamhet!', type: 'streak', requiredValue: 70, icon: '🎯' },
  { id: 'streak_80', name: '80 Dagar i Följd', description: 'Du bygger en otroligt stark vana!', type: 'streak', requiredValue: 80, icon: '🎯' },
  { id: 'streak_90', name: 'Kvartalsstreak!', description: 'Ett helt kvartal av framgång. Otroligt!', type: 'streak', requiredValue: 90, icon: '🌟' },
  { id: 'streak_100', name: 'Hundraklubben!', description: 'Grattis till 100 dagar i följd! Du är en stjärna!', type: 'streak', requiredValue: 100, icon: '💯' },
  { id: 'streak_150', name: '150 Dagar i Följd', description: 'Över 150 dagar, din disciplin är beundransvärd.', type: 'streak', requiredValue: 150, icon: '🚀' },
  { id: 'streak_200', name: '200 Dagar i Följd', description: '200 dagar! Du har skapat en livsstil.', type: 'streak', requiredValue: 200, icon: '🚀' },
  { id: 'streak_250', name: '250 Dagar i Följd', description: 'Ett kvarts tusen dagar, du är ostoppbar!', type: 'streak', requiredValue: 250, icon: '✨' },
  { id: 'streak_300', name: '300 Dagar i Följd', description: 'Du närmar dig ett helt år av framgång!', type: 'streak', requiredValue: 300, icon: '✨' },
  { id: 'streak_365', name: 'Ett Helt År!', description: 'Ett helt år av daglig dedikation. Du är en sann inspiration!', type: 'streak', requiredValue: 365, icon: '💎' },
  { id: 'streak_500', name: '500 Dagar!', description: 'Ett halvt tusen dagar! Vilken otrolig milstolpe.', type: 'streak', requiredValue: 500, icon: '🌌' },
  { id: 'streak_730', name: 'Två Hela År!', description: 'Två år! Ditt engagemang är legendariskt.', type: 'streak', requiredValue: 730, icon: '👑' },
  { id: 'streak_1000', name: '1000-dagarslegend!', description: 'Tusen dagar. Du har nått en nivå få ens kan drömma om.', type: 'streak', requiredValue: 1000, icon: '🤯' },

  // Course Achievement
  { id: 'course_completed', name: 'Kursen Slutförd!', description: 'Grattis! Du har slutfört hela kursen "Praktisk Viktkontroll" och bemästrat kunskapen.', type: 'course', requiredValue: 1, icon: '🎓' },

  // Goal Achievement
  { id: 'main_goal_reached', name: 'Målet Uppnått!', description: 'Du har nått ditt primära vikt- eller kompositionsmål som du satte upp. Fira din framgång!', type: 'goal', requiredValue: 1, icon: '🏁' },
];