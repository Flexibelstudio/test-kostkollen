

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BuddyDetails, Achievement, TimelineEvent, Peppkompis } from '../types';
import { UserGroupIcon, ArrowLeftIcon, FireIcon, ChevronDownIcon, ChevronUpIcon, BellIcon, ScaleIcon, ProteinIcon, TrophyIcon, ChatBubbleLeftRightIcon, HeartIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import { addPeppToWeightLog, addPeppToAchievement, removePeppFromWeightLog, removePeppFromAchievement, fetchTimelineForBuddy, fetchTimelineForCurrentUser } from '../services/firestoreService';
import { auth } from '../firebase';
import { LOCAL_STORAGE_KEYS, ACHIEVEMENT_DEFINITIONS } from '../constants';
import { playAudio } from '../services/audioService';

interface BuddyListViewProps {
    buddies: BuddyDetails[];
    onBack: () => void;
    isLoading: boolean;
    achievements: Achievement[];
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    currentUserName: string;
    onStartChat: (buddy: Peppkompis) => void;
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

const TimelineEventCard: React.FC<{
    event: TimelineEvent;
    onPepp: (type: 'weight' | 'achievement', relatedDocId: string) => void;
}> = ({ event, onPepp }) => {

    const hasPepped = event.peppedByCurrentUser;

    return (
        <div className="flex items-start space-x-3 p-3 bg-neutral-light/50 rounded-lg">
            <div className="mt-1 text-2xl">{event.icon}</div>
            <div className="flex-grow">
                <p className="text-sm font-semibold text-neutral-dark">{event.title}</p>
                <p className="text-xs text-neutral">{event.description}</p>
                <PeppDisplay pepps={event.pepps} />
            </div>
            <button
                onClick={() => onPepp(event.type, event.relatedDocId)}
                className={`flex-shrink-0 p-2 rounded-full interactive-transition active:scale-90
                    ${hasPepped 
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-white text-neutral hover:bg-red-100 hover:text-red-500'
                    }`}
                aria-label={hasPepped ? 'Ångra pepp' : 'Peppa denna händelse'}
            >
                <HeartIcon className="w-5 h-5"/>
            </button>
        </div>
    );
};

const StatRow: React.FC<{ label: string; value: number | undefined; change: number | undefined; unit: string; invertChangeColor?: boolean; icon: React.ReactNode }> = ({ label, value, change, unit, invertChangeColor = false, icon }) => {
    
    const formatChange = (changeVal: number | undefined): { text: string; colorClass: string } => {
        if (changeVal === undefined || changeVal === null || isNaN(changeVal) || Math.abs(changeVal) < 0.05) {
            return { text: '±0,0 kg', colorClass: 'text-neutral' };
        }
        
        const sign = changeVal > 0 ? '+' : '';
        const formattedValue = `${sign}${changeVal.toFixed(1).replace('.', ',')} ${unit}`;
        
        let colorClass = 'text-neutral';
        if (changeVal > 0) {
            colorClass = invertChangeColor ? 'text-red-500' : 'text-green-600';
        } else if (changeVal < 0) {
            colorClass = invertChangeColor ? 'text-green-600' : 'text-red-500';
        }
        
        return { text: formattedValue, colorClass };
    };

    const changeInfo = formatChange(change);

    return (
        <div className="flex justify-between items-center bg-neutral-light/40 px-3 py-2 rounded-md">
            <div className="flex items-center">
                <div className="mr-2">{icon}</div>
                <span className="font-medium text-neutral-dark">{label}</span>
            </div>
            <div className="text-right">
                <span className="text-base font-bold text-neutral-dark">{value !== undefined ? `${value.toFixed(1)} ${unit}` : 'N/A'}</span>
                {change !== undefined && <span className={`block text-xs font-semibold ${changeInfo.colorClass}`}>{changeInfo.text}</span>}
            </div>
        </div>
    );
};


const BuddyCard: React.FC<{
    buddy: BuddyDetails;
    achievements: Achievement[];
    lastViewTimestamp: number;
    currentUser: { uid: string, name: string };
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    onStartChat: (buddy: Peppkompis) => void;
}> = ({ buddy, achievements, lastViewTimestamp, currentUser, setToastNotification, onStartChat }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoadingFeed, setIsLoadingFeed] = useState(false);
    const [feed, setFeed] = useState<TimelineEvent[]>([]);
    const [notificationSeen, setNotificationSeen] = useState(false);
    
    const { hasNewUpdate, notificationTooltip } = useMemo(() => {
        const isNewWeight = (buddy.lastWeightLogTimestamp ?? 0) > lastViewTimestamp;
        const isNewAchievement = (buddy.lastAchievementTimestamp ?? 0) > lastViewTimestamp;
        
        const newUpdate = isNewWeight || isNewAchievement;
        let tooltip = '';
        if (newUpdate) {
            if (isNewWeight && isNewAchievement) tooltip = 'Ny mätning och ny bragd!';
            else if (isNewWeight) tooltip = 'Ny mätning loggad!';
            else if (isNewAchievement) tooltip = 'Ny bragd upplåst!';
        }
        
        return { hasNewUpdate: newUpdate, notificationTooltip: tooltip };
    }, [buddy.lastWeightLogTimestamp, buddy.lastAchievementTimestamp, lastViewTimestamp]);

    const handleExpandClick = useCallback(async () => {
        const expanding = !isExpanded;
        setIsExpanded(expanding);

        if (expanding) {
            setNotificationSeen(true); // Mark as seen immediately on expand
            if (feed.length === 0) { // Fetch only if feed is empty
                setIsLoadingFeed(true);
                try {
                    const timelineEvents = await fetchTimelineForBuddy(buddy.uid, currentUser.uid, achievements);
                    setFeed(timelineEvents);
                } catch (error) {
                    console.error("Error fetching buddy timeline:", error);
                    setToastNotification({ message: 'Kunde inte ladda kompisens flöde.', type: 'error' });
                } finally {
                    setIsLoadingFeed(false);
                }
            }
        }
    }, [isExpanded, buddy.uid, currentUser.uid, achievements, feed.length, setToastNotification]);

    const handlePepp = useCallback(async (type: 'weight' | 'achievement', relatedDocId: string) => {
        if (!relatedDocId) {
            console.error("handlePepp called with invalid relatedDocId");
            return;
        }
        
        playAudio('uiClick');

        const eventToUpdate = feed.find(event => event.relatedDocId === relatedDocId && event.type === type);
        
        // This is a safety check. With the updated fetchTimeline, this should almost never fail for achievements.
        if (!eventToUpdate) {
            console.error("Could not find event to pepp. Feed might be out of sync or event is too old.");
            setToastNotification({ message: 'Ett fel uppstod, kunde inte synkronisera pepp.', type: 'error' });
            return;
        }

        const isAlreadyPepped = eventToUpdate.peppedByCurrentUser;

        setFeed(prevFeed => prevFeed.map(event => {
            if (event.relatedDocId === relatedDocId && event.type === type) {
                const newPepps = { ...event.pepps };
                if (isAlreadyPepped) {
                    delete newPepps[currentUser.uid];
                } else {
                    newPepps[currentUser.uid] = { name: currentUser.name, timestamp: Date.now() };
                }
                return {
                    ...event,
                    peppedByCurrentUser: !isAlreadyPepped,
                    pepps: newPepps
                };
            }
            return event;
        }));

        try {
            if (isAlreadyPepped) {
                if (type === 'weight') {
                    await removePeppFromWeightLog(currentUser.uid, buddy.uid, relatedDocId);
                } else {
                    await removePeppFromAchievement(currentUser.uid, buddy.uid, relatedDocId);
                }
            } else {
                if (type === 'weight') {
                    await addPeppToWeightLog(currentUser.uid, currentUser.name, buddy.uid, relatedDocId);
                } else {
                    await addPeppToAchievement(currentUser.uid, currentUser.name, buddy.uid, relatedDocId);
                }
            }
        } catch (error) {
            console.error("Error toggling pepp:", error);
            setToastNotification({ message: 'Kunde inte ändra pepp.', type: 'error' });
            // Rollback optimistic update
             setFeed(prevFeed => prevFeed.map(event =>
                (event.id === eventToUpdate.id) ? eventToUpdate : event
            ));
        }
    }, [feed, currentUser, buddy.uid, setToastNotification]);


    return (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-neutral-light/70 flex flex-col">
            <div className="flex justify-between items-start">
                <div className="flex items-center min-w-0">
                    <p className="font-bold text-lg text-neutral-dark truncate">{buddy.name}</p>
                    {hasNewUpdate && !notificationSeen && (
                         <div className="relative group ml-2 flex-shrink-0">
                             <BellIcon className="w-5 h-5 text-accent animate-pulse" />
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max p-2 bg-neutral-dark text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10" role="tooltip">
                                 {notificationTooltip}
                             </div>
                         </div>
                    )}
                </div>
                <div className="flex items-center space-x-1">
                    <button
                        onClick={() => onStartChat(buddy)}
                        className="p-1.5 text-neutral-dark hover:text-primary-darker rounded-full hover:bg-primary-100 active:scale-90 interactive-transition"
                        aria-label={`Chatta med ${buddy.name}`}
                        title={`Chatta med ${buddy.name}`}
                    >
                       <ChatBubbleLeftRightIcon className="w-5 h-5"/>
                    </button>
                    <button
                        onClick={handleExpandClick}
                        className="p-1.5 text-neutral-dark hover:text-primary-darker rounded-full hover:bg-primary-100 active:scale-90 interactive-transition"
                        aria-expanded={isExpanded}
                        aria-controls={`buddy-details-${buddy.uid}`}
                        aria-label={isExpanded ? "Dölj detaljer" : "Visa detaljer"}
                    >
                        {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>
            
            <p className="text-sm text-neutral"><span className="font-semibold">Mål:</span> {buddy.goalSummary}</p>
            
            {isExpanded && (
                <div id={`buddy-details-${buddy.uid}`} className="mt-3 pt-3 border-t border-neutral-light/60 animate-fade-in space-y-3">
                    <div className="space-y-2 mb-3">
                        <StatRow label="Nuvarande Vikt" value={buddy.currentWeight} change={buddy.totalWeightChange} unit="kg" invertChangeColor={true} icon={<ScaleIcon className="w-5 h-5 text-neutral" />} />
                        {buddy.currentMuscleMass !== undefined && <StatRow label="Muskelmassa" value={buddy.currentMuscleMass} change={buddy.muscleMassChange} unit="kg" icon={<ProteinIcon className="w-5 h-5 text-neutral" />} />}
                        {buddy.currentFatMass !== undefined && <StatRow label="Fettmassa" value={buddy.currentFatMass} change={buddy.fatMassChange} unit="kg" invertChangeColor={true} icon={<FireIcon className="w-5 h-5 text-neutral" />} />}
                    </div>

                    <h4 className="text-md font-semibold text-neutral-dark border-t border-neutral-light/60 pt-3">
                        Bragder
                    </h4>
                    <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                       {achievements.map(ach => {
                            const isUnlocked = buddy.unlockedAchievements && buddy.unlockedAchievements[ach.id];
                            const unlockedDate = isUnlocked ? new Date(buddy.unlockedAchievements[ach.id]).toLocaleDateString('sv-SE') : '';
                            const tooltip = isUnlocked
                                ? `${ach.name} - Upplåst ${unlockedDate}\n${ach.description}`
                                : `${ach.name} (Låst)\n${ach.description}`;
                            
                            const event = feed.find(e => e.type === 'achievement' && e.relatedDocId === ach.id);
                            const hasPepped = event ? event.peppedByCurrentUser : false;

                            return (
                                <div
                                    key={ach.id}
                                    className={`relative group aspect-square flex items-center justify-center rounded-lg transition-all duration-300 ${isUnlocked ? 'bg-amber-100 opacity-100 shadow-sm' : 'bg-neutral-light opacity-30 grayscale'}`}
                                    title={tooltip}
                                >
                                    <span className="text-2xl sm:text-3xl" style={{ textShadow: isUnlocked ? '0 0 5px rgba(255,255,255,0.7)' : 'none' }}>
                                        {ach.icon}
                                    </span>
                                    {isUnlocked && (
                                        <button
                                            onClick={() => handlePepp('achievement', ach.id)}
                                            className={`absolute -bottom-1.5 -right-1.5 p-1.5 rounded-full shadow-md border border-white/50 interactive-transition active:scale-90
                                                ${hasPepped 
                                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                                    : 'bg-white text-gray-400 hover:text-red-500'
                                                }`}
                                            aria-label={hasPepped ? 'Ångra pepp' : 'Peppa denna bragd'}
                                        >
                                            <HeartIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <h4 className="text-md font-semibold text-neutral-dark border-t border-neutral-light/60 pt-3">Senaste Händelser</h4>
                    {isLoadingFeed ? (
                        <div className="flex justify-center items-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                        </div>
                    ) : feed.length > 0 ? (
                        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                           {feed.map(event => (
                               <TimelineEventCard key={event.id} event={event} onPepp={handlePepp} />
                           ))}
                        </div>
                    ) : (
                        <p className="text-sm text-neutral text-center py-4">Inga nya händelser att visa för {buddy.name}.</p>
                    )}
                </div>
            )}
        </div>
    );
}


const BuddyListView: React.FC<BuddyListViewProps> = ({ buddies, onBack, isLoading, achievements, setToastNotification, currentUserName, onStartChat }) => {
    
    const [lastViewTimestamp] = useState<number>(() => {
        return parseInt(localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_BUDDY_VIEW_TIMESTAMP) || '0', 10);
    });

    const currentUser = useMemo(() => ({
        uid: auth.currentUser!.uid,
        name: currentUserName || 'En kompis'
    }), [currentUserName]);
    
    useEffect(() => {
        // Mark all updates as "seen" immediately upon entering the view.
        // This resets the notification icons on the main screen for the next time the app loads.
        localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_BUDDY_VIEW_TIMESTAMP, Date.now().toString());
    }, []);


    if (isLoading) {
        return <LoadingSpinner message="Laddar Peppkompisar..." />;
    }

    return (
        <div className="animate-fade-in">
            <header className="flex items-center mb-6">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-neutral hover:text-primary rounded-md hover:bg-primary-100 active:scale-90"
                    aria-label="Tillbaka till startsidan"
                >
                    <ArrowLeftIcon className="w-7 h-7" />
                </button>
                <div className="flex items-center mx-auto pr-8">
                     <UserGroupIcon className="w-8 h-8 text-primary mr-3" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-neutral-dark">Mina Peppkompisar</h1>
                </div>
            </header>
            
            <section className="bg-white p-5 sm:p-6 rounded-xl shadow-soft-lg border border-neutral-light">
                 {buddies.length === 0 ? (
                    <p className="text-center text-neutral py-6">
Du har inga Peppkompisar ännu. Gå till 'Konto' &gt; 'Peppkompis' för att lägga till vänner!
                    </p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {buddies.map(buddy => (
                           <BuddyCard 
                                key={buddy.uid} 
                                buddy={buddy} 
                                achievements={achievements}
                                lastViewTimestamp={lastViewTimestamp}
                                currentUser={currentUser}
                                setToastNotification={setToastNotification}
                                onStartChat={onStartChat}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default BuddyListView;