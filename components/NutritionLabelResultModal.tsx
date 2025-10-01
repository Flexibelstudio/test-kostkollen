import React, { useState, useEffect } from 'react';
import { NutritionalInfo } from '../types.ts';
import { CheckIcon, XMarkIcon } from './icons.tsx';
import { FileText } from 'lucide-react';
import { playAudio } from '../services/audioService.ts';

interface NutritionLabelResultModalProps {
  show: boolean;
  onClose: () => void;
  analysisResult: NutritionalInfo; // This is per 100g
  onLog: (finalNutrients: NutritionalInfo) => void;
}

const NutritionLabelResultModal: React.FC<NutritionLabelResultModalProps> = ({ show, onClose, analysisResult, onLog }) => {
  const [amountGrams, setAmountGrams] = useState('100');
  const [finalNutrients, setFinalNutrients] = useState<NutritionalInfo>(analysisResult);

  useEffect(() => {
    if (analysisResult) {
        setFinalNutrients(analysisResult);
        setAmountGrams('100');
    }
  }, [analysisResult]);

  useEffect(() => {
    const grams = parseFloat(amountGrams.replace(',', '.')) || 0;
    const multiplier = grams / 100.0;
    
    setFinalNutrients({
      foodItem: analysisResult.foodItem,
      calories: Math.round((analysisResult.calories || 0) * multiplier),
      protein: Math.round((analysisResult.protein || 0) * multiplier),
      carbohydrates: Math.round((analysisResult.carbohydrates || 0) * multiplier),
      fat: Math.round((analysisResult.fat || 0) * multiplier),
    });
  }, [amountGrams, analysisResult]);
  
  const handleLog = () => {
    playAudio('uiClick');
    onLog({
        ...finalNutrients,
        foodItem: `${finalNutrients.foodItem || 'Skannad produkt'} (${amountGrams}g)`
    });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(',', '.');
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
        setAmountGrams(val);
    }
  };

  if (!show) return null;

  const labelClass = "block text-sm font-medium text-neutral-dark";

  return (
    <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center">
                    <FileText className="w-7 h-7 text-primary mr-2.5" />
                    <h2 id="nutrition-label-modal-title" className="text-2xl font-semibold text-neutral-dark">Bekräfta från näringsinfo</h2>
                </div>
                <button onClick={onClose} className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90" aria-label="Stäng">
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>

            <div className="space-y-4">
                <div className="p-4 bg-neutral-light/70 rounded-lg">
                    <p className="text-lg font-bold text-neutral-dark">{analysisResult.foodItem || 'Okänd Produkt'}</p>
                    <p className="text-sm text-neutral-dark">Näringsvärde per 100g/ml:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-sm">
                        <span>🔥 Kalorier: {Math.round(analysisResult.calories)} kcal</span>
                        <span>💪 Protein: {analysisResult.protein.toFixed(1)} g</span>
                        <span>🍞 Kolhydrater: {analysisResult.carbohydrates.toFixed(1)} g</span>
                        <span>🥑 Fett: {analysisResult.fat.toFixed(1)} g</span>
                    </div>
                </div>

                <div>
                    <label htmlFor="amountGrams" className={`${labelClass} text-center`}>Hur många gram/ml åt/drack du?</label>
                    <div className="relative mt-1 max-w-xs mx-auto">
                        <input
                            type="text"
                            id="amountGrams"
                            value={amountGrams}
                            onChange={handleAmountChange}
                            className="w-full px-4 py-3 text-center text-xl font-bold bg-white border-2 border-primary-lighter rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            inputMode="decimal"
                            autoFocus
                        />
                         <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-neutral">g/ml</span>
                    </div>
                </div>

                <div className="pt-4 mt-2 border-t border-neutral-light/60">
                    <h4 className="font-semibold text-neutral-dark mb-2 text-center">Totalt för din portion:</h4>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 p-3 bg-primary-100/60 rounded-md text-lg">
                        <div className="font-semibold flex items-center">🔥 Kalorier: <span className="ml-2 font-bold">{finalNutrients.calories} kcal</span></div>
                        <div className="font-semibold flex items-center">💪 Protein: <span className="ml-2 font-bold">{finalNutrients.protein} g</span></div>
                        <div className="font-semibold flex items-center">🍞 Kolhydrater: <span className="ml-2 font-bold">{finalNutrients.carbohydrates} g</span></div>
                        <div className="font-semibold flex items-center">🥑 Fett: <span className="ml-2 font-bold">{finalNutrients.fat} g</span></div>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3.5 space-y-3 sm:space-y-0">
                <button type="button" onClick={onClose} className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm active:scale-95">
                    <XMarkIcon className="w-5 h-5 inline mr-1.5" />
                    Avbryt
                </button>
                <button type="button" onClick={handleLog} className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95">
                    <CheckIcon className="w-5 h-5 inline mr-1.5" />
                    Logga
                </button>
            </div>
        </div>
    </div>
  );
};

export default NutritionLabelResultModal;
