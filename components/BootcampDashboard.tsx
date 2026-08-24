import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftIcon, ShieldCheckIcon, CheckCircleIcon, FireIcon, CalendarIcon, ChatBubbleLeftRightIcon } from './icons';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BootcampParticipant, EveningReport, UserProfileData, GoalSettings, WeightLogEntry, WeeklyCalorieBank, BuddyDetails } from '../types';
import { subscribeToUserEveningReports, submitEveningReport, recalculateStreak, getBootcampStepGoal, completeBootcampOnboarding } from '../services/bootcampService';
import { fetchMealLogsForDate, fetchWaterLog, saveWeightLog } from '../services/firestoreService';
import { auth } from '../firebase';
import ToastNotification from './ToastNotification';
import MealStructureGuide from './MealStructureGuide';
import ProteinInfoModal from './ProteinInfoModal';
import LogWeightModal from './LogWeightModal';
import UserProfileModal from './UserProfileModal';
import { InformationCircleIcon } from './icons';
import { getDateUID } from '../utils/dateUtils';
import { sumMealNutrients } from '../utils/nutritionTotals';
import { getBootcampRankInfo } from '../utils/bootcampUtils';
import { BootcampDiplomaGalleryModal } from './BootcampDiplomaGalleryModal';
import { RankBadge } from './RankBadge';
import { Award, Volume2, VolumeX } from 'lucide-react';

interface BootcampDashboardProps {
  participant: BootcampParticipant;
  userProfile: UserProfileData;
  goals: GoalSettings;
  weightLogs: WeightLogEntry[];
  weeklyBank: WeeklyCalorieBank;
  onBack: () => void;
  ensureYesterdayProcessed?: (uid: string, now?: Date, options?: any, manualLogOverride?: any, prefetchedWater?: number) => Promise<void>;
  buddyDetails?: BuddyDetails[];
  onAddFriend?: (userId: string, userName: string) => void;
  onSaveProfileAndGoals?: (profileUpdates: UserProfileData, goalUpdates: GoalSettings) => Promise<void>;
  onSaveWeightLog?: (data: Omit<WeightLogEntry, 'id'>) => Promise<void>;
}

const BootcampDashboard: React.FC<BootcampDashboardProps> = ({ participant, userProfile, goals, weightLogs, weeklyBank, onBack, ensureYesterdayProcessed, buddyDetails = [], onAddFriend, onSaveProfileAndGoals, onSaveWeightLog }) => {
  const [reports, setReports] = useState<EveningReport[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProteinInfoModal, setShowProteinInfoModal] = useState(false);
  const [showDiplomaGallery, setShowDiplomaGallery] = useState(false);
  const [isSpeakingQuote, setIsSpeakingQuote] = useState(false);

  // Waiting Room state
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfileData | null>(null);
  const [hasCompletedWeight, setHasCompletedWeight] = useState(participant.bootcampOnboardingCompleted || false);

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
  
  let joinedToday = false;
  if (participant.joinedAt) {
    let joinedDate;
    if (typeof (participant.joinedAt as any).toDate === 'function') {
      joinedDate = (participant.joinedAt as any).toDate();
    } else if (typeof participant.joinedAt === 'number') {
      // If it's a timestamp in seconds (Firestore sometimes returns this if not fully parsed)
      // or milliseconds. Let's assume milliseconds if it's large, seconds if small.
      joinedDate = new Date(participant.joinedAt > 1e11 ? participant.joinedAt : participant.joinedAt * 1000);
    } else if (typeof participant.joinedAt === 'string') {
      joinedDate = new Date(participant.joinedAt);
    } else if ((participant.joinedAt as any).seconds) {
      joinedDate = new Date((participant.joinedAt as any).seconds * 1000);
    }
    
    if (joinedDate && !isNaN(joinedDate.getTime())) {
      joinedToday = getDateUID(joinedDate) === todayStr;
    }
  }

  const justStartedToday = participant.fas1StartDate === todayStr || joinedToday;
  const canEditYesterday = !justStartedToday && (!yesterdayReport || !yesterdayReport.isGreenDay);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = subscribeToUserEveningReports(participant.cohortId, auth.currentUser.uid, (fetchedReports) => {
      setReports(fetchedReports);
      // Recalculate streak whenever reports change or on mount to fix any broken streaks
      recalculateStreak(participant.cohortId, auth.currentUser!.uid, fetchedReports).catch(console.error);
    }, participant.fas1StartDate);
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
        
        const { calories: totalCalories, protein: totalProtein } = sumMealNutrients(meals);
        
        // Kcal-kravet: Får inte gå över målet (0 kcal marginal, men sparpott får användas).
        // Får ligga under målet, men max 20% under (för att bygga sparpott utan att svälta).
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
        
        setLoggedAllMeals(meals.length > 0 && isCaloriesWithinRange);
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

  const handleWeightSaved = async (data: Omit<WeightLogEntry, 'id'>) => {
    if (!auth.currentUser) return;
    try {
      if (onSaveWeightLog) {
        await onSaveWeightLog(data);
      } else {
        await saveWeightLog(auth.currentUser.uid, data);
      }
      
      const isUsingInBody = data.skeletalMuscleMassKg != null || data.bodyFatMassKg != null;
      
      let startDate = participant.originalStartDate ? new Date(participant.originalStartDate) : new Date();
      if (participant.cohortId === 'solo' || participant.cohortId === 'solo_group') {
        startDate = new Date();
      }
      const targetDate = new Date(startDate);
      targetDate.setDate(targetDate.getDate() + 84); // 12 weeks

      const updatedProfile: UserProfileData = { 
        ...userProfile, 
        currentWeightKg: data.weightKg,
        skeletalMuscleMassKg: data.skeletalMuscleMassKg ?? userProfile.skeletalMuscleMassKg,
        bodyFatMassKg: data.bodyFatMassKg ?? userProfile.bodyFatMassKg,
        measurementMethod: isUsingInBody ? 'inbody' : 'scale',
        goalCompletionDate: targetDate.toISOString().split('T')[0],
        goalStartDate: new Date().toISOString().split('T')[0],
        goalStartWeight: data.weightKg,
        goalStartFatMassKg: data.bodyFatMassKg ?? userProfile.bodyFatMassKg,
        goalStartMuscleMassKg: data.skeletalMuscleMassKg ?? userProfile.skeletalMuscleMassKg
      };
      
      setTempProfile(updatedProfile);
      setHasCompletedWeight(true);
      setShowWeightModal(false);
      setShowProfileModal(true);
    } catch (error) {
      console.error("Error saving weight log during bootcamp onboarding:", error);
      setToast({ message: 'Kunde inte spara mätningen', type: 'error' });
    }
  };

  const handleProfileSaved = async (updatedProfile: UserProfileData, updatedGoals: GoalSettings) => {
    if (!auth.currentUser) return;
    try {
      if (onSaveProfileAndGoals) {
        await onSaveProfileAndGoals(updatedProfile, updatedGoals);
      }
      await completeBootcampOnboarding(auth.currentUser.uid, participant.cohortId);
      setShowProfileModal(false);
      setToast({ message: 'Du är nu redo för Bootcamp!', type: 'success' });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      setToast({ message: 'Ett fel uppstod. Försök igen.', type: 'error' });
    }
  };

  const isWaitingRoom = !participant.bootcampOnboardingCompleted || (participant.originalStartDate && participant.originalStartDate > todayStr);

  if (isWaitingRoom) {
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
          Tillbaka
        </button>

        <div className="bg-white p-8 rounded-3xl shadow-soft-xl border border-neutral-light text-center max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
            <CalendarIcon className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-neutral-darker mb-4">Väntrummet</h1>
          
          {participant.originalStartDate && participant.originalStartDate > todayStr ? (
            <p className="text-lg text-neutral-600 mb-8">
              Din trupp drar igång den <strong className="text-primary">{participant.originalStartDate}</strong>. 
              Tills dess kan du förbereda dig genom att göra din startmätning och sätta dina mål.
            </p>
          ) : (
            <p className="text-lg text-neutral-600 mb-8">
              Innan du kan börja rapportera måste du göra din startmätning och sätta dina mål.
            </p>
          )}

          <div className="space-y-4">
            <div className={`p-4 rounded-xl border ${hasCompletedWeight ? 'bg-[#E8EFE9] border-[#8C9A86]/40' : 'bg-[#F1EAE0]/50 border-[#F1EAE0]'} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasCompletedWeight ? 'bg-[#8C9A86] text-white' : 'bg-[#F1EAE0] text-[#7A756E]'}`}>
                  1
                </div>
                <span className={`font-bold ${hasCompletedWeight ? 'text-[#2B3B2C]' : 'text-[#56524D]'}`}>Startmätning</span>
              </div>
              {hasCompletedWeight ? (
                <CheckCircleIcon className="w-6 h-6 text-[#8C9A86]" />
              ) : (
                <button 
                  onClick={() => setShowWeightModal(true)}
                  className="px-4 py-2 bg-[#D96E4A] text-white font-bold rounded-lg hover:bg-[#C05A38] transition-colors"
                >
                  Gör nu
                </button>
              )}
            </div>

            <div className={`p-4 rounded-xl border ${participant.bootcampOnboardingCompleted ? 'bg-[#E8EFE9] border-[#8C9A86]/40' : 'bg-[#F1EAE0]/50 border-[#F1EAE0]'} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${participant.bootcampOnboardingCompleted ? 'bg-[#8C9A86] text-white' : 'bg-[#F1EAE0] text-[#7A756E]'}`}>
                  2
                </div>
                <span className={`font-bold ${participant.bootcampOnboardingCompleted ? 'text-[#2B3B2C]' : 'text-[#56524D]'}`}>Sätt dina mål</span>
              </div>
              {participant.bootcampOnboardingCompleted ? (
                <CheckCircleIcon className="w-6 h-6 text-[#8C9A86]" />
              ) : (
                <button 
                  onClick={() => {
                    if (!hasCompletedWeight) {
                      setToast({ message: 'Gör startmätningen först!', type: 'info' });
                    } else {
                      setShowProfileModal(true);
                    }
                  }}
                  disabled={!hasCompletedWeight}
                  className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-darker transition-colors disabled:opacity-50"
                >
                  Gör nu
                </button>
              )}
            </div>
          </div>
        </div>

        {showWeightModal && createPortal(
          <div className="fixed inset-0 bg-neutral-dark/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => setShowWeightModal(false)}>
            <LogWeightModal 
              show={showWeightModal} 
              onClose={() => setShowWeightModal(false)} 
              onSave={handleWeightSaved} 
              measurementMethod="unknown" 
              hideComment={true}
            />
          </div>,
          document.body
        )}

        {showProfileModal && tempProfile && createPortal(
          <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => setShowProfileModal(false)}>
            <div onClick={e => e.stopPropagation()} className="animate-scale-in w-full max-w-2xl">
              <UserProfileModal
                initialProfile={tempProfile}
                onSave={handleProfileSaved}
                onClose={() => setShowProfileModal(false)}
                isOnboarding={true}
                onboardingStep="form"
                isBootcampOnboarding={true}
                aiFeedbackLoading={false}
                onSubscribeToPush={async () => false}
              />
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

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
                {(participant.cohortId === 'solo' || participant.cohortId === 'solo_group') ? 'SOLO-UPPDRAG' : 'TRUPP-UPPDRAG'} • {participant.status === 'fas1' ? 'FAS 1: GRUNDFAS' : 'FAS 2: ELIT'}
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
            <div className="flex gap-2 sm:gap-4 justify-center w-full max-w-md mx-auto">
              <div className="bg-black/40 px-2 py-2.5 rounded-2xl border border-white/10 flex flex-col items-center flex-1">
                <div className="h-3.5 mb-0.5"></div>
                <div className="h-8 flex items-center gap-1 text-primary mb-1 whitespace-nowrap">
                  <FireIcon className="w-6 h-6 shrink-0" />
                  <span className="font-bold text-2xl leading-none">{participant.currentStreak}</span>
                </div>
                <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold text-center mt-auto">Nuvarande</span>
              </div>
              
              <div className="bg-black/40 px-2 py-2.5 rounded-2xl border border-white/10 flex flex-col items-center flex-1">
                <div className="h-3.5 mb-0.5 flex items-end justify-center">
                  <span className="font-bold text-xs text-primary whitespace-nowrap leading-none">
                    {participant.status === 'fas1' ? 'Fas 1' : 'Fas 2'}
                  </span>
                </div>
                <div className="h-8 flex items-center gap-1.5 text-primary mb-1 whitespace-nowrap shrink-0">
                  <RankBadge 
                    rank={getBootcampRankInfo(Math.max(participant.longestStreak || 0, userProfile.highestBootcampStreak || 0), participant.currentStreak || 0, participant.status).currentRank} 
                    size="sm" 
                    className="w-6 h-6 shrink-0" 
                  />
                  <span className="font-bold text-xl leading-none whitespace-nowrap shrink-0 text-primary">
                    {getBootcampRankInfo(Math.max(participant.longestStreak || 0, userProfile.highestBootcampStreak || 0), participant.currentStreak || 0, participant.status).currentRank}
                  </span>
                </div>
                <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold text-center mt-auto">Rang</span>
              </div>

              <div className="bg-black/40 px-2 py-2.5 rounded-2xl border border-white/10 flex flex-col items-center flex-1">
                <div className="h-3.5 mb-0.5"></div>
                <div className="h-8 flex items-center gap-1 text-neutral-300 mb-1 whitespace-nowrap">
                  <CalendarIcon className="w-6 h-6 shrink-0" />
                  <span className="font-bold text-2xl leading-none">
                    {getBootcampRankInfo(Math.max(participant.longestStreak || 0, userProfile.highestBootcampStreak || 0), participant.currentStreak || 0, participant.status).nextRank ? getBootcampRankInfo(Math.max(participant.longestStreak || 0, userProfile.highestBootcampStreak || 0), participant.currentStreak || 0, participant.status).daysToNext : 0}
                  </span>
                </div>
                <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold text-center mt-auto">Dagar Kvar</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generalens Order & Grad (Börjes order for current rank) */}
      {(() => {
        const currentRankInfo = getBootcampRankInfo(
          Math.max(participant.longestStreak || 0, userProfile.highestBootcampStreak || 0),
          participant.currentStreak || 0,
          participant.status
        );

        const toggleSpeechQuote = () => {
          if (!('speechSynthesis' in window)) return;
          if (isSpeakingQuote) {
            window.speechSynthesis.cancel();
            setIsSpeakingQuote(false);
          } else {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(`General Börjes order för ${currentRankInfo.currentRank}. ${currentRankInfo.rankDef.quote}`);
            utterance.lang = 'sv-SE';
            utterance.rate = 0.95;
            utterance.onend = () => setIsSpeakingQuote(false);
            utterance.onerror = () => setIsSpeakingQuote(false);
            setIsSpeakingQuote(true);
            window.speechSynthesis.speak(utterance);
          }
        };

        return (
          <div className="bg-[#3D3935] text-[#FAF6EF] rounded-3xl shadow-soft-xl mb-6 p-6 border border-[#D96E4A]/30 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#D96E4A]/30">
              <div className="flex items-center gap-3">
                <RankBadge rank={currentRankInfo.currentRank} size="md" className="w-12 h-12 sm:w-14 sm:h-14 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D96E4A] animate-pulse"></span>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#D96E4A]">
                      GENERALENS ORDER • {currentRankInfo.currentRank.toUpperCase()}
                    </p>
                  </div>
                  <p className="text-xs text-[#FAF6EF]/70 font-medium">
                    {currentRankInfo.rankDef.achievementText}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSpeechQuote}
                  className={`p-2 rounded-xl transition-all text-xs font-semibold flex items-center gap-1.5 ${
                    isSpeakingQuote 
                      ? 'bg-[#D96E4A] text-white animate-pulse' 
                      : 'bg-white/10 hover:bg-white/20 text-[#FAF6EF]'
                  }`}
                  title="Läs upp Börjes order"
                >
                  {isSpeakingQuote ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>{isSpeakingQuote ? 'Tysta' : 'Läs upp'}</span>
                </button>

                <button
                  onClick={() => setShowDiplomaGallery(true)}
                  className="px-3 py-1.5 bg-[#D96E4A] hover:bg-[#C05A38] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <Award className="w-4 h-4" />
                  <span>Mina Diplom</span>
                </button>
              </div>
            </div>

            <div className="bg-[#2B2825] rounded-2xl p-4 sm:p-5 border border-[#D96E4A]/20">
              <p className="text-base sm:text-lg italic font-normal leading-relaxed text-[#FAF6EF]/90">
                "{currentRankInfo.rankDef.quote}"
              </p>
              <div className="mt-3 text-right">
                <span className="text-xs font-bold tracking-wider text-[#D96E4A] font-serif">
                  — General Börje, Högkvarteret
                </span>
              </div>
            </div>
          </div>
        );
      })()}

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
            <div className={`mb-6 p-5 rounded-2xl border-2 shadow-sm flex items-center justify-between ${hasLoggedThisWeek ? 'bg-[#E8EFE9] border-[#8C9A86]/40' : (isDelayed ? 'bg-red-50 border-red-200' : 'bg-[#F6E2D9] border-[#D96E4A]/30')}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${hasLoggedThisWeek ? 'bg-[#8C9A86] text-white' : (isDelayed ? 'bg-red-100 text-red-600' : 'bg-[#F6E2D9] text-[#D96E4A]')}`}>
                  {hasLoggedThisWeek ? <CheckCircleIcon className="w-8 h-8" /> : '⚖️'}
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${hasLoggedThisWeek ? 'text-[#2B3B2C]' : (isDelayed ? 'text-red-800' : 'text-[#56524D]')}`}>
                    Veckans Uppdrag: Invägning
                  </h3>
                  <p className={`text-sm ${hasLoggedThisWeek ? 'text-[#3E523F]' : (isDelayed ? 'text-red-700 font-medium' : 'text-[#7A756E]')}`}>
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
                  className={`px-4 py-2 rounded-lg font-bold text-white shadow-sm transition-transform active:scale-95 ${isDelayed ? 'bg-red-600 hover:bg-red-700' : 'bg-[#D96E4A] hover:bg-[#C05A38]'}`}
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
                <CheckCircleIcon className="w-6 h-6 text-[#D96E4A]" />
                {editingYesterday ? 'Gårdagens Kvällsrapport' : 'Dagens Kvällsrapport'}
              </h2>
              {!editingYesterday && canEditYesterday && (
                <button 
                  onClick={() => setEditingYesterday(true)}
                  className="text-sm font-bold text-[#D96E4A] hover:text-[#C05A38] underline"
                >
                  Rätta gårdagen
                </button>
              )}
            </div>

            {(!editingYesterday && hasReportedToday) ? (
              <div className="p-6 bg-[#E8EFE9] dark:bg-[#34302C] rounded-2xl border border-[#8C9A86]/40 text-center">
                <CheckCircleIcon className="w-12 h-12 text-[#8C9A86] mx-auto mb-3" />
                <h3 className="text-lg font-bold text-[#2B3B2C] dark:text-[#FAF6EF] mb-2">Rapport inlämnad!</h3>
                <p className="text-[#3E523F] dark:text-[#C2BCB4]">
                  Du har lämnat din rapport för idag. Generalen har mottagit den. Vila upp dig inför morgondagen.
                </p>
                {canEditYesterday && (
                  <button 
                    onClick={() => setEditingYesterday(true)}
                    className="mt-4 px-4 py-2 bg-[#F6E2D9] text-[#D96E4A] rounded-full font-bold text-sm hover:bg-[#F1EAE0] transition-colors"
                  >
                    Rätta gårdagens rapport
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-6">
                {editingYesterday && (
                  <div className="p-4 bg-[#F6E2D9] text-[#D96E4A] rounded-2xl mb-4 flex justify-between items-center">
                    <span>Du redigerar gårdagens rapport ({yesterdayStr}).</span>
                    <button type="button" onClick={() => setEditingYesterday(false)} className="text-sm font-bold underline">Avbryt</button>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="p-4 bg-[#F1EAE0] text-[#56524D] rounded-2xl text-sm mb-4">
                    <p>
                      <strong>OBS:</strong> Mat, protein och vatten hämtas automatiskt från din loggbok. 
                      Om du saknar något, gå tillbaka till Hem-fliken och logga det innan du skickar in rapporten.
                    </p>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${loggedAllMeals ? 'bg-[#84A98C]/10 border-[#84A98C]/30' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${loggedAllMeals ? 'bg-[#84A98C] text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className={`font-bold block ${loggedAllMeals ? 'text-neutral-dark dark:text-white' : 'text-neutral-dark dark:text-white'}`}>Kalorimålet</span>
                      <span className={`text-sm ${loggedAllMeals ? 'text-[#84A98C] dark:text-[#84A98C]' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {userProfile.goalType === 'gain_muscle' 
                          ? (loggedAllMeals ? 'Du har nått ditt minimiintag för muskelbyggnad.' : 'Du måste nå ditt minimiintag (TDEE) för att bygga muskler.')
                          : (loggedAllMeals ? 'Du ligger inom din kaloribudget (eller täcks av sparpotten).' : 'Du måste ligga inom din kaloribudget (max 20% under, ej över utan sparpott).')
                        }
                      </span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${proteinMet ? 'bg-[#84A98C]/10 border-[#84A98C]/30' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${proteinMet ? 'bg-[#84A98C] text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className={`font-bold flex items-center ${proteinMet ? 'text-neutral-dark dark:text-white' : 'text-neutral-dark dark:text-white'}`}>
                        Proteinkravet
                        <button 
                            type="button" 
                            onClick={() => setShowProteinInfoModal(true)}
                            className={`ml-1.5 transition-colors ${proteinMet ? 'text-[#84A98C] hover:text-primary' : 'text-neutral-400 hover:text-primary'}`}
                            aria-label="Information om proteinmål"
                        >
                            <InformationCircleIcon className="w-4 h-4" />
                        </button>
                      </span>
                      <span className={`text-sm ${proteinMet ? 'text-[#84A98C] dark:text-[#84A98C]' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {proteinMet ? `Du har nått ditt mål (${goals.proteinGoal}g).` : `Du har inte nått ditt proteinmål (${goals.proteinGoal}g).`}
                      </span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${waterMet ? 'bg-[#84A98C]/10 border-[#84A98C]/30' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${waterMet ? 'bg-[#84A98C] text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className={`font-bold block ${waterMet ? 'text-neutral-dark dark:text-white' : 'text-neutral-dark dark:text-white'}`}>Vätskekontroll</span>
                      <span className={`text-sm ${waterMet ? 'text-[#84A98C] dark:text-[#84A98C]' : 'text-neutral-500 dark:text-neutral-400'}`}>
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
                      <span className="font-bold text-neutral-dark dark:text-white block">Styrketräning (valfritt)</span>
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

                <div className="bg-[#F6E2D9] p-4 rounded-2xl border border-primary/20">
                  <p className="text-sm text-neutral-dark font-medium">
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
                      <div className={`w-3 h-3 rounded-full ${report.isGreenDay ? 'bg-[#84A98C]' : 'bg-red-500'}`}></div>
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

      {showDiplomaGallery && (
        <BootcampDiplomaGalleryModal
          longestStreak={Math.max(participant.longestStreak || 0, userProfile.highestBootcampStreak || 0)}
          userName={userProfile.name || 'Soldat'}
          status={participant.status}
          onClose={() => setShowDiplomaGallery(false)}
        />
      )}
    </div>
  );
};

export default BootcampDashboard;
