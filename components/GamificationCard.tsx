import React from 'react';
import { GoalSettings, UserProfileData, Level, StreakSaver } from '../types';
import { LEVEL_DEFINITIONS } from '../constants';
import { TrophyIcon, LifebuoyIcon, ChevronDownIcon } from './icons';

interface GamificationCardProps {
  goals: GoalSettings;
  minSafeCalories: number;
  highestStreak: number;
  highestLevelId: string | null;
  streakSaver: StreakSaver | null;
  isExpanded: boolean;
  onToggle: () => void;
}

const GamificationCard: React.FC<GamificationCardProps> = ({
  goals,
  minSafeCalories,
  highestStreak,
  highestLevelId,
  streakSaver,
  isExpanded,
  onToggle
}) => {
  const highestLevelReached = highestLevelId 
    ? LEVEL_DEFINITIONS.find(level => level.id === highestLevelId) 
    : null;

  return (
    <section aria-labelledby="gamification-heading" className="bg-white p-5 sm:p-6 rounded-xl shadow-soft-lg border border-neutral-light">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center text-left"
        aria-expanded={isExpanded}
        aria-controls="gamification-content"
      >
        <h3 id="gamification-heading" className="text-xl font-semibold text-neutral-dark">
          Streak-info & Rekord
        </h3>
        <ChevronDownIcon className={`w-6 h-6 text-neutral-dark transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      <div
        id="gamification-content"
        className={`overflow-hidden transition-[max-height,margin-top] duration-500 ease-in-out ${isExpanded ? 'max-h-96 mt-4' : 'max-h-0 mt-0'}`}
      >
        {/* Explanation of how to get a streak */}
        <div className="mb-5 space-y-4">
          <div>
              <h4 className="text-lg font-medium text-neutral-dark mb-2">Hur streaks fungerar:</h4>
              <div className="flex items-start space-x-3">
              <span className="text-3xl" role="img" aria-label="Streak-ikon">🔥</span>
              <p className="text-sm text-neutral">
                  För att bygga din streak (🔥), logga minst en måltid varje dag. Kalenderdagarna blir gröna när du håller dig inom ditt kaloriintervall.
              </p>
              </div>
          </div>
           <div>
              <h4 className="text-lg font-medium text-neutral-dark mb-2">Veckans Streakräddare</h4>
              <div className="flex items-start space-x-3">
              <LifebuoyIcon className="w-8 h-8 text-secondary flex-shrink-0" />
              <p className="text-sm text-neutral">
                  Varje måndag får du en ny 'Streakräddare'. Om du misslyckas med en dag kan du dagen efter använda den för att reparera din streak och fortsätta din resa utan avbrott! 
                  <br/>
                  Status: {streakSaver?.available ? (
                      <span className="font-bold text-primary">Tillgänglig</span>
                  ) : (
                      <span className="font-bold text-neutral">Använd</span>
                  )}
              </p>
              </div>
          </div>
        </div>

        {/* Dina rekord */}
        <div className="pt-4 border-t border-neutral-light/50">
          <h4 className="text-lg font-medium text-neutral-dark mb-2">Dina rekord:</h4>
          <div className="flex items-start space-x-3">
            <TrophyIcon className="w-8 h-8 text-accent flex-shrink-0 mt-1" />
            <div>
              {(highestStreak > 0 || highestLevelReached) ? (
                <>
                  {highestStreak > 0 && (
                    <p className="text-base text-neutral-dark">
                      Högsta streak: <strong className="font-semibold">{highestStreak} {highestStreak === 1 ? 'dag' : 'dagar'}</strong>
                    </p>
                  )}
                  {highestLevelReached && (
                    <p className="text-base text-neutral-dark">
                      Högsta nivå: <strong className="font-semibold">{highestLevelReached.name}</strong> {highestLevelReached.icon}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-base text-neutral">Inga rekord satta ännu. Fortsätt kämpa!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GamificationCard;