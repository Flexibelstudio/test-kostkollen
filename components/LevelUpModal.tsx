import React from 'react';
import { Level } from '../types';
import { CheckCircleIcon, XMarkIcon } from './icons'; // Using CheckCircle as a generic celebration icon

interface LevelUpModalProps {
  level: Level;
  onClose: () => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ level, onClose }) => {
  if (!level) return null;

  return (
    <div 
        className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-fade-in"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-up-modal-title"
    >
      <div 
        className="bg-white p-8 rounded-xl shadow-soft-xl text-center max-w-md w-full animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-6xl mb-5" role="img" aria-label={level.name}>{level.icon || '🎉'}</div>
        <h2 id="level-up-modal-title" className="text-3xl font-bold text-neutral-dark mb-3">Nivå upp!</h2>
        <p className="text-xl text-neutral-dark mb-2">
          Grattis! Du har nått nivån:
        </p>
        <p className="text-3xl font-semibold text-accent mb-2">
          {level.name}
        </p>
        <p className="text-base text-neutral-dark mb-8">
          {level.description}
        </p>
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform"
        >
          Fortsätt Logga!
        </button>
      </div>
    </div>
  );
};

export default LevelUpModal;