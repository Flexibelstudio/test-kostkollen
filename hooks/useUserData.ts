
import { useState, useEffect, useCallback } from 'react';
import { 
    UserProfileData, GoalSettings, LoggedMeal, PastDaysSummaryCollection, 
    WeightLogEntry, CommonMeal, UserCourseProgress, WeeklyCalorieBank, 
    StreakSaver, MentalWellbeingLog, UserRole, AIStructuredFeedbackResponse, 
    Reactions 
} from '../types';
import { 
    DEFAULT_GOALS, DEFAULT_USER_PROFILE 
} from '../constants';
import { 
    fetchInitialAppData, ensureUserProfileInFirestore 
} from '../services/firestoreService';
import { getWeekInfo } from '../utils/dateUtils';
import { auth } from '../firebase'; // Import auth to get current user details

export interface UseUserDataReturn {
    // State
    goals: GoalSettings;
    setGoals: React.Dispatch<React.SetStateAction<GoalSettings>>;
    userProfile: UserProfileData;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfileData>>;
    dailyLog: LoggedMeal[];
    setDailyLog: React.Dispatch<React.SetStateAction<LoggedMeal[]>>;
    waterLoggedMl: number;
    setWaterLoggedMl: React.Dispatch<React.SetStateAction<number>>;
    commonMeals: CommonMeal[];
    setCommonMeals: React.Dispatch<React.SetStateAction<CommonMeal[]>>;
    weightLogs: WeightLogEntry[];
    setWeightLogs: React.Dispatch<React.SetStateAction<WeightLogEntry[]>>;
    pastDaysSummary: PastDaysSummaryCollection;
    setPastDaysSummary: React.Dispatch<React.SetStateAction<PastDaysSummaryCollection>>;
    streakData: { currentStreak: number; lastDateStreakChecked: string | null };
    setStreakData: React.Dispatch<React.SetStateAction<{ currentStreak: number; lastDateStreakChecked: string | null }>>;
    summaryStartDate: string | null;
    setSummaryStartDate: React.Dispatch<React.SetStateAction<string | null>>;
    weeklyBank: WeeklyCalorieBank;
    setWeeklyBank: React.Dispatch<React.SetStateAction<WeeklyCalorieBank>>;
    streakSaver: StreakSaver | null;
    setStreakSaver: React.Dispatch<React.SetStateAction<StreakSaver | null>>;
    highestStreak: number;
    setHighestStreak: React.Dispatch<React.SetStateAction<number>>;
    highestLevelId: string | null;
    setHighestLevelId: React.Dispatch<React.SetStateAction<string | null>>;
    unlockedAchievements: { [id: string]: string };
    setUnlockedAchievements: React.Dispatch<React.SetStateAction<{ [id: string]: string }>>;
    achievementInteractions: { [id: string]: { reactions: Reactions } };
    setAchievementInteractions: React.Dispatch<React.SetStateAction<{ [id: string]: { reactions: Reactions } }>>;
    userCourseProgress: UserCourseProgress;
    setUserCourseProgress: React.Dispatch<React.SetStateAction<UserCourseProgress>>;
    hasCompletedOnboarding: boolean;
    setHasCompletedOnboarding: React.Dispatch<React.SetStateAction<boolean>>;
    userRole: UserRole | null;
    setUserRole: React.Dispatch<React.SetStateAction<UserRole | null>>;
    userStatus: 'pending' | 'approved' | 'archived' | null;
    setUserStatus: React.Dispatch<React.SetStateAction<'pending' | 'approved' | 'archived' | null>>;
    journeyAnalysisFeedback: AIStructuredFeedbackResponse | null;
    setJourneyAnalysisFeedback: React.Dispatch<React.SetStateAction<AIStructuredFeedbackResponse | null>>;
    mentalWellbeingLogs: MentalWellbeingLog[];
    setMentalWellbeingLogs: React.Dispatch<React.SetStateAction<MentalWellbeingLog[]>>;
    
    // Loading states
    isDataLoading: boolean;
    isInitialDataLoaded: boolean;
    setIsInitialDataLoaded: React.Dispatch<React.SetStateAction<boolean>>;
    
    // Actions
    resetUserData: () => void;
    refreshUserData: () => Promise<void>;
}

export const useUserData = (userId: string | undefined, currentDate: Date): UseUserDataReturn => {
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);

    // Data State
    const [goals, setGoals] = useState<GoalSettings>(DEFAULT_GOALS);
    const [userProfile, setUserProfile] = useState<UserProfileData>(DEFAULT_USER_PROFILE);
    const [dailyLog, setDailyLog] = useState<LoggedMeal[]>([]);
    const [waterLoggedMl, setWaterLoggedMl] = useState<number>(0);
    const [commonMeals, setCommonMeals] = useState<CommonMeal[]>([]);
    const [weightLogs, setWeightLogs] = useState<WeightLogEntry[]>([]);
    const [pastDaysSummary, setPastDaysSummary] = useState<PastDaysSummaryCollection>({});
    const [streakData, setStreakData] = useState<{ currentStreak: number; lastDateStreakChecked: string | null }>({ currentStreak: 0, lastDateStreakChecked: null });
    const [summaryStartDate, setSummaryStartDate] = useState<string | null>(null);
    const [weeklyBank, setWeeklyBank] = useState<WeeklyCalorieBank>(() => {
        const { weekId, startDate, endDate } = getWeekInfo(currentDate);
        return { weekId, bankedCalories: 0, startDate, endDate };
    });
    const [streakSaver, setStreakSaver] = useState<StreakSaver | null>(null);
    const [highestStreak, setHighestStreak] = useState<number>(0);
    const [highestLevelId, setHighestLevelId] = useState<string | null>(null);
    const [unlockedAchievements, setUnlockedAchievements] = useState<{ [id: string]: string }>({});
    const [achievementInteractions, setAchievementInteractions] = useState<{ [id: string]: { reactions: Reactions } }>({});
    const [userCourseProgress, setUserCourseProgress] = useState<UserCourseProgress>({});
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [userStatus, setUserStatus] = useState<'pending' | 'approved' | 'archived' | null>(null);
    const [journeyAnalysisFeedback, setJourneyAnalysisFeedback] = useState<AIStructuredFeedbackResponse | null>(null);
    const [mentalWellbeingLogs, setMentalWellbeingLogs] = useState<MentalWellbeingLog[]>([]);

    const resetUserData = useCallback(() => {
        setGoals(DEFAULT_GOALS);
        setUserProfile(DEFAULT_USER_PROFILE);
        setDailyLog([]);
        setPastDaysSummary({});
        setStreakData({ currentStreak: 0, lastDateStreakChecked: null });
        setSummaryStartDate(null);
        setWaterLoggedMl(0);
        setUserCourseProgress({});
        setWeightLogs([]);
        setMentalWellbeingLogs([]);
        setCommonMeals([]);
        setHighestLevelId(null);
        setHighestStreak(0);
        setUnlockedAchievements({});
        setAchievementInteractions({});
        setHasCompletedOnboarding(false);
        setIsInitialDataLoaded(false);
        setUserStatus(null);
        setUserRole(null);
        setJourneyAnalysisFeedback(null);
        setStreakSaver(null);
    }, []);

    const refreshUserData = useCallback(async () => {
        if (!userId) {
            resetUserData();
            return;
        }

        setIsDataLoading(true);
        try {
            if (auth.currentUser) {
                await ensureUserProfileInFirestore(auth.currentUser);
            }
            
            const appData = await fetchInitialAppData(userId);

            if (appData) {
                setGoals(appData.goals || DEFAULT_GOALS);
                setUserProfile(appData.profile || DEFAULT_USER_PROFILE);
                setStreakData({
                    currentStreak: appData.currentStreak || 0,
                    lastDateStreakChecked: appData.lastDateStreakChecked || null,
                });
                setSummaryStartDate(appData.summaryStartDate || null);
                
                if (appData.weeklyBank) {
                    setWeeklyBank(appData.weeklyBank);
                }

                setStreakSaver(appData.streakSaver || null);
                setHighestStreak(appData.highestStreak || 0);
                setHighestLevelId(appData.highestLevelId || null);
                setCommonMeals(appData.commonMeals || []);
                setWeightLogs(appData.weightLogs || []);
                setMentalWellbeingLogs(appData.mentalWellbeingLogs || []);
                setPastDaysSummary(appData.pastDaySummaries || {});
                setUserCourseProgress(appData.courseProgress || {});
                setUnlockedAchievements(appData.unlockedAchievements || {});
                setAchievementInteractions(appData.achievementInteractions || {});
                setHasCompletedOnboarding(appData.hasCompletedOnboarding || false);
                setUserRole(appData.role || 'member');
                setUserStatus(appData.status || 'pending');
                setJourneyAnalysisFeedback(appData.journeyAnalysisFeedback || null);
                
                setIsInitialDataLoaded(true);
            } else {
                resetUserData();
            }
        } catch (error) {
            console.error("Error loading user data:", error);
        } finally {
            setIsDataLoading(false);
        }
        // Vi plockar bort weeklyBank från deps för att förhindra oändlig loop vid initial laddning
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, resetUserData]);

    // Initial fetch effect
    useEffect(() => {
        if (userId) {
             refreshUserData();
        } else {
             resetUserData();
             setIsDataLoading(false);
        }
    }, [userId, refreshUserData, resetUserData]);

    return {
        goals, setGoals,
        userProfile, setUserProfile,
        dailyLog, setDailyLog,
        waterLoggedMl, setWaterLoggedMl,
        commonMeals, setCommonMeals,
        weightLogs, setWeightLogs,
        pastDaysSummary, setPastDaysSummary,
        streakData, setStreakData,
        summaryStartDate, setSummaryStartDate,
        weeklyBank, setWeeklyBank,
        streakSaver, setStreakSaver,
        highestStreak, setHighestStreak,
        highestLevelId, setHighestLevelId,
        unlockedAchievements, setUnlockedAchievements,
        achievementInteractions, setAchievementInteractions,
        userCourseProgress, setUserCourseProgress,
        hasCompletedOnboarding, setHasCompletedOnboarding,
        userRole, setUserRole,
        userStatus, setUserStatus,
        journeyAnalysisFeedback, setJourneyAnalysisFeedback,
        mentalWellbeingLogs, setMentalWellbeingLogs,
        isDataLoading,
        isInitialDataLoaded,
        setIsInitialDataLoaded,
        resetUserData,
        refreshUserData
    };
};
