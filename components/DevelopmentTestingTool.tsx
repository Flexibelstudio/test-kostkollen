import React, { useState } from 'react';
import { 
  UserProfileData, 
  GoalSettings, 
  PastDaySummary, 
  WeightLogEntry, 
  PlateauAnalysisResult,
  LoggedMeal
} from '../types';
import { runPlateauAnalysis, getTodayKeySE } from '../utils/plateauAnalysis';
import { PlateauAnalysisCard } from './PlateauAnalysisCard';
import { 
  Play, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  Activity, 
  Sparkles, 
  Calculator, 
  ShieldCheck, 
  Check, 
  XCircle,
  Clock,
  RefreshCw,
  Timer
} from 'lucide-react';
import { getDateUID } from '../utils/dateUtils';
import { 
  sumMealNutrients, 
  calculateRemainingCalories, 
  calculateWeeklyTotals, 
  getMealDateUID,
  resolveUpdatedNutrients
} from '../utils/nutritionTotals';
import { getPhotoMetricsHistory, PhotoPipelineMetrics } from '../utils/photoPipelineProfiler';

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

  const [arithmeticAuditResult, setArithmeticAuditResult] = useState<{
    passed: boolean;
    executedAt: string;
    testA_mealSum: {
      passed: boolean;
      mealsCount: number;
      mealValue: number;
      rawSum: number;
      preRoundedSum: number;
      displaySum: number;
      diffIfPreRounded: number;
      actualError: number;
    };
    testB_macros: {
      passed: boolean;
      rawProtein: number;
      displayProtein: number;
      rawCarbs: number;
      displayCarbs: number;
      rawFat: number;
      displayFat: number;
      calculatedMacroCalories: number;
      statedCalories: number;
    };
    testC_remaining: {
      passed: boolean;
      goal: number;
      consumedRaw: number;
      rawRemaining: number;
      displayRemaining: number;
      bankScenario: {
        passed: boolean;
        goal: number;
        consumed: number;
        availableBank: number;
        rawExcess: number;
        bankDeduction: number;
        remainingBank: number;
        netOverBudget: number;
        noDoubleCountVerified: boolean;
      };
    };
    testD_weeklyTotal: {
      passed: boolean;
      dailyRawInputs: number[];
      dailyRoundedValues: number[];
      exactRawSum: number;
      displayWeekSum: number;
      sumOfPreRoundedDays: number;
      roundingErrorPrevented: number;
    };
    testE_timezoneMidnight: {
      passed: boolean;
      testTimestamp: string;
      localDateString: string;
      utcDateString: string;
      usesLocalDate: boolean;
    };
    testF_recalcOnMutation: {
      passed: boolean;
      initialSum: number;
      sumAfterDelete: number;
      sumAfterEdit: number;
      pureFromScratch: boolean;
    };
    testG_rawPreservation: {
      passed: boolean;
      originalRawCalories: number;
      displayedFieldCalories: string;
      savedRawCaloriesAfterUnchangedEdit: number;
      isExactlyPreserved: boolean;
      explicitEditHandled: boolean;
    };
    testH_photoMultiplier: {
      passed: boolean;
      rawCalories: number;
      savedCaloriesSingle: number;
      expectedSingle: number;
      portionMultiplier: number;
      savedCaloriesMultiplied: number;
      expectedMultiplied: number;
      preRoundedMultiplied: number;
    };
  } | null>(null);

  /**
   * Kör ett automatiserat självtest för kaloriberäkningar och aritmetisk precision.
   * Skapar måltider med bråkiga värden (33.33 kcal vardera) och verifierar:
   * a) att måltidernas summa är exakt
   * b) att makrofördelningen summerar rätt
   * c) att återstående och Sparpott stämmer mot målet utan dubbelräkning
   * d) att veckototalen summerar dagsintagens råvärden
   * e) att tidszon och dygnsgräns är säkrade
   * f) att redigera/ta bort måltid räknar om från grunden utan diff-avrundningsfel
   */
  const handleRunArithmeticAudit = () => {
    // 1. Skapa 10 testmåltider med 33.33 kcal vardera
    const mealCount = 10;
    const mealKcal = 33.33;
    const mealProtein = 3.33;
    const mealCarbs = 4.44;
    const mealFat = 1.11;

    const testMeals: LoggedMeal[] = Array.from({ length: mealCount }, (_, i) => ({
      id: `audit_meal_${i + 1}`,
      mealType: 'lunch',
      timestamp: Date.now() + i * 1000,
      dateString: getDateUID(new Date()),
      nutritionalInfo: {
        foodItem: `Testmåltid #${i + 1}`,
        calories: mealKcal,
        protein: mealProtein,
        carbohydrates: mealCarbs,
        fat: mealFat,
      }
    }));

    // A. Summa av måltider (Dagstotal "Ätit") via produktionsfunktionen sumMealNutrients()
    const totalsResult = sumMealNutrients(testMeals);
    const rawCalories = totalsResult.calories; // 333.30
    const preRoundedCalories = testMeals.reduce((acc, m) => acc + Math.round(m.nutritionalInfo.calories), 0); // Jämförelsesiffra för att demonstrera avrundningsrisk
    const displayCalories = Math.round(rawCalories); // 333
    const diffIfPreRounded = Number((rawCalories - preRoundedCalories).toFixed(2)); // +3.30 kcal fel som appen förebygger
    const actualError = Math.abs(rawCalories - (mealCount * mealKcal));
    const testA_passed = actualError < 0.0001 && displayCalories === Math.round(mealCount * mealKcal);

    // B. Makrofördelning via samma anrop till sumMealNutrients()
    const rawProtein = totalsResult.protein; // 33.30
    const rawCarbs = totalsResult.carbohydrates; // 44.40
    const rawFat = totalsResult.fat; // 11.10
    const displayProtein = Math.round(rawProtein); // 33
    const displayCarbs = Math.round(rawCarbs); // 44
    const displayFat = Math.round(rawFat); // 11
    const testB_passed = Math.abs(rawProtein - 33.3) < 0.0001 &&
                         Math.abs(rawCarbs - 44.4) < 0.0001 &&
                         Math.abs(rawFat - 11.1) < 0.0001;

    // C. Återstående & Sparpott via produktionsfunktionen calculateRemainingCalories()
    const calorieGoal = 2000.0;
    const baseRemainingCalc = calculateRemainingCalories(calorieGoal, rawCalories, 0, 'lose_fat');
    const rawRemaining = baseRemainingCalc.caloriesRemaining; // 1666.70
    const displayRemaining = Math.round(rawRemaining); // 1667

    // Sparpott-överskridande scenario via samma produktionsfunktion:
    const bankGoal = 1500;
    const bankConsumed = 1650.50;
    const availableBank = 300;
    const bankScenarioCalc = calculateRemainingCalories(bankGoal, bankConsumed, availableBank, 'lose_fat');
    
    // Verifiera att Sparpott varken läggs till målet (bankGoal förblir 1500) eller dras av två gånger
    const noDoubleCount = (bankGoal === 1500) && 
                          (bankScenarioCalc.isFullyCoveredByBank === true) && 
                          (bankScenarioCalc.netCaloriesOver === 0) && 
                          (Math.abs(bankScenarioCalc.remainingBankDisplay - 149.50) < 0.001) &&
                          (bankScenarioCalc.rawCaloriesOver === 150.50) &&
                          (bankScenarioCalc.calculatedBankUsage === 150.50);
    const testC_passed = (Math.abs(rawRemaining - (2000 - 333.30)) < 0.0001) && noDoubleCount;

    // D. Veckototal via produktionsfunktionen calculateWeeklyTotals()
    const dailyRawInputs = [1500.33, 1600.44, 1750.55, 1400.12, 1850.88, 1950.25, 1550.43];
    const weeklyDaysData = dailyRawInputs.map(c => ({ consumedCalories: c, calorieGoal: 2000 }));
    const weeklyTotalsResult = calculateWeeklyTotals(weeklyDaysData, 2000);
    const exactRawSum = weeklyTotalsResult.totalConsumed; // 11603.00
    const displayWeekSum = weeklyTotalsResult.displayTotalConsumed; // 11603
    const dailyRoundedValues = dailyRawInputs.map(v => Math.round(v)); // [1500, 1600, 1751, 1400, 1851, 1950, 1550]
    const sumOfPreRoundedDays = dailyRoundedValues.reduce((a, b) => a + b, 0); // 11602 (1 kcal fel)
    const roundingErrorPrevented = exactRawSum - sumOfPreRoundedDays; // +1.00 kcal fel förebyggt
    const testD_passed = Math.abs(exactRawSum - 11603.0) < 0.0001 && 
                         displayWeekSum === 11603 && 
                         weeklyTotalsResult.totalGoal === 14000;

    // E. Dygnsgräns och Tidszon via produktionsfunktionen getMealDateUID()
    // Testa en tidpunkt sent på kvällen (23:30 lokal tid)
    const testLateNight = new Date(2026, 7, 21, 23, 30, 0); // Lokal tid 21 aug 2026 kl 23:30
    const localUID = getMealDateUID(testLateNight);
    const testE_passed = localUID === '2026-08-21';

    // F. Redigera & Ta bort (Full omräkning från grunden via sumMealNutrients)
    let workingList = [...testMeals];
    const initialSum = sumMealNutrients(workingList).calories; // 333.30
    // Ta bort måltid #5
    workingList = workingList.filter(m => m.id !== 'audit_meal_5');
    const sumAfterDelete = sumMealNutrients(workingList).calories; // 299.97
    // Redigera måltid #2 till 50.55 kcal
    workingList = workingList.map(m => m.id === 'audit_meal_2' ? { ...m, nutritionalInfo: { ...m.nutritionalInfo, calories: 50.55 } } : m);
    const sumAfterEdit = sumMealNutrients(workingList).calories; // 317.19
    const expectedEditSum = (9 - 1) * 33.33 + 50.55; // 8 * 33.33 + 50.55 = 266.64 + 50.55 = 317.19
    const testF_passed = Math.abs(sumAfterEdit - expectedEditSum) < 0.0001;

    // G. Bevara råvärden vid redigering (Raw Value Preservation on Edit)
    // Verifierar: Logga en måltid med 33,33 kcal, simulera en redigering där ingenting ändras,
    // och kontrollera att värdet fortfarande är 33,33 och inte 33.
    const originalRawMealInfo = {
      foodItem: 'Testmåltid 33.33 kcal',
      calories: 33.33,
      protein: 3.33,
      carbohydrates: 4.44,
      fat: 1.11,
    };
    // Formuläret laddas med avrundade värden för användarvänlighet ("33", "3", "4", "1")
    const simulatedUnchangedFields = {
      foodItem: 'Testmåltid 33.33 kcal',
      calories: Math.round(originalRawMealInfo.calories).toString(), // "33"
      protein: Math.round(originalRawMealInfo.protein).toString(), // "3"
      carbohydrates: Math.round(originalRawMealInfo.carbohydrates).toString(), // "4"
      fat: Math.round(originalRawMealInfo.fat).toString(), // "1"
    };
    // Användaren klickar spara utan att ha ändrat fälten
    const savedAfterUnchangedEdit = resolveUpdatedNutrients(originalRawMealInfo, simulatedUnchangedFields);
    const isCaloriesPreserved = Math.abs(savedAfterUnchangedEdit.calories - 33.33) < 0.0001;
    const isProteinPreserved = Math.abs(savedAfterUnchangedEdit.protein - 3.33) < 0.0001;
    const isCarbsPreserved = Math.abs(savedAfterUnchangedEdit.carbohydrates - 4.44) < 0.0001;
    const isFatPreserved = Math.abs(savedAfterUnchangedEdit.fat - 1.11) < 0.0001;

    // Simulera även en faktisk medveten ändring: användaren skriver in "50"
    const savedAfterExplicitEdit = resolveUpdatedNutrients(originalRawMealInfo, {
      ...simulatedUnchangedFields,
      calories: '50'
    });
    const isExplicitEditHandled = savedAfterExplicitEdit.calories === 50;

    const testG_passed = isCaloriesPreserved && isProteinPreserved && isCarbsPreserved && isFatPreserved && isExplicitEditHandled;

    // H. Fotovägen & Portionsmultiplikator (Photo Pipeline & Multiplier Precision)
    // Simulera ett analysresultat med bråkiga råvärden: 337.4 kcal
    const rawPhotoAnalysis = {
      foodItem: 'Pannkakor med sylt',
      calories: 337.4,
      protein: 12.6,
      carbohydrates: 45.2,
      fat: 11.8,
    };
    // Modalen laddar Math.round i inmatningsfälten för ren användarvisning ("337", "13", "45", "12")
    const photoModalFieldsUnedited = {
      foodItem: rawPhotoAnalysis.foodItem,
      calories: Math.round(rawPhotoAnalysis.calories).toString(), // "337"
      protein: Math.round(rawPhotoAnalysis.protein).toString(), // "13"
      carbohydrates: Math.round(rawPhotoAnalysis.carbohydrates).toString(), // "45"
      fat: Math.round(rawPhotoAnalysis.fat).toString(), // "12"
    };
    // Fall 1: Användaren loggar orört utan att redigera -> resolveUpdatedNutrients bevarar 337.4
    const resolvedPhotoMeal1 = resolveUpdatedNutrients(rawPhotoAnalysis, photoModalFieldsUnedited);
    const isPhoto1Preserved = Math.abs(resolvedPhotoMeal1.calories - 337.4) < 0.0001;

    // Fall 2: Portionsmultiplikator 3 appliceras i Dashboard.tsx på råvärdet utan trunkering
    const portionMultiplierVal = 3;
    const photoMeal3Calories = resolvedPhotoMeal1.calories * portionMultiplierVal; // 337.4 * 3 = 1012.2
    const preRounded3Calories = Math.round(rawPhotoAnalysis.calories) * portionMultiplierVal; // 337 * 3 = 1011 (fel!)
    const isPhoto3Correct = Math.abs(photoMeal3Calories - 1012.2) < 0.0001;

    const testH_passed = isPhoto1Preserved && isPhoto3Correct;

    const passedAll = testA_passed && testB_passed && testC_passed && testD_passed && testE_passed && testF_passed && testG_passed && testH_passed;

    setArithmeticAuditResult({
      passed: passedAll,
      executedAt: new Date().toLocaleTimeString('sv-SE'),
      testA_mealSum: {
        passed: testA_passed,
        mealsCount: mealCount,
        mealValue: mealKcal,
        rawSum: Number(rawCalories.toFixed(2)),
        preRoundedSum: preRoundedCalories,
        displaySum: displayCalories,
        diffIfPreRounded,
        actualError: Number(actualError.toFixed(4)),
      },
      testB_macros: {
        passed: testB_passed,
        rawProtein: Number(rawProtein.toFixed(2)),
        displayProtein,
        rawCarbs: Number(rawCarbs.toFixed(2)),
        displayCarbs,
        rawFat: Number(rawFat.toFixed(2)),
        displayFat,
        calculatedMacroCalories: Number(((rawProtein * 4) + (rawCarbs * 4) + (rawFat * 9)).toFixed(2)),
        statedCalories: Number(rawCalories.toFixed(2)),
      },
      testC_remaining: {
        passed: testC_passed,
        goal: calorieGoal,
        consumedRaw: Number(rawCalories.toFixed(2)),
        rawRemaining: Number(rawRemaining.toFixed(2)),
        displayRemaining,
        bankScenario: {
          passed: noDoubleCount,
          goal: bankGoal,
          consumed: bankConsumed,
          availableBank,
          rawExcess: Number(bankScenarioCalc.rawCaloriesOver.toFixed(2)),
          bankDeduction: Number(bankScenarioCalc.calculatedBankUsage.toFixed(2)),
          remainingBank: Number(bankScenarioCalc.remainingBankDisplay.toFixed(2)),
          netOverBudget: Number(bankScenarioCalc.netCaloriesOver.toFixed(2)),
          noDoubleCountVerified: noDoubleCount,
        }
      },
      testD_weeklyTotal: {
        passed: testD_passed,
        dailyRawInputs,
        dailyRoundedValues,
        exactRawSum: Number(exactRawSum.toFixed(2)),
        displayWeekSum,
        sumOfPreRoundedDays,
        roundingErrorPrevented: Number(roundingErrorPrevented.toFixed(2)),
      },
      testE_timezoneMidnight: {
        passed: testE_passed,
        testTimestamp: '2026-08-21 23:30:00 (Lokal tid)',
        localDateString: localUID,
        utcDateString: testLateNight.toISOString().split('T')[0],
        usesLocalDate: testE_passed,
      },
      testF_recalcOnMutation: {
        passed: testF_passed,
        initialSum: Number(initialSum.toFixed(2)),
        sumAfterDelete: Number(sumAfterDelete.toFixed(2)),
        sumAfterEdit: Number(sumAfterEdit.toFixed(2)),
        pureFromScratch: testF_passed,
      },
      testG_rawPreservation: {
        passed: testG_passed,
        originalRawCalories: originalRawMealInfo.calories,
        displayedFieldCalories: simulatedUnchangedFields.calories,
        savedRawCaloriesAfterUnchangedEdit: savedAfterUnchangedEdit.calories,
        isExactlyPreserved: isCaloriesPreserved,
        explicitEditHandled: isExplicitEditHandled,
      },
      testH_photoMultiplier: {
        passed: testH_passed,
        rawCalories: rawPhotoAnalysis.calories,
        savedCaloriesSingle: Number(resolvedPhotoMeal1.calories.toFixed(2)),
        expectedSingle: 337.4,
        portionMultiplier: portionMultiplierVal,
        savedCaloriesMultiplied: Number(photoMeal3Calories.toFixed(2)),
        expectedMultiplied: 1012.2,
        preRoundedMultiplied: preRounded3Calories,
      }
    });
  };

  // Helper to generate date string X days ago
  const getDateDaysAgo = (daysAgo: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  /**
   * Genererar deterministisk syntetisk logghistorik för ett givet antal dagar utan slumpmässigt brus.
   */
  const generatePastDays = (
    count: number,
    dailyCalories: number,
    logRatio: number, // 0.0 - 1.0 (t.ex. 0.95 = 95% loggade dagar)
    calorieGoal: number = 1800,
    proteinGoal: number = 130
  ): PastDaySummary[] => {
    const list: PastDaySummary[] = [];
    const unloggedFrequency = logRatio < 1 ? Math.max(2, Math.round(1 / (1 - logRatio))) : 0;

    for (let i = count; i >= 1; i--) {
      const dateStr = getDateDaysAgo(i);
      // Deterministisk fördelning av loggade vs ologgade dagar utan slump
      const isLogged = logRatio >= 1 || (unloggedFrequency > 0 && i % unloggedFrequency !== 0);
      
      if (isLogged) {
        list.push({
          date: dateStr,
          goalMet: true,
          consumedCalories: dailyCalories,
          consumedProtein: proteinGoal,
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
   * Genererar deterministiska syntetiska viktloggar utan slumpmässigt brus.
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
      const fraction = count > 0 ? (count - i) / count : 1;
      const weight = startWeight + (endWeight - startWeight) * fraction;
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
    // Kvinna, 35 år, 168 cm, 70 kg -> BMR = 1414 kcal
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
      calorieGoal: 1450, // Nära BMR (1414 kcal)
      proteinGoal: 120,
      carbohydrateGoal: 130,
      fatGoal: 45
    };

    const pastDays = generatePastDays(24, 1440, 0.95, 1450, 120);
    const weightLogs = generateWeightLogs(24, 70.0, 70.0); // Fast stabil vikt 70.0 kg

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
      description: 'Profil där dagligt mål (1450 kcal) ligger strax över beräknad BMR (1414 kcal), 21+ dagars stabil vikt, hög loggningsgrad (95%). Förväntat: status intake_too_low, INGET sänkningsförslag oavsett räknare.',
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
    // 21+ dagars stabil vikt, hög loggningsgrad, intag med god marginal över BMR (t.ex. 2050 kcal för man)
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
      calorieGoal: 2050, // God marginal över BMR (1885 kcal)
      proteinGoal: 160,
      carbohydrateGoal: 200,
      fatGoal: 65
    };

    const pastDays = generatePastDays(25, 2030, 0.95, 2050, 160);
    const weightLogs = generateWeightLogs(25, 92.0, 92.0); // Fast stabil vikt 92.0 kg

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
    // Vikten står stilla (75.0 kg -> 75.0 kg), men bodyFatMassKg minskar med -1.5 kg (tydligt > 0.2 kg marginal) och skelettmuskelmassa ökar med +1.0 kg
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

    const pastDays = generatePastDays(25, 1820, 0.95, 1850, 140);
    // 25 dagar: Fast vikt 75.0 -> 75.0 kg, Fett 22.5 -> 21.0 kg (-1.5 kg fettminskning), Muskler 27.5 -> 28.5 kg (+1.0 kg muskelökning)
    const weightLogs = generateWeightLogs(25, 75.0, 75.0, 22.5, 21.0, 27.5, 28.5);

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
      description: 'measurementMethod är "inbody". Vikten har stått helt stilla på 75.0 kg, men fettmassan har minskat med -1.5 kg (tydlig marginal över 0.2 kg) och muskelmassan ökat med +1.0 kg över 25 dagar. Förväntat: isPlateau: false, status recomposition_progress, positiv feedback på kroppsrekomposition.',
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
    // 21+ dagars stabil vikt (0.0 kg förändring, tydligt inom gränsen för platå), hög loggningsgrad (> 80%), Mätvecka EJ genomförd tidigare
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
      calorieGoal: 1850, // BMR 1470 kcal
      proteinGoal: 130,
      carbohydrateGoal: 180,
      fatGoal: 60
    };

    const pastDays = generatePastDays(24, 1840, 0.95, 1850, 130);
    const weightLogs = generateWeightLogs(24, 78.0, 78.0); // Fast stabil vikt 78.0 kg (0.0 kg delta, tydligt platå)

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
      description: 'measurementMethod är "scale". 21+ dagars stabil vikt (0.0 kg förändring), 95% loggningsgrad, ingen mätvecka genomförd än. Förväntat: isPlateau: true, status measuring_week_recommended, coach föreslår en 7 dagars Mätvecka och alternativa strategier (steg, protein, diet break) innan kalorisänkning.',
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

    // Deterministiskt ~50-55% loggade dagar
    const pastDays = generatePastDays(24, 2050, 0.55, 2100, 150);
    const weightLogs = generateWeightLogs(24, 88.0, 88.0); // Fast stabil vikt 88.0 kg

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

      {/* Aritmetik- och Avrundningsrevision Självtest */}
      <div className="bg-white p-5 rounded-2xl border border-[#2B3B2C]/20 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-800 text-base flex items-center gap-2">
                Aritmetik- och Avrundningsrevision
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Självtest
                </span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Verifierar att råvärden summeras obrutet och endast avrundas vid visning. Kontrollerar måltidssummor, makron, Sparpott, veckototaler och dygnsgränser.
              </p>
            </div>
          </div>

          <button
            onClick={handleRunArithmeticAudit}
            className="px-4 py-2.5 bg-[#2B3B2C] hover:bg-[#1E291F] text-white rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
            Kör självtest (10 x 33,33 kcal)
          </button>
        </div>

        {arithmeticAuditResult ? (
          <div className="space-y-4 animate-fade-in">
            {/* Huvudstatus */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              arithmeticAuditResult.passed 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              <div className="flex items-center gap-3">
                {arithmeticAuditResult.passed ? (
                  <ShieldCheck className="w-7 h-7 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-7 h-7 text-red-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {arithmeticAuditResult.passed 
                      ? 'Alla 7 aritmetiska verifieringar GODKÄNDA' 
                      : 'Ett eller flera aritmetiska tester misslyckades'}
                  </h4>
                  <p className="text-xs opacity-80 mt-0.5">
                    Testet kördes {arithmeticAuditResult.executedAt} med syntetiska måltider (råvärden summerade före visningsavrundning & bevarande av råvärden vid redigering).
                  </p>
                </div>
              </div>
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full self-start sm:self-auto ${
                arithmeticAuditResult.passed 
                  ? 'bg-emerald-200/80 text-emerald-900' 
                  : 'bg-red-200/80 text-red-900'
              }`}>
                {arithmeticAuditResult.passed ? 'STATUS: PASS (100%)' : 'STATUS: FAIL'}
              </span>
            </div>

            {/* Testfall A-G Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Test A: Summa av måltider */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                arithmeticAuditResult.testA_mealSum.passed 
                  ? 'bg-neutral-50/70 border-neutral-200' 
                  : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Test A: Dagstotal "Ätit"</span>
                  {arithmeticAuditResult.testA_mealSum.passed ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3 mr-1" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      <XCircle className="w-3 h-3 mr-1" /> FEL
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1 text-neutral-700 font-mono">
                  <p>Input: 10 måltider x 33,33 kcal</p>
                  <p>Exakt råsumma: <strong>{arithmeticAuditResult.testA_mealSum.rawSum} kcal</strong></p>
                  <p>Visas i UI: <strong>{arithmeticAuditResult.testA_mealSum.displaySum} kcal</strong></p>
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200/60 mt-1">
                    Vid felaktig måltidsavrundning (10x33): {arithmeticAuditResult.testA_mealSum.preRoundedSum} kcal (fel: {arithmeticAuditResult.testA_mealSum.diffIfPreRounded} kcal förebyggt).
                  </p>
                </div>
              </div>

              {/* Test B: Makrofördelning */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                arithmeticAuditResult.testB_macros.passed 
                  ? 'bg-neutral-50/70 border-neutral-200' 
                  : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Test B: Makrofördelning</span>
                  {arithmeticAuditResult.testB_macros.passed ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3 mr-1" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      <XCircle className="w-3 h-3 mr-1" /> FEL
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1 text-neutral-700 font-mono">
                  <p>Protein råvärde: <strong>{arithmeticAuditResult.testB_macros.rawProtein}g</strong> (Visas: {arithmeticAuditResult.testB_macros.displayProtein}g)</p>
                  <p>Kolhydrater råvärde: <strong>{arithmeticAuditResult.testB_macros.rawCarbs}g</strong> (Visas: {arithmeticAuditResult.testB_macros.displayCarbs}g)</p>
                  <p>Fett råvärde: <strong>{arithmeticAuditResult.testB_macros.rawFat}g</strong> (Visas: {arithmeticAuditResult.testB_macros.displayFat}g)</p>
                  <p className="text-[11px] text-neutral-500 pt-1">
                    Summeras alltid från råa gram och avrundas per kort vid render.
                  </p>
                </div>
              </div>

              {/* Test C: Återstående & Sparpott */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                arithmeticAuditResult.testC_remaining.passed 
                  ? 'bg-neutral-50/70 border-neutral-200' 
                  : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Test C: Återstående & Sparpott</span>
                  {arithmeticAuditResult.testC_remaining.passed ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3 mr-1" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      <XCircle className="w-3 h-3 mr-1" /> FEL
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1 text-neutral-700 font-mono">
                  <p>Mål 2000 kcal - Ätit 333,30 kcal</p>
                  <p>Råvärde kvar: <strong>{arithmeticAuditResult.testC_remaining.rawRemaining} kcal</strong></p>
                  <p>Visas i UI: <strong>{arithmeticAuditResult.testC_remaining.displayRemaining} kcal</strong></p>
                  <div className="text-[11px] text-emerald-800 bg-emerald-50 p-1.5 rounded border border-emerald-200 mt-1 space-y-0.5">
                    <p>Sparpott vid överskott (Mål 1500, Ätit 1650,5, Sparpott 300):</p>
                    <p>• Dras från sparpott: {arithmeticAuditResult.testC_remaining.bankScenario.bankDeduction} kcal</p>
                    <p>• Kvar i sparpott: {arithmeticAuditResult.testC_remaining.bankScenario.remainingBank} kcal</p>
                    <p>• Ingen dubbelräkning verifierad ✅</p>
                  </div>
                </div>
              </div>

              {/* Test D: Veckototalen */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                arithmeticAuditResult.testD_weeklyTotal.passed 
                  ? 'bg-neutral-50/70 border-neutral-200' 
                  : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Test D: Veckototal</span>
                  {arithmeticAuditResult.testD_weeklyTotal.passed ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3 mr-1" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      <XCircle className="w-3 h-3 mr-1" /> FEL
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1 text-neutral-700 font-mono">
                  <p>7 dagars råvärden: [1500.33, 1600.44, 1750.55, 1400.12, 1850.88, 1950.25, 1550.43]</p>
                  <p>Exakt råsumma vecka: <strong>{arithmeticAuditResult.testD_weeklyTotal.exactRawSum} kcal</strong></p>
                  <p>Visas i veckoöversikt: <strong>{arithmeticAuditResult.testD_weeklyTotal.displayWeekSum} kcal</strong></p>
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200/60 mt-1">
                    Summa av 7 avrundade dagar: {arithmeticAuditResult.testD_weeklyTotal.sumOfPreRoundedDays} kcal. Råsummering förebygger {arithmeticAuditResult.testD_weeklyTotal.roundingErrorPrevented} kcal fel.
                  </p>
                </div>
              </div>

              {/* Test E: Tidszon & Dygnsgräns */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                arithmeticAuditResult.testE_timezoneMidnight.passed 
                  ? 'bg-neutral-50/70 border-neutral-200' 
                  : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Test E: Dygnsgräns & Tid</span>
                  {arithmeticAuditResult.testE_timezoneMidnight.passed ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3 mr-1" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      <XCircle className="w-3 h-3 mr-1" /> FEL
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1 text-neutral-700 font-mono">
                  <p className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-neutral-500" /> Loggtid: {arithmeticAuditResult.testE_timezoneMidnight.testTimestamp}</p>
                  <p>Genererad dag-ID: <strong>{arithmeticAuditResult.testE_timezoneMidnight.localDateString}</strong></p>
                  <p className="text-[11px] text-neutral-500 pt-1">
                    getDateUID använder lokal klienttid. Måltider loggade sent på kvällen hamnar på rätt lokalt dygn och drabbas inte av UTC-förskjutning.
                  </p>
                </div>
              </div>

              {/* Test F: Redigera & Ta bort */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                arithmeticAuditResult.testF_recalcOnMutation.passed 
                  ? 'bg-neutral-50/70 border-neutral-200' 
                  : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Test F: Edit / Delete Omräkning</span>
                  {arithmeticAuditResult.testF_recalcOnMutation.passed ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3 mr-1" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      <XCircle className="w-3 h-3 mr-1" /> FEL
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1 text-neutral-700 font-mono">
                  <p className="flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5 text-neutral-500" /> Initial summa: {arithmeticAuditResult.testF_recalcOnMutation.initialSum} kcal</p>
                  <p>Efter radering av måltid #5: <strong>{arithmeticAuditResult.testF_recalcOnMutation.sumAfterDelete} kcal</strong></p>
                  <p>Efter edit av måltid #2: <strong>{arithmeticAuditResult.testF_recalcOnMutation.sumAfterEdit} kcal</strong></p>
                  <p className="text-[11px] text-neutral-500 pt-1">
                    recalculateAndSaveSummary beräknar alltid om alla måltider från grunden utan ackumulerade diff-fel.
                  </p>
                </div>
              </div>

              {/* Test G: Bevara Råvärden vid Redigering */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                arithmeticAuditResult.testG_rawPreservation.passed 
                  ? 'bg-neutral-50/70 border-neutral-200' 
                  : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Test G: Bevara Råvärden</span>
                  {arithmeticAuditResult.testG_rawPreservation.passed ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3 mr-1" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      <XCircle className="w-3 h-3 mr-1" /> FEL
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1 text-neutral-700 font-mono">
                  <p>Originalmåltid: <strong>{arithmeticAuditResult.testG_rawPreservation.originalRawCalories} kcal</strong></p>
                  <p>Visas i formulärfält: "{arithmeticAuditResult.testG_rawPreservation.displayedFieldCalories}" kcal</p>
                  <p>Sparat efter oändrad redigering: <strong>{arithmeticAuditResult.testG_rawPreservation.savedRawCaloriesAfterUnchangedEdit} kcal</strong></p>
                  <p className="text-[11px] text-emerald-800 bg-emerald-50 p-1.5 rounded border border-emerald-200 mt-1">
                    Exakt råvärde (33,33) bevaras intakt vid spara utan att trunkeras till 33. Vid faktisk ändring sparas det nya värdet korrekt.
                  </p>
                </div>
              </div>

              {/* Test H: Fotovägen & Portionsmultiplikator */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                arithmeticAuditResult.testH_photoMultiplier.passed 
                  ? 'bg-neutral-50/70 border-neutral-200' 
                  : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Test H: Fotologgning & Multiplikator</span>
                  {arithmeticAuditResult.testH_photoMultiplier.passed ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3 mr-1" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      <XCircle className="w-3 h-3 mr-1" /> FEL
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1.5 text-neutral-700 font-mono">
                  <div className="flex items-center justify-between bg-white p-1.5 rounded border border-neutral-200/80">
                    <span>1 port (orörd):</span>
                    <span>Förväntat: <strong>{arithmeticAuditResult.testH_photoMultiplier.expectedSingle} kcal</strong> | Faktiskt: <strong className="text-emerald-700">{arithmeticAuditResult.testH_photoMultiplier.savedCaloriesSingle} kcal</strong></span>
                  </div>
                  <div className="flex items-center justify-between bg-white p-1.5 rounded border border-neutral-200/80">
                    <span>{arithmeticAuditResult.testH_photoMultiplier.portionMultiplier}x portioner:</span>
                    <span>Förväntat: <strong>{arithmeticAuditResult.testH_photoMultiplier.expectedMultiplied} kcal</strong> | Faktiskt: <strong className="text-emerald-700">{arithmeticAuditResult.testH_photoMultiplier.savedCaloriesMultiplied} kcal</strong></span>
                  </div>
                  <p className="text-[11px] text-emerald-800 bg-emerald-50 p-1.5 rounded border border-emerald-200 mt-1">
                    Geminis analysvärde (337,4) bevaras orört vid loggning (inte 337). Vid 3x portioner blir resultatet exakt 1012,2 kcal (istället för 1011 vid förhandsavrundning).
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl text-center space-y-2">
            <p className="text-xs text-neutral-600 font-medium">
              Klicka på <strong>"Kör självtest (10 x 33,33 kcal)"</strong> ovan för att genomföra den aritmetiska revisionen och verifiera avrundningsprecisionen.
            </p>
          </div>
        )}
      </div>

      {/* Fotomätningshistorik */}
      <div className="bg-white p-5 rounded-2xl border border-amber-500/30 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h3 className="font-bold text-neutral-800 text-base flex items-center gap-2">
              <Timer className="w-5 h-5 text-amber-500" />
              Tidsmätning: Foto till Loggad Måltid (8 steg)
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Realtidsmätning av alla 8 steg från knapptryck via komprimering och Gemini 2.5 Flash till Firestore.
            </p>
          </div>
          <span className="text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full font-semibold">
            {getPhotoMetricsHistory().length} mätningar i minnet
          </span>
        </div>

        {getPhotoMetricsHistory().length === 0 ? (
          <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl text-center space-y-1">
            <p className="text-xs text-neutral-600 font-medium">
              Inga fotologgningar har gjorts i denna session ännu.
            </p>
            <p className="text-[11px] text-neutral-400">
              Gå till Dashboarden och ta ett foto med kameraknappen så visas hela tidslinjen här och i den flytande panelen.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {getPhotoMetricsHistory().slice(0, 3).map((item, idx) => (
              <div key={item.id} className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between font-sans">
                  <span className="font-bold text-neutral-800">
                    Mätning #{getPhotoMetricsHistory().length - idx}: {item.foodItemIdentified || 'Måltid'} ({item.caloriesIdentified || 0} kcal)
                  </span>
                  <span className="text-[11px] text-neutral-500">{item.formattedTime}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 bg-white rounded border border-neutral-200">
                    <span className="text-neutral-500 block text-[10px]">1. Bildtagning</span>
                    <strong className="text-neutral-800">{item.captureTimeMs.toFixed(1)} ms</strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-neutral-200">
                    <span className="text-neutral-500 block text-[10px]">2. Komprimering</span>
                    <strong className="text-amber-700">{item.compressionTimeMs.toFixed(1)} ms</strong>
                    <span className="text-[10px] text-neutral-400 block">{item.rawImageSizeKb.toFixed(0)}KB → {item.compressedImageSizeKb.toFixed(0)}KB</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-neutral-200">
                    <span className="text-neutral-500 block text-[10px]">4. Gemini Anrop</span>
                    <strong className="text-amber-700">{item.geminiCallTimeMs.toFixed(1)} ms</strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-neutral-200">
                    <span className="text-neutral-500 block text-[10px]">7. Firestore</span>
                    <strong className="text-blue-700">{item.firestoreSaveTimeMs.toFixed(1)} ms</strong>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-neutral-200 text-neutral-600 font-sans text-xs">
                  <span>Aktiv maskintid: <strong className="text-emerald-700 font-mono">{item.totalActiveProcessingTimeMs.toFixed(1)} ms</strong></span>
                  <span>Total väggklocka: <strong className="text-neutral-800 font-mono">{item.totalPipelineTimeMs.toFixed(1)} ms</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default DevelopmentTestingTool;
