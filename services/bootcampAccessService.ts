import { UserProfileData, BootcampAccess, BootcampOnboardingTaskId } from '../types';
import { ALL_BOOTCAMP_ONBOARDING_TASKS, BOOTCAMP_DURATION_DAYS, BOOTCAMP_ONBOARDING_MAX_DAYS } from '../utils/accessControl';
import { updateUserDocument } from './firestoreService';
import { isTestingToolAllowed } from '../utils/testingToolHostnames';
import { SOLO_COHORT_ID } from './bootcampService';

/**
 * Hjälpfunktion för att addera dagar till ett datum.
 */
function addDays(dateStrOrObj: string | Date, days: number): string {
  const d = new Date(dateStrOrObj);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Säkerställer att en solo-trupp finns när Bootcampen startar.
 * Åtkomstmodellen (bootcampAccess) och truppmodellen (bootcampCohorts/participants)
 * är två separata system – utan detta anrop tror appen att användaren inte går någon
 * Bootcamp, och Kurssidan visar säljvyn i stället för programmet.
 */
async function ensureSoloBootcampParticipant(userId: string): Promise<void> {
  try {
    const { getUserActiveBootcamp, joinSoloBootcamp } = await import('./bootcampService');
    const existing = await getUserActiveBootcamp(userId);
    if (existing) return;
    await joinSoloBootcamp(userId);
  } catch (e) {
    console.error('Kunde inte skapa solo-trupp vid Bootcamp-start:', e);
  }
}

/**
 * Initierar köpflödet för General Börjes 12-veckors Bootcamp.
 * Detta är den ENDA tillåtna vägen till köp från produktionsgränssnittet
 * och är den centrala integrationspunkten där Stripe Checkout ansluts.
 * 
 * Observera: Denna funktion får ALDRIG anropa grantBootcampAccess direkt.
 * Åtkomst beviljas uteslutande via backend / Stripe Webhook (Firebase Admin SDK) efter verifierad betalning.
 * 
 * @param userId Användarens unika Firebase Auth UID
 */
export async function startBootcampCheckout(userId?: string): Promise<void> {
  // Enda vägen till köp från produktionsgränssnittet. Går via Cloud Function
  // createCheckoutSession, vars webhook sedan skriver bootcampAccess med Admin SDK.
  // Klienten skriver aldrig åtkomstfältet själv – se firestore.rules.
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const createSession = httpsCallable(functions, 'createCheckoutSession');

  const result = await createSession({
    returnUrl: window.location.origin,
    mode: 'payment',
    cohortId: SOLO_COHORT_ID,
  });

  const url = (result.data as any)?.url;
  if (!url) {
    throw new Error('Kunde inte starta betalningen. Försök igen.');
  }

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('pending_checkout_type', 'bootcamp');
  }
  window.location.href = url;
}

/**
 * Initierar köpflödet för abonnemang (månadsprenumeration efter examen/bootcamp).
 * Detta är den centrala integrationspunkten där Stripe Checkout för abonnemang ansluts.
 * 
 * @param userId Användarens unika Firebase Auth UID
 * @param coachStyle Vald coach-stil för det fortsatta abonnemanget
 */
export async function startSubscriptionCheckout(userId?: string, coachStyle?: string): Promise<void> {
  // === STRIPE SUBSCRIPTION CHECKOUT INTEGRATIONSPUNKT ===
  // Här kopplas Stripe-checkout in via Cloud Functions, t.ex.:
  // const functions = getFunctions();
  // const createSession = httpsCallable(functions, 'createSubscriptionSession');
  // const result = await createSession({ mode: 'subscription', coachStyle, returnUrl: window.location.origin });
  // window.location.href = result.data.url;
  
  // Tills Stripe är driftsatt för abonnemang i produktion:
  throw new Error("Abonnemangsbetalning via Stripe är inte konfigurerad ännu. Kontakta support.");
}

/**
 * Sparar att examensflödet har visats för användaren, datum och användarens beslut.
 * Uppdaterar även vald coach om användaren valde en ny coach under examen.
 */
export async function recordBootcampGraduation(
  userId: string,
  currentAccess: BootcampAccess | undefined | null,
  decision: 'accepted' | 'declined' | 'dismissed',
  chosenCoachStyle?: string
): Promise<BootcampAccess> {
  const updatedAccess: BootcampAccess = {
    ...(currentAccess || {
      purchaseDate: new Date().toISOString(),
      onboardingCompletedDate: new Date().toISOString(),
      bootcampStartDate: new Date().toISOString().split('T')[0],
      accessExpiresDate: new Date().toISOString().split('T')[0],
      onboardingTasksCompleted: [...ALL_BOOTCAMP_ONBOARDING_TASKS],
    }),
    graduationSeen: true,
    graduationSeenAt: new Date().toISOString(),
    graduationDecision: decision,
  };

  // Examensbeslutet är inte betalningskritiskt och skrivs till ett eget fält,
  // eftersom bootcampAccess bara får skrivas av servern.
  const updatePayload: Record<string, any> = {
    bootcampGraduation: {
      seen: true,
      seenAt: new Date().toISOString(),
      decision,
    }
  };

  if (chosenCoachStyle) {
    updatePayload.coachStyle = chosenCoachStyle;
  }

  await updateUserDocument(userId, updatePayload);
  return updatedAccess;
}

/**
 * Beviljar Bootcamp-åtkomst för en användare.
 * Denna funktion är ENBART tillåten i utvecklings- och testmiljöer bakom värdnamnsspärr.
 * I produktion skrivs bootcampAccess enbart via säkra backend-webhooks (Firebase Admin SDK).
 * 
 * @param userId Användarens unika Firebase Auth UID
 * @param purchaseDate Valfritt inköpsdatum i ISO-format (standard: nuvarande tid)
 */
/**
 * Skriver bootcampAccess via Cloud Function (Admin SDK), eftersom klienten
 * inte får röra fältet. Funktionen på serversidan vägrar köra i produktion.
 */
async function setBootcampAccessViaServer(bootcampAccess: BootcampAccess | null, userFields?: Record<string, any>): Promise<void> {
  if (!isTestingToolAllowed()) {
    throw new Error('Simulerade Bootcamp-tillstånd är spärrade utanför tillåtna testmiljöer.');
  }
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const devGrant = httpsCallable(getFunctions(), 'devGrantBootcampAccess');
  await devGrant({ bootcampAccess, userFields });
}

export async function grantBootcampAccess(
  userId: string,
  purchaseDate?: string
): Promise<BootcampAccess> {
  // Säkerhetsspärr: Avbryt omedelbart om anrop sker från otillåtet värdnamn
  if (!isTestingToolAllowed()) {
    console.warn('[SECURITY] grantBootcampAccess blockerades: Får endast anropas i godkända testmiljöer.');
    throw new Error('grantBootcampAccess är spärrad utanför tillåtna testmiljöer.');
  }

  // bootcampAccess får inte skrivas av klienten – Firestore-reglerna nekar det.
  // Skrivningen sker därför i en Cloud Function med Admin SDK, som i sin tur
  // vägrar köra i produktionsprojektet. Två oberoende spärrar.
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const devGrant = httpsCallable(functions, 'devGrantBootcampAccess');
  const result = await devGrant({ purchaseDate });
  return (result.data as any).bootcampAccess as BootcampAccess;
}

/**
 * Registrerar en slutförd uppgift i Grundutbildningen.
 * Om alla 5 uppgifter därmed är klara aktiveras Bootcampen automatiskt och 12-veckorsperioden startar!
 */
export async function completeBootcampOnboardingTask(
  userId: string,
  taskId: BootcampOnboardingTaskId,
  currentProfile: UserProfileData
): Promise<BootcampAccess | null> {
  const currentAccess = currentProfile.bootcampAccess;
  const onboarding = currentProfile.bootcampOnboarding;
  if (!currentAccess || onboarding?.completedAt || currentAccess.onboardingCompletedDate) {
    return currentAccess || null;
  }

  const existingCompleted = onboarding?.tasksCompleted || currentAccess.onboardingTasksCompleted || [];
  if (existingCompleted.includes(taskId)) {
    return currentAccess;
  }

  const updatedTasks = [...existingCompleted, taskId];
  const isAllCompleted = ALL_BOOTCAMP_ONBOARDING_TASKS.every(t => updatedTasks.includes(t));

  // Framstegen skrivs till bootcampOnboarding – bootcampAccess är betalningskritiskt
  // och får bara skrivas av Stripe-webhooken via Admin SDK.
  const onboardingUpdate = {
    tasksCompleted: updatedTasks,
    completedAt: isAllCompleted ? new Date().toISOString() : (currentProfile.bootcampOnboarding?.completedAt || null),
  };

  await updateUserDocument(userId, {
    bootcampOnboarding: onboardingUpdate
  });

  if (isAllCompleted) {
    await ensureSoloBootcampParticipant(userId);
  }

  return { ...currentAccess, onboardingTasksCompleted: updatedTasks };
}

/**
 * Slutför alla 5 uppgifter i Grundutbildningen direkt och startar Bootcampens 12 veckor.
 */
export async function completeAllBootcampOnboardingTasks(
  userId: string,
  currentProfile: UserProfileData
): Promise<BootcampAccess | null> {
  const currentAccess = currentProfile.bootcampAccess;
  const purchaseDate = currentAccess?.purchaseDate || new Date().toISOString();

  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = nowIso.split('T')[0];
  const expiryStr = addDays(now, BOOTCAMP_DURATION_DAYS);

  await updateUserDocument(userId, {
    bootcampOnboarding: {
      tasksCompleted: [...ALL_BOOTCAMP_ONBOARDING_TASKS],
      completedAt: nowIso,
    }
  });

  const updatedAccess: BootcampAccess = {
    ...(currentAccess || {} as BootcampAccess),
    purchaseDate,
    onboardingCompletedDate: nowIso,
    bootcampStartDate: todayStr,
    accessExpiresDate: currentAccess?.accessExpiresDate || expiryStr,
    onboardingTasksCompleted: [...ALL_BOOTCAMP_ONBOARDING_TASKS],
  };

  await ensureSoloBootcampParticipant(userId);

  return updatedAccess;
}

/**
 * Kontrollerar om grundutbildningens tidsfrist på 3 dygn har löpt ut och startar Bootcampen automatiskt om så är fallet.
 */
export async function checkAndAdvanceBootcampAccess(
  userId: string,
  currentProfile: UserProfileData
): Promise<{ updated: boolean; bootcampAccess: BootcampAccess | null }> {
  const access = currentProfile.bootcampAccess;
  if (!access || !access.purchaseDate || access.onboardingCompletedDate) {
    return { updated: false, bootcampAccess: access || null };
  }

  const purchaseTime = new Date(access.purchaseDate).getTime();
  const nowTime = Date.now();
  const msIn3Days = BOOTCAMP_ONBOARDING_MAX_DAYS * 24 * 60 * 60 * 1000;

  // Har mer än 3 dygn passerat sedan köpet?
  if (nowTime - purchaseTime >= msIn3Days) {
    // Startdatum sätts till köpdatum + 3 dygn
    const autoStartDate = new Date(purchaseTime + msIn3Days);
    const startDateStr = autoStartDate.toISOString().split('T')[0];
    const expiryStr = addDays(autoStartDate, BOOTCAMP_DURATION_DAYS);

    const updatedAccess: BootcampAccess = {
      ...access,
      onboardingCompletedDate: autoStartDate.toISOString(),
      bootcampStartDate: startDateStr,
      accessExpiresDate: expiryStr,
    };

    // Ingen skrivning av bootcampAccess här: läget härleds i accessControl utifrån
    // purchaseDate + grundutbildningens längd. Fältet ägs av Stripe-webhooken.
    await ensureSoloBootcampParticipant(userId);

    return { updated: true, bootcampAccess: updatedAccess };
  }

  return { updated: false, bootcampAccess: access };
}

/**
 * Simulerar förflyttning i programmet till en godtycklig dag (för testverktyget).
 * 
 * @param dayInProgram Dag 1 till 85 (85 = utgången åtkomst)
 */
export async function setBootcampAccessProgramDay(
  userId: string,
  currentProfile: UserProfileData,
  dayInProgram: number
): Promise<BootcampAccess> {
  const msPerDay = 24 * 60 * 60 * 1000;
  const now = new Date();
  
  // Startdatum beräknas bakåt från nuvarande datum baserat på vald dag
  const startTime = now.getTime() - ((dayInProgram - 1) * msPerDay);
  const startDate = new Date(startTime);
  const startDateStr = startDate.toISOString().split('T')[0];
  const expiryDateStr = addDays(startDate, BOOTCAMP_DURATION_DAYS);

  const purchaseDate = new Date(startTime - (2 * msPerDay)).toISOString();

  const simulatedAccess: BootcampAccess = {
    purchaseDate,
    onboardingCompletedDate: startDate.toISOString(),
    bootcampStartDate: startDateStr,
    accessExpiresDate: expiryDateStr,
    onboardingTasksCompleted: [...ALL_BOOTCAMP_ONBOARDING_TASKS],
  };

  await setBootcampAccessViaServer(simulatedAccess);

  return simulatedAccess;
}

/**
 * Nollställer användarens Bootcamp-åtkomst.
 */
export async function resetBootcampAccess(userId: string): Promise<void> {
  await setBootcampAccessViaServer(null);
}

/**
 * TESTVERKTYG: Simulerar en fullföljd Bootcamp (grad General, streak >= 80) vars åtkomst har gått ut.
 * Nollställer även graduationSeen så att examensflödet visas.
 */
export async function simulateExpiredBootcampCompleted(userId: string): Promise<BootcampAccess> {
  const msPerDay = 24 * 60 * 60 * 1000;
  const now = new Date();
  const startDate = new Date(now.getTime() - (86 * msPerDay));
  const startDateStr = startDate.toISOString().split('T')[0];
  const expiryDate = new Date(now.getTime() - (1 * msPerDay));
  const expiryDateStr = expiryDate.toISOString().split('T')[0];
  const purchaseDate = new Date(startDate.getTime() - (2 * msPerDay)).toISOString();

  const simulatedAccess: BootcampAccess = {
    purchaseDate,
    onboardingCompletedDate: startDate.toISOString(),
    bootcampStartDate: startDateStr,
    accessExpiresDate: expiryDateStr,
    onboardingTasksCompleted: [...ALL_BOOTCAMP_ONBOARDING_TASKS],
    graduationSeen: false,
    graduationSeenAt: null,
    graduationDecision: null,
  };

  await setBootcampAccessViaServer(simulatedAccess, {
    highestBootcampStreak: 84,
    currentStreak: 84,
    hasCompletedBootcamp: true,
    subscriptionStatus: 'inactive'
  });

  return simulatedAccess;
}

/**
 * TESTVERKTYG: Simulerar en ej fullföljd Bootcamp (streak < 80) vars åtkomst har gått ut.
 * Nollställer även graduationSeen så att den öppna dörren visas.
 */
export async function simulateExpiredBootcampIncomplete(userId: string): Promise<BootcampAccess> {
  const msPerDay = 24 * 60 * 60 * 1000;
  const now = new Date();
  const startDate = new Date(now.getTime() - (86 * msPerDay));
  const startDateStr = startDate.toISOString().split('T')[0];
  const expiryDate = new Date(now.getTime() - (1 * msPerDay));
  const expiryDateStr = expiryDate.toISOString().split('T')[0];
  const purchaseDate = new Date(startDate.getTime() - (2 * msPerDay)).toISOString();

  const simulatedAccess: BootcampAccess = {
    purchaseDate,
    onboardingCompletedDate: startDate.toISOString(),
    bootcampStartDate: startDateStr,
    accessExpiresDate: expiryDateStr,
    onboardingTasksCompleted: [...ALL_BOOTCAMP_ONBOARDING_TASKS],
    graduationSeen: false,
    graduationSeenAt: null,
    graduationDecision: null,
  };

  await setBootcampAccessViaServer(simulatedAccess, {
    highestBootcampStreak: 16,
    currentStreak: 0,
    hasCompletedBootcamp: false,
    subscriptionStatus: 'inactive'
  });

  return simulatedAccess;
}

/**
 * TESTVERKTYG: Nollställer att examen visats så att examensflödet kan köras om.
 */
export async function resetBootcampGraduationStatus(userId: string, currentAccess?: BootcampAccess | null): Promise<BootcampAccess> {
  const updatedAccess: BootcampAccess = {
    ...(currentAccess || {
      purchaseDate: new Date(Date.now() - 90 * 86400000).toISOString(),
      onboardingCompletedDate: new Date(Date.now() - 88 * 86400000).toISOString(),
      bootcampStartDate: new Date(Date.now() - 87 * 86400000).toISOString().split('T')[0],
      accessExpiresDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      onboardingTasksCompleted: [...ALL_BOOTCAMP_ONBOARDING_TASKS],
    }),
    graduationSeen: false,
    graduationSeenAt: null,
    graduationDecision: null,
  };

  await setBootcampAccessViaServer(updatedAccess);

  return updatedAccess;
}
