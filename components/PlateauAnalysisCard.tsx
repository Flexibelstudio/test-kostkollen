import React, { useState } from 'react';
import { PlateauAnalysisResult, UserProfileData, GoalSettings, CoachStyle } from '../types';
import { COACH_PERSONAS } from '../constants';
import { 
  Scale, 
  Dumbbell, 
  Footprints, 
  Apple, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Sparkles, 
  ShieldAlert, 
  HeartHandshake,
  TrendingDown,
  Info
} from 'lucide-react';

interface PlateauAnalysisCardProps {
  result: PlateauAnalysisResult;
  userProfile: UserProfileData;
  goals: GoalSettings;
  onStartMeasuringWeek?: () => Promise<void> | void;
  onAcceptAdjustment?: (proposedCalorieGoal: number, reductionAmount: number) => Promise<void> | void;
  onDiscussWithCoach?: () => void;
  isCompact?: boolean;
}

export const PlateauAnalysisCard: React.FC<PlateauAnalysisCardProps> = ({
  result,
  userProfile,
  goals,
  onStartMeasuringWeek,
  onAcceptAdjustment,
  onDiscussWithCoach,
  isCompact = false
}) => {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const coachStyle: CoachStyle = userProfile.coachStyle || 'balanced';
  const persona = COACH_PERSONAS[coachStyle] || COACH_PERSONAS['balanced'];

  const handleStartMeasuringWeekClick = async () => {
    if (!onStartMeasuringWeek || isActionLoading) return;
    try {
      setIsActionLoading(true);
      await onStartMeasuringWeek();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAcceptAdjustmentClick = async () => {
    if (!onAcceptAdjustment || !result.adjustment || isActionLoading) return;
    try {
      setIsActionLoading(true);
      await onAcceptAdjustment(result.adjustment.proposedCalorieGoal, result.adjustment.reductionAmountKcal);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = () => {
    switch (result.status) {
      case 'recomposition_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Kroppsrekomposition
          </span>
        );
      case 'fat_loss_steady':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            <TrendingDown className="w-3.5 h-3.5" />
            Stabil fettminskning
          </span>
        );
      case 'low_logging_rate':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
            <AlertCircle className="w-3.5 h-3.5" />
            Underlag saknas ({result.loggingPercentage}%)
          </span>
        );
      case 'measuring_week_recommended':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F6E2D9] text-[#D96E4A]">
            <Calendar className="w-3.5 h-3.5" />
            Mätvecka föreslås
          </span>
        );
      case 'measuring_week_in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
            <Calendar className="w-3.5 h-3.5" />
            Mätvecka pågår
          </span>
        );
      case 'adjustment_recommended':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            <Sparkles className="w-3.5 h-3.5" />
            Justeringsförslag (-{result.adjustment?.reductionAmountKcal} kcal)
          </span>
        );
      case 'intake_too_low':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
            <ShieldAlert className="w-3.5 h-3.5" />
            Basal energigräns nådd
          </span>
        );
      case 'human_handover':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
            <HeartHandshake className="w-3.5 h-3.5" />
            Mänsklig coachkontakt
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-light shadow-sm p-5 sm:p-6 text-left my-4 animate-scale-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-light/60 flex items-center justify-center flex-shrink-0 text-neutral-dark font-bold">
            {persona.imageUrl ? (
              <img src={persona.imageUrl} alt={persona.label} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Scale className="w-5 h-5 text-neutral-dark" />
            )}
          </div>
          <div>
            <h4 className="text-base font-bold text-neutral-dark leading-tight">
              Platåanalys: {persona.label}
            </h4>
            <p className="text-xs text-neutral-500 font-medium">
              21 dagars 7-dagars glidande medelvärde ({result.measurementMethod === 'inbody' ? 'InBody' : 'Våg'})
            </p>
          </div>
        </div>
        <div>
          {renderStatusBadge()}
        </div>
      </div>

      {/* Coach text */}
      <div className="bg-neutral-light/30 rounded-xl p-4 mb-4 border border-neutral-light/50">
        <p className="text-base text-neutral-dark leading-relaxed whitespace-pre-line">
          {result.coachBriefingText}
        </p>
      </div>

      {/* Siffror & Dataöversikt */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4 text-center">
        <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-0.5">7-d Snittvikt</p>
          <p className="text-sm sm:text-base font-extrabold text-neutral-dark">
            {result.endRollingAvgWeight !== undefined ? `${result.endRollingAvgWeight} kg` : '-'}
            {result.weightDeltaKg !== undefined && (
              <span className={`text-xs ml-1 font-semibold ${result.weightDeltaKg <= 0 ? 'text-green-600' : 'text-neutral-500'}`}>
                ({result.weightDeltaKg > 0 ? `+${result.weightDeltaKg}` : `${result.weightDeltaKg}`} kg)
              </span>
            )}
          </p>
        </div>

        {result.measurementMethod === 'inbody' && result.fatDeltaKg !== undefined && (
          <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-0.5">7-d Fettmassa</p>
            <p className="text-sm sm:text-base font-extrabold text-neutral-dark">
              {result.endRollingAvgFatKg !== undefined ? `${result.endRollingAvgFatKg} kg` : '-'}
              <span className={`text-xs ml-1 font-semibold ${result.fatDeltaKg <= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                ({result.fatDeltaKg > 0 ? `+${result.fatDeltaKg}` : `${result.fatDeltaKg}`} kg)
              </span>
            </p>
          </div>
        )}

        {result.measurementMethod === 'inbody' && result.muscleDeltaKg !== undefined && (
          <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-0.5">7-d Muskelmassa</p>
            <p className="text-sm sm:text-base font-extrabold text-neutral-dark">
              {result.endRollingAvgMuscleKg !== undefined ? `${result.endRollingAvgMuscleKg} kg` : '-'}
              <span className={`text-xs ml-1 font-semibold ${result.muscleDeltaKg >= 0 ? 'text-green-600' : 'text-neutral-500'}`}>
                ({result.muscleDeltaKg > 0 ? `+${result.muscleDeltaKg}` : `${result.muscleDeltaKg}`} kg)
              </span>
            </p>
          </div>
        )}

        <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-0.5">Loggningsgrad</p>
          <p className="text-sm sm:text-base font-extrabold text-neutral-dark">
            {result.loggingPercentage}% <span className="text-xs font-normal text-neutral-500">av dagarna</span>
          </p>
        </div>
      </div>

      {/* Mätvecka Action */}
      {result.status === 'measuring_week_recommended' && onStartMeasuringWeek && (
        <div className="mb-4 bg-[#FAF5F0] border border-[#EADBCC] rounded-xl p-4">
          <div className="flex items-start gap-3 mb-3">
            <Calendar className="w-5 h-5 text-[#D96E4A] flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="text-sm font-bold text-neutral-dark">Starta 7 dagars Mätvecka</h5>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Logga alla måltider, drycker och mellanmål noggrant under 7 dagar. Därefter utvärderar vi tillsammans om planen behöver justeras.
              </p>
            </div>
          </div>
          <button
            onClick={handleStartMeasuringWeekClick}
            disabled={isActionLoading}
            className="w-full py-2.5 px-4 bg-[#D96E4A] hover:bg-[#C25B39] text-white text-sm font-bold rounded-lg shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isActionLoading ? 'Startar...' : 'Starta Mätvecka nu'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Justeringsförslag Action */}
      {result.status === 'adjustment_recommended' && result.adjustment && onAcceptAdjustment && (
        <div className="mb-4 bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h5 className="text-sm font-bold text-emerald-950">Föreslagen justering</h5>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Från {result.adjustment.currentCalorieGoal} kcal till <strong>{result.adjustment.proposedCalorieGoal} kcal/dag</strong> (-{result.adjustment.reductionAmountKcal} kcal).
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                Tryggt över ditt beräknade BMR på {result.adjustment.bmr} kcal ({result.adjustment.reductionsRemaining} säkra justeringar kvar).
              </p>
            </div>
          </div>
          <button
            onClick={handleAcceptAdjustmentClick}
            disabled={isActionLoading}
            className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-lg shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isActionLoading ? 'Uppdaterar...' : `Acceptera förslag (${result.adjustment.proposedCalorieGoal} kcal)`}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alternativa åtgärder Accordion */}
      {result.alternatives && result.alternatives.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="w-full flex items-center justify-between text-xs font-bold text-neutral-600 hover:text-neutral-dark py-2 px-1 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
              Alternativa åtgärder innan kalorisänkning ({result.alternatives.length})
            </span>
            {showAlternatives ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAlternatives && (
            <div className="space-y-2 pt-2 animate-fade-in">
              {result.alternatives.map((alt) => (
                <div key={alt.id} className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    {alt.id === 'steps' && <Footprints className="w-4 h-4 text-[#D96E4A]" />}
                    {alt.id === 'protein' && <Apple className="w-4 h-4 text-emerald-600" />}
                    {alt.id === 'strength' && <Dumbbell className="w-4 h-4 text-indigo-600" />}
                    {alt.id === 'diet_break' && <Calendar className="w-4 h-4 text-purple-600" />}
                    <h6 className="text-xs font-bold text-neutral-dark">{alt.title}</h6>
                  </div>
                  <p className="text-xs text-neutral-700 font-medium mb-1">{alt.description}</p>
                  <p className="text-xs text-neutral-500 leading-normal">{alt.rationale}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prata med coach knapp om önskas */}
      {onDiscussWithCoach && (
        <div className="pt-2 border-t border-neutral-light/50 flex justify-end">
          <button
            onClick={onDiscussWithCoach}
            className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 py-1"
          >
            <span>Diskutera med {persona.label} i chatten</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Medicinsk ansvarsfriskrivning */}
      <div className="mt-4 pt-3 border-t border-neutral-100 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-neutral-400 leading-normal">
          {result.disclaimer}
        </p>
      </div>
    </div>
  );
};
export default PlateauAnalysisCard;
