
import React from 'react';
import { IosShareIcon, XMarkIcon } from './icons.tsx';

interface IosInstallPromptProps {
  onClose: () => void;
}

const IosInstallPrompt: React.FC<IosInstallPromptProps> = ({ onClose }) => {
  return (
    <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 pt-6 shadow-[0_2px_10px_rgba(0,0,0,0.1)] z-[60] animate-slide-down-fade-in">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="App Logo" className="w-12 h-12 object-contain" />
          <div>
            <h3 className="font-bold text-neutral-dark">Installera Kostloggen</h3>
            <p className="text-sm text-neutral">
              Tryck på <IosShareIcon className="w-4 h-4 inline-block mx-1 align-text-bottom" /> och välj 'Lägg till på hemskärmen'.
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-neutral-light/70 flex-shrink-0" aria-label="Stäng installationsguide">
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default IosInstallPrompt;
