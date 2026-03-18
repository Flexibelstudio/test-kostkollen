import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, updateDoc, onSnapshot, serverTimestamp, collectionGroup, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { BootcampCohort, BootcampParticipant, EveningReport, BootcampPost, BootcampComment } from '../types';

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

export const subscribeToUserActiveBootcamp = (userId: string, callback: (participant: BootcampParticipant | null) => void) => {
  if (!db) {
    callback(null);
    return () => {};
  }

  const q = query(collectionGroup(db, 'participants'), where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
    } else {
      callback(snapshot.docs[0].data() as BootcampParticipant);
    }
  }, (error) => {
    console.error("Error subscribing to user bootcamp:", error);
    callback(null);
  });
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

export const recalculateStreak = async (cohortId: string, userId: string) => {
  if (!db) throw new Error("Firestore not initialized");

  const q = query(
    collection(db, 'bootcampCohorts', cohortId, 'participants', userId, 'eveningReports'),
    orderBy('date', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const reports = snapshot.docs.map(doc => doc.data() as EveningReport);
  
  let currentStreak = 0;
  let longestStreak = 0;
  let currentTempStreak = 0;

  // Calculate longest streak
  // We iterate from oldest to newest to calculate longest streak correctly
  const ascendingReports = [...reports].reverse();
  for (const report of ascendingReports) {
    if (report.isGreenDay) {
      currentTempStreak++;
      if (currentTempStreak > longestStreak) {
        longestStreak = currentTempStreak;
      }
    } else {
      currentTempStreak = 0;
    }
  }

  // Calculate current streak
  // We iterate from newest to oldest. We only count consecutive green days starting from today or yesterday.
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let foundStart = false;
  for (const report of reports) {
    if (!foundStart) {
      // The streak must start from today or yesterday. If the newest report is older than yesterday, streak is 0.
      if (report.date === todayStr || report.date === yesterdayStr) {
        foundStart = true;
      } else {
        break; // Streak is broken
      }
    }

    if (report.isGreenDay) {
      currentStreak++;
    } else {
      break; // Streak broken
    }
  }

  const participantRef = doc(db, 'bootcampCohorts', cohortId, 'participants', userId);
  const participantSnap = await getDoc(participantRef);
  
  if (participantSnap.exists()) {
    const participant = participantSnap.data() as BootcampParticipant;
    let newStatus = participant.status;
    let needsAttention = participant.needsCoachAttention;
    let attentionReason = participant.attentionReason;

    if (currentStreak >= 14 && participant.status === 'fas1') {
      newStatus = 'fas2';
    } else if (currentStreak === 0 && reports.length > 0 && !reports[0].isGreenDay) {
      needsAttention = true;
      attentionReason = 'Bröt sin streak (Röd dag)';
    } else if (currentStreak > 0 && attentionReason === 'Bröt sin streak (Röd dag)') {
       needsAttention = false;
       attentionReason = null;
    }

    const updateData: any = {
      currentStreak,
      longestStreak: Math.max(longestStreak, participant.longestStreak),
      status: newStatus,
      needsCoachAttention: needsAttention,
      attentionReason: attentionReason
    };

    await updateDoc(participantRef, updateData);
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
  
  await recalculateStreak(cohortId, userId);
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
  authorGender?: 'male' | 'female' | 'other'
): Promise<string> => {
  const postsRef = collection(db, 'bootcampCohorts', cohortId, 'posts');
  const newPost: Omit<BootcampPost, 'id'> = {
    cohortId,
    authorUid,
    authorName,
    text,
    timestamp: Date.now(),
    likes: {},
    comments: [],
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
  authorGender?: 'male' | 'female' | 'other'
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
