
import React from 'react';
import { LEVEL_DEFINITIONS } from '../constants';
import { XMarkIcon, FireIcon, TrophyIcon } from './icons';

interface GamificationModalProps {
  show: boolean;
  onClose: () => void;
  currentStreak: number;
  highestStreak: number;
  highestLevelId: string | null;
}

const GamificationModal: React.FC<GamificationModalProps> = ({
  show,
  onClose,
  currentStreak,
  highestStreak,
  highestLevelId
}) => {
  if (!show) return null;

  const highestLevelReached = highestLevelId 
    ? LEVEL_DEFINITIONS.find(level => level.id === highestLevelId) 
    : null;

  // Calculate next level info if possible
  const currentLevelIndex = LEVEL_DEFINITIONS.findIndex(l => l.requiredStreak > currentStreak);
  const nextLevel = currentLevelIndex !== -1 ? LEVEL_DEFINITIONS[currentLevelIndex] : null;
  const daysToNextLevel = nextLevel ? nextLevel.requiredStreak - currentStreak : 0;

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gamification-modal-title"
    >
      <div
        className="bg-white dark:bg-neutral-darker p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in border border-transparent dark:border-neutral-light/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <TrophyIcon className="w-6 h-6" />
                </div>
                <h2 id="gamification-modal-title" className="text-2xl font-bold text-neutral-dark dark:text-white">
                    Streak & Rekord
                </h2>
            </div>
            <button
                onClick={onClose}
                className="p-2 text-neutral dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-90 interactive-transition"
                aria-label="Stäng"
            >
                <XMarkIcon className="w-6 h-6" />
            </button>
        </div>

        <div className="space-y-6">
            {/* Current Streak Hero */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-2xl border border-orange-200 dark:border-orange-500/30 text-center">
                <div className="flex justify-center mb-2">
                    <FireIcon className="w-12 h-12 text-orange-500 dark:text-orange-400 animate-pulse" />
                </div>
                <p className="text-sm font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider mb-1">Nuvarande Streak</p>
                <p className="text-5xl font-extrabold text-neutral-dark dark:text-white">
                    {currentStreak}
                </p>
                <p className="text-base text-neutral-dark dark:text-neutral-300 font-medium">{currentStreak === 1 ? 'dag' : 'dagar'} i rad</p>
                
                {nextLevel && (
                    <div className="mt-4 bg-white/60 dark:bg-black/20 p-2 rounded-lg text-sm text-orange-900 dark:text-orange-200">
                        Bara <strong>{daysToNextLevel}</strong> {daysToNextLevel === 1 ? 'dag' : 'dagar'} kvar till nivå: <span className="font-bold">{nextLevel.name}</span> {nextLevel.icon}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-neutral-dark border-2 border-neutral-light dark:border-neutral-light/10 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-xs font-semibold text-neutral dark:text-neutral-400 uppercase mb-1">Högsta streak</p>
                    <p className="text-2xl font-extrabold text-neutral-dark dark:text-white">
                        {highestStreak}
                    </p>
                    <p className="text-xs text-neutral-dark dark:text-neutral-300">{highestStreak === 1 ? 'dag' : 'dagar'}</p>
                </div>
                <div className="bg-white dark:bg-neutral-dark border-2 border-yellow-100 dark:border-yellow-900/30 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-xs font-semibold text-neutral dark:text-neutral-400 uppercase mb-1">Högsta nivå</p>
                    <p className="text-2xl font-extrabold text-accent dark:text-yellow-400 flex items-center justify-center gap-1">
                        {highestLevelReached ? (
                            <span>{highestLevelReached.icon}</span>
                        ) : '-'}
                    </p>
                    <p className="text-xs text-neutral-dark dark:text-neutral-300 truncate px-1">
                        {highestLevelReached ? highestLevelReached.name : 'Ingen nivå än'}
                    </p>
                </div>
            </div>
            
            <div className="bg-neutral-light/30 dark:bg-neutral-dark/50 p-4 rounded-xl border border-neutral-light dark:border-neutral-light/10">
                <p className="text-sm text-neutral-dark dark:text-neutral-300 leading-snug">
                    <strong className="text-primary-darker dark:text-primary-light">Tips:</strong> Din streak bygger på konsekvens. Logga minst en måltid varje dag för att hålla den vid liv!
                </p>
            </div>
        </div>
        
        <div className="mt-8 text-center">
             <button
                onClick={onClose}
                className="px-6 py-2.5 bg-neutral-light dark:bg-neutral-dark hover:bg-gray-200 dark:hover:bg-neutral-light/20 text-neutral-dark dark:text-white font-semibold rounded-lg transition-colors"
            >
                Stäng
            </button>
        </div>
      </div>
    </div>
  );
};

export default GamificationModal;
