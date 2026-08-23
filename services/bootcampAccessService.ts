import { UserProfileData, BootcampAccess, BootcampOnboardingTaskId } from '../types';
import { ALL_BOOTCAMP_ONBOARDING_TASKS, BOOTCAMP_DURATION_DAYS, BOOTCAMP_ONBOARDING_MAX_DAYS } from '../utils/accessControl';
import { updateUserDocument } from './firestoreService';

/**
 * Hjälpfunktion för att addera dagar till ett datum.
 */
function addDays(dateStrOrObj: string | Date, days: number): string {
  const d = new Date(dateStrOrObj);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Beviljar Bootcamp-åtkomst för en användare.
 * Denna funktion anropas efter genomfört köp (eller via simulerat köp i testverktyget).
 * 
 * @param userId Användarens unika Firebase Auth UID
 * @param purchaseDate Valfritt inköpsdatum i ISO-format (standard: nuvarande tid)
 */
export async function grantBootcampAccess(
  userId: string, 
  purchaseDate?: string
): Promise<BootcampAccess> {
  const nowIso = purchaseDate || new Date().toISOString();
  
  const newBootcampAccess: BootcampAccess = {
    purchaseDate: nowIso,
    onboardingCompletedDate: null,
    bootcampStartDate: null,
    accessExpiresDate: null,
    onboardingTasksCompleted: [],
  };

  await updateUserDocument(userId, {
    bootcampAccess: newBootcampAccess
  });

  return newBootcampAccess;
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
  if (!currentAccess || currentAccess.onboardingCompletedDate) {
    return currentAccess || null;
  }

  const existingCompleted = currentAccess.onboardingTasksCompleted || [];
  if (existingCompleted.includes(taskId)) {
    return currentAccess;
  }

  const updatedTasks = [...existingCompleted, taskId];
  const isAllCompleted = ALL_BOOTCAMP_ONBOARDING_TASKS.every(t => updatedTasks.includes(t));

  const updatedAccess: BootcampAccess = {
    ...currentAccess,
    onboardingTasksCompleted: updatedTasks,
  };

  if (isAllCompleted) {
    const now = new Date();
    const nowIso = now.toISOString();
    const todayStr = nowIso.split('T')[0];
    const expiryStr = addDays(now, BOOTCAMP_DURATION_DAYS);

    updatedAccess.onboardingCompletedDate = nowIso;
    updatedAccess.bootcampStartDate = todayStr;
    updatedAccess.accessExpiresDate = expiryStr;
  }

  await updateUserDocument(userId, {
    bootcampAccess: updatedAccess
  });

  return updatedAccess;
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

  const updatedAccess: BootcampAccess = {
    purchaseDate,
    onboardingCompletedDate: nowIso,
    bootcampStartDate: todayStr,
    accessExpiresDate: expiryStr,
    onboardingTasksCompleted: [...ALL_BOOTCAMP_ONBOARDING_TASKS],
  };

  await updateUserDocument(userId, {
    bootcampAccess: updatedAccess
  });

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

    await updateUserDocument(userId, {
      bootcampAccess: updatedAccess
    });

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

  await updateUserDocument(userId, {
    bootcampAccess: simulatedAccess
  });

  return simulatedAccess;
}

/**
 * Nollställer användarens Bootcamp-åtkomst.
 */
export async function resetBootcampAccess(userId: string): Promise<void> {
  await updateUserDocument(userId, {
    bootcampAccess: null as any
  });
}
