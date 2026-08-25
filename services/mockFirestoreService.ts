import type { User } from '@firebase/auth';
import {
  LoggedMeal, UserProfileData, GoalSettings, CommonMeal, PastDaySummary,
  UserCourseProgress, WeightLogEntry, UserRole, FirestoreUserDocument,
  NutritionalInfo, PastDaysSummaryCollection, UserLessonProgress, CoachViewMember,
  MentalWellbeingLog, AIDataForCoachSummary, Peppkompis, PeppkompisRequest, BuddyDetails,
  TimelineEvent, Achievement, TimelineComment, Reactions
} from '../types';
import { mockInitialState, MOCK_USER_ID } from './mockData';
import { courseLessons } from '../courseData.ts';
import { LEVEL_DEFINITIONS } from '../constants';

const LOCAL_STORAGE_MOCK_KEY = 'foodLoggerMockData_v2';

const getDateUID = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getMockState = () => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_MOCK_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse mock data from localStorage", e);
  }
  return mockInitialState;
};

const saveMockState = (state: any) => {
  localStorage.setItem(LOCAL_STORAGE_MOCK_KEY, JSON.stringify(state));
};

let state = getMockState();

// add pepps to some mock weight logs
if (state.weightLogs && state.weightLogs[0] && !state.weightLogs[0].reactions) {
    state.weightLogs[0].reactions = {};
}
if (state.weightLogs && state.weightLogs[1] && !state.weightLogs[1].reactions) {
    state.weightLogs[1].reactions = { '👍': { 'someOtherUser': 'Peppy' } };
}

// Add mock achievement interactions
if (!state.achievementInteractions) {
    state.achievementInteractions = {
        'mockUser123': {
            'streak_10': {
                id: 'streak_10',
                reactions: {}
            }
        }
    };
}
saveMockState(state); // save the initial state changes


// --- Meal Logs ---
export async function addMealLog(userId: string, mealData: Omit<LoggedMeal, 'id'>) {
  const newId = `meal_${Date.now()}`;
  const newMeal: LoggedMeal = { ...mealData, id: newId };
  if (!state.mealLogs[mealData.dateString]) {
    state.mealLogs[mealData.dateString] = [];
  }
  state.mealLogs[mealData.dateString].push(newMeal);
  state.firestoreUserDocument.lastLogDate = mealData.dateString;
  saveMockState(state);
  return newId;
}

export async function deleteMealLog(userId: string, mealLogId: string) {
  Object.keys(state.mealLogs).forEach(date => {
    state.mealLogs[date] = state.mealLogs[date].filter(m => m.id !== mealLogId);
  });
  saveMockState(state);
}

export async function updateMealLog(userId: string, mealLogId: string, updatedInfo: Partial<NutritionalInfo>) {
    Object.keys(state.mealLogs).forEach(date => {
        const mealIndex = state.mealLogs[date].findIndex(m => m.id === mealLogId);
        if (mealIndex !== -1) {
            state.mealLogs[date][mealIndex].nutritionalInfo = {
                ...state.mealLogs[date][mealIndex].nutritionalInfo,
                ...updatedInfo
            };
        }
    });
    saveMockState(state);
}

export async function fetchMealLogsForDate(userId: string, dateUID: string): Promise<LoggedMeal[]> {
  return state.mealLogs[dateUID] || [];
}

// --- Water Logs ---
export async function setWaterLog(userId: string, dateUID: string, waterMl: number) {
  state.waterLogs[dateUID] = waterMl;
  saveMockState(state);
}

export async function fetchWaterLog(userId: string, dateUID: string): Promise<number> {
  return state.waterLogs[dateUID] || 0;
}

// --- User Document & Profile ---
export async function ensureUserProfileInFirestore(fbUser: User, role: UserRole, profileName?: string) {
    if (!state.firestoreUserDocument) {
        state.firestoreUserDocument = mockInitialState.firestoreUserDocument;
        state.userProfile = mockInitialState.userProfile;
        saveMockState(state);
    }
}

export async function saveProfileAndGoals(userId: string, profile: UserProfileData, goals: GoalSettings) {
    state.userProfile = profile;
    state.goals = goals;
    state.firestoreUserDocument.displayName = profile.name || 'Mock Användare';
    state.firestoreUserDocument.goals = goals;
    state.firestoreUserDocument.goalType = profile.goalType;
    state.firestoreUserDocument.desiredFatMassChangeKg = profile.desiredFatMassChangeKg ?? null;
    state.firestoreUserDocument.desiredMuscleMassChangeKg = profile.desiredMuscleMassChangeKg ?? null;
    state.firestoreUserDocument.ageYears = profile.ageYears;
    state.firestoreUserDocument.gender = profile.gender;
    saveMockState(state);
}

export async function updateUserDocument(userId: string, data: Partial<FirestoreUserDocument>) {
    state.firestoreUserDocument = { ...state.firestoreUserDocument, ...data };
    if (data.weeklyBank) state.weeklyBank = data.weeklyBank;
    if (data.journeyAnalysisFeedback !== undefined) {
        state.firestoreUserDocument.journeyAnalysisFeedback = data.journeyAnalysisFeedback;
        state.journeyAnalysisFeedback = data.journeyAnalysisFeedback;
    }
    saveMockState(state);
}

// --- Common Meals ---
export async function addCommonMeal(userId: string, commonMealData: Omit<CommonMeal, 'id'>) {
  const newId = `cm_${Date.now()}`;
  state.commonMeals.unshift({ ...commonMealData, id: newId });
  saveMockState(state);
  return newId;
}

export async function deleteCommonMeal(userId: string, commonMealId: string) {
  state.commonMeals = state.commonMeals.filter(cm => cm.id !== commonMealId);
  saveMockState(state);
}

export async function incrementCommonMealUsage(userId: string, commonMealId: string) {
    const index = state.commonMeals.findIndex(cm => cm.id === commonMealId);
    if (index !== -1) {
        const current = state.commonMeals[index];
        state.commonMeals[index] = { ...current, useCount: (current.useCount || 0) + 1, lastUsedAt: Date.now() };
    }
    saveMockState(state);
}

export async function updateCommonMeal(userId: string, commonMealId: string, updatedData: { name: string; nutritionalInfo: NutritionalInfo }) {
    const index = state.commonMeals.findIndex(cm => cm.id === commonMealId);
    if(index !== -1) {
        state.commonMeals[index] = { ...state.commonMeals[index], ...updatedData };
    }
    saveMockState(state);
}

// --- Past Day Summaries ---
export async function setPastDaySummary(userId: string, dateUID: string, summary: PastDaySummary) {
  state.pastDaySummaries[dateUID] = summary;
  saveMockState(state);
}

// --- Course Progress ---
export async function saveCourseProgress(userId: string, lessonId: string, progress: UserLessonProgress) {
  state.courseProgress[lessonId] = progress;
  const completedCount = Object.values(state.courseProgress).filter(p => (p as UserLessonProgress).isCompleted).length;
  state.firestoreUserDocument.courseProgressSummary = {
      started: Object.keys(state.courseProgress).length > 0,
      completedLessons: completedCount,
      totalLessons: courseLessons.length
  };
  saveMockState(state);
}

// --- Weight Logs ---
export async function saveWeightLog(userId: string, weightLog: Omit<WeightLogEntry, 'id'>) {
  const newId = `wl_${Date.now()}`;
  state.weightLogs.push({ ...weightLog, id: newId });
  state.weightLogs.sort((a,b) => a.loggedAt - b.loggedAt);
  // Update profile with new values
  state.userProfile.currentWeightKg = weightLog.weightKg;
  if (weightLog.skeletalMuscleMassKg !== undefined) {
      state.userProfile.skeletalMuscleMassKg = weightLog.skeletalMuscleMassKg;
  }
  if (weightLog.bodyFatMassKg !== undefined) {
      state.userProfile.bodyFatMassKg = weightLog.bodyFatMassKg;
  }
  state.firestoreUserDocument.currentWeightKg = weightLog.weightKg;
  saveMockState(state);
  return newId;
}

// --- Mental Wellbeing ---
export async function addMentalWellbeingLog(userId: string, logData: Omit<MentalWellbeingLog, 'id'>): Promise<string> {
    const newId = `wellbeing_${Date.now()}`;
    // This is not persisted in mock state for simplicity, as it's not a core visualized feature yet.
    console.log("Mock: Mental wellbeing log saved:", { ...logData, id: newId });
    return newId;
}

// --- Initial Fetch ---
export async function fetchInitialAppData(userId: string) {
  return {
    role: state.firestoreUserDocument.role,
    status: state.firestoreUserDocument.status,
    hasCompletedOnboarding: state.firestoreUserDocument.hasCompletedOnboarding,
    profile: state.userProfile,
    goals: state.goals,
    currentStreak: state.firestoreUserDocument.currentStreak,
    lastDateStreakChecked: state.firestoreUserDocument.lastDateStreakChecked,
    highestStreak: state.firestoreUserDocument.highestStreak,
    highestLevelId: state.firestoreUserDocument.highestLevelId,
    weeklyBank: state.weeklyBank,
    commonMeals: state.commonMeals,
    weightLogs: state.weightLogs,
    pastDaySummaries: state.pastDaySummaries,
    courseProgress: state.courseProgress,
    unlockedAchievements: state.firestoreUserDocument.unlockedAchievements,
    journeyAnalysisFeedback: state.firestoreUserDocument.journeyAnalysisFeedback,
  };
}


// --- Coach Functions ---
export async function fetchCoachViewMembers(): Promise<CoachViewMember[]> {
    return state.coachViewMembers;
}
export async function setCourseAccessForMember(memberId: string, access: boolean) {
    const member = state.coachViewMembers.find(m => m.id === memberId);
    if(member) {
        member.isCourseActive = access;
        if(access) member.courseInterest = false;
        saveMockState(state);
    }
}
export async function approveMember(memberId: string) {
     const member = state.coachViewMembers.find(m => m.id === memberId);
     if(member) {
        member.status = 'approved';
        saveMockState(state);
     }
}
export async function revokeApproval(memberId: string) {
    const member = state.coachViewMembers.find(m => m.id === memberId);
    if(member) {
        member.status = 'pending';
        saveMockState(state);
    }
}
export async function updateUserRole(memberId: string, newRole: UserRole) {
    const member = state.coachViewMembers.find(m => m.id === memberId);
    if(member) {
        member.role = newRole;
        saveMockState(state);
    }
}
export async function bulkApproveMembers(memberIds: string[]) {
    memberIds.forEach(id => {
        const member = state.coachViewMembers.find(m => m.id === id);
        if(member) member.status = 'approved';
    });
    saveMockState(state);
}
export async function bulkSetCourseAccess(memberIds: string[], access: boolean) {
    memberIds.forEach(id => {
        const member = state.coachViewMembers.find(m => m.id === id);
        if(member) {
            member.isCourseActive = access;
            if(access) member.courseInterest = false;
        }
    });
    saveMockState(state);
}
export async function bulkUpdateUserRole(memberIds: string[], role: UserRole) {
    memberIds.forEach(id => {
        const member = state.coachViewMembers.find(m => m.id === id);
        if(member) member.role = role;
    });
    saveMockState(state);
}
export async function fetchDetailedMemberDataForCoach(memberId: string): Promise<AIDataForCoachSummary> {
    const member = state.coachViewMembers.find(m => m.id === memberId);
    const userDoc = state.firestoreUserDocument; // Assuming we're looking at the main mock user
    const profile = state.userProfile;
    if (!member || !userDoc || !profile) throw new Error("Mock member not found");

    return {
        memberName: member.name,
        memberProfile: profile,
        last7DaysSummaries: Object.values(state.pastDaySummaries),
        last5WeightLogs: state.weightLogs.slice(-5),
        currentStreak: userDoc.currentStreak,
        lastLogDate: userDoc.lastLogDate,
        courseProgressSummary: userDoc.courseProgressSummary
    };
}

// --- Buddy System Mocks ---
let mockFriendRequests: PeppkompisRequest[] = [
    { id: 'req1', fromUid: 'friend1', fromName: 'Pelle', toUid: MOCK_USER_ID, status: 'pending', createdAt: Date.now() }
];

let mockOutgoingRequests: PeppkompisRequest[] = [];


let mockBuddies: { [userId: string]: Peppkompis[] } = {
    [MOCK_USER_ID]: [{ uid: 'friend2', name: 'Lisa', photoURL: 'https://i.pravatar.cc/150?u=lisa' }]
};

export async function addPepp(fromUser: { uid: string, name: string }, toUserUid: string, dateString: string): Promise<void> {
    console.log(`Mock: ${fromUser.name} pepped ${toUserUid} for ${dateString}`);
}
export async function updateUserSearchableStatus(userId: string, isSearchable: boolean): Promise<boolean> {
    console.log(`Mock: User ${userId} searchable status set to ${isSearchable}`);
    return isSearchable;
}

export async function searchForBuddies(currentUserId: string): Promise<Peppkompis[]> {
    const users: Peppkompis[] = [
        { uid: 'friend1', name: 'Pelle', photoURL: 'https://i.pravatar.cc/150?u=pelle', gender: 'male' },
        { uid: 'friend2', name: 'Lisa', photoURL: 'https://i.pravatar.cc/150?u=lisa', gender: 'female' },
        { uid: 'newfriend123', name: 'Ny Kompis', photoURL: undefined, gender: 'female' }
    ];
    return users.filter(u => u.uid !== currentUserId);
}

export async function sendFriendRequest(fromUser: Peppkompis, toUserUid: string): Promise<void> {
    mockOutgoingRequests.push({
        id: `req_${Date.now()}`,
        fromUid: fromUser.uid,
        fromName: fromUser.name,
        toUid: toUserUid,
        status: 'pending',
        createdAt: Date.now(),
    });
    console.log(`Mock: Friend request sent from ${fromUser.name} to uid ${toUserUid}`);
}

export async function fetchFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    return mockFriendRequests.filter(req => req.toUid === userId);
}

export async function fetchOutgoingFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    return mockOutgoingRequests.filter(req => req.fromUid === userId);
}

export function listenForFriendRequests(userId: string, callback: (requests: PeppkompisRequest[]) => void): () => void {
    const filtered = mockFriendRequests.filter(req => req.toUid === userId);
    callback(filtered);
    return () => {}; // No-op unsubscribe for mock
}
export async function updateFriendRequestStatus(request: PeppkompisRequest, status: 'accepted' | 'declined'): Promise<void> {
    console.log(`Mock: Request ${request.id} status updated to ${status}`);
    mockFriendRequests = mockFriendRequests.filter(r => r.id !== request.id);
    if (status === 'accepted') {
        if (!mockBuddies[request.toUid]) mockBuddies[request.toUid] = [];
        mockBuddies[request.toUid].push({ uid: request.fromUid, name: request.fromName });
    }
}
export async function fetchBuddies(userId: string): Promise<Peppkompis[]> {
    return mockBuddies[userId] || [];
}
export async function removeBuddy(currentUserId: string, buddyUid: string): Promise<void> {
    if (mockBuddies[currentUserId]) {
        mockBuddies[currentUserId] = mockBuddies[currentUserId].filter(b => b.uid !== buddyUid);
    }
    console.log(`Mock: Removed buddy ${buddyUid} from ${currentUserId}`);
}
export async function fetchBuddyDailyData(buddyId: string, dateUID: string): Promise<any> {
    return {
        meals: state.mealLogs[dateUID] || [],
        water: state.waterLogs[dateUID] || 0,
        goals: state.goals,
        profile: state.userProfile
    }
}
export async function fetchBuddyDetailsList(userId: string): Promise<BuddyDetails[]> {
    const buddies = mockBuddies[userId] || [];
    return buddies.map(buddy => {
        const buddyData = mockInitialState.firestoreUserDocument; // Use a generic mock data for any buddy
        return {
            ...buddy,
            goalSummary: `${buddyData.goalType === 'lose_fat' ? 'Fettminskning' : buddyData.goalType === 'gain_muscle' ? 'Muskelökning' : 'Bibehålla'}`,
            currentStreak: buddyData.currentStreak,
            unlockedAchievements: buddyData.unlockedAchievements,
            goalStartWeight: buddyData.goalStartWeight,
            currentWeight: buddyData.currentWeightKg,
            goalType: buddyData.goalType,
            mainGoalCompleted: buddyData.mainGoalCompleted,
            measurementMethod: buddyData.measurementMethod,
            desiredWeightChangeKg: buddyData.desiredWeightChangeKg,
            desiredFatMassChangeKg: buddyData.desiredFatMassChangeKg,
            desiredMuscleMassChangeKg: buddyData.desiredMuscleMassChangeKg,
            achievementInteractions: state.achievementInteractions ? state.achievementInteractions[buddy.uid] : {},
        } as BuddyDetails
    });
}
export async function addPeppToWeightLog(fromUid: string, fromName: string, toUserUid: string, weightLogId: string): Promise<void> {
    console.log(`Mock: ${fromName} pepped weight log ${weightLogId} for ${toUserUid}`);
}
export async function removePeppFromWeightLog(fromUid: string, toUserUid: string, weightLogId: string): Promise<void> {
     console.log(`Mock: ${fromUid} removed pepp from weight log ${weightLogId} for ${toUserUid}`);
}
export async function togglePeppOnTimelineEvent(
  fromUser: { uid: string, name: string },
  event: TimelineEvent,
  emoji: string,
): Promise<boolean> {
    let isPeppedNow = false;
    let stateWasChanged = false;

    const toggleReaction = (item: any) => {
        if (!item.reactions) item.reactions = {};
        if (!item.reactions[emoji]) item.reactions[emoji] = {};

        const alreadyPepped = item.reactions[emoji][fromUser.uid];
        if (alreadyPepped) {
            delete item.reactions[emoji][fromUser.uid];
            if (Object.keys(item.reactions[emoji]).length === 0) {
                delete item.reactions[emoji];
            }
            isPeppedNow = false;
        } else {
            item.reactions[emoji][fromUser.uid] = fromUser.name;
            isPeppedNow = true;
        }
    };
    
    if (event.type === 'weight') {
        const logIndex = state.weightLogs.findIndex((log: WeightLogEntry) => log.id === event.id);
        if (logIndex !== -1) {
            toggleReaction(state.weightLogs[logIndex]);
            stateWasChanged = true;
        }
    } else if (event.type === 'achievement') {
        const achievementId = event.id.replace('ach_', '');
        if (state.achievementInteractions?.[MOCK_USER_ID]?.[achievementId]) {
            toggleReaction(state.achievementInteractions[MOCK_USER_ID][achievementId]);
            stateWasChanged = true;
        } else {
             // Create if it doesn't exist
            if (!state.achievementInteractions) state.achievementInteractions = {};
            if (!state.achievementInteractions[MOCK_USER_ID]) state.achievementInteractions[MOCK_USER_ID] = {};
            state.achievementInteractions[MOCK_USER_ID][achievementId] = { id: achievementId, reactions: {} };
            toggleReaction(state.achievementInteractions[MOCK_USER_ID][achievementId]);
            stateWasChanged = true;
        }
    }

    if (stateWasChanged) {
        saveMockState(state);
    } else {
        console.warn(`Mock: Could not find event with id ${event.id} to toggle reaction.`);
    }

    console.log(`Mock: ${fromUser.name} toggled pepp on event ${event.id} for user ${event.userId}. Is now pepped: ${isPeppedNow}`);
    return isPeppedNow;
}

export async function addCommentToTimelineEvent(
  relatedDocPath: string,
  commentData: Omit<TimelineComment, 'id' | 'timestamp'> & { timestamp: any }
): Promise<string> {
  const newId = `comment_${Date.now()}`;
  console.log(`Mock: Adding comment to ${relatedDocPath}`, { ...commentData, id: newId });
  // Comments are not persisted in the simple mock state, but we log the action.
  return newId;
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
    mockOutgoingRequests = mockOutgoingRequests.filter(req => req.id !== requestId);
    console.log(`Mock: Cancelled friend request ${requestId}`);
}

export async function fetchTimelineForCurrentUser(currentUserId: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    const formatChange = (change: number | undefined, isFirstEntry?: boolean, invertColor: boolean = false): string => {
        if (change === undefined || change === null || isNaN(change)) {
            return '-';
        }
        if (Math.abs(change) < 0.05) {
            return `±0,0`;
        }
        const sign = change > 0 ? '+' : '';
        return `${sign}${change.toFixed(1).replace('.', ',')}`;
    };

    const logs = state.weightLogs;
    const currentUserInfo = {
        userId: MOCK_USER_ID,
        userName: state.userProfile.name || 'Mock Användare',
        userPhotoURL: state.userProfile.photoURL,
        gender: state.userProfile.gender,
    };

    const weightEvents: TimelineEvent[] = logs.map((currentLog: WeightLogEntry, index: number) => {
        const previousLog = logs[index - 1];
        let weightChange, muscleChange, fatChange;
        if (previousLog) {
            weightChange = currentLog.weightKg - previousLog.weightKg;
            if (currentLog.skeletalMuscleMassKg != null && previousLog.skeletalMuscleMassKg != null) {
                muscleChange = currentLog.skeletalMuscleMassKg - previousLog.skeletalMuscleMassKg;
            }
            if (currentLog.bodyFatMassKg != null && previousLog.bodyFatMassKg != null) {
                fatChange = currentLog.bodyFatMassKg - previousLog.bodyFatMassKg;
            }
        }
        const descriptionParts = [];
        descriptionParts.push(`Vikt: ${currentLog.weightKg.toFixed(1)}kg (${formatChange(weightChange, false, true)})`);
        if (currentLog.skeletalMuscleMassKg != null) {
            descriptionParts.push(`Muskler: ${currentLog.skeletalMuscleMassKg.toFixed(1)}kg (${formatChange(muscleChange)})`);
        }
        if (currentLog.bodyFatMassKg != null) {
            descriptionParts.push(`Fett: ${currentLog.bodyFatMassKg.toFixed(1)}kg (${formatChange(fatChange, false, true)})`);
        }

        return {
            id: currentLog.id,
            type: 'weight',
            timestamp: currentLog.loggedAt,
            title: `Ny mätning loggad`,
            description: descriptionParts.join(' | '),
            icon: '⚖️',
            reactions: currentLog.reactions || {},
            comments: [], // Comments not mocked in detail here
            relatedDocPath: `users/${MOCK_USER_ID}/weightLogs/${currentLog.id}`,
            ...currentUserInfo
        };
    });

    const unlockedAchievementEvents: TimelineEvent[] = Object.entries(state.firestoreUserDocument.unlockedAchievements)
        .map(([id, dateString]) => {
            const achievement = achievements.find(a => a.id === id);
            if (!achievement) return null;
            return {
                id: `ach_${id}`,
                type: 'achievement',
                timestamp: new Date(dateString as string).getTime(),
                title: `Bragd: ${achievement.name}`,
                description: achievement.description,
                icon: achievement.icon,
                reactions: state.achievementInteractions?.[MOCK_USER_ID]?.[id]?.reactions || {},
                comments: [],
                relatedDocPath: `users/${MOCK_USER_ID}/achievementInteractions/${id}`,
                ...currentUserInfo
            };
        })
        .filter(e => e !== null) as TimelineEvent[];

    const allEvents = [...weightEvents, ...unlockedAchievementEvents];

    return allEvents.sort((a, b) => b.timestamp - a.timestamp);
}
export async function togglePeppOnAchievement(
  fromUser: { uid: string, name: string },
  toUserUid: string,
  achievementId: string,
  emoji: string = '❤️'
): Promise<boolean> {
    if (!state.achievementInteractions) state.achievementInteractions = {};
    if (!state.achievementInteractions[toUserUid]) state.achievementInteractions[toUserUid] = {};
    if (!state.achievementInteractions[toUserUid][achievementId]) {
        state.achievementInteractions[toUserUid][achievementId] = { id: achievementId, reactions: {} };
    }
    const reactions = state.achievementInteractions[toUserUid][achievementId].reactions || {};
    if (!reactions[emoji]) reactions[emoji] = {};

    let isPeppedNow = false;
    if (reactions[emoji][fromUser.uid]) {
        delete reactions[emoji][fromUser.uid];
    } else {
        reactions[emoji][fromUser.uid] = fromUser.name;
        isPeppedNow = true;
    }
    
    state.achievementInteractions[toUserUid][achievementId].reactions = reactions;
    saveMockState(state);
    console.log(`Mock: ${fromUser.name} toggled pepp on achievement ${achievementId} for ${toUserUid}. Is now pepped: ${isPeppedNow}`);
    return isPeppedNow;
}
