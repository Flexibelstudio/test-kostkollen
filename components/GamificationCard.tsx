
import React from 'react';
import { Level } from '../types';
import { LEVEL_DEFINITIONS } from '../constants';
import { XMarkIcon, FireIcon } from './icons';

interface GamificationModalProps {
  show: boolean;
  onClose: () => void;
  highestStreak: number;
  highestLevelId: string | null;
}

const GamificationModal: React.FC<GamificationModalProps> = ({
  show,
  onClose,
  highestStreak,
  highestLevelId
}) => {
  if (!show) return null;

  const highestLevelReached = highestLevelId 
    ? LEVEL_DEFINITIONS.find(level => level.id === highestLevelId) 
    : null;

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gamification-modal-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F6E2D9] flex items-center justify-center text-[#D96E4A]">
                    <FireIcon className="w-6 h-6" />
                </div>
                <h2 id="gamification-modal-title" className="text-2xl font-bold text-neutral-dark">
                    Streak & Rekord
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

        <div className="space-y-6">
            <div className="bg-neutral-light/30 p-4 rounded-xl border border-neutral-light">
                <p className="text-sm text-neutral-dark leading-snug">
                    <strong className="text-[#D96E4A]">Kom ihåg:</strong> Din streak (🔥) är ett bevis på din konsekvens. Logga minst en måltid varje dag för att hålla den vid liv!
                </p>
            </div>

            <div>
                <h4 className="text-sm font-bold text-neutral-dark mb-3 uppercase tracking-wide opacity-70 text-center">Dina personbästa</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border-2 border-neutral-light rounded-2xl p-4 text-center shadow-sm">
                        <p className="text-xs font-semibold text-neutral uppercase mb-1">Högsta streak</p>
                        <p className="text-2xl font-extrabold text-[#D96E4A]">
                            {highestStreak}
                        </p>
                        <p className="text-xs text-neutral-dark">{highestStreak === 1 ? 'dag' : 'dagar'}</p>
                    </div>
                    <div className="bg-white border-2 border-neutral-light rounded-2xl p-4 text-center shadow-sm">
                        <p className="text-xs font-semibold text-neutral uppercase mb-1">Högsta nivå</p>
                        <p className="text-2xl font-extrabold text-accent flex items-center justify-center gap-1">
                            {highestLevelReached ? (
                                <span>{highestLevelReached.icon}</span>
                            ) : '-'}
                        </p>
                        <p className="text-xs text-neutral-dark truncate px-1">
                            {highestLevelReached ? highestLevelReached.name : 'Ingen nivå än'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
        
        <div className="mt-8 text-center">
             <button
                onClick={onClose}
                className="px-6 py-2.5 bg-neutral-light hover:bg-gray-200 text-neutral-dark font-semibold rounded-lg transition-colors"
            >
                Stäng
            </button>
        </div>
      </div>
    </div>
  );
};

export default GamificationModal;
