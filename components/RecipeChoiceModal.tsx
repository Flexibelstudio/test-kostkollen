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
    onChooseUpload 
}) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-choice-modal-title"
    >
      <div
        className="bg-white p-6 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <RecipeIcon className="w-7 h-7 text-primary mr-2.5" />
            <h2 id="recipe-choice-modal-title" className="text-2xl font-semibold text-neutral-dark">
              Hitta Recept
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
            aria-label="Stäng"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={onChooseSearch}
            className="w-full flex items-center p-4 bg-neutral-light/50 hover:bg-neutral-light border border-transparent hover:border-primary/30 rounded-xl transition-all group"
          >
            <div className="bg-white p-3 rounded-full shadow-sm mr-4 group-hover:scale-110 transition-transform">
              <SearchIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-neutral-dark">Sök på namn</h3>
              <p className="text-sm text-neutral">T.ex. "Kycklinggryta" eller "Pannkakor"</p>
            </div>
          </button>

          <button
            onClick={onChooseTakePhoto}
            className="w-full flex items-center p-4 bg-neutral-light/50 hover:bg-neutral-light border border-transparent hover:border-primary/30 rounded-xl transition-all group"
          >
            <div className="bg-white p-3 rounded-full shadow-sm mr-4 group-hover:scale-110 transition-transform">
              <CameraIcon className="w-6 h-6 text-secondary" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-neutral-dark">Fota ingredienser</h3>
              <p className="text-sm text-neutral">Låt AI:n föreslå recept baserat på vad du har</p>
            </div>
          </button>

          <button
            onClick={onChooseUpload}
            className="w-full flex items-center p-4 bg-neutral-light/50 hover:bg-neutral-light border border-transparent hover:border-primary/30 rounded-xl transition-all group"
          >
            <div className="bg-white p-3 rounded-full shadow-sm mr-4 group-hover:scale-110 transition-transform">
              <UploadIcon className="w-6 h-6 text-accent" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-neutral-dark">Ladda upp bilder</h3>
              <p className="text-sm text-neutral">Välj bilder från ditt galleri</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeChoiceModal;