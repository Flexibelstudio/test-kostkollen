
import React, { useState, useEffect } from 'react';
import { NutritionalInfo, BarcodeScannedFoodInfo, MealType } from '../types.ts';
import { FireIcon, ProteinIcon, LeafIcon, CheckIcon, XMarkIcon, BarcodeIcon, PencilIcon } from './icons.tsx';
import { playAudio } from '../services/audioService.ts';
import MealTypeSelector from './MealTypeSelector';

interface BarcodeSearchResultModalProps {
  show: boolean;
  scanResult: BarcodeScannedFoodInfo | null;
  onLog: (nutritionalInfo: NutritionalInfo, options: { saveAsCommon: boolean, mealType: MealType }) => void;
  onClose: () => void;
  defaultMealType?: MealType | null;
}

const BarcodeSearchResultModal: React.FC<BarcodeSearchResultModalProps> = ({ show, scanResult, onLog, onClose, defaultMealType = null }) => {
  const [amount, setAmount] = useState('100'); // Default to 100g
  const [unit, setUnit] = useState<'g' | 'servings'>('g');
  const [calculatedNutrients, setCalculatedNutrients] = useState<NutritionalInfo>({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(defaultMealType);
  const [saveAsCommon, setSaveAsCommon] = useState<boolean>(false);

  useEffect(() => {
    if (scanResult) {
      const numAmount = parseFloat(amount) || 0;
      let multiplier = 0;
      
      if (unit === 'g') {
        multiplier = numAmount / 100;
      } else if (unit === 'servings' && scanResult.servingSizeG) {
        multiplier = (numAmount * scanResult.servingSizeG) / 100;
      }

      setCalculatedNutrients({
        calories: Math.round(scanResult.nutrientsPer100g.calories * multiplier),
        protein: Math.round(scanResult.nutrientsPer100g.protein * multiplier),
        carbohydrates: Math.round(scanResult.nutrientsPer100g.carbohydrates * multiplier),
        fat: Math.round(scanResult.nutrientsPer100g.fat * multiplier),
      });
    }
  }, [amount, unit, scanResult]);

  useEffect(() => {
      setSelectedMealType(defaultMealType);
  }, [defaultMealType]);

  useEffect(() => {
      if (scanResult && scanResult.servingSizeG) {
          setUnit('servings');
          setAmount('1');
      } else {
          setUnit('g');
          setAmount('100');
      }
      setSaveAsCommon(false);
  }, [scanResult]);

  const handleLog = () => {
    if (!scanResult || !selectedMealType) return;
    playAudio('uiClick');
    onLog({
      ...calculatedNutrients,
      foodItem: `${scanResult.name} (${scanResult.brand})`
    }, { saveAsCommon: saveAsCommon, mealType: selectedMealType });
    onClose(); // Close modal immediately after logging
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(',', '.');
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
        setAmount(val);
    }
  };

  if (!show || !scanResult) return null;

  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";
  const labelClass = "block text-sm font-medium text-neutral-dark";

  return (
    <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center">
            <BarcodeIcon className="w-7 h-7 text-primary mr-2.5" />
            <h2 className="text-2xl font-semibold text-neutral-dark">Skannad Produkt</h2>
          </div>
          <button onClick={onClose} className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90" aria-label="Stäng">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {scanResult.imageUrl && (
              <div className="w-full h-40 flex justify-center items-center bg-neutral-light rounded-lg overflow-hidden">
                  <img src={scanResult.imageUrl} alt={scanResult.name} className="max-h-full max-w-full object-contain"/>
              </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-neutral-dark">{scanResult.name}</h3>
            <p className="text-base text-neutral">{scanResult.brand}</p>
          </div>

          {/* Meal Type Selector */}
          <div>
              <label className={labelClass + " mb-1"}>Måltidstyp</label>
              <MealTypeSelector selectedType={selectedMealType} onSelect={setSelectedMealType} />
              {!selectedMealType && <p className="text-xs text-red-500 mt-1">Välj måltidstyp för att logga.</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label htmlFor="amount" className={labelClass}>Mängd</label>
                  <div className="relative">
                      <input type="text" id="amount" value={amount} onChange={handleAmountChange} className={`${inputClass} pr-8`} inputMode="decimal" />
                      <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                  </div>
              </div>
               <div>
                  <label htmlFor="unit" className={labelClass}>Enhet</label>
                   <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value as 'g' | 'servings')} className={inputClass}>
                      <option value="g">gram</option>
                      {scanResult.servingSizeG && <option value="servings">portion(er) ({scanResult.servingSizeG}g)</option>}
                   </select>
              </div>
          </div>

          <div className="pt-4 mt-2 border-t border-neutral-light/60">
              <h4 className="font-semibold text-neutral-dark mb-2">Beräknat näringsinnehåll:</h4>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 p-3 bg-neutral-light/70 rounded-md">
                  <div className="flex items-center"><FireIcon className="w-4 h-4 mr-1 text-red-500" /> Kalorier: {calculatedNutrients.calories} kcal</div>
                  <div className="flex items-center"><ProteinIcon className="w-4 h-4 mr-1 text-primary" /> Protein: {calculatedNutrients.protein} g</div>
                  <div className="flex items-center"><LeafIcon className="w-4 h-4 mr-1 text-yellow-500" /> Kolhydrater: {calculatedNutrients.carbohydrates} g</div>
                  <div className="flex items-center"><LeafIcon className="w-4 h-4 mr-1 text-orange-500" /> Fett: {calculatedNutrients.fat} g</div>
              </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-neutral-light/60">
            <label htmlFor="saveAsCommonBarcode" className="flex items-center text-base text-neutral-dark cursor-pointer">
              <input
                type="checkbox"
                id="saveAsCommonBarcode"
                checked={saveAsCommon}
                onChange={(e) => setSaveAsCommon(e.target.checked)}
                className="h-5 w-5 text-primary border-neutral-light rounded focus:ring-primary mr-2.5"
              />
              <span className="mr-1.5" role="img" aria-hidden="true">📌</span>
              Spara som vanligt val
            </label>
          </div>
        </div>
        
         <div className="mt-6 flex flex-col sm:flex-row sm:justify-end sm:space-x-3.5 space-y-3 sm:space-y-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm active:scale-95"
          >
            <XMarkIcon className="w-5 h-5 inline mr-1.5" />
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleLog}
            disabled={!selectedMealType}
            className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon className="w-5 h-5 inline mr-1.5" />
            Logga
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeSearchResultModal;
