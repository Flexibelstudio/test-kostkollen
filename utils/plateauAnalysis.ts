import { 
  UserProfileData, 
  GoalSettings, 
  PastDaySummary, 
  WeightLogEntry, 
  LoggedMeal, 
  CoachStyle, 
  PlateauAnalysisResult, 
  PlateauAnalysisState, 
  PlateauLoggingGapAnalysis, 
  PlateauAlternativeAction, 
  PlateauAdjustment, 
  PlateauAnalysisStatus 
} from '../types';
import { calculateMifflinStJeorBMR, calculateTDEE } from './nutritionalCalculations';

export const PLATEAU_MEDICAL_DISCLAIMER = 
  "Detta är allmänna råd och inte medicinsk rådgivning. Den som har en sjukdom eller medicinerar bör rådgöra med sin läkare innan större kostförändringar.";

export interface PlateauAnalysisParams {
  userProfile: UserProfileData;
  goals: GoalSettings;
  pastDaysSummary: PastDaySummary[];
  weightLogs: WeightLogEntry[];
  recentMealLogs?: LoggedMeal[];
  todayDateStr?: string; // YYYY-MM-DD
  forceAnalysis?: boolean;
}

/**
 * Beräknar skillnaden i dagar mellan två datumsträngar (YYYY-MM-DD).
 */
export const getDaysBetweenDates = (startDateStr: string, endDateStr: string): number => {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Hämtar dagens datum i YYYY-MM-DD (Europe/Stockholm).
 */
export const getTodayKeySE = (): string => {
  const z = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
  const y = z.getFullYear();
  const m = String(z.getMonth() + 1).padStart(2, "0");
  const d = String(z.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Kontrollerar om en platåanalys bör genomföras idag.
 * Villkor:
 * 1. Minst 21 dagars historik sedan målet sattes eller sedan användaren började logga.
 * 2. Högst en gång per vecka (minst 7 dagar sedan förra analysen), såvida inte en aktiv mätvecka nyss slutförts.
 */
export const shouldRunPlateauAnalysis = (
  userProfile: UserProfileData,
  pastDaysSummary: PastDaySummary[],
  todayStr: string = getTodayKeySE(),
  force: boolean = false
): { shouldRun: boolean; reason?: string } => {
  if (force) return { shouldRun: true };

  // Endast relevant för fettminskning / viktnedgång
  if (userProfile.goalType !== 'lose_fat') {
    return { shouldRun: false, reason: 'Platåanalys är endast aktiv för mål med viktnedgång eller fettminskning.' };
  }

  const plateauState = userProfile.plateauAnalysis;

  // Kontrollera om en mätvecka är aktiv och nu har pågått i minst 7 dagar
  if (plateauState?.measuringWeekActive && plateauState.measuringWeekStartDate) {
    const daysSinceMätveckaStart = getDaysBetweenDates(plateauState.measuringWeekStartDate, todayStr);
    if (daysSinceMätveckaStart >= 7) {
      return { shouldRun: true, reason: 'Mätveckan är slutförd och redo för utvärdering.' };
    } else {
      return { 
        shouldRun: false, 
        reason: `Mätvecka pågår (dag ${daysSinceMätveckaStart + 1} av 7).` 
      };
    }
  }

  // Max en gång per vecka (minst 7 dagar sedan förra analysen)
  if (plateauState?.lastPlateauAnalysisDate) {
    const daysSinceLastAnalysis = getDaysBetweenDates(plateauState.lastPlateauAnalysisDate, todayStr);
    if (daysSinceLastAnalysis < 7) {
      return { shouldRun: false, reason: `Analys gjordes för ${daysSinceLastAnalysis} dagar sedan (max en gång per vecka).` };
    }
  }

  // Kontrollera att det finns minst 21 dagars sammanhängande period
  const goalStartDateStr = userProfile.goalStartDate;
  if (goalStartDateStr) {
    const daysSinceGoalStart = getDaysBetweenDates(goalStartDateStr, todayStr);
    if (daysSinceGoalStart < 21) {
      return { shouldRun: false, reason: `Målet sattes för ${daysSinceGoalStart} dagar sedan (kräver minst 21 dagar).` };
    }
  } else {
    // Om inget goalStartDate finns, kolla äldsta loggade dagen i sammanställningen
    const dates = pastDaysSummary.map(s => s.date).sort();
    if (dates.length < 21) {
      return { shouldRun: false, reason: `Endast ${dates.length} dagars data finns (kräver minst 21 dagar).` };
    }
    const oldestDate = dates[0];
    const daysFromOldest = getDaysBetweenDates(oldestDate, todayStr);
    if (daysFromOldest < 21) {
      return { shouldRun: false, reason: `Perioden är ${daysFromOldest} dagar (kräver minst 21 dagar).` };
    }
  }

  return { shouldRun: true };
};

/**
 * Beräknar 7-dagars glidande medelvärden i början och slutet av en 21-dagarsperiod.
 */
interface RollingAverageResult {
  startAvgWeight: number;
  endAvgWeight: number;
  weightDelta: number;
  startAvgFat?: number;
  endAvgFat?: number;
  fatDelta?: number;
  startAvgMuscle?: number;
  endAvgMuscle?: number;
  muscleDelta?: number;
}

export const calculatePeriodRollingAverages = (
  weightLogs: WeightLogEntry[],
  currentWeightKg: number = 70,
  currentFatKg?: number,
  currentMuscleKg?: number,
  periodDays: number = 21,
  todayStr: string = getTodayKeySE()
): RollingAverageResult => {
  const sortedLogs = [...weightLogs].sort((a, b) => a.loggedAt - b.loggedAt);
  const nowTs = new Date(todayStr).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  const startWindowEndTs = nowTs - ((periodDays - 7) * msPerDay);
  const startWindowStartTs = nowTs - (periodDays * msPerDay);
  const endWindowStartTs = nowTs - (7 * msPerDay);

  // Mätningar i startfönstret (dag 1–7 i 21-dagarsperioden)
  const startLogs = sortedLogs.filter(
    l => l.loggedAt >= startWindowStartTs && l.loggedAt <= startWindowEndTs
  );

  // Mätningar i slutfönstret (dag 15–21 i 21-dagarsperioden)
  const endLogs = sortedLogs.filter(
    l => l.loggedAt >= endWindowStartTs && l.loggedAt <= (nowTs + msPerDay)
  );

  // Vikt-medelvärden
  const startAvgWeight = startLogs.length > 0
    ? startLogs.reduce((acc, l) => acc + l.weightKg, 0) / startLogs.length
    : (sortedLogs[0]?.weightKg || currentWeightKg);

  const endAvgWeight = endLogs.length > 0
    ? endLogs.reduce((acc, l) => acc + l.weightKg, 0) / endLogs.length
    : currentWeightKg;

  const weightDelta = Number((endAvgWeight - startAvgWeight).toFixed(2));

  // InBody-mätvärden (fett och muskler)
  const startFatLogs = startLogs.filter(l => typeof l.bodyFatMassKg === 'number');
  const endFatLogs = endLogs.filter(l => typeof l.bodyFatMassKg === 'number');

  let startAvgFat: number | undefined;
  let endAvgFat: number | undefined;
  let fatDelta: number | undefined;

  if (startFatLogs.length > 0 || endFatLogs.length > 0 || typeof currentFatKg === 'number') {
    startAvgFat = startFatLogs.length > 0
      ? startFatLogs.reduce((acc, l) => acc + (l.bodyFatMassKg || 0), 0) / startFatLogs.length
      : (sortedLogs.find(l => typeof l.bodyFatMassKg === 'number')?.bodyFatMassKg || currentFatKg);

    endAvgFat = endFatLogs.length > 0
      ? endFatLogs.reduce((acc, l) => acc + (l.bodyFatMassKg || 0), 0) / endFatLogs.length
      : currentFatKg;

    if (startAvgFat !== undefined && endAvgFat !== undefined) {
      fatDelta = Number((endAvgFat - startAvgFat).toFixed(2));
    }
  }

  const startMuscleLogs = startLogs.filter(l => typeof l.skeletalMuscleMassKg === 'number');
  const endMuscleLogs = endLogs.filter(l => typeof l.skeletalMuscleMassKg === 'number');

  let startAvgMuscle: number | undefined;
  let endAvgMuscle: number | undefined;
  let muscleDelta: number | undefined;

  if (startMuscleLogs.length > 0 || endMuscleLogs.length > 0 || typeof currentMuscleKg === 'number') {
    startAvgMuscle = startMuscleLogs.length > 0
      ? startMuscleLogs.reduce((acc, l) => acc + (l.skeletalMuscleMassKg || 0), 0) / startMuscleLogs.length
      : (sortedLogs.find(l => typeof l.skeletalMuscleMassKg === 'number')?.skeletalMuscleMassKg || currentMuscleKg);

    endAvgMuscle = endMuscleLogs.length > 0
      ? endMuscleLogs.reduce((acc, l) => acc + (l.skeletalMuscleMassKg || 0), 0) / endMuscleLogs.length
      : currentMuscleKg;

    if (startAvgMuscle !== undefined && endAvgMuscle !== undefined) {
      muscleDelta = Number((endAvgMuscle - startAvgMuscle).toFixed(2));
    }
  }

  return {
    startAvgWeight: Number(startAvgWeight.toFixed(1)),
    endAvgWeight: Number(endAvgWeight.toFixed(1)),
    weightDelta,
    startAvgFat: startAvgFat !== undefined ? Number(startAvgFat.toFixed(1)) : undefined,
    endAvgFat: endAvgFat !== undefined ? Number(endAvgFat.toFixed(1)) : undefined,
    fatDelta,
    startAvgMuscle: startAvgMuscle !== undefined ? Number(startAvgMuscle.toFixed(1)) : undefined,
    endAvgMuscle: endAvgMuscle !== undefined ? Number(endAvgMuscle.toFixed(1)) : undefined,
    muscleDelta,
  };
};

/**
 * Analyserar loggningskvalitet och identifierar luckor utan att döma.
 */
export const analyzeLoggingQuality = (
  pastDays: PastDaySummary[],
  bmr: number,
  periodDays: number = 21,
  recentMealLogs?: LoggedMeal[],
  todayStr: string = getTodayKeySE()
): PlateauLoggingGapAnalysis => {
  const now = new Date(todayStr);
  const cutoffDate = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // Filtrera de senaste 21 dagarna
  const periodSummaries = pastDays.filter(s => s.date >= cutoffStr && s.date <= todayStr);
  
  // Dagar med faktisk matloggning (> 0 kcal)
  const loggedDays = periodSummaries.filter(s => s.consumedCalories > 0);
  const totalDays = periodDays;
  const loggingPercentage = Math.round((loggedDays.length / totalDays) * 100);

  // 1. Dagar med orimligt lågt intag (< 60% av BMR, tecken på glömd loggning)
  const lowIntakeThreshold = bmr * 0.60;
  const lowIntakeDaysCount = loggedDays.filter(s => s.consumedCalories < lowIntakeThreshold).length;

  // 2. Skillnad mellan vardag och helg
  const weekdayCalories: number[] = [];
  const weekendCalories: number[] = [];

  loggedDays.forEach(s => {
    const dayOfWeek = new Date(s.date).getDay();
    // 0 = Söndag, 6 = Lördag
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendCalories.push(s.consumedCalories);
    } else {
      weekdayCalories.push(s.consumedCalories);
    }
  });

  const weekdayAvgCalories = weekdayCalories.length > 0
    ? Math.round(weekdayCalories.reduce((a, b) => a + b, 0) / weekdayCalories.length)
    : 0;

  const weekendAvgCalories = weekendCalories.length > 0
    ? Math.round(weekendCalories.reduce((a, b) => a + b, 0) / weekendCalories.length)
    : 0;

  const diffKcal = Math.abs(weekendAvgCalories - weekdayAvgCalories);
  const hasSignificantDifference = diffKcal >= 300 && weekendCalories.length >= 2 && weekdayCalories.length >= 5;

  // 3. Dagar där kvällsmåltider (middag/kvällsmat) saknas
  let missingDinnerDaysCount = 0;
  if (recentMealLogs && recentMealLogs.length > 0) {
    const mealsByDate: { [date: string]: LoggedMeal[] } = {};
    recentMealLogs.forEach(m => {
      if (!mealsByDate[m.dateString]) mealsByDate[m.dateString] = [];
      mealsByDate[m.dateString].push(m);
    });

    Object.entries(mealsByDate).forEach(([dateStr, meals]) => {
      if (dateStr >= cutoffStr && dateStr <= todayStr) {
        const hasDinnerOrSnack = meals.some(m => m.mealType === 'dinner' || m.mealType === 'snack');
        if (!hasDinnerOrSnack && meals.length > 0) {
          missingDinnerDaysCount++;
        }
      }
    });
  }

  // 4. Dagar där vatten/dryck inte loggats
  const missingDrinksCount = periodSummaries.filter(s => !s.waterGoalMet).length;

  return {
    lowIntakeDaysCount,
    weekendVsWeekdayDifference: {
      hasSignificantDifference,
      weekdayAvgCalories,
      weekendAvgCalories,
      diffKcal,
    },
    missingDinnerDaysCount,
    missingDrinksCount,
    totalDays,
    loggedDays: loggedDays.length,
    loggingPercentage,
  };
};

/**
 * Beräknar säkra kalori- och makrojusteringar med hårda spärrar.
 */
export const calculateSafeAdjustment = (
  userProfile: UserProfileData,
  currentCalorieGoal: number,
  bmr: number,
  reductionCount: number
): PlateauAdjustment => {
  // Absolut golv: 1400 kcal för kvinnor, 1600 kcal för män
  const absoluteFloor = userProfile.gender === 'male' ? 1600 : 1400;
  
  // Effektivt golv: Högsta av BMR och det absoluta golvet
  const effectiveHardFloor = Math.max(Math.round(bmr), absoluteFloor);

  // Maximal sänkning: max 10% och max 200 kcal
  const maxTenPercent = Math.round(currentCalorieGoal * 0.10);
  const rawReduction = Math.min(maxTenPercent, 200);

  // Föreslaget mål med spärr mot golvet
  let proposedCalorieGoal = currentCalorieGoal - rawReduction;
  let isFloorReached = false;

  if (proposedCalorieGoal < effectiveHardFloor) {
    proposedCalorieGoal = effectiveHardFloor;
    isFloorReached = true;
  }

  const reductionAmountKcal = currentCalorieGoal - proposedCalorieGoal;
  const reductionsRemaining = Math.max(0, 2 - (reductionCount + 1));

  return {
    currentCalorieGoal,
    proposedCalorieGoal,
    reductionAmountKcal,
    isFloorReached,
    bmr: Math.round(bmr),
    hardFloor: effectiveHardFloor,
    reductionsRemaining,
  };
};

/**
 * Skapar standardiserade alternativa åtgärder som alltid lyfts FÖRE kalorisänkning.
 */
export const getPlateauAlternativeActions = (
  userProfile: UserProfileData,
  tdee: number
): PlateauAlternativeAction[] => {
  return [
    {
      id: 'steps',
      title: 'Öka ditt dagliga stegmål',
      description: 'Lägg till 2 000 steg per dag för att höja energiförbrukningen.',
      rationale: 'Ett enkelt sätt att öka förbrukningen utan att behöva dra ner på maten eller påverka återhämtningen negativt.'
    },
    {
      id: 'protein',
      title: 'Höj ditt proteinintag',
      description: 'Sikta på 1,8–2,0 g protein per kg kroppsvikt.',
      rationale: 'Protein mättar bäst, har högst termogen effekt och säkerställer att det är fett och inte muskelmassa som förbränns.'
    },
    {
      id: 'strength',
      title: 'Lägg till ett styrkepass i veckan',
      description: 'Ett extra helkroppspass stimulerar proteinsyntesen och vilometabolismen.',
      rationale: 'Styrketräning ger signalen till kroppen att behålla aktiv muskelvävnad under energiunderskott.'
    },
    {
      id: 'diet_break',
      title: 'Ta en 7 dagars diet break på balansnivå',
      description: `Ät på din underhållsnivå (${Math.round(tdee)} kcal) i 7 dagar.`,
      rationale: 'Det kan låta kontraintuitivt, men en planerad paus återställer leptinnivåer, minskar stresshormoner och bryter ofta en fastlåst platå.'
    }
  ];
};

/**
 * Genererar coachspecifika texter för Börje, Erik och Maja.
 * Samma slutsats och siffror, men anpassat tonläge. Inga emojis. Ingen skuldbeläggning.
 */
export const generateCoachBriefingText = (
  coachStyle: CoachStyle,
  userName: string,
  status: PlateauAnalysisStatus,
  measurementMethod: 'inbody' | 'scale',
  data: {
    weightDelta?: number;
    fatDelta?: number;
    muscleDelta?: number;
    loggingPercentage: number;
    loggingGaps?: PlateauLoggingGapAnalysis;
    adjustment?: PlateauAdjustment;
    tdee: number;
    bmr: number;
    reductionsRemaining?: number;
  }
): string => {
  const name = userName || 'du';
  const isBorje = coachStyle === 'hard';
  const isErik = coachStyle === 'balanced';
  const isMaja = coachStyle === 'soft';

  // --- FALL 1: För låg loggningsgrad (< 80%) ---
  if (status === 'low_logging_rate') {
    if (isBorje) {
      return `Platåanalys för ${name}: Du har loggat ${data.loggingPercentage}% av dagarna den senaste 3-veckorsperioden. Det är för lite data för att dra slutsatser om din plan. Problemet ligger inte i målet, utan i kontinuiteten. Lösning: logga varje måltid under de kommande 7 dagarna så att vi har en stabil grund att analysera.`;
    } else if (isErik) {
      return `Analys av dina senaste 21 dagar för ${name}: Din loggningsgrad är ${data.loggingPercentage}%. För en tillförlitlig analys behöver vi minst 80% fullständiga dagar. Det betyder att det inte är din kaloribalans som behöver justeras, utan regelbundenheten i rapporteringen. Låt oss fokusera på att logga konsekvent den kommande veckan för att få fram rätt beslutsunderlag.`;
    } else {
      return `Hej ${name}! Jag har tittat på dina senaste tre veckor. Du har loggat maten ${data.loggingPercentage}% av dagarna. Det är helt okej, men det gör att vi inte riktigt kan se vad som händer i kroppen ännu. Det är alltså inte din plan det är fel på. Ska vi hjälpas åt att få till en vecka där du loggar varje dag, så att vi kan se hur det känns och fungerar?`;
    }
  }

  // --- FALL 2: InBody Kroppsrekomposition (Fett minskar, muskler ökar/vikten still) ---
  if (status === 'recomposition_progress') {
    const fatText = data.fatDelta ? Math.abs(data.fatDelta).toFixed(1).replace('.', ',') : '0,5';
    const muscleText = data.muscleDelta && data.muscleDelta > 0 ? data.muscleDelta.toFixed(1).replace('.', ',') : '0,3';

    if (isBorje) {
      return `Mätanalys: Vikten har stått stilla, men mätningen visar att du har minskat ${fatText} kg fett och ökat ${muscleText} kg i muskelmassa. Detta är ingen platå. Det är ren kroppsrekomposition. Planen fungerar precis som den ska. Vi ändrar ingenting i kalorierna. Fortsätt på inslagen väg.`;
    } else if (isErik) {
      return `Positiv analys: Din totalvikt har varit stabil, men kroppssammansättningen har förändrats till det bättre. Du har minskat fettmassan med ${fatText} kg och samtidigt ökat muskelmassan med ${muscleText} kg. Muskler har högre densitet än fett, vilket förklarar varför vågen står stilla. Din nuvarande plan ger optimala resultat, så vi behåller ditt nuvarande kalori- och proteinmål.`;
    } else {
      return `Hej ${name}! Titta här på dina mätvärden: även om vågen inte rört sig mycket så har du tappat hela ${fatText} kg fett och byggt ${muscleText} kg muskler! Det här är fantastiska nyheter och kallas kroppsrekomposition. Din kropp formar om sig och blir starkare. Vi ändrar ingenting i din mat, du gör ett jättefint jobb!`;
    }
  }

  // --- FALL 3: Jämn fettminskning pågår ---
  if (status === 'fat_loss_steady') {
    if (isBorje) {
      return `Statusrapport: 7-dagars glidande medelvärde visar en stabil nedgång på ${Math.abs(data.weightDelta || 0.4).toFixed(1).replace('.', ',')} kg över perioden. Ingen platå föreligger. Håll i disciplinen och kör vidare.`;
    } else if (isErik) {
      return `Analysen visar att din trendkurva rör sig nedåt i en sund takt (${Math.abs(data.weightDelta || 0.4).toFixed(1).replace('.', ',')} kg över 21 dagar baserat på 7-dagars medelvärde). Ingen justering krävs, din energibalans ligger helt rätt.`;
    } else {
      return `Hej ${name}! Din trend visar att du rör dig stadigt framåt i en trygg och hållbar takt. Vi fortsätter med din nuvarande plan, den ger dig fin energi och fina resultat!`;
    }
  }

  // --- FALL 4: Platå identifierad -> Föreslå Mätvecka först (Del 3) ---
  if (status === 'measuring_week_recommended') {
    const gaps = data.loggingGaps;
    let gapObservation = '';
    if (gaps?.weekendVsWeekdayDifference.hasSignificantDifference) {
      gapObservation = `Det finns en märkbar skillnad mellan intaget på vardagar (${gaps.weekendVsWeekdayDifference.weekdayAvgCalories} kcal) och helger (${gaps.weekendVsWeekdayDifference.weekendAvgCalories} kcal).`;
    } else if (gaps && gaps.lowIntakeDaysCount >= 2) {
      gapObservation = `Vissa dagar har ett rapporterat intag under 60% av ditt BMR, vilket ofta tyder på att någon måltid fallit bort ur loggen.`;
    } else if (gaps && gaps.missingDinnerDaysCount >= 2) {
      gapObservation = `Kvällsmåltider saknas på flera av dagarna.`;
    } else {
      gapObservation = `Innan vi drar slutsatsen att energibehovet minskat behöver vi säkerställa att allt kommer med.`;
    }

    if (isBorje) {
      return `Platåidentifiering: Vikten har legat stilla de senaste 21 dagarna. Vi sänker inte maten i blindo. ${gapObservation} Uppdrag: Vi genomför en 7 dagars Mätvecka där precis allt loggas i detalj, inklusive dryck och småportioner. När veckan är klar utvärderar vi om en justering faktiskt behövs.`;
    } else if (isErik) {
      return `Analys av platå: Ditt 7-dagars glidande medelvärde har planat ut under 3 veckor. ${measurementMethod === 'scale' ? 'Eftersom vi använder vanlig våg kan vi inte skilja på vätskeretention och fettmassa enbart på siffran.' : ''} ${gapObservation} Mitt förslag är en gemensam felsökning genom en 7 dagars Mätvecka. Vi loggar noggrant i 7 dagar för att få ett exakt facit innan vi rör din kaloribudget.`;
    } else {
      return `Hej ${name}! Jag ser att vågen har tagit en paus de senaste veckorna. Det är helt naturligt och händer alla förr eller senare. ${gapObservation} I stället för att stressa eller äta mindre vill jag att vi gör en Mätvecka tillsammans: 7 dagar där vi hjälps åt att logga allt så noggrant vi kan, även drycker och små mellanmål. Efter det ser vi om vi behöver skruva på något!`;
    }
  }

  // --- FALL 5: Mätvecka pågår ---
  if (status === 'measuring_week_in_progress') {
    if (isBorje) {
      return `Mätvecka pågår: Fortsätt logga varje enskild måltid och dryck. Vi utvärderar när de 7 dagarna har passerat.`;
    } else if (isErik) {
      return `Din Mätvecka är igång. Fortsätt att registrera allt noggrant så har vi ett perfekt underlag vid veckans slut.`;
    } else {
      return `Hej ${name}! Din Mätvecka rullar på. Kom ihåg att detta bara är ett sätt att samla fakta tillsammans i lugn och ro.`;
    }
  }

  // --- FALL 6: Intaget är redan för lågt (<= BMR / Golv) ---
  if (status === 'intake_too_low') {
    if (isBorje) {
      return `Viktig analys: Vikten står stilla, men ditt dagliga intag ligger redan nära ditt beräknade BMR på ${data.bmr} kcal. Jag förbjuder en ytterligare kalorisänkning. Att svälta kroppen leder bara till minskad spontanaktivitet och tappad muskelmassa. Åtgärd: Öka vardagsstegen eller ta en 7 dagars paus på balansnivå (${Math.round(data.tdee)} kcal) för att återställa förbränningen.`;
    } else if (isErik) {
      return `Analys av ämnesomsättning: Din platå beror sannolikt inte på för mycket mat. Ditt mål ligger redan vid ditt basala energibehov (BMR ${data.bmr} kcal). Att sänka ytterligare riskerar att sänka din NEAT (spontan vardagsrörelse) och försämra återhämtningen. Jag rekommenderar starkt att vi testar en diet break i en vecka på underhållsnivå (${Math.round(data.tdee)} kcal) eller höjer protein och steg i stället för att minska maten.`;
    } else {
      return `Hej ${name}! Jag ser att resultaten pausat, men du äter redan väldigt lite i förhållande till vad din kropp behöver i vila (${data.bmr} kcal). Vi ska absolut inte sänka maten mer, det skulle bara göra dig trött. Vad sägs om att vi i stället testar en vecka på balansnivå eller fokuserar på sköna promenader och extra protein?`;
    }
  }

  // --- FALL 7: Justering rekommenderas efter mätvecka (Del 4) ---
  if (status === 'adjustment_recommended' && data.adjustment) {
    const adj = data.adjustment;
    const redKcal = adj.reductionAmountKcal;
    const newGoal = adj.proposedCalorieGoal;

    if (isBorje) {
      return `Mätveckan är slutförd och datan är tydlig. Platån består trots konsekvent loggning. Föreslagen åtgärd: Vi justerar ditt dagliga mål med -${redKcal} kcal till ${newGoal} kcal. Detta håller dig tryggt över ditt BMR på ${adj.bmr} kcal. Alternativt: öka dina dagliga steg med 2 000 steg eller lägg till ett styrkepass innan du minskar maten.`;
    } else if (isErik) {
      return `Utvärdering efter Mätvecka: Datan visar att din loggning är stabil och en verklig platå föreligger. Vi kan göra en kontrollerad justering på -${redKcal} kcal, vilket ger ett nytt dagligt mål på ${newGoal} kcal. Detta ligger med god marginal över ditt BMR (${adj.bmr} kcal) och det fysiologiska golvet. Prova gärna att först öka det dagliga stegmålet eller lägga in ett extra styrkepass.`;
    } else {
      return `Hej ${name}! Tack för ett jättefint arbete med Mätveckan. Nu när vi har säkra siffror ser vi att kroppen har anpassat sig. Vi kan göra en liten och skonsam sänkning med ${redKcal} kcal till ${newGoal} kcal per dag, vilket fortfarande ger dig gott om näring över ditt basbehov. Vill du hellre testa att öka vardagsrörelsen med fler steg eller mer protein fungerar det också jättebra!`;
    }
  }

  // --- FALL 8: Systemets gräns nådd -> Lämna över till människa (Del 5) ---
  if (status === 'human_handover') {
    if (isBorje) {
      return `Systembegränsning nådd: Vi har genomfört tillåtna justeringar och ditt mål kan inte sänkas mer utan att äventyra hälsan. Nästa steg är inte mindre mat, utan ett samtal med en mänsklig coach för att analysera stress, sömn och träningsupplägg. ${measurementMethod === 'scale' ? 'Boka även en InBody-mätning för att få svart på vitt om kroppssammansättningen.' : ''}`;
    } else if (isErik) {
      return `Rådgivningsrekommendation: Appen har nått den gräns där ytterligare automatiska sänkningar varken är säkra eller effektiva. Vi behöver se över helhetsbilden (stressnivåer, sömnhygien, träningsvolym och hormonell balans). Jag rekommenderar ett samtal med en av våra mänskliga coacher. ${measurementMethod === 'scale' ? 'En InBody-mätning vore också ett utmärkt nästa steg för att ta reda på vad som faktiskt hänt med muskel- och fettmassan.' : ''}`;
    } else {
      return `Hej ${name}! Du har gjort ett fantastiskt jobb med loggningen, men nu har vi nått en punkt där vi inte ska dra ner mer på maten. För att hjälpa dig vidare på ett tryggt och personligt sätt föreslår jag att du tar kontakt med en av våra mänskliga coacher. ${measurementMethod === 'scale' ? 'Det vore också jättebra att göra en InBody-mätning, så får du se exakt hur din muskel- och fettmassa mår.' : ''} Du är inte ensam i detta!`;
    }
  }

  // Fallback
  return `Din vikt och loggning analyseras kontinuerligt för att säkerställa att din plan är hållbar, trygg och effektiv.`;
};

/**
 * Huvudmotor för Platåanalys.
 * Körs automatiskt via morgonbriefingen eller på begäran.
 */
export const runPlateauAnalysis = (
  params: PlateauAnalysisParams
): PlateauAnalysisResult | null => {
  const { userProfile, goals, pastDaysSummary, weightLogs, recentMealLogs, todayDateStr, forceAnalysis } = params;
  const todayStr = todayDateStr || getTodayKeySE();

  const preCheck = shouldRunPlateauAnalysis(userProfile, pastDaysSummary, todayStr, forceAnalysis);
  if (!preCheck.shouldRun && !forceAnalysis) {
    return null;
  }

  const currentWeightKg = userProfile.currentWeightKg || 70;
  const heightCm = userProfile.heightCm || 170;
  const ageYears = userProfile.ageYears || 30;
  const gender = userProfile.gender || 'female';
  const measurementMethod = userProfile.measurementMethod || 'inbody';
  const coachStyle = userProfile.coachStyle || 'balanced';

  // 1. Beräkna BMR och TDEE
  const bmr = calculateMifflinStJeorBMR(currentWeightKg, heightCm, ageYears, gender);
  const tdee = calculateTDEE(bmr, userProfile.activityLevel || 'moderate');

  // 2. Analysera loggningskvalitet (Del 1 & Del 3)
  const periodDays = 21;
  const loggingGaps = analyzeLoggingQuality(pastDaysSummary, bmr, periodDays, recentMealLogs, todayStr);

  // 3. Beräkna 7-dagars glidande medelvärden
  const rollingAvg = calculatePeriodRollingAverages(
    weightLogs,
    currentWeightKg,
    userProfile.bodyFatMassKg,
    userProfile.skeletalMuscleMassKg,
    periodDays,
    todayStr
  );

  const plateauState = userProfile.plateauAnalysis || {};
  const currentReductionCount = plateauState.plateauReductionCount || 0;

  // --- KONTROLL 1: Loggningsgrad under 80% ---
  if (loggingGaps.loggingPercentage < 80) {
    const status: PlateauAnalysisStatus = 'low_logging_rate';
    const coachText = generateCoachBriefingText(coachStyle, userProfile.name || '', status, measurementMethod, {
      loggingPercentage: loggingGaps.loggingPercentage,
      tdee,
      bmr,
    });

    return {
      date: todayStr,
      status,
      measurementMethod,
      isPlateau: false,
      periodDays,
      loggingPercentage: loggingGaps.loggingPercentage,
      startRollingAvgWeight: rollingAvg.startAvgWeight,
      endRollingAvgWeight: rollingAvg.endAvgWeight,
      weightDeltaKg: rollingAvg.weightDelta,
      loggingGaps,
      coachBriefingText: coachText,
      disclaimer: PLATEAU_MEDICAL_DISCLAIMER,
    };
  }

  // --- KONTROLL 2: Förgrening på Mätmetod (Del 2) ---
  let isGenuinePlateau = false;
  let isRecomposition = false;
  let isSteadyProgress = false;

  if (measurementMethod === 'inbody') {
    const fatDelta = rollingAvg.fatDelta !== undefined ? rollingAvg.fatDelta : 0;
    const muscleDelta = rollingAvg.muscleDelta !== undefined ? rollingAvg.muscleDelta : 0;
    const weightDelta = rollingAvg.weightDelta;

    if (fatDelta <= -0.2) {
      // Fettmassan minskar
      if (weightDelta >= -0.2) {
        // Fett minskar men vikten står still / ökar -> Kroppsrekomposition!
        isRecomposition = true;
      } else {
        // Fett minskar och vikten minskar -> Jämn fettminskning
        isSteadyProgress = true;
      }
    } else {
      // Fettmassan har stått still (minskning < 0.2 kg på 21 dagar) -> Äkta platå!
      isGenuinePlateau = true;
    }
  } else {
    // Våg (Scale)
    const weightDelta = rollingAvg.weightDelta;
    if (weightDelta <= -0.3) {
      // Jämn viktminskning pågår
      isSteadyProgress = true;
    } else {
      // Vikten har stått stilla eller ökat -> Potentiell platå
      isGenuinePlateau = true;
    }
  }

  // Om kroppen gör framsteg (rekomposition eller stabil fettminskning)
  if (isRecomposition) {
    const status: PlateauAnalysisStatus = 'recomposition_progress';
    const coachText = generateCoachBriefingText(coachStyle, userProfile.name || '', status, measurementMethod, {
      weightDelta: rollingAvg.weightDelta,
      fatDelta: rollingAvg.fatDelta,
      muscleDelta: rollingAvg.muscleDelta,
      loggingPercentage: loggingGaps.loggingPercentage,
      tdee,
      bmr,
    });

    return {
      date: todayStr,
      status,
      measurementMethod,
      isPlateau: false,
      periodDays,
      loggingPercentage: loggingGaps.loggingPercentage,
      startRollingAvgWeight: rollingAvg.startAvgWeight,
      endRollingAvgWeight: rollingAvg.endAvgWeight,
      weightDeltaKg: rollingAvg.weightDelta,
      startRollingAvgFatKg: rollingAvg.startAvgFat,
      endRollingAvgFatKg: rollingAvg.endAvgFat,
      fatDeltaKg: rollingAvg.fatDelta,
      startRollingAvgMuscleKg: rollingAvg.startAvgMuscle,
      endRollingAvgMuscleKg: rollingAvg.endAvgMuscle,
      muscleDeltaKg: rollingAvg.muscleDelta,
      coachBriefingText: coachText,
      disclaimer: PLATEAU_MEDICAL_DISCLAIMER,
    };
  }

  if (isSteadyProgress) {
    const status: PlateauAnalysisStatus = 'fat_loss_steady';
    const coachText = generateCoachBriefingText(coachStyle, userProfile.name || '', status, measurementMethod, {
      weightDelta: rollingAvg.weightDelta,
      fatDelta: rollingAvg.fatDelta,
      muscleDelta: rollingAvg.muscleDelta,
      loggingPercentage: loggingGaps.loggingPercentage,
      tdee,
      bmr,
    });

    return {
      date: todayStr,
      status,
      measurementMethod,
      isPlateau: false,
      periodDays,
      loggingPercentage: loggingGaps.loggingPercentage,
      startRollingAvgWeight: rollingAvg.startAvgWeight,
      endRollingAvgWeight: rollingAvg.endAvgWeight,
      weightDeltaKg: rollingAvg.weightDelta,
      startRollingAvgFatKg: rollingAvg.startAvgFat,
      endRollingAvgFatKg: rollingAvg.endAvgFat,
      fatDeltaKg: rollingAvg.fatDelta,
      coachBriefingText: coachText,
      disclaimer: PLATEAU_MEDICAL_DISCLAIMER,
    };
  }

  // --- KONTROLL 3: Platå identifierad. Utvärdera Mätvecka vs Justering (Del 3 & 4) ---
  const isMeasuringWeekJustFinished = plateauState.measuringWeekActive && 
    plateauState.measuringWeekStartDate &&
    getDaysBetweenDates(plateauState.measuringWeekStartDate, todayStr) >= 7;

  // Om mätvecka inte är genomförd än för denna platå -> Föreslå Mätvecka (Del 3)
  if (!isMeasuringWeekJustFinished && !plateauState.measuringWeekCompletedDate) {
    const status: PlateauAnalysisStatus = 'measuring_week_recommended';
    const coachText = generateCoachBriefingText(coachStyle, userProfile.name || '', status, measurementMethod, {
      weightDelta: rollingAvg.weightDelta,
      fatDelta: rollingAvg.fatDelta,
      loggingPercentage: loggingGaps.loggingPercentage,
      loggingGaps,
      tdee,
      bmr,
    });

    return {
      date: todayStr,
      status,
      measurementMethod,
      isPlateau: true,
      periodDays,
      loggingPercentage: loggingGaps.loggingPercentage,
      startRollingAvgWeight: rollingAvg.startAvgWeight,
      endRollingAvgWeight: rollingAvg.endAvgWeight,
      weightDeltaKg: rollingAvg.weightDelta,
      startRollingAvgFatKg: rollingAvg.startAvgFat,
      endRollingAvgFatKg: rollingAvg.endAvgFat,
      fatDeltaKg: rollingAvg.fatDelta,
      loggingGaps,
      alternatives: getPlateauAlternativeActions(userProfile, tdee),
      suggestInBody: measurementMethod === 'scale',
      coachBriefingText: coachText,
      disclaimer: PLATEAU_MEDICAL_DISCLAIMER,
    };
  }

  // Om mätvecka är aktiv men inte 7 dagar passerat än
  if (plateauState.measuringWeekActive && !isMeasuringWeekJustFinished) {
    const status: PlateauAnalysisStatus = 'measuring_week_in_progress';
    const coachText = generateCoachBriefingText(coachStyle, userProfile.name || '', status, measurementMethod, {
      loggingPercentage: loggingGaps.loggingPercentage,
      tdee,
      bmr,
    });

    return {
      date: todayStr,
      status,
      measurementMethod,
      isPlateau: true,
      periodDays,
      loggingPercentage: loggingGaps.loggingPercentage,
      coachBriefingText: coachText,
      disclaimer: PLATEAU_MEDICAL_DISCLAIMER,
    };
  }

  // --- KONTROLL 4: Mätvecka genomförd och platån kvarstår -> Justering med hårda spärrar (Del 4 & 5) ---
  const currentGoalKcal = goals.calorieGoal;
  const absoluteFloor = gender === 'male' ? 1600 : 1400;
  const effectiveHardFloor = Math.max(Math.round(bmr), absoluteFloor);

  // Spärr: Om intaget redan är vid eller under BMR / golv -> Sänk ALDRIG
  if (currentGoalKcal <= effectiveHardFloor || currentGoalKcal <= bmr + 50) {
    const status: PlateauAnalysisStatus = 'intake_too_low';
    const coachText = generateCoachBriefingText(coachStyle, userProfile.name || '', status, measurementMethod, {
      weightDelta: rollingAvg.weightDelta,
      fatDelta: rollingAvg.fatDelta,
      loggingPercentage: loggingGaps.loggingPercentage,
      tdee,
      bmr,
    });

    return {
      date: todayStr,
      status,
      measurementMethod,
      isPlateau: true,
      periodDays,
      loggingPercentage: loggingGaps.loggingPercentage,
      startRollingAvgWeight: rollingAvg.startAvgWeight,
      endRollingAvgWeight: rollingAvg.endAvgWeight,
      weightDeltaKg: rollingAvg.weightDelta,
      alternatives: getPlateauAlternativeActions(userProfile, tdee),
      handoverReason: 'intake_already_low',
      suggestInBody: measurementMethod === 'scale',
      coachBriefingText: coachText,
      disclaimer: PLATEAU_MEDICAL_DISCLAIMER,
    };
  }

  // Spärr: Max 2 sänkningar per målets livstid (Del 4 & 5)
  if (currentReductionCount >= 2) {
    const status: PlateauAnalysisStatus = 'human_handover';
    const coachText = generateCoachBriefingText(coachStyle, userProfile.name || '', status, measurementMethod, {
      weightDelta: rollingAvg.weightDelta,
      fatDelta: rollingAvg.fatDelta,
      loggingPercentage: loggingGaps.loggingPercentage,
      tdee,
      bmr,
    });

    return {
      date: todayStr,
      status,
      measurementMethod,
      isPlateau: true,
      periodDays,
      loggingPercentage: loggingGaps.loggingPercentage,
      startRollingAvgWeight: rollingAvg.startAvgWeight,
      endRollingAvgWeight: rollingAvg.endAvgWeight,
      weightDeltaKg: rollingAvg.weightDelta,
      alternatives: getPlateauAlternativeActions(userProfile, tdee),
      handoverReason: 'max_reductions_reached',
      suggestInBody: measurementMethod === 'scale',
      coachBriefingText: coachText,
      disclaimer: PLATEAU_MEDICAL_DISCLAIMER,
    };
  }

  // Beräkna kontrollerad justering
  const adjustment = calculateSafeAdjustment(userProfile, currentGoalKcal, bmr, currentReductionCount);
  const status: PlateauAnalysisStatus = 'adjustment_recommended';
  const coachText = generateCoachBriefingText(coachStyle, userProfile.name || '', status, measurementMethod, {
    weightDelta: rollingAvg.weightDelta,
    fatDelta: rollingAvg.fatDelta,
    loggingPercentage: loggingGaps.loggingPercentage,
    adjustment,
    tdee,
    bmr,
    reductionsRemaining: adjustment.reductionsRemaining,
  });

  return {
    date: todayStr,
    status,
    measurementMethod,
    isPlateau: true,
    periodDays,
    loggingPercentage: loggingGaps.loggingPercentage,
    startRollingAvgWeight: rollingAvg.startAvgWeight,
    endRollingAvgWeight: rollingAvg.endAvgWeight,
    weightDeltaKg: rollingAvg.weightDelta,
    startRollingAvgFatKg: rollingAvg.startAvgFat,
    endRollingAvgFatKg: rollingAvg.endAvgFat,
    fatDeltaKg: rollingAvg.fatDelta,
    adjustment,
    alternatives: getPlateauAlternativeActions(userProfile, tdee),
    suggestInBody: measurementMethod === 'scale',
    coachBriefingText: coachText,
    disclaimer: PLATEAU_MEDICAL_DISCLAIMER,
  };
};
