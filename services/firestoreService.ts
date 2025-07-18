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
    Chat,
    ChatMessage
} from '../types';
import { DEFAULT_GOALS, LEVEL_DEFINITIONS } from '../constants';
import { courseLessons } from '../courseData.ts';

const getDateUID = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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

export const getDocSafe = async (docRef: DocumentReference) => {
    try {
        return await getDoc(docRef);
    } catch (error: any) {
        if (error.code === 'unavailable') {
            console.warn(`Firestore: Document read from cache for ${docRef.path} due to being offline.`);
            return getDocFromCache(docRef);
        }
        throw error;
    }
};

const getDocsSafe = async (queryRef: Query) => {
    try {
        return await getDocs(queryRef);
    } catch (error: any) {
        if (error.code === 'unavailable') {
            console.warn(`Firestore: Query read from cache for ${queryRef.toString()} due to being offline.`);
            return getDocsFromCache(queryRef);
        }
        throw error;
    }
};

export async function ensureUserProfileInFirestore(fbUser: User, role: UserRole = 'member', profileName?: string) {
    const userDocRef = doc(db, 'users', fbUser.uid);
    const userDoc = await getDocSafe(userDocRef);

    if (!userDoc.exists()) {
        const newUserDoc: FirestoreUserDocument = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: profileName || fbUser.displayName || "Ny användare",
            role: role,
            status: 'pending',
            isCourseActive: false,
            courseInterest: false,
            hasCompletedOnboarding: false,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            lastLogDate: null,
            photoURL: fbUser.photoURL,
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
            lastDateStreakChecked: null,
            highestStreak: 0,
            highestLevelId: null,
            weeklyBank: { weekId: 'none', bankedCalories: 0, startDate: '', endDate: ''},
            unlockedAchievements: {},
            journeyAnalysisFeedback: null,
            isSearchable: true,
            mainGoalCompleted: false,
            completedGoals: [],
        };
        await setDoc(userDocRef, newUserDoc);
    } else {
        const updateData: any = { lastLoginAt: serverTimestamp() };
        if (profileName && userDoc.data().displayName !== profileName) {
            updateData.displayName = profileName;
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

    const commonMealsQuery = query(commonMealsRef, orderBy('name'));
    const weightLogsQuery = query(weightLogsRef, orderBy('loggedAt'));

    try {
        const [
            userDocSnap,
            commonMealsSnap,
            weightLogsSnap,
            courseProgressSnap,
            pastSummariesSnap
        ] = await Promise.all([
            getDocSafe(userDocRef),
            getDocsSafe(commonMealsQuery),
            getDocsSafe(weightLogsQuery),
            getDocsSafe(courseProgressRef),
            getDocsSafe(pastSummariesRef)
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
            mainGoalCompleted: userDocData.mainGoalCompleted ?? false,
            completedGoals: userDocData.completedGoals ?? [],
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
            unlockedAchievements: userDocData.unlockedAchievements,
            journeyAnalysisFeedback: userDocData.journeyAnalysisFeedback,
            commonMeals,
            weightLogs,
            courseProgress,
            pastDaySummaries
        };
    } catch (error) {
        console.error("Error fetching initial app data:", error);
        throw error;
    }
}

export async function addMealLog(userId: string, mealData: Omit<LoggedMeal, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'users', userId, 'mealLogs'), mealData);
    await updateDoc(doc(db, 'users', userId), { lastLogDate: mealData.dateString });
    return docRef.id;
}

export async function deleteMealLog(userId: string, mealLogId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId, 'mealLogs', mealLogId));
}

export async function updateMealLog(userId: string, mealLogId: string, updatedInfo: Partial<LoggedMeal>): Promise<void> {
    await updateDoc(doc(db, 'users', userId, 'mealLogs', mealLogId), updatedInfo);
}

export async function fetchMealLogsForDate(userId: string, dateUID: string): Promise<LoggedMeal[]> {
    const q = query(collection(db, 'users', userId, 'mealLogs'), where('dateString', '==', dateUID), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocsSafe(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as LoggedMeal));
}

export async function setWaterLog(userId: string, dateUID: string, waterMl: number): Promise<void> {
    await setDoc(doc(db, 'users', userId, 'waterLogs', dateUID), { waterLoggedMl: waterMl });
}

export async function fetchWaterLog(userId: string, dateUID: string): Promise<number> {
    const docRef = doc(db, 'users', userId, 'waterLogs', dateUID);
    const docSnap = await getDocSafe(docRef);
    if (docSnap.exists()) {
        return docSnap.data().waterLoggedMl || 0;
    }
    return 0;
}

export async function addCommonMeal(userId: string, commonMealData: Omit<CommonMeal, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'users', userId, 'commonMeals'), commonMealData);
    return docRef.id;
}

export async function deleteCommonMeal(userId: string, commonMealId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId, 'commonMeals', commonMealId));
}

export async function updateCommonMeal(userId: string, commonMealId: string, updatedData: { name: string; nutritionalInfo: NutritionalInfo }): Promise<void> {
    await updateDoc(doc(db, 'users', userId, 'commonMeals', commonMealId), updatedData);
}

export async function saveProfileAndGoals(userId: string, profile: UserProfileData, goals: GoalSettings): Promise<void> {
    const userDocRef = doc(db, 'users', userId);
    
    // This function previously used a batch to fan-out name/photo updates to buddy
    // and chat collections. This complex operation can easily fail if Firestore security
    // rules are tightened, causing the entire profile save to be rejected.
    //
    // By simplifying this to only update the user's own document, we ensure the core
    // functionality (updating one's own profile) is robust and works even with
    // standard security rules (`allow write: if request.auth.uid == userId;`).
    //
    // The trade-off is that buddy/chat info may become stale. The robust, long-term
    // solution for fan-outs is to use a Cloud Function triggered by this document
    // update, which can perform writes with admin privileges.
    
    const dataToSave: Partial<FirestoreUserDocument> = {
        displayName: profile.name,
        photoURL: profile.photoURL ?? null,
        currentWeightKg: profile.currentWeightKg ?? null,
        heightCm: profile.heightCm ?? null,
        ageYears: profile.ageYears ?? null,
        gender: profile.gender,
        activityLevel: profile.activityLevel,
        goalType: profile.goalType,
        measurementMethod: profile.measurementMethod,
        desiredWeightChangeKg: profile.desiredWeightChangeKg ?? null,
        skeletalMuscleMassKg: profile.skeletalMuscleMassKg ?? null,
        bodyFatMassKg: profile.bodyFatMassKg ?? null,
        desiredFatMassChangeKg: profile.desiredFatMassChangeKg ?? null,
        desiredMuscleMassChangeKg: profile.desiredMuscleMassChangeKg ?? null,
        goalCompletionDate: profile.goalCompletionDate ?? null,
        isSearchable: profile.isSearchable ?? true,
        goalStartWeight: profile.goalStartWeight ?? null,
        mainGoalCompleted: profile.mainGoalCompleted ?? false,
        completedGoals: profile.completedGoals ?? [],
        goals: goals,
    };

    await updateDoc(userDocRef, dataToSave);
}


export async function saveWeightLog(userId: string, weightLog: Omit<WeightLogEntry, 'id'>): Promise<string> {
    const batch = writeBatch(db);
    const newLogRef = doc(collection(db, 'users', userId, 'weightLogs'));

    // Create a new object for Firestore, filtering out any undefined fields.
    const firestoreReadyWeightLog = Object.fromEntries(
        Object.entries(weightLog).filter(([_, v]) => v !== undefined)
    );

    batch.set(newLogRef, firestoreReadyWeightLog);

    const userDocRef = doc(db, 'users', userId);
    batch.update(userDocRef, {
        currentWeightKg: weightLog.weightKg,
        skeletalMuscleMassKg: weightLog.skeletalMuscleMassKg ?? deleteField(),
        bodyFatMassKg: weightLog.bodyFatMassKg ?? deleteField(),
    });
    
    await batch.commit();
    return newLogRef.id;
}

export async function setPastDaySummary(userId: string, dateUID: string, summary: PastDaySummary): Promise<void> {
    await setDoc(doc(db, 'users', userId, 'pastDaySummaries', dateUID), summary);
}

export async function updateUserDocument(userId: string, data: Partial<FirestoreUserDocument>): Promise<void> {
    await updateDoc(doc(db, 'users', userId), data);
}

export async function saveCourseProgress(userId: string, lessonId: string, progress: UserLessonProgress): Promise<void> {
    const progressRef = doc(db, 'users', userId, 'courseProgress', lessonId);
    await setDoc(progressRef, progress, { merge: true });

    // Update summary in a separate transaction or cloud function for better performance.
    // For simplicity here, we'll fetch and update.
    const allProgressSnap = await getDocs(collection(db, 'users', userId, 'courseProgress'));
    let completedCount = 0;
    allProgressSnap.forEach(doc => {
        if((doc.data() as UserLessonProgress).isCompleted) completedCount++;
    });

    const progressSummary = {
        started: allProgressSnap.size > 0,
        completedLessons: completedCount,
        totalLessons: courseLessons.length
    };
    
    await updateDoc(doc(db, 'users', userId), { courseProgressSummary: progressSummary });
}

export async function addMentalWellbeingLog(userId: string, logData: Omit<MentalWellbeingLog, 'id'>): Promise<void> {
    await addDoc(collection(db, 'users', userId, 'mentalWellbeingLogs'), logData);
}

export function listenForTotalUnreadCount(userId: string, callback: (count: number) => void): () => void {
    const q = query(collection(db, 'chats'), where('participantUids', 'array-contains', userId));
    return onSnapshot(q, (snapshot) => {
        let totalUnread = 0;
        snapshot.forEach(doc => {
            const chat = doc.data() as Chat;
            totalUnread += chat.unreadCounts?.[userId] || 0;
        });
        callback(totalUnread);
    });
}

export function listenForFriendRequests(userId: string, callback: (requests: PeppkompisRequest[]) => void): () => void {
    const q = query(collection(db, 'peppkompisRequests'), where('toUid', '==', userId), where('status', '==', 'pending'));
    
    return onSnapshot(q, async (snapshot) => {
        const requestsPromises = snapshot.docs.map(async (d) => {
            const requestData = { id: d.id, ...d.data() } as PeppkompisRequest;
            
            // Enrich with the latest display name
            try {
                const fromUserDoc = await getDocSafe(doc(db, 'users', requestData.fromUid));
                if (fromUserDoc.exists()) {
                    requestData.fromName = fromUserDoc.data().displayName || requestData.fromName;
                }
            } catch (error) {
                console.error(`Failed to enrich friend request from ${requestData.fromUid}`, error);
            }
            
            return requestData;
        });

        const enrichedRequests = await Promise.all(requestsPromises);
        callback(enrichedRequests);
    });
}

export async function fetchCoachViewMembers(): Promise<CoachViewMember[]> {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('displayName'));
    const snapshot = await getDocsSafe(q);

    return Promise.all(snapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data() as FirestoreUserDocument;
        const memberId = userDoc.id;

        const weightLogsRef = collection(db, 'users', memberId, 'weightLogs');
        const last7DaysDate = new Date();
        last7DaysDate.setDate(last7DaysDate.getDate() - 7);
        const summariesRef = query(collection(db, 'users', memberId, 'pastDaySummaries'), where('date', '>=', getDateUID(last7DaysDate)));
        const buddiesRef = collection(db, 'users', memberId, 'buddies');
        
        const [weightLogsSnap, summariesSnap, buddiesSnap] = await Promise.all([
            getDocsSafe(query(weightLogsRef, orderBy('loggedAt', 'desc'), limit(2))),
            getDocsSafe(summariesRef),
            getDocsSafe(buddiesRef)
        ]);

        let weeklyWeightChange: number | undefined;
        if(weightLogsSnap.docs.length >= 2) {
            const last = weightLogsSnap.docs[0].data().weightKg;
            const secondLast = weightLogsSnap.docs[1].data().weightKg;
            weeklyWeightChange = last - secondLast;
        }

        let proteinGoalMetPercentage7d: number | undefined;
        let goalAdherence: CoachViewMember['goalAdherence'] = 'inactive';
        if(!summariesSnap.empty) {
            const metCount = summariesSnap.docs.filter(d => d.data().goalMet).length;
            const adherence = metCount / summariesSnap.size;
            if (adherence >= 0.7) goalAdherence = 'good';
            else if (adherence >= 0.4) goalAdherence = 'average';
            else goalAdherence = 'poor';

            const proteinMetCount = summariesSnap.docs.filter(d => d.data().proteinGoalMet).length;
            proteinGoalMetPercentage7d = (proteinMetCount / summariesSnap.size) * 100;
        }
        
        return {
            id: memberId,
            name: userData.displayName,
            email: userData.email || '',
            role: userData.role,
            status: userData.status,
            photoURL: userData.photoURL || undefined,
            isCourseActive: userData.isCourseActive,
            courseInterest: userData.courseInterest,
            memberSince: userData.createdAt instanceof Timestamp ? userData.createdAt.toDate().toLocaleDateString('sv-SE') : 'N/A',
            lastLogDate: userData.lastLogDate || undefined,
            currentStreak: userData.currentStreak,
            goalSummary: `${userData.goalType === 'lose_fat' ? 'Fettminskning' : userData.goalType === 'gain_muscle' ? 'Muskelökning' : 'Bibehålla'}`,
            proteinGoalMetPercentage7d,
            goalAdherence,
            courseProgressSummary: userData.courseProgressSummary,
            weeklyWeightChange,
            ageYears: userData.ageYears || undefined,
            gender: userData.gender,
            numberOfBuddies: buddiesSnap.size
        };
    }));
}

export async function setCourseAccessForMember(memberId: string, access: boolean) {
    await updateDoc(doc(db, 'users', memberId), { isCourseActive: access, courseInterest: false });
}

export async function approveMember(memberId: string) {
    await updateDoc(doc(db, 'users', memberId), { status: 'approved' });
}

export async function revokeApproval(memberId: string) {
    await updateDoc(doc(db, 'users', memberId), { status: 'pending' });
}

export async function updateUserRole(memberId: string, newRole: UserRole) {
    await updateDoc(doc(db, 'users', memberId), { role: newRole });
}

export async function bulkApproveMembers(memberIds: string[]) {
    const batch = writeBatch(db);
    memberIds.forEach(id => batch.update(doc(db, 'users', id), { status: 'approved' }));
    await batch.commit();
}

export async function bulkSetCourseAccess(memberIds: string[], access: boolean) {
    const batch = writeBatch(db);
    memberIds.forEach(id => batch.update(doc(db, 'users', id), { isCourseActive: access, courseInterest: false }));
    await batch.commit();
}

export async function bulkUpdateUserRole(memberIds: string[], role: UserRole) {
    const batch = writeBatch(db);
    memberIds.forEach(id => batch.update(doc(db, 'users', id), { role }));
    await batch.commit();
}

export async function fetchDetailedMemberDataForCoach(memberId: string): Promise<AIDataForCoachSummary> {
    const userDocRef = doc(db, 'users', memberId);
    const userDocSnap = await getDocSafe(userDocRef);

    if (!userDocSnap.exists()) throw new Error("Member not found");
    const userData = userDocSnap.data() as FirestoreUserDocument;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const summariesQuery = query(collection(db, 'users', memberId, 'pastDaySummaries'), where('date', '>=', getDateUID(sevenDaysAgo)), orderBy('date', 'desc'));
    const weightLogsQuery = query(collection(db, 'users', memberId, 'weightLogs'), orderBy('loggedAt', 'desc'), limit(5));

    const [summariesSnap, weightLogsSnap] = await Promise.all([ getDocsSafe(summariesQuery), getDocsSafe(weightLogsQuery) ]);
    
    const last7DaysSummaries = summariesSnap.docs.map(d => d.data() as PastDaySummary);
    const last5WeightLogs = weightLogsSnap.docs.map(d => d.data() as WeightLogEntry);
    
    const userProfile: UserProfileData = {
        name: userData.displayName, currentWeightKg: userData.currentWeightKg ?? undefined, heightCm: userData.heightCm ?? undefined,
        ageYears: userData.ageYears ?? undefined, gender: userData.gender, activityLevel: userData.activityLevel ?? 'moderate', goalType: userData.goalType,
        measurementMethod: userData.measurementMethod, desiredWeightChangeKg: userData.desiredWeightChangeKg ?? undefined, skeletalMuscleMassKg: userData.skeletalMuscleMassKg ?? undefined,
        bodyFatMassKg: userData.bodyFatMassKg ?? undefined, desiredFatMassChangeKg: userData.desiredFatMassChangeKg ?? undefined,
        desiredMuscleMassChangeKg: userData.desiredMuscleMassChangeKg ?? undefined, goalCompletionDate: userData.goalCompletionDate ?? undefined, isCourseActive: userData.isCourseActive
    };

    return {
        memberName: userData.displayName, memberProfile: userProfile, last7DaysSummaries,
        last5WeightLogs, currentStreak: userData.currentStreak, lastLogDate: userData.lastLogDate, courseProgressSummary: userData.courseProgressSummary
    };
}

export async function fetchTimelineForCurrentUser(currentUserId: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    const weightLogsRef = collection(db, 'users', currentUserId, 'weightLogs');
    const summariesRef = collection(db, 'users', currentUserId, 'pastDaySummaries');
    const courseProgressRef = collection(db, 'users', currentUserId, 'courseProgress');
    const userDocRef = doc(db, 'users', currentUserId);
    const timelineEventsRef = collection(db, 'users', currentUserId, 'timelineEvents');

    const emptySnap = { docs: [], empty: true, size: 0, forEach: () => {} } as any;

    const [weightLogsSnap, summariesSnap, courseProgressSnap, userDocSnap, timelineEventsSnap] = await Promise.all([
        getDocsSafe(query(weightLogsRef, orderBy('loggedAt', 'desc'), limit(20))).catch(err => {
            console.warn(`Timeline: Could not fetch weightLogs for ${currentUserId}. Permission error likely.`, err.message);
            return emptySnap;
        }),
        getDocsSafe(query(summariesRef, orderBy('date', 'desc'))).catch(err => {
            console.warn(`Timeline: Could not fetch pastDaySummaries for ${currentUserId}. Permission error likely.`, err.message);
            return emptySnap;
        }),
        getDocsSafe(courseProgressRef).catch(err => {
            console.warn(`Timeline: Could not fetch courseProgress for ${currentUserId}. Permission error likely.`, err.message);
            return emptySnap;
        }),
        getDocSafe(userDocRef), // This is critical, if it fails, let it throw.
        getDocsSafe(query(timelineEventsRef, orderBy('timestamp', 'desc'), limit(20))).catch(err => {
            console.warn(`Timeline: Could not fetch timelineEvents for ${currentUserId}. Permission error likely.`, err.message);
            return emptySnap;
        })
    ]);
    
    const unlockedAchievements = userDocSnap.data()?.unlockedAchievements || {};

    const logs = weightLogsSnap.docs.map(d => ({id: d.id, ...d.data()}));
    
    const weightEvents: TimelineEvent[] = logs
        .map((currentLog: any, index: number) => {
            if (typeof currentLog.weightKg !== 'number' || typeof currentLog.loggedAt !== 'number') {
                return null;
            }
            const previousLog: any = logs[index + 1];
            
            let weightChange, muscleChange, fatChange;
            if (previousLog && typeof previousLog.weightKg === 'number') {
                weightChange = currentLog.weightKg - previousLog.weightKg;
                
                if (typeof currentLog.skeletalMuscleMassKg === 'number' && typeof previousLog.skeletalMuscleMassKg === 'number') {
                    muscleChange = currentLog.skeletalMuscleMassKg - previousLog.skeletalMuscleMassKg;
                }
                if (typeof currentLog.bodyFatMassKg === 'number' && typeof previousLog.bodyFatMassKg === 'number') {
                    fatChange = currentLog.bodyFatMassKg - previousLog.bodyFatMassKg;
                }
            }
            
            const descriptionParts = [];
            descriptionParts.push(`Vikt: ${currentLog.weightKg.toFixed(1)}kg (${formatChange(weightChange, true)})`);
            if(currentLog.skeletalMuscleMassKg != null) {
                descriptionParts.push(`Muskler: ${currentLog.skeletalMuscleMassKg.toFixed(1)}kg (${formatChange(muscleChange)})`);
            }
            if(currentLog.bodyFatMassKg != null) {
                 descriptionParts.push(`Fett: ${currentLog.bodyFatMassKg.toFixed(1)}kg (${formatChange(fatChange, true)})`);
            }
    
            return {
                id: `w_${currentLog.id}`, type: 'weight', timestamp: currentLog.loggedAt,
                title: `Ny mätning loggad`,
                description: descriptionParts.join(' | '),
                icon: '⚖️', pepps: currentLog.pepps || {}, peppedByCurrentUser: !!(currentLog.pepps && currentLog.pepps[currentUserId]), relatedDocId: currentLog.id
            };
        })
        .filter((e): e is TimelineEvent => e !== null);


    const achievementEvents: TimelineEvent[] = Object.keys(unlockedAchievements).map(achId => {
        const achievementDef = achievements.find(a => a.id === achId);
        if (!achievementDef) return null;
        return {
            id: `a_${achId}`, type: 'achievement', timestamp: new Date(unlockedAchievements[achId]).getTime(),
            title: `Bragd: ${achievementDef.name}`, description: achievementDef.description,
            icon: achievementDef.icon, pepps: {}, peppedByCurrentUser: false, relatedDocId: achId
        };
    }).filter(e => e !== null) as TimelineEvent[];

    const allSummaries = summariesSnap.docs.map(d => ({...d.data(), id: d.id}) as PastDaySummary & {id: string});

    const streakEvents: TimelineEvent[] = allSummaries.filter(data => data.goalMet && data.streakForThisDay && data.streakForThisDay > 0)
    .map(data => ({
        id: `s_${data.date}`,
        type: 'streak',
        timestamp: new Date(data.date + 'T23:59:59').getTime(),
        title: `+1 Dag Streak!`,
        description: `Ny streak: ${data.streakForThisDay} dagar i följd.`,
        icon: '🔥',
        pepps: data.pepps || {},
        peppedByCurrentUser: !!(data.pepps && data.pepps[currentUserId]),
        relatedDocId: data.id
    }));

    const courseEvents: TimelineEvent[] = courseProgressSnap.docs.map(doc => {
        const progress = doc.data() as UserLessonProgress;
        const lesson = courseLessons.find(l => l.id === doc.id);
        if (!progress.unlockedAt || !lesson) return null;

        return {
            id: `c_${lesson.id}`,
            type: 'course',
            timestamp: progress.unlockedAt,
            title: `Lektion Upplåst: ${lesson.title}`,
            description: `Du har låst upp en ny lektion i kursen "Praktisk Viktkontroll".`,
            icon: '🎓',
            pepps: {}, // Pepps on lessons not supported yet
            peppedByCurrentUser: false,
            relatedDocId: lesson.id
        };
    }).filter(e => e !== null) as TimelineEvent[];

    const levelEvents: TimelineEvent[] = [];
    const sortedSummariesForLevels = [...allSummaries].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (let i = 0; i < sortedSummariesForLevels.length; i++) {
        const currentSummary = sortedSummariesForLevels[i];
        const previousStreak = i > 0 ? sortedSummariesForLevels[i-1].streakForThisDay || 0 : 0;
        const currentStreak = currentSummary.streakForThisDay || 0;

        LEVEL_DEFINITIONS.forEach(level => {
            if (level.requiredStreak > 0 && currentStreak >= level.requiredStreak && previousStreak < level.requiredStreak) {
                levelEvents.push({
                    id: `l_${currentSummary.date}_${level.id}`,
                    type: 'level',
                    timestamp: new Date(currentSummary.date + 'T23:59:58').getTime(), // Slightly before streak event
                    title: `Nivå Upp: ${level.name}`,
                    description: level.description,
                    icon: level.icon,
                    pepps: {},
                    peppedByCurrentUser: false,
                    relatedDocId: level.id
                });
            }
        });
    }

    const goalEvents: TimelineEvent[] = timelineEventsSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            type: data.type,
            timestamp: data.timestamp,
            title: data.title,
            description: data.description,
            icon: data.icon,
            pepps: data.pepps || {},
            peppedByCurrentUser: !!(data.pepps && data.pepps[currentUserId]),
            relatedDocId: data.relatedDocId
        } as TimelineEvent;
    });


    const allEvents = [...weightEvents, ...achievementEvents, ...streakEvents, ...courseEvents, ...levelEvents, ...goalEvents];
    allEvents.sort((a, b) => b.timestamp - a.timestamp);
    return allEvents;
}

export async function fetchTimelineForBuddy(buddyUid: string, currentUserId: string, achievements: Achievement[]): Promise<TimelineEvent[]> {
    const events = await fetchTimelineForCurrentUser(buddyUid, achievements);
    events.forEach(event => { event.peppedByCurrentUser = !!event.pepps[currentUserId]; });
    return events;
}

export async function addTimelineEvent(userId: string, eventData: Omit<TimelineEvent, 'id' | 'peppedByCurrentUser'>): Promise<string> {
    const timelineCollectionRef = collection(db, 'users', userId, 'timelineEvents');
    const docRef = await addDoc(timelineCollectionRef, eventData);
    return docRef.id;
}

export async function addPepp(fromUser: { uid: string, name: string }, toUserUid: string, dateString: string): Promise<void> {
    const summaryRef = doc(db, 'users', toUserUid, 'pastDaySummaries', dateString);
    await updateDoc(summaryRef, {
      [`pepps.${fromUser.uid}`]: { name: fromUser.name, timestamp: Date.now() }
    });
}
  
export async function updateUserSearchableStatus(userId: string, isSearchable: boolean): Promise<boolean> {
    await updateDoc(doc(db, 'users', userId), { isSearchable });
    return isSearchable;
}

export async function searchForBuddies(currentUserId: string): Promise<Peppkompis[]> {
    const q = query(collection(db, 'users'), where('isSearchable', '==', true));
    const snapshot = await getDocsSafe(q);
    
    const users: Peppkompis[] = [];
    snapshot.forEach(userDoc => {
        if (userDoc.id !== currentUserId) {
            const userData = userDoc.data() as FirestoreUserDocument;
            users.push({
                uid: userDoc.id,
                name: userData.displayName,
                email: userData.email || '',
                photoURL: userData.photoURL || undefined,
                gender: userData.gender,
            });
        }
    });
    return users;
}

export async function sendFriendRequest(fromUser: Peppkompis, toUserUid: string): Promise<void> {
    await addDoc(collection(db, 'peppkompisRequests'), {
        fromUid: fromUser.uid,
        fromName: fromUser.name,
        fromEmail: fromUser.email,
        toUid: toUserUid,
        status: 'pending',
        createdAt: serverTimestamp()
    });
}

export async function fetchFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    const q = query(collection(db, 'peppkompisRequests'), where('toUid', '==', userId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);

    const requests = await Promise.all(snapshot.docs.map(async (d) => {
        const requestData = { id: d.id, ...d.data() } as PeppkompisRequest;
        
        // Enrich with the latest display name
        const fromUserDoc = await getDocSafe(doc(db, 'users', requestData.fromUid));
        if (fromUserDoc.exists()) {
            requestData.fromName = fromUserDoc.data().displayName || requestData.fromName;
        }
        
        return requestData;
    }));

    return requests;
}

export async function fetchOutgoingFriendRequests(userId: string): Promise<PeppkompisRequest[]> {
    const q = query(collection(db, 'peppkompisRequests'), where('fromUid', '==', userId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PeppkompisRequest));
}

export async function updateFriendRequestStatus(request: PeppkompisRequest, status: 'accepted' | 'declined'): Promise<void> {
    const requestRef = doc(db, 'peppkompisRequests', request.id);

    if (status === 'accepted') {
        const batch = writeBatch(db);

        // 1. Get the sender's data to create a buddy entry for the current user.
        const fromUserRef = doc(db, 'users', request.fromUid);
        const fromUserSnap = await getDocSafe(fromUserRef);
        if (!fromUserSnap.exists()) {
            throw new Error("Användaren som skickade förfrågan hittades inte.");
        }
        const fromUserData = fromUserSnap.data() as FirestoreUserDocument;
        
        // 2. Add the sender as a buddy to the current user (who is accepting). This is a permitted write.
        const currentUserBuddyRef = doc(db, 'users', request.toUid, 'buddies', request.fromUid);
        batch.set(currentUserBuddyRef, {
            uid: request.fromUid,
            name: fromUserData.displayName || 'En kompis',
            email: fromUserData.email || '',
            photoURL: fromUserData.photoURL || undefined,
            gender: fromUserData.gender || 'female',
        });

        // 3. Update the request status to 'accepted'. This signals the sender's client to complete the process.
        batch.update(requestRef, { status: 'accepted' });
        
        await batch.commit();

    } else { // 'declined'
        // Just delete the request.
        await deleteDoc(requestRef);
    }
}

export function listenForAcceptedRequests(userId: string, callback: (requests: PeppkompisRequest[]) => void): () => void {
    const q = query(collection(db, 'peppkompisRequests'), where('fromUid', '==', userId), where('status', '==', 'accepted'));
    
    return onSnapshot(q, async (snapshot) => {
        const requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PeppkompisRequest));
        if (requests.length > 0) {
            callback(requests);
        }
    });
}

export async function processAcceptedRequest(request: PeppkompisRequest): Promise<string> {
    const batch = writeBatch(db);
    
    const toUserRef = doc(db, 'users', request.toUid);
    const toUserSnap = await getDocSafe(toUserRef);
    if (!toUserSnap.exists()) {
        // If the accepting user doesn't exist anymore, just delete the request.
        const requestRef = doc(db, 'peppkompisRequests', request.id);
        await deleteDoc(requestRef);
        throw new Error("Användaren som accepterade förfrågan hittades inte.");
    }
    const toUserData = toUserSnap.data() as FirestoreUserDocument;

    // This write is performed by the SENDER, so it's to their own subcollection.
    const currentUserBuddyRef = doc(db, 'users', request.fromUid, 'buddies', request.toUid);
    batch.set(currentUserBuddyRef, {
        uid: request.toUid,
        name: toUserData.displayName || 'En kompis',
        email: toUserData.email || '',
        photoURL: toUserData.photoURL || undefined,
        gender: toUserData.gender || 'female',
    });

    // The sender, having processed the 'accepted' status, can now delete the request.
    const requestRef = doc(db, 'peppkompisRequests', request.id);
    batch.delete(requestRef);

    await batch.commit();
    return toUserData.displayName;
}

export async function fetchBuddies(userId: string): Promise<Peppkompis[]> {
    const snapshot = await getDocs(collection(db, 'users', userId, 'buddies'));
    return snapshot.docs.map(doc => doc.data() as Peppkompis);
}

export async function removeBuddy(currentUserId: string, buddyUid: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', currentUserId, 'buddies', buddyUid));
    batch.delete(doc(db, 'users', buddyUid, 'buddies', currentUserId));
    await batch.commit();
}

export async function fetchBuddyDetailsList(userId: string): Promise<BuddyDetails[]> {
    const buddies = await fetchBuddies(userId);
    return Promise.all(buddies.map(async (buddy) => {
        const buddyDoc = await getDoc(doc(db, 'users', buddy.uid));
        if (!buddyDoc.exists()) return null;
        const buddyData = buddyDoc.data() as FirestoreUserDocument;
        
        let latestWeightLog: WeightLogEntry | null = null;
        let firstWeightLog: WeightLogEntry | null = null;
        
        try {
            const lastWeightLogQuery = query(collection(db, 'users', buddy.uid, 'weightLogs'), orderBy('loggedAt', 'desc'), limit(1));
            const firstWeightLogQuery = query(collection(db, 'users', buddy.uid, 'weightLogs'), orderBy('loggedAt', 'asc'), limit(1));

            const [lastWeightLogSnap, firstWeightLogSnap] = await Promise.all([
                getDocsSafe(lastWeightLogQuery),
                getDocsSafe(firstWeightLogQuery)
            ]);
            
            const lastData = lastWeightLogSnap.empty ? null : lastWeightLogSnap.docs[0].data();
            if (lastData && typeof lastData.weightKg === 'number') {
                latestWeightLog = lastData as WeightLogEntry;
            }

            const firstData = firstWeightLogSnap.empty ? null : firstWeightLogSnap.docs[0].data();
            if (firstData && typeof firstData.weightKg === 'number') {
                firstWeightLog = firstData as WeightLogEntry;
            }

        } catch (error) {
            console.warn(`Could not fetch weight logs for buddy ${buddy.uid}. This may be due to Firestore security rules restricting access for non-coach roles.`, error);
        }

        const goalType = buddyData.goalType || 'maintain';
        const goalSummary = `${goalType === 'lose_fat' ? 'Fettminskning' : goalType === 'gain_muscle' ? 'Muskelökning' : 'Bibehålla'}`;

        const startWeight = buddyData.goalStartWeight ?? firstWeightLog?.weightKg;
        const currentWeight = latestWeightLog?.weightKg ?? buddyData.currentWeightKg ?? undefined;
        const totalWeightChange = (startWeight != null && currentWeight != null) ? currentWeight - startWeight : undefined;

        const startMuscleMass = firstWeightLog?.skeletalMuscleMassKg;
        const currentMuscleMass = latestWeightLog?.skeletalMuscleMassKg;
        const muscleMassChange = (startMuscleMass != null && currentMuscleMass != null) ? currentMuscleMass - startMuscleMass : undefined;
        
        const startFatMass = firstWeightLog?.bodyFatMassKg;
        const currentFatMass = latestWeightLog?.bodyFatMassKg;
        const fatMassChange = (startFatMass != null && currentFatMass != null) ? currentFatMass - startFatMass : undefined;
        
        return {
            ...buddy,
            name: buddyData.displayName || 'Okänd användare',
            photoURL: buddyData.photoURL || undefined,
            gender: buddyData.gender || 'female',
            goalSummary: goalSummary,
            currentStreak: buddyData.currentStreak ?? 0,
            unlockedAchievements: buddyData.unlockedAchievements ?? {},
            startWeight,
            currentWeight,
            totalWeightChange,
            currentMuscleMass,
            muscleMassChange,
            currentFatMass,
            fatMassChange,
            measurementMethod: buddyData.measurementMethod || 'inbody',
            desiredWeightChangeKg: buddyData.desiredWeightChangeKg,
            desiredFatMassChangeKg: buddyData.desiredFatMassChangeKg,
            desiredMuscleMassChangeKg: buddyData.desiredMuscleMassChangeKg,
            goalType: goalType,
            mainGoalCompleted: buddyData.mainGoalCompleted ?? false,
            goalStartWeight: buddyData.goalStartWeight,
        };
    })).then(results => results.filter(b => b !== null) as BuddyDetails[]);
}

export async function fetchBuddyDailyData(buddyId: string, dateUID: string): Promise<any> {
    const [buddyDoc, meals, water] = await Promise.all([
        getDoc(doc(db, 'users', buddyId)),
        fetchMealLogsForDate(buddyId, dateUID),
        fetchWaterLog(buddyId, dateUID)
    ]);
    const buddyData = buddyDoc.data();
    return {
        meals, water, goals: buddyData?.goals, profile: { name: buddyData?.displayName }
    };
}

export async function fetchAchievementInteractions(userId: string): Promise<any> {
    const interactionsRef = collection(db, 'users', userId, 'achievementInteractions');
    const snapshot = await getDocsSafe(interactionsRef);
    const interactions: { [achievementId: string]: any } = {};
    snapshot.forEach(doc => {
        interactions[doc.id] = doc.data();
    });
    return interactions;
}

export async function addPeppToWeightLog(fromUid: string, fromName: string, toUserUid: string, weightLogId: string): Promise<void> {
    const logRef = doc(db, 'users', toUserUid, 'weightLogs', weightLogId);
    await updateDoc(logRef, { [`pepps.${fromUid}`]: { name: fromName, timestamp: Date.now() } });
}
  
export async function removePeppFromWeightLog(fromUid: string, toUserUid: string, weightLogId: string): Promise<void> {
    const logRef = doc(db, 'users', toUserUid, 'weightLogs', weightLogId);
    await updateDoc(logRef, { [`pepps.${fromUid}`]: deleteField() });
}

export async function addPeppToAchievement(fromUid: string, fromName: string, toUserUid: string, achievementId: string): Promise<void> {
    const interactionRef = doc(db, 'users', toUserUid, 'achievementInteractions', achievementId);
    await setDoc(interactionRef, { 
        pepps: { [fromUid]: { name: fromName, timestamp: Date.now() } } 
    }, { merge: true });
}

export async function removePeppFromAchievement(fromUid: string, toUserUid: string, achievementId: string): Promise<void> {
    const interactionRef = doc(db, 'users', toUserUid, 'achievementInteractions', achievementId);
    await updateDoc(interactionRef, { 
        [`pepps.${fromUid}`]: deleteField() 
    });
}

export function getChatId(user1: string, user2: string): string {
    return [user1, user2].sort().join('_');
}

export function listenForChats(userId: string, callback: (chats: Chat[]) => void): () => void {
    const q = query(collection(db, 'chats'), where('participantUids', 'array-contains', userId));
    return onSnapshot(q, snapshot => {
        const chats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Chat));
        callback(chats);
    });
}

export async function sendMessage(chatId: string, senderId: string, participants: Peppkompis[], text: string, imageDataUrl?: string): Promise<void> {
    const batch = writeBatch(db);
    const chatRef = doc(db, 'chats', chatId);
    const messageRef = doc(collection(chatRef, 'messages'));

    const messagePayload: { senderId: string, text: string, timestamp: any, imageDataUrl?: string } = {
        senderId,
        text: text || "",
        timestamp: serverTimestamp()
    };
    if (imageDataUrl) {
        messagePayload.imageDataUrl = imageDataUrl;
    }
    batch.set(messageRef, messagePayload);

    const otherParticipantId = participants.find(p => p.uid !== senderId)?.uid;
    const updatePayload: any = {
        lastMessage: { text: text || "📷 Bild", senderId, timestamp: serverTimestamp() },
        participants,
        participantUids: participants.map(p => p.uid)
    };
    if (otherParticipantId) {
        updatePayload[`unreadCounts.${otherParticipantId}`] = increment(1);
    }
    
    batch.set(chatRef, updatePayload, { merge: true });

    await batch.commit();
}

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
    await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
}

export function listenForMessages(chatId: string, callback: (messages: ChatMessage[]) => void): () => void {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    return onSnapshot(q, snapshot => {
        const messages = snapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                timestamp: (data.timestamp as Timestamp)?.toDate().getTime() || Date.now()
            } as ChatMessage;
        });
        callback(messages);
    });
}

export async function toggleMessageLike(chatId: string, messageId: string, userId: string) {
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    const msgSnap = await getDoc(msgRef);
    if(msgSnap.exists()){
        const likes = msgSnap.data().likes || {};
        if(likes[userId]){
            await updateDoc(msgRef, {[`likes.${userId}`]: deleteField() });
        } else {
            await updateDoc(msgRef, {[`likes.${userId}`]: true});
        }
    }
}

export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, 'chats', chatId), { [`unreadCounts.${userId}`]: 0 });
}