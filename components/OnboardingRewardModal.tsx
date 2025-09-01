import React from 'react';
import { TrophyIcon } from './icons';

interface OnboardingRewardModalProps {
  show: boolean;
  onClose: () => void;
}

const OnboardingRewardModal: React.FC<OnboardingRewardModalProps> = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-reward-title"
    >
      <div
        className="bg-white p-8 rounded-xl shadow-soft-xl text-center max-w-md w-full animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <TrophyIcon className="w-24 h-24 text-accent mx-auto mb-4" />
        <h2 id="onboarding-reward-title" className="text-3xl font-bold text-neutral-dark mb-3">
          Snyggt jobbat! Du är redo!
        </h2>
        <p className="text-lg text-neutral-dark mb-4">
          Du har klarat av de första stegen och har nu koll på grunderna i appen.
        </p>
        <div className="bg-primary-100/60 p-4 rounded-lg border border-primary-200 text-left">
            <h3 className="font-semibold text-primary-darker text-lg mb-2">Belöning: Sparpott-bonus! 🏦</h3>
            <p className="text-sm text-neutral-dark">
                Som tack får du en startbonus på <strong>100 kcal</strong> i din Sparpott. Sparpotten är en veckovis pott där du samlar kalorier du har 'över' på bra dagar, som du sedan kan använda när du vill unna dig något extra.
            </p>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-8 px-6 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform"
        >
          Grymt, kör igång!
        </button>
      </div>
    </div>
  );
};

export default OnboardingRewardModal;
