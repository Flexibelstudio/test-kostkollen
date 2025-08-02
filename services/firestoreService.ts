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
    Transaction,
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
import { courseLessons } from '../courseData.ts';

const getDateUID = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getWeekInfo = (date: Date): { weekId: string; startDate: string; endDate: string } => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); 
  const dayUTC = d.getUTCDay(); 
  const diffToMondayUTC = d.getUTCDate() - dayUTC + (dayUTC === 0 ? -6 : 1); 
  
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diffToMondayUTC));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));

  const year = monday.getUTCFullYear();
  
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
  const pastDaysOfYear = (monday.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + (firstDayOfYear.getUTCDay() === 0 ? 7 : 1) -1 ) / 7);


  return {
    weekId: `${year}-W${String(weekNumber).padStart(2, '0')}`,
    startDate: monday.toISOString().split('T')[0],
    endDate: sunday.toISOString().split('T')[0],
  };
};


const formatChange = (change: number | undefined): string => {
    if (change === undefined || change === null || isNaN(change)) {
        return '-';
    }
    if (Math.abs(change) < 0.05) {
        return `±0,0`;
    }
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1).replace('.', ',')}`;
};

export const getDocSafe = async (docRef: DocumentReference) => {
    try {
        // First, try to get from the server.
        return await getDoc(docRef);
    } catch (error: any) {
        // If server is unavailable (offline), try the cache.
        if (error.code === 'unavailable') {
            console.warn(`Firestore: Server unavailable for ${docRef.path}. Trying cache.`);
            try {
                return await getDocFromCache(docRef);
            } catch (cacheError: any) {
                // If the document is not in the cache, Firestore throws.
                // This is expected if the doc was never fetched while online.
                // We'll treat this as "document does not exist" in the offline context.
                console.warn(`Firestore: Document ${docRef.path} not found in cache.`);
                // Return an object that mimics a non-existent DocumentSnapshot.
                // This prevents the calling function from crashing.
                return {
                    exists: () => false,
                    data: () => undefined,
                    id: docRef.id,
                    ref: docRef
                } as any; // Cast to avoid complex mock object creation.
            }
        }
        // For other errors (permissions, etc.), re-throw.
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
            } catch (cacheError) {
                console.warn(`Firestore: Query results not found in cache.`);
                // Return a snapshot-like object that indicates an empty result set.
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

export async function ensureUserProfileInFirestore(fbUser: User) {
    const userDocRef = doc(db, 'users', fbUser.uid);
    const userDoc = await getDocSafe(userDocRef);
    const currentWeekInfo = getWeekInfo(new Date());

    if (!userDoc.exists()) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDateString = getDateUID(yesterday);
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
            currentStreak: 0,
            lastDateStreakChecked: yesterdayDateString,
            highestStreak: 0,
            highestLevelId: null,
            weeklyBank: { weekId: currentWeekInfo.weekId, bankedCalories: 0, startDate: currentWeekInfo.startDate, endDate: currentWeekInfo.endDate},
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
        const updateData: any = { 
            lastLoginAt: serverTimestamp()
        };
        if (fbUser.displayName && existingData.displayName !== fbUser.displayName) {
            updateData.displayName = fbUser.displayName;
        }
        await updateDoc(userDocRef, updateData);
    }
}

export async function fetchInitialAppData(userId: string) {
    const userDocRef = doc(db, 'users', userId);
    const commonMealsRef = collection(db, 'users', userId, 'commonMeals');
    const weightLogsRef = collection(db, 'users', userId, 'weightLogs');
    const courseProgressRef = collection(db, 'users', userId, 'courseProgress');
    const pastSummariesRef = collection(db, 'users', userId, 'pastDaySummaries');
    const achievementInteractionsRef = collection(db, 'users', userId, 'achievementInteractions');

    const commonMealsQuery = query(commonMealsRef, orderBy('name'));
    const weightLogsQuery = query(weightLogsRef, orderBy('loggedAt'));

    try {
        const [
            userDocSnap,
            commonMealsSnap,
            weightLogsSnap,
            courseProgressSnap,
            pastSummariesSnap,
            achievementInteractionsSnap
        ] = await Promise.all([
            getDocSafe(userDocRef),
            getDocsSafe(commonMealsQuery),
            getDocsSafe(weightLogsQuery),
            getDocsSafe(courseProgressRef),
            getDocsSafe(pastSummariesRef),
            getDocsSafe(achievementInteractionsRef)
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
            isSearchable: userDocData.isSearchable,
            goalStartWeight: userDocData.goalStartWeight ?? undefined,
            goalStartMuscleMassKg: userDocData.goalStartMuscleMassKg ?? undefined,
            goalStartFatMassKg: userDocData.goalStartFatMassKg ?? undefined,
            mainGoalCompleted: userDocData.mainGoalCompleted ?? false,
            completedGoals: userDocData.completedGoals ?? [],
            notificationSettings: userDocData.notificationSettings,
            preferredWeighInDay: userDocData.preferredWeighInDay
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

        return {
            role: userDocData.role,
            status: userDocData.status,
            hasCompletedOnboarding: userDocData.hasCompletedOnboarding,
            profile,
            goals: userDocData.goals,
            currentStreak: userDocData.currentStreak,
            lastDateStreakChecked: userDocData.lastDateStreakChecked,
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
        };

    } catch (error) {
        console.error("Error fetching initial app data:", error);
        throw error;
    }
}


export async function addMealLog(userId: string, mealId: string, mealData: Omit<LoggedMeal, 'id'>) {
  const mealLogRef = doc(db, 'users', userId, 'mealLogs', mealId);
  const userDocRef = doc(db, 'users', userId);
  
  const batch = writeBatch(db);
  
  batch.set(mealLogRef, mealData);
  
  // SAFE UPDATE: Only update the lastLogDate field. Do not read and write back role/status.
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

export async function addTimelineEvent(
    userId: string,
    eventData: Omit<TimelineEvent, 'id' | 'userId' | 'userName' | 'userPhotoURL' | 'gender' | 'relatedDocPath' | 'reactions' | 'comments'> & { relatedDocId: string }
) {
    // 1. Fetch necessary data OUTSIDE the transaction.
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDocSafe(userDocRef);
    if (!userDocSnap.exists()) {
        console.error(`Could not create timeline event: User ${userId} not found.`);
        return; // or throw
    }
    const userData = userDocSnap.data() as FirestoreUserDocument;

    const buddies = await fetchBuddies(userId);
    const buddyUids = buddies.map(b => b.uid);
    const visibleTo = [userId, ...buddyUids];

    // 2. Construct a unique, valid document ID for the timeline event.
    // Replace slashes with a safe character like '--'.
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
    };
    delete (fullEvent as any).relatedDocId;

    // 3. Run the transaction to perform the atomic "create if not exists".
    try {
        await runTransaction(db, async (transaction) => {
            const eventDoc = await transaction.get(timelineDocRef);
            if (eventDoc.exists()) {
                console.log(`Timeline event with ID "${uniqueEventId}" already exists. Skipping creation.`);
                return;
            }
            transaction.set(timelineDocRef, fullEvent);
        });
    } catch (error) {
        console.error("Transaction to create timeline event failed: ", error);
        // Re-throw to be caught by the calling function in App.tsx
        throw error;
    }
}

export async function setWaterLog(userId: string, dateUID: string, waterMl: number) {
  const waterLogRef = doc(db, 'users', userId, 'waterLogs', dateUID);
  await setDoc(waterLogRef, { dateUID, waterLoggedMl: waterMl });
}

export async function fetchWaterLog(userId: string, dateUID: string): Promise<number> {
  const waterLogRef = doc(db, 'users', userId, 'waterLogs', dateUID);
  const docSnap = await getDocSafe(waterLogRef);
  return docSnap.exists() ? docSnap.data().waterLoggedMl : 0;
}

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

export async function saveProfileAndGoals(userId: string, profile: UserProfileData, goals: GoalSettings) {
    const userDocRef = doc(db, 'users', userId);
    
    // SAFE UPDATE: Create a payload with only the fields that need to be updated.
    // Do NOT read and write back `role` and `status`. `updateDoc` will leave them untouched.
    const dataToUpdate = {
        ...profile,
        goals: goals,
        displayName: profile.name,
    };
    
    function noUndefined(obj: any) {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : v])
      );
    }
    await updateDoc(userDocRef, noUndefined(dataToUpdate as any));
}


export async function saveWeightLog(userId: string, weightLog: Omit<WeightLogEntry, 'id'>) {
    const weightLogsRef = collection(db, 'users', userId, 'weightLogs');
    
    const docRef = await addDoc(weightLogsRef, weightLog);
    
    // The update to the main user document has been removed as per user request
    // to resolve a permissions issue with Firestore security rules.
    // The user's profile state is updated in App.tsx to reflect the new weight for the current session.
    
    return docRef.id;
}

export async function addMentalWellbeingLog(userId: string, logData: Omit<MentalWellbeingLog, 'id'>) {
    const wellbeingLogsRef = collection(db, 'users', userId, 'mentalWellbeingLogs');
    await addDoc(wellbeingLogsRef, logData);
}

export async function fetchMentalWellbeingLogs(userId: string): Promise<MentalWellbeingLog[]> {
    const logsRef = collection(db, 'users', userId, 'mentalWellbeingLogs');
    const q = query(logsRef, orderBy("loggedAt", "desc"), limit(30));
    const querySnapshot = await getDocsSafe(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MentalWellbeingLog[];
}

export async function setPastDaySummary(userId: string, dateUID: string, summary: PastDaySummary) {
    const summaryRef = doc(db, 'users', userId, 'pastDaySummaries', dateUID);
    await setDoc(summaryRef, summary, { merge: true });
}

export async function updateUserDocument(userId: string, data: Partial<FirestoreUserDocument>) {
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

export async function saveCourseProgress(userId: string, lessonId: string, progress: UserLessonProgress, role: UserRole, status: 'pending' | 'approved') {
    const courseProgressRef = doc(db, 'users', userId, 'courseProgress', lessonId);
    await setDoc(courseProgressRef, progress, { merge: true });
    
    // After saving, recalculate and update the summary on the main user doc
    const progressCollectionRef = collection(db, 'users', userId, 'courseProgress');
    const snapshot = await getDocsSafe(progressCollectionRef);
    
    let completedCount = 0;
    snapshot.forEach(doc => {
        const lessonProgress = doc.data() as UserLessonProgress;
        if (lessonProgress.isCompleted) {
            completedCount++;
        }
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
}


// --- Coach Functions ---
export async function fetchCoachViewMembers(): Promise<CoachViewMember[]> {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocsSafe(q);

    // Lägg denna funktion HÄR, före forEach!
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

    const members: CoachViewMember[] = [];
    snapshot.forEach(doc => {
        const data = doc.data() as FirestoreUserDocument;

        let goalSummary = "Ej satt";
        if (data.goalType === 'maintain') goalSummary = "Bibehålla";
        else if (data.goalType === 'lose_fat') goalSummary = `${data.desiredFatMassChangeKg || data.desiredWeightChangeKg || ''} kg fett`;
        else if (data.goalType === 'gain_muscle') goalSummary = `${data.desiredMuscleMassChangeKg || data.desiredWeightChangeKg || ''} kg muskler`;

        members.push({
            id: data.uid,
            name: data.displayName,
            email: data.email || 'N/A',
            role: data.role,
            status: data.status,
            photoURL: data.photoURL ?? undefined,
            isCourseActive: data.isCourseActive,
            courseInterest: data.courseInterest,
            memberSince: toDateString(data.createdAt), // <<-- här används den
            lastLogDate: data.lastLogDate ?? undefined,
            currentStreak: data.currentStreak,
            goalSummary: goalSummary,
            courseProgressSummary: data.courseProgressSummary,
            ageYears: data.ageYears ?? undefined,
            gender: data.gender
        });
    });

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


export async function setCourseAccessForMember(memberId: string, access: boolean) {
    const userDocRef = doc(db, 'users', memberId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
        const { role, status } = userDoc.data();
        await updateDoc(userDocRef, { isCourseActive: access, courseInterest: false, role, status });
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
export async function bulkSetCourseAccess(memberIds: string[], access: boolean) {
    const batch = writeBatch(db);
    for (const id of memberIds) {
        const userDocRef = doc(db, 'users', id);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const { role, status } = userDoc.data();
            batch.update(userDocRef, { isCourseActive: access, courseInterest: false, role, status });
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


// --- Buddy System ---
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
        
        // Fetch comments subcollection for each event
        const commentsRef = collection(db, 'communityTimeline', eventDoc.id, 'comments');
        const commentsQuery = query(commentsRef, orderBy('timestamp', 'asc'));
        const commentsSnapshot = await getDocsSafe(commentsQuery);
        
        // For each comment, fetch its likes and build the map
        const commentsWithLikesPromises = commentsSnapshot.docs.map(async (commentDoc) => {
            const commentData = { id: commentDoc.id, ...commentDoc.data() } as TimelineComment;
            
            const likesRef = collection(db, 'communityTimeline', eventDoc.id, 'comments', commentDoc.id, 'likes');
            const likesSnapshot = await getDocsSafe(likesRef);
            
            const likesMap: { [uid: string]: string } = {};
            likesSnapshot.forEach(likeDoc => {
                // The like document's ID is the user's UID.
                // The document contains the user's name.
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

        // Fetch the latest weight log to get the most current data
        const weightLogsRef = collection(db, 'users', buddy.uid, 'weightLogs');
        const latestLogQuery = query(weightLogsRef, orderBy('loggedAt', 'desc'), limit(1));
        const latestLogSnap = await getDocsSafe(latestLogQuery);
        const latestLog = latestLogSnap.empty ? null : latestLogSnap.docs[0].data() as WeightLogEntry;

        // Use latest log data if available, otherwise fallback to main doc data
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

export async function updateFriendRequestStatus(request: PeppkompisRequest, status: 'accepted' | 'declined'): Promise<void> {
    const requestRef = doc(db, 'peppkompisRequests', request.id);

    if (status === 'accepted') {
        // As per user's architecture, frontend updates the status to trigger a backend Cloud Function.
        // The Cloud Function is responsible for creating the reciprocal friendship.
        await updateDoc(requestRef, { status: "accepted" });
    } else { // 'declined'
        // For declining, deleting the request document is the most straightforward action.
        await deleteDoc(requestRef);
    }
}

export async function removeBuddy(currentUserId: string, buddyUid: string): Promise<void> {
    // A user can only write to their own documents.
    // This function will only remove the buddy from the current user's list.
    // The symmetrical relationship on the other user's side will remain until they
    // also remove the buddy. This is a client-side limitation; a Cloud Function
    // would be needed for a fully symmetrical deletion. The original implementation
    // attempted a symmetrical delete which causes permission errors.
    const batch = writeBatch(db);
    const currentUserBuddyRef = doc(db, `users/${currentUserId}/buddies/${buddyUid}`);
    batch.delete(currentUserBuddyRef);
    await batch.commit();
}

export async function fetchFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    const requestsRef = collection(db, 'peppkompisRequests');
    const q = query(requestsRef, where("toUid", "==", userId));
    const snapshot = await getDocsSafe(q);
    const allRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeppkompisRequest));
    return allRequests.filter(req => req.status === "pending");
}

export async function fetchOutgoingFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    const requestsRef = collection(db, 'peppkompisRequests');
    const q = query(requestsRef, where("fromUid", "==", userId));
    const snapshot = await getDocsSafe(q);
    const allRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeppkompisRequest));
    return allRequests.filter(req => req.status === "pending");
}

export async function togglePeppOnTimelineEvent(fromUser: { uid: string, name: string }, event: TimelineEvent, emoji: string): Promise<void> {
    const eventRef = doc(db, 'communityTimeline', event.id);

    await runTransaction(db, async (transaction) => {
        const eventDoc = await transaction.get(eventRef);
        if (!eventDoc.exists()) throw "Event does not exist!";
        
        const currentReactions = eventDoc.data().reactions || {};
        let userPreviousReactionEmoji: string | null = null;
        Object.keys(currentReactions).forEach(key => {
            if (currentReactions[key]?.[fromUser.uid]) {
                userPreviousReactionEmoji = key;
            }
        });
        
        // Remove previous reaction
        if (userPreviousReactionEmoji) {
            transaction.update(eventRef, { [`reactions.${userPreviousReactionEmoji}.${fromUser.uid}`]: deleteField() });
        }
        
        // Add new reaction if it's different
        if (userPreviousReactionEmoji !== emoji) {
            transaction.update(eventRef, { [`reactions.${emoji}.${fromUser.uid}`]: fromUser.name });
        }
    });
}

export async function addCommentToTimelineEvent(eventId: string, commentData: Omit<TimelineComment, 'id'>): Promise<string> {
    const commentsRef = collection(db, 'communityTimeline', eventId, 'comments');
    const docRef = await addDoc(commentsRef, commentData);
    return docRef.id;
}

export async function toggleLikeOnComment(fromUser: { uid: string, name: string }, event: TimelineEvent, commentId: string): Promise<void> {
    const likeRef = doc(db, 'communityTimeline', event.id, 'comments', commentId, 'likes', fromUser.uid);

    await runTransaction(db, async (transaction) => {
        const likeDoc = await transaction.get(likeRef);
        if (likeDoc.exists()) {
            // User has already liked, so unlike (delete the document)
            transaction.delete(likeRef);
        } else {
            // User has not liked, so like (create the document)
            // The security rule for 'update, delete' relies on this 'userId' field.
            transaction.set(likeRef, {
                userId: fromUser.uid,
                userName: fromUser.name,
                timestamp: serverTimestamp()
            });
        }
    });
}


export async function cancelFriendRequest(requestId: string): Promise<void> {
    const requestRef = doc(db, 'peppkompisRequests', requestId);
    await deleteDoc(requestRef);
}

export async function fetchTimelineForCurrentUser(currentUserId: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    // This is a simplified version for the journey view. A more robust implementation might live in a separate service.
    const userDocSnap = await getDocSafe(doc(db, 'users', currentUserId));
    if (!userDocSnap.exists()) return [];
    
    const userData = userDocSnap.data() as FirestoreUserDocument;
    
    const currentUserInfo = {
        userId: currentUserId,
        userName: userData.displayName,
        userPhotoURL: userData.photoURL || undefined,
        gender: userData.gender,
    };

    const weightLogsRef = collection(db, 'users', currentUserId, 'weightLogs');
    const weightLogsQuery = query(weightLogsRef, orderBy('loggedAt', 'asc'));
    const weightLogsSnap = await getDocsSafe(weightLogsQuery);
    const weightLogs = weightLogsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as WeightLogEntry[];

    const weightEvents: TimelineEvent[] = weightLogs.map((currentLog, index) => {
        const previousLog = index > 0 ? weightLogs[index - 1] : null;
        let weightChange, muscleChange, fatChange;
        if (previousLog) {
            weightChange = currentLog.weightKg - previousLog.weightKg;
            if (currentLog.skeletalMuscleMassKg != null && previousLog.skeletalMuscleMassKg != null) muscleChange = currentLog.skeletalMuscleMassKg - previousLog.skeletalMuscleMassKg;
            if (currentLog.bodyFatMassKg != null && previousLog.bodyFatMassKg != null) fatChange = currentLog.bodyFatMassKg - previousLog.bodyFatMassKg;
        }
        const descriptionParts = [`Vikt: ${currentLog.weightKg.toFixed(1)}kg (${formatChange(weightChange)})`];
        if (currentLog.skeletalMuscleMassKg != null) descriptionParts.push(`Muskler: ${currentLog.skeletalMuscleMassKg.toFixed(1)}kg (${formatChange(muscleChange)})`);
        if (currentLog.bodyFatMassKg != null) descriptionParts.push(`Fett: ${currentLog.bodyFatMassKg.toFixed(1)}kg (${formatChange(fatChange)})`);

        return {
            id: currentLog.id, type: 'weight', timestamp: currentLog.loggedAt, title: `Ny mätning loggad`,
            description: descriptionParts.join(' | '), icon: '⚖️', reactions: currentLog.reactions || {}, comments: [],
            relatedDocPath: `users/${currentUserId}/weightLogs/${currentLog.id}`, ...currentUserInfo
        };
    });

    const unlockedAchievementEvents: TimelineEvent[] = Object.entries(userData.unlockedAchievements || {})
        .map(([id, dateString]) => {
            const achievement = achievements.find(a => a.id === id);
            if (!achievement) return null;
            return {
                id: `ach_${id}`, type: 'achievement', timestamp: new Date(dateString as string).getTime(), title: `Bragd: ${achievement.name}`,
                description: achievement.description, icon: achievement.icon, reactions: userData.achievementInteractions?.[id]?.reactions || {}, comments: [],
                relatedDocPath: `users/${currentUserId}/achievementInteractions/${id}`, ...currentUserInfo
            };
        }).filter(e => e !== null) as TimelineEvent[];

    const allEvents = [...weightEvents, ...unlockedAchievementEvents];
    return allEvents.sort((a, b) => b.timestamp - a.timestamp);
}