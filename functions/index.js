const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");
const logger = require("firebase-functions/logger");
const cors = require('cors')({ origin: true });

// --- SÄKER HÄMTNING AV VARIABLER ---
// Denna funktion förhindrar krascher om en miljövariabel saknas i molnet
function getSafeConfig(domain, key) {
    try {
        return functions.config()[domain][key];
    } catch (e) {
        return null;
    }
}

// Initiera Stripe med den hemliga nyckeln (från .env ELLER molnet)
const stripeSecret = process.env.STRIPE_SECRET_KEY || getSafeConfig('stripe', 'secret');
const stripe = require("stripe")(stripeSecret);

admin.initializeApp();
const db = admin.firestore();

// ---- VAPID-nycklar ----
const vapidPublicKey = functions.config().webpush ? functions.config().webpush.public_key : null;
const vapidPrivateKey = functions.config().webpush ? functions.config().webpush.private_key : null;

if (vapidPublicKey && vapidPrivateKey) {
    logger.log("Webpush VAPID keys loaded", {
        publicKeyLength: vapidPublicKey.length,
        privateKeyLength: vapidPrivateKey.length
    });

    try {
        webpush.setVapidDetails(
          "mailto:support@kostloggen.se", 
          vapidPublicKey,
          vapidPrivateKey
        );
    } catch (error) {
        logger.error("VAPID details configuration failed at startup:", error);
    }
} else {
    logger.warn("WEBPUSH keys are not set. Push notifications will be disabled.");
}

// ---- Hjälpfunktioner för pushnotiser ----

async function getCoachAndAdminIds() {
    const coachesSnapshot = await db.collection("users").where("role", "==", "coach").get();
    const adminsSnapshot = await db.collection("users").where("role", "==", "admin").get();

    const coachIds = coachesSnapshot.docs.map((doc) => doc.id);
    const adminIds = adminsSnapshot.docs.map((doc) => doc.id);

    const allIds = new Set([...coachIds, ...adminIds]);
    return Array.from(allIds);
}

async function sendNotificationToUser(userId, payload, notificationType) {
  if (!vapidPrivateKey || !vapidPublicKey) {
      logger.warn(`Skipping notification for ${userId} because WEBPUSH keys are not configured.`);
      return;
  }
  const userDocRef = db.collection("users").doc(userId);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists) return;
  const userData = userDoc.data();

  if (userData.notificationSettings && userData.notificationSettings[notificationType] === false) {
      logger.log(`Skipping notification type '${notificationType}' for user ${userId} due to user settings.`);
      return;
  }

  const subscriptions = userData.pushSubscriptions || [];
  if (subscriptions.length === 0) return;

  const validSubscriptions = [];
  let dirty = false;

  const promises = subscriptions.map((sub) =>
    webpush.sendNotification(sub, JSON.stringify(payload))
      .then(() => {
        validSubscriptions.push(sub);
      })
      .catch((error) => {
        if (error.statusCode === 404 || error.statusCode === 410) {
          logger.warn(`Removing invalid subscription for user ${userId} (Status: ${error.statusCode})`);
          dirty = true;
        } else {
          logger.error(`Error sending notification to user ${userId}:`, { errorBody: error.body });
          validSubscriptions.push(sub);
        }
      })
  );

  await Promise.all(promises);

  if (dirty) {
    await userDocRef.update({ pushSubscriptions: validSubscriptions });
  }
}

// ---- Notis-funktioner ----

exports.onNewUserRegistered = functions.auth.user().onCreate(async (user) => {
    const { email, displayName } = user;
    const name = displayName || email || "En ny användare";

    logger.log(`New user registered: ${name} (${email})`);

    const payload = {
      notification: {
        title: "Ny Medlem! 🎉",
        body: `${name} har registrerat sig och väntar på godkännande.`,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-96x96.png",
        data: { url: "/" }
      }
    };

    const coachIds = await getCoachAndAdminIds();
    if (coachIds.length === 0) return;

    const notificationPromises = coachIds.map((id) => sendNotificationToUser(id, payload, "newEvents"));
    await Promise.all(notificationPromises);
});

exports.onFriendRequestCreated = functions.firestore
  .document("peppkompisRequests/{requestId}")
  .onCreate(async (snapshot) => {
    const request = snapshot.data();
    if (!request) return;

    const payload = {
      notification: {
        title: "Ny peppkompis-förfrågan! 🎉",
        body: `${request.fromName} vill bli din peppkompis!`,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-96x96.png",
        data: { url: "/?view=community&tab=requests" }
      }
    };
    await sendNotificationToUser(request.toUid, payload, "friendRequests");
  });

exports.onTimelineEventCreated = functions.firestore
  .document("communityTimeline/{eventId}")
  .onCreate(async (snapshot) => {
    const event = snapshot.data();
    if (!event) return;

    const buddiesRef = db.collection("users").doc(event.userId).collection("buddies");
    const buddiesSnapshot = await buddiesRef.get();
    if (buddiesSnapshot.empty) return;

    const eventId = snapshot.id;
    const payload = {
      notification: {
        title: "Ny händelse i flödet!",
        body: `${event.userName} ${event.title}`,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-96x96.png",
        data: { url: `/?view=community&highlight=${eventId}` }
      }
    };

    const notificationPromises = buddiesSnapshot.docs.map((doc) => {
      const buddy = doc.data();
      if (buddy.uid !== event.userId) {
        return sendNotificationToUser(buddy.uid, payload, "newEvents");
      }
      return null;
    });
    await Promise.all(notificationPromises);
  });

exports.onCommentCreated = functions.firestore
  .document("communityTimeline/{eventId}/comments/{commentId}")
  .onCreate(async (snapshot, context) => {
    const comment = snapshot.data();
    const eventId = context.params.eventId;
    if (!comment) return;

    const eventRef = db.collection("communityTimeline").doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) return;

    const eventData = eventDoc.data();
    const eventOwnerId = eventData.userId;

    // Get all comments to find all users who have participated
    const commentsSnapshot = await db.collection("communityTimeline").doc(eventId).collection("comments").get();
    const participantIds = new Set();
    
    // Add the post owner
    participantIds.add(eventOwnerId);
    
    // Add all commenters
    commentsSnapshot.docs.forEach(doc => {
        participantIds.add(doc.data().authorUid);
    });

    // Remove the person who just commented
    participantIds.delete(comment.authorUid);

    const payload = {
      notification: {
        title: "Ny kommentar! 💬",
        body: `${comment.authorName} kommenterade på inlägget: "${eventData.title}"`,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-96x96.png",
        data: { url: `/?view=community&highlight=${eventId}` }
      }
    };

    const notificationPromises = Array.from(participantIds).map(userId => {
        return sendNotificationToUser(userId, payload, "comments");
    });

    await Promise.all(notificationPromises);
  });

exports.onUserStreakUpdated = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data() || {};
      const after = change.after.data() || {};
      const userId = context.params.userId;

      const newStreak = after.currentStreak || 0;
      const oldStreak = before.currentStreak || 0;

      if (newStreak === oldStreak || newStreak <= 0) return null;
      
      if (newStreak > oldStreak) {
        const buddiesSnap = await db.collection("users").doc(userId).collection("buddies").get();
        const buddyUids = buddiesSnap.docs.map(d => d.id);
        const visibleTo = [userId, ...buddyUids];

        const dateStr = new Date().toISOString().split('T')[0];
        const eventId = `streak_${userId}_${newStreak}_${dateStr}`;
        const timelineDocRef = db.collection("communityTimeline").doc(eventId);

        const existingDoc = await timelineDocRef.get();
        if (existingDoc.exists) return null;

        // Calculate goal text and progress
        let goalTextAtPost = 'Mål: Bibehålla';
        let progressAtPost = 0;
        
        if (after.measurementMethod === 'scale' && after.desiredWeightChangeKg) {
            goalTextAtPost = `Mål: ${after.desiredWeightChangeKg > 0 ? '+' : ''}${after.desiredWeightChangeKg} kg`;
        } else if (after.measurementMethod === 'inbody') {
            if (after.desiredFatMassChangeKg) goalTextAtPost = `Mål: ${after.desiredFatMassChangeKg} kg fett`;
            else if (after.desiredMuscleMassChangeKg) goalTextAtPost = `Mål: +${after.desiredMuscleMassChangeKg} kg muskler`;
        }

        let goalSummary = "Ej satt";
        if (after.goalType === 'maintain') goalSummary = "Bibehålla";
        else if (after.goalType === 'lose_fat') goalSummary = `${after.desiredFatMassChangeKg || after.desiredWeightChangeKg || ''} kg fett`;
        else if (after.goalType === 'gain_muscle') goalSummary = `${after.desiredMuscleMassChangeKg || after.desiredWeightChangeKg || ''} kg muskler`;

        if (goalTextAtPost === 'Mål: Bibehålla' && goalSummary) {
          goalTextAtPost = goalSummary;
        }

        let currentWeight = after.currentWeightKg;
        let currentFatMass = after.bodyFatMassKg;
        let currentMuscleMass = after.skeletalMuscleMassKg;
        
        try {
          const latestLogSnap = await db.collection('users').doc(userId).collection('weightLogs')
            .orderBy('loggedAt', 'desc').limit(1).get();
          if (!latestLogSnap.empty) {
            const latestLog = latestLogSnap.docs[0].data();
            currentWeight = latestLog.weightKg ?? currentWeight;
            currentFatMass = latestLog.bodyFatMassKg ?? currentFatMass;
            currentMuscleMass = latestLog.skeletalMuscleMassKg ?? currentMuscleMass;
          }
        } catch (e) {
          logger.warn("Could not fetch weight logs for progress calculation", e);
        }

        // Calculate progress
        const isScaleGoal = after.measurementMethod === 'scale';
        const isFatLossGoal = !isScaleGoal && after.desiredFatMassChangeKg && after.desiredFatMassChangeKg < 0;
        const isMuscleGainGoal = !isScaleGoal && after.desiredMuscleMassChangeKg && after.desiredMuscleMassChangeKg > 0;
        
        let start, current, goalChange;
        if (isFatLossGoal) {
            start = after.goalStartFatMassKg || after.goalStartWeight;
            current = currentFatMass || after.currentWeightKg;
            goalChange = after.desiredFatMassChangeKg;
        } else if (isMuscleGainGoal) {
            start = after.goalStartMuscleMassKg || after.goalStartWeight;
            current = currentMuscleMass || after.currentWeightKg;
            goalChange = after.desiredMuscleMassChangeKg;
        } else {
            start = after.goalStartWeight;
            current = currentWeight;
            goalChange = after.desiredWeightChangeKg;
        }
        
        if (start != null && current != null && goalChange) {
            const totalChangeNeeded = Math.abs(goalChange);
            let changeAchieved = goalChange > 0 ? current - start : start - current;
            changeAchieved = Math.max(0, changeAchieved);
            if (totalChangeNeeded < 0.01) {
                progressAtPost = 100;
            } else {
                const progressRaw = (changeAchieved / totalChangeNeeded) * 100;
                progressAtPost = Math.max(0, Math.min(progressRaw, 100));
            }
        }

        // Fetch bootcamp info
        let bootcampStreakAtPost = undefined;
        let bootcampId = undefined;
        try {
          const bootcampSnap = await db.collectionGroup('participants').where('userId', '==', userId).get();
          if (!bootcampSnap.empty) {
            // Find the active one
            const activeParticipant = bootcampSnap.docs.map(d => d.data()).find(p => p.status === 'fas1' || p.status === 'fas2');
            if (activeParticipant) {
              bootcampStreakAtPost = activeParticipant.currentStreak || 0;
              bootcampId = activeParticipant.cohortId;
            }
          }
        } catch (e) {
          logger.warn("Could not fetch bootcamp info for timeline event", e);
        }

        const eventData = {
          type: 'streak',
          timestamp: Date.now(),
          title: 'håller i sin streak! 🔥',
          description: `Har nu loggat ${newStreak} ${newStreak === 1 ? 'dag' : 'dagar'} i rad!`,
          icon: '🔥',
          userId: userId,
          userName: after.displayName || 'En användare',
          userPhotoURL: after.photoURL || null,
          gender: after.gender || 'female',
          visibleTo: visibleTo,
          reactions: {},
          comments: [],
          relatedDocPath: `users/${userId}`,
          streakAtPost: newStreak,
          bootcampStreakAtPost: bootcampStreakAtPost,
          bootcampId: bootcampId,
          goalTextAtPost: goalTextAtPost,
          progressAtPost: progressAtPost
        };

        await timelineDocRef.set(eventData);
      }
    } catch (error) {
      logger.error("Failed to process streak update:", error);
    }
  });

exports.onReactionAdded = functions.firestore
  .document("communityTimeline/{eventId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const eventId = context.params.eventId;

    const beforeReactions = before.reactions || {};
    const afterReactions = after.reactions || {};

    if (JSON.stringify(beforeReactions) === JSON.stringify(afterReactions)) return;

    const eventOwnerId = after.userId;

    for (const emoji in afterReactions) {
        const usersAfter = afterReactions[emoji] || {};
        const usersBefore = beforeReactions[emoji] || {};

        const newUids = Object.keys(usersAfter).filter(uid => !usersBefore[uid]);

        for (const newUid of newUids) {
            if (newUid === eventOwnerId) continue;

            const likerName = usersAfter[newUid];
            const payload = {
                notification: {
                    title: `Ny reaktion! ${emoji}`,
                    body: `${likerName} reagerade på ditt inlägg.`,
                    icon: "/icons/icon-192x192.png",
                    badge: "/icons/badge-96x96.png",
                    data: { url: `/?view=community&highlight=${eventId}` }
                }
            };
            await sendNotificationToUser(eventOwnerId, payload, "likes");
        }
    }
  });

exports.onCommentLikeCreated = functions.firestore
  .document("communityTimeline/{eventId}/comments/{commentId}/likes/{likeId}")
  .onCreate(async (snapshot, context) => {
    const likeData = snapshot.data();
    const { eventId, commentId } = context.params;

    const commentRef = db.collection("communityTimeline").doc(eventId).collection("comments").doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) return;
    const commentData = commentDoc.data();
    const commentAuthorId = commentData.authorUid;

    if (likeData.userId === commentAuthorId) return;

    const payload = {
      notification: {
        title: "Gilla på kommentar ❤️",
        body: `${likeData.userName} gillade din kommentar.`,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-96x96.png",
        data: { url: `/?view=community&highlight=${eventId}` }
      }
    };
    await sendNotificationToUser(commentAuthorId, payload, "likes");
  });

exports.addMutualFriends = functions.firestore
  .document("peppkompisRequests/{requestId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === "pending" && after.status === "accepted") {
      const fromUserId = after.fromUid;
      const toUserId = after.toUid;

      const fromUserDoc = await db.collection("users").doc(fromUserId).get();
      const toUserDoc = await db.collection("users").doc(toUserId).get();

      const fromUserData = fromUserDoc.exists ? fromUserDoc.data() : {};
      const toUserData = toUserDoc.exists ? toUserDoc.data() : {};

      const buddyForFrom = {
        uid: toUserId,
        name: toUserData.displayName || "",
        email: toUserData.email || "",
        photoURL: toUserData.photoURL || "",
        gender: toUserData.gender || "",
      };

      const buddyForTo = {
        uid: fromUserId,
        name: fromUserData.displayName || "",
        email: fromUserData.email || "",
        photoURL: fromUserData.photoURL || "",
        gender: fromUserData.gender || "",
      };

      try {
        await db.collection("users").doc(fromUserId).collection("buddies").doc(toUserId).set(buddyForFrom);
        await db.collection("users").doc(toUserId).collection("buddies").doc(fromUserId).set(buddyForTo);
        
        const requestId = context.params.requestId;
        await db.collection("peppkompisRequests").doc(requestId).delete();
      } catch (error) {
        logger.error("Fel vid skapande av vänskap:", error);
      }
    }
  });

exports.onBuddyRemoved = functions.firestore
  .document("users/{userId}/buddies/{buddyId}")
  .onDelete(async (snapshot, context) => {
    const { userId, buddyId } = context.params;
    const reciprocalBuddyRef = db.collection("users").doc(buddyId).collection("buddies").doc(userId);

    try {
      await reciprocalBuddyRef.delete();
    } catch (error) {
      if (error.code !== 5) { 
         logger.error(`Misslyckades med att ta bort speglad vänrelation`, error);
      }
    }
  });

// --- SCHEMALAGD PUSHNOTIS-FUNKTION ---
const TZ = "Europe/Stockholm";

function stockholmNow() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false, weekday: "long",
  });
  const parts = fmt.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;

  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hour = parseInt(get("hour"), 10);
  const weekday = (get("weekday") || "").toLowerCase();

  return { hour, dateString: `${yyyy}-${mm}-${dd}`, weekday };
}

const MILESTONE_STREAKS = [7, 14, 21, 30, 50, 60, 90, 100, 150, 200, 300, 365];

exports.scheduledNotificationChecker = functions.pubsub
    .schedule("every 1 hours")
    .onRun(async (context) => {
      const usersSnapshot = await db.collection("users").get();

      for (const userDoc of usersSnapshot.docs) {
        const user = userDoc.data();
        const userId = userDoc.id;

        const { hour: localHour, dateString: todayDateString, weekday: dayOfWeek } = stockholmNow();

        // 1. Inaktivitet (kl 10)
        if (localHour === 10 && user.lastLogDate) {
            const lastLog = new Date(user.lastLogDate);
            const today = new Date(todayDateString);
            const diffTime = Math.abs(today - lastLog);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            if (diffDays === 3 && user.lastInactivityReminderSent !== todayDateString) {
                const payload = {
                    notification: {
                        title: "Vi saknar dig! 🥺",
                        body: "Det var 3 dagar sedan du loggade. Kom tillbaka och håll dina vanor vid liv!",
                        icon: "/icons/icon-192x192.png", badge: "/icons/badge-96x96.png", data: { url: "/?view=main" },
                    }
                };
                await sendNotificationToUser(userId, payload, "inactivityReminder");
                await db.collection("users").doc(userId).update({ lastInactivityReminderSent: todayDateString });
            }
        }

        // 2. Milstolpe (kl 19)
        if (localHour === 19 && user.currentStreak > 0) {
            const nextDayStreak = user.currentStreak + 1;
            if (MILESTONE_STREAKS.includes(nextDayStreak)) {
                if (user.lastLogDate !== todayDateString && user.lastMilestoneNudgeSentFor !== todayDateString) {
                    const payload = {
                        notification: {
                            title: "Du är så nära! 🔥",
                            body: `Logga idag för att nå en streak på ${nextDayStreak} dagar! Du fixar det!`,
                            icon: "/icons/icon-192x192.png", badge: "/icons/badge-96x96.png", data: { url: "/?view=main" },
                        }
                    };
                    await sendNotificationToUser(userId, payload, "milestoneNudge");
                    await db.collection("users").doc(userId).update({ lastMilestoneNudgeSentFor: todayDateString });
                }
            }
        }

        // 3. Vatten (kl 12)
        if (localHour === 12 && user.lastWaterReminderSent !== todayDateString) {
          const waterLog = await db.collection("users").doc(userId).collection("waterLogs").doc(todayDateString).get();
          const needsWaterReminder = !waterLog.exists || (waterLog.exists && (waterLog.data().waterLoggedMl || 0) <= 0);

          if (needsWaterReminder) {
            const payload = {
              notification: {
                title: "💧 Glöm inte vattnet!",
                body: "Kom ihåg att logga ditt vattenintag.",
                icon: "/icons/icon-192x192.png", badge: "/icons/badge-96x96.png", data: {url: "/?view=main"},
              }
            };
            await sendNotificationToUser(userId, payload, "waterReminder");
            await db.collection("users").doc(userId).update({lastWaterReminderSent: todayDateString});
          }
        }

        // 4. Mat (kl 18)
        if (localHour === 18 && user.lastFoodReminderSent !== todayDateString) {
          const mealLogsQuery = db.collection("users").doc(userId).collection("mealLogs").where("dateString", "==", todayDateString).limit(1);
          const mealLogsSnapshot = await mealLogsQuery.get();

          if (mealLogsSnapshot.empty) {
            const payload = {
              notification: {
                title: "🍽️ Middagstips!",
                body: "Har du loggat dagens mat ännu? Missa inte att fylla i din kostlogg.",
                icon: "/icons/icon-192x192.png", badge: "/icons/badge-96x96.png", data: {url: "/?view=main"},
              }
            };
            await sendNotificationToUser(userId, payload, "foodReminder");
            await db.collection("users").doc(userId).update({lastFoodReminderSent: todayDateString});
          }
        }

        // 5. Vägning (kl 8)
        const preferredDay = (user.preferredWeighInDay || "måndag").toLowerCase();
        if (localHour === 8 && dayOfWeek === preferredDay && user.lastWeighInReminderSent !== todayDateString) {
          const payload = {
            notification: {
              title: "⚖️ Dags för vägning!",
              body: `Idag är din planerade vägdag (${user.preferredWeighInDay}). Kom ihåg att logga din vikt!`,
              icon: "/icons/icon-192x192.png", badge: "/icons/badge-96x96.png", data: {url: "/?view=journey"},
            }
          };
          await sendNotificationToUser(userId, payload, "weighInReminder");
          await db.collection("users").doc(userId).update({lastWeighInReminderSent: todayDateString});
        }
      }
      return null;
    });

// ---- DATABAS-BACKUP ----
const {Firestore} = require("@google-cloud/firestore");
const firestoreClient = new Firestore();

exports.scheduledFirestoreExport = functions.pubsub
  .schedule("0 3 * * *")
  .timeZone("Europe/Stockholm")
  .onRun(async (context) => {
    const projectId = admin.app().options.projectId;
    const databaseName = firestoreClient.databasePath(projectId, "(default)");
    const bucket = `gs://${projectId}-backups`;

    try {
      await firestoreClient.exportDocuments({
        name: databaseName,
        outputUriPrefix: bucket,
      });
      return null;
    } catch (error) {
      logger.error("Fel vid start av Firestore-export:", error);
      throw new Error("Export-operationen misslyckades.");
    }
  });

const getDateUID = (date, timezone) => {
    const fmt = new Intl.DateTimeFormat("sv-SE", {
        timeZone: timezone || "Europe/Stockholm",
        year: "numeric", month: "2-digit", day: "2-digit",
    });
    const parts = fmt.formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
};

const wasCalorieGoalMetForSummary = (consumed, goal, goalType) => {
    if (goal <= 0 || consumed <= 0) return false;
    switch (goalType) {
        case "lose_fat": return consumed <= goal;
        case "maintain": return Math.abs(consumed - goal) <= goal * 0.10;
        case "gain_muscle": return consumed >= goal;
        default: return Math.abs(consumed - goal) <= goal * 0.10;
    }
};

const MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL = 0.80;
const MIN_ABSOLUTE_CALORIES_THRESHOLD = 1200;

exports.manualSummarizeYesterday = functions
  .region("us-central1")
  .runWith({timeoutSeconds: 540, memory: "2GB"})
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists || (callerDoc.data().role !== "admin" && callerDoc.data().role !== "coach")) {
        throw new functions.https.HttpsError("permission-denied", "User must be an admin or coach.");
    }

    const serverTime = new Date();
    const yesterday = new Date(serverTime.toLocaleString("en-US", {timeZone: "Europe/Stockholm"}));
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateUID = getDateUID(yesterday, "Europe/Stockholm");
    
    const today = new Date(serverTime.toLocaleString("en-US", {timeZone: "Europe/Stockholm"}));
    const todayDateUID = getDateUID(today, "Europe/Stockholm");

    if (yesterdayDateUID >= todayDateUID) {
        logger.warn(`Attempted to summarize a future/current date (${yesterdayDateUID}). Aborting.`);
        return {success: false, message: `Attempted to summarize a future/current date (${yesterdayDateUID}). Aborting.`};
    }

    const usersSnapshot = await db.collection("users").where("status", "==", "approved").get();
    const allWriteOps = [];
    let processedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const user = userDoc.data();

        if (user.lastDateStreakChecked && user.lastDateStreakChecked >= yesterdayDateUID) continue;
        if (!user.goals || typeof user.goals.calorieGoal !== "number") continue;

        try {
            const mealLogsSnap = await db.collection("users").doc(userId).collection("mealLogs").where("dateString", "==", yesterdayDateUID).get();
            const dailyLogForDate = mealLogsSnap.docs.map((d) => d.data());

            const totalNutrients = dailyLogForDate.reduce((acc, meal) => {
                acc.calories += meal.nutritionalInfo.calories;
                return acc;
            }, {calories: 0});

            const minSafeCalories = Math.max(user.goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD);
            const wasDaySuccessful = dailyLogForDate.length > 0 &&
                totalNutrients.calories >= minSafeCalories &&
                wasCalorieGoalMetForSummary(totalNutrients.calories, user.goals.calorieGoal, user.goalType);

            const newStreak = wasDaySuccessful ? (user.currentStreak || 0) + 1 : 0;
            const newHighestStreak = Math.max(user.highestStreak || 0, newStreak);
            const bankedAmountThisDay = wasDaySuccessful && totalNutrients.calories < user.goals.calorieGoal ?
                user.goals.calorieGoal - totalNutrients.calories : 0;

            const summaryData = {
                date: yesterdayDateUID,
                goalMet: wasDaySuccessful,
                consumedCalories: totalNutrients.calories,
                calorieGoal: user.goals.calorieGoal,
                streakForThisDay: newStreak,
                bankedAmount: bankedAmountThisDay
            };

            allWriteOps.push({ref: db.collection("users").doc(userId).collection("pastDaySummaries").doc(yesterdayDateUID), data: summaryData, type: "set"});
            allWriteOps.push({
                ref: db.collection("users").doc(userId), 
                data: {
                    currentStreak: newStreak, 
                    highestStreak: newHighestStreak, 
                    lastDateStreakChecked: yesterdayDateUID, 
                    "weeklyBank.bankedCalories": admin.firestore.FieldValue.increment(bankedAmountThisDay)
                }, 
                type: "update"
            });
            
            processedCount++;
        } catch (error) {
            logger.error(`Error processing user ${userId}`, error);
        }
    }

    const batchPromises = [];
    for (let i = 0; i < allWriteOps.length; i += 500) {
        const batch = db.batch();
        allWriteOps.slice(i, i + 500).forEach(op => op.type === "set" ? batch.set(op.ref, op.data, {merge: true}) : batch.update(op.ref, op.data));
        batchPromises.push(batch.commit());
    }
    
    await Promise.all(batchPromises);
    return {success: true, message: `Summerat ${processedCount} användare.`};
});

// ==========================================
// NYTT: STRIPE INTEGRATION
// ==========================================

exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Användaren är inte inloggad.');
    }

    // Hämta priceId från .env ELLER molnet ELLER frontend
    const priceId = process.env.STRIPE_PRICE_ID || data.priceId || getSafeConfig('stripe', 'price');
    const origin = data.returnUrl || 'https://app.kostloggen.se';

    if (!priceId) {
        console.error("Price ID is missing in both .env and functions.config()");
        throw new functions.https.HttpsError('internal', "Kunde inte hitta ett pris för produkten.");
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer_email: context.auth.token.email,
            line_items: [{ price: priceId, quantity: 1 }],
            metadata: { firebaseUid: context.auth.uid },
            allow_promotion_codes: true,
            success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/cancel`,
        });
        
        return { sessionId: session.id, url: session.url };
    } catch (error) {
        console.error("Stripe fel:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.cancelSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Inte inloggad.');

    const userId = context.auth.uid;
    try {
        const userSnapshot = await db.collection('users').doc(userId).get();
        const userData = userSnapshot.data();

        if (!userData || !userData.subscriptionId) {
             throw new functions.https.HttpsError('failed-precondition', 'Ingen prenumeration.');
        }

        const subscription = await stripe.subscriptions.update(userData.subscriptionId, { cancel_at_period_end: true });

        await db.collection('users').doc(userId).update({
            subscriptionStatus: 'canceling',
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        logger.error("Cancel Subscription Error:", error);
        throw new functions.https.HttpsError('internal', 'Kunde inte avsluta prenumerationen.');
    }
});

exports.onChatMessageCreated = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    const chatId = context.params.chatId;
    if (!message) return;

    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) return;

    const chatData = chatDoc.data();
    const members = chatData.members || [];
    const memberSettings = chatData.memberSettings || {};

    const senderId = message.senderId;
    
    // Build notification payload
    const payload = {
      notification: {
        title: chatData.type === 'direct' ? message.senderName : `${message.senderName} i ${chatData.name}`,
        body: message.text || (message.imageUrl ? 'Skickade en bild' : 'Nytt meddelande'),
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-96x96.png",
        data: { url: `/?view=chat&chatId=${chatId}` }
      }
    };

    const notificationPromises = members.map(async (memberId) => {
      if (memberId === senderId) return null;

      const settings = memberSettings[memberId] || {};
      const level = settings.notificationLevel || 'all';

      if (level === 'mute') return null;
      
      if (level === 'mentions') {
        // Since 'mentions' was the default previously, many users have it set without knowing.
        // For now, we'll treat 'mentions' as 'all' unless they explicitly mute.
        // If we want to strictly enforce mentions later, we can check for '@'.
      }

      // Send the notification
      return sendNotificationToUser(memberId, payload, "messages");
    });

    await Promise.all(notificationPromises);
  });

exports.onChatMessageUpdated = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const chatId = context.params.chatId;

    const beforeReactions = before.reactions || {};
    const afterReactions = after.reactions || {};

    if (JSON.stringify(beforeReactions) === JSON.stringify(afterReactions)) return;

    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) return;

    const chatData = chatDoc.data();
    const messageOwnerId = after.senderId;

    // Find new reactions
    for (const emoji of Object.keys(afterReactions)) {
        const usersBefore = beforeReactions[emoji] || {};
        const usersAfter = afterReactions[emoji] || {};

        for (const newUid of Object.keys(usersAfter)) {
            if (!usersBefore[newUid]) {
                // New reaction from newUid
                if (newUid === messageOwnerId) continue;

                const likerName = usersAfter[newUid];
                const payload = {
                    notification: {
                        title: `Ny reaktion! ${emoji}`,
                        body: `${likerName} reagerade på ditt meddelande i ${chatData.name || 'chatten'}.`,
                        icon: "/icons/icon-192x192.png",
                        badge: "/icons/badge-96x96.png",
                        data: { url: `/?view=chat&chatId=${chatId}` }
                    }
                };
                await sendNotificationToUser(messageOwnerId, payload, "likes");
            }
        }
    }
  });

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    // Hämta webhook secret från .env ELLER molnet
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || getSafeConfig('stripe', 'webhook_secret');

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
    } catch (err) {
        logger.error(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const firebaseUid = session.metadata.firebaseUid;

            await db.collection('users').doc(firebaseUid).update({
                subscriptionStatus: 'active',
                status: 'approved',
                stripeCustomerId: session.customer,
                subscriptionId: session.subscription,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } 
        else if (event.type === 'customer.subscription.updated') {
             const subscription = event.data.object;
             if (subscription.cancel_at_period_end) {
                 const usersSnapshot = await db.collection('users').where('subscriptionId', '==', subscription.id).get();
                 if (!usersSnapshot.empty) {
                     const batch = db.batch();
                     usersSnapshot.forEach((doc) => {
                         batch.update(doc.ref, {
                             subscriptionStatus: 'canceling',
                             currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                             updatedAt: admin.firestore.FieldValue.serverTimestamp()
                         });
                     });
                     await batch.commit();
                 }
             } else {
                 const usersSnapshot = await db.collection('users').where('subscriptionId', '==', subscription.id).get();
                 if (!usersSnapshot.empty) {
                     const batch = db.batch();
                     usersSnapshot.forEach((doc) => {
                         if (doc.data().subscriptionStatus !== 'active') {
                             batch.update(doc.ref, {
                                 subscriptionStatus: 'active',
                                 currentPeriodEnd: admin.firestore.FieldValue.delete(),
                                 updatedAt: admin.firestore.FieldValue.serverTimestamp()
                             });
                         }
                     });
                     await batch.commit();
                 }
             }
        }
        else if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object;
            const usersSnapshot = await db.collection('users').where('subscriptionId', '==', subscription.id).get();
            
            if (!usersSnapshot.empty) {
                const batch = db.batch();
                usersSnapshot.forEach((doc) => {
                    batch.update(doc.ref, {
                        subscriptionStatus: 'canceled',
                        status: 'archived',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();
            }
        }
    } catch (err) {
        logger.error("Error handling webhook event:", err);
        return res.status(500).send("Internal Server Error");
    }

    res.json({received: true});
});