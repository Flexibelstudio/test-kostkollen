
import React, { useState, useEffect } from 'react';
import { WeightLogEntry, BootcampParticipant } from '../types';
import { XMarkIcon, CheckIcon } from './icons';
import { COACH_PERSONAS } from '../constants';

interface LogWeightModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (data: Omit<WeightLogEntry, 'id'>) => Promise<void>;
  measurementMethod?: 'scale' | 'inbody' | 'unknown';
  hideComment?: boolean;
  activeBootcamp?: BootcampParticipant | null;
  weightLogs?: WeightLogEntry[];
}

const LogWeightModal: React.FC<LogWeightModalProps> = ({ show, onClose, onSave, measurementMethod = 'scale', hideComment = false, activeBootcamp, weightLogs = [] }) => {
  const [weightKg, setWeightKg] = useState<string>('');
  const [skeletalMuscleMassKg, setSkeletalMuscleMassKg] = useState<string>('');
  const [bodyFatMassKg, setBodyFatMassKg] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Bootcamp restriction logic
  const isBootcampActive = activeBootcamp?.status === 'fas1' || activeBootcamp?.status === 'fas2';
  
  const checkIsWeighInWindow = () => {
    const now = new Date();
    const day = now.getDay(); // 0 is Sunday, 1 is Monday
    const hour = now.getHours();
    
    // Sunday all day (0), or Monday (1) before 12:00
    return day === 0 || (day === 1 && hour < 12);
  };

  const checkHasLoggedThisWeek = () => {
    if (!weightLogs || weightLogs.length === 0) return false;
    
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    const startOfWeighInWeek = new Date(now);
    startOfWeighInWeek.setDate(now.getDate() - dayOfWeek); // Go back to Sunday
    startOfWeighInWeek.setHours(0, 0, 0, 0);

    return weightLogs.some(log => log.loggedAt >= startOfWeighInWeek.getTime());
  };

  const isWeighInWindow = checkIsWeighInWindow();
  const hasLoggedThisWeek = checkHasLoggedThisWeek();
  const showBootcampRestriction = isBootcampActive && !isWeighInWindow;
  const isDelayedLogging = showBootcampRestriction && !hasLoggedThisWeek;
  const isBlockedLogging = showBootcampRestriction && hasLoggedThisWeek;

  const [acceptedPunishment, setAcceptedPunishment] = useState(false);

  useEffect(() => {
    if (show) {
      setWeightKg('');
      setSkeletalMuscleMassKg('');
      setBodyFatMassKg('');
      setComment('');
      setError(null);
      setIsSaving(false);
      setShowConfirm(false);
      setAcceptedPunishment(false);
    }
  }, [show]);

  const handleSave = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    const weightValue = parseFloat(weightKg);
    if (isNaN(weightValue) || weightValue <= 0) {
      setError('Vänligen ange en giltig vikt.');
      return;
    }
    setError(null);

    // Show confirmation dialog first
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsSaving(true);

    const muscleValue = parseFloat(skeletalMuscleMassKg);
    const fatValue = parseFloat(bodyFatMassKg);
    
    try {
        await onSave({
            loggedAt: Date.now(),
            weightKg: weightValue,
            skeletalMuscleMassKg: !isNaN(muscleValue) ? muscleValue : undefined,
            bodyFatMassKg: !isNaN(fatValue) ? fatValue : undefined,
            comment: comment.trim() ? comment.trim() : undefined,
        });
        // Parent component will close the modal. isSaving will reset on next 'show'.
    } catch (err) {
        console.error("Error saving weight log:", err);
        setError("Kunde inte spara mätningen. Försök igen.");
        setIsSaving(false); // Reset on error so user can try again
    }
  };

  if (!show) return null;

  if (showConfirm) {
    return (
      <div className="fixed inset-0 z-50 bg-neutral-dark/40 backdrop-blur-sm flex justify-center items-center p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden flex flex-col p-6 animate-scale-in">
          <h3 className="text-xl font-bold text-neutral-dark mb-4 text-center font-sans tracking-tight">
            Bekräfta dina siffror
          </h3>
          <p className="text-base text-neutral mb-8 text-center px-2 font-sans leading-relaxed">
            Är du säker på att du fyllt i rätt? Din mätning kommer <strong className="font-semibold text-neutral-dark">inte</strong> att kunna ändras i efterhand.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 px-4 rounded-xl font-bold font-sans transition-all interactive-transition bg-neutral-light border border-neutral-light text-neutral hover:bg-neutral-light/80"
              disabled={isSaving}
            >
              Ångra
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-xl font-bold font-sans transition-all interactive-transition bg-primary text-white hover:bg-primary-dark shadow-sm disabled:opacity-70 flex justify-center items-center"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Logga'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isBlockedLogging) {
    return (
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="bg-primary p-4 flex justify-between items-center text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <img src={COACH_PERSONAS['hard'].imageUrl} alt="General Börje" className="w-8 h-8 rounded-full object-cover border border-white" />
            General Börje
          </h2>
          <button onClick={onClose} className="text-white hover:bg-primary-darker p-1 rounded-full transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 text-center">
          <div className="w-24 h-24 bg-neutral-light rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden border-2 border-primary">
            <img src={COACH_PERSONAS['hard'].imageUrl} alt="General Börje" className="w-full h-full object-cover" />
          </div>
          <h3 className="text-xl font-bold text-neutral-dark mb-2">Ställ undan vågen, soldat!</h3>
          <p className="text-neutral-dark mb-6">
            Du har redan vägt dig denna vecka. Vi fokuserar på processen under veckan, inte på vågen. Ut och marschera med dig!
          </p>
          <button
            onClick={onClose}
            className="w-full px-5 py-3 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 interactive-transition"
          >
            Uppfattat, General!
          </button>
        </div>
      </div>
    );
  }

  if (isDelayedLogging && !acceptedPunishment) {
    return (
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="bg-red-600 p-4 flex justify-between items-center text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <img src={COACH_PERSONAS['hard'].imageUrl} alt="General Börje" className="w-8 h-8 rounded-full object-cover border border-white" />
            General Börje
          </h2>
          <button onClick={onClose} className="text-white hover:bg-red-700 p-1 rounded-full transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 text-center">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden border-2 border-red-600">
            <img src={COACH_PERSONAS['hard'].imageUrl} alt="General Börje" className="w-full h-full object-cover" />
          </div>
          <h3 className="text-xl font-bold text-red-800 mb-2">FÖRSENAD INVÄGNING!</h3>
          <p className="text-neutral-dark mb-6">
            Du missade invägningen i söndags, soldat! Det är oacceptabelt. 50 armhävningar omedelbart, sen upp på vågen! Se till att logga i tid nästa vecka!
          </p>
          <button
            onClick={() => setAcceptedPunishment(true)}
            className="w-full px-5 py-3 text-base font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm active:scale-95 interactive-transition"
          >
            Jag har gjort mina 50 armhävningar!
          </button>
          <button
            onClick={onClose}
            className="w-full mt-3 px-5 py-3 text-base font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-md shadow-sm active:scale-95 interactive-transition"
          >
            Avbryt
          </button>
        </div>
      </div>
    );
  }

  const inputClass = "mt-1.5 block w-full px-3.5 py-2.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base disabled:bg-neutral-light/70 disabled:cursor-not-allowed";
  const labelClass = "block text-base font-medium text-neutral-dark";

  return (
    <div
      className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-5">
        <h2 id="log-weight-modal-title" className="text-2xl font-semibold text-neutral-dark">Logga ny mätning</h2>
        <button
          onClick={onClose}
          className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
          aria-label="Stäng"
          disabled={isSaving}
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>
      
      <form onSubmit={handleSave} className="space-y-4">
        <fieldset disabled={isSaving} className="space-y-4 group">
            <div className="group-disabled:opacity-60 transition-opacity">
                <label htmlFor="weightKg" className={labelClass}>Vikt (kg) *</label>
                <input
                    type="number"
                    id="weightKg"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className={inputClass}
                    min="1"
                    step="0.1"
                    placeholder="Ange din nuvarande vikt"
                    required
                    autoFocus
                />
            </div>

            {(measurementMethod === 'inbody' || measurementMethod === 'unknown') && (
                <div className="group-disabled:opacity-60 transition-opacity animate-fade-in space-y-2">
                    <div className="bg-primary-50 p-3 rounded-lg border border-primary-100 mb-4">
                        <p className="text-sm text-primary-800">
                            <span className="font-semibold">Viktigt:</span> Om du mäter dig med en InBody-våg måste du fylla i muskelmassa och fettmassa nedan för att vi ska kunna sätta rätt mål för din bootcamp.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="skeletalMuscleMassKg" className={labelClass}>Muskelmassa (kg)</label>
                            <input 
                                type="number" 
                                id="skeletalMuscleMassKg" 
                                value={skeletalMuscleMassKg} 
                                onChange={(e) => setSkeletalMuscleMassKg(e.target.value)} 
                                className={inputClass} 
                                min="0" 
                                step="0.1" 
                                placeholder="Valfritt" 
                            />
                        </div>
                        <div>
                            <label htmlFor="bodyFatMassKg" className={labelClass}>Fettmassa (kg)</label>
                            <input 
                                type="number" 
                                id="bodyFatMassKg" 
                                value={bodyFatMassKg} 
                                onChange={(e) => setBodyFatMassKg(e.target.value)} 
                                className={inputClass} 
                                min="0" 
                                step="0.1" 
                                placeholder="Valfritt" 
                            />
                        </div>
                    </div>
                    {measurementMethod === 'unknown' && (
                        <p className="text-xs text-neutral-500 italic">
                            Om du mäter dig med InBody eller en avancerad våg, fyll i muskel- och fettmassa för att få rätt målsättningar.
                        </p>
                    )}
                </div>
            )}
            
            {!hideComment && (
                <div className="group-disabled:opacity-60 transition-opacity">
                    <label htmlFor="comment" className={labelClass}>Kommentar (valfritt)</label>
                    <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} className={inputClass} rows={2} placeholder="T.ex. Morgonvikt, efter träning..."></textarea>
                </div>
            )}
        </fieldset>

        {error && <p className="text-red-500 text-sm animate-fade-in">{error}</p>}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm active:scale-95 interactive-transition disabled:opacity-60"
            >
                Avbryt
            </button>
            <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 interactive-transition flex items-center justify-center disabled:opacity-60"
            >
                {isSaving ? (
                    <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        Sparar...
                    </>
                ) : (
                    <>
                        <CheckIcon className="w-5 h-5 mr-2" />
                        Spara mätning
                    </>
                )}
            </button>
        </div>
      </form>
    </div>
  );
};

export default LogWeightModal;
