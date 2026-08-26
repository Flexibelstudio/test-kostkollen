
import React, { useState, useEffect, useCallback, useMemo, useRef, JSX } from 'react';
import { db } from './firebase';
import {
  doc, writeBatch, increment
} from "@firebase/firestore";

import CoachDashboard from './components/CoachDashboard';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import ArchivedUserScreen from './components/ArchivedUserScreen';
import SplashScreen from './components/SplashScreen';
import { CoursesView, CourseInfo, ALL_COURSES } from './components/CoursesView.tsx';

import {
  AppStatus, PastDaySummary, ViewMode,
  UserProfileData, 
  Level, WeeklyCalorieBank, CourseLesson, UserLessonProgress,
  WeightLogEntry,
  AIStructuredFeedbackResponse, 
  TimelineEvent, BuddyDetails, OnboardingChecklistState,
  OnboardingChecklistItemStatus,
  UserRole,
  GoalSettings,
  LoggedMeal,
  PastDaysSummaryCollection,
  CoachStyle
} from './types.ts';

import {
  DEFAULT_GOALS, LOCAL_STORAGE_KEYS, DEFAULT_WATER_GOAL_ML,
  DEFAULT_USER_PROFILE, LEVEL_DEFINITIONS, MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL,
  ACHIEVEMENT_DEFINITIONS, COACH_PERSONAS, VAPID_PUBLIC_KEY
} from './constants.ts';

import { getAIFeedback as getAIFeedbackService } from './services/geminiService.ts';

import {
  fetchWaterLog,
  saveProfileAndGoals, saveWeightLog, updateUserDocument, saveCourseProgress,
  listenForFriendRequests,
  fetchCommunityTimeline, fetchBuddyDetailsList, fetchMealLogsForDate, listenToCommunityTimeline,
  setPastDaySummary, savePushSubscription, unlockAchievement, fetchTotalMealsCount
} from './services/firestoreService.ts';

import { subscribeToUserChats } from './services/chatService.ts';
import { listenToUserChallenges, syncUserChallengeStatus, getDateUID_SE } from './services/challengeService.ts';
import { sumMealNutrients } from './utils/nutritionTotals.ts';

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
import GamificationModal from './components/GamificationModal.tsx';
import SubscriptionModal from './components/SubscriptionModal.tsx';
import { TrialRecapModal } from './components/TrialRecapModal.tsx';
import { BootcampFinaleModal } from './components/BootcampFinaleModal.tsx';
import { BootcampGraduationModal } from './components/BootcampGraduationModal.tsx';
import { BootcampDiplomaModal } from './components/BootcampDiplomaModal.tsx';
import { BOOTCAMP_RANKS, BootcampRankDef } from './utils/bootcampUtils.ts';

import { calculateGoalTimeline } from './utils/timelineUtils.ts';
import { getWeekInfo, getDateUID } from './utils/dateUtils.ts';
import { initAudio, playAudio } from './services/audioService.ts';
import { uploadImageToStorage, uploadBase64ToStorage, base64ToBlob } from './utils/storageUtils';
import { getUserActiveBootcamp, subscribeToUserActiveBootcamp, getEveningReportForDate, subscribeToUserEveningReports, getUnseenBootcampFinale, markBootcampFinaleAsSeen } from './services/bootcampService.ts';
import { completeBootcampOnboardingTask, grantBootcampAccess, startBootcampCheckout, startSubscriptionCheckout, recordBootcampGraduation } from './services/bootcampAccessService.ts';
import { isTestingToolAllowed } from './utils/testingToolHostnames.ts';
import { hasAppAccess, isReadOnlyUser, getBootcampAccessDetails } from './utils/accessControl.ts';
import AccessGateView from './components/AccessGateView.tsx';
import {
  InformationCircleIcon, AICoachIcon,
  PencilIcon,
  BellIcon, InstallIcon, LifebuoyIcon, ArrowRightOnRectangleIcon, SwitchHorizontalIcon, SparklesIcon, TrophyIcon, CreditCardIcon, UserPlusIcon
} from './components/icons.tsx';
import { shareAppInvite } from './utils/shareUtils';
import { Home, Footprints, Users, GraduationCap } from "lucide-react";
import Dashboard from './pages/Dashboard';
import {
  initAppHistory,
  pushViewState,
  replaceViewState,
  pushModalState,
  closeModalState,
  subscribeToHistory
} from './utils/navigationHistory';

/* ===========================
   Daily Summary Helpers
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
  const end = today;
  return { start, end, yKey: dayKeySE(start) };
};

const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

const setLocalStorageItem = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {}
};

// Hjälpfunktion för att konvertera VAPID-nyckel
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
  
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
  
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

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
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-feedback-modal-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-2xl animate-scale-in flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-light/70 flex-shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-primary-50 p-2.5 rounded-xl">
                    {modalIcon}
                </div>
                <h3 id="ai-feedback-modal-title" className="text-2xl font-bold text-neutral-dark">{modalTitle}</h3>
            </div>
        </div>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary mb-4"></div>
                    <p className="text-neutral font-medium">Coachen tänker...</p>
                </div>
            ) : error ? (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
                    <p className="font-bold mb-1">Ett fel uppstod</p>
                    <p>{error}</p>
                </div>
            ) : feedbackMessage ? (
                 <div className="space-y-4">
                    {typeof feedbackMessage === 'string' ? (
                        <p className="text-neutral-dark leading-relaxed whitespace-pre-wrap">{feedbackMessage}</p>
                    ) : (
                        <>
                            <p className="text-lg font-medium text-neutral-dark mb-4">{feedbackMessage.greeting}</p>
                            <div className="space-y-4">
                                {feedbackMessage.sections.map((section, idx) => (
                                    <div key={idx} className="bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                                        <h4 className="font-bold text-neutral-dark mb-2 flex items-center gap-2">
                                            <span className="text-xl">{section.emoji}</span>
                                            {section.title}
                                        </h4>
                                        <p className="text-neutral-dark text-sm leading-relaxed whitespace-pre-wrap">{section.content}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                 </div>
            ) : null}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 flex-shrink-0 pt-4 border-t border-neutral-light/70">
            {showDiscussButton && (
                <button 
                    onClick={onDiscuss} 
                    className="flex-1 px-5 py-3 text-lg font-medium text-white bg-[#D96E4A] hover:bg-[#C05A38] rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <SparklesIcon className="w-5 h-5" /> Diskutera med Coach
                </button>
            )}
            <button 
                onClick={onClose} 
                className={`flex-1 px-5 py-3 text-lg font-medium rounded-xl shadow-md active:scale-95 transition-all ${showDiscussButton ? 'bg-neutral-light text-neutral-dark hover:bg-gray-200' : 'bg-primary text-white hover:bg-primary-darker'}`}
            >
                {isOnboardingContext ? 'Fortsätt' : 'Stäng'}
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
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-fade-in" onClick={onClose}>
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
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-fade-in" onClick={onClose}>
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
    currentUser, authLoading, logout, setCurrentUser,
    currentDate,
    goals, setGoals,
    userProfile, setUserProfile,
    setDailyLog,
    setWaterLoggedMl,
    weightLogs, setWeightLogs,
    pastDaysSummary, setPastDaysSummary,
    streakData, setStreakData,
    summaryStartDate, setSummaryStartDate,
    weeklyBank, setWeeklyBank,
    streakSaver,
    highestStreak,
    setHighestStreak,
    highestLevelId,
    setHighestLevelId,
    unlockedAchievements,
    setUnlockedAchievements,
    achievementInteractions,
    userCourseProgress, setUserCourseProgress,
    hasCompletedOnboarding, setHasCompletedOnboarding,
    userRole,
    userStatus,
    mentalWellbeingLogs,
    isDataLoading,
    isInitialDataLoaded,
    resetUserData,
    refreshUserData,
    simulatedUserStatus,
    setSimulatedUserStatus,
    simulatedSubscriptionStatus,
    setSimulatedSubscriptionStatus,
  } = useUserContext();

  // Local UI State
  const [viewingDate, setViewingDate] = useState<Date>(() => new Date()); 
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [openBootcampDirectly, setOpenBootcampDirectly] = useState(false);
  const [isBootcampViewActive, setIsBootcampViewActive] = useState(false);
  const [currentInterface, setCurrentInterface] = useState<'member' | 'coach'| 'admin'>('member');
  
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Appen kör alltid ljust läge – säkerställ att klassen dark aldrig sätts och rensa eventuellt tema i localStorage
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try {
      localStorage.removeItem('theme');
    } catch (e) {
      // ignore
    }
  }, []);

  // Initial history setup & popstate subscription
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    let initView: ViewMode = 'main';
    let initJourneyTab: 'calendar' | 'profile' | 'achievements' | undefined;
    let initCommunityTab: 'flode' | 'hantera' | 'chatt' | undefined;
    let initCommunitySubTab: 'buddies' | 'search' | 'requests' | undefined;

    if (viewParam === 'community') {
      initView = 'community';
      const tabParam = params.get('tab');
      if (tabParam === 'requests') {
        initCommunityTab = 'hantera';
        initCommunitySubTab = 'requests';
      } else {
        initCommunityTab = 'flode';
      }
    } else if (viewParam === 'chat') {
      initView = 'community';
      initCommunityTab = 'chatt';
    } else if (params.get('payment_success') === 'true' || window.location.pathname.endsWith('/success')) {
      initView = 'coursesView';
    }

    initAppHistory({
      view: initView,
      journeyTab: initJourneyTab,
      communityTab: initCommunityTab,
      communitySubTab: initCommunitySubTab
    });

    const unsubscribe = subscribeToHistory((historyState) => {
      if (historyState.view) {
        setViewMode(historyState.view);
      }
      if (historyState.journeyTab) {
        setJourneyInitialTab(historyState.journeyTab);
      }
      if (historyState.communityTab) {
        setCommunityInitialTab(historyState.communityTab);
      }
      if (historyState.communitySubTab) {
        setCommunityInitialSubTab(historyState.communitySubTab);
      }
      if (historyState.courseId) {
        const found = ALL_COURSES.find(c => c.id === historyState.courseId) || null;
        setActiveCourse(found);
      } else if (historyState.view !== 'courseOverview' && historyState.view !== 'lessonDetail') {
        setActiveCourse(null);
      }
      if (historyState.lessonId) {
        setCurrentLessonId(historyState.lessonId);
      } else if (historyState.view !== 'lessonDetail') {
        setCurrentLessonId(null);
      }
      setPreviewCourseId((historyState.previewCourseId as CourseInfo['id'] | undefined) || null);

      // Sync Modals
      setShowAICoachModal(historyState.modal === 'aiCoach');
      setShowUserProfileModal(historyState.modal === 'userProfile');
      setShowLogWeightModal(historyState.modal === 'logWeight');
      setShowSubscriptionModal(historyState.modal === 'subscription');
      setShowGraduationModal(historyState.modal === 'bootcampGraduation');
      setShowFinaleModal(historyState.modal === 'bootcampFinale');
      setShowTrialRecapModal(historyState.modal === 'trialRecap');
      setShowInfoModal(historyState.modal === 'info');
      setShowGamificationModal(historyState.modal === 'gamification');
      setShowMentalWellbeingModal(historyState.modal === 'mentalWellbeing');
      setShowLatestUpdateView(historyState.modal === 'latestUpdate');
      setShowOnboardingRewardModal(historyState.modal === 'onboardingReward');
      setShowAIFeedbackModal(historyState.modal === 'aiFeedback');

      if (historyState.modal !== 'levelUp') setShowLevelUpModal(null);
      if (historyState.modal !== 'goalMet') setShowGoalMetModalData(null);
      if (historyState.modal !== 'motivation') setShowMotivationModal(null);
      if (historyState.modal !== 'streakSaver') setDayToPotentiallySave(null);
      if (historyState.modal !== 'morningReport') setMorningReportData(null);
      if (historyState.modal !== 'diploma') setPromotionDiplomaModalData(null);
      if (historyState.modal !== 'newLessonUnlocked') setNewlyUnlockedLesson(null);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleOpenLogWeightModal = () => {
      pushModalState('logWeight');
      setShowLogWeightModal(true);
    };
    window.addEventListener('open-log-weight-modal', handleOpenLogWeightModal);
    return () => window.removeEventListener('open-log-weight-modal', handleOpenLogWeightModal);
  }, []);

  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [splashEffect, setSplashEffect] = useState<{ x: number, y: number, count: number, id: number } | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [unseenFinale, setUnseenFinale] = useState<any>(null);
  const [showFinaleModal, setShowFinaleModal] = useState(false);
  const [showGraduationModal, setShowGraduationModal] = useState(false);
  const [promotionDiplomaModalData, setPromotionDiplomaModalData] = useState<{
    rankDef: BootcampRankDef;
    userName: string;
    streakDays: number;
  } | null>(null);
  
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState<boolean>(false);
  const [isProfileModalOnboarding, setIsProfileModalOnboarding] = useState(false);
  const [showGamificationModal, setShowGamificationModal] = useState(false); 
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showTrialRecapModal, setShowTrialRecapModal] = useState(false);
  const [totalMealsCount, setTotalMealsCount] = useState<number>(0);

  const [journeyInitialTab, setJourneyInitialTab] = useState<'calendar' | 'profile' | 'achievements'>('calendar');

  const [showLevelUpModal, setShowLevelUpModal] = useState<Level | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGoalMetModalData, setShowGoalMetModalData] = useState<{date: string; description: string} | null>(null);
  const [dayToPotentiallySave, setDayToPotentiallySave] = useState<PastDaySummary | null>(null);
  const [showMotivationModal, setShowMotivationModal] = useState<PastDaySummary | null>(null);
  const [morningReportData, setMorningReportData] = useState<{ summary: PastDaySummary, currentStreak: number, yesterdayMeals?: LoggedMeal[], yesterdayBootcampReport?: any } | null>(null);
  const [activeBootcamp, setActiveBootcamp] = useState<any | null>(null);
  const [isBootcampLoading, setIsBootcampLoading] = useState(true);
  const [recentBootcampReports, setRecentBootcampReports] = useState<any[]>([]);
  const [isSummarizingYesterday, setIsSummarizingYesterday] = useState(false);
  const [hasRunCatchUp, setHasRunCatchUp] = useState(false);

  // Refs to store latest state for use in async callbacks (like the catch-up loop)
  const pastDaysSummaryRef = useRef(pastDaysSummary);
  const streakDataRef = useRef(streakData);
  const weeklyBankRef = useRef(weeklyBank);
  // Läses inne i fördröjda anrop efter Stripe-återkomsten, där closuren annars
  // skulle se en gammal profil.
  const userProfileRef = useRef(userProfile);
  useEffect(() => { userProfileRef.current = userProfile; }, [userProfile]);

  useEffect(() => { pastDaysSummaryRef.current = pastDaysSummary; }, [pastDaysSummary]);
  useEffect(() => { streakDataRef.current = streakData; }, [streakData]);
  useEffect(() => { weeklyBankRef.current = weeklyBank; }, [weeklyBank]);


  const [toastNotification, setToastNotification] = useState<{message: string, type: 'success' | 'error' | 'info', onClick?: () => void} | null>(null);
  
  const [activeCourse, setActiveCourse] = useState<CourseInfo | null>(null);
  // Förhandsvisning av en låst kurs: lektion 1 i läsläge, ingenting sparas.
  const [previewCourseId, setPreviewCourseId] = useState<CourseInfo['id'] | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [newlyUnlockedLesson, setNewlyUnlockedLesson] = useState<CourseLesson | null>(null);

  const [onboardingStep, setOnboardingStep] = useState<'form' | 'feedback' | 'invite'>('form');
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
  
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [communityViewKey] = useState(Date.now());
  const [communityInitialTab, setCommunityInitialTab] = useState<'flode' | 'hantera' | 'chatt'>('flode');
  const [communityInitialSubTab, setCommunityInitialSubTab] = useState<'buddies' | 'search' | 'requests'>('buddies');
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null);
  const [initialChatId, setInitialChatId] = useState<string | null>(null);
  const [initialPostText, setInitialPostText] = useState<string | null>(null);
  const [lastCommunityViewTimestamp, setLastCommunityViewTimestamp] = useState<number | null>(null);
  const previousViewModeRef = useRef<ViewMode>(viewMode);
  const lastSeenMessageTimestamps = useRef<Record<string, number>>({});
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [buddyDetails, setBuddyDetails] = useState<BuddyDetails[]>([]);
  const [isLoadingCommunityData, setIsLoadingCommunityData] = useState(true);

  const newEventsCount = useMemo(() => {
    if (!currentUser || !timelineEvents) return 0;
    if (viewMode === 'community') return 0;
    const lastTimestamp = getLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_COMMUNITY_VIEW_TIMESTAMP, 0);
    let count = 0;
    timelineEvents.forEach(event => {
        if (event.userId !== currentUser.uid && event.timestamp > lastTimestamp) count++;
    });
    return count;
  }, [timelineEvents, currentUser, viewMode]);

  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosInstallPrompt, setShowIosInstallPrompt] = useState(false);

  const [showLatestUpdateView, setShowLatestUpdateView] = useState(false);
  const [hasUnseenUpdate, setHasUnseenUpdate] = useState(false);

  const formattedViewingDate = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    let s = viewingDate.toLocaleDateString('sv-SE', opts);
    s = s.replace(/\./g, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [viewingDate]);

  const minSafeCalories = useMemo(() => {
    return (goals.calorieGoal || 2000) * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
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
            setToastNotification({ message: 'Kunde inte ladda dagens data.', type: 'error' });
        } finally {
            setAppStatus(AppStatus.IDLE);
        }
    }, [setDailyLog, setWaterLoggedMl, setToastNotification]);

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

    // Lesson Unlock Logic
    useEffect(() => {
        // FIX: Removed userRole === 'coach' check to allow coaches to test course progression
        if (!currentUser || !isInitialDataLoaded || userStatus !== 'approved') return;

        const checkAndUnlockLessons = async () => {
            if (!db) return;
            const batch = writeBatch(db);
            let hasUnlockedAny = false;

            // 1. Praktisk Viktkontroll (Streak-baserad)
            const pvLessons = courseLessons;
            let lastStreakAtUnlock = 0;
            let lastUnlockedIdx = -1;

            // Initialize baseline from Lesson 1 (which must be unlocked to start)
            if (userCourseProgress[pvLessons[0].id]?.unlockedAt) {
                lastUnlockedIdx = 0;
                lastStreakAtUnlock = userCourseProgress[pvLessons[0].id].streakAtUnlock ?? 0;
            }

            // Start checking from Lesson 2 (index 1)
            for (let i = 1; i < pvLessons.length; i++) {
                const lessonId = pvLessons[i].id;
                const prog = userCourseProgress[lessonId];
                if (prog?.unlockedAt) {
                    lastUnlockedIdx = i;
                    lastStreakAtUnlock = prog.streakAtUnlock ?? 0;
                } else {
                    const prevWasUnlocked = lastUnlockedIdx === i - 1;
                    const streakTarget = lastStreakAtUnlock + 7;

                    if (prevWasUnlocked && streakData.currentStreak >= streakTarget) {
                        const newProg: UserLessonProgress = {
                            unlockedAt: Date.now(),
                            streakAtUnlock: streakData.currentStreak,
                            completedFocusPoints: [],
                            isCompleted: false,
                            reflectionAnswer: ''
                        };
                        const ref = doc(db, 'users', currentUser.uid, 'courseProgress', lessonId);
                        batch.set(ref, newProg, { merge: true });
                        
                        setUserCourseProgress(prev => ({ ...prev, [lessonId]: newProg }));
                        setNewlyUnlockedLesson(pvLessons[i]);
                        hasUnlockedAny = true;
                        playAudio('levelUp');
                        break; 
                    }
                    break; 
                }
            }

            // 2. Maxa Klimakteriet (Tidsbaserad - Veckovis)
            const mkLessons = menopauseCourseLessons;
            const firstMkLessonProg = userCourseProgress[mkLessons[0].id];
            
            // Vi behöver veta när kursen startade (unlockedAt för första lektionen)
            if (firstMkLessonProg?.unlockedAt) {
                const activatedAt = firstMkLessonProg.unlockedAt;
                const now = Date.now();
                const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

                for (let i = 1; i < mkLessons.length; i++) {
                    const lessonId = mkLessons[i].id;
                    const prog = userCourseProgress[lessonId];
                    
                    if (!prog?.unlockedAt) {
                        // Denna lektion är låst. Kolla om det gått tillräckligt många veckor.
                        const weeksRequired = i; // Lektion 2 (index 1) kräver 1 vecka osv.
                        const timeElapsed = now - activatedAt;

                        if (timeElapsed >= (weeksRequired * oneWeekMs)) {
                            const newProg: UserLessonProgress = {
                                unlockedAt: now,
                                completedFocusPoints: [],
                                isCompleted: false,
                                reflectionAnswer: ''
                            };
                            const ref = doc(db, 'users', currentUser.uid, 'courseProgress', lessonId);
                            batch.set(ref, newProg, { merge: true });
                            
                            setUserCourseProgress(prev => ({ ...prev, [lessonId]: newProg }));
                            setNewlyUnlockedLesson(mkLessons[i]);
                            hasUnlockedAny = true;
                            playAudio('levelUp');
                            // Fortsätt inte loopen i samma körning för att inte låsa upp allt på en gång om de varit borta länge
                            break;
                        }
                        // Om vi når en låst lektion som inte är redo, stanna.
                        break;
                    }
                }
            }

            if (hasUnlockedAny) {
                try {
                    await batch.commit();
                } catch (e) {}
            }
        };

        checkAndUnlockLessons();
    }, [isInitialDataLoaded, currentUser, streakData.currentStreak, userCourseProgress, userRole, userStatus, setUserCourseProgress]);

    // 18:00 Challenge Food Logging Reminder Effect
    useEffect(() => {
        if (!currentUser || userProfile?.notificationSettings?.foodReminder === false) return;

        const check1800ChallengeReminder = async () => {
            const now = new Date();
            if (now.getHours() < 18) return; // Only trigger at or after 18:00 local time

            const todayStr = getDateUID_SE(now);
            const storageKey = `challenge_reminder_notified_${currentUser.uid}_${todayStr}`;
            if (localStorage.getItem(storageKey)) return; // Already notified today

            // Check if user has logged food today
            const summary = pastDaysSummary[todayStr];
            const hasLoggedToday = summary && (summary.consumedCalories > 0 || summary.goalMet);

            if (hasLoggedToday) return; // User already logged food today!

            const unsubscribe = listenToUserChallenges(currentUser.uid, (challenges) => {
                const activeChallenge = challenges.find(c => c.status === 'active' && c.participantUids.includes(currentUser.uid) && !c.participants?.[currentUser.uid]?.leftAt);
                if (activeChallenge) {
                    localStorage.setItem(storageKey, 'true');
                    setToastNotification({
                        message: 'Glöm inte att logga din mat idag i 7-dagarsutmaningen!',
                        type: 'info'
                    });

                    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                        try {
                            new Notification('Peppkompis Utmaning 🏆', {
                                body: 'En liten påminnelse: glöm inte att logga maten idag för att hålla sviten i er 7-dagarsutmaning!',
                                icon: '/favicon.ico'
                            });
                        } catch (e) {}
                    }
                }
            });

            return () => unsubscribe();
        };

        check1800ChallengeReminder();
        const interval = setInterval(check1800ChallengeReminder, 5 * 60 * 1000); // Check every 5 mins
        return () => clearInterval(interval);
    }, [currentUser, userProfile?.notificationSettings?.foodReminder, pastDaysSummary]);

    // Auto-sync challenge status when food is logged
    useEffect(() => {
        if (!currentUser) return;
        const todayStr = getDateUID_SE(new Date());
        const summary = pastDaysSummary[todayStr];
        const hasLoggedToday = summary && (summary.consumedCalories > 0 || summary.goalMet);

        if (hasLoggedToday) {
            const unsubscribe = listenToUserChallenges(currentUser.uid, (challenges) => {
                const activeChallenges = challenges.filter(c => c.status === 'active' && c.participantUids.includes(currentUser.uid));
                if (activeChallenges.length > 0) {
                    syncUserChallengeStatus(currentUser.uid, activeChallenges, [todayStr]);
                }
            });
            return () => unsubscribe();
        }
    }, [currentUser, pastDaysSummary]);


    useEffect(() => {
        setViewingDate(new Date(currentDate));
    }, [currentDate]);


const handleSubscribeToPush = async (force: boolean = false): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notiser stöds inte i denna webbläsare.');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        
        // Kontrollera om en existerande subscription finns
        let subscription = await registration.pushManager.getSubscription();
        
        if (subscription && force) {
            try {
                await subscription.unsubscribe();
            } catch (unsubError) {
                console.warn('Kunde inte avregistrera tidigare push-prenumeration:', unsubError);
            }
            subscription = null;
        }
        
        if (!subscription) {
            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
        }

        if (currentUser && subscription) {
            // Spara till Firestore
            await savePushSubscription(currentUser.uid, subscription.toJSON());
            return true;
        }
        return false;
    } catch (error) {
        console.error('Kunde inte aktivera push-notiser:', error);
        return false;
    }
  };
  
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.message === 'push-received-in-foreground') {
        const { title, body } = event.data.notification;
        
        // Don't show toast if we are in the community view (which includes chat)
        // to prevent it from getting in the way while typing.
        if (previousViewModeRef.current === 'community') {
            return;
        }
        
        setToastNotification({ message: body ? `${title}: ${body}` : title, type: 'success' });
        playAudio('logSuccess', 0.8);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => { navigator.serviceWorker.removeEventListener('message', handleMessage); };
  }, []); 

  const handleFirestoreError = (error: any, operation: string) => {
    // Utan den här raden syns felet ingenstans - användaren fick en röd ruta
    // och konsolen var tom, vilket gjorde det omöjligt att felsöka.
    console.error(`Firestore-fel vid "${operation}":`, error?.code, error?.message, error);
    setToastNotification({ message: `Kunde inte ${operation}.`, type: 'error' });
    setTimeout(() => setToastNotification(null), 5000);
  };

  useEffect(() => {
    if (currentUser && userStatus === 'approved') {
        const unsubscribeRequests = listenForFriendRequests(currentUser.uid, (requests) => {
            setPendingRequestsCount(requests.length);
        });
        
        const unsubscribeChats = subscribeToUserChats(currentUser.uid, (chats) => {
            let unreadCount = 0;
            chats.forEach(chat => {
                const mySettings = chat.memberSettings?.[currentUser.uid];
                const lastRead = mySettings?.lastReadTimestamp || 0;
                const isMuted = mySettings?.notificationLevel === 'mute';

                if (chat.lastMessage && chat.lastMessage.timestamp > lastRead && chat.lastMessage.senderId !== currentUser.uid) {
                    unreadCount++;
                    
                    const prevTimestamp = lastSeenMessageTimestamps.current[chat.id] || 0;
                    if (chat.lastMessage.timestamp > prevTimestamp && !isMuted) {
                        // Show toast if we are not in the community view
                        if (previousViewModeRef.current !== 'community') {
                            setToastNotification({ 
                                message: `Nytt meddelande från ${chat.lastMessage.senderName || 'någon'} i ${chat.name || 'Gruppchatt'}`, 
                                type: 'info',
                                onClick: () => {
                                    setCommunityInitialTab('chatt');
                                    setViewMode('community');
                                }
                            });
                            playAudio('logSuccess');
                        }
                    }
                }
                
                if (chat.lastMessage) {
                    lastSeenMessageTimestamps.current[chat.id] = chat.lastMessage.timestamp;
                }
            });
            setUnreadChatsCount(unreadCount);
        });

        return () => { 
            unsubscribeRequests(); 
            unsubscribeChats();
        };
    } else {
        setPendingRequestsCount(0);
        setUnreadChatsCount(0);
    }
  }, [currentUser, userStatus]);


    const loadCommunityData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoadingCommunityData(true);
        try {
            const details = await fetchBuddyDetailsList(currentUser.uid);
            setBuddyDetails(details);
        } catch (error) {
            console.error("Failed to load community data:", error);
            setToastNotification({ message: "Kunde inte ladda flödet. Kontrollera din anslutning.", type: 'error' });
        } finally {
            setIsLoadingCommunityData(false);
        }
    }, [currentUser, setToastNotification]);

    useEffect(() => {
        if (currentUser && isInitialDataLoaded && userStatus === 'approved' && !isBootcampLoading) {
            loadCommunityData();
        }
    }, [currentUser, isInitialDataLoaded, userStatus, loadCommunityData, isBootcampLoading]);

    const previousTimelineEventsRef = useRef<TimelineEvent[]>([]);

    useEffect(() => {
        if (!currentUser || userStatus !== 'approved') return;
        
        const unsubscribe = listenToCommunityTimeline(
            currentUser.uid,
            ({ events }) => {
                let filteredEvents = events;
                
                // Användare som inte är 'coach' eller 'admin' (dvs standardmedlemmar) ser endast inlägg efter registrering.
                const userRoleValue = userProfile?.role || 'member';
                const isCoachOrAdmin = userRoleValue === 'coach' || userRoleValue === 'admin';
                if (!isCoachOrAdmin) {
                    const registrationTime = (() => {
                        if (userProfile && userProfile.createdAt) {
                            if (typeof (userProfile.createdAt as any).toDate === 'function') {
                                return (userProfile.createdAt as any).toDate().getTime();
                            }
                            if (typeof (userProfile.createdAt as any).toMillis === 'function') {
                                return (userProfile.createdAt as any).toMillis();
                            }
                            if ((userProfile.createdAt as any).seconds) {
                                return (userProfile.createdAt as any).seconds * 1000;
                            }
                            const t = new Date(userProfile.createdAt as any).getTime();
                            if (!isNaN(t)) return t;
                        }
                        if (currentUser && currentUser.metadata && currentUser.metadata.creationTime) {
                            const t = new Date(currentUser.metadata.creationTime).getTime();
                            if (!isNaN(t)) return t;
                        }
                        return 0;
                    })();
                    
                    if (registrationTime > 0) {
                        // Vi filtrerar bort gamla inlägg och sparar de som skapades vid eller efter registreringen (minus 1 min marginal)
                        filteredEvents = events.filter(event => event.timestamp >= (registrationTime - 60000));
                    }
                }
                
                setTimelineEvents(filteredEvents);
                
                // Check for new events to show a toast
                if (previousTimelineEventsRef.current.length > 0 && filteredEvents.length > 0) {
                    const newestEvent = filteredEvents[0];
                    const previousNewestEvent = previousTimelineEventsRef.current[0];
                    
                    if (newestEvent.id !== previousNewestEvent?.id && 
                        newestEvent.userId !== currentUser.uid && 
                        newestEvent.timestamp > (previousNewestEvent?.timestamp || 0)) {
                        
                        // Only show toast if we are not currently looking at the community feed
                        if (previousViewModeRef.current !== 'community') {
                            setToastNotification({
                                message: `Nytt inlägg från ${newestEvent.userName || 'någon'} i communityt!`,
                                type: 'info',
                                onClick: () => {
                                    setHighlightEventId(newestEvent.id);
                                    setCommunityInitialTab('flode');
                                    setViewMode('community');
                                }
                            });
                            playAudio('logSuccess', 0.8);
                        }
                    }
                }
                previousTimelineEventsRef.current = filteredEvents;
            },
            20,
            activeBootcamp?.cohortId
        );
        
        return () => unsubscribe();
    }, [currentUser, userStatus, activeBootcamp?.cohortId, setToastNotification, userProfile?.role, userProfile?.createdAt]);

    useEffect(() => {
        const previousViewMode = previousViewModeRef.current;
        if (viewMode === 'community' && previousViewMode !== 'community') {
            const lastTimestamp = getLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_COMMUNITY_VIEW_TIMESTAMP, null);
            setLastCommunityViewTimestamp(lastTimestamp);
            setLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_COMMUNITY_VIEW_TIMESTAMP, Date.now());
        }
        previousViewModeRef.current = viewMode;
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

  // Trial countdown dialog loader (Dag 5-7 av provperioden, d.v.s. 1 till 3 dagar kvar)
  useEffect(() => {
    const checkAndLoadTrialRecap = async () => {
      if (!currentUser || !isInitialDataLoaded || userProfile.subscriptionStatus !== 'trialing' || !userProfile.currentPeriodEnd) return;
      
      const getTrialDaysLeftLocal = (endStr: string) => {
        const end = new Date(endStr);
        const now = new Date();
        const diffTime = end.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      };

      const daysLeft = getTrialDaysLeftLocal(userProfile.currentPeriodEnd);
      const hasSeen = localStorage.getItem(`hasSeenTrialRecapDialog_${currentUser.uid}`);
      const params = new URLSearchParams(window.location.search);
      const forceOpen = params.get('showTrialRecap') === 'true';

      // Dag 5-7 motsvarar 1-3 dagar kvar.
      if ((forceOpen || (daysLeft >= 1 && daysLeft <= 3)) && (forceOpen || hasSeen !== 'true')) {
        try {
          const count = await fetchTotalMealsCount(currentUser.uid);
          setTotalMealsCount(count);
          setShowTrialRecapModal(true);

          if (forceOpen) {
            // Städa bort parametern så den inte poppar upp igen efter stängning
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('showTrialRecap');
            window.history.replaceState({}, '', newUrl.pathname + newUrl.search);
          }
        } catch (err) {
          console.error("Error reading trial meals statistics:", err);
        }
      }
    };

    checkAndLoadTrialRecap();
  }, [isInitialDataLoaded, currentUser, userProfile.subscriptionStatus, userProfile.currentPeriodEnd]);

  // Examensflöde utlösning: När Bootcamp-perioden (accessExpiresDate) nås ska examensflödet visas en gång
  useEffect(() => {
    if (!currentUser || !isInitialDataLoaded) return;
    const access = userProfile.bootcampAccess;
    if (access && access.accessExpiresDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      const expiryStr = access.accessExpiresDate.split('T')[0];
      const isExpired = todayStr > expiryStr;
      
      if (isExpired && !access.graduationSeen) {
        setShowGraduationModal(true);
      }
    }
  }, [currentUser, isInitialDataLoaded, userProfile.bootcampAccess]);

  const isBootcampCompleted = useMemo(() => {
    return (
      (userProfile.highestBootcampStreak || 0) >= 80 ||
      streakData.currentStreak >= 80 ||
      userProfile.hasCompletedBootcamp === true ||
      activeBootcamp?.status === 'completed' ||
      (activeBootcamp?.longestStreak || 0) >= 80
    );
  }, [userProfile.highestBootcampStreak, streakData.currentStreak, userProfile.hasCompletedBootcamp, activeBootcamp]);

  const handleAcceptGraduationSubscription = async (chosenCoach: CoachStyle) => {
    if (!currentUser) return;
    try {
      const updatedAccess = await recordBootcampGraduation(currentUser.uid, userProfile.bootcampAccess, 'accepted', chosenCoach);
      setUserProfile(prev => ({
        ...prev,
        bootcampAccess: updatedAccess,
        coachStyle: chosenCoach
      }));
      setShowGraduationModal(false);

      // Starta abonnemangsbetalning via Stripe
      try {
        await startSubscriptionCheckout(currentUser.uid, chosenCoach);
      } catch (err: any) {
        setToastNotification({
          message: `Du har valt ${COACH_PERSONAS[chosenCoach]?.label || 'coach'}! Betalningsintegration är inte konfigurerad ännu.`,
          type: 'success'
        });
      }
    } catch (e: any) {
      console.error('Kunde inte spara examensval:', e);
      setToastNotification({ message: 'Ett fel uppstod vid sparande av ditt val.', type: 'error' });
    }
  };

  const handleDeclineGraduationSubscription = async (chosenCoach: CoachStyle) => {
    if (!currentUser) return;
    try {
      const updatedAccess = await recordBootcampGraduation(currentUser.uid, userProfile.bootcampAccess, 'declined', chosenCoach);
      setUserProfile(prev => ({
        ...prev,
        bootcampAccess: updatedAccess,
        coachStyle: chosenCoach
      }));
      setShowGraduationModal(false);
      setToastNotification({
        message: 'Dina resultat och din historik är sparade för alltid i läsläget.',
        type: 'success'
      });
    } catch (e: any) {
      console.error('Kunde inte spara examensval:', e);
      setShowGraduationModal(false);
    }
  };

  useEffect(() => {
      if (currentUser) {
          const unsubscribe = subscribeToUserActiveBootcamp(currentUser.uid, (bootcamp) => {
              setActiveBootcamp(bootcamp);
              setIsBootcampLoading(false);
              
              if (bootcamp && bootcamp.longestStreak > 0) {
                  setUserProfile(prev => {
                      if (!prev.highestBootcampStreak || bootcamp.longestStreak > prev.highestBootcampStreak) {
                          return { ...prev, highestBootcampStreak: bootcamp.longestStreak };
                      }
                      return prev;
                  });
              }
          });
          
          // Also check for unseen finale
          getUnseenBootcampFinale(currentUser.uid).then(finale => {
              if (finale) {
                  setUnseenFinale(finale);
                  setShowFinaleModal(true);
              }
          });
          
          return () => unsubscribe();
      } else {
          setActiveBootcamp(null);
          setIsBootcampLoading(false);
      }
  }, [currentUser]);

  useEffect(() => {
      if (currentUser && activeBootcamp) {
          const unsubscribe = subscribeToUserEveningReports(activeBootcamp.cohortId, currentUser.uid, (reports) => {
              setRecentBootcampReports(reports);
          }, activeBootcamp.fas1StartDate);
          return () => unsubscribe();
      } else {
          setRecentBootcampReports([]);
      }
  }, [currentUser, activeBootcamp]);

  // --- NEW EFFECT: Ensure Morning Report is shown if not seen today ---
  useEffect(() => {
      if (!currentUser || !isInitialDataLoaded || !hasCompletedOnboarding || !hasRunCatchUp) return;

      // Don't show if currently processing or already showing
      if (isSummarizingYesterday || morningReportData) return;

      const todayUID = dayKeySE(new Date());
      const lastSeen = localStorage.getItem('lastSeenMorningReport');

      if (lastSeen === todayUID) return;

      // Check if we have summary for yesterday
      const yesterdayUID = dayKeySE(new Date(Date.now() - 86400000));
      const summary = pastDaysSummary[yesterdayUID];

      if (summary) {
           // Use the streak stored in the summary as the truth, fallback to currentStreak if missing
           const displayStreak = (typeof summary.streakForThisDay === 'number') ? summary.streakForThisDay : streakData.currentStreak;
           
           Promise.all([
             fetchMealLogsForDate(currentUser.uid, yesterdayUID),
             activeBootcamp ? getEveningReportForDate(activeBootcamp.cohortId, currentUser.uid, yesterdayUID) : Promise.resolve(null)
           ]).then(([meals, bootcampReport]) => {
               setMorningReportData({ summary, currentStreak: displayStreak, yesterdayMeals: meals, yesterdayBootcampReport: bootcampReport });
           });
      }
  }, [currentUser, isInitialDataLoaded, hasCompletedOnboarding, hasRunCatchUp, pastDaysSummary, streakData.currentStreak, morningReportData, isSummarizingYesterday, activeBootcamp]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    
    if (viewParam === 'community') {
      setViewMode('community');
      const tabParam = params.get('tab');
      if (tabParam === 'requests') {
        setCommunityInitialTab('hantera');
        setCommunityInitialSubTab('requests');
      }
      const highlightParam = params.get('highlight');
      if (highlightParam) {
        setHighlightEventId(highlightParam);
      }
      // Fördröj städningen av URL:en så att en eventuell Service Worker-omladdning inte tappar bort parametern
      setTimeout(() => {
        window.history.replaceState(window.history.state, '', window.location.pathname);
      }, 5000);
    } else if (viewParam === 'chat') {
      setViewMode('community');
      setCommunityInitialTab('chatt');
      const chatIdParam = params.get('chatId');
      if (chatIdParam) {
        setInitialChatId(chatIdParam);
      }
      // Fördröj städningen av URL:en
      setTimeout(() => {
        window.history.replaceState(window.history.state, '', window.location.pathname);
      }, 5000);
    }
    
    // Ingen statusgrind här. Tidigare krävdes userStatus === 'approved', men nya
    // konton skapas som 'pending' - så den som faktiskt betalat hoppades över
    // och landade tillbaka på valsidan i stället för inne i appen.
    if (params.get('payment_success') === 'true' || window.location.pathname.endsWith('/success')) {
        setToastNotification({ message: "Betalning bekräftad! Välkommen in!", type: 'success' });
        
        // --- SKICKA KÖP TILL META PIXEL ---
        let checkoutType = 'subscription'; // standard fallback
        if (typeof window !== 'undefined') {
            const stored = window.sessionStorage.getItem('pending_checkout_type');
            if (stored) {
                checkoutType = stored;
                window.sessionStorage.removeItem('pending_checkout_type');
            } else if (activeBootcamp) {
                checkoutType = 'bootcamp';
            }
        }

        if (typeof window !== 'undefined') {
            if (window.location.hostname === 'app.kostloggen.se') {
                if ((window as any).fbq) {
                    if (checkoutType === 'bootcamp') {
                        (window as any).fbq('track', 'Purchase', { currency: 'SEK', value: 495.00 });
                        console.log("Meta Pixel: Skickade Purchase (495 kr) för bootcamp");
                    } else {
                        (window as any).fbq('track', 'CompleteRegistration');
                        console.log("Meta Pixel: Skickade CompleteRegistration för prenumeration");
                    }
                }
            } else {
                console.log(`[Meta Pixel Sandbox] Event skulle ha skickats i produktion (${checkoutType === 'bootcamp' ? 'Purchase: 495 kr' : 'CompleteRegistration'})`);
            }
        }
        // ----------------------------------

        // Landa på rätt ställe. Handlaren var skriven för bootcampköp och
        // slussade ALLA till kursvyn med bootcampen öppnad - även den som just
        // tecknat abonnemang, som då möttes av grundutbildningen i stället för
        // den vanliga starten.
        if (checkoutType === 'bootcamp') {
            setOpenBootcampDirectly(true);
            pushViewState({ view: 'coursesView' });
            setViewMode('coursesView');
        } else {
            setOpenBootcampDirectly(false);
            pushViewState({ view: 'main' });
            setViewMode('main');
        }

        // Webhooken skriver åtkomsten EFTER att Stripe skickat tillbaka
        // användaren, så profilen i minnet är ett ögonblick för gammal.
        //
        // refreshUserData sätter isDataLoading och ger en laddningsskärm. Körs
        // flera omläsningar parallellt fastnar appen på loggan - därför väntar
        // vi in varje anrop, och slutar så fort åtkomsten faktiskt finns.
        (async () => {
            for (const delay of [2500, 4000, 6000]) {
                await new Promise(resolve => setTimeout(resolve, delay));
                if (hasAppAccess(userProfileRef.current)) return;
                await refreshUserData();
            }
        })();

        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('payment_success');
        newUrl.searchParams.delete('session_id');
        const newPath = newUrl.pathname.endsWith('/success') ? '/' : newUrl.pathname;
        window.history.replaceState(window.history.state, '', newPath + newUrl.search);
    }
  }, [setToastNotification, activeBootcamp, refreshUserData]);

  const handleNavigateToCourses = () => {
    pushViewState({ view: 'coursesView' });
    setViewMode('coursesView');
    setShowLatestUpdateView(false);
  };

  const handleLogout = async () => {
    setShowProfileDropdown(false);
    try {
      await logout();
      resetUserData();
    } catch (error) {
      setToastNotification({ message: "Utloggning misslyckades.", type: 'error' });
    }
  };

  const toggleInterfaceView = () => {
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
    
    // Aktivera laddningsläget direkt om vi är i onboarding för att modalens knapp ska reagera
    if (isProfileModalOnboarding) {
        setAIFeedbackLoading(true);
    }

    const updatedProfile = { ...profileData };
    
    // Check if goal parameters changed to reset the timeline start date
    const goalChanged = 
        (updatedProfile.desiredWeightChangeKg != null ? updatedProfile.desiredWeightChangeKg : null) !== (userProfile.desiredWeightChangeKg != null ? userProfile.desiredWeightChangeKg : null) ||
        (updatedProfile.desiredFatMassChangeKg != null ? updatedProfile.desiredFatMassChangeKg : null) !== (userProfile.desiredFatMassChangeKg != null ? userProfile.desiredFatMassChangeKg : null) ||
        (updatedProfile.desiredMuscleMassChangeKg != null ? updatedProfile.desiredMuscleMassChangeKg : null) !== (userProfile.desiredMuscleMassChangeKg != null ? userProfile.desiredMuscleMassChangeKg : null) ||
        (updatedProfile.goalCompletionDate || null) !== (userProfile.goalCompletionDate || null);

    // If we are doing a "full goal edit" (starting a new goal explicitly), let's ensure it resets.
    // However, App.tsx doesn't receive `isFullGoalEdit` parameter natively from the JourneyProfileEditor through handleSaveProfileAndGoals.
    // Actually, JourneyProfileEditor manually resets goalStartDate: "profileToSave.goalStartDate = new Date().toISOString();" 
    // And it will trigger the start weight reset too.
    const isExplicitlyNewGoal = updatedProfile.goalStartDate !== userProfile.goalStartDate && updatedProfile.goalStartDate;

    if ((goalChanged || !updatedProfile.goalStartDate) && !isExplicitlyNewGoal) {
        updatedProfile.goalStartDate = new Date().toISOString().split('T')[0];
        updatedProfile.goalStartWeight = updatedProfile.currentWeightKg;
        updatedProfile.goalStartFatMassKg = updatedProfile.bodyFatMassKg;
        updatedProfile.goalStartMuscleMassKg = updatedProfile.skeletalMuscleMassKg;
        updatedProfile.plateauAnalysis = {
            ...(updatedProfile.plateauAnalysis || {}),
            plateauReductionCount: 0,
            lastPlateauAnalysisDate: undefined,
            measuringWeekActive: false,
            measuringWeekStartDate: undefined,
        };
    } else if (isExplicitlyNewGoal || goalChanged) {
        updatedProfile.plateauAnalysis = {
            ...(updatedProfile.plateauAnalysis || {}),
            plateauReductionCount: 0,
            lastPlateauAnalysisDate: undefined,
            measuringWeekActive: false,
            measuringWeekStartDate: undefined,
        };
    }

    // Upload image to Firebase Storage if it's a new base64 image
    if (newPhotoDataUrl && newPhotoDataUrl.startsWith('data:image')) {
        try {
            const fileName = `profile_${Date.now()}.jpg`;
            const path = `profile_images/${currentUser.uid}/${fileName}`;
            const downloadUrl = await uploadBase64ToStorage(newPhotoDataUrl, path);
            updatedProfile.photoURL = downloadUrl;
        } catch (uploadError) {
            console.error("Error uploading profile image to storage:", uploadError);
            setToastNotification({ message: 'Kunde inte ladda upp profilbilden till servern.', type: 'error' });
            setAIFeedbackLoading(false);
            return;
        }
    } else if (newPhotoDataUrl) {
        // Fallback if it's already a URL or something else
        updatedProfile.photoURL = newPhotoDataUrl;
    }

    try {
        await saveProfileAndGoals(currentUser.uid, updatedProfile, newGoals);
        // Slå ihop, ersätt inte. Profilmodalen bär inte med sig serverägda fält
        // som bootcampAccess och subscriptionStatus - ersattes hela profilen med
        // modalens kopia försvann åtkomsten ur minnet, och användaren kastades
        // tillbaka till köpsidan direkt efter att ha fyllt i profilen.
        setUserProfile(prev => ({
            ...updatedProfile,
            bootcampAccess: prev.bootcampAccess ?? updatedProfile.bootcampAccess,
            bootcampOnboarding: prev.bootcampOnboarding ?? updatedProfile.bootcampOnboarding,
            subscriptionStatus: prev.subscriptionStatus ?? updatedProfile.subscriptionStatus,
            currentPeriodEnd: prev.currentPeriodEnd ?? updatedProfile.currentPeriodEnd,
            role: prev.role ?? updatedProfile.role,
            status: prev.status ?? updatedProfile.status,
        }));
        setGoals(newGoals);

        if (isProfileModalOnboarding) {
            setOnboardingStep('feedback');
            setAppStatus(AppStatus.ANALYZING_FEEDBACK);

            try {
                const feedback = await getAIFeedbackService({
                    userName: updatedProfile.name,
                    todayTotals: { calories: 0, protein: 0, carbohydrates: 0, fat: 0 },
                    userGoals: newGoals,
                    userProfile: updatedProfile,
                    currentStreak: 0,
                    activeLesson: null,
                    isOnboarding: true,
                    mentalWellbeing: { stressLevel: null, energyLevel: null, sleepQuality: null, mood: null }
                });
                setAIFeedbackMessage(feedback);
            } catch (aiError) {
                setAiFeedbackError("Kunde inte generera feedback just nu, men din profil är sparad.");
            } finally {
                setAIFeedbackLoading(false);
            }
        } else {
            setShowUserProfileModal(false);
            setToastNotification({ message: "Profil sparad!", type: 'success' });
        }
    } catch (error: any) {
       handleFirestoreError(error, 'spara profil');
       setAIFeedbackLoading(false);
    }
  };

  const handleFinishOnboarding = async () => {
    if (!currentUser) return;
    setShowOnboardingCompletion(false);
    setShowAIFeedbackModal(false);
    setShowUserProfileModal(false); 
    setHasCompletedOnboarding(true);
    setViewMode('main'); // Sätt startsidan vid avslutat konto/onboarding
    setOpenBootcampDirectly(false); // Säkerställ att han inte slussas direkt till bootcamp-registrering
    setShowSpotlight(true);
    
    const todayUID = dayKeySE(new Date());

    const newState: OnboardingChecklistState = {
        firstSeenDate: todayUID,
        items: { mealLogged: false, waterLogged: false, journeyViewed: false, communityViewed: false },
        dismissed: false,
    };
    setChecklistState(newState);
    setLocalStorageItem(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, newState);

    try {
        // role och status skickas INTE med. Säkerhetsreglerna kräver att de är
        // oförändrade, och userStatus är numera det tolkade värdet ('pending'
        // läses som godkänt) - så skrivningen sa 'approved' medan dokumentet sa
        // 'pending' och hela uppdateringen avvisades. Följden blev en röd toast
        // och att hasCompletedOnboarding aldrig sparades, så onboardingen kom
        // tillbaka efter betalningen.
        await updateUserDocument(currentUser.uid, { 
          hasCompletedOnboarding: true,
          summaryStartDate: todayUID, // Set start date for report processing to TODAY
          lastDateStreakChecked: todayUID, // Set this to today so morning report for "yesterday" won't trigger immediately
        });
        setSummaryStartDate(todayUID);
        setStreakData(prev => ({ ...prev, lastDateStreakChecked: todayUID }));
        playAudio('levelUp');
    } catch (error) {
        handleFirestoreError(error, 'slutföra onboarding');
    }
  };

  const updateChecklistItem = useCallback((itemKey: keyof OnboardingChecklistItemStatus) => {
    setChecklistState(prevState => {
        if (!prevState || prevState.items[itemKey]) return prevState;
        const newState: OnboardingChecklistState = { 
            ...prevState, 
            items: { ...prevState.items, [itemKey]: true } 
        };
        setLocalStorageItem(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, newState);
        return newState;
    });
  }, []);

  const isGrantingOnboardingBonus = useRef(false);

  /**
   * Sparpott-bonusen ges när sista punkten bockas i, inte när belöningsmodalen
   * stängs. Navigerade man bort i stället för att trycka på krysset fick man
   * varken bonusen eller bli av med checklistan.
   *
   * Spärren ligger i användardokumentet och inte i localStorage, så bonusen inte
   * kan hämtas en gång till från en annan enhet.
   */
  const grantOnboardingBonus = useCallback(async () => {
    if (!currentUser) return;
    if (userProfile.goalType === 'gain_muscle') return;
    if (userProfile.onboardingBonusGrantedAt) return;
    if (isGrantingOnboardingBonus.current) return;

    isGrantingOnboardingBonus.current = true;
    try {
      const grantedAt = Date.now();
      const newVal = (weeklyBankRef.current?.bankedCalories || 0) + 100;
      const weekId = weeklyBankRef.current?.weekId || getWeekInfo(new Date()).weekId;
      await updateUserDocument(currentUser.uid, {
        "weeklyBank.bankedCalories": newVal,
        "weeklyBank.weekId": weekId,
        onboardingBonusGrantedAt: grantedAt
      });
      setWeeklyBank(prev => ({ ...prev, bankedCalories: newVal, weekId: prev.weekId || weekId }));
      setUserProfile(prev => ({ ...prev, onboardingBonusGrantedAt: grantedAt }));
      setToastNotification({ message: "100 kcal bonus tillagd i din sparpott!", type: 'success' });
    } catch (e) {
      console.error('Kunde inte lägga till onboarding-bonusen', e);
      isGrantingOnboardingBonus.current = false;
    }
  }, [currentUser, userProfile.goalType, userProfile.onboardingBonusGrantedAt, setToastNotification]);

  useEffect(() => {
    if (!checklistState || !currentUser || !isInitialDataLoaded) return;
    // Att bara dölja kortet räckte inte - effekten körde ändå och delade ut
    // bonusen mitt i en pågående bootcamp. Bootcampen äger onboardingen då.
    if (activeBootcamp || userProfile.bootcampAccess) return;
    const allComplete = Object.values(checklistState.items).every(Boolean);
    if (allComplete && !checklistState.dismissed) {
        setShowConfetti(true);
        playAudio('levelUp');
        setShowOnboardingRewardModal(true);
        grantOnboardingBonus();
    }
  }, [checklistState, currentUser, isInitialDataLoaded, grantOnboardingBonus, activeBootcamp, userProfile.bootcampAccess]);

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

  const handleOnboardingNavigate = (view: 'journey' | 'community') => {
    if (view === 'community') {
         updateChecklistItem('communityViewed');
         pushViewState({ view: 'community', communityTab: 'flode' });
         setCommunityInitialTab('flode');
    } else { 
        updateChecklistItem('journeyViewed');
        pushViewState({ view: 'journey', journeyTab: 'calendar' });
        setJourneyInitialTab('calendar');
    }
    setViewMode(view);
  };

  const handleDismissSpotlight = () => {
    setShowSpotlight(false);
    setLocalStorageItem(LOCAL_STORAGE_KEYS.ONBOARDING_SPOTLIGHT_SHOWN, true);
  };
    
  const closeModal = (modalSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
    modalSetter(false);
  };

  const openModal = (modalSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
    modalSetter(true);
  };

  const handleOpenInfoModal = () => {
    pushModalState('info');
    setShowInfoModal(true);
  };

  const handleCloseInfoModal = () => {
    closeModalState('info', () => setShowInfoModal(false));
  };
  
  const handleNavigateToCourse = async (courseId: CourseInfo['id']) => {
    const course = ALL_COURSES.find(c => c.id === courseId);
    if (!course || !currentUser) return;

    const firstLessonId = courseId === 'praktisk-viktkontroll' ? 'lektion1' : 'm-lektion1';
    
    // Manual activation check
    if (!userCourseProgress[firstLessonId]?.unlockedAt) {
        // För Praktisk Viktkontroll nollställer vi streakAtUnlock så användaren får credit för sin befintliga streak
        const initialStreakBaseline = courseId === 'praktisk-viktkontroll' ? 0 : streakData.currentStreak;

        const newProg: UserLessonProgress = {
            unlockedAt: Date.now(),
            streakAtUnlock: initialStreakBaseline,
            completedFocusPoints: [],
            isCompleted: false,
            reflectionAnswer: ''
        };
        
        try {
            await saveCourseProgress(currentUser.uid, firstLessonId, newProg, userRole || 'member', userStatus || 'approved');
            setUserCourseProgress(prev => ({ ...prev, [firstLessonId]: newProg }));
            setToastNotification({ message: 'Kursen är nu aktiverad!', type: 'success' });
            playAudio('levelUp');
            
            // Create a timeline event for starting the course
            try {
                const { addTimelineEvent } = await import('./services/firestoreService');
                await addTimelineEvent(currentUser.uid, {
                    type: 'course',
                    timestamp: Date.now(),
                    title: `har påbörjat kursen ${course.title}!`,
                    description: 'Nu börjar resan mot ny kunskap.',
                    icon: '🚀',
                    relatedDocId: courseId
                });
            } catch (e) {
                console.error("Failed to create course start timeline event", e);
            }
            
        } catch (e) {
            console.error("Failed to activate course", e);
        }
    }

    setPreviewCourseId(null);
    setActiveCourse(course);
    pushViewState({ view: 'courseOverview', courseId: course.id });
    setViewMode('courseOverview');
  };

  const handlePreviewLesson = (courseId: CourseInfo['id']) => {
    const firstLessonId = courseId === 'maxa-klimakteriet' ? 'm-lektion1' : 'lektion1';
    setPreviewCourseId(courseId);
    setCurrentLessonId(firstLessonId);
    pushViewState({ view: 'lessonDetail', courseId: null, previewCourseId: courseId, lessonId: firstLessonId });
    setViewMode('lessonDetail');
  };

  const handleCloseLessonDetail = () => {
    // Förhandsvisningen tillhör ingen aktiverad kurs - tillbaka till kurslistan.
    if (previewCourseId) {
      setPreviewCourseId(null);
      setCurrentLessonId(null);
      pushViewState({ view: 'coursesView' });
      setViewMode('coursesView');
      return;
    }
    if (activeCourse) {
      pushViewState({ view: 'courseOverview', courseId: activeCourse.id });
      setViewMode('courseOverview');
    } else {
      pushViewState({ view: 'coursesView' });
      setViewMode('coursesView');
    }
    setCurrentLessonId(null);
  };

  const handleSelectLesson = (lessonId: string) => {
    setPreviewCourseId(null);
    setCurrentLessonId(lessonId);
    pushViewState({ view: 'lessonDetail', courseId: activeCourse?.id, lessonId });
    setViewMode('lessonDetail');
  };


  const handleToggleFocusPoint = async (lessonId: string, focusPointId: string) => {
    if (!currentUser) return;

    const currentProgress = userCourseProgress[lessonId] || {
      completedFocusPoints: [],
      reflectionAnswer: '',
      isCompleted: false
    };

    const isCompleted = currentProgress.completedFocusPoints.includes(focusPointId);
    let newFocusPoints;

    if (isCompleted) {
      newFocusPoints = currentProgress.completedFocusPoints.filter(id => id !== focusPointId);
    } else {
      newFocusPoints = [...(currentProgress.completedFocusPoints || []), focusPointId];
    }

    const updatedProgress = {
      ...currentProgress,
      completedFocusPoints: newFocusPoints
    };

    setUserCourseProgress(prev => ({
      ...prev,
      [lessonId]: updatedProgress
    }));

    try {
        await saveCourseProgress(currentUser.uid, lessonId, updatedProgress, userRole || 'member', userStatus || 'approved');
    } catch (error) {}
  };

  const handleMarkLessonComplete = async (lessonId: string) => {
      if (!currentUser) return;
      playAudio('logSuccess');
      
      const currentProgress = userCourseProgress[lessonId] || {};
      const updatedProgress = { ...currentProgress, isCompleted: true };
      
      setUserCourseProgress(prev => {
          const newState = {
              ...prev,
              [lessonId]: updatedProgress as any
          };
          
          // Check for course completion achievement
          const lessonsForOverview = activeCourse?.id === 'maxa-klimakteriet' ? menopauseCourseLessons : courseLessons;
          const totalLessons = lessonsForOverview.length;
          const completedLessons = lessonsForOverview.filter(l => newState[l.id]?.isCompleted).length;
          
          if (totalLessons > 0 && completedLessons === totalLessons) {
              const ach = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'course_completed');
              if (ach && !unlockedAchievements[ach.id]) {
                  unlockAchievement(currentUser.uid, ach.id, ach.name, ach.icon, ach.description).then(unlocked => {
                      if (unlocked) {
                          setToastNotification({ message: `Bragd upplåst: ${ach.name}!`, type: 'success' });
                          setUnlockedAchievements(prevAch => ({ ...prevAch, [ach.id]: new Date().toISOString() }));
                      }
                  });
              }
          }
          
          return newState;
      });
      
      try {
          await saveCourseProgress(currentUser.uid, lessonId, updatedProgress as any, userRole || 'member', userStatus || 'approved');
      } catch (error) {}
  };

  const handleOpenSpeedDial = () => {
    pushViewState({ view: 'main' });
    setViewMode('main'); 
  };

  const handleNavigateToJourney = (tab: 'calendar' | 'profile' | 'achievements') => {
    setJourneyInitialTab(tab);
    pushViewState({ view: 'journey', journeyTab: tab });
    setViewMode('journey');
  };

  const handleOpenLogWeightModal = () => {
    pushModalState('logWeight');
    setShowLogWeightModal(true);
  };

  const handleCloseLogWeightModal = () => {
    closeModalState('logWeight', () => setShowLogWeightModal(false));
  };
  
  const handleNavigateToMainWithDate = (date: Date) => {
    setViewingDate(date);
    pushViewState({ view: 'main' });
    setViewMode('main');
  };

  const handleOpenAICoachModal = (context?: any) => {
    pushModalState('aiCoach');
    setCoachInitialContext(context || null);
    setShowAICoachModal(true);
  };

  const handleCloseAICoachModal = () => {
    closeModalState('aiCoach', () => {
      setShowAICoachModal(false);
      setCoachInitialContext(null);
    });
  };

  const handleOpenUserProfileModal = (isOnboarding = false) => {
    setIsProfileModalOnboarding(isOnboarding);
    pushModalState('userProfile');
    setShowUserProfileModal(true);
  };

  const handleCloseUserProfileModal = () => {
    if (isProfileModalOnboarding && onboardingStep === 'invite') {
      handleFinishOnboarding();
    } else if (isProfileModalOnboarding && onboardingStep === 'feedback') {
      setOnboardingStep('invite');
    } else {
      closeModalState('userProfile', () => {
        setShowUserProfileModal(false);
        setIsProfileModalOnboarding(false);
        setOnboardingStep('form');
      });
    }
  };

  const handleOpenSubscriptionModal = () => {
    pushModalState('subscription');
    setShowSubscriptionModal(true);
  };

  const handleCloseSubscriptionModal = () => {
    closeModalState('subscription', () => setShowSubscriptionModal(false));
  };

  const handleOpenGraduationModal = () => {
    pushModalState('bootcampGraduation');
    setShowGraduationModal(true);
  };

  const handleCloseGraduationModal = () => {
    closeModalState('bootcampGraduation', () => setShowGraduationModal(false));
  };

  const handleOpenGamificationModal = () => {
    pushModalState('gamification');
    setShowGamificationModal(true);
  };

  const handleCloseGamificationModal = () => {
    closeModalState('gamification', () => setShowGamificationModal(false));
  };

  const handleOpenMentalWellbeingModal = () => {
    pushModalState('mentalWellbeing');
    setShowMentalWellbeingModal(true);
  };

  const handleCloseMentalWellbeingModal = () => {
    closeModalState('mentalWellbeing', () => setShowMentalWellbeingModal(false));
  };

  const handleUseStreakSaver = async () => {
      setDayToPotentiallySave(null);
  };

  const handleBootcampInitialWeightLog = async (data: Omit<WeightLogEntry, 'id'>) => {
    if (!currentUser) return;
    try {
        const newId = await saveWeightLog(currentUser.uid, data, true);
        const newEntry: WeightLogEntry = { ...data, id: newId };
        setWeightLogs(prev => [...prev, newEntry].sort((a, b) => a.loggedAt - b.loggedAt));
        
        setUserProfile(prev => ({
            ...prev,
            currentWeightKg: data.weightKg,
            skeletalMuscleMassKg: data.skeletalMuscleMassKg ?? prev.skeletalMuscleMassKg,
            bodyFatMassKg: data.bodyFatMassKg ?? prev.bodyFatMassKg
        }));
    } catch (error) {
        console.error("Error saving initial bootcamp weight log:", error);
        setToastNotification({ message: "Ett fel uppstod när mätningen skulle sparas.", type: 'error' });
        throw error;
    }
  };

  const handleSaveWeightLog = async (data: Omit<WeightLogEntry, 'id'>) => {
    if (!currentUser) return;
    try {
        const newId = await saveWeightLog(currentUser.uid, data);
        const newEntry: WeightLogEntry = { ...data, id: newId };
        setWeightLogs(prev => [...prev, newEntry].sort((a, b) => a.loggedAt - b.loggedAt));
        
        setUserProfile(prev => ({
            ...prev,
            currentWeightKg: data.weightKg,
            skeletalMuscleMassKg: data.skeletalMuscleMassKg ?? prev.skeletalMuscleMassKg,
            bodyFatMassKg: data.bodyFatMassKg ?? prev.bodyFatMassKg
        }));

        setToastNotification({ message: "Vikt sparad!", type: 'success' });
        playAudio('logSuccess');
        setShowLogWeightModal(false);

        // Check if goal reached
        if (!userProfile.mainGoalCompleted) {
             let goalMet = false;
             let metGoalDescription = "";

             if (userProfile.measurementMethod === 'scale' && userProfile.goalStartWeight != null && userProfile.desiredWeightChangeKg != null) {
                 const targetWeight = userProfile.goalStartWeight + userProfile.desiredWeightChangeKg;
                 if (userProfile.desiredWeightChangeKg < 0 && data.weightKg <= targetWeight) goalMet = true;
                 if (userProfile.desiredWeightChangeKg > 0 && data.weightKg >= targetWeight) goalMet = true;
                 if (goalMet) metGoalDescription = `Din målvikt på ${targetWeight.toFixed(1).replace('.', ',')} kg`;
             } else if (userProfile.measurementMethod === 'inbody') {
                 let fatMet = false;
                 let muscleMet = false;
                 let hasFatGoal = userProfile.desiredFatMassChangeKg != null;
                 let hasMuscleGoal = userProfile.desiredMuscleMassChangeKg != null;
                 let targetFat = 0;
                 let targetMuscle = 0;

                 if (hasFatGoal && userProfile.goalStartFatMassKg != null && data.bodyFatMassKg != null) {
                     targetFat = userProfile.goalStartFatMassKg + userProfile.desiredFatMassChangeKg!;
                     if (userProfile.desiredFatMassChangeKg! < 0 && data.bodyFatMassKg <= targetFat) fatMet = true;
                     if (userProfile.desiredFatMassChangeKg! > 0 && data.bodyFatMassKg >= targetFat) fatMet = true;
                 }

                 if (hasMuscleGoal && userProfile.goalStartMuscleMassKg != null && data.skeletalMuscleMassKg != null) {
                     targetMuscle = userProfile.goalStartMuscleMassKg + userProfile.desiredMuscleMassChangeKg!;
                     if (userProfile.desiredMuscleMassChangeKg! < 0 && data.skeletalMuscleMassKg <= targetMuscle) muscleMet = true;
                     if (userProfile.desiredMuscleMassChangeKg! > 0 && data.skeletalMuscleMassKg >= targetMuscle) muscleMet = true;
                 }

                 if (hasFatGoal && hasMuscleGoal) {
                     goalMet = fatMet || muscleMet;
                     if (fatMet && muscleMet) metGoalDescription = `Dina mål för fettmassa (${targetFat.toFixed(1).replace('.', ',')} kg) och muskelmassa (${targetMuscle.toFixed(1).replace('.', ',')} kg)`;
                     else if (fatMet) metGoalDescription = `Ditt mål för fettmassa på ${targetFat.toFixed(1).replace('.', ',')} kg`;
                     else if (muscleMet) metGoalDescription = `Ditt mål för muskelmassa på ${targetMuscle.toFixed(1).replace('.', ',')} kg`;
                 } else if (hasFatGoal) {
                     goalMet = fatMet;
                     if (fatMet) metGoalDescription = `Ditt mål för fettmassa på ${targetFat.toFixed(1).replace('.', ',')} kg`;
                 } else if (hasMuscleGoal) {
                     goalMet = muscleMet;
                     if (muscleMet) metGoalDescription = `Ditt mål för muskelmassa på ${targetMuscle.toFixed(1).replace('.', ',')} kg`;
                 }
             }

             if (goalMet) {
                const ach = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'main_goal_reached');
                if (ach) {
                    const unlocked = await unlockAchievement(currentUser.uid, ach.id, ach.name, ach.icon, ach.description);
                    
                    setShowConfetti(true);
                    setShowGoalMetModalData({ date: new Date().toISOString().split('T')[0], description: metGoalDescription });
                    playAudio('levelUp');
                    setUserProfile(prev => ({ ...prev, mainGoalCompleted: true }));
                    await updateUserDocument(currentUser.uid, { mainGoalCompleted: true });
                    
                    if (unlocked) {
                        setUnlockedAchievements(prev => ({ ...prev, [ach.id]: new Date().toISOString() }));
                    }
                }
             }
        }

        // Grundutbildning inmönstrings-uppgift.
        // Uppgiften heter "startmätning OCH mål", så när mätningen är sparad
        // slussas användaren direkt vidare till målen i stället för att lämnas
        // med halva uppgiften gjord.
        // Gatet lag tidigare pa bootcampAccess.onboardingCompletedDate, men det
        // faltet skrivs aldrig langre - grundutbildningens status bor i
        // bootcampOnboarding. Foljden blev att profilen slog upp efter VARJE
        // invagning, aven for den som redan gatt klart grundutbildningen.
        const onboardingDetails = getBootcampAccessDetails(userProfile);
        const weighInTaskDone = onboardingDetails.onboardingTasksCompleted.includes('weigh_in_and_goal');

        if (currentUser && onboardingDetails.isOnboarding && !weighInTaskDone) {
            pushModalState('userProfile');
            setShowUserProfileModal(true);
            completeBootcampOnboardingTask(currentUser.uid, 'weigh_in_and_goal', userProfile).then(updated => {
                if (updated) {
                    setUserProfile(prev => ({
                            ...prev,
                            bootcampAccess: updated,
                            // Spegla listan lokalt också, annars läser nästa uppgift en gammal profil
                            bootcampOnboarding: {
                                ...(prev.bootcampOnboarding || { completedAt: null }),
                                tasksCompleted: updated?.onboardingTasksCompleted || prev.bootcampOnboarding?.tasksCompleted || [],
                            },
                        }));
                }
            });
        }

    } catch (error) {
        setToastNotification({ message: "Kunde inte spara mätningen.", type: 'error' });
    }
  };

  const handleSaveWellbeingAndProceed = async (data: MentalWellbeingData) => {
      if(!currentUser) return;
      try {
          closeModalState('mentalWellbeing', () => setShowMentalWellbeingModal(false));
          handleOpenLogWeightModal(); // Chain to weight log
      } catch(e) {
          console.error(e);
      }
  };

const ensureWeeklyBankReset = useCallback(async () => {
if (!currentUser || !isInitialDataLoaded || userStatus !== 'approved') return;

    const now = new Date();
    const currentWeek = getWeekInfo(now);

    if (weeklyBankRef.current.weekId !== currentWeek.weekId) {
        const resetBank: WeeklyCalorieBank = {
            weekId: currentWeek.weekId,
            bankedCalories: 0,
            startDate: currentWeek.startDate,
            endDate: currentWeek.endDate,
        };

        try {
            await updateUserDocument(currentUser.uid, {
                weeklyBank: resetBank
            });
            setWeeklyBank(resetBank);
            weeklyBankRef.current = resetBank;
        } catch (error) {}
    }
}, [currentUser, isInitialDataLoaded, userRole, userStatus, setWeeklyBank]);

const ensureYesterdayProcessed = useCallback(async (uid: string, now = new Date(), options: ProcessDayEndLogicOptions = {}, manualLogOverride?: LoggedMeal[], prefetchedWater?: number): Promise<void> => {
if (!uid || userStatus !== 'approved' || !hasCompletedOnboarding) return;

    const { start: yesterdayStart, yKey: yesterdayUID } = yesterdayRangeSE(now);
    const todayUID = dayKeySE(new Date());

    // STRICT CHECK: Never summarize today or a future date
    if (yesterdayUID >= todayUID) {
        console.warn(`Attempted to summarize a future/current date (${yesterdayUID}). Aborting.`);
        return;
    }
    
    if (!summaryStartDate || yesterdayUID < summaryStartDate) {
        return;
    }
    
    setIsSummarizingYesterday(true);

    try {
        const [yesterdayMeals, yesterdayWater] = await Promise.all([
            manualLogOverride ? Promise.resolve(manualLogOverride) : fetchMealLogsForDate(uid, yesterdayUID),
            prefetchedWater !== undefined ? Promise.resolve(prefetchedWater) : fetchWaterLog(uid, yesterdayUID)
        ]);

        const mealsToProcess = manualLogOverride || yesterdayMeals;

        const totals = sumMealNutrients(mealsToProcess);

        const minSafe = (goals.calorieGoal || 2000) * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
        
        let goalMet = false;
        let usedFromBank = 0;
        let savedBy: "sparpott" | undefined = undefined;

        if (totals.calories >= minSafe) {
            if (userProfile.goalType === 'lose_fat' || userProfile.goalType === 'maintain') {
                if (totals.calories <= goals.calorieGoal) {
                    goalMet = true;
                } else {
                    const excess = totals.calories - goals.calorieGoal;
                    // Deduct up to the available bank amount
                    if (weeklyBankRef.current.bankedCalories > 0) {
                        usedFromBank = Math.min(Math.round(excess), weeklyBankRef.current.bankedCalories);
                        if (usedFromBank >= Math.round(excess)) {
                            goalMet = true;
                            savedBy = 'sparpott';
                        }
                    }
                }
            } else if (userProfile.goalType === 'gain_muscle') {
                goalMet = totals.calories >= (goals.calorieGoal - 300);
            }
        }

        let bankedAmount = 0;
        if ((userProfile.goalType === 'lose_fat' || userProfile.goalType === 'maintain') && !savedBy) {
            if (totals.calories >= minSafe && totals.calories < goals.calorieGoal) {
                bankedAmount = Math.round(goals.calorieGoal - totals.calories);
            }
        }

        // --- STREAK LOGIC FIXED (Using Historical Chain) ---
        // Look at the day BEFORE yesterday (forrgår) to determine continuity.
        const dayBeforeYesterday = new Date(yesterdayStart);
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
        const dayBeforeUID = dayKeySE(dayBeforeYesterday);
        
        // Find historical streak from context. Fallback to 0 if missing.
        const prevDaySummary = pastDaysSummaryRef.current[dayBeforeUID];
        const prevStreak = prevDaySummary?.streakForThisDay || 0;
        
        const hasLogs = mealsToProcess.length > 0;
        let finalNewStreak = 0;
        
        // ALLTID räkna ut streaken på nytt baserat på faktiska loggar (självläkande)
        if (hasLogs) {
             finalNewStreak = prevStreak + 1;
        } else {
             finalNewStreak = 0;
        }
        
        const summary: PastDaySummary = {
            date: yesterdayUID,
            goalMet,
            consumedCalories: totals.calories,
            calorieGoal: goals.calorieGoal,
            proteinGoalMet: totals.protein >= goals.proteinGoal,
            consumedProtein: totals.protein,
            proteinGoal: goals.proteinGoal,
            consumedCarbohydrates: totals.carbohydrates,
            carbohydrateGoal: goals.carbohydrateGoal,
            consumedFat: totals.fat,
            fatGoal: goals.fatGoal,
            goalType: userProfile.goalType,
            waterGoalMet: yesterdayWater >= DEFAULT_WATER_GOAL_ML,
            streakForThisDay: finalNewStreak, 
            bankedAmount: bankedAmount,
            savedBy: savedBy
        };

        // --- STATE UPDATE: Force update to streakData ---
        // This ensures the UI reflects the new streak immediately.
        const newStreakData = { 
            currentStreak: finalNewStreak, 
            lastDateStreakChecked: yesterdayUID 
        };
        setStreakData(newStreakData);
        streakDataRef.current = newStreakData;

        await setPastDaySummary(uid, yesterdayUID, summary);
        
        const userUpdates: any = {
            currentStreak: finalNewStreak,
            lastDateStreakChecked: yesterdayUID
        };

        if (finalNewStreak > highestStreak) {
            userUpdates.highestStreak = finalNewStreak;
            setHighestStreak(finalNewStreak);
        }

        // Level Check
        const newLevel = LEVEL_DEFINITIONS.find(l => l.requiredStreak === finalNewStreak);
        if (newLevel && newLevel.id !== 'level0') {
            setShowLevelUpModal(newLevel);
            
            const currentHighestLevelIndex = LEVEL_DEFINITIONS.findIndex(l => l.id === highestLevelId);
            const newLevelIndex = LEVEL_DEFINITIONS.findIndex(l => l.id === newLevel.id);
            
            if (newLevelIndex > currentHighestLevelIndex) {
                setHighestLevelId(newLevel.id);
                userUpdates.highestLevelId = newLevel.id;
            }
        } else if (newLevel && newLevel.id === 'level0' && !highestLevelId) {
            setHighestLevelId(newLevel.id);
            userUpdates.highestLevelId = newLevel.id;
        }

        if (bankedAmount > 0) {
            const newVal = weeklyBankRef.current.bankedCalories + bankedAmount;
            userUpdates["weeklyBank.bankedCalories"] = newVal;
            const newBank = {
                ...weeklyBankRef.current,
                bankedCalories: newVal
            };
            setWeeklyBank(newBank);
            weeklyBankRef.current = newBank;
        } else if (usedFromBank > 0) {
            const newVal = Math.max(0, weeklyBankRef.current.bankedCalories - usedFromBank);
            userUpdates["weeklyBank.bankedCalories"] = newVal;
            const newBank = {
                ...weeklyBankRef.current,
                bankedCalories: newVal
            };
            setWeeklyBank(newBank);
            weeklyBankRef.current = newBank;
        }

        await updateUserDocument(uid, userUpdates);

        // Update local summaries state so Dashboard sees the new summary immediately
        const newSummaries = { ...pastDaysSummaryRef.current, [yesterdayUID]: summary };
        setPastDaysSummary(newSummaries);
        pastDaysSummaryRef.current = newSummaries;
        
        if (!options.silent) {
            playAudio('levelUp'); 
        }

        // Streak Achievement Check
        const streakAchs = ACHIEVEMENT_DEFINITIONS.filter(a => a.type === 'streak' && a.requiredValue <= finalNewStreak);
        for (const streakAch of streakAchs) {
             const unlocked = await unlockAchievement(uid, streakAch.id, streakAch.name, streakAch.icon, streakAch.description);
             if (unlocked) {
                 setToastNotification({ message: `Bragd upplåst: ${streakAch.name}!`, type: 'success' });
                 setUnlockedAchievements(prev => ({ ...prev, [streakAch.id]: new Date().toISOString() }));
             }
        }

    } catch (error) {
        setToastNotification({ message: "Kunde inte sammanställa gårdagen.", type: 'error' });
    } finally {
        setIsSummarizingYesterday(false);
    }
}, [currentUser?.uid, userRole, userStatus, goals, userProfile, summaryStartDate, hasCompletedOnboarding, setPastDaysSummary, setStreakData, setWeeklyBank, setToastNotification, activeBootcamp]);

    const isCatchingUp = useRef(false);
    useEffect(() => {
        const catchUp = async () => {
            if (isCatchingUp.current) return;
            if (currentUser && isInitialDataLoaded && userStatus === 'approved' && hasCompletedOnboarding) {
                isCatchingUp.current = true;
                try {
                    const today = new Date();
                    const yesterdayUID = dayKeySE(new Date(today.getTime() - 86400000));
                    
                    const deepHealDone = localStorage.getItem(`deepHealDone_${currentUser.uid}`) === 'true';
                    const daysToProcess = [];
                    
                    let currentCheckDate = new Date(today.getTime() - 30 * 86400000); // Check up to 30 days back
                    if (summaryStartDate && new Date(summaryStartDate) > currentCheckDate) {
                        currentCheckDate = new Date(summaryStartDate);
                    }

                    while (currentCheckDate < today) {
                        const checkUID = dayKeySE(currentCheckDate);
                        const summary = pastDaysSummaryRef.current[checkUID];
                        
                        let needsProcessing = !summary;
                        
                        // Deep heal: check days with 0 calories to see if they actually have meals
                        if (!deepHealDone && summary && summary.consumedCalories === 0) {
                            needsProcessing = true;
                        }
                        
                        if (needsProcessing) {
                            daysToProcess.push({
                                uid: checkUID,
                                processNow: new Date(currentCheckDate.getTime() + 86400000),
                                isFinalDay: checkUID === yesterdayUID
                            });
                        }
                        currentCheckDate.setDate(currentCheckDate.getDate() + 1);
                    }

                    if (daysToProcess.length > 0) {
                        console.log("Catching up / Healing days:", daysToProcess.map(d => d.uid));
                        // Process in batches of 5 to avoid overloading
                        for (let i = 0; i < daysToProcess.length; i += 5) {
                            const batch = daysToProcess.slice(i, i + 5);
                            const prefetchPromises = batch.map(async (day) => {
                                const [meals, water] = await Promise.all([
                                    fetchMealLogsForDate(currentUser.uid, day.uid),
                                    fetchWaterLog(currentUser.uid, day.uid)
                                ]);
                                return { ...day, meals, water };
                            });
                            
                            const prefetchedData = await Promise.all(prefetchPromises);

                            for (const dayData of prefetchedData) {
                                const summary = pastDaysSummaryRef.current[dayData.uid];
                                const hasActualData = dayData.meals.length > 0 || dayData.water > 0;
                                
                                // Process if it was missing, or if we found actual data during deep heal
                                if (!summary || hasActualData) {
                                    await ensureYesterdayProcessed(currentUser.uid, dayData.processNow, { silent: !dayData.isFinalDay }, dayData.meals, dayData.water);
                                }
                            }
                        }
                    }
                    
                    if (!deepHealDone) {
                        localStorage.setItem(`deepHealDone_${currentUser.uid}`, 'true');
                    }

                    // --- GLOBAL STREAK RECALCULATION ---
                    // Now that all summaries are accurate, ensure the streak chain is mathematically perfect
                    const summaries = pastDaysSummaryRef.current;
                    const dates = Object.keys(summaries).sort();
                    if (dates.length > 0) {
                        let runningStreak = 0;
                        let highestStreakReached = 0;
                        const updates: Record<string, PastDaySummary> = {};

                        for (const date of dates) {
                            const summary = summaries[date];
                            if (summary.consumedCalories > 0) {
                                runningStreak += 1;
                            } else {
                                runningStreak = 0;
                            }

                            if (summary.streakForThisDay !== runningStreak) {
                                updates[date] = { ...summary, streakForThisDay: runningStreak };
                            }
                            highestStreakReached = Math.max(highestStreakReached, runningStreak);
                        }

                        if (Object.keys(updates).length > 0) {
                            console.log("Fixing broken streak links:", Object.keys(updates));
                            const newSummaries = { ...summaries, ...updates };
                            setPastDaysSummary(newSummaries);
                            pastDaysSummaryRef.current = newSummaries;

                            // Update Firestore sequentially to ensure order
                            for (const [date, updatedSummary] of Object.entries(updates)) {
                                await setPastDaySummary(currentUser.uid, date, updatedSummary);
                            }
                        }

                        // Ensure current streak matches the recalculated truth for yesterday
                        const actualYesterdayStreak = updates[yesterdayUID] ? updates[yesterdayUID].streakForThisDay : (summaries[yesterdayUID]?.streakForThisDay || 0);
                        
                        if (streakDataRef.current.currentStreak !== actualYesterdayStreak) {
                            const newStreakData = { currentStreak: actualYesterdayStreak, lastDateStreakChecked: yesterdayUID };
                            setStreakData(newStreakData);
                            streakDataRef.current = newStreakData;
                            await updateUserDocument(currentUser.uid, { currentStreak: actualYesterdayStreak, lastDateStreakChecked: yesterdayUID });
                        }

                        // Safely update highest streak if we found a new high
                        setHighestStreak(prev => {
                            const newHighest = Math.max(prev, highestStreakReached);
                            if (newHighest > prev) {
                                updateUserDocument(currentUser.uid, { highestStreak: newHighest }).catch(console.error);
                            }
                            return newHighest;
                        });
                    }

                    await ensureWeeklyBankReset();
                } finally {
                    isCatchingUp.current = false;
                    setHasRunCatchUp(true);
                }
            }
        };

        catchUp();
    }, [currentUser, isInitialDataLoaded, userStatus, hasCompletedOnboarding, ensureYesterdayProcessed, ensureWeeklyBankReset, summaryStartDate]);

  
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

    const handleCloseOnboardingRewardModal = async () => {
        setShowOnboardingRewardModal(false);
        if (checklistState) {
            const newState = { ...checklistState, dismissed: true };
            setLocalStorageItem(LOCAL_STORAGE_KEYS.ONBOARDING_CHECKLIST_STATE, newState);
            setChecklistState(null);
        }

        // Bonusen delas ut när sista punkten bockas i (grantOnboardingBonus).
        // Anropet här är bara ett skyddsnät om utdelningen misslyckades då.
        await grantOnboardingBonus();
    };

    // IMPLEMENTED SAVING LOGIC HERE
    const handleSaveLessonData = async (lessonId: string, data: Partial<UserLessonProgress>) => {
        if (!currentUser) return;

        // Optimistic update
        setUserCourseProgress(prev => {
            const current = prev[lessonId] || { completedFocusPoints: [], isCompleted: false, reflectionAnswer: '' };
            const updated = {
                ...current,
                ...data
            };
            return {
                ...prev,
                [lessonId]: updated
            };
        });

        // Firestore update
        try {
            const currentProgress = userCourseProgress[lessonId] || { completedFocusPoints: [], isCompleted: false, reflectionAnswer: '' };
            const updatedProgress = { ...currentProgress, ...data };
            await saveCourseProgress(currentUser.uid, lessonId, updatedProgress, userRole || 'member', userStatus || 'approved');
            setToastNotification({ message: 'Sparat!', type: 'success' });
        } catch (error) {
            console.error("Failed to save lesson data", error);
            setToastNotification({ message: 'Kunde inte spara.', type: 'error' });
        }
    };

  // --- RENDERING LOGIC START ---
  
  if (authLoading) return <SplashScreen />;
  if (!currentUser) return <AuthForm onAuthStateChange={setCurrentUser} />;
  if (!isInitialDataLoaded) return <SplashScreen />;

  if (userStatus === 'pending') {
    return <PendingApprovalScreen onLogout={handleLogout} userEmail={currentUser.email} userId={currentUser.uid} />;
  }

  if (userStatus === 'archived') {
    return <ArchivedUserScreen onLogout={handleLogout} />;
  }
  
  if ((userRole === 'coach' || userRole === 'admin') && currentInterface === 'coach') {
    return <CoachDashboard 
              onLogout={handleLogout} 
              currentUserEmail={currentUser.email || "Coach"} 
              currentUserId={currentUser.uid}
              currentUser={currentUser}
              userProfile={userProfile}
              userRole={userRole}
              setToastNotification={setToastNotification}
              onToggleInterface={toggleInterfaceView}
            />;
  }

  // Central åtkomstgrind via hasAppAccess & isReadOnlyUser:
  // hasAppAccess ger full tillgång till loggning och verktyg.
  // isReadOnlyUser ger visningsåtkomst till tidigare loggade data och historik utan ny loggning.
  const effectiveUserProfile = { ...userProfile, role: userRole || userProfile.role };
  const userHasAccess = hasAppAccess(effectiveUserProfile);
  const isReadOnly = isReadOnlyUser(effectiveUserProfile);

  // Köpvalet visas först när profilen är ifylld. Annars möttes ett nybakat konto
  // av en prislista innan appen ens visat vad den räknat fram - och profilmodalen
  // hann aldrig öppnas, eftersom grinden returnerade tidigt.
  if (!userHasAccess && !isReadOnly && hasCompletedOnboarding) {
    return (
      <>
        <AccessGateView 
          planSummary={{
            calorieGoal: goals.calorieGoal,
            proteinGoal: goals.proteinGoal,
            goalType: userProfile.goalType,
          }}
          userProfile={userProfile}
          onStartBootcampCheckout={async () => {
            if (!currentUser) return;
            await startBootcampCheckout(currentUser.uid);
          }}
          onSimulatedGrant={async () => {
            if (!currentUser || !isTestingToolAllowed()) return;
            const newAccess = await grantBootcampAccess(currentUser.uid);
            setUserProfile(prev => ({ ...prev, bootcampAccess: newAccess, coachStyle: 'hard' }));
            setToastNotification({ message: 'Simulerad Bootcamp-åtkomst beviljad (Testläge)!', type: 'success' });
          }}
          onOpenSubscriptionModal={() => setShowSubscriptionModal(true)}
          onStartSubscriptionCheckout={async () => {
            if (!currentUser) return;
            await startSubscriptionCheckout(currentUser.uid, userProfile.coachStyle);
          }}
          onLogout={handleLogout}
        />
        {showSubscriptionModal && (
          <SubscriptionModal 
            show={showSubscriptionModal} 
            onClose={() => setShowSubscriptionModal(false)} 
            status={userProfile.subscriptionStatus || 'inactive'} 
            currentPeriodEnd={userProfile.currentPeriodEnd}
            onCancelSuccess={() => {
              setUserProfile(prev => ({ ...prev, subscriptionStatus: 'canceling' }));
            }}
            onUndoCancelSuccess={() => {
              setUserProfile(prev => ({ ...prev, subscriptionStatus: 'active' }));
            }}
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
    { key: 'main', label: 'Startsida', Icon: Home, isActive: viewMode === 'main', onClick: () => { pushViewState({ view: 'main' }); setViewMode('main'); setCurrentLessonId(null); } },
    { key: 'journey', label: 'Min resa', Icon: Footprints, isActive: viewMode === 'journey', onClick: () => { pushViewState({ view: 'journey', journeyTab: 'calendar' }); setJourneyInitialTab('calendar'); setViewMode('journey'); } },
    { key: 'course', label: 'Kurs', Icon: GraduationCap, isActive: viewMode === 'coursesView' || viewMode === 'courseOverview' || viewMode === 'lessonDetail', onClick: () => { pushViewState({ view: 'coursesView' }); setViewMode('coursesView');} },
    { key: 'community', label: 'Community', Icon: Users, isActive: viewMode === 'community', onClick: () => { pushViewState({ view: 'community', communityTab: 'flode' }); setCommunityInitialTab('flode'); setViewMode('community'); }, notificationCount: pendingRequestsCount + newEventsCount + unreadChatsCount },
  ];

  const lessonsForOverview = activeCourse?.id === 'maxa-klimakteriet' ? menopauseCourseLessons : courseLessons;
  const previewLessons = previewCourseId === 'maxa-klimakteriet' ? menopauseCourseLessons : courseLessons;
  const lessonsForCurrentView = previewCourseId ? previewLessons : lessonsForOverview;
  const currentLesson = lessonsForCurrentView.find(l => l.id === currentLessonId);

  const coachName = userProfile.coachStyle && COACH_PERSONAS[userProfile.coachStyle] ? COACH_PERSONAS[userProfile.coachStyle].label : 'Din Coach';

  const todayStr = dayKeySE(new Date());
  const isBootcampStarted = activeBootcamp ? todayStr >= activeBootcamp.fas1StartDate : false;
  const effectiveActiveBootcamp = isBootcampStarted ? activeBootcamp : null;

  const shouldShowGreenBackground = effectiveActiveBootcamp && (viewMode === 'main' || (viewMode === 'coursesView' && isBootcampViewActive));

  return (
    <>
      <div className={`${viewMode === 'community' ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'} bg-neutral-light dark:bg-neutral-darker bg-fixed flex flex-col items-center pb-0`}>
       <header className="w-full bg-white dark:bg-neutral-darker text-neutral-dark dark:text-white py-2 px-4 shadow-lg sticky top-0 z-30">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => { pushViewState({ view: 'main' }); setViewMode('main'); }}>
                    <img src="/favicon.png" alt="Kostloggen.se logo" className="h-14 w-14 object-contain" />
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
                                <item.Icon color={item.isActive ? "#D96E4A" : "#7A756E"} size={24} strokeWidth={item.isActive ? 2 : 1.5} />
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
                                <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={40} />
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
                                    icon={<UserPlusIcon />}
                                    label="Bjud in kompisar"
                                    onClick={async () => {
                                        setShowProfileDropdown(false);
                                        const res = await shareAppInvite();
                                        if (res.copied) {
                                            setToastNotification({ message: 'Inbjudan kopierad till urklipp!', type: 'success' });
                                        } else if (res.shared) {
                                            setToastNotification({ message: 'Inbjudan delad!', type: 'success' });
                                        }
                                    }}
                                />
                                <DropdownMenuItem
                                    icon={<TrophyIcon />}
                                    label="Streak & Rekord"
                                    onClick={() => {
                                        setShowGamificationModal(true);
                                        setShowProfileDropdown(false);
                                    }}
                                />
                                <DropdownMenuItem
                                    icon={<CreditCardIcon />}
                                    label="Prenumeration"
                                    onClick={() => {
                                        setShowSubscriptionModal(true);
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
                                
                                {(userRole === 'coach' || userRole === 'admin') && (
                                    <>
                                        <div className="my-1 border-t border-neutral-light/70"></div>
                                        <DropdownMenuItem
                                            icon={<SwitchHorizontalIcon />}
                                            label="Coach Dashboard"
                                            onClick={toggleInterfaceView}
                                            className="text-[#D96E4A] hover:bg-[#F6E2D9]/50 font-medium"
                                        />
                                    </>
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
          ? "w-full flex-grow flex flex-col overflow-hidden" 
          : `w-full ${mainContentMaxWidth} mx-auto p-2 sm:p-4 flex-grow flex flex-col`
        }>
         {viewMode === 'main' && (
            <Dashboard 
                checklistState={checklistState}
                onOnboardingNavigate={handleOnboardingNavigate}
                onChecklistUpdate={updateChecklistItem} 
                showSpotlight={showSpotlight}
                onDismissSpotlight={handleDismissSpotlight}
                isInstallBannerVisible={showInstallBanner || showIosInstallPrompt}
                viewingDate={viewingDate}
                onDateSelect={handleNavigateToMainWithDate}
                formattedViewingDate={formattedViewingDate}
                ensureYesterdayProcessed={ensureYesterdayProcessed}
                setToastNotification={setToastNotification}
                onOpenAICoach={() => handleOpenAICoachModal()}
                isSummarizingYesterday={isSummarizingYesterday}
                isAICoachOpen={showAICoachModal}
                isProfileOpen={showUserProfileModal}
                isMorningReportOpen={!!morningReportData}
                activeBootcamp={effectiveActiveBootcamp}
                hasCompletedTodaysReport={recentBootcampReports.some(report => report.date === dayKeySE(new Date()))}
                onOpenBootcamp={() => {
                    setOpenBootcampDirectly(true);
                    pushViewState({ view: 'coursesView' });
                    setViewMode('coursesView');
                }}
                onShareRecipe={(recipeText) => {
                    pushViewState({ view: 'community', communityTab: 'flode' });
                    setCommunityInitialTab('flode');
                    setInitialPostText(recipeText);
                    setViewMode('community');
                }}
                onOpenSubscription={() => {
                  if (isReadOnly) {
                    handleOpenGraduationModal();
                  } else {
                    handleOpenSubscriptionModal();
                  }
                }}
                isReadOnly={isReadOnly}
                onOpenGraduationOffer={() => handleOpenGraduationModal()}
            />
         )}
         {viewMode === 'journey' && (
            <JourneyView 
                pastDaysData={pastDaysSummary} 
                weightLogs={weightLogs}
                userProfile={userProfile}
                goals={goals}
                onSaveProfileAndGoals={handleSaveProfileAndGoals}
                onOpenLogWeightModal={handleOpenLogWeightModal} 
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
                onNavigateToMainWithDate={handleNavigateToMainWithDate}
                streakSaver={streakSaver}
                analysisContext={null as any} 
                setShowAICoachModal={setShowAICoachModal}
                isAICoachOpen={showAICoachModal}
                isProfileOpen={showUserProfileModal}
                isMorningReportOpen={!!morningReportData}
                activeBootcamp={effectiveActiveBootcamp}
            />
         )}
         {viewMode === 'coursesView' && (
            <CoursesView
                userProfile={userProfile}
                goals={goals}
                userProgress={userCourseProgress}
                weightLogs={weightLogs}
                weeklyBank={weeklyBank}
                onNavigateToCourse={handleNavigateToCourse}
                onPreviewLesson={handlePreviewLesson}
                onSaveProfileAndGoals={handleSaveProfileAndGoals}
                onSaveWeightLog={handleBootcampInitialWeightLog}
                onCourseAborted={refreshUserData}
                ensureYesterdayProcessed={ensureYesterdayProcessed}
                activeBootcamp={activeBootcamp}
                initialOpenBootcamp={openBootcampDirectly}
                onBootcampStateChange={setIsBootcampViewActive}
                onNavigateHome={() => { pushViewState({ view: 'main' }); setViewMode('main'); }}
                bootcampFeedSlot={effectiveActiveBootcamp ? (
                  <CommunityView
                    currentUser={currentUser}
                    userProfile={userProfile}
                    achievements={ACHIEVEMENT_DEFINITIONS}
                    setToastNotification={setToastNotification}
                    pendingRequestsCount={pendingRequestsCount}
                    unreadChatsCount={unreadChatsCount}
                    timelineEvents={timelineEvents}
                    setTimelineEvents={setTimelineEvents}
                    buddyDetails={buddyDetails}
                    isLoading={isLoadingCommunityData}
                    activeBootcamp={effectiveActiveBootcamp}
                    onDataChanged={loadCommunityData}
                    lastViewTimestamp={lastCommunityViewTimestamp}
                    currentStreak={streakData.currentStreak}
                    userRole={userRole || 'member'}
                    initialFeedFilter="bootcamp"
                    embedded
                  />
                ) : undefined}
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
                key={currentLesson.id}
                lesson={currentLesson}
                progress={userCourseProgress[currentLessonId]}
                onToggleFocusPoint={handleToggleFocusPoint} 
                onSaveProgress={handleSaveLessonData}
                onMarkComplete={handleMarkLessonComplete} 
                onClose={handleCloseLessonDetail}
                onOpenSpeedDial={handleOpenSpeedDial}
                onNavigateToJourney={handleNavigateToJourney}
                userProfile={userProfile}
                weightLogs={weightLogs}
                pastDaysSummary={Object.values(pastDaysSummary)}
                onOpenLogWeightModal={handleOpenLogWeightModal} 
                isPreview={!!previewCourseId}
                previewPositionText={previewCourseId ? `Lektion 1 av ${previewLessons.length}` : undefined}
                previewUnlockText={
                  previewCourseId === 'praktisk-viktkontroll'
                    ? 'Resten av kursen låses upp när du har genomfört en Bootcamp. Då sparas dina svar och Flexibot ger dig personlig återkoppling på varje reflektion.'
                    : previewCourseId
                      ? 'Starta kursen för att spara dina svar och få personlig återkoppling från Flexibot på varje reflektion.'
                      : undefined
                }
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
              unreadChatsCount={unreadChatsCount}
              initialTab={communityInitialTab}
              initialSubTab={communityInitialSubTab}
              highlightEventId={highlightEventId}
              initialChatId={initialChatId}
              initialPostText={initialPostText}
              timelineEvents={timelineEvents}
              setTimelineEvents={setTimelineEvents}
              buddyDetails={buddyDetails}
              isLoading={isLoadingCommunityData}
              activeBootcamp={effectiveActiveBootcamp}
              onDataChanged={loadCommunityData}
              lastViewTimestamp={lastCommunityViewTimestamp}
              currentStreak={streakData.currentStreak}
              userRole={userRole || 'member'}
            />
         )}
        </main>
        
        {showLatestUpdateView && <UpdateNoticeModal show={showLatestUpdateView} onClose={() => setShowLatestUpdateView(false)} onNavigateToCourses={handleNavigateToCourses} />}
        {showOnboardingRewardModal && <OnboardingRewardModal show={showOnboardingRewardModal} onClose={handleCloseOnboardingRewardModal} goalType={userProfile.goalType} />}
        {dayToPotentiallySave && <UseStreakSaverModal show={!!dayToPotentiallySave} onClose={() => setDayToPotentiallySave(null)} onConfirm={handleUseStreakSaver} daySummary={dayToPotentiallySave} />}
        {showMotivationModal && <MotivationModal show={!!showMotivationModal} onClose={() => setShowMotivationModal(null)} daySummary={showMotivationModal} />}
        {morningReportData && (
          <MorningReportModal 
            show={!!morningReportData} 
            onClose={() => {
              closeModalState('morningReport', () => {
                setMorningReportData(null);
                const todayUID = dayKeySE(new Date());
                localStorage.setItem('lastSeenMorningReport', todayUID);
              });
            }} 
            summary={morningReportData.summary} 
            currentStreak={morningReportData.currentStreak} 
            userProfile={userProfile} 
            goals={goals}
            onUpdateGoals={handleSaveProfileAndGoals}
            onUpdateProfile={async (updatedProfile) => { handleSaveProfileAndGoals(updatedProfile, goals); }}
            onDiscussWithCoach={() => {
              setMorningReportData(null);
              setCoachInitialContext({ type: 'from_analysis' });
              pushModalState('aiCoach');
              setShowAICoachModal(true);
            }}
            yesterdayMeals={morningReportData.yesterdayMeals} 
            yesterdayBootcampReport={morningReportData.yesterdayBootcampReport} 
            activeBootcamp={effectiveActiveBootcamp} 
            pastDaysSummary={Object.values(pastDaysSummary)} 
            weightLogs={weightLogs} 
          />
        )}
        {showInfoModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-fade-in" onClick={handleCloseInfoModal}><InfoModal onClose={handleCloseInfoModal} userName={userProfile.name} /></div>}
        {showUserProfileModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-fade-in" onClick={handleCloseUserProfileModal}><div onClick={e => e.stopPropagation()} className="animate-scale-in"><UserProfileModal initialProfile={userProfile} onSave={handleSaveProfileAndGoals} onClose={handleCloseUserProfileModal} isOnboarding={isProfileModalOnboarding} onboardingStep={onboardingStep} aiFeedbackLoading={aiFeedbackLoading} aiFeedbackMessage={aiFeedbackMessage} aiFeedbackError={aiFeedbackError} onSubscribeToPush={handleSubscribeToPush} isBootcampActive={!!effectiveActiveBootcamp} onFinishOnboarding={handleFinishOnboarding} onGoToInviteStep={() => setOnboardingStep('invite')} /></div></div>}
        {showOnboardingCompletion && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-fade-in" onClick={handleFinishOnboarding}><div onClick={e => e.stopPropagation()} className="animate-scale-in"><OnboardingCompletionScreen onFinish={handleFinishOnboarding} coachName={coachName} /></div></div>}
        {showLevelUpModal && <LevelUpModal level={showLevelUpModal} onClose={() => closeModalState('levelUp', () => setShowLevelUpModal(null))} />}
        {showGoalMetModalData && <GoalMetModal data={showGoalMetModalData} onClose={() => closeModalState('goalMet', () => setShowGoalMetModalData(null))} />}
        {newlyUnlockedLesson && <NewLessonUnlockedModal lessonTitle={newlyUnlockedLesson.title} onClose={() => closeModalState('newLessonUnlocked', () => setNewlyUnlockedLesson(null))} />}
        {showAIFeedbackModal && <AIFeedbackModal show={showAIFeedbackModal} onClose={() => { if (isProfileModalOnboarding) { handleFinishOnboarding(); } else { closeModalState('aiFeedback', () => setShowAIFeedbackModal(false)); } }} feedbackMessage={aiFeedbackMessage} isLoading={aiFeedbackLoading} error={aiFeedbackError} modalTitle={aiModalTitle} modalIcon={userProfile.coachStyle && COACH_PERSONAS[userProfile.coachStyle] && COACH_PERSONAS[userProfile.coachStyle].imageUrl ? <img src={COACH_PERSONAS[userProfile.coachStyle].imageUrl} alt={COACH_PERSONAS[userProfile.coachStyle].label} className="w-7 h-7 object-cover rounded-full mr-2.5" /> : aiModalIcon} isOnboardingContext={isProfileModalOnboarding} showDiscussButton={aiModalTitle === "Analys av din mätning"} onDiscuss={() => { setShowAIFeedbackModal(false); setCoachInitialContext({ type: 'from_analysis' }); pushViewState({ view: 'journey' }); pushModalState('aiCoach'); setViewMode('journey'); setShowAICoachModal(true); }} />}
        {showLogWeightModal && <div className="fixed inset-0 bg-neutral-dark/40 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-fade-in" onClick={handleCloseLogWeightModal}><LogWeightModal show={showLogWeightModal} onClose={handleCloseLogWeightModal} onSave={handleSaveWeightLog} measurementMethod={userProfile.measurementMethod} activeBootcamp={effectiveActiveBootcamp} weightLogs={weightLogs} prefillFromProfile={{ weightKg: userProfile.currentWeightKg, skeletalMuscleMassKg: userProfile.skeletalMuscleMassKg, bodyFatMassKg: userProfile.bodyFatMassKg }} /></div>}
        {showMentalWellbeingModal && <MentalWellbeingModal show={showMentalWellbeingModal} onClose={handleCloseMentalWellbeingModal} onSave={handleSaveWellbeingAndProceed} />}
        {/* Pass userCourseProgress to AI Coach Modal */}
        <AICoachModal 
            show={showAICoachModal} 
            onClose={handleCloseAICoachModal} 
            analysisContext={{ 
                userProfile, 
                goals, 
                allWeightLogs: weightLogs, 
                last30DaysSummaries: Object.values(pastDaysSummary), 
                mentalWellbeingLogs, 
                goalTimeline: calculateGoalTimeline(userProfile, weightLogs), 
                currentStreak: streakData.currentStreak,
                userCourseProgress,
                activeBootcamp: effectiveActiveBootcamp,
                recentBootcampReports
            }} 
            initialContext={coachInitialContext} 
        />
        {showGamificationModal && (
            <GamificationModal
                show={showGamificationModal}
                onClose={handleCloseGamificationModal}
                currentStreak={streakData.currentStreak}
                highestStreak={highestStreak}
                highestLevelId={highestLevelId}
            />
        )}
        {showSubscriptionModal && (
            <SubscriptionModal 
                show={showSubscriptionModal} 
                onClose={handleCloseSubscriptionModal} 
                status={userProfile.subscriptionStatus || 'active'} 
                currentPeriodEnd={userProfile.currentPeriodEnd}
                onCancelSuccess={() => {
                    setUserProfile(prev => ({ ...prev, subscriptionStatus: 'canceling' }));
                }}
                onUndoCancelSuccess={() => {
                    setUserProfile(prev => ({ ...prev, subscriptionStatus: 'active' }));
                }}
            />
        )}
        {showTrialRecapModal && currentUser && (
            <TrialRecapModal 
                show={showTrialRecapModal}
                onClose={() => {
                    closeModalState('trialRecap', () => {
                      setShowTrialRecapModal(false);
                      localStorage.setItem(`hasSeenTrialRecapDialog_${currentUser.uid}`, 'true');
                    });
                }}
                userName={userProfile.name || currentUser.displayName || ''}
                currentStreak={streakData.currentStreak}
                totalMealsLogged={totalMealsCount}
                bankedCalories={weeklyBank?.bankedCalories || 0}
                coachStyle={userProfile.coachStyle || 'balanced'}
                onOpenSubscription={() => {
                  setShowTrialRecapModal(false);
                  handleOpenSubscriptionModal();
                }}
                hasLowUsage={Object.keys(pastDaysSummary).length < 3}
            />
        )}
        {showFinaleModal && unseenFinale && currentUser && (
            <BootcampFinaleModal
                participant={unseenFinale}
                userName={userProfile.name || currentUser.displayName || ''}
                onClose={() => {
                    closeModalState('bootcampFinale', () => {
                      setShowFinaleModal(false);
                      markBootcampFinaleAsSeen(unseenFinale.cohortId, currentUser.uid);
                    });
                }}
                onGoToCourse={() => {
                    closeModalState('bootcampFinale', () => {
                      setShowFinaleModal(false);
                      markBootcampFinaleAsSeen(unseenFinale.cohortId, currentUser.uid);
                      pushViewState({ view: 'coursesView' });
                      setViewMode('coursesView');
                    });
                }}
            />
        )}

        {showGraduationModal && currentUser && (
            <BootcampGraduationModal
                show={showGraduationModal}
                isCompleted={isBootcampCompleted}
                userProfile={userProfile}
                pastDaysSummary={pastDaysSummary}
                weightLogs={weightLogs}
                totalMealsCount={totalMealsCount}
                streakDays={Math.max(streakData.currentStreak, userProfile.highestBootcampStreak || 0, activeBootcamp?.longestStreak || 0)}
                onAcceptSubscription={handleAcceptGraduationSubscription}
                onDecline={handleDeclineGraduationSubscription}
                onClose={handleCloseGraduationModal}
            />
        )}

        {promotionDiplomaModalData && currentUser && (
            <BootcampDiplomaModal
                rankDef={promotionDiplomaModalData.rankDef}
                userName={promotionDiplomaModalData.userName}
                streakDays={promotionDiplomaModalData.streakDays}
                onClose={() => {
                    closeModalState('diploma', () => {
                      if (currentUser && promotionDiplomaModalData) {
                        localStorage.setItem(`seenRankPromo_${promotionDiplomaModalData.rankDef.req}_${currentUser.uid}`, 'true');
                      }
                      setPromotionDiplomaModalData(null);
                    });
                }}
                onShareInFeed={async (data) => {
                    if (currentUser) {
                      try {
                        const { addTimelineEvent } = await import('./services/firestoreService');
                        await addTimelineEvent(currentUser.uid, {
                          type: 'achievement',
                          timestamp: Date.now(),
                          title: `har befordrats till ${data.rankDef.name}! 🎖️`,
                          description: `Har erhållit befordringsbevis för ${data.streakDays} dagar i följd i Generalens Bootcamp! "${data.rankDef.quote}"`,
                          icon: '🎖️',
                          relatedDocId: `diploma_${data.rankDef.name.toLowerCase()}`
                        });
                        setToastNotification({ message: 'Diplomet har delats i flödet! 🎉', type: 'success' });
                        localStorage.setItem(`seenRankPromo_${data.rankDef.req}_${currentUser.uid}`, 'true');
                      } catch (e) {
                        console.error('Kunde inte dela i flödet:', e);
                        setToastNotification({ message: 'Gick inte att dela i flödet just nu.', type: 'error' });
                      }
                    }
                }}
                isNewPromotion={true}
            />
        )}

      </div>
      {(appStatus === AppStatus.ANALYZING || appStatus === AppStatus.ANALYZING_INGREDIENTS || appStatus === AppStatus.SAVING) && (
        <LoadingSpinner message={appStatus === AppStatus.ANALYZING ? "Analyserar bild..." : appStatus === AppStatus.ANALYZING_INGREDIENTS ? "Hittar recept från dina bilder..." : "Sparar..."} />
      )}
      {splashEffect && <WaterSplashEffect key={splashEffect.id} x={splashEffect.x} y={splashEffect.y} count={splashEffect.count} onComplete={() => setSplashEffect(null)} />}
      {toastNotification && <ToastNotification message={toastNotification.message} type={toastNotification.type} onClose={() => setToastNotification(null)} onClick={toastNotification.onClick} />}
      {showConfetti && <ConfettiCelebration isActive={showConfetti} />}
       {showInstallBanner && (
        <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 pt-6 shadow-[0_2px_10px_rgba(0,0,0,0.1)] z-[60] animate-slide-down-fade-in">
            <div className="max-w-4xl mx-auto relative">
                <div className="flex items-start gap-3">
                    <InstallIcon className="w-12 h-12 text-primary flex-shrink-0" />
                    <div className="pr-16">
                        <h3 className="font-bold text-neutral-dark">Installera Kostloggen</h3>
                        <p className="text-sm text-neutral leading-tight">Få en bättre upplevelse genom att lägga till appen på din hemskärm.</p>
                    </div>
                </div>
                <div className="absolute top-0 right-0 flex items-center gap-1">
                    <button onClick={handleDismissInstallBanner} className="p-2 text-xs font-medium text-neutral hover:text-neutral-dark hover:bg-neutral-light/70 rounded-md">Senare</button>
                    <button onClick={handleInstallClick} className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded-lg shadow-sm active:scale-95 transition-transform">Installera</button>
                </div>
            </div>
        </div>
      )}
      {showIosInstallPrompt && <IosInstallPrompt onClose={handleCloseIosInstallPrompt} />}
    </>
  );
};
