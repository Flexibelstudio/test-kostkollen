import { PastDaySummary, StreakSaver } from '../types';
import {
  STREAK_SAVER_MONTHLY_GRANT,
  STREAK_SAVER_MAX_BANKED,
  STREAK_SAVER_MAX_DAYS_BACK,
  STREAK_SAVER_MIN_DAYS_BACK,
} from '../constants';

/**
 * Livbojar och streak-kedjan pa ETT stalle.
 *
 * Streaken raknades tidigare om pa tre olika stallen med varsin kopia av samma
 * "consumedCalories > 0 ? +1 : 0". Med raddade dagar inblandade far de inte
 * langre gissa sjalva - da hade nasta omrakning tagit bort raddningen igen.
 */

/** En raddad dag. Bryter inte streaken, men raknar inte upp den heller. */
export const isRescuedDay = (summary?: PastDaySummary | null): boolean =>
  !!summary && summary.savedBy === 'streakSaver';

/**
 * Ett steg framat i kedjan. `prev` ar streaken efter foregaende dag.
 * Saknas dagen helt ar kedjan bruten.
 */
export const stepStreak = (prev: number, summary?: PastDaySummary | null): number => {
  if (!summary) return 0;
  if (isRescuedDay(summary)) return prev;
  return summary.consumedCalories > 0 ? prev + 1 : 0;
};

/** Tom dag = ingenting loggat. Bara sadana dagar far raddas. */
export const isEmptyDay = (summary?: PastDaySummary | null): boolean =>
  !summary || (!isRescuedDay(summary) && !(summary.consumedCalories > 0));

const startOfDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

/** Hur manga dygn bakat i tiden dateUID ligger, raknat fran today. */
export const daysBack = (dateUID: string, today = new Date()): number => {
  const target = startOfDay(new Date(`${dateUID}T00:00:00`));
  const diff = startOfDay(today).getTime() - target.getTime();
  return Math.round(diff / 86400000);
};

/** Standardvarde for en anvandare som aldrig haft livbojar. */
export const emptyStreakSaver = (monthKey: string): StreakSaver => ({
  available: STREAK_SAVER_MONTHLY_GRANT,
  lastGrantedMonth: monthKey,
  usedDates: [],
});

/**
 * Laser ut en giltig StreakSaver ur det som ligger i databasen. Aldre konton kan
 * ha den gamla formen { weekId, available: boolean } - den kastas och ersatts.
 */
export const normalizeStreakSaver = (raw: any, monthKey: string): StreakSaver => {
  if (!raw || typeof raw !== 'object' || typeof raw.available !== 'number') {
    return emptyStreakSaver(monthKey);
  }
  return {
    available: Math.max(0, Math.min(STREAK_SAVER_MAX_BANKED, Math.floor(raw.available))),
    lastGrantedMonth: typeof raw.lastGrantedMonth === 'string' ? raw.lastGrantedMonth : monthKey,
    usedDates: Array.isArray(raw.usedDates) ? raw.usedDates.filter((d: any) => typeof d === 'string') : [],
  };
};

/** YYYY-MM for ett datum. */
export const monthKeyOf = (dateUID: string): string => dateUID.slice(0, 7);

/**
 * Manadens pafyllning. Returnerar null om ingenting behover andras, annars den
 * uppdaterade posten. Kapas alltid mot taket.
 */
export const grantMonthlyIfDue = (saver: StreakSaver, todayUID: string): StreakSaver | null => {
  const currentMonth = monthKeyOf(todayUID);
  if (saver.lastGrantedMonth === currentMonth) return null;
  const available = Math.min(STREAK_SAVER_MAX_BANKED, saver.available + STREAK_SAVER_MONTHLY_GRANT);
  if (available === saver.available && saver.lastGrantedMonth === currentMonth) return null;
  return { ...saver, available, lastGrantedMonth: currentMonth };
};

export interface RescueEligibility {
  eligible: boolean;
  /** Kort forklaring nar det inte gar, avsedd att visas for anvandaren. */
  reason?: string;
}

/** Far den har dagen raddas just nu? */
export const canRescueDay = (
  dateUID: string,
  summary: PastDaySummary | undefined | null,
  saver: StreakSaver | null,
  today = new Date(),
  summaryStartDate?: string | null,
): RescueEligibility => {
  const back = daysBack(dateUID, today);
  if (back <= 0) return { eligible: false, reason: 'Dagen är inte slut än.' };
  if (back < STREAK_SAVER_MIN_DAYS_BACK) {
    return { eligible: false, reason: 'Gårdagen kan du fortfarande logga i efterhand – spara livbojen.' };
  }
  if (back > STREAK_SAVER_MAX_DAYS_BACK) {
    return { eligible: false, reason: `Det går bara att rädda dagar upp till ${STREAK_SAVER_MAX_DAYS_BACK} dagar tillbaka.` };
  }
  if (summaryStartDate && dateUID < summaryStartDate) {
    return { eligible: false, reason: 'Dagen ligger före din första loggade dag.' };
  }
  if (isRescuedDay(summary)) return { eligible: false, reason: 'Dagen är redan räddad.' };
  if (!isEmptyDay(summary)) return { eligible: false, reason: 'Du loggade faktiskt den här dagen – den behöver ingen livboj.' };
  if (!saver || saver.available <= 0) return { eligible: false, reason: 'Du har inga livbojar kvar den här månaden.' };
  return { eligible: true };
};

/** Sammanfattningen som skrivs for en raddad dag. */
export const buildRescuedSummary = (
  dateUID: string,
  existing: PastDaySummary | undefined | null,
  calorieGoal: number,
  goalType: string,
  streakForThisDay: number,
): PastDaySummary => ({
  date: dateUID,
  goalMet: false,
  consumedCalories: 0,
  calorieGoal: existing?.calorieGoal ?? calorieGoal,
  proteinGoalMet: false,
  consumedProtein: 0,
  proteinGoal: existing?.proteinGoal ?? 0,
  consumedCarbohydrates: 0,
  carbohydrateGoal: existing?.carbohydrateGoal ?? 0,
  consumedFat: 0,
  fatGoal: existing?.fatGoal ?? 0,
  goalType: (existing?.goalType ?? goalType) as any,
  waterGoalMet: false,
  streakForThisDay,
  savedBy: 'streakSaver',
});
