
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");
const logger = require("firebase-functions/logger");

admin.initializeApp();
const db = admin.firestore();

// ---- Stripe Konfiguration ----
const stripeSecretKey = functions.config().stripe ? functions.config().stripe.secret_key : null;
let stripe;
if (stripeSecretKey) {
    stripe = require("stripe")(stripeSecretKey);
} else {
    logger.warn("Stripe secret key is missing in functions config.");
}

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
          "mailto:support@kostloggen.se", // Uppdatera denna med din kontakt-email
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

  const validSubscriptions = [];
  let dirty = false;

  const promises = subscriptions.map((sub) =>
    webpush.sendNotification(sub, JSON.stringify(payload))
      .then(() => {
        // Lyckades skicka, behåll prenumerationen
        validSubscriptions.push(sub);
      })
      .catch((error) => {
        // Om prenumerationen är ogiltig (404/410), ta bort den.
        if (error.statusCode === 404 || error.statusCode === 410) {
          logger.warn(`Removing invalid subscription for user ${userId} (Status: ${error.statusCode})`);
          dirty = true;
        } else {
          // Vid andra fel (t.ex. 500), behåll den och försök igen senare, men logga felet.
          logger.error(`Error sending notification to user ${userId}:`, { errorBody: error.body });
          validSubscriptions.push(sub);
        }
      })
  );

  await Promise.all(promises);

  // Uppdatera användarens prenumerationer om vi tog bort några trasiga
  if (dirty) {
    await userDocRef.update({ pushSubscriptions: validSubscriptions });
  }
}

// ---- Betalningsfunktioner ----

exports.createSubscription = functions.region("us-central1").https.onCall(async (data, context) => {
    // 1. Autentisering
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in to create a subscription.");
    }

    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;
    const returnUrl = data.returnUrl || "https://kostloggen.se"; // Fallback URL

    // 2. Kontrollera Stripe-konfig
    if (!stripe) {
        logger.error("Stripe is not configured on the server.");
        throw new functions.https.HttpsError("failed-precondition", "Payment service is currently unavailable.");
    }

    try {
        // 3. Skapa Stripe Checkout Session
        // OBS: Ersätt 'price_...' med ditt faktiska Price ID från Stripe Dashboard.
        // Du kan också lägga detta i functions.config().stripe.price_id
        const priceId = functions.config().stripe.price_id || "price_1QkiwOGd3JxaW4hb...example"; 

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            customer_email: userEmail,
            client_reference_id: userId,
            success_url: `${returnUrl}?payment_success=true`,
            cancel_url: `${returnUrl}?payment_cancelled=true`,
            metadata: {
                userId: userId,
            },
        });

        logger.log(`Created Stripe session for user ${userId}: ${session.id}`);

        // 4. Returnera URL till frontend
        return { url: session.url };

    } catch (error) {
        logger.error("Error creating Stripe session:", error);
        throw new functions.https.HttpsError("internal", "Unable to create payment session.", error);
    }
});

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

// Milstolpar att peppa för: 7 dagar, 14, 21, 30, 50, 60, 90, 100, 150, 200, 300, 365
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

        // 1. INAKTIVITETSPÅMINNELSE: kl 10:00
        // Skicka om man inte loggat på 3 dagar (dvs lastLogDate är 3 dagar gammal eller mer)
        if (localHour === 10 && user.lastLogDate) {
            const lastLog = new Date(user.lastLogDate);
            const today = new Date(todayDateString);
            const diffTime = Math.abs(today - lastLog);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            // Om det gått exakt 3 dagar och vi inte redan skickat en påminnelse idag
            if (diffDays === 3 && user.lastInactivityReminderSent !== todayDateString) {
                const payload = {
                    notification: {
                        title: "Vi saknar dig! 🥺",
                        body: "Det var 3 dagar sedan du loggade. Kom tillbaka och håll dina vanor vid liv!",
                        icon: "/icons/icon-192x192.png",
                        badge: "/icons/badge-96x96.png",
                        data: { url: "/?view=main" },
                    }
                };
                await sendNotificationToUser(userId, payload, "inactivityReminder");
                await db.collection("users").doc(userId).update({ lastInactivityReminderSent: todayDateString });
            }
        }

        // 2. MILSTOLPE-PEPP: kl 19:00
        // Skicka om användaren är 1 dag ifrån en milstolpe och inte har loggat än idag
        if (localHour === 19 && user.currentStreak > 0) {
            const nextDayStreak = user.currentStreak + 1;
            
            // Kolla om nästa dags streak är en milstolpe
            if (MILESTONE_STREAKS.includes(nextDayStreak)) {
                // Kolla om de har loggat idag. Om user.lastLogDate INTE är idag, så behöver de logga för att nå milstolpen.
                if (user.lastLogDate !== todayDateString && user.lastMilestoneNudgeSentFor !== todayDateString) {
                    const payload = {
                        notification: {
                            title: "Du är så nära! 🔥",
                            body: `Logga idag för att nå en streak på ${nextDayStreak} dagar! Du fixar det!`,
                            icon: "/icons/icon-192x192.png",
                            badge: "/icons/badge-96x96.png",
                            data: { url: "/?view=main" },
                        }
                    };
                    await sendNotificationToUser(userId, payload, "milestoneNudge");
                    await db.collection("users").doc(userId).update({ lastMilestoneNudgeSentFor: todayDateString });
                }
            }
        }

        // 3. VATTENPÅMINNELSE: kl 12
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

        // 4. MATPÅMINNELSE: kl 18
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

        // 5. VÄGNINGS-PÅMINNELSE: kl 8 på föredragen dag
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

exports.manualSummarizeYesterday = functions
  .region("us-central1")
  .runWith({timeoutSeconds: 540, memory: "2GB"})
  .https.onCall(async (data, context) => {
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
    const allWriteOps = [];

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const user = userDoc.data();

        if (user.lastDateStreakChecked && user.lastDateStreakChecked >= yesterdayDateUID) {
            skippedCount++;
            continue;
        }
        if (!user.goals || typeof user.goals.calorieGoal !== "number") {
            logger.warn(`Skipping user ${userId} due to missing or invalid 'goals' field.`);
            skippedCount++;
            continue;
        }

        try {
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

            const newStreak = wasDaySuccessful ? (user.currentStreak || 0) + 1 : 0;
            const newHighestStreak = Math.max(user.highestStreak || 0, newStreak);
            const bankedAmountThisDay = wasDaySuccessful && totalNutrients.calories < user.goals.calorieGoal ?
                user.goals.calorieGoal - totalNutrients.calories : 0;

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
            allWriteOps.push({ref: summaryRef, data: summaryData, type: "set"});

            const userUpdate = {
                currentStreak: newStreak,
                highestStreak: newHighestStreak,
                lastDateStreakChecked: yesterdayDateUID,
                "weeklyBank.bankedCalories": admin.firestore.FieldValue.increment(bankedAmountThisDay),
            };
            allWriteOps.push({ref: userRef, data: userUpdate, type: "update"});
            
            processedCount++;
        } catch (error) {
            logger.error(`Failed during data gathering for user ${userId}:`, error);
            failedCount++;
        }
    }

    logger.log(`Gathered ${allWriteOps.length} write operations for ${processedCount} users. Committing in batches.`);
    const batchPromises = [];
    for (let i = 0; i < allWriteOps.length; i += 500) {
        const batch = db.batch();
        const chunk = allWriteOps.slice(i, i + 500);
        chunk.forEach((op) => {
            if (op.type === "set") {
                batch.set(op.ref, op.data, {merge: true});
            } else {
                batch.update(op.ref, op.data);
            }
        });
        batchPromises.push(batch.commit());
    }
    
    try {
        await Promise.all(batchPromises);
        logger.log(`Successfully committed ${batchPromises.length} batches.`);
    } catch (error) {
        logger.error("Error committing batches:", error);
        throw new functions.https.HttpsError("internal", "Failed to commit all user updates.", {originalError: error});
    }

    const message = `Summering klar. ${processedCount} användare bearbetades, ${failedCount} misslyckades, ${skippedCount} hoppades över.`;
    logger.log(`Manual summary finished. ${message}`);
    return {success: true, message: message};
});
