import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, CheckCircle2, ChevronRight, Download, Sparkles, Volume2, VolumeX, Shield, BookOpen, Flame, Calendar, Utensils, Scale } from 'lucide-react';
import { UserProfileData, PastDaysSummaryCollection, WeightLogEntry, CoachStyle } from '../types';
import { COACH_PERSONAS } from '../constants';
import { getBootcampRankInfo, BORJE_EXTRA_TEXTS } from '../utils/bootcampUtils';
import { BootcampDiplomaCard } from './BootcampDiplomaCard';
import { downloadDiplomaImage } from '../utils/diplomaImageExporter';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

interface BootcampGraduationModalProps {
  show: boolean;
  onClose: () => void;
  userProfile: UserProfileData;
  pastDaysSummary: PastDaysSummaryCollection;
  weightLogs: WeightLogEntry[];
  totalMealsCount: number;
  streakDays: number;
  isCompleted: boolean;
  onAcceptSubscription: (chosenCoach: CoachStyle) => Promise<void>;
  onDecline: (chosenCoach: CoachStyle) => Promise<void>;
}

export const BootcampGraduationModal: React.FC<BootcampGraduationModalProps> = ({
  show,
  onClose,
  userProfile,
  pastDaysSummary,
  weightLogs,
  totalMealsCount,
  streakDays,
  isCompleted,
  onAcceptSubscription,
  onDecline,
}) => {
  const { width, height } = useWindowSize();
  const [step, setStep] = useState<'diploma' | 'offer'>(isCompleted ? 'diploma' : 'offer');
  const [selectedCoach, setSelectedCoach] = useState<CoachStyle>(userProfile.coachStyle || 'balanced');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const highestStreak = Math.max(
    streakDays || 0,
    userProfile.highestBootcampStreak || 0
  );

  const rankInfo = useMemo(() => {
    return getBootcampRankInfo(highestStreak, streakDays, isCompleted ? 'completed' : 'active');
  }, [highestStreak, streakDays, isCompleted]);

  const finaleRankDef = useMemo(() => {
    return {
      ...rankInfo.rankDef,
      quote: BORJE_EXTRA_TEXTS.FINALE
    };
  }, [rankInfo]);

  // Beräkna användarens faktiska data och resultat
  const stats = useMemo(() => {
    const loggedDaysCount = Object.keys(pastDaysSummary || {}).length;
    const measurementMethod = userProfile.measurementMethod || 'scale';

    // Beräkna viktförändring för vanlig våg
    let weightChange: number | null = null;
    let startWeight: number | null = userProfile.goalStartWeight || null;
    let latestWeight: number | null = userProfile.currentWeightKg || null;

    if (weightLogs && weightLogs.length > 0) {
      const sortedLogs = [...weightLogs].sort((a, b) => a.loggedAt - b.loggedAt);
      if (!startWeight) startWeight = sortedLogs[0].weightKg;
      latestWeight = sortedLogs[sortedLogs.length - 1].weightKg;
    }

    if (startWeight !== null && latestWeight !== null) {
      weightChange = latestWeight - startWeight;
    }

    // Beräkna fett- och muskelförändring för InBody
    let fatChange: number | null = null;
    let muscleChange: number | null = null;
    let startFat: number | null = userProfile.goalStartFatMassKg || null;
    let latestFat: number | null = userProfile.bodyFatMassKg || null;
    let startMuscle: number | null = userProfile.goalStartMuscleMassKg || null;
    let latestMuscle: number | null = userProfile.skeletalMuscleMassKg || null;

    if (weightLogs && weightLogs.length > 0) {
      const inbodyLogs = weightLogs.filter(l => typeof l.bodyFatMassKg === 'number' || typeof l.skeletalMuscleMassKg === 'number');
      if (inbodyLogs.length > 0) {
        const sortedInbody = [...inbodyLogs].sort((a, b) => a.loggedAt - b.loggedAt);
        if (startFat === null && sortedInbody[0].bodyFatMassKg !== undefined) {
          startFat = sortedInbody[0].bodyFatMassKg;
        }
        if (startMuscle === null && sortedInbody[0].skeletalMuscleMassKg !== undefined) {
          startMuscle = sortedInbody[0].skeletalMuscleMassKg;
        }
        const lastWithFat = [...sortedInbody].reverse().find(l => typeof l.bodyFatMassKg === 'number');
        if (lastWithFat && lastWithFat.bodyFatMassKg !== undefined) {
          latestFat = lastWithFat.bodyFatMassKg;
        }
        const lastWithMuscle = [...sortedInbody].reverse().find(l => typeof l.skeletalMuscleMassKg === 'number');
        if (lastWithMuscle && lastWithMuscle.skeletalMuscleMassKg !== undefined) {
          latestMuscle = lastWithMuscle.skeletalMuscleMassKg;
        }
      }
    }

    if (startFat !== null && latestFat !== null) {
      fatChange = latestFat - startFat;
    }
    if (startMuscle !== null && latestMuscle !== null) {
      muscleChange = latestMuscle - startMuscle;
    }

    return {
      loggedDaysCount,
      totalMeals: totalMealsCount,
      highestStreak,
      measurementMethod,
      weightChange,
      startWeight,
      latestWeight,
      fatChange,
      muscleChange,
      startFat,
      latestFat,
      startMuscle,
      latestMuscle,
    };
  }, [pastDaysSummary, userProfile, weightLogs, totalMealsCount, highestStreak]);

  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) {
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`General Börjes slutord till truppen. ${BORJE_EXTRA_TEXTS.FINALE}`);
      utterance.lang = 'sv-SE';
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleDownloadDiploma = async () => {
    try {
      setIsDownloading(true);
      await downloadDiplomaImage(
        finaleRankDef,
        userProfile.name || 'Soldat',
        highestStreak
      );
    } catch (e) {
      console.error('Kunde inte ladda ner diplomet:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStartSubscription = async () => {
    setIsProcessing(true);
    try {
      await onAcceptSubscription(selectedCoach);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeclineSubscription = async () => {
    setIsProcessing(true);
    try {
      await onDecline(selectedCoach);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto custom-scrollbar">
        {isCompleted && step === 'diploma' && (
          <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-2xl my-auto relative flex flex-col gap-4 text-[#2B2825]"
        >
          {/* STEG 1: GENERALSDIPLOM (Endast för fullföljd Bootcamp) */}
          {isCompleted && step === 'diploma' ? (
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center justify-between text-white px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-[#D96E4A]/20 border border-[#D96E4A] flex items-center justify-center text-[#D96E4A]">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#D96E4A] block">
                      EXAMEN I GENERALENS BOOTCAMP
                    </span>
                    <h3 className="text-xl font-extrabold font-serif leading-tight">
                      Generalsdiplomet
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSpeech}
                    className={`p-2.5 rounded-full transition-all flex items-center justify-center ${
                      isSpeaking ? 'bg-[#D96E4A] text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={isSpeaking ? 'Tysta uppläsning' : 'Lyssna på General Börjes slutord'}
                  >
                    {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Diplom-kort */}
              <div className="shadow-2xl rounded-2xl overflow-hidden">
                <BootcampDiplomaCard
                  rankDef={finaleRankDef}
                  userName={userProfile.name || 'Soldat'}
                  streakDays={highestStreak}
                />
              </div>

              {/* Slutord och navigering till erbjudande */}
              <div className="bg-[#FAF6EF] p-5 sm:p-6 rounded-2xl border border-neutral-light flex flex-col gap-4 shadow-xl">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#D96E4A] bg-[#F1EAE0]">
                    {COACH_PERSONAS.hard.imageUrl ? (
                      <img src={COACH_PERSONAS.hard.imageUrl} alt="General Börje" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl flex items-center justify-center h-full">🪖</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#2B2825]">General Börjes överlämning:</h4>
                    <p className="text-xs sm:text-sm text-[#56524D] mt-1 leading-relaxed italic">
                      "Soldat! Du har genomfört tolv veckors stenhård disciplin. Från och med nu tar du inga order av mig — du är din egen general. Det har varit en ära att drilla dig."
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-light">
                  <button
                    type="button"
                    onClick={handleDownloadDiploma}
                    disabled={isDownloading}
                    className="w-full sm:w-auto px-4 py-2.5 bg-white border border-[#E5DFD5] hover:bg-[#F6F2EA] text-[#56524D] rounded-xl font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 text-[#D96E4A]" />
                    <span>{isDownloading ? 'Sparar diplom...' : 'Spara diplom som bild'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('offer')}
                    className="w-full sm:w-auto px-6 py-3 bg-[#D96E4A] hover:bg-[#C05A38] text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#D96E4A]/30 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <span>Gå vidare till ditt nästa kapitel</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STEG 2: ERBJUDANDET (Talar med användarens faktiska data) */
            <div className="bg-[#FAF6EF] rounded-3xl border border-neutral-light p-6 sm:p-8 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F6E2D9] text-[#D96E4A] text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  {isCompleted ? 'Ditt nästa kapitel' : 'Dörren står öppen'}
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold font-serif text-[#2B2825]">
                  {isCompleted 
                    ? 'Fortsätt med eget befäl' 
                    : 'Fortsätt i din egen takt'}
                </h2>
                <p className="text-sm text-[#7A756E] mt-2 max-w-lg mx-auto leading-relaxed">
                  {isCompleted
                    ? 'Tolv veckor av stenhård disciplin har gett dig en stark grund och vanor som håller. Här är vad du har åstadkommit under din tid i truppen:'
                    : 'Din 12-veckorsperiod har nått sitt slut, men varje loggad dag och varje måltid du registrerat är en investering i din hälsa. Här är din samlade data:'}
                </p>
              </div>

              {/* DATA-PANEL: Faktiska siffror från användarens historik */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-neutral-light shadow-sm">
                <div className="flex flex-col items-center text-center p-2 rounded-xl bg-[#FAF6EF]/60">
                  <Calendar className="w-5 h-5 text-[#D96E4A] mb-1" />
                  <span className="text-2xl font-black text-[#2B2825]">{stats.loggedDaysCount}</span>
                  <span className="text-[11px] font-medium text-[#7A756E]">Loggade dagar</span>
                </div>

                <div className="flex flex-col items-center text-center p-2 rounded-xl bg-[#FAF6EF]/60">
                  <Utensils className="w-5 h-5 text-[#D96E4A] mb-1" />
                  <span className="text-2xl font-black text-[#2B2825]">{stats.totalMeals}</span>
                  <span className="text-[11px] font-medium text-[#7A756E]">Loggade måltider</span>
                </div>

                <div className="flex flex-col items-center text-center p-2 rounded-xl bg-[#FAF6EF]/60">
                  <Flame className="w-5 h-5 text-[#D96E4A] mb-1" />
                  <span className="text-2xl font-black text-[#2B2825]">{stats.highestStreak}</span>
                  <span className="text-[11px] font-medium text-[#7A756E]">Högsta streak</span>
                </div>

                <div className="flex flex-col items-center text-center p-2 rounded-xl bg-[#FAF6EF]/60">
                  <Scale className="w-5 h-5 text-[#D96E4A] mb-1" />
                  {stats.measurementMethod === 'inbody' && stats.fatChange !== null ? (
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black text-[#2B2825]">
                        {stats.fatChange <= 0 ? '' : '+'}{stats.fatChange.toFixed(1)} kg
                      </span>
                      <span className="text-[11px] font-medium text-[#7A756E]">Fettmassa</span>
                    </div>
                  ) : stats.weightChange !== null ? (
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black text-[#2B2825]">
                        {stats.weightChange <= 0 ? '' : '+'}{stats.weightChange.toFixed(1)} kg
                      </span>
                      <span className="text-[11px] font-medium text-[#7A756E]">Viktförändring</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black text-[#2B2825]">Klar</span>
                      <span className="text-[11px] font-medium text-[#7A756E]">Utgångsstatus</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Extra InBody-detaljer om tillgängligt */}
              {stats.measurementMethod === 'inbody' && stats.muscleChange !== null && (
                <div className="flex items-center justify-center gap-4 text-xs font-medium text-[#56524D] bg-[#F6E2D9]/40 p-2.5 rounded-xl border border-[#D96E4A]/20 -mt-2">
                  <span>Muskelmassa: <strong>{stats.muscleChange >= 0 ? '+' : ''}{stats.muscleChange.toFixed(1)} kg</strong></span>
                  <span>•</span>
                  <span>Fettmassa: <strong>{stats.fatChange !== null && stats.fatChange <= 0 ? '' : '+'}{stats.fatChange?.toFixed(1) || '0.0'} kg</strong></span>
                </div>
              )}

              {/* FÖRMÅNER: Vad abonnemanget innehåller */}
              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-[#7A756E]">
                  Detta ingår i ditt fortsatta abonnemang
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-white rounded-2xl border border-neutral-light flex flex-col gap-1.5 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-[#F6E2D9] text-[#D96E4A] flex items-center justify-center">
                      <Utensils className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-[#2B2825]">Fortsatt AI-loggning</span>
                    <span className="text-xs text-[#7A756E] leading-relaxed">
                      Smidig matfotologgning, streckkodsläsare och personlig kostanalys varje dag.
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-2xl border border-neutral-light flex flex-col gap-1.5 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-[#E8EFE9] text-[#2B3B2C] flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-[#2B2825]">Valfri AI-coach</span>
                    <span className="text-xs text-[#7A756E] leading-relaxed">
                      Välj den coach som passar din vardag: Maja, Erik eller Börje. Byt när du vill.
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-2xl border border-neutral-light flex flex-col gap-1.5 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-[#FAF0E6] text-[#A66038] flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-[#2B2825]">Två fördjupningskurser</span>
                    <span className="text-xs text-[#7A756E] leading-relaxed">
                      Full tillgång till Praktisk Viktkontroll och Maxa Klimakteriet utan extra kostnad.
                    </span>
                  </div>
                </div>
              </div>

              {/* COACH-VALET SOM EN DEL AV ERBJUDANDET */}
              <div className="flex flex-col gap-3 pt-2 border-t border-neutral-light">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[#7A756E]">
                    Vem vill du ha vid din sida framåt?
                  </h4>
                  <span className="text-xs text-[#D96E4A] font-semibold">Valfri coach ingår</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(Object.keys(COACH_PERSONAS) as CoachStyle[]).map(style => {
                    const p = COACH_PERSONAS[style];
                    const isSelected = selectedCoach === style;

                    return (
                      <button
                        type="button"
                        key={style}
                        onClick={() => setSelectedCoach(style)}
                        className={`text-left p-3.5 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#F6E2D9] text-[#56524D] border-[#D96E4A] shadow-md scale-[1.02]'
                            : 'bg-white border-neutral-light hover:border-[#D96E4A]/50 text-[#56524D]'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-2 shadow-sm transition-transform bg-[#F1EAE0] border border-[#FAF6EF] overflow-hidden ${isSelected ? 'ring-2 ring-[#D96E4A]' : ''}`}>
                          {p.imageUrl ? <img src={p.imageUrl} alt={p.label} className="w-full h-full object-cover" /> : p.emoji}
                        </div>
                        <span className="font-bold text-sm text-[#56524D]">{p.label}</span>
                        <span className="text-[11px] font-medium text-[#D96E4A]">{p.roleTitle}</span>
                        <span className="text-[11px] text-[#7A756E] mt-1 line-clamp-2">{p.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PRIS OCH AKTIONER */}
              <div className="flex flex-col gap-3 pt-4 border-t border-neutral-light">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-[#2B2825]">149 kr</span>
                      <span className="text-sm font-medium text-[#7A756E]">/ månad</span>
                    </div>
                    <p className="text-xs text-[#7A756E] mt-0.5">
                      Ingen bindningstid. Avsluta enkelt när du vill med ett klick.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleStartSubscription}
                    className="w-full sm:w-auto px-8 py-3.5 bg-[#D96E4A] hover:bg-[#C05A38] text-white rounded-2xl font-bold text-base transition-all shadow-lg shadow-[#D96E4A]/30 flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isProcessing ? 'Startar...' : 'Fortsätt med abonnemang'}</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleDeclineSubscription}
                    className="text-xs sm:text-sm text-[#7A756E] hover:text-[#2B2825] font-medium transition-colors underline underline-offset-4 cursor-pointer"
                  >
                    Nej tack, behåll mina resultat i läsläge
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BootcampGraduationModal;
