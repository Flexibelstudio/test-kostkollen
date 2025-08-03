const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");
const logger = require("firebase-functions/logger");
const { utcToZonedTime, format } = require('date-fns-tz');

admin.initializeApp();
const db = admin.firestore();

// ---- VAPID-nycklar ----
const vapidPublicKey = "BAZ9uP6JoKPu2ah3IGboVbSqUvRJF2dBAsUgfVqVYezguVIftFE_ZrIKpQmoHtA0RVMscEuGHdMZiLZn1UmSE90";
const vapidPrivateKey = functions.config().webpush ? functions.config().webpush.private_key : null;

if (vapidPrivateKey) {
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
    logger.warn("WEBPUSH_PRIVATE_KEY is not set in functions config. Push notifications will be disabled.");
}

// ---- Hjälpfunktion för pushnotiser ----
async function sendNotificationToUser(userId, payload, notificationType) {
  if (!vapidPrivateKey) {
      logger.warn(`Skipping notification for ${userId} because WEBPUSH_PRIVATE_KEY is not configured.`);
      return;
  }
  const userDocRef = db.collection("users").doc(userId);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists) return;
  const userData = userDoc.data();

  if (userData.notificationSettings && userData.notificationSettings[notificationType] === false) return;

  const subscriptions = userData.pushSubscriptions || [];
  if (subscriptions.length === 0) return;

  const promises = subscriptions.map((sub) =>
    webpush.sendNotification(sub, JSON.stringify(payload)).catch((error) => {
      logger.error("Fel vid sändning av notis:", error.body);
    })
  );
  await Promise.all(promises);
}

// ---- Notis-funktioner ----

// 1. Peppkompisförfrågan skapad (notis)
exports.onFriendRequestCreated = functions.firestore
  .document("peppkompisRequests/{requestId}")
  .onCreate(async (snapshot) => {
    const request = snapshot.data();
    if (!request) return;

    const payload = {
      title: "Ny peppkompis-förfrågan! 🎉",
      body: `${request.fromName} vill bli din peppkompis!`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-96x96.png",
      data: {
        url: "/?view=community&tab=requests"
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

    const eventId = snapshot.id; // <-- Hämta ID:t för händelsen

    const payload = {
      title: "Ny händelse i flödet!",
      body: `${event.userName} har ${event.title}`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-96x96.png",
      data: { // <-- Lägg till detta objekt
        url: `/?view=community&highlight=${eventId}`
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
    const eventId = context.params.eventId; // <-- ID för huvudhändelsen
    if (!comment) return;

    const eventRef = db.collection("communityTimeline").doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) return;

    const eventData = eventDoc.data();
    const eventOwnerId = eventData.userId;

    if (comment.authorUid === eventOwnerId) return;

    const payload = {
      title: "Ny kommentar! 💬",
      body: `${comment.authorName} kommenterade ditt inlägg: "${eventData.title}"`,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-96x96.png",
      data: { // <-- Lägg till detta objekt
        url: `/?view=community&highlight=${eventId}`
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

  // --- SCHEMALAGD PUSHNOTIS-FUNKTION FÖR PÅMINNELSER ---

exports.scheduledNotificationChecker = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();
      const userId = userDoc.id;

      // Skippa om ingen timezone eller push subscription
      if (!user.timezone || !user.pushSubscriptions || user.pushSubscriptions.length === 0) continue;

      // Lokal tid
      const localTime = utcToZonedTime(new Date(), user.timezone);
      const localHour = localTime.getHours();
      const todayDateString = format(localTime, "yyyy-MM-dd");

      // --- VATTENPÅMINNELSE: kl 12 ---
      if (
        localHour === 12 && // Bara 12:00 lokal tid
        user.notificationSettings?.waterReminder !== false && // Ej avstängd
        user.lastWaterReminderSent !== todayDateString // Inte redan skickad idag
      ) {
        const waterLog = await db
          .collection('users')
          .doc(userId)
          .collection('waterLogs')
          .doc(todayDateString)
          .get();
        
        let needsWaterReminder = false;
        if (!waterLog.exists) {
          needsWaterReminder = true;
        } else {
          const waterData = waterLog.data();
          if (waterData && waterData.waterLoggedMl <= 0) {
            needsWaterReminder = true;
          }
        }

        if (needsWaterReminder) {
          // Skicka pushnotis
          for (const subscription of user.pushSubscriptions) {
            await webpush.sendNotification(subscription, JSON.stringify({
              title: "💧 Glöm inte vattnet!",
              body: "Kom ihåg att logga ditt vattenintag.",
              icon: "/icons/icon-192x192.png",
              badge: "/icons/badge-96x96.png",
              data: { url: "/?view=main" }
            })).catch(console.error);
          }
          // Notera att påminnelse skickad
          await db.collection('users').doc(userId).update({
            lastWaterReminderSent: todayDateString
          });
        }
      }

      // --- MATPÅMINNELSE: kl 18 ---
      if (
        localHour === 18 &&
        user.notificationSettings?.foodReminder !== false &&
        user.lastFoodReminderSent !== todayDateString
      ) {
        // Kontrollera om det finns några matloggar för idag
        const mealLogsQuery = db
          .collection('users')
          .doc(userId)
          .collection('mealLogs')
          .where('dateString', '==', todayDateString)
          .limit(1);
        
        const mealLogsSnapshot = await mealLogsQuery.get();

        if (mealLogsSnapshot.empty) {
            // Skicka pushnotis
            for (const subscription of user.pushSubscriptions) {
              await webpush.sendNotification(subscription, JSON.stringify({
                title: "🍽️ Middagstips!",
                body: "Har du loggat dagens mat ännu? Missa inte att fylla i din kostlogg.",
                icon: "/icons/icon-192x192.png",
                badge: "/icons/badge-96x96.png",
                data: { url: "/?view=main" }
              })).catch(console.error);
            }
            // Notera att påminnelse skickad
            await db.collection('users').doc(userId).update({
              lastFoodReminderSent: todayDateString
            });
        }
      }

      // --- VÄGNINGS-PÅMINNELSE: kl 8 måndag (eller preferred day) ---
      const preferredDay = user.preferredWeighInDay || 'monday';
      const dayOfWeek = localTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (
        localHour === 8 &&
        dayOfWeek === preferredDay.toLowerCase() &&
        user.notificationSettings?.weighInReminder !== false &&
        user.lastWeighInReminderSent !== todayDateString
      ) {
        // Skicka pushnotis
        for (const subscription of user.pushSubscriptions) {
          await webpush.sendNotification(subscription, JSON.stringify({
            title: "⚖️ Dags för vägning!",
            body: "Idag är din planerade vägdag. Kom ihåg att logga din vikt för att följa dina framsteg!",
            icon: "/icons/icon-192x192.png",
            badge: "/icons/badge-96x96.png",
            data: { url: "/?view=journey&tab=weight" }
          })).catch(console.error);
        }
        // Notera att påminnelse skickad
        await db.collection('users').doc(userId).update({
          lastWeighInReminderSent: todayDateString
        });
      }

      // --- Fler påminnelser kan läggas till här ---
    }
    return null;
  });