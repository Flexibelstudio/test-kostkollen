

import React, { useRef } from 'react';
import { XMarkIcon, CameraIcon, UploadIcon, TrashIcon, SparklesIcon } from './icons';
import { playAudio } from '../services/audioService';

interface IngredientCaptureModalProps {
  show: boolean;
  onClose: () => void;
  onFindRecipes: (images: string[]) => void;
  openCameraModal: () => void;
  images: string[];
  onRemoveImage: (index: number) => void;
  onUploadImages: (files: FileList) => void;
}

const MAX_IMAGES = 5;

const IngredientCaptureModal: React.FC<IngredientCaptureModalProps> = ({ 
    show,
    onClose,
    onFindRecipes,
    openCameraModal,
    images,
    onRemoveImage,
    onUploadImages
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      onUploadImages(event.target.files);
      event.target.value = ''; // Reset file input
    }
  };

  const handleTriggerUpload = () => {
    playAudio('uiClick');
    fileInputRef.current?.click();
  };

  const handleFindRecipesClick = () => {
    if (images.length === 0) {
      alert("Vänligen lägg till minst en bild på dina ingredienser.");
      return;
    }
    onFindRecipes(images);
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[65] p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5 flex-shrink-0">
            <div className="flex items-center">
              <SparklesIcon className="w-7 h-7 text-primary mr-2.5" />
              <h2 id="ingredient-capture-modal-title" className="text-2xl font-semibold text-neutral-dark">
                Recept från Skafferiet
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

          <p className="text-neutral-dark mb-4 flex-shrink-0">
            Fota eller ladda upp bilder på ingredienser du har hemma (max {MAX_IMAGES} st), så hjälper AI:n dig med receptförslag! Tydliga bilder på enskilda ingredienser fungerar bäst.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-shrink-0">
            <button
              onClick={openCameraModal}
              className="flex-1 flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary-darker text-white rounded-lg shadow-sm active:scale-95 interactive-transition disabled:opacity-50"
              disabled={images.length >= MAX_IMAGES}
            >
              <CameraIcon className="w-5 h-5 mr-2" /> Ta Bild
            </button>
            <button
              onClick={handleTriggerUpload}
              className="flex-1 flex items-center justify-center px-4 py-2.5 bg-secondary hover:bg-secondary-darker text-white rounded-lg shadow-sm active:scale-95 interactive-transition disabled:opacity-50"
              disabled={images.length >= MAX_IMAGES}
            >
              <UploadIcon className="w-5 h-5 mr-2" /> Ladda Upp Bilder
            </button>
            <input
              type="file"
              multiple
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
            />
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar mb-5 min-h-[150px] bg-neutral-light p-3 rounded-lg">
            {images.length === 0 ? (
              <p className="text-neutral text-center py-10">Inga bilder valda ännu.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((imgDataUrl, index) => (
                  <div key={`ingredient-img-${index}`} className="relative group aspect-square">
                    <img src={imgDataUrl} alt={`Vald ingrediensbild ${index + 1}`} className="w-full h-full object-cover rounded-md shadow-sm" />
                    <button
                      onClick={() => onRemoveImage(index)}
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-700 active:scale-90 transition-opacity interactive-transition"
                      aria-label="Ta bort bild"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-auto flex-shrink-0">
            <button
              onClick={handleFindRecipesClick}
              disabled={images.length === 0}
              className="w-full px-5 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm active:scale-95 disabled:opacity-50 interactive-transition"
            >
              Hitta Recept ({images.length} bilder)
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default IngredientCaptureModal;