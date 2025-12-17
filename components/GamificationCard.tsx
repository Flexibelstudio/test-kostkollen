
import React from 'react';
import { GoalSettings, UserProfileData, Level } from '../types';
import { LEVEL_DEFINITIONS } from '../constants';
import { TrophyIcon, LifebuoyIcon, ChevronDownIcon, FireIcon } from './icons';

interface GamificationCardProps {
  goals: GoalSettings;
  minSafeCalories: number;
  highestStreak: number;
  highestLevelId: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}

const GamificationCard: React.FC<GamificationCardProps> = ({
  goals,
  minSafeCalories,
  highestStreak,
  highestLevelId,
  isExpanded,
  onToggle
}) => {
  const highestLevelReached = highestLevelId 
    ? LEVEL_DEFINITIONS.find(level => level.id === highestLevelId) 
    : null;

  return (
    <section aria-labelledby="gamification-heading" className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-light">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center text-left"
        aria-expanded={isExpanded}
        aria-controls="gamification-content"
      >
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                <FireIcon className="w-6 h-6" />
            </div>
            <h3 id="gamification-heading" className="text-lg font-bold text-neutral-dark">
            Streak & Rekord
            </h3>
        </div>
        <ChevronDownIcon className={`w-5 h-5 text-neutral-dark transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      <div
        id="gamification-content"
        className={`overflow-hidden transition-[max-height,margin-top] duration-500 ease-in-out ${isExpanded ? 'max-h-96 mt-4' : 'max-h-0 mt-0'}`}
      >
        <div className="pt-2 border-t border-neutral-light/50 space-y-4">
            
            <div className="bg-neutral-light/30 p-3 rounded-xl">
                <p className="text-sm text-neutral-dark leading-snug">
                    <strong className="text-orange-600">Tips:</strong> Logga minst en måltid varje dag för att hålla din streak (🔥) vid liv!
                </p>
            </div>

            <div>
                <h4 className="text-sm font-bold text-neutral-dark mb-2 uppercase tracking-wide opacity-70">Dina personbästa</h4>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-neutral-light rounded-xl p-3 text-center shadow-sm">
                        <p className="text-xs text-neutral">Högsta streak</p>
                        <p className="text-lg font-extrabold text-orange-500">
                            {highestStreak} {highestStreak === 1 ? 'dag' : 'dagar'}
                        </p>
                    </div>
                    <div className="bg-white border border-neutral-light rounded-xl p-3 text-center shadow-sm">
                        <p className="text-xs text-neutral">Högsta nivå</p>
                        <p className="text-lg font-extrabold text-accent flex items-center justify-center gap-1">
                            {highestLevelReached ? (
                                <>
                                    <span>{highestLevelReached.icon}</span>
                                    <span>{highestLevelReached.name}</span>
                                </>
                            ) : '-'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </section>
  );
};

export default GamificationCard;
