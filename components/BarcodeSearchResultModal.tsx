
import React, { useState, useEffect } from 'react';
import { NutritionalInfo, BarcodeScannedFoodInfo } from '../types.ts';
import { FireIcon, ProteinIcon, LeafIcon, CheckIcon, XMarkIcon, BarcodeIcon } from './icons.tsx';
import { playAudio } from '../services/audioService.ts';

interface BarcodeSearchResultModalProps {
  scanResult: BarcodeScannedFoodInfo;
  onLog: (nutritionalInfo: NutritionalInfo) => void;
  onClose: () => void;
}

const BarcodeSearchResultModal: React.FC<BarcodeSearchResultModalProps> = ({ scanResult, onLog, onClose }) => {
  const [amount, setAmount] = useState('100'); // Default to 100g
  const [unit, setUnit] = useState<'g' | 'servings'>('g');
  const [calculatedNutrients, setCalculatedNutrients] = useState<NutritionalInfo>({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });

  useEffect(() => {
    if (scanResult) {
      const numAmount = parseFloat(amount.replace(',', '.')) || 0;
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
      if (scanResult && scanResult.servingSizeG) {
          setUnit('servings');
          setAmount('1');
      } else {
          setUnit('g');
          setAmount('100');
      }
  }, [scanResult]);

  const handleLog = () => {
    playAudio('uiClick');
    onLog({
      ...calculatedNutrients,
      foodItem: `${scanResult.name} (${scanResult.brand})`
    });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const valueWithDot = value.replace(',', '.');
    const validDecimalRegex = /^\d*\.?\d{0,2}$/;
    if (valueWithDot === "" || validDecimalRegex.test(valueWithDot)) {
        setAmount(value);
    }
  };

  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";
  const labelClass = "block text-sm font-medium text-neutral-dark";

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg">
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

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="amount" className={labelClass}>Mängd</label>
                <input type="text" id="amount" value={amount} onChange={handleAmountChange} className={inputClass} inputMode="decimal" />
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
      </div>
      
       <div className="mt-8 flex flex-col sm:flex-row sm:justify-end sm:space-x-3.5 space-y-3 sm:space-y-0">
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
          className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95"
        >
          <CheckIcon className="w-5 h-5 inline mr-1.5" />
          Logga
        </button>
      </div>
    </div>
  );
};

export default BarcodeSearchResultModal;
