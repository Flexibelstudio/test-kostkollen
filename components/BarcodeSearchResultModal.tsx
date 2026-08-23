
import React, { useState, useEffect } from 'react';
import { NutritionalInfo, BarcodeScannedFoodInfo, MealType } from '../types.ts';
import { FireIcon, ProteinIcon, LeafIcon, CheckIcon, XMarkIcon, BarcodeIcon, PencilIcon } from './icons.tsx';
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

interface BarcodeSearchResultModalProps {
  show: boolean;
  scanResult: BarcodeScannedFoodInfo | null;
  onLog: (nutritionalInfo: NutritionalInfo, options: { saveAsCommon: boolean, mealType: MealType }) => void;
  onClose: () => void;
  defaultMealType?: MealType | null;
}

const BarcodeSearchResultModal: React.FC<BarcodeSearchResultModalProps> = ({ show, scanResult, onLog, onClose, defaultMealType = null }) => {
  const [amount, setAmount] = useState('100'); // Default to 100g
  const [unit, setUnit] = useState<Unit>('g');
  const [calculatedNutrients, setCalculatedNutrients] = useState<NutritionalInfo>({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(defaultMealType);
  const [saveAsCommon, setSaveAsCommon] = useState<boolean>(false);

  useEffect(() => {
    if (scanResult) {
      const numAmount = parseFloat(amount.replace(',', '.')) || 0;
      let multiplier = 0;
      
      if (unit === 'portion' && scanResult.servingSizeG) {
        multiplier = (numAmount * scanResult.servingSizeG) / 100;
      } else {
        const grams = numAmount * unitToGrams[unit];
        multiplier = grams / 100;
      }

      setCalculatedNutrients({
        calories: scanResult.nutrientsPer100g.calories * multiplier,
        protein: scanResult.nutrientsPer100g.protein * multiplier,
        carbohydrates: scanResult.nutrientsPer100g.carbohydrates * multiplier,
        fat: scanResult.nutrientsPer100g.fat * multiplier,
      });
    }
  }, [amount, unit, scanResult]);

  useEffect(() => {
      setSelectedMealType(defaultMealType);
  }, [defaultMealType]);

  useEffect(() => {
      if (scanResult && scanResult.servingSizeG) {
          setUnit('portion');
          setAmount('1');
      } else {
          setUnit('g');
          setAmount('100');
      }
      setSaveAsCommon(false);
  }, [scanResult]);

  const handleLog = () => {
    if (!scanResult || !selectedMealType) return;
    onLog({
      ...calculatedNutrients,
      foodItem: `${scanResult.name} (${scanResult.brand}) (${amount} ${unit})`
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
      <div className="bg-white rounded-xl shadow-soft-xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 sm:p-8 pb-4 border-b border-neutral-light/60 shrink-0">
          <div className="flex items-center">
            <BarcodeIcon className="w-7 h-7 text-primary mr-2.5" />
            <h2 className="text-2xl font-semibold text-neutral-dark">Skannad Produkt</h2>
          </div>
          <button onClick={onClose} className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90" aria-label="Stäng">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 sm:p-8 pt-4 space-y-4 overflow-y-auto custom-scrollbar">
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
                  {(unit === 'portion' || unit === 'st') && (
                      <p className="text-xs text-neutral-500 mt-1.5 ml-1">Tips: Du kan skriva t.ex. 0.5 eller 1.5 för att justera portionen.</p>
                  )}
              </div>
               <div>
                  <label htmlFor="unit" className={labelClass}>Enhet</label>
                   <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className={inputClass}>
                      <option value="g">gram (g)</option>
                      <option value="ml">milliliter (ml)</option>
                      <option value="dl">deciliter (dl)</option>
                      <option value="msk">matsked (msk)</option>
                      <option value="tsk">tesked (tsk)</option>
                      <option value="st">styck (st)</option>
                      <option value="portion">
                        portion {scanResult.servingSizeG ? `(${scanResult.servingSizeG}g)` : ''}
                      </option>
                   </select>
              </div>
          </div>

          <div className="pt-4 mt-2 border-t border-neutral-light/60">
              <h4 className="font-semibold text-neutral-dark mb-2">Beräknat näringsinnehåll:</h4>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 p-3 bg-neutral-light/70 rounded-md">
                  <div className="flex items-center"><FireIcon className="w-4 h-4 mr-1 text-red-500" /> Kalorier: {Math.round(calculatedNutrients.calories)} kcal</div>
                  <div className="flex items-center"><ProteinIcon className="w-4 h-4 mr-1 text-primary" /> Protein: {calculatedNutrients.protein.toFixed(1)} g</div>
                  <div className="flex items-center"><LeafIcon className="w-4 h-4 mr-1 text-[#7A756E]" /> Kolhydrater: {calculatedNutrients.carbohydrates.toFixed(1)} g</div>
                  <div className="flex items-center"><LeafIcon className="w-4 h-4 mr-1 text-[#D96E4A]" /> Fett: {calculatedNutrients.fat.toFixed(1)} g</div>
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
        
         <div className="p-6 sm:p-8 pt-4 border-t border-neutral-light/60 shrink-0 flex flex-col sm:flex-row sm:justify-end sm:space-x-3.5 space-y-3 sm:space-y-0 bg-neutral-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-neutral-dark bg-white border border-neutral-light hover:bg-gray-50 rounded-md shadow-sm active:scale-95"
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
