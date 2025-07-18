import { UserProfileData, GoalSettings, LoggedMeal, PastDaysSummaryCollection, WeightLogEntry, CommonMeal, UserCourseProgress, WeeklyCalorieBank, FirestoreUserDocument, UserRole, PastDaySummary, CoachViewMember, AIStructuredFeedbackResponse, PeppkompisRequest, Peppkompis } from '../types';
import { DEFAULT_GOALS, DEFAULT_USER_PROFILE, DEFAULT_WATER_GOAL_ML } from '../constants';
import { courseLessons } from '../courseData.ts';

const getDateUID = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const MOCK_USER_ID = 'mockUser123';

export const mockUserProfile: UserProfileData = {
    ...DEFAULT_USER_PROFILE,
    name: 'Mock Användare',
    currentWeightKg: 75,
    heightCm: 180,
    ageYears: 32,
    gender: 'male',
    activityLevel: 'moderate',
    goalType: 'lose_fat',
    desiredFatMassChangeKg: -5,
    goalCompletionDate: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0], // 60 days from now
    isCourseActive: true,
};

export const mockGoals: GoalSettings = {
    calorieGoal: 2200,
    proteinGoal: 150,
    carbohydrateGoal: 200,
    fatGoal: 80,
};

const today = new Date();
const yesterday = new Date();
yesterday.setDate(today.getDate() - 1);
const twoDaysAgo = new Date();
twoDaysAgo.setDate(today.getDate() - 2);

export const mockMealLogs: { [date: string]: LoggedMeal[] } = {
    [getDateUID(today)]: [
        { id: 'meal1', timestamp: Date.now() - 3600000, dateString: getDateUID(today), nutritionalInfo: { foodItem: 'Äggröra och rostat bröd', calories: 350, protein: 20, carbohydrates: 30, fat: 15 } },
        { id: 'meal2', timestamp: Date.now(), dateString: getDateUID(today), nutritionalInfo: { foodItem: 'Kycklingsallad', calories: 450, protein: 40, carbohydrates: 10, fat: 28 } },
    ],
    [getDateUID(yesterday)]: [
        { id: 'meal3', timestamp: Date.now() - 86400000, dateString: getDateUID(yesterday), nutritionalInfo: { foodItem: 'Havregrynsgröt med bär', calories: 300, protein: 10, carbohydrates: 55, fat: 5 } },
        { id: 'meal4', timestamp: Date.now() - 80000000, dateString: getDateUID(yesterday), nutritionalInfo: { foodItem: 'Lax med quinoa', calories: 600, protein: 45, carbohydrates: 40, fat: 30 } },
        { id: 'meal5', timestamp: Date.now() - 70000000, dateString: getDateUID(yesterday), nutritionalInfo: { foodItem: 'Grekisk Yoghurt', calories: 150, protein: 15, carbohydrates: 10, fat: 5 } },
    ]
};

export const mockPastDaySummaries: PastDaysSummaryCollection = {
    [getDateUID(yesterday)]: {
        date: getDateUID(yesterday),
        goalMet: true,
        consumedCalories: 2100,
        calorieGoal: 2200,
        proteinGoalMet: true,
        consumedProtein: 155,
        proteinGoal: 150,
        consumedCarbohydrates: 190,
        carbohydrateGoal: 200,
        consumedFat: 75,
        fatGoal: 80,
        goalType: 'lose_fat',
        waterGoalMet: true,
        streakForThisDay: 5,
    },
    [getDateUID(twoDaysAgo)]: {
        date: getDateUID(twoDaysAgo),
        goalMet: false,
        consumedCalories: 2500,
        calorieGoal: 2200,
        proteinGoalMet: true,
        consumedProtein: 160,
        proteinGoal: 150,
        consumedCarbohydrates: 250,
        carbohydrateGoal: 200,
        consumedFat: 90,
        fatGoal: 80,
        goalType: 'lose_fat',
        waterGoalMet: false,
        streakForThisDay: 4,
    }
};

export const mockWeightLogs: WeightLogEntry[] = [
    { id: 'w1', loggedAt: Date.now() - 14 * 86400000, weightKg: 76.5, skeletalMuscleMassKg: 35.1, bodyFatMassKg: 16.2 },
    { id: 'w2', loggedAt: Date.now() - 7 * 86400000, weightKg: 75.8, skeletalMuscleMassKg: 35.2, bodyFatMassKg: 15.5 },
    { id: 'w3', loggedAt: Date.now(), weightKg: 75.2, skeletalMuscleMassKg: 35.3, bodyFatMassKg: 14.9 },
];

export const mockCommonMeals: CommonMeal[] = [
    { id: 'cm1', name: 'Proteinsmoothie', nutritionalInfo: { foodItem: 'Proteinsmoothie', calories: 250, protein: 40, carbohydrates: 10, fat: 5 } },
    { id: 'cm2', name: 'Grekisk Yoghurt & Bär', nutritionalInfo: { foodItem: 'Grekisk Yoghurt & Bär', calories: 150, protein: 20, carbohydrates: 8, fat: 4 } },
];

export const mockCourseProgress: UserCourseProgress = {
    'lektion1': { completedFocusPoints: ['l1fp1', 'l1fp2'], reflectionAnswer: 'Mitt största hinder kommer att vara helgerna när rutinerna bryts.', isCompleted: true, whyAnswer: 'För att ha mer energi och vara en förebild för mina barn.', smartGoalAnswer: "Jag ska minska min fettmassa med 5 kg till den 31 december genom att logga min mat varje dag och styrketräna 3 gånger i veckan." },
    'lektion2': { completedFocusPoints: ['l2fp1'], reflectionAnswer: 'Det fungerade bra att planera in promenader.', isCompleted: false }
};

export const mockWaterLogs: { [date: string]: number } = {
    [getDateUID(today)]: 1000,
    [getDateUID(yesterday)]: DEFAULT_WATER_GOAL_ML,
};

export const mockWeeklyBank: WeeklyCalorieBank = {
    weekId: "2024-W30",
    bankedCalories: 500,
    startDate: '2024-07-22',
    endDate: '2024-07-28',
};

export const mockJourneyFeedback: AIStructuredFeedbackResponse = {
    greeting: "Hej Mock Användare!",
    sections: [
        { emoji: "⭐", title: "Helhetsbild & Uppmuntran", content: "Du gör ett fantastiskt jobb med att logga regelbundet!" },
        { emoji: "📈", title: "Viktutveckling & Trender", content: "Din vikt har en stadig nedåtgående trend. Bra jobbat!" },
        { emoji: "💪", title: "Muskelmassa & Kroppssammansättning", content: "Din muskelmassa är stabil, vilket är utmärkt under en viktnedgång." },
        { emoji: "🍽️", title: "Daglig Konsekvens & Näringsintag", content: "Ditt proteinintag är konsekvent bra. Fortsätt så!" },
        { emoji: "🧠", title: "Insikter & Kurskoppling", content: "Eftersom du är på en platå, kan Lektion 7 i kursen hjälpa dig vidare." },
        { emoji: "💡", title: "Konkreta Rekommendationer", content: "• Försök variera din träning denna vecka.\n• Lägg till 10g extra protein till din frukost." }
    ]
};

export const mockFirestoreUser: FirestoreUserDocument = {
    uid: MOCK_USER_ID,
    email: 'test@example.com',
    displayName: 'Mock Användare',
    role: 'member',
    status: 'approved',
    isCourseActive: true,
    hasCompletedOnboarding: true,
    createdAt: { toDate: () => new Date() } as any,
    lastLoginAt: { toDate: () => new Date() } as any,
    lastLogDate: getDateUID(yesterday),
    goals: mockGoals,
    goalType: 'lose_fat',
    ageYears: 32,
    gender: 'male',
    currentWeightKg: 75.2,
    measurementMethod: 'inbody',
    desiredWeightChangeKg: null,
    desiredFatMassChangeKg: -5,
    desiredMuscleMassChangeKg: 0,
    currentStreak: 5,
    lastDateStreakChecked: getDateUID(yesterday),
    highestStreak: 10,
    highestLevelId: 'level1',
    weeklyBank: mockWeeklyBank,
    courseProgressSummary: {
        started: true,
        completedLessons: 1,
        totalLessons: courseLessons.length
    },
    unlockedAchievements: {
      'streak_10': new Date().toISOString()
    },
    journeyAnalysisFeedback: mockJourneyFeedback,
};

export const mockCoachViewMembers: CoachViewMember[] = [
    { id: 'coach1', name: 'Mikael Coach', email: 'mikael@test.com', role: 'coach', status: 'approved', isCourseActive: false, memberSince: '2024-01-01', lastLogDate: getDateUID(yesterday), currentStreak: 100, goalSummary: 'Coach', proteinGoalMetPercentage7d: 100, goalAdherence: 'good', ageYears: 40, gender: 'male' },
    { id: 'member1', name: 'Anna Andersson', email: 'anna@test.com', role: 'member', status: 'approved', isCourseActive: true, memberSince: '2024-01-15', lastLogDate: getDateUID(yesterday), currentStreak: 12, goalSummary: '-8 kg fett', proteinGoalMetPercentage7d: 85, goalAdherence: 'good', courseProgressSummary: { started: true, completedLessons: 3, totalLessons: 12 }, weeklyWeightChange: -0.7, ageYears: 28, gender: 'female' },
    { id: 'member2', name: 'Bengt Bengtsson', email: 'bengt@test.com', role: 'member', status: 'pending', isCourseActive: false, memberSince: '2024-03-01', lastLogDate: undefined, currentStreak: 0, goalSummary: 'Ej satt', proteinGoalMetPercentage7d: 0, ageYears: 45, gender: 'male' },
    { id: 'member3', name: 'Cecilia Ceder', email: 'cecilia@test.com', role: 'member', status: 'approved', isCourseActive: false, memberSince: '2024-02-20', lastLogDate: getDateUID(twoDaysAgo), currentStreak: 0, goalSummary: 'Bibehålla', proteinGoalMetPercentage7d: 30, goalAdherence: 'poor', weeklyWeightChange: 0.2, ageYears: 35, gender: 'female' }
];

const mockFriendRequests: PeppkompisRequest[] = [
    { id: 'req1', fromUid: 'friend1', fromName: 'Pelle', fromEmail: 'pelle@test.com', toUid: MOCK_USER_ID, status: 'pending', createdAt: Date.now() }
];

const mockOutgoingRequests: PeppkompisRequest[] = [];

const mockBuddies: { [userId: string]: Peppkompis[] } = {
    [MOCK_USER_ID]: [{ uid: 'friend2', name: 'Lisa', email: 'lisa@test.com' }]
};

export const mockInitialState = {
    userProfile: mockUserProfile,
    goals: mockGoals,
    mealLogs: mockMealLogs,
    pastDaySummaries: mockPastDaySummaries,
    weightLogs: mockWeightLogs,
    commonMeals: mockCommonMeals,
    courseProgress: mockCourseProgress,
    waterLogs: mockWaterLogs,
    firestoreUserDocument: mockFirestoreUser,
    coachViewMembers: mockCoachViewMembers,
    achievementInteractions: {
        'member1': {
            'streak_10': {
                id: 'streak_10',
                pepps: {}
            }
        }
    },
    friendRequests: mockFriendRequests,
    outgoingRequests: mockOutgoingRequests,
    buddies: mockBuddies,
};