



import { db, auth } from "../firebase";
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
    type DocumentSnapshot,
    type QuerySnapshot,
    type QueryDocumentSnapshot,
    type DocumentChange,
    type SnapshotMetadata,
    type FieldPath,
    limit,
    deleteField,
    increment
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
    BuddySummary,
    TimelineEvent,
    Achievement,
    Chat,
    ChatMessage
} from '../types';
import type { User } from '@firebase/auth';
import { DEFAULT_GOALS, DEFAULT_USER_PROFILE } from "../constants";
import { courseLessons } from "../courseData";
import * as mockService from './mockFirestoreService';

const isMock = new URLSearchParams(window.location.search).get('mock') === 'true';
if (isMock) {
    console.log("%cRUNNING IN MOCK MODE", "color: orange; font-weight: bold; font-size: 14px;");
}

// Helper to safely get a document, falling back to cache if offline
export async function getDocSafe<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
    try {
        return await getDoc(ref);
    } catch (error: any) {
        if (error.code === 'unavailable') {
            console.warn(`Firestore unavailable for ${ref.path}. Attempting to read from cache.`);
            try {
                return await getDocFromCache(ref);
            } catch (cacheError: any) {
                console.warn(`Could not read doc ${ref.path} from cache. Re-throwing 'unavailable' to signal offline state. Message: ${cacheError.message}`);
                throw error; // Re-throw the original 'unavailable' error
            }
        }
        console.error(`Unhandled Firestore error for ${ref.path}:`, error);
        throw error; // Re-throw other errors
    }
}

// Helper to safely get documents from a query, falling back to cache if offline
async function getDocsSafe<T>(q: Query<T>): Promise<QuerySnapshot<T>> {
    try {
        return await getDocs(q);
    } catch (error: any) {
        if (error.code === 'unavailable') {
            console.warn(`Firestore unavailable for query. Attempting to read from cache.`);
            try {
                return await getDocsFromCache(q);
            } catch (cacheError: any) {
                 console.warn(`Could not read query from cache. Re-throwing 'unavailable' to signal offline state. Message: ${cacheError.message}`);
                throw error; // Re-throw the original 'unavailable' error
            }
        }
        console.error(`Unhandled Firestore error for query:`, error);
        throw error; // Re-throw other errors
    }
}


// --- Meal Logs ---
export async function addMealLog(userId: string, mealData: Omit<LoggedMeal, 'id'>) {
    if (isMock) return mockService.addMealLog(userId, mealData);
  const mealDataForFirestore: { [key: string]: any } = {
    ...mealData,
    createdAt: serverTimestamp(),
  };

  // Remove undefined fields to prevent Firestore errors
  Object.keys(mealDataForFirestore).forEach(key => {
      if (mealDataForFirestore[key] === undefined) {
          delete mealDataForFirestore[key];
      }
  });
  
  const batch = writeBatch(db);
  const newMealRef = doc(collection(db, "users", userId, "mealLogs"));
  batch.set(newMealRef, mealDataForFirestore);

  // Update lastLogDate on the main user document
  const userDocRef = doc(db, "users", userId);
  batch.update(userDocRef, { lastLogDate: mealData.dateString });
  
  await batch.commit();
  return newMealRef.id;
}

export async function deleteMealLog(userId: string, mealLogId: string) {
    if (isMock) return mockService.deleteMealLog(userId, mealLogId);
  await deleteDoc(doc(db, "users", userId, "mealLogs", mealLogId));
}

export async function updateMealLog(userId: string, mealLogId: string, updatedInfo: Partial<NutritionalInfo>) {
    if (isMock) return mockService.updateMealLog(userId, mealLogId, updatedInfo);
    
    // Create an object with dot notation for updating nested fields.
    // This is safer as it only touches the fields provided in updatedInfo.
    const firestoreUpdateData: { [key: string]: any } = {};
    for (const key in updatedInfo) {
        if (Object.prototype.hasOwnProperty.call(updatedInfo, key)) {
            firestoreUpdateData[`nutritionalInfo.${key}`] = updatedInfo[key as keyof typeof updatedInfo];
        }
    }
    
    if (Object.keys(firestoreUpdateData).length === 0) {
        console.warn("updateMealLog called with empty data. No update performed.");
        return;
    }

    await updateDoc(doc(db, "users", userId, "mealLogs", mealLogId), firestoreUpdateData);
}

export async function fetchMealLogsForDate(userId: string, dateUID: string): Promise<LoggedMeal[]> {
    if (isMock) return mockService.fetchMealLogsForDate(userId, dateUID);
  const q = query(collection(db, "users", userId, "mealLogs"), where("dateString", "==", dateUID), orderBy("timestamp", "asc"));
  const querySnapshot = await getDocsSafe(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoggedMeal));
}

// --- Water Logs ---
export async function setWaterLog(userId: string, dateUID: string, waterMl: number) {
    if (isMock) return mockService.setWaterLog(userId, dateUID, waterMl);
    const waterLogRef = doc(db, "users", userId, "waterLogs", dateUID);
    await setDoc(waterLogRef, { dateUID, waterLoggedMl: waterMl });
}

export async function fetchWaterLog(userId: string, dateUID: string): Promise<number> {
    if (isMock) return mockService.fetchWaterLog(userId, dateUID);
    const docRef = doc(db, "users", userId, "waterLogs", dateUID);
    const docSnap = await getDocSafe(docRef);
    return docSnap.exists() ? docSnap.data().waterLoggedMl : 0;
}


// --- User Document (Profile, Goals, Streak, etc.) ---
export async function ensureUserProfileInFirestore(fbUser: User, role: UserRole, profileName?: string): Promise<void> {
    if (isMock) return mockService.ensureUserProfileInFirestore(fbUser, role, profileName);
  const userDocRef = doc(db, "users", fbUser.uid);
  const docSnap = await getDocSafe(userDocRef);

  if (!docSnap.exists()) {
    // This block should rarely be hit now, as fetchInitialAppData handles creation.
    // Kept as a fallback.
    const isAdminSeedAccount = fbUser.email === 'mikael@flexibelfriskvardhalsa.se';
    const finalRole = isAdminSeedAccount ? 'coach' : 'member';
    const finalStatus = isAdminSeedAccount ? 'approved' : 'pending';
    const finalHasCompletedOnboarding = isAdminSeedAccount;

    const defaultDisplayName = finalRole === 'coach' ? 'Coach' : (profileName || 'Ny Medlem');
    
    const newUserDocument: Omit<FirestoreUserDocument, 'lastLoginAt' | 'createdAt'> & { lastLoginAt: any, createdAt: any } = {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: profileName || fbUser.displayName || defaultDisplayName,
      role: finalRole,
      status: finalStatus,
      isCourseActive: false,
      courseInterest: false,
      hasCompletedOnboarding: finalHasCompletedOnboarding,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      lastLogDate: null,
      goals: DEFAULT_GOALS,
      goalType: 'maintain',
      ageYears: null,
      gender: 'female',
      measurementMethod: 'inbody',
      desiredWeightChangeKg: null,
      desiredFatMassChangeKg: null,
      desiredMuscleMassChangeKg: null,
      currentStreak: 0,
      lastDateStreakChecked: null,
      highestStreak: 0,
      highestLevelId: null,
      weeklyBank: { weekId: "", bankedCalories: 0, startDate: "", endDate: "" },
      courseProgressSummary: {
        started: false,
        completedLessons: 0,
        totalLessons: courseLessons.length
      },
      unlockedAchievements: {},
    };
    await setDoc(userDocRef, newUserDocument);

    const profileDetailsRef = doc(db, "users", fbUser.uid, "profile", "profileDetails");
    await setDoc(profileDetailsRef, DEFAULT_USER_PROFILE);

    console.log(`New user document created in Firestore for UID: ${fbUser.uid}. Role: ${finalRole}`);
  } else {
    await updateDoc(userDocRef, {
        email: fbUser.email,
        displayName: profileName || docSnap.data().displayName || fbUser.displayName,
        lastLoginAt: serverTimestamp(),
    });
  }
}

export async function saveProfileAndGoals(userId: string, profile: UserProfileData, goals: GoalSettings) {
    if (isMock) return mockService.saveProfileAndGoals(userId, profile, goals);
  const userDocRef = doc(db, "users", userId);
  const profileDetailsRef = doc(db, "users", userId, "profile", "profileDetails");

  const batch = writeBatch(db);

  // Sanitize the profile object to remove any keys with an `undefined` value,
  // as Firestore does not support them.
  const firestoreProfile = Object.keys(profile).reduce((acc, key) => {
    const K = key as keyof UserProfileData;
    if (profile[K] !== undefined) {
      (acc as any)[K] = profile[K];
    }
    return acc;
  }, {} as Partial<UserProfileData>);


  batch.update(userDocRef, { 
    goals: goals,
    displayName: profile.name || null,
    goalType: profile.goalType,
    ageYears: profile.ageYears ?? null,
    gender: profile.gender,
    measurementMethod: profile.measurementMethod ?? 'inbody',
    desiredWeightChangeKg: profile.desiredWeightChangeKg ?? null,
    desiredFatMassChangeKg: profile.desiredFatMassChangeKg ?? null,
    desiredMuscleMassChangeKg: profile.desiredMuscleMassChangeKg ?? null,
    // Denormalize fields for coach view
    currentWeightKg: profile.currentWeightKg ?? null,
  });
  batch.set(profileDetailsRef, firestoreProfile, { merge: true });

  await batch.commit();
}

export async function updateUserDocument(userId: string, data: Partial<FirestoreUserDocument>) {
    if (isMock) return mockService.updateUserDocument(userId, data);
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, data);
}

// --- Common Meals ---
export async function addCommonMeal(userId: string, commonMealData: Omit<CommonMeal, 'id'>) {
    if (isMock) return mockService.addCommonMeal(userId, commonMealData);
    const docRef = await addDoc(collection(db, "users", userId, "commonMeals"), commonMealData);
    return docRef.id;
}

export async function deleteCommonMeal(userId: string, commonMealId: string) {
    if (isMock) return mockService.deleteCommonMeal(userId, commonMealId);
    await deleteDoc(doc(db, "users", userId, "commonMeals", commonMealId));
}

export async function updateCommonMeal(userId: string, commonMealId: string, updatedData: { name: string; nutritionalInfo: NutritionalInfo }) {
    if (isMock) return mockService.updateCommonMeal(userId, commonMealId, updatedData);
    await updateDoc(doc(db, "users", userId, "commonMeals", commonMealId), updatedData);
}


// --- Past Day Summaries ---
export async function setPastDaySummary(userId: string, dateUID: string, summary: PastDaySummary) {
    if (isMock) return mockService.setPastDaySummary(userId, dateUID, summary);
    const summaryRef = doc(db, "users", userId, "pastDaySummaries", dateUID);
    await setDoc(summaryRef, summary);
}

// --- Course Progress ---
export async function saveCourseProgress(userId: string, lessonId: string, progress: UserLessonProgress) {
    if (isMock) return mockService.saveCourseProgress(userId, lessonId, progress);
  const userDocRef = doc(db, "users", userId);
  const courseProgressCollectionRef = collection(db, "users", userId, "courseProgress");
  const lessonProgressDocRef = doc(courseProgressCollectionRef, lessonId);

  // First, get the current state of progress for this user
  const snapshot = await getDocsSafe(courseProgressCollectionRef);
  let completedCount = 0;
  let hasStarted = snapshot.docs.length > 0;
  
  // Calculate completed lessons based on what's in Firestore *before* this update
  snapshot.forEach(docSnap => {
      // If we are updating the current doc, we use the new `isCompleted` status
      if (docSnap.id === lessonId) {
          if (progress.isCompleted) {
              completedCount++;
          }
      } else { // For all other docs, use their existing status
          if (docSnap.data().isCompleted) {
              completedCount++;
          }
      }
  });
  
  if (!snapshot.docs.find(d => d.id === lessonId)) {
    hasStarted = true; // New lesson progress implies starting
  }


  const progressSummary = {
      started: hasStarted,
      completedLessons: completedCount,
      totalLessons: courseLessons.length,
  };

  const batch = writeBatch(db);
  batch.set(lessonProgressDocRef, progress, { merge: true });
  batch.update(userDocRef, { courseProgressSummary: progressSummary });

  await batch.commit();
}


// --- Weight Logs ---
export async function saveWeightLog(userId: string, weightLog: Omit<WeightLogEntry, 'id'>) {
    if (isMock) return mockService.saveWeightLog(userId, weightLog);
    const dataToSave: { [key: string]: any } = { ...weightLog };
    
    // Remove undefined fields to prevent Firestore errors
    Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === undefined) {
            delete dataToSave[key];
        }
    });

    // Use a batch to ensure atomic write
    const batch = writeBatch(db);
    
    // 1. Create the new weight log document
    const newWeightLogRef = doc(collection(db, "users", userId, "weightLogs"));
    batch.set(newWeightLogRef, dataToSave);
    
    // Prepare updates for profile documents
    const profileUpdates: { currentWeightKg: number, skeletalMuscleMassKg?: number, bodyFatMassKg?: number } = {
        currentWeightKg: weightLog.weightKg
    };
    if (weightLog.skeletalMuscleMassKg !== undefined && weightLog.skeletalMuscleMassKg !== null) {
        profileUpdates.skeletalMuscleMassKg = weightLog.skeletalMuscleMassKg;
    }
    if (weightLog.bodyFatMassKg !== undefined && weightLog.bodyFatMassKg !== null) {
        profileUpdates.bodyFatMassKg = weightLog.bodyFatMassKg;
    }

    // 2. Update the denormalized weight on the main user document
    const userDocRef = doc(db, "users", userId);
    batch.update(userDocRef, { currentWeightKg: weightLog.weightKg });

    // 3. Update the profile sub-document with all relevant fields
    const profileDetailsRef = doc(db, "users", userId, "profile", "profileDetails");
    batch.set(profileDetailsRef, profileUpdates, { merge: true });

    await batch.commit();
    return newWeightLogRef.id;
}


// --- Mental Wellbeing ---
export async function addMentalWellbeingLog(userId: string, logData: Omit<MentalWellbeingLog, 'id'>) {
    if (isMock) return mockService.addMentalWellbeingLog(userId, logData);
    const dataToSave: { [key: string]: any } = { ...logData };
    
    Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === undefined) {
            delete dataToSave[key];
        }
    });

    await addDoc(collection(db, "users", userId, "mentalWellbeingLogs"), dataToSave);
}

// --- Initial App Data Fetch ---
export async function fetchInitialAppData(userId: string) {
    if (isMock) return mockService.fetchInitialAppData(userId);
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDocSafe(userDocRef);

    if (!userDocSnap.exists()) {
        console.error(`User document for UID ${userId} not found.`);
        // Returning a default structure to prevent app crash
        const today = new Date();
        const { weekId, startDate, endDate } = getWeekInfo(today);
        return {
            role: 'member' as UserRole,
            status: 'pending' as 'pending' | 'approved',
            hasCompletedOnboarding: false,
            profile: DEFAULT_USER_PROFILE,
            goals: DEFAULT_GOALS,
            currentStreak: 0,
            lastDateStreakChecked: null,
            highestStreak: 0,
            highestLevelId: null,
            weeklyBank: { weekId, bankedCalories: 0, startDate, endDate },
            commonMeals: [],
            weightLogs: [],
            pastDaySummaries: {},
            courseProgress: {},
            unlockedAchievements: {},
            buddies: [],
        };
    }

    const userData = userDocSnap.data();

    // Fetch sub-collections
    const profileDetailsSnap = await getDocSafe(doc(db, "users", userId, "profile", "profileDetails"));
    
    const commonMealsQuery = query(collection(db, "users", userId, "commonMeals"), orderBy("name"));
    const weightLogsQuery = query(collection(db, "users", userId, "weightLogs"), orderBy("loggedAt", "asc"));
    const pastSummariesQuery = query(collection(db, "users", userId, "pastDaySummaries")); // No order needed, we'll object-map it
    const courseProgressQuery = query(collection(db, "users", userId, "courseProgress"));
    const buddiesQuery = collection(db, "users", userId, "buddies");


    const [commonMealsSnap, weightLogsSnap, pastSummariesSnap, courseProgressSnap, buddiesSnap] = await Promise.all([
        getDocsSafe(commonMealsQuery),
        getDocsSafe(weightLogsQuery),
        getDocsSafe(pastSummariesQuery),
        getDocsSafe(courseProgressQuery),
        getDocsSafe(buddiesQuery),
    ]);
    
    // Process results
    const commonMeals = commonMealsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommonMeal));
    const weightLogs = weightLogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeightLogEntry));
    const pastDaySummaries = pastSummariesSnap.docs.reduce((acc: PastDaysSummaryCollection, doc) => {
        acc[doc.id] = doc.data() as PastDaySummary;
        return acc;
    }, {});
    const courseProgress = courseProgressSnap.docs.reduce((acc: UserCourseProgress, doc) => {
        acc[doc.id] = doc.data() as UserLessonProgress;
        return acc;
    }, {});
    const buddies = buddiesSnap.docs.map(doc => doc.data() as Peppkompis);

    
    // Ensure weeklyBank is valid for the current week
    const today = new Date();
    const { weekId: currentWeekId, startDate: currentWeekStart, endDate: currentWeekEnd } = getWeekInfo(today);
    let weeklyBank = userData.weeklyBank;
    if (!weeklyBank || weeklyBank.weekId !== currentWeekId) {
        weeklyBank = { weekId: currentWeekId, bankedCalories: 0, startDate: currentWeekStart, endDate: currentWeekEnd };
    }

    return {
        role: userData.role || 'member',
        status: userData.status || 'pending',
        hasCompletedOnboarding: userData.hasCompletedOnboarding || false,
        profile: profileDetailsSnap.exists() ? profileDetailsSnap.data() as UserProfileData : DEFAULT_USER_PROFILE,
        goals: userData.goals || DEFAULT_GOALS,
        currentStreak: userData.currentStreak || 0,
        lastDateStreakChecked: userData.lastDateStreakChecked || null,
        highestStreak: userData.highestStreak || 0,
        highestLevelId: userData.highestLevelId || null,
        weeklyBank,
        commonMeals,
        weightLogs,
        pastDaySummaries,
        courseProgress,
        unlockedAchievements: userData.unlockedAchievements || {},
        buddies,
    };
}


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

// --- Peppkompis (Buddy) System ---

export async function addPepp(fromUser: { uid: string; name: string; }, toUserUid: string, dateString: string) {
    if (isMock) return mockService.addPepp(fromUser, toUserUid, dateString);
    const summaryDocRef = doc(db, "users", toUserUid, "pastDaySummaries", dateString);
    
    // Using dot notation to set a field in a map. This is idempotent.
    // It will add the field if it doesn't exist, or overwrite it if it does.
    // The value is the user's name, which can be useful for display later.
    await updateDoc(summaryDocRef, {
        [`pepps.${fromUser.uid}`]: fromUser.name
    });
}

export async function updateUserSearchableStatus(userId: string, isSearchable?: boolean): Promise<boolean> {
    if (isMock) return mockService.updateUserSearchableStatus(userId, isSearchable);
    const userDocRef = doc(db, "users", userId);
    
    if (typeof isSearchable === 'boolean') {
        await updateDoc(userDocRef, { isSearchable });
        return isSearchable;
    } else {
        const docSnap = await getDocSafe(userDocRef);
        return docSnap.data()?.isSearchable || false;
    }
}

export async function searchUserByEmail(email: string, currentUserId: string): Promise<Peppkompis | null> {
    if (isMock) return mockService.searchUserByEmail(email, currentUserId);
    const q = query(
        collection(db, "users"),
        where("email", "==", email),
        where("isSearchable", "==", true),
        limit(1)
    );
    const querySnapshot = await getDocsSafe(q);

    if (querySnapshot.empty) {
        return null;
    }

    const userDoc = querySnapshot.docs[0];
    if (userDoc.id === currentUserId) {
        return null; // Cannot add yourself
    }
    
    const userData = userDoc.data() as FirestoreUserDocument;
    return {
        uid: userDoc.id,
        name: userData.displayName || 'Okänd användare',
        email: userData.email || email,
    };
}

export async function sendFriendRequest(fromUser: Peppkompis, toUserUid: string): Promise<void> {
    if (isMock) return mockService.sendFriendRequest(fromUser, toUserUid);
    // Check if a request already exists
    const requestsRef = collection(db, 'peppkompisRequests');
    const q1 = query(requestsRef, where('fromUid', '==', fromUser.uid), where('toUid', '==', toUserUid));
    const q2 = query(requestsRef, where('fromUid', '==', toUserUid), where('toUid', '==', fromUser.uid));

    const [existingReq1, existingReq2] = await Promise.all([getDocsSafe(q1), getDocsSafe(q2)]);
    
    if (!existingReq1.empty || !existingReq2.empty) {
        throw new Error("En förfrågan finns redan mellan er eller så är ni redan vänner.");
    }

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

export async function fetchFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    if (isMock) return mockService.fetchFriendRequests(userId);
    const q = query(
        collection(db, 'peppkompisRequests'),
        where('toUid', '==', userId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocsSafe(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeppkompisRequest));
}

export async function updateFriendRequestStatus(request: PeppkompisRequest, status: 'accepted' | 'declined'): Promise<void> {
    if (isMock) return mockService.updateFriendRequestStatus(request, status);
    const requestDocRef = doc(db, 'peppkompisRequests', request.id);

    if (status === 'accepted') {
        const batch = writeBatch(db);

        // Update request status
        batch.update(requestDocRef, { status: 'accepted' });

        // Add buddy to both users
        const fromUserRef = doc(db, 'users', request.fromUid);
        const toUserRef = doc(db, 'users', request.toUid);

        const [fromUserSnap, toUserSnap] = await Promise.all([getDocSafe(fromUserRef), getDocSafe(toUserRef)]);

        if (!fromUserSnap.exists() || !toUserSnap.exists()) {
            throw new Error("Kunde inte hitta en av användarna.");
        }

        const fromUserData = fromUserSnap.data();
        const toUserData = toUserSnap.data();

        const buddyForFromUser: Peppkompis = { uid: request.toUid, name: toUserData.displayName, email: toUserData.email };
        const buddyForToUser: Peppkompis = { uid: request.fromUid, name: fromUserData.displayName, email: fromUserData.email };

        const fromUserBuddyRef = doc(db, 'users', request.fromUid, 'buddies', request.toUid);
        const toUserBuddyRef = doc(db, 'users', request.toUid, 'buddies', request.fromUid);

        batch.set(fromUserBuddyRef, buddyForFromUser);
        batch.set(toUserBuddyRef, buddyForToUser);

        await batch.commit();

    } else { // 'declined'
        // Just delete the request
        await deleteDoc(requestDocRef);
    }
}

export async function fetchBuddies(userId: string): Promise<Peppkompis[]> {
    if (isMock) return mockService.fetchBuddies(userId);
    const buddiesCollectionRef = collection(db, 'users', userId, 'buddies');
    const querySnapshot = await getDocsSafe(buddiesCollectionRef);
    return querySnapshot.docs.map(doc => doc.data() as Peppkompis);
}

export async function removeBuddy(currentUserId: string, buddyUid: string): Promise<void> {
    if (isMock) return mockService.removeBuddy(currentUserId, buddyUid);
    const batch = writeBatch(db);

    const currentUserBuddyRef = doc(db, 'users', currentUserId, 'buddies', buddyUid);
    const buddyUserBuddyRef = doc(db, 'users', buddyUid, 'buddies', currentUserId);

    batch.delete(currentUserBuddyRef);
    batch.delete(buddyUserBuddyRef);
    
    // Also remove any pending requests between them
    const requestsRef = collection(db, 'peppkompisRequests');
    const q1 = query(requestsRef, where('fromUid', '==', currentUserId), where('toUid', '==', buddyUid));
    const q2 = query(requestsRef, where('fromUid', '==', buddyUid), where('toUid', '==', currentUserId));
    
    const [reqs1, reqs2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    reqs1.forEach(doc => batch.delete(doc.ref));
    reqs2.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
}


export async function fetchBuddyDailyData(buddyId: string, dateUID: string): Promise<{
    meals: LoggedMeal[];
    water: number;
    goals: GoalSettings;
    profile: UserProfileData;
}> {
    if (isMock) return mockService.fetchBuddyDailyData(buddyId, dateUID);
    
    // SECURITY NOTE: In a real app, this MUST be protected by Firestore security rules
    // that check if the requesting user (auth.uid) is a buddy of `buddyId`.
    
    const userDocRef = doc(db, "users", buddyId);
    const profileRef = doc(db, "users", buddyId, "profile", "profileDetails");
    
    const [userDocSnap, profileSnap] = await Promise.all([
        getDocSafe(userDocRef),
        getDocSafe(profileRef),
    ]);
    
    if (!userDocSnap.exists() || !profileSnap.exists()) {
        throw new Error("Kunde inte hitta din kompis profil.");
    }

    const userData = userDocSnap.data() as FirestoreUserDocument;
    const profileData = profileSnap.data() as UserProfileData;
    
    const [meals, water] = await Promise.all([
        fetchMealLogsForDate(buddyId, dateUID),
        fetchWaterLog(buddyId, dateUID)
    ]);
    
    return {
        meals,
        water,
        goals: userData.goals,
        profile: profileData
    };
}

export async function fetchBuddySummaryData(buddyId: string): Promise<BuddySummary> {
    if (isMock) return mockService.fetchBuddySummaryData(buddyId);
    // Fetch user document
    const userDocRef = doc(db, "users", buddyId);
    const userDocSnap = await getDocSafe(userDocRef);

    if (!userDocSnap.exists()) {
        throw new Error("Kunde inte hitta din kompis profil.");
    }
    const userData = userDocSnap.data() as FirestoreUserDocument;

    // Fetch first and last weight logs
    const weightLogsCollectionRef = collection(db, "users", buddyId, "weightLogs");
    const firstLogQuery = query(weightLogsCollectionRef, orderBy("loggedAt", "asc"), limit(1));
    const lastLogQuery = query(weightLogsCollectionRef, orderBy("loggedAt", "desc"), limit(1));

    const [firstLogSnap, lastLogSnap] = await Promise.all([
        getDocsSafe(firstLogQuery),
        getDocsSafe(lastLogQuery),
    ]);

    const firstLog = firstLogSnap.empty ? null : firstLogSnap.docs[0].data() as WeightLogEntry;
    const lastLog = lastLogSnap.empty ? null : lastLogSnap.docs[0].data() as WeightLogEntry;

    // Calculate changes
    let totalWeightChange, muscleMassChange, fatMassChange;
    if (firstLog && lastLog && firstLog.id !== lastLog.id) {
        totalWeightChange = lastLog.weightKg - firstLog.weightKg;
        if (lastLog.skeletalMuscleMassKg != null && firstLog.skeletalMuscleMassKg != null) {
            muscleMassChange = lastLog.skeletalMuscleMassKg - firstLog.skeletalMuscleMassKg;
        }
        if (lastLog.bodyFatMassKg != null && firstLog.bodyFatMassKg != null) {
            fatMassChange = lastLog.bodyFatMassKg - firstLog.bodyFatMassKg;
        }
    }
    
    let goalSummary = 'Ej satt';
    if (userData.desiredFatMassChangeKg && userData.desiredFatMassChangeKg < 0) {
        goalSummary = `${userData.desiredFatMassChangeKg} kg fett`;
    } else if (userData.desiredMuscleMassChangeKg && userData.desiredMuscleMassChangeKg > 0) {
        goalSummary = `+${userData.desiredMuscleMassChangeKg} kg muskler`;
    } else if(userData.goalType === 'maintain') {
        goalSummary = 'Bibehålla';
    }

    return {
        name: userData.displayName || 'Okänd',
        currentWeight: lastLog?.weightKg,
        totalWeightChange,
        muscleMassChange,
        fatMassChange,
        currentStreak: userData.currentStreak || 0,
        goalSummary
    };
}


const getDateUIDNoTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export async function fetchBuddyDetailsList(userId: string): Promise<BuddyDetails[]> {
    if (isMock) return mockService.fetchBuddyDetailsList(userId);
    const buddies = await fetchBuddies(userId);
    if (buddies.length === 0) {
        return [];
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateUID = getDateUIDNoTime(yesterday);

    const buddyDetailsPromises = buddies.map(async (buddy) => {
        const userDocRef = doc(db, "users", buddy.uid);
        const summaryDocRef = doc(db, "users", buddy.uid, "pastDaySummaries", yesterdayDateUID);
        
        // Fetch first and last weight logs to calculate TOTAL change
        const weightLogsCollectionRef = collection(db, "users", buddy.uid, "weightLogs");
        const firstLogQuery = query(weightLogsCollectionRef, orderBy("loggedAt", "asc"), limit(1));
        const lastLogQuery = query(weightLogsCollectionRef, orderBy("loggedAt", "desc"), limit(1));


        const [userDocSnap, summaryDocSnap, firstLogSnap, lastLogSnap] = await Promise.all([
            getDocSafe(userDocRef),
            getDocSafe(summaryDocRef),
            getDocsSafe(firstLogQuery),
            getDocsSafe(lastLogQuery),
        ]);

        let goalSummary = 'Ej satt';
        let currentStreak = 0;
        let unlockedAchievements: { [id: string]: string } = {};

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as FirestoreUserDocument;
            currentStreak = userData.currentStreak || 0;
            unlockedAchievements = userData.unlockedAchievements || {};
             if (userData.desiredFatMassChangeKg && userData.desiredFatMassChangeKg < 0) {
                goalSummary = `${userData.desiredFatMassChangeKg} kg fett`;
            } else if (userData.desiredMuscleMassChangeKg && userData.desiredMuscleMassChangeKg > 0) {
                goalSummary = `+${userData.desiredMuscleMassChangeKg} kg muskler`;
            } else if(userData.goalType === 'maintain') {
                goalSummary = 'Bibehålla';
            }
        }
        
        const firstLog = firstLogSnap.empty ? null : firstLogSnap.docs[0].data() as WeightLogEntry;
        const lastLog = lastLogSnap.empty ? null : lastLogSnap.docs[0].data() as WeightLogEntry;

        let totalWeightChange, muscleMassChange, fatMassChange;
        
        // Ensure we have two different logs to compare for total change
        if (firstLog && lastLog && firstLog.id !== lastLog.id) {
            totalWeightChange = lastLog.weightKg - firstLog.weightKg;
            if (lastLog.skeletalMuscleMassKg != null && firstLog.skeletalMuscleMassKg != null) {
                muscleMassChange = lastLog.skeletalMuscleMassKg - firstLog.skeletalMuscleMassKg;
            }
            if (lastLog.bodyFatMassKg != null && firstLog.bodyFatMassKg != null) {
                fatMassChange = lastLog.bodyFatMassKg - firstLog.bodyFatMassKg;
            }
        }
        
        const currentWeight = lastLog?.weightKg;
        const currentMuscleMass = lastLog?.skeletalMuscleMassKg;
        const currentFatMass = lastLog?.bodyFatMassKg;


        const yesterdayGoalMet = summaryDocSnap.exists() ? summaryDocSnap.data().goalMet : undefined;
        const pepps = summaryDocSnap.exists() ? summaryDocSnap.data().pepps || {} : {};
        const yesterdayPeppCount = Object.keys(pepps).length;
        const currentUserHasPepped = pepps.hasOwnProperty(userId);

        const lastWeightLogTimestamp = lastLog?.loggedAt;

        let lastAchievementTimestamp: number | undefined = undefined;
        if (unlockedAchievements && Object.keys(unlockedAchievements).length > 0) {
            const timestamps = Object.values(unlockedAchievements).map(dateStr => new Date(dateStr).getTime());
            if (timestamps.length > 0) {
                lastAchievementTimestamp = Math.max(...timestamps);
            }
        }
        
        return {
            ...buddy,
            goalSummary,
            yesterdayGoalMet,
            currentStreak,
            yesterdayPeppCount,
            currentUserHasPepped,
            unlockedAchievements,
            currentWeight,
            totalWeightChange,
            muscleMassChange,
            fatMassChange,
            currentMuscleMass,
            currentFatMass,
            lastWeightLogTimestamp,
            lastAchievementTimestamp,
        };
    });

    return Promise.all(buddyDetailsPromises);
}

export async function addPeppToWeightLog(fromUid: string, fromName: string, toUserUid: string, weightLogId: string): Promise<void> {
    if (isMock) return mockService.addPeppToWeightLog(fromUid, fromName, toUserUid, weightLogId);
    const weightLogRef = doc(db, "users", toUserUid, "weightLogs", weightLogId);
    await updateDoc(weightLogRef, {
        [`pepps.${fromUid}`]: { name: fromName, timestamp: Date.now() }
    });
}

export async function removePeppFromWeightLog(fromUid: string, toUserUid: string, weightLogId: string): Promise<void> {
    if (isMock) return mockService.removePeppFromWeightLog(fromUid, toUserUid, weightLogId);
    const weightLogRef = doc(db, "users", toUserUid, "weightLogs", weightLogId);
    await updateDoc(weightLogRef, {
        [`pepps.${fromUid}`]: deleteField()
    });
}

export async function addPeppToAchievement(fromUid: string, fromName: string, toUserUid: string, achievementId: string): Promise<void> {
    if (isMock) return mockService.addPeppToAchievement(fromUid, fromName, toUserUid, achievementId);
    const achievementInteractionRef = doc(db, "users", toUserUid, "achievementInteractions", achievementId);
    const peppData = {
        pepps: {
            [fromUid]: { name: fromName, timestamp: Date.now() }
        }
    };
    await setDoc(achievementInteractionRef, peppData, { merge: true });
}

export async function removePeppFromAchievement(fromUid: string, toUserUid: string, achievementId: string): Promise<void> {
    if (isMock) return mockService.removePeppFromAchievement(fromUid, toUserUid, achievementId);
    const achievementInteractionRef = doc(db, "users", toUserUid, "achievementInteractions", achievementId);
    await updateDoc(achievementInteractionRef, {
        [`pepps.${fromUid}`]: deleteField()
    });
}

async function fetchTimeline(userId: string, currentUserIdForPeppCheck: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    const weightLogsQuery = query(collection(db, "users", userId, "weightLogs"), orderBy("loggedAt", "desc"), limit(10));
    const [userDocSnap, weightLogsSnap] = await Promise.all([
        getDocSafe(doc(db, "users", userId)),
        getDocsSafe(weightLogsQuery)
    ]);

    if (!userDocSnap.exists()) return [];

    const userData = userDocSnap.data();
    const unlockedAchievements = userData.unlockedAchievements || {};
    
    const timelineEvents: TimelineEvent[] = [];

    // Process weight logs
    weightLogsSnap.docs.forEach(docSnap => {
        const log = docSnap.data() as Omit<WeightLogEntry, 'id'>;
        const docId = docSnap.id;
        const pepps = log.pepps || {};
        timelineEvents.push({
            id: `weight-${docId}`,
            type: 'weight',
            timestamp: log.loggedAt,
            title: `Vikt loggad: ${log.weightKg.toFixed(1)} kg`,
            description: log.comment || `Kroppssammansättning uppdaterad.`,
            icon: '⚖️',
            pepps: pepps,
            peppedByCurrentUser: pepps.hasOwnProperty(currentUserIdForPeppCheck),
            relatedDocId: docId
        });
    });
    
    // Process achievements
    const achIds = Object.keys(unlockedAchievements);
    if (achIds.length > 0) {
        const interactionPromises = achIds.map(achId => getDocSafe(doc(db, "users", userId, "achievementInteractions", achId)));
        const interactionSnaps = await Promise.all(interactionPromises);
        
        interactionSnaps.forEach((interactionSnap, index) => {
            const achId = achIds[index];
            const achievement = achievements.find(a => a.id === achId);
            if (achievement) {
                const pepps = interactionSnap.exists() ? interactionSnap.data().pepps || {} : {};
                timelineEvents.push({
                    id: `ach-${achId}`,
                    type: 'achievement',
                    timestamp: new Date(unlockedAchievements[achId]).getTime(),
                    title: `Bragd upplåst: ${achievement.name}`,
                    description: achievement.description,
                    icon: achievement.icon,
                    pepps: pepps,
                    peppedByCurrentUser: pepps.hasOwnProperty(currentUserIdForPeppCheck),
                    relatedDocId: achId
                });
            }
        });
    }

    timelineEvents.sort((a, b) => b.timestamp - a.timestamp);
    return timelineEvents;
}


export async function fetchTimelineForCurrentUser(currentUserId: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    if (isMock) return mockService.fetchTimelineForCurrentUser(currentUserId, achievements);
    return fetchTimeline(currentUserId, currentUserId, achievements);
}


export async function fetchTimelineForBuddy(buddyUid: string, currentUserId: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    if (isMock) return mockService.fetchTimelineForBuddy(buddyUid, currentUserId, achievements);
    return fetchTimeline(buddyUid, currentUserId, achievements);
}

// --- Chat Functions ---

export const getChatId = (uid1: string, uid2: string): string => {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

export function listenForChats(userId: string, callback: (chats: Chat[]) => void): () => void {
    if (isMock) return mockService.listenForChats(userId, callback);
    const chatsQuery = query(collection(db, 'chats'), where('participantUids', 'array-contains', userId));

    const unsubscribe = onSnapshot(chatsQuery, (querySnapshot) => {
        const chats = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                participants: data.participants,
                participantUids: data.participantUids,
                lastMessage: data.lastMessage ? {
                    ...data.lastMessage,
                    timestamp: (data.lastMessage.timestamp as Timestamp)?.toMillis() || 0
                } : undefined,
                unreadCounts: data.unreadCounts || {}
            } as Chat;
        });

        const sortedChats = chats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
        callback(sortedChats);
    }, (error) => {
        console.error("Error listening for chats:", error);
    });

    return unsubscribe;
}

export async function getChats(userId: string): Promise<Chat[]> {
    if (isMock) return mockService.getChats(userId);
    const chatsQuery = query(collection(db, 'chats'), where('participantUids', 'array-contains', userId));
    const querySnapshot = await getDocsSafe(chatsQuery);

    const chats = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            participants: data.participants,
            participantUids: data.participantUids,
            lastMessage: data.lastMessage ? {
                ...data.lastMessage,
                timestamp: (data.lastMessage.timestamp as Timestamp)?.toMillis() || 0
            } : undefined,
            unreadCounts: data.unreadCounts || {}
        } as Chat;
    });

    return chats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
}

export async function sendMessage(chatId: string, senderId: string, participants: Peppkompis[], text: string, imageDataUrl?: string) {
    if (isMock) return mockService.sendMessage(chatId, senderId, participants, text, imageDataUrl);

    const batch = writeBatch(db);
    
    const chatDocRef = doc(db, 'chats', chatId);
    const messagesCollectionRef = collection(db, 'chats', chatId, 'messages');
    const newMessageRef = doc(messagesCollectionRef);

    // 1. Add the new message to the batch
    const messageData: { [key: string]: any } = {
        senderId,
        text,
        timestamp: serverTimestamp()
    };
    if (imageDataUrl) {
        messageData.imageDataUrl = imageDataUrl;
    }
    batch.set(newMessageRef, messageData);

    // 2. Read the current chat document to get unread counts
    const chatDocSnap = await getDocSafe(chatDocRef);
    
    const recipient = participants.find(p => p.uid !== senderId);
    if (!recipient) throw new Error("Mottagare kunde inte hittas i chatten.");
    const recipientId = recipient.uid;

    // 3. Calculate the new unread counts map
    const currentUnreadMap = chatDocSnap.exists() ? (chatDocSnap.data().unreadCounts || {}) : {};
    const newUnreadMap = {
        ...currentUnreadMap,
        [recipientId]: (currentUnreadMap[recipientId] || 0) + 1,
    };
     if (newUnreadMap[senderId] === undefined) {
        newUnreadMap[senderId] = 0;
    }


    // 4. Prepare the chat document data with the full new map
    const lastMessageText = text.trim() ? text.trim() : (imageDataUrl ? "📷 Bild" : "");
    const chatData = {
        participants: participants.map(p => ({ uid: p.uid, name: p.name, email: p.email })),
        participantUids: participants.map(p => p.uid),
        lastMessage: {
            text: lastMessageText,
            timestamp: serverTimestamp(),
            senderId: senderId
        },
        unreadCounts: newUnreadMap
    };
    
    // 5. Add the chat document update to the batch
    batch.set(chatDocRef, chatData, { merge: true });

    await batch.commit();
}


export function listenForMessages(chatId: string, callback: (messages: ChatMessage[]) => void): () => void {
    if (isMock) return mockService.listenForMessages(chatId, callback);
    const messagesQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(messagesQuery, (querySnapshot) => {
        const messages = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: (doc.data().timestamp as Timestamp)?.toMillis() || Date.now()
        } as ChatMessage));
        callback(messages);
    }, (error) => {
        console.error("Error listening to messages:", error);
    });

    return unsubscribe;
}

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
    if (isMock) return mockService.deleteMessage(chatId, messageId);
    
    // Deletes the message document.
    // NOTE: This does not currently update the 'lastMessage' on the parent chat document
    // if the deleted message was the last one. The chat preview might be temporarily out of sync.
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await deleteDoc(messageRef);
}

export async function toggleMessageLike(chatId: string, messageId: string, userId: string) {
    if (isMock) return mockService.toggleMessageLike(chatId, messageId, userId);
    
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    
    const messageSnap = await getDoc(messageRef);
    if (!messageSnap.exists()) {
        console.error("Cannot like a message that does not exist.");
        return;
    }

    const likes = messageSnap.data().likes || {};
    const isLiked = likes[userId] === true;

    if (isLiked) {
        await updateDoc(messageRef, {
            [`likes.${userId}`]: deleteField()
        });
    } else {
        await updateDoc(messageRef, {
            [`likes.${userId}`]: true
        });
    }
}


export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
    if (isMock) return mockService.markChatAsRead(chatId, userId);
    const chatDocRef = doc(db, 'chats', chatId);
    try {
        await updateDoc(chatDocRef, {
            [`unreadCounts.${userId}`]: 0
        });
    } catch (error: any) {
        if (error.code !== 'not-found') {
            console.error("Error marking chat as read:", error);
            throw error;
        }
        // If doc doesn't exist, it means chat hasn't started. No action needed.
    }
}

export function listenForTotalUnreadCount(userId: string, callback: (count: number) => void): () => void {
    if (isMock) return mockService.listenForTotalUnreadCount(userId, callback);
    const q = query(collection(db, 'chats'), where('participantUids', 'array-contains', userId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        let totalUnread = 0;
        querySnapshot.forEach(doc => {
            const data = doc.data();
            if (data.unreadCounts && data.unreadCounts[userId]) {
                totalUnread += data.unreadCounts[userId];
            }
        });
        callback(totalUnread);
    }, (error) => {
        console.error("Error listening for total unread count:", error);
        callback(0); // Return 0 on error
    });

    return unsubscribe;
}



// --- COACH-SPECIFIC FUNCTIONS ---

export async function fetchCoachViewMembers(): Promise<CoachViewMember[]> {
    if (isMock) return mockService.fetchCoachViewMembers();
    
    const usersCollectionRef = collection(db, "users");
    const q = query(usersCollectionRef);
    const querySnapshot = await getDocsSafe(q);
    
    const members: CoachViewMember[] = [];
    for (const userDoc of querySnapshot.docs) {
        const userData = userDoc.data() as FirestoreUserDocument;
        
        let goalSummary = 'Ej satt';
        if (userData.desiredFatMassChangeKg && userData.desiredFatMassChangeKg < 0) {
            goalSummary = `${userData.desiredFatMassChangeKg} kg fett`;
        } else if (userData.desiredMuscleMassChangeKg && userData.desiredMuscleMassChangeKg > 0) {
            goalSummary = `+${userData.desiredMuscleMassChangeKg} kg muskler`;
        } else if(userData.goalType === 'maintain') {
            goalSummary = 'Bibehålla';
        }

        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);

        const weightLogsQuery = query(
            collection(db, "users", userDoc.id, "weightLogs"),
            where("loggedAt", ">=", sevenDaysAgo.getTime()),
            orderBy("loggedAt", "asc")
        );
        const weightLogsSnapshot = await getDocsSafe(weightLogsQuery);
        const recentWeightLogs = weightLogsSnapshot.docs.map(doc => doc.data() as WeightLogEntry);

        let weeklyWeightChange: number | undefined;
        if (recentWeightLogs.length > 1) {
            const firstLog = recentWeightLogs[0];
            const lastLog = recentWeightLogs[recentWeightLogs.length - 1];
            weeklyWeightChange = lastLog.weightKg - firstLog.weightKg;
        }

        const lastLogDate = userData.lastLogDate || undefined;
        let adherence: CoachViewMember['goalAdherence'] = 'inactive';
        if (lastLogDate) {
            const daysSinceLastLog = (today.getTime() - new Date(lastLogDate).getTime()) / (1000 * 3600 * 24);
            if (daysSinceLastLog < 3) adherence = 'good';
            else if (daysSinceLastLog < 7) adherence = 'average';
            else adherence = 'poor';
        }

        const sevenDaysAgoISO = sevenDaysAgo.toISOString().split('T')[0];
        const summariesQuery = query(
            collection(db, "users", userDoc.id, "pastDaySummaries"),
            where("date", ">=", sevenDaysAgoISO)
        );
        const summariesSnapshot = await getDocsSafe(summariesQuery);
        const last7DaysSummaries = summariesSnapshot.docs.map(d => d.data() as PastDaySummary);

        let proteinGoalMetDays = 0;
        if (last7DaysSummaries.length > 0) {
            proteinGoalMetDays = last7DaysSummaries.filter(s => s.proteinGoalMet).length;
        }

        const proteinGoalMetPercentage7d = last7DaysSummaries.length > 0
            ? Math.round((proteinGoalMetDays / last7DaysSummaries.length) * 100)
            : 0;

        const coachMember: CoachViewMember = {
            id: userDoc.id,
            name: userData.displayName || 'Okänt namn',
            email: userData.email || 'Okänd e-post',
            role: userData.role,
            status: userData.status,
            ageYears: userData.ageYears,
            gender: userData.gender,
            isCourseActive: userData.isCourseActive,
            courseInterest: userData.courseInterest,
            memberSince: new Date((userData.createdAt as any).seconds * 1000).toISOString().split('T')[0],
            lastLogDate,
            currentStreak: userData.currentStreak,
            goalSummary,
            proteinGoalMetPercentage7d,
            courseProgressSummary: userData.courseProgressSummary,
            goalAdherence: adherence,
            weeklyWeightChange: weeklyWeightChange,
        };
        members.push(coachMember);
    }
    return members;
}


export async function setCourseAccessForMember(memberId: string, newStatus: boolean): Promise<void> {
    if (isMock) return mockService.setCourseAccessForMember(memberId, newStatus);
    const userDocRef = doc(db, "users", memberId);
    await updateDoc(userDocRef, { 
        isCourseActive: newStatus,
        // Reset interest flag when access is granted
        courseInterest: newStatus ? false : (await getDoc(userDocRef)).data()?.courseInterest 
    });
}

export async function approveMember(memberId: string): Promise<void> {
    if (isMock) return mockService.approveMember(memberId);
    const userDocRef = doc(db, "users", memberId);
    await updateDoc(userDocRef, { status: 'approved' });
}

export async function revokeApproval(memberId: string): Promise<void> {
    if (isMock) return mockService.revokeApproval(memberId);
    const userDocRef = doc(db, "users", memberId);
    await updateDoc(userDocRef, { status: 'pending', isCourseActive: false }); // Also deactivate course on revoke
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    if (isMock) return mockService.updateUserRole(userId, newRole);
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, { role: newRole });
}


export async function fetchDetailedMemberDataForCoach(memberId: string): Promise<AIDataForCoachSummary> {
    if (isMock) return mockService.fetchDetailedMemberDataForCoach(memberId);

    const profileDocRef = doc(db, "users", memberId, "profile", "profileDetails");
    const userDocRef = doc(db, "users", memberId);

    const [profileSnap, userSnap] = await Promise.all([getDocSafe(profileDocRef), getDocSafe(userDocRef)]);
    
    if (!userSnap.exists()) throw new Error("Member document not found.");

    const memberProfile = profileSnap.exists() ? profileSnap.data() as UserProfileData : DEFAULT_USER_PROFILE;
    const userData = userSnap.data();

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString().split('T')[0];

    const summariesQuery = query(
        collection(db, "users", memberId, "pastDaySummaries"),
        where("date", ">=", sevenDaysAgoISO),
        orderBy("date", "desc")
    );
    const summariesSnapshot = await getDocsSafe(summariesQuery);
    const last7DaysSummaries = summariesSnapshot.docs.map(d => d.data() as PastDaySummary);

    const weightLogsQuery = query(
        collection(db, "users", memberId, "weightLogs"),
        orderBy("loggedAt", "desc"),
        limit(5)
    );
    const weightLogsSnapshot = await getDocsSafe(weightLogsQuery);
    const last5WeightLogs = weightLogsSnapshot.docs.map(d => d.data() as WeightLogEntry).reverse();

    return {
        memberName: userData.displayName || 'Okänt namn',
        memberProfile,
        last7DaysSummaries,
        last5WeightLogs,
        currentStreak: userData.currentStreak || 0,
        lastLogDate: userData.lastLogDate,
        isCourseActive: userData.isCourseActive,
        courseProgressSummary: userData.courseProgressSummary
    };
}


export async function bulkApproveMembers(memberIds: string[]): Promise<void> {
    if (isMock) return mockService.bulkApproveMembers(memberIds);
    const batch = writeBatch(db);
    memberIds.forEach(id => {
        const docRef = doc(db, "users", id);
        batch.update(docRef, { status: "approved" });
    });
    await batch.commit();
}

export async function bulkSetCourseAccess(memberIds: string[], newStatus: boolean): Promise<void> {
    if (isMock) return mockService.bulkSetCourseAccess(memberIds, newStatus);
    const batch = writeBatch(db);
    memberIds.forEach(id => {
        const docRef = doc(db, "users", id);
        batch.update(docRef, { isCourseActive: newStatus, courseInterest: newStatus ? false : undefined });
    });
    await batch.commit();
}

export async function bulkUpdateUserRole(memberIds: string[], newRole: UserRole): Promise<void> {
    if (isMock) return mockService.bulkUpdateUserRole(memberIds, newRole);
    const batch = writeBatch(db);
    memberIds.forEach(id => {
        const docRef = doc(db, "users", id);
        batch.update(docRef, { role: newRole });
    });
    await batch.commit();
}
