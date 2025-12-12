
import React, { useState, useEffect, useCallback, useMemo, useRef, JSX } from 'react';
import { db } from './firebase';
import {
  doc, writeBatch, deleteField, collection, getDocFromServer, runTransaction,
  where, updateDoc, getDoc
} from "@firebase/firestore";

import CoachDashboard from './components/CoachDashboard';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import SplashScreen from './components/SplashScreen';
import { CoursesView, CourseInfo, ALL_COURSES } from './components/CoursesView.tsx';

import {
  AppStatus, PastDaySummary, ViewMode,
  UserProfileData, 
  Level, WeeklyCalorieBank, CourseLesson, UserLessonProgress,
  AIDataForFeedback, FirestoreUserDocument, WeightLogEntry, MentalWellbeingLog,
  AIDataForJourneyAnalysis, AIStructuredFeedbackResponse, 
  CompletedGoal, TimelineEvent, BuddyDetails, OnboardingChecklistState,
  OnboardingChecklistItemStatus,
  UserRole,
  GoalType,
  GoalSettings,
  LoggedMeal
} from './types.ts';

import {
  DEFAULT_GOALS, LOCAL_STORAGE_KEYS, DEFAULT_WATER_GOAL_ML,
  DEFAULT_USER_PROFILE, LEVEL_DEFINITIONS, MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD,
  ACHIEVEMENT_DEFINITIONS, VAPID_PUBLIC_KEY
} from './constants.ts';

import { getAIFeedback, getDetailedJourneyAnalysis } from './services/geminiService.ts';

import {
  setWaterLog, fetchWaterLog,
  saveProfileAndGoals, saveWeightLog, updateUserDocument, saveCourseProgress,
  addMentalWellbeingLog, listenForFriendRequests,
  getDocSafe, savePushSubscription, addTimelineEvent, fetchCommunityTimeline, fetchBuddyDetailsList, fetchMealLogsForDate
} from './services/firestoreService.ts';

// Context
import { useUserContext } from './context/UserContext';

import LoadingSpinner from './components/LoadingSpinner.tsx';
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
import MorningReportModal from './components/MorningReportModal.tsx';

import { calculateRecommendations } from './utils/nutritionalCalculations.ts';
import { calculateGoalTimeline } from './utils/timelineUtils.ts';
import { getWeekInfo, getDateUID } from './utils/dateUtils.ts';
import { initAudio, playAudio } from './services/audioService.ts';
import {
  InformationCircleIcon, AICoachIcon,
  PencilIcon,
  ChatBubbleOvalLeftEllipsisIcon, BellIcon, InstallIcon, LifebuoyIcon, ArrowRightOnRectangleIcon, SwitchHorizontalIcon, SparklesIcon
} from './components/icons.tsx';
import { Home, Footprints, Users, GraduationCap } from "lucide-react";
import Dashboard from './pages/Dashboard';
import { OnboardingChecklist } from './components/OnboardingChecklist';
import { CommonMeal } from './types.ts';

/* ===========================
   Start of Daily Summary Helpers
   =========================== */

const TZ = "Europe/Stockholm";
const startOfDaySE = (d: Date) => {
  const z = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  return new Date(z.getFullYear(), z.getMonth(), z.getDate());
};
const dayKeySE = (d: Date) => {
    const z = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
    const year = z.getFullYear();
    const month = String(z.getMonth() + 1).padStart(2, '0');
    const day = String(z.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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
      const surplus = 300; // Simplified const
      const tdeeFloor = calorieGoalValue > surplus ? calorieGoalValue - surplus : 0;
      return consumedCalories >= tdeeFloor;
    }
    default: {
      const tenPercentDefault = calorieGoalValue * 0.10;
      return Math.abs(consumedCalories - calorieGoalValue) <= tenPercentDefault;
    }
  }
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
        {/* ... Content omitted for brevity, assume same modal structure ... */}
        <div className="min-h-[100px] flex-grow overflow-y-auto custom-scrollbar">
            {/* ... feedback display logic ... */}
            {feedbackMessage && !isLoading && !error && (
                 <div className="space-y-6">
                    {/* Simple render for feedback */}
                    {typeof feedbackMessage === 'string' ? feedbackMessage : feedbackMessage.greeting}
                 </div>
            )}
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <button onClick={onClose} className="w-full px-5 py-3 text-lg font-medium text-white bg-primary rounded-md">Stäng</button>
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
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white p-6 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-neutral-dark mb-3">Ny Dag!</h2>
                <p>Idag är en ny chans!</p>
                <button onClick={onClose} className="w-full mt-4 px-5 py-3 bg-primary text-white rounded-md">Kör!</button>
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
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={onClose}>
             <div className="bg-white p-6 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in text-center" onClick={(e) => e.stopPropagation()}>
                <LifebuoyIcon className="w-16 h-16 text-secondary mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-neutral-dark mb-3">Rädda streak?</h2>
                <div className="flex gap-3 mt-4">
                    <button onClick={onClose} className="flex-1 px-4 py-2 bg-neutral-light rounded-md">Nej</button>
                    <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-primary text-white rounded-md">Ja</button>
                </div>
            </div>
        </div>
    );
};

export const App = () => {
  const {
    currentUser, authLoading, persistenceWarning, logout, setCurrentUser,
    currentDate, setCurrentDate,
    goals, setGoals,
    userProfile, setUserProfile,
    setDailyLog,
    setWaterLoggedMl,
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
    resetUserData,
  } = useUserContext();

  // Local UI State
  const [viewingDate, setViewingDate] = useState<Date>(() => new Date()); 
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [currentInterface, setCurrentInterface] = useState<'member' | 'coach'>('member');
  
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [splashEffect, setSplashEffect] = useState<{ x: number, y: number, count: number, id: number } | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
  
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState<boolean>(false);
  const [isProfileModalOnboarding, setIsProfileModalOnboarding] = useState(false);

  const [journeyInitialTab, setJourneyInitialTab] = useState<'calendar' | 'profile' | 'achievements'>('calendar');

  const [lastNotifiedStreakLevelUp, setLastNotifiedStreakLevelUp] = useState<string | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState<Level | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGoalMetModalData, setShowGoalMetModalData] = useState<{date: string; streak: number} | null>(null);
  const [dayToPotentiallySave, setDayToPotentiallySave] = useState<PastDaySummary | null>(null);
  const [showMotivationModal, setShowMotivationModal] = useState<PastDaySummary | null>(null);
  const [morningReportData, setMorningReportData] = useState<{ summary: PastDaySummary, currentStreak: number } | null>(null);
  const [isSummarizingYesterday, setIsSummarizingYesterday] = useState(false);


  const [toastNotification, setToastNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [activeCourse, setActiveCourse] = useState<CourseInfo | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [newlyUnlockedLesson, setNewlyUnlockedLesson] = useState<CourseLesson | null>(null);

  const [onboardingStep, setOnboardingStep] = useState<'form' | 'feedback'>('form');
  const [showOnboardingCompletion, setShowOnboardingCompletion] = useState<boolean>(false);
  const [showSpotlight, setShowSpotlight] = useState<boolean>(false);
  const [checklistState, setChecklistState] = useState<OnboardingChecklistState | null>(null);
  const [showOnboardingRewardModal, setShowOnboardingRewardModal] = useState(false);

  const [showAIFeedbackModal, setShowAIFeedbackModal] = useState<boolean>(false);
  const [aiFeedbackMessage, setAIFeedbackMessage] = useState<AIStructuredFeedbackResponse | string | null>(null);
  const [aiFeedbackLoading, setAIFeedbackLoading] = useState<boolean>(false);
  const [aiFeedbackError, setAiFeedbackError] = useState<string | null>(null);
  const [aiModalTitle, setAiModalTitle] = useState("Din Coach");
  const [aiModalIcon, setAiModalIcon] = useState<JSX.Element>(<AICoachIcon className="w-7 h-7 text-secondary mr-2.5" />);
  const [showAICoachModal, setShowAICoachModal] = useState(false);
  const [coachInitialContext, setCoachInitialContext] = useState<{ type: 'from_analysis'; date?: string } | null>(null);
  
  const [showLogWeightModal, setShowLogWeightModal] = useState<boolean>(false);

  const [showMentalWellbeingModal, setShowMentalWellbeingModal] = useState<boolean>(false);
  const [relatedWeightLogIdForWellbeing, setRelatedWeightLogIdForWellbeing] = useState<string | null>(null);
  const [pendingGoalFeedbackData, setPendingGoalFeedbackData] = useState<{ profile: UserProfileData, goals: GoalSettings, isOnboarding: boolean } | null>(null);
  const [pendingAnalysisData, setPendingAnalysisData] = useState<{ updatedLogs: WeightLogEntry[] } | null>(null);
  
  type PendingTimelineEvent = 
    | { type: 'weight', data: { newLog: WeightLogEntry; previousLog: WeightLogEntry | null } }
    | { type: 'goal_set', data: { userProfile: UserProfileData } }
    | { type: 'goal_achieved', data: { newLog: WeightLogEntry; goalDescription: string } };

  const [pendingTimelineEvent, setPendingTimelineEvent] = useState<PendingTimelineEvent | null>(null);
  
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

  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosInstallPrompt, setShowIosInstallPrompt] = useState(false);

  const [showLatestUpdateView, setShowLatestUpdateView] = useState(false);
  const [hasUnseenUpdate, setHasUnseenUpdate] = useState(false);

  const formattedViewingDate = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    let s = viewingDate.toLocaleDateString('sv-SE', opts);
    // Ta bort punkter som kan finnas i kortformat (t.ex. "tis.") och gör första bokstaven stor
    s = s.replace(/\./g, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [viewingDate]);

  const minSafeCalories = useMemo(() => {
    const goalBasedMin = goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
    return Math.max(goalBasedMin, MIN_ABSOLUTE_CALORIES_THRESHOLD);
  }, [goals.calorieGoal]);

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
            setToastNotification({ message: 'Kunde inte ladda dagens data.', type: 'error'});
            setTimeout(() => setToastNotification(null), 4000);
        } finally {
            setAppStatus(AppStatus.IDLE);
        }
    }, [setDailyLog, setWaterLoggedMl]);

    useEffect(() => {
        if (currentUser && isInitialDataLoaded && userStatus === 'approved') {
            loadDataForDate(currentUser.uid, viewingDate);
        }
    }, [currentUser, viewingDate, isInitialDataLoaded, loadDataForDate, userStatus]);

     useEffect(() => {
        if (isInitialDataLoaded && currentUser && userRole === 'member' && !hasCompletedOnboarding && userStatus === 'approved') {
             if (!showUserProfileModal) {
                 setShowUserProfileModal(true);
                 setIsProfileModalOnboarding(true);
                 setOnboardingStep('form');
             }
        }
    }, [isInitialDataLoaded, currentUser, hasCompletedOnboarding, userRole, userStatus, showUserProfileModal]);


    useEffect(() => {
        setViewingDate(new Date(currentDate));
    }, [currentDate]);


const handleSubscribeToPush = async (): Promise<boolean> => {
    if (!currentUser || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return false;
    }
    try {
        const registration = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return false;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        await savePushSubscription(currentUser.uid, JSON.parse(JSON.stringify(subscription)));
        setToastNotification({ message: 'Pushnotiser aktiverade!', type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);
        return true;
    } catch (error) {
        console.error('Failed to subscribe push:', error);
        return false;
    }
  };
  
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.message === 'push-received-in-foreground') {
        const { title, body } = event.data.notification;
        setToastNotification({ message: body ? `${title}: ${body}` : title, type: 'success' });
        playAudio('logSuccess', 0.8);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => { navigator.serviceWorker.removeEventListener('message', handleMessage); };
  }, []); 

  const handleFirestoreError = (error: any, operation: string) => {
    console.error(`Firestore error during ${operation}:`, error);
    setToastNotification({ message: `Kunde inte ${operation}.`, type: 'error' });
    setTimeout(() => setToastNotification(null), 5000);
  };

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
            const filteredEvents = events.filter(event => event.userId === currentUser.uid || details.some(b => b.uid === event.userId));
            setTimelineEvents(filteredEvents);
            setBuddyDetails(details);

            const lastViewed = getLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_COMMUNITY_VIEW_TIMESTAMP, null);
            if (lastViewed && viewMode !== 'community') {
               // Logic to calculate notification count
            }
        } catch (error) {
            console.error("Error loading community data", error);
        } finally {
            setIsLoadingCommunityData(false);
        }
    }, [currentUser, viewMode]);

    useEffect(() => {
        if (currentUser && isInitialDataLoaded && userStatus === 'approved') {
            loadCommunityData();
        }
    }, [currentUser, isInitialDataLoaded, userStatus, loadCommunityData]);

    useEffect(() => {
        const previousViewMode = previousViewModeRef.current;
        if (viewMode === 'community' && previousViewMode !== 'community') {
            const lastTimestamp = getLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_COMMUNITY_VIEW_TIMESTAMP, null);
            setLastCommunityViewTimestamp(lastTimestamp);
            setCommunityNotificationCount(0); 
            setLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_COMMUNITY_VIEW_TIMESTAMP, Date.now());
        }
        previousViewModeRef.current = viewMode;
    }, [viewMode]);

    useEffect(() => {
        if (viewMode !== 'community') {
            setCommunityInitialTab('flode');
            setCommunityInitialSubTab('buddies');
        }
    }, [viewMode]);

  useEffect(() => {
    if (isInitialDataLoaded && currentUser) {
        const UPDATE_NOTICE_KEY = 'updateNotice_v5_StreakUpdate'; 
        try {
            const noticeShown = localStorage.getItem(UPDATE_NOTICE_KEY);
            if (!noticeShown) setHasUnseenUpdate(true);
        } catch (error) {}
    }
  }, [isInitialDataLoaded, currentUser]);

  const handleViewLatestUpdate = () => {
    setShowLatestUpdateView(true);
    setShowProfileDropdown(false);
    playAudio('uiClick');
    if (hasUnseenUpdate) {
        localStorage.setItem('updateNotice_v5_StreakUpdate', 'true');
        setHasUnseenUpdate(false);
    }
  };

  const handleNavigateToCourses = () => {
    setViewMode('coursesView');
    setShowLatestUpdateView(false);
  };

  const handleLogout = async () => {
    playAudio('uiClick');
    setShowProfileDropdown(false);
    try {
      await logout();
      resetUserData();
    } catch (error) {
      setToastNotification({ message: "Utloggning misslyckades.", type: 'error' });
    }
  };

  const toggleInterfaceView = () => {
    playAudio('uiClick');
    setShowProfileDropdown(false);
    setCurrentInterface(prev => prev === 'member' ? 'coach' : 'member');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [profileDropdownRef]);


  const handleSaveProfileAndGoals = async (profileData: UserProfileData, newGoals: GoalSettings, newPhotoDataUrl?: string | null) => {
    if (!currentUser) return;
    setAppStatus(AppStatus.SAVING);
    try {
        await saveProfileAndGoals(currentUser.uid, profileData, newGoals);
        setUserProfile(profileData);
        setGoals(newGoals);
        setShowUserProfileModal(false);
        setToastNotification({ message: "Profil sparad!", type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);
    } catch (error: any) {
       handleFirestoreError(error, 'spara profil');
    } finally {
        setAppStatus(AppStatus.IDLE);
    }
  };

const handleCloseUserProfileModal = () => {
    setShowUserProfileModal(false);
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

// --- WEEKLY BANK RESET CHECK ---
const ensureWeeklyBankReset = useCallback(async () => {
    if (!currentUser || !isInitialDataLoaded) return;

    const currentWeekInfo = getWeekInfo(currentDate);

    // If the bank's week ID doesn't match the current date's week ID
    if (weeklyBank.weekId !== currentWeekInfo.weekId) {
        console.log(`Detected new week (${currentWeekInfo.weekId}). Resetting calorie bank.`);
        
        const newBank: WeeklyCalorieBank = {
            weekId: currentWeekInfo.weekId,
            bankedCalories: 0,
            startDate: currentWeekInfo.startDate,
            endDate: currentWeekInfo.endDate
        };

        // Optimistic update
        setWeeklyBank(newBank);

        try {
            await updateUserDocument(currentUser.uid, { weeklyBank: newBank });
        } catch (error) {
            console.error("Error resetting weekly bank:", error);
        }
    }
}, [currentUser, isInitialDataLoaded, currentDate, weeklyBank, setWeeklyBank]);

useEffect(() => {
    ensureWeeklyBankReset();
}, [ensureWeeklyBankReset]);
// -------------------------------

const ensureYesterdayProcessed = useCallback(async (uid: string, now = new Date(), options: ProcessDayEndLogicOptions = {}, manualLogOverride?: LoggedMeal[]): Promise<{ summary: PastDaySummary | null; streakData: { currentStreak: number; lastDateStreakChecked: string | null }; weeklyBank: WeeklyCalorieBank; highestStreak: number; } | void> => {
  setIsSummarizingYesterday(true); // Start spinner
  setAppStatus(AppStatus.PROCESSING_DAY_END);
  try {
    const { start, end, yKey } = yesterdayRangeSE(now);
    const userRef = doc(db, "users", uid);
    
    const dayBeforeDate = new Date(start);
    dayBeforeDate.setDate(dayBeforeDate.getDate() - 1);
    const dayBeforeKey = dayKeySE(dayBeforeDate);

    const userSnap = await getDocFromServer(userRef).catch(() => null);
    if (!userSnap?.exists()) return;

    const userData = userSnap.data() as FirestoreUserDocument;
    const { lastDateStreakChecked, summaryStartDate, hasCompletedOnboarding } = userData;
    
    if (!hasCompletedOnboarding) return;
    if (summaryStartDate && yKey < summaryStartDate) {
      await updateUserDocument(uid, { lastDateStreakChecked: yKey, role: userRole, status: userStatus });
      return;
    }

    let shouldProcess = true;
    if (lastDateStreakChecked && lastDateStreakChecked >= yKey && !options.force && !manualLogOverride) {
         const summaryRef = doc(db, "users", uid, "pastDaySummaries", yKey);
         const summarySnap = await getDoc(summaryRef);
         if (summarySnap.exists()) {
             shouldProcess = false; 
         }
    }
    
    if (manualLogOverride) {
        shouldProcess = true;
    }

    if (!shouldProcess) return;

    let dailyLogForDate: LoggedMeal[];
    if (manualLogOverride) {
        dailyLogForDate = manualLogOverride;
    } else {
        dailyLogForDate = await fetchMealLogsForDate(uid, yKey);
    }
    
    const localGoals = userData.goals || DEFAULT_GOALS;
    const localProfile = { ...DEFAULT_USER_PROFILE, ...userData } as UserProfileData;
    const waterLogForDate = await fetchWaterLog(uid, yKey);

    const totalNutrientsForDay = dailyLogForDate.reduce(
      (acc, meal) => {
        acc.calories += meal.nutritionalInfo.calories;
        return acc;
      },
      { calories: 0 }
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

    let resultData: any = null;
    await runTransaction(db, async (tx) => {
        const userDocTx = await tx.get(userRef);
        if (!userDocTx.exists()) return;
        const userDataTx = userDocTx.data() as FirestoreUserDocument;
        const currentStreakFromDb = userDataTx.currentStreak || 0;
        const lastChecked = userDataTx.lastDateStreakChecked;

        const currentDaySummaryRef = doc(db, "users", uid, "pastDaySummaries", yKey);
        const currentDaySummarySnap = await tx.get(currentDaySummaryRef);
        const prevSummaryData = currentDaySummarySnap.exists() ? currentDaySummarySnap.data() as PastDaySummary : null;

        const prevDaySummaryRef = doc(db, "users", uid, "pastDaySummaries", dayBeforeKey);
        const prevDaySnap = await tx.get(prevDaySummaryRef);
        let recoveredStreak = 0;
        if (prevDaySnap.exists()) {
            const prevSummary = prevDaySnap.data() as PastDaySummary;
            recoveredStreak = prevSummary.streakForThisDay || 0;
        }
        
        let nextStreak = currentStreakFromDb;
        
        if (habitMetForStreak) {
             if (currentStreakFromDb === 0) {
                 if (recoveredStreak > 0) {
                    nextStreak = recoveredStreak + 1;
                 } else {
                    nextStreak = 1;
                 }
             } else {
                 if (lastChecked === yKey) {
                     nextStreak = currentStreakFromDb;
                 } else {
                     nextStreak = currentStreakFromDb + 1;
                 }
             }
        } else {
            nextStreak = 0;
        }

        const newHighestStreak = Math.max(userDataTx.highestStreak || 0, nextStreak);

        let newWeeklyBank = { ...userDataTx.weeklyBank };
        const processedDayWeekInfo = getWeekInfo(new Date(yKey)); 

        if (processedDayWeekInfo.weekId !== newWeeklyBank.weekId) {
            newWeeklyBank = {
                weekId: processedDayWeekInfo.weekId,
                bankedCalories: 0,
                startDate: processedDayWeekInfo.startDate,
                endDate: processedDayWeekInfo.endDate
            };
        }

        if (prevSummaryData && prevSummaryData.bankedAmount) {
             if (processedDayWeekInfo.weekId === newWeeklyBank.weekId) {
                 newWeeklyBank.bankedCalories = Math.max(0, newWeeklyBank.bankedCalories - prevSummaryData.bankedAmount);
             }
        }

        let bankedAmountThisDay = 0;
        if (goalMetForCalendar && effectiveCaloriesConsumed < localGoals.calorieGoal) {
            bankedAmountThisDay = Math.floor(localGoals.calorieGoal - effectiveCaloriesConsumed);
        }

        if (bankedAmountThisDay > 0) {
            newWeeklyBank.bankedCalories += bankedAmountThisDay;
        }

        const summaryForThisDay: PastDaySummary = {
            date: yKey,
            goalMet: goalMetForCalendar,
            consumedCalories: totalNutrientsForDay.calories,
            calorieGoal: localGoals.calorieGoal,
            proteinGoalMet: false, 
            consumedProtein: 0,
            proteinGoal: localGoals.proteinGoal,
            consumedCarbohydrates: 0,
            carbohydrateGoal: localGoals.carbohydrateGoal,
            consumedFat: 0,
            fatGoal: localGoals.fatGoal,
            goalType: localProfile.goalType,
            waterGoalMet: waterLogForDate >= DEFAULT_WATER_GOAL_ML,
            streakForThisDay: nextStreak,
            bankedAmount: bankedAmountThisDay,
        };
      
        const sumRef = doc(db, "users", uid, "pastDaySummaries", yKey);
        tx.set(sumRef, summaryForThisDay, { merge: true });
        tx.update(userRef, {
            currentStreak: nextStreak,
            lastDateStreakChecked: yKey,
            highestStreak: newHighestStreak,
            weeklyBank: newWeeklyBank,
        });
        resultData = { summary: summaryForThisDay, streakData: { currentStreak: nextStreak, lastDateStreakChecked: yKey }, weeklyBank: newWeeklyBank, highestStreak: newHighestStreak };
    });
    
    // Direct state update to ensure UI reflects the summary immediately without waiting for fetch/reload
    if (resultData && resultData.summary) {
        setPastDaysSummary(prev => ({ ...prev, [yKey]: resultData.summary }));
    }

    return resultData;

} catch (err) {
  console.error("Error during daily summary processing:", err);
} finally {
  setAppStatus(AppStatus.IDLE);
  setIsSummarizingYesterday(false); // Stop spinner
}
}, [currentUser?.uid, userRole, userStatus, setPastDaysSummary]);

    useEffect(() => {
        if (!currentUser?.uid || !isInitialDataLoaded) return;
        const onWake = async () => {
            const result = await ensureYesterdayProcessed(currentUser.uid).catch(console.error);
            // DETTA ÄR FIXEN: Om funktionen returnerar en summering (vilket betyder att den kördes "på riktigt" nu),
            // visa Morgonrapporten.
            if (result && result.summary) {
                setMorningReportData({ summary: result.summary, currentStreak: result.streakData.currentStreak });
            }
        };
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

  
  useEffect(() => {
    initAudio();
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => { window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt); };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    setInstallPromptEvent(null);
    setShowInstallBanner(false);
  };
  
  const handleDismissInstallBanner = () => setShowInstallBanner(false);
  const handleCloseIosInstallPrompt = () => {
    setShowIosInstallPrompt(false);
    localStorage.setItem('iosInstallPromptDismissed', 'true');
  };

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'community') {
    setViewMode('community');
    if (params.get('tab') === 'requests') setCommunityInitialSubTab('requests');
    if (params.get('highlight')) setHighlightEventId(params.get('highlight'));
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);

    // Onboarding Logic
    const handleCloseOnboardingRewardModal = () => {
        setShowOnboardingRewardModal(false);
        setLocalStorageItem(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, { ...checklistState, dismissed: true });
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
            // Bonus logic would go here
            setShowConfetti(true);
            playAudio('levelUp');
            setShowOnboardingRewardModal(true);
        }
    }, [checklistState, currentUser, isInitialDataLoaded]);

    useEffect(() => {
        if (!currentUser || !isInitialDataLoaded || !hasCompletedOnboarding) {
          setChecklistState(null);
          return;
        }
        const storedState = getLocalStorageItem<OnboardingChecklistState | null>(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, null);
        if (storedState && !storedState.dismissed) {
             setChecklistState(storedState);
        } else {
            setChecklistState(null);
        }
    }, [isInitialDataLoaded, hasCompletedOnboarding, currentUser]);

    const handleOnboardingNavigate = (view: 'journey' | 'community', subView?: 'search') => {
        if (view === 'community') {
             // Logic to set tabs if needed
        } else { 
            setJourneyInitialTab('calendar');
        }
        setViewMode(view);
    };

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
  
  const handleNavigateToCourse = (courseId: CourseInfo['id']) => {
    const course = ALL_COURSES.find(c => c.id === courseId);
    if (course) {
        setActiveCourse(course);
        setViewMode('courseOverview');
        playAudio('uiClick');
    }
  };

  const handleCloseLessonDetail = () => {
    setViewMode('courseOverview');
    setCurrentLessonId(null);
  };

  const handleSelectLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
    setViewMode('lessonDetail');
  };


  const handleMarkLessonComplete = async (lessonId: string) => {
     // Logic handled inside LessonDetail mostly, just UI update here via context
  };

  // --- Course CTA Handlers ---
  const handleOpenSpeedDial = () => {
    setViewMode('main'); 
  };

  const handleNavigateToJourney = (tab: 'calendar' | 'profile' | 'achievements') => {
    setJourneyInitialTab(tab);
    setViewMode('journey');
  };

  const handleOpenLogWeightModal = () => {
    // When called from Journey view (which uses the inline function), viewMode stays as journey.
    // When called from LessonDetail (which uses handleOpenLogWeightModal helper), it switches to main.
    // For direct access, we just open the modal.
    openModal(setShowLogWeightModal);
  };
  
  const handleDiscussSavedAnalysis = (analysisDate?: string) => {
    setCoachInitialContext({ type: 'from_analysis', date: analysisDate });
    setShowAICoachModal(true);
  };

  const handleNavigateToMainWithDate = (date: Date) => {
    setViewingDate(date);
    setViewMode('main');
  };

  const handleUseStreakSaver = async () => {
      // Logic moved to Dashboard or handled here? 
      // This logic updates user doc, so it fits here or in a service. 
      // Keeping simple for now.
      setDayToPotentiallySave(null);
  };

  const handleSaveWeightLog = async (data: Omit<WeightLogEntry, 'id'>) => {
    if (!currentUser) return;
    setAppStatus(AppStatus.SAVING); // Show loading spinner or similar
    try {
        const newId = await saveWeightLog(currentUser.uid, data);
        
        // Update context state to reflect change immediately
        const newEntry: WeightLogEntry = { ...data, id: newId };
        setWeightLogs(prev => [...prev, newEntry].sort((a, b) => a.loggedAt - b.loggedAt));
        
        setToastNotification({ message: "Vikt sparad!", type: 'success' });
        playAudio('logSuccess');
        setShowLogWeightModal(false);
    } catch (error) {
        console.error("Error saving weight:", error);
        setToastNotification({ message: "Kunde inte spara vikt.", type: 'error' });
        // Throw error so the modal knows it failed (if it handles it), otherwise just notify
    } finally {
        setAppStatus(AppStatus.IDLE);
    }
  };

  const handleSaveWellbeingAndProceed = async (data: MentalWellbeingData) => {
      setShowMentalWellbeingModal(false);
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
    
  const navItems = [
    { key: 'main', label: 'Startsida', Icon: Home, isActive: viewMode === 'main', onClick: () => { setViewMode('main'); setCurrentLessonId(null); } },
    { key: 'journey', label: 'Min resa', Icon: Footprints, isActive: viewMode === 'journey', onClick: () => { setJourneyInitialTab('calendar'); setViewMode('journey'); } },
    { key: 'course', label: 'Kurs', Icon: GraduationCap, isActive: viewMode === 'coursesView' || viewMode === 'courseOverview' || viewMode === 'lessonDetail', onClick: () => { setViewMode('coursesView');} },
    { key: 'community', label: 'Community', Icon: Users, isActive: viewMode === 'community', onClick: () => { setViewMode('community'); }, notificationCount: pendingRequestsCount + communityNotificationCount },
  ];

  const lessonsForOverview = activeCourse?.id === 'maxa-klimakteriet' ? menopauseCourseLessons : courseLessons;
  const lessonsForDetail = activeCourse?.id === 'maxa-klimakteriet' ? menopauseCourseLessons : courseLessons;
  const currentLesson = lessonsForDetail.find(l => l.id === currentLessonId);

  return (
    <>
      <div className="min-h-screen bg-neutral-light bg-dotted-pattern bg-dotted-size bg-fixed flex flex-col items-center pb-4">
       <header className="w-full bg-white text-neutral-dark p-4 shadow-lg sticky top-0 z-30">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('main')}>
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
                                <item.Icon color="#3bab5a" size={24} strokeWidth={1.5} />
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
                            onClick={() => setShowProfileDropdown(prev => !prev)}
                        >
                             <div className="icon-wrap p-0 relative">
                                <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={32} />
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
                showSpotlight={showSpotlight}
                onDismissSpotlight={handleDismissSpotlight}
                isInstallBannerVisible={showInstallBanner || showIosInstallPrompt}
                viewingDate={viewingDate}
                onDateSelect={handleNavigateToMainWithDate}
                formattedViewingDate={formattedViewingDate}
                ensureYesterdayProcessed={ensureYesterdayProcessed}
                setToastNotification={setToastNotification}
                onOpenAICoach={() => { setShowAICoachModal(true); setCoachInitialContext(null); }}
                isSummarizingYesterday={isSummarizingYesterday} // Pass prop
            />
         )}
         {viewMode === 'journey' && (
            <JourneyView 
                pastDaysData={pastDaysSummary} 
                weightLogs={weightLogs}
                userProfile={userProfile}
                goals={goals}
                onSaveProfileAndGoals={handleSaveProfileAndGoals}
                onOpenLogWeightModal={handleOpenLogWeightModal} // Use consistent handler
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
                analysisContext={null as any} // Pass null or handle properly if needed
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
                onToggleFocusPoint={() => {}}
                onSaveReflection={async () => {}}
                onMarkComplete={handleMarkLessonComplete}
                onClose={handleCloseLessonDetail}
                onOpenSpeedDial={handleOpenSpeedDial}
                onNavigateToJourney={handleNavigateToJourney}
                onSaveWhyAnswer={async () => {}}
                onSaveSmartGoalAnswer={async () => {}}
                userProfile={userProfile}
                weightLogs={weightLogs}
                pastDaysSummary={Object.values(pastDaysSummary)}
                onOpenLogWeightModal={handleOpenLogWeightModal} // Can use the same helper
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
        
        {/* Global Modals */}
        {showLatestUpdateView && <UpdateNoticeModal show={showLatestUpdateView} onClose={() => setShowLatestUpdateView(false)} onNavigateToCourses={handleNavigateToCourses} />}
        {showOnboardingRewardModal && <OnboardingRewardModal show={showOnboardingRewardModal} onClose={handleCloseOnboardingRewardModal} />}
        {dayToPotentiallySave && <UseStreakSaverModal show={!!dayToPotentiallySave} onClose={() => setDayToPotentiallySave(null)} onConfirm={handleUseStreakSaver} daySummary={dayToPotentiallySave} />}
        {showMotivationModal && <MotivationModal show={!!showMotivationModal} onClose={() => setShowMotivationModal(null)} daySummary={showMotivationModal} />}
        {morningReportData && <MorningReportModal show={!!morningReportData} onClose={() => setMorningReportData(null)} summary={morningReportData.summary} currentStreak={morningReportData.currentStreak} />}
        {showInfoModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => closeModal(setShowInfoModal)}><InfoModal onClose={() => closeModal(setShowInfoModal)} userName={userProfile.name} /></div>}
        {showUserProfileModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={handleCloseUserProfileModal}><div onClick={e => e.stopPropagation()} className="animate-scale-in"><UserProfileModal initialProfile={userProfile} onSave={handleSaveProfileAndGoals} onClose={handleCloseUserProfileModal} isOnboarding={isProfileModalOnboarding} onboardingStep={onboardingStep} aiFeedbackLoading={aiFeedbackLoading} aiFeedbackMessage={aiFeedbackMessage} aiFeedbackError={aiFeedbackError} onSubscribeToPush={handleSubscribeToPush} /></div></div>}
        {showOnboardingCompletion && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={handleFinishOnboarding}><div onClick={e => e.stopPropagation()} className="animate-scale-in"><OnboardingCompletionScreen onFinish={handleFinishOnboarding} /></div></div>}
        {showLevelUpModal && <LevelUpModal level={showLevelUpModal} onClose={() => setShowLevelUpModal(null)} />}
        {showGoalMetModalData && <GoalMetModal data={showGoalMetModalData} onClose={() => setShowGoalMetModalData(null)} />}
        {newlyUnlockedLesson && <NewLessonUnlockedModal lessonTitle={newlyUnlockedLesson.title} onClose={() => setNewlyUnlockedLesson(null)} />}
        {showAIFeedbackModal && <AIFeedbackModal show={showAIFeedbackModal} onClose={() => { if (isProfileModalOnboarding) { handleFinishOnboarding(); } else { setShowAIFeedbackModal(false); } }} feedbackMessage={aiFeedbackMessage} isLoading={aiFeedbackLoading} error={aiFeedbackError} modalTitle={aiModalTitle} modalIcon={aiModalIcon} isOnboardingContext={isProfileModalOnboarding} showDiscussButton={aiModalTitle === "Analys av din mätning"} onDiscuss={() => { playAudio('uiClick'); setShowAIFeedbackModal(false); setCoachInitialContext({ type: 'from_analysis' }); setViewMode('journey'); setShowAICoachModal(true); }} />}
        {showLogWeightModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => closeModal(setShowLogWeightModal)}><LogWeightModal show={showLogWeightModal} onClose={() => closeModal(setShowLogWeightModal)} onSave={handleSaveWeightLog} /></div>}
        {showMentalWellbeingModal && <MentalWellbeingModal show={showMentalWellbeingModal} onClose={() => setShowMentalWellbeingModal(false)} onSave={handleSaveWellbeingAndProceed} />}
        {journeyAnalysisFeedback && <AICoachModal show={showAICoachModal} onClose={() => { setShowAICoachModal(false); setCoachInitialContext(null); }} analysisContext={{ userProfile, goals, allWeightLogs: weightLogs, last30DaysSummaries: Object.values(pastDaysSummary), mentalWellbeingLogs, goalTimeline: calculateGoalTimeline(userProfile), currentStreak: streakData.currentStreak }} initialContext={coachInitialContext} />}

      </div>
      {(appStatus === AppStatus.ANALYZING || appStatus === AppStatus.ANALYZING_INGREDIENTS || appStatus === AppStatus.SAVING) && (
        <LoadingSpinner message={appStatus === AppStatus.ANALYZING ? "Analyserar bild..." : appStatus === AppStatus.ANALYZING_INGREDIENTS ? "Hittar recept från dina bilder..." : "Sparar..."} />
      )}
      {splashEffect && <WaterSplashEffect key={splashEffect.id} x={splashEffect.x} y={splashEffect.y} count={splashEffect.count} onComplete={() => setSplashEffect(null)} />}
      {toastNotification && <ToastNotification message={toastNotification.message} type={toastNotification.type} onClose={() => setToastNotification(null)} />}
      {showConfetti && <ConfettiCelebration isActive={showConfetti} />}
       {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-50 animate-slide-up-fade-in">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <InstallIcon className="w-12 h-12 text-primary flex-shrink-0" />
                    <div>
                        <h3 className="font-bold text-neutral-dark">Installera Kostloggen</h3>
                        <p className="text-sm text-neutral">Få en bättre upplevelse genom att lägga till appen på din hemskärm.</p>
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
