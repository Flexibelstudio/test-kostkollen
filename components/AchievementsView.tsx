

import React, { useState, useEffect, useRef } from 'react';
import { Achievement, UserProfileData, TimelineEvent, Reactions, CompletedGoal } from '../types';
import { LockClosedIcon, TrophyIcon, ShareIcon, HeartIcon, XMarkIcon, CheckCircleIcon } from './icons';
import { playAudio } from '../services/audioService';
import { auth } from '../firebase';

interface AchievementsViewProps {
  userProfile: UserProfileData;
  achievements: Achievement[];
  unlockedAchievements: { [id: string]: string }; // id -> date string
  achievementInteractions: { [id: string]: { reactions: Reactions } };
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

// Internal component for the Diploma view inside the modal
const DiplomaView: React.FC<{
  achievement: Achievement;
  unlockedDate: string;
  userProfile: UserProfileData;
  onClose: () => void;
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  latestCompletedGoal?: CompletedGoal | null;
}> = ({ achievement, unlockedDate, userProfile, latestCompletedGoal, onClose, setToastNotification }) => {
    const diplomaRef = useRef<HTMLDivElement>(null);
    const [isSharing, setIsSharing] = useState(false);

    const isDynamicDiploma = achievement.id === 'main_goal_reached' && latestCompletedGoal;
    const diplomaDescription = isDynamicDiploma ? latestCompletedGoal.description : achievement.description;
    const diplomaDate = isDynamicDiploma ? latestCompletedGoal.achievedOn : unlockedDate;


    const handleShareDiploma = async () => {
        if (!diplomaRef.current || isSharing) return;
        playAudio('uiClick');
        setIsSharing(true);

        try {
            const diplomaEl = diplomaRef.current;
            const scale = 2; // Render at 2x resolution for better quality
            const canvas = document.createElement('canvas');
            canvas.width = diplomaEl.offsetWidth * scale;
            canvas.height = diplomaEl.offsetHeight * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');
            
            ctx.scale(scale, scale);

            // 1. Draw Background
            const gradient = ctx.createLinearGradient(0, 0, diplomaEl.offsetWidth, diplomaEl.offsetHeight);
            gradient.addColorStop(0, '#fffbeb'); // from-amber-50
            gradient.addColorStop(1, '#fef3c7'); // to-yellow-100
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, diplomaEl.offsetWidth, diplomaEl.offsetHeight);

            // 2. Draw Border
            ctx.strokeStyle = '#fcd34d'; // border-amber-300
            ctx.lineWidth = 8; // was 4 in tailwind, but scaling makes it thicker
            ctx.strokeRect(ctx.lineWidth/2, ctx.lineWidth/2, diplomaEl.offsetWidth - ctx.lineWidth, diplomaEl.offsetHeight - ctx.lineWidth);

            const diplomaRect = diplomaEl.getBoundingClientRect();
            
            // 3. Draw all text elements and icons
            const elementsToDraw = diplomaEl.querySelectorAll('h2, p, div.text-7xl, div.inline-block > p');
            
            for (const el of Array.from(elementsToDraw)) {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                const text = el.textContent || '';
                
                if (style.display === 'none' || !text.trim()) continue;

                ctx.fillStyle = style.color;
                ctx.font = style.font;
                ctx.textAlign = style.textAlign as CanvasTextAlign;
                ctx.textBaseline = 'middle';

                let x = rect.left - diplomaRect.left;
                const y = rect.top - diplomaRect.top + rect.height / 2;

                if (ctx.textAlign === 'center') {
                    x += rect.width / 2;
                } else if (ctx.textAlign === 'right') {
                    x += rect.width;
                }
                
                ctx.fillText(text, x, y);

                // Draw the border bottom for the name
                if (el.className.includes('border-b-2')) {
                    ctx.strokeStyle = style.borderBottomColor;
                    ctx.lineWidth = parseFloat(style.borderBottomWidth);
                    ctx.beginPath();
                    const borderY = rect.top - diplomaRect.top + rect.height - (ctx.lineWidth);
                    ctx.moveTo(rect.left - diplomaRect.left, borderY);
                    ctx.lineTo(rect.right - diplomaRect.left, borderY);
                    ctx.stroke();
                }
            }

            // 4. Convert canvas to Blob
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('Failed to create image from diploma.');

            // 5. Share or Download
            const file = new File([blob], `bragd-${achievement.id}.png`, { type: 'image/png' });
            const shareText = isDynamicDiploma
                ? `Jag har klarat mitt mål i Kostloggen.se: "${diplomaDescription}"! 💪`
                : `Jag har låst upp bragden "${achievement.name}" i Kostloggen.se! 💪`;
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Bragd: ${achievement.name}`,
                    text: shareText,
                });
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(file);
                link.download = `bragd-${achievement.name}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
                setToastNotification({ message: 'Bild nedladdad! Dela den gärna.', type: 'success' });
                 setTimeout(() => setToastNotification(null), 3000);
            }
        } catch (error) {
            console.error('Sharing failed:', error);
            setToastNotification({ message: 'Kunde inte dela diplomet.', type: 'error' });
            setTimeout(() => setToastNotification(null), 3000);
        } finally {
            setIsSharing(false);
        }
    };


    return (
        <div 
            className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in"
            onClick={onClose}
            role="dialog" aria-modal="true" aria-labelledby={`diploma-title-${achievement.id}`}
        >
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-soft-xl w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
                <div ref={diplomaRef} className="bg-gradient-to-br from-amber-50 to-yellow-100 p-8 rounded-lg shadow-inner border-4 border-amber-300 text-center relative overflow-hidden">
                    {/* Decorative elements for display only, not for canvas */}
                    <div className="absolute top-0 left-0 w-24 h-24 bg-amber-200/50 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-200/50 rounded-full translate-x-1/3 translate-y-1/3"></div>
                    
                    <h2 id={`diploma-title-${achievement.id}`} className="text-3xl font-bold text-amber-800 mb-2">Diplom</h2>
                    <p className="text-lg text-neutral-dark mb-4">För enastående prestation</p>
                    <div className="text-7xl mb-4">{achievement.icon}</div>
                    <p className="text-2xl font-semibold text-amber-900 mb-2">{achievement.name}</p>
                    <p className="text-base text-neutral-dark mb-6">{diplomaDescription}</p>
                    <p className="text-xl font-medium text-primary-darker mb-4">Tilldelas stolt till</p>
                    <div className="inline-block">
                        <p className="text-3xl font-serif text-amber-900 tracking-wider border-b-2 border-amber-400 pb-2 mb-4">
                            {userProfile.name || 'En Stjärna'}
                        </p>
                    </div>
                    <p className="text-sm text-neutral-dark">
                        {isDynamicDiploma ? 'Uppnådd' : 'Upplåst'} den {new Date(diplomaDate).toLocaleDateString('sv-SE')}
                    </p>
                </div>
                
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto flex-1 px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md active:scale-95"
                    >
                        Stäng
                    </button>
                    <button
                        onClick={handleShareDiploma}
                        disabled={isSharing}
                        className="w-full sm:w-auto flex-1 px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md active:scale-95 flex items-center justify-center disabled:opacity-70"
                    >
                         {isSharing ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                                Skapar bild...
                            </>
                        ) : (
                            <>
                                <ShareIcon className="w-5 h-5 mr-2" />
                                Dela diplom
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AchievementsView: React.FC<AchievementsViewProps> = ({ 
    userProfile, achievements, unlockedAchievements, achievementInteractions, setToastNotification 
}) => {
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [latestCompletedGoal, setLatestCompletedGoal] = useState<CompletedGoal | null>(null);

  const handleAchievementClick = (ach: Achievement) => {
    const isUnlocked = !!unlockedAchievements[ach.id];
    if (!isUnlocked) return;
    
    if (ach.id === 'main_goal_reached' && userProfile.completedGoals && userProfile.completedGoals.length > 0) {
        // Sort goals by date to find the most recent one
        const sortedGoals = [...userProfile.completedGoals].sort((a, b) => new Date(b.achievedOn).getTime() - new Date(a.achievedOn).getTime());
        setLatestCompletedGoal(sortedGoals[0]);
    } else {
        setLatestCompletedGoal(null); // Reset for other achievements
    }

    setSelectedAchievement(ach);
  };

  const unlockedCount = Object.keys(unlockedAchievements).length;
  const totalCount = achievements.length;

  return (
    <>
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
                <TrophyIcon className="w-7 h-7 text-accent mr-3" />
                <h3 id="achievements-heading" className="text-xl font-semibold text-neutral-dark">Mina Bragder</h3>
            </div>
            <p className="text-lg font-bold text-accent">{unlockedCount} / {totalCount}</p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {achievements.map(ach => {
            const unlockedDate = unlockedAchievements[ach.id];
            const isUnlocked = !!unlockedDate;
            const pepps = achievementInteractions[ach.id]?.reactions?.['❤️'] || {};
            const peppCount = Object.keys(pepps).length;
            const currentUser = auth.currentUser;
            const currentUserPepped = !!(currentUser && pepps[currentUser.uid]);

            return (
              <div key={ach.id} className="relative group">
                <button
                  onClick={() => handleAchievementClick(ach)}
                  className={`w-full aspect-square flex flex-col items-center justify-center p-2 rounded-lg text-center transition-all duration-200
                    ${isUnlocked 
                      ? 'bg-amber-100/70 border-2 border-amber-300 shadow-sm hover:shadow-md hover:border-amber-400 hover:scale-105' 
                      : 'bg-neutral-light border border-gray-300 filter grayscale opacity-70 cursor-not-allowed'
                    }`}
                  aria-label={isUnlocked ? `Visa diplom för ${ach.name}` : `${ach.name} (låst)`}
                  disabled={!isUnlocked}
                >
                  <span className="text-4xl sm:text-5xl">{ach.icon}</span>
                  <p className="text-xs font-semibold text-amber-900 mt-1 truncate">{ach.name}</p>
                </button>
                {isUnlocked && peppCount > 0 && (
                    <div className="absolute bottom-1 right-1 flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-xs shadow pointer-events-none">
                        <HeartIcon className={`w-3 h-3 ${currentUserPepped ? 'text-red-500' : 'text-gray-500'}`} />
                        <span className={`font-bold text-xs ${currentUserPepped ? 'text-red-600' : 'text-gray-600'}`}>{peppCount}</span>
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {selectedAchievement && (
        <DiplomaView 
            achievement={selectedAchievement} 
            unlockedDate={unlockedAchievements[selectedAchievement.id]}
            userProfile={userProfile}
            onClose={() => setSelectedAchievement(null)}
            setToastNotification={setToastNotification}
            latestCompletedGoal={latestCompletedGoal}
        />
      )}
    </>
  );
};

export default AchievementsView;
