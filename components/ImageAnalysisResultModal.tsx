
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
  const [editedInfo, setEditedInfo] = useState<NutritionalInfo>(analysisResult);
  const [saveAsCommon, setSaveAsCommon] = useState<boolean>(false); 

  useEffect(() => {
    setEditedInfo({
        ...analysisResult,
        calories: Math.round(analysisResult.calories || 0),
        protein: Math.round(analysisResult.protein || 0),
        carbohydrates: Math.round(analysisResult.carbohydrates || 0),
        fat: Math.round(analysisResult.fat || 0),
    });
    setSaveAsCommon(false); 
  }, [analysisResult]);

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
    playAudio('uiClick');
    const validatedInfo: NutritionalInfo = {
        ...editedInfo,
        calories: editedInfo.calories || 0,
        protein: editedInfo.protein || 0,
        carbohydrates: editedInfo.carbohydrates || 0,
        fat: editedInfo.fat || 0,
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
                alt={editedInfo.foodItem || "Analyserad bild"} 
                className="w-full h-full object-cover"
            />
        </div>
        
        <div>
          <label htmlFor="foodItemModal" className={labelClass}>Identifierat livsmedel</label>
          <input type="text" name="foodItem" id="foodItemModal" value={editedInfo.foodItem || ''} onChange={handleChange} className={inputClass} />
        </div>
        
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <div>
            <label htmlFor="caloriesModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>Kalorier (kcal)</label>
            <input type="number" name="calories" id="caloriesModal" value={editedInfo.calories} onChange={handleChange} min="0" step="1" className={inputClass} />
          </div>
          <div>
            <label htmlFor="proteinModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Protein">💪</span>Protein (g)</label>
            <input type="number" name="protein" id="proteinModal" value={editedInfo.protein} onChange={handleChange} min="0" step="1" className={inputClass} />
          </div>
          <div>
            <label htmlFor="carbohydratesModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>Kolhydrater (g)</label>
            <input type="number" name="carbohydrates" id="carbohydratesModal" value={editedInfo.carbohydrates} onChange={handleChange} min="0" step="1" className={inputClass} />
          </div>
          <div>
            <label htmlFor="fatModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>Fett (g)</label>
            <input type="number" name="fat" id="fatModal" value={editedInfo.fat} onChange={handleChange} min="0" step="1" className={inputClass} />
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

      <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-3.5 space-y-3 sm:space-y-0">
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
          Logga måltid
        </button>
      </div>
    </div>
  );
};

export default ImageAnalysisResultModal;
