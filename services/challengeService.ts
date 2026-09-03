import { db } from "../firebase";
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    updateDoc, 
    deleteDoc, 
    onSnapshot,
    serverTimestamp,
    orderBy
} from "@firebase/firestore";
import type { Challenge, ChallengeParticipant } from "../types";

const TZ = "Europe/Stockholm";
export const getDateUID_SE = (d: Date = new Date()): string => {
  const z = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const y = z.getFullYear();
  const m = String(z.getMonth() + 1).padStart(2, "0");
  const day = String(z.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function getChallengeDates(startDateStr: string): string[] {
  const dates: string[] = [];
  const parts = startDateStr.split('-');
  const start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

// In-memory mock storage if Firestore is not available
let mockChallenges: Challenge[] = [];

/**
 * Creates a new 7-day food logging challenge.
 */
export async function createChallenge(
    creator: { uid: string; name: string; photoURL?: string },
    invitedBuddies: { uid: string; name: string; photoURL?: string }[],
    startDateStr?: string
): Promise<string> {
    const startDate = startDateStr || getDateUID_SE();
    const dates = getChallengeDates(startDate);
    const endDate = dates[6];
    const now = Date.now();
    const challengeId = `challenge_${now}_${Math.random().toString(36).substr(2, 6)}`;

    const initialDailyStatus: { [dateString: string]: boolean } = {};
    dates.forEach(d => { initialDailyStatus[d] = false; });

    const participants: { [uid: string]: ChallengeParticipant } = {
        [creator.uid]: {
            uid: creator.uid,
            name: creator.name || 'Jag',
            photoURL: creator.photoURL,
            joinedAt: now,
            leftAt: null,
            dailyStatus: { ...initialDailyStatus }
        }
    };

    invitedBuddies.forEach(buddy => {
        participants[buddy.uid] = {
            uid: buddy.uid,
            name: buddy.name || 'Kompis',
            photoURL: buddy.photoURL,
            joinedAt: now,
            leftAt: null,
            dailyStatus: { ...initialDailyStatus }
        };
    });

    const participantUids = Object.keys(participants);

    const newChallenge: Challenge = {
        id: challengeId,
        createdBy: creator.uid,
        createdByName: creator.name,
        title: '7-dagars matloggningsutmaning',
        startDate,
        endDate,
        status: 'active',
        participants,
        participantUids,
        createdAt: now,
        updatedAt: now
    };

    if (db) {
        try {
            await setDoc(doc(db, 'challenges', challengeId), newChallenge);
            return challengeId;
        } catch (error) {
            console.error("Error creating challenge in Firestore:", error);
        }
    }

    // Fallback to mock
    mockChallenges.push(newChallenge);
    return challengeId;
}

/**
 * Listens to active challenges for a user.
 */
export function listenToUserChallenges(
    userId: string,
    onUpdate: (challenges: Challenge[]) => void
): () => void {
    if (!db) {
        const userMocks = mockChallenges.filter(c => c.participantUids.includes(userId));
        onUpdate(userMocks);
        return () => {};
    }

    try {
        const q = query(
            collection(db, 'challenges'),
            where('participantUids', 'array-contains', userId)
        );

        return onSnapshot(q, (snapshot) => {
            const challenges: Challenge[] = snapshot.docs.map(docSnap => docSnap.data() as Challenge);
            // Sort by createdAt desc
            challenges.sort((a, b) => b.createdAt - a.createdAt);
            onUpdate(challenges);
        }, (err) => {
            console.error("Error listening to challenges:", err);
            const userMocks = mockChallenges.filter(c => c.participantUids.includes(userId));
            onUpdate(userMocks);
        });
    } catch (e) {
        console.error("Error setting up challenge listener:", e);
        const userMocks = mockChallenges.filter(c => c.participantUids.includes(userId));
        onUpdate(userMocks);
        return () => {};
    }
}

/**
 * Updates a participant's daily status for a specific date in a challenge.
 */
export async function updateParticipantDailyStatus(
    challengeId: string,
    userId: string,
    dateString: string,
    isLogged: boolean
): Promise<void> {
    if (db) {
        try {
            const docRef = doc(db, 'challenges', challengeId);
            await updateDoc(docRef, {
                [`participants.${userId}.dailyStatus.${dateString}`]: isLogged,
                updatedAt: Date.now()
            });
            return;
        } catch (error) {
            console.error("Error updating participant status in Firestore:", error);
        }
    }

    // Mock update
    const challenge = mockChallenges.find(c => c.id === challengeId);
    if (challenge && challenge.participants[userId]) {
        challenge.participants[userId].dailyStatus[dateString] = isLogged;
        challenge.updatedAt = Date.now();
    }
}

/**
 * Allows a user to leave a challenge quietly without showing it to others as a failure.
 */
export async function leaveChallenge(challengeId: string, userId: string): Promise<void> {
    if (db) {
        try {
            const docRef = doc(db, 'challenges', challengeId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as Challenge;
                const updatedUids = (data.participantUids || []).filter(id => id !== userId);
                await updateDoc(docRef, {
                    [`participants.${userId}.leftAt`]: Date.now(),
                    participantUids: updatedUids,
                    updatedAt: Date.now()
                });
            }
            return;
        } catch (error) {
            console.error("Error leaving challenge in Firestore:", error);
        }
    }

    // Mock leave
    const challenge = mockChallenges.find(c => c.id === challengeId);
    if (challenge) {
        if (challenge.participants[userId]) {
            challenge.participants[userId].leftAt = Date.now();
        }
        challenge.participantUids = challenge.participantUids.filter(id => id !== userId);
    }
}

/**
 * Checks and updates logged days for active challenges based on user's logged days.
 */
export async function syncUserChallengeStatus(
    userId: string,
    challenges: Challenge[],
    loggedDates: string[] | Set<string>
): Promise<void> {
    const loggedSet = loggedDates instanceof Set ? loggedDates : new Set(loggedDates);

    for (const challenge of challenges) {
        if (challenge.status !== 'active') continue;
        const participant = challenge.participants[userId];
        if (!participant || participant.leftAt) continue;

        const dates = getChallengeDates(challenge.startDate);
        let updatedAny = false;

        for (const d of dates) {
            const currentVal = participant.dailyStatus?.[d] || false;
            const hasLogged = loggedSet.has(d);
            if (hasLogged !== currentVal) {
                await updateParticipantDailyStatus(challenge.id, userId, d, hasLogged);
                updatedAny = true;
            }
        }
    }
}
