import { UserProfileData, BootcampAccess, BootcampOnboardingTaskId } from '../types';
import { 
  BOOTCAMP_PRICE_SEK, 
  BOOTCAMP_PRICE_LABEL, 
  BOOTCAMP_DURATION_WEEKS, 
  BOOTCAMP_DURATION_DAYS, 
  BOOTCAMP_ONBOARDING_MAX_DAYS 
} from '../constants/pricing';

export { 
  BOOTCAMP_PRICE_SEK, 
  BOOTCAMP_PRICE_LABEL, 
  BOOTCAMP_DURATION_WEEKS, 
  BOOTCAMP_DURATION_DAYS, 
  BOOTCAMP_ONBOARDING_MAX_DAYS 
};

export const ALL_BOOTCAMP_ONBOARDING_TASKS: BootcampOnboardingTaskId[] = [
  'log_meal_photo',
  'log_meal_search',
  'log_water',
  'weigh_in_and_goal',
  'read_morning_briefing'
];

export interface BootcampOnboardingTaskMeta {
  id: BootcampOnboardingTaskId;
  title: string;
  description: string;
  actionLabel: string;
}

export const BOOTCAMP_ONBOARDING_TASKS_META: Record<BootcampOnboardingTaskId, BootcampOnboardingTaskMeta> = {
  log_meal_photo: {
    id: 'log_meal_photo',
    title: 'Logga en måltid med foto',
    description: 'Rikta kameran mot tallriken. AI analyserar dina kalorier och makros.',
    actionLabel: 'Ta foto'
  },
  log_meal_search: {
    id: 'log_meal_search',
    title: 'Logga en måltid med sökning',
    description: 'Sök bland livsmedel eller skriv in din mat manuellt.',
    actionLabel: 'Sök mat'
  },
  log_water: {
    id: 'log_water',
    title: 'Logga vatten',
    description: 'Registrera ditt vätskeintag. Minst 2 liter rent vatten per dag krävs.',
    actionLabel: 'Logga vatten'
  },
  weigh_in_and_goal: {
    id: 'weigh_in_and_goal',
    title: 'Väg in och sätt ditt mål',
    description: 'Registrera din startvikt och kalibrera din målsättning.',
    actionLabel: 'Väg in / Mål'
  },
  read_morning_briefing: {
    id: 'read_morning_briefing',
    title: 'Läs en morgonbriefing',
    description: 'Öppna din dagliga rapport för att få taktiska instruktioner.',
    actionLabel: 'Morgonbriefing'
  }
};

/**
 * Central funktion för att avgöra om en användare har behörighet och full åtkomst till appen.
 * 
 * Regler:
 * 1. Coacher och Administratörer har alltid full åtkomst.
 * 2. Användare med aktivt abonnemang eller pågående provperiod ('active', 'trialing', 'canceling') har åtkomst.
 * 3. Användare med giltig Bootcamp-åtkomst har åtkomst:
 *    - Under grundutbildningsfasen (högst 3 dagar efter köp).
 *    - Under de 12 programmveckorna fram till och med accessExpiresDate.
 */
export function hasAppAccess(userProfile?: UserProfileData | null): boolean {
  if (!userProfile) return false;

  // Coacher och administratörer har alltid åtkomst
  if (userProfile.role === 'coach' || userProfile.role === 'admin') {
    return true;
  }

  // 1. Aktiv prenumeration / provperiod
  const subStatus = userProfile.subscriptionStatus;
  const isSubscriptionActive = subStatus === 'active' || subStatus === 'trialing' || subStatus === 'canceling';
  if (isSubscriptionActive) {
    return true;
  }

  // 2. Giltig Bootcamp-åtkomst
  const bAccess = userProfile.bootcampAccess;
  if (bAccess && bAccess.purchaseDate) {
    // Om utgångsdatumet finns, kontrollera om dagens datum är före eller samma dag
    if (bAccess.accessExpiresDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      const expiryStr = bAccess.accessExpiresDate.split('T')[0];
      return todayStr <= expiryStr;
    }
    // Under grundutbildningen (innan accessExpiresDate har satts) har användaren full tillgång
    return true;
  }

  return false;
}

export interface BootcampAccessDetails {
  hasAccess: boolean;
  hasBootcamp: boolean;
  isOnboarding: boolean;
  isBootcampActive: boolean;
  isExpired: boolean;
  purchaseDate: string | null;
  onboardingCompletedDate: string | null;
  bootcampStartDate: string | null;
  accessExpiresDate: string | null;
  daysRemaining: number | null;
  daysInProgram: number | null;
  onboardingTasksCompleted: BootcampOnboardingTaskId[];
  onboardingProgressPercent: number;
  onboardingDaysLeft: number;
}

/**
 * Returnerar detaljerad status kring Bootcamp-åtkomst och grundutbildning.
 */
export function getBootcampAccessDetails(userProfile?: UserProfileData | null): BootcampAccessDetails {
  const defaultDetails: BootcampAccessDetails = {
    hasAccess: hasAppAccess(userProfile),
    hasBootcamp: false,
    isOnboarding: false,
    isBootcampActive: false,
    isExpired: false,
    purchaseDate: null,
    onboardingCompletedDate: null,
    bootcampStartDate: null,
    accessExpiresDate: null,
    daysRemaining: null,
    daysInProgram: null,
    onboardingTasksCompleted: [],
    onboardingProgressPercent: 0,
    onboardingDaysLeft: 0,
  };

  if (!userProfile?.bootcampAccess?.purchaseDate) {
    return defaultDetails;
  }

  const access = userProfile.bootcampAccess;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const purchaseTime = new Date(access.purchaseDate).getTime();
  const nowTime = now.getTime();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSincePurchase = Math.floor((nowTime - purchaseTime) / msPerDay);
  const onboardingDaysLeft = Math.max(0, BOOTCAMP_ONBOARDING_MAX_DAYS - daysSincePurchase);

  const completedTasks = access.onboardingTasksCompleted || [];
  const progressPercent = Math.round((completedTasks.length / ALL_BOOTCAMP_ONBOARDING_TASKS.length) * 100);

  const isOnboarding = !access.onboardingCompletedDate;

  let daysRemaining: number | null = null;
  let daysInProgram: number | null = null;
  let isExpired = false;
  let isBootcampActive = false;

  if (access.bootcampStartDate && access.accessExpiresDate) {
    const startTime = new Date(access.bootcampStartDate).getTime();
    const expiryTime = new Date(access.accessExpiresDate).getTime();
    
    daysInProgram = Math.max(1, Math.floor((nowTime - startTime) / msPerDay) + 1);
    daysRemaining = Math.max(0, Math.ceil((expiryTime - nowTime) / msPerDay));
    
    const expiryStr = access.accessExpiresDate.split('T')[0];
    isExpired = todayStr > expiryStr;
    isBootcampActive = !isExpired;
  }

  return {
    hasAccess: hasAppAccess(userProfile),
    hasBootcamp: true,
    isOnboarding,
    isBootcampActive,
    isExpired,
    purchaseDate: access.purchaseDate,
    onboardingCompletedDate: access.onboardingCompletedDate,
    bootcampStartDate: access.bootcampStartDate,
    accessExpiresDate: access.accessExpiresDate,
    daysRemaining,
    daysInProgram,
    onboardingTasksCompleted: completedTasks,
    onboardingProgressPercent: progressPercent,
    onboardingDaysLeft,
  };
}
