
// FIX: Corrected import path for Firestore's Timestamp type
// FIX: Changed import from 'firebase/firestore' to '@firebase/firestore' to resolve missing member error.
import { Timestamp } from "@firebase/firestore";
import { MentalWellbeingData } from "./components/MentalWellbeingModal";

// --- Core Nutritional & Goal Types ---

export interface ChartDataset {
  label: string;
  data: (number | null)[];
}

export interface ChartData {
  chartType: 'line';
  title: string;
  labels: string[];
  datasets: ChartDataset[];
}

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
  waterGoal?: number;
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

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface LoggedMeal {
  id: string;
  timestamp: number; // Client-side timestamp of when the log entry was created/finalized
  dateString: string; // YYYY-MM-DD string for the day the meal belongs to
  imageUrl?: string; // Can be a Firebase Storage URL or a local data:image SVG string
  nutritionalInfo: NutritionalInfo;
  caloriesCoveredByBank?: number;
  commonMealId?: string; // To identify meals logged from "Common Meals" for grouping
  mealType: MealType; // New field for categorization

  // Frontend-only properties for display logic
  count?: number;
  originalIds?: string[];
}

export interface WeightLogEntry {
  id: string;
  loggedAt: number; // timestamp
  weightKg: number;
  skeletalMuscleMassKg?: number;
  bodyFatMassKg?: number;
  comment?: string;
  reactions?: Reactions;
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
  timestamp: number;
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

// FIX: Define StreakSaver interface
export interface StreakSaver {
  weekId: string;
  available: boolean;
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
  reactions?: Reactions;
  streakForThisDay?: number;
  // FIX: Allow 'streakSaver' as a valid value for savedBy
  savedBy?: "sparpott" | "streakSaver";
  bankedAmount?: number; // Amount saved to bank on this day
}

export interface PastDaysSummaryCollection {
  [dateKey: string]: PastDaySummary; // dateKey is YYYY-MM-DD
}

// --- App State & Views ---

export enum AppStatus {
  IDLE = "IDLE",
  LOADING_CAMERA = "LOADING_CAMERA",
  LOADING_DATA = "LOADING_DATA",
  ANALYZING = "ANALYZING",
  ANALYZING_TEXT = "ANALYZING_TEXT",
  ANALYZING_FEEDBACK = "ANALYZING_FEEDBACK",
  SEARCHING_BARCODE = "SEARCHING_BARCODE",
  ERROR = "ERROR",
  PROCESSING_DAY_END = "PROCESSING_DAY_END",
  SEARCHING_RECIPE = "SEARCHING_RECIPE",
  ANALYZING_INGREDIENTS = "ANALYZING_INGREDIENTS",
  INGREDIENT_ANALYSIS_SUCCESS = "INGREDIENT_ANALYSIS_SUCCESS",
  SAVING = "SAVING",
}

export type ViewMode =
  | "main"
  | "journey"
  | "coursesView"
  | "courseOverview"
  | "lessonDetail"
  | "community";

// --- User Profile & Roles ---

export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "lose_fat" | "maintain" | "gain_muscle";
export type UserRole = "member" | "coach" | "admin";
export type DayOfWeek =
  | "måndag"
  | "tisdag"
  | "onsdag"
  | "torsdag"
  | "fredag"
  | "lördag"
  | "söndag";

export type CoachStyle = 'soft' | 'balanced' | 'hard';

export interface NotificationSettings {
  // Social notifications
  friendRequests: boolean;
  newEvents: boolean;
  comments: boolean;
  likes: boolean; // Add this
  messages: boolean; // Chat messages
  // Reminder notifications
  waterReminder: boolean;
  foodReminder: boolean;
  weighInReminder: boolean;
  inactivityReminder: boolean;
  milestoneNudge: boolean;
}

export interface UserProfileData {
  name?: string;
  currentWeightKg?: number;
  heightCm?: number;
  ageYears?: number;
  gender: Gender;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  photoURL?: string;

  measurementMethod?: "inbody" | "scale";
  desiredWeightChangeKg?: number;

  skeletalMuscleMassKg?: number;
  bodyFatMassKg?: number;
  desiredFatMassChangeKg?: number;
  desiredMuscleMassChangeKg?: number;
  goalCompletionDate?: string;
  goalStartDate?: string; // New field to lock the timeline start date
  isSearchable?: boolean;
  goalStartWeight?: number;
  goalStartMuscleMassKg?: number;
  goalStartFatMassKg?: number;
  mainGoalCompleted?: boolean;
  completedGoals?: CompletedGoal[];
  notificationSettings: NotificationSettings;
  preferredWeighInDay?: DayOfWeek;
  // New fields for course access management
  isCourseActive?: boolean;
  courseInterest?: boolean;
  coachStyle: CoachStyle; // New field for coaching style
  
  // Subscription fields
  subscriptionStatus?: 'active' | 'canceling' | 'canceled';
  currentPeriodEnd?: string; // ISO date string
}

// Firestore user document structure
export interface FirestoreUserDocument extends Omit<UserProfileData, "name"> {
  uid: string;
  email: string | null;
  displayName: string;
  role: UserRole;
  status: "pending" | "approved" | "archived";
  hasCompletedOnboarding: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  lastLogDate: string | null;
  goals: GoalSettings;
  currentStreak: number;
  lastDateStreakChecked: string | null;

  /** Första dag vi tillåter dagssummeringar. Format: 'YYYY-MM-DD' (Europe/Stockholm). */
  summaryStartDate?: string | null; // <-- tillagt fält
  streakSaver?: StreakSaver | null; // FIX: Add streakSaver property

  highestStreak: number;
  highestLevelId: string | null;
  weeklyBank: WeeklyCalorieBank;
  unlockedAchievements: { [id: string]: string };
  achievementInteractions?: { [achievementId: string]: { reactions: Reactions } };
  journeyAnalysisFeedback: AIStructuredFeedbackResponse | null;
  courseProgressSummary?: {
    started: boolean;
    completedLessons: number;
    totalLessons: number;
  };
  pushSubscriptions?: object[]; // Stores web push notification subscription objects
  timezone?: string;
  lastWaterReminderSent?: string;
  lastFoodReminderSent?: string;
  lastInactivityReminderSent?: string;
  lastMilestoneNudgeSentFor?: string;
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
  type: "streak" | "course" | "goal";
  requiredValue: number;
  icon: string;
}

// --- Onboarding ---

export interface OnboardingChecklistItemStatus {
  mealLogged: boolean;
  waterLogged: boolean;
  journeyViewed: boolean;
  communityViewed: boolean;
}

export interface OnboardingChecklistState {
  firstSeenDate: string; // ISO date string YYYY-MM-DD
  items: OnboardingChecklistItemStatus;
  dismissed: boolean;
}

// --- Course & Lessons ---

export interface CourseLesson {
  id: string;
  title: string;
  introduction: string;
  detailedText?: string;
  focusPoints: {
    id: string;
    text: string;
    cta?: {
      label: string;
      action:
        | "openSpeedDial"
        | "navigateToJourneyCalendar"
        | "navigateToJourneyGoals"
        | "openLogWeightModal";
    };
  }[];
  tips: { id: string; text: string }[];
  reflection: { id: string; question: string };
  aiPromptHint?: "challenges" | "plateau";
  specialAction?: {
    type: "writeWhy" | "smartGoal";
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
  mentalWellbeing: MentalWellbeingData;
}

export interface AIDataForLessonIntro {
  userName: string | undefined;
  lessonTitle: string;
  userProfile: UserProfileData;
  pastDaysSummary: PastDaySummary[];
  weightLogs: WeightLogEntry[];
}

export interface TimelineMilestone {
  dateString: string; // Formatted date for display
  isoDate: string; // ISO date string (YYYY-MM-DD) for comparisons
  targetDescription: string;
  targetWeightKg: number;
  isFinal: boolean;
}

export interface AIDataForJourneyAnalysis {
  userProfile: UserProfileData;
  goals: GoalSettings;
  allWeightLogs: WeightLogEntry[];
  last30DaysSummaries: PastDaySummary[];
  goalTimeline: {
    milestones: TimelineMilestone[];
    paceFeedback: { type: string; text: string } | null;
  };
  mentalWellbeingLogs?: MentalWellbeingLog[];
  currentStreak: number;
  userCourseProgress?: UserCourseProgress;
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

// --- Coach & Admin Types ---

export interface CoachViewMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "pending" | "approved" | "archived";
  photoURL?: string;
  memberSince: string;
  lastLogDate?: string;
  currentStreak: number;
  goalSummary: string;
  proteinGoalMetPercentage7d?: number;
  goalAdherence?: "good" | "average" | "poor" | "inactive";
  courseProgressSummary?: {
    started: boolean;
    completedLessons: number;
    totalLessons: number;
  };
  weeklyWeightChange?: number;
  ageYears?: number;
  gender: Gender;
  numberOfBuddies?: number;
  // New fields for course access management
  isCourseActive?: boolean;
  courseInterest?: boolean;
}

// --- Chat & Community Types ---

export type ChatType = 'coach_group' | 'private_group' | 'public_room' | 'direct';

export type NotificationLevel = 'all' | 'mentions' | 'mute';

export interface ChatMemberSettings {
  notificationLevel: NotificationLevel;
  lastReadTimestamp: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  text: string;
  imageUrl?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  timestamp: number;
  mentions?: string[]; // Array of userIds
  likes?: string[]; // Legacy: Array of userIds who liked the message
  reactions?: Reactions;
  replyTo?: {
    messageId: string;
    senderName: string;
    text: string;
    imageUrl?: string;
  };
  sharedEventPreview?: {
    id: string;
    title: string;
    description: string;
    icon: string;
    imageUrl?: string;
    type: string;
  };
}

export interface Chat {
  id: string;
  type: ChatType;
  name?: string;
  description?: string;
  avatarUrl?: string;
  members: string[]; // Array of userIds
  admins: string[]; // Array of userIds
  invitePermission?: 'admin_only' | 'everyone';
  requiresApproval?: boolean;
  isSystemGroup?: boolean;
  pendingMembers?: string[]; // Array of userIds waiting for approval
  memberSettings: {
    [userId: string]: ChatMemberSettings;
  };
  lastMessage?: {
    text: string;
    timestamp: number;
    senderId: string;
    senderName?: string;
  };
  createdAt: number;
  createdBy: string;
}

// --- Community & Social Types ---

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
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

export interface BuddyDetails extends Peppkompis {
  goalSummary?: string;
  currentStreak?: number;
  unlockedAchievements: { [id: string]: string };
  role?: UserRole;

  // For progress bar
  goalStartWeight?: number;
  goalStartMuscleMassKg?: number;
  goalStartFatMassKg?: number;
  currentWeight?: number;
  goalType: GoalType;
  mainGoalCompleted?: boolean;

  // For detailed stats
  totalWeightChange?: number;
  currentMuscleMass?: number;
  muscleMassChange?: number;
  currentFatMass?: number;
  fatMassChange?: number;

  // From profile for goal calculation
  measurementMethod?: "inbody" | "scale";
  desiredWeightChangeKg?: number;
  desiredFatMassChangeKg?: number;
  desiredMuscleMassChangeKg?: number;

  // For interactions
  achievementInteractions?: { [achievementId: string]: { reactions: Reactions } };
}

export type TimelineEventType =
  | "weight"
  | "achievement"
  | "streak"
  | "course"
  | "level"
  | "goal"
  | "goal_achieved"
  | "goal_set"
  | "user_post"; // Added user_post

export type PostCategory = 'general' | 'food' | 'workout' | 'question' | 'pepp';

export interface Reactions {
  [emoji: string]: {
    // e.g., '👍'
    [uid: string]: string; // key is UID, value is user's name
  };
}

export interface TimelineComment {
  id: string; // Firestore document ID
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  text: string;
  timestamp: number;
  likes?: {
    [uid: string]: string; // key is UID, value is user's name
  };
}

export interface TimelineEvent {
  id: string; // A unique ID for the event in the UI (e.g., 'weight_docId')
  type: TimelineEventType;
  timestamp: number;
  title: string;
  description: string;
  icon: string;

  // New fields for User Posts
  imageUrl?: string; // Optional image (Base64 or URL)
  category?: PostCategory; // For filtering/styling

  // New reaction and comment structure
  reactions: Reactions;
  comments: TimelineComment[];

  relatedDocPath: string; // Firestore path to the source document

  // Info about the user who generated the event
  userId: string;
  userName: string;
  userPhotoURL?: string;
  gender: Gender;
  visibleTo?: string[];
  isGlobal?: boolean;
}
