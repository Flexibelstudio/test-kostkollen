import { FieldValue, Timestamp } from "@firebase/firestore";

// --- Core Nutritional & Goal Types ---

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
  carbohydrateGoal: number;
  fatGoal: number;
}

export interface CalculatedNutritionalRecommendations {
    bmr: number;
    tdee: number;
    recommendedCalories: number;
    recommendedProteinGrams: number;
    recommendedFatGrams: number;
    recommendedCarbsGrams: number;
}

// --- Logging & Data Structures ---

export interface LoggedMeal {
  id: string;
  timestamp: number; // Client-side timestamp of when the log entry was created/finalized
  dateString: string; // YYYY-MM-DD string for the day the meal belongs to
  imageDataUrl?: string; // base64 data URL for the image, now optional
  nutritionalInfo: NutritionalInfo;
  caloriesCoveredByBank?: number;
}

export interface WeightLogEntry {
    id: string;
    loggedAt: number; // timestamp
    weightKg: number;
    skeletalMuscleMassKg?: number;
    bodyFatMassKg?: number;
    comment?: string;
    pepps?: { [fromUid: string]: { name: string; timestamp: number } };
}

export interface MentalWellbeingLog {
    id: string;
    loggedAt: number;
    dateString: string;
    stressLevel: number | null;
    energyLevel: number | null;
    sleepQuality: number | null;
    mood: number | null;
    relatedWeightLogId?: string;
}

export interface CommonMeal {
  id: string;
  name: string;
  nutritionalInfo: NutritionalInfo;
}

export interface DailyWaterLog {
  dateUID: string; // YYYY-MM-DD to match food log daily reset logic
  waterLoggedMl: number;
}

export interface WeeklyCalorieBank {
    weekId: string; // e.g., "2024-W30"
    bankedCalories: number;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
}

export interface PastDaySummary {
  date: string; // YYYY-MM-DD
  goalMet: boolean;
  consumedCalories: number;
  calorieGoal: number;
  proteinGoalMet: boolean;
  consumedProtein: number;
  proteinGoal: number;
  consumedCarbohydrates: number;
  carbohydrateGoal: number;
  consumedFat: number;
  fatGoal: number;
  goalType: GoalType;
  isBinaryOrigin?: boolean;
  waterGoalMet?: boolean;
  pepps?: { [fromUid: string]: { name: string; timestamp: number }; };
  streakForThisDay?: number;
}

export interface PastDaysSummaryCollection {
  [dateKey: string]: PastDaySummary; // dateKey is YYYY-MM-DD
}

// --- App State & Views ---

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING_CAMERA = 'LOADING_CAMERA',
  LOADING_DATA = 'LOADING_DATA',
  ANALYZING = 'ANALYZING',
  ANALYZING_TEXT = 'ANALYZING_TEXT',
  SEARCHING_BARCODE = 'SEARCHING_BARCODE',
  ERROR = 'ERROR',
  PROCESSING_DAY_END = 'PROCESSING_DAY_END',
  SEARCHING_RECIPE = 'SEARCHING_RECIPE',
  ANALYZING_INGREDIENTS = 'ANALYZING_INGREDIENTS',
  INGREDIENT_ANALYSIS_SUCCESS = 'INGREDIENT_ANALYSIS_SUCCESS',
}

export type ViewMode = 'main' | 'journey' | 'courseOverview' | 'lessonDetail' | 'community';

// --- User Profile & Roles ---

export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose_fat' | 'maintain' | 'gain_muscle';
export type UserRole = 'member' | 'coach' | 'admin';

export interface UserProfileData {
  name?: string;
  currentWeightKg?: number;
  heightCm?: number;
  ageYears?: number;
  gender: Gender;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  photoURL?: string;
  
  measurementMethod?: 'inbody' | 'scale';
  desiredWeightChangeKg?: number;
  
  skeletalMuscleMassKg?: number;
  bodyFatMassKg?: number;
  desiredFatMassChangeKg?: number;
  desiredMuscleMassChangeKg?: number;
  goalCompletionDate?: string;
  isCourseActive?: boolean;
  courseInterest?: boolean;
  isSearchable?: boolean;
  goalStartWeight?: number;
  mainGoalCompleted?: boolean;
  completedGoals?: CompletedGoal[];
}

// --- Gamification & Achievements ---

export interface CompletedGoal {
  id: string; // e.g., timestamp or a unique ID
  achievedOn: string; // ISO date string
  description: string; // "Minskade 5kg fettmassa"
  startWeight: number;
  endWeight: number;
}


export interface Level {
    id: string;
    name: string;
    requiredStreak: number;
    icon: string;
    description: string;
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    type: 'streak' | 'course' | 'goal';
    requiredValue: number;
    icon: string;
}

// --- Course & Lessons ---

export interface CourseLesson {
    id: string;
    title: string;
    introduction: string;
    focusPoints: { id: string; text: string; cta?: { label: string; action: 'openSpeedDial' | 'navigateToJourneyCalendar' | 'navigateToJourneyGoals' | 'openLogWeightModal'; }; }[];
    tips: { id: string; text: string; }[];
    reflection: { id: string; question: string; };
    aiPromptHint?: 'challenges' | 'plateau';
    specialAction?: {
        type: 'writeWhy' | 'smartGoal';
        prompt: string;
        description: string;
    };
}

export interface UserLessonProgress {
    completedFocusPoints: string[];
    reflectionAnswer: string | null;
    isCompleted: boolean;
    unlockedAt?: number;
    streakAtUnlock?: number;
    whyAnswer?: string;
    smartGoalAnswer?: string;
}

export interface UserCourseProgress {
    [lessonId: string]: UserLessonProgress;
}

// --- AI & External Service Types ---

export interface RecipeSuggestion {
    title: string;
    description: string;
    prepTime: string;
    cookTime: string;
    servings: string;
    ingredients: { item: string }[];
    instructions: string[];
    totalNutritionalInfo: NutritionalInfo;
    chefTip?: string;
    error?: string;
}

export interface IngredientRecipeResponse {
    identifiedIngredients: string[];
    recipeSuggestions: RecipeSuggestion[];
}

export interface AIDataForFeedback {
  userName: string | undefined;
  todayTotals: NutritionalInfo;
  userGoals: GoalSettings;
  userProfile: UserProfileData;
  currentStreak: number;
  activeLesson: CourseLesson | null;
  isOnboarding?: boolean;
}

export interface AIDataForLessonIntro {
    userName: string | undefined;
    lessonTitle: string;
    userProfile: UserProfileData;
    pastDaysSummary: PastDaySummary[];
    weightLogs: WeightLogEntry[];
}

export interface AIDataForJourneyAnalysis {
    userProfile: UserProfileData;
    allWeightLogs: WeightLogEntry[];
    last30DaysSummaries: PastDaySummary[];
    goalTimeline: { milestones: TimelineMilestone[]; paceFeedback: { type: string, text: string } | null };
    mentalWellbeingLogs?: MentalWellbeingLog[];
}

export interface AIDataForCoachSummary {
    memberName: string;
    memberProfile: UserProfileData;
    last7DaysSummaries: PastDaySummary[];
    last5WeightLogs: WeightLogEntry[];
    currentStreak: number;
    lastLogDate?: string | null;
    courseProgressSummary?: {
        started: boolean;
        completedLessons: number;
        totalLessons: number;
    };
}

export interface AIFeedbackSection {
    emoji: string;
    title: string;
    content: string;
}

export interface AIStructuredFeedbackResponse {
    greeting: string;
    sections: AIFeedbackSection[];
    analysisDate?: string;
}

export interface BarcodeScannedFoodInfo {
    name: string;
    brand: string;
    imageUrl?: string;
    servingSizeG?: number;
    nutrientsPer100g: NutritionalInfo;
}

export interface InBodyScanData {
    weightKg: number;
    skeletalMuscleMassKg?: number;
    bodyFatMassKg?: number;
    timestamp?: number;
}


// --- Community & Peppkompis Types ---

export interface Peppkompis {
    uid: string;
    name: string;
    email: string;
    photoURL?: string;
    gender?: Gender;
}

export interface PeppkompisRequest {
    id: string;
    fromUid: string;
    fromName: string;
    fromEmail: string;
    toUid: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: number;
}

export interface BuddyDetails extends Peppkompis {
    goalSummary?: string;
    goalCompletionDate?: string;
    yesterdayGoalMet?: boolean;
    currentStreak?: number;
    yesterdayPeppCount: number;
    currentUserHasPepped: boolean;
    unlockedAchievements: { [id: string]: string };
    currentWeight?: number;
    totalWeightChange?: number;
    muscleMassChange?: number;
    fatMassChange?: number;
    currentMuscleMass?: number;
    currentFatMass?: number;
    lastWeightLogTimestamp?: number;
    lastAchievementTimestamp?: number;
    startWeight?: number;
    goalType?: GoalType;
    measurementMethod?: 'inbody' | 'scale';
    desiredWeightChangeKg?: number;
    desiredFatMassChangeKg?: number;
    desiredMuscleMassChangeKg?: number;
    gender?: Gender;
    mainGoalCompleted?: boolean;
    goalStartWeight?: number;
}

export interface BuddySummary {
    uid: string;
    name: string;
    email: string;
    goalSummary: string;
    currentStreak: number;
    yesterdayGoalMet?: boolean;
    yesterdayPeppCount: number;
}

export interface TimelineEvent {
    id: string;
    type: 'weight' | 'achievement' | 'streak' | 'level' | 'course' | 'goal';
    timestamp: number;
    title: string;
    description: string;
    icon: string;
    pepps: { [fromUid: string]: { name: string; timestamp: number } };
    peppedByCurrentUser: boolean;
    relatedDocId: string;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    text: string;
    timestamp: number;
    imageDataUrl?: string;
    likes?: { [userId: string]: boolean };
}

export interface Chat {
    id: string;
    participants: Peppkompis[];
    participantUids: string[];
    lastMessage?: {
        text: string;
        senderId: string;
        timestamp: number | FieldValue | Timestamp;
    };
    unreadCounts: {
        [userId: string]: number;
    };
}


// --- Firestore Document Types ---

export interface FirestoreUserDocument {
    uid: string;
    email: string | null;
    displayName: string;
    role: UserRole;
    status: 'pending' | 'approved';
    isCourseActive: boolean;
    courseInterest?: boolean;
    hasCompletedOnboarding: boolean;
    createdAt: FieldValue;
    lastLoginAt: FieldValue;
    lastLogDate: string | null;
    photoURL?: string | null;
    goals: GoalSettings;
    goalType: GoalType;
    ageYears: number | null;
    gender: Gender;
    activityLevel?: ActivityLevel;
    currentWeightKg?: number | null;
    heightCm?: number | null;
    measurementMethod?: 'inbody' | 'scale';
    desiredWeightChangeKg?: number | null;
    skeletalMuscleMassKg?: number | null;
    bodyFatMassKg?: number | null;
    desiredFatMassChangeKg?: number | null;
    desiredMuscleMassChangeKg?: number | null;
    goalCompletionDate?: string | null;
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
    unlockedAchievements: { [id: string]: string };
    journeyAnalysisFeedback: AIStructuredFeedbackResponse | null;
    isSearchable?: boolean;
    goalStartWeight?: number | null;
    mainGoalCompleted?: boolean;
    completedGoals?: CompletedGoal[];
}

export interface TimelineMilestone {
  dateString: string; // Formatted date for display
  isoDate: string; // ISO date string (YYYY-MM-DD) for comparisons
  targetDescription: string;
  targetWeightKg: number;
  isFinal: boolean;
}

export interface CoachViewMember {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    status: 'pending' | 'approved';
    isCourseActive?: boolean;
    courseInterest?: boolean;
    memberSince: string;
    lastLogDate?: string;
    currentStreak?: number;
    goalSummary?: string;
    photoURL?: string;
    proteinGoalMetPercentage7d?: number;
    goalAdherence?: 'good' | 'average' | 'poor' | 'inactive';
    courseProgressSummary?: {
        started: boolean;
        completedLessons: number;
        totalLessons: number;
    };
    weeklyWeightChange?: number;
    ageYears?: number;
    gender?: Gender;
    numberOfBuddies?: number;
}