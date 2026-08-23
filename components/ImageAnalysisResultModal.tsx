
import React, { useState, useEffect } from 'react';
import { NutritionalInfo, MealType } from '../types.ts';
import { FireIcon, ProteinIcon, LeafIcon, CheckIcon, XMarkIcon, CameraIcon, PencilIcon } from './icons.tsx'; 
import MealTypeSelector from './MealTypeSelector';
import { recordModalRenderEnd, recordModalConfirm } from '../utils/photoPipelineProfiler.ts';
import { resolveUpdatedNutrients } from '../utils/nutritionTotals.ts';
import { Loader2, Sparkles } from 'lucide-react';

interface ImageAnalysisResultModalProps {
  show: boolean;
  analysisResult: NutritionalInfo | null;
  imageDataUrl: string | null;
  isLoading?: boolean;
  onLog: (editedInfo: NutritionalInfo, options: { saveAsCommon: boolean, mealType: MealType, portionMultiplier?: number }) => void; 
  onClose: () => void;
  defaultMealType?: MealType | null;
}

const ImageAnalysisResultModal: React.FC<ImageAnalysisResultModalProps> = ({ 
  show, 
  analysisResult, 
  imageDataUrl, 
  isLoading = false,
  onLog, 
  onClose, 
  defaultMealType = null 
}) => {
  const [editedFoodItem, setEditedFoodItem] = useState<string>('');
  const [editedCalories, setEditedCalories] = useState<string>('');
  const [editedProtein, setEditedProtein] = useState<string>('');
  const [editedCarbohydrates, setEditedCarbohydrates] = useState<string>('');
  const [editedFat, setEditedFat] = useState<string>('');
  const [saveAsCommon, setSaveAsCommon] = useState<boolean>(false); 
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(defaultMealType);
  const [portionMultiplier, setPortionMultiplier] = useState<string>('1');

  useEffect(() => {
    if (analysisResult) {
      setEditedFoodItem(analysisResult.foodItem || '');
      setEditedCalories(Math.round(analysisResult.calories || 0).toString());
      setEditedProtein(Math.round(analysisResult.protein || 0).toString());
      setEditedCarbohydrates(Math.round(analysisResult.carbohydrates || 0).toString());
      setEditedFat(Math.round(analysisResult.fat || 0).toString());
    } else {
      setEditedFoodItem('');
      setEditedCalories('');
      setEditedProtein('');
      setEditedCarbohydrates('');
      setEditedFat('');
    }
  }, [analysisResult]);

  useEffect(() => {
      if (show) {
        setSelectedMealType(defaultMealType);
        setSaveAsCommon(false);
        setPortionMultiplier('1');
      }
  }, [defaultMealType, show]);

  useEffect(() => {
    if (show && imageDataUrl) {
      // Steg 6: Registrera att modalen är renderad till DOM
      recordModalRenderEnd();
    }
  }, [show, imageDataUrl]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'foodItem') {
      setEditedFoodItem(value);
      return;
    }

    if (value === '') {
      if (name === 'calories') setEditedCalories('');
      else if (name === 'protein') setEditedProtein('');
      else if (name === 'carbohydrates') setEditedCarbohydrates('');
      else if (name === 'fat') setEditedFat('');
      return;
    }

    // Check if the value is a valid integer string
    if (/^\d+$/.test(value)) {
      if (name === 'calories') setEditedCalories(value);
      else if (name === 'protein') setEditedProtein(value);
      else if (name === 'carbohydrates') setEditedCarbohydrates(value);
      else if (name === 'fat') setEditedFat(value);
    }
  };

  const handleSubmit = () => {
    if (!selectedMealType || !analysisResult || isLoading) return;
    recordModalConfirm();
    const validatedInfo: NutritionalInfo = resolveUpdatedNutrients(analysisResult, {
      foodItem: editedFoodItem,
      calories: editedCalories,
      protein: editedProtein,
      carbohydrates: editedCarbohydrates,
      fat: editedFat,
    });
    const parsedMultiplier = parseFloat(portionMultiplier.replace(',', '.')) || 1;
    onLog(validatedInfo, { saveAsCommon, mealType: selectedMealType, portionMultiplier: parsedMultiplier }); 
    onClose(); // Close modal immediately after logging
  };

  if (!show || !imageDataUrl) return null;

  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed";
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
            <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-md shrink-0 bg-neutral-900">
                <img 
                    src={imageDataUrl} 
                    alt={editedFoodItem || "Analyserad bild"} 
                    className="w-full h-full object-cover"
                />
                {isLoading && (
                  <div className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px] flex items-center justify-center">
                    <div className="bg-neutral-900/90 border border-neutral-700 text-neutral-100 px-4 py-2 rounded-full flex items-center gap-2.5 shadow-xl text-xs font-semibold animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Analyserar maträtt och näringsvärden...</span>
                    </div>
                  </div>
                )}
            </div>
            
            {/* Meal Type Selector - Fullt interaktiv direkt */}
            <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass}>Måltidstyp</label>
                  {isLoading && (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                      ✓ Kan väljas direkt
                    </span>
                  )}
                </div>
                <MealTypeSelector selectedType={selectedMealType} onSelect={setSelectedMealType} />
                {!selectedMealType && <p className="text-xs text-red-500 mt-1">Välj måltidstyp för att logga.</p>}
            </div>

            {/* Portionsstorlek - Fullt interaktiv direkt */}
            <div>
                <label className={labelClass + " mb-1"}>Portionsstorlek (Antal)</label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={portionMultiplier} 
                        onChange={(e) => setPortionMultiplier(e.target.value)} 
                        className={`${inputClass} pr-8`} 
                        inputMode="decimal" 
                        placeholder="1"
                    />
                    <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                </div>
                <p className="text-xs text-neutral-500 mt-1.5 ml-1">Tips: Du kan skriva t.ex. 0.5 eller 1.5 för att justera portionen.</p>
            </div>

            {/* Identifierat livsmedel */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="foodItemModal" className={labelClass}>Identifierat livsmedel</label>
                {isLoading && (
                  <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin inline" /> Identifierar...
                  </span>
                )}
              </div>
              <div className="relative">
                {isLoading ? (
                  <div className="h-10 w-full bg-neutral-100 rounded-md animate-pulse border border-neutral-200 flex items-center px-3 text-sm text-neutral-400">
                    Väntar på AI-analys...
                  </div>
                ) : (
                  <>
                    <input type="text" name="foodItem" id="foodItemModal" value={editedFoodItem} onChange={handleChange} className={`${inputClass} pr-8`} />
                    <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                  </>
                )}
              </div>
            </div>
            
            {/* Näringsvärden - Laddningsplatshållare eller fält */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <div>
                <label htmlFor="caloriesModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>Kalorier (kcal)</label>
                <div className="relative">
                  {isLoading ? (
                    <div className="h-10 w-full bg-neutral-100 rounded-md animate-pulse border border-neutral-200 flex items-center px-3 text-xs text-neutral-400">
                      Beräknar...
                    </div>
                  ) : (
                    <>
                      <input type="number" name="calories" id="caloriesModal" value={editedCalories} onChange={handleChange} min="0" step="1" className={`${inputClass} pr-8`} />
                      <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                    </>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="proteinModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Protein">💪</span>Protein (g)</label>
                <div className="relative">
                  {isLoading ? (
                    <div className="h-10 w-full bg-neutral-100 rounded-md animate-pulse border border-neutral-200 flex items-center px-3 text-xs text-neutral-400">
                      Beräknar...
                    </div>
                  ) : (
                    <>
                      <input type="number" name="protein" id="proteinModal" value={editedProtein} onChange={handleChange} min="0" step="1" className={`${inputClass} pr-8`} />
                      <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                    </>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="carbohydratesModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>Kolhydrater (g)</label>
                <div className="relative">
                  {isLoading ? (
                    <div className="h-10 w-full bg-neutral-100 rounded-md animate-pulse border border-neutral-200 flex items-center px-3 text-xs text-neutral-400">
                      Beräknar...
                    </div>
                  ) : (
                    <>
                      <input type="number" name="carbohydrates" id="carbohydratesModal" value={editedCarbohydrates} onChange={handleChange} min="0" step="1" className={`${inputClass} pr-8`} />
                      <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                    </>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="fatModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>Fett (g)</label>
                <div className="relative">
                  {isLoading ? (
                    <div className="h-10 w-full bg-neutral-100 rounded-md animate-pulse border border-neutral-200 flex items-center px-3 text-xs text-neutral-400">
                      Beräknar...
                    </div>
                  ) : (
                    <>
                      <input type="number" name="fat" id="fatModal" value={editedFat} onChange={handleChange} min="0" step="1" className={`${inputClass} pr-8`} />
                      <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                    </>
                  )}
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
            disabled={!selectedMealType || isLoading || !analysisResult}
            className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analyserar måltid...</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                <span>Logga</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageAnalysisResultModal;

