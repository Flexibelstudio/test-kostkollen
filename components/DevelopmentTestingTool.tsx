import React, { useState } from 'react';
import { 
  UserProfileData, 
  GoalSettings, 
  PastDaySummary, 
  WeightLogEntry, 
  PlateauAnalysisResult
} from '../types';
import { runPlateauAnalysis, getTodayKeySE } from '../utils/plateauAnalysis';
import { PlateauAnalysisCard } from './PlateauAnalysisCard';
import { Play, RotateCcw, CheckCircle, AlertTriangle, Activity, Sparkles } from 'lucide-react';

interface DevelopmentTestingToolProps {
  onSimulateSuccessfulDay?: () => void;
  onSimulateUnsuccessfulDay?: () => void;
  currentDate?: string;
  userProfile?: UserProfileData;
  goals?: GoalSettings;
  onApplyTestScenario?: (profile: UserProfileData, goals: GoalSettings, pastDays: PastDaySummary[], weightLogs: WeightLogEntry[]) => void;
}

export const DevelopmentTestingTool: React.FC<DevelopmentTestingToolProps> = ({
  onSimulateSuccessfulDay,
  onSimulateUnsuccessfulDay,
  currentDate = getTodayKeySE(),
  userProfile,
  goals,
  onApplyTestScenario,
}) => {
  const [activeScenarioResult, setActiveScenarioResult] = useState<{
    scenarioId: number;
    scenarioTitle: string;
    description: string;
    expectedStatus: string;
    profile: UserProfileData;
    goals: GoalSettings;
    pastDays: PastDaySummary[];
    weightLogs: WeightLogEntry[];
    result: PlateauAnalysisResult | null;
  } | null>(null);

  // Helper to generate date string X days ago
  const getDateDaysAgo = (daysAgo: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  /**
   * Genererar syntetisk logghistorik för ett givet antal dagar med specificerad loggningsgrad och kalorier.
   */
  const generatePastDays = (
    count: number,
    dailyCalories: number,
    logRatio: number, // 0.0 - 1.0 (t.ex. 0.95 = 95% loggade dagar)
    calorieGoal: number = 1800,
    proteinGoal: number = 130
  ): PastDaySummary[] => {
    const list: PastDaySummary[] = [];
    for (let i = count; i >= 1; i--) {
      const dateStr = getDateDaysAgo(i);
      // Avgör om denna dag är loggad baserat på ratio
      const isLogged = (i % Math.max(1, Math.round(1 / (1 - logRatio || 0.01)))) !== 0 || logRatio >= 1;
      
      if (isLogged) {
        list.push({
          date: dateStr,
          goalMet: true,
          consumedCalories: dailyCalories + (Math.floor(Math.random() * 60) - 30),
          consumedProtein: proteinGoal + (Math.floor(Math.random() * 10) - 5),
          proteinGoalMet: true,
          consumedCarbohydrates: 150,
          consumedFat: 55,
          calorieGoal,
          proteinGoal,
          carbohydrateGoal: 200,
          fatGoal: 60,
          goalType: 'lose_fat'
        });
      } else {
        // Ologgad dag (0 kcal intag)
        list.push({
          date: dateStr,
          goalMet: false,
          consumedCalories: 0,
          consumedProtein: 0,
          proteinGoalMet: false,
          consumedCarbohydrates: 0,
          consumedFat: 0,
          calorieGoal,
          proteinGoal,
          carbohydrateGoal: 200,
          fatGoal: 60,
          goalType: 'lose_fat'
        });
      }
    }
    return list;
  };

  /**
   * Genererar syntetiska viktloggar.
   */
  const generateWeightLogs = (
    count: number,
    startWeight: number,
    endWeight: number,
    startFat?: number,
    endFat?: number,
    startMuscle?: number,
    endMuscle?: number
  ): WeightLogEntry[] => {
    const list: WeightLogEntry[] = [];
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    for (let i = count; i >= 0; i -= 2) { // Vägning varannan dag
      const fraction = (count - i) / count;
      const weight = startWeight + (endWeight - startWeight) * fraction + ((Math.random() * 0.2) - 0.1);
      const fat = startFat !== undefined && endFat !== undefined 
        ? startFat + (endFat - startFat) * fraction 
        : undefined;
      const muscle = startMuscle !== undefined && endMuscle !== undefined 
        ? startMuscle + (endMuscle - startMuscle) * fraction 
        : undefined;

      list.push({
        id: `test_weight_${i}`,
        weightKg: Number(weight.toFixed(1)),
        loggedAt: now - (i * msPerDay),
        bodyFatMassKg: fat !== undefined ? Number(fat.toFixed(1)) : undefined,
        skeletalMuscleMassKg: muscle !== undefined ? Number(muscle.toFixed(1)) : undefined
      });
    }
    return list;
  };

  // --- TESTFALL 1: Intag nära BMR ---
  const runTestCase1 = () => {
    // Kvinna, 35 år, 168 cm, 70 kg -> BMR = 1435 kcal
    // Dagligt mål satt till 1450 kcal (nära BMR och nära absolut golv 1400)
    // 21+ dagars stabil vikt, 95% loggningsgrad, mätvecka genomförd
    const profile: UserProfileData = {
      name: 'Anna (Testfall 1)',
      gender: 'female',
      ageYears: 35,
      heightCm: 168,
      currentWeightKg: 70,
      desiredWeightChangeKg: -8,
      goalType: 'lose_fat',
      measurementMethod: 'scale',
      coachStyle: 'balanced',
      activityLevel: 'light',
      goalStartDate: getDateDaysAgo(25),
      notificationSettings: {
        friendRequests: true,
        newEvents: true,
        comments: true,
        likes: true,
        messages: true,
        waterReminder: true,
        foodReminder: true,
        weighInReminder: true,
        inactivityReminder: true,
        milestoneNudge: true
      },
      plateauAnalysis: {
        plateauReductionCount: 0,
        measuringWeekCompletedDate: getDateDaysAgo(1),
        lastPlateauAnalysisDate: undefined
      }
    };

    const mockGoals: GoalSettings = {
      calorieGoal: 1450, // Nära BMR (1435 kcal)
      proteinGoal: 120,
      carbohydrateGoal: 130,
      fatGoal: 45
    };

    const pastDays = generatePastDays(24, 1440, 0.95, 1450, 120);
    const weightLogs = generateWeightLogs(24, 70.0, 70.1); // Stabil vikt (ingen nedgång)

    const result = runPlateauAnalysis({
      userProfile: profile,
      goals: mockGoals,
      pastDaysSummary: pastDays,
      weightLogs,
      forceAnalysis: true
    });

    setActiveScenarioResult({
      scenarioId: 1,
      scenarioTitle: 'Fall 1 – "Intag nära BMR"',
      description: 'Profil där dagligt mål (1450 kcal) ligger strax över beräknad BMR (1435 kcal), 21+ dagars stabil vikt, hög loggningsgrad (95%). Förväntat: status intake_too_low, INGET sänkningsförslag oavsett räknare.',
      expectedStatus: 'intake_too_low (Inget sänkningsförslag)',
      profile,
      goals: mockGoals,
      pastDays,
      weightLogs,
      result
    });

    if (onApplyTestScenario) onApplyTestScenario(profile, mockGoals, pastDays, weightLogs);
  };

  // --- TESTFALL 2: Taket nått (Max 2 sänkningar) ---
  const runTestCase2 = () => {
    // plateauReductionCount satt till 2
    // 21+ dagars stabil vikt, hög loggningsgrad, intag med god marginal över BMR (t.ex. 2000 kcal för man)
    const profile: UserProfileData = {
      name: 'Johan (Testfall 2)',
      gender: 'male',
      ageYears: 38,
      heightCm: 184,
      currentWeightKg: 92,
      desiredWeightChangeKg: -10,
      goalType: 'lose_fat',
      measurementMethod: 'scale',
      coachStyle: 'hard',
      activityLevel: 'moderate',
      goalStartDate: getDateDaysAgo(30),
      notificationSettings: {
        friendRequests: true,
        newEvents: true,
        comments: true,
        likes: true,
        messages: true,
        waterReminder: true,
        foodReminder: true,
        weighInReminder: true,
        inactivityReminder: true,
        milestoneNudge: true
      },
      plateauAnalysis: {
        plateauReductionCount: 2, // Taket nått!
        measuringWeekCompletedDate: getDateDaysAgo(1),
        lastPlateauAnalysisDate: undefined
      }
    };

    const mockGoals: GoalSettings = {
      calorieGoal: 2050, // God marginal över BMR (ca 1850)
      proteinGoal: 160,
      carbohydrateGoal: 200,
      fatGoal: 65
    };

    const pastDays = generatePastDays(25, 2030, 0.95, 2050, 160);
    const weightLogs = generateWeightLogs(25, 92.0, 92.1); // Stabil vikt

    const result = runPlateauAnalysis({
      userProfile: profile,
      goals: mockGoals,
      pastDaysSummary: pastDays,
      weightLogs,
      forceAnalysis: true
    });

    setActiveScenarioResult({
      scenarioId: 2,
      scenarioTitle: 'Fall 2 – "Taket nått"',
      description: 'plateauReductionCount satt till 2, 21+ dagars stabil vikt, hög loggningsgrad (95%), intag med god marginal över BMR. Förväntat: status human_handover, ingen ytterligare automatisk kalorisänkning.',
      expectedStatus: 'human_handover (Överlämning till mänsklig coach)',
      profile,
      goals: mockGoals,
      pastDays,
      weightLogs,
      result
    });

    if (onApplyTestScenario) onApplyTestScenario(profile, mockGoals, pastDays, weightLogs);
  };

  // --- TESTFALL 3: Rekomposition (InBody) ---
  const runTestCase3 = () => {
    // measurementMethod: 'inbody'
    // Vikten står stilla (75 kg -> 75 kg), men bodyFatMassKg minskar med -1.2 kg och skelettmuskelmassa ökar med +0.8 kg
    // Hög loggningsgrad
    const profile: UserProfileData = {
      name: 'Sara (Testfall 3)',
      gender: 'female',
      ageYears: 29,
      heightCm: 172,
      currentWeightKg: 75,
      desiredWeightChangeKg: -7,
      bodyFatMassKg: 21.0,
      skeletalMuscleMassKg: 28.5,
      goalType: 'lose_fat',
      measurementMethod: 'inbody',
      coachStyle: 'soft',
      activityLevel: 'moderate',
      goalStartDate: getDateDaysAgo(28),
      notificationSettings: {
        friendRequests: true,
        newEvents: true,
        comments: true,
        likes: true,
        messages: true,
        waterReminder: true,
        foodReminder: true,
        weighInReminder: true,
        inactivityReminder: true,
        milestoneNudge: true
      },
      plateauAnalysis: {
        plateauReductionCount: 0,
        lastPlateauAnalysisDate: undefined
      }
    };

    const mockGoals: GoalSettings = {
      calorieGoal: 1850,
      proteinGoal: 140,
      carbohydrateGoal: 170,
      fatGoal: 60
    };

    const pastDays = generatePastDays(25, 1820, 0.92, 1850, 140);
    // 25 dagar: Vikt 75.0 -> 75.0 kg, Fett 22.2 -> 21.0 kg (-1.2 kg), Muskler 27.7 -> 28.5 kg (+0.8 kg)
    const weightLogs = generateWeightLogs(25, 75.0, 75.0, 22.2, 21.0, 27.7, 28.5);

    const result = runPlateauAnalysis({
      userProfile: profile,
      goals: mockGoals,
      pastDaysSummary: pastDays,
      weightLogs,
      forceAnalysis: true
    });

    setActiveScenarioResult({
      scenarioId: 3,
      scenarioTitle: 'Fall 3 – "Rekomposition (InBody)"',
      description: 'measurementMethod är "inbody". Vikten har stått helt stilla på 75 kg, men fettmassan har minskat med -1.2 kg och muskelmassan ökat med +0.8 kg över 25 dagar. Förväntat: isPlateau: false, status recomposition_progress, positiv feedback på kroppsrekomposition.',
      expectedStatus: 'recomposition_progress (isPlateau: false, Ren rekomposition)',
      profile,
      goals: mockGoals,
      pastDays,
      weightLogs,
      result
    });

    if (onApplyTestScenario) onApplyTestScenario(profile, mockGoals, pastDays, weightLogs);
  };

  // --- TESTFALL 4: Äkta platå (våg) -> Föreslå Mätvecka först ---
  const runTestCase4 = () => {
    // measurementMethod: 'scale'
    // 21+ dagars stabil vikt, hög loggningsgrad (> 80%), Mätvecka EJ genomförd tidigare
    // Förväntat: isPlateau: true, status measuring_week_recommended (föreslå mätvecka och alternativa åtgärder innan kalorisänkning)
    const profile: UserProfileData = {
      name: 'Maria (Testfall 4)',
      gender: 'female',
      ageYears: 42,
      heightCm: 165,
      currentWeightKg: 78,
      desiredWeightChangeKg: -10,
      goalType: 'lose_fat',
      measurementMethod: 'scale',
      coachStyle: 'balanced',
      activityLevel: 'moderate',
      goalStartDate: getDateDaysAgo(25),
      notificationSettings: {
        friendRequests: true,
        newEvents: true,
        comments: true,
        likes: true,
        messages: true,
        waterReminder: true,
        foodReminder: true,
        weighInReminder: true,
        inactivityReminder: true,
        milestoneNudge: true
      },
      plateauAnalysis: {
        plateauReductionCount: 0,
        measuringWeekActive: false,
        measuringWeekStartDate: undefined,
        measuringWeekCompletedDate: undefined,
        lastPlateauAnalysisDate: undefined
      }
    };

    const mockGoals: GoalSettings = {
      calorieGoal: 1850, // BMR ca 1470 kcal
      proteinGoal: 130,
      carbohydrateGoal: 180,
      fatGoal: 60
    };

    const pastDays = generatePastDays(24, 1840, 0.90, 1850, 130);
    const weightLogs = generateWeightLogs(24, 78.1, 78.2); // Vikten står still

    const result = runPlateauAnalysis({
      userProfile: profile,
      goals: mockGoals,
      pastDaysSummary: pastDays,
      weightLogs,
      forceAnalysis: true
    });

    setActiveScenarioResult({
      scenarioId: 4,
      scenarioTitle: 'Fall 4 – "Äkta platå (våg)"',
      description: 'measurementMethod är "scale". 21+ dagars stabil vikt, 90% loggningsgrad, ingen mätvecka genomförd än. Förväntat: isPlateau: true, status measuring_week_recommended, coach föreslår en 7 dagars Mätvecka och alternativa strategier (steg, protein, diet break) innan kalorisänkning.',
      expectedStatus: 'measuring_week_recommended (Föreslå Mätvecka & Alternativ)',
      profile,
      goals: mockGoals,
      pastDays,
      weightLogs,
      result
    });

    if (onApplyTestScenario) onApplyTestScenario(profile, mockGoals, pastDays, weightLogs);
  };

  // --- TESTFALL 5: Låg loggningsgrad (< 80%) ---
  const runTestCase5 = () => {
    // 21+ dagars historik men användaren har endast loggat mat ca 55% av dagarna
    // Förväntat: isPlateau: false, status low_logging_rate, coachen uppmuntrar till regelbunden loggning och gör INGEN kalorijustering.
    const profile: UserProfileData = {
      name: 'Fredrik (Testfall 5)',
      gender: 'male',
      ageYears: 34,
      heightCm: 180,
      currentWeightKg: 88,
      desiredWeightChangeKg: -10,
      goalType: 'lose_fat',
      measurementMethod: 'scale',
      coachStyle: 'hard',
      activityLevel: 'light',
      goalStartDate: getDateDaysAgo(26),
      notificationSettings: {
        friendRequests: true,
        newEvents: true,
        comments: true,
        likes: true,
        messages: true,
        waterReminder: true,
        foodReminder: true,
        weighInReminder: true,
        inactivityReminder: true,
        milestoneNudge: true
      },
      plateauAnalysis: {
        plateauReductionCount: 0,
        lastPlateauAnalysisDate: undefined
      }
    };

    const mockGoals: GoalSettings = {
      calorieGoal: 2100,
      proteinGoal: 150,
      carbohydrateGoal: 220,
      fatGoal: 65
    };

    // Endast ~55% loggade dagar (13 av 24 dagar)
    const pastDays = generatePastDays(24, 2050, 0.55, 2100, 150);
    const weightLogs = generateWeightLogs(24, 88.0, 88.2);

    const result = runPlateauAnalysis({
      userProfile: profile,
      goals: mockGoals,
      pastDaysSummary: pastDays,
      weightLogs,
      forceAnalysis: true
    });

    setActiveScenarioResult({
      scenarioId: 5,
      scenarioTitle: 'Fall 5 – "Låg loggningsgrad"',
      description: 'Användaren har loggat mat endast 55% av dagarna i 24-dagarsperioden. Förväntat: isPlateau: false, status low_logging_rate, coachen påtalar vänligt att problemet inte är planen utan loggningsgraden, och uppmuntrar till regelbundenhet.',
      expectedStatus: 'low_logging_rate (isPlateau: false, Uppmana till loggning)',
      profile,
      goals: mockGoals,
      pastDays,
      weightLogs,
      result
    });

    if (onApplyTestScenario) onApplyTestScenario(profile, mockGoals, pastDays, weightLogs);
  };

  const handleReset = () => {
    setActiveScenarioResult(null);
  };

  return (
    <section aria-labelledby="dev-tool-heading" className="bg-[#F6E2D9]/40 border-2 border-[#D96E4A] p-5 sm:p-7 rounded-2xl shadow-lg mt-8 space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center p-2.5 bg-[#F6E2D9] rounded-2xl mb-2 text-[#D96E4A]">
          <Sparkles className="w-6 h-6 mr-2" />
          <h2 id="dev-tool-heading" className="text-xl sm:text-2xl font-black text-[#56524D]">
            Testverktyg för utvecklare & Platåanalys
          </h2>
        </div>
        <p className="text-sm text-[#7A756E] max-w-2xl mx-auto">
          Testa streaksimulering eller kör konstruerade testscenarion för <strong>Platå-analysen</strong> för att verifiera motor, spärrar och coachernas briefingtexter.
        </p>
      </div>

      {/* Dags-simulering */}
      {onSimulateSuccessfulDay && onSimulateUnsuccessfulDay && (
        <div className="bg-white/80 p-4 rounded-xl border border-[#D96E4A]/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7A756E]">Dagssimulering (Streaks & Sparpott)</span>
            <span className="text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full font-mono">
              Simulerat datum: <strong>{currentDate}</strong>
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onSimulateSuccessfulDay}
              className="flex-1 px-4 py-2.5 bg-[#2B3B2C] hover:bg-[#1E291F] text-white rounded-xl shadow-sm font-medium text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Jag klarade dagen ✅
            </button>
            <button
              onClick={onSimulateUnsuccessfulDay}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm font-medium text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-white" />
              Jag klarade inte dagen ❌
            </button>
          </div>
        </div>
      )}

      {/* Platåanalys Testfall */}
      <div className="bg-white p-5 rounded-2xl border border-[#D96E4A]/30 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
          <div>
            <h3 className="font-bold text-neutral-800 text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#D96E4A]" />
              Konstruerade testfall för Platåanalys
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Klicka på ett testfall för att simulera nödvändig profil, måltidshistorik och viktkurva samt köra analysen direkt.
            </p>
          </div>
          {activeScenarioResult && (
            <button
              onClick={handleReset}
              className="self-start sm:self-auto px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Återställ vy
            </button>
          )}
        </div>

        {/* 5 Testknappar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Fall 1 */}
          <button
            onClick={runTestCase1}
            className={`p-3.5 text-left rounded-xl border transition-all flex flex-col justify-between gap-2 group ${
              activeScenarioResult?.scenarioId === 1
                ? 'bg-[#F6E2D9] border-[#D96E4A] shadow-md ring-2 ring-[#D96E4A]/40'
                : 'bg-neutral-50/70 hover:bg-[#F6E2D9]/30 border-neutral-200 hover:border-[#D96E4A]/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-extrabold text-[#D96E4A] uppercase tracking-wider">Fall 1</span>
                <span className="text-[11px] bg-white px-2 py-0.5 rounded font-mono text-neutral-600 border border-neutral-200">
                  intake_too_low
                </span>
              </div>
              <h4 className="font-bold text-neutral-800 text-sm group-hover:text-[#D96E4A] transition-colors">
                Intag nära BMR
              </h4>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                Dagligt mål (1450 kcal) nära BMR. Stabil vikt, 95% loggning. Inget sänkningsförslag ges.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#D96E4A] mt-2">
              <Play className="w-3.5 h-3.5 fill-current" />
              Kör testfall 1
            </div>
          </button>

          {/* Fall 2 */}
          <button
            onClick={runTestCase2}
            className={`p-3.5 text-left rounded-xl border transition-all flex flex-col justify-between gap-2 group ${
              activeScenarioResult?.scenarioId === 2
                ? 'bg-[#F6E2D9] border-[#D96E4A] shadow-md ring-2 ring-[#D96E4A]/40'
                : 'bg-neutral-50/70 hover:bg-[#F6E2D9]/30 border-neutral-200 hover:border-[#D96E4A]/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-extrabold text-[#D96E4A] uppercase tracking-wider">Fall 2</span>
                <span className="text-[11px] bg-white px-2 py-0.5 rounded font-mono text-neutral-600 border border-neutral-200">
                  human_handover
                </span>
              </div>
              <h4 className="font-bold text-neutral-800 text-sm group-hover:text-[#D96E4A] transition-colors">
                Taket nått (2 sänkningar)
              </h4>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                plateauReductionCount = 2, stabil vikt, hög loggning. Systemet lämnar över till mänsklig coach.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#D96E4A] mt-2">
              <Play className="w-3.5 h-3.5 fill-current" />
              Kör testfall 2
            </div>
          </button>

          {/* Fall 3 */}
          <button
            onClick={runTestCase3}
            className={`p-3.5 text-left rounded-xl border transition-all flex flex-col justify-between gap-2 group ${
              activeScenarioResult?.scenarioId === 3
                ? 'bg-[#F6E2D9] border-[#D96E4A] shadow-md ring-2 ring-[#D96E4A]/40'
                : 'bg-neutral-50/70 hover:bg-[#F6E2D9]/30 border-neutral-200 hover:border-[#D96E4A]/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-extrabold text-[#D96E4A] uppercase tracking-wider">Fall 3</span>
                <span className="text-[11px] bg-white px-2 py-0.5 rounded font-mono text-neutral-600 border border-neutral-200">
                  recomposition
                </span>
              </div>
              <h4 className="font-bold text-neutral-800 text-sm group-hover:text-[#D96E4A] transition-colors">
                Rekomposition (InBody)
              </h4>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                InBody-mätning: Vikten still men fett -1.2 kg och muskler +0.8 kg. isPlateau: false, hyllas som framsteg.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#D96E4A] mt-2">
              <Play className="w-3.5 h-3.5 fill-current" />
              Kör testfall 3
            </div>
          </button>

          {/* Fall 4 */}
          <button
            onClick={runTestCase4}
            className={`p-3.5 text-left rounded-xl border transition-all flex flex-col justify-between gap-2 group ${
              activeScenarioResult?.scenarioId === 4
                ? 'bg-[#F6E2D9] border-[#D96E4A] shadow-md ring-2 ring-[#D96E4A]/40'
                : 'bg-neutral-50/70 hover:bg-[#F6E2D9]/30 border-neutral-200 hover:border-[#D96E4A]/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-extrabold text-[#D96E4A] uppercase tracking-wider">Fall 4</span>
                <span className="text-[11px] bg-white px-2 py-0.5 rounded font-mono text-neutral-600 border border-neutral-200">
                  measuring_week
                </span>
              </div>
              <h4 className="font-bold text-neutral-800 text-sm group-hover:text-[#D96E4A] transition-colors">
                Äkta platå (våg)
              </h4>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                Våg: 21+ dagars stillastående, 90% loggning. Föreslår 7 dagars Mätvecka och alternativ före kalorijustering.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#D96E4A] mt-2">
              <Play className="w-3.5 h-3.5 fill-current" />
              Kör testfall 4
            </div>
          </button>

          {/* Fall 5 */}
          <button
            onClick={runTestCase5}
            className={`p-3.5 text-left rounded-xl border transition-all flex flex-col justify-between gap-2 group ${
              activeScenarioResult?.scenarioId === 5
                ? 'bg-[#F6E2D9] border-[#D96E4A] shadow-md ring-2 ring-[#D96E4A]/40'
                : 'bg-neutral-50/70 hover:bg-[#F6E2D9]/30 border-neutral-200 hover:border-[#D96E4A]/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-extrabold text-[#D96E4A] uppercase tracking-wider">Fall 5</span>
                <span className="text-[11px] bg-white px-2 py-0.5 rounded font-mono text-neutral-600 border border-neutral-200">
                  low_logging_rate
                </span>
              </div>
              <h4 className="font-bold text-neutral-800 text-sm group-hover:text-[#D96E4A] transition-colors">
                Låg loggningsgrad (&lt; 80%)
              </h4>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                Endast 55% loggade dagar. isPlateau: false. Coachen uppmuntrar till kontinuitet istället för planändring.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#D96E4A] mt-2">
              <Play className="w-3.5 h-3.5 fill-current" />
              Kör testfall 5
            </div>
          </button>
        </div>

        {/* Resultatvisning */}
        {activeScenarioResult && (
          <div className="mt-6 pt-5 border-t border-neutral-200 space-y-4 animate-fade-in">
            <div className="bg-neutral-900 text-white p-4 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D96E4A]">
                  Aktivt Testfall: {activeScenarioResult.scenarioTitle}
                </span>
                <span className="text-xs font-mono bg-neutral-800 px-2.5 py-1 rounded text-emerald-400 border border-neutral-700">
                  Utfall: {activeScenarioResult.result?.status}
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {activeScenarioResult.description}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] font-mono text-neutral-400 border-t border-neutral-800">
                <div>Loggningsgrad: <strong className="text-white">{activeScenarioResult.result?.loggingPercentage}%</strong></div>
                <div>isPlateau: <strong className="text-white">{activeScenarioResult.result?.isPlateau ? 'true' : 'false'}</strong></div>
                <div>Mätmetod: <strong className="text-white">{activeScenarioResult.result?.measurementMethod}</strong></div>
                <div>Coach: <strong className="text-white">{activeScenarioResult.profile.coachStyle}</strong></div>
              </div>
            </div>

            {/* Render actual PlateauAnalysisCard */}
            {activeScenarioResult.result ? (
              <div className="mt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                  Visuell representation (PlateauAnalysisCard)
                </h4>
                <PlateauAnalysisCard
                  result={activeScenarioResult.result}
                  userProfile={activeScenarioResult.profile}
                  goals={activeScenarioResult.goals}
                  onStartMeasuringWeek={() => alert("Simulerat: Starta 7 dagars Mätvecka")}
                  onAcceptAdjustment={(newCal, red) => alert(`Simulerat: Justera mål till ${newCal} kcal (-${red} kcal)`)}
                  onDiscussWithCoach={() => alert("Simulerat: Öppna coachdialog")}
                />
              </div>
            ) : (
              <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-xs">
                Analysen returnerade inget resultat (villkoren för att köra uppfylldes inte).
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default DevelopmentTestingTool;
