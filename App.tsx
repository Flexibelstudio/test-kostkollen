

import React, { useState, useEffect, useCallback, useMemo, useRef, JSX } from 'react';
import { auth, db, persistencePromise } from './firebase';
import { onAuthStateChanged, signOut, type User } from '@firebase/auth';
import { doc, writeBatch } from "@firebase/firestore";

import CoachDashboard from './components/CoachDashboard';
import PendingApprovalScreen from './components/PendingApprovalScreen';


import { NutritionalInfo, GoalSettings, LoggedMeal, AppStatus, PastDaySummary, PastDaysSummaryCollection, ViewMode, DailyWaterLog, CommonMeal, SearchedFoodInfo, UserProfileData, CalculatedNutritionalRecommendations, Level, GoalType, WeeklyCalorieBank, UserCourseProgress, CourseLesson, UserLessonProgress, RecipeSuggestion, AIDataForFeedback, UserRole, FirestoreUserDocument, IngredientRecipeResponse, WeightLogEntry, MentalWellbeingLog, AIDataForJourneyAnalysis, BarcodeScannedFoodInfo, Achievement, AIStructuredFeedbackResponse, AIFeedbackSection, Peppkompis, BuddyDetails, TimelineEvent } from './types.ts';
import { DEFAULT_GOALS, LOCAL_STORAGE_KEYS, MANUAL_LOG_FOOD_ICON_SVG, COMMON_MEAL_LOG_ICON_SVG, DEFAULT_WATER_GOAL_ML, DEFAULT_USER_PROFILE, LEVEL_DEFINITIONS, MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD, PIGGY_BANK_ICON_SVG, CALORIES_PER_GRAM, MAX_RECENT_RECIPE_SEARCHES, MAX_INGREDIENT_IMAGES, ACHIEVEMENT_DEFINITIONS } from './constants.ts';
import { analyzeFoodImage, getNutritionalInfoForTextSearch, getAIFeedback, getRecipeSuggestion, getRecipesFromIngredientsImage, getDetailedJourneyAnalysis } from './services/geminiService.ts';
import { getFoodInfoFromBarcode } from './services/openFoodFactsService.ts';
import { 
    fetchInitialAppData,
    addMealLog,
    deleteMealLog,
    updateMealLog,
    fetchMealLogsForDate,
    setWaterLog,
    fetchWaterLog,
    addCommonMeal,
    deleteCommonMeal as deleteCommonMealFromDB,
    updateCommonMeal,
    saveProfileAndGoals,
    saveWeightLog,
    setPastDaySummary,
    updateUserDocument,
    saveCourseProgress,
    addMentalWellbeingLog,
    ensureUserProfileInFirestore,
    fetchBuddyDetailsList,
    fetchTimelineForCurrentUser,
    listenForTotalUnreadCount,
    getDocSafe
} from "./services/firestoreService"; 
import WaterLogger from './components/WaterLogger.tsx';
import ProgressDisplay from './components/ProgressDisplay.tsx';
import LoadingSpinner from './components/LoadingSpinner.tsx';
import MealItemCard from './components/MealItemCard.tsx';
import { JourneyView } from './components/JourneyView.tsx';
import SaveCommonMealModal from './components/SaveCommonMealModal.tsx';
import { CommonMealsList } from './components/CommonMealsList.tsx';
import InfoModal from './components/InfoModal.tsx';
import UserProfileModal from './components/UserProfileModal.tsx';
import CameraModal from './components/CameraModal.tsx';
import BarcodeScannerModal from './components/BarcodeScannerModal.tsx';
import BarcodeSearchResultModal from './components/BarcodeSearchResultModal.tsx';
import ToastNotification from './components/ToastNotification.tsx'; 
import ImageAnalysisResultModal from './components/ImageAnalysisResultModal.tsx'; 
import ConfettiCelebration from './components/ConfettiCelebration.tsx';
import LevelUpModal from './components/LevelUpModal.tsx';
import GoalMetModal from './components/GoalMetModal.tsx'; 
// Course components
import CourseOverview from './components/course/CourseOverview.tsx';
import LessonDetail from './components/course/LessonDetail.tsx';
import { courseLessons } from './courseData.ts'; 
import CourseInfoModal from './components/course/CourseInfoModal.tsx';
import NewLessonUnlockedModal from './components/course/NewLessonUnlockedModal.tsx';
import RecipeModal from './components/RecipeModal.tsx';
import TextEntryModal from './components/TextEntryModal.tsx';
import IngredientCaptureModal from './components/IngredientCaptureModal.tsx';
import IngredientRecipeResultsModal from './components/IngredientRecipeResultsModal.tsx';
import WeeklyProgressDays from './components/WeeklyProgressDays.tsx';
import { AuthForm } from './components/AuthForm.tsx';
import GamificationCard from './components/GamificationCard.tsx';
import LogWeightModal from './components/LogWeightModal.tsx';
import MentalWellbeingModal, { MentalWellbeingData } from './components/MentalWellbeingModal.tsx';
import BmrTdeeInfoModal from './components/BmrTdeeInfoModal.tsx';
import OnboardingCompletionScreen from './components/OnboardingCompletionScreen.tsx';
import BuddySystemView from './components/BuddySystemView.tsx';
import BuddyListView from './components/BuddyListView.tsx';
import PeppNotificationsModal from './components/PeppNotificationsModal.tsx';
import { ChatView } from './components/ChatView.tsx';



import { calculateRecommendations } from './utils/nutritionalCalculations.ts';
import { calculateGoalTimeline } from './utils/timelineUtils.ts';
import { initAudio, playAudio } from './services/audioService.ts'; 
import { FireIcon, ProteinIcon, LeafIcon, PlusCircleIcon, CheckCircleIcon, HistoryIcon, BookmarkIcon, CameraIcon, UploadIcon, CheckIcon as ConfirmIcon, InformationCircleIcon, XMarkIcon, UserCircleIcon, ExclamationTriangleIcon, CourseIcon, AICoachIcon, RotateCcwIcon as RefreshIcon, PlusIcon, SearchIcon, ArrowRightOnRectangleIcon, RecipeIcon, UserGroupIcon, SwitchHorizontalIcon, SparklesIcon, PencilIcon, ChartLineIcon, BarcodeIcon, PersonIcon, HomeIcon, ChatBubbleOvalLeftEllipsisIcon, ArrowRightIcon, BellIcon, HeartIcon, ChatBubbleLeftRightIcon } from './components/icons.tsx';

export type PeppNotificationItem = {
    event: TimelineEvent;
    peppFromUid: string;
    peppData: { name: string; timestamp: number; };
    uniqueId: string;
};


const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    // The key LOCAL_STORAGE_KEYS.USER_PROFILE does not exist anymore.
    // The logic was probably for fallback, but it's better to remove it
    // to avoid errors and since data is now in Firestore.
    return defaultValue;
  }
};

const setLocalStorageItem = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
};


const getWeekInfo = (date: Date): { weekId: string; startDate: string; endDate: string } => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); 
  const dayUTC = d.getUTCDay(); 
  const diffToMondayUTC = d.getUTCDate() - dayUTC + (dayUTC === 0 ? -6 : 1); 
  
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diffToMondayUTC));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));

  const year = monday.getUTCFullYear();
  
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
  const pastDaysOfYear = (monday.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + (firstDayOfYear.getUTCDay() === 0 ? 7 : 1) -1 ) / 7);


  return {
    weekId: `${year}-W${String(weekNumber).padStart(2, '0')}`,
    startDate: monday.toISOString().split('T')[0],
    endDate: sunday.toISOString().split('T')[0],
  };
};

const wasCalorieGoalMetForSummary = ( 
  consumedCalories: number,
  calorieGoalValue: number,
  goalTypeForDay: GoalType
): boolean => {
  if (calorieGoalValue <= 0) return false; 
  if (consumedCalories <=0) return false; 

  switch (goalTypeForDay) {
    case 'lose_fat':
      return consumedCalories <= calorieGoalValue;
    case 'maintain':
      const tenPercentOfTarget = calorieGoalValue * 0.10;
      return Math.abs(consumedCalories - calorieGoalValue) <= tenPercentOfTarget;
    case 'gain_muscle':
      return consumedCalories >= calorieGoalValue;
    default: 
      const tenPercentDefault = calorieGoalValue * 0.10;
      return Math.abs(consumedCalories - calorieGoalValue) <= tenPercentDefault;
  }
};

const getUserLevelInfo = (currentStreak: number): { currentLevel: Level, nextLevel: Level | null, progressToNextLevelPercentage: number } => {
  let currentLevel: Level = LEVEL_DEFINITIONS[0];
  let nextLevel: Level | null = null;

  for (let i = LEVEL_DEFINITIONS.length - 1; i >= 0; i--) {
    if (currentStreak >= LEVEL_DEFINITIONS[i].requiredStreak) {
      currentLevel = LEVEL_DEFINITIONS[i];
      if (i < LEVEL_DEFINITIONS.length - 1) {
        nextLevel = LEVEL_DEFINITIONS[i + 1];
      }
      break;
    }
  }
  
  if (currentLevel.id === LEVEL_DEFINITIONS[LEVEL_DEFINITIONS.length -1].id) {
    nextLevel = null; 
  }

  let progressToNextLevelPercentage = 0;
  if (nextLevel) {
    const streakForCurrentLevel = currentLevel.requiredStreak;
    const streakForNextLevel = nextLevel.requiredStreak;
    const progressInStreak = Math.max(0, currentStreak - streakForCurrentLevel);
    const streakRangeForLevel = streakForNextLevel - streakForCurrentLevel;
    if (streakRangeForLevel > 0) {
      progressToNextLevelPercentage = Math.min(100, (progressInStreak / streakRangeForLevel) * 100);
    } else if (currentStreak >= streakForNextLevel) { 
        progressToNextLevelPercentage = 100;
    }
  } else { 
    progressToNextLevelPercentage = 100;
  }
  return { currentLevel, nextLevel, progressToNextLevelPercentage };
};

const getDateUID = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface ProcessDayEndLogicOptions {
  disableBankUpdate?: boolean;
}

// AI Feedback Modal Component
const AIFeedbackModal: React.FC<{
  show: boolean;
  onClose: () => void;
  feedbackMessage: AIStructuredFeedbackResponse | string | null;
  isLoading: boolean;
  error: string | null;
  modalTitle: string;
  modalIcon: JSX.Element;
  isOnboardingContext?: boolean;
}> = ({ show, onClose, feedbackMessage, isLoading, error, modalTitle, modalIcon, isOnboardingContext }) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-feedback-modal-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-2xl animate-scale-in flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center">
            {modalIcon}
            <h2 id="ai-feedback-modal-title" className="text-2xl font-semibold text-neutral-dark">
              {modalTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
            aria-label="Stäng"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="min-h-[100px] flex-grow overflow-y-auto custom-scrollbar">
          {isLoading && (
            <div className="flex items-center justify-center p-4 text-neutral-dark h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mr-3"></div>
              Coachen tänker...
            </div>
          )}
          {error && !isLoading && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
              <p className="font-medium">Fel från Coach:</p>
              <p>{error}</p>
            </div>
          )}
          {feedbackMessage && !isLoading && !error && (
             typeof feedbackMessage === 'string' ? (
                <div className="p-4 bg-primary-100/60 border border-primary-200/80 rounded-lg text-neutral-dark space-y-3">
                  {feedbackMessage.split('\n\n').map((paragraph, index) => {
                      const lines = paragraph.split('\n').map((line, lineIndex) => {
                          if (line.startsWith('**')) {
                              return <strong key={lineIndex} className="block mt-2 mb-1 text-lg">{line.replace(/\*\*/g, '')}</strong>;
                          }
                          if (line.startsWith('*')) {
                              return <li key={lineIndex} className="ml-4">{line.substring(1).trim()}</li>;
                          }
                          return <span key={lineIndex}>{line}<br/></span>;
                      });
                      return <div key={index}>{lines}</div>;
                  })}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center text-lg font-semibold text-neutral-dark bg-primary-100/50 p-3 rounded-md">
                        <span className="text-2xl mr-3">📄</span>
                        {feedbackMessage.greeting}
                    </div>
                    {feedbackMessage.sections.map((section, index) => (
                        <div key={index} className="pt-4 border-t border-neutral-light/60">
                            <h3 className="text-xl font-bold text-neutral-dark mb-2 flex items-center">
                                <span className="text-2xl mr-3">{section.emoji}</span>
                                {section.title}
                            </h3>
                            <div className="text-neutral-dark space-y-1 text-base pl-10">
                                {section.content.split('\n').map((line, lineIdx) => (
                                    <p key={lineIdx}>{line}</p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-5 py-3 text-lg font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm interactive-transition active:scale-95"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
};

// Updated Recipe Choice Modal Component
const RecipeChoiceModal: React.FC<{
  show: boolean;
  onClose: () => void;
  onChooseSearch: () => void;
  onChooseTakePhoto: () => void;
  onChooseUpload: () => void;
}> = ({ show, onClose, onChooseSearch, onChooseTakePhoto, onChooseUpload }) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-choice-modal-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <RecipeIcon className="w-7 h-7 text-primary mr-2.5" />
            <h2 id="recipe-choice-modal-title" className="text-2xl font-semibold text-neutral-dark">
                Hitta recept
            </h2>
          </div>
           <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
            aria-label="Stäng"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <p className="text-neutral-dark mb-6 text-center">Hur vill du hitta ett recept?</p>
        <div className="space-y-4">
            <button
                onClick={() => { playAudio('uiClick'); onChooseSearch(); }}
                className="w-full flex items-center justify-center px-5 py-3 bg-primary hover:bg-primary-darker text-white text-lg font-medium rounded-lg shadow-sm active:scale-95 interactive-transition"
            >
                <SearchIcon className="w-5 h-5 mr-2.5" /> Sök recept med text
            </button>
            <button
                onClick={() => { playAudio('uiClick'); onChooseTakePhoto(); }}
                className="w-full flex items-center justify-center px-5 py-3 bg-secondary hover:bg-secondary-darker text-white text-lg font-medium rounded-lg shadow-sm active:scale-95 interactive-transition"
            >
                <CameraIcon className="w-5 h-5 mr-2.5" /> Fota ingredienser (AI)
            </button>
             <button
                onClick={() => { playAudio('uiClick'); onChooseUpload(); }}
                className="w-full flex items-center justify-center px-5 py-3 bg-accent hover:bg-accent-darker text-white text-lg font-medium rounded-lg shadow-sm active:scale-95 interactive-transition"
            >
                <UploadIcon className="w-5 h-5 mr-2.5" /> Välj bilder från enhet (AI)
            </button>
        </div>
      </div>
    </div>
  );
};


export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userStatus, setUserStatus] = useState<'pending' | 'approved' | null>(null);
  const [currentInterface, setCurrentInterface] = useState<'member' | 'coach'>('member');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);



  const [goals, setGoals] = useState<GoalSettings>(DEFAULT_GOALS);
  const [userProfile, setUserProfile] = useState<UserProfileData>(DEFAULT_USER_PROFILE);

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date()); // Use the actual current date
  const [viewingDate, setViewingDate] = useState<Date>(() => new Date()); 
  
  const isViewingToday = useMemo(() => {
    const todayStr = getDateUID(currentDate);
    const viewingDateStr = getDateUID(viewingDate);
    return todayStr === viewingDateStr;
  }, [currentDate, viewingDate]);

  const isViewingAppYesterday = useMemo(() => {
    const yesterday = new Date(currentDate);
    yesterday.setDate(currentDate.getDate() - 1);
    return viewingDate.toDateString() === yesterday.toDateString();
  }, [viewingDate, currentDate]);

  const [dailyLog, setDailyLog] = useState<LoggedMeal[]>([]);
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [waterLoggedMl, setWaterLoggedMl] = useState<number>(0);
  const [waterGoalMl, setWaterGoalMl] = useState<number>(DEFAULT_WATER_GOAL_ML);
  
  const [commonMeals, setCommonMeals] = useState<CommonMeal[]>([]);
  const [showSaveCommonMealModal, setShowSaveCommonMealModal] = useState<boolean>(false);
  const [mealToSaveAsCommon, setMealToSaveAsCommon] = useState<LoggedMeal | null>(null);

  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState<boolean>(false);
  const [showTextEntryModal, setShowTextEntryModal] = useState<boolean>(false);
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  
  const [cameraImageForAnalysis, setCameraImageForAnalysis] = useState<string | null>(null);
  const [analysisResultForModal, setAnalysisResultForModal] = useState<NutritionalInfo | null>(null);

  const [pastDaysSummary, setPastDaysSummary] = useState<PastDaysSummaryCollection>({});
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [journeyInitialTab, setJourneyInitialTab] = useState<'weight' | 'calendar' | 'profile' | 'achievements'>('weight');

  const [streakData, setStreakData] = useState<{ currentStreak: number; lastDateStreakChecked: string | null }>({ currentStreak: 0, lastDateStreakChecked: null });
  const [lastNotifiedStreakLevelUp, setLastNotifiedStreakLevelUp] = useState<string | null>(null); // This can stay local
  const [showLevelUpModal, setShowLevelUpModal] = useState<Level | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGoalMetModalData, setShowGoalMetModalData] = useState<{date: string; streak: number} | null>(null);

  const [toastNotification, setToastNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [weeklyBank, setWeeklyBank] = useState<WeeklyCalorieBank>(() => {
    const today = currentDate;
    const { weekId, startDate, endDate } = getWeekInfo(today);
    return { weekId, bankedCalories: 0, startDate, endDate };
  });

  const [highestStreak, setHighestStreak] = useState<number>(0);
  const [highestLevelId, setHighestLevelId] = useState<string | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<{ [id: string]: string }>({});


  // Course state
  const [userCourseProgress, setUserCourseProgress] = useState<UserCourseProgress>({});
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [showCourseInfoModalOnLoad, setShowCourseInfoModalOnLoad] = useState<boolean>(false);
  const [newlyUnlockedLesson, setNewlyUnlockedLesson] = useState<CourseLesson | null>(null);

  // Onboarding
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [onboardingStep, setOnboardingStep] = useState<'form' | 'feedback'>('form');
  const [showOnboardingCompletion, setShowOnboardingCompletion] = useState<boolean>(false);


  // AI Feedback State
  const [showAIFeedbackModal, setShowAIFeedbackModal] = useState<boolean>(false); // For regular coach use
  const [aiFeedbackMessage, setAIFeedbackMessage] = useState<AIStructuredFeedbackResponse | string | null>(null);
  const [aiFeedbackLoading, setAIFeedbackLoading] = useState<boolean>(false);
  const [aiFeedbackError, setAIFeedbackError] = useState<string | null>(null);
  const [aiModalTitle, setAiModalTitle] = useState("Din Coach");
  const [aiModalIcon, setAiModalIcon] = useState<JSX.Element>(<AICoachIcon className="w-7 h-7 text-secondary mr-2.5" />);
  
  // Recipe Feature State
  const [showRecipeModal, setShowRecipeModal] = useState<boolean>(false);
  const [currentRecipe, setCurrentRecipe] = useState<RecipeSuggestion | null>(null);
  const [recentRecipeSearches, setRecentRecipeSearches] = useState<string[]>([]); // This can be local

  // Ingredient to Recipe Feature State
  const [showRecipeChoiceModal, setShowRecipeChoiceModal] = useState<boolean>(false);
  const [showIngredientCaptureModal, setShowIngredientCaptureModal] = useState<boolean>(false);
  const [showIngredientRecipeResultsModal, setShowIngredientRecipeResultsModal] = useState<boolean>(false);
  const [ingredientAnalysisResult, setIngredientAnalysisResult] = useState<IngredientRecipeResponse | null>(null);
  const [isCapturingForIngredients, setIsCapturingForIngredients] = useState<boolean>(false);
  const [ingredientImagesForCapture, setIngredientImagesForCapture] = useState<string[]>([]);

  // Barcode Scanner State
  const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState<boolean>(false);
  const [barcodeScanResult, setBarcodeScanResult] = useState<BarcodeScannedFoodInfo | null>(null);


  const [showSpeedDial, setShowSpeedDial] = useState(false);
 
  // Weight Tracking State
  const [weightLogs, setWeightLogs] = useState<WeightLogEntry[]>([]);
  const [showLogWeightModal, setShowLogWeightModal] = useState<boolean>(false);

  // Mental Wellbeing State
  const [showMentalWellbeingModal, setShowMentalWellbeingModal] = useState<boolean>(false);
  const [relatedWeightLogIdForWellbeing, setRelatedWeightLogIdForWellbeing] = useState<string | null>(null);
  
  // Buddy System State
  const [showBuddySystemModal, setShowBuddySystemModal] = useState<boolean>(false);
  const [buddies, setBuddies] = useState<Peppkompis[]>([]);
  const [buddyDetailsList, setBuddyDetailsList] = useState<BuddyDetails[]>([]);
  const [isLoadingBuddies, setIsLoadingBuddies] = useState(false);
  const [hasNewBuddyUpdates, setHasNewBuddyUpdates] = useState(false);
  const [hasNewPeppsForMe, setHasNewPeppsForMe] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(true); // Flag to ensure check runs once per session/login
  
  // Chat State
  const [activeChatBuddy, setActiveChatBuddy] = useState<Peppkompis | null>(null);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);


  // Pepp Notifications State
  const [showPeppNotificationsModal, setShowPeppNotificationsModal] = useState(false);
  const [peppFeed, setPeppFeed] = useState<PeppNotificationItem[]>([]);
  const [isLoadingPeppFeed, setIsLoadingPeppFeed] = useState(false);


  
  const handleFirestoreError = (error: any, operation: string) => {
    console.error(`Firestore error during ${operation}:`, error);
    let message = `Kunde inte ${operation}.`;
    if (error && error.code === 'permission-denied') {
      message = `Behörighet saknas för att ${operation}. Kontrollera dina Firestore-säkerhetsregler.`;
    } else if (error && error.message) {
      // Avoid showing overly technical Firebase messages to the user
      message = `Ett fel uppstod vid ${operation}. Försök igen.`;
    }
    setToastNotification({ message, type: 'error' });
    setTimeout(() => setToastNotification(null), 5000); // Longer timeout for errors
  };

    const loadDataForDate = useCallback(async (userId: string, dateToLoad: Date) => {
        if (!userId) return;
        const dateUID = getDateUID(dateToLoad);
        setAppStatus(AppStatus.LOADING_CAMERA); // Re-using status for general loading
        try {
            const [loadedLog, loadedWater] = await Promise.all([
                fetchMealLogsForDate(userId, dateUID),
                fetchWaterLog(userId, dateUID)
            ]);
            setDailyLog(loadedLog);
            setWaterLoggedMl(loadedWater);
        } catch (error: any) {
            console.error("Error loading daily data from Firestore:", error);
            const isOfflineError = error.code === 'unavailable' || (error.message && (error.message.toLowerCase().includes('offline') || error.message.toLowerCase().includes('unavailable')));
            if (isOfflineError) {
                setToastNotification({ message: 'Offline. Visar senast hämtad data.', type: 'error'});
            } else {
                setToastNotification({ message: 'Kunde inte ladda dagens data. Försöker igen senare.', type: 'error'});
            }
            setTimeout(() => setToastNotification(null), 4000);
        } finally {
            setAppStatus(AppStatus.IDLE);
        }
    }, []);


    const resetAllLocalState = useCallback(() => {
        setGoals(DEFAULT_GOALS);
        setUserProfile(DEFAULT_USER_PROFILE);
        setDailyLog([]);
        setPastDaysSummary({});
        setStreakData({ currentStreak: 0, lastDateStreakChecked: null });
        setWaterLoggedMl(0);
        setUserCourseProgress({});
        setRecentRecipeSearches([]);
        setWeightLogs([]);
        setCommonMeals([]);
        setHighestLevelId(null);
        setHighestStreak(0);
        setUnlockedAchievements({});
        setHasCompletedOnboarding(false);
        setIsInitialDataLoaded(false);
        setUserStatus(null);
        setBuddies([]);
        setBuddyDetailsList([]);
        setIsCheckingUpdates(true); // Reset the check flag on logout
        setTotalUnreadCount(0);
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setAuthLoading(true);
            
            const persistenceResult = await persistencePromise;
            if (!persistenceResult.success) {
                setPersistenceWarning(persistenceResult.message);
            }

            if (user) {
                setCurrentUser(user);
                setIsDataLoading(true);
                try {
                    const appData = await fetchInitialAppData(user.uid);
                    
                    if (appData) {
                        setGoals(appData.goals || DEFAULT_GOALS);
                        setUserProfile(appData.profile || DEFAULT_USER_PROFILE);
                        setStreakData({
                            currentStreak: appData.currentStreak || 0,
                            lastDateStreakChecked: appData.lastDateStreakChecked || null,
                        });
                        setWeeklyBank(appData.weeklyBank || weeklyBank);
                        setHighestStreak(appData.highestStreak || 0);
                        setHighestLevelId(appData.highestLevelId || null);
                        setCommonMeals(appData.commonMeals || []);
                        setWeightLogs(appData.weightLogs || []);
                        setPastDaysSummary(appData.pastDaySummaries || {});
                        setUserCourseProgress(appData.courseProgress || {});
                        setUnlockedAchievements(appData.unlockedAchievements || {});
                        setHasCompletedOnboarding(appData.hasCompletedOnboarding || false);
                        setUserRole(appData.role || 'member');
                        setUserStatus(appData.status || 'pending');
                        setBuddies(appData.buddies || []);
                        setCurrentInterface('member');
                        
                        setIsInitialDataLoaded(true);
                        
                        // This call now primarily serves to update displayName if it has changed in the auth profile
                        await ensureUserProfileInFirestore(user, appData.role || 'member', appData.profile?.name);
                        
                        if ((appData.role === 'member') && !appData.hasCompletedOnboarding && appData.status === 'approved') {
                            setShowUserProfileModal(true);
                            setOnboardingStep('form');
                        }
                    } else {
                        // This else block should theoretically not be hit anymore due to the refactoring,
                        // but it's kept as a safeguard.
                        console.error("fetchInitialAppData returned null, which should not happen. Resetting state.");
                        resetAllLocalState();
                    }
                } catch (error: any) {
                    console.error("Error loading initial app data:", error);
                    const isOfflineError = error.code === 'unavailable' || (error.message && (error.message.toLowerCase().includes('offline') || error.message.toLowerCase().includes('unavailable')));

                    if (isOfflineError) {
                        const userErrorMessage = "Du är offline. Appen visar data från cachen.";
                        setToastNotification({ message: userErrorMessage, type: 'error' });
                        setTimeout(() => setToastNotification(null), 6000);
                        setIsInitialDataLoaded(true);
                    } else {
                         setToastNotification({ message: 'Ett fel uppstod vid laddning av data.', type: 'error'});
                        setTimeout(() => setToastNotification(null), 5000);
                        resetAllLocalState();
                    }
                } finally {
                    setIsDataLoading(false);
                }
            } else {
                setCurrentUser(null);
                setUserRole(null);
                setUserStatus(null);
                setCurrentInterface('member');
                resetAllLocalState();
                setIsDataLoading(false);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [resetAllLocalState]);

    // This separate effect handles loading daily data whenever the user or the viewing date changes.
    // It's responsible for fetching logs for the currently selected day.
    useEffect(() => {
        if (currentUser && isInitialDataLoaded && userStatus === 'approved') {
            loadDataForDate(currentUser.uid, viewingDate);
        }
    }, [currentUser, viewingDate, isInitialDataLoaded, loadDataForDate, userStatus]);

    useEffect(() => {
        if (viewMode === 'buddies' && currentUser) {
            const loadBuddyDetails = async () => {
                setIsLoadingBuddies(true);
                try {
                    const details = await fetchBuddyDetailsList(currentUser.uid);
                    setBuddyDetailsList(details);
                } catch (error) {
                    console.error("Failed to load buddy details:", error);
                    setToastNotification({ message: 'Kunde inte ladda Peppkompis-lista.', type: 'error' });
                } finally {
                    setIsLoadingBuddies(false);
                }
            };
            loadBuddyDetails();
        }
    }, [viewMode, currentUser]);


    // Background check for buddy updates to show notification bell
    useEffect(() => {
        if (isInitialDataLoaded && currentUser && userStatus === 'approved' && isCheckingUpdates) {
            const checkUpdates = async () => {
                // Check for new activity FROM buddies
                if (buddies.length > 0) {
                    try {
                        const details = await fetchBuddyDetailsList(currentUser.uid);
                        const lastViewTimestamp = parseInt(localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_BUDDY_VIEW_TIMESTAMP) || '0', 10);
        
                        const hasUpdates = details.some(buddy => {
                            const hasNewWeight = (buddy.lastWeightLogTimestamp ?? 0) > lastViewTimestamp;
                            const hasNewAchievement = (buddy.lastAchievementTimestamp ?? 0) > lastViewTimestamp;
                            return hasNewWeight || hasNewAchievement;
                        });
                        
                        setHasNewBuddyUpdates(hasUpdates);
                    } catch (error) {
                        console.error("Failed to load buddy details for notification check:", error);
                    }
                } else {
                    setHasNewBuddyUpdates(false);
                }

                // Check for new pepps FOR me
                try {
                    const myTimeline = await fetchTimelineForCurrentUser(currentUser.uid, ACHIEVEMENT_DEFINITIONS);
                    const lastMyPeppsViewTimestamp = parseInt(localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_MY_PEPPS_VIEW_TIMESTAMP) || '0', 10);
                    
                    const hasNewPepp = myTimeline.some(event => 
                        Object.values(event.pepps).some(pepp => pepp.timestamp > lastMyPeppsViewTimestamp)
                    );
                    setHasNewPeppsForMe(hasNewPepp);

                } catch (error) {
                    console.error("Failed to check for new pepps for current user:", error);
                }
                
                setIsCheckingUpdates(false); // Mark both checks as done
            };
            checkUpdates();
        }
    }, [isInitialDataLoaded, currentUser, userStatus, buddies, isCheckingUpdates]);

    useEffect(() => {
        if (currentUser && userStatus === 'approved') {
            const unsubscribe = listenForTotalUnreadCount(currentUser.uid, (count) => {
                setTotalUnreadCount(count);
            });
            return () => unsubscribe();
        }
    }, [currentUser, userStatus]);

    // This effect "heals" past data by adding missing fields, like waterGoalMet.
    // It runs once when data is loaded and checks the last 30 days.
    useEffect(() => {
        if (!currentUser || !isInitialDataLoaded || Object.keys(pastDaysSummary).length === 0) {
            return;
        }

        const healLast30DaysData = async () => {
            const batch = writeBatch(db);
            const localUpdatedSummaries: PastDaysSummaryCollection = {};
            let updatesMade = false;

            const thirtyDaysAgo = new Date(currentDate);
            thirtyDaysAgo.setDate(currentDate.getDate() - 30);

            const summariesToHeal = Object.values(pastDaysSummary).filter(summary => {
                const summaryDate = new Date(summary.date);
                return summaryDate >= thirtyDaysAgo && summary.waterGoalMet === undefined;
            });

            if (summariesToHeal.length === 0) {
                return; // Nothing to heal
            }
            
            console.log(`Found ${summariesToHeal.length} summaries to heal in the last 30 days.`);

            for (const summary of summariesToHeal) {
                const dateUID = summary.date;
                console.log(`Healing data for ${dateUID}: Missing waterGoalMet.`);
                
                const waterAmount = await fetchWaterLog(currentUser.uid, dateUID);
                const wasMet = waterAmount >= DEFAULT_WATER_GOAL_ML;
                
                const updatedSummary = { ...summary, waterGoalMet: wasMet };
                localUpdatedSummaries[dateUID] = updatedSummary;
                
                const summaryRef = doc(db, "users", currentUser.uid, "pastDaySummaries", dateUID);
                batch.update(summaryRef, { waterGoalMet: wasMet });
                updatesMade = true;
            }

            if (updatesMade) {
                console.log("Applying healed data to state and Firestore...");
                setPastDaysSummary(prev => ({ ...prev, ...localUpdatedSummaries }));
                await batch.commit();
                console.log("Healing complete.");
            }
        };

        healLast30DaysData().catch(err => {
            console.error("Data healing process failed:", err);
        });

    }, [isInitialDataLoaded, currentUser?.uid, pastDaysSummary, currentDate]);


  const handleLogout = async () => {
    playAudio('uiClick');
    setShowProfileDropdown(false);
    try {
      await signOut(auth);
      // onAuthStateChanged will handle resetting state
    } catch (error) {
      console.error("Logout error:", error);
      setToastNotification({ message: "Utloggning misslyckades.", type: 'error' });
    }
  };

  const toggleInterfaceView = () => {
    playAudio('uiClick');
    setShowProfileDropdown(false);
    setCurrentInterface(prev => prev === 'member' ? 'coach' : 'member');
  };

   // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileDropdownRef]);



  const formattedViewingDate = useMemo(() => {
    return viewingDate.toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, [viewingDate]);

  const recommendations = useMemo(() => {
    if (userProfile.currentWeightKg && userProfile.heightCm && userProfile.ageYears) {
        return calculateRecommendations(userProfile as UserProfileData & { currentWeightKg: number, heightCm: number, ageYears: number });
    }
    return null;
  }, [userProfile]);


  // Handle Current Date Change (e.g. for dev tool)
  useEffect(() => {
    setViewingDate(new Date(currentDate));
  }, [currentDate]);


  useEffect(() => {
    const { weekId: currentWeekId } = getWeekInfo(currentDate);
    if (weeklyBank.weekId !== currentWeekId && currentUser) {
        console.log(`New week detected (${currentWeekId} vs ${weeklyBank.weekId}). Resetting weekly calorie bank.`);
        const newBank = { weekId: currentWeekId, bankedCalories: 0, startDate: getWeekInfo(currentDate).startDate, endDate: getWeekInfo(currentDate).endDate };
        setWeeklyBank(newBank);
        updateUserDocument(currentUser.uid, { weeklyBank: newBank });
    }
  }, [currentDate, weeklyBank.weekId, currentUser]);


    useEffect(() => {
        // Persist recent recipe searches to local storage
        setLocalStorageItem(LOCAL_STORAGE_KEYS.RECENT_RECIPE_SEARCHES, recentRecipeSearches);
    }, [recentRecipeSearches]);


  const totalNutrients = useMemo(() => {
    return dailyLog.reduce(
      (acc, meal) => {
        acc.calories += meal.nutritionalInfo.calories;
        acc.protein += meal.nutritionalInfo.protein;
        acc.carbohydrates += meal.nutritionalInfo.carbohydrates;
        acc.fat += meal.nutritionalInfo.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
    );
  }, [dailyLog]);
  
  const minSafeCalories = useMemo(() => {
    const goalBasedMin = goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
    return Math.max(goalBasedMin, MIN_ABSOLUTE_CALORIES_THRESHOLD);
  }, [goals.calorieGoal]);


  const addMealToLog = async (nutritionalInfo: NutritionalInfo, imageDataUrl?: string, commonMealId?: string) => {
    if (!isViewingToday || !currentUser) {
        setToastNotification({ message: "Du kan endast logga måltider för idag.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }

    // --- Start of Optimistic Update ---
    const localId = `local_${Date.now()}`;
    const specialLogTypeIds = ['text_search', 'recipe', 'ingredient_recipe', 'barcode'];
    
    const finalImageUrl = imageDataUrl ? imageDataUrl :
                          commonMealId === 'manual' ? MANUAL_LOG_FOOD_ICON_SVG :
                          (commonMealId && !specialLogTypeIds.includes(commonMealId)) ? COMMON_MEAL_LOG_ICON_SVG :
                          undefined;
                          
    // 1. Create the new meal object for both UI and Firestore.
    const newMealData: Omit<LoggedMeal, 'id'> = {
        timestamp: Date.now(),
        dateString: getDateUID(viewingDate),
        nutritionalInfo: {
            foodItem: nutritionalInfo.foodItem || 'Okänd måltid',
            calories: Math.max(0, nutritionalInfo.calories),
            protein: Math.max(0, nutritionalInfo.protein),
            carbohydrates: Math.max(0, nutritionalInfo.carbohydrates),
            fat: Math.max(0, nutritionalInfo.fat),
        },
    };

    if (finalImageUrl) {
        newMealData.imageDataUrl = finalImageUrl;
    }
    
    // 2. Handle calorie bank logic BEFORE adding to state.
    const originalBankState = weeklyBank;
    let newBankState = originalBankState;
    if (totalNutrients.calories + newMealData.nutritionalInfo.calories > goals.calorieGoal && originalBankState.bankedCalories > 0) {
        const overshoot = (totalNutrients.calories + newMealData.nutritionalInfo.calories) - goals.calorieGoal;
        const canUseFromBank = Math.min(overshoot, originalBankState.bankedCalories);
        if (canUseFromBank > 0) {
            newMealData.caloriesCoveredByBank = canUseFromBank;
            newBankState = { ...originalBankState, bankedCalories: Math.max(0, originalBankState.bankedCalories - canUseFromBank) };
        }
    }

    // 3. Add the meal to the UI state immediately.
    const optimisticMeal: LoggedMeal = { ...newMealData, id: localId } as LoggedMeal;
    setDailyLog(prevLog => [...prevLog, optimisticMeal]);
    if (newBankState.bankedCalories !== originalBankState.bankedCalories) {
        setWeeklyBank(newBankState);
    }
    
    playAudio('logSuccess', 0.8);
    setToastNotification({ message: `"${optimisticMeal.nutritionalInfo.foodItem}" loggades!`, type: 'success' });
    setTimeout(() => setToastNotification(null), 3000);

    // --- End of Optimistic Update ---

    try {
        // 4. Try to save to Firestore.
        const newDocId = await addMealLog(currentUser.uid, newMealData);

        // 5. On success, update the local state with the real ID from Firestore.
        setDailyLog(prevLog => prevLog.map(meal => 
            meal.id === localId ? { ...meal, id: newDocId } : meal
        ));
        
        // Also save the bank update to Firestore
        if (newBankState.bankedCalories !== originalBankState.bankedCalories) {
            await updateUserDocument(currentUser.uid, { weeklyBank: newBankState });
        }

    } catch (error) {
        // 6. On failure, revert the optimistic update.
        handleFirestoreError(error, 'spara måltid');
        setDailyLog(prevLog => prevLog.filter(meal => meal.id !== localId));
        // Also revert the bank update
        if (newBankState.bankedCalories !== originalBankState.bankedCalories) {
            setWeeklyBank(originalBankState); // Revert to original bank state
        }
    }
  };


  const handleImageCapture = async (base64ImageData: string) => {
    setShowCameraModal(false); // Always close the camera after a capture
    if (isCapturingForIngredients) {
        setIngredientImagesForCapture(prev => [...prev, `data:image/jpeg;base64,${base64ImageData}`]);
        openModal(setShowIngredientCaptureModal);
    } else {
        setCameraImageForAnalysis(base64ImageData);
        setAppStatus(AppStatus.ANALYZING);
        try {
            const analysis = await analyzeFoodImage(base64ImageData);
            setAnalysisResultForModal(analysis);
            setAppStatus(AppStatus.IDLE);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Okänt analysfel";
            setErrorMessage(errorMsg);
            setToastNotification({ message: `Analysfel: ${errorMsg}`, type: 'error'});
            setTimeout(() => setToastNotification(null), 3500);
            setAppStatus(AppStatus.ERROR);
        }
    }
  };
  
    const handleAddIngredientImagesFromUpload = (files: FileList) => {
        const filesArray = Array.from(files);
        let canAddCount = MAX_INGREDIENT_IMAGES - ingredientImagesForCapture.length;

        filesArray.slice(0, canAddCount).forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                setIngredientImagesForCapture(prev => [...prev, dataUrl]);
            };
            reader.readAsDataURL(file);
        });
        if (filesArray.length > canAddCount) {
            setToastNotification({ message: `Du kan ladda upp max ${MAX_INGREDIENT_IMAGES} bilder. ${canAddCount} bilder lades till.`, type: 'error' });
            setTimeout(() => setToastNotification(null), 3500);
        }
    };
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64ImageData = (reader.result as string).split(',')[1];
        if (base64ImageData) {
            handleImageCapture(base64ImageData);
        }
      };
      reader.readAsDataURL(file);
    }
    event.target.value = ''; // Reset file input
  };

  const handleLogFromModal = (foodInfo: NutritionalInfo | SearchedFoodInfo, options: {saveAsCommon: boolean}, imageDataUrl?: string) => {
    const isSearchedFood = 'servingDescription' in foodInfo;
    const baseNutritionalInfo: NutritionalInfo = {
        foodItem: foodInfo.foodItem,
        calories: foodInfo.calories,
        protein: foodInfo.protein,
        carbohydrates: foodInfo.carbohydrates,
        fat: foodInfo.fat
    };
    
    const foodNameToUse = isSearchedFood ? (foodInfo as SearchedFoodInfo).servingDescription : foodInfo.foodItem;
    const fullFoodItemName = isSearchedFood ? `${foodInfo.foodItem} (${(foodInfo as SearchedFoodInfo).servingDescription})` : foodInfo.foodItem;

    addMealToLog({ ...baseNutritionalInfo, foodItem: fullFoodItemName }, 
                 imageDataUrl, 
                 isSearchedFood ? 'text_search' : undefined);

    if (options.saveAsCommon) {
        saveCommonMeal(
            { ...baseNutritionalInfo, foodItem: foodNameToUse || 'Okänt val' }, // Use the specific food name for common meal
            foodNameToUse || 'Okänt val' // Use the specific name for the common meal name
        );
    }
    setAnalysisResultForModal(null);
    setCameraImageForAnalysis(null);
  };
  
  const handleLogWater = async (amountMl: number) => {
    if (!isViewingToday || !currentUser) {
        setToastNotification({ message: "Du kan endast logga vatten för idag.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    playAudio('uiClick', 0.7);
    const newTotalWater = waterLoggedMl + amountMl;
    setWaterLoggedMl(newTotalWater);

    const dateUID = getDateUID(viewingDate);
    try {
      await setWaterLog(currentUser.uid, dateUID, newTotalWater);
    } catch (error) {
      handleFirestoreError(error, 'logga vatten');
      // Revert state if save fails
      setWaterLoggedMl(current => current - amountMl);
    }
  };

  const handleResetWater = async () => {
    if (!isViewingToday || !currentUser) return;
    playAudio('uiClick', 0.7);
    const previousAmount = waterLoggedMl;
    setWaterLoggedMl(0);
    const dateUID = getDateUID(viewingDate);
    try {
      await setWaterLog(currentUser.uid, dateUID, 0);
    } catch (error) {
      handleFirestoreError(error, 'nollställa vatten');
      setWaterLoggedMl(previousAmount);
    }
  };
  
  const handleDeleteMeal = async (mealId: string) => {
    if (!isViewingToday || !currentUser) {
        setToastNotification({ message: "Du kan endast radera måltider för idag.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    playAudio('uiClick');
    
    const mealToAdjustBankFor = dailyLog.find(meal => meal.id === mealId);
    
    try {
        await deleteMealLog(currentUser.uid, mealId);
        setDailyLog(prevLog => prevLog.filter(meal => meal.id !== mealId));

        if (mealToAdjustBankFor && mealToAdjustBankFor.caloriesCoveredByBank) {
            const refundAmount = mealToAdjustBankFor.caloriesCoveredByBank;
            const newBank = { ...weeklyBank, bankedCalories: weeklyBank.bankedCalories + refundAmount };
            setWeeklyBank(newBank);
            await updateUserDocument(currentUser.uid, { weeklyBank: newBank });
            setToastNotification({ message: `Måltid borttagen. ${refundAmount.toFixed(0)} kcal återförda.`, type: 'success' });
        } else {
            setToastNotification({ message: "Måltid borttagen.", type: 'success' });
        }
        setTimeout(() => setToastNotification(null), 3000);
    } catch (error) {
        handleFirestoreError(error, 'ta bort måltid');
    }
  };

  const handleUpdateMeal = async (mealId: string, updatedInfo: NutritionalInfo) => {
    if (!isViewingToday || !currentUser) {
        setToastNotification({ message: "Du kan endast uppdatera måltider för idag.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    playAudio('uiClick');

    const originalLog = [...dailyLog];
    const updatedLog = originalLog.map(meal => 
        meal.id === mealId ? { ...meal, nutritionalInfo: updatedInfo } : meal
    );

    // Note: This is an optimistic update. A full implementation would also
    // recalculate the daily calorie bank usage here. For this fix, we are focusing
    // on ensuring the edit saves and the UI updates correctly.
    setDailyLog(updatedLog);

    try {
        await updateMealLog(currentUser.uid, mealId, updatedInfo);
        setToastNotification({ message: "Måltid uppdaterad.", type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);
    } catch (error) {
        handleFirestoreError(error, 'uppdatera måltid');
        setDailyLog(originalLog); // Rollback on error
    }
  };

  const saveCommonMeal = async (mealInfoToSave: NutritionalInfo, name: string) => {
    if (!currentUser) return;

    // More robust sanitization to handle potential NaN or undefined values.
    const cleanNutritionalInfo: NutritionalInfo = {
        calories: Math.round(Number(mealInfoToSave.calories) || 0),
        protein: Math.round(Number(mealInfoToSave.protein) || 0),
        carbohydrates: Math.round(Number(mealInfoToSave.carbohydrates) || 0),
        fat: Math.round(Number(mealInfoToSave.fat) || 0),
        foodItem: mealInfoToSave.foodItem || name,
    };

    const newCommonMealData: Omit<CommonMeal, 'id'> = {
      name: name,
      nutritionalInfo: cleanNutritionalInfo,
    };
    try {
        const newDocId = await addCommonMeal(currentUser.uid, newCommonMealData);
        setCommonMeals(prev => [{ ...newCommonMealData, id: newDocId }, ...prev].slice(0, 20));
        setShowSaveCommonMealModal(false);
        setMealToSaveAsCommon(null);
        setToastNotification({ message: `"${name}" sparad som vanligt val!`, type: 'success' });
        playAudio('logSuccess', 0.8);
        setTimeout(() => setToastNotification(null), 2500);
    } catch (error) {
        handleFirestoreError(error, 'spara vanligt val');
    }
  };

  const logCommonMeal = (commonMeal: CommonMeal) => {
     if (!isViewingToday) {
        setToastNotification({ message: "Du kan endast logga måltider för idag.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    addMealToLog(commonMeal.nutritionalInfo, COMMON_MEAL_LOG_ICON_SVG, commonMeal.id);
  };

  const deleteCommonMeal = async (commonMealId: string) => {
    if (!currentUser) return;
    try {
        await deleteCommonMealFromDB(currentUser.uid, commonMealId);
        setCommonMeals(prev => prev.filter(cm => cm.id !== commonMealId));
        setToastNotification({ message: "Vanligt val borttaget.", type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);
    } catch (error) {
        handleFirestoreError(error, 'ta bort vanligt val');
    }
  };

  const handleUpdateCommonMeal = async (commonMealId: string, updatedData: { name: string; nutritionalInfo: NutritionalInfo }) => {
    if (!currentUser) return;
    playAudio('uiClick');
    try {
        await updateCommonMeal(currentUser.uid, commonMealId, updatedData);
        setCommonMeals(prev => prev.map(cm => 
            cm.id === commonMealId ? { ...cm, ...updatedData } : cm
        ));
        setToastNotification({ message: "Vanligt val uppdaterat.", type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);
    } catch (error) {
        handleFirestoreError(error, 'uppdatera vanligt val');
    }
  };

  const handleManualLog = (manualNutritionalInfo: NutritionalInfo, options: { saveAsCommon: boolean }) => {
    if (!isViewingToday) {
        setToastNotification({ message: "Du kan endast logga måltider för idag.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    addMealToLog(manualNutritionalInfo, MANUAL_LOG_FOOD_ICON_SVG, 'manual');
    if (options.saveAsCommon) {
      saveCommonMeal(manualNutritionalInfo, manualNutritionalInfo.foodItem || 'Manuellt val');
    }
  };

  const fetchOnboardingAIFeedback = useCallback(async (profileOverride: UserProfileData, goalsOverride: GoalSettings) => {
    setAIFeedbackLoading(true);
    setAIFeedbackError(null);
    setAIFeedbackMessage(null); // Clear previous message
    setAiModalTitle("Feedback från din Coach");
    setAiModalIcon(<AICoachIcon className="w-7 h-7 text-secondary mr-2.5" />);
    
    const dataForFeedback: AIDataForFeedback = {
      userName: profileOverride.name,
      todayTotals: totalNutrients, // Needed for type, not for prompt
      userGoals: goalsOverride,
      userProfile: profileOverride,
      currentStreak: streakData.currentStreak, // Needed for type, not for prompt
      activeLesson: null, // Onboarding has no active lesson
      isOnboarding: true,
    };

    try {
      const feedback = await getAIFeedback(dataForFeedback);
      setAIFeedbackMessage(feedback);
    } catch (e: any) {
      setAIFeedbackError(e.message || "Ett fel uppstod när feedback skulle hämtas.");
    } finally {
      setAIFeedbackLoading(false);
    }
  }, [totalNutrients, streakData.currentStreak]);

  const handleSaveProfileAndGoals = async (profileData: UserProfileData, newGoals: GoalSettings) => {
    if (!currentUser) return;

    const previousProfile = userProfile;
    const previousGoals = goals;

    // Optimistically update state and UI
    setUserProfile(profileData);
    setGoals(newGoals);

    if (!hasCompletedOnboarding && userRole === 'member' && onboardingStep === 'form') {
        // UI change for onboarding flow
        setOnboardingStep('feedback');
        // This fetch might fail offline, but the user can still proceed.
        fetchOnboardingAIFeedback(profileData, newGoals).catch(e => console.error("Could not fetch onboarding AI feedback while offline:", e));
    } else {
        // UI change for regular edit
        setShowUserProfileModal(false);
        playAudio('logSuccess');
        setToastNotification({ message: "Profil och mål har uppdaterats!", type: 'success' });
        setTimeout(() => setToastNotification(null), 2500);
    }
    
    try {
        // This will be queued by Firestore's offline persistence if the client is offline
        await saveProfileAndGoals(currentUser.uid, profileData, newGoals);

        // Onboarding-specific side-effect: log initial weight
        if (!hasCompletedOnboarding && userRole === 'member' && onboardingStep === 'form') {
            if (profileData.currentWeightKg && profileData.currentWeightKg > 0) {
                const newWeightLog: Omit<WeightLogEntry, 'id'> = {
                    loggedAt: Date.now(),
                    weightKg: profileData.currentWeightKg,
                    skeletalMuscleMassKg: profileData.skeletalMuscleMassKg,
                    bodyFatMassKg: profileData.bodyFatMassKg,
                    comment: 'Startvikt',
                };
                // Fire and forget, also gets queued
                saveWeightLog(currentUser.uid, newWeightLog)
                    .then(newDocId => {
                        setWeightLogs(prev => [...prev, { ...newWeightLog, id: newDocId }].sort((a, b) => a.loggedAt - b.loggedAt));
                    })
                    .catch(weightLogError => {
                        // This error might happen if offline write fails for some reason other than connectivity.
                        // We will just log it, as rolling back the profile for this is probably not desired.
                        handleFirestoreError(weightLogError, 'spara startvikt');
                    });
            }
        }
    } catch (error: any) {
        // If Firestore write *truly* fails (e.g., permissions error, not just offline),
        // then we roll back the optimistic update.
        // Firestore's offline persistence should not throw for 'unavailable', it queues the write.
        // This catch is for other errors like 'permission-denied'.
        
        setUserProfile(previousProfile);
        setGoals(previousGoals);

        // Revert UI changes
        if (!hasCompletedOnboarding && userRole === 'member' && onboardingStep === 'feedback') {
             setOnboardingStep('form');
        } else if (hasCompletedOnboarding) {
            setShowUserProfileModal(true); // Re-open the modal
        }
        
        handleFirestoreError(error, 'spara profil och mål');
    }
  };

const handleCloseUserProfileModal = () => {
    if (!hasCompletedOnboarding && userRole === 'member' && onboardingStep === 'feedback') {
        setShowUserProfileModal(false);
        setOnboardingStep('form');
        setAIFeedbackMessage(null);
        setAIFeedbackError(null);
        setShowOnboardingCompletion(true); // Show the new completion screen
    } else {
        setShowUserProfileModal(false);
        setOnboardingStep('form');
        setAIFeedbackMessage(null);
        setAIFeedbackError(null);
    }
};

const handleFinishOnboarding = async () => {
    if (!currentUser) return;
    setShowOnboardingCompletion(false);
    setHasCompletedOnboarding(true);
    setIsInitialDataLoaded(true);
    try {
        await updateUserDocument(currentUser.uid, { hasCompletedOnboarding: true });
        playAudio('levelUp');
    } catch (error) {
        handleFirestoreError(error, 'slutföra onboarding');
    }
};


  // This effect handles catching up on missed days for streak and calorie bank calculations.
  useEffect(() => {
    if (isDataLoading || !currentUser || !isInitialDataLoaded) {
      return;
    }

    // Use a local variable to handle potential null value for new users
    let lastChecked = streakData.lastDateStreakChecked;

    // Handle initialization for new users or if the date is missing.
    // We start from 2 days ago to be safe, ensuring a full day can be processed.
    if (!lastChecked) {
      const dayBeforeYesterday = new Date(currentDate);
      dayBeforeYesterday.setDate(currentDate.getDate() - 2);
      lastChecked = getDateUID(dayBeforeYesterday);
    }

    const todayDateStr = getDateUID(currentDate);
    if (lastChecked === todayDateStr) {
      if (appStatus === AppStatus.PROCESSING_DAY_END) {
        setAppStatus(AppStatus.IDLE);
      }
      return;
    }

    const lastProcessedDate = new Date(lastChecked);
    if (isNaN(lastProcessedDate.getTime())) {
      console.error("Invalid lastDateStreakChecked in state:", lastChecked);
      return;
    }

    const datesToProcess: Date[] = [];
    let dayToProcess = new Date(lastProcessedDate);
    dayToProcess.setUTCDate(dayToProcess.getUTCDate() + 1); // Use UTC methods to avoid timezone bugs
    const todayForLoop = new Date(todayDateStr);

    while (dayToProcess < todayForLoop) {
      datesToProcess.push(new Date(dayToProcess));
      dayToProcess.setUTCDate(dayToProcess.getUTCDate() + 1); // Use UTC methods
    }

    if (datesToProcess.length > 0) {
      const processMissedDays = async () => {
        console.log(`Processing ${datesToProcess.length} missed day(s)...`);
        setAppStatus(AppStatus.PROCESSING_DAY_END);

        let accumulatedStreak = streakData.currentStreak;
        let accumulatedBank = weeklyBank.bankedCalories;
        let accumulatedHighestStreak = highestStreak;
        const newSummaries: PastDaysSummaryCollection = {};
        let latestProcessedDateUID = lastChecked!;
        let totalBankedInLoop = 0;

        for (const date of datesToProcess) {
          const dateUID = getDateUID(date);

          let existingSummary = pastDaysSummary[dateUID];
          if (!existingSummary) {
            const summaryDoc = await getDocSafe(
              doc(db, "users", currentUser.uid, "pastDaySummaries", dateUID)
            );
            if (summaryDoc.exists()) {
              existingSummary = summaryDoc.data() as PastDaySummary;
            }
          }

          let summaryForThisDay: PastDaySummary;

          if (existingSummary && existingSummary.isBinaryOrigin) {
            summaryForThisDay = existingSummary;
          } else {
            const [dailyLogForDate, waterLogForDate] = await Promise.all([
              fetchMealLogsForDate(currentUser.uid, dateUID),
              fetchWaterLog(currentUser.uid, dateUID),
            ]);

            const totalNutrientsForDay = dailyLogForDate.reduce(
              (acc, meal) => {
                acc.calories += meal.nutritionalInfo.calories;
                acc.protein += meal.nutritionalInfo.protein;
                acc.carbohydrates += meal.nutritionalInfo.carbohydrates;
                acc.fat += meal.nutritionalInfo.fat;
                return acc;
              },
              { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
            );
            const waterGoalMet = waterLogForDate >= DEFAULT_WATER_GOAL_ML;

            const caloriesConsumed = totalNutrientsForDay.calories;
            const totalCoveredByBankForDay = dailyLogForDate.reduce(
              (sum, meal) => sum + (meal.caloriesCoveredByBank || 0),
              0
            );
            const effectiveCaloriesConsumed =
              caloriesConsumed - totalCoveredByBankForDay;
            const minSafeCaloriesForDay = Math.max(
              goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL,
              MIN_ABSOLUTE_CALORIES_THRESHOLD
            );

            const wasDaySuccessful =
              dailyLogForDate.length > 0 &&
              caloriesConsumed >= minSafeCaloriesForDay &&
              wasCalorieGoalMetForSummary(
                effectiveCaloriesConsumed,
                goals.calorieGoal,
                userProfile.goalType
              );

            const calorieTarget = goals.calorieGoal;
            let bankedAmountThisDay = 0;
            if (
              totalCoveredByBankForDay === 0 &&
              dailyLogForDate.length > 0 &&
              caloriesConsumed >= minSafeCaloriesForDay &&
              caloriesConsumed <= calorieTarget
            ) {
              bankedAmountThisDay = calorieTarget - caloriesConsumed;
              if (bankedAmountThisDay > 0) {
                accumulatedBank += bankedAmountThisDay;
                totalBankedInLoop += bankedAmountThisDay;
              }
            }

            summaryForThisDay = {
              date: dateUID,
              goalMet: wasDaySuccessful,
              consumedCalories: caloriesConsumed,
              calorieGoal: calorieTarget,
              proteinGoalMet: totalNutrientsForDay.protein >= goals.proteinGoal,
              consumedProtein: totalNutrientsForDay.protein,
              proteinGoal: goals.proteinGoal,
              consumedCarbohydrates: totalNutrientsForDay.carbohydrates,
              carbohydrateGoal: goals.carbohydrateGoal,
              consumedFat: totalNutrientsForDay.fat,
              fatGoal: goals.fatGoal,
              goalType: userProfile.goalType,
              isBinaryOrigin: false,
              waterGoalMet: waterGoalMet,
            };
            await setPastDaySummary(currentUser.uid, dateUID, summaryForThisDay);
          }

          newSummaries[dateUID] = summaryForThisDay;

          if (summaryForThisDay.goalMet) {
            accumulatedStreak++;
          } else {
            accumulatedStreak = 0;
          }
          accumulatedHighestStreak = Math.max(
            accumulatedHighestStreak,
            accumulatedStreak
          );
          latestProcessedDateUID = dateUID;
        }

        setStreakData({
          currentStreak: accumulatedStreak,
          lastDateStreakChecked: latestProcessedDateUID,
        });
        setWeeklyBank((prev) => ({ ...prev, bankedCalories: accumulatedBank }));
        if (accumulatedHighestStreak > highestStreak) {
          setHighestStreak(accumulatedHighestStreak);
        }
        setPastDaysSummary((prev) => ({ ...prev, ...newSummaries }));

        await updateUserDocument(currentUser.uid, {
          currentStreak: accumulatedStreak,
          lastDateStreakChecked: latestProcessedDateUID,
          weeklyBank: { ...weeklyBank, bankedCalories: accumulatedBank },
          highestStreak: accumulatedHighestStreak,
        });

        if (newSummaries[latestProcessedDateUID]?.goalMet) {
          setShowGoalMetModalData({
            date: latestProcessedDateUID,
            streak: accumulatedStreak,
          });
          setShowConfetti(true);
          playAudio("levelUp");
          setTimeout(() => setShowConfetti(false), 5000);
        }

        if (totalBankedInLoop > 0) {
          setToastNotification({
            message: `${totalBankedInLoop.toFixed(0)} kcal sparade till potten!`,
            type: "success",
          });
          setTimeout(() => setToastNotification(null), 3500);
          playAudio("calorieBank", 0.7);
        }

        setAppStatus(AppStatus.IDLE);
      };

      processMissedDays().catch((err) => {
        console.error("Error during bulk day processing:", err);
        setAppStatus(AppStatus.IDLE);
      });
    }
  }, [
    isDataLoading,
    currentUser,
    isInitialDataLoaded,
    currentDate,
    streakData,
    weeklyBank,
    goals,
    userProfile.goalType,
    highestStreak,
  ]);


  const handleUpdateSimpleDayStatus = async (dateStr: string, metGoal: boolean) => {
    if (!currentUser) return;
    const dateToUpdate = new Date(dateStr);
     if (getDateUID(dateToUpdate) >= getDateUID(currentDate)) {
        setToastNotification({ message: `Du kan bara uppdatera status för dagar som har passerat.`, type: 'error' });
        setTimeout(() => setToastNotification(null), 4000);
        return;
    }
    
    setAppStatus(AppStatus.PROCESSING_DAY_END);

    try {
      const summaryEntry: PastDaySummary = {
          date: dateStr,
          goalMet: metGoal,
          consumedCalories: metGoal ? (goals.calorieGoal || 1500) : 1,
          calorieGoal: goals.calorieGoal,
          proteinGoalMet: metGoal,
          consumedProtein: metGoal ? (goals.proteinGoal || 70) : 0,
          proteinGoal: goals.proteinGoal,
          consumedCarbohydrates: metGoal ? (goals.carbohydrateGoal || 150) : 0,
          carbohydrateGoal: goals.carbohydrateGoal,
          consumedFat: metGoal ? (goals.fatGoal || 50) : 0,
          fatGoal: goals.fatGoal,
          goalType: userProfile.goalType || 'maintain',
          isBinaryOrigin: true,
          waterGoalMet: false,
      };
      await setPastDaySummary(currentUser.uid, dateStr, summaryEntry);
      setPastDaysSummary(prevSummary => ({ ...prevSummary, [dateStr]: summaryEntry }));
      
      const dayBeforeChange = new Date(dateToUpdate);
      dayBeforeChange.setDate(dayBeforeChange.getDate() - 1);
      const dayBeforeChangeUID = getDateUID(dayBeforeChange);

      // Force reprocessing from the day before the change, to ensure subsequent days are correct.
      setStreakData(prev => ({ ...prev, lastDateStreakChecked: dayBeforeChangeUID }));
      
      setToastNotification({ message: `Status för ${dateToUpdate.toLocaleDateString('sv-SE')} uppdaterad.`, type: 'success' });
      setTimeout(() => setToastNotification(null), 3000);
    } catch (error) {
        handleFirestoreError(error, 'uppdatera dagstatus');
    } finally {
        setAppStatus(AppStatus.IDLE);
    }
  };
  
  // Audio Initialization
  useEffect(() => {
    initAudio().then(success => {
      if (success) console.log("Audio system initialized successfully.");
      else console.warn("Audio system initialization failed or requires user interaction.");
    });
  }, []);

  const closeModal = (modalSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
    playAudio('uiClick');
    modalSetter(false);
  };

  const openModal = (modalSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
    playAudio('uiClick');
    modalSetter(true);
  };

  const handleOpenInfoModal = () => {
    openModal(setShowInfoModal);
  };

  const handleOpenSaveCommonMealModal = (meal: LoggedMeal) => {
    setMealToSaveAsCommon(meal);
    openModal(setShowSaveCommonMealModal);
  };
  
  // --- Course Logic ---
  const unlockLesson = useCallback(async (lessonId: string, streakAtUnlock: number) => {
    if (!currentUser) return;

    const newProgress: UserLessonProgress = {
        completedFocusPoints: [],
        reflectionAnswer: null,
        isCompleted: false,
        unlockedAt: Date.now(),
        streakAtUnlock: streakAtUnlock,
    };
    
    setUserCourseProgress(prev => ({...prev, [lessonId]: newProgress}));
    
    try {
        await saveCourseProgress(currentUser.uid, lessonId, newProgress);
        const lesson = courseLessons.find(l => l.id === lessonId);
        if (lesson) {
            setNewlyUnlockedLesson(lesson);
            playAudio('levelUp');
        }
    } catch (error) {
        handleFirestoreError(error, 'låsa upp lektion');
    }
  }, [currentUser?.uid]);

  // Combined logic for unlocking the first lesson and subsequent lessons
  useEffect(() => {
    if (!isInitialDataLoaded || !currentUser || !userProfile.isCourseActive) {
        return;
    }

    let lastUnlockedIndex = -1;
    for (let i = courseLessons.length - 1; i >= 0; i--) {
      if (userCourseProgress[courseLessons[i].id]?.unlockedAt) {
        lastUnlockedIndex = i;
        break;
      }
    }

    // Case 1: No lesson unlocked yet. Unlock the first one.
    if (lastUnlockedIndex === -1 && courseLessons.length > 0) {
        const firstLessonId = courseLessons[0].id;
        if (!userCourseProgress[firstLessonId]?.unlockedAt) { // Double-check to prevent re-triggering
             console.log(`Unlocking first lesson as course is active.`);
             unlockLesson(firstLessonId, streakData.currentStreak);
        }
        return; // Done for this render
    }
    
    // Case 2: At least one lesson is unlocked. Check for next unlock.
    if (lastUnlockedIndex > -1) {
        const lastUnlockedProgress = userCourseProgress[courseLessons[lastUnlockedIndex].id];
        
        if (lastUnlockedProgress?.unlockedAt) {
            const streakAtUnlock = lastUnlockedProgress.streakAtUnlock ?? 0;
            
            // Condition: 7 new days of streak
            if (streakData.currentStreak >= streakAtUnlock + 7) {
                const nextLessonIndex = lastUnlockedIndex + 1;

                if (nextLessonIndex < courseLessons.length) {
                    const nextLesson = courseLessons[nextLessonIndex];
                    if (!userCourseProgress[nextLesson.id]?.unlockedAt) {
                        console.log(`Unlocking lesson ${nextLesson.title} due to streak condition.`);
                        unlockLesson(nextLesson.id, streakData.currentStreak);
                    }
                }
            }
        }
    }
  }, [isInitialDataLoaded, currentUser, userProfile.isCourseActive, userCourseProgress, streakData.currentStreak, unlockLesson]);

  const handleCloseLessonDetail = () => {
    setViewMode('courseOverview');
    setCurrentLessonId(null);
    playAudio('uiClick');
  };

  const handleSelectLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
    setViewMode('lessonDetail');
    playAudio('uiClick');
  };

  const handleToggleFocusPoint = async (lessonId: string, focusPointId: string) => {
    if (!currentUser) return;
    try {
      const newProgress = { ...userCourseProgress };
      const lessonProgress = newProgress[lessonId] || { completedFocusPoints: [], reflectionAnswer: null, isCompleted: false };
      const newCompletedFocusPoints = lessonProgress.completedFocusPoints.includes(focusPointId)
        ? lessonProgress.completedFocusPoints.filter(id => id !== focusPointId)
        : [...lessonProgress.completedFocusPoints, focusPointId];
      
      lessonProgress.completedFocusPoints = newCompletedFocusPoints;
      newProgress[lessonId] = lessonProgress;
      
      setUserCourseProgress(newProgress);
      await saveCourseProgress(currentUser.uid, lessonId, lessonProgress);
      playAudio('uiClick', 0.6);
    } catch (error) {
        handleFirestoreError(error, 'spara kursframsteg');
    }
  };

  const handleSaveReflection = async (lessonId: string, answer: string) => {
    if (!currentUser) return;
    try {
      const lessonProgress = userCourseProgress[lessonId] || { completedFocusPoints: [], reflectionAnswer: null, isCompleted: false };
      lessonProgress.reflectionAnswer = answer;
      setUserCourseProgress(prev => ({ ...prev, [lessonId]: lessonProgress }));
      await saveCourseProgress(currentUser.uid, lessonId, lessonProgress);
      setToastNotification({message: "Reflektion sparad!", type: "success"});
      setTimeout(() => setToastNotification(null), 2000);
    } catch (error) {
        handleFirestoreError(error, 'spara reflektion');
        throw error;
    }
  };
  
  const handleSaveWhyAnswer = async (lessonId: string, answer: string) => {
    if (!currentUser) return;
    try {
      const lessonProgress = userCourseProgress[lessonId] || { completedFocusPoints: [], reflectionAnswer: null, isCompleted: false };
      lessonProgress.whyAnswer = answer;
      setUserCourseProgress(prev => ({ ...prev, [lessonId]: lessonProgress }));
      await saveCourseProgress(currentUser.uid, lessonId, lessonProgress);
      setToastNotification({message: "Svar sparat!", type: "success"});
      setTimeout(() => setToastNotification(null), 2000);
    } catch (error) {
        handleFirestoreError(error, 'spara svar');
        throw error;
    }
  };
  
  const handleSaveSmartGoalAnswer = async (lessonId: string, answer: string) => {
    if (!currentUser) return;
    try {
      const lessonProgress = userCourseProgress[lessonId] || { completedFocusPoints: [], reflectionAnswer: null, isCompleted: false };
      lessonProgress.smartGoalAnswer = answer;
      setUserCourseProgress(prev => ({ ...prev, [lessonId]: lessonProgress }));
      await saveCourseProgress(currentUser.uid, lessonId, lessonProgress);
      setToastNotification({message: "SMART-mål sparat!", type: "success"});
      setTimeout(() => setToastNotification(null), 2000);
    } catch (error) {
        handleFirestoreError(error, 'spara SMART-mål');
        throw error;
    }
  };


  const handleMarkLessonComplete = async (lessonId: string) => {
    if (!currentUser) return;
    try {
      const lessonProgress = userCourseProgress[lessonId] || { completedFocusPoints: [], reflectionAnswer: null, isCompleted: false };
      lessonProgress.isCompleted = true;
      setUserCourseProgress(prev => ({ ...prev, [lessonId]: lessonProgress }));
      await saveCourseProgress(currentUser.uid, lessonId, lessonProgress);
      playAudio('levelUp', 0.8);
      setToastNotification({message: "Lektion markerad som slutförd!", type: "success"});
      setTimeout(() => setToastNotification(null), 3000);

      const FINAL_LESSON_ID = 'lektion12';
      if (lessonId === FINAL_LESSON_ID) {
          await handleUnlockAchievement('course_completed');
      }
    } catch (error) {
      handleFirestoreError(error, 'markera lektion som slutförd');
    }
  };
  
    const handleExpressCourseInterest = async () => {
        if (!currentUser) return;
        playAudio('uiClick');

        // Optimistic UI update
        setUserProfile(prev => ({ ...prev, courseInterest: true }));

        // Show toast
        setToastNotification({ message: "Ditt intresse har anmälts! Din coach återkommer inom kort.", type: "success" });
        setTimeout(() => setToastNotification(null), 4000);

        try {
            await updateUserDocument(currentUser.uid, { courseInterest: true });
        } catch (error) {
            handleFirestoreError(error, 'anmäla kursintresse');
            // Rollback on error
            setUserProfile(prev => ({ ...prev, courseInterest: false }));
        }
    };

  // --- Course CTA Handlers ---
  const handleOpenSpeedDial = () => {
    setViewMode('main'); // Ensure we are on the main view
    handleFabClick();
  };

  const handleNavigateToJourney = (tab: 'weight' | 'calendar' | 'profile' | 'achievements') => {
    setJourneyInitialTab(tab);
    setViewMode('journey');
  };

  const handleOpenLogWeightModal = () => {
    setViewMode('main');
    openModal(setShowLogWeightModal);
  };
  
  const handleStartChat = (buddy: Peppkompis) => {
      setActiveChatBuddy(buddy);
      setViewMode('chat');
  };

  const handleGetDetailedFeedback = useCallback(async () => {
    setAIFeedbackLoading(true);
    setAIFeedbackError(null);
    setAIFeedbackMessage(null);
    setAiModalTitle("Detaljerad Feedback");
    setAiModalIcon(<SparklesIcon className="w-7 h-7 text-secondary mr-2.5" />);
    setShowAIFeedbackModal(true);
    playAudio('uiClick');
    
    const timeline = calculateGoalTimeline(userProfile);
    
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30DaysSummaries = Object.values(pastDaysSummary).filter(s => {
        const summaryDate = new Date(s.date);
        return summaryDate >= thirtyDaysAgo;
    });

    const dataForAnalysis: AIDataForJourneyAnalysis = {
        userProfile,
        allWeightLogs: weightLogs,
        last30DaysSummaries,
        goalTimeline: timeline
    };

    try {
        const feedback = await getDetailedJourneyAnalysis(dataForAnalysis);
        setAIFeedbackMessage(feedback);
    } catch (e: any) {
        setAIFeedbackError(e.message || "Ett fel uppstod vid generering av analys.");
    } finally {
        setAIFeedbackLoading(false);
    }
  }, [userProfile, weightLogs, pastDaysSummary, currentDate]);

  const handleRecipeSearch = async (searchQuery: string) => {
    setAppStatus(AppStatus.SEARCHING_RECIPE);
    setCurrentRecipe(null); // Clear previous recipe
    setErrorMessage(null);
    try {
      const result = await getRecipeSuggestion(searchQuery);
      setCurrentRecipe(result);
      if (!result.error) {
        setRecentRecipeSearches(prev => {
            const updated = [searchQuery, ...prev.filter(s => s !== searchQuery)];
            return updated.slice(0, MAX_RECENT_RECIPE_SEARCHES);
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Okänt receptsökfel";
      setErrorMessage(errorMsg); // For display in RecipeModal or as toast
      setCurrentRecipe({ error: errorMsg } as RecipeSuggestion); // Set error on recipe too
    } finally {
      setAppStatus(AppStatus.IDLE);
    }
  };

  const handleLogRecipe = (nutritionalInfo: NutritionalInfo) => {
     if (!isViewingToday) {
        setToastNotification({ message: "Du kan endast logga recept för idag.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    addMealToLog(nutritionalInfo, undefined, 'recipe'); // commonMealId 'recipe' or similar
    setShowRecipeModal(false); // Close modal after logging
    setCurrentRecipe(null);
    setToastNotification({ message: `"${nutritionalInfo.foodItem}" loggades!`, type: 'success' });
    setTimeout(() => setToastNotification(null), 3000);
  };

  // --- Ingredient to Recipe Handlers (Updated Flow) ---
  const handleOpenRecipeChoiceModal = () => {
    playAudio('uiClick');
    setShowRecipeChoiceModal(true);
  };
  
  const handleChooseRecipeSearch = () => {
    setShowRecipeChoiceModal(false);
    setShowRecipeModal(true);
  };
  
  const handleChooseTakePhoto = () => {
    setShowRecipeChoiceModal(false);
    setIngredientImagesForCapture([]); // Clear any previous images
    setIsCapturingForIngredients(true);
    openModal(setShowCameraModal);
  };

  const handleChooseUpload = () => {
    setShowRecipeChoiceModal(false);
    setIngredientImagesForCapture([]);
    setIsCapturingForIngredients(true);
    document.getElementById('ingredientUploadInput')?.click();
  };
  
  const handleIngredientImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      openModal(setShowIngredientCaptureModal);
      handleAddIngredientImagesFromUpload(files);
    }
    if (event.target) event.target.value = '';
  };
  
  const handleRemoveImage = (indexToRemove: number) => {
    setIngredientImagesForCapture(prev => prev.filter((_, index) => index !== indexToRemove));
    playAudio('uiClick');
  };

  const handleFindRecipesFromIngredients = async (imagesDataUrls: string[]) => {
    setShowIngredientCaptureModal(false); // Close capture modal
    setAppStatus(AppStatus.ANALYZING_INGREDIENTS);
    setIngredientAnalysisResult(null); // Clear previous results
    setErrorMessage(null);
    try {
        const imageBase64Data = imagesDataUrls.map(dataUrl => dataUrl.split(',')[1]).filter(Boolean);
        const result = await getRecipesFromIngredientsImage(imageBase64Data as string[]);
        setIngredientAnalysisResult(result);
        setShowIngredientRecipeResultsModal(true); // Show results modal
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Kunde inte generera recept från ingredienser.";
      setErrorMessage(errorMsg);
      setToastNotification({ message: errorMsg, type: 'error' });
      setTimeout(() => setToastNotification(null), 3500);
    } finally {
      setAppStatus(AppStatus.IDLE);
      setIsCapturingForIngredients(false); // Reset flag
    }
  };

  const handleLogRecipeFromIngredients = (nutritionalInfo: NutritionalInfo) => {
    if (!isViewingToday) {
        setToastNotification({ message: "Du kan endast logga recept för idag.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    addMealToLog(nutritionalInfo, undefined, 'ingredient_recipe');
    // Keep results modal open for now, user might want to log another
    setToastNotification({ message: `"${nutritionalInfo.foodItem}" loggades!`, type: 'success' });
    setTimeout(() => setToastNotification(null), 3000);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setShowBarcodeScannerModal(false);
    setAppStatus(AppStatus.SEARCHING_BARCODE);
    try {
      const result = await getFoodInfoFromBarcode(barcode);
      setBarcodeScanResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ett okänt fel uppstod";
      setToastNotification({ message: `Streckkodsfel: ${errorMessage}`, type: "error" });
      setTimeout(() => setToastNotification(null), 3500);
    } finally {
      setAppStatus(AppStatus.IDLE);
    }
  };

  const handleLogFromBarcode = (nutritionalInfo: NutritionalInfo) => {
    if (isViewingToday) {
      addMealToLog(nutritionalInfo, barcodeScanResult?.imageUrl, 'barcode');
      setBarcodeScanResult(null);
    }
  };

    const handleSaveWeightLog = async (data: Omit<WeightLogEntry, 'id'>) => {
        if (!currentUser) return;
        try {
            const newDocId = await saveWeightLog(currentUser.uid, data);
            const newWeightLogEntry: WeightLogEntry = {
                id: newDocId,
                ...data,
            };
            setWeightLogs(prev => [...prev, newWeightLogEntry].sort((a,b) => a.loggedAt - b.loggedAt));
            
            // Also update the local profile state to reflect the new current values
            setUserProfile(prevProfile => ({
                ...prevProfile,
                currentWeightKg: data.weightKg,
                skeletalMuscleMassKg: data.skeletalMuscleMassKg ?? prevProfile.skeletalMuscleMassKg,
                bodyFatMassKg: data.bodyFatMassKg ?? prevProfile.bodyFatMassKg
            }));
            
            setShowLogWeightModal(false);
            playAudio('logSuccess');
            setToastNotification({ message: 'Vikt loggad!', type: 'success' });
            setRelatedWeightLogIdForWellbeing(newDocId);
            setShowMentalWellbeingModal(true);

            // Check for goal completion after saving new weight
            if (userProfile.desiredFatMassChangeKg !== undefined && userProfile.currentWeightKg) {
                const targetWeight = userProfile.currentWeightKg + userProfile.desiredFatMassChangeKg;
                if (data.weightKg <= targetWeight) { // Assuming a loss goal
                    await handleUnlockAchievement('main_goal_reached');
                }
            } else if (userProfile.desiredMuscleMassChangeKg !== undefined && userProfile.currentWeightKg) {
                const targetWeight = userProfile.currentWeightKg + userProfile.desiredMuscleMassChangeKg;
                if (data.weightKg >= targetWeight) { // Assuming a gain goal
                    await handleUnlockAchievement('main_goal_reached');
                }
            }
        } catch (error) {
            handleFirestoreError(error, 'spara viktlogg');
        }
    };


  const handleSaveMentalWellbeingLog = async (data: MentalWellbeingData) => {
    if (!currentUser) return;
    const isDataLogged = Object.values(data).some(v => v !== null);

    if (isDataLogged) {
        const newLog: Omit<MentalWellbeingLog, 'id'> = {
            loggedAt: Date.now(),
            dateString: getDateUID(viewingDate),
            ...data,
            relatedWeightLogId: relatedWeightLogIdForWellbeing || undefined,
        };
        try {
            await addMentalWellbeingLog(currentUser.uid, newLog);
            setToastNotification({ message: 'Välbefinnande sparat!', type: 'success' });
            playAudio('logSuccess', 0.8);
            setTimeout(() => setToastNotification(null), 3000);
        } catch (error) {
            handleFirestoreError(error, 'spara välbefinnande');
        }
    }
    
    setShowMentalWellbeingModal(false);
    setRelatedWeightLogIdForWellbeing(null);
  };


  const handleFabClick = () => {
    playAudio('uiClick');
    if (!isViewingToday) {
        setToastNotification({message: "Du kan endast logga för idag.", type: "error"});
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    setShowSpeedDial(prev => !prev);
  };

  const originalBodyOverflow = useRef(document.body.style.overflow);
  useEffect(() => {
    const isAnyModalOpen = showUserProfileModal || showInfoModal || showRecipeModal || showCameraModal || showTextEntryModal || showSaveCommonMealModal || showIngredientCaptureModal || showIngredientRecipeResultsModal || showRecipeChoiceModal || showSpeedDial || showLevelUpModal || showGoalMetModalData || showCourseInfoModalOnLoad || showAIFeedbackModal || showLogWeightModal || showMentalWellbeingModal || showOnboardingCompletion || showBarcodeScannerModal || !!barcodeScanResult || !!newlyUnlockedLesson || showBuddySystemModal || showPeppNotificationsModal;
    if (isAnyModalOpen) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = originalBodyOverflow.current;
    }
    return () => {
        if (document.body.style.overflow === 'hidden') {
            document.body.style.overflow = originalBodyOverflow.current;
        }
    };
  }, [showUserProfileModal, showInfoModal, showRecipeModal, showCameraModal, showTextEntryModal, showSaveCommonMealModal, showIngredientCaptureModal, showIngredientRecipeResultsModal, showRecipeChoiceModal, showSpeedDial, showLevelUpModal, showGoalMetModalData, showCourseInfoModalOnLoad, showAIFeedbackModal, showLogWeightModal, showMentalWellbeingModal, showOnboardingCompletion, showBarcodeScannerModal, barcodeScanResult, newlyUnlockedLesson, showBuddySystemModal, showPeppNotificationsModal]);
  
  const totalCaloriesCoveredByBankToday = useMemo(() => {
    return dailyLog.reduce((sum, meal) => sum + (meal.caloriesCoveredByBank || 0), 0);
  }, [dailyLog]);
  
  const handleUnlockAchievement = useCallback(async (achievementId: string) => {
    if (!currentUser || unlockedAchievements[achievementId]) {
      return; // Already unlocked or no user
    }
    
    const unlockedDate = new Date().toISOString();
    
    // Optimistic update
    const newUnlocked = { ...unlockedAchievements, [achievementId]: unlockedDate };
    setUnlockedAchievements(newUnlocked);
    
    const achievement = ACHIEVEMENT_DEFINITIONS.find(a => a.id === achievementId);
    if (achievement) {
        setToastNotification({ message: `Bragd upplåst: ${achievement.name}`, type: 'success' });
        setTimeout(() => setToastNotification(null), 4000);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
        playAudio('levelUp');
    }

    try {
      await updateUserDocument(currentUser.uid, { unlockedAchievements: newUnlocked });
    } catch (error) {
      handleFirestoreError(error, 'uppdatera bragder');
      // Rollback optimistic update
      const rolledBack = { ...unlockedAchievements };
      delete rolledBack[achievementId];
      setUnlockedAchievements(rolledBack);
    }
  }, [currentUser, unlockedAchievements]);

  useEffect(() => {
    // Level Up Check
    const { currentLevel } = getUserLevelInfo(streakData.currentStreak);
    if (currentLevel.id !== lastNotifiedStreakLevelUp && currentLevel.id !== LEVEL_DEFINITIONS[0].id) {
        if (currentLevel.id !== highestLevelId) {
            setShowLevelUpModal(currentLevel);
            setLastNotifiedStreakLevelUp(currentLevel.id);
            if (currentLevel.id > (highestLevelId || 'level0')) {
                const newHighestLevelId = currentLevel.id;
                setHighestLevelId(newHighestLevelId);
                if (currentUser) {
                    updateUserDocument(currentUser.uid, { highestLevelId: newHighestLevelId });
                }
            }
            setShowConfetti(true);
            playAudio('levelUp');
            setTimeout(() => setShowConfetti(false), 5000);
        }
    }
  }, [streakData.currentStreak, lastNotifiedStreakLevelUp, highestLevelId, currentUser]);

  useEffect(() => {
    if (highestStreak > 0 && isInitialDataLoaded) {
        ACHIEVEMENT_DEFINITIONS.forEach(ach => {
            if (ach.type === 'streak' && highestStreak >= ach.requiredValue) {
                handleUnlockAchievement(ach.id);
            }
        });
    }
  }, [highestStreak, isInitialDataLoaded, handleUnlockAchievement]);

  const handleOpenPeppNotifications = async () => {
    if (!currentUser) return;
    playAudio('uiClick');
    setShowPeppNotificationsModal(true);
    setHasNewPeppsForMe(false);
    localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_MY_PEPPS_VIEW_TIMESTAMP, Date.now().toString());

    setIsLoadingPeppFeed(true);
    try {
        const timeline = await fetchTimelineForCurrentUser(currentUser.uid, ACHIEVEMENT_DEFINITIONS);
        
        const feed = timeline
            .filter(event => Object.keys(event.pepps).length > 0)
            .flatMap((event): PeppNotificationItem[] => 
                Object.entries(event.pepps).map(([peppFromUid, peppData]) => ({
                    event: event,
                    peppFromUid,
                    peppData,
                    uniqueId: `${event.id}-${peppFromUid}-${peppData.timestamp}`
                }))
            )
            .sort((a, b) => b.peppData.timestamp - a.peppData.timestamp);

        setPeppFeed(feed);
    } catch (e) {
        console.error("Failed to fetch pepp notifications:", e);
        setToastNotification({ message: 'Kunde inte hämta notiser.', type: 'error' });
    } finally {
        setIsLoadingPeppFeed(false);
    }
  };


  if (authLoading || isDataLoading) {
    return <LoadingSpinner message={authLoading ? "Autentiserar..." : "Laddar dina data..."} />;
  }

  if (!currentUser) {
    return <AuthForm onAuthStateChange={setCurrentUser} />;
  }

  if (userStatus === 'pending') {
    return <PendingApprovalScreen onLogout={handleLogout} userEmail={currentUser.email} />;
  }
  
  if (userRole === 'coach' && currentInterface === 'coach') {
    return <CoachDashboard 
              onLogout={handleLogout} 
              currentUserEmail={currentUser.email || "Coach"} 
              currentUserId={currentUser.uid}
              onToggleInterface={toggleInterfaceView}
           />;
  }


  const handleAddOptionSelect = (option: 'camera' | 'upload' | 'text' | 'recipe' | 'barcode') => {
    setShowSpeedDial(false); // Close speed dial menu first
    playAudio('uiClick');
    switch (option) {
      case 'camera':
        setIsCapturingForIngredients(false); // Ensure this is for single meal
        openModal(setShowCameraModal);
        break;
      case 'upload':
        setIsCapturingForIngredients(false); // Ensure this is for single meal
        document.getElementById('imageUploadInputMain')?.click(); // Trigger hidden input
        break;
      case 'text':
        openModal(setShowTextEntryModal);
        break;
      case 'recipe':
        handleOpenRecipeChoiceModal(); // This opens the choice modal (search vs scan)
        break;
      case 'barcode':
        openModal(setShowBarcodeScannerModal);
        break;
    }
  };

  const HeaderButton: React.FC<{
    onClick: () => void;
    label: string;
    ariaLabel: string;
    title?: string;
    className?: string;
    isActive?: boolean;
  }> = ({ onClick, label, ariaLabel, title, className, isActive }) => (
    <button
      onClick={onClick}
      className={`flex items-center justify-center px-4 py-2 text-sm bg-neutral-light hover:bg-gray-200 text-neutral-dark font-medium rounded-lg shadow-sm active:scale-95 transition-all ${isActive ? 'ring-2 ring-primary' : ''} ${className || ''}`}
      aria-label={ariaLabel}
      title={title || ariaLabel}
    >
      <span className="truncate">{label}</span>
    </button>
  );

  const DropdownMenuItem: React.FC<{
    onClick: () => void;
    icon: JSX.Element;
    label: string;
    className?: string;
  }> = ({ onClick, icon, label, className }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-4 py-2.5 text-sm text-neutral-dark hover:bg-neutral-light/70 flex items-center rounded-md transition-colors ${className || ''}`}
    >
        {React.cloneElement(icon, { className: "w-5 h-5 mr-2.5 text-neutral" })}
        {label}
    </button>
);

  const mainContentMaxWidth = 'max-w-4xl';
    
    const { currentLevel } = getUserLevelInfo(streakData.currentStreak);

  return (
    <>
      <div className="min-h-screen bg-neutral-light flex flex-col items-center">
        {persistenceWarning && (
            <div className="w-full bg-yellow-400 text-yellow-900 p-3 text-center sticky top-0 z-[1000] shadow-md">
                <p className="font-bold">⚠️ Varning för Offlineläge</p>
                <p className="text-sm">{persistenceWarning}</p>
            </div>
        )}
         <header className="w-full bg-white text-neutral-dark p-5 shadow-lg sticky top-0 z-30">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-4">
                <h1 className="text-3xl sm:text-4xl font-bold text-neutral-dark">
                  Välkommen, {userProfile.name || currentUser?.displayName || 'Användare'}!
                </h1>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3">
                <HeaderButton
                    onClick={() => {
                        playAudio('uiClick');
                        setViewMode('main');
                        setCurrentLessonId(null);
                    }}
                    label="Startsida"
                    ariaLabel="Tillbaka till startsidan"
                    isActive={viewMode === 'main'}
                />
                 <HeaderButton 
                    onClick={() => { playAudio('uiClick'); setJourneyInitialTab('weight'); setViewMode('journey'); }}
                    label="Min Resa"
                    ariaLabel="Visa min resa"
                    isActive={viewMode === 'journey'}
                />
                <HeaderButton 
                    onClick={() => { playAudio('uiClick'); setViewMode('courseOverview');}} 
                    label="Kurs" 
                    ariaLabel="Visa kursöversikt" 
                    isActive={viewMode === 'courseOverview' || viewMode === 'lessonDetail'}
                />
                <div className="relative" ref={profileDropdownRef}>
                    <HeaderButton 
                        onClick={() => { playAudio('uiClick'); setShowProfileDropdown(prev => !prev);}} 
                        label="Konto"
                        ariaLabel="Kontomeny"
                        isActive={showProfileDropdown}
                    />
                    {showProfileDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-neutral-light/70 p-2 z-40 animate-fade-slide-in">
                             <DropdownMenuItem
                                icon={<PencilIcon/>}
                                label="Redigera Profil"
                                onClick={() => {
                                    setShowUserProfileModal(true);
                                    setShowProfileDropdown(false);
                                    playAudio('uiClick');
                                }}
                            />
                            <DropdownMenuItem
                                icon={<UserGroupIcon />}
                                label="Peppkompis"
                                onClick={() => {
                                    setShowBuddySystemModal(true);
                                    setShowProfileDropdown(false);
                                    playAudio('uiClick');
                                }}
                            />
                            <DropdownMenuItem
                                icon={<InformationCircleIcon />}
                                label="Information"
                                onClick={() => {
                                    handleOpenInfoModal();
                                    setShowProfileDropdown(false);
                                }}
                            />
                             <DropdownMenuItem
                                icon={<ChatBubbleOvalLeftEllipsisIcon />}
                                label="Lämna Feedback"
                                onClick={() => {
                                    window.open('https://docs.google.com/forms/d/e/1FAIpQLSf3_ZzAUa_3OMSnE0wrdY5pZ_0UzfKIvw_T0lFRjKdBfqIrJw/viewform?usp=header', '_blank', 'noopener,noreferrer');
                                    setShowProfileDropdown(false);
                                    playAudio('uiClick');
                                }}
                            />
                            {userRole === 'coach' && (
                                <DropdownMenuItem
                                    icon={<SwitchHorizontalIcon />}
                                    label={currentInterface === 'member' ? "Till Admin-vy" : "Till Medlemsvy"}
                                    onClick={toggleInterfaceView}
                                />
                            )}
                            <div className="my-1 border-t border-neutral-light/70"></div>
                            <DropdownMenuItem
                                icon={<ArrowRightOnRectangleIcon />}
                                label="Logga ut"
                                onClick={handleLogout}
                                className="text-red-600 hover:bg-red-50"
                            />
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleOpenPeppNotifications}
                        className="relative p-3 bg-neutral-light hover:bg-gray-200 text-neutral-dark font-medium rounded-full shadow-sm active:scale-95 transition-all"
                        aria-label="Visa pepp-notiser"
                        title="Visa pepp-notiser"
                    >
                        <HeartIcon className={`w-6 h-6 transition-colors ${hasNewPeppsForMe ? 'text-red-500' : 'text-neutral'}`} />
                        {hasNewPeppsForMe && (
                          <span className="absolute top-1.5 right-1.5 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                          </span>
                        )}
                    </button>
                    <button
                        onClick={() => { playAudio('uiClick'); setViewMode('chat'); setActiveChatBuddy(null); }}
                        className="relative p-3 bg-neutral-light hover:bg-gray-200 text-neutral-dark font-medium rounded-full shadow-sm active:scale-95 transition-all"
                        aria-label="Öppna chatt"
                        title="Öppna chatt"
                    >
                        <ChatBubbleLeftRightIcon className="w-6 h-6 text-neutral" />
                        {totalUnreadCount > 0 && (
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold ring-2 ring-white">
                                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                            </span>
                        )}
                    </button>
                </div>
              </div>
          </div>
        </header>

        <main className={`w-full ${mainContentMaxWidth} mx-auto p-4 sm:p-6 flex-grow`}>
         {viewMode === 'main' && (
            <>
              <section aria-labelledby="daily-overview-heading" className="mb-6 bg-white p-5 sm:p-6 rounded-xl shadow-soft-lg border border-neutral-light">
                <h2 id="daily-overview-heading" className="sr-only">Daglig Översikt</h2>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-4">
                    <div className="flex items-start justify-between w-full sm:w-auto">
                        <div>
                            <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">Streak</h3>
                            <p className="text-lg font-bold text-secondary">{streakData.currentStreak} dagar</p>
                            {highestStreak > 0 && highestStreak > streakData.currentStreak && (
                                <p className="text-xs text-neutral mt-0.5">(Rekord: {highestStreak})</p>
                            )}
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">Nivå</h3>
                            <p className="text-lg font-bold text-primary truncate" title={currentLevel.name}>{currentLevel.name}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-stretch gap-x-3 w-full sm:w-auto">
                        <div className="flex-1 bg-neutral-light px-4 py-3 rounded-lg shadow-sm text-center">
                            <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">Sparpott</h3>
                            <p className="text-lg font-bold text-primary">{weeklyBank.bankedCalories.toFixed(0)} kcal</p>
                        </div>
                         <button
                            onClick={() => {
                                playAudio('uiClick');
                                setViewMode('buddies');
                                setHasNewBuddyUpdates(false);
                                // Don't reset hasNewPeppsForMe here, it's handled by the heart icon click now.
                            }}
                            className="group flex-1 bg-neutral-light px-4 py-3 rounded-lg shadow-sm text-center hover:bg-gray-200 interactive-transition"
                            aria-label="Visa Peppkompisar"
                        >
                            <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap flex items-center justify-center">
                                {hasNewBuddyUpdates && <BellIcon className="w-4 h-4 mr-1 text-accent animate-pulse" title="Ny aktivitet från en kompis!" />}
                                <span>Peppkompisar</span>
                            </h3>
                            <p className="text-lg font-bold text-primary">{buddies.length} st</p>
                        </button>
                    </div>
                </div>

                 <WeeklyProgressDays 
                    pastDaysSummary={pastDaysSummary} 
                    currentAppDate={currentDate} 
                    onDayClick={(date) => {
                        playAudio('uiClick');
                        setViewingDate(date);
                    }}
                    viewingDate={viewingDate}
                />
                 <p className="text-xl font-semibold text-neutral-dark text-center mt-3 -mb-1">{isViewingToday ? "Dagens framsteg" : formattedViewingDate}</p>

                 <div className="mt-4">
                  <ProgressDisplay
                    label="Kalorier"
                    current={totalNutrients.calories}
                    goal={goals.calorieGoal}
                    unit="kcal"
                    icon={<span className="text-2xl" role="img" aria-label="Kalorier">🔥</span>}
                    minSafeThreshold={minSafeCalories}
                    bankedCaloriesAvailable={weeklyBank.bankedCalories}
                    amountCoveredByBankToday={totalCaloriesCoveredByBankToday}
                  />
                  <ProgressDisplay
                    label="Protein"
                    current={totalNutrients.protein}
                    goal={goals.proteinGoal}
                    unit="g"
                    icon={<span className="text-2xl" role="img" aria-label="Protein">💪</span>}
                    minSafeThreshold={0} bankedCaloriesAvailable={0} 
                  />
                  <ProgressDisplay
                    label="Kolhydrater"
                    current={totalNutrients.carbohydrates}
                    goal={goals.carbohydrateGoal}
                    unit="g"
                    icon={<span className="text-2xl" role="img" aria-label="Kolhydrater">🍞</span>}
                    minSafeThreshold={0} bankedCaloriesAvailable={0} 
                  />
                  <ProgressDisplay
                    label="Fett"
                    current={totalNutrients.fat}
                    goal={goals.fatGoal}
                    unit="g"
                    icon={<span className="text-2xl" role="img" aria-label="Fett">🥑</span>}
                    minSafeThreshold={0} bankedCaloriesAvailable={0} 
                  />
                </div>
                <div className="mt-6">
                     <button
                        onClick={handleGetDetailedFeedback}
                        disabled={aiFeedbackLoading}
                        className="w-full px-5 py-3 bg-white hover:bg-neutral-light border border-neutral-light text-primary-darker font-semibold rounded-lg shadow-soft-lg active:scale-95 interactive-transition flex items-center justify-center disabled:opacity-60"
                    >
                        {aiFeedbackLoading && (
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary mr-2"></div>
                        )}
                        <SparklesIcon className="w-5 h-5 mr-2" />
                        Få Detaljerad Feedback från Flexibot
                    </button>
                </div>
              </section>
            
              <div className="space-y-6 mt-6">
                <WaterLogger 
                  currentWaterMl={waterLoggedMl} 
                  waterGoalMl={waterGoalMl} 
                  onLogWater={handleLogWater} 
                  onResetWater={handleResetWater}
                  disabled={!isViewingToday}
                />
                <CommonMealsList 
                  commonMeals={commonMeals} 
                  onLogCommonMeal={logCommonMeal} 
                  onDeleteCommonMeal={deleteCommonMeal}
                  onUpdateCommonMeal={handleUpdateCommonMeal}
                  disabled={!isViewingToday}
                />
              </div>


              <section aria-labelledby="todays-log-heading" className="mt-8">
                <h2 id="todays-log-heading" className="text-2xl font-semibold text-neutral-dark mb-4">
                  {isViewingToday ? "Dagens logg" : "Logg för valt datum"} ({dailyLog.length} {dailyLog.length === 1 ? 'post' : 'poster'})
                </h2>
                {dailyLog.length === 0 ? (
                  <p className="text-center text-neutral-dark bg-white p-6 rounded-lg shadow border border-neutral-light">
                    {isViewingToday ? "Inga måltider loggade idag. Klicka på plus-knappen för att börja!" : "Inga måltider loggade denna dag."}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {dailyLog.map(meal => (
                      <MealItemCard 
                        key={meal.id} 
                        meal={meal} 
                        onDelete={handleDeleteMeal} 
                        onUpdate={handleUpdateMeal}
                        onSelectForCommonSave={handleOpenSaveCommonMealModal}
                        isReadOnly={!isViewingToday}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {viewMode === 'journey' && (
            <JourneyView
              pastDaysData={pastDaysSummary}
              weightLogs={weightLogs}
              userProfile={userProfile}
              goals={goals}
              onSaveProfileAndGoals={handleSaveProfileAndGoals}
              onOpenLogWeightModal={() => openModal(setShowLogWeightModal)}
              playAudio={playAudio}
              onUpdateSimpleDayStatus={handleUpdateSimpleDayStatus}
              viewingDate={viewingDate}
              setViewingDate={setViewingDate}
              currentDate={currentDate}
              initialTab={journeyInitialTab}
              highestStreak={highestStreak}
              highestLevelId={highestLevelId}
              minSafeCalories={minSafeCalories}
              setToastNotification={setToastNotification}
              achievements={ACHIEVEMENT_DEFINITIONS}
              unlockedAchievements={unlockedAchievements}
            />
          )}

          {viewMode === 'buddies' && (
            <BuddyListView
                buddies={buddyDetailsList}
                isLoading={isLoadingBuddies}
                onBack={() => setViewMode('main')}
                onStartChat={handleStartChat}
                achievements={ACHIEVEMENT_DEFINITIONS}
                setToastNotification={setToastNotification}
                currentUserName={userProfile.name || 'En kompis'}
            />
          )}

          {viewMode === 'courseOverview' && (
            <CourseOverview
              lessons={courseLessons}
              userProgress={userCourseProgress}
              onSelectLesson={handleSelectLesson}
              isCourseActive={userProfile.isCourseActive || false}
              currentStreak={streakData.currentStreak}
              onExpressCourseInterest={handleExpressCourseInterest}
              courseInterest={userProfile.courseInterest || false}
            />
          )}

          {viewMode === 'lessonDetail' && currentLessonId && (
            <LessonDetail
              lesson={courseLessons.find(l => l.id === currentLessonId)!}
              progress={userCourseProgress[currentLessonId]}
              onToggleFocusPoint={handleToggleFocusPoint}
              onSaveReflection={handleSaveReflection}
              onSaveWhyAnswer={handleSaveWhyAnswer}
              onSaveSmartGoalAnswer={handleSaveSmartGoalAnswer}
              onMarkComplete={handleMarkLessonComplete}
              onOpenSpeedDial={handleOpenSpeedDial}
              onNavigateToJourney={handleNavigateToJourney}
              userProfile={userProfile}
              weightLogs={weightLogs}
              pastDaysSummary={Object.values(pastDaysSummary)}
              onOpenLogWeightModal={handleOpenLogWeightModal}
              onClose={handleCloseLessonDetail}
            />
          )}
          {viewMode === 'chat' && currentUser && (
              <ChatView
                  currentUser={currentUser}
                  activeBuddy={activeChatBuddy}
                  onSelectBuddy={setActiveChatBuddy}
                  onBack={() => {
                      setViewMode('main');
                      setActiveChatBuddy(null);
                  }}
                  setToastNotification={setToastNotification}
              />
          )}
        </main>

        <footer className="w-full text-center p-5 mt-auto bg-neutral-light border-t border-neutral-light">
          <p className="text-sm text-neutral">@ 2025 Flexibel Hälsostudio. Alla rättigheter förbehållna.</p>
        </footer>
      </div>
      
      {/* Hidden file input for direct image upload */}
      <input 
        type="file" 
        id="imageUploadInputMain" 
        className="hidden" 
        accept="image/*" 
        onChange={handleImageUpload} 
        aria-hidden="true"
      />
      <input
        type="file"
        id="ingredientUploadInput"
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleIngredientImageUpload}
        aria-hidden="true"
      />

      {/* --- Speed Dial & FAB --- */}
      {viewMode !== 'chat' && (
        <>
          <div className="fixed bottom-6 right-6 z-40">
              <div className="flex flex-col-reverse items-end gap-y-4">
                  {/* Speed Dial Menu Items */}
                  {showSpeedDial && (
                      ([
                          { label: "Sök & Logga", icon: <SearchIcon className="w-8 h-8 text-neutral-dark"/>, action: 'text' },
                          { label: "Skanna Streckkod", icon: <BarcodeIcon className="w-8 h-8 text-neutral-dark"/>, action: 'barcode' },
                          { label: "Ladda upp matbild", icon: <UploadIcon className="w-8 h-8 text-neutral-dark"/>, action: 'upload' },
                          { label: "Hitta Recept", icon: <RecipeIcon className="w-8 h-8 text-neutral-dark"/>, action: 'recipe' },
                          { label: "Fota din mat", icon: <CameraIcon className="w-8 h-8 text-neutral-dark"/>, action: 'camera' },
                      ] as const).map((item, index) => (
                          <div 
                              key={item.action} 
                              className="flex items-center gap-x-4 animate-slide-up-fade-in cursor-pointer"
                              style={{ animationDelay: `${(4 - index) * 40}ms` }}
                              onClick={(e) => { e.stopPropagation(); handleAddOptionSelect(item.action); }}
                          >
                              <span className="bg-white text-neutral-dark px-4 py-2 rounded-lg shadow-lg text-lg font-semibold">{item.label}</span>
                              <div className="bg-white p-4 rounded-full shadow-lg hover:bg-neutral-light active:scale-90 interactive-transition hover:shadow-xl">
                                  {item.icon}
                              </div>
                          </div>
                      ))
                  )}

                  {/* Main FAB Button */}
                  <button
                      onClick={handleFabClick}
                      className="w-20 h-20 bg-secondary hover:bg-secondary-darker text-white rounded-full flex items-center justify-center shadow-xl active:scale-95 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl"
                      aria-haspopup="true"
                      aria-expanded={showSpeedDial}
                      aria-label={showSpeedDial ? "Stäng loggningsmeny" : "Öppna loggningsmeny"}
                  >
                      <PlusIcon className={`w-10 h-10 transition-transform duration-300 ${showSpeedDial ? 'rotate-45' : ''}`} />
                  </button>
              </div>
          </div>
          {/* Overlay for when speed dial is open */}
          {showSpeedDial && (
              <div 
                  className="fixed inset-0 bg-black/40 animate-fade-in z-30" 
                  onClick={() => {
                      playAudio('uiClick');
                      setShowSpeedDial(false);
                  }}
              ></div>
          )}
        </>
      )}
      {/* --- End Speed Dial & FAB --- */}

      {/* Modals & Overlays */}
      {showUserProfileModal && (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
            <UserProfileModal 
                initialProfile={userProfile} 
                onSave={handleSaveProfileAndGoals} 
                onClose={handleCloseUserProfileModal}
                isOnboarding={!hasCompletedOnboarding && userRole==='member'}
                onboardingStep={onboardingStep}
                aiFeedbackLoading={aiFeedbackLoading}
                aiFeedbackMessage={aiFeedbackMessage}
                aiFeedbackError={aiFeedbackError}
            />
        </div>
      )}
      {showInfoModal && (
          <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => closeModal(setShowInfoModal)}>
              <div onClick={(e) => e.stopPropagation()}>
                  <InfoModal onClose={() => closeModal(setShowInfoModal)} userName={userProfile.name} />
              </div>
          </div>
      )}
       {showSaveCommonMealModal && mealToSaveAsCommon && (
            <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => closeModal(setShowSaveCommonMealModal)}>
                <div onClick={(e) => e.stopPropagation()}>
                    <SaveCommonMealModal 
                        mealInfo={mealToSaveAsCommon.nutritionalInfo} 
                        initialName={mealToSaveAsCommon.nutritionalInfo.foodItem || 'Okänt val'} 
                        onSave={(name) => saveCommonMeal(mealToSaveAsCommon.nutritionalInfo, name)} 
                        onClose={() => closeModal(setShowSaveCommonMealModal)} 
                    />
                </div>
            </div>
      )}
      {showTextEntryModal && (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => closeModal(setShowTextEntryModal)}>
          <div onClick={e => e.stopPropagation()}>
            <TextEntryModal 
              show={showTextEntryModal}
              onClose={() => closeModal(setShowTextEntryModal)}
              onLog={(foodInfo, opts) => handleLogFromModal(foodInfo, opts)}
            />
          </div>
        </div>
      )}
      {appStatus === AppStatus.ANALYZING && <LoadingSpinner message="Analyserar bild..." />}
      {appStatus === AppStatus.ANALYZING_INGREDIENTS && <LoadingSpinner message="Analyserar ingredienser och skapar recept..." />}
      {appStatus === AppStatus.SEARCHING_BARCODE && <LoadingSpinner message="Letar efter produkt..." />}
      {analysisResultForModal && cameraImageForAnalysis && (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => setAnalysisResultForModal(null)}>
            <div onClick={(e) => e.stopPropagation()}>
              <ImageAnalysisResultModal 
                analysisResult={analysisResultForModal}
                imageDataUrl={`data:image/jpeg;base64,${cameraImageForAnalysis}`}
                onLog={(info, opts) => handleLogFromModal(info, opts, `data:image/jpeg;base64,${cameraImageForAnalysis}`)}
                onClose={() => setAnalysisResultForModal(null)}
              />
            </div>
        </div>
      )}
      
      {showCameraModal && (
        <CameraModal 
            show={showCameraModal} 
            onClose={() => closeModal(setShowCameraModal)} 
            onImageCapture={handleImageCapture}
            onCameraError={(msg) => {
                setToastNotification({ message: `Kamerafel: ${msg}`, type: 'error' });
                setTimeout(() => setToastNotification(null), 4000);
            }}
        />
      )}
       {showBarcodeScannerModal && (
        <BarcodeScannerModal
            show={showBarcodeScannerModal}
            onClose={() => closeModal(setShowBarcodeScannerModal)}
            onBarcodeScanned={handleBarcodeScanned}
            onCameraError={(msg) => {
                setToastNotification({ message: `Kamerafel: ${msg}`, type: 'error' });
                setTimeout(() => setToastNotification(null), 4000);
                closeModal(setShowBarcodeScannerModal);
            }}
        />
      )}
      
      {barcodeScanResult && (
          <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in" onClick={() => setBarcodeScanResult(null)}>
              <div onClick={(e) => e.stopPropagation()}>
                <BarcodeSearchResultModal
                    scanResult={barcodeScanResult}
                    onLog={handleLogFromBarcode}
                    onClose={() => setBarcodeScanResult(null)}
                />
              </div>
          </div>
      )}
      {showIngredientCaptureModal && (
          <IngredientCaptureModal
              show={showIngredientCaptureModal}
              onClose={() => { closeModal(setShowIngredientCaptureModal); setIsCapturingForIngredients(false); }}
              onFindRecipes={handleFindRecipesFromIngredients}
              openCameraModal={() => openModal(setShowCameraModal)}
              images={ingredientImagesForCapture}
              onRemoveImage={handleRemoveImage}
              onUploadImages={handleAddIngredientImagesFromUpload}
          />
      )}
       {showIngredientRecipeResultsModal && ingredientAnalysisResult && (
            <IngredientRecipeResultsModal
                show={showIngredientRecipeResultsModal}
                onClose={() => closeModal(setShowIngredientRecipeResultsModal)}
                identifiedIngredients={ingredientAnalysisResult.identifiedIngredients}
                recipeSuggestions={ingredientAnalysisResult.recipeSuggestions}
                onLogRecipe={handleLogRecipeFromIngredients}
                isLoading={appStatus === AppStatus.ANALYZING_INGREDIENTS}
                error={errorMessage}
                isLoggingDisabled={!isViewingToday}
            />
       )}
      
       <RecipeModal
        show={showRecipeModal}
        onClose={() => { closeModal(setShowRecipeModal); setCurrentRecipe(null); setErrorMessage(null); }}
        onSearch={handleRecipeSearch}
        onLogRecipe={handleLogRecipe}
        recipe={currentRecipe}
        isLoading={appStatus === AppStatus.SEARCHING_RECIPE}
        error={errorMessage}
        isLoggingDisabled={!isViewingToday}
        recentSearches={recentRecipeSearches}
        setToastNotification={setToastNotification}
      />

      <RecipeChoiceModal
        show={showRecipeChoiceModal}
        onClose={() => closeModal(setShowRecipeChoiceModal)}
        onChooseSearch={handleChooseRecipeSearch}
        onChooseTakePhoto={handleChooseTakePhoto}
        onChooseUpload={handleChooseUpload}
      />


      {showLevelUpModal && <LevelUpModal level={showLevelUpModal} onClose={() => setShowLevelUpModal(null)} />}
      {showGoalMetModalData && <GoalMetModal data={showGoalMetModalData} onClose={() => setShowGoalMetModalData(null)} />}
      {newlyUnlockedLesson && <NewLessonUnlockedModal lessonTitle={newlyUnlockedLesson.title} onClose={() => setNewlyUnlockedLesson(null)} />}
      <ConfettiCelebration isActive={showConfetti} />
      {showCourseInfoModalOnLoad && <CourseInfoModal show={showCourseInfoModalOnLoad} onClose={() => setShowCourseInfoModalOnLoad(false)} />}
      <AIFeedbackModal
        show={showAIFeedbackModal}
        onClose={() => closeModal(setShowAIFeedbackModal)}
        feedbackMessage={aiFeedbackMessage}
        isLoading={aiFeedbackLoading}
        error={aiFeedbackError}
        modalTitle={aiModalTitle}
        modalIcon={aiModalIcon}
      />
      {showLogWeightModal && (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => closeModal(setShowLogWeightModal)}>
           <LogWeightModal
             show={showLogWeightModal}
             onClose={() => closeModal(setShowLogWeightModal)}
             onSave={handleSaveWeightLog}
           />
        </div>
      )}
      {showMentalWellbeingModal && (
         <MentalWellbeingModal
            show={showMentalWellbeingModal}
            onClose={() => {
                setShowMentalWellbeingModal(false);
                setRelatedWeightLogIdForWellbeing(null);
            }}
            onSave={handleSaveMentalWellbeingLog}
          />
      )}
      {showOnboardingCompletion && (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in">
            <OnboardingCompletionScreen onFinish={handleFinishOnboarding} />
        </div>
      )}
      {showBuddySystemModal && (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={() => setShowBuddySystemModal(false)}>
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-2xl mx-auto max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5 flex-shrink-0">
                    <div className="flex items-center">
                        <UserGroupIcon className="w-7 h-7 text-primary mr-2.5" />
                        <h2 id="buddy-system-modal-title" className="text-2xl font-semibold text-neutral-dark">
                            Peppkompis
                        </h2>
                    </div>
                    <button
                        onClick={() => setShowBuddySystemModal(false)}
                        className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
                        aria-label="Stäng"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="overflow-y-auto custom-scrollbar flex-grow">
                  <BuddySystemView currentUser={currentUser} setToastNotification={setToastNotification} />
                </div>
            </div>
        </div>
      )}

      {showPeppNotificationsModal && (
          <PeppNotificationsModal
            show={showPeppNotificationsModal}
            onClose={() => setShowPeppNotificationsModal(false)}
            feedItems={peppFeed}
            isLoading={isLoadingPeppFeed}
          />
      )}

      {toastNotification && (
          <ToastNotification 
            message={toastNotification.message} 
            type={toastNotification.type} 
            onClose={() => setToastNotification(null)}
          />
      )}
    </>
  );
};
