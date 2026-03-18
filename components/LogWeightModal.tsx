
import React, { useState, useEffect } from 'react';
import { WeightLogEntry } from '../types';
import { XMarkIcon, CheckIcon } from './icons';

interface LogWeightModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (data: Omit<WeightLogEntry, 'id'>) => Promise<void>;
  measurementMethod?: 'scale' | 'inbody' | 'unknown';
}

const LogWeightModal: React.FC<LogWeightModalProps> = ({ show, onClose, onSave, measurementMethod = 'scale' }) => {
  const [weightKg, setWeightKg] = useState<string>('');
  const [skeletalMuscleMassKg, setSkeletalMuscleMassKg] = useState<string>('');
  const [bodyFatMassKg, setBodyFatMassKg] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setWeightKg('');
      setSkeletalMuscleMassKg('');
      setBodyFatMassKg('');
      setComment('');
      setError(null);
      setIsSaving(false);
    }
  }, [show]);

  if (!show) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightValue = parseFloat(weightKg);
    if (isNaN(weightValue) || weightValue <= 0) {
      setError('Vänligen ange en giltig vikt.');
      return;
    }
    setError(null);
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
            
            <div className="group-disabled:opacity-60 transition-opacity">
                <label htmlFor="comment" className={labelClass}>Kommentar (valfritt)</label>
                <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} className={inputClass} rows={2} placeholder="T.ex. Morgonvikt, efter träning..."></textarea>
            </div>
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
