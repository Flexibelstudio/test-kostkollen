
import React, { useState, useEffect } from 'react';
import { NutritionalInfo, MealType } from '../types.ts';
import { CheckIcon, XMarkIcon } from './icons.tsx';
import { FileText } from 'lucide-react';
import { playAudio } from '../services/audioService.ts';
import MealTypeSelector from './MealTypeSelector';

type Unit = 'g' | 'ml' | 'dl' | 'msk' | 'tsk' | 'st' | 'portion';

const unitToGrams: Record<Unit, number> = {
  'g': 1,
  'ml': 1,
  'dl': 100,
  'msk': 15,
  'tsk': 5,
  'st': 100, // Schablonvärde
  'portion': 150 // Schablonvärde
};

interface NutritionLabelResultModalProps {
  show: boolean;
  onClose: () => void;
  analysisResult: NutritionalInfo | null; // This is per 100g
  onLog: (finalNutrients: NutritionalInfo, options: { saveAsCommon: boolean, mealType: MealType }) => void;
  defaultMealType?: MealType | null;
}

const NutritionLabelResultModal: React.FC<NutritionLabelResultModalProps> = ({ show, onClose, analysisResult, onLog, defaultMealType = null }) => {
  const [amountInput, setAmountInput] = useState('100');
  const [unit, setUnit] = useState<Unit>('g');
  const [finalNutrients, setFinalNutrients] = useState<NutritionalInfo>({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(defaultMealType);

  useEffect(() => {
    if (analysisResult) {
        setFinalNutrients(analysisResult);
        setAmountInput('100');
        setUnit('g');
    }
  }, [analysisResult]);

  useEffect(() => {
      if(show) {
        setSelectedMealType(defaultMealType);
      }
  }, [defaultMealType, show]);

  useEffect(() => {
    if (analysisResult) {
        const amount = parseFloat(amountInput.replace(',', '.')) || 0;
        const grams = amount * unitToGrams[unit];
        const multiplier = grams / 100.0;
        
        setFinalNutrients({
          foodItem: analysisResult.foodItem,
          calories: Math.round((analysisResult.calories || 0) * multiplier),
          protein: Number(((analysisResult.protein || 0) * multiplier).toFixed(1)),
          carbohydrates: Number(((analysisResult.carbohydrates || 0) * multiplier).toFixed(1)),
          fat: Number(((analysisResult.fat || 0) * multiplier).toFixed(1)),
        });
    }
  }, [amountInput, unit, analysisResult]);
  
  const handleLog = () => {
    if (!selectedMealType) return;
    playAudio('uiClick');
    onLog({
        ...finalNutrients,
        foodItem: `${finalNutrients.foodItem || 'Skannad produkt'} (${amountInput} ${unit})`
    }, { saveAsCommon: false, mealType: selectedMealType });
    onClose(); // Close modal immediately after logging
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(',', '.');
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
        setAmountInput(val);
    }
  };

  if (!show || !analysisResult) return null;

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
                    <p className="text-sm text-neutral-dark">Näringsvärde per 100g:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-sm">
                        <span>🔥 Kalorier: {Math.round(analysisResult.calories)} kcal</span>
                        <span>💪 Protein: {analysisResult.protein.toFixed(1)} g</span>
                        <span>🍞 Kolhydrater: {analysisResult.carbohydrates.toFixed(1)} g</span>
                        <span>🥑 Fett: {analysisResult.fat.toFixed(1)} g</span>
                    </div>
                </div>

                {/* Meal Type Selector */}
                <div>
                    <label className={labelClass + " mb-1"}>Måltidstyp</label>
                    <MealTypeSelector selectedType={selectedMealType} onSelect={setSelectedMealType} />
                    {!selectedMealType && <p className="text-xs text-red-500 mt-1">Välj måltidstyp för att logga.</p>}
                </div>

                <div>
                    <label htmlFor="amountInput" className={`${labelClass} text-center`}>Hur mycket åt/drack du?</label>
                    <div className="relative mt-1 max-w-xs mx-auto flex items-center shadow-sm rounded-lg">
                        <input
                            type="text"
                            id="amountInput"
                            value={amountInput}
                            onChange={handleAmountChange}
                            className="w-2/3 px-4 py-3 text-center text-xl font-bold bg-white border-2 border-r-0 border-primary-lighter rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary z-10"
                            inputMode="decimal"
                            autoFocus
                        />
                        <select
                            value={unit}
                            onChange={(e) => setUnit(e.target.value as Unit)}
                            className="w-1/3 px-2 py-3 text-center text-lg font-semibold bg-neutral-light border-2 border-primary-lighter rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer z-10"
                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23111827%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
                        >
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                            <option value="dl">dl</option>
                            <option value="msk">msk</option>
                            <option value="tsk">tsk</option>
                            <option value="st">st</option>
                            <option value="portion">portion</option>
                        </select>
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
                <button type="button" onClick={handleLog} disabled={!selectedMealType} className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    <CheckIcon className="w-5 h-5 inline mr-1.5" />
                    Logga
                </button>
            </div>
        </div>
    </div>
  );
};

export default NutritionLabelResultModal;
