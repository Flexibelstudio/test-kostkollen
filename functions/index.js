
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");
const logger = require("firebase-functions/logger");
const cors = require('cors')({ origin: true });

// Initiera Stripe med den hemliga nyckeln från config
const stripe = require("stripe")(functions.config().stripe.secret);

admin.initializeApp();
const db = admin.firestore();

// ---- VAPID-nycklar ----
const vapidPublicKey = functions.config().webpush ? functions.config().webpush.public_key : null;
const vapidPrivateKey = functions.config().webpush ? functions.config().webpush.private_key : null;

if (vapidPublicKey && vapidPrivateKey) {
    logger.log("Webpush VAPID keys loaded from Firebase config", {
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
    logger.warn("WEBPUSH keys are not set in functions config. Push notifications will be disabled.");
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

// 0. Notiser till Coach
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
        data: {
          url: "/" 
        }
      }
    };

    const coachIds = await getCoachAndAdminIds();
    if (coachIds.length === 0) {
        logger.warn("No coaches or admins found to notify about new user.");
        return;
    }

    const notificationPromises = coachIds.map((id) =>
        sendNotificationToUser(id, payload, "newEvents") 
    );

    await Promise.all(notificationPromises);
});

// 1. Peppkompisförfrågan skapad
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
        data: {
          url: "/?view=community&tab=requests"
        }
      }
    };

    await sendNotificationToUser(request.toUid, payload, "friendRequests");
  });

// 2. Händelse i flödet skapad (Skickar push-notiser)
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
        data: {
          url: `/?view=community&highlight=${eventId}`
        }
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

// 3. Kommentar skapad
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

    if (comment.authorUid === eventOwnerId) return;

    const payload = {
      notification: {
        title: "Ny kommentar! 💬",
        body: `${comment.authorName} kommenterade ditt inlägg: "${eventData.title}"`,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-96x96.png",
        data: {
          url: `/?view=community&highlight=${eventId}`
        }
      }
    };

    await sendNotificationToUser(eventOwnerId, payload, "comments");
  });

// 4. Streak-uppdatering (Skapar inlägg i flödet)
exports.onUserStreakUpdated = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const userId = context.params.userId;

    const newStreak = after.currentStreak || 0;
    const oldStreak = before.currentStreak || 0;

    // Om streaken har ökat och är över 0
    if (newStreak > oldStreak && newStreak > 0) {
      logger.log(`Streak increased for user ${userId}: ${oldStreak} -> ${newStreak}. Creating timeline event.`);

      // Hämta kompisar för att sätta synlighet
      const buddiesSnap = await db.collection("users").doc(userId).collection("buddies").get();
      const buddyUids = buddiesSnap.docs.map(d => d.id);
      const visibleTo = [userId, ...buddyUids];

      const eventId = `streak_${userId}_${newStreak}_${new Date().toISOString().split('T')[0]}`;
      const timelineDocRef = db.collection("communityTimeline").doc(eventId);

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
      };

      try {
        await timelineDocRef.set(eventData, { merge: true });
      } catch (error) {
        logger.error("Failed to create streak timeline event:", error);
      }
    }
  });

// 5. Reaktion på inlägg (Dilla)
exports.onReactionAdded = functions.firestore
  .document("communityTimeline/{eventId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const eventId = context.params.eventId;

    // Check if reactions changed
    const beforeReactions = before.reactions || {};
    const afterReactions = after.reactions || {};

    // Simple equality check to avoid processing if no reaction change
    if (JSON.stringify(beforeReactions) === JSON.stringify(afterReactions)) return;

    const eventOwnerId = after.userId;

    // Iterate through emojis to find new reactions
    for (const emoji in afterReactions) {
        const usersAfter = afterReactions[emoji] || {};
        const usersBefore = beforeReactions[emoji] || {};

        // Find UIDs present in 'after' but not 'before'
        const newUids = Object.keys(usersAfter).filter(uid => !usersBefore[uid]);

        for (const newUid of newUids) {
            // Don't notify if user reacts to their own post
            if (newUid === eventOwnerId) continue;

            const likerName = usersAfter[newUid];

            const payload = {
                notification: {
                    title: `Ny reaktion! ${emoji}`,
                    body: `${likerName} reagerade på ditt inlägg.`,
                    icon: "/icons/icon-192x192.png",
                    badge: "/icons/badge-96x96.png",
                    data: {
                        url: `/?view=community&highlight=${eventId}`
                    }
                }
            };

            await sendNotificationToUser(eventOwnerId, payload, "likes");
        }
    }
  });

// 6. Gilla på kommentar (Dilla kommentar)
exports.onCommentLikeCreated = functions.firestore
  .document("communityTimeline/{eventId}/comments/{commentId}/likes/{likeId}")
  .onCreate(async (snapshot, context) => {
    const likeData = snapshot.data();
    const { eventId, commentId } = context.params;

    // Get comment author
    const commentRef = db.collection("communityTimeline").doc(eventId).collection("comments").doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) return;
    const commentData = commentDoc.data();
    const commentAuthorId = commentData.authorUid;

    // Don't notify if user likes their own comment
    if (likeData.userId === commentAuthorId) return;

    const payload = {
      notification: {
        title: "Gilla på kommentar ❤️",
        body: `${likeData.userName} gillade din kommentar.`,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-96x96.png",
        data: {
          url: `/?view=community&highlight=${eventId}`
        }
      }
    };

    await sendNotificationToUser(commentAuthorId, payload, "likes");
  });

// ---- Kompis-hanteringsfunktioner ----

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


// --- SCHEMALAGD PUSHNOTIS-FUNKTION (SVERIGE-TID) ---
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

  return {
    hour,
    dateString: `${yyyy}-${mm}-${dd}`,
    weekday,
  };
}

const MILESTONE_STREAKS = [7, 14, 21, 30, 50, 60, 90, 100, 150, 200, 300, 365];

exports.scheduledNotificationChecker = functions.pubsub
    .schedule("every 1 hours")
    .onRun(async (context) => {
      const usersSnapshot = await db.collection("users").get();

      for (const userDoc of usersSnapshot.docs) {
        const user = userDoc.data();
        const userId = userDoc.id;

        const {
          hour: localHour,
          dateString: todayDateString,
          weekday: dayOfWeek,
        } = stockholmNow();

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

// --- MANUELL SUMMERINGSFUNKTION ---
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
        case "gain_muscle": return consumed >= (goal - 300); // FIX: Floor check instead of strict goal
        default: return Math.abs(consumed - goal) <= goal * 0.10;
    }
};

const MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL = 0.80;
const MIN_ABSOLUTE_CALORIES_THRESHOLD = 1200;
const DEFAULT_WATER_GOAL_ML = 2000;

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
            const waterLogSnap = await db.collection("users").doc(userId).collection("waterLogs").doc(yesterdayDateUID).get();
            const waterLogForDate = waterLogSnap.exists ? waterLogSnap.data().waterLoggedMl : 0;

            const totalNutrients = dailyLogForDate.reduce((acc, meal) => {
                acc.calories += meal.nutritionalInfo.calories;
                acc.protein += meal.nutritionalInfo.protein;
                acc.carbohydrates += meal.nutritionalInfo.carbohydrates;
                acc.fat += meal.nutritionalInfo.fat;
                return acc;
            }, {calories: 0, protein: 0, carbohydrates: 0, fat: 0});

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

// 1. Skapa en Checkout Session (Anropa denna från Appen!)
// Se till att denna rad är med högst upp

exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    // Logga direkt för att se om vi ens når hit
    console.log("Anrop mottaget till createCheckoutSession", { 
        uid: context.auth ? context.auth.uid : 'ej inloggad',
        data: data 
    });

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Användaren är inte inloggad.');
    }

    // Hämta priceId dynamiskt från config eller frontend
    const priceId = functions.config().stripe.price || data.priceId;
    const origin = data.returnUrl || 'https://staging-kostloggen.netlify.app';

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer_email: context.auth.token.email,
            line_items: [{ price: priceId, quantity: 1 }],
            metadata: { firebaseUid: context.auth.uid },
            success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/cancel`,
        });
        
        return { sessionId: session.id, url: session.url };
    } catch (error) {
        console.error("Stripe fel:", error);
        // Genom att kasta ett specifikt fel här undviker vi "internal"
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// 2. Avsluta Prenumeration (Anropa från appen)
exports.cancelSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Du måste vara inloggad för att hantera prenumerationen.');
    }

    const userId = context.auth.uid;
    
    try {
        // Hämta user doc för att få subscriptionId
        const userSnapshot = await db.collection('users').doc(userId).get();
        const userData = userSnapshot.data();

        if (!userData || !userData.subscriptionId) {
             throw new functions.https.HttpsError('failed-precondition', 'Ingen aktiv prenumeration hittades.');
        }

        // Avsluta i Stripe (vid periodens slut)
        const subscription = await stripe.subscriptions.update(userData.subscriptionId, {
            cancel_at_period_end: true
        });

        // Uppdatera Firestore direkt (optimistiskt)
        // Webhooken kommer också få ett event, men detta ger snabbare feedback
        await db.collection('users').doc(userId).update({
            subscriptionStatus: 'canceling',
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        logger.error("Cancel Subscription Error:", error);
        throw new functions.https.HttpsError('internal', 'Kunde inte avsluta prenumerationen. Försök igen eller kontakta support.');
    }
});


// 3. Webhook för att lyssna på Stripe-händelser (Säkert anrop från Stripe)
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const endpointSecret = functions.config().stripe.webhook_secret;

    let event;

    try {
        // Verifiera att anropet kommer från Stripe
        event = stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
    } catch (err) {
        logger.error(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Hantera händelser
    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const firebaseUid = session.metadata.firebaseUid;

            logger.log(`Betalning genomförd för användare: ${firebaseUid}`);

            // Uppdatera användaren i Firestore till "active" OCH "approved"
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
             // Kolla om den är satt att avslutas
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
                     logger.log(`Prenumeration uppdaterad till 'canceling' för id: ${subscription.id}`);
                 }
             } else {
                 // Om användaren ångrat sig och återaktiverat (cancel_at_period_end = false)
                 // Kan vi sätta tillbaka till 'active' här om vi vill stödja det flödet i framtiden
                 const usersSnapshot = await db.collection('users').where('subscriptionId', '==', subscription.id).get();
                 if (!usersSnapshot.empty) {
                     const batch = db.batch();
                     usersSnapshot.forEach((doc) => {
                         // Bara uppdatera om status var canceling/canceled
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
            // Vi måste hitta vem som hade denna subscription
            const usersSnapshot = await db.collection('users').where('subscriptionId', '==', subscription.id).get();
            
            if (!usersSnapshot.empty) {
                const batch = db.batch();
                usersSnapshot.forEach((doc) => {
                    batch.update(doc.ref, {
                        subscriptionStatus: 'canceled',
                        status: 'archived', // Stäng tillgången
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();
                logger.log(`Prenumeration raderad (löpt ut) för id: ${subscription.id}`);
            }
        }
    } catch (err) {
        logger.error("Error handling webhook event:", err);
        return res.status(500).send("Internal Server Error");
    }

    res.json({received: true});
});
