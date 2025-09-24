import { db } from "../firebase";
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
} from "@firebase/firestore";
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
    Achievement,
    TimelineComment,
    Reactions,
    CompletedGoal
} from '../types';
import { DEFAULT_GOALS, LEVEL_DEFINITIONS, DEFAULT_USER_PROFILE } from '../constants';
import { courseLessons, menopauseCourseLessons } from '../courseData.ts';
import { getWeekInfo } from "../utils/dateUtils.ts";

/* ===== Helpers ===== */

const getDateUID = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      isCourseActive: false,
      courseInterest: false,
      menopauseCourseActive: false,
      menopauseCourseInterest: false,
      currentStreak: 0,
      lastDateStreakChecked: dayBeforeYesterdayDateString,
      summaryStartDate: null,
      highestStreak: 0,
      highestLevelId: null,
      weeklyBank: {
        weekId: currentWeekInfo.weekId,
        bankedCalories: 0,
        startDate: currentWeekInfo.startDate,
        endDate: currentWeekInfo.endDate
      },
      streakSaver: { available: true, weekId: currentWeekInfo.weekId },
      unlockedAchievements: {},
      journeyAnalysisFeedback: null,
      isSearchable: true,
      mainGoalCompleted: false,
      completedGoals: [],
      notificationSettings: DEFAULT_USER_PROFILE.notificationSettings,
      preferredWeighInDay: 'måndag',
      timezone: timezone,
      pushSubscriptions: [],
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
      isCourseActive: userDocData.isCourseActive,
      courseInterest: userDocData.courseInterest,
      menopauseCourseActive: userDocData.menopauseCourseActive,
      menopauseCourseInterest: userDocData.menopauseCourseInterest,
      isSearchable: userDocData.isSearchable,
      goalStartWeight: userDocData.goalStartWeight ?? undefined,
      goalStartMuscleMassKg: userDocData.goalStartMuscleMassKg ?? undefined,
      goalStartFatMassKg: userDocData.goalStartFatMassKg ?? undefined,
      mainGoalCompleted: userDocData.mainGoalCompleted ?? false,
      completedGoals: userDocData.completedGoals ?? [],
      notificationSettings: userDocData.notificationSettings,
      preferredWeighInDay: userDocData.preferredWeighInDay,
      preferredLessonDay: userDocData.preferredLessonDay ?? undefined,
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
      streakSaver: userDocData.streakSaver,
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
  const mealLogRef = doc(db, 'users', userId, 'mealLogs', mealId);
  const userDocRef = doc(db, 'users', userId);
  
  const batch = writeBatch(db);
  batch.set(mealLogRef, mealData);
  batch.update(userDocRef, { lastLogDate: mealData.dateString });
  await batch.commit();
}

export async function deleteMealLog(userId: string, mealLogId: string) {
  const mealLogRef = doc(db, 'users', userId, 'mealLogs', mealLogId);
  await deleteDoc(mealLogRef);
}

export async function updateMealLog(userId: string, mealLogId: string, updatedInfo: Partial<NutritionalInfo>) {
  const mealLogRef = doc(db, 'users', userId, 'mealLogs', mealLogId);
  await updateDoc(mealLogRef, { nutritionalInfo: updatedInfo });
}

export async function fetchMealLogsForDate(userId: string, dateUID: string): Promise<LoggedMeal[]> {
  const mealLogsRef = collection(db, 'users', userId, 'mealLogs');
  const q = query(mealLogsRef, where("dateString", "==", dateUID), orderBy("timestamp", "desc"));
  const querySnapshot = await getDocsSafe(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LoggedMeal[];
}

/* ===== Water ===== */

export async function setWaterLog(userId: string, dateUID: string, waterMl: number) {
  const waterLogRef = doc(db, 'users', userId, 'waterLogs', dateUID);
  await setDoc(waterLogRef, { dateUID, waterLoggedMl: waterMl });
}

export async function fetchWaterLog(userId: string, dateUID: string): Promise<number> {
  const waterLogRef = doc(db, 'users', userId, 'waterLogs', dateUID);
  const docSnap = await getDocSafe(waterLogRef);
  return docSnap.exists() ? docSnap.data().waterLoggedMl : 0;
}

/* ===== Common meals ===== */

export async function addCommonMeal(userId: string, commonMealData: Omit<CommonMeal, 'id'>) {
  const commonMealsRef = collection(db, 'users', userId, 'commonMeals');
  const docRef = await addDoc(commonMealsRef, commonMealData);
  return docRef.id;
}

export async function deleteCommonMeal(userId: string, commonMealId: string) {
  const commonMealRef = doc(db, 'users', userId, 'commonMeals', commonMealId);
  await deleteDoc(commonMealRef);
}

export async function updateCommonMeal(userId: string, commonMealId: string, updatedData: { name: string; nutritionalInfo: NutritionalInfo }) {
  const commonMealRef = doc(db, 'users', userId, 'commonMeals', commonMealId);
  await updateDoc(commonMealRef, updatedData);
}

/* ===== Profile & goals ===== */

export async function saveProfileAndGoals(userId: string, profile: UserProfileData, goals: GoalSettings, role: UserRole, status: 'pending' | 'approved') {
  const userDocRef = doc(db, 'users', userId);
  
  const dataToUpdate = {
    ...profile,
    goals,
    displayName: profile.name,
    role,
    status,
  };

  const cleanData = Object.fromEntries(
    Object.entries(dataToUpdate).filter(([, v]) => v !== undefined)
  );

  await updateDoc(userDocRef, cleanData);
}


/* ===== Weight ===== */

export async function saveWeightLog(userId: string, weightLog: Omit<WeightLogEntry, 'id'>) {
  const weightLogsRef = collection(db, 'users', userId, 'weightLogs');
  const docRef = await addDoc(weightLogsRef, weightLog);
  return docRef.id;
}

/* ===== Wellbeing ===== */

export async function addMentalWellbeingLog(userId: string, logData: Omit<MentalWellbeingLog, 'id'>): Promise<string> {
  const wellbeingLogsRef = collection(db, 'users', userId, 'mentalWellbeingLogs');
  const docRef = await addDoc(wellbeingLogsRef, logData);
  return docRef.id;
}

export async function fetchMentalWellbeingLogs(userId: string): Promise<MentalWellbeingLog[]> {
  const logsRef = collection(db, 'users', userId, 'mentalWellbeingLogs');
  const q = query(logsRef, orderBy("loggedAt", "desc"), limit(30));
  const querySnapshot = await getDocsSafe(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MentalWellbeingLog[];
}

/* ===== Summaries & user doc misc ===== */

export async function setPastDaySummary(userId: string, dateUID: string, summary: PastDaySummary) {
  const summaryRef = doc(db, 'users', userId, 'pastDaySummaries', dateUID);
  await setDoc(summaryRef, summary, { merge: true });
}

export async function updateUserDocument(userId: string, data: { [key: string]: any }) {
  const userDocRef = doc(db, 'users', userId);
  await updateDoc(userDocRef, data);
}

export async function savePushSubscription(userId: string, subscription: object) {
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

export async function addTimelineEvent(
    userId: string,
    eventData: {
        type: TimelineEvent['type'];
        timestamp: number;
        title: string;
        description: string;
        icon: string;
        relatedDocId: string;
    }
): Promise<void> {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDocSafe(userDocRef);
    if (!userDoc.exists()) {
        console.error(`addTimelineEvent: User ${userId} not found.`);
        return;
    }
    const userData = userDoc.data() as FirestoreUserDocument;

    const buddies = await fetchBuddies(userId);
    const visibleTo = [userId, ...buddies.map(b => b.uid)];

    const timelineDocRef = doc(collection(db, "communityTimeline"));

    let relatedDocPath = `users/${userId}`; // Default to user doc
    if (eventData.type === 'weight' || eventData.type === 'goal_achieved') {
        relatedDocPath = `users/${userId}/weightLogs/${eventData.relatedDocId}`;
    } else if (eventData.type === 'achievement') {
        relatedDocPath = `users/${userId}/achievementInteractions/${eventData.relatedDocId.replace('ach_', '')}`;
    } else if (eventData.type === 'course') {
        relatedDocPath = `users/${userId}/courseProgress/${eventData.relatedDocId.replace('course_', '')}`;
    }

    const newEvent: Omit<TimelineEvent, 'id' | 'comments'> = {
        type: eventData.type,
        timestamp: eventData.timestamp,
        title: eventData.title,
        description: eventData.description,
        icon: eventData.icon,
        reactions: {},
        relatedDocPath,
        userId: userId,
        userName: userData.displayName,
        userPhotoURL: userData.photoURL ?? undefined,
        gender: userData.gender,
        visibleTo: visibleTo,
    };
    
    await setDoc(timelineDocRef, newEvent);
}

/* ===== Course ===== */

export async function saveCourseProgress(userId: string, lessonId: string, progress: UserLessonProgress, role: UserRole, status: 'pending' | 'approved') {
  const courseProgressRef = doc(db, 'users', userId, 'courseProgress', lessonId);
  await setDoc(courseProgressRef, progress, { merge: true });
  
  const progressCollectionRef = collection(db, 'users', userId, 'courseProgress');
  const snapshot = await getDocsSafe(progressCollectionRef);
  
  // FIX: Fetch the user document to check active courses instead of using a non-existent 'state' variable.
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDocSafe(userDocRef);
  const userDocData = userDocSnap.exists() ? userDocSnap.data() as FirestoreUserDocument : null;
  
  const allLessons = [...courseLessons, ...menopauseCourseLessons];
  const totalLessonsInActiveCourses = allLessons.filter(lesson => {
      if (!userDocData) return false;
      if (lesson.id.startsWith('m-') && userDocData.menopauseCourseActive) return true;
      if (lesson.id.startsWith('lektion') && userDocData.isCourseActive) return true;
      return false;
  }).length;
  
  let completedCount = 0;
  snapshot.forEach(doc => {
    const lessonProgress = doc.data() as UserLessonProgress;
    if (lessonProgress.isCompleted) completedCount++;
  });

  await updateUserDocument(userId, {
    courseProgressSummary: {
      started: !snapshot.empty,
      completedLessons: completedCount,
      totalLessons: totalLessonsInActiveCourses,
    },
    role: role,
    status: status,
  });
}

/* ===== Coach ===== */

export async function fetchCoachViewMembers(): Promise<CoachViewMember[]> {
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
      isCourseActive: data.isCourseActive,
      courseInterest: data.courseInterest,
      menopauseCourseActive: data.menopauseCourseActive,
      menopauseCourseInterest: data.menopauseCourseInterest,
      memberSince: toDateString(data.createdAt),
      lastLogDate: data.lastLogDate ?? undefined,
      currentStreak: data.currentStreak,
      goalSummary: goalSummary,
      courseProgressSummary: data.courseProgressSummary,
      ageYears: data.ageYears ?? undefined,
      gender: data.gender,
      numberOfBuddies: numberOfBuddies,
    };
  });

  const members = await Promise.all(membersPromises);
  return members;
}

export async function fetchDetailedMemberDataForCoach(memberId: string): Promise<AIDataForCoachSummary> {
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
    isCourseActive: userDocData.isCourseActive,
    courseInterest: userDocData.courseInterest,
    menopauseCourseActive: userDocData.menopauseCourseActive,
    menopauseCourseInterest: userDocData.menopauseCourseInterest,
    isSearchable: userDocData.isSearchable,
    goalStartWeight: userDocData.goalStartWeight,
    goalStartMuscleMassKg: userDocData.goalStartMuscleMassKg,
    goalStartFatMassKg: userDocData.goalStartFatMassKg,
    mainGoalCompleted: userDocData.mainGoalCompleted,
    completedGoals: userDocData.completedGoals,
    notificationSettings: userDocData.notificationSettings || DEFAULT_USER_PROFILE.notificationSettings,
    preferredWeighInDay: userDocData.preferredWeighInDay,
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

export async function setCourseAccessForMember(memberId: string, courseField: 'isCourseActive' | 'menopauseCourseActive', interestField: 'courseInterest' | 'menopauseCourseInterest', access: boolean) {
  const userDocRef = doc(db, 'users', memberId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const { role, status } = userDoc.data();
    const updatePayload = {
        [courseField]: access,
        [interestField]: false,
        role,
        status,
    };
    await updateDoc(userDocRef, updatePayload);
  }
}
export async function approveMember(memberId: string) {
  const userDocRef = doc(db, 'users', memberId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const { role } = userDoc.data();
    await updateDoc(userDocRef, { status: 'approved', role });
  }
}
export async function revokeApproval(memberId: string) {
  const userDocRef = doc(db, 'users', memberId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const { role } = userDoc.data();
    await updateDoc(userDocRef, { status: 'pending', role });
  }
}
export async function updateUserRole(memberId: string, newRole: UserRole) {
  const userDocRef = doc(db, 'users', memberId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const { status } = userDoc.data();
    await updateDoc(userDocRef, { role: newRole, status });
  }
}
export async function bulkApproveMembers(memberIds: string[]) {
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
export async function bulkSetCourseAccess(memberIds: string[], courseField: 'isCourseActive' | 'menopauseCourseActive', interestField: 'courseInterest' | 'menopauseCourseInterest', access: boolean) {
  const batch = writeBatch(db);
  for (const id of memberIds) {
    const userDocRef = doc(db, 'users', id);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const { role, status } = userDoc.data();
      const updatePayload = {
        [courseField]: access,
        [interestField]: false,
        role,
        status,
      };
      batch.update(userDocRef, updatePayload);
    }
  }
  await batch.commit();
}
export async function bulkUpdateUserRole(memberIds: string[], role: UserRole) {
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

/* ===== Buddy system ===== */

export function listenForFriendRequests(userId: string, callback: (requests: PeppkompisRequest[]) => void): () => void {
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

// FIX: Add missing function
export async function fetchFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    const requestsRef = collection(db, 'peppkompisRequests');
    const q = query(requestsRef, where("toUid", "==", userId), where("status", "==", "pending"));
    const snapshot = await getDocsSafe(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeppkompisRequest));
}

// FIX: Add missing function
export async function fetchOutgoingFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    const requestsRef = collection(db, 'peppkompisRequests');
    const q = query(requestsRef, where("fromUid", "==", userId), where("status", "==", "pending"));
    const snapshot = await getDocsSafe(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeppkompisRequest));
}

export async function fetchBuddies(userId: string): Promise<Peppkompis[]> {
  const buddiesRef = collection(db, 'users', userId, 'buddies');
  const snapshot = await getDocsSafe(buddiesRef);
  return snapshot.docs.map(doc => doc.data() as Peppkompis);
}

export async function fetchCommunityTimeline(currentUserId: string): Promise<TimelineEvent[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const startOfYesterdayTimestamp = yesterday.getTime();

  const timelineRef = collection(db, 'communityTimeline');
  const q = query(
    timelineRef,
    where('visibleTo', 'array-contains', currentUserId),
    where('timestamp', '>=', startOfYesterdayTimestamp),
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  
  const snapshot = await getDocsSafe(q);

  const eventsWithCommentsPromises = snapshot.docs.map(async (eventDoc) => {
    const eventData = { id: eventDoc.id, ...eventDoc.data() } as TimelineEvent;
    
    const commentsRef = collection(db, 'communityTimeline', eventDoc.id, 'comments');
    const commentsQuery = query(commentsRef, orderBy('timestamp', 'asc'));
    const commentsSnapshot = await getDocsSafe(commentsQuery);
    
    const commentsWithLikesPromises = commentsSnapshot.docs.map(async (commentDoc) => {
      const commentData = { id: commentDoc.id, ...commentDoc.data() } as TimelineComment;
      
      const likesRef = collection(db, 'communityTimeline', eventDoc.id, 'comments', commentDoc.id, 'likes');
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

  return await Promise.all(eventsWithCommentsPromises);
}

export async function fetchBuddyDetailsList(userId: string): Promise<BuddyDetails[]> {
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
    } as BuddyDetails;
  });

  const results = await Promise.all(buddyDetailsPromises);
  return results.filter((b): b is BuddyDetails => b !== null);
}

/* ===== Social ===== */

export async function searchForBuddies(currentUserId: string): Promise<Peppkompis[]> {
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
  const requestsRef = collection(db, 'peppkompisRequests');
  const newRequest: Omit<PeppkompisRequest, 'id'> = {
    fromUid: fromUser.uid,
    fromName: fromUser.name,
    fromEmail: fromUser.email,
    toUid: toUserUid,
    status: 'pending',
    createdAt: Date.now(),
  };
  await addDoc(requestsRef, newRequest);
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, 'peppkompisRequests', requestId);
  await deleteDoc(requestRef);
}

export async function updateFriendRequestStatus(request: PeppkompisRequest, status: 'accepted' | 'declined'): Promise<void> {
  const requestRef = doc(db, 'peppkompisRequests', request.id);
  if (status === 'accepted') {
    await updateDoc(requestRef, { status: "accepted" });
  } else {
    // FIX: Complete the function for 'declined' status
    await deleteDoc(requestRef);
  }
}

// FIX: Add missing function
export async function removeBuddy(currentUserId: string, buddyUid: string): Promise<void> {
    const buddyRef = doc(db, 'users', currentUserId, 'buddies', buddyUid);
    await deleteDoc(buddyRef);
}

// FIX: Add missing function
export async function togglePeppOnTimelineEvent(
  fromUser: { uid: string; name: string },
  event: TimelineEvent,
  newEmoji: string
): Promise<void> {
  const eventRef = doc(db, "communityTimeline", event.id);

  await runTransaction(db, async (transaction) => {
    const eventDoc = await transaction.get(eventRef);
    if (!eventDoc.exists()) {
      throw "Event does not exist!";
    }

    const currentReactions = eventDoc.data().reactions || {};
    let userPreviousEmoji: string | null = null;

    // Find if the user has already reacted with any emoji
    for (const emoji in currentReactions) {
      if (Object.prototype.hasOwnProperty.call(currentReactions[emoji], fromUser.uid)) {
        userPreviousEmoji = emoji;
        break;
      }
    }

    const updates: { [key: string]: any } = {};

    // If user had a previous reaction, prepare to remove it
    if (userPreviousEmoji) {
      updates[`reactions.${userPreviousEmoji}.${fromUser.uid}`] = deleteField();
    }

    // If the new reaction is different from the previous one, add it
    if (userPreviousEmoji !== newEmoji) {
      updates[`reactions.${newEmoji}.${fromUser.uid}`] = fromUser.name;
    }

    transaction.update(eventRef, updates);
  });
}

// FIX: Add missing function
export async function addCommentToTimelineEvent(
  eventId: string,
  commentData: Omit<TimelineComment, 'id'>
): Promise<string> {
  const commentsRef = collection(db, 'communityTimeline', eventId, 'comments');
  const docRef = await addDoc(commentsRef, commentData);
  return docRef.id;
}

// FIX: Add missing function
export async function toggleLikeOnComment(
  fromUser: { uid: string; name: string },
  event: TimelineEvent,
  commentId: string
): Promise<void> {
  const commentRef = doc(db, 'communityTimeline', event.id, 'comments', commentId);
  
  await runTransaction(db, async (transaction) => {
    const commentDoc = await transaction.get(commentRef);
    if (!commentDoc.exists()) {
      throw "Comment does not exist!";
    }
    const currentLikes = commentDoc.data().likes || {};
    if (currentLikes[fromUser.uid]) {
      transaction.update(commentRef, {
        [`likes.${fromUser.uid}`]: deleteField()
      });
    } else {
      transaction.update(commentRef, {
        [`likes.${fromUser.uid}`]: fromUser.name
      });
    }
  });
}
