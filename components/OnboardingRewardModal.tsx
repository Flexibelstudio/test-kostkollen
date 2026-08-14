
import React from 'react';
import { TrophyIcon, FireIcon } from './icons';
import { GoalType } from '../types';

interface OnboardingRewardModalProps {
  show: boolean;
  onClose: () => void;
  goalType: GoalType;
}

const OnboardingRewardModal: React.FC<OnboardingRewardModalProps> = ({ show, onClose, goalType }) => {
  if (!show) return null;

  const isMuscleGain = goalType === 'gain_muscle';

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
        {isMuscleGain ? (
             <div className="w-24 h-24 bg-[#F6E2D9] rounded-full flex items-center justify-center mx-auto mb-4 text-[#D96E4A]">
                <FireIcon className="w-12 h-12" />
             </div>
        ) : (
            <TrophyIcon className="w-24 h-24 text-accent mx-auto mb-4" />
        )}
        
        <h2 id="onboarding-reward-title" className="text-3xl font-bold text-neutral-dark mb-3">
          {isMuscleGain ? "Snyggt jobbat – du är redo!" : "Snyggt jobbat! Du är redo!"}
        </h2>
        
        <p className="text-lg text-neutral-dark mb-6">
          Du har klarat av de första stegen och har nu koll på grunderna i appen.
        </p>

        {isMuscleGain ? (
            <div className="bg-[#F6E2D9] p-6 rounded-xl border border-[#D96E4A]/30 text-center mb-2">
                <p className="text-lg font-bold text-[#56524D] leading-relaxed">
                    "Du har nu full koll på verktygen. Nu lägger vi i högsta växeln för att bygga din styrka!"
                </p>
            </div>
        ) : (
            <div className="bg-primary-100/60 p-4 rounded-lg border border-primary-200 text-left">
                <h3 className="font-semibold text-primary-darker text-lg mb-2">Belöning: Sparpott-bonus! 🏦</h3>
                <p className="text-sm text-neutral-dark">
                    Som tack får du en startbonus på <strong>100 kcal</strong> i din Sparpott. Unna dig något gott i helgen!
                </p>
            </div>
        )}

        <button
          onClick={onClose}
          className={`w-full mt-8 px-6 py-3 text-white text-lg font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-50 active:scale-95 transform ${isMuscleGain ? 'bg-[#D96E4A] hover:bg-[#C05A38] focus:ring-[#D96E4A]' : 'bg-primary hover:bg-primary-darker focus:ring-primary'}`}
        >
          Grymt, kör igång!
        </button>
      </div>
    </div>
  );
};

export default OnboardingRewardModal;
