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

import { getAIFeedback, getDetailedJourneyAnalysis } from './services/geminiService.ts';

import {
  addMealLog as addMealLogFirestore, setWaterLog, fetchWaterLog, addCommonMeal, deleteCommonMeal as deleteCommonMealFromDB, updateCommonMeal,
  saveProfileAndGoals, saveWeightLog, updateUserDocument, saveCourseProgress,
  addMentalWellbeingLog, listenForFriendRequests,
  getDocSafe, savePushSubscription, addTimelineEvent, fetchCommunityTimeline, fetchBuddyDetailsList, fetchMealLogsForDate
} from './services/firestoreService.ts';

// Context
import { useUserContext } from './context/UserContext';

import { JourneyView } from './components/JourneyView.tsx';
import InfoModal from './components/InfoModal.tsx';
import UserProfileModal, { Avatar } from './components/UserProfileModal.tsx';
import ToastNotification from './components/ToastNotification.tsx';
import ConfettiCelebration from './components/ConfettiCelebration.tsx';
import LevelUpModal from './components/LevelUpModal.tsx';
import GoalMetModal from './components/GoalMetModal.tsx';
import CourseOverview from './components/course/CourseOverview.tsx';
import LessonDetail from './components/course/LessonDetail.tsx';
import { courseLessons, menopauseCourseLessons } from './courseData.ts';
import NewLessonUnlockedModal from './components/course/NewLessonUnlockedModal.tsx';
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

import { calculateRecommendations } from './utils/nutritionalCalculations.ts';
import { calculateGoalTimeline } from './utils/timelineUtils.ts';
import { getWeekInfo, getDateUID } from './utils/dateUtils.ts';
import { initAudio, playAudio } from './services/audioService.ts';
import {
  InformationCircleIcon, AICoachIcon, PencilIcon,
  ChatBubbleOvalLeftEllipsisIcon, BellIcon, InstallIcon, LifebuoyIcon, ArrowRightOnRectangleIcon, SwitchHorizontalIcon
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
        {/* Content trimmed for brevity, logic preserved */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center">
            {modalIcon}
            <h2 id="ai-feedback-modal-title" className="text-2xl font-semibold text-neutral-dark">
              {modalTitle}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"><div className="w-6 h-6">X</div></button>
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
                  <p>{feedbackMessage}</p>
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


export const App = () => {
  // Use Context instead of local hooks
  const {
    currentUser, authLoading, persistenceWarning, logout, setCurrentUser, // Auth
    currentDate, setCurrentDate, // Date from context
    goals, setGoals,
    userProfile, setUserProfile,
    setDailyLog, setWaterLoggedMl,
    pastDaysSummary, setPastDaysSummary,
    streakData, setStreakData,
    setWeeklyBank,
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
    weightLogs, setWeightLogs,
    isDataLoading,
    isInitialDataLoaded,
    resetUserData,
  } = useUserContext();

  // Local UI State
  const [viewingDate, setViewingDate] = useState<Date>(() => new Date()); 
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [currentInterface, setCurrentInterface] = useState<'member' | 'coach'>('member');
  
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [splashEffect, setSplashEffect] = useState<{ x: number, y: number, count: number, id: number } | null>(null);
  
  // Modal States
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState<boolean>(false);
  const [isProfileModalOnboarding, setIsProfileModalOnboarding] = useState(false);
  
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
        return () => { unsubscribeRequests(); };
    } else {
        setPendingRequestsCount(0);
    }
  }, [currentUser, userStatus]);

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

  const minSafeCalories = useMemo(() => {
    const goalBasedMin = goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
    return Math.max(goalBasedMin, MIN_ABSOLUTE_CALORIES_THRESHOLD);
  }, [goals.calorieGoal]);

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
    // Trigger FAB click in dashboard? Not possible directly from here without ref or context.
    // But Dashboard state is local now. This is a tricky one with the refactor.
    // Ideally Dashboard uses a context/prop trigger, or we just switch view.
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
        const userUpdatePayload: Partial<FirestoreUserDocument> = {
            streakSaver: newStreakSaverState,
            currentStreak: newStreak,
            lastDateStreakChecked: dayToSave.date,
            role: userRole as UserRole,
            status: userStatus as "pending" | "approved"
        };
        if (newHighestStreak > highestStreak) {
            userUpdatePayload.highestStreak = newHighestStreak;
        }
        batch.update(userRef, userUpdatePayload as any);

        await batch.commit();

    } catch (error) {
        handleFirestoreError(error, 'använda streakräddare');
        // Rollback
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
    const isAnyModalOpen = showUserProfileModal || showInfoModal || showLevelUpModal || showGoalMetModalData || newlyUnlockedLesson || showAIFeedbackModal || showLogWeightModal || showMentalWellbeingModal || showOnboardingCompletion || !!newlyUnlockedLesson || !!dayToPotentiallySave || !!showMotivationModal || showIosInstallPrompt || showOnboardingRewardModal || showAICoachModal || showLatestUpdateView;
    
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
  }, [showUserProfileModal, showInfoModal, showLevelUpModal, showGoalMetModalData, newlyUnlockedLesson, showAIFeedbackModal, showLogWeightModal, showMentalWellbeingModal, showOnboardingCompletion, newlyUnlockedLesson, dayToPotentiallySave, showMotivationModal, showIosInstallPrompt, showOnboardingRewardModal, showAICoachModal, showLatestUpdateView]);
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [viewMode, currentLessonId]);

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
    // Re-implement getUserLevelInfo locally as it was in the original file or assume it works
    const currentLevel = LEVEL_DEFINITIONS.slice().reverse().find(l => streakData.currentStreak >= l.requiredStreak) || LEVEL_DEFINITIONS[0];

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


  const handleSaveProfileAndGoals = async (profileData: UserProfileData, newGoals: GoalSettings, newPhotoDataUrl?: string | null) => {
    if (!currentUser) return;

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
            if (measurementMethod === 'inbody' && goalStartFatMassKg && desiredFatMassChangeKg) return `Minskade ${Math.abs(desiredFatMassChangeKg).toFixed(1)} kg fettmassa`;
            return `Gick ner ${Math.abs(parseFloat(weightChange))} kg`;
        }
        if (goalType === 'gain_muscle') {
             if (measurementMethod === 'inbody' && goalStartMuscleMassKg && desiredMuscleMassChangeKg) return `Ökade ${Math.abs(desiredMuscleMassChangeKg).toFixed(1)} kg muskelmassa`;
            return `Gick upp ${Math.abs(parseFloat(weightChange))} kg`;
        }
        return `Nådde sitt mål att bibehålla vikten`;
    };

    const handleSaveWeightLog = async (data: Omit<WeightLogEntry, 'id'>) => {
        if (!currentUser) return;
        const sanitizedDataForFirestore = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
        try {
            const newDocId = await saveWeightLog(currentUser.uid, sanitizedDataForFirestore as Omit<WeightLogEntry, 'id'>);
            const newWeightLogEntry: WeightLogEntry = { id: newDocId, ...data };
            
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
                todayTotals: { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }, // Not relevant for goal feedback
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

  const handleCloseOnboardingRewardModal = () => {
      setShowOnboardingRewardModal(false);
      const currentState = getLocalStorageItem<OnboardingChecklistState | null>(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, null);
      if (currentState) {
          const newState = { ...currentState, dismissed: true };
          setLocalStorageItem(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, newState);
      }
      setChecklistState(null);
  };

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
                setToastNotification={setToastNotification}
                onOnboardingNavigate={handleOnboardingNavigate}
                viewingDate={viewingDate}
                onDateSelect={(date) => {
                    handleNavigateToMainWithDate(date);
                    setViewingDate(date);
                }}
                checklistState={checklistState}
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
        
        <input type="file" id="imageUploadInputMain" className="hidden" accept="image/*" onChange={() => {}} />
        <input type="file" id="ingredientUploadInput" className="hidden" accept="image/*" multiple onChange={() => {}} />

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
      </div>
      
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
                    <button onClick={() => setShowInstallBanner(false)} className="p-2 text-sm text-neutral hover:bg-neutral-light/70 rounded-md">Senare</button>
                    <button onClick={() => { installPromptEvent?.prompt(); setShowInstallBanner(false); }} className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-md shadow-sm">Installera</button>
                </div>
            </div>
        </div>
      )}
      {showIosInstallPrompt && <IosInstallPrompt onClose={() => setShowIosInstallPrompt(false)} />}
    </>
  );
};