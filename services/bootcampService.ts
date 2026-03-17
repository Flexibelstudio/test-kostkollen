import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { BootcampCohort, BootcampParticipant, EveningReport } from '../types';

// --- Cohort Management ---

export const createCohort = async (
  name: string,
  inviteCode: string,
  startDate: string,
  chatGroupId: string,
  coachId: string
): Promise<string> => {
  if (!db) throw new Error("Firestore not initialized");

  const cohortData: Omit<BootcampCohort, 'id'> = {
    name,
    inviteCode: inviteCode.toUpperCase(),
    startDate,
    chatGroupId,
    status: 'upcoming',
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

// --- Participant Management ---

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
  
  // Here we would also trigger the logic to check if it's a "Green Day"
  // and update the participant's streak/status accordingly.
  // For now, we just save the report.
};
