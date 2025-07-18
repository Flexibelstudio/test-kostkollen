import type { User } from '@firebase/auth';
import {
  LoggedMeal, UserProfileData, GoalSettings, CommonMeal, PastDaySummary,
  UserCourseProgress, WeightLogEntry, UserRole, FirestoreUserDocument,
  NutritionalInfo, PastDaysSummaryCollection, UserLessonProgress, CoachViewMember,
  MentalWellbeingLog, AIDataForCoachSummary, Peppkompis, PeppkompisRequest, BuddyDetails, BuddySummary,
  TimelineEvent, Achievement, Chat, ChatMessage
} from '../types';
import { mockInitialState } from './mockData';
import { courseLessons } from '../courseData.ts';
import { MOCK_USER_ID } from './mockData';

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
if (state.weightLogs && state.weightLogs[0] && !state.weightLogs[0].pepps) {
    state.weightLogs[0].pepps = {};
}
if (state.weightLogs && state.weightLogs[1] && !state.weightLogs[1].pepps) {
    state.weightLogs[1].pepps = { 'someOtherUser': { name: 'Peppy', timestamp: Date.now() } };
}

// Add mock achievement interactions
if (!state.achievementInteractions) {
    state.achievementInteractions = {
        'mockUser123': {
            'streak_10': {
                id: 'streak_10',
                pepps: {}
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
export async function addMentalWellbeingLog(userId: string, logData: Omit<MentalWellbeingLog, 'id'>) {
    // This is not persisted in mock state for simplicity, as it's not a core visualized feature yet.
    console.log("Mock: Mental wellbeing log saved:", logData);
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
export async function addPepp(fromUser: { uid: string, name: string }, toUserUid: string, dateString: string): Promise<void> {
    console.log(`Mock: ${fromUser.name} pepped ${toUserUid} for ${dateString}`);
}
export async function updateUserSearchableStatus(userId: string, isSearchable: boolean): Promise<boolean> {
    console.log(`Mock: User ${userId} searchable status set to ${isSearchable}`);
    return isSearchable;
}

export async function searchForBuddies(currentUserId: string): Promise<Peppkompis[]> {
    const users: Peppkompis[] = [
        { uid: 'friend1', name: 'Pelle', email: 'pelle@test.com', photoURL: undefined, gender: 'male' },
        { uid: 'friend2', name: 'Lisa', email: 'lisa@test.com', photoURL: undefined, gender: 'female' },
        { uid: 'newfriend123', name: 'Ny Kompis', email: 'newfriend@test.com', photoURL: undefined, gender: 'female' }
    ];
    return users.filter(u => u.uid !== currentUserId);
}

export async function sendFriendRequest(fromUser: Peppkompis, toUserUid: string): Promise<void> {
    if (!state.outgoingRequests) state.outgoingRequests = [];
    state.outgoingRequests.push({
        id: `req_${Date.now()}`,
        fromUid: fromUser.uid,
        fromName: fromUser.name,
        fromEmail: fromUser.email,
        toUid: toUserUid,
        status: 'pending',
        createdAt: Date.now(),
    });
    console.log(`Mock: Friend request sent from ${fromUser.name} to uid ${toUserUid}`);
    saveMockState(state);
}

export async function fetchFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    if (!state.friendRequests) state.friendRequests = [];
    return state.friendRequests.filter(req => req.toUid === userId);
}

export async function fetchOutgoingFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    if (!state.outgoingRequests) state.outgoingRequests = [];
    return state.outgoingRequests.filter(req => req.fromUid === userId);
}

export function listenForFriendRequests(userId: string, callback: (requests: PeppkompisRequest[]) => void): () => void {
    if (!state.friendRequests) state.friendRequests = [];
    const filtered = state.friendRequests.filter(req => req.toUid === userId);
    callback(filtered);
    return () => {}; // No-op unsubscribe for mock
}
export async function updateFriendRequestStatus(request: PeppkompisRequest, status: 'accepted' | 'declined'): Promise<void> {
    // This mock simulates the final outcome of the new two-part flow.
    // On decline, the request is simply removed.
    // On accept, the request is removed, and the reciprocal friendship is created in the state.
    state.friendRequests = state.friendRequests.filter(r => r.id !== request.id);
    
    if (status === 'accepted') {
        if (!state.buddies) state.buddies = {};
        
        // Add requester to current user's (toUid) buddy list
        if (!state.buddies[request.toUid]) state.buddies[request.toUid] = [];
        state.buddies[request.toUid].push({ 
            uid: request.fromUid, 
            name: request.fromName, 
            email: request.fromEmail,
        });
        
        // Add current user (toUid) to requester's (fromUid) buddy list
        if (!state.buddies[request.fromUid]) state.buddies[request.fromUid] = [];
        const toUser = state.firestoreUserDocument;
        state.buddies[request.fromUid].push({
            uid: request.toUid,
            name: toUser.displayName,
            email: toUser.email || '',
            photoURL: toUser.photoURL || undefined,
            gender: toUser.gender,
        });
    }
    saveMockState(state);
}

export async function fetchBuddies(userId: string): Promise<Peppkompis[]> {
    if (!state.buddies) state.buddies = {};
    return state.buddies[userId] || [];
}
export async function removeBuddy(currentUserId: string, buddyUid: string): Promise<void> {
    if (state.buddies && state.buddies[currentUserId]) {
        state.buddies[currentUserId] = state.buddies[currentUserId].filter(b => b.uid !== buddyUid);
    }
     if (state.buddies && state.buddies[buddyUid]) {
        state.buddies[buddyUid] = state.buddies[buddyUid].filter(b => b.uid !== currentUserId);
    }
    console.log(`Mock: Removed buddy ${buddyUid} from ${currentUserId}`);
    saveMockState(state);
}
export async function fetchBuddyDailyData(buddyId: string, dateUID: string): Promise<any> {
    return {
        meals: state.mealLogs[dateUID] || [],
        water: state.waterLogs[dateUID] || 0,
        goals: state.goals,
        profile: state.userProfile
    }
}
export async function fetchBuddyDetailsList(userId: string): Promise<any[]> {
    if (!state.buddies) state.buddies = {};
    return (state.buddies[userId] || []).map(buddy => ({
        ...buddy,
        goalSummary: 'Minska fett',
        yesterdayGoalMet: true,
        currentStreak: 15,
        yesterdayPeppCount: 1,
        currentUserHasPepped: false,
    }));
}
export async function fetchAchievementInteractions(userId: string): Promise<any> {
    if (userId === MOCK_USER_ID) {
        return state.achievementInteractions[MOCK_USER_ID] || {};
    }
    // For any buddy, return a predefined interaction object for testing
    return {
        'streak_10': { pepps: { [MOCK_USER_ID]: { name: 'Mock Användare', timestamp: Date.now() } } },
        'course_completed': { pepps: {} }
    };
}
export async function addPeppToWeightLog(fromUid: string, fromName: string, toUserUid: string, weightLogId: string): Promise<void> {
    console.log(`Mock: ${fromName} pepped weight log ${weightLogId} for ${toUserUid}`);
}
export async function removePeppFromWeightLog(fromUid: string, toUserUid: string, weightLogId: string): Promise<void> {
     console.log(`Mock: ${fromUid} removed pepp from weight log ${weightLogId} for ${toUserUid}`);
}
export async function addPeppToAchievement(fromUid: string, fromName: string, toUserUid: string, achievementId: string): Promise<void> {
     console.log(`Mock: ${fromName} pepped achievement ${achievementId} for ${toUserUid}`);
}
export async function removePeppFromAchievement(fromUid: string, toUserUid: string, achievementId: string): Promise<void> {
    console.log(`Mock: ${fromUid} removed pepp from achievement ${achievementId} for ${toUserUid}`);
}
export async function fetchTimelineForCurrentUser(currentUserId: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    const formatChange = (change: number | undefined, invertColor: boolean = false): string => {
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
        descriptionParts.push(`Vikt: ${currentLog.weightKg.toFixed(1)}kg (${formatChange(weightChange, true)})`);
        if (currentLog.skeletalMuscleMassKg != null) descriptionParts.push(`Muskler: ${currentLog.skeletalMuscleMassKg.toFixed(1)}kg (${formatChange(muscleChange)})`);
        if (currentLog.bodyFatMassKg != null) descriptionParts.push(`Fett: ${currentLog.bodyFatMassKg.toFixed(1)}kg (${formatChange(fatChange, true)})`);
        return {
            id: `w_${currentLog.id}`, type: 'weight', timestamp: currentLog.loggedAt,
            title: `Ny mätning loggad`, description: descriptionParts.join(' | '),
            icon: '⚖️', pepps: currentLog.pepps || {}, peppedByCurrentUser: !!(currentLog.pepps && currentLog.pepps[currentUserId]), relatedDocId: currentLog.id
        };
    });

    const unlockedAchievements = state.firestoreUserDocument.unlockedAchievements || {};
    const achievementEvents: TimelineEvent[] = Object.keys(unlockedAchievements).map(achId => {
        const achievementDef = achievements.find(a => a.id === achId);
        if (!achievementDef) return null;
        return {
            id: `a_${achId}`, type: 'achievement', timestamp: new Date(unlockedAchievements[achId]).getTime(),
            title: `Bragd: ${achievementDef.name}`, description: achievementDef.description,
            icon: achievementDef.icon, pepps: {}, peppedByCurrentUser: false, relatedDocId: achId
        };
    }).filter(e => e !== null) as TimelineEvent[];

    const allSummaries = Object.values(state.pastDaySummaries) as (PastDaySummary & { id?: string })[];
    allSummaries.forEach((s, i) => s.id = `summary_${i}`);

    const streakEvents: TimelineEvent[] = allSummaries
        .filter(data => data.goalMet && data.streakForThisDay && data.streakForThisDay > 0)
        .map(data => ({
            id: `s_${data.date}`, type: 'streak', timestamp: new Date(data.date + 'T23:59:59').getTime(),
            title: `+1 Dag Streak!`, description: `Ny streak: ${data.streakForThisDay} dagar i följd.`,
            icon: '🔥', pepps: data.pepps || {}, peppedByCurrentUser: !!(data.pepps && data.pepps[currentUserId]),
            relatedDocId: data.id!
        }));
    
    const courseEvents: TimelineEvent[] = Object.entries(state.courseProgress).map(([lessonId, progress]) => {
        const lessonProgress = progress as UserLessonProgress;
        const lesson = courseLessons.find(l => l.id === lessonId);
        if (!lessonProgress.unlockedAt || !lesson) return null;

        return {
            id: `c_${lesson.id}`,
            type: 'course',
            timestamp: lessonProgress.unlockedAt,
            title: `Lektion Upplåst: ${lesson.title}`,
            description: `Du har låst upp en ny lektion i kursen "Praktisk Viktkontroll".`,
            icon: '🎓',
            pepps: {}, // Pepps on lessons not supported yet
            peppedByCurrentUser: false,
            relatedDocId: lesson.id
        };
    }).filter(e => e !== null) as TimelineEvent[];

    const allEvents = [...weightEvents, ...achievementEvents, ...streakEvents, ...courseEvents];
    allEvents.sort((a, b) => b.timestamp - a.timestamp);
    return allEvents;
}
export async function fetchTimelineForBuddy(buddyUid: string, currentUserId: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    return fetchTimelineForCurrentUser(buddyUid, achievements);
}

// --- Chat Mocks ---
let mockChats: Chat[] = [];
let mockMessages: { [chatId: string]: ChatMessage[] } = {};

export async function getChats(userId: string): Promise<Chat[]> {
    return mockChats.filter(c => c.participantUids.includes(userId));
}
export function listenForChats(userId: string, callback: (chats: Chat[]) => void): () => void {
    callback(mockChats.filter(c => c.participantUids.includes(userId)));
    return () => {};
}
export async function sendMessage(chatId: string, senderId: string, participants: Peppkompis[], text: string, imageDataUrl?: string): Promise<void> {
    const newMsg: ChatMessage = { id: `msg_${Date.now()}`, senderId, text, timestamp: Date.now(), imageDataUrl };
    if (!mockMessages[chatId]) mockMessages[chatId] = [];
    mockMessages[chatId].push(newMsg);
    
    let chat = mockChats.find(c => c.id === chatId);
    if (!chat) {
        chat = { id: chatId, participants, participantUids: participants.map(p => p.uid), unreadCounts: {} };
        mockChats.push(chat);
    }
    chat.lastMessage = { text: text || "📷 Bild", senderId, timestamp: Date.now() };
    const otherParticipant = participants.find(p => p.uid !== senderId);
    if (otherParticipant) {
        if(!chat.unreadCounts) chat.unreadCounts = {};
        chat.unreadCounts[otherParticipant.uid] = (chat.unreadCounts[otherParticipant.uid] || 0) + 1;
    }
}
export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
    if (mockMessages[chatId]) {
        mockMessages[chatId] = mockMessages[chatId].filter(m => m.id !== messageId);
    }
}
export function listenForMessages(chatId: string, callback: (messages: ChatMessage[]) => void): () => void {
    callback(mockMessages[chatId] || []);
    return () => {};
}
export async function toggleMessageLike(chatId: string, messageId: string, userId: string) {
    const msg = mockMessages[chatId]?.find(m => m.id === messageId);
    if (msg) {
        if (!msg.likes) msg.likes = {};
        if (msg.likes[userId]) delete msg.likes[userId];
        else msg.likes[userId] = true;
    }
}
export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
    const chat = mockChats.find(c => c.id === chatId);
    if (chat?.unreadCounts) {
        chat.unreadCounts[userId] = 0;
    }
}
export function listenForTotalUnreadCount(userId: string, callback: (count: number) => void): () => void {
    let total = 0;
    mockChats.forEach(c => {
        if(c.participantUids.includes(userId) && c.unreadCounts[userId]){
            total += c.unreadCounts[userId];
        }
    });
    callback(total);
    return () => {};
}
