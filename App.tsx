
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
  LoggedMeal
} from './types.ts';

import {
  DEFAULT_GOALS, LOCAL_STORAGE_KEYS, DEFAULT_WATER_GOAL_ML,
  DEFAULT_USER_PROFILE, LEVEL_DEFINITIONS, MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD,
  ACHIEVEMENT_DEFINITIONS, COACH_PERSONAS, VAPID_PUBLIC_KEY
} from './constants.ts';

import { getAIFeedback } from './services/geminiService.ts';

import {
  fetchWaterLog,
  saveProfileAndGoals, saveWeightLog, updateUserDocument, saveCourseProgress,
  listenForFriendRequests,
  fetchCommunityTimeline, fetchBuddyDetailsList, fetchMealLogsForDate,
  setPastDaySummary, savePushSubscription, unlockAchievement
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
import GamificationModal from './components/GamificationModal.tsx';
import SubscriptionModal from './components/SubscriptionModal.tsx';

import { calculateGoalTimeline } from './utils/timelineUtils.ts';
import { getWeekInfo, getDateUID } from './utils/dateUtils.ts';
import { initAudio, playAudio } from './services/audioService.ts';
import {
  InformationCircleIcon, AICoachIcon,
  PencilIcon,
  BellIcon, InstallIcon, LifebuoyIcon, ArrowRightOnRectangleIcon, SwitchHorizontalIcon, SparklesIcon, TrophyIcon, CreditCardIcon
} from './components/icons.tsx';
import { Home, Footprints, Users, GraduationCap } from "lucide-react";
import Dashboard from './pages/Dashboard';

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
                    className="flex-1 px-5 py-3 text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
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
    highestLevelId,
    unlockedAchievements,
    achievementInteractions,
    userCourseProgress, setUserCourseProgress,
    hasCompletedOnboarding, setHasCompletedOnboarding,
    userRole,
    userStatus,
    mentalWellbeingLogs,
    isDataLoading,
    isInitialDataLoaded,
    resetUserData,
  } = useUserContext();

  // Local UI State
  const [viewingDate, setViewingDate] = useState<Date>(() => new Date()); 
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [currentInterface, setCurrentInterface] = useState<'member' | 'coach'| 'admin'>('member');
  
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [splashEffect, setSplashEffect] = useState<{ x: number, y: number, count: number, id: number } | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
  
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState<boolean>(false);
  const [isProfileModalOnboarding, setIsProfileModalOnboarding] = useState(false);
  const [showGamificationModal, setShowGamificationModal] = useState(false); 
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const [journeyInitialTab, setJourneyInitialTab] = useState<'calendar' | 'profile' | 'achievements'>('calendar');

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
  
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [communityViewKey] = useState(Date.now());
  const [communityInitialTab] = useState<'flode' | 'hantera'>('flode');
  const [communityInitialSubTab] = useState<'buddies' | 'search' | 'requests'>('buddies');
  const [highlightEventId] = useState<string | null>(null);
  const [lastCommunityViewTimestamp, setLastCommunityViewTimestamp] = useState<number | null>(null);
  const previousViewModeRef = useRef<ViewMode>(viewMode);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [buddyDetails, setBuddyDetails] = useState<BuddyDetails[]>([]);
  const [communityNotificationCount] = useState(0);
  const [isLoadingCommunityData, setIsLoadingCommunityData] = useState(true);

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
    const goalBasedMin = (goals.calorieGoal || 2000) * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
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
        if (!currentUser || !isInitialDataLoaded || userRole === 'coach' || userStatus !== 'approved') return;

        const checkAndUnlockLessons = async () => {
            const batch = writeBatch(db);
            let hasUnlockedAny = false;

            // 1. Praktisk Viktkontroll (Streak-baserad)
            const pvLessons = courseLessons;
            let lastStreakAtUnlock = 0;
            let lastUnlockedIdx = -1;

            for (let i = 0; i < pvLessons.length; i++) {
                const lessonId = pvLessons[i].id;
                const prog = userCourseProgress[lessonId];
                if (prog?.unlockedAt) {
                    lastUnlockedIdx = i;
                    lastStreakAtUnlock = prog.streakAtUnlock ?? 0;
                } else {
                    const isFirstLesson = i === 0;
                    if (isFirstLesson) break; 

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


    useEffect(() => {
        setViewingDate(new Date(currentDate));
    }, [currentDate]);


const handleSubscribeToPush = async (): Promise<boolean> => {
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
        setToastNotification({ message: body ? `${title}: ${body}` : title, type: 'success' });
        playAudio('logSuccess', 0.8);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => { navigator.serviceWorker.removeEventListener('message', handleMessage); };
  }, []); 

  const handleFirestoreError = (error: any, operation: string) => {
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
            // FIX: Removed redundant filtering. The Firestore query already filters by 'visibleTo'.
            setTimelineEvents(events);
            setBuddyDetails(details);
        } catch (error) {
            console.error("Failed to load community data:", error);
            setToastNotification({ message: "Kunde inte ladda flödet. Kontrollera din anslutning.", type: 'error' });
        } finally {
            setIsLoadingCommunityData(false);
        }
    }, [currentUser, setToastNotification]); // Added setToastNotification to deps

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'community') {
      setViewMode('community');
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (params.get('payment_success') === 'true' && userStatus === 'approved') {
        setToastNotification({ message: "Betalning bekräftad! Välkommen in!", type: 'success' });
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('payment_success');
        window.history.replaceState({}, '', newUrl.pathname + newUrl.search);
    }
  }, [userStatus, setToastNotification]);

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
    
    // Aktivera laddningsläget direkt om vi är i onboarding för att modalens knapp ska reagera
    if (isProfileModalOnboarding) {
        setAIFeedbackLoading(true);
    }

    const updatedProfile = { ...profileData };
    if (newPhotoDataUrl) {
        updatedProfile.photoURL = newPhotoDataUrl;
    }

    try {
        await saveProfileAndGoals(currentUser.uid, updatedProfile, newGoals);
        setUserProfile(updatedProfile);
        setGoals(newGoals);

        if (isProfileModalOnboarding) {
            setOnboardingStep('feedback');
            setAppStatus(AppStatus.ANALYZING_FEEDBACK);

            try {
                const feedback = await getAIFeedback({
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
                setAppStatus(AppStatus.IDLE);
            }
        } else {
            setShowUserProfileModal(false);
            setToastNotification({ message: "Profil sparad!", type: 'success' });
            setAppStatus(AppStatus.IDLE);
        }
    } catch (error: any) {
       handleFirestoreError(error, 'spara profil');
       setAppStatus(AppStatus.IDLE);
       setAIFeedbackLoading(false);
    }
  };

  const handleFinishOnboarding = async () => {
    if (!currentUser) return;
    setShowOnboardingCompletion(false);
    setShowAIFeedbackModal(false);
    setShowUserProfileModal(false); 
    setHasCompletedOnboarding(true);
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
        await updateUserDocument(currentUser.uid, { 
          hasCompletedOnboarding: true,
          summaryStartDate: todayUID, // Set start date for report processing to TODAY
          lastDateStreakChecked: todayUID, // Set this to today so morning report for "yesterday" won't trigger immediately
          role: userRole || 'member', 
          status: userStatus || 'approved' 
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

  useEffect(() => {
    if (!checklistState || !currentUser || !isInitialDataLoaded) return;
    const allComplete = Object.values(checklistState.items).every(Boolean);
    if (allComplete && !checklistState.dismissed) {
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

  const handleOnboardingNavigate = (view: 'journey' | 'community') => {
    if (view === 'community') {
         updateChecklistItem('communityViewed');
    } else { 
        updateChecklistItem('journeyViewed');
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
        } catch (e) {
            console.error("Failed to activate course", e);
        }
    }

    setActiveCourse(course);
    setViewMode('courseOverview');
    playAudio('uiClick');
  };

  const handleCloseLessonDetail = () => {
    setViewMode('courseOverview');
    setCurrentLessonId(null);
  };

  const handleSelectLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
    setViewMode('lessonDetail');
  };


  const handleToggleFocusPoint = async (lessonId: string, focusPointId: string) => {
    if (!currentUser) return;
    playAudio('uiClick');

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
      
      setUserCourseProgress(prev => ({
          ...prev,
          [lessonId]: updatedProgress as any
      }));
      
      try {
          await saveCourseProgress(currentUser.uid, lessonId, updatedProgress as any, userRole || 'member', userStatus || 'approved');
      } catch (error) {}
  };

  const handleOpenSpeedDial = () => {
    setViewMode('main'); 
  };

  const handleNavigateToJourney = (tab: 'calendar' | 'profile' | 'achievements') => {
    setJourneyInitialTab(tab);
    setViewMode('journey');
  };

  const handleOpenLogWeightModal = () => {
    openModal(setShowLogWeightModal);
  };
  
  const handleNavigateToMainWithDate = (date: Date) => {
    setViewingDate(date);
    setViewMode('main');
  };

  const handleUseStreakSaver = async () => {
      setDayToPotentiallySave(null);
  };

  const handleSaveWeightLog = async (data: Omit<WeightLogEntry, 'id'>) => {
    if (!currentUser) return;
    setAppStatus(AppStatus.SAVING); 
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
        if (!userProfile.mainGoalCompleted && userProfile.goalStartWeight && userProfile.desiredWeightChangeKg) {
             const isWeightLoss = userProfile.goalType === 'lose_fat';
             const isMuscleGain = userProfile.goalType === 'gain_muscle';
             let goalMet = false;
             const targetWeight = userProfile.goalStartWeight + userProfile.desiredWeightChangeKg;

             if (isWeightLoss && data.weightKg <= targetWeight) goalMet = true;
             if (isMuscleGain && data.weightKg >= targetWeight) goalMet = true;

             if (goalMet) {
                const ach = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'main_goal_reached');
                if (ach) {
                    const unlocked = await unlockAchievement(currentUser.uid, ach.id, ach.name, ach.icon, ach.description);
                    if (unlocked) {
                        setShowConfetti(true);
                        setShowGoalMetModalData({ date: new Date().toISOString().split('T')[0], streak: streakData.currentStreak });
                        playAudio('levelUp');
                        setUserProfile(prev => ({ ...prev, mainGoalCompleted: true }));
                        await updateUserDocument(currentUser.uid, { mainGoalCompleted: true });
                    }
                }
             }
        }

    } catch (error) {
        setToastNotification({ message: "Kunde inte spara mätningen.", type: 'error' });
    } finally {
        setAppStatus(AppStatus.IDLE);
    }
  };

  const handleSaveWellbeingAndProceed = async (data: MentalWellbeingData) => {
      if(!currentUser) return;
      try {
          // You might want to save this to Firestore here as well, 
          // but based on App.tsx, the saving logic seems to be missing or implied.
          // Assuming `addMentalWellbeingLog` is available or similar.
          // For now, just close modal and open weight log as requested.
          setShowMentalWellbeingModal(false);
          setShowLogWeightModal(true); // Chain to weight log
      } catch(e) {
          console.error(e);
      }
  };

  const handleCloseUserProfileModal = () => {
    if (isProfileModalOnboarding && onboardingStep === 'feedback') {
        handleFinishOnboarding();
    } else {
        setShowUserProfileModal(false);
        setOnboardingStep('form');
    }
  };

const ensureWeeklyBankReset = useCallback(async () => {
    if (!currentUser || !isInitialDataLoaded || userRole === 'coach' || userStatus !== 'approved') return;

    const now = new Date();
    const currentWeek = getWeekInfo(now);

    if (weeklyBank.weekId !== currentWeek.weekId) {
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
        } catch (error) {}
    }
}, [currentUser, isInitialDataLoaded, userRole, userStatus, weeklyBank.weekId, setWeeklyBank]);

useEffect(() => {
    ensureWeeklyBankReset();
}, [ensureWeeklyBankReset]);

const ensureYesterdayProcessed = useCallback(async (uid: string, now = new Date(), options: ProcessDayEndLogicOptions = {}, manualLogOverride?: LoggedMeal[]): Promise<void> => {
    if (!uid || userRole === 'coach' || userStatus !== 'approved' || !hasCompletedOnboarding) return;

    const { start: yesterdayStart, yKey: yesterdayUID } = yesterdayRangeSE(now);
    
    const isAlreadyChecked = streakData.lastDateStreakChecked === yesterdayUID;

    // Guard: Only skip if yesterday is BEFORE the summary start date.
    // If summaryStartDate is missing (legacy users), we allow processing.
    if (summaryStartDate && yesterdayUID < summaryStartDate && !isAlreadyChecked) {
        return;
    }
    
    setIsSummarizingYesterday(true);

    try {
        // STRATEGI: Kolla först om rapporten redan finns (t.ex. skapad av backend eller tidigare session)
        // Om den finns, använd den direkt för att laga streak och visa modal, istället för att räkna om allt.
        let summary: PastDaySummary | undefined = pastDaysSummary[yesterdayUID];
        let totals = { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };
        let waterAmount = 0;

        if (!summary) {
            // Ingen rapport finns, gör full beräkning
            const [yesterdayMeals, yesterdayWater] = await Promise.all([
                fetchMealLogsForDate(uid, yesterdayUID),
                fetchWaterLog(uid, yesterdayUID)
            ]);
            waterAmount = yesterdayWater;

            const mealsToProcess = manualLogOverride || yesterdayMeals;

            totals = mealsToProcess.reduce((acc, meal) => ({
                calories: acc.calories + meal.nutritionalInfo.calories,
                protein: acc.protein + meal.nutritionalInfo.protein,
                carbohydrates: acc.carbohydrates + meal.nutritionalInfo.carbohydrates,
                fat: acc.fat + meal.nutritionalInfo.fat,
            }), { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });

            const minSafe = Math.max((goals.calorieGoal || 2000) * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD);
            
            let goalMet = false;
            let usedFromBank = 0;
            let savedBy: "sparpott" | undefined = undefined;

            if (totals.calories >= minSafe) {
                if (userProfile.goalType === 'lose_fat' || userProfile.goalType === 'maintain') {
                    if (totals.calories <= goals.calorieGoal) {
                        goalMet = true;
                    } else {
                        const excess = totals.calories - goals.calorieGoal;
                        if (weeklyBank.bankedCalories >= excess) {
                            goalMet = true;
                            usedFromBank = Math.round(excess);
                            savedBy = 'sparpott';
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

            // Skapa nytt summary-objekt
            const hasLogs = mealsToProcess.length > 0;
            
            // Streak-logik för ny beräkning
            let finalNewStreak = 0;
            const dayBeforeYesterday = new Date(yesterdayStart);
            dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
            const dayBeforeYesterdayUID = dayKeySE(dayBeforeYesterday);
            
            // Om vi missat en dag emellan, nollställs basen. Annars är basen nuvarande streak.
            // Men om streaken redan ÄR uppdaterad (isAlreadyChecked), rör vi den inte här nere.
            let baseStreak = streakData.currentStreak;
            
            if (!isAlreadyChecked && streakData.lastDateStreakChecked !== dayBeforeYesterdayUID && streakData.lastDateStreakChecked !== yesterdayUID) {
                 baseStreak = 0;
            }

            if (hasLogs) {
                finalNewStreak = baseStreak + 1;
            } else {
                finalNewStreak = 0;
            }

            summary = {
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
                waterGoalMet: waterAmount >= DEFAULT_WATER_GOAL_ML,
                streakForThisDay: finalNewStreak, 
                bankedAmount: bankedAmount,
                savedBy: savedBy
            };

            // Spara till Firestore (bara om vi skapade en ny)
            await setPastDaySummary(uid, yesterdayUID, summary);
            setPastDaysSummary(prev => ({ ...prev, [yesterdayUID]: summary! }));

            // Uppdatera bank om det behövs (bara vid ny beräkning)
            if (!isAlreadyChecked) {
                const userUpdates: any = {};
                if (bankedAmount > 0) {
                    userUpdates["weeklyBank.bankedCalories"] = increment(bankedAmount);
                    setWeeklyBank(prev => ({
                        ...prev,
                        bankedCalories: prev.bankedCalories + bankedAmount
                    }));
                } else if (usedFromBank > 0) {
                    userUpdates["weeklyBank.bankedCalories"] = increment(-usedFromBank);
                    setWeeklyBank(prev => ({
                        ...prev,
                        bankedCalories: Math.max(0, prev.bankedCalories - usedFromBank)
                    }));
                }
                if (Object.keys(userUpdates).length > 0) {
                    await updateUserDocument(uid, userUpdates);
                }
            }
        } 

        // --- HÄR KOMMER REPARATIONS- OCH VISNINGSLOGIKEN ---
        // Oavsett om vi hämtade en befintlig rapport eller skapade en ny:
        // Se till att streaken är korrekt och visa modalen.

        if (summary) {
            // Om streaken inte är uppdaterad än, gör det nu baserat på rapporten
            if (!isAlreadyChecked) {
                // Beräkna streak baserat på om det fanns aktivitet i rapporten
                // (Vi antar att consumedCalories > 0 betyder aktivitet)
                let calculatedStreak = streakData.currentStreak;
                
                const dayBeforeYesterday = new Date(yesterdayStart);
                dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
                const dayBeforeYesterdayUID = dayKeySE(dayBeforeYesterday);

                // Reset om vi missat dagar
                if (streakData.lastDateStreakChecked !== dayBeforeYesterdayUID) {
                    calculatedStreak = 0;
                }

                if (summary.consumedCalories > 0) {
                    calculatedStreak += 1;
                } else {
                    calculatedStreak = 0;
                }

                // Uppdatera state och DB
                setStreakData({ currentStreak: calculatedStreak, lastDateStreakChecked: yesterdayUID });
                
                // Uppdatera själva rapporten med streaken om den saknades (för bakåtkompatibilitet)
                if (summary.streakForThisDay !== calculatedStreak) {
                     summary.streakForThisDay = calculatedStreak;
                }

                await updateUserDocument(uid, {
                    currentStreak: calculatedStreak,
                    lastDateStreakChecked: yesterdayUID
                });

                // Kolla achievements
                const streakAch = ACHIEVEMENT_DEFINITIONS.find(a => a.type === 'streak' && a.requiredValue === calculatedStreak);
                if (streakAch) {
                    const unlocked = await unlockAchievement(uid, streakAch.id, streakAch.name, streakAch.icon, streakAch.description);
                    if (unlocked) {
                        setToastNotification({ message: `Bragd upplåst: ${streakAch.name}!`, type: 'success' });
                    }
                }
                
                // Visa modalen eftersom detta är "nyheten" för användaren idag
                setMorningReportData({ summary, currentStreak: calculatedStreak });
                playAudio('levelUp');
            } else {
                // Om streaken redan VAR checkad (backend hann före), men vi är här (för att modalen inte visats?)
                // Visa modalen ändå om vi anropades manuellt eller via self-healing
                setMorningReportData({ summary, currentStreak: streakData.currentStreak });
            }
        }

    } catch (error) {
        console.error("Error summarizing yesterday:", error);
        setToastNotification({ message: "Kunde inte sammanställa gårdagen.", type: 'error' });
    } finally {
        setIsSummarizingYesterday(false);
    }
}, [currentUser?.uid, userRole, userStatus, goals, userProfile, summaryStartDate, hasCompletedOnboarding, setPastDaysSummary, setStreakData, setWeeklyBank, setToastNotification, weeklyBank.bankedCalories, streakData.lastDateStreakChecked, streakData.currentStreak, pastDaysSummary]);

    useEffect(() => {
        if (currentUser && isInitialDataLoaded && userStatus === 'approved' && hasCompletedOnboarding) {
            const yesterdayUID = dayKeySE(new Date(Date.now() - 86400000));
            
            // Trigger if:
            // 1. Streak NOT updated for yesterday
            // 2. OR Summary for yesterday is MISSING in local state (self-healing)
            const isStreakUpdated = streakData.lastDateStreakChecked === yesterdayUID;
            const hasSummary = !!pastDaysSummary[yesterdayUID];

            if (!isStreakUpdated || !hasSummary) {
                ensureYesterdayProcessed(currentUser.uid, new Date());
            }
        }
    }, [currentUser, isInitialDataLoaded, userStatus, hasCompletedOnboarding, streakData.lastDateStreakChecked, pastDaysSummary, ensureYesterdayProcessed]);

  
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

        if (currentUser && userProfile.goalType !== 'gain_muscle') {
             try {
                await updateUserDocument(currentUser.uid, {
                    "weeklyBank.bankedCalories": increment(100)
                });
                setWeeklyBank(prev => ({ ...prev, bankedCalories: prev.bankedCalories + 100 }));
                setToastNotification({ message: "100 kcal bonus tillagd i din sparpott!", type: 'success' });
                playAudio('calorieBank');
             } catch (e) {}
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
  const currentLesson = lessonsForOverview.find(l => l.id === currentLessonId);

  const coachName = userProfile.coachStyle ? COACH_PERSONAS[userProfile.coachStyle].label : 'Din Coach';

  return (
    <>
      <div className="min-h-screen bg-neutral-light bg-dotted-pattern bg-dotted-size bg-fixed flex flex-col items-center pb-0">
       <header className="w-full bg-white text-neutral-dark py-2 px-4 shadow-lg sticky top-0 z-30">
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
                                    icon={<TrophyIcon />}
                                    label="Streak & Rekord"
                                    onClick={() => {
                                        playAudio('uiClick');
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
                                            className="text-indigo-600 hover:bg-indigo-50 font-medium"
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
          ? "w-full flex-grow flex flex-col h-full" 
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
                onOpenAICoach={() => { setShowAICoachModal(true); setCoachInitialContext(null); }}
                isSummarizingYesterday={isSummarizingYesterday}
                isAICoachOpen={showAICoachModal}
                isProfileOpen={showUserProfileModal}
                isMorningReportOpen={!!morningReportData}
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
                highestStreak={streakData.currentStreak} 
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
            />
         )}
         {viewMode === 'coursesView' && (
            <CoursesView
                userProfile={userProfile}
                userProgress={userCourseProgress}
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
              currentStreak={streakData.currentStreak}
            />
         )}
        </main>
        
        {showLatestUpdateView && <UpdateNoticeModal show={showLatestUpdateView} onClose={() => setShowLatestUpdateView(false)} onNavigateToCourses={handleNavigateToCourses} />}
        {showOnboardingRewardModal && <OnboardingRewardModal show={showOnboardingRewardModal} onClose={handleCloseOnboardingRewardModal} goalType={userProfile.goalType} />}
        {dayToPotentiallySave && <UseStreakSaverModal show={!!dayToPotentiallySave} onClose={() => setDayToPotentiallySave(null)} onConfirm={handleUseStreakSaver} daySummary={dayToPotentiallySave} />}
        {showMotivationModal && <MotivationModal show={!!showMotivationModal} onClose={() => setShowMotivationModal(null)} daySummary={showMotivationModal} />}
        {morningReportData && <MorningReportModal show={!!morningReportData} onClose={() => setMorningReportData(null)} summary={morningReportData.summary} currentStreak={morningReportData.currentStreak} userProfile={userProfile} />}
        {showInfoModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => closeModal(setShowInfoModal)}><InfoModal onClose={() => closeModal(setShowInfoModal)} userName={userProfile.name} /></div>}
        {showUserProfileModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={handleCloseUserProfileModal}><div onClick={e => e.stopPropagation()} className="animate-scale-in"><UserProfileModal initialProfile={userProfile} onSave={handleSaveProfileAndGoals} onClose={handleCloseUserProfileModal} isOnboarding={isProfileModalOnboarding} onboardingStep={onboardingStep} aiFeedbackLoading={aiFeedbackLoading} aiFeedbackMessage={aiFeedbackMessage} aiFeedbackError={aiFeedbackError} onSubscribeToPush={handleSubscribeToPush} /></div></div>}
        {showOnboardingCompletion && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={handleFinishOnboarding}><div onClick={e => e.stopPropagation()} className="animate-scale-in"><OnboardingCompletionScreen onFinish={handleFinishOnboarding} coachName={coachName} /></div></div>}
        {showLevelUpModal && <LevelUpModal level={showLevelUpModal} onClose={() => setShowLevelUpModal(null)} />}
        {showGoalMetModalData && <GoalMetModal data={showGoalMetModalData} onClose={() => setShowGoalMetModalData(null)} />}
        {newlyUnlockedLesson && <NewLessonUnlockedModal lessonTitle={newlyUnlockedLesson.title} onClose={() => setNewlyUnlockedLesson(null)} />}
        {showAIFeedbackModal && <AIFeedbackModal show={showAIFeedbackModal} onClose={() => { if (isProfileModalOnboarding) { handleFinishOnboarding(); } else { setShowAIFeedbackModal(false); } }} feedbackMessage={aiFeedbackMessage} isLoading={aiFeedbackLoading} error={aiFeedbackError} modalTitle={aiModalTitle} modalIcon={aiModalIcon} isOnboardingContext={isProfileModalOnboarding} showDiscussButton={aiModalTitle === "Analys av din mätning"} onDiscuss={() => { playAudio('uiClick'); setShowAIFeedbackModal(false); setCoachInitialContext({ type: 'from_analysis' }); setViewMode('journey'); setShowAICoachModal(true); }} />}
        {showLogWeightModal && <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => closeModal(setShowLogWeightModal)}><LogWeightModal show={showLogWeightModal} onClose={() => closeModal(setShowLogWeightModal)} onSave={handleSaveWeightLog} measurementMethod={userProfile.measurementMethod} /></div>}
        {showMentalWellbeingModal && <MentalWellbeingModal show={showMentalWellbeingModal} onClose={() => setShowMentalWellbeingModal(false)} onSave={handleSaveWellbeingAndProceed} />}
        <AICoachModal show={showAICoachModal} onClose={() => { setShowAICoachModal(false); setCoachInitialContext(null); }} analysisContext={{ userProfile, goals, allWeightLogs: weightLogs, last30DaysSummaries: Object.values(pastDaysSummary), mentalWellbeingLogs, goalTimeline: calculateGoalTimeline(userProfile), currentStreak: streakData.currentStreak }} initialContext={coachInitialContext} />
        {showGamificationModal && (
            <GamificationModal
                show={showGamificationModal}
                onClose={() => closeModal(setShowGamificationModal)}
                currentStreak={streakData.currentStreak}
                highestStreak={highestStreak}
                highestLevelId={highestLevelId}
            />
        )}
        {showSubscriptionModal && (
            <SubscriptionModal 
                show={showSubscriptionModal} 
                onClose={() => setShowSubscriptionModal(false)} 
                status={userProfile.subscriptionStatus || 'active'} 
                currentPeriodEnd={userProfile.currentPeriodEnd}
            />
        )}

      </div>
      {(appStatus === AppStatus.ANALYZING || appStatus === AppStatus.ANALYZING_INGREDIENTS || appStatus === AppStatus.SAVING) && (
        <LoadingSpinner message={appStatus === AppStatus.ANALYZING ? "Analyserar bild..." : appStatus === AppStatus.ANALYZING_INGREDIENTS ? "Hittar recept från dina bilder..." : "Sparar..."} />
      )}
      {splashEffect && <WaterSplashEffect key={splashEffect.id} x={splashEffect.x} y={splashEffect.y} count={splashEffect.count} onComplete={() => setSplashEffect(null)} />}
      {toastNotification && <ToastNotification message={toastNotification.message} type={toastNotification.type} onClose={() => setToastNotification(null)} />}
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
