
import React, { useState, useEffect } from 'react';
import { NutritionalInfo, MealType } from '../types.ts';
import { FireIcon, ProteinIcon, LeafIcon, CheckIcon, XMarkIcon, CameraIcon, PencilIcon } from './icons.tsx'; 
import { playAudio } from '../services/audioService.ts';
import MealTypeSelector from './MealTypeSelector';

interface ImageAnalysisResultModalProps {
  show: boolean;
  analysisResult: NutritionalInfo | null;
  imageDataUrl: string | null;
  onLog: (editedInfo: NutritionalInfo, options: { saveAsCommon: boolean, mealType: MealType }) => void; 
  onClose: () => void;
  defaultMealType?: MealType | null;
}

const ImageAnalysisResultModal: React.FC<ImageAnalysisResultModalProps> = ({ show, analysisResult, imageDataUrl, onLog, onClose, defaultMealType = null }) => {
  const [editedInfo, setEditedInfo] = useState<NutritionalInfo>({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  const [saveAsCommon, setSaveAsCommon] = useState<boolean>(false); 
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(defaultMealType);

  useEffect(() => {
    if (analysisResult) {
      setEditedInfo({
          ...analysisResult,
          calories: Math.round(analysisResult.calories || 0),
          protein: Math.round(analysisResult.protein || 0),
          carbohydrates: Math.round(analysisResult.carbohydrates || 0),
          fat: Math.round(analysisResult.fat || 0),
      });
    }
    setSaveAsCommon(false); 
  }, [analysisResult]);

  useEffect(() => {
      if (show) {
        setSelectedMealType(defaultMealType);
      }
  }, [defaultMealType, show]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const isNumericField = ['calories', 'protein', 'carbohydrates', 'fat'].includes(name);

    if (isNumericField) {
      if (value === '') {
        setEditedInfo(prev => ({ ...prev, [name]: 0 }));
        return;
      }
      // Check if the value is a valid integer string
      if (/^\d+$/.test(value)) {
        const parsedValue = parseInt(value, 10);
        if (!isNaN(parsedValue) && parsedValue >= 0) {
          setEditedInfo(prev => ({ ...prev, [name]: parsedValue }));
        }
      }
    } else {
      setEditedInfo(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = () => {
    if (!selectedMealType) return;
    playAudio('uiClick');
    const validatedInfo: NutritionalInfo = {
        ...editedInfo,
        calories: editedInfo.calories || 0,
        protein: editedInfo.protein || 0,
        carbohydrates: editedInfo.carbohydrates || 0,
        fat: editedInfo.fat || 0,
    };
    onLog(validatedInfo, { saveAsCommon, mealType: selectedMealType }); 
    onClose(); // Close modal immediately after logging
  };

  if (!show || !analysisResult || !imageDataUrl) return null;

  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";
  const labelClass = "block text-sm font-medium text-neutral-dark";

  return (
    <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light w-full max-w-lg mx-auto flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header - Fixed */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
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

        {/* Scrollable Content */}
        <div className="flex-grow overflow-y-auto custom-scrollbar -mr-2 pr-2">
          <div className="mb-6 space-y-4">
            <div className="w-full aspect-video rounded-lg overflow-hidden shadow-md shrink-0">
                <img 
                    src={imageDataUrl} 
                    alt={editedInfo.foodItem || "Analyserad bild"} 
                    className="w-full h-full object-cover"
                />
            </div>
            
            {/* Meal Type Selector */}
            <div>
                <label className={labelClass + " mb-1"}>Måltidstyp</label>
                <MealTypeSelector selectedType={selectedMealType} onSelect={setSelectedMealType} />
                {!selectedMealType && <p className="text-xs text-red-500 mt-1">Välj måltidstyp för att logga.</p>}
            </div>

            <div>
              <label htmlFor="foodItemModal" className={labelClass}>Identifierat livsmedel</label>
               <div className="relative">
                    <input type="text" name="foodItem" id="foodItemModal" value={editedInfo.foodItem || ''} onChange={handleChange} className={`${inputClass} pr-8`} />
                    <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <div>
                <label htmlFor="caloriesModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>Kalorier (kcal)</label>
                <div className="relative">
                    <input type="number" name="calories" id="caloriesModal" value={editedInfo.calories} onChange={handleChange} min="0" step="1" className={`${inputClass} pr-8`} />
                    <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                </div>
              </div>
              <div>
                <label htmlFor="proteinModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Protein">💪</span>Protein (g)</label>
                <div className="relative">
                    <input type="number" name="protein" id="proteinModal" value={editedInfo.protein} onChange={handleChange} min="0" step="1" className={`${inputClass} pr-8`} />
                    <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                </div>
              </div>
              <div>
                <label htmlFor="carbohydratesModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>Kolhydrater (g)</label>
                <div className="relative">
                    <input type="number" name="carbohydrates" id="carbohydratesModal" value={editedInfo.carbohydrates} onChange={handleChange} min="0" step="1" className={`${inputClass} pr-8`} />
                    <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                </div>
              </div>
              <div>
                <label htmlFor="fatModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>Fett (g)</label>
                <div className="relative">
                    <input type="number" name="fat" id="fatModal" value={editedInfo.fat} onChange={handleChange} min="0" step="1" className={`${inputClass} pr-8`} />
                    <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                </div>
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
        </div>

        {/* Footer - Fixed */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3.5 mt-4 pt-4 border-t border-neutral-light/50 flex-shrink-0">
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
            disabled={!selectedMealType}
            className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon className="w-5 h-5 inline mr-1.5" />
            Logga
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageAnalysisResultModal;
