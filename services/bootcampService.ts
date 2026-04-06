import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, updateDoc, onSnapshot, serverTimestamp, collectionGroup, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { BootcampCohort, BootcampParticipant, EveningReport, BootcampPost, BootcampComment, Gender } from '../types';
import { getDateUID } from '../utils/dateUtils';

// --- Cohort Management ---

export const createCohort = async (
  name: string,
  inviteCode: string,
  startDate: string,
  chatGroupId: string,
  coachId: string,
  isPublic: boolean
): Promise<string> => {
  if (!db) throw new Error("Firestore not initialized");

  const cohortData: Omit<BootcampCohort, 'id'> = {
    name,
    inviteCode: inviteCode.toUpperCase(),
    startDate,
    chatGroupId,
    status: 'upcoming',
    isPublic,
    createdAt: Date.now(),
    createdBy: coachId,
  };

  const docRef = await addDoc(collection(db, 'bootcampCohorts'), cohortData);
  return docRef.id;
};

export const subscribeToCohorts = (callback: (cohorts: BootcampCohort[]) => void) => {
  if (!db) return () => {};
  
  const q = query(collection(db, 'bootcampCohorts'));
  return onSnapshot(q, (snapshot) => {
    const cohorts: BootcampCohort[] = [];
    snapshot.forEach(doc => {
      cohorts.push({ id: doc.id, ...doc.data() } as BootcampCohort);
    });
    // Sort by start date descending
    cohorts.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    callback(cohorts);
  });
};

export const subscribeToPublicCohorts = (callback: (cohorts: BootcampCohort[]) => void) => {
  if (!db) return () => {};
  
  const q = query(collection(db, 'bootcampCohorts'), where('isPublic', '==', true), where('status', '==', 'upcoming'));
  return onSnapshot(q, (snapshot) => {
    const cohorts: BootcampCohort[] = [];
    snapshot.forEach(doc => {
      cohorts.push({ id: doc.id, ...doc.data() } as BootcampCohort);
    });
    // Sort by start date ascending (closest first)
    cohorts.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    callback(cohorts);
  });
};

// --- Participant Management ---

export const updateCohort = async (cohortId: string, updates: Partial<BootcampCohort>): Promise<void> => {
  if (!db) throw new Error("Firestore not initialized");
  const cohortRef = doc(db, 'bootcampCohorts', cohortId);
  await updateDoc(cohortRef, updates);
};

export const deleteCohort = async (cohortId: string): Promise<void> => {
  if (!db) throw new Error("Firestore not initialized");
  const cohortRef = doc(db, 'bootcampCohorts', cohortId);
  await deleteDoc(cohortRef);
};

export const joinSoloBootcamp = async (userId: string): Promise<{ success: boolean; message: string }> => {
  if (!db) throw new Error("Firestore not initialized");

  // Check if already joined any bootcamp
  const participantRef = doc(db, 'bootcampCohorts', 'solo', 'participants', userId);
  const participantSnap = await getDoc(participantRef);

  if (participantSnap.exists()) {
    const data = participantSnap.data() as BootcampParticipant;
    if (data.status === 'fas1' || data.status === 'fas2') {
      return { success: false, message: 'Du är redan med i ett Bootcamp.' };
    }
    // If status is 'dropped' or 'completed', they can restart. We will update the document.
  }

  // Add or update participant
  const startDateStr = new Date().toISOString().split('T')[0];
  const participantData: Partial<BootcampParticipant> = {
    userId,
    cohortId: 'solo', // Special ID for solo participants
    status: 'fas1',
    currentStreak: 0,
    longestStreak: 0,
    fas1StartDate: startDateStr, // Starts today
    originalStartDate: startDateStr, // Absolute start date
    needsCoachAttention: false,
    joinedAt: Date.now(),
    bootcampOnboardingCompleted: false,
  };

  await setDoc(participantRef, participantData, { merge: true });

  try {
    const { addTimelineEvent } = await import('./firestoreService');
    await addTimelineEvent(userId, {
      type: 'achievement',
      timestamp: Date.now(),
      title: 'har mönstrat in till Bootcamp!',
      description: 'Har antagit utmaningen och startat General Börjes Bootcamp (Solo).',
      icon: '🪖',
      relatedDocId: `bootcamp_join_solo_${Date.now()}`
    });
  } catch (e) {
    console.error("Failed to create bootcamp join timeline event", e);
  }

  return { 
    success: true, 
    message: 'Välkommen till Bootcampet, rekryt! Din första dag börjar nu.' 
  };
};

export const completeBootcampOnboarding = async (userId: string, cohortId: string): Promise<void> => {
  if (!db) throw new Error("Firestore not initialized");
  const participantRef = doc(db, 'bootcampCohorts', cohortId, 'participants', userId);
  
  const participantSnap = await getDoc(participantRef);
  if (!participantSnap.exists()) return;

  const data = participantSnap.data() as BootcampParticipant;
  
  const updates: Partial<BootcampParticipant> = {
    bootcampOnboardingCompleted: true
  };

  // If solo, start the 12 weeks from today
  if (cohortId === 'solo') {
    const startDateStr = new Date().toISOString().split('T')[0];
    updates.fas1StartDate = startDateStr;
    updates.originalStartDate = startDateStr;
  }

  await updateDoc(participantRef, updates);
};

export const joinCohort = async (userId: string, inviteCode: string): Promise<{ success: boolean; message: string; cohortId?: string; chatGroupId?: string }> => {
  if (!db) throw new Error("Firestore not initialized");

  // Find cohort by invite code
  const q = query(collection(db, 'bootcampCohorts'), where('inviteCode', '==', inviteCode.toUpperCase()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { success: false, message: 'Ogiltig inbjudningskod.' };
  }

  const cohortDoc = snapshot.docs[0];
  const cohort = { id: cohortDoc.id, ...cohortDoc.data() } as BootcampCohort;

  // Check if already joined
  const participantRef = doc(db, 'bootcampCohorts', cohort.id, 'participants', userId);
  const participantSnap = await getDoc(participantRef);

  if (participantSnap.exists()) {
    const data = participantSnap.data() as BootcampParticipant;
    if (data.status === 'fas1' || data.status === 'fas2') {
      return { success: false, message: 'Du är redan med i denna trupp.' };
    }
  }

  // Add or update participant
  const participantData: Partial<BootcampParticipant> = {
    userId,
    cohortId: cohort.id,
    status: 'fas1',
    currentStreak: 0,
    longestStreak: 0,
    fas1StartDate: cohort.startDate, // Initial start date
    originalStartDate: cohort.startDate, // Absolute start date
    needsCoachAttention: false,
    joinedAt: Date.now(),
    bootcampOnboardingCompleted: false,
  };

  await setDoc(participantRef, participantData, { merge: true });

  try {
    const { addTimelineEvent } = await import('./firestoreService');
    await addTimelineEvent(userId, {
      type: 'achievement',
      timestamp: Date.now(),
      title: 'har mönstrat in till Bootcamp!',
      description: `Har antagit utmaningen och anslutit sig till truppen: ${cohort.name}.`,
      icon: '🪖',
      relatedDocId: `bootcamp_join_${cohort.id}_${Date.now()}`
    });
  } catch (e) {
    console.error("Failed to create bootcamp join timeline event", e);
  }

  return { 
    success: true, 
    message: 'Välkommen till truppen, rekryt!', 
    cohortId: cohort.id,
    chatGroupId: cohort.chatGroupId 
  };
};

export const fetchAllBootcampParticipants = async (): Promise<BootcampParticipant[]> => {
  if (!db) return [];
  const q = query(collectionGroup(db, 'participants'));
  const snapshot = await getDocs(q);
  const participants: BootcampParticipant[] = [];
  snapshot.forEach(doc => {
    participants.push(doc.data() as BootcampParticipant);
  });
  return participants;
};

export const subscribeToAllBootcampParticipants = (callback: (participants: BootcampParticipant[]) => void) => {
  if (!db) return () => {};
  
  const q = query(collectionGroup(db, 'participants'));
  return onSnapshot(q, (snapshot) => {
    const participants: BootcampParticipant[] = [];
    snapshot.forEach(doc => {
      participants.push(doc.data() as BootcampParticipant);
    });
    callback(participants);
  });
};

export const subscribeToCohortParticipants = (cohortId: string, callback: (participants: BootcampParticipant[]) => void) => {
  if (!db) return () => {};
  
  const q = query(collection(db, 'bootcampCohorts', cohortId, 'participants'));
  return onSnapshot(q, (snapshot) => {
    const participants: BootcampParticipant[] = [];
    snapshot.forEach(doc => {
      participants.push(doc.data() as BootcampParticipant);
    });
    callback(participants);
  });
};

// --- Evening Reports ---

export const abortBootcamp = async (userId: string, cohortId: string): Promise<void> => {
  if (!db) throw new Error("Firestore not initialized");
  const participantRef = doc(db, 'bootcampCohorts', cohortId, 'participants', userId);
  await updateDoc(participantRef, { status: 'dropped', endedAt: Date.now() });
};

const checkBootcampExpiration = async (participant: BootcampParticipant): Promise<BootcampParticipant> => {
  if (!db || (participant.status !== 'fas1' && participant.status !== 'fas2')) {
    return participant;
  }
  
  const startDateStr = participant.originalStartDate || participant.fas1StartDate;
  if (!startDateStr) return participant;

  const startDate = new Date(startDateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 84) { // 12 weeks
    const participantRef = doc(db, 'bootcampCohorts', participant.cohortId, 'participants', participant.userId);
    await updateDoc(participantRef, { status: 'completed', endedAt: Date.now() });
    
    // Also update the user's profile to indicate they have completed a bootcamp
    const userRef = doc(db, 'users', participant.userId);
    await updateDoc(userRef, { hasCompletedBootcamp: true });
    
    // Create a timeline event for completing the bootcamp
    try {
      const { addTimelineEvent } = await import('./firestoreService');
      await addTimelineEvent(participant.userId, {
        type: 'achievement',
        timestamp: Date.now(),
        title: 'har slutfört General Börjes Bootcamp!',
        description: `Klarade 12 veckor och uppnådde graden ${participant.longestStreak >= 80 ? 'General' : participant.longestStreak >= 65 ? 'Major' : participant.longestStreak >= 50 ? 'Kapten' : participant.longestStreak >= 35 ? 'Löjtnant' : participant.longestStreak >= 25 ? 'Fänrik' : participant.longestStreak >= 14 ? 'Sergeant' : participant.longestStreak >= 7 ? 'Korpral' : 'Soldat'}!`,
        icon: '🎖️',
        relatedDocId: participant.cohortId
      });
    } catch (e) {
      console.error("Failed to create bootcamp completion timeline event", e);
    }

    return { ...participant, status: 'completed' };
  }

  return participant;
};

export const cleanupExpiredBootcampGroups = async (userId: string): Promise<void> => {
  if (!db) return;
  try {
    const q = query(collectionGroup(db, 'participants'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;
    
    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    for (const docSnap of snapshot.docs) {
      const participant = docSnap.data() as BootcampParticipant;
      
      if ((participant.status === 'completed' || participant.status === 'dropped') && participant.endedAt) {
        if (now - participant.endedAt > THREE_DAYS_MS) {
          // Remove from chat group
          try {
            const { removeMemberFromChat } = await import('./chatService');
            // The chat ID is usually the cohortId
            await removeMemberFromChat(participant.cohortId, userId);
            
            // Optionally, mark as expired so we don't keep trying to remove them
            await updateDoc(docSnap.ref, { status: 'expired' });
          } catch (e) {
            console.error(`Failed to remove user ${userId} from chat ${participant.cohortId}`, e);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error cleaning up expired bootcamp groups:", error);
  }
};

export const getUserActiveBootcamp = async (userId: string): Promise<BootcampParticipant | null> => {
  if (!db) return null;

  try {
    const q = query(collectionGroup(db, 'participants'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    // Return the first active one (assuming user can only be in one at a time)
    const activeParticipant = snapshot.docs.map(doc => doc.data() as BootcampParticipant).find(p => p.status === 'fas1' || p.status === 'fas2');
    
    if (activeParticipant) {
      const checkedParticipant = await checkBootcampExpiration(activeParticipant);
      if (checkedParticipant.status === 'fas1' || checkedParticipant.status === 'fas2') {
        return checkedParticipant;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching user bootcamp:", error);
    return null;
  }
};

export const subscribeToUserActiveBootcamp = (userId: string, callback: (participant: BootcampParticipant | null) => void) => {
  if (!db) {
    callback(null);
    return () => {};
  }

  const q = query(collectionGroup(db, 'participants'), where('userId', '==', userId));
  return onSnapshot(q, async (snapshot) => {
    if (snapshot.empty) {
      callback(null);
    } else {
      const activeParticipant = snapshot.docs.map(doc => doc.data() as BootcampParticipant).find(p => p.status === 'fas1' || p.status === 'fas2');
      if (activeParticipant) {
        const checkedParticipant = await checkBootcampExpiration(activeParticipant);
        if (checkedParticipant.status === 'fas1' || checkedParticipant.status === 'fas2') {
          callback(checkedParticipant);
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  }, (error) => {
    console.error("Error subscribing to user bootcamp:", error);
    callback(null);
  });
};

export const getUnseenBootcampFinale = async (userId: string): Promise<BootcampParticipant | null> => {
  if (!db) return null;
  try {
    const q = query(collectionGroup(db, 'participants'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    // Find a completed bootcamp where finaleSeen is not true
    const unseenFinale = snapshot.docs.map(doc => doc.data() as BootcampParticipant).find(p => p.status === 'completed' && !p.finaleSeen);
    return unseenFinale || null;
  } catch (error) {
    console.error("Error fetching unseen bootcamp finale:", error);
    return null;
  }
};

export const markBootcampFinaleAsSeen = async (cohortId: string, userId: string): Promise<void> => {
  if (!db) return;
  try {
    const participantRef = doc(db, 'bootcampCohorts', cohortId, 'participants', userId);
    await updateDoc(participantRef, { finaleSeen: true });
  } catch (error) {
    console.error("Error marking bootcamp finale as seen:", error);
  }
};

export const subscribeToUserEveningReports = (cohortId: string, userId: string, callback: (reports: EveningReport[]) => void, startDate?: string) => {
  if (!db) return () => {};

  const q = query(
    collection(db, 'bootcampCohorts', cohortId, 'participants', userId, 'eveningReports'),
    orderBy('date', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    let reports = snapshot.docs.map(doc => doc.data() as EveningReport);
    if (startDate) {
      reports = reports.filter(r => r.date >= startDate);
    }
    callback(reports);
  });
};

export const getEveningReportForDate = async (cohortId: string, userId: string, date: string): Promise<EveningReport | null> => {
  if (!db) return null;
  try {
    const q = query(
      collection(db, 'bootcampCohorts', cohortId, 'participants', userId, 'eveningReports'),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].data() as EveningReport;
    }
    return null;
  } catch (error) {
    console.error("Error fetching evening report:", error);
    return null;
  }
};

export const recalculateStreak = async (cohortId: string, userId: string, providedReports?: EveningReport[]) => {
  if (!db) throw new Error("Firestore not initialized");

  const participantRef = doc(db, 'bootcampCohorts', cohortId, 'participants', userId);
  const participantSnap = await getDoc(participantRef);
  
  if (!participantSnap.exists()) return;
  
  const participant = participantSnap.data() as BootcampParticipant;
  const startDate = participant.fas1StartDate;

  let reports = providedReports;
  
  if (!reports) {
    const q = query(
      collection(db, 'bootcampCohorts', cohortId, 'participants', userId, 'eveningReports'),
      orderBy('date', 'desc')
    );
    
    const snapshot = await getDocs(q);
    reports = snapshot.docs.map(doc => doc.data() as EveningReport);
  }

  // Filter reports to only include those on or after the current attempt's start date
  if (startDate) {
    reports = reports.filter(r => r.date >= startDate);
  }
  
  let currentStreak = 0;
  let longestStreak = 0;
  let currentTempStreak = 0;
  let lastDateStr = '';

  // Calculate longest streak
  // We iterate from oldest to newest to calculate longest streak correctly
  const ascendingReports = [...reports].reverse();
  for (const report of ascendingReports) {
    if (report.isGreenDay) {
      if (lastDateStr === '') {
        currentTempStreak = 1;
      } else {
        const d = new Date(report.date);
        d.setDate(d.getDate() - 1);
        const expectedPrevDate = getDateUID(d);
        if (lastDateStr === expectedPrevDate) {
          currentTempStreak++;
        } else {
          currentTempStreak = 1; // Reset if not consecutive
        }
      }
      if (currentTempStreak > longestStreak) {
        longestStreak = currentTempStreak;
      }
      lastDateStr = report.date;
    } else {
      currentTempStreak = 0;
      lastDateStr = '';
    }
  }

  // Calculate current streak
  // We iterate from newest to oldest. We only count consecutive green days starting from today or yesterday.
  const today = new Date();
  const todayStr = getDateUID(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getDateUID(yesterday);

  let expectedDateStr = '';
  
  for (const report of reports) {
    if (expectedDateStr === '') {
      // First iteration, streak must start today or yesterday
      if (report.date === todayStr || report.date === yesterdayStr) {
        if (report.isGreenDay) {
          currentStreak++;
          // Next expected date is the day before this report
          const d = new Date(report.date);
          d.setDate(d.getDate() - 1);
          expectedDateStr = getDateUID(d);
        } else {
          break; // Streak broken immediately
        }
      } else {
        break; // Streak is broken (no report for today or yesterday)
      }
    } else {
      // Subsequent iterations, must match expected date
      if (report.date === expectedDateStr) {
        if (report.isGreenDay) {
          currentStreak++;
          const d = new Date(report.date);
          d.setDate(d.getDate() - 1);
          expectedDateStr = getDateUID(d);
        } else {
          break; // Streak broken by a red day
        }
      } else {
        break; // Streak broken by a missing day
      }
    }
  }

  if (participantSnap.exists()) {
    // participant is already defined at the top of the function
    let newStatus = participant.status;
    let needsAttention = participant.needsCoachAttention;
    let attentionReason = participant.attentionReason;

    if (currentStreak >= 14 && participant.status === 'fas1') {
      newStatus = 'fas2';
      
      // Create a timeline event for reaching Phase 2
      try {
        const { addTimelineEvent } = await import('./firestoreService');
        await addTimelineEvent(userId, {
          type: 'achievement',
          timestamp: Date.now(),
          title: 'har nått Fas 2 i Generalens Bootcamp!',
          description: 'Överlevde grundträningen och är nu redo för Elit-fasen.',
          icon: '🔥',
          relatedDocId: `bootcamp_${cohortId}_fas2`
        });
      } catch (e) {
        console.error("Failed to create bootcamp fas2 timeline event", e);
      }
    } else if (currentStreak === 0 && reports.length > 0 && !reports[0].isGreenDay) {
      needsAttention = true;
      attentionReason = 'Bröt sin streak (Röd dag)';
    } else if (currentStreak > 0 && attentionReason === 'Bröt sin streak (Röd dag)') {
       needsAttention = false;
       attentionReason = null;
    }

    const newLongestStreak = Math.max(longestStreak, participant.longestStreak);
    
    // Check for rank ups
    if (newLongestStreak > participant.longestStreak) {
      const ranks = [
        { name: 'General', req: 80 },
        { name: 'Major', req: 65 },
        { name: 'Kapten', req: 50 },
        { name: 'Löjtnant', req: 35 },
        { name: 'Fänrik', req: 25 },
        { name: 'Sergeant', req: 14 },
        { name: 'Korpral', req: 7 }
      ];
      
      const oldRank = ranks.find(r => participant.longestStreak >= r.req);
      const newRank = ranks.find(r => newLongestStreak >= r.req);
      
      if (newRank && (!oldRank || newRank.req > oldRank.req)) {
        try {
          const { addTimelineEvent } = await import('./firestoreService');
          await addTimelineEvent(userId, {
            type: 'achievement',
            timestamp: Date.now(),
            title: `har befordrats till ${newRank.name}!`,
            description: `Nådde ${newLongestStreak} dagar i Generalens Bootcamp.`,
            icon: '🎖️',
            relatedDocId: `bootcamp_${cohortId}_rank_${newRank.req}`
          });
        } catch (e) {
          console.error("Failed to create bootcamp rank timeline event", e);
        }
      }
    }

    const updateData: any = {
      currentStreak,
      longestStreak: newLongestStreak,
      status: newStatus,
      needsCoachAttention: needsAttention,
      attentionReason: attentionReason || null
    };

    await updateDoc(participantRef, updateData);

    // Update highestBootcampStreak on user profile if needed
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const currentHighest = userData.highestBootcampStreak || 0;
      if (newLongestStreak > currentHighest) {
        await updateDoc(userRef, { highestBootcampStreak: newLongestStreak });
      }
    }
  }
};

export const submitEveningReport = async (
  cohortId: string,
  userId: string,
  report: Omit<EveningReport, 'createdAt'>,
  userProfile: { name?: string; photoURL?: string }
) => {
  if (!db) throw new Error("Firestore not initialized");

  const reportData: any = {
    ...report,
    createdAt: Date.now(),
  };

  // Firestore does not support undefined values
  Object.keys(reportData).forEach(key => {
    if (reportData[key] === undefined) {
      delete reportData[key];
    }
  });

  const reportRef = doc(db, 'bootcampCohorts', cohortId, 'participants', userId, 'eveningReports', report.date);
  await setDoc(reportRef, reportData);
  
  // Note: We no longer call recalculateStreak here because the onSnapshot listener 
  // in BootcampDashboard will trigger it with the most up-to-date reports, 
  // avoiding race conditions with stale server reads.
};

// --- Bootcamp Feed ---

export const subscribeToBootcampPosts = (cohortId: string, callback: (posts: BootcampPost[]) => void) => {
  const postsRef = collection(db, 'bootcampCohorts', cohortId, 'posts');
  const q = query(postsRef, orderBy('timestamp', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const posts: BootcampPost[] = [];
    snapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as BootcampPost);
    });
    callback(posts);
  });
};

export const createBootcampPost = async (
  cohortId: string,
  authorUid: string,
  authorName: string,
  text: string,
  imageUrl?: string,
  isOfficial?: boolean,
  authorPhotoURL?: string,
  authorGender?: Gender
): Promise<string> => {
  const postsRef = collection(db, 'bootcampCohorts', cohortId, 'posts');
  
  // Fetch user data for streak and goal text
  let streakAtPost = 0;
  let goalTextAtPost = 'Mål: Bibehålla';
  let progressAtPost = 0;
  try {
    const userDocRef = doc(db, 'users', authorUid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data() as any;
      streakAtPost = userData.currentStreak || 0;
      
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
    }
  } catch (e) {
    console.error("Failed to fetch user data for post", e);
  }

  // Fetch bootcamp participant data for bootcamp streak
  let bootcampStreakAtPost: number | undefined = undefined;
  try {
    const participantRef = doc(db, 'bootcampCohorts', cohortId, 'participants', authorUid);
    const participantSnap = await getDoc(participantRef);
    if (participantSnap.exists()) {
      const participantData = participantSnap.data() as any;
      if (participantData.status === 'fas1' || participantData.status === 'fas2') {
          bootcampStreakAtPost = participantData.currentStreak || 0;
      }
    }
  } catch (e) {
    console.error("Failed to fetch bootcamp streak for post", e);
  }

  const newPost: Omit<BootcampPost, 'id'> = {
    cohortId,
    authorUid,
    authorName,
    text,
    timestamp: Date.now(),
    likes: {},
    comments: [],
    streakAtPost,
    bootcampStreakAtPost,
    goalTextAtPost,
    progressAtPost
  };
  if (imageUrl) newPost.imageUrl = imageUrl;
  if (isOfficial !== undefined) newPost.isOfficial = isOfficial;
  if (authorPhotoURL) newPost.authorPhotoURL = authorPhotoURL;
  if (authorGender) newPost.authorGender = authorGender;

  const docRef = await addDoc(postsRef, newPost);
  return docRef.id;
};

export const likeBootcampPost = async (cohortId: string, postId: string, userId: string, userName: string) => {
  const postRef = doc(db, 'bootcampCohorts', cohortId, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const postData = postSnap.data() as BootcampPost;
    const currentLikes = postData.likes || {};
    if (currentLikes[userId]) {
      delete currentLikes[userId];
    } else {
      currentLikes[userId] = userName;
    }
    await updateDoc(postRef, { likes: currentLikes });
  }
};

export const reactToBootcampPost = async (cohortId: string, postId: string, userId: string, userName: string, emoji: string) => {
  const postRef = doc(db, 'bootcampCohorts', cohortId, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const postData = postSnap.data() as BootcampPost;
    const currentReactions = postData.reactions || {};
    
    // Check if user already reacted with this emoji
    const usersWhoReacted = currentReactions[emoji] || {};
    const hasReacted = !!usersWhoReacted[userId];
    
    if (hasReacted) {
      // Remove reaction
      delete currentReactions[emoji][userId];
      // Clean up empty emoji objects
      if (Object.keys(currentReactions[emoji]).length === 0) {
        delete currentReactions[emoji];
      }
    } else {
      // Add reaction
      if (!currentReactions[emoji]) {
        currentReactions[emoji] = {};
      }
      currentReactions[emoji][userId] = userName;
    }
    
    await updateDoc(postRef, { reactions: currentReactions });
  }
};

export const addBootcampComment = async (
  cohortId: string,
  postId: string,
  authorUid: string,
  authorName: string,
  text: string,
  authorPhotoURL?: string,
  authorGender?: Gender
) => {
  const postRef = doc(db, 'bootcampCohorts', cohortId, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const postData = postSnap.data() as BootcampPost;
    const currentComments = postData.comments || [];
    const newComment: BootcampComment = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      authorUid,
      authorName,
      text,
      timestamp: Date.now(),
      likes: {}
    };
    if (authorPhotoURL) newComment.authorPhotoURL = authorPhotoURL;
    if (authorGender) newComment.authorGender = authorGender;
    
    await updateDoc(postRef, { comments: [...currentComments, newComment] });
  }
};

export const likeBootcampComment = async (cohortId: string, postId: string, commentId: string, userId: string, userName: string) => {
  const postRef = doc(db, 'bootcampCohorts', cohortId, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const postData = postSnap.data() as BootcampPost;
    const currentComments = postData.comments || [];
    const commentIndex = currentComments.findIndex(c => c.id === commentId);
    if (commentIndex !== -1) {
      const comment = currentComments[commentIndex];
      const currentLikes = comment.likes || {};
      if (currentLikes[userId]) {
        delete currentLikes[userId];
      } else {
        currentLikes[userId] = userName;
      }
      currentComments[commentIndex] = { ...comment, likes: currentLikes };
      await updateDoc(postRef, { comments: currentComments });
    }
  }
};

export const getBootcampStepGoal = (activityLevel: string, phase: string = 'fas1'): number => {
  let baseSteps = 10000;
  switch (activityLevel) {
    case 'sedentary': baseSteps = 4000; break;
    case 'light': baseSteps = 7000; break;
    case 'moderate': baseSteps = 10000; break;
    case 'active': baseSteps = 12000; break;
    case 'very_active': baseSteps = 14000; break;
    default: baseSteps = 10000;
  }
  
  if (phase === 'fas2' || phase === 'fas3') {
    baseSteps += 2000;
  }
  
  return baseSteps;
};
