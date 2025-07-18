
import React, { useState } from 'react';
import { WeightLogEntry } from '../types';
import { XMarkIcon, CheckIcon, InformationCircleIcon } from './icons';

interface LogWeightModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (data: Omit<WeightLogEntry, 'id'>) => void;
}

const LogWeightModal: React.FC<LogWeightModalProps> = ({ show, onClose, onSave }) => {
  const [weightKg, setWeightKg] = useState<string>('');
  const [skeletalMuscleMassKg, setSkeletalMuscleMassKg] = useState<string>('');
  const [bodyFatMassKg, setBodyFatMassKg] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!show) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const weightValue = parseFloat(weightKg);
    if (isNaN(weightValue) || weightValue <= 0) {
      setError('Vänligen ange en giltig vikt.');
      return;
    }
    setError(null);

    const muscleValue = parseFloat(skeletalMuscleMassKg);
    const fatValue = parseFloat(bodyFatMassKg);
    
    onSave({
      loggedAt: Date.now(),
      weightKg: weightValue,
      skeletalMuscleMassKg: !isNaN(muscleValue) ? muscleValue : undefined,
      bodyFatMassKg: !isNaN(fatValue) ? fatValue : undefined,
      comment: comment.trim() ? comment.trim() : undefined,
    });
    
    // Clear form for next time
    setWeightKg('');
    setSkeletalMuscleMassKg('');
    setBodyFatMassKg('');
    setComment('');
  };

  const inputClass = "mt-1.5 block w-full px-3.5 py-2.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";
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
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
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

        <div className="pt-3 border-t border-neutral-light/60">
           <p className="text-sm text-neutral-dark mb-3 flex items-start">
              <InformationCircleIcon className="w-6 h-6 mr-2 text-secondary flex-shrink-0" />
              <span>Har du gjort en InBody-mätning? Fyll i valfria fält nedan för att spåra din kroppssammansättning.</span>
          </p>
          <div>
            <label htmlFor="skeletalMuscleMassKg" className={labelClass}>Skelettmuskelmassa (kg)</label>
            <input type="number" id="skeletalMuscleMassKg" value={skeletalMuscleMassKg} onChange={(e) => setSkeletalMuscleMassKg(e.target.value)} className={inputClass} min="0" step="0.1" placeholder="Valfritt" />
          </div>
          <div>
            <label htmlFor="bodyFatMassKg" className={labelClass}>Kroppsfettmassa (kg)</label>
            <input type="number" id="bodyFatMassKg" value={bodyFatMassKg} onChange={(e) => setBodyFatMassKg(e.target.value)} className={inputClass} min="0" step="0.1" placeholder="Valfritt" />
          </div>
        </div>
        
         <div>
            <label htmlFor="comment" className={labelClass}>Kommentar (valfritt)</label>
            <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} className={inputClass} rows={2} placeholder="T.ex. Morgonvikt, efter träning..."></textarea>
          </div>

        {error && <p className="text-red-500 text-sm animate-fade-in">{error}</p>}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm active:scale-95 interactive-transition"
          >
            Avbryt
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 interactive-transition flex items-center justify-center"
          >
            <CheckIcon className="w-5 h-5 mr-2" />
            Spara mätning
          </button>
        </div>
      </form>
    </div>
  );
};

export default LogWeightModal;
