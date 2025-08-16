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

// 4. Lägg till kompisar vid accepterad förfrågan
exports.addMutualFriends = functions.firestore
  .document("peppkompisRequests/{requestId}")
  .onUpdate(async (change) => {
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
      } catch (error) {
        logger.error("Fel vid skapande av vänskap:", error);
      }
    }
  });

// 5. Ta bort kompisar om vänskap tas bort
exports.removeMutualFriends = functions.firestore
  .document("peppkompisRequests/{requestId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (
      before.status === "accepted" &&
      (after.status === "removed" || after.status === "declined")
    ) {
      const fromUserId = after.fromUid;
      const toUserId = after.toUid;

      try {
        await db.collection("users").doc(fromUserId).collection("buddies").doc(toUserId).delete();
        await db.collection("users").doc(toUserId).collection("buddies").doc(fromUserId).delete();
        logger.log(
          `Vänskap mellan ${fromUserId} och ${toUserId} togs bort pga status: ${after.status}`
        );
      } catch (error) {
        logger.error("Fel vid borttagning av vänskap:", error);
      }
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