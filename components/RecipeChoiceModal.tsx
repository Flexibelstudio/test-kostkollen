        
import React from 'react';
import { SearchIcon, CameraIcon, UploadIcon, XMarkIcon, RecipeIcon } from './icons';

interface RecipeChoiceModalProps {
  show: boolean;
  onClose: () => void;
  onChooseSearch: () => void;
  onChooseTakePhoto: () => void;
  onChooseUpload: () => void;
}

const RecipeChoiceModal: React.FC<RecipeChoiceModalProps> = ({
  show,
  onClose,
  onChooseSearch,
  onChooseTakePhoto,
  onChooseUpload,
}) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-choice-title"
    >
      <div
        className="bg-white p-6 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
                <RecipeIcon className="w-7 h-7 text-purple-600" />
                <h2 id="recipe-choice-title" className="text-2xl font-semibold text-neutral-dark">
                    Hitta Recept
                </h2>
            </div>
            <button
                onClick={onClose}
                className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 transition-transform"
                aria-label="Stäng"
            >
                <XMarkIcon className="w-6 h-6" />
            </button>
        </div>

        <p className="text-neutral-dark mb-6">
            Hur vill du hitta ditt recept idag?
        </p>

        <div className="space-y-3">
          <button
            onClick={onChooseSearch}
            className="w-full flex items-center p-4 bg-white border-2 border-neutral-light hover:border-purple-300 hover:bg-purple-50 rounded-xl transition-all group shadow-sm active:scale-[0.98]"
          >
            <div className="p-3 bg-purple-100 text-purple-600 rounded-full mr-4 group-hover:bg-purple-200 transition-colors">
              <SearchIcon className="w-6 h-6" />
            </div>
            <div className="text-left">
              <span className="block font-semibold text-neutral-dark group-hover:text-purple-900">Sök på namn</span>
              <span className="text-sm text-neutral">T.ex. "Kycklingpasta"</span>
            </div>
          </button>

          <button
            onClick={onChooseTakePhoto}
            className="w-full flex items-center p-4 bg-white border-2 border-neutral-light hover:border-blue-300 hover:bg-blue-50 rounded-xl transition-all group shadow-sm active:scale-[0.98]"
          >
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full mr-4 group-hover:bg-blue-200 transition-colors">
              <CameraIcon className="w-6 h-6" />
            </div>
            <div className="text-left">
              <span className="block font-semibold text-neutral-dark group-hover:text-blue-900">Fota ingredienser</span>
              <span className="text-sm text-neutral">Få förslag baserat på vad du har</span>
            </div>
          </button>
          
           <button
            onClick={onChooseUpload}
            className="w-full flex items-center p-4 bg-white border-2 border-neutral-light hover:border-green-300 hover:bg-green-50 rounded-xl transition-all group shadow-sm active:scale-[0.98]"
          >
            <div className="p-3 bg-green-100 text-green-600 rounded-full mr-4 group-hover:bg-green-200 transition-colors">
              <UploadIcon className="w-6 h-6" />
            </div>
            <div className="text-left">
              <span className="block font-semibold text-neutral-dark group-hover:text-green-900">Ladda upp bilder</span>
              <span className="text-sm text-neutral">Använd bilder från ditt galleri</span>
            </div>
          </button>
        </div>
        
        <div className="mt-6 text-center">
            <button onClick={onClose} className="text-neutral hover:text-neutral-dark font-medium text-sm">
                Avbryt
            </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeChoiceModal;
