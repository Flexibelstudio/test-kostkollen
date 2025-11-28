
import React from 'react';
import { PastDaySummary } from '../types';
import { CheckCircleIcon, XCircleIcon, FireIcon, TrophyIcon } from './icons';

interface MorningReportModalProps {
  show: boolean;
  onClose: () => void;
  summary: PastDaySummary;
  currentStreak: number;
}

const MorningReportModal: React.FC<MorningReportModalProps> = ({ show, onClose, summary, currentStreak }) => {
  if (!show) return null;

  const isSuccess = summary.goalMet;
  const bankedAmount = summary.bankedAmount || 0;
  
  // Formatera datumet snyggt (t.ex. "Gårdagen", "Måndag 24 nov")
  const dateObj = new Date(summary.date);
  const dateString = dateObj.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div 
        className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-md flex items-center justify-center z-[80] p-4 animate-fade-in"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="morning-report-title"
    >
      <div 
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl text-center max-w-md w-full animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex justify-center">
            {isSuccess ? (
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="w-12 h-12 text-primary" />
                </div>
            ) : (
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
                    <div className="text-4xl">🌅</div>
                </div>
            )}
        </div>

        <h2 id="morning-report-title" className="text-2xl sm:text-3xl font-bold text-neutral-dark mb-2">
          {isSuccess ? "Snyggt jobbat!" : "Ny dag, nya tag!"}
        </h2>
        
        <p className="text-neutral-dark text-lg mb-6">
            Här är resultatet för <span className="font-medium capitalize">{dateString}</span>:
        </p>

        <div className="bg-neutral-light/50 rounded-xl p-4 mb-8 space-y-4 border border-neutral-light">
            {/* Streak Status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FireIcon className={`w-6 h-6 ${currentStreak > 0 ? 'text-secondary' : 'text-neutral'}`} />
                    <span className="font-medium text-neutral-dark">Din Streak</span>
                </div>
                <span className="text-xl font-bold text-neutral-dark">
                    {currentStreak} {currentStreak === 1 ? 'dag' : 'dagar'}
                </span>
            </div>

            {/* Bank Status (Only show if green day) */}
            {isSuccess && bankedAmount > 0 && (
                <div className="flex items-center justify-between pt-3 border-t border-neutral-light/60 animate-fade-in">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🏦</span>
                        <span className="font-medium text-neutral-dark">Till Sparpotten</span>
                    </div>
                    <span className="text-xl font-bold text-primary">
                        +{bankedAmount} kcal
                    </span>
                </div>
            )}
             
             {/* Status Text */}
            <div className="pt-3 border-t border-neutral-light/60 text-left">
                 {isSuccess ? (
                     <p className="text-sm text-primary-darker flex items-start">
                         <CheckCircleIcon className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" />
                         Du nådde ditt mål och dagen blev grön!
                     </p>
                 ) : (
                     <p className="text-sm text-neutral flex items-start">
                         <span className="mr-1.5 mt-0.5">💪</span>
                         Du nådde inte hela vägen igår, men idag är en ny chans att färga kalendern grön.
                     </p>
                 )}
            </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-6 py-3.5 bg-primary text-white text-lg font-semibold rounded-xl shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform transition-all"
        >
          Starta dagen! 🚀
        </button>
      </div>
    </div>
  );
};

export default MorningReportModal;
