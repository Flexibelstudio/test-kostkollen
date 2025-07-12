import React from 'react';
import { Achievement, UserProfileData, TimelineEvent } from '../types';
import { LockClosedIcon, TrophyIcon, ShareIcon, HeartIcon } from './icons';
import { playAudio } from '../services/audioService';

interface AchievementsViewProps {
  userProfile: UserProfileData;
  achievements: Achievement[];
  unlockedAchievements: { [id: string]: string }; // id -> date string
  timelineEvents: TimelineEvent[];
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const PeppDisplay: React.FC<{ pepps: TimelineEvent['pepps'] }> = ({ pepps }) => {
    const peppEntries = Object.values(pepps || {});
    const peppCount = peppEntries.length;

    if (peppCount === 0) {
        return null;
    }

    const sortedPeppEntries = peppEntries.sort((a, b) => a.timestamp - b.timestamp);
    const names = sortedPeppEntries.map(p => p.name);
    
    let displayText = '';

    if (peppCount === 1) {
        displayText = names[0];
    } else if (peppCount === 2) {
        displayText = `${names[0]} och ${names[1]}`;
    } else {
        displayText = `${names[0]}, ${names[1]} och ${peppCount - 2} andra`;
    }

    return (
        <div className="flex items-center text-xs text-red-600 mt-1.5" title={names.join(', ')}>
            <HeartIcon className="w-4 h-4 inline-block mr-1 flex-shrink-0" />
            <span className="font-semibold">
                Peppad av <span className="font-bold">{displayText}</span>
            </span>
        </div>
    );
};


const AchievementsView: React.FC<AchievementsViewProps> = ({ userProfile, achievements, unlockedAchievements, timelineEvents, setToastNotification }) => {

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
        setToastNotification({ message: 'Delning avbröts eller misslyckades.', type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        setToastNotification({ message: 'Diplomet kopierades till urklipp!', type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        setToastNotification({ message: 'Kunde inte kopiera till urklipp.', type: 'error' });
         setTimeout(() => setToastNotification(null), 3000);
      }
    }
  };


  return (
    <div className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
      <div className="flex items-center mb-4">
        <TrophyIcon className="w-7 h-7 text-accent mr-3" />
        <h3 className="text-xl font-semibold text-neutral-dark">Dina Bragder</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map(ach => {
          const unlockedDate = unlockedAchievements[ach.id];
          const isUnlocked = !!unlockedDate;

          if (isUnlocked) {
            const event = timelineEvents.find(e => e.relatedDocId === ach.id && e.type === 'achievement');
            const pepps = event ? event.pepps : {};
            
            return (
              <div key={ach.id} className="relative group p-4 rounded-lg bg-[#fdfaf1] border-2 border-amber-500 shadow-lg flex flex-col text-center text-amber-900 font-serif">
                <div className="absolute inset-0 border-2 border-amber-300 m-1 rounded-md pointer-events-none"></div>
                <div className="relative z-10 w-full flex flex-col items-center h-full">
                  <h3 className="text-xl font-bold tracking-wider uppercase text-amber-800">Diplom</h3>
                  <p className="text-xs mt-2">Tilldelas stolt till</p>
                  <p className="text-lg font-semibold my-1 text-primary-darker">{userProfile.name || 'En Kämpe'}</p>
                  <div className="w-1/3 border-t border-amber-400 my-2"></div>
                  <p className="text-base font-bold my-1 text-balance">{ach.name} {ach.icon}</p>
                  <p className="text-xs italic px-2 my-2 text-balance flex-grow">"{ach.description}"</p>
                  <div className="mt-auto pt-2 w-full">
                    <div className="flex items-end justify-between">
                      <div className="text-left">
                        <TrophyIcon className="w-10 h-10 text-amber-600 opacity-80" />
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold">Datum</p>
                        <p className="text-xs">{new Date(unlockedDate).toLocaleDateString('sv-SE')}</p>
                      </div>
                    </div>
                     <PeppDisplay pepps={pepps} />
                  </div>
                </div>
                <button
                  onClick={() => handleShare(ach)}
                  className="absolute top-2 right-2 p-1.5 text-amber-800 hover:text-primary-darker rounded-full hover:bg-primary-100/50 active:scale-90 interactive-transition opacity-0 group-hover:opacity-100 focus:opacity-100 z-20"
                  aria-label="Dela diplom"
                  title="Dela diplom"
                >
                  <ShareIcon className="w-5 h-5" />
                </button>
              </div>
            );
          }

          return (
            <div key={ach.id} className={`relative group p-4 rounded-lg border-2 flex items-start space-x-4 transition-all duration-300 bg-neutral-light/50 border-gray-300`}>
              <div className={`text-4xl mt-1 opacity-30`}>{ach.icon}</div>
              <div className="flex-grow">
                <h4 className={`font-bold text-neutral`}>{ach.name}</h4>
                <p className={`text-sm text-neutral`}>{ach.description}</p>
                <div className="flex items-center text-xs text-neutral-dark opacity-60 mt-1">
                  <LockClosedIcon className="w-3 h-3 mr-1" />
                  <span>Låst</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AchievementsView;
