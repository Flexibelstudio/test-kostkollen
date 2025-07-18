
import React, { useState, useEffect } from 'react';
import { NutritionalInfo } from '../types.ts';
import { FireIcon, ProteinIcon, LeafIcon, CheckIcon, XMarkIcon, CameraIcon } from './icons.tsx'; 
import { playAudio } from '../services/audioService.ts';

interface ImageAnalysisResultModalProps {
  analysisResult: NutritionalInfo;
  imageDataUrl: string;
  onLog: (editedInfo: NutritionalInfo, options: { saveAsCommon: boolean }) => void; 
  onClose: () => void;
}

const ImageAnalysisResultModal: React.FC<ImageAnalysisResultModalProps> = ({ analysisResult, imageDataUrl, onLog, onClose }) => {
  const formatForDisplay = (num: number) => num.toLocaleString('sv-SE', { maximumFractionDigits: 2, useGrouping: false });

  const [editedFoodItem, setEditedFoodItem] = useState(analysisResult.foodItem || '');
  const [editedCalories, setEditedCalories] = useState(formatForDisplay(analysisResult.calories));
  const [editedProtein, setEditedProtein] = useState(formatForDisplay(analysisResult.protein));
  const [editedCarbohydrates, setEditedCarbohydrates] = useState(formatForDisplay(analysisResult.carbohydrates));
  const [editedFat, setEditedFat] = useState(formatForDisplay(analysisResult.fat));
  const [saveAsCommon, setSaveAsCommon] = useState<boolean>(false); 

  useEffect(() => {
    setEditedFoodItem(analysisResult.foodItem || '');
    setEditedCalories(formatForDisplay(analysisResult.calories));
    setEditedProtein(formatForDisplay(analysisResult.protein));
    setEditedCarbohydrates(formatForDisplay(analysisResult.carbohydrates));
    setEditedFat(formatForDisplay(analysisResult.fat));
    setSaveAsCommon(false); 
  }, [analysisResult]);

  const createNumericHandler = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const valueWithDot = value.replace(',', '.');
        const validDecimalRegex = /^\d*\.?\d{0,2}$/;
        if (valueWithDot === '' || validDecimalRegex.test(valueWithDot)) {
            setter(value);
        }
    };
  };

  const handleSubmit = () => {
    playAudio('uiClick');
    const parseValue = (val: string) => parseFloat(val.replace(',', '.')) || 0;
    const validatedInfo: NutritionalInfo = {
        foodItem: editedFoodItem,
        calories: parseValue(editedCalories),
        protein: parseValue(editedProtein),
        carbohydrates: parseValue(editedCarbohydrates),
        fat: parseValue(editedFat),
    };
    onLog(validatedInfo, { saveAsCommon }); 
  };

  if (!analysisResult || !imageDataUrl) return null;

  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";
  const labelClass = "block text-sm font-medium text-neutral-dark";

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light w-full max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center">
            <CameraIcon className="w-7 h-7 text-primary mr-2.5" />
            <h2 id="image-analysis-result-modal-title" className="text-2xl font-semibold text-neutral-dark">Bekräfta måltid</h2>
        </div>
        <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 active:scale-90 transform"
            aria-label="Stäng bildanalysresultat"
        >
            <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="mb-6 space-y-4">
        <div className="w-full aspect-video rounded-lg overflow-hidden shadow-md">
            <img 
                src={imageDataUrl} 
                alt={editedFoodItem || "Analyserad bild"} 
                className="w-full h-full object-cover"
            />
        </div>
        
        <div>
          <label htmlFor="foodItemModal" className={labelClass}>Identifierat livsmedel</label>
          <input type="text" name="foodItem" id="foodItemModal" value={editedFoodItem} onChange={(e) => setEditedFoodItem(e.target.value)} className={inputClass} />
        </div>
        
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <div>
            <label htmlFor="caloriesModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>Kalorier (kcal)</label>
            <input type="text" inputMode="decimal" name="calories" id="caloriesModal" value={editedCalories} onChange={createNumericHandler(setEditedCalories)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="proteinModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Protein">💪</span>Protein (g)</label>
            <input type="text" inputMode="decimal" name="protein" id="proteinModal" value={editedProtein} onChange={createNumericHandler(setEditedProtein)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="carbohydratesModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>Kolhydrater (g)</label>
            <input type="text" inputMode="decimal" name="carbohydrates" id="carbohydratesModal" value={editedCarbohydrates} onChange={createNumericHandler(setEditedCarbohydrates)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="fatModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>Fett (g)</label>
            <input type="text" inputMode="decimal" name="fat" id="fatModal" value={editedFat} onChange={createNumericHandler(setEditedFat)} className={inputClass} />
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-neutral-light/60">
          <label htmlFor="saveAsCommonImage" className="flex items-center text-base text-neutral-dark cursor-pointer">
            <input
              type="checkbox"
              id="saveAsCommonImage"
              name="saveAsCommon"
              checked={saveAsCommon}
              onChange={(e) => setSaveAsCommon(e.target.checked)}
              className="h-5 w-5 text-primary border-neutral-light rounded focus:ring-primary mr-2.5"
            />
            <span className="mr-1.5" role="img" aria-hidden="true">📌</span>
            Spara som vanligt val
          </label>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3.5">
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral focus:ring-opacity-50 active:scale-95 transform"
        >
          <XMarkIcon className="w-5 h-5 inline mr-1.5" />
          Avbryt
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform"
        >
          <CheckIcon className="w-5 h-5 inline mr-1.5" />
          Logga
        </button>
      </div>
    </div>
  );
};

export default ImageAnalysisResultModal;
