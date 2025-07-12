import React from 'react';
import { GoalSettings, UserProfileData, Level } from '../types';
import { LEVEL_DEFINITIONS } from '../constants';
import { TrophyIcon } from './icons'; // Assuming TrophyIcon is in icons.tsx

interface GamificationCardProps {
  goals: GoalSettings;
  minSafeCalories: number;
  highestStreak: number;
  highestLevelId: string | null;
}

const GamificationCard: React.FC<GamificationCardProps> = ({
  goals,
  minSafeCalories,
  highestStreak,
  highestLevelId,
}) => {
  const highestLevelReached = highestLevelId 
    ? LEVEL_DEFINITIONS.find(level => level.id === highestLevelId) 
    : null;

  return (
    <section aria-labelledby="gamification-heading" className="mt-6 bg-white p-5 sm:p-6 rounded-xl shadow-soft-lg border border-neutral-light">
      <h3 id="gamification-heading" className="text-xl font-semibold text-neutral-dark mb-4">
        Streak-info & Rekord
      </h3>

      {/* Explanation of how to get a streak */}
      <div className="mb-5">
        <h4 className="text-lg font-medium text-neutral-dark mb-2">Hur streaks fungerar:</h4>
        <div className="flex items-start space-x-3">
          <span className="text-3xl" role="img" aria-label="Streak-ikon">🎯</span>
          <p className="text-sm text-neutral">
            För att bygga din streak: ät minst {minSafeCalories.toFixed(0)} kcal, och håll ditt effektiva intag (efter ev. användning av sparpott) under {goals.calorieGoal.toFixed(0)} kcal för dagen.
          </p>
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
    </section>
  );
};

export default GamificationCard;
