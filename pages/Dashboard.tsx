import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, ShieldCheckIcon, CheckCircleIcon, FireIcon, CalendarIcon, ChatBubbleLeftRightIcon } from './icons';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BootcampParticipant, EveningReport, UserProfileData, GoalSettings, WeightLogEntry, WeeklyCalorieBank } from '../types';
import { subscribeToUserEveningReports, submitEveningReport, recalculateStreak, getBootcampStepGoal } from '../services/bootcampService';
import { fetchMealLogsForDate, fetchWaterLog } from '../services/firestoreService';
import { auth } from '../firebase';
import ToastNotification from './ToastNotification';
import MealStructureGuide from './MealStructureGuide';
import ProteinInfoModal from './ProteinInfoModal';
import { InformationCircleIcon } from './icons';
import { getDateUID } from '../utils/dateUtils';
import { getBootcampRankInfo } from '../utils/bootcampUtils';

interface BootcampDashboardProps {
  participant: BootcampParticipant;
  userProfile: UserProfileData;
  goals: GoalSettings;
  weightLogs: WeightLogEntry[];
  weeklyBank: WeeklyCalorieBank;
  onBack: () => void;
  ensureYesterdayProcessed?: (uid: string, now?: Date, options?: any, manualLogOverride?: any, prefetchedWater?: number) => Promise<void>;
}

const BootcampDashboard: React.FC<BootcampDashboardProps> = ({ participant, userProfile, goals, weightLogs, weeklyBank, onBack, ensureYesterdayProcessed }) => {
  const [reports, setReports] = useState<EveningReport[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProteinInfoModal, setShowProteinInfoModal] = useState(false);

  // Form state
  const [loggedAllMeals, setLoggedAllMeals] = useState(false);
  const [proteinMet, setProteinMet] = useState(false);
  const [waterMet, setWaterMet] = useState(false);
  const [steps, setSteps] = useState('');
  const [comment, setComment] = useState('');
  const [strengthTrained, setStrengthTrained] = useState(false);
  const [mood, setMood] = useState(5);
  const [sleep, setSleep] = useState('');
  const [editingYesterday, setEditingYesterday] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const todayStr = getDateUID(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getDateUID(yesterday);
  
  const targetDateStr = editingYesterday ? yesterdayStr : todayStr;
  const hasReportedToday = reports.some(r => r.date === todayStr);
  const yesterdayReport = reports.find(r => r.date === yesterdayStr);
  
  // Can edit yesterday if yesterday was reported but maybe we want to fix it.
  // Or maybe we didn't report yesterday at all.
  // The user can edit yesterday's report all day today.
  const canEditYesterday = (!yesterdayReport || !yesterdayReport.isGreenDay);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = subscribeToUserEveningReports(participant.cohortId, auth.currentUser.uid, (fetchedReports) => {
      setReports(fetchedReports);
      // Recalculate streak whenever reports change or on mount to fix any broken streaks
      recalculateStreak(participant.cohortId, auth.currentUser!.uid, fetchedReports).catch(console.error);
    });
    return () => unsubscribe();
  }, [participant.cohortId]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchProgress = async () => {
      try {
        const [meals, water] = await Promise.all([
          fetchMealLogsForDate(auth.currentUser!.uid, targetDateStr),
          fetchWaterLog(auth.currentUser!.uid, targetDateStr)
        ]);
        
        const totalProtein = meals.reduce((acc, meal) => acc + meal.nutritionalInfo.protein, 0);
        const totalCalories = meals.reduce((acc, meal) => acc + meal.nutritionalInfo.calories, 0);
        
        // Kcal-kravet: Får inte gå över målet (0 kcal marginal, men sparpott får användas).
        // Får ligga under målet, men max 20% under (för att bygga sparpott utan att svälta).
        // Måste ha loggat minst 400 kcal för att räknas som en aktiv dag.
        let isCaloriesWithinRange = false;
        if (userProfile.goalType === 'gain_muscle') {
          // För muskelbyggnad: Måste nå minst TDEE (mål - 300). Ingen strikt övre gräns.
          isCaloriesWithinRange = totalCalories >= (goals.calorieGoal - 300);
        } else {
          const bankedCalories = weeklyBank?.bankedCalories || 0;
          const upperLimit = goals.calorieGoal + bankedCalories;
          const lowerLimit = goals.calorieGoal * 0.8; // 20% under
          isCaloriesWithinRange = totalCalories >= lowerLimit && totalCalories <= upperLimit;
        }
        
        setLoggedAllMeals(meals.length > 0 && totalCalories > 400 && isCaloriesWithinRange);
        setProteinMet(totalProtein >= goals.proteinGoal);
        setWaterMet(water >= 2000); // 2 liters

        if (editingYesterday && yesterdayReport) {
          setSteps(yesterdayReport.steps.toString());
          setMood(yesterdayReport.mood);
          setStrengthTrained(yesterdayReport.strengthTrained);
          setSleep(yesterdayReport.sleep ? yesterdayReport.sleep.toString() : '');
          setComment(yesterdayReport.comment || '');
        } else if (!editingYesterday) {
          setSteps('');
          setMood(5);
          setStrengthTrained(false);
          setSleep('');
          setComment('');
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    };
    fetchProgress();
  }, [targetDateStr, goals.calorieGoal, goals.proteinGoal, editingYesterday, yesterdayReport, weeklyBank, userProfile.goalType]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const stepsNum = parseInt(steps, 10);
    if (isNaN(stepsNum)) {
      setToast({ message: 'Ange antal steg som en siffra.', type: 'error' });
      return;
    }

    const targetSteps = getBootcampStepGoal(userProfile.activityLevel, participant.status);
    const stepsMet = stepsNum >= targetSteps;
    const isGreenDay = loggedAllMeals && proteinMet && waterMet && stepsMet;

    setIsSubmitting(true);
    try {
      await submitEveningReport(participant.cohortId, auth.currentUser.uid, {
        date: targetDateStr,
        steps: stepsNum,
        mood,
        strengthTrained,
        sleep: sleep ? parseFloat(sleep) : undefined,
        proteinMet,
        waterMet,
        loggedAllMeals,
        comment,
        isGreenDay
      }, userProfile);
      
      if (editingYesterday) {
        if (isGreenDay) {
          setToast({ 
            message: 'Ordningen återställd! Generalen har justerat protokollet och din streak är räddad!', 
            type: 'success' 
          });
        } else {
          setToast({ 
            message: 'Gårdagens rapport har uppdaterats.', 
            type: 'info' 
          });
        }
        setEditingYesterday(false);
        
        // Trigger morning report update
        if (ensureYesterdayProcessed) {
          await ensureYesterdayProcessed(auth.currentUser.uid, new Date());
        }
      } else {
        setToast({ 
          message: isGreenDay ? 'Grön dag registrerad! Bra jobbat, rekryt!' : 'Röd dag registrerad. Streaken är bruten. Nya tag imorgon!', 
          type: isGreenDay ? 'success' : 'error' 
        });
      }
      
      // Reset form
      setLoggedAllMeals(false);
      setProteinMet(false);
      setWaterMet(false);
      setSteps('');
      setComment('');
      setStrengthTrained(false);
      setMood(5);
      setSleep('');
    } catch (error) {
      console.error("Error submitting report:", error);
      setToast({ message: 'Ett fel uppstod. Försök igen.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in pb-20">
      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-dark hover:text-primary transition-colors mb-6 font-bold"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Tillbaka till Kurser
      </button>

      {/* Header */}
      <div className="bg-neutral-darker text-white rounded-3xl shadow-soft-xl mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <button 
          onClick={() => setIsStatusOpen(!isStatusOpen)}
          className="w-full p-6 relative z-10 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="w-8 h-8 text-primary" />
            <div className="text-left">
              <h1 className="text-2xl font-extrabold uppercase tracking-wider">Lägesrapport</h1>
              <p className="text-neutral-300 text-sm font-medium">
                {participant.cohortId === 'solo' ? 'SOLO-UPPDRAG' : 'TRUPP-UPPDRAG'} • {participant.status === 'fas1' ? 'FAS 1: GRUNDTRÄNING' : 'FAS 2: ELIT'}
              </p>
            </div>
          </div>
          {isStatusOpen ? <ChevronUp className="w-6 h-6 text-neutral-400" /> : <ChevronDown className="w-6 h-6 text-neutral-400" />}
        </button>

        {isStatusOpen && (
          <div className="p-6 pt-0 relative z-10 animate-fade-in border-t border-white/10 mt-2">
            <p className="text-sm text-neutral-300 font-medium mb-6 leading-relaxed text-center italic">
              "Lystring! Disciplin är bron mellan mål och resultat. Visa mig vad du går för!"
            </p>
            <div className="flex gap-4 justify-center w-full max-w-md mx-auto">
              <div className="bg-black/40 px-4 py-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center flex-1">
                <div className="flex items-center gap-1 text-orange-400 mb-2 whitespace-nowrap">
                  <FireIcon className="w-6 h-6 shrink-0" />
                  <span className="font-bold text-2xl">{participant.currentStreak}</span>
                </div>
                <span className="text-[10px] sm:text-xs text-neutral-400 uppercase tracking-wider font-bold text-center">Nuvarande</span>
              </div>
              
              <div className="bg-black/40 px-2 py-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center flex-1 relative">
                <span className="absolute top-2 text-[10px] font-bold text-primary/80 uppercase tracking-wider">
                  {participant.status === 'fas1' ? 'Fas 1' : 'Fas 2'}
                </span>
                <div className="flex items-center gap-1 text-primary mb-2 whitespace-nowrap shrink-0">
                  <ShieldCheckIcon className="w-6 h-6 shrink-0" />
                  <span className="font-bold text-lg sm:text-xl whitespace-nowrap shrink-0 text-green-400">
                    {getBootcampRankInfo(participant.longestStreak || 0, participant.currentStreak || 0, participant.status).currentRank}
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs text-neutral-400 uppercase tracking-wider font-bold text-center">Rang</span>
              </div>

              <div className="bg-black/40 px-4 py-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center flex-1">
                <div className="flex items-center gap-1 text-neutral-300 mb-2 whitespace-nowrap">
                  <CalendarIcon className="w-6 h-6 shrink-0" />
                  <span className="font-bold text-2xl">
                    {getBootcampRankInfo(participant.longestStreak || 0, participant.currentStreak || 0, participant.status).nextRank ? getBootcampRankInfo(participant.longestStreak || 0, participant.currentStreak || 0, participant.status).daysToNext : 0}
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs text-neutral-400 uppercase tracking-wider font-bold text-center">Dagar Kvar</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TV Screen - Generalens Briefing (Dynamic based on Phase) */}
      <div className="bg-neutral-darker text-white rounded-3xl shadow-soft-xl mb-6 p-6 border border-white/5">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
          Sändning från Högkvarteret
        </h2>
        <div className="w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-neutral-dark bg-black relative aspect-video">
          <video 
            controls 
            preload="metadata"
            className="w-full h-full object-cover"
            key={participant.status} // Force re-render when status changes
          >
            <source 
              src={participant.status === 'fas1' ? "/general-fas1.mp4" : "/general-fas2.mp4"} 
              type="video/mp4" 
            />
            Din webbläsare stöder inte videouppspelning.
          </video>
          <div className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded tracking-wider">
            REC • {participant.status === 'fas1' ? 'FAS 1' : 'FAS 2'}
          </div>
        </div>
      </div>

      {/* Veckans Uppdrag (Weekly Assignment) */}
      {(() => {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        const isSunday = day === 0;
        const isMondayMorning = day === 1 && hour < 12;
        
        // Check if logged this week
        let hasLoggedThisWeek = false;
        if (weightLogs && weightLogs.length > 0) {
          const startOfWeighInWindow = new Date(now);
          const daysSinceMonday = day === 0 ? 6 : day - 1;
          startOfWeighInWindow.setDate(now.getDate() - daysSinceMonday);
          startOfWeighInWindow.setHours(0, 0, 0, 0);
          
          // If it's Sunday, we consider the week starting from last Monday to this Sunday.
          // Actually, the "weigh-in week" starts on Sunday and ends on Saturday.
          // Let's define the start of the weigh-in week as the most recent Sunday.
          const startOfWeighInWeek = new Date(now);
          startOfWeighInWeek.setDate(now.getDate() - day); // Go back to Sunday
          startOfWeighInWeek.setHours(0, 0, 0, 0);
          
          hasLoggedThisWeek = weightLogs.some(log => log.loggedAt >= startOfWeighInWeek.getTime());
        }

        const isDelayed = !isSunday && !isMondayMorning && !hasLoggedThisWeek;

        // Show if it's Sunday/Monday morning, OR if they haven't logged this week (delayed)
        if (isSunday || isMondayMorning || isDelayed) {
          return (
            <div className={`mb-6 p-5 rounded-2xl border-2 shadow-sm flex items-center justify-between ${hasLoggedThisWeek ? 'bg-green-50 border-green-200' : (isDelayed ? 'bg-red-50 border-red-200' : 'bg-primary-50 border-primary-200')}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${hasLoggedThisWeek ? 'bg-green-100 text-green-600' : (isDelayed ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-darker')}`}>
                  {hasLoggedThisWeek ? <CheckCircleIcon className="w-8 h-8" /> : '⚖️'}
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${hasLoggedThisWeek ? 'text-green-800' : (isDelayed ? 'text-red-800' : 'text-primary-darker')}`}>
                    Veckans Uppdrag: Invägning
                  </h3>
                  <p className={`text-sm ${hasLoggedThisWeek ? 'text-green-700' : (isDelayed ? 'text-red-700 font-medium' : 'text-primary-dark')}`}>
                    {hasLoggedThisWeek 
                      ? 'Bra jobbat! Du har loggat din vikt för denna vecka.' 
                      : (isDelayed 
                          ? 'FÖRSENAD! Du missade söndagens invägning. Logga din vikt omedelbart, soldat!' 
                          : 'Det är söndag! Dags att ställa sig på vågen och logga din vikt.')}
                  </p>
                </div>
              </div>
              {!hasLoggedThisWeek && (
                <button 
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-log-weight-modal'));
                  }}
                  className={`px-4 py-2 rounded-lg font-bold text-white shadow-sm transition-transform active:scale-95 ${isDelayed ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-darker'}`}
                >
                  Logga nu
                </button>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* Måltidsstruktur Guide */}
      <MealStructureGuide calorieGoal={goals.calorieGoal} proteinGoal={goals.proteinGoal} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Today's Report */}
          <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-neutral-dark flex items-center gap-2">
                <CheckCircleIcon className="w-6 h-6 text-primary" />
                {editingYesterday ? 'Gårdagens Kvällsrapport' : 'Dagens Kvällsrapport'}
              </h2>
              {!editingYesterday && canEditYesterday && (
                <button 
                  onClick={() => setEditingYesterday(true)}
                  className="text-sm font-bold text-orange-600 hover:text-orange-700 underline"
                >
                  Rätta gårdagen
                </button>
              )}
            </div>

            {(!editingYesterday && hasReportedToday) ? (
              <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 text-center">
                <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 mb-2">Rapport inlämnad!</h3>
                <p className="text-emerald-600 dark:text-emerald-300">
                  Du har lämnat din rapport för idag. Generalen har mottagit den. Vila upp dig inför morgondagen.
                </p>
                {canEditYesterday && (
                  <button 
                    onClick={() => setEditingYesterday(true)}
                    className="mt-4 px-4 py-2 bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 rounded-full font-bold text-sm hover:bg-orange-200 dark:hover:bg-orange-800/60 transition-colors"
                  >
                    Rätta gårdagens rapport
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-6">
                {editingYesterday && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400 rounded-2xl mb-4 flex justify-between items-center">
                    <span>Du redigerar gårdagens rapport ({yesterdayStr}).</span>
                    <button type="button" onClick={() => setEditingYesterday(false)} className="text-sm font-bold underline">Avbryt</button>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-2xl text-sm mb-4">
                    <p>
                      <strong>OBS:</strong> Mat, protein och vatten hämtas automatiskt från din loggbok. 
                      Om du saknar något, gå tillbaka till Hem-fliken och logga det innan du skickar in rapporten.
                    </p>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${loggedAllMeals ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${loggedAllMeals ? 'bg-emerald-500 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className={`font-bold block ${loggedAllMeals ? 'text-emerald-800 dark:text-emerald-400' : 'text-neutral-dark dark:text-white'}`}>Kalorimålet</span>
                      <span className={`text-sm ${loggedAllMeals ? 'text-emerald-600 dark:text-emerald-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {userProfile.goalType === 'gain_muscle' 
                          ? (loggedAllMeals ? 'Du har nått ditt minimiintag för muskelbyggnad.' : 'Du måste nå ditt minimiintag (TDEE) för att bygga muskler.')
                          : (loggedAllMeals ? 'Du ligger inom din kaloribudget (eller täcks av sparpotten).' : 'Du måste ligga inom din kaloribudget (max 20% under, ej över utan sparpott).')
                        }
                      </span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${proteinMet ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${proteinMet ? 'bg-emerald-500 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className={`font-bold flex items-center ${proteinMet ? 'text-emerald-800 dark:text-emerald-400' : 'text-neutral-dark dark:text-white'}`}>
                        Proteinkravet
                        <button 
                            type="button" 
                            onClick={() => setShowProteinInfoModal(true)}
                            className={`ml-1.5 transition-colors ${proteinMet ? 'text-emerald-600 hover:text-emerald-800' : 'text-neutral-400 hover:text-primary'}`}
                            aria-label="Information om proteinmål"
                        >
                            <InformationCircleIcon className="w-4 h-4" />
                        </button>
                      </span>
                      <span className={`text-sm ${proteinMet ? 'text-emerald-600 dark:text-emerald-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {proteinMet ? `Du har nått ditt mål (${goals.proteinGoal}g).` : `Du har inte nått ditt proteinmål (${goals.proteinGoal}g).`}
                      </span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${waterMet ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${waterMet ? 'bg-emerald-500 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className={`font-bold block ${waterMet ? 'text-emerald-800 dark:text-emerald-400' : 'text-neutral-dark dark:text-white'}`}>Vätskekontroll</span>
                      <span className={`text-sm ${waterMet ? 'text-emerald-600 dark:text-emerald-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {waterMet ? 'Du har druckit minst 2 liter vatten.' : 'Du har inte druckit 2 liter vatten än.'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                    <label className="block font-bold text-neutral-dark dark:text-white mb-2">Stegmålet (Minst {getBootcampStepGoal(userProfile.activityLevel, participant.status).toLocaleString()})</label>
                    <input 
                      type="number" 
                      value={steps}
                      onChange={(e) => setSteps(e.target.value)}
                      placeholder="Ange antal steg..."
                      className="w-full p-3 rounded-xl border border-neutral-light dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-dark dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>

                  <label className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={strengthTrained}
                      onChange={(e) => setStrengthTrained(e.target.checked)}
                      className="w-6 h-6 rounded text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <span className="font-bold text-neutral-dark dark:text-white block">Styrketräning</span>
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">Jag har genomfört ett träningspass idag.</span>
                    </div>
                  </label>

                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                    <label className="block font-bold text-neutral-dark dark:text-white mb-2">Sömn (Timmar)</label>
                    <input 
                      type="number" 
                      step="0.5"
                      value={sleep}
                      onChange={(e) => setSleep(e.target.value)}
                      placeholder="T.ex. 7.5"
                      className="w-full p-3 rounded-xl border border-neutral-light dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-dark dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                    <label className="block font-bold text-neutral-dark dark:text-white mb-2">Energinivå / Mående ({mood}/10)</label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={mood}
                      onChange={(e) => setMood(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                      <span>1 (Låg)</span>
                      <span>10 (Hög)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-neutral-dark dark:text-white mb-2">Kommentar till Generalen (Frivilligt)</label>
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Hur kändes dagen? Några utmaningar?"
                    className="w-full p-4 rounded-2xl border border-neutral-light dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-dark dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent min-h-[120px] resize-none"
                  />
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-200 dark:border-orange-800/50">
                  <p className="text-sm text-orange-800 dark:text-orange-400 font-medium">
                    <strong>OBS:</strong> Om du inte kan kryssa i alla boxar och har minst {getBootcampStepGoal(userProfile.activityLevel, participant.status).toLocaleString()} steg, kommer detta att registreras som en <strong className="text-red-600 dark:text-red-400">Röd Dag</strong> och din streak bryts.
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-neutral-darker text-white font-bold rounded-xl hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editingYesterday ? 'Uppdatera Gårdagens Rapport' : 'Skicka Kvällsrapport'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: History & Chat */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-3xl shadow-soft-xl border border-neutral-light dark:border-neutral-700">
            <h3 className="font-bold text-neutral-dark dark:text-white mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Historik (Senaste 7 dagarna)
            </h3>
            
            {reports.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 italic text-center py-4">Inga rapporter inlämnade ännu.</p>
            ) : (
              <div className="space-y-3">
                {reports.slice(0, 7).map((report, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <span className="text-sm font-medium text-neutral-dark dark:text-white">{report.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">{report.steps} steg</span>
                      <div className={`w-3 h-3 rounded-full ${report.isGreenDay ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showProteinInfoModal && (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowProteinInfoModal(false)}>
            <div onClick={e => e.stopPropagation()}>
                <ProteinInfoModal onClose={() => setShowProteinInfoModal(false)} />
            </div>
        </div>
      )}
    </div>
  );
};

export default BootcampDashboard;
