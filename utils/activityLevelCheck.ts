import { UserProfileData, ActivityLevel, PastDaySummary, WeightLogEntry } from '../types';
import { ACTIVITY_MULTIPLIERS } from '../constants';
import { calculateMifflinStJeorBMR } from './nutritionalCalculations';

/**
 * Verklighetskoll av aktivitetsnivån.
 *
 * Aktivitetsnivån sätts en gång vid registreringen och är en ren gissning, men
 * den väger tungt: multiplikatorn går från 1,2 till 1,9, vilket för många är
 * 500 kcal om dagen. Sitter den fel jagar användaren ett mål som aldrig kunnat
 * fungera - och skyller det på sig själv.
 *
 * Vågen är facit. Har någon ätit enligt sitt mål under en längre period vet vi
 * vad de faktiskt gör av med: intaget plus (eller minus) den energi som
 * vikten förändrats med. Därifrån räknar vi baklänges till vilken
 * aktivitetsnivå som stämmer.
 *
 * Modulen FÖRESLÅR bara. Den ändrar aldrig något själv, och den flyttar aldrig
 * mer än ett steg i taget.
 */

/** Energiinnehåll i ett kilo kroppsvikt. Grov men vedertagen tumregel. */
const KCAL_PER_KG = 7700;

/** Perioden som utvärderas. Kortare än så blir vattenvikt större än signalen. */
export const ACTIVITY_CHECK_PERIOD_DAYS = 28;

/** Fönstret i var ände som vikten medelvärdesbildas över. */
const WEIGHT_WINDOW_DAYS = 7;

/** Under den här loggningsgraden är intaget underskattat och svaret värdelöst. */
const MIN_LOGGING_RATIO = 0.8;

/** Utanför det här spannet är datan för brusig för att dra slutsatser av. */
const MIN_PLAUSIBLE_MULTIPLIER = 1.05;
const MAX_PLAUSIBLE_MULTIPLIER = 2.10;

/**
 * Hysteres. Den skattade multiplikatorn måste ligga en bit förbi gränsen mot
 * grannivån, annars börjar förslaget studsa fram och tillbaka varje vecka.
 */
const HYSTERESIS = 0.05;

/** Minsta tid mellan två förslag, så det inte blir tjat. */
export const MIN_DAYS_BETWEEN_SUGGESTIONS = 14;

export const ACTIVITY_LEVEL_ORDER: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Stillasittande',
  light: 'Lätt aktiv',
  moderate: 'Medelaktiv',
  active: 'Högaktiv',
  very_active: 'Mycket högaktiv',
};

export type ActivityCheckOutcome =
  | 'not_enough_data'
  | 'poor_logging'
  | 'implausible'
  | 'level_looks_right'
  | 'suggest_higher'
  | 'suggest_lower';

export interface ActivityLevelCheckResult {
  outcome: ActivityCheckOutcome;
  /** Kort förklaring på svenska av varför analysen inte gick att göra. */
  reason?: string;

  currentLevel?: ActivityLevel;
  suggestedLevel?: ActivityLevel;

  /** Vad profilen räknar med i dag. */
  currentTdee?: number;
  /** Vad datan säger att användaren faktiskt gör av med. */
  estimatedTdee?: number;
  /** Skattad multiplikator (estimerad TDEE delat med BMR). */
  impliedMultiplier?: number;

  avgDailyIntake?: number;
  weightDeltaKg?: number;
  periodDays?: number;
  loggingPercentage?: number;

  /** Sätts när stegdata funnits och pekar åt samma håll som vågen. */
  stepsSupport?: {
    avgDailySteps: number;
    agreesWithSuggestion: boolean;
  };
}

interface WeightWindowAverages {
  startAvg: number;
  endAvg: number;
  /** Faktiskt antal dygn mellan fönstrens tyngdpunkter. */
  spanDays: number;
}

/**
 * Medelvikt i början respektive slutet av perioden.
 *
 * Returnerar null om något av fönstren saknar mätningar. Det är med flit:
 * gissar man fram ett värde när vågen inte använts får man en viktförändring
 * som aldrig ägt rum, och hela slutsatsen bygger på den siffran.
 */
export function getWeightWindowAverages(
  weightLogs: WeightLogEntry[],
  todayMs: number,
  periodDays: number = ACTIVITY_CHECK_PERIOD_DAYS
): WeightWindowAverages | null {
  const msPerDay = 24 * 60 * 60 * 1000;
  const periodStart = todayMs - periodDays * msPerDay;
  const startWindowEnd = periodStart + WEIGHT_WINDOW_DAYS * msPerDay;
  const endWindowStart = todayMs - WEIGHT_WINDOW_DAYS * msPerDay;

  const startLogs = weightLogs.filter(l => l.loggedAt >= periodStart && l.loggedAt < startWindowEnd);
  const endLogs = weightLogs.filter(l => l.loggedAt >= endWindowStart && l.loggedAt <= todayMs);

  if (startLogs.length === 0 || endLogs.length === 0) return null;

  const mean = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;

  const startAvg = mean(startLogs.map(l => l.weightKg));
  const endAvg = mean(endLogs.map(l => l.weightKg));
  const startMeanTs = mean(startLogs.map(l => l.loggedAt));
  const endMeanTs = mean(endLogs.map(l => l.loggedAt));

  const spanDays = (endMeanTs - startMeanTs) / msPerDay;
  if (spanDays < 14) return null;

  return { startAvg, endAvg, spanDays };
}

/** Aktivitetsnivån vars multiplikator ligger närmast ett värde. */
export function nearestActivityLevel(multiplier: number): ActivityLevel {
  return ACTIVITY_LEVEL_ORDER.reduce((best, level) =>
    Math.abs(ACTIVITY_MULTIPLIERS[level] - multiplier) <
    Math.abs(ACTIVITY_MULTIPLIERS[best] - multiplier)
      ? level
      : best
  );
}

/** Steg per dag omsatt till den aktivitetsnivå de brukar motsvara. */
export function activityLevelFromSteps(avgDailySteps: number): ActivityLevel {
  if (avgDailySteps < 5000) return 'sedentary';
  if (avgDailySteps < 7500) return 'light';
  if (avgDailySteps < 10000) return 'moderate';
  if (avgDailySteps < 12500) return 'active';
  return 'very_active';
}

export interface ActivityLevelCheckParams {
  userProfile: UserProfileData;
  pastDaysSummary: PastDaySummary[];
  weightLogs: WeightLogEntry[];
  /** Snitt av dagliga steg, när det finns. Bekräftar bara - avgör aldrig. */
  avgDailySteps?: number;
  todayMs?: number;
  periodDays?: number;
}

export function runActivityLevelCheck({
  userProfile,
  pastDaysSummary,
  weightLogs,
  avgDailySteps,
  todayMs = Date.now(),
  periodDays = ACTIVITY_CHECK_PERIOD_DAYS,
}: ActivityLevelCheckParams): ActivityLevelCheckResult {
  const { currentWeightKg, heightCm, ageYears, gender, activityLevel } = userProfile;

  if (!currentWeightKg || !heightCm || !ageYears || !gender || !activityLevel) {
    return { outcome: 'not_enough_data', reason: 'Profilen saknar uppgifter som behövs för uträkningen.' };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const periodStartMs = todayMs - periodDays * msPerDay;

  // Dagar i perioden med loggad mat.
  const daysInPeriod = pastDaysSummary.filter(s => {
    const ts = new Date(s.date).getTime();
    return ts >= periodStartMs && ts <= todayMs;
  });
  const loggedDays = daysInPeriod.filter(s => s.consumedCalories > 0);
  const loggingPercentage = periodDays > 0 ? loggedDays.length / periodDays : 0;

  if (loggedDays.length < 14) {
    return {
      outcome: 'not_enough_data',
      reason: `Bara ${loggedDays.length} loggade dagar i perioden. Analysen kräver minst 14.`,
      loggingPercentage,
    };
  }

  if (loggingPercentage < MIN_LOGGING_RATIO) {
    // Med luckor i loggen ser intaget lägre ut än det är, och då framstår
    // förbrukningen som högre. Att föreslå en höjd nivå på det underlaget
    // vore att belöna slarvig loggning med ett högre kalorimål.
    return {
      outcome: 'poor_logging',
      reason: 'För många dagar saknar loggning för att intaget ska gå att lita på.',
      loggingPercentage,
    };
  }

  const weights = getWeightWindowAverages(weightLogs, todayMs, periodDays);
  if (!weights) {
    return {
      outcome: 'not_enough_data',
      reason: 'Det saknas vägningar i början eller slutet av perioden.',
      loggingPercentage,
    };
  }

  const avgDailyIntake =
    loggedDays.reduce((sum, s) => sum + s.consumedCalories, 0) / loggedDays.length;

  const weightDeltaKg = weights.endAvg - weights.startAvg;

  // Energibalans: gick vikten ner har mer förbrukats än vad som ätits.
  const estimatedTdee = avgDailyIntake - (weightDeltaKg * KCAL_PER_KG) / weights.spanDays;

  const bmr = calculateMifflinStJeorBMR(currentWeightKg, heightCm, ageYears, gender);
  const impliedMultiplier = estimatedTdee / bmr;

  const base = {
    currentLevel: activityLevel,
    currentTdee: Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]),
    estimatedTdee: Math.round(estimatedTdee),
    impliedMultiplier: Number(impliedMultiplier.toFixed(3)),
    avgDailyIntake: Math.round(avgDailyIntake),
    weightDeltaKg: Number(weightDeltaKg.toFixed(2)),
    periodDays: Math.round(weights.spanDays),
    loggingPercentage,
  };

  if (
    impliedMultiplier < MIN_PLAUSIBLE_MULTIPLIER ||
    impliedMultiplier > MAX_PLAUSIBLE_MULTIPLIER
  ) {
    // Utanför det fysiologiskt rimliga betyder nästan alltid att något i
    // underlaget är fel - inte att användaren är en outlier.
    return {
      ...base,
      outcome: 'implausible',
      reason: 'Siffrorna går inte ihop tillräckligt bra för att dra en slutsats.',
    };
  }

  const currentIndex = ACTIVITY_LEVEL_ORDER.indexOf(activityLevel);
  const currentMultiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  const target = nearestActivityLevel(impliedMultiplier);
  const targetIndex = ACTIVITY_LEVEL_ORDER.indexOf(target);

  if (targetIndex === currentIndex) {
    return { ...base, outcome: 'level_looks_right' };
  }

  const direction = targetIndex > currentIndex ? 1 : -1;
  const neighbourIndex = currentIndex + direction;
  const neighbour = ACTIVITY_LEVEL_ORDER[neighbourIndex];
  const neighbourMultiplier = ACTIVITY_MULTIPLIERS[neighbour];

  // Hysteres: kräv att värdet passerat mittpunkten mot grannivån med marginal.
  const midpoint = (currentMultiplier + neighbourMultiplier) / 2;
  const passedMidpoint =
    direction > 0
      ? impliedMultiplier > midpoint + HYSTERESIS
      : impliedMultiplier < midpoint - HYSTERESIS;

  if (!passedMidpoint) {
    return { ...base, outcome: 'level_looks_right' };
  }

  const result: ActivityLevelCheckResult = {
    ...base,
    outcome: direction > 0 ? 'suggest_higher' : 'suggest_lower',
    // Aldrig mer än ett steg i taget, hur långt ifrån datan än pekar.
    suggestedLevel: neighbour,
  };

  if (typeof avgDailySteps === 'number' && avgDailySteps > 0) {
    const stepLevelIndex = ACTIVITY_LEVEL_ORDER.indexOf(activityLevelFromSteps(avgDailySteps));
    result.stepsSupport = {
      avgDailySteps: Math.round(avgDailySteps),
      agreesWithSuggestion:
        direction > 0 ? stepLevelIndex > currentIndex : stepLevelIndex < currentIndex,
    };
  }

  return result;
}

/**
 * Har det gått tillräckligt lång tid sedan förra förslaget?
 */
export function shouldOfferActivitySuggestion(
  lastSuggestedDate: string | undefined,
  todayStr: string
): boolean {
  if (!lastSuggestedDate) return true;
  const days = Math.floor(
    (new Date(todayStr).getTime() - new Date(lastSuggestedDate).getTime()) / (24 * 60 * 60 * 1000)
  );
  return days >= MIN_DAYS_BETWEEN_SUGGESTIONS;
}
