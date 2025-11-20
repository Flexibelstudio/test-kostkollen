import React, { useState, useEffect, useCallback, useMemo, useRef, JSX } from 'react';
import { db } from './firebase';
import {
  doc, writeBatch, deleteField, collection, getDocFromServer, runTransaction,
  where, updateDoc
} from "@firebase/firestore";

import CoachDashboard from './components/CoachDashboard';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import SplashScreen from './components/SplashScreen';
import { CoursesView, CourseInfo, ALL_COURSES } from './components/CoursesView.tsx';

import {
  NutritionalInfo, LoggedMeal, AppStatus, PastDaySummary, ViewMode,
  CommonMeal, SearchedFoodInfo, UserProfileData, 
  Level, WeeklyCalorieBank, CourseLesson, UserLessonProgress, RecipeSuggestion,
  AIDataForFeedback, FirestoreUserDocument, IngredientRecipeResponse, WeightLogEntry, MentalWellbeingLog,
  AIDataForJourneyAnalysis, BarcodeScannedFoodInfo, AIStructuredFeedbackResponse, 
  CompletedGoal, TimelineEvent, BuddyDetails, OnboardingChecklistState,
  OnboardingChecklistItemStatus,
  UserRole,
  GoalType,
  GoalSettings
} from './types.ts';

import {
  DEFAULT_GOALS, LOCAL_STORAGE_KEYS, MANUAL_LOG_FOOD_ICON_SVG, COMMON_MEAL_LOG_ICON_SVG, DEFAULT_WATER_GOAL_ML,
  DEFAULT_USER_PROFILE, LEVEL_DEFINITIONS, MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD,
  ACHIEVEMENT_DEFINITIONS, VAPID_PUBLIC_KEY, SEARCH_ICON_SVG, RECIPE_ICON_SVG, BARCODE_ICON_SVG, BOOKMARK_ICON_SVG, CALORIE_ADJUSTMENT,
  MAX_INGREDIENT_IMAGES
} from './constants.ts';

import { analyzeFoodImage, getNutritionalInfoForTextSearch, getAIFeedback, getRecipeSuggestion,
  getRecipesFromIngredientsImage, getDetailedJourneyAnalysis, analyzeNutritionLabelImage } from './services/geminiService.ts';
import { getFoodInfoFromBarcode } from './services/openFoodFactsService.ts';

import {
  addMealLog as addMealLogFirestore, setWaterLog, fetchWaterLog, addCommonMeal, deleteCommonMeal as deleteCommonMealFromDB, updateCommonMeal,
  saveProfileAndGoals, saveWeightLog, updateUserDocument, saveCourseProgress,
  addMentalWellbeingLog, listenForFriendRequests,
  getDocSafe, savePushSubscription, addTimelineEvent, fetchCommunityTimeline, fetchBuddyDetailsList, fetchMealLogsForDate
} from './services/firestoreService.ts';

// Context
import { useUserContext } from './context/UserContext';

import LoadingSpinner from './components/LoadingSpinner.tsx';
import { JourneyView } from './components/JourneyView.tsx';
import SaveCommonMealModal from './components/SaveCommonMealModal.tsx';
import InfoModal from './components/InfoModal.tsx';
import UserProfileModal, { Avatar } from './components/UserProfileModal.tsx';
import CameraModal from './components/CameraModal.tsx';
import BarcodeScannerModal from './components/BarcodeScannerModal.tsx';
import BarcodeSearchResultModal from './components/BarcodeSearchResultModal.tsx';
import ToastNotification from './components/ToastNotification.tsx';
import ImageAnalysisResultModal from './components/ImageAnalysisResultModal.tsx';
import ConfettiCelebration from './components/ConfettiCelebration.tsx';
import LevelUpModal from './components/LevelUpModal.tsx';
import GoalMetModal from './components/GoalMetModal.tsx';
import CourseOverview from './components/course/CourseOverview.tsx';
import LessonDetail from './components/course/LessonDetail.tsx';
import { courseLessons, menopauseCourseLessons } from './courseData.ts';
import NewLessonUnlockedModal from './components/course/NewLessonUnlockedModal.tsx';
import RecipeModal from './components/RecipeModal.tsx';
import TextEntryModal from './components/TextEntryModal.tsx';
import IngredientCaptureModal from './components/IngredientCaptureModal.tsx';
import IngredientRecipeResultsModal from './components/IngredientRecipeResultsModal.tsx';
import { AuthForm } from './components/AuthForm.tsx';
import LogWeightModal from './components/LogWeightModal.tsx';
import MentalWellbeingModal, { MentalWellbeingData } from './components/MentalWellbeingModal.tsx';
import OnboardingCompletionScreen from './components/OnboardingCompletionScreen.tsx';
import { CommunityView } from './components/CommunityView.tsx';
import IosInstallPrompt from './components/IosInstallPrompt.tsx';
import OnboardingRewardModal from './components/OnboardingRewardModal.tsx';
import AICoachModal from './components/AICoachModal.tsx';
import UpdateNoticeModal from './components/UpdateNoticeModal.tsx';
import WaterSplashEffect from './components/WaterSplashEffect';
import NutritionLabelResultModal from './components/NutritionLabelResultModal.tsx';

import { calculateRecommendations } from './utils/nutritionalCalculations.ts';
import { calculateGoalTimeline } from './utils/timelineUtils.ts';
import { getWeekInfo, getDateUID } from './utils/dateUtils.ts';
import { initAudio, playAudio } from './services/audioService.ts';
import {
  CameraIcon, UploadIcon,
  InformationCircleIcon, XMarkIcon, AICoachIcon, PlusIcon, SearchIcon, ArrowRightOnRectangleIcon, RecipeIcon,
  SwitchHorizontalIcon, SparklesIcon, PencilIcon, BarcodeIcon,
  ChatBubbleOvalLeftEllipsisIcon, BellIcon, InstallIcon, LifebuoyIcon
} from './components/icons.tsx';
import { Home, Footprints, Users, GraduationCap } from "lucide-react";
import Dashboard from './pages/Dashboard';

/* ===========================
   Start of Daily Summary Helpers
   =========================== */

const TZ = "Europe/Stockholm";
const startOfDaySE = (d: Date) => {
  const z = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  return new Date(z.getFullYear(), z.getMonth(), z.getDate());
};
const dayKeySE = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "long",
  }).format(d).replace(/\//g, "-");

const yesterdayRangeSE = (now = new Date()) => {
  const today = startOfDaySE(now);
  const start = new Date(+today - 86400000);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const end = today;
  return { start, end, yKey: dayKeySE(start) };
};

/* ===========================
   End of Daily Summary Helpers
   =========================== */

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
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

const wasCalorieGoalMetForSummary = ( 
  consumedCalories: number,
  calorieGoalValue: number,
  goalTypeForDay: GoalType | undefined
): boolean => {
  if (calorieGoalValue <= 0) return false; 
  if (consumedCalories <=0) return false; 

  switch (goalTypeForDay) {
    case 'lose_fat':
      return consumedCalories <= calorieGoalValue;
    case 'maintain': {
      const tenPercentOfTarget = calorieGoalValue * 0.10;
      return Math.abs(consumedCalories - calorieGoalValue) <= tenPercentOfTarget;
    }
    case 'gain_muscle': {
      const surplus = CALORIE_ADJUSTMENT.gain_muscle;
      const tdeeFloor = calorieGoalValue > surplus ? calorieGoalValue - surplus : 0;
      return consumedCalories >= tdeeFloor;
    }
    default: {
      const tenPercentDefault = calorieGoalValue * 0.10;
      return Math.abs(consumedCalories - calorieGoalValue) <= tenPercentDefault;
    }
  }
};

const getUserLevelInfo = (streak: number): { currentLevel: Level, nextLevel: Level | null, progressToNextLevelPercentage: number } => {
  let currentLevel: Level = LEVEL_DEFINITIONS[0];
  let nextLevel: Level | null = null;

  for (let i = LEVEL_DEFINITIONS.length - 1; i >= 0; i--) {
    if (streak >= LEVEL_DEFINITIONS[i].requiredStreak) {
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
    const progressInStreak = Math.max(0, streak - streakForCurrentLevel);
    const streakRangeForLevel = streakForNextLevel - streakForCurrentLevel;
    if (streakRangeForLevel > 0) {
      progressToNextLevelPercentage = Math.min(100, (progressInStreak / streakRangeForLevel) * 100);
    } else if (streak >= streakForNextLevel) { 
        progressToNextLevelPercentage = 100;
    }
  } else { 
    progressToNextLevelPercentage = 100;
  }
  return { currentLevel, nextLevel, progressToNextLevelPercentage };
};

const formatChange = (change: number | undefined): string => {
    if (change === undefined || change === null || isNaN(change)) {
        return '-';
    }
    if (Math.abs(change) < 0.05) {
        return `±0,0`;
    }
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1).replace('.', ',')}`;
};

interface ProcessDayEndLogicOptions {
  force?: boolean;
  silent?: boolean;
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
  showDiscussButton?: boolean;
  onDiscuss?: () => void;
}> = ({ show, onClose, feedbackMessage, isLoading, error, modalTitle, modalIcon, isOnboardingContext, showDiscussButton, onDiscuss }) => {
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
                      <span className="text-2xl mr-3"> </span>
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
                                  <p key={lineIdx}>{line.replace(/•/g, '• ')}</p>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
            )
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          {showDiscussButton && onDiscuss && (
            <button
              onClick={onDiscuss}
              className="w-full px-4 py-3 text-base sm:text-lg font-medium text-secondary-darker bg-secondary-100 hover:bg-secondary-200 rounded-md shadow-sm interactive-transition active:scale-95 flex items-center justify-center gap-2 order-1 sm:order-none"
            >
              <AICoachIcon className="w-6 h-6 flex-shrink-0"/>
              <span className="text-center">Diskutera analysen med din coach</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full px-5 py-3 text-lg font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm interactive-transition active:scale-95"
          >
           {isOnboardingContext ? 'Kom igång med min resa!' : 'Stäng'}
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

const MotivationModal: React.FC<{
    show: boolean;
    onClose: () => void;
    daySummary: PastDaySummary;
}> = ({ show, onClose, daySummary }) => {
    if (!show) return null;

    return (
        <div
            className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="motivation-modal-title"
        >
            <div
                className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <span className="text-6xl mb-4 inline-block" role="img" aria-label="Soluppgång">🌅</span>
                <h2 id="motivation-modal-title" className="text-2xl font-bold text-neutral-dark mb-3">
                    Ny Dag, Nya Möjligheter!
                </h2>
                <p className="text-neutral-dark mb-6">
                    Gårdagen gick inte som planerat, men det är helt okej. Idag är en ny chans att fokusera på dina mål. Du klarar det!
                </p>
                <button
                    onClick={onClose}
                    className="w-full px-5 py-3 text-lg font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 interactive-transition"
                >
                    Kör igång!
                </button>
            </div>
        </div>
    );
};


const UseStreakSaverModal: React.FC<{
    show: boolean;
    onClose: () => void;
    onConfirm: () => void;
    daySummary: PastDaySummary;
}> = ({ show, onClose, onConfirm, daySummary }) => {
    if (!show) return null;

    return (
        <div
            className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="streak-saver-modal-title"
        >
            <div
                className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <LifebuoyIcon className="w-16 h-16 text-secondary mx-auto mb-4" />
                <h2 id="streak-saver-modal-title" className="text-2xl font-bold text-neutral-dark mb-3">
                    Rädda din streak?
                </h2>
                <p className="text-neutral-dark mb-2">
                    Du nådde inte ditt mål i går.
                </p>
                <p className="text-neutral-dark mb-6">
                    Vill du använda veckans <strong>Streakräddare</strong> för att reparera din streak?
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onClose}
                        className="w-full px-5 py-3 text-lg font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm active:scale-95 interactive-transition"
                    >
                        Nej, tack
                    </button>
                    <button
                        onClick={onConfirm}
                        className="w-full px-5 py-3 text-lg font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 interactive-transition"
                    >
                        Ja, använd räddare
                    </button>
                </div>
            </div>
        </div>
    );
};


const resizeImageForLog = (file: File, maxSize: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            if (!event.target?.result) {
                return reject(new Error("File could not be read."));
            }
            const img = new Image();
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);
                // Get data URL with specified quality and return only the base64 part
                const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                resolve(dataUrl.split(',')[1]);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};


export const App = () => {
  // Use Context instead of local hooks
  const {
    currentUser, authLoading, persistenceWarning, logout, setCurrentUser, // Auth
    currentDate, setCurrentDate, // Date from context
    goals, setGoals,
    userProfile, setUserProfile,
    dailyLog, setDailyLog,
    waterLoggedMl, setWaterLoggedMl,
    commonMeals, setCommonMeals,
    weightLogs, setWeightLogs,
    pastDaysSummary, setPastDaysSummary,
    streakData, setStreakData,
    weeklyBank, setWeeklyBank,
    streakSaver, setStreakSaver,
    highestStreak, setHighestStreak,
    highestLevelId, setHighestLevelId,
    unlockedAchievements, setUnlockedAchievements,
    achievementInteractions, setAchievementInteractions,
    userCourseProgress, setUserCourseProgress,
    hasCompletedOnboarding, setHasCompletedOnboarding,
    userRole,
    userStatus,
    journeyAnalysisFeedback, setJourneyAnalysisFeedback,
    mentalWellbeingLogs, setMentalWellbeingLogs,
    isDataLoading,
    isInitialDataLoaded,
    // setIsInitialDataLoaded, // Usually not needed directly in UI
    resetUserData,
    // refreshUserData // Usually handled internally by context/hook
  } = useUserContext();

  // Local UI State
  // Note: currentDate is now from context. We only keep viewingDate locally for navigation.
  const [viewingDate, setViewingDate] = useState<Date>(() => new Date()); 
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [currentInterface, setCurrentInterface] = useState<'member' | 'coach'>('member');
  
  // UI & Interaction State
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [splashEffect, setSplashEffect] = useState<{ x: number, y: number, count: number, id: number } | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Derived State
  const waterGoalMl = DEFAULT_WATER_GOAL_ML;

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

  const isEditableLogDate = useMemo(() => isViewingToday || isViewingAppYesterday, [isViewingToday, isViewingAppYesterday]);

  
  // Modal States
  const [showSaveCommonMealModal, setShowSaveCommonMealModal] = useState<boolean>(false);
  const [mealToSaveAsCommon, setMealToSaveAsCommon] = useState<LoggedMeal | null>(null);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState<boolean>(false);
  const [isProfileModalOnboarding, setIsProfileModalOnboarding] = useState(false);
  const [showTextEntryModal, setShowTextEntryModal] = useState<boolean>(false);
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  
  // Camera/Image Analysis State
  const [cameraImageForAnalysis, setCameraImageForAnalysis] = useState<string | null>(null);
  const [imageFileForAnalysis, setImageFileForAnalysis] = useState<File | null>(null);
  const [analysisResultForModal, setAnalysisResultForModal] = useState<NutritionalInfo | null>(null);

  // Tab State
  const [journeyInitialTab, setJourneyInitialTab] = useState<'calendar' | 'profile' | 'achievements'>('calendar');

  // Streak & Level UI
  const [lastNotifiedStreakLevelUp, setLastNotifiedStreakLevelUp] = useState<string | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState<Level | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGoalMetModalData, setShowGoalMetModalData] = useState<{date: string; streak: number} | null>(null);
  const [dayToPotentiallySave, setDayToPotentiallySave] = useState<PastDaySummary | null>(null);
  const [showMotivationModal, setShowMotivationModal] = useState<PastDaySummary | null>(null);


  const [toastNotification, setToastNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Course State
  const [activeCourse, setActiveCourse] = useState<CourseInfo | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [newlyUnlockedLesson, setNewlyUnlockedLesson] = useState<CourseLesson | null>(null);

  // Onboarding UI State
  const [onboardingStep, setOnboardingStep] = useState<'form' | 'feedback'>('form');
  const [showOnboardingCompletion, setShowOnboardingCompletion] = useState<boolean>(false);
  const [showSpotlight, setShowSpotlight] = useState<boolean>(false);
  const [checklistState, setChecklistState] = useState<OnboardingChecklistState | null>(null);
  const waterLoggerRef = useRef<HTMLDivElement>(null);
  const [showOnboardingRewardModal, setShowOnboardingRewardModal] = useState(false);

  // AI Feedback State
  const [showAIFeedbackModal, setShowAIFeedbackModal] = useState<boolean>(false);
  const [aiFeedbackMessage, setAIFeedbackMessage] = useState<AIStructuredFeedbackResponse | string | null>(null);
  const [aiFeedbackLoading, setAIFeedbackLoading] = useState<boolean>(false);
  const [aiFeedbackError, setAiFeedbackError] = useState<string | null>(null);
  const [aiModalTitle, setAiModalTitle] = useState("Din Coach");
  const [aiModalIcon, setAiModalIcon] = useState<JSX.Element>(<AICoachIcon className="w-7 h-7 text-secondary mr-2.5" />);
  const [showAICoachModal, setShowAICoachModal] = useState(false);
  const [coachInitialContext, setCoachInitialContext] = useState<{ type: 'from_analysis'; date?: string } | null>(null);
  
  // Recipe Feature State
  const [showRecipeModal, setShowRecipeModal] = useState<boolean>(false);
  const [currentRecipe, setCurrentRecipe] = useState<RecipeSuggestion | null>(null);
  const [recentRecipeSearches, setRecentRecipeSearches] = useState<string[]>([]);

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
  const [isCapturingForLabel, setIsCapturingForLabel] = useState<boolean>(false);
  const [showNutritionLabelResultModal, setShowNutritionLabelResultModal] = useState(false);
  const [nutritionLabelResult, setNutritionLabelResult] = useState<NutritionalInfo | null>(null);

  const [showSpeedDial, setShowSpeedDial] = useState(false);
  
  // Weight Tracking UI State
  const [showLogWeightModal, setShowLogWeightModal] = useState<boolean>(false);

  // Mental Wellbeing UI State
  const [showMentalWellbeingModal, setShowMentalWellbeingModal] = useState<boolean>(false);
  const [relatedWeightLogIdForWellbeing, setRelatedWeightLogIdForWellbeing] = useState<string | null>(null);
  const [pendingGoalFeedbackData, setPendingGoalFeedbackData] = useState<{ profile: UserProfileData, goals: GoalSettings, isOnboarding: boolean } | null>(null);
  const [pendingAnalysisData, setPendingAnalysisData] = useState<{ updatedLogs: WeightLogEntry[] } | null>(null);
  
  // Timeline Pending Events
  type PendingTimelineEvent = 
    | { type: 'weight', data: { newLog: WeightLogEntry; previousLog: WeightLogEntry | null } }
    | { type: 'goal_set', data: { userProfile: UserProfileData } }
    | { type: 'goal_achieved', data: { newLog: WeightLogEntry; goalDescription: string } };

  const [pendingTimelineEvent, setPendingTimelineEvent] = useState<PendingTimelineEvent | null>(null);
  
  // Community State
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [communityViewKey, setCommunityViewKey] = useState(Date.now());
  const [communityInitialTab, setCommunityInitialTab] = useState<'flode' | 'hantera'>('flode');
  const [communityInitialSubTab, setCommunityInitialSubTab] = useState<'buddies' | 'search' | 'requests'>('buddies');
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null);
  const [lastCommunityViewTimestamp, setLastCommunityViewTimestamp] = useState<number | null>(null);
  const previousViewModeRef = useRef<ViewMode>(viewMode);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [buddyDetails, setBuddyDetails] = useState<BuddyDetails[]>([]);
  const [communityNotificationCount, setCommunityNotificationCount] = useState(0);
  const [isLoadingCommunityData, setIsLoadingCommunityData] = useState(true);

  // PWA Install Prompt State
  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosInstallPrompt, setShowIosInstallPrompt] = useState(false);

  // Update Notification State
  const [showLatestUpdateView, setShowLatestUpdateView] = useState(false);
  const [hasUnseenUpdate, setHasUnseenUpdate] = useState(false);


  // -- Effects for Daily Data Loading & App visibility --

    const loadDataForDate = useCallback(async (userId: string, dateToLoad: Date) => {
        if (!userId) return;
        const dateUID = getDateUID(dateToLoad);
        setAppStatus(AppStatus.LOADING_DATA); 
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
    }, [setDailyLog, setWaterLoggedMl]);


    // This separate effect handles loading daily data whenever the user or the viewing date changes.
    useEffect(() => {
        if (currentUser && isInitialDataLoaded && userStatus === 'approved') {
            loadDataForDate(currentUser.uid, viewingDate);
        }
    }, [currentUser, viewingDate, isInitialDataLoaded, loadDataForDate, userStatus]);

    // Check for onboarding completion to show modal
     useEffect(() => {
        if (isInitialDataLoaded && currentUser && userRole === 'member' && !hasCompletedOnboarding && userStatus === 'approved') {
             // Only show if we haven't already shown it or if we are not currently showing it
             if (!showUserProfileModal) {
                 setShowUserProfileModal(true);
                 setIsProfileModalOnboarding(true);
                 setOnboardingStep('form');
             }
        }
    }, [isInitialDataLoaded, currentUser, hasCompletedOnboarding, userRole, userStatus, showUserProfileModal]);


    // Sync viewing date with context date on visibility change (handled by context)
    useEffect(() => {
        setViewingDate(new Date(currentDate));
    }, [currentDate]);


const handleSubscribeToPush = async (): Promise<boolean> => {
    if (!currentUser || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setToastNotification({ message: 'Pushnotiser stöds inte av din webbläsaare eller så har något gått fel.', type: 'error' });
        setTimeout(() => setToastNotification(null), 4000);
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            setToastNotification({ message: 'Tillåtelse för notiser nekades.', type: 'error' });
            setTimeout(() => setToastNotification(null), 4000);
            return false;
        }

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        const subscriptionObject = JSON.parse(JSON.stringify(subscription));
        console.log('Push Subscription Object (för felsökning):', subscriptionObject);

        await savePushSubscription(currentUser.uid, subscriptionObject);
        setToastNotification({ message: 'Pushnotiser är nu aktiverade!', type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);
        return true;
    } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
        setToastNotification({ message: 'Kunde inte aktivera pushnotiser. Försök igen.', type: 'error' });
        setTimeout(() => setToastNotification(null), 4000);
        return false;
    }
  };
  
  // In-app notification listener
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.message === 'push-received-in-foreground') {
        const { title, body } = event.data.notification;
        const toastMessage = body ? `${title}: ${body}` : title;
        setToastNotification({ message: toastMessage, type: 'success' });
        playAudio('logSuccess', 0.8);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []); 

  const handleFirestoreError = (error: any, operation: string) => {
    console.error(`Firestore error during ${operation}:`, error);
    let message = `Kunde inte ${operation}.`;
    if (error && error.code === 'permission-denied') {
      message = `Behörighet saknas för att ${operation}. Kontrollera dina Firestore-säkerhetsregler.`;
    } else if (error && error.message) {
      message = `Ett fel uppstod vid ${operation}. Försök igen.`;
    }
    setToastNotification({ message, type: 'error' });
    setTimeout(() => setToastNotification(null), 5000);
  };

  // Friend Requests listener
  useEffect(() => {
    if (currentUser && userStatus === 'approved') {
        const unsubscribeRequests = listenForFriendRequests(currentUser.uid, (requests) => {
            setPendingRequestsCount(requests.length);
        });

        return () => {
            unsubscribeRequests();
        };
    } else {
        setPendingRequestsCount(0);
    }
  }, [currentUser, userStatus]);

    // Data Healing Effect (Water Goal)
    useEffect(() => {
        if (!currentUser || !isInitialDataLoaded || Object.keys(pastDaysSummary).length === 0) {
            return;
        }

        const healLast30DaysData = async () => {
            const batch = writeBatch(db);
            const localUpdatedSummaries = { ...pastDaysSummary }; // Clone for local update
            let updatesMade = false;

            const thirtyDaysAgo = new Date(currentDate);
            thirtyDaysAgo.setDate(currentDate.getDate() - 30);

            const summariesToHeal = Object.values(pastDaysSummary).filter(summary => {
                const summaryDate = new Date(summary.date);
                return summaryDate >= thirtyDaysAgo && summary.waterGoalMet === undefined;
            });

            if (summariesToHeal.length === 0) {
                return;
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
                setPastDaysSummary(localUpdatedSummaries);
                await batch.commit();
                console.log("Healing complete.");
            }
        };

        healLast30DaysData().catch(err => {
            console.error("Data healing process failed:", err);
        });

    }, [isInitialDataLoaded, currentUser?.uid, pastDaysSummary, currentDate, setPastDaysSummary]);


    const loadCommunityData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoadingCommunityData(true);
        try {
            const [events, details] = await Promise.all([
                fetchCommunityTimeline(currentUser.uid),
                fetchBuddyDetailsList(currentUser.uid),
            ]);
    
            const buddyUids = new Set(details.map(buddy => buddy.uid));
            const filteredEvents = events.filter(event => 
                event.userId === currentUser.uid || buddyUids.has(event.userId)
            );
    
            setTimelineEvents(filteredEvents);
            setBuddyDetails(details);

            const lastViewed = getLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_COMMUNITY_VIEW_TIMESTAMP, null);
            if (lastViewed && viewMode !== 'community') {
                const updatedEventIds = new Set<string>();
                filteredEvents.forEach(event => {
                    let hasNewActivity = false;
                    if (event.userId !== currentUser.uid && event.timestamp > lastViewed) {
                        hasNewActivity = true;
                    }
                    (event.comments || []).forEach(comment => {
                        if (comment.authorUid !== currentUser.uid && comment.timestamp > lastViewed) {
                            hasNewActivity = true;
                        }
                    });

                    if (hasNewActivity) {
                        updatedEventIds.add(event.id);
                    }
                });
                setCommunityNotificationCount(updatedEventIds.size);
            }
        } catch (error) {
            console.error("Error loading community data in App:", error);
            setToastNotification({ message: 'Kunde inte ladda community-data.', type: 'error' });
        } finally {
            setIsLoadingCommunityData(false);
        }
    }, [currentUser, viewMode, setToastNotification]);

    useEffect(() => {
        if (currentUser && isInitialDataLoaded && userStatus === 'approved') {
            loadCommunityData();
        }
    }, [currentUser, isInitialDataLoaded, userStatus, loadCommunityData]);

    // Effect for managing Community View timestamp and notifications
    useEffect(() => {
        const previousViewMode = previousViewModeRef.current;
        
        // User is ENTERING community view
        if (viewMode === 'community' && previousViewMode !== 'community') {
            const lastTimestamp = getLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_COMMUNITY_VIEW_TIMESTAMP, null);
            setLastCommunityViewTimestamp(lastTimestamp);
            
            // Clear the notification badge immediately
            setCommunityNotificationCount(0); 
            
            // Set the *new* "last visited" timestamp for future calculations
            setLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_COMMUNITY_VIEW_TIMESTAMP, Date.now());
        }
        
        previousViewModeRef.current = viewMode;
    }, [viewMode]);

    // Effect to reset special community tabs when navigating away
    useEffect(() => {
        if (viewMode !== 'community') {
            setCommunityInitialTab('flode');
            setCommunityInitialSubTab('buddies');
        }
    }, [viewMode]);

  // Update Notice Logic
  useEffect(() => {
    if (isInitialDataLoaded && currentUser) {
        const UPDATE_NOTICE_KEY = 'updateNotice_v5_StreakUpdate'; 
        try {
            const noticeShown = localStorage.getItem(UPDATE_NOTICE_KEY);
            if (!noticeShown) {
                setHasUnseenUpdate(true);
            }
        } catch (error) {
            console.warn('Could not access localStorage for update notice.', error);
        }
    }
  }, [isInitialDataLoaded, currentUser]);

  const handleViewLatestUpdate = () => {
    setShowLatestUpdateView(true);
    setShowProfileDropdown(false);
    playAudio('uiClick');

    if (hasUnseenUpdate) {
        const UPDATE_NOTICE_KEY = 'updateNotice_v5_StreakUpdate';
        try {
            localStorage.setItem(UPDATE_NOTICE_KEY, 'true');
        } catch (error) {
            console.warn('Could not save to localStorage for update notice.', error);
        }
        setHasUnseenUpdate(false);
    }
  };

  const handleNavigateToCourses = () => {
    setViewMode('coursesView');
    if (showLatestUpdateView) {
        setShowLatestUpdateView(false);
    }
  };

  const handleLogout = async () => {
    playAudio('uiClick');
    setShowProfileDropdown(false);
    try {
      await logout();
      resetUserData();
      // Auth state change will handle redirect/UI update via hook
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


    useEffect(() => {
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


  const addMealToLog = async (nutritionalInfo: NutritionalInfo, options: { base64Image?: string; commonMealId?: string } = {}) => {
    if (!isEditableLogDate || !currentUser) {
        const message = isViewingToday ? "Du kan endast logga måltider för idag och igår." : "Du kan endast logga måltider för idag och igår.";
        setToastNotification({ message, type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }

    const mealLogCollectionRef = collection(db, 'users', currentUser.uid, 'mealLogs');
    const mealLogDocRef = doc(mealLogCollectionRef);
    const mealId = mealLogDocRef.id;

    let finalImageUrl: string | undefined = undefined;
    const originalDailyLog = [...dailyLog];
    const originalBankState = { ...weeklyBank };

    try {
        if (options.base64Image) {
            finalImageUrl = options.base64Image;
        }

        if (!finalImageUrl) {
            if (options.commonMealId === 'manual') {
                finalImageUrl = MANUAL_LOG_FOOD_ICON_SVG;
            } else if (options.commonMealId === 'text_search') {
                finalImageUrl = SEARCH_ICON_SVG;
            } else if (options.commonMealId === 'recipe' || options.commonMealId === 'ingredient_recipe') {
                finalImageUrl = RECIPE_ICON_SVG;
            } else if (options.commonMealId === 'barcode') {
                finalImageUrl = BARCODE_ICON_SVG;
            } else if (options.commonMealId) {
                finalImageUrl = BOOKMARK_ICON_SVG;
            } else {
                finalImageUrl = COMMON_MEAL_LOG_ICON_SVG; 
            }
        }
        
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

        if (options.commonMealId) {
            newMealData.commonMealId = options.commonMealId;
        }

        if (finalImageUrl) {
            newMealData.imageUrl = finalImageUrl;
        }

        let newBankState = originalBankState;
        if (totalNutrients.calories + newMealData.nutritionalInfo.calories > goals.calorieGoal && originalBankState.bankedCalories > 0) {
            const overshoot = (totalNutrients.calories + newMealData.nutritionalInfo.calories) - goals.calorieGoal;
            const canUseFromBank = Math.min(overshoot, originalBankState.bankedCalories);
            if (canUseFromBank > 0) {
                newMealData.caloriesCoveredByBank = canUseFromBank;
                newBankState = { ...originalBankState, bankedCalories: Math.max(0, originalBankState.bankedCalories - canUseFromBank) };
            }
        }

        const optimisticMeal: LoggedMeal = { ...newMealData, id: mealId };
        setDailyLog(prevLog => [optimisticMeal, ...prevLog]);
        if (newBankState.bankedCalories !== originalBankState.bankedCalories) {
            setWeeklyBank(newBankState);
        }
        
        playAudio('logSuccess', 0.8);
        
        if (checklistState && !checklistState.items.mealLogged) {
            updateChecklistItem('mealLogged');
        }
        
        setToastNotification({ message: `"${optimisticMeal.nutritionalInfo.foodItem}" loggades!`, type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);

        // Save to Firestore
        await addMealLogFirestore(currentUser.uid, mealId, newMealData);

        // Save bank update to Firestore if it changed
        if (newBankState.bankedCalories !== originalBankState.bankedCalories) {
            await updateUserDocument(currentUser.uid, { weeklyBank: newBankState, role: userRole, status: userStatus });
        }
        
        if (isViewingAppYesterday) {
            const processResult = await ensureYesterdayProcessed(currentUser.uid, currentDate, { force: true, silent: true });
            
            if (processResult) {
                if (processResult.summary) {
                    setPastDaysSummary(prev => ({
                        ...prev,
                        [processResult.summary!.date]: processResult.summary!,
                    }));
                }
                setStreakData(processResult.streakData);
                setWeeklyBank(processResult.weeklyBank);
                setHighestStreak(processResult.highestStreak);
            }
        }

    } catch (error) {
        handleFirestoreError(error, 'spara måltid');
        setDailyLog(originalDailyLog);
        setWeeklyBank(originalBankState);
    } finally {
        setCameraImageForAnalysis(null);
        setImageFileForAnalysis(null);
    }
  };


  const handleImageCapture = async (base64ImageData: string, fromFileUpload: boolean = false) => {
    setShowCameraModal(false); 
    if (!fromFileUpload) {
        setImageFileForAnalysis(null);
    }
    if (isCapturingForIngredients) {
        setIngredientImagesForCapture(prev => [...prev, `data:image/jpeg;base64,${base64ImageData}`]);
        openModal(setShowIngredientCaptureModal);
    } else if (isCapturingForLabel) {
        setAppStatus(AppStatus.ANALYZING);
        try {
            const analysis = await analyzeNutritionLabelImage(base64ImageData);
            setNutritionLabelResult(analysis);
            setShowNutritionLabelResultModal(true);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Okänt analysfel";
            setErrorMessage(errorMsg);
            setToastNotification({ message: `Analysfel: ${errorMsg}`, type: 'error'});
            setTimeout(() => setToastNotification(null), 3500);
            setAppStatus(AppStatus.ERROR);
        } finally {
            setAppStatus(AppStatus.IDLE);
            setIsCapturingForLabel(false);
        }
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
  
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAppStatus(AppStatus.ANALYZING);
      try {
        const resizedBase64 = await resizeImageForLog(file, 800);
        setImageFileForAnalysis(file);
        handleImageCapture(resizedBase64, true);
      } catch (error) {
          console.error("Image resize failed:", error);
          setToastNotification({ message: 'Kunde inte bearbeta bilden.', type: 'error' });
          setTimeout(() => setToastNotification(null), 3500);
          setAppStatus(AppStatus.IDLE);
      }
    }
    if (event.target) event.target.value = '';
  };

  const handleLogFromModal = (foodInfo: NutritionalInfo | SearchedFoodInfo, options: { saveAsCommon: boolean }) => {
    const isSearchedFood = 'servingDescription' in foodInfo;
    const baseNutritionalInfo: NutritionalInfo = {
        foodItem: foodInfo.foodItem,
        calories: foodInfo.calories,
        protein: foodInfo.protein,
        carbohydrates: foodInfo.carbohydrates,
        fat: foodInfo.fat
    };
    
    const fullFoodItemName = isSearchedFood ? `${foodInfo.foodItem} (${(foodInfo as SearchedFoodInfo).servingDescription})` : foodInfo.foodItem;
    const base64ForUpload = cameraImageForAnalysis ? `data:image/jpeg;base64,${cameraImageForAnalysis}` : undefined;

    addMealToLog(
        { ...baseNutritionalInfo, foodItem: fullFoodItemName }, 
        { 
            base64Image: base64ForUpload,
            commonMealId: isSearchedFood ? 'text_search' : undefined
        }
    );

    if (options.saveAsCommon) {
      saveCommonMeal(
        { ...baseNutritionalInfo, foodItem: fullFoodItemName || 'Okänt val' },
        fullFoodItemName || 'Okänt val'
      );
    }
    setAnalysisResultForModal(null);
    setCameraImageForAnalysis(null);
    setImageFileForAnalysis(null);
  };
  
  const handleLogWater = async (amountMl: number, event?: React.MouseEvent<HTMLButtonElement>) => {
    if (!isEditableLogDate || !currentUser) {
        setToastNotification({ message: "Du kan endast logga vatten för idag och igår.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }

    if (event) {
        const rect = event.currentTarget.getBoundingClientRect();
        setSplashEffect({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            count: amountMl === 250 ? 15 : 25,
            id: Date.now(),
        });
    }
    
    playAudio('waterSplash');
    
    const newTotalWater = waterLoggedMl + amountMl;
    setWaterLoggedMl(newTotalWater);

    const dateUID = getDateUID(viewingDate);
    try {
      await setWaterLog(currentUser.uid, dateUID, newTotalWater);
    } catch (error) {
      handleFirestoreError(error, 'logga vatten');
      setWaterLoggedMl(current => current - amountMl);
    }
  };

  const handleResetWater = async () => {
    if (!isEditableLogDate || !currentUser) return;
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
    if (!isEditableLogDate || !currentUser) {
        setToastNotification({ message: "Du kan endast radera måltider för idag eller igår.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    playAudio('uiClick');

    const originalDailyLog = [...dailyLog];
    const originalWeeklyBank = { ...weeklyBank };

    const updatedLogUnsorted = dailyLog.filter(meal => meal.id !== mealId);

    const originalBankRefund = dailyLog.reduce((sum, meal) => sum + (meal.caloriesCoveredByBank || 0), 0);
    const bankBeforeToday = weeklyBank.bankedCalories + originalBankRefund;

    let cumulativeCalories = 0;
    let bankUsedThisDay = 0;
    
    const sortedMeals = [...updatedLogUnsorted].sort((a, b) => a.timestamp - b.timestamp);
    const newMealsWithBankRecalculated: LoggedMeal[] = [];
    
    for (const meal of sortedMeals) {
        const newMeal = { ...meal, nutritionalInfo: { ...meal.nutritionalInfo }, caloriesCoveredByBank: 0 };
        const mealCalories = newMeal.nutritionalInfo.calories;
        const previousTotal = cumulativeCalories;
        cumulativeCalories += mealCalories;

        if (cumulativeCalories > goals.calorieGoal) {
            const overshootFromThisMeal = Math.max(0, cumulativeCalories - Math.max(goals.calorieGoal, previousTotal));
            if (overshootFromThisMeal > 0) {
                const availableBank = bankBeforeToday - bankUsedThisDay;
                const canUseFromBank = Math.min(overshootFromThisMeal, availableBank);
                if (canUseFromBank > 0) {
                    newMeal.caloriesCoveredByBank = canUseFromBank;
                    bankUsedThisDay += canUseFromBank;
                }
            }
        }
        newMealsWithBankRecalculated.push(newMeal);
    }
    
    const newBankAmount = bankBeforeToday - bankUsedThisDay;

    setDailyLog(newMealsWithBankRecalculated.sort((a, b) => b.timestamp - a.timestamp));
    setWeeklyBank(prev => ({ ...prev, bankedCalories: newBankAmount }));

    try {
        const batch = writeBatch(db);
        const mealToDeleteRef = doc(db, "users", currentUser.uid, "mealLogs", mealId);
        batch.delete(mealToDeleteRef);
        
        const originalMealsMap = new Map(originalDailyLog.map(m => [m.id, m]));
        newMealsWithBankRecalculated.forEach(newMeal => {
            const originalMeal = originalMealsMap.get(newMeal.id);
            if (!originalMeal || originalMeal.caloriesCoveredByBank !== newMeal.caloriesCoveredByBank) {
                const mealRef = doc(db, "users", currentUser.uid, "mealLogs", newMeal.id);
                batch.update(mealRef, { caloriesCoveredByBank: newMeal.caloriesCoveredByBank || 0 });
            }
        });

        const userDocRef = doc(db, "users", currentUser.uid);
        batch.update(userDocRef, { "weeklyBank.bankedCalories": newBankAmount, role: userRole, status: userStatus });
        
        await batch.commit();

        setToastNotification({ message: "Måltid borttagen.", type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);
        
        if (isViewingAppYesterday) {
            const processResult = await ensureYesterdayProcessed(currentUser.uid, currentDate, { force: true, silent: true });
            if (processResult) {
                if (processResult.summary) {
                    setPastDaysSummary(prev => ({ ...prev, [processResult.summary!.date]: processResult.summary! }));
                }
                setStreakData(processResult.streakData);
                setWeeklyBank(processResult.weeklyBank);
                setHighestStreak(processResult.highestStreak);
            }
        }
    } catch (error) {
        handleFirestoreError(error, 'ta bort måltid');
        setDailyLog(originalDailyLog);
        setWeeklyBank(originalWeeklyBank);
    }
};

const handleUpdateMeal = async (mealId: string, updatedInfo: NutritionalInfo) => {
    if (!isEditableLogDate || !currentUser) {
        setToastNotification({ message: "Du kan endast uppdatera måltider för idag eller igår.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    playAudio('uiClick');

    const originalDailyLog = [...dailyLog];
    const originalWeeklyBank = { ...weeklyBank };

    const updatedLogUnsorted = dailyLog.map(meal => 
        meal.id === mealId ? { ...meal, nutritionalInfo: updatedInfo } : meal
    );
    
    const originalBankRefund = dailyLog.reduce((sum, meal) => sum + (meal.caloriesCoveredByBank || 0), 0);
    const bankBeforeToday = weeklyBank.bankedCalories + originalBankRefund;

    let cumulativeCalories = 0;
    let bankUsedThisDay = 0;
    
    const sortedMeals = [...updatedLogUnsorted].sort((a, b) => a.timestamp - b.timestamp);
    const newMealsWithBankRecalculated: LoggedMeal[] = [];
    
    for (const meal of sortedMeals) {
        const newMeal = { ...meal, nutritionalInfo: { ...meal.nutritionalInfo }, caloriesCoveredByBank: 0 };
        const mealCalories = newMeal.nutritionalInfo.calories;
        const previousTotal = cumulativeCalories;
        cumulativeCalories += mealCalories;

        if (cumulativeCalories > goals.calorieGoal) {
            const overshootFromThisMeal = Math.max(0, cumulativeCalories - Math.max(goals.calorieGoal, previousTotal));
            if (overshootFromThisMeal > 0) {
                const availableBank = bankBeforeToday - bankUsedThisDay;
                const canUseFromBank = Math.min(overshootFromThisMeal, availableBank);
                if (canUseFromBank > 0) {
                    newMeal.caloriesCoveredByBank = canUseFromBank;
                    bankUsedThisDay += canUseFromBank;
                }
            }
        }
        newMealsWithBankRecalculated.push(newMeal);
    }
    
    const newBankAmount = bankBeforeToday - bankUsedThisDay;

    setDailyLog(newMealsWithBankRecalculated.sort((a, b) => b.timestamp - a.timestamp));
    setWeeklyBank(prev => ({ ...prev, bankedCalories: newBankAmount }));

    try {
        const batch = writeBatch(db);
        
        const originalMealsMap = new Map(originalDailyLog.map(m => [m.id, m]));
        newMealsWithBankRecalculated.forEach(newMeal => {
            const originalMeal = originalMealsMap.get(newMeal.id);
            if (!originalMeal || JSON.stringify(originalMeal.nutritionalInfo) !== JSON.stringify(newMeal.nutritionalInfo) || originalMeal.caloriesCoveredByBank !== newMeal.caloriesCoveredByBank) {
                const mealRef = doc(db, "users", currentUser.uid, "mealLogs", newMeal.id);
                batch.update(mealRef, {
                    nutritionalInfo: newMeal.nutritionalInfo,
                    caloriesCoveredByBank: newMeal.caloriesCoveredByBank || 0
                });
            }
        });

        const userDocRef = doc(db, "users", currentUser.uid);
        batch.update(userDocRef, { "weeklyBank.bankedCalories": newBankAmount, role: userRole, status: userStatus });
        
        await batch.commit();
        setToastNotification({ message: "Måltid uppdaterad.", type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);

        if (isViewingAppYesterday) {
            const processResult = await ensureYesterdayProcessed(currentUser.uid, currentDate, { force: true, silent: true });
            if (processResult) {
                if (processResult.summary) {
                    setPastDaysSummary(prev => ({ ...prev, [processResult.summary!.date]: processResult.summary! }));
                }
                setStreakData(processResult.streakData);
                setWeeklyBank(processResult.weeklyBank);
                setHighestStreak(processResult.highestStreak);
            }
        }
    } catch (error) {
        handleFirestoreError(error, 'uppdatera måltid');
        setDailyLog(originalDailyLog);
        setWeeklyBank(originalWeeklyBank);
    }
  };

  const saveCommonMeal = async (mealInfoToSave: NutritionalInfo, name: string) => {
    if (!currentUser) return;

    const cleanNutritionalInfo: NutritionalInfo = {
        calories: Math.round(Number(mealInfoToSave.calories) || 0),
        protein: Math.round(Number(mealInfoToSave.protein) || 0),
        carbohydrates: Math.round(Number(mealInfoToSave.carbohydrates) || 0),
        fat: Math.round(Number(mealInfoToSave.fat) || 0),
        foodItem: mealInfoToSave.foodItem || name,
    };

    const timestamp = Date.now();
    const newCommonMealData: Omit<CommonMeal, 'id'> = { 
      name: name,
      nutritionalInfo: cleanNutritionalInfo,
      timestamp,
    };
    try {
        const newDocId = await addCommonMeal(currentUser.uid, newCommonMealData);
        setCommonMeals(prev => [{ ...newCommonMealData, id: newDocId }, ...prev]);
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
     if (!isEditableLogDate) {
        setToastNotification({ message: "Du kan endast logga måltider för idag eller igår.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    addMealToLog(commonMeal.nutritionalInfo, { commonMealId: commonMeal.id });
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

  const handleSaveProfileAndGoals = async (profileData: UserProfileData, newGoals: GoalSettings, newPhotoDataUrl?: string | null) => {
    if (!currentUser) return;
    setAppStatus(AppStatus.SAVING);

    const previousProfile = { ...userProfile };
    
    const wasNewMeasurementLogged = profileData.currentWeightKg != null && (
        profileData.currentWeightKg !== previousProfile.currentWeightKg ||
        profileData.skeletalMuscleMassKg !== previousProfile.skeletalMuscleMassKg ||
        profileData.bodyFatMassKg !== previousProfile.bodyFatMassKg
    );

    const goalParamsChanged = (
        previousProfile.desiredFatMassChangeKg !== profileData.desiredFatMassChangeKg ||
        previousProfile.desiredMuscleMassChangeKg !== profileData.desiredMuscleMassChangeKg ||
        previousProfile.desiredWeightChangeKg !== profileData.desiredWeightChangeKg ||
        previousProfile.goalCompletionDate !== profileData.goalCompletionDate
    );

    let profileToSave = { ...profileData };
    if (newPhotoDataUrl) {
        profileToSave.photoURL = newPhotoDataUrl;
    }
    profileToSave.completedGoals = previousProfile.completedGoals || [];

    if (goalParamsChanged) {
        const latestWeightLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
        const latestWeight = latestWeightLog?.weightKg ?? userProfile.currentWeightKg;
        const latestMuscle = latestWeightLog?.skeletalMuscleMassKg ?? userProfile.skeletalMuscleMassKg;
        const latestFat = latestWeightLog?.bodyFatMassKg ?? userProfile.bodyFatMassKg;

        profileToSave.goalStartWeight = latestWeight;
        profileToSave.goalStartMuscleMassKg = latestMuscle;
        profileToSave.goalStartFatMassKg = latestFat;
        profileToSave.mainGoalCompleted = false;
        profileToSave.currentWeightKg = latestWeight;
        profileToSave.skeletalMuscleMassKg = latestMuscle;
        profileToSave.bodyFatMassKg = latestFat;
    } else {
        profileToSave.goalStartWeight = previousProfile.goalStartWeight;
        profileToSave.goalStartMuscleMassKg = previousProfile.goalStartMuscleMassKg;
        profileToSave.goalStartFatMassKg = previousProfile.goalStartFatMassKg;
        profileToSave.mainGoalCompleted = previousProfile.mainGoalCompleted;
    }
    
    const sanitizedProfileForFirestore = {
        ...profileToSave,
        photoURL: profileToSave.photoURL ?? null,
    };

    const isJourneySave = viewMode === 'journey';
    const isFeedbackFlow = isProfileModalOnboarding || (isJourneySave && goalParamsChanged);

    try {
        await saveProfileAndGoals(currentUser.uid, sanitizedProfileForFirestore, newGoals);
        if (wasNewMeasurementLogged && profileData.currentWeightKg) {
             const weightLogData: Omit<WeightLogEntry, 'id'> = {
                loggedAt: Date.now(),
                weightKg: profileData.currentWeightKg,
                skeletalMuscleMassKg: profileData.skeletalMuscleMassKg,
                bodyFatMassKg: profileData.bodyFatMassKg,
                comment: 'Mätning vid målsättning'
            };
            const newDocId = await saveWeightLog(currentUser.uid, weightLogData);
            setWeightLogs(prevLogs => [...prevLogs, { id: newDocId, ...weightLogData }].sort((a,b) => a.loggedAt - b.loggedAt));
        }
        
        setUserProfile(sanitizedProfileForFirestore);
        setGoals(newGoals);

        if (isFeedbackFlow) {
            if (goalParamsChanged) {
                setPendingTimelineEvent({ type: 'goal_set', data: { userProfile: sanitizedProfileForFirestore } });
            }
            setPendingGoalFeedbackData({ profile: sanitizedProfileForFirestore, goals: newGoals, isOnboarding: isProfileModalOnboarding });
            setShowUserProfileModal(false);
            setShowMentalWellbeingModal(true);
        } else {
            setShowUserProfileModal(false);
            playAudio('logSuccess');
            setToastNotification({ message: "Profil har uppdaterats!", type: 'success' });
            setTimeout(() => setToastNotification(null), 2500);
        }

    } catch (error: any) {
       handleFirestoreError(error, 'spara profil och mål');
    } finally {
        setAppStatus(AppStatus.IDLE);
    }
  };

const handleCloseUserProfileModal = () => {
    if (isProfileModalOnboarding && onboardingStep === 'feedback') {
        setShowUserProfileModal(false);
        setAIFeedbackMessage(null);
        setAiFeedbackError(null);
        setShowOnboardingCompletion(true);
    } else {
        setShowUserProfileModal(false);
        setAIFeedbackMessage(null);
        setAiFeedbackError(null);
    }
    setOnboardingStep('form');
};

const handleFinishOnboarding = async () => {
    if (!currentUser) return;
    setShowOnboardingCompletion(false);
    setShowAIFeedbackModal(false);
    setHasCompletedOnboarding(true);
    setShowSpotlight(true);
    
    const newState: OnboardingChecklistState = {
        firstSeenDate: new Date().toISOString().split('T')[0],
        items: { mealLogged: false, waterLogged: false, journeyViewed: false, communityViewed: false },
        dismissed: false,
    };
    setChecklistState(newState);
    setLocalStorageItem(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, newState);

    try {
        await updateUserDocument(currentUser.uid, { 
          hasCompletedOnboarding: true,
          summaryStartDate: dayKeySE(new Date()),
          role: userRole, 
          status: userStatus 
        });
        playAudio('levelUp');
    } catch (error) {
        handleFirestoreError(error, 'slutföra onboarding');
    }
  };


// New, robust day-end summary logic (fixed)
const ensureYesterdayProcessed = useCallback(async (uid: string, now = new Date(), options: ProcessDayEndLogicOptions = {}): Promise<{ summary: PastDaySummary | null; streakData: { currentStreak: number; lastDateStreakChecked: string | null }; weeklyBank: WeeklyCalorieBank; highestStreak: number; } | void> => {
  setAppStatus(AppStatus.PROCESSING_DAY_END);
  try {
    const { start, end, yKey } = yesterdayRangeSE(now);

    const userRef = doc(db, "users", uid);
    const userSnap = await getDocFromServer(userRef).catch(() => null);
    if (!userSnap?.exists()) return;

    const userData = userSnap.data() as FirestoreUserDocument;
    const { lastDateStreakChecked, summaryStartDate, hasCompletedOnboarding } = userData;
    
    if (!hasCompletedOnboarding) return;
    if (summaryStartDate && yKey < summaryStartDate) {
      await updateUserDocument(uid, { lastDateStreakChecked: yKey, role: userRole, status: userStatus });
      return;
    }
    if (lastDateStreakChecked && lastDateStreakChecked >= yKey && !options.force) return;

    const [dailyLogForDate] = await Promise.all([fetchMealLogsForDate(uid, yKey)]);
    
    if (dailyLogForDate.length === 0) {
      let updatedDataForReturn: any;
      await runTransaction(db, async (tx) => {
        const userSnapTx = await tx.get(userRef);
        if (!userSnapTx.exists()) return;
        const userDataTx = userSnapTx.data() as FirestoreUserDocument;
        tx.update(userRef, { currentStreak: 0, lastDateStreakChecked: yKey });
        
        updatedDataForReturn = {
          summary: null,
          streakData: { currentStreak: 0, lastDateStreakChecked: yKey },
          weeklyBank: userDataTx.weeklyBank,
          highestStreak: userDataTx.highestStreak,
        };
      });

      if (updatedDataForReturn) {
          if (!options.silent) {
              setStreakData(updatedDataForReturn.streakData);
              setPastDaysSummary(prev => {
                  const newSummaries = { ...prev };
                  delete newSummaries[yKey];
                  return newSummaries;
              });
          }
          return updatedDataForReturn;
      }
      return;
    }
    
    const localGoals = userData.goals || DEFAULT_GOALS;
    const localProfile = { ...DEFAULT_USER_PROFILE, ...userData } as UserProfileData;
    const waterLogForDate = await fetchWaterLog(uid, yKey);

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

    const totalCoveredByBankForDay = dailyLogForDate.reduce(
      (sum, meal) => sum + (meal.caloriesCoveredByBank || 0),
      0
    );
    
    const effectiveCaloriesConsumed = totalNutrientsForDay.calories - totalCoveredByBankForDay;
    const minSafeCaloriesForDay = Math.max(localGoals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD);
    
    const wasCalorieGoalMet = wasCalorieGoalMetForSummary(effectiveCaloriesConsumed, localGoals.calorieGoal, localProfile.goalType);
    const goalMetForCalendar = totalNutrientsForDay.calories >= minSafeCaloriesForDay && wasCalorieGoalMet;
    const habitMetForStreak = dailyLogForDate.length > 0;

    let bankedAmountThisDay = 0;
    if (goalMetForCalendar && totalNutrientsForDay.calories < localGoals.calorieGoal) {
      bankedAmountThisDay = localGoals.calorieGoal - totalNutrientsForDay.calories;
    }
    
    let resultData: any = null;
    await runTransaction(db, async (tx) => {
      const userSnapTx = await tx.get(userRef);
      if (!userSnapTx.exists()) return;

      const userDataTx = userSnapTx.data() as FirestoreUserDocument;
      
      const dayBeforeYDate = new Date(start);
      dayBeforeYDate.setDate(dayBeforeYDate.getDate() - 1);
      const dayBeforeYKey = dayKeySE(dayBeforeYDate);
      const prevSummaryRef = doc(db, "users", uid, "pastDaySummaries", dayBeforeYKey);
      const prevSummarySnap = await tx.get(prevSummaryRef);
      const prevStreak = prevSummarySnap.exists() ? (prevSummarySnap.data() as PastDaySummary).streakForThisDay ?? 0 : 0;
      
      const prevHighest = userDataTx.highestStreak ?? 0;
      const nextStreak = habitMetForStreak ? prevStreak + 1 : 0;
      const newHighestStreak = Math.max(prevHighest, nextStreak);

      const summaryForThisDay: PastDaySummary = {
        date: yKey,
        goalMet: goalMetForCalendar,
        consumedCalories: totalNutrientsForDay.calories,
        calorieGoal: localGoals.calorieGoal,
        proteinGoalMet: totalNutrientsForDay.protein >= localGoals.proteinGoal,
        consumedProtein: totalNutrientsForDay.protein,
        proteinGoal: localGoals.proteinGoal,
        consumedCarbohydrates: totalNutrientsForDay.carbohydrates,
        carbohydrateGoal: localGoals.carbohydrateGoal,
        consumedFat: totalNutrientsForDay.fat,
        fatGoal: localGoals.fatGoal,
        goalType: localProfile.goalType,
        waterGoalMet: waterLogForDate >= DEFAULT_WATER_GOAL_ML,
        streakForThisDay: nextStreak,
      };
      
      const isProcessingOnMonday = now.getDay() === 1;
      const weekInfoYesterday = getWeekInfo(new Date(`${yKey}T12:00:00`));
      let finalBank = userDataTx.weeklyBank || { weekId: weekInfoYesterday.weekId, bankedCalories: 0, startDate: weekInfoYesterday.startDate, endDate: weekInfoYesterday.endDate };
      
      if (isProcessingOnMonday) {
          const weekInfoToday = getWeekInfo(now);
          finalBank = {
              weekId: weekInfoToday.weekId,
              bankedCalories: 0,
              startDate: weekInfoToday.startDate,
              endDate: weekInfoToday.endDate
          };
      } else {
          if (finalBank.weekId !== weekInfoYesterday.weekId) {
              finalBank = { weekId: weekInfoYesterday.weekId, startDate: weekInfoYesterday.startDate, endDate: weekInfoYesterday.endDate, bankedCalories: bankedAmountThisDay };
          } else {
              finalBank = { ...finalBank, bankedCalories: (finalBank.bankedCalories || 0) + bankedAmountThisDay };
          }
      }
      
      const sumRef = doc(db, "users", uid, "pastDaySummaries", yKey);
      tx.set(sumRef, summaryForThisDay, { merge: true });

      tx.update(userRef, {
        currentStreak: nextStreak,
        lastDateStreakChecked: yKey,
        highestStreak: newHighestStreak,
        weeklyBank: finalBank,
      });

      resultData = {
          summary: summaryForThisDay,
          streakData: { currentStreak: nextStreak, lastDateStreakChecked: yKey },
          weeklyBank: finalBank,
          highestStreak: newHighestStreak
      };
    });

    if (resultData) {
        if (!options.silent) {
            setStreakData(resultData.streakData);
            setWeeklyBank(resultData.weeklyBank);
            setHighestStreak(resultData.highestStreak);
            setPastDaysSummary(prev => ({...prev, [yKey]: resultData.summary}));
            
            if (resultData.summary.goalMet) {
                const newStreakValue = resultData.streakData.currentStreak;
                if (newStreakValue > 0 && currentUser) {
                    try {
                        const streakEventData = {
                            type: 'streak' as const,
                            timestamp: Date.now(),
                            title: `har fått +1 på sin Streak!`,
                            description: `Ny streak: ${newStreakValue} dagar i följd.`,
                            icon: '🔥',
                            relatedDocId: `streak_${yKey}`
                        };
                        await addTimelineEvent(currentUser.uid, streakEventData);
                    } catch (error) { console.error("Failed to create streak timeline event:", error); }
                }
                setShowGoalMetModalData({ date: yKey, streak: newStreakValue });
                setShowConfetti(true);
                playAudio("levelUp");
                setTimeout(() => setShowConfetti(false), 5000);
            } else {
                if (userData.streakSaver?.available && resultData.summary) {
                    setDayToPotentiallySave(resultData.summary);
                } else if (resultData.summary) {
                    setShowMotivationModal(resultData.summary);
                }
            }
        }
        return resultData;
    }
} catch (err) {
  console.error("Error during daily summary processing:", err);
  setToastNotification({ message: "Ett fel uppstod vid summering av dagen.", type: "error" });
} finally {
  setAppStatus(AppStatus.IDLE);
}
}, [currentUser?.uid, userRole, userStatus, currentDate]);

    /** Hook: trigga ensureYesterdayProcessed när appen blir aktiv/visbar */
    useEffect(() => {
        if (!currentUser?.uid || !isInitialDataLoaded) return;

        const onWake = () => ensureYesterdayProcessed(currentUser.uid).catch(console.error);
        const onVis = () => { if (!document.hidden) onWake(); };

        window.addEventListener("focus", onWake);
        window.addEventListener("pageshow", onWake); 
        document.addEventListener("visibilitychange", onVis);

        onWake();

        return () => {
            window.removeEventListener("focus", onWake);
            window.removeEventListener("pageshow", onWake);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [currentUser?.uid, isInitialDataLoaded, ensureYesterdayProcessed]);

  
  // Audio Initialization
  useEffect(() => {
    initAudio().then(success => {
      if (success) console.log("Audio system initialized successfully.");
      else console.warn("Audio system initialization failed or requires user interaction.");
    });
  }, []);

// PWA Install Prompt Logic (for Android/Desktop)
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setShowInstallBanner(true);
      console.log('`beforeinstallprompt` event was fired.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // PWA Install Prompt Logic (for iOS)
  useEffect(() => {
    const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isInStandaloneMode = () => window.matchMedia('(display-mode: standalone)').matches;
    const isSafariOnIos = () => isIos() && navigator.vendor && navigator.vendor.indexOf('Apple') > -1 && !navigator.userAgent.match(/CriOS/i);
    const hasDismissedPrompt = localStorage.getItem('iosInstallPromptDismissed') === 'true';
  
    if (isSafariOnIos() && !isInStandaloneMode() && !hasDismissedPrompt) {
      const timer = setTimeout(() => {
        setShowIosInstallPrompt(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      return;
    }
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
    setShowInstallBanner(false);
  };
  
  const handleDismissInstallBanner = () => {
    setShowInstallBanner(false);
  };
  
  const handleCloseIosInstallPrompt = () => {
    setShowIosInstallPrompt(false);
    try {
      localStorage.setItem('iosInstallPromptDismissed', 'true');
    } catch (error) {
      console.warn('Could not save iOS prompt dismissal to localStorage:', error);
    }
  };


useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const tab = params.get('tab');
  const highlightId = params.get('highlight');

  if (view === 'community') {
    setViewMode('community');
    if (tab === 'requests') {
      setCommunityInitialTab('hantera');
    }
    if (highlightId) {
      setHighlightEventId(highlightId);
    }
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);

  // Check for stale push notifications
  useEffect(() => {
    const ensureValidSubscription = async () => {
        if (!currentUser || !isInitialDataLoaded || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                const keyArrayBuffer = subscription.options.applicationServerKey;
                if (keyArrayBuffer) {
                    const existingKey = btoa(String.fromCharCode.apply(null, new Uint8Array(keyArrayBuffer)))
                        .replace(/\+/g, '-')
                        .replace(/_/g, '_')
                        .replace(/=+$/, '');
                    
                    const currentKey = VAPID_PUBLIC_KEY.replace(/=+$/, '');

                    if (existingKey !== currentKey) {
                        console.log("Stale push subscription key found. Unsubscribing.");
                        await subscription.unsubscribe();
                        subscription = null; 
                    }
                } else {
                    console.log("Subscription found without a key. Unsubscribing.");
                    await subscription.unsubscribe();
                    subscription = null;
                }
            }

            if (!subscription) {
                const permissionState = await registration.pushManager.permissionState({ userVisibleOnly: true });
                if (permissionState === 'granted') {
                    const newSubscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                    });
                    
                    const subscriptionObject = JSON.parse(JSON.stringify(newSubscription));
                    
                    const userDoc = await getDocSafe(doc(db, "users", currentUser.uid));
                    const existingSubscriptions = userDoc.exists() ? (userDoc.data() as FirestoreUserDocument).pushSubscriptions || [] : [];
                    const isAlreadySaved = existingSubscriptions.some((sub: any) => sub.endpoint === subscriptionObject.endpoint);
                    
                    if (!isAlreadySaved) {
                        await savePushSubscription(currentUser.uid, subscriptionObject);
                    } 
                } 
            }
        } catch (error) {
            console.error("Error ensuring valid push subscription:", error);
        }
    };

    ensureValidSubscription();
  }, [currentUser, isInitialDataLoaded]);

    // --- ONBOARDING LOGIC ---
    const handleCloseOnboardingRewardModal = () => {
        setShowOnboardingRewardModal(false);
        const currentState = getLocalStorageItem<OnboardingChecklistState | null>(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, null);
        if (currentState) {
            const newState = { ...currentState, dismissed: true };
            setLocalStorageItem(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, newState);
        }
        setChecklistState(null);
    };

    const updateChecklistItem = useCallback((itemKey: keyof OnboardingChecklistItemStatus) => {
        setChecklistState(prevState => {
            if (!prevState || prevState.items[itemKey]) return prevState;
            const newState = { ...prevState, items: { ...prevState.items, [itemKey]: true } };
            setLocalStorageItem(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, newState);
            return newState;
        });
    }, []);
    
    useEffect(() => {
        if (!checklistState || !currentUser || !isInitialDataLoaded) return;

        const allComplete = Object.values(checklistState.items).every(Boolean);

        if (allComplete && !checklistState.dismissed) {
            const handleCompletion = () => {
                const bonusCalories = 100;

                setWeeklyBank(prevBank => {
                    const newBankState: WeeklyCalorieBank = {
                        ...prevBank,
                        bankedCalories: (prevBank.bankedCalories || 0) + bonusCalories
                    };

                    updateUserDocument(currentUser.uid, { weeklyBank: newBankState, role: userRole, status: userStatus })
                        .catch(error => {
                            handleFirestoreError(error, 'spara bonus till sparpott');
                            setWeeklyBank(prevBank);
                        });
                    
                    return newBankState; 
                });
                
                setShowConfetti(true);
                playAudio('levelUp');
                setShowOnboardingRewardModal(true);
            };
            handleCompletion();
        }
    }, [checklistState, currentUser, isInitialDataLoaded, userRole, userStatus, setWeeklyBank]);

    useEffect(() => {
        if (!currentUser || !isInitialDataLoaded || !hasCompletedOnboarding) {
          setChecklistState(null);
          return;
        }

        const storedState = getLocalStorageItem<OnboardingChecklistState | null>(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, null);
        if (storedState) {
            const fourDaysInMillis = 4 * 24 * 60 * 60 * 1000;
            const firstSeen = new Date(storedState.firstSeenDate).getTime();
            const allDone = Object.values(storedState.items).every(Boolean);

            if (storedState.dismissed || (Date.now() - firstSeen > fourDaysInMillis) || allDone) {
                setChecklistState(null);
            } else {
                setChecklistState(storedState);
            }
        } else {
            setChecklistState(null);
        }
    }, [isInitialDataLoaded, hasCompletedOnboarding, currentUser]);

    useEffect(() => {
        if (isViewingToday && waterLoggedMl > 0 && checklistState && !checklistState.items.waterLogged) {
            updateChecklistItem('waterLogged');
        }
    }, [waterLoggedMl, isViewingToday, checklistState, updateChecklistItem]);

    const handleOnboardingNavigate = (view: 'journey' | 'community', subView?: 'search') => {
        if (view === 'community') {
            if (subView === 'search') {
                setCommunityInitialTab('hantera');
                setCommunityInitialSubTab('search');
            } else {
                setCommunityInitialTab('flode');
                setCommunityInitialSubTab('buddies');
            }
        } else { 
            setJourneyInitialTab('calendar');
        }
        setViewMode(view);
    };

    useEffect(() => {
        if (checklistState) {
            if (viewMode === 'journey' && !checklistState.items.journeyViewed) {
                updateChecklistItem('journeyViewed');
            }
            if (viewMode === 'community' && !checklistState.items.communityViewed) {
                updateChecklistItem('communityViewed');
            }
        }
    }, [viewMode, checklistState, updateChecklistItem]);

    const handleDismissSpotlight = () => {
        setShowSpotlight(false);
        setLocalStorageItem(LOCAL_STORAGE_KEYS.ONBOARDING_SPOTLIGHT_SHOWN, true);
    };
    
    const handleScrollToWater = () => {
        waterLoggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

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
    let mealToSave: LoggedMeal = meal;

    if (meal.count && meal.count > 1) {
        const singleNutrition: NutritionalInfo = {
            foodItem: meal.nutritionalInfo.foodItem, 
            calories: meal.nutritionalInfo.calories / meal.count,
            protein: meal.nutritionalInfo.protein / meal.count,
            carbohydrates: meal.nutritionalInfo.carbohydrates / meal.count,
            fat: meal.nutritionalInfo.fat / meal.count,
        };
        mealToSave = {
            ...meal,
            nutritionalInfo: singleNutrition,
        };
    }
    setMealToSaveAsCommon(mealToSave);
    openModal(setShowSaveCommonMealModal);
  };
  
  // --- Course Logic ---
  const handleNavigateToCourse = (courseId: CourseInfo['id']) => {
    const course = ALL_COURSES.find(c => c.id === courseId);
    if (course) {
        setActiveCourse(course);
        setViewMode('courseOverview');
        playAudio('uiClick');
    }
  };

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
        await saveCourseProgress(currentUser.uid, lessonId, newProgress, userRole!, userStatus!);
        const allLessons = [...courseLessons, ...menopauseCourseLessons];
        const lesson = allLessons.find(l => l.id === lessonId);
        if (lesson) {
            setNewlyUnlockedLesson(lesson);
            playAudio('levelUp');
        }
    } catch (error) {
        handleFirestoreError(error, 'låsa upp lektion');
    }
  }, [currentUser?.uid, userRole, userStatus, setUserCourseProgress]);

  // Streak-based unlocking
  useEffect(() => {
    if (!isInitialDataLoaded || !currentUser) {
        return;
    }

    let lastUnlockedIndex = -1;
    for (let i = courseLessons.length - 1; i >= 0; i--) {
      if (userCourseProgress[courseLessons[i].id]?.unlockedAt) {
        lastUnlockedIndex = i;
        break;
      }
    }

    if (lastUnlockedIndex === -1 && courseLessons.length > 0) {
        const firstLessonId = courseLessons[0].id;
        if (!userCourseProgress[firstLessonId]?.unlockedAt) {
            unlockLesson(firstLessonId, streakData.currentStreak);
        }
        return;
    }
    
    if (lastUnlockedIndex > -1) {
        const lastUnlockedProgress = userCourseProgress[courseLessons[lastUnlockedIndex].id];
        
        if (lastUnlockedProgress?.unlockedAt) {
            const streakAtUnlock = lastUnlockedProgress.streakAtUnlock ?? 0;
            let shouldUnlock = false;
            
            if (streakData.currentStreak >= streakAtUnlock) {
                if (streakData.currentStreak >= streakAtUnlock + 7) { shouldUnlock = true; }
            } else {
                if (streakData.currentStreak >= 7) { shouldUnlock = true; }
            }

            if (shouldUnlock) {
                const nextLessonIndex = lastUnlockedIndex + 1;
                if (nextLessonIndex < courseLessons.length) {
                    const nextLesson = courseLessons[nextLessonIndex];
                    if (!userCourseProgress[nextLesson.id]?.unlockedAt) {
                        unlockLesson(nextLesson.id, streakData.currentStreak);
                    }
                }
            }
        }
    }
  }, [isInitialDataLoaded, currentUser, userCourseProgress, streakData.currentStreak, unlockLesson]);

  // Completion-based unlocking
  useEffect(() => {
    if (!isInitialDataLoaded || !currentUser) {
        return;
    }

    const firstLessonId = menopauseCourseLessons[0]?.id;
    if (firstLessonId && !userCourseProgress[firstLessonId]?.unlockedAt) {
        unlockLesson(firstLessonId, 0);
    }

    for (let i = 0; i < menopauseCourseLessons.length - 1; i++) {
        const currentLessonId = menopauseCourseLessons[i].id;
        const nextLessonId = menopauseCourseLessons[i + 1].id;

        const currentLessonProgress = userCourseProgress[currentLessonId];
        const nextLessonProgress = userCourseProgress[nextLessonId];

        if (currentLessonProgress?.isCompleted && !nextLessonProgress?.unlockedAt) {
            unlockLesson(nextLessonId, 0);
        }
    }
  }, [isInitialDataLoaded, currentUser, userCourseProgress, unlockLesson]);


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
      await saveCourseProgress(currentUser.uid, lessonId, lessonProgress, userRole!, userStatus!);
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
      await saveCourseProgress(currentUser.uid, lessonId, lessonProgress, userRole!, userStatus!);
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
      await saveCourseProgress(currentUser.uid, lessonId, lessonProgress, userRole!, userStatus!);
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
      await saveCourseProgress(currentUser.uid, lessonId, lessonProgress, userRole!, userStatus!);
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
        await saveCourseProgress(currentUser.uid, lessonId, lessonProgress, userRole!, userStatus!);
        playAudio('levelUp', 0.8);
        setToastNotification({message: "Lektion markerad som slutförd!", type: "success"});
        setTimeout(() => setToastNotification(null), 3000);

        const allLessons = [...courseLessons, ...menopauseCourseLessons];
        const lesson = allLessons.find(l => l.id === lessonId);
        const courseInfo = ALL_COURSES.find(c => (c.id === 'praktisk-viktkontroll' && lessonId.startsWith('lektion')) || (c.id === 'maxa-klimakteriet' && lessonId.startsWith('m-lektion')));

        if (lesson && courseInfo) {
            const eventData = {
                type: 'course' as const,
                timestamp: Date.now(),
                title: `har slutfört "${lesson.title}" `,
                description: `Ett stort steg framåt i kursen '${courseInfo.title}'!`,
                icon: ' ',
                relatedDocId: `course_${lessonId}`
            };
            await addTimelineEvent(currentUser.uid, eventData);
        }

        const FINAL_LESSON_ID = 'lektion12';
        if (lessonId === FINAL_LESSON_ID) {
            await handleUnlockAchievement('course_completed');
        }
    } catch (error) {
        handleFirestoreError(error, 'markera lektion som slutförd');
    }
  };

  // --- Course CTA Handlers ---
  const handleOpenSpeedDial = () => {
    setViewMode('main'); 
    handleFabClick();
  };

  const handleNavigateToJourney = (tab: 'calendar' | 'profile' | 'achievements') => {
    setJourneyInitialTab(tab);
    setViewMode('journey');
  };

  const handleOpenLogWeightModal = () => {
    setViewMode('main');
    openModal(setShowLogWeightModal);
  };
  
  const triggerJourneyAnalysis = useCallback(async (currentWeightLogs: WeightLogEntry[], latestWellbeingLog?: MentalWellbeingData): Promise<AIStructuredFeedbackResponse | null> => {
      if (!currentUser || !userProfile) return null;

      const timeline = calculateGoalTimeline(userProfile);
      
      const thirtyDaysAgo = new Date(currentDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const last30DaysSummaries = Object.values(pastDaysSummary).filter(s => {
          const summaryDate = new Date(s.date);
          return summaryDate >= thirtyDaysAgo;
      });

      // We don't want to mutate the state here directly for temp analysis, so just use what we have
      let combinedWellbeingLogs: MentalWellbeingLog[] = [...mentalWellbeingLogs];
      if (latestWellbeingLog && Object.values(latestWellbeingLog).some(v => v !== null)) {
          const newLog: MentalWellbeingLog = {
              id: 'transient',
              loggedAt: Date.now(),
              dateString: getDateUID(currentDate),
              ...latestWellbeingLog,
          };
          combinedWellbeingLogs.unshift(newLog);
      }

      const dataForAnalysis: AIDataForJourneyAnalysis = {
          userProfile,
          goals: goals,
          allWeightLogs: currentWeightLogs,
          last30DaysSummaries,
          goalTimeline: timeline,
          mentalWellbeingLogs: combinedWellbeingLogs,
          currentStreak: streakData.currentStreak,
      };

      try {
          const feedback = await getDetailedJourneyAnalysis(dataForAnalysis);
          const feedbackWithDate = { ...feedback, analysisDate: new Date().toISOString() };
          setJourneyAnalysisFeedback(feedbackWithDate);
          await updateUserDocument(currentUser.uid, { journeyAnalysisFeedback: feedbackWithDate, role: userRole, status: userStatus });
          return feedbackWithDate;
      } catch (e: any) {
          console.error("Failed to generate and save journey analysis:", e.message);
          return null;
      }
  }, [currentUser, userProfile, goals, pastDaysSummary, currentDate, userRole, userStatus, streakData.currentStreak, mentalWellbeingLogs, setJourneyAnalysisFeedback]);

  const handleDiscussSavedAnalysis = (analysisDate?: string) => {
    playAudio('uiClick');
    setCoachInitialContext({ type: 'from_analysis', date: analysisDate });
    setShowAICoachModal(true);
  };

  const handleFabClick = () => {
    playAudio('uiClick');
    if (showSpotlight) {
        handleDismissSpotlight();
    }
    if (!isEditableLogDate) {
        setToastNotification({message: "Du kan endast logga för idag eller igår.", type: "error"});
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    setShowSpeedDial(prev => !prev);
  };

  const handleNavigateToMainWithDate = (date: Date) => {
    const yesterday = new Date(currentDate);
    yesterday.setDate(currentDate.getDate() - 1);
    const dateUID = getDateUID(date);
    const yesterdayUID = getDateUID(yesterday);
    
    const summaryForDay = pastDaysSummary[dateUID];

    if (dateUID === yesterdayUID && summaryForDay && !summaryForDay.goalMet && streakSaver?.available) {
        setDayToPotentiallySave(summaryForDay);
    } else {
        setViewingDate(date);
        setViewMode('main');
    }
  };

  const handleUseStreakSaver = async () => {
    if (!currentUser || !dayToPotentiallySave) return;

    const dayToSave = dayToPotentiallySave;
    setDayToPotentiallySave(null);

    const dayToSaveDate = new Date(dayToSave.date + 'T12:00:00Z');
    const dayBefore = new Date(dayToSaveDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayBeforeUID = getDateUID(dayBefore);
    const dayBeforeSummary = pastDaysSummary[dayBeforeUID];
    const newStreak = (dayBeforeSummary?.streakForThisDay || 0) + 1;
    const newHighestStreak = Math.max(highestStreak, newStreak);
    
    const updatedSummary = { ...dayToSave, goalMet: true, savedBy: 'streakSaver' as const, streakForThisDay: newStreak };
    setPastDaysSummary(prev => ({ ...prev, [dayToSave.date]: updatedSummary }));

    const newStreakSaverState = { ...streakSaver!, available: false };
    setStreakSaver(newStreakSaverState);

    setStreakData(prev => ({ ...prev, currentStreak: newStreak, lastDateStreakChecked: dayToSave.date }));
    if (newHighestStreak > highestStreak) {
        setHighestStreak(newHighestStreak);
    }
    
    setToastNotification({ message: "Streak räddad! Starkt jobbat!", type: 'success' });
    playAudio('levelUp');

    try {
        const streakEventData = {
            type: 'streak' as const,
            timestamp: Date.now(),
            title: `har fått +1 på sin Streak!`,
            description: `Ny streak: ${newStreak} dagar i följd.`,
            icon: '🔥',
            relatedDocId: `streak_${dayToSave.date}`
        };
        await addTimelineEvent(currentUser.uid, streakEventData);

        const batch = writeBatch(db);
        const summaryRef = doc(db, 'users', currentUser.uid, 'pastDaySummaries', dayToSave.date);
        batch.update(summaryRef, { goalMet: true, savedBy: 'streakSaver', streakForThisDay: newStreak });

        const userRef = doc(db, 'users', currentUser.uid);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userUpdatePayload: Partial<FirestoreUserDocument> = {
            streakSaver: newStreakSaverState,
            currentStreak: newStreak,
            lastDateStreakChecked: dayToSave.date,
            role: userRole as UserRole, // Explicit cast
            status: userStatus as "pending" | "approved"
        };
        if (newHighestStreak > highestStreak) {
            userUpdatePayload.highestStreak = newHighestStreak;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        batch.update(userRef, userUpdatePayload as any);

        await batch.commit();

    } catch (error) {
        handleFirestoreError(error, 'använda streakräddare');
        // Rollback optimistic update
        setPastDaysSummary(prev => ({ ...prev, [dayToSave.date]: dayToSave }));
        setStreakSaver(streakSaver);
        setStreakData(prev => ({...prev, currentStreak: streakData.currentStreak}));
        if(newHighestStreak > highestStreak) {
            setHighestStreak(highestStreak);
        }
    }
};

  const originalBodyOverflow = useRef(document.body.style.overflow);
  useEffect(() => {
    const isAnyModalOpen = showUserProfileModal || showInfoModal || showRecipeModal || showCameraModal || showTextEntryModal || showSaveCommonMealModal || showIngredientCaptureModal || showIngredientRecipeResultsModal || showRecipeChoiceModal || showLevelUpModal || showGoalMetModalData || newlyUnlockedLesson || showAIFeedbackModal || showLogWeightModal || showMentalWellbeingModal || showOnboardingCompletion || showBarcodeScannerModal || !!barcodeScanResult || !!newlyUnlockedLesson || showSpeedDial || !!dayToPotentiallySave || !!showMotivationModal || showIosInstallPrompt || showOnboardingRewardModal || showAICoachModal || showLatestUpdateView;
    
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
  }, [showUserProfileModal, showInfoModal, showRecipeModal, showCameraModal, showTextEntryModal, showSaveCommonMealModal, showIngredientCaptureModal, showIngredientRecipeResultsModal, showRecipeChoiceModal, showLevelUpModal, showGoalMetModalData, newlyUnlockedLesson, showAIFeedbackModal, showLogWeightModal, showMentalWellbeingModal, showOnboardingCompletion, showBarcodeScannerModal, barcodeScanResult, newlyUnlockedLesson, showSpeedDial, dayToPotentiallySave, showMotivationModal, showIosInstallPrompt, showOnboardingRewardModal, showAICoachModal, showLatestUpdateView]);
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [viewMode, currentLessonId]);

  const totalCaloriesCoveredByBankToday = useMemo(() => {
    return dailyLog.reduce((sum, meal) => sum + (meal.caloriesCoveredByBank || 0), 0);
  }, [dailyLog]);
  
  const handleUnlockAchievement = useCallback(async (achievementId: string) => {
    if (!currentUser || unlockedAchievements[achievementId]) {
      return; 
    }
    
    const unlockedDate = new Date().toISOString();
    
    const newUnlocked = { ...unlockedAchievements, [achievementId]: unlockedDate };
    setUnlockedAchievements(newUnlocked);
    
    const achievement = ACHIEVEMENT_DEFINITIONS.find(a => a.id === achievementId);
    if (achievement) {
        setToastNotification({ message: `Bragd upplåst: ${achievement.name}`, type: 'success' });
        setTimeout(() => setToastNotification(null), 4000);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
        playAudio('levelUp');
        
        const eventData = {
            type: 'achievement' as const,
            timestamp: new Date(unlockedDate).getTime(),
            title: `har låst upp en bragden "${achievement.name} ${achievement.icon}"`,
            description: achievement.description,
            icon: achievement.icon,
            relatedDocId: `ach_${achievement.id}`
        };
        await addTimelineEvent(currentUser.uid, eventData);
    }

    try {
      await updateUserDocument(currentUser.uid, { unlockedAchievements: newUnlocked, role: userRole, status: userStatus });
    } catch (error) {
      handleFirestoreError(error, 'uppdatera bragder');
      const rolledBack = { ...unlockedAchievements };
      delete rolledBack[achievementId];
      setUnlockedAchievements(rolledBack);
    }
  }, [currentUser?.uid, unlockedAchievements, userRole, userStatus, setUnlockedAchievements]);

  useEffect(() => {
    // Level Up Check
    const { currentLevel } = getUserLevelInfo(streakData.currentStreak);
    if (currentLevel.id !== lastNotifiedStreakLevelUp && currentLevel.id !== LEVEL_DEFINITIONS[0].id) {
        if (currentLevel.id > (highestLevelId || 'level0')) {
            setShowLevelUpModal(currentLevel);
            setLastNotifiedStreakLevelUp(currentLevel.id);
            const newHighestLevelId = currentLevel.id;
            setHighestLevelId(newHighestLevelId);
            if (currentUser) {
                updateUserDocument(currentUser.uid, { highestLevelId: newHighestLevelId, role: userRole, status: userStatus });
                const eventData = {
                    type: 'level' as const,
                    timestamp: Date.now(),
                    title: `har nått en ny Nivå: ${currentLevel.name} ${currentLevel.icon}`,
                    description: currentLevel.description,
                    icon: currentLevel.icon,
                    relatedDocId: `lvl_${currentLevel.id}`
                };
                addTimelineEvent(currentUser.uid, eventData);
            }
            setShowConfetti(true);
            playAudio('levelUp');
            setTimeout(() => setShowConfetti(false), 5000);
        }
    }
  }, [streakData.currentStreak, lastNotifiedStreakLevelUp, highestLevelId, currentUser, userRole, userStatus, setHighestLevelId]);

  useEffect(() => {
    if (highestStreak > 0 && isInitialDataLoaded) {
        ACHIEVEMENT_DEFINITIONS.forEach(ach => {
            if (ach.type === 'streak' && highestStreak >= ach.requiredValue) {
                handleUnlockAchievement(ach.id);
            }
        });
    }
  }, [highestStreak, isInitialDataLoaded, handleUnlockAchievement]);

   // Logic for grouped daily log moved to Dashboard component, passed via dailyLog

  const journeyAnalysisData = useMemo<AIDataForJourneyAnalysis | null>(() => {
    if (!isInitialDataLoaded || !userProfile) return null;
    
    const timeline = calculateGoalTimeline(userProfile);
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const last30DaysSummaries = Object.values(pastDaysSummary).filter(s => {
        const summaryDate = new Date(s.date);
        return summaryDate >= thirtyDaysAgo;
    });

    return {
      userProfile,
      goals: goals,
      allWeightLogs: weightLogs,
      last30DaysSummaries,
      mentalWellbeingLogs,
      goalTimeline: timeline,
      currentStreak: streakData.currentStreak,
    };
  }, [isInitialDataLoaded, userProfile, goals, weightLogs, pastDaysSummary, mentalWellbeingLogs, currentDate, streakData.currentStreak]);

  const handleLogFromLabel = (nutritionalInfo: NutritionalInfo) => {
    addMealToLog(nutritionalInfo, { commonMealId: 'nutrition_label' });
    setShowNutritionLabelResultModal(false);
    setNutritionLabelResult(null);
    setToastNotification({ message: `"${nutritionalInfo.foodItem}" loggades!`, type: 'success' });
    setTimeout(() => setToastNotification(null), 3000);
  };
  
  const handleScanFallback = () => {
    closeModal(setShowBarcodeScannerModal);
    setIsCapturingForLabel(true);
    setIsCapturingForIngredients(false);
    openModal(setShowCameraModal);
  };
  
  const handleRecipeSearch = async (searchQuery: string) => {
    setAppStatus(AppStatus.SEARCHING_RECIPE);
    setCurrentRecipe(null); 
    setErrorMessage(null);
    try {
      const result = await getRecipeSuggestion(searchQuery);
      setCurrentRecipe(result);
      if (!result.error) {
        setRecentRecipeSearches(prev => {
            const updated = [searchQuery, ...prev.filter(s => s !== searchQuery)];
            return updated.slice(0, 5); // Keep 5 most recent
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Okänt receptsökfel";
      setErrorMessage(errorMsg); 
      setCurrentRecipe({ error: errorMsg } as RecipeSuggestion); 
    } finally {
      setAppStatus(AppStatus.IDLE);
    }
  };

  const handleLogRecipe = (nutritionalInfo: NutritionalInfo) => {
     if (!isEditableLogDate) {
        setToastNotification({ message: "Du kan endast logga recept för idag eller igår.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    addMealToLog(nutritionalInfo, { commonMealId: 'recipe' });
    setShowRecipeModal(false); 
    setCurrentRecipe(null);
    setToastNotification({ message: `"${nutritionalInfo.foodItem}" loggades!`, type: 'success' });
    setTimeout(() => setToastNotification(null), 3000);
  };
  
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
    setIngredientImagesForCapture([]); 
    setIsCapturingForIngredients(true);
    setIsCapturingForLabel(false);
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
    setShowIngredientCaptureModal(false); 
    setAppStatus(AppStatus.ANALYZING_INGREDIENTS);
    setIngredientAnalysisResult(null); 
    setErrorMessage(null);
    try {
        const imageBase64Data = imagesDataUrls.map(dataUrl => dataUrl.split(',')[1]).filter(Boolean);
        const result = await getRecipesFromIngredientsImage(imageBase64Data as string[]);
        setIngredientAnalysisResult(result);
        setShowIngredientRecipeResultsModal(true); 
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Kunde inte generera recept från ingredienser.";
      setErrorMessage(errorMsg);
      setToastNotification({ message: errorMsg, type: 'error' });
      setTimeout(() => setToastNotification(null), 3500);
    } finally {
      setAppStatus(AppStatus.IDLE);
      setIsCapturingForIngredients(false); 
    }
  };

  const handleLogRecipeFromIngredients = (nutritionalInfo: NutritionalInfo) => {
    if (!isEditableLogDate) {
        setToastNotification({ message: "Du kan endast logga recept för idag eller igår.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
    }
    addMealToLog(nutritionalInfo, { commonMealId: 'ingredient_recipe' });
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
    if (isEditableLogDate) {
      addMealToLog(nutritionalInfo, { base64Image: barcodeScanResult?.imageUrl, commonMealId: 'barcode' });
      setBarcodeScanResult(null);
    }
  };
  
    const checkGoalCompletion = (newLog: WeightLogEntry, profile: UserProfileData): boolean => {
        if (profile.mainGoalCompleted) return false;

        const { measurementMethod, desiredWeightChangeKg, desiredFatMassChangeKg, desiredMuscleMassChangeKg, goalStartWeight, goalStartFatMassKg, goalStartMuscleMassKg } = profile;

        if (measurementMethod === 'scale') {
            if (desiredWeightChangeKg == null || goalStartWeight == null) return false;
            const targetWeight = goalStartWeight + desiredWeightChangeKg;
            return desiredWeightChangeKg < 0 ? newLog.weightKg <= targetWeight : newLog.weightKg >= targetWeight;
        } else { 
            if (desiredFatMassChangeKg != null && desiredFatMassChangeKg < 0 && goalStartFatMassKg != null && newLog.bodyFatMassKg != null) {
                const targetFat = goalStartFatMassKg + desiredFatMassChangeKg;
                return newLog.bodyFatMassKg <= targetFat;
            }
            if (desiredMuscleMassChangeKg != null && desiredMuscleMassChangeKg > 0 && goalStartMuscleMassKg != null && newLog.skeletalMuscleMassKg != null) {
                const targetMuscle = goalStartMuscleMassKg + desiredMuscleMassChangeKg;
                return newLog.skeletalMuscleMassKg >= targetMuscle;
            }
        }
        return false;
    };

    const getGoalDescriptionString = (profile: UserProfileData, finalWeight: number): string => {
        const { goalType, goalStartWeight, goalStartFatMassKg, goalStartMuscleMassKg, desiredFatMassChangeKg, desiredMuscleMassChangeKg, measurementMethod, desiredWeightChangeKg } = profile;
        const startWeight = goalStartWeight || 0;
        const weightChange = (finalWeight - startWeight).toFixed(1);

        if (goalType === 'lose_fat') {
            if (measurementMethod === 'inbody' && goalStartFatMassKg && desiredFatMassChangeKg) {
                return `Minskade ${Math.abs(desiredFatMassChangeKg).toFixed(1)} kg fettmassa`;
            }
            return `Gick ner ${Math.abs(parseFloat(weightChange))} kg`;
        }
        if (goalType === 'gain_muscle') {
             if (measurementMethod === 'inbody' && goalStartMuscleMassKg && desiredMuscleMassChangeKg) {
                return `Ökade ${Math.abs(desiredMuscleMassChangeKg).toFixed(1)} kg muskelmassa`;
            }
            return `Gick upp ${Math.abs(parseFloat(weightChange))} kg`;
        }
        return `Nådde sitt mål att bibehålla vikten`;
    };

    const handleSaveWeightLog = async (data: Omit<WeightLogEntry, 'id'>) => {
        if (!currentUser) return;
        setAppStatus(AppStatus.SAVING);

        const sanitizedDataForFirestore = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));

        try {
            const newDocId = await saveWeightLog(currentUser.uid, sanitizedDataForFirestore as Omit<WeightLogEntry, 'id'>);
            const newWeightLogEntry: WeightLogEntry = { id: newDocId, ...data };
            
            // Update local state immediately
            setWeightLogs(prevLogs => [...prevLogs, newWeightLogEntry].sort((a,b) => a.loggedAt - b.loggedAt));
            
            setUserProfile(prev => ({ ...prev, currentWeightKg: data.weightKg, skeletalMuscleMassKg: data.skeletalMuscleMassKg ?? prev.skeletalMuscleMassKg, bodyFatMassKg: data.bodyFatMassKg ?? prev.bodyFatMassKg }));
            
            const goalWasJustCompleted = !userProfile.mainGoalCompleted && checkGoalCompletion(newWeightLogEntry, userProfile);

            if (goalWasJustCompleted) {
                const goalDescription = getGoalDescriptionString(userProfile, newWeightLogEntry.weightKg);
                const newCompletedGoal: CompletedGoal = {
                    id: `goal_${Date.now()}`, achievedOn: new Date().toISOString().split('T')[0],
                    description: goalDescription, startWeight: userProfile.goalStartWeight || 0, endWeight: newWeightLogEntry.weightKg,
                };
                const updatedProfile = {
                    ...userProfile, mainGoalCompleted: true, completedGoals: [...(userProfile.completedGoals || []), newCompletedGoal],
                    desiredFatMassChangeKg: undefined, desiredMuscleMassChangeKg: undefined,
                    desiredWeightChangeKg: undefined, goalCompletionDate: undefined,
                };
                setUserProfile(updatedProfile);
                await updateUserDocument(currentUser.uid, {
                    mainGoalCompleted: true, completedGoals: updatedProfile.completedGoals,
                    desiredFatMassChangeKg: deleteField(), desiredMuscleMassChangeKg: deleteField(),
                    desiredWeightChangeKg: deleteField(), goalCompletionDate: deleteField(),
                    role: userRole, status: userStatus
                });
                await handleUnlockAchievement('main_goal_reached');
                setPendingTimelineEvent({ type: 'goal_achieved', data: { newLog: newWeightLogEntry, goalDescription } });
                setToastNotification({ message: 'GRATTIS! Du har nått ditt huvudmål!', type: 'success' });
            } else {
                const previousLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
                setPendingTimelineEvent({ type: 'weight', data: { newLog: newWeightLogEntry, previousLog } });
                setToastNotification({ message: 'Vikt loggad!', type: 'success' });
            }
            
            setShowLogWeightModal(false);
            setPendingAnalysisData({ updatedLogs: [...weightLogs, newWeightLogEntry].sort((a,b) => a.loggedAt - b.loggedAt) });
            setRelatedWeightLogIdForWellbeing(newDocId);
            setShowMentalWellbeingModal(true);
        } catch (error) {
            handleFirestoreError(error, 'spara viktlogg');
        } finally {
            setAppStatus(AppStatus.IDLE);
        }
    };

    const handleSaveWellbeingAndProceed = async (data: MentalWellbeingData) => {
        if (!currentUser) return;
        
        const eventToCreate = pendingTimelineEvent;
        setPendingTimelineEvent(null);

        const isDataLogged = Object.values(data).some(v => v !== null);

        if (isDataLogged) {
            const newLog: Omit<MentalWellbeingLog, 'id'> = {
                loggedAt: Date.now(), dateString: getDateUID(viewingDate),
                ...data,
                relatedWeightLogId: relatedWeightLogIdForWellbeing || null,
            };
            try {
                const newDocId = await addMentalWellbeingLog(currentUser.uid, newLog);
                setMentalWellbeingLogs(prev => [{...newLog, id: newDocId}, ...prev].sort((a,b) => b.loggedAt - a.loggedAt));
                playAudio('logSuccess', 0.8);
            } catch (error) {
                handleFirestoreError(error, 'spara välbefinnande');
            }
        }
        
        setShowMentalWellbeingModal(false);

        if (eventToCreate) {
            try {
                let eventData: Omit<TimelineEvent, 'id' | 'userId' | 'userName' | 'userPhotoURL' | 'gender' | 'relatedDocPath' | 'reactions' | 'comments'> & { relatedDocId: string } | null = null;
                
                switch (eventToCreate.type) {
                    case 'weight': {
                        const { newLog, previousLog } = eventToCreate.data;
                        const weightChange = previousLog ? newLog.weightKg - previousLog.weightKg : undefined;
                        const muscleChange = (previousLog && newLog.skeletalMuscleMassKg != null && previousLog.skeletalMuscleMassKg != null) ? newLog.skeletalMuscleMassKg - previousLog.skeletalMuscleMassKg : undefined;
                        const fatChange = (previousLog && newLog.bodyFatMassKg != null && previousLog.bodyFatMassKg != null) ? newLog.bodyFatMassKg - previousLog.bodyFatMassKg : undefined;
                        
                        const descriptionParts = [`Vikt: ${newLog.weightKg.toFixed(1)}kg (${formatChange(weightChange)})`];
                        if (muscleChange !== undefined) descriptionParts.push(`Muskler: ${newLog.skeletalMuscleMassKg!.toFixed(1)}kg (${formatChange(muscleChange)})`);
                        if (fatChange !== undefined) descriptionParts.push(`Fett: ${newLog.bodyFatMassKg!.toFixed(1)}kg (${formatChange(fatChange)})`);

                        eventData = {
                            type: 'weight', timestamp: newLog.loggedAt, title: `har loggat en ny mätning`,
                            description: descriptionParts.join('\n'), icon: '⚖️', relatedDocId: newLog.id
                        };
                        break;
                    }
                    case 'goal_set': {
                        const { userProfile: profileData } = eventToCreate.data;
                        const datePart = profileData.goalCompletionDate ? ` till ${new Date(profileData.goalCompletionDate + 'T00:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}` : '';
                        let goalText = 'Nytt mål: ';
                        if (profileData.measurementMethod === 'scale' && profileData.desiredWeightChangeKg) {
                            goalText += `Nå en viktförändring på ${profileData.desiredWeightChangeKg > 0 ? '+' : ''}${profileData.desiredWeightChangeKg.toFixed(1).replace('.',',')} kg${datePart}`;
                        } else {
                            const changes = [];
                            if (profileData.desiredFatMassChangeKg) changes.push(`${profileData.desiredFatMassChangeKg > 0 ? '+' : ''}${profileData.desiredFatMassChangeKg.toFixed(1).replace('.',',')} kg fett`);
                            if (profileData.desiredMuscleMassChangeKg) changes.push(`${profileData.desiredMuscleMassChangeKg > 0 ? '+' : ''}${profileData.desiredMuscleMassChangeKg.toFixed(1).replace('.',',')} kg muskler`);
                            goalText += `Nå en förändring på ${changes.join(' och ')}${datePart}`;
                        }
                        
                        eventData = {
                            type: 'goal_set', timestamp: Date.now(), title: `har satt ett nytt mål`,
                            description: goalText, icon: '🎯', relatedDocId: `goal_${Date.now()}`
                        };
                        break;
                    }
                    case 'goal_achieved': {
                        const { newLog, goalDescription } = eventToCreate.data;
                        eventData = {
                            type: 'goal_achieved', timestamp: newLog.loggedAt, title: `har uppnått sitt mål! 🏁`,
                            description: goalDescription, icon: '🏁', relatedDocId: newLog.id
                        };
                        break;
                    }
                }
                if (eventData) {
                    await addTimelineEvent(currentUser.uid, eventData);
                }
            } catch (error) {
                console.error("Failed to create pending timeline event:", error);
            }
        }


        if (pendingAnalysisData) {
            setAiModalTitle("Analys av din mätning");
            setAiModalIcon(<SparklesIcon className="w-7 h-7 text-secondary mr-2.5" />);
            setShowAIFeedbackModal(true);
            setAIFeedbackLoading(true);
            setAIFeedbackMessage(null);
            setAiFeedbackError(null);

            const feedback = await triggerJourneyAnalysis(pendingAnalysisData.updatedLogs, data);
            
            setAIFeedbackLoading(false);
            if (feedback) {
                setAIFeedbackMessage(feedback);
            } else {
                setAiFeedbackError("Kunde inte generera en analys just nu.");
            }
            
            setPendingAnalysisData(null);
            setRelatedWeightLogIdForWellbeing(null);
        } else if (pendingGoalFeedbackData) {
            setAiModalTitle("Feedback från din Coach");
            setAiModalIcon(<AICoachIcon className="w-7 h-7 text-secondary mr-2.5" />);
            setShowAIFeedbackModal(true);
            setAIFeedbackLoading(true);
            setAIFeedbackMessage(null);
            setAiFeedbackError(null);

            const dataForFeedback: AIDataForFeedback = {
                userName: pendingGoalFeedbackData.profile.name,
                userGoals: pendingGoalFeedbackData.goals,
                userProfile: pendingGoalFeedbackData.profile,
                isOnboarding: pendingGoalFeedbackData.isOnboarding,
                mentalWellbeing: data,
                todayTotals: totalNutrients,
                currentStreak: streakData.currentStreak,
                activeLesson: null,
            };
            
            try {
                const feedback = await getAIFeedback(dataForFeedback);
                setAIFeedbackMessage(feedback);
                if (pendingGoalFeedbackData.isOnboarding) {
                    setOnboardingStep('feedback');
                }
            } catch (e: any) {
                setAiFeedbackError(e.message || "Ett fel uppstod.");
            } finally {
                setAIFeedbackLoading(false);
                setPendingGoalFeedbackData(null);
            }
        } else {
            if (isDataLogged) {
                setToastNotification({ message: 'Välbefinnande sparat!', type: 'success' });
                 setTimeout(() => setToastNotification(null), 3000);
            }
        }
    };

    const handleAddOptionSelect = (option: 'camera' | 'upload' | 'text' | 'recipe' | 'barcode') => {
        setShowSpeedDial(false);
        playAudio('uiClick');
        switch (option) {
        case 'camera':
            setIsCapturingForIngredients(false); 
            setIsCapturingForLabel(false);
            openModal(setShowCameraModal);
            break;
        case 'upload':
            setIsCapturingForIngredients(false); 
            setIsCapturingForLabel(false);
            document.getElementById('imageUploadInputMain')?.click(); 
            break;
        case 'text':
            openModal(setShowTextEntryModal);
            break;
        case 'recipe':
            handleOpenRecipeChoiceModal();
            break;
        case 'barcode':
            openModal(setShowBarcodeScannerModal);
            break;
        }
  };


  if (authLoading || isDataLoading) {
    return <SplashScreen />;
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

  const DropdownMenuItem: React.FC<{
    onClick: () => void;
    icon: JSX.Element;
    label: string;
    className?: string;
    hasNotification?: boolean;
  }> = ({ onClick, icon, label, className, hasNotification }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-4 py-2.5 text-sm text-neutral-dark hover:bg-neutral-light/70 flex items-center rounded-md transition-colors ${className || ''}`}
    >
        {React.cloneElement(icon, { className: "w-5 h-5 mr-2.5 text-neutral" })}
        <span className="flex-grow">{label}</span>
        {hasNotification && (
            <span className="ml-auto h-2.5 w-2.5 rounded-full bg-red-500"></span>
        )}
    </button>
);

  const mainContentMaxWidth = 'max-w-7xl';
    
    const { currentLevel } = getUserLevelInfo(highestStreak);

    const iconColor = "#3bab5a";
    const iconSize = 24;
    const iconStrokeWidth = 1.5;

    const totalNotificationCount = pendingRequestsCount + communityNotificationCount;

    const navItems = [
      { key: 'main', label: 'Startsida', Icon: Home, isActive: viewMode === 'main', onClick: () => { playAudio('uiClick'); setViewMode('main'); setCurrentLessonId(null); } },
      { key: 'journey', label: 'Min resa', Icon: Footprints, isActive: viewMode === 'journey', onClick: () => { playAudio('uiClick'); setJourneyInitialTab('calendar'); setViewMode('journey'); } },
      { key: 'course', label: 'Kurs', Icon: GraduationCap, isActive: viewMode === 'coursesView' || viewMode === 'courseOverview' || viewMode === 'lessonDetail', onClick: () => { playAudio('uiClick'); setViewMode('coursesView');} },
      { key: 'community', label: 'Community', Icon: Users, isActive: viewMode === 'community', onClick: () => { playAudio('uiClick'); if (viewMode === 'community') { setCommunityViewKey(Date.now()); } setViewMode('community'); }, notificationCount: totalNotificationCount },
    ];

    const lessonsForOverview = activeCourse?.id === 'maxa-klimakteriet' ? menopauseCourseLessons : courseLessons;
    const lessonsForDetail = activeCourse?.id === 'maxa-klimakteriet' ? menopauseCourseLessons : courseLessons;
    const currentLesson = lessonsForDetail.find(l => l.id === currentLessonId);

  return (
    <>
      <div className="min-h-screen bg-neutral-light flex flex-col items-center pb-28">
        {persistenceWarning && (
            <div className="w-full bg-yellow-400 text-yellow-900 p-3 text-center sticky top-0 z-[1000] shadow-md">
                <p className="font-bold"> Varning för Offlineläge</p>
                <p className="text-sm">{persistenceWarning}</p>
            </div>
        )}
       <header className="w-full bg-white text-neutral-dark p-4 shadow-lg sticky top-0 z-30">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => { playAudio('uiClick'); setViewMode('main'); setCurrentLessonId(null); }}>
                    <img src="/favicon.png" alt="Kostloggen.se logo" className="h-14 w-14" />
                </div>
                <div className="flex flex-wrap justify-end items-center gap-1">
                    {navItems.map(item => (
                        <button
                            key={item.key}
                            aria-label={item.label}
                            className={`nav-btn ${item.isActive ? "active" : ""}`}
                            onClick={item.onClick}
                        >
                            <span className="icon-wrap">
                                <item.Icon color={iconColor} size={iconSize} strokeWidth={iconStrokeWidth} />
                            </span>
                            {item.notificationCount > 0 && (
                                <span className="absolute top-[-4px] right-[-4px] flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold ring-2 ring-white">
                                    {item.notificationCount > 9 ? '9+' : item.notificationCount}
                                </span>
                            )}
                        </button>
                    ))}
                    <div className="relative" ref={profileDropdownRef}>
                        <button
                            aria-label="Konto"
                            className={`nav-btn ${showProfileDropdown ? "active" : ""}`}
                            onClick={() => { playAudio('uiClick'); setShowProfileDropdown(prev => !prev);}}
                        >
                             <div className="icon-wrap p-0 relative">
                                <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={32} />
                                {hasUnseenUpdate && (
                                    <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
                                )}
                             </div>
                        </button>
                        {showProfileDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-neutral-light/70 p-2 z-40 animate-fade-slide-in">
                                <DropdownMenuItem
                                    icon={<PencilIcon/>}
                                    label="Redigera Profil"
                                    onClick={() => {
                                        setShowUserProfileModal(true);
                                        setIsProfileModalOnboarding(false);
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
                                    icon={<BellIcon />}
                                    label="Senaste uppdateringen"
                                    hasNotification={hasUnseenUpdate}
                                    onClick={handleViewLatestUpdate}
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
                </div>
            </div>
        </header>

        <main className={viewMode === 'community' 
          ? "w-full flex-grow flex flex-col h-full" 
          : `w-full ${mainContentMaxWidth} mx-auto p-2 sm:p-4 flex-grow flex flex-col`
        }>
         {viewMode === 'main' && (
            <Dashboard 
                checklistState={checklistState}
                onOnboardingNavigate={handleOnboardingNavigate}
                onTriggerLog={handleFabClick}
                onScrollToWater={handleScrollToWater}
                waterLoggerRef={waterLoggerRef}
                streakData={streakData}
                highestStreak={highestStreak}
                currentLevel={currentLevel}
                userProfile={userProfile}
                weeklyBank={weeklyBank}
                pastDaysSummary={pastDaysSummary}
                currentAppDate={currentDate}
                viewingDate={viewingDate}
                onDateSelect={handleNavigateToMainWithDate}
                formattedViewingDate={formattedViewingDate}
                dailyLog={dailyLog}
                goals={goals}
                waterLoggedMl={waterLoggedMl}
                waterGoalMl={waterGoalMl}
                onLogWater={handleLogWater}
                onResetWater={handleResetWater}
                isEditableLogDate={isEditableLogDate}
                commonMeals={commonMeals}
                onLogCommonMeal={logCommonMeal}
                onDeleteCommonMeal={deleteCommonMeal}
                onUpdateCommonMeal={handleUpdateCommonMeal}
                onDeleteMeal={handleDeleteMeal}
                onUpdateMeal={handleUpdateMeal}
                onOpenSaveCommonMealModal={handleOpenSaveCommonMealModal}
                showSpeedDial={showSpeedDial}
                onToggleSpeedDial={handleFabClick}
                onAddOptionSelect={handleAddOptionSelect}
                showSpotlight={showSpotlight}
                onDismissSpotlight={handleDismissSpotlight}
                isInstallBannerVisible={showInstallBanner || showIosInstallPrompt}
            />
         )}
         {viewMode === 'journey' && journeyAnalysisData && (
            <JourneyView 
                pastDaysData={pastDaysSummary} 
                weightLogs={weightLogs}
                userProfile={userProfile}
                goals={goals}
                onSaveProfileAndGoals={handleSaveProfileAndGoals}
                onOpenLogWeightModal={() => openModal(setShowLogWeightModal)}
                playAudio={playAudio}
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
                achievementInteractions={achievementInteractions}
                journeyAnalysisFeedback={journeyAnalysisFeedback}
                onNavigateToMainWithDate={handleNavigateToMainWithDate}
                streakSaver={streakSaver}
                analysisContext={journeyAnalysisData}
                setShowAICoachModal={setShowAICoachModal}
                onDiscussSavedAnalysis={handleDiscussSavedAnalysis}
            />
         )}
         {viewMode === 'coursesView' && (
            <CoursesView
                userProfile={userProfile}
                onNavigateToCourse={handleNavigateToCourse}
            />
         )}
         {viewMode === 'courseOverview' && activeCourse && (
           <CourseOverview
               lessons={lessonsForOverview}
               userProgress={userCourseProgress}
               onSelectLesson={handleSelectLesson}
               currentStreak={streakData.currentStreak}
               courseId={activeCourse.id}
            />
         )}
          {viewMode === 'lessonDetail' && currentLessonId && currentLesson && (
            <LessonDetail
                lesson={currentLesson}
                progress={userCourseProgress[currentLessonId]}
                onToggleFocusPoint={handleToggleFocusPoint}
                onSaveReflection={handleSaveReflection}
                onMarkComplete={handleMarkLessonComplete}
                onClose={handleCloseLessonDetail}
                onOpenSpeedDial={handleOpenSpeedDial}
                onNavigateToJourney={handleNavigateToJourney}
                onSaveWhyAnswer={handleSaveWhyAnswer}
                onSaveSmartGoalAnswer={handleSaveSmartGoalAnswer}
                userProfile={userProfile}
                weightLogs={weightLogs}
                pastDaysSummary={Object.values(pastDaysSummary)}
                onOpenLogWeightModal={handleOpenLogWeightModal}
            />
         )}
         {viewMode === 'community' && (
            <CommunityView
              key={communityViewKey}
              currentUser={currentUser}
              userProfile={userProfile}
              achievements={ACHIEVEMENT_DEFINITIONS}
              setToastNotification={setToastNotification}
              pendingRequestsCount={pendingRequestsCount}
              initialTab={communityInitialTab}
              initialSubTab={communityInitialSubTab}
              highlightEventId={highlightEventId}
              timelineEvents={timelineEvents}
              setTimelineEvents={setTimelineEvents}
              buddyDetails={buddyDetails}
              isLoading={isLoadingCommunityData}
              onDataChanged={loadCommunityData}
              lastViewTimestamp={lastCommunityViewTimestamp}
            />
         )}
        </main>
        
        <input type="file" id="imageUploadInputMain" className="hidden" accept="image/*" onChange={handleImageUpload} />
        <input type="file" id="ingredientUploadInput" className="hidden" accept="image/*" multiple onChange={handleIngredientImageUpload} />

        {/* Modals */}
        {showLatestUpdateView && (
            <UpdateNoticeModal 
                show={showLatestUpdateView} 
                onClose={() => setShowLatestUpdateView(false)}
                onNavigateToCourses={handleNavigateToCourses}
            />
        )}
        {showOnboardingRewardModal && (
            <OnboardingRewardModal show={showOnboardingRewardModal} onClose={handleCloseOnboardingRewardModal} />
        )}
        {dayToPotentiallySave && (
            <UseStreakSaverModal
                show={!!dayToPotentiallySave}
                onClose={() => setDayToPotentiallySave(null)}
                onConfirm={handleUseStreakSaver}
                daySummary={dayToPotentiallySave}
            />
        )}
        {showMotivationModal && (
            <MotivationModal
                show={!!showMotivationModal}
                onClose={() => setShowMotivationModal(null)}
                daySummary={showMotivationModal}
            />
        )}
        {analysisResultForModal && (
            <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => setAnalysisResultForModal(null)}>
                 <div onClick={e => e.stopPropagation()} className="animate-scale-in">
                    <ImageAnalysisResultModal
                        analysisResult={analysisResultForModal}
                        imageDataUrl={`data:image/jpeg;base64,${cameraImageForAnalysis}`}
                        onLog={handleLogFromModal}
                        onClose={() => setAnalysisResultForModal(null)}
                    />
                </div>
            </div>
        )}
         {showInfoModal && (
            <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => closeModal(setShowInfoModal)}>
              <InfoModal onClose={() => closeModal(setShowInfoModal)} userName={userProfile.name} />
            </div>
          )}
          {showUserProfileModal && (
            <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={handleCloseUserProfileModal}>
              <div onClick={e => e.stopPropagation()} className="animate-scale-in">
                  <UserProfileModal
                    initialProfile={userProfile}
                    onSave={handleSaveProfileAndGoals}
                    onClose={handleCloseUserProfileModal}
                    isOnboarding={isProfileModalOnboarding}
                    onboardingStep={onboardingStep}
                    aiFeedbackLoading={aiFeedbackLoading}
                    aiFeedbackMessage={aiFeedbackMessage}
                    aiFeedbackError={aiFeedbackError}
                    onSubscribeToPush={handleSubscribeToPush}
                  />
              </div>
            </div>
          )}
          {showOnboardingCompletion && (
             <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={handleFinishOnboarding}>
                <div onClick={e => e.stopPropagation()} className="animate-scale-in">
                    <OnboardingCompletionScreen onFinish={handleFinishOnboarding} />
                </div>
             </div>
          )}
           {showTextEntryModal && (
              <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => closeModal(setShowTextEntryModal)}>
                  <div onClick={e => e.stopPropagation()} className="animate-scale-in">
                      <TextEntryModal show={showTextEntryModal} onClose={() => closeModal(setShowTextEntryModal)} onLog={(foodInfo, options) => {
                          addMealToLog({ ...foodInfo, foodItem: foodInfo.servingDescription ? `${foodInfo.foodItem} (${foodInfo.servingDescription})` : foodInfo.foodItem }, { commonMealId: 'text_search' });
                          if (options.saveAsCommon) {
                            saveCommonMeal(foodInfo, foodInfo.servingDescription ? `${foodInfo.foodItem} (${foodInfo.servingDescription})` : foodInfo.foodItem);
                          }
                      }} />
                  </div>
              </div>
          )}
          {showCameraModal && (
            <CameraModal
                show={showCameraModal}
                onClose={() => closeModal(setShowCameraModal)}
                onImageCapture={handleImageCapture}
                onCameraError={(msg) => {
                    setToastNotification({ message: `Kamerafel: ${msg}`, type: 'error'});
                    setTimeout(() => setToastNotification(null), 3500);
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
                  setTimeout(() => setToastNotification(null), 3500);
              }}
              onScanFallback={handleScanFallback}
            />
          )}
          {barcodeScanResult && (
            <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => setBarcodeScanResult(null)}>
              <div onClick={e => e.stopPropagation()} className="animate-scale-in">
                <BarcodeSearchResultModal
                  scanResult={barcodeScanResult}
                  onLog={handleLogFromBarcode}
                  onClose={() => setBarcodeScanResult(null)}
                />
              </div>
            </div>
          )}
          {showSaveCommonMealModal && mealToSaveAsCommon && (
            <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => closeModal(setShowSaveCommonMealModal)}>
                <div onClick={e => e.stopPropagation()} className="animate-scale-in">
                    <SaveCommonMealModal
                    mealInfo={mealToSaveAsCommon.nutritionalInfo}
                    initialName={mealToSaveAsCommon.nutritionalInfo.foodItem || ''}
                    onSave={(name) => saveCommonMeal(mealToSaveAsCommon!.nutritionalInfo, name)}
                    onClose={() => closeModal(setShowSaveCommonMealModal)}
                    />
                </div>
            </div>
        )}
        {showRecipeChoiceModal && (
            <RecipeChoiceModal
                show={showRecipeChoiceModal}
                onClose={() => closeModal(setShowRecipeChoiceModal)}
                onChooseSearch={handleChooseRecipeSearch}
                onChooseTakePhoto={handleChooseTakePhoto}
                onChooseUpload={handleChooseUpload}
            />
        )}
        {showRecipeModal && (
            <RecipeModal
                show={showRecipeModal}
                onClose={() => { closeModal(setShowRecipeModal); setCurrentRecipe(null); setErrorMessage(null); }}
                onSearch={handleRecipeSearch}
                onLogRecipe={handleLogRecipe}
                recipe={currentRecipe}
                isLoading={appStatus === AppStatus.SEARCHING_RECIPE}
                error={errorMessage}
                isLoggingDisabled={!isEditableLogDate}
                recentSearches={recentRecipeSearches}
                setToastNotification={setToastNotification}
            />
        )}
        {showIngredientCaptureModal && (
            <IngredientCaptureModal
                show={showIngredientCaptureModal}
                onClose={() => closeModal(setShowIngredientCaptureModal)}
                onFindRecipes={handleFindRecipesFromIngredients}
                openCameraModal={() => {
                    closeModal(setShowIngredientCaptureModal);
                    openModal(setShowCameraModal);
                }}
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
                isLoggingDisabled={!isEditableLogDate}
            />
        )}
        {showLevelUpModal && (
            <LevelUpModal level={showLevelUpModal} onClose={() => setShowLevelUpModal(null)} />
        )}
         {showGoalMetModalData && (
          <GoalMetModal
            data={showGoalMetModalData}
            onClose={() => setShowGoalMetModalData(null)}
          />
        )}
        {newlyUnlockedLesson && (
          <NewLessonUnlockedModal 
            lessonTitle={newlyUnlockedLesson.title} 
            onClose={() => setNewlyUnlockedLesson(null)} 
          />
        )}
        {showAIFeedbackModal && (
            <AIFeedbackModal
                show={showAIFeedbackModal}
                onClose={() => {
                   if (isProfileModalOnboarding) {
                       handleFinishOnboarding();
                   } else {
                       setShowAIFeedbackModal(false);
                   }
                }}
                feedbackMessage={aiFeedbackMessage}
                isLoading={aiFeedbackLoading}
                error={aiFeedbackError}
                modalTitle={aiModalTitle}
                modalIcon={aiModalIcon}
                isOnboardingContext={isProfileModalOnboarding}
                showDiscussButton={aiModalTitle === "Analys av din mätning"}
                onDiscuss={() => {
                    playAudio('uiClick');
                    setShowAIFeedbackModal(false);
                    setCoachInitialContext({ type: 'from_analysis' });
                    setViewMode('journey');
                    setShowAICoachModal(true);
                }}
            />
        )}
        {showLogWeightModal && (
          <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => closeModal(setShowLogWeightModal)}>
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
                onClose={() => setShowMentalWellbeingModal(false)}
                onSave={handleSaveWellbeingAndProceed}
            />
        )}
        {journeyAnalysisData && (
            <AICoachModal 
              show={showAICoachModal}
              onClose={() => {
                  setShowAICoachModal(false);
                  setCoachInitialContext(null);
              }}
              analysisContext={journeyAnalysisData}
              initialContext={coachInitialContext}
            />
        )}
        {showNutritionLabelResultModal && nutritionLabelResult && (
          <NutritionLabelResultModal
            show={showNutritionLabelResultModal}
            onClose={() => {
              setShowNutritionLabelResultModal(false);
              setNutritionLabelResult(null);
            }}
            analysisResult={nutritionLabelResult}
            onLog={handleLogFromLabel}
          />
        )}

      </div>
      {(appStatus === AppStatus.ANALYZING || appStatus === AppStatus.ANALYZING_INGREDIENTS) && (
        <LoadingSpinner
          message={
            appStatus === AppStatus.ANALYZING
              ? "Analyserar bild..."
              : "Hittar recept från dina bilder..."
          }
        />
      )}
      {splashEffect && (
        <WaterSplashEffect
            key={splashEffect.id}
            x={splashEffect.x}
            y={splashEffect.y}
            count={splashEffect.count}
            onComplete={() => setSplashEffect(null)}
        />
      )}
      {toastNotification && (
          <ToastNotification
            message={toastNotification.message}
            type={toastNotification.type}
            onClose={() => setToastNotification(null)}
          />
      )}
      {showConfetti && <ConfettiCelebration isActive={showConfetti} />}
       {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-50 animate-slide-up-fade-in">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <InstallIcon className="w-12 h-12 text-primary flex-shrink-0" />
                    <div>
                        <h3 className="font-bold text-neutral-dark">Installera Kostloggen</h3>
                        <p className="text-sm text-neutral">
                            Få en bättre upplevelse genom att lägga till appen på din hemskärm.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleDismissInstallBanner} className="p-2 text-sm text-neutral hover:bg-neutral-light/70 rounded-md">Senare</button>
                    <button onClick={handleInstallClick} className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-md shadow-sm">Installera</button>
                </div>
            </div>
        </div>
      )}
      {showIosInstallPrompt && <IosInstallPrompt onClose={handleCloseIosInstallPrompt} />}
    </>
  );
};