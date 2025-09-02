const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");
const logger = require("firebase-functions/logger");

admin.initializeApp();
const db = admin.firestore();

// ---- VAPID-nycklar ----
// Båda nycklarna hämtas nu från Firebase config för bättre säkerhet och hantering.
const vapidPublicKey = functions.config().webpush ? functions.config().webpush.public_key : null;
const vapidPrivateKey = functions.config().webpush ? functions.config().webpush.private_key : null;

if (vapidPublicKey && vapidPrivateKey) {
    logger.log("Webpush VAPID keys loaded from Firebase config", {
        publicKeyLength: vapidPublicKey.length,
        privateKeyLength: vapidPrivateKey.length
    });

    try {
        webpush.setVapidDetails(
          "mailto:din-email@example.com", // Uppdatera denna med din kontakt-email
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

/**
 * Finds all coach and admin user IDs.
 * @return {Promise<string[]>} A promise that resolves to an array of UIDs.
 */
async function getCoachAndAdminIds() {
    const coachesSnapshot = await db.collection("users").where("role", "==", "coach").get();
    const adminsSnapshot = await db.collection("users").where("role", "==", "admin").get();

    const coachIds = coachesSnapshot.docs.map((doc) => doc.id);
    const adminIds = adminsSnapshot.docs.map((doc) => doc.id);

    // Use a Set to ensure unique IDs if a user is both coach and admin (unlikely but safe)
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

  const promises = subscriptions.map((sub) =>
    webpush.sendNotification(sub, JSON.stringify(payload)).catch((error) => {
      // Om prenumerationen är ogiltig (t.ex. 404, 410), kan vi logga detta för att senare kunna städa upp.
      if (error.statusCode === 404 || error.statusCode === 410) {
        logger.warn(`Subscription for user ${userId} seems to be invalid. Consider removing it.`, { subscription: sub });
      } else {
        logger.error(`Error sending notification to user ${userId}:`, { errorBody: error.body });
      }
    })
  );
  await Promise.all(promises);
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
          url: "/" // Coach dashboard is at root, toggled in UI
        }
      }
    };

    const coachIds = await getCoachAndAdminIds();
    if (coachIds.length === 0) {
        logger.warn("No coaches or admins found to notify about new user.");
        return;
    }

    const notificationPromises = coachIds.map((id) =>
        sendNotificationToUser(id, payload, "newEvents") // Reusing 'newEvents' setting for coach
    );

    await Promise.all(notificationPromises);
});

exports.onCourseInterest = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if courseInterest changed from false/undefined to true
    if (after.courseInterest === true && before.courseInterest !== true) {
        const name = after.displayName || "En medlem";
        logger.log(`Course interest shown by: ${name} (ID: ${change.after.id})`);

        const payload = {
          notification: {
            title: "Intresse för kurs! 🎓",
            body: `${name} har visat intresse för kursen 'Praktisk Viktkontroll'.`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/badge-96x96.png",
            data: {
              url: "/" // Coach dashboard
            }
          }
        };

        const coachIds = await getCoachAndAdminIds();
        if (coachIds.length === 0) {
            logger.warn("No coaches or admins found to notify about course interest.");
            return;
        }

        const notificationPromises = coachIds.map((id) =>
            sendNotificationToUser(id, payload, "newEvents") // Reusing 'newEvents' setting for coach
        );

        await Promise.all(notificationPromises);
    }
  });


// 1. Peppkompisförfrågan skapad (notis)
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

// 2. Händelse i flödet skapad (notis)
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

// 3. Kommentar skapad (notis)
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

// ---- Kompis-hanteringsfunktioner ----

// 4. Lägg till kompisar och RADERA FÖRFRÅGAN vid accepterad förfrågan
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
        logger.log(`Vänskap skapad mellan ${fromUserId} och ${toUserId}`);

        // Ta bort förfrågan efter att vänskapen skapats.
        const requestId = context.params.requestId;
        await db.collection("peppkompisRequests").doc(requestId).delete();
        logger.log(`Raderade vänförfrågan ${requestId} efter att den accepterats.`);
      } catch (error) {
        logger.error("Fel vid skapande av vänskap och radering av förfrågan:", error);
      }
    }
  });

// 5. Ta bort speglad vänrelation när en användare tar bort en kompis.
// Denna ersätter den gamla 'removeMutualFriends' som var felaktigt implementerad.
exports.onBuddyRemoved = functions.firestore
  .document("users/{userId}/buddies/{buddyId}")
  .onDelete(async (snapshot, context) => {
    const { userId, buddyId } = context.params;

    logger.log(`Användare ${userId} tog bort ${buddyId} som kompis. Försöker ta bort speglad relation.`);

    const reciprocalBuddyRef = db.collection("users").doc(buddyId).collection("buddies").doc(userId);

    try {
      await reciprocalBuddyRef.delete();
      logger.log(`Tog bort ${userId} från ${buddyId}s kompislista.`);
    } catch (error) {
      if (error.code === 5) { // Kod 5 är NOT_FOUND, vilket är ok.
         logger.log(`Speglad vänrelation fanns inte redan för ${buddyId} -> ${userId}. Ingen åtgärd behövs.`);
         return;
      }
      logger.error(`Misslyckades med att ta bort speglad vänrelation för ${buddyId} -> ${userId}`, error);
    }
  });


// --- SCHEMALAGD PUSHNOTIS-FUNKTION (SVERIGE-TID) ---
const TZ = "Europe/Stockholm";

/**
 * Gets the current time details in Swedish time zone.
 * @return {{hour: number, dateString: string, weekday: string}}
 */
function stockholmNow() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "long",
  });
  const parts = fmt.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;

  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hour = parseInt(get("hour"), 10);
  const weekday = (get("weekday") || "").toLowerCase(); // ex. "torsdag"

  return {
    hour, // 0..23 i svensk tid
    dateString: `${yyyy}-${mm}-${dd}`, // "YYYY-MM-DD" i svensk tid
    weekday, // "måndag"..."söndag"
  };
}

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

        // --- VATTENPÅMINNELSE: kl 12 ---
        if (
          localHour === 12 &&
          user.lastWaterReminderSent !== todayDateString
        ) {
          const waterLog = await db.collection("users").doc(userId)
              .collection("waterLogs").doc(todayDateString).get();
          const needsWaterReminder = !waterLog.exists ||
              (waterLog.exists && (waterLog.data().waterLoggedMl || 0) <= 0);

          if (needsWaterReminder) {
            const payload = {
              notification: {
                title: "💧 Glöm inte vattnet!",
                body: "Kom ihåg att logga ditt vattenintag.",
                icon: "/icons/icon-192x192.png",
                badge: "/icons/badge-96x96.png",
                data: {url: "/?view=main"},
              }
            };
            await sendNotificationToUser(userId, payload, "waterReminder");
            await db.collection("users").doc(userId)
                .update({lastWaterReminderSent: todayDateString});
          }
        }

        // --- MATPÅMINNELSE: kl 18 ---
        if (
          localHour === 18 &&
          user.lastFoodReminderSent !== todayDateString
        ) {
          const mealLogsQuery = db.collection("users").doc(userId)
              .collection("mealLogs").where("dateString", "==", todayDateString)
              .limit(1);
          const mealLogsSnapshot = await mealLogsQuery.get();

          if (mealLogsSnapshot.empty) {
            const payload = {
              notification: {
                title: "🍽️ Middagstips!",
                body: "Har du loggat dagens mat ännu? Missa inte att fylla i din kostlogg.",
                icon: "/icons/icon-192x192.png",
                badge: "/icons/badge-96x96.png",
                data: {url: "/?view=main"},
              }
            };
            await sendNotificationToUser(userId, payload, "foodReminder");
            await db.collection("users").doc(userId)
                .update({lastFoodReminderSent: todayDateString});
          }
        }

        // --- VÄGNINGS-PÅMINNELSE: kl 8 på föredragen dag ---
        const preferredDay = (user.preferredWeighInDay || "måndag").toLowerCase();

        if (
          localHour === 8 &&
          dayOfWeek === preferredDay &&
          user.lastWeighInReminderSent !== todayDateString
        ) {
          const payload = {
            notification: {
              title: "⚖️ Dags för vägning!",
              body: `Idag är din planerade vägdag (${user.preferredWeighInDay}). Kom ihåg att logga din vikt!`,
              icon: "/icons/icon-192x192.png",
              badge: "/icons/badge-96x96.png",
              data: {url: "/?view=journey"},
            }
          };
          await sendNotificationToUser(userId, payload, "weighInReminder");
          await db.collection("users").doc(userId)
              .update({lastWeighInReminderSent: todayDateString});
        }
      }
      return null;
    });

// ---- DATABAS-BACKUP (SCHEMALAGD EXPORT) ----
// Denna funktion kräver att Cloud Functionens service-konto har rollen
// "Cloud Datastore Import Export Admin" i IAM & Admin API.
// Du måste också skapa en Google Cloud Storage-bucket med namnet
// gs://<DITT-PROJEKT-ID>-backups i ditt Google Cloud-projekt.
const {Firestore} = require("@google-cloud/firestore");
const firestoreClient = new Firestore();

exports.scheduledFirestoreExport = functions.pubsub
  .schedule("0 3 * * *")
  .timeZone("Europe/Stockholm")
  .onRun(async (context) => {
    const projectId = admin.app().options.projectId;
    const databaseName = firestoreClient.databasePath(projectId, "(default)");
    const bucket = `gs://${projectId}-backups`;

    logger.log(`Startar schemalagd backup av Firestore-databasen '${databaseName}' till bucket '${bucket}'`);

    try {
      const responses = await firestoreClient.exportDocuments({
        name: databaseName,
        outputUriPrefix: bucket,
        // Lämna collectionIds tomt för att exportera hela databasen.
        // collectionIds: []
      });
      const response = responses[0];
      logger.log(`Export-operation startad: ${response["name"]}`);
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
        case "gain_muscle": return consumed >= goal;
        default: return Math.abs(consumed - goal) <= goal * 0.10;
    }
};

const MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL = 0.80;
const MIN_ABSOLUTE_CALORIES_THRESHOLD = 1200;
const DEFAULT_WATER_GOAL_ML = 2000;

exports.manualSummarizeYesterday = functions.runWith({timeoutSeconds: 540}).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Caller user document not found.");
    }
    const callerRole = callerDoc.data().role;
    if (callerRole !== "admin" && callerRole !== "coach") {
        throw new functions.https.HttpsError("permission-denied", "User must be an admin or coach.");
    }

    logger.log(`Manual summary triggered by ${context.auth.uid} (${callerRole})`);

    const serverTime = new Date();
    const yesterday = new Date(serverTime.toLocaleString("en-US", {timeZone: "Europe/Stockholm"}));
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateUID = getDateUID(yesterday, "Europe/Stockholm");

    const usersSnapshot = await db.collection("users").where("status", "==", "approved").get();
    let processedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const user = userDoc.data();

        try {
            if (user.lastDateStreakChecked && user.lastDateStreakChecked >= yesterdayDateUID) {
                skippedCount++;
                continue;
            }
            
            // Robustness check: Ensure user.goals exists before proceeding
            if (!user.goals) {
                logger.warn(`Skipping user ${userId} due to missing 'goals' field.`);
                skippedCount++;
                continue;
            }

            const mealLogsRef = db.collection("users").doc(userId).collection("mealLogs");
            const mealLogsQuery = mealLogsRef.where("dateString", "==", yesterdayDateUID);
            const mealLogsSnap = await mealLogsQuery.get();
            const dailyLogForDate = mealLogsSnap.docs.map((d) => d.data());

            const waterLogRef = db.collection("users").doc(userId).collection("waterLogs").doc(yesterdayDateUID);
            const waterLogSnap = await waterLogRef.get();
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

            let newStreak = wasDaySuccessful ? (user.currentStreak || 0) + 1 : 0;
            const newHighestStreak = Math.max(user.highestStreak || 0, newStreak);

            const bankedAmountThisDay = wasDaySuccessful && totalNutrients.calories < user.goals.calorieGoal ?
                user.goals.calorieGoal - totalNutrients.calories : 0;

            const batch = db.batch();
            const userRef = db.collection("users").doc(userId);
            const summaryRef = db.collection("users").doc(userId).collection("pastDaySummaries").doc(yesterdayDateUID);

            const summaryData = {
                date: yesterdayDateUID,
                goalMet: wasDaySuccessful,
                consumedCalories: totalNutrients.calories,
                calorieGoal: user.goals.calorieGoal,
                proteinGoalMet: totalNutrients.protein >= user.goals.proteinGoal,
                consumedProtein: totalNutrients.protein,
                proteinGoal: user.goals.proteinGoal,
                consumedCarbohydrates: totalNutrients.carbohydrates,
                carbohydrateGoal: user.goals.carbohydrateGoal,
                consumedFat: totalNutrients.fat,
                fatGoal: user.goals.fatGoal,
                goalType: user.goalType,
                waterGoalMet: waterLogForDate >= DEFAULT_WATER_GOAL_ML,
                streakForThisDay: newStreak,
            };
            batch.set(summaryRef, summaryData, {merge: true});

            const userUpdate = {
                currentStreak: newStreak,
                highestStreak: newHighestStreak,
                lastDateStreakChecked: yesterdayDateUID,
                "weeklyBank.bankedCalories": admin.firestore.FieldValue.increment(bankedAmountThisDay),
            };
            batch.update(userRef, userUpdate);

            if (wasDaySuccessful) {
                const buddiesSnapshot = await db.collection("users").doc(userId).collection("buddies").get();
                const visibleTo = [userId, ...buddiesSnapshot.docs.map((doc) => doc.id)];
                const timelineEventData = {
                    type: "streak",
                    timestamp: admin.firestore.Timestamp.now().toMillis(),
                    title: `har fått +1 på sin Streak!`,
                    description: `Ny streak: ${newStreak} dagar i följd.`,
                    icon: "🔥",
                    relatedDocId: `streak_${yesterdayDateUID}`,
                    userId: userId,
                    userName: user.displayName,
                    userPhotoURL: user.photoURL || null,
                    gender: user.gender,
                    visibleTo: visibleTo,
                    reactions: {},
                    comments: [],
                    relatedDocPath: `users/${userId}/pastDaySummaries/${yesterdayDateUID}`,
                };
                const timelineDocRef = db.doc(`communityTimeline/users--${userId}--streak--${yesterdayDateUID}`);
                batch.set(timelineDocRef, timelineEventData);
            }

            await batch.commit();
            processedCount++;
        } catch (error) {
            logger.error(`Failed to process user ${userId}:`, error);
            failedCount++;
        }
    }

    const message = `Summering klar. ${processedCount} användare bearbetades, ${failedCount} misslyckades, ${skippedCount} hoppades över.`;
    logger.log(`Manual summary finished. ${message}`);
    return {success: true, message: message};
});