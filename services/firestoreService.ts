
import { db, functions } from "../firebase";
import type { User } from '@firebase/auth';
import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    getDocFromCache,
    getDocsFromCache,
    query, 
    orderBy,
    where,
    deleteDoc,
    updateDoc,
    writeBatch,
    onSnapshot,
    Timestamp,
    type DocumentReference,
    type Query,
    limit,
    deleteField,
    increment,
    runTransaction,
    arrayUnion,
    startAfter,
    QuerySnapshot,
    collectionGroup
} from "@firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { 
    LoggedMeal, 
    UserProfileData, 
    CoachViewMember, 
    UserRole, 
    FirestoreUserDocument, 
    WeightLogEntry,
    GoalSettings,
    CommonMeal,
    PastDaySummary,
    UserCourseProgress,
    MentalWellbeingLog,
    WeeklyCalorieBank,
    NutritionalInfo,
    PastDaysSummaryCollection,
    UserLessonProgress,
    AIDataForCoachSummary,
    Peppkompis,
    PeppkompisRequest,
    BuddyDetails,
    TimelineEvent,
    TimelineComment,
    Reactions,
    PostCategory,
    Achievement
} from '../types';
import { DEFAULT_GOALS, DEFAULT_USER_PROFILE } from '../constants';
import { courseLessons, menopauseCourseLessons } from '../courseData.ts';
import { getWeekInfo } from "../utils/dateUtils.ts";

/* ===== Helpers ===== */

const getDateUID = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Europe/Stockholm-säker "idag"-nyckel (YYYY-MM-DD)
const TZ = "Europe/Stockholm";
const getDateUID_SE = (d: Date = new Date()): string => {
  const z = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const y = z.getFullYear();
  const m = String(getDateUID_SE_Helper_Month(z)).padStart(2, "0");
  const day = String(z.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getDateUID_SE_Helper_Month = (z: Date) => z.getMonth() + 1;

const formatChange = (change: number | undefined): string => {
  if (change === undefined || change === null || isNaN(change)) return '-';
  if (Math.abs(change) < 0.05) return '±0,0';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1).replace('.', ',')}`;
};

/**
 * Rensar bort undefined-fält från objekt innan de sparas i Firestore.
 * FIX: Ignorerar Firestore interna FieldValue-objekt (som increment) 
 * så att de inte "tvättas" sönder till vanliga text-objekt i databasen.
 */
const cleanFirestoreData = (data: any) => {
  if (typeof data !== 'object' || data === null) return data;
  
  // Om objektet är ett Firestore-kommando (har interna fält som _methodName eller Cc), låt det vara.
  if (data._methodName || data.hasOwnProperty('Cc')) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item));
  }

  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = cleanFirestoreData(value);
    }
    return acc;
  }, {} as any);
};

export const getDocSafe = async (docRef: DocumentReference) => {
  try {
    return await getDoc(docRef);
  } catch (error: any) {
    if (error.code === 'unavailable') {
      console.warn(`Firestore: Server unavailable for ${docRef.path}. Trying cache.`);
      try {
        return await getDocFromCache(docRef);
      } catch (cacheError: any) {
        console.warn(`Firestore: Document ${docRef.path} not found in cache.`);
        return {
          exists: () => false,
          data: () => undefined,
          id: docRef.id,
          ref: docRef
        } as any;
      }
    }
    throw error;
  }
};

export const getDocsSafe = async (queryRef: Query) => {
  try {
    return await getDocs(queryRef);
  } catch (error: any) {
    if (error.code === 'unavailable') {
      console.warn(`Firestore: Server unavailable for query. Trying cache.`);
      try {
        return await getDocsFromCache(queryRef);
      } catch (cacheError: any) {
        console.warn(`Firestore: Query results not found in cache.`);
        return {
          empty: true,
          docs: [],
          size: 0,
          forEach: () => {},
        } as any;
      }
    }
    throw error;
  }
};

/* ===== User bootstrap ===== */

export async function ensureUserProfileInFirestore(fbUser: User) {
  if (!db) return;
  const userDocRef = doc(db, 'users', fbUser.uid);
  const userDoc = await getDocSafe(userDocRef);
  const currentWeekInfo = getWeekInfo(new Date());

  if (!userDoc.exists()) {
    const dayBeforeYesterday = new Date();
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const dayBeforeYesterdayDateString = getDateUID(dayBeforeYesterday);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const newUserDoc: Omit<FirestoreUserDocument, 'createdAt' | 'lastLoginAt'> & { createdAt: any, lastLoginAt: any } = {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName || "Ny användare",
      role: 'member',
      status: 'pending',
      hasCompletedOnboarding: false,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      lastLogDate: null,
      photoURL: fbUser.photoURL || null,
      goals: DEFAULT_GOALS,
      goalType: 'maintain',
      ageYears: null,
      gender: 'female',
      activityLevel: 'moderate',
      currentWeightKg: null,
      heightCm: null,
      measurementMethod: 'inbody',
      desiredWeightChangeKg: null,
      skeletalMuscleMassKg: null,
      bodyFatMassKg: null,
      desiredFatMassChangeKg: null,
      desiredMuscleMassChangeKg: null,
      goalCompletionDate: null,
      currentStreak: 0,
      lastDateStreakChecked: dayBeforeYesterdayDateString,
      summaryStartDate: null, // <-- NYTT: sätts vid onboarding-slut
      highestStreak: 0,
      highestLevelId: null,
      weeklyBank: {
        weekId: currentWeekInfo.weekId,
        bankedCalories: 0,
        startDate: currentWeekInfo.startDate,
        endDate: currentWeekInfo.endDate
      },
      unlockedAchievements: {},
      journeyAnalysisFeedback: null,
      isSearchable: true,
      mainGoalCompleted: false,
      completedGoals: [],
      notificationSettings: DEFAULT_USER_PROFILE.notificationSettings,
      preferredWeighInDay: 'måndag',
      timezone: timezone,
      pushSubscriptions: [],
      coachStyle: DEFAULT_USER_PROFILE.coachStyle || 'balanced',
    };
    await setDoc(userDocRef, newUserDoc);
  } else {
    const existingData = userDoc.data();
    const updateData: any = { lastLoginAt: serverTimestamp() };
    if (fbUser.displayName && existingData.displayName !== fbUser.displayName) {
      updateData.displayName = fbUser.displayName;
    }
    await updateDoc(userDocRef, updateData);
  }
}

/* ===== Initial load ===== */

export async function fetchInitialAppData(userId: string) {
  if (!db) {
    return {
      role: 'member',
      status: 'approved',
      hasCompletedOnboarding: true,
      profile: DEFAULT_USER_PROFILE,
      goals: DEFAULT_GOALS,
      currentStreak: 0,
      lastDateStreakChecked: getDateUID_SE(),
      summaryStartDate: null,
      highestStreak: 0,
      highestLevelId: null,
      weeklyBank: null,
      streakSaver: null,
      commonMeals: [],
      weightLogs: [],
      pastDaySummaries: {},
      courseProgress: {},
      unlockedAchievements: {},
      achievementInteractions: {},
      journeyAnalysisFeedback: null,
      pushSubscriptions: [],
      mentalWellbeingLogs: [],
    };
  }
  const userDocRef = doc(db, 'users', userId);
  const commonMealsRef = collection(db, 'users', userId, 'commonMeals');
  const weightLogsRef = collection(db, 'users', userId, 'weightLogs');
  const courseProgressRef = collection(db, 'users', userId, 'courseProgress');
  const pastSummariesRef = collection(db, 'users', userId, 'pastDaySummaries');
  const achievementInteractionsRef = collection(db, 'users', userId, 'achievementInteractions');
  const mentalWellbeingLogsRef = collection(db, 'users', userId, 'mentalWellbeingLogs');

  const commonMealsQuery = query(commonMealsRef, orderBy('name'));
  const weightLogsQuery = query(weightLogsRef, orderBy('loggedAt'));
  const mentalWellbeingLogsQuery = query(mentalWellbeingLogsRef, orderBy('loggedAt', 'desc'), limit(30));

  try {
    const [
      userDocSnap,
      commonMealsSnap,
      weightLogsSnap,
      courseProgressSnap,
      pastSummariesSnap,
      achievementInteractionsSnap,
      mentalWellbeingLogsSnap
    ] = await Promise.all([
      getDocSafe(userDocRef),
      getDocsSafe(commonMealsQuery),
      getDocsSafe(weightLogsQuery),
      getDocsSafe(courseProgressRef),
      getDocsSafe(pastSummariesRef),
      getDocsSafe(achievementInteractionsRef),
      getDocsSafe(mentalWellbeingLogsQuery)
    ]);
    
    if (!userDocSnap.exists()) {
      console.error("No user document found for ID:", userId);
      return null;
    }

    const userDocData = userDocSnap.data() as FirestoreUserDocument;

    // --- SJÄLVLÄKNING AV SPARPOT ---
    if (userDocData.weeklyBank && typeof userDocData.weeklyBank.bankedCalories !== 'number') {
      const corruptValue: any = userDocData.weeklyBank.bankedCalories;
      const healedValue = (corruptValue && typeof corruptValue.Cc === 'number') ? corruptValue.Cc : 0;
      userDocData.weeklyBank.bankedCalories = healedValue;
    }

    const profile: UserProfileData = {
      name: userDocData.displayName,
      photoURL: userDocData.photoURL ?? undefined,
      currentWeightKg: userDocData.currentWeightKg ?? undefined,
      heightCm: userDocData.heightCm ?? undefined,
      ageYears: userDocData.ageYears ?? undefined,
      gender: userDocData.gender,
      activityLevel: userDocData.activityLevel ?? 'moderate',
      goalType: userDocData.goalType,
      measurementMethod: userDocData.measurementMethod ?? 'inbody',
      desiredWeightChangeKg: userDocData.desiredWeightChangeKg ?? undefined,
      skeletalMuscleMassKg: userDocData.skeletalMuscleMassKg ?? undefined,
      bodyFatMassKg: userDocData.bodyFatMassKg ?? undefined,
      desiredFatMassChangeKg: userDocData.desiredFatMassChangeKg ?? undefined,
      desiredMuscleMassChangeKg: userDocData.desiredMuscleMassChangeKg ?? undefined,
      goalCompletionDate: userDocData.goalCompletionDate ?? undefined,
      isSearchable: userDocData.isSearchable,
      goalStartWeight: userDocData.goalStartWeight ?? undefined,
      goalStartMuscleMassKg: userDocData.goalStartMuscleMassKg ?? undefined,
      goalStartFatMassKg: userDocData.goalStartFatMassKg ?? undefined,
      mainGoalCompleted: userDocData.mainGoalCompleted ?? false,
      completedGoals: userDocData.completedGoals ?? [],
      notificationSettings: userDocData.notificationSettings,
      preferredWeighInDay: userDocData.preferredWeighInDay,
      coachStyle: ((userDocData.coachStyle as string) === 'tough' ? 'hard' : userDocData.coachStyle) || DEFAULT_USER_PROFILE.coachStyle,
      subscriptionStatus: userDocData.subscriptionStatus,
      currentPeriodEnd: userDocData.currentPeriodEnd,
    };
    
    const commonMeals = commonMealsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CommonMeal[];
    const weightLogs = weightLogsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as WeightLogEntry[];
    const courseProgress: UserCourseProgress = {};
    courseProgressSnap.forEach(doc => {
      courseProgress[doc.id] = doc.data() as UserLessonProgress;
    });
    const pastDaySummaries: PastDaysSummaryCollection = {};
    pastSummariesSnap.forEach(doc => {
      pastDaySummaries[doc.id] = doc.data() as PastDaySummary;
    });
    const achievementInteractions: { [id: string]: { reactions: Reactions } } = {};
    achievementInteractionsSnap.forEach(doc => {
      achievementInteractions[doc.id] = doc.data() as { reactions: Reactions };
    });
    const mentalWellbeingLogs = mentalWellbeingLogsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as MentalWellbeingLog[];

    return {
      role: userDocData.role,
      status: userDocData.status,
      hasCompletedOnboarding: userDocData.hasCompletedOnboarding,
      profile,
      goals: userDocData.goals,
      currentStreak: userDocData.currentStreak,
      lastDateStreakChecked: userDocData.lastDateStreakChecked,
      summaryStartDate: userDocData.summaryStartDate ?? null,
      highestStreak: userDocData.highestStreak,
      highestLevelId: userDocData.highestLevelId,
      weeklyBank: userDocData.weeklyBank,
      streakSaver: userDocData.streakSaver ?? null,
      commonMeals,
      weightLogs,
      pastDaySummaries,
      courseProgress,
      unlockedAchievements: userDocData.unlockedAchievements,
      achievementInteractions,
      journeyAnalysisFeedback: userDocData.journeyAnalysisFeedback,
      pushSubscriptions: userDocData.pushSubscriptions ?? [],
      mentalWellbeingLogs,
    };

  } catch (error) {
    console.error("Error fetching initial app data:", error);
    throw error;
  }
}

/* ===== Meals / logs ===== */

export async function addMealLog(userId: string, mealId: string, mealData: Omit<LoggedMeal, 'id'>) {
  if (!db) return;
  const mealLogRef = doc(db, 'users', userId, 'mealLogs', mealId);
  const userDocRef = doc(db, 'users', userId);
  
  const batch = writeBatch(db);
  batch.set(mealLogRef, cleanFirestoreData(mealData));
  batch.update(userDocRef, { lastLogDate: mealData.dateString });
  await batch.commit();
}

export async function deleteMealLog(userId: string, mealLogId: string) {
  if (!db) return;
  const mealLogRef = doc(db, 'users', userId, 'mealLogs', mealLogId);
  await deleteDoc(mealLogRef);
}

export async function updateMealLog(userId: string, mealLogId: string, updatedInfo: Partial<NutritionalInfo>) {
  if (!db) return;
  const mealLogRef = doc(db, 'users', userId, 'mealLogs', mealLogId);
  await updateDoc(mealLogRef, { nutritionalInfo: cleanFirestoreData(updatedInfo) });
}

export async function fetchMealLogsForDate(userId: string, dateUID: string): Promise<LoggedMeal[]> {
  if (!db) return [];
  const mealLogsRef = collection(db, 'users', userId, 'mealLogs');
  const q = query(mealLogsRef, where("dateString", "==", dateUID), orderBy("timestamp", "desc"));
  const querySnapshot = await getDocsSafe(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LoggedMeal[];
}

/* ===== Timeline Helper ===== */

// Helper to fetch sub-collections (comments/likes) for events
const enrichTimelineEvents = async (snapshot: QuerySnapshot): Promise<{ events: TimelineEvent[], lastDoc: any }> => {
    if (snapshot.empty) {
        return { events: [], lastDoc: null };
    }
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    const eventsPromises = snapshot.docs.map(async (doc) => {
        const eventData = { id: doc.id, ...doc.data() } as TimelineEvent;
        
        // Fetch comments subcollection
        const commentsRef = collection(db, 'communityTimeline', eventData.id, 'comments');
        const commentsQuery = query(commentsRef, orderBy('timestamp', 'asc'));
        const commentsSnapshot = await getDocsSafe(commentsQuery);
        
        const commentsWithLikesPromises = commentsSnapshot.docs.map(async (commentDoc) => {
            const commentData = { id: commentDoc.id, ...commentDoc.data() } as TimelineComment;
            
            // Fetch likes subcollection for each comment
            const likesRef = collection(db, 'communityTimeline', eventData.id, 'comments', commentDoc.id, 'likes');
            const likesSnapshot = await getDocsSafe(likesRef);
            
            const likesMap: { [uid: string]: string } = {};
            likesSnapshot.forEach(likeDoc => {
                likesMap[likeDoc.id] = likeDoc.data().userName; 
            });
            
            commentData.likes = likesMap;
            return commentData;
        });
        
        eventData.comments = await Promise.all(commentsWithLikesPromises);
        return eventData;
    });

    const events = await Promise.all(eventsPromises);
    return { events, lastDoc };
};

/* ===== Timeline ===== */

export async function getActiveBootcampForUser(userId: string): Promise<string | null> {
    if (!db) return null;
    try {
        const q = query(collectionGroup(db, 'participants'), where('userId', '==', userId));
        const snapshot = await getDocsSafe(q);
        if (!snapshot.empty) {
            const participantData = snapshot.docs[0].data() as any;
            if (participantData.status === 'fas1' || participantData.status === 'fas2') {
                return participantData.cohortId || snapshot.docs[0].ref.parent.parent?.id || null;
            }
        }
    } catch (e) {
        console.error("Failed to fetch active bootcamp for user", e);
    }
    return null;
}

// 1. Listen for NEW events (Real-time)
export function listenToBootcampTimeline(
  cohortId: string,
  onUpdate: (events: TimelineEvent[]) => void
) {
    if (!db) return () => {};

    const q = query(
        collection(db, 'communityTimeline'),
        where('bootcampId', '==', cohortId),
        orderBy('timestamp', 'desc'),
        limit(20)
    );

    return onSnapshot(q, async (snapshot) => {
        const { events } = await enrichTimelineEvents(snapshot);
        onUpdate(events);
    }, (error) => {
        console.error("Error listening to bootcamp timeline:", error);
    });
}

export async function fetchBootcampTimeline(
  cohortId: string,
  lastEvent: TimelineEvent | null = null
): Promise<TimelineEvent[]> {
    if (!db) return [];

    let q = query(
        collection(db, 'communityTimeline'),
        where('bootcampId', '==', cohortId),
        orderBy('timestamp', 'desc'),
        limit(20)
    );

    if (lastEvent) {
        const lastDocRef = doc(db, 'communityTimeline', lastEvent.id);
        const lastDocSnap = await getDocSafe(lastDocRef);
        if (lastDocSnap.exists()) {
            q = query(q, startAfter(lastDocSnap));
        }
    }

    const snapshot = await getDocs(q);
    const { events } = await enrichTimelineEvents(snapshot);
    return events;
}

export function listenToCommunityTimeline(
  userId: string, 
  callback: (data: { events: TimelineEvent[], lastDoc: any }) => void,
  limitCount: number = 20,
  bootcampId?: string | null
) {
  if (!db) {
    callback({ events: [], lastDoc: null });
    return () => {};
  }
  
  const visibleToArray = [userId, 'GLOBAL'];
  if (bootcampId) visibleToArray.push(bootcampId);

  const q = query(
    collection(db, 'communityTimeline'),
    where('visibleTo', 'array-contains-any', visibleToArray),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, async (snapshot) => {
    // Note: async inside onSnapshot callback works, but data might lag slightly behind the sync snapshot emission.
    // This is generally acceptable for this use case.
    const { events, lastDoc } = await enrichTimelineEvents(snapshot);
    callback({ events, lastDoc });
  }, (error) => {
    console.error("Error listening to timeline:", error);
  });
}

// 2. Fetch OLDER events (Pagination)
export async function _fetchCommunityTimelinePaginated(
  currentUserId: string, 
  lastSnapshot: any = null, 
  limitCount: number = 10,
  bootcampId?: string | null
): Promise<{ events: TimelineEvent[], lastDoc: any }> {
  if (!db) return { events: [], lastDoc: null };
  
  const visibleToArray = [currentUserId, 'GLOBAL'];
  if (bootcampId) visibleToArray.push(bootcampId);

  let q = query(
    collection(db, 'communityTimeline'),
    where('visibleTo', 'array-contains-any', visibleToArray),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );

  if (lastSnapshot) {
      q = query(q, startAfter(lastSnapshot));
  }
  
  try {
    const snapshot = await getDocsSafe(q);
    return enrichTimelineEvents(snapshot);
  } catch (error: any) {
      console.error("Error fetching community timeline:", error);
      if (error.code === 'failed-precondition') {
          console.error("Firestore Index Missing! Please check the Firebase Console link in the error object above to create it.");
      }
      throw error;
  }
}

export async function fetchCommunityTimeline(
  currentUserId: string, 
  lastSnapshot: any = null, 
  limitCount: number = 10,
  bootcampId?: string | null
): Promise<TimelineEvent[]> {
    const { events } = await _fetchCommunityTimelinePaginated(currentUserId, lastSnapshot, limitCount, bootcampId);
    return events;
}

export async function createUserPost(
  userId: string,
  text: string,
  category: PostCategory,
  imageBase64?: string,
  visibility: 'global' | 'friends' | 'bootcamp' | 'bootcamp_and_friends' = 'friends',
  overrideName?: string,
  overridePhotoURL?: string,
  bootcampId?: string | null
) {
    if (!db) return { id: `post_${Date.now()}`, type: 'user_post', timestamp: Date.now(), title: 'Mock Post', description: text, icon: '📝', userId, userName: overrideName || 'Mock', userPhotoURL: overridePhotoURL || null, gender: 'female', visibleTo: [], reactions: {}, comments: [], relatedDocPath: '', category, imageUrl: imageBase64 } as any;
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDocSafe(userDocRef);
    if (!userDocSnap.exists()) throw new Error("User not found");
    const userData = userDocSnap.data() as FirestoreUserDocument;

    let visibleTo: string[] = [];
    let isGlobal = false;
    
    if (visibility === 'global') {
        visibleTo = ['GLOBAL'];
        isGlobal = true;
    } else if (visibility === 'bootcamp_and_friends') {
        const buddies = await fetchBuddies(userId);
        const buddyUids = buddies.map(b => b.uid);
        visibleTo = [userId, ...buddyUids];
        if (bootcampId) visibleTo.push(bootcampId);
    } else if (visibility === 'bootcamp') {
        if (bootcampId) visibleTo = [bootcampId];
        else visibleTo = [userId]; // Fallback
    } else {
        // friends
        const buddies = await fetchBuddies(userId);
        const buddyUids = buddies.map(b => b.uid);
        visibleTo = [userId, ...buddyUids];
    }

    const eventId = `post_${userId}_${Date.now()}`;
    const timelineDocRef = doc(db, "communityTimeline", eventId);

    // Calculate goal text and progress
    let goalTextAtPost = 'Mål: Bibehålla';
    let progressAtPost = 0;
    
    if (userData.measurementMethod === 'scale' && userData.desiredWeightChangeKg) {
        goalTextAtPost = `Mål: ${userData.desiredWeightChangeKg > 0 ? '+' : ''}${userData.desiredWeightChangeKg} kg`;
    } else {
        if (userData.desiredFatMassChangeKg) goalTextAtPost = `Mål: ${userData.desiredFatMassChangeKg} kg fett`;
        else if (userData.desiredMuscleMassChangeKg) goalTextAtPost = `Mål: +${userData.desiredMuscleMassChangeKg} kg muskler`;
    }
    
    // Calculate progress
    const isScaleGoal = userData.measurementMethod === 'scale';
    const isFatLossGoal = !isScaleGoal && userData.desiredFatMassChangeKg && userData.desiredFatMassChangeKg < 0;
    const isMuscleGainGoal = !isScaleGoal && userData.desiredMuscleMassChangeKg && userData.desiredMuscleMassChangeKg > 0;
    
    let start, current, goalChange;
    if (isFatLossGoal) {
        start = userData.goalStartFatMassKg || userData.goalStartWeight;
        current = userData.bodyFatMassKg || userData.currentWeightKg;
        goalChange = userData.desiredFatMassChangeKg;
    } else if (isMuscleGainGoal) {
        start = userData.goalStartMuscleMassKg || userData.goalStartWeight;
        current = userData.skeletalMuscleMassKg || userData.currentWeightKg;
        goalChange = userData.desiredMuscleMassChangeKg;
    } else {
        start = userData.goalStartWeight;
        current = userData.currentWeightKg;
        goalChange = userData.desiredWeightChangeKg;
    }
    
    if (userData.mainGoalCompleted) {
        progressAtPost = 100;
    } else if (start != null && current != null && goalChange) {
        const totalChangeNeeded = Math.abs(goalChange);
        let changeAchieved = goalChange > 0 ? current - start : start - current;
        changeAchieved = Math.max(0, changeAchieved);
        if (totalChangeNeeded < 0.01) progressAtPost = 100;
        else progressAtPost = Math.max(0, Math.min((changeAchieved / totalChangeNeeded) * 100, 100));
    }

    // Fetch active bootcamp for bootcamp streak
    let bootcampStreakAtPost: number | undefined = undefined;
    try {
        const { getUserActiveBootcamp } = await import('./bootcampService');
        const activeBootcamp = await getUserActiveBootcamp(userId);
        if (activeBootcamp) {
            bootcampStreakAtPost = activeBootcamp.currentStreak || 0;
        }
    } catch (e) {
        console.error("Failed to fetch bootcamp streak for post", e);
    }

    const isBootcampPost = visibility === 'bootcamp' || visibility === 'bootcamp_and_friends';
    const isCoachPost = overrideName !== undefined;
    
    let title = 'skapade ett inlägg';
    if (isGlobal) {
        title = 'delade ett meddelande till alla';
    } else if (isCoachPost && isBootcampPost) {
        title = 'delade ett meddelande till truppen';
    }

    const postEvent: Omit<TimelineEvent, 'id'> = {
        type: 'user_post',
        timestamp: Date.now(),
        title: title,
        description: text,
        icon: (isGlobal || isCoachPost) ? '📢' : category === 'pepp' ? '💖' : category === 'workout' ? '💪' : category === 'food' ? '🥗' : category === 'question' ? '❓' : '📝',
        userId: userId,
        userName: overrideName || userData.displayName,
        userPhotoURL: overridePhotoURL !== undefined ? overridePhotoURL : (userData.photoURL ?? null),
        gender: userData.gender,
        visibleTo: visibleTo,
        reactions: {},
        comments: [],
        relatedDocPath: `users/${userId}/posts/${eventId}`,
        category: category,
        imageUrl: imageBase64, // Note: Saving base64 directly to Firestore doc. Keep images small (<500kb).
        isGlobal: isGlobal,
        streakAtPost: userData.currentStreak || 0,
        bootcampStreakAtPost: bootcampStreakAtPost,
        goalTextAtPost: goalTextAtPost,
        progressAtPost: progressAtPost,
        bootcampId: isBootcampPost && bootcampId ? bootcampId : undefined
    };

    await setDoc(timelineDocRef, cleanFirestoreData(postEvent));
    return { id: eventId, ...postEvent };
}

export async function deleteTimelineEvent(eventId: string): Promise<void> {
  if (!db) return;
  const eventRef = doc(db, 'communityTimeline', eventId);
  await deleteDoc(eventRef);
}

export async function addTimelineEvent(
  userId: string,
  eventData: Omit<TimelineEvent, 'id' | 'userId' | 'userName' | 'userPhotoURL' | 'gender' | 'relatedDocPath' | 'reactions' | 'comments'> & { relatedDocId: string }
) {
  if (!db) return;
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDocSafe(userDocRef);
  if (!userDocSnap.exists()) {
    console.error(`Could not create timeline event: User ${userId} not found.`);
    return;
  }
  const userData = userDocSnap.data() as FirestoreUserDocument;

  const buddies = await fetchBuddies(userId);
  const buddyUids = buddies.map(b => b.uid);
  const visibleTo = [userId, ...buddyUids];

  // Fetch bootcamp info if applicable
  let bootcampStreakAtPost: number | undefined;
  let bootcampId: string | undefined;
  try {
    const { getUserActiveBootcamp } = await import('./bootcampService');
    const activeBootcamp = await getUserActiveBootcamp(userId);
    if (activeBootcamp) {
      bootcampStreakAtPost = activeBootcamp.currentStreak;
      bootcampId = activeBootcamp.cohortId;
    }
  } catch (e) {
    console.warn("Could not fetch bootcamp info for timeline event", e);
  }

  // Calculate goal text and progress
  let goalTextAtPost: string | undefined;
  let progressAtPost: number | undefined;
  try {
    const { calculateProgressPercentage, getGoalShortDescription } = await import('../utils/progressUtils');
    goalTextAtPost = getGoalShortDescription(
      userData.measurementMethod,
      userData.desiredWeightChangeKg,
      userData.desiredFatMassChangeKg,
      userData.desiredMuscleMassChangeKg
    );
    
    let goalSummary = "Ej satt";
    if (userData.goalType === 'maintain') goalSummary = "Bibehålla";
    else if (userData.goalType === 'lose_fat') goalSummary = `${userData.desiredFatMassChangeKg || userData.desiredWeightChangeKg || ''} kg fett`;
    else if (userData.goalType === 'gain_muscle') goalSummary = `${userData.desiredMuscleMassChangeKg || userData.desiredWeightChangeKg || ''} kg muskler`;

    if (goalTextAtPost === 'Mål: Bibehålla' && goalSummary) {
      goalTextAtPost = goalSummary;
    }
    
    // Calculate progress using the correct property names from FirestoreUserDocument
    let currentWeight = userData.currentWeightKg;
    let currentFatMass = userData.bodyFatMassKg;
    let currentMuscleMass = userData.skeletalMuscleMassKg;
    
    try {
      const weightLogsRef = collection(db, 'users', userId, 'weightLogs');
      const latestLogQuery = query(weightLogsRef, orderBy('loggedAt', 'desc'), limit(1));
      const latestLogSnap = await getDocsSafe(latestLogQuery);
      if (!latestLogSnap.empty) {
        const latestLog = latestLogSnap.docs[0].data() as WeightLogEntry;
        currentWeight = latestLog.weightKg ?? currentWeight;
        currentFatMass = latestLog.bodyFatMassKg ?? currentFatMass;
        currentMuscleMass = latestLog.skeletalMuscleMassKg ?? currentMuscleMass;
      }
    } catch (e) {
      console.warn("Could not fetch weight logs for progress calculation", e);
    }
    
    progressAtPost = calculateProgressPercentage(
      userData.measurementMethod,
      userData.goalStartWeight, currentWeight, userData.desiredWeightChangeKg,
      userData.goalStartFatMassKg, currentFatMass, userData.desiredFatMassChangeKg,
      userData.goalStartMuscleMassKg, currentMuscleMass, userData.desiredMuscleMassChangeKg,
      false // mainGoalCompleted is not easily available here
    );
  } catch (e) {
    console.warn("Could not calculate goal info for timeline event", e);
  }

  const uniqueEventId = `users--${userId}--${eventData.type}--${eventData.relatedDocId}`;
  const timelineDocRef = doc(db, "communityTimeline", uniqueEventId);
  
  const fullEvent: Omit<TimelineEvent, 'id'> = {
    ...eventData,
    userId: userId,
    userName: userData.displayName,
    userPhotoURL: userData.photoURL ?? null,
    gender: userData.gender,
    visibleTo: visibleTo,
    reactions: {},
    comments: [],
    relatedDocPath: `users/${userId}/${eventData.type}/${eventData.relatedDocId}`,
    streakAtPost: userData.currentStreak || 0,
    bootcampStreakAtPost: bootcampStreakAtPost,
    bootcampId: bootcampId,
    goalTextAtPost: goalTextAtPost,
    progressAtPost: progressAtPost
  };
  delete (fullEvent as any).relatedDocId;

  try {
    await runTransaction(db, async (transaction) => {
      const eventDoc = await transaction.get(timelineDocRef);
      if (eventDoc.exists()) {
        console.log(`Timeline event with ID "${uniqueEventId}" already exists. Skipping creation.`);
        return;
      }
      transaction.set(timelineDocRef, cleanFirestoreData(fullEvent));
    });
  } catch (error) {
    console.error("Transaction to create timeline event failed: ", error);
    throw error;
  }
}

/* ===== Water ===== */

export async function setWaterLog(userId: string, dateUID: string, waterMl: number) {
  if (!db) return;
  const waterLogRef = doc(db, 'users', userId, 'waterLogs', dateUID);
  await setDoc(waterLogRef, { dateUID, waterLoggedMl: waterMl });
}

export async function fetchWaterLog(userId: string, dateUID: string): Promise<number> {
  if (!db) return 0;
  const waterLogRef = doc(db, 'users', userId, 'waterLogs', dateUID);
  const docSnap = await getDocSafe(waterLogRef);
  return docSnap.exists() ? docSnap.data().waterLoggedMl : 0;
}

/* ===== Common meals ===== */

export async function addCommonMeal(userId: string, commonMealData: Omit<CommonMeal, 'id'>) {
  if (!db) return `cm_${Date.now()}`;
  const commonMealsRef = collection(db, 'users', userId, 'commonMeals');
  const docRef = await addDoc(commonMealsRef, cleanFirestoreData(commonMealData));
  return docRef.id;
}

export async function deleteCommonMeal(userId: string, commonMealId: string) {
  if (!db) return;
  const commonMealRef = doc(db, 'users', userId, 'commonMeals', commonMealId);
  await deleteDoc(commonMealRef);
}

export async function updateCommonMeal(userId: string, commonMealId: string, updatedData: { name: string; nutritionalInfo: NutritionalInfo }) {
  if (!db) return;
  const commonMealRef = doc(db, 'users', userId, 'commonMeals', commonMealId);
  await updateDoc(commonMealRef, cleanFirestoreData(updatedData));
}

/* ===== Profile & goals ===== */

export async function saveProfileAndGoals(userId: string, profile: UserProfileData, goals: GoalSettings) {
  if (!db) return;
  const userDocRef = doc(db, 'users', userId);

  let maybeSummaryStart: string | undefined;
  let currentDocData: FirestoreUserDocument | undefined;
  try {
    const snap = await getDocSafe(userDocRef);
    if (snap.exists()) {
      currentDocData = snap.data() as FirestoreUserDocument;
      if (!currentDocData.summaryStartDate) {
        maybeSummaryStart = getDateUID_SE();
      }
    }
  } catch (e) {
    console.warn("Could not read userDoc before updating profile/goals.", e);
  }

  const dataToUpdate: any = {
    ...profile,
    goals: goals,
    displayName: profile.name,
    ...(maybeSummaryStart ? { summaryStartDate: maybeSummaryStart } : {}),
  };

  // Check if goal has changed
  const goalChanged = currentDocData && (
    currentDocData.goalType !== profile.goalType ||
    currentDocData.measurementMethod !== profile.measurementMethod ||
    currentDocData.desiredWeightChangeKg !== profile.desiredWeightChangeKg ||
    currentDocData.desiredFatMassChangeKg !== profile.desiredFatMassChangeKg ||
    currentDocData.desiredMuscleMassChangeKg !== profile.desiredMuscleMassChangeKg
  );

  if (!currentDocData || goalChanged) {
    // Set goal start date to today
    dataToUpdate.goalStartDate = new Date().toISOString().split('T')[0];
  }

  if (goalChanged) {
    // Reset goal completion status
    dataToUpdate.mainGoalCompleted = false;

    // Fetch the latest weight log to set as the new start value
    try {
      const weightLogsRef = collection(db, 'users', userId, 'weightLogs');
      const latestLogQuery = query(weightLogsRef, orderBy('loggedAt', 'desc'), limit(1));
      const latestLogSnap = await getDocsSafe(latestLogQuery);
      
      if (!latestLogSnap.empty) {
        const latestLog = latestLogSnap.docs[0].data() as WeightLogEntry;
        if (latestLog.weightKg != null) dataToUpdate.goalStartWeight = latestLog.weightKg;
        if (latestLog.bodyFatMassKg != null) dataToUpdate.goalStartFatMassKg = latestLog.bodyFatMassKg;
        if (latestLog.skeletalMuscleMassKg != null) dataToUpdate.goalStartMuscleMassKg = latestLog.skeletalMuscleMassKg;
      }
    } catch (e) {
      console.warn("Could not fetch latest weight log to set goal start values.", e);
    }
  }

  await updateDoc(userDocRef, cleanFirestoreData(dataToUpdate));
}

/* ===== Gamification: Achievements ===== */

export async function unlockAchievement(userId: string, achievementId: string, achievementName: string, achievementIcon: string, description: string): Promise<boolean> {
    if (!db) return true;
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDocSafe(userRef);

    if (userSnap.exists()) {
        const data = userSnap.data() as FirestoreUserDocument;
        // Check if already unlocked to prevent duplicates
        if (data.unlockedAchievements && data.unlockedAchievements[achievementId]) {
            return false; 
        }
    }

    // Unlock in Firestore
    await setDoc(userRef, {
        unlockedAchievements: {
            [achievementId]: new Date().toISOString()
        }
    }, { merge: true });

    // Create a timeline event for the achievement
    await addTimelineEvent(userId, {
        type: 'achievement',
        timestamp: Date.now(),
        title: 'har låst upp en bragd!',
        description: `${achievementName} - ${description}`,
        icon: achievementIcon,
        relatedDocId: `ach_${achievementId}` // Ensure unique per achievement
    });

    return true;
}

export async function checkAndUnlockAchievements(
    userId: string, 
    currentStreak: number, 
    isMainGoalCompleted: boolean, 
    completedLessonsCount: number, 
    totalLessonsCount: number,
    achievementsDef: Achievement[]
): Promise<Achievement[]> {
    if (!db) return [];
    
    const unlockedNow: Achievement[] = [];
    
    // Check Streak Achievements
    const streakAchs = achievementsDef.filter(a => a.type === 'streak' && a.requiredValue <= currentStreak);
    for (const ach of streakAchs) {
        const unlocked = await unlockAchievement(userId, ach.id, ach.name, ach.icon, ach.description);
        if (unlocked) unlockedNow.push(ach);
    }
    
    // Check Goal Achievement
    if (isMainGoalCompleted) {
        const goalAch = achievementsDef.find(a => a.id === 'main_goal_reached');
        if (goalAch) {
            const unlocked = await unlockAchievement(userId, goalAch.id, goalAch.name, goalAch.icon, goalAch.description);
            if (unlocked) unlockedNow.push(goalAch);
        }
    }
    
    // Check Course Achievement
    if (totalLessonsCount > 0 && completedLessonsCount >= totalLessonsCount) {
        const courseAch = achievementsDef.find(a => a.id === 'course_completed');
        if (courseAch) {
            const unlocked = await unlockAchievement(userId, courseAch.id, courseAch.name, courseAch.icon, courseAch.description);
            if (unlocked) unlockedNow.push(courseAch);
        }
    }
    
    return unlockedNow;
}

/* ===== Weight ===== */

export async function saveWeightLog(userId: string, weightLog: Omit<WeightLogEntry, 'id'>) {
  if (!db) return `wl_${Date.now()}`;
  const weightLogsRef = collection(db, 'users', userId, 'weightLogs');
  const userDocRef = doc(db, 'users', userId);
  
  // 1. Spara loggen i dess kollektion
  const docRef = await addDoc(weightLogsRef, cleanFirestoreData(weightLog));
  const newLogId = docRef.id;

  // 2. Uppdatera även användardokumentets "nuvarande" värden (vikt, muskler, fett)
  // Detta säkerställer att herokort och progressbars är i synk.
  const profileUpdates: any = {
    currentWeightKg: weightLog.weightKg,
  };
  if (weightLog.skeletalMuscleMassKg !== undefined) profileUpdates.skeletalMuscleMassKg = weightLog.skeletalMuscleMassKg;
  if (weightLog.bodyFatMassKg !== undefined) profileUpdates.bodyFatMassKg = weightLog.bodyFatMassKg;
  
  await updateDoc(userDocRef, cleanFirestoreData(profileUpdates));

  // --- Automatic Timeline Event ---
  try {
    const logsQuery = query(weightLogsRef, orderBy('loggedAt', 'desc'), limit(2));
    const logsSnap = await getDocsSafe(logsQuery);
    
    let previousLog: WeightLogEntry | null = null;
    for (const doc of logsSnap.docs) {
      if (doc.id !== newLogId) {
        previousLog = doc.data() as WeightLogEntry;
        break;
      }
    }

    let weightChange, muscleChange, fatChange;
    if (previousLog) {
      weightChange = weightLog.weightKg - previousLog.weightKg;
      if (weightLog.skeletalMuscleMassKg != null && previousLog.skeletalMuscleMassKg != null) {
        muscleChange = weightLog.skeletalMuscleMassKg - previousLog.skeletalMuscleMassKg;
      }
      if (weightLog.bodyFatMassKg != null && previousLog.bodyFatMassKg != null) {
        fatChange = weightLog.bodyFatMassKg - previousLog.bodyFatMassKg;
      }
    }

    const descriptionParts = [`Vikt: ${weightLog.weightKg.toFixed(1)}kg (${formatChange(weightChange)})`];
    if (weightLog.skeletalMuscleMassKg != null) {
      descriptionParts.push(`Muskler: ${weightLog.skeletalMuscleMassKg.toFixed(1)}kg (${formatChange(muscleChange)})`);
    }
    if (weightLog.bodyFatMassKg != null) {
      descriptionParts.push(`Fett: ${weightLog.bodyFatMassKg.toFixed(1)}kg (${formatChange(fatChange)})`);
    }

    await addTimelineEvent(userId, {
      type: 'weight',
      timestamp: weightLog.loggedAt,
      title: 'har loggat en ny mätning',
      description: descriptionParts.join('\n'),
      icon: '⚖️',
      relatedDocId: newLogId
    });

  } catch (err) {
    console.error("Failed to add weight log to timeline:", err);
  }

  return newLogId;
}

/* ===== Wellbeing ===== */

export async function addMentalWellbeingLog(userId: string, logData: Omit<MentalWellbeingLog, 'id'>): Promise<string> {
  if (!db) return `wellbeing_${Date.now()}`;
  const wellbeingLogsRef = collection(db, 'users', userId, 'mentalWellbeingLogs');
  const docRef = await addDoc(wellbeingLogsRef, cleanFirestoreData(logData));
  return docRef.id;
}

export async function fetchMentalWellbeingLogs(userId: string): Promise<MentalWellbeingLog[]> {
  if (!db) return [];
  const logsRef = collection(db, 'users', userId, 'mentalWellbeingLogs');
  const q = query(logsRef, orderBy("loggedAt", "desc"), limit(30));
  const querySnapshot = await getDocsSafe(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MentalWellbeingLog[];
}

/* ===== Summaries & user doc misc ===== */

export async function setPastDaySummary(userId: string, dateUID: string, summary: PastDaySummary) {
  if (!db) return;
  const summaryRef = doc(db, 'users', userId, 'pastDaySummaries', dateUID);
  await setDoc(summaryRef, cleanFirestoreData(summary), { merge: true });
}

export async function updateUserDocument(userId: string, data: { [key: string]: any }) {
  if (!db) return;
  const userDocRef = doc(db, 'users', userId);
  await updateDoc(userDocRef, cleanFirestoreData(data));
}

export async function savePushSubscription(userId: string, subscription: object) {
  if (!db) return;
  const userDocRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const { role, status } = userDoc.data();
    await updateDoc(userDocRef, {
      pushSubscriptions: arrayUnion(subscription),
      role: role,
      status: status,
    });
  }
}

/* ===== Course ===== */

export async function fetchCourseProgressForUser(userId: string): Promise<Record<string, UserLessonProgress>> {
  if (!db) return {};
  const progressCollectionRef = collection(db, 'users', userId, 'courseProgress');
  const snapshot = await getDocsSafe(progressCollectionRef);
  
  const progress: Record<string, UserLessonProgress> = {};
  snapshot.forEach(doc => {
    progress[doc.id] = doc.data() as UserLessonProgress;
  });
  
  return progress;
}

export async function cancelCourse(userId: string, courseId: 'praktisk-viktkontroll' | 'maxa-klimakteriet') {
  if (!db) return;
  const prefix = courseId === 'praktisk-viktkontroll' ? 'lektion' : 'm-lektion';
  const progressCollectionRef = collection(db, 'users', userId, 'courseProgress');
  const snapshot = await getDocsSafe(progressCollectionRef);
  
  const batch = writeBatch(db);
  snapshot.forEach(docSnap => {
    if (docSnap.id.startsWith(prefix)) {
      batch.delete(docSnap.ref);
    }
  });
  await batch.commit();

  // Also update user profile to reflect course is no longer active
  await updateUserDocument(userId, { isCourseActive: false });
}

export async function saveCourseProgress(userId: string, lessonId: string, progress: UserLessonProgress, role: UserRole, status: 'pending' | 'approved' | 'archived') {
  if (!db) return;
  const courseProgressRef = doc(db, 'users', userId, 'courseProgress', lessonId);
  await setDoc(courseProgressRef, cleanFirestoreData(progress), { merge: true });
  
  const progressCollectionRef = collection(db, 'users', userId, 'courseProgress');
  const snapshot = await getDocsSafe(progressCollectionRef);
  
  let completedCount = 0;
  snapshot.forEach(doc => {
    const lessonProgress = doc.data() as UserLessonProgress;
    if (lessonProgress.isCompleted) completedCount++;
  });

  await updateUserDocument(userId, {
    courseProgressSummary: {
      started: !snapshot.empty,
      completedLessons: completedCount,
      totalLessons: courseLessons.length
    },
    role: role,
    status: status,
  });

  if (progress.isCompleted) {
    try {
        let courseName = '';
        let lesson = courseLessons.find(l => l.id === lessonId);
        if (lesson) {
            courseName = 'Praktisk Viktkontroll';
        } else {
            lesson = menopauseCourseLessons.find(l => l.id === lessonId);
            if (lesson) {
                courseName = 'Maxa Klimakteriet';
            }
        }

        if (lesson) {
            await addTimelineEvent(userId, {
                type: 'course',
                timestamp: Date.now(),
                title: `har klarat en lektion i ${courseName}!`,
                description: `Avklarad: ${lesson.title}`,
                icon: '🎓',
                relatedDocId: lessonId
            });
        }
    } catch (e) {
        console.error("Failed to create course timeline event", e);
    }
  }
}

/* ===== Coach ===== */

export async function fetchCoachViewMembers(): Promise<CoachViewMember[]> {
  if (!db) return [];
  const usersRef = collection(db, "users");
  const q = query(usersRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocsSafe(q);

  const toDateString = (createdAt: any): string => {
    if (!createdAt) return 'Okänt';
    if (typeof createdAt.toDate === 'function') {
      return createdAt.toDate().toLocaleDateString('sv-SE');
    }
    if (typeof createdAt === 'string') {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('sv-SE');
    }
    return 'Okänt';
  };

  const membersPromises = snapshot.docs.map(async (doc) => {
    const data = doc.data() as FirestoreUserDocument;

    let goalSummary = "Ej satt";
    if (data.goalType === 'maintain') goalSummary = "Bibehålla";
    else if (data.goalType === 'lose_fat') goalSummary = `${data.desiredFatMassChangeKg || data.desiredWeightChangeKg || ''} kg fett`;
    else if (data.goalType === 'gain_muscle') goalSummary = `${data.desiredMuscleMassChangeKg || data.desiredWeightChangeKg || ''} kg muskler`;

    const buddiesRef = collection(db, "users", data.uid, "buddies");
    const buddiesSnapshot = await getDocsSafe(buddiesRef);
    const numberOfBuddies = buddiesSnapshot.size;

    return {
      id: data.uid,
      name: data.displayName,
      email: data.email || 'N/A',
      role: data.role,
      status: data.status,
      photoURL: data.photoURL ?? undefined,
      memberSince: toDateString(data.createdAt),
      lastLogDate: data.lastLogDate ?? undefined,
      currentStreak: data.currentStreak,
      goalSummary: goalSummary,
      courseProgressSummary: data.courseProgressSummary,
      subscriptionStatus: data.subscriptionStatus || (data.status === 'approved' ? 'active' : 'inactive'),
      ageYears: data.ageYears ?? undefined,
      gender: data.gender,
      numberOfBuddies: numberOfBuddies,
    };
  });

  const members = await Promise.all(membersPromises);
  return members;
}

export async function fetchDetailedMemberDataForCoach(memberId: string): Promise<AIDataForCoachSummary> {
  if (!db) return { memberName: 'Mock', memberProfile: DEFAULT_USER_PROFILE, last7DaysSummaries: [], last5WeightLogs: [], currentStreak: 0, lastLogDate: null, courseProgressSummary: null };
  const userDocRef = doc(db, 'users', memberId);
  const userDocSnap = await getDocSafe(userDocRef);
  if (!userDocSnap.exists()) throw new Error("Member not found");
  const userDocData = userDocSnap.data() as FirestoreUserDocument;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoUID = getDateUID(sevenDaysAgo);

  const summariesRef = collection(db, 'users', memberId, 'pastDaySummaries');
  const summariesQuery = query(summariesRef, where("date", ">=", sevenDaysAgoUID), orderBy("date", "desc"));
  
  const weightLogsRef = collection(db, 'users', memberId, 'weightLogs');
  const weightLogsQuery = query(weightLogsRef, orderBy("loggedAt", "desc"), limit(5));

  const [summariesSnap, weightLogsSnap] = await Promise.all([
    getDocsSafe(summariesQuery),
    getDocsSafe(weightLogsQuery)
  ]);

  const last7DaysSummaries = summariesSnap.docs.map(d => d.data() as PastDaySummary);
  const last5WeightLogs = weightLogsSnap.docs.map(d => d.data() as WeightLogEntry).reverse();

  const memberProfile: UserProfileData = {
    name: userDocData.displayName,
    photoURL: userDocData.photoURL ?? undefined,
    currentWeightKg: userDocData.currentWeightKg ?? undefined,
    heightCm: userDocData.heightCm ?? undefined,
    ageYears: userDocData.ageYears ?? undefined,
    gender: userDocData.gender,
    activityLevel: userDocData.activityLevel ?? 'moderate',
    goalType: userDocData.goalType,
    measurementMethod: userDocData.measurementMethod ?? 'inbody',
    desiredWeightChangeKg: userDocData.desiredWeightChangeKg ?? undefined,
    skeletalMuscleMassKg: userDocData.skeletalMuscleMassKg ?? undefined,
    bodyFatMassKg: userDocData.bodyFatMassKg ?? undefined,
    desiredFatMassChangeKg: userDocData.desiredFatMassChangeKg ?? undefined,
    desiredMuscleMassChangeKg: userDocData.desiredMuscleMassChangeKg ?? undefined,
    goalCompletionDate: userDocData.goalCompletionDate ?? undefined,
    isSearchable: userDocData.isSearchable,
    goalStartWeight: userDocData.goalStartWeight,
    goalStartMuscleMassKg: userDocData.goalStartMuscleMassKg,
    goalStartFatMassKg: userDocData.goalStartFatMassKg,
    mainGoalCompleted: userDocData.mainGoalCompleted,
    completedGoals: userDocData.completedGoals,
    notificationSettings: userDocData.notificationSettings || DEFAULT_USER_PROFILE.notificationSettings,
    preferredWeighInDay: userDocData.preferredWeighInDay,
    coachStyle: userDocData.coachStyle || DEFAULT_USER_PROFILE.coachStyle,
    subscriptionStatus: userDocData.subscriptionStatus || (userDocData.status === 'approved' ? 'active' : 'inactive'),
  };

  return {
    memberName: memberProfile.name!,
    memberProfile,
    last7DaysSummaries,
    last5WeightLogs,
    currentStreak: userDocData.currentStreak,
    lastLogDate: userDocData.lastLogDate,
    courseProgressSummary: userDocData.courseProgressSummary
  };
}

/* ===== Admin & roles ===== */

export async function approveMember(memberId: string) {
  if (!db) return;
  const userDocRef = doc(db, 'users', memberId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const { role } = userDoc.data();
    await updateDoc(userDocRef, { status: 'approved', role });
  }
}
export async function revokeApproval(memberId: string) {
  if (!db) return;
  const userDocRef = doc(db, 'users', memberId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const { role } = userDoc.data();
    await updateDoc(userDocRef, { status: 'pending', role });
  }
}
export async function archiveMember(memberId: string) {
  if (!db) return;
  const userDocRef = doc(db, 'users', memberId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const { role } = userDoc.data();
    await updateDoc(userDocRef, { status: 'archived', role });
  }
}
export async function unarchiveMember(memberId: string) {
  if (!db) return;
  const userDocRef = doc(db, 'users', memberId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const { role } = userDoc.data();
    await updateDoc(userDocRef, { status: 'approved', role });
  }
}
export async function updateUserRole(memberId: string, newRole: UserRole) {
  if (!db) return;
  const userDocRef = doc(db, 'users', memberId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const { status } = userDoc.data();
    await updateDoc(userDocRef, { role: newRole, status });
  }
}
export async function bulkApproveMembers(memberIds: string[]) {
  if (!db) return;
  const batch = writeBatch(db);
  for (const id of memberIds) {
    const userDocRef = doc(db, 'users', id);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const { role } = userDoc.data();
      batch.update(userDocRef, { status: 'approved', role });
    }
  }
  await batch.commit();
}
export async function bulkUpdateUserRole(memberIds: string[], role: UserRole) {
  if (!db) return;
  const batch = writeBatch(db);
  for (const id of memberIds) {
    const userDocRef = doc(db, 'users', id);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const { status } = userDoc.data();
      batch.update(userDocRef, { role, status });
    }
  }
  await batch.commit();
}

/* ===== Social ===== */

export function listenForFriendRequests(userId: string, callback: (requests: PeppkompisRequest[]) => void): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }
  const requestsRef = collection(db, 'peppkompisRequests');
  const q = query(requestsRef, where("toUid", "==", userId));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const requests = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeppkompisRequest));
    const pendingRequests = requests.filter(req => req.status === "pending");
    callback(pendingRequests);
  }, (error) => {
    console.error("Error listening for friend requests:", error);
  });

  return unsubscribe;
}

export async function fetchBuddies(userId: string): Promise<Peppkompis[]> {
  if (!db) return [];
  const buddiesRef = collection(db, 'users', userId, 'buddies');
  const snapshot = await getDocsSafe(buddiesRef);
  return snapshot.docs.map(doc => doc.data() as Peppkompis);
}

export async function fetchUsersByUids(uids: string[]): Promise<BuddyDetails[]> {
  if (!db || uids.length === 0) return [];
  
  const results: BuddyDetails[] = [];
  // Firestore 'in' queries support max 10 items
  for (let i = 0; i < uids.length; i += 10) {
    const chunk = uids.slice(i, i + 10);
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', 'in', chunk));
    const snapshot = await getDocsSafe(q);
    
    snapshot.forEach(doc => {
      const data = doc.data() as FirestoreUserDocument;
      results.push({
        uid: data.uid,
        name: data.displayName,
        email: data.email || '',
        photoURL: data.photoURL,
        role: data.role,
        goalType: data.goalType || 'maintain',
        unlockedAchievements: {}
      });
    });
  }
  
  return results;
}

export async function fetchBuddyDetailsList(userId: string): Promise<BuddyDetails[]> {
  if (!db) return [];
  const buddies = await fetchBuddies(userId);
  if (buddies.length === 0) return [];

  const buddyDetailsPromises = buddies.map(async (buddy) => {
    const userDocRef = doc(db, 'users', buddy.uid);
    const userDocSnap = await getDocSafe(userDocRef);
    if (!userDocSnap.exists()) return null;
    
    const userData = userDocSnap.data() as FirestoreUserDocument;

    const weightLogsRef = collection(db, 'users', buddy.uid, 'weightLogs');
    const latestLogQuery = query(weightLogsRef, orderBy('loggedAt', 'desc'), limit(1));
    const latestLogSnap = await getDocsSafe(latestLogQuery);
    const latestLog = latestLogSnap.empty ? null : latestLogSnap.docs[0].data() as WeightLogEntry;

    const currentWeight = latestLog?.weightKg ?? userData.currentWeightKg;
    const currentMuscleMass = latestLog?.skeletalMuscleMassKg ?? userData.skeletalMuscleMassKg;
    const currentFatMass = latestLog?.bodyFatMassKg ?? userData.bodyFatMassKg;

    let bootcampStreak: number | undefined = undefined;
    let bootcampStatus: string | undefined = undefined;
    try {
      const { getUserActiveBootcamp } = await import('./bootcampService');
      const activeBootcamp = await getUserActiveBootcamp(buddy.uid);
      if (activeBootcamp) {
        bootcampStreak = activeBootcamp.currentStreak;
        bootcampStatus = activeBootcamp.status;
      }
    } catch (e) {
      console.warn("Could not fetch bootcamp info for buddy", e);
    }

    let totalWeightChange, muscleMassChange, fatMassChange;
    if (userData.goalStartWeight != null && currentWeight != null) {
      totalWeightChange = currentWeight - userData.goalStartWeight;
    }
    if (userData.goalStartMuscleMassKg != null && currentMuscleMass != null) {
      muscleMassChange = currentMuscleMass - userData.goalStartMuscleMassKg;
    }
    if (userData.goalStartFatMassKg != null && currentFatMass != null) {
      fatMassChange = currentFatMass - userData.goalStartFatMassKg;
    }

    return {
      ...buddy,
      goalSummary: `${userData.goalType === 'lose_fat' ? 'Fettminskning' : userData.goalType === 'gain_muscle' ? 'Muskelökning' : 'Bibehålla'}`,
      currentStreak: userData.currentStreak,
      unlockedAchievements: userData.unlockedAchievements || {},
      goalStartWeight: userData.goalStartWeight,
      goalStartMuscleMassKg: userData.goalStartMuscleMassKg,
      goalStartFatMassKg: userData.goalStartFatMassKg,
      currentWeight: currentWeight,
      goalType: userData.goalType,
      mainGoalCompleted: userData.mainGoalCompleted,
      totalWeightChange,
      currentMuscleMass: currentMuscleMass,
      muscleMassChange,
      currentFatMass: currentFatMass,
      fatMassChange,
      measurementMethod: userData.measurementMethod,
      desiredWeightChangeKg: userData.desiredWeightChangeKg,
      desiredFatMassChangeKg: userData.desiredFatMassChangeKg,
      desiredMuscleMassChangeKg: userData.desiredMuscleMassChangeKg,
      achievementInteractions: userData.achievementInteractions || {},
      bootcampStreak,
      bootcampStatus,
    } as BuddyDetails;
  });

  const results = await Promise.all(buddyDetailsPromises);
  return results.filter((b): b is BuddyDetails => b !== null);
}

export async function searchForBuddies(currentUserId: string): Promise<Peppkompis[]> {
  if (!db) return [];
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("isSearchable", "==", true));
  const snapshot = await getDocsSafe(q);

  const users: Peppkompis[] = [];
  snapshot.forEach(doc => {
    const data = doc.data() as FirestoreUserDocument;
    if (data.uid !== currentUserId) {
      users.push({
        uid: data.uid,
        name: data.displayName,
        email: data.email || '',
        photoURL: data.photoURL || undefined,
        gender: data.gender,
      });
    }
  });
  return users;
}

export async function sendFriendRequest(fromUser: Peppkompis, toUserUid: string): Promise<void> {
  if (!db) return;
  const requestsRef = collection(db, 'peppkompisRequests');
  const newRequest: Omit<PeppkompisRequest, 'id'> = {
    fromUid: fromUser.uid,
    fromName: fromUser.name,
    fromEmail: fromUser.email,
    toUid: toUserUid,
    status: 'pending',
    createdAt: Date.now(),
  };
  await addDoc(requestsRef, cleanFirestoreData(newRequest));
}

export async function updateFriendRequestStatus(request: PeppkompisRequest, status: 'accepted' | 'declined'): Promise<void> {
  if (!db) return;
  const requestRef = doc(db, 'peppkompisRequests', request.id);
  if (status === 'accepted') {
    await updateDoc(requestRef, { status: "accepted" });
  } else {
    await deleteDoc(requestRef);
  }
}

export async function removeBuddy(currentUserId: string, buddyUid: string): Promise<void> {
  if (!db) return;
  const currentUserBuddyRef = doc(db, `users/${currentUserId}/buddies/${buddyUid}`);
  await deleteDoc(currentUserBuddyRef);
}

export async function fetchFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
  if (!db) return [];
  const requestsRef = collection(db, 'peppkompisRequests');
  const q = query(requestsRef, where("toUid", "==", userId));
  const snapshot = await getDocsSafe(q);
  const allRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeppkompisRequest));
  return allRequests.filter(req => req.status === "pending");
}

export async function fetchOutgoingFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
  if (!db) return [];
  const requestsRef = collection(db, 'peppkompisRequests');
  const q = query(requestsRef, where("fromUid", "==", userId));
  const snapshot = await getDocsSafe(q);
  const allRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeppkompisRequest));
  return allRequests.filter(req => req.status === "pending");
}

export async function togglePeppOnTimelineEvent(fromUser: { uid: string, name: string }, event: TimelineEvent, emoji: string): Promise<void> {
  if (!db) return;
  const eventRef = doc(db, 'communityTimeline', event.id);
  await runTransaction(db, async (transaction) => {
    const eventDoc = await transaction.get(eventRef);
    if (!eventDoc.exists()) throw "Event does not exist!";
    
    const currentReactions = eventDoc.data() || {};
    let userPreviousReactionEmoji: string | null = null;
    Object.keys(currentReactions.reactions || {}).forEach(key => {
      if (currentReactions.reactions[key]?.[fromUser.uid]) {
        userPreviousReactionEmoji = key;
      }
    });
    
    const updates: Record<string, any> = {};
    if (userPreviousReactionEmoji) {
      updates[`reactions.${userPreviousReactionEmoji}.${fromUser.uid}`] = deleteField();
    }
    if (userPreviousReactionEmoji !== emoji) {
      updates[`reactions.${emoji}.${fromUser.uid}`] = fromUser.name;
    }
    
    if (Object.keys(updates).length > 0) {
      transaction.update(eventRef, updates);
    }
  });
}

export async function addCommentToTimelineEvent(eventId: string, commentData: Omit<TimelineComment, 'id'>): Promise<string> {
  if (!db) return `comment_${Date.now()}`;
  const commentsRef = collection(db, 'communityTimeline', eventId, 'comments');
  const docRef = await addDoc(commentsRef, cleanFirestoreData(commentData));
  return docRef.id;
}

export async function toggleLikeOnComment(fromUser: { uid: string, name: string }, event: TimelineEvent, commentId: string): Promise<void> {
  if (!db) return;
  const likeRef = doc(db, 'communityTimeline', event.id, 'comments', commentId, 'likes', fromUser.uid);
  await runTransaction(db, async (transaction) => {
    const likeDoc = await transaction.get(likeRef);
    if (likeDoc.exists()) {
      transaction.delete(likeRef);
    } else {
      transaction.set(likeRef, {
        userId: fromUser.uid,
        userName: fromUser.name,
        timestamp: serverTimestamp()
      });
    }
  });
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  if (!db) return;
  const requestRef = doc(db, 'peppkompisRequests', requestId);
  await deleteDoc(requestRef);
}

// Subscription Management
export async function reactivateSubscription(): Promise<string> {
    if (!functions) throw new Error("Functions not initialized");
    const createSession = httpsCallable(functions, 'createCheckoutSession');
    const result = await createSession({ returnUrl: window.location.origin });
    return (result.data as any).url;
}

export async function cancelSubscription(userId: string) {
    if (!functions) throw new Error("Functions not initialized");
    const cancelSub = httpsCallable(functions, 'cancelSubscription');
    await cancelSub();
}
