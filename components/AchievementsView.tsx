
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
  
  const getAchievementIcon = (achievement: Achievement, isUnlocked: boolean) => {
    const className = `w-6 h-6 ${isUnlocked ? 'text-amber-700' : 'text-gray-400'}`;
    
    if (achievement.type === 'course') return <BookOpenIcon className={className} />;
    if (achievement.type === 'goal') return <TrophyIcon className={className} />;

    const id = achievement.id;
    if (id.includes('30') || id.includes('60') || id.includes('90') || id.includes('month') || id.includes('kvartal')) {
        return <CalendarIcon className={className} />;
    }
    if (id.includes('50') || id.includes('150') || id.includes('250')) {
        return <MedalIcon className={className} />;
    }
    return <TrophyIcon className={className} />;
  };

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between px-1 mb-2">
            <h3 id="achievements-heading" className="text-xl font-bold text-neutral-dark">Samla Bragder</h3>
            <span className="text-xs font-medium text-neutral bg-neutral-light px-2 py-1 rounded-full">
                {Object.keys(unlockedAchievements).length} / {achievements.length}
            </span>
        </div>
        
        <div className="flex flex-col space-y-3">
          {achievements.map(ach => {
            const isUnlocked = !!unlockedAchievements[ach.id];

            return (
              <div 
                key={ach.id} 
                className={`flex flex-row items-center p-4 rounded-2xl border transition-all duration-200
                    ${isUnlocked 
                        ? 'bg-amber-50/50 border-amber-200 shadow-sm' 
                        : 'bg-white border-neutral-light opacity-70 grayscale'
                    }`}
              >
                {/* Icon Box */}
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 mr-4 shadow-sm
                    ${isUnlocked 
                        ? 'bg-amber-100' 
                        : 'bg-neutral-light' 
                    }`}
                >
                    {getAchievementIcon(ach, isUnlocked)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h4 className={`text-base font-bold truncate ${isUnlocked ? 'text-neutral-dark' : 'text-gray-500'}`}>
                            {ach.name}
                        </h4>
                        {isUnlocked && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md">
                                Klarad
                            </span>
                        )}
                    </div>
                    <p className="text-xs sm:text-sm text-neutral mt-0.5 leading-snug">
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
