import React, { useState } from 'react';
import { InBodyScanData, WeightLogEntry } from '../types';
import { XMarkIcon, CheckIcon, BarcodeIcon } from './icons';

interface InBodyResultModalProps {
  show: boolean;
  onClose: () => void;
  scanData: InBodyScanData;
  onSave: (data: Omit<WeightLogEntry, 'id'>) => void;
}

const InBodyResultModal: React.FC<InBodyResultModalProps> = ({ show, onClose, scanData, onSave }) => {
  const [comment, setComment] = useState<string>('InBody-mätning');

  const handleSave = () => {
    const logData: Omit<WeightLogEntry, 'id'> = {
      loggedAt: scanData.timestamp || Date.now(),
      weightKg: scanData.weightKg,
      skeletalMuscleMassKg: scanData.skeletalMuscleMassKg,
      bodyFatMassKg: scanData.bodyFatMassKg,
      comment: comment.trim() || 'InBody-mätning',
    };
    onSave(logData);
  };
  
  if (!show) return null;

  const inputClass = "mt-1.5 block w-full px-3.5 py-2.5 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";
  const labelClass = "block text-base font-medium text-neutral-dark";
  const valueDisplayClass = "text-lg font-semibold text-primary";

  return (
    <div
      className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center">
            <BarcodeIcon className="w-7 h-7 text-primary mr-2.5" />
            <h2 id="inbody-result-modal-title" className="text-2xl font-semibold text-neutral-dark">Bekräfta InBody-mätning</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
          aria-label="Stäng"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      <p className="text-neutral-dark mb-4">Granska de skannade värdena nedan och spara mätningen.</p>

      <div className="space-y-4 bg-neutral-light/70 p-4 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
                <p className={labelClass}>Vikt (kg)</p>
                <p className={valueDisplayClass}>{scanData.weightKg.toFixed(2)}</p>
            </div>
             <div>
                <p className={labelClass}>Muskelmassa (kg)</p>
                <p className={valueDisplayClass}>{scanData.skeletalMuscleMassKg?.toFixed(2) || 'N/A'}</p>
            </div>
             <div>
                <p className={labelClass}>Fettmassa (kg)</p>
                <p className={valueDisplayClass}>{scanData.bodyFatMassKg?.toFixed(2) || 'N/A'}</p>
            </div>
        </div>
        {scanData.timestamp && (
            <p className="text-xs text-center text-neutral mt-2">
                Mätningstid: {new Date(scanData.timestamp).toLocaleString('sv-SE')}
            </p>
        )}
      </div>

      <div className="mt-4">
        <label htmlFor="comment" className={labelClass}>Kommentar</label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className={inputClass}
          rows={2}
          placeholder="T.ex. InBody-mätning"
        ></textarea>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row sm:justify-end sm:space-x-3.5 space-y-3 sm:space-y-0 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm active:scale-95 interactive-transition"
        >
          <XMarkIcon className="w-5 h-5 inline mr-1.5" />
          Avbryt
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 interactive-transition flex items-center justify-center"
        >
          <CheckIcon className="w-5 h-5 mr-2" />
          Spara Mätning
        </button>
      </div>
    </div>
  );
};

export default InBodyResultModal;