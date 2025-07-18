import React, { useState, useEffect, useMemo } from 'react';
import type { User } from '@firebase/auth';
import { BuddyDetails, Achievement } from '../types';
import { ChevronDownIcon, ChevronUpIcon, HeartIcon, TrophyIcon } from './icons';
import { User as UserIcon, Dumbbell, PieChart, MessageSquare } from 'lucide-react';
import BuddyLogView from './BuddyLogView';
import { ACHIEVEMENT_DEFINITIONS } from '../constants';
import { addPeppToAchievement, removePeppFromAchievement, fetchAchievementInteractions } from '../services/firestoreService';
import { playAudio } from '../services/audioService';
import { Avatar } from './UserProfileModal';

const CompactStatCard: React.FC<{
    label: string;
    value: string;
    change?: { text: string; colorClass: string };
    icon: React.ReactElement<{ className?: string }>;
    iconBgColor: string;
    iconColor: string;
}> = ({ label, value, change, icon, iconBgColor, iconColor }) => (
    <div className="bg-white p-3 sm:p-4 rounded-xl shadow-soft-lg border border-neutral-light/70 flex flex-col flex-1 min-w-0 h-full justify-center text-center">
        <div className="flex items-center justify-center text-xs sm:text-sm text-neutral gap-2">
            <div className={`flex-shrink-0 p-1.5 rounded-full ${iconBgColor} ${iconColor}`}>
                {React.cloneElement(icon, { className: "w-4 h-4" })}
            </div>
            <span className="font-semibold">{label}</span>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-neutral-dark mt-1 whitespace-nowrap">{value}</p>
        {change && (
            <p className={`text-xs sm:text-sm font-semibold ${change.colorClass}`}>{change.text}</p>
        )}
    </div>
);


const formatChange = (change: number | undefined, invertColor: boolean = false): { text: string; colorClass: string } => {
    if (change === undefined || change === null || isNaN(change)) {
        return { text: '-', colorClass: 'text-neutral' };
    }
    if (Math.abs(change) < 0.05) {
        return { text: '±0,0 kg', colorClass: 'text-accent' };
    }
    const sign = change > 0 ? '+' : '';
    const formattedValue = `${sign}${change.toFixed(1).replace('.',',')}kg`;

    let colorClass = 'text-neutral';
    if (change > 0) {
        colorClass = invertColor ? 'text-red-600' : 'text-primary-darker';
    } else if (change < 0) {
        colorClass = invertColor ? 'text-primary-darker' : 'text-red-600';
    }
    
    return { text: formattedValue, colorClass };
};

const BuddyCard: React.FC<{
    buddy: BuddyDetails;
    currentUser: User;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    onStartChat: (buddy: BuddyDetails) => void;
}> = ({ buddy, currentUser, setToastNotification, onStartChat }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);
    const [interactions, setInteractions] = useState<{ [achievementId: string]: { pepps: { [fromUid: string]: any } } }>({});

    const { goalProgress, goalProgressText } = useMemo(() => {
        const { goalStartWeight, currentWeight, measurementMethod, desiredWeightChangeKg, desiredFatMassChangeKg, desiredMuscleMassChangeKg, mainGoalCompleted } = buddy;

        if (mainGoalCompleted || goalStartWeight == null || currentWeight == null) {
            return { goalProgress: 0, goalProgressText: 'Mål ej satt' };
        }

        let goalChange = 0;
        if (measurementMethod === 'scale') {
            goalChange = desiredWeightChangeKg || 0;
        } else {
            goalChange = (desiredFatMassChangeKg || 0) + (desiredMuscleMassChangeKg || 0);
        }

        if (goalChange === 0) {
            return { goalProgress: 0, goalProgressText: 'Mål ej satt' };
        }
        
        const targetWeight = goalStartWeight + goalChange;
        const totalChangeNeeded = goalStartWeight - targetWeight;
        const changeAchieved = goalStartWeight - currentWeight;

        if (totalChangeNeeded === 0) {
            return { goalProgress: 100, goalProgressText: '100%' };
        }

        const progressRaw = (changeAchieved / totalChangeNeeded) * 100;
        const progressClamped = Math.max(0, Math.min(progressRaw, 100));

        return {
            goalProgress: progressClamped,
            goalProgressText: `${progressClamped.toFixed(0)}%`,
        };
    }, [buddy]);
    
    const goalDisplayString = useMemo(() => {
        const { measurementMethod, desiredWeightChangeKg, desiredFatMassChangeKg, desiredMuscleMassChangeKg, goalSummary } = buddy;
        if (measurementMethod === 'scale' && desiredWeightChangeKg) {
            return `${desiredWeightChangeKg > 0 ? '+' : ''}${desiredWeightChangeKg.toFixed(1).replace('.',',')} kg vikt`;
        }
        if (desiredFatMassChangeKg) {
            return `${desiredFatMassChangeKg > 0 ? '+' : ''}${desiredFatMassChangeKg.toFixed(1).replace('.',',')} kg fett`;
        }
        if (desiredMuscleMassChangeKg) {
            return `${desiredMuscleMassChangeKg > 0 ? '+' : ''}${desiredMuscleMassChangeKg.toFixed(1).replace('.',',')} kg muskler`;
        }
        return goalSummary; // Fallback
    }, [buddy]);


    useEffect(() => {
        if (isExpanded && Object.keys(interactions).length === 0) {
            const loadInteractions = async () => {
                setIsLoadingInteractions(true);
                try {
                    const fetchedInteractions = await fetchAchievementInteractions(buddy.uid);
                    setInteractions(fetchedInteractions);
                } catch (error) {
                    console.error("Failed to load buddy interactions", error);
                } finally {
                    setIsLoadingInteractions(false);
                }
            };
            loadInteractions();
        }
    }, [isExpanded, buddy.uid]);
    
    const handleTogglePepp = async (achievementId: string) => {
        playAudio('uiClick');
        const peppedByCurrentUser = interactions[achievementId]?.pepps?.[currentUser.uid];

        // Optimistic UI update
        const originalInteractions = { ...interactions };
        const updatedInteractions = JSON.parse(JSON.stringify(interactions)); // Deep copy
        if (!updatedInteractions[achievementId]) updatedInteractions[achievementId] = { pepps: {} };
        if (!updatedInteractions[achievementId].pepps) updatedInteractions[achievementId].pepps = {};

        if (peppedByCurrentUser) {
            delete updatedInteractions[achievementId].pepps[currentUser.uid];
        } else {
            updatedInteractions[achievementId].pepps[currentUser.uid] = { name: currentUser.displayName, timestamp: Date.now() };
        }
        setInteractions(updatedInteractions);
        
        try {
            if (peppedByCurrentUser) {
                await removePeppFromAchievement(currentUser.uid, buddy.uid, achievementId);
            } else {
                await addPeppToAchievement(currentUser.uid, currentUser.displayName || "En kompis", buddy.uid, achievementId);
            }
        } catch (error) {
            setToastNotification({ message: "Kunde inte skicka pepp.", type: 'error' });
            // Rollback on error
            setInteractions(originalInteractions);
        }
    };


    const weightChangeInfo = formatChange(buddy.totalWeightChange, true);
    const muscleChangeInfo = formatChange(buddy.muscleMassChange, false);
    const fatChangeInfo = formatChange(buddy.fatMassChange, true);

    return (
        <div className="relative bg-white p-4 rounded-xl shadow-lg border border-neutral-light interactive-transition hover:shadow-xl hover:border-primary flex flex-col h-full">
            <div className="absolute top-3 right-3 z-10">
                <button
                    onClick={() => onStartChat(buddy)}
                    className="p-2 text-neutral hover:text-primary rounded-full hover:bg-primary-100/50 interactive-transition"
                    aria-label={`Starta chatt med ${buddy.name}`}
                >
                    <MessageSquare className="w-5 h-5" />
                </button>
            </div>
            <div className="flex justify-between items-start">
                 <div className="flex items-center gap-3">
                    <Avatar photoURL={buddy.photoURL} gender={buddy.gender} size={40} />
                    <div>
                        <h4 className="text-lg font-bold text-primary-darker">{buddy.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-neutral mt-1">
                            <span>Mål: <span className="font-semibold">{goalDisplayString}</span></span>
                            <span className="flex items-center"><span role="img" aria-label="Streak" className="mr-1">🔥</span>{buddy.currentStreak ?? 0} dagar</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 space-y-2 flex-grow">
                 {!buddy.mainGoalCompleted && (
                    <div className="mb-3">
                        <div className="w-full bg-neutral-light rounded-full h-2.5 shadow-inner">
                            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${goalProgress}%` }}></div>
                        </div>
                        <p className="text-right text-xs font-semibold text-primary mt-1">{goalProgressText}</p>
                    </div>
                 )}
                 <div className="flex flex-row gap-2">
                    <CompactStatCard 
                        label="Vikt" 
                        value={buddy.currentWeight ? `${buddy.currentWeight.toFixed(1)}kg` : 'N/A'}
                        change={weightChangeInfo}
                        icon={<UserIcon />}
                        iconBgColor="bg-green-100" 
                        iconColor="text-green-600"
                    />
                    {buddy.currentMuscleMass != null && (
                         <CompactStatCard 
                            label="Muskler" 
                            value={`${buddy.currentMuscleMass.toFixed(1)}kg`}
                            change={muscleChangeInfo}
                            icon={<Dumbbell />}
                            iconBgColor="bg-orange-100" 
                            iconColor="text-orange-500"
                        />
                    )}
                    {buddy.currentFatMass != null && (
                         <CompactStatCard 
                            label="Fett" 
                            value={`${buddy.currentFatMass.toFixed(1)}kg`}
                            change={fatChangeInfo}
                            icon={<PieChart />}
                            iconBgColor="bg-yellow-100"
                            iconColor="text-yellow-500"
                        />
                    )}
                </div>
            </div>
            
            <div className="flex justify-center mt-2">
                 <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 text-neutral hover:text-primary rounded-full hover:bg-primary-100/50"
                    aria-expanded={isExpanded}
                    aria-controls={`buddy-details-${buddy.uid}`}
                >
                    {isExpanded ? <ChevronUpIcon className="w-6 h-6" /> : <ChevronDownIcon className="w-6 h-6" />}
                </button>
            </div>

            <div id={`buddy-details-${buddy.uid}`} className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] mt-4 pt-3 border-t' : 'max-h-0'}`}>
                 <h5 className="text-md font-semibold text-neutral-dark mb-2">Bragder</h5>
                 {isLoadingInteractions ? <p className="text-sm text-neutral">Laddar...</p> : 
                     <div className="grid grid-cols-5 gap-2">
                         {ACHIEVEMENT_DEFINITIONS.map(achievement => {
                             const isUnlocked = !!buddy.unlockedAchievements?.[achievement.id];
                             const peppedByCurrentUser = interactions[achievement.id]?.pepps?.[currentUser.uid];
                             const peppCount = Object.keys(interactions[achievement.id]?.pepps || {}).length;
             
                             return (
                                 <div 
                                     key={achievement.id} 
                                     className={`group p-2 rounded-lg border-2 flex flex-col items-center justify-center text-center aspect-square transition-all duration-300
                                         ${isUnlocked 
                                             ? 'bg-amber-50 border-amber-300' 
                                             : 'bg-neutral-light/60 border-gray-300 filter grayscale'
                                         }`
                                     }
                                     title={`${achievement.name}${isUnlocked ? '' : ' (Låst)'}: ${achievement.description}`}
                                 >
                                     <div className={`text-2xl sm:text-3xl transition-transform duration-300 flex-grow flex items-center justify-center ${isUnlocked ? '' : 'group-hover:scale-110'}`}>{achievement.icon}</div>
                                     {isUnlocked && (
                                          <button 
                                             onClick={() => handleTogglePepp(achievement.id)} 
                                             className={`mt-auto flex items-center justify-center gap-1 w-full text-xs font-semibold p-1 rounded-md transition-colors ${peppedByCurrentUser ? 'bg-red-200 text-red-600' : 'bg-gray-300 text-gray-600 hover:bg-red-100'}`}
                                         >
                                             <HeartIcon className="w-3 h-3"/> {peppCount}
                                         </button>
                                     )}
                                 </div>
                             );
                         })}
                     </div>
                 }
            </div>
        </div>
    );
};

interface BuddyListViewProps {
  buddies: BuddyDetails[];
  currentUser: User;
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  onStartChat: (buddy: BuddyDetails) => void;
}

const BuddyListView: React.FC<BuddyListViewProps> = ({ buddies, currentUser, setToastNotification, onStartChat }) => {
    
    if (buddies.length === 0) {
        return <p className="text-center text-neutral p-6">Du har inga kompisar än. Lägg till några för att se deras framsteg här!</p>;
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {buddies.map(buddy => (
                    <BuddyCard 
                        key={buddy.uid} 
                        buddy={buddy} 
                        currentUser={currentUser}
                        setToastNotification={setToastNotification}
                        onStartChat={onStartChat}
                    />
                ))}
            </div>
        </>
    );
};

export default BuddyListView;