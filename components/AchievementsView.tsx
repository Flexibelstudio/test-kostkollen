
import React from 'react';
import { Achievement, UserProfileData, Reactions } from '../types';
import { TrophyIcon, FireIcon, BookOpenIcon, LockClosedIcon, CalendarIcon, MedalIcon } from './icons';

interface AchievementsViewProps {
  userProfile: UserProfileData;
  achievements: Achievement[];
  unlockedAchievements: { [id: string]: string }; // id -> date string
  achievementInteractions: { [id: string]: { reactions: Reactions } };
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const AchievementsView: React.FC<AchievementsViewProps> = ({ 
    achievements, unlockedAchievements 
}) => {
  
  // Helper to choose the right SVG icon based on achievement ID and Type
  const getAchievementIcon = (achievement: Achievement, isUnlocked: boolean) => {
    const className = `w-8 h-8 ${isUnlocked ? 'text-amber-600' : 'text-gray-400'}`;
    
    if (achievement.type === 'course') {
        return <BookOpenIcon className={className} />;
    }
    
    if (achievement.type === 'goal') {
        return <TrophyIcon className={className} />;
    }

    const id = achievement.id;

    // Calendar icons for time periods (Month, Quarter, Year)
    if (id.includes('30') || id.includes('60') || id.includes('90') || id.includes('month') || id.includes('kvartal')) {
        return <CalendarIcon className={className} />;
    }

    // Medal icons for mid-tier milestones
    if (id.includes('50') || id.includes('150') || id.includes('250')) {
        return <MedalIcon className={className} />;
    }

    // Trophy icons for big milestones
    if (id.includes('100') || id.includes('365') || id.includes('500') || id.includes('1000') || id.includes('730')) {
        return <TrophyIcon className={className} />;
    }

    // Default to Trophy for small streaks (10, 20 etc) to match user preference
    return <TrophyIcon className={className} />;
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
            <h3 id="achievements-heading" className="text-2xl font-bold text-neutral-dark">Dina bragder</h3>
        </div>
        
        <div className="flex flex-col space-y-3">
          {achievements.map(ach => {
            const isUnlocked = !!unlockedAchievements[ach.id];

            return (
              <div 
                key={ach.id} 
                className="flex flex-row items-start p-4 bg-white rounded-2xl border border-neutral-light shadow-sm"
              >
                {/* Icon Box */}
                <div className={`h-16 w-16 rounded-xl flex items-center justify-center flex-shrink-0 
                    ${isUnlocked 
                        ? 'bg-[#FDE6CA]' // Beige/Gold background for unlocked
                        : 'bg-neutral-light' // Gray background for locked
                    }`}
                >
                    {getAchievementIcon(ach, isUnlocked)}
                </div>

                {/* Content */}
                <div className="ml-4 flex-1 min-w-0 flex flex-col justify-center h-full py-0.5">
                    {/* Status Label */}
                    <span className={`text-xs font-bold uppercase tracking-wide mb-1
                        ${isUnlocked 
                            ? 'text-teal-600' 
                            : 'text-neutral'
                        }`}
                    >
                        {isUnlocked ? 'Uppnådd' : 'Ej uppnådd'}
                    </span>

                    {/* Title */}
                    <h4 className={`text-base font-bold truncate mb-0.5 ${isUnlocked ? 'text-neutral-dark' : 'text-gray-500'}`}>
                        {ach.name}
                    </h4>
                    
                    {/* Description */}
                    <p className="text-sm text-neutral leading-snug line-clamp-2">
                        {ach.description}
                    </p>
                </div>
              </div>
            );
          })}
        </div>
    </div>
  );
};

export default AchievementsView;
