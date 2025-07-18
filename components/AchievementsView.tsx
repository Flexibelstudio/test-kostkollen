import React, { useState, useEffect } from 'react';
import { Achievement, UserProfileData, TimelineEvent } from '../types';
import { LockClosedIcon, TrophyIcon, ShareIcon, HeartIcon, XMarkIcon, CheckCircleIcon } from './icons';
import { playAudio } from '../services/audioService';
import { auth } from '../firebase';
import { fetchAchievementInteractions } from '../services/firestoreService';

interface AchievementsViewProps {
  userProfile: UserProfileData;
  achievements: Achievement[];
  unlockedAchievements: { [id: string]: string }; // id -> date string
  timelineEvents: TimelineEvent[]; // This is no longer directly used but kept for prop consistency
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

// Internal component for the Diploma view inside the modal
const DiplomaView: React.FC<{
  achievement: Achievement;
  unlockedDate: string;
  userProfile: UserProfileData;
  onShare: (achievement: Achievement) => void;
  interactions: { pepps?: { [uid: string]: { name: string } } } | undefined;
}> = ({ achievement, unlockedDate, userProfile, onShare, interactions }) => {
    const peppCount = interactions?.pepps ? Object.keys(interactions.pepps).length : 0;
    const peppedBy = interactions?.pepps ? Object.values(interactions.pepps).map(p => p.name) : [];

    return (
  <div className="relative group p-4 rounded-lg bg-[#fdfaf1] border-2 border-amber-500 shadow-lg flex flex-col text-center text-amber-900 font-serif">
    <div className="absolute inset-0 border-2 border-amber-300 m-1 rounded-md pointer-events-none"></div>
    <div className="relative z-10 w-full flex flex-col items-center h-full">
      <h3 className="text-xl font-bold tracking-wider uppercase text-amber-800">Diplom</h3>
      <p className="text-xs mt-2">Tilldelas stolt till</p>
      <p className="text-lg font-semibold my-1 text-primary-darker">{userProfile.name || 'En Kämpe'}</p>
      <div className="w-1/3 border-t border-amber-400 my-2"></div>
      <p className="text-base font-bold my-1 text-balance">{achievement.name} {achievement.icon}</p>
      <p className="text-xs italic px-2 my-2 text-balance flex-grow">"{achievement.description}"</p>
      <div className="mt-auto pt-2 w-full">
        <div className="flex items-end justify-between">
            <div className="text-left">
                {peppCount > 0 ? (
                     <div className="relative group/pepp">
                        <div className="flex items-center gap-1 text-red-600 cursor-default">
                            <HeartIcon className="w-6 h-6"/>
                            <span className="font-bold text-base">{peppCount}</span>
                        </div>
                        {peppedBy.length > 0 && (
                            <div className="absolute bottom-full left-0 mb-2 w-max p-2 bg-neutral-dark text-white text-xs rounded-md opacity-0 group-hover/pepp:opacity-100 transition-opacity pointer-events-none z-20">
                                Peppad av: {peppedBy.join(', ')}
                            </div>
                        )}
                    </div>
                ) : (
                    <TrophyIcon className="w-10 h-10 text-amber-600 opacity-80" />
                )}
            </div>
          <div className="text-right">
            <p className="text-xs font-semibold">Datum</p>
            <p className="text-xs">{new Date(unlockedDate).toLocaleDateString('sv-SE')}</p>
          </div>
        </div>
      </div>
    </div>
    <button
      onClick={() => onShare(achievement)}
      className="absolute top-2 right-2 p-1.5 text-amber-800 hover:text-primary-darker rounded-full hover:bg-primary-100/50 active:scale-90 interactive-transition z-20"
      aria-label="Dela diplom"
      title="Dela diplom"
    >
      <ShareIcon className="w-5 h-5" />
    </button>
  </div>
)};

const AchievementsView: React.FC<AchievementsViewProps> = ({ userProfile, achievements, unlockedAchievements, setToastNotification }) => {
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [interactions, setInteractions] = useState<{ [id: string]: { pepps: { [uid: string]: { name: string } } } }>({});
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(true);

  useEffect(() => {
    const fetchInteractions = async () => {
      if (!auth.currentUser) return;
      setIsLoadingInteractions(true);
      try {
        const fetchedInteractions = await fetchAchievementInteractions(auth.currentUser.uid);
        setInteractions(fetchedInteractions);
      } catch (err) {
        console.error("Failed to fetch achievement interactions:", err);
      } finally {
        setIsLoadingInteractions(false);
      }
    };

    fetchInteractions();
  }, []);

  const handleShare = async (achievement: Achievement) => {
    playAudio('uiClick');
    const shareText = `Jag har tilldelats diplomet "${achievement.name}" i Kostloggen.se! ${achievement.icon}\n\n${achievement.description}\n\nFölj med mig på min hälsoresa! #kostloggen`;
    const shareData = {
      title: 'Ny Bragd Upplåst!',
      text: shareText,
      url: 'https://kostloggen.se'
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setToastNotification({ message: 'Diplomet kopierades till urklipp!', type: 'success' });
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        setToastNotification({ message: 'Kunde inte kopiera till urklipp.', type: 'error' });
      } finally {
        setTimeout(() => setToastNotification(null), 3000);
      }
    }
  };

  const unlockedCount = Object.keys(unlockedAchievements).length;

  return (
    <>
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
        <div className="flex items-center mb-4">
          <TrophyIcon className="w-7 h-7 text-accent mr-3" />
          <div>
            <h3 className="text-xl font-semibold text-neutral-dark">Dina Bragder</h3>
            <p className="text-sm text-neutral">{unlockedCount} av {achievements.length} upplåsta</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {achievements.map(ach => {
            const unlockedDate = unlockedAchievements[ach.id];
            const isUnlocked = !!unlockedDate;
            const interactionData = interactions[ach.id];
            const peppCount = interactionData?.pepps ? Object.keys(interactionData.pepps).length : 0;

            return (
              <button
                key={ach.id}
                onClick={() => setSelectedAchievement(ach)}
                disabled={!isUnlocked}
                className={`relative group p-4 rounded-lg border-2 flex flex-col items-center justify-center text-center aspect-square transition-all duration-300
                  ${isUnlocked
                    ? 'bg-amber-50 border-amber-300 hover:shadow-lg hover:border-amber-400 hover:scale-105 cursor-pointer'
                    : 'bg-neutral-light/60 border-gray-300 filter grayscale cursor-not-allowed'
                  }`
                }
              >
                <div className={`text-4xl sm:text-5xl transition-transform duration-300 ${isUnlocked ? '' : 'group-hover:scale-110'}`}>{ach.icon}</div>
                <h4 className={`mt-2 text-xs sm:text-sm font-semibold transition-colors ${isUnlocked ? 'text-amber-800' : 'text-neutral-dark'}`}>
                  {ach.name}
                </h4>
                {isUnlocked && peppCount > 0 && !isLoadingInteractions && (
                  <div className="absolute bottom-1 right-1 flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-xs shadow">
                      <HeartIcon className="w-3 h-3 text-red-500" />
                      <span className="font-bold text-red-600">{peppCount}</span>
                  </div>
                )}
                {!isUnlocked && (
                    <div className="absolute inset-0 bg-neutral-light/50 flex items-center justify-center rounded-lg">
                        <LockClosedIcon className="w-8 h-8 text-neutral opacity-50"/>
                    </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {selectedAchievement && unlockedAchievements[selectedAchievement.id] && (
        <div
          className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in"
          onClick={() => setSelectedAchievement(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-neutral-dark flex items-center">
                {selectedAchievement.icon}
                <span className="ml-2">{selectedAchievement.name}</span>
              </h2>
              <button onClick={() => setSelectedAchievement(null)} className="p-2 text-neutral hover:text-red-500 rounded-full active:scale-90">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <DiplomaView
              achievement={selectedAchievement}
              unlockedDate={unlockedAchievements[selectedAchievement.id]}
              userProfile={userProfile}
              onShare={handleShare}
              interactions={isLoadingInteractions ? undefined : interactions[selectedAchievement.id]}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AchievementsView;