// --- Imports ---
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");
const logger = require("firebase-functions/logger");
const { utcToZonedTime, format } = require('date-fns-tz');

// --- Init Firebase ---
admin.initializeApp();
const db = admin.firestore();

// --- Stripe Initialization with Environment Switching ---
const stripeConfig = functions.config().stripe;
const isEmulator = !!process.env.FUNCTIONS_EMULATOR;

let stripe;
let priceId;
let webhookSecret;

if (isEmulator) {
    logger.info("EMULATOR MODE: Using Stripe TEST keys.");
    if (!stripeConfig || !stripeConfig.test || !stripeConfig.test.secret || !stripeConfig.test.price || !stripeConfig.test.webhook_secret) {
        logger.error("Stripe TEST config is MISSING or incomplete in 'functions/.runtimeconfig.json'. Please set stripe.test.secret, stripe.test.price, and stripe.test.webhook_secret.", {
            hasConfig: !!stripeConfig,
            hasTest: !!stripeConfig?.test,
            hasSecret: !!stripeConfig?.test?.secret,
            hasPrice: !!stripeConfig?.test?.price,
            hasWebhook: !!stripeConfig?.test?.webhook_secret,
        });
        stripe = null;
    } else {
        stripe = require("stripe")(stripeConfig.test.secret);
        priceId = stripeConfig.test.price;
        webhookSecret = stripeConfig.test.webhook_secret;
        logger.info("Stripe TEST keys loaded successfully for emulator.");
    }
} else {
    logger.info("LIVE MODE: Using Stripe LIVE keys.");
    if (!stripeConfig || !stripeConfig.live || !stripeConfig.live.secret || !stripeConfig.live.price || !stripeConfig.live.webhook_secret) {
        logger.error("Stripe LIVE config is MISSING or incomplete in Firebase Functions configuration. Please set stripe.live.secret, stripe.live.price, and stripe.live.webhook_secret.", {
            hasConfig: !!stripeConfig,
            hasLive: !!stripeConfig?.live,
            hasSecret: !!stripeConfig?.live?.secret,
            hasPrice: !!stripeConfig?.live?.price,
            hasWebhook: !!stripeConfig?.live?.webhook_secret,
        });
        stripe = null;
    } else {
        stripe = require("stripe")(stripeConfig.live.secret);
        priceId = stripeConfig.live.price;
        webhookSecret = stripeConfig.live.webhook_secret;
        logger.info("Stripe LIVE keys loaded successfully.");
    }
}


// ---- VAPID Keys for Push Notifications ----
const vapidPublicKey = "BAZ9uP6JoKPu2ah3IGboVbSqUvRJF2dBAsUgfVqVYezguVIftFE_ZrIKpQmoHtA0RVMscEuGHdMZiLZn1UmSE90";
const vapidPrivateKey = functions.config().webpush ? functions.config().webpush.private_key : null;

if (vapidPrivateKey) {
  try {
    webpush.setVapidDetails(
      "info@flexibelfriskvardhalsa.se", // Replace with your contact email
      vapidPublicKey,
      vapidPrivateKey
    );
  } catch (error) {
    logger.error("VAPID details configuration failed at startup:", error);
  }
} else {
  logger.warn("WEBPUSH_PRIVATE_KEY is not set in functions config. Push notifications will be disabled.");
}

// ---- Helper function for sending push notifications ----
async function sendNotificationToUser(userId, payload, notificationType) {
  if (!vapidPrivateKey) {
    logger.warn(`Skipping notification for ${userId} because WEBPUSH_PRIVATE_KEY is not configured.`);
    return;
  }
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;
    const userData = userDoc.data();
    if (userData.notificationSettings && userData.notificationSettings[notificationType] === false) return;
    const subscriptions = userData.pushSubscriptions || [];
    if (subscriptions.length === 0) return;
    const promises = subscriptions.map((sub) =>
      webpush.sendNotification(sub, JSON.stringify(payload)).catch((error) => {
        logger.error("Error sending notification:", error?.message || error?.body || error.toString());
      })
    );
    await Promise.all(promises);
  } catch (err) {
    logger.error(`Error handling notification for ${userId}:`, err.message || err.toString());
  }
}

// ---- STRIPE: CREATE CHECKOUT SESSION (LIVE & LOCAL) ----
exports.createStripeCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Du måste vara inloggad för att starta ett köp.");
  }
  const uid = context.auth.uid;
  
  if (!stripe || !priceId) {
      logger.error("Stripe is not initialized or priceId is missing. Check config.", { hasStripe: !!stripe, hasPrice: !!priceId });
      throw new functions.https.HttpsError("internal", "Betalningssystemet är inte korrekt konfigurerat.");
  }
  
  const successUrl = isEmulator ? "http://localhost:5173/tack" : "https://flexibel-kostkollen.web.app/tack";
  const cancelUrl = isEmulator ? "http://localhost:5173/" : "https://flexibel-kostkollen.web.app/";
  
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Användardokument hittades inte.");
    }
    const userEmail = userDoc.data().email;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail,
      client_reference_id: uid,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return { sessionId: session.id };
  } catch (error) {
    logger.error("Stripe session creation failed for user:", uid, error);
    throw new functions.https.HttpsError("internal", "Kunde inte skapa betalningssessionen. Vänligen försök igen.");
  }
});


// ---- STRIPE WEBHOOK LISTENER ----
exports.stripeWebhook = functions.https.onRequest(async (request, response) => {
  if (!stripe || !webhookSecret) {
      logger.error("Stripe is not initialized or webhook secret is missing. Cannot process webhook.", { hasStripe: !!stripe, hasWebhook: !!webhookSecret });
      return response.status(500).send("Webhook handler is not configured.");
  }
  const signature = request.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);
  } catch (err) {
    logger.error("Webhook signature verification failed.", err);
    return response.sendStatus(400);
  }
  const dataObject = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      const userId = dataObject.client_reference_id;
      const stripeCustomerId = dataObject.customer;
      const stripeSubscriptionId = dataObject.subscription;
      await db.collection("users").doc(userId).update({
        "subscription.stripeCustomerId": stripeCustomerId,
        "subscription.stripeSubscriptionId": stripeSubscriptionId,
        "status": "active"
      });
      break;
    }
    case "invoice.payment_succeeded": {
      const subscriptionId = dataObject.subscription;
      const subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
      const userQuery = await db.collection("users").where("subscription.stripeSubscriptionId", "==", subscriptionId).limit(1).get();
      if (!userQuery.empty) {
        const userId = userQuery.docs[0].id;
        await db.collection("users").doc(userId).update({
          "subscription.active": true,
          "subscription.status": "active",
          "status": "active",
          "subscription.currentPeriodEnd": subscriptionDetails.current_period_end,
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscriptionId = dataObject.id;
      const userQuery = await db.collection("users").where("subscription.stripeSubscriptionId", "==", subscriptionId).limit(1).get();
      if (!userQuery.empty) {
        const userId = userQuery.docs[0].id;
        await db.collection("users").doc(userId).update({
          "subscription.active": false,
          "subscription.status": "canceled",
           "status": "approved"
        });
      }
      break;
    }
    default:
      logger.log(`Unhandled event type ${event.type}`);
  }
  response.sendStatus(200);
});

// ---- Notification Functions ----
exports.onFriendRequestCreated = functions.firestore.document("peppkompisRequests/{requestId}").onCreate(async (snapshot) => {
    const request = snapshot.data();
    if (!request) return;
    const payload = { title: "Ny peppkompis-förfrågan! 🎉", body: `${request.fromName} vill bli din peppkompis!`, icon: "/icons/icon-192x192.png", data: { url: "/?view=community&tab=requests" } };
    await sendNotificationToUser(request.toUid, payload, "friendRequests");
});
exports.onTimelineEventCreated = functions.firestore.document("communityTimeline/{eventId}").onCreate(async (snapshot) => {
    const event = snapshot.data();
    if (!event) return;
    const buddiesRef = db.collection("users").doc(event.userId).collection("buddies");
    const buddiesSnapshot = await buddiesRef.get();
    if (buddiesSnapshot.empty) return;
    const eventId = snapshot.id;
    const payload = { title: "Ny händelse i flödet!", body: `${event.userName} ${event.title}`, icon: "/icons/icon-192x192.png", data: { url: `/?view=community&highlight=${eventId}` } };
    const notificationPromises = buddiesSnapshot.docs.map((doc) => {
        const buddy = doc.data();
        if (buddy.uid !== event.userId) return sendNotificationToUser(buddy.uid, payload, "newEvents");
        return null;
    });
    await Promise.all(notificationPromises);
});
exports.onCommentCreated = functions.firestore.document("communityTimeline/{eventId}/comments/{commentId}").onCreate(async (snapshot, context) => {
    const comment = snapshot.data();
    const eventId = context.params.eventId;
    if (!comment) return;
    const eventDoc = await db.collection("communityTimeline").doc(eventId).get();
    if (!eventDoc.exists) return;
    const eventData = eventDoc.data();
    const eventOwnerId = eventData.userId;
    if (comment.authorUid === eventOwnerId) return;
    const payload = { title: "Ny kommentar! 💬", body: `${comment.authorName} kommenterade ditt inlägg: "${eventData.title}"`, icon: "/icons/icon-192x192.png", data: { url: `/?view=community&highlight=${eventId}` } };
    await sendNotificationToUser(eventOwnerId, payload, "comments");
});
  
// ---- Buddy Management Functions ----
exports.addMutualFriends = functions.firestore.document("peppkompisRequests/{requestId}").onUpdate(async (change) => {
    const after = change.after.data();
    if (change.before.data().status === "pending" && after.status === "accepted") {
        const fromUserId = after.fromUid;
        const toUserId = after.toUid;
        const fromUserDoc = await db.collection("users").doc(fromUserId).get();
        const toUserDoc = await db.collection("users").doc(toUserId).get();
        if (!fromUserDoc.exists || !toUserDoc.exists) {
            logger.error("Could not find one or both users for friendship.", {from: fromUserId, to: toUserId});
            return;
        }
        const fromUserData = fromUserDoc.data();
        const toUserData = toUserDoc.data();
        const buddyForFrom = { uid: toUserId, name: toUserData.displayName, email: toUserData.email, photoURL: toUserData.photoURL, gender: toUserData.gender };
        const buddyForTo = { uid: fromUserId, name: fromUserData.displayName, email: fromUserData.email, photoURL: fromUserData.photoURL, gender: fromUserData.gender };
        await db.collection("users").doc(fromUserId).collection("buddies").doc(toUserId).set(buddyForFrom);
        await db.collection("users").doc(toUserId).collection("buddies").doc(fromUserId).set(buddyForTo);
        logger.log(`Friendship created between ${fromUserId} and ${toUserId}`);
    }
});
exports.removeMutualFriends = functions.firestore.document("peppkompisRequests/{requestId}").onUpdate(async (change) => {
    if (change.before.data().status === "accepted" && (change.after.data().status === "removed" || change.after.data().status === "declined")) {
        const after = change.after.data();
        await db.collection("users").doc(after.fromUid).collection("buddies").doc(after.toUid).delete();
        await db.collection("users").doc(after.toUid).collection("buddies").doc(after.fromUid).delete();
        logger.log(`Friendship removed between ${after.fromUid} and ${after.toUid}`);
    }
});

// --- SCHEDULED REMINDER FUNCTION ---
exports.scheduledNotificationChecker = functions.pubsub.schedule('every 1 hours').onRun(async () => {
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
        const user = userDoc.data();
        const userId = userDoc.id;
        if (!user.timezone || !user.pushSubscriptions || user.pushSubscriptions.length === 0) continue;
        const localTime = utcToZonedTime(new Date(), user.timezone);
        const localHour = localTime.getHours();
        const todayDateString = format(localTime, "yyyy-MM-dd");
        if (localHour === 12 && user.notificationSettings?.waterReminder && user.lastWaterReminderSent !== todayDateString) {
            const waterLog = await db.collection('users').doc(userId).collection('waterLogs').doc(todayDateString).get();
            if (!waterLog.exists) {
                await sendNotificationToUser(userId, { title: "💧 Glöm inte vattnet!", body: "Kom ihåg att logga ditt vattenintag.", data: { url: "/?view=main" } }, "waterReminder");
                await db.collection('users').doc(userId).update({ lastWaterReminderSent: todayDateString });
            }
        }
        if (localHour === 18 && user.notificationSettings?.foodReminder && user.lastFoodReminderSent !== todayDateString) {
            await sendNotificationToUser(userId, { title: "🍽️ Middagstips!", body: "Har du loggat dagens mat ännu?", data: { url: "/?view=main" } }, "foodReminder");
            await db.collection('users').doc(userId).update({ lastFoodReminderSent: todayDateString });
        }
        const preferredDay = (user.preferredWeighInDay || 'monday').toLowerCase();
        const dayOfWeek = format(localTime, 'eeee', { timeZone: user.timezone }).toLowerCase();
        if (localHour === 8 && dayOfWeek === preferredDay && user.notificationSettings?.weighInReminder && user.lastWeighInReminderSent !== todayDateString) {
            await sendNotificationToUser(userId, { title: "⚖️ Dags för vägning!", body: "Idag är din planerade vägdag.", data: { url: "/?view=journey&tab=weight" } }, "weighInReminder");
            await db.collection('users').doc(userId).update({ lastWeighInReminderSent: todayDateString });
        }
    }
    return null;
});