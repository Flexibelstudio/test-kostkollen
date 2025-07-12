import { FieldValue } from "@firebase/firestore";

export interface NutritionalInfo {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  foodItem?: string; // Optional: Gemini might provide this
}

export interface SearchedFoodInfo extends NutritionalInfo {
  servingDescription: string; // e.g., "100g", "1 medium (approx 150g)"
}

export interface GoalSettings {
  calorieGoal: number;
  proteinGoal: number;
  carbohydrateGoal: number; // Added
  fatGoal: number; // Added
}

export interface LoggedMeal {
  id: string;
  timestamp: number; // Client-side timestamp of when the log entry was created/finalized
  dateString: string; // YYYY-MM-DD string for the day the meal belongs to
  imageDataUrl?: string; // base64 data URL for the image, now optional
  nutritionalInfo: NutritionalInfo;
  caloriesCoveredByBank?: number; // Added to track bank usage per meal
}

export interface CommonMeal {
  id: string;
  name: string;
  nutritionalInfo: NutritionalInfo;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING_CAMERA = 'LOADING_CAMERA',
  ANALYZING = 'ANALYZING',
  ANALYZING_TEXT = 'ANALYZING_TEXT', // New status for text search
  SEARCHING_BARCODE = 'SEARCHING_BARCODE',
  ERROR = 'ERROR',
  PROCESSING_DAY_END = 'PROCESSING_DAY_END', // New status for automatic day processing
  SEARCHING_RECIPE = 'SEARCHING_RECIPE', // New status for recipe search
  ANALYZING_INGREDIENTS = 'ANALYZING_INGREDIENTS', // For ingredient to recipe feature
  INGREDIENT_ANALYSIS_SUCCESS = 'INGREDIENT_ANALYSIS_SUCCESS', // After successful ingredient analysis
}

export interface PastDaySummary {
  date: string; // YYYY-MM-DD
  goalMet: boolean; // Represents calorie goal met based on goalType for that day
  consumedCalories: number;
  calorieGoal: number;
  proteinGoalMet: boolean;
  consumedProtein: number;
  proteinGoal: number;
  consumedCarbohydrates: number;
  carbohydrateGoal: number;
  consumedFat: number;
  fatGoal: number;
  goalType: GoalType; // Added to know which goal type was active for this day
  isBinaryOrigin?: boolean; // New field: true if summary came from a binary "Met/Not Met" choice
  waterGoalMet?: boolean; // Tracks if the 2000ml water goal was met
  pepps?: { [fromUid: string]: string; }; // NEW: Map of user UIDs to names for those who "pepped"
}

export interface PastDaysSummaryCollection {
  [dateKey: string]: PastDaySummary; // dateKey is YYYY-MM-DD
};

export type ViewMode = 'main' | 'journey' | 'courseOverview' | 'lessonDetail' | 'buddies' | 'chat';

export interface DailyWaterLog {
  dateUID: string; // YYYY-MM-DD to match food log daily reset logic
  waterLoggedMl: number;
}

// New types for User Profile feature
export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose_fat' | 'maintain' | 'gain_muscle';

export interface UserProfileData {
  name?: string; // User's first name for personalization
  currentWeightKg?: number; // Made optional for onboarding
  heightCm?: number;       // Made optional for onboarding
  ageYears?: number;       // Made optional for onboarding
  gender: Gender;
  activityLevel: ActivityLevel;
  goalType: GoalType; // This will be derived if desired changes are set
  
  measurementMethod?: 'inbody' | 'scale'; // To distinguish between goal setting methods
  desiredWeightChangeKg?: number; // For 'scale' measurement method
  
  skeletalMuscleMassKg?: number; // Optional: From InBody etc.
  bodyFatMassKg?: number;       // Optional: From InBody etc.
  desiredFatMassChangeKg?: number; // Optional: User's desired change in fat mass (e.g., -5 for 5kg loss)
  desiredMuscleMassChangeKg?: number; // Optional: User's desired change in muscle mass (e.g., +2 for 2kg gain)
  goalCompletionDate?: string; // Optional: YYYY-MM-DD
  isCourseActive?: boolean; // NEW: To be toggled by a coach
  courseInterest?: boolean; // NEW: To track user interest in the course
}

export interface CalculatedNutritionalRecommendations {
  bmr: number;
  tdee: number;
  recommendedCalories: number;
  recommendedProteinGrams: number;
  recommendedFatGrams: number;
  recommendedCarbsGrams: number;
}

// New type for Gamification Levels
export interface Level {
  id: string;
  name: string;
  requiredStreak: number;
  icon?: string; // Emoji or SVG data URL path
  description: string;
}

// New type for Weekly Calorie Bank
export interface WeeklyCalorieBank {
  weekId: string; // Format: "YYYY-WW" e.g., "2023-42"
  bankedCalories: number;
  startDate: string; // ISO date string "YYYY-MM-DD" for Monday
  endDate: string; // ISO date string "YYYY-MM-DD" for Sunday
}

// Course Feature Types
export interface CourseFocusPoint {
  id: string;
  text: string;
  cta?: {
    label: string;
    action: 'openSpeedDial' | 'navigateToJourneyCalendar' | 'navigateToJourneyGoals' | 'openLogWeightModal';
  };
}

export interface CourseTip {
  id: string;
  text: string;
}

export interface CourseReflection {
  id: string;
  question: string;
}

export interface CourseLesson {
  id: string; // e.g., "lektion1"
  title: string;
  introduction: string;
  focusPoints: CourseFocusPoint[];
  tips: CourseTip[];
  reflection: CourseReflection;
  specialAction?: {
    type: 'writeWhy' | 'smartGoal';
    prompt: string;
    description?: string; // Optional longer description for SMART goals
  };
  aiPromptHint?: 'challenges' | 'plateau'; // For personalized intros
}

export interface UserLessonProgress {
  completedFocusPoints: string[]; // array of focusPoint ids
  reflectionAnswer: string | null;
  whyAnswer?: string | null; // For Week 1's "why"
  smartGoalAnswer?: string | null; // For Week 1's SMART Goal
  isCompleted: boolean;
  unlockedAt?: number; // Timestamp when the lesson was unlocked
  streakAtUnlock?: number; // The user's current streak when the lesson was unlocked
}

export interface UserCourseProgress {
  [lessonId: string]: UserLessonProgress;
}

// Types for AI Recipe Feature
export interface RecipeIngredient {
  item: string; // e.g., "2 st kycklingfiléer, ca 300g totalt"
}

export interface RecipeSuggestion {
  title: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  totalNutritionalInfo: NutritionalInfo;
  chefTip?: string;
  error?: string; // For cases where the query isn't recipe-like
}

// Type for AI Coach Feedback
export interface AIDataForFeedback {
  userName?: string;
  todayTotals: { calories: number; protein: number; carbohydrates: number; fat: number; };
  userGoals: GoalSettings;
  userProfile: UserProfileData;
  currentStreak: number;
  activeLesson?: {
    title: string;
    focusPoints?: string[];
    reflectionQuestion?: string;
    reflectionAnswer?: string | null;
  } | null;
  isOnboarding?: boolean; // New flag for onboarding context
}

// Type for AI Lesson Intro
export interface AIDataForLessonIntro {
  userName?: string;
  lessonTitle: string;
  userProfile: UserProfileData;
  pastDaysSummary: PastDaySummary[];
  weightLogs: WeightLogEntry[];
}


// Type for User Role
export type UserRole = 'member' | 'coach';

// Type for Coach View Member Data
export interface CoachViewMember {
  id: string; // UID
  name: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'approved';
  ageYears?: number;
  gender?: Gender;
  isCourseActive?: boolean;
  courseInterest?: boolean; // NEW: To track interest
  memberSince: string; // YYYY-MM-DD from createdAt
  lastLogDate?: string;
  currentStreak?: number; // Added for streak count
  goalSummary?: string; // Added for "mål satt"
  proteinGoalMetPercentage7d: number; // Percentage of logged days in last 7 days where protein goal was met
  courseProgressSummary?: {
    started: boolean;
    completedLessons: number;
    totalLessons: number;
  };
  goalAdherence?: 'good' | 'average' | 'poor' | 'inactive';
  weeklyWeightChange?: number;
}

// Type for Ingredient-based Recipe Suggestion
export interface IngredientRecipeResponse {
  identifiedIngredients: string[];
  recipeSuggestions: RecipeSuggestion[];
}

// Type for Weight Tracking
export interface WeightLogEntry {
  id: string; // Firestore document ID
  loggedAt: number; // Client-side timestamp in milliseconds
  weightKg: number;
  skeletalMuscleMassKg?: number | null;
  bodyFatMassKg?: number | null;
  comment?: string | null;
  pepps?: { [fromUid: string]: { name: string; timestamp: number; } };
}

// Type for InBody Scan result
export interface InBodyScanData {
  weightKg: number;
  skeletalMuscleMassKg?: number;
  bodyFatMassKg?: number;
  timestamp?: number;
}

// Type for Mental Wellbeing Tracking
export interface MentalWellbeingLog {
  id: string;
  loggedAt: number;
  dateString: string; // YYYY-MM-DD
  stressLevel: number | null; // 1=low stress, 5=high stress
  energyLevel: number | null; // 1=low energy, 5=high energy
  sleepQuality: number | null; // 1=bad, 5=good
  mood: number | null; // 1=bad, 5=good
  relatedWeightLogId?: string; // Optional: To link it to the weight log that triggered it
}


// Firestore User Document (root level /users/{userId})
export interface FirestoreUserDocument {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  status: 'pending' | 'approved';
  isCourseActive: boolean;
  courseInterest?: boolean; // NEW: To track interest
  isSearchable?: boolean; // NEW: For buddy system
  hasCompletedOnboarding: boolean;
  createdAt: FieldValue;
  lastLoginAt: FieldValue;
  lastLogDate?: string | null;
  // Dynamic user data also stored at the root
  goals: GoalSettings;
  goalType: GoalType;
  ageYears?: number | null;
  gender?: Gender;
  currentWeightKg?: number | null; // Denormalized for coach view
  measurementMethod: 'inbody' | 'scale' | null;
  desiredWeightChangeKg: number | null;
  desiredFatMassChangeKg: number | null;
  desiredMuscleMassChangeKg: number | null;
  currentStreak: number;
  lastDateStreakChecked: string | null;
  highestStreak: number;
  highestLevelId: string | null;
  weeklyBank: WeeklyCalorieBank;
  courseProgressSummary?: {
    started: boolean;
    completedLessons: number;
    totalLessons: number;
  };
  unlockedAchievements?: { [achievementId: string]: string }; // id -> ISO date string
}

// New type for Goal Timeline
export interface TimelineMilestone {
  dateString: string; // "Mån dd"
  isoDate: string; // "YYYY-MM-DD"
  targetDescription: string; // "Mål: 75.5 kg"
  targetWeightKg: number;
  isFinal: boolean;
}

// New type for structured AI feedback
export interface AIFeedbackSection {
  emoji: string;
  title: string;
  content: string;
}
export interface AIStructuredFeedbackResponse {
  greeting: string;
  sections: AIFeedbackSection[];
}

// Type for Detailed AI Journey Analysis
export interface AIDataForJourneyAnalysis {
  userProfile: UserProfileData;
  allWeightLogs: WeightLogEntry[];
  last30DaysSummaries: PastDaySummary[];
  goalTimeline: {
    milestones: TimelineMilestone[];
    paceFeedback: { type: string; text: string } | null;
  };
}

// Type for Barcode Scanning Feature
export interface BarcodeScannedFoodInfo {
  name: string;
  brand: string;
  imageUrl?: string;
  nutrientsPer100g: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
  };
  servingSizeG?: number; // Optional serving size in grams
}

// New type for Achievements (Bragder)
export interface Achievement {
  id: string;
  name: string;
  description: string;
  type: 'streak' | 'goal' | 'course';
  requiredValue: number; // For streak: days. For others: 1 (as a flag).
  icon: string; // Emoji
}

export interface AchievementInteraction {
  id: string; // Corresponds to achievementId
  pepps: { [fromUid: string]: { name: string; timestamp: number; } };
}


// New type for AI Coach Summary
export interface AIDataForCoachSummary {
  memberName: string;
  memberProfile: UserProfileData;
  last7DaysSummaries: PastDaySummary[];
  last5WeightLogs: WeightLogEntry[];
  currentStreak: number;
  lastLogDate?: string;
  isCourseActive?: boolean;
  courseProgressSummary?: {
    started: boolean;
    completedLessons: number;
    totalLessons: number;
  };
}

// New types for "Peppkompis" (Buddy) System
export interface Peppkompis {
  uid: string;
  name: string;
  email: string;
}

export interface PeppkompisRequest {
  id: string; // Firestore document ID
  fromUid: string;
  fromName: string;
  fromEmail: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export interface BuddyDetails extends Peppkompis {
  goalSummary?: string;
  yesterdayGoalMet?: boolean | undefined; // true, false, or undefined if no log
  currentStreak?: number;
  yesterdayPeppCount?: number;
  currentUserHasPepped?: boolean;
  unlockedAchievements?: { [achievementId: string]: string };
  currentWeight?: number;
  totalWeightChange?: number;
  muscleMassChange?: number;
  fatMassChange?: number;
  lastWeightLogTimestamp?: number;
  lastAchievementTimestamp?: number;
  currentMuscleMass?: number;
  currentFatMass?: number;
}

export interface BuddySummary {
    name: string;
    currentWeight?: number;
    totalWeightChange?: number;
    muscleMassChange?: number;
    fatMassChange?: number;
    currentStreak?: number;
    goalSummary?: string;
}

// NEW type for unified feed display
export interface TimelineEvent {
    id: string; // composite key e.g., "weight-log-id" or "ach-achievement-id"
    type: 'weight' | 'achievement';
    timestamp: number;
    title: string;
    description: string;
    icon: string; // emoji
    pepps: { [fromUid: string]: { name: string; timestamp: number; } };
    peppedByCurrentUser: boolean;
    relatedDocId: string; // the original document id (weight log id or achievement id)
}

// NEW TYPES FOR CHAT
export interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    timestamp: number;
    imageDataUrl?: string; // base64 Data URL for the image
    likes?: { [userId: string]: boolean }; // Map of user UIDs to true if they liked it
}

export interface Chat {
    id: string; // The chat document ID (e.g., uid1_uid2)
    participants: Peppkompis[]; // Details of both participants
    participantUids: string[]; // Array of UIDs for easy querying
    lastMessage?: {
        text: string;
        timestamp: number;
        senderId: string;
    };
    unreadCounts: { [userId: string]: number }; // e.g., { "user1_uid": 0, "user2_uid": 3 }
}
