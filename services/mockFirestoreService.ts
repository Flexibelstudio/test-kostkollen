



import type { User } from '@firebase/auth';
import {
  LoggedMeal, UserProfileData, GoalSettings, CommonMeal, PastDaySummary,
  UserCourseProgress, WeightLogEntry, UserRole, FirestoreUserDocument,
  NutritionalInfo, PastDaysSummaryCollection, UserLessonProgress, CoachViewMember,
  MentalWellbeingLog, AIDataForCoachSummary, Peppkompis, PeppkompisRequest, BuddyDetails, BuddySummary,
  TimelineEvent, Achievement, Chat, ChatMessage
} from '../types';
import { mockInitialState, MOCK_USER_ID } from './mockData';
import { courseLessons } from '../courseData.ts';

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
    weeklyBank: state.firestoreUserDocument.weeklyBank,
    commonMeals: state.commonMeals,
    weightLogs: state.weightLogs,
    pastDaySummaries: state.pastDaySummaries,
    courseProgress: state.courseProgress,
    unlockedAchievements: state.firestoreUserDocument.unlockedAchievements || {},
    buddies: state.buddies[userId] || [],
  };
}

// --- Peppkompis (Buddy) System Mocks ---

if (!state.peppkompisRequests) {
    state.peppkompisRequests = [
        { id: 'req1', fromUid: 'member2', fromName: 'Bengt Bengtsson', fromEmail: 'bengt@test.com', toUid: MOCK_USER_ID, status: 'pending', createdAt: Date.now() }
    ];
}
if (!state.buddies) {
    state.buddies = {
        [MOCK_USER_ID]: [
            { uid: 'member1', name: 'Anna Andersson', email: 'anna@test.com' }
        ],
        'member1': [
            { uid: MOCK_USER_ID, name: 'Mock Användare', email: 'test@example.com' }
        ]
    };
}


export async function addPepp(fromUser: { uid: string; name: string; }, toUserUid: string, dateString: string) {
    // Note: in a real multi-user scenario, `state` would need to be structured per-user.
    // For this mock, we assume `state.pastDaySummaries` is for the buddy being pepped.
    const summary = state.pastDaySummaries[dateString];
    if (summary) {
        if (!summary.pepps) {
            summary.pepps = {};
        }
        summary.pepps[fromUser.uid] = fromUser.name;
        saveMockState(state);
    }
}


export async function updateUserSearchableStatus(userId: string, isSearchable?: boolean): Promise<boolean> {
    if (typeof isSearchable === 'boolean') {
        state.firestoreUserDocument.isSearchable = isSearchable;
        saveMockState(state);
        return isSearchable;
    }
    return state.firestoreUserDocument.isSearchable || false;
}

export async function searchUserByEmail(email: string, currentUserId: string): Promise<Peppkompis | null> {
    const found = state.coachViewMembers.find(m => m.email === email && m.role === 'member' && m.id !== currentUserId);
    if (found) {
        return { uid: found.id, name: found.name, email: found.email };
    }
    return null;
}

export async function sendFriendRequest(fromUser: Peppkompis, toUserUid: string): Promise<void> {
    const existing = state.peppkompisRequests.find(r =>
        (r.fromUid === fromUser.uid && r.toUid === toUserUid) ||
        (r.fromUid === toUserUid && r.toUid === fromUser.uid)
    );
    if (existing) {
        throw new Error("En förfrågan finns redan.");
    }

    const newRequest: PeppkompisRequest = {
        id: `req_${Date.now()}`,
        fromUid: fromUser.uid,
        fromName: fromUser.name,
        fromEmail: fromUser.email,
        toUid: toUserUid,
        status: 'pending',
        createdAt: Date.now(),
    };
    state.peppkompisRequests.push(newRequest);
    saveMockState(state);
}

export async function fetchFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    return state.peppkompisRequests.filter(r => r.toUid === userId && r.status === 'pending');
}

export async function updateFriendRequestStatus(request: PeppkompisRequest, status: 'accepted' | 'declined'): Promise<void> {
    const reqIndex = state.peppkompisRequests.findIndex(r => r.id === request.id);
    if (reqIndex === -1) return;

    if (status === 'accepted') {
        state.peppkompisRequests[reqIndex].status = 'accepted';
        
        if (!state.buddies[request.toUid]) state.buddies[request.toUid] = [];
        if (!state.buddies[request.fromUid]) state.buddies[request.fromUid] = [];
        
        state.buddies[request.toUid].push({ uid: request.fromUid, name: request.fromName, email: request.fromEmail });
        const toUser = state.coachViewMembers.find(m => m.id === request.toUid) || { name: 'Okänd', email: '' };
        state.buddies[request.fromUid].push({ uid: request.toUid, name: toUser.name, email: toUser.email });

    } else {
        state.peppkompisRequests.splice(reqIndex, 1);
    }
    saveMockState(state);
}

export async function fetchBuddies(userId: string): Promise<Peppkompis[]> {
    return state.buddies[userId] || [];
}

export async function removeBuddy(currentUserId: string, buddyUid: string): Promise<void> {
    if (state.buddies[currentUserId]) {
        state.buddies[currentUserId] = state.buddies[currentUserId].filter(b => b.uid !== buddyUid);
    }
    if (state.buddies[buddyUid]) {
        state.buddies[buddyUid] = state.buddies[buddyUid].filter(b => b.uid !== currentUserId);
    }
    saveMockState(state);
}


export async function fetchBuddyDailyData(buddyId: string, dateUID: string): Promise<{
    meals: LoggedMeal[];
    water: number;
    goals: GoalSettings;
    profile: UserProfileData;
}> {
    // For mock, we'll return a simplified version of the main user's data
    // regardless of buddyId, as we don't have separate states for each user.
    const meals = state.mealLogs[dateUID] || [];
    const water = state.waterLogs[dateUID] || 0;
    
    // A more realistic mock would have different data for different buddies
    return {
        meals: meals.slice(0,1), // Just show first meal for privacy mock
        water,
        goals: state.goals,
        profile: state.userProfile
    };
}

export async function fetchBuddySummaryData(buddyId: string): Promise<BuddySummary> {
    // Return some static mock data for the buddy
    const buddyData = state.coachViewMembers.find(m => m.id === buddyId);
    const weightLogs = state.weightLogs; // Use the main mock user's logs
    
    const firstLog = weightLogs.length > 1 ? weightLogs[0] : null;
    const lastLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;

    let totalWeightChange, muscleMassChange, fatMassChange;
    if (firstLog && lastLog) {
        totalWeightChange = lastLog.weightKg - firstLog.weightKg;
        if (lastLog.skeletalMuscleMassKg != null && firstLog.skeletalMuscleMassKg != null) {
            muscleMassChange = lastLog.skeletalMuscleMassKg - firstLog.skeletalMuscleMassKg;
        }
        if (lastLog.bodyFatMassKg != null && firstLog.bodyFatMassKg != null) {
            fatMassChange = lastLog.bodyFatMassKg - firstLog.bodyFatMassKg;
        }
    }

    return {
        name: buddyData?.name || 'Mock Kompis',
        currentWeight: lastLog?.weightKg,
        totalWeightChange,
        muscleMassChange,
        fatMassChange,
        currentStreak: buddyData?.currentStreak || 5,
        goalSummary: buddyData?.goalSummary || '-5 kg fett'
    };
}


const getDateUIDNoTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export async function fetchBuddyDetailsList(userId: string): Promise<BuddyDetails[]> {
    const buddies = await fetchBuddies(userId);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateUID = getDateUIDNoTime(yesterday);
    
    return buddies.map(buddy => {
        const buddyData = state.coachViewMembers.find(m => m.id === buddy.uid);
        // This is a simplification; in a real app, each buddy would have their own summary data.
        // Here we use the main user's summary data for all buddies for mock purposes.
        const summary = state.pastDaySummaries[yesterdayDateUID]; 
        const pepps = summary?.pepps || {};
        
        // Simplified: Give 'Anna' the mock user's achievements
        const unlockedAchievements = buddy.uid === 'member1' ? state.firestoreUserDocument.unlockedAchievements : {};
        
        const weightLogs = state.weightLogs;
        const firstLog = weightLogs.length > 1 ? weightLogs[0] : null;
        const lastLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
        let totalWeightChange, muscleMassChange, fatMassChange;
        if (firstLog && lastLog && firstLog.id !== lastLog.id) {
            totalWeightChange = lastLog.weightKg - firstLog.weightKg;
            muscleMassChange = (lastLog.skeletalMuscleMassKg ?? 0) - (firstLog.skeletalMuscleMassKg ?? 0);
            fatMassChange = (lastLog.bodyFatMassKg ?? 0) - (firstLog.bodyFatMassKg ?? 0);
        }

        return {
            ...buddy,
            goalSummary: buddyData?.goalSummary || 'Ej satt',
            yesterdayGoalMet: summary?.goalMet,
            currentStreak: buddyData?.currentStreak || 0,
            yesterdayPeppCount: Object.keys(pepps).length,
            currentUserHasPepped: pepps.hasOwnProperty(userId),
            unlockedAchievements,
            currentWeight: lastLog?.weightKg,
            totalWeightChange,
            muscleMassChange,
            fatMassChange,
            lastWeightLogTimestamp: lastLog?.loggedAt,
            lastAchievementTimestamp: new Date().getTime() - (10 * 3600 * 1000), // Mock: 10 hours ago
        };
    });
}

export async function addPeppToWeightLog(fromUid: string, fromName: string, toUserUid: string, weightLogId: string): Promise<void> {
    const log = state.weightLogs.find(l => l.id === weightLogId);
    if (log) {
        if (!log.pepps) {
            log.pepps = {};
        }
        log.pepps[fromUid] = { name: fromName, timestamp: Date.now() };
        saveMockState(state);
    }
}

export async function removePeppFromWeightLog(fromUid: string, toUserUid: string, weightLogId: string): Promise<void> {
    const log = state.weightLogs.find(l => l.id === weightLogId);
    if (log && log.pepps && log.pepps[fromUid]) {
        delete log.pepps[fromUid];
        saveMockState(state);
    }
}

export async function addPeppToAchievement(fromUid: string, fromName: string, toUserUid: string, achievementId: string): Promise<void> {
    if (!state.achievementInteractions) {
        state.achievementInteractions = {};
    }
    if (!state.achievementInteractions[toUserUid]) {
        state.achievementInteractions[toUserUid] = {};
    }
    if (!state.achievementInteractions[toUserUid][achievementId]) {
        state.achievementInteractions[toUserUid][achievementId] = { id: achievementId, pepps: {} };
    }
    state.achievementInteractions[toUserUid][achievementId].pepps[fromUid] = { name: fromName, timestamp: Date.now() };
    saveMockState(state);
}

export async function removePeppFromAchievement(fromUid: string, toUserUid: string, achievementId: string): Promise<void> {
    const interaction = state.achievementInteractions?.[toUserUid]?.[achievementId];
    if (interaction && interaction.pepps && interaction.pepps[fromUid]) {
        delete interaction.pepps[fromUid];
        saveMockState(state);
    }
}

async function fetchMockTimeline(userId: string, currentUserIdForPeppCheck: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    const timelineEvents: TimelineEvent[] = [];
    
    // Use the main mock user's data regardless of who is being fetched, for simplicity
    const weightLogs = state.weightLogs;
    const unlockedAchievements = state.firestoreUserDocument.unlockedAchievements || {};
    const achievementInteractions = state.achievementInteractions?.[userId] || {};

    weightLogs.forEach(log => {
        if (log) {
            const pepps = log.pepps || {};
            timelineEvents.push({
                id: `weight-${log.id}`, type: 'weight', timestamp: log.loggedAt,
                title: `Vikt loggad: ${log.weightKg.toFixed(1)} kg`,
                description: log.comment || 'Kroppssammansättning uppdaterad.',
                icon: '⚖️', pepps, peppedByCurrentUser: pepps.hasOwnProperty(currentUserIdForPeppCheck),
                relatedDocId: log.id,
            });
        }
    });

    for (const achId in unlockedAchievements) {
        const achievement = achievements.find(a => a.id === achId);
        if (achievement) {
            const interaction = achievementInteractions[achId];
            const pepps = interaction?.pepps || {};
            timelineEvents.push({
                id: `ach-${achId}`, type: 'achievement', timestamp: new Date(unlockedAchievements[achId]).getTime(),
                title: `Bragd upplåst: ${achievement.name}`,
                description: achievement.description,
                icon: achievement.icon, pepps: pepps,
                peppedByCurrentUser: pepps.hasOwnProperty(currentUserIdForPeppCheck),
                relatedDocId: achId,
            });
        }
    }

    timelineEvents.sort((a, b) => b.timestamp - a.timestamp);
    return timelineEvents.slice(0, 20);
}


export async function fetchTimelineForCurrentUser(currentUserId: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    return fetchMockTimeline(currentUserId, currentUserId, achievements);
}

export async function fetchTimelineForBuddy(buddyUid: string, currentUserId: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    return fetchMockTimeline(buddyUid, currentUserId, achievements);
}

// --- Chat Mocks ---
const getChatId = (uid1: string, uid2: string): string => {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

if (!state.chats) {
    const chatId = getChatId(MOCK_USER_ID, 'member1');
    state.chats = {
        [chatId]: {
            id: chatId,
            participants: [
                { uid: MOCK_USER_ID, name: 'Mock Användare', email: 'test@example.com' },
                { uid: 'member1', name: 'Anna Andersson', email: 'anna@test.com' },
            ],
            participantUids: [MOCK_USER_ID, 'member1'],
            lastMessage: { text: 'Hej Anna!', senderId: MOCK_USER_ID, timestamp: Date.now() - 3600000 },
            unreadCounts: { [MOCK_USER_ID]: 1, 'member1': 0 }
        }
    };
    state.chatMessages = {
        [chatId]: [
            { id: 'msg1', senderId: MOCK_USER_ID, text: 'Hej Anna!', timestamp: Date.now() - 3600000, likes: {} },
            { id: 'msg2', senderId: 'member1', text: 'Hej! Hur går det?', timestamp: Date.now() - 3500000, likes: { [MOCK_USER_ID]: true } }
        ]
    };
    saveMockState(state);
}


export async function getChats(userId: string): Promise<Chat[]> {
    const userBuddies = state.buddies[userId] || [];
    const chats: Chat[] = [];

    // Add existing chats
    Object.values(state.chats).forEach((chat: any) => {
        if (chat.participantUids.includes(userId)) {
            chats.push({
                ...chat,
                participants: chat.participants.map((p: any) => ({...p}))
            });
        }
    });
    
    // Ensure all buddies have a chat object, even if empty
    userBuddies.forEach(buddy => {
        const chatId = getChatId(userId, buddy.uid);
        if (!chats.find(c => c.id === chatId)) {
            chats.push({
                id: chatId,
                participants: [
                    { uid: userId, name: state.firestoreUserDocument.displayName || 'Du', email: state.firestoreUserDocument.email || ''},
                    buddy
                ],
                participantUids: [userId, buddy.uid],
                unreadCounts: {}
            });
        }
    });


    return chats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
}

export function listenForChats(userId: string, callback: (chats: Chat[]) => void): () => void {
    // Mock doesn't support real-time, so we just call the callback once.
    // The main app logic will work correctly with the real Firestore listener.
    getChats(userId).then(chats => callback(chats));
    return () => {}; // No-op unsubscribe function
}

export async function sendMessage(chatId: string, senderId: string, participants: Peppkompis[], text: string, imageDataUrl?: string) {
    if (!state.chats[chatId]) {
        state.chats[chatId] = {
            id: chatId,
            participants: participants.map(p => ({...p})),
            participantUids: participants.map(p => p.uid),
            unreadCounts: {}
        };
    }

    if (!state.chatMessages) state.chatMessages = {};
    if (!state.chatMessages[chatId]) state.chatMessages[chatId] = [];

    const newMessage: ChatMessage = { 
        id: `msg_${Date.now()}`, 
        senderId, 
        text, 
        timestamp: Date.now(),
        ...(imageDataUrl && { imageDataUrl })
    };
    state.chatMessages[chatId].push(newMessage);

    const lastMessageText = text.trim() ? text.trim() : (imageDataUrl ? "📷 Bild" : "");
    state.chats[chatId].lastMessage = { text: lastMessageText, senderId, timestamp: Date.now() };
    
    const recipient = participants.find(p => p.uid !== senderId);
    if (recipient) {
        if (!state.chats[chatId].unreadCounts[recipient.uid]) {
            state.chats[chatId].unreadCounts[recipient.uid] = 0;
        }
        state.chats[chatId].unreadCounts[recipient.uid]++;
    }

    saveMockState(state);
}

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
    if (state.chatMessages && state.chatMessages[chatId]) {
        state.chatMessages[chatId] = state.chatMessages[chatId].filter((m: ChatMessage) => m.id !== messageId);
        // Note: Mock doesn't update lastMessage either, to mirror production behavior.
        saveMockState(state);
    }
}

export function listenForMessages(chatId: string, callback: (messages: ChatMessage[]) => void): () => void {
    const messages = state.chatMessages?.[chatId] || [];
    callback(messages);
    // Realtime not supported in mock, just returns current state.
    return () => {};
}

export async function toggleMessageLike(chatId: string, messageId: string, userId: string) {
    if (!state.chatMessages || !state.chatMessages[chatId]) return;
    
    const msgIndex = state.chatMessages[chatId].findIndex((m: ChatMessage) => m.id === messageId);
    if (msgIndex === -1) return;

    const message = state.chatMessages[chatId][msgIndex];
    if (!message.likes) {
        message.likes = {};
    }

    if (message.likes[userId]) {
        delete message.likes[userId];
    } else {
        message.likes[userId] = true;
    }
    
    saveMockState(state);
}

export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
    if (state.chats[chatId]) {
        state.chats[chatId].unreadCounts[userId] = 0;
        saveMockState(state);
    }
}

export function listenForTotalUnreadCount(userId: string, callback: (count: number) => void): () => void {
    let totalUnread = 0;
    Object.values(state.chats).forEach((chat: any) => {
        if (chat.participantUids.includes(userId) && chat.unreadCounts[userId]) {
            totalUnread += chat.unreadCounts[userId];
        }
    });
    callback(totalUnread);
    // Realtime not supported in mock
    return () => {};
}



// --- COACH-SPECIFIC FUNCTIONS ---
export async function approveMember(memberId: string): Promise<void> {
  const index = state.coachViewMembers.findIndex(m => m.id === memberId);
  if (index > -1) {
    state.coachViewMembers[index].status = 'approved';
  }
  if (memberId === MOCK_USER_ID) {
      state.firestoreUserDocument.status = 'approved';
  }
  saveMockState(state);
}

export async function revokeApproval(memberId: string): Promise<void> {
    const index = state.coachViewMembers.findIndex(m => m.id === memberId);
    if (index > -1) {
        state.coachViewMembers[index].status = 'pending';
        state.coachViewMembers[index].isCourseActive = false;
    }
    if (memberId === MOCK_USER_ID) {
        state.firestoreUserDocument.status = 'pending';
        state.firestoreUserDocument.isCourseActive = false;
    }
    saveMockState(state);
}

export async function fetchCoachViewMembers(): Promise<CoachViewMember[]> {
    return state.coachViewMembers;
}

export async function setCourseAccessForMember(memberId: string, newStatus: boolean): Promise<void> {
    const member = state.coachViewMembers.find((m: CoachViewMember) => m.id === memberId);
    if (member) {
        member.isCourseActive = newStatus;
        if (newStatus) {
            member.courseInterest = false;
        }
    }
    if (memberId === MOCK_USER_ID) {
        state.firestoreUserDocument.isCourseActive = newStatus;
        if (newStatus) {
            state.firestoreUserDocument.courseInterest = false;
        }
    }
    saveMockState(state);
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    const member = state.coachViewMembers.find((m: CoachViewMember) => m.id === userId);
    if (member) {
        member.role = newRole;
    }
     if (userId === MOCK_USER_ID) {
        state.firestoreUserDocument.role = newRole;
    }
    saveMockState(state);
}

export async function fetchDetailedMemberDataForCoach(memberId: string): Promise<AIDataForCoachSummary> {
    const member = state.coachViewMembers.find((m: CoachViewMember) => m.id === memberId);
    if (!member) throw new Error("Mock member not found");

    return {
        memberName: member.name,
        memberProfile: state.userProfile,
        last7DaysSummaries: Object.values(state.pastDaySummaries),
        last5WeightLogs: state.weightLogs.slice(-5),
        currentStreak: member.currentStreak || 0,
        lastLogDate: member.lastLogDate,
        isCourseActive: member.isCourseActive,
        courseProgressSummary: member.courseProgressSummary,
    };
}


export async function bulkApproveMembers(memberIds: string[]): Promise<void> {
    memberIds.forEach(id => {
        approveMember(id);
    });
}

export async function bulkSetCourseAccess(memberIds: string[], newStatus: boolean): Promise<void> {
    memberIds.forEach(id => {
        setCourseAccessForMember(id, newStatus);
    });
}

export async function bulkUpdateUserRole(memberIds: string[], newRole: UserRole): Promise<void> {
    memberIds.forEach(id => {
        updateUserRole(id, newRole);
    });
}
