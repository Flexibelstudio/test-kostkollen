import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, updateDoc, onSnapshot, serverTimestamp, collectionGroup, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { BootcampCohort, BootcampParticipant, EveningReport } from '../types';

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

export const joinSoloBootcamp = async (userId: string): Promise<{ success: boolean; message: string }> => {
  if (!db) throw new Error("Firestore not initialized");

  // Check if already joined any bootcamp
  const participantRef = doc(db, 'bootcampCohorts', 'solo', 'participants', userId);
  const participantSnap = await getDoc(participantRef);

  if (participantSnap.exists()) {
    return { success: false, message: 'Du är redan med i ett Bootcamp.' };
  }

  // Add participant
  const participantData: BootcampParticipant = {
    userId,
    cohortId: 'solo', // Special ID for solo participants
    status: 'fas1',
    currentStreak: 0,
    longestStreak: 0,
    fas1StartDate: new Date().toISOString().split('T')[0], // Starts today
    needsCoachAttention: false,
    joinedAt: Date.now(),
  };

  await setDoc(participantRef, participantData);

  return { 
    success: true, 
    message: 'Välkommen till Bootcampet, rekryt! Din första dag börjar nu.' 
  };
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
    return { success: false, message: 'Du är redan med i denna trupp.' };
  }

  // Add participant
  const participantData: BootcampParticipant = {
    userId,
    cohortId: cohort.id,
    status: 'fas1',
    currentStreak: 0,
    longestStreak: 0,
    fas1StartDate: cohort.startDate, // Initial start date
    needsCoachAttention: false,
    joinedAt: Date.now(),
  };

  await setDoc(participantRef, participantData);

  return { 
    success: true, 
    message: 'Välkommen till truppen, rekryt!', 
    cohortId: cohort.id,
    chatGroupId: cohort.chatGroupId 
  };
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

export const getUserActiveBootcamp = async (userId: string): Promise<BootcampParticipant | null> => {
  if (!db) return null;

  try {
    const q = query(collectionGroup(db, 'participants'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    // Return the first active one (assuming user can only be in one at a time)
    return snapshot.docs[0].data() as BootcampParticipant;
  } catch (error) {
    console.error("Error fetching user bootcamp:", error);
    return null;
  }
};

export const subscribeToUserEveningReports = (cohortId: string, userId: string, callback: (reports: EveningReport[]) => void) => {
  if (!db) return () => {};

  const q = query(
    collection(db, 'bootcampCohorts', cohortId, 'participants', userId, 'eveningReports'),
    orderBy('date', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map(doc => doc.data() as EveningReport);
    callback(reports);
  });
};

export const submitEveningReport = async (
  cohortId: string,
  userId: string,
  report: Omit<EveningReport, 'createdAt'>
) => {
  if (!db) throw new Error("Firestore not initialized");

  const reportData: EveningReport = {
    ...report,
    createdAt: Date.now(),
  };

  const reportRef = doc(db, 'bootcampCohorts', cohortId, 'participants', userId, 'eveningReports', report.date);
  await setDoc(reportRef, reportData);
  
  // Update participant streak
  const participantRef = doc(db, 'bootcampCohorts', cohortId, 'participants', userId);
  const participantSnap = await getDoc(participantRef);
  
  if (participantSnap.exists()) {
    const participant = participantSnap.data() as BootcampParticipant;
    let newStreak = participant.currentStreak;
    let newLongest = participant.longestStreak;
    let newStatus = participant.status;
    let needsAttention = participant.needsCoachAttention;
    let attentionReason = participant.attentionReason;

    if (report.isGreenDay) {
      newStreak += 1;
      if (newStreak > newLongest) {
        newLongest = newStreak;
      }
      // Check if they unlock phase 2 (14 days)
      if (newStreak >= 14 && participant.status === 'fas1') {
        newStatus = 'fas2';
      }
    } else {
      newStreak = 0;
      needsAttention = true;
      attentionReason = 'Bröt sin streak (Röd dag)';
    }

    await updateDoc(participantRef, {
      currentStreak: newStreak,
      longestStreak: newLongest,
      status: newStatus,
      needsCoachAttention: needsAttention,
      attentionReason: attentionReason
    });
  }
};
