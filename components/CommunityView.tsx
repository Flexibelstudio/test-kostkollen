import React, { useState, useEffect, useMemo, FC, useCallback } from 'react';
import type { User } from '@firebase/auth';
import { Peppkompis, TimelineEvent, Achievement, Gender, BuddyDetails, UserProfileData, PeppkompisRequest, TimelineComment, Reactions } from '../types';
import { 
    searchForBuddies,
    sendFriendRequest,
    updateFriendRequestStatus,
    removeBuddy,
    fetchFriendRequests,
    fetchOutgoingFriendRequests,
    togglePeppOnTimelineEvent,
    addCommentToTimelineEvent,
    toggleLikeOnComment,
    fetchBuddies,
    cancelFriendRequest
} from '../services/firestoreService';
import { 
    HeartIcon, 
    TrashIcon, CheckIcon, XMarkIcon, UserPlusIcon, SearchIcon, ChevronDownIcon, ArrowRightIcon,
    ShareIcon, PencilIcon,
} from './icons';
import { Users, Newspaper, User as UserIcon, Dumbbell, PieChart, MoreHorizontal } from 'lucide-react';
import { playAudio } from '../services/audioService';
import { Avatar } from './UserProfileModal';

// --- HELPER FUNCTION ---
const formatChange = (change: number | undefined, isFirstEntry: boolean, invertColors: boolean = false): { text: string; colorClass: string } => {
    if (isFirstEntry) {
        return { text: '-', colorClass: 'text-neutral' };
    }
    if (change === undefined || change === null || isNaN(change)) {
        return { text: '-', colorClass: 'text-neutral' };
    }

    if (Math.abs(change) < 0.05) {
        return { text: '±0,0 kg', colorClass: 'text-accent' };
    }

    const sign = change > 0 ? '+' : '';
    const formattedValue = `${sign}${change.toFixed(1).replace('.', ',')} kg`;

    let colorClass = 'text-neutral';
    if (change > 0) {
        colorClass = invertColors ? 'text-red-600' : 'text-primary-darker';
    } else if (change < 0) {
        colorClass = invertColors ? 'text-primary-darker' : 'text-red-600';
    }
    
    return { text: formattedValue, colorClass };
};

// --- SUB-COMPONENTS ---

const BuddyCard: FC<{ 
    buddy: BuddyDetails; 
    onRemove: () => void; 
}> = ({ buddy, onRemove }) => {
    const [showMenu, setShowMenu] = useState(false);
    
    const progressPercentage = useMemo(() => {
        if (buddy.mainGoalCompleted) return 100;

        let start, current, goalChange;

        if (buddy.measurementMethod === 'scale') {
            start = buddy.goalStartWeight;
            current = buddy.currentWeight;
            goalChange = buddy.desiredWeightChangeKg || 0;
        } else { // inbody
            if (buddy.desiredFatMassChangeKg && buddy.desiredFatMassChangeKg < 0) {
                start = buddy.goalStartFatMassKg;
                current = buddy.currentFatMass;
                goalChange = buddy.desiredFatMassChangeKg;
            } else if (buddy.desiredMuscleMassChangeKg && buddy.desiredMuscleMassChangeKg > 0) {
                start = buddy.goalStartMuscleMassKg;
                current = buddy.currentMuscleMass;
                goalChange = buddy.desiredMuscleMassChangeKg;
            } else { // Fallback to weight if no specific fat/muscle goal is set
                 start = buddy.goalStartWeight;
                 current = buddy.currentWeight;
                 goalChange = 0;
            }
        }
        
        if (start == null || current == null || goalChange === 0) {
            return 0;
        }
        
        const target = start + goalChange;
        const totalChangeNeeded = start - target;
        const changeAchieved = start - current;

        if (totalChangeNeeded === 0) {
            return 100;
        }

        const progressRaw = (changeAchieved / totalChangeNeeded) * 100;
        return Math.max(0, Math.min(progressRaw, 100));
    }, [buddy]);
    
    const goalDescription = useMemo(() => {
        const { mainGoalCompleted, measurementMethod, desiredWeightChangeKg, desiredFatMassChangeKg, desiredMuscleMassChangeKg, goalSummary } = buddy;
        if (mainGoalCompleted) return "Mål uppnått!";

        const changes = [];
        if (measurementMethod === 'scale' && desiredWeightChangeKg) {
            changes.push(`${desiredWeightChangeKg > 0 ? '+' : ''}${desiredWeightChangeKg.toFixed(1).replace('.',',')} kg vikt`);
        } else {
            if (desiredFatMassChangeKg) {
                changes.push(`${desiredFatMassChangeKg > 0 ? '+' : ''}${desiredFatMassChangeKg.toFixed(1).replace('.',',')} kg fett`);
            }
            if (desiredMuscleMassChangeKg) {
                changes.push(`${desiredMuscleMassChangeKg > 0 ? '+' : ''}${desiredMuscleMassChangeKg.toFixed(1).replace('.',',')} kg muskler`);
            }
        }

        if (changes.length > 0) {
            return `Mål: ${changes.join(' & ')}`;
        }
        
        return goalSummary || 'Inget specifikt mål';
    }, [buddy]);

    return (
        <div className="bg-white p-4 rounded-xl shadow-soft-lg border border-neutral-light/70 space-y-3 relative group">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <Avatar photoURL={buddy.photoURL} gender={buddy.gender} size={48} />
                    <div>
                        <h3 className="text-xl font-bold text-neutral-dark">{buddy.name}</h3>
                        <p className="text-xs text-neutral flex items-center gap-2 mt-0.5">
                            <span className="font-medium text-orange-500">🔥 {buddy.currentStreak} dagar</span>
                            <span className="text-neutral-300">|</span>
                            <span className="truncate max-w-[150px]">{goalDescription}</span>
                        </p>
                    </div>
                </div>
                
                {/* Menu Trigger */}
                <div className="relative">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        className="p-1.5 text-neutral-400 hover:text-neutral-dark rounded-full hover:bg-neutral-light transition-colors"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                    
                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-neutral-light z-30 animate-scale-in origin-top-right overflow-hidden">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onRemove(); }}
                                className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                                <TrashIcon className="w-4 h-4" /> Ta bort
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-neutral-500">Måluppfyllnad</span>
                    <span className="text-xs font-bold text-primary-darker">{progressPercentage.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-neutral-light rounded-full h-2 shadow-inner">
                    <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
                </div>
            </div>

            {/* Overlay click to close menu */}
            {showMenu && (
                <div className="fixed inset-0 z-20 cursor-default" onClick={() => setShowMenu(false)}></div>
            )}
        </div>
    );
};

const FriendManagementView: FC<{
    currentUser: User;
    userProfile: UserProfileData;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    onDataChanged: () => void;
    buddyDetails: BuddyDetails[];
    achievements: Achievement[];
    initialTab?: 'buddies' | 'search' | 'requests';
}> = ({
    currentUser,
    userProfile,
    setToastNotification,
    onDataChanged,
    buddyDetails,
    achievements,
    initialTab = 'buddies'
}) => {
    const [buddySearchQuery, setBuddySearchQuery] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [allSearchableUsers, setAllSearchableUsers] = useState<Peppkompis[]>([]);
    const [requests, setRequests] = useState<PeppkompisRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<PeppkompisRequest[]>([]);
    const [activeTab, setActiveTab] = useState<'buddies' | 'search' | 'requests'>(initialTab);
    const [buddyToRemove, setBuddyToRemove] = useState<Peppkompis | null>(null);
    const [showInviteOptionsModal, setShowInviteOptionsModal] = useState(false);
    const [isCopied, setIsCopied] = useState(false);


    const fetchData = useCallback(async () => {
        setIsLoadingData(true);
        try {
            const [reqs, outReqs, allUsers] = await Promise.all([
                fetchFriendRequests(currentUser.uid),
                fetchOutgoingFriendRequests(currentUser.uid),
                searchForBuddies(currentUser.uid),
            ]);
            setRequests(reqs.filter(r => r.fromUid !== currentUser.uid));
            setOutgoingRequests(outReqs);
            setAllSearchableUsers(allUsers);
        } catch (error) {
            setToastNotification({ message: "Kunde inte ladda kompisdata.", type: 'error' });
        } finally {
            setIsLoadingData(false);
        }
    }, [currentUser.uid, setToastNotification]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const invitePeppPart = `Hej! Jag använder en app som heter Kostloggen för att få koll på min hälsa och det är faktiskt riktigt bra. Tänkte om du ville haka på så kan vi peppa varandra?`;
    const inviteLinkIntro = `Ladda ner den och lägg till mig som kompis här:`;
    const inviteUrlPart = `https://app.kostloggen.se`;
    
    // Hela texten för urklipp
    const inviteFullText = `${invitePeppPart}\n\n${inviteLinkIntro} ${inviteUrlPart}`;

    const handleShareViaApp = async () => {
        setShowInviteOptionsModal(false);
        playAudio('uiClick');
        
        if (navigator.share) {
            try {
                // Vi skickar med hela texten inklusive "Ladda ner"-meningen i 'text' fältet
                // men lämnar själva länken till 'url' fältet. Detta är det säkraste sättet
                // för att undvika dubblering i Messenger och behålla formatering.
                await navigator.share({
                    text: `${invitePeppPart}\n\n${inviteLinkIntro}`,
                    url: inviteUrlPart
                });
            } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    console.error('Error sharing:', error);
                    setToastNotification({ message: 'Kunde inte dela inbjudan.', type: 'error' });
                }
            }
        } else {
            // Fallback for desktop - kopiera hela texten
            navigator.clipboard.writeText(inviteFullText).then(() => {
                setToastNotification({ message: 'Inbjudningstext kopierad!', type: 'success' });
            }, () => {
                setToastNotification({ message: 'Kunde inte kopiera texten.', type: 'error' });
            });
        }
    };
    
    const handleCopyToClipboard = () => {
        playAudio('uiClick');
        navigator.clipboard.writeText(inviteFullText).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // Reset feedback after 2s
        }, () => {
            setToastNotification({ message: 'Kunde inte kopiera texten.', type: 'error' });
        });
    };


    const searchResults = useMemo(() => {
        const buddyUids = new Set(buddyDetails.map(b => b.uid));
        const nonFriends = allSearchableUsers.filter(user => !buddyUids.has(user.uid));

        const query = searchQuery.trim().toLowerCase();
        if (!query) return [];
        
        return nonFriends.filter(user => 
            user.name.toLowerCase().includes(query) || 
            (user.email && user.email.toLowerCase().includes(query))
        );
    }, [searchQuery, allSearchableUsers, buddyDetails]);
    
    const filteredBuddyDetails = useMemo(() => {
        const query = buddySearchQuery.trim().toLowerCase();
        if (!query) return buddyDetails;
        return buddyDetails.filter(buddy => 
            buddy.name.toLowerCase().includes(query) || 
            (buddy.email && buddy.email.toLowerCase().includes(query))
        );
    }, [buddySearchQuery, buddyDetails]);

    const handleSendRequest = async (toUser: Peppkompis) => {
        const currentUserPeppkompis: Peppkompis = {
            uid: currentUser.uid,
            name: userProfile.name || "En användare",
            email: currentUser.email || '',
            photoURL: userProfile.photoURL,
            gender: userProfile.gender,
        };
        try {
            await sendFriendRequest(currentUserPeppkompis, toUser.uid);
            setToastNotification({ message: `Förfrågan skickad till ${toUser.name}!`, type: 'success' });
            const outReqs = await fetchOutgoingFriendRequests(currentUser.uid);
            setOutgoingRequests(outReqs);
        } catch (error) {
            setToastNotification({ message: (error as Error).message || 'Kunde inte skicka förfrågan.', type: 'error' });
        }
    };

    const handleRequestAction = async (request: PeppkompisRequest, status: 'accepted' | 'declined') => {
        try {
            await updateFriendRequestStatus(request, status);
            await fetchData();
            onDataChanged();
            setToastNotification({ message: `Förfrågan ${status === 'accepted' ? 'godkänd' : 'avvisad'}.`, type: 'success' });
        } catch (error) {
            setToastNotification({ message: 'Kunde inte hantera förfrågan.', type: 'error' });
        }
    };
    
    const handleRemoveBuddyRequest = (buddy: Peppkompis) => {
        playAudio('uiClick');
        setBuddyToRemove(buddy);
    };

    const confirmRemoveBuddy = async () => {
        if (!buddyToRemove) return;
        playAudio('uiClick');
        try {
            await removeBuddy(currentUser.uid, buddyToRemove.uid);
            onDataChanged();
            setToastNotification({ message: `${buddyToRemove.name} har tagits bort.`, type: 'success' });
        } catch (error) {
            setToastNotification({ message: 'Kunde inte ta bort kompis.', type: 'error' });
        } finally {
            setBuddyToRemove(null);
        }
    };

    const handleCancelRequest = async (requestId: string) => {
        try {
            await cancelFriendRequest(requestId);
            setToastNotification({ message: 'Förfrågan har avbrutits.', type: 'success' });
            const outReqs = await fetchOutgoingFriendRequests(currentUser.uid);
            setOutgoingRequests(outReqs);
        } catch (error) {
            setToastNotification({ message: 'Kunde inte avbryta förfrågan.', type: 'error' });
        }
    };

    const renderTabContent = () => {
        if (isLoadingData) return <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div></div>;

        switch (activeTab) {
            case 'buddies':
                return (
                    <div className="space-y-4">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input 
                                type="search" 
                                value={buddySearchQuery} 
                                onChange={e => setBuddySearchQuery(e.target.value)} 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                                placeholder="Sök bland dina kompisar..."
                            />
                        </div>
                        {filteredBuddyDetails.length === 0 ? (
                            <p className="text-sm text-neutral text-center py-8">
                                {buddySearchQuery ? 'Inga kompisar matchade din sökning.' : 'Du har inga kompisar än.'}
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredBuddyDetails.map(buddy => (
                                    <BuddyCard
                                        key={buddy.uid}
                                        buddy={buddy}
                                        onRemove={() => handleRemoveBuddyRequest(buddy)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'search':
                return (
                    <div className="animate-fade-in space-y-4">
                        <button
                            onClick={() => setShowInviteOptionsModal(true)}
                            className="w-full flex items-center justify-center px-5 py-3 bg-primary hover:bg-primary-darker text-white text-lg font-medium rounded-xl shadow-sm active:scale-95 interactive-transition"
                        >
                            Bjud in en vän
                        </button>
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                             <input 
                                type="search" 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                                placeholder="Sök bland användare..."
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            {searchResults.map(user => {
                                const isBuddy = buddyDetails.some(b => b.uid === user.uid);
                                const hasPendingRequest = outgoingRequests.some(r => r.toUid === user.uid);
                                return (
                                    <div key={user.uid} className="flex items-center justify-between bg-white p-2 rounded-md border border-neutral-light">
                                        <div className="flex items-center gap-2">
                                            <Avatar photoURL={user.photoURL} gender={user.gender} size={32} />
                                            <p className="font-semibold text-neutral-dark text-sm">{user.name}</p>
                                        </div>
                                        {isBuddy ? ( <span className="text-xs font-semibold text-primary px-2 py-1 bg-primary-100 rounded-full">Kompis</span>
                                        ) : hasPendingRequest ? ( <span className="text-xs font-semibold text-yellow-600 px-2 py-1 bg-yellow-100 rounded-full">Väntar</span>
                                        ) : ( <button onClick={() => handleSendRequest(user)} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title={`Skicka förfrågan`}><UserPlusIcon className="w-5 h-5" /></button> )}
                                    </div>
                                );
                            })}
                             {searchQuery && searchResults.length === 0 && (
                                <p className="text-sm text-neutral text-center py-4">Inga användare matchade din sökning.</p>
                            )}
                        </div>
                    </div>
                );
            case 'requests':
                return (
                    <div className="space-y-4 bg-white p-4 rounded-lg border border-neutral-light">
                        <h4 className="font-semibold">Inkommande ({requests.length})</h4>
                        {requests.length > 0 ? requests.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-neutral-light p-2 rounded-lg">
                                <p className="font-semibold text-sm">{req.fromName}</p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleRequestAction(req, 'declined')} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><XMarkIcon className="w-5 h-5" /></button>
                                    <button onClick={() => handleRequestAction(req, 'accepted')} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><CheckIcon className="w-5 h-5" /></button>
                                </div>
                            </div>
                        )) : <p className="text-sm text-neutral">Inga nya förfrågningar.</p>}
                         <h4 className="font-semibold pt-2 border-t">Utgående ({outgoingRequests.length})</h4>
                        {outgoingRequests.length > 0 ? outgoingRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-neutral-light p-2 rounded-lg">
                                <p className="font-semibold text-sm">{allSearchableUsers.find(u => u.uid === req.toUid)?.name || 'Okänd'}</p>
                                <button onClick={() => handleCancelRequest(req.id)} className="text-xs font-semibold text-red-600 px-2 py-1 bg-red-100 rounded-full hover:bg-red-200">Avbryt</button>
                            </div>
                        )) : <p className="text-sm text-neutral">Inga utgående förfrågningar.</p>}
                    </div>
                );
        }
    };

    return (
        <div className="p-4 flex flex-col h-full">
            <div className="flex-shrink-0">
                <nav className="flex -mb-px border-b border-neutral-light">
                    <button onClick={() => setActiveTab('buddies')} className={`py-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'buddies' ? 'border-primary text-primary' : 'border-transparent text-neutral hover:text-primary'}`}>Mina kompisar</button>
                    <button onClick={() => setActiveTab('search')} className={`py-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'search' ? 'border-primary text-primary' : 'border-transparent text-neutral hover:text-primary'}`}>Hitta kompisar</button>
                    <button onClick={() => setActiveTab('requests')} className={`relative py-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'requests' ? 'border-primary text-primary' : 'border-transparent text-neutral hover:text-primary'}`}>
                        Förfrågningar
                        {requests.length > 0 && <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{requests.length}</span>}
                    </button>
                </nav>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar mt-4">
                {renderTabContent()}
            </div>
            {buddyToRemove && (
                <div
                    className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in"
                    onClick={() => setBuddyToRemove(null)}
                    role="dialog" aria-modal="true" aria-labelledby="confirm-remove-buddy-title"
                >
                    <div className="bg-white p-6 rounded-3xl shadow-soft-xl w-full max-w-sm animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 id="confirm-remove-buddy-title" className="text-lg font-semibold text-neutral-dark mb-4">Bekräfta borttagning</h3>
                        <p className="text-neutral mb-6">Är du säker på att du vill ta bort <strong>{buddyToRemove.name}</strong> som Peppkompis?</p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setBuddyToRemove(null)} className="px-5 py-2.5 text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-xl active:scale-95 interactive-transition font-medium">Avbryt</button>
                            <button onClick={confirmRemoveBuddy} className="px-5 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-xl active:scale-95 interactive-transition font-medium">Ja, ta bort</button>
                        </div>
                    </div>
                </div>
            )}
            {showInviteOptionsModal && (
                <div
                    className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in"
                    onClick={() => setShowInviteOptionsModal(false)}
                >
                    <div className="bg-white p-6 rounded-3xl shadow-soft-xl w-full max-w-sm animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-neutral-dark mb-4">Bjud in en vän</h3>
                        <div className="space-y-3">
                            <button onClick={handleShareViaApp} className="w-full flex items-center justify-center px-4 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-xl shadow-sm active:scale-95 interactive-transition">
                                <ShareIcon className="w-5 h-5 mr-2" /> Dela via app
                            </button>
                             <p className="text-xs text-neutral text-center">Obs: Vissa appar som Messenger kan ignorera texten.</p>
                            <button
                                onClick={handleCopyToClipboard}
                                disabled={isCopied}
                                className="w-full flex items-center justify-center px-4 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-xl shadow-sm disabled:bg-green-100 disabled:text-green-700 active:scale-95 interactive-transition"
                            >
                                <PencilIcon className="w-5 h-5 mr-2" /> {isCopied ? 'Kopierad!' : 'Kopiera inbjudningstext'}
                            </button>
                        </div>
                         <button onClick={() => setShowInviteOptionsModal(false)} className="mt-4 w-full py-2 text-sm text-neutral hover:underline">
                            Stäng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const renderWeightDescription = (description: string) => {
    const parts = description.split('\n'); // Split by newline
    return (
        <div className="space-y-1 mt-2">
            {parts.map(part => {
                const match = part.match(/(Vikt|Muskler|Fett):\s*([\d,.]+\s*kg)\s*\(([-+±\d,]+)\)/);
                if (!match) {
                    return <p key={part} className="text-base text-neutral-dark">{part}</p>;
                }
                
                const label = match[1];
                const value = match[2];
                const changeStr = match[3];
                const changeNum = parseFloat(changeStr.replace(',', '.'));

                let colorClass = 'text-accent'; // Neutral/yellow for ±0,0
                if (changeNum > 0) {
                    if (label === 'Muskler') colorClass = 'text-primary'; // Green for muscle increase
                    else colorClass = 'text-red-600'; // Red for weight/fat increase
                } else if (changeNum < 0) {
                    if (label === 'Muskler') colorClass = 'text-red-600'; // Red for muscle decrease
                    else colorClass = 'text-primary'; // Green for weight/fat decrease
                }

                return (
                    <p key={label} className="text-base text-neutral-dark">
                        <span className="font-medium">{label}:</span> {value} <span className={`font-bold ${colorClass}`}>({changeStr})</span>
                    </p>
                );
            })}
        </div>
    );
};

const TimelineEventCard: FC<{
    event: TimelineEvent;
    currentUser: User;
    userProfile: UserProfileData;
    onTogglePepp: (event: TimelineEvent, emoji: string) => void;
    onAddComment: (event: TimelineEvent, text: string) => Promise<void>;
    onToggleLike: (event: TimelineEvent, commentId: string) => void;
    lastViewTimestamp: number | null;
}> = ({ event, currentUser, userProfile, onTogglePepp, onAddComment, onToggleLike, lastViewTimestamp }) => {
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || isSubmitting) return;
        setIsSubmitting(true);
        await onAddComment(event, newComment);
        setNewComment('');
        setIsSubmitting(false);
    };
    
    const reactions = ['👍', '💪', '🔥', '🎉', '❤️'];
    const isNewEvent = lastViewTimestamp !== null && event.timestamp > lastViewTimestamp && event.userId !== currentUser.uid;

    return (
    <div id={`event-${event.id}`} className={`p-3 rounded-xl shadow-sm border transition-colors duration-500 ease-out ${isNewEvent ? 'bg-green-100/60 border-green-200' : 'bg-white border-neutral-light/60'}`}>
        <div className="flex items-start gap-3">
            <Avatar photoURL={event.userPhotoURL} gender={event.gender} size={40} />
            <div className="flex-1">
                <p className="text-sm">
                    <span className="font-bold">{event.userId === currentUser.uid ? 'Du' : event.userName}</span> {event.title}
                </p>
                <p className="text-xs text-neutral">{new Date(event.timestamp).toLocaleString('sv-SE', {dateStyle: 'short', timeStyle: 'short'})}</p>
                
                {event.type === 'weight' ? (
                    renderWeightDescription(event.description)
                ) : (
                    <p className="text-sm text-neutral-dark mt-1">{event.description}</p>
                )}
            </div>
        </div>

            <div className="flex flex-wrap items-center gap-1 mt-3 pt-2 border-t border-neutral-light/50 ml-[52px]">
                {reactions.map(emoji => {
                    const usersWhoReacted = (event.reactions || {})[emoji] || {};
                    const count = Object.keys(usersWhoReacted).length;
                    const hasReacted = !!usersWhoReacted[currentUser.uid];

                    return (
                        <button 
                            key={emoji} 
                            onClick={() => onTogglePepp(event, emoji)} 
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm transition-all active:scale-95 border
                                ${hasReacted 
                                    ? 'bg-primary-100 border-primary text-primary-darker' 
                                    : 'bg-neutral-light/70 border-neutral-light/70 hover:bg-neutral-light text-neutral-dark'
                                }`}
                        >
                            <span className="text-lg">{emoji}</span>
                            {count > 0 && <span className="font-semibold text-xs">{count}</span>}
                        </button>
                    )
                })}
            </div>
            
            <div className="space-y-2 mt-3 ml-[52px]">
                {(event.comments || []).map(comment => {
                    const likes = comment.likes || {};
                    const likeCount = Object.keys(likes).length;
                    const userHasLiked = !!likes[currentUser.uid];
                    const isNewComment = lastViewTimestamp !== null && comment.timestamp > lastViewTimestamp && comment.authorUid !== currentUser.uid;

                    return (
                        <div key={comment.id} className="flex items-start gap-2">
                            <Avatar photoURL={comment.authorPhotoURL} size={28} />
                            <div onDoubleClick={() => onToggleLike(event, comment.id)} className={`rounded-lg px-3 py-1.5 text-sm flex-1 group relative cursor-pointer transition-colors duration-500 ease-out ${isNewComment ? 'bg-green-100/50' : 'bg-neutral-light/70'}`}>
                                <p className="font-semibold text-neutral-dark">{comment.authorUid === currentUser.uid ? 'Du' : comment.authorName}</p>
                                <p className="text-neutral-dark break-words">{comment.text}</p>
                                
                                <div className="absolute -bottom-3 -right-2 flex items-center gap-1 bg-white rounded-full p-0.5 shadow-sm border border-neutral-light/50">
                                    <button 
                                        onClick={() => onToggleLike(event, comment.id)}
                                        className={`p-1 rounded-full transition-colors ${userHasLiked ? 'text-red-500' : 'text-neutral hover:text-red-500'}`}
                                        aria-label="Gilla kommentar"
                                    >
                                        <HeartIcon className={`w-4 h-4 ${userHasLiked ? 'fill-current' : 'fill-none'}`} style={{ stroke: 'currentColor', strokeWidth: 2 }} />
                                    </button>
                                    {likeCount > 0 && (
                                        <span className="text-xs font-semibold text-neutral-dark pr-1.5">{likeCount}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 mt-3 pt-2 border-t border-neutral-light/50">
                 <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={32} />
                 <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm bg-neutral-light rounded-full border border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Skriv en kommentar..."
                 />
                 <button type="submit" disabled={isSubmitting || !newComment.trim()} className="p-2 text-primary rounded-full disabled:opacity-50 hover:bg-primary-100">
                    <ArrowRightIcon className="w-5 h-5" />
                 </button>
            </form>
        </div>
    );
};


export const CommunityView: React.FC<{ 
  key: number;
  currentUser: User;
  userProfile: UserProfileData;
  achievements: Achievement[];
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  pendingRequestsCount: number;
  initialTab?: 'flode' | 'hantera';
  initialSubTab?: 'buddies' | 'search' | 'requests';
  highlightEventId?: string | null;
  timelineEvents: TimelineEvent[];
  setTimelineEvents: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
  buddyDetails: BuddyDetails[];
  isLoading: boolean;
  onDataChanged: () => void;
  lastViewTimestamp: number | null;
}> = ({ 
  currentUser,
  userProfile,
  achievements,
  setToastNotification,
  pendingRequestsCount,
  initialTab = 'flode',
  initialSubTab = 'buddies',
  highlightEventId = null,
  timelineEvents,
  setTimelineEvents,
  buddyDetails,
  isLoading,
  onDataChanged,
  lastViewTimestamp
}) => {
  const [activeTab, setActiveTab] = useState<'flode' | 'hantera'>(initialTab);
    
    const handleTogglePepp = async (event: TimelineEvent, newEmoji: string) => {
        if (!event.id) return;
        playAudio('uiClick', 0.6);
        const fromUser = { uid: currentUser.uid, name: userProfile.name || 'En kompis' };
        
        const originalEvents = timelineEvents;
        setTimelineEvents(prevEvents => prevEvents.map(e => {
            if (e.id === event.id) {
                const newReactions: Reactions = JSON.parse(JSON.stringify(e.reactions || {}));
                let previousReactionEmoji: string | null = null;
                for (const emojiKey in newReactions) {
                    if (newReactions[emojiKey]?.[fromUser.uid]) {
                        previousReactionEmoji = emojiKey;
                        break;
                    }
                }
                if (previousReactionEmoji) {
                    delete newReactions[previousReactionEmoji][fromUser.uid];
                    if (Object.keys(newReactions[previousReactionEmoji]).length === 0) {
                        delete newReactions[previousReactionEmoji];
                    }
                }
                if (previousReactionEmoji !== newEmoji) {
                    if (!newReactions[newEmoji]) newReactions[newEmoji] = {};
                    newReactions[newEmoji][fromUser.uid] = fromUser.name;
                }
                return { ...e, reactions: newReactions };
            }
            return e;
        }));

        try { 
            await togglePeppOnTimelineEvent(fromUser, event, newEmoji); 
        } catch (error) {
            setToastNotification({ message: 'Kunde inte skicka reaktion.', type: 'error' });
            setTimelineEvents(originalEvents);
        }
    };
    
    const handleToggleLike = async (event: TimelineEvent, commentId: string) => {
        playAudio('uiClick', 0.5);
        const fromUser = { uid: currentUser.uid, name: userProfile.name || 'En kompis' };
        
        const originalEvents = timelineEvents;
        setTimelineEvents(prevEvents => prevEvents.map(e => {
            if (e.id === event.id) {
                const newComments = (e.comments || []).map(c => {
                    if (c.id === commentId) {
                        const newLikes = { ...(c.likes || {}) };
                        if (newLikes[fromUser.uid]) delete newLikes[fromUser.uid];
                        else newLikes[fromUser.uid] = fromUser.name;
                        return { ...c, likes: newLikes };
                    }
                    return c;
                });
                return { ...e, comments: newComments };
            }
            return e;
        }));
        
        try { await toggleLikeOnComment(fromUser, event, commentId); } catch (error) {
            setToastNotification({ message: 'Kunde inte gilla kommentar.', type: 'error' });
            setTimelineEvents(originalEvents);
        }
    };
    
    const handleAddComment = async (event: TimelineEvent, text: string) => {
        if (!text.trim()) return;
        playAudio('uiClick');
        const clientTimestamp = Date.now();
        const optimisticComment: TimelineComment = { 
            id: `local-${clientTimestamp}`, 
            authorUid: currentUser.uid, 
            authorName: userProfile.name || 'Användare', 
            authorPhotoURL: userProfile.photoURL, 
            text: text.trim(), 
            timestamp: clientTimestamp, 
            likes: {} 
        };
        
        const originalEvents = timelineEvents;
        setTimelineEvents(prevEvents => prevEvents.map(e => 
            e.id === event.id ? { ...e, comments: [...(e.comments || []), optimisticComment] } : e
        ));

        try {
            const commentDataForFirestore = { 
                authorUid: optimisticComment.authorUid, 
                authorName: optimisticComment.authorName, 
                authorPhotoURL: optimisticComment.authorPhotoURL, 
                text: optimisticComment.text, 
                timestamp: optimisticComment.timestamp,
                likes: optimisticComment.likes,
            };
            const newCommentId = await addCommentToTimelineEvent(event.id, commentDataForFirestore);
            setTimelineEvents(prevEvents => prevEvents.map(e => {
                if (e.id === event.id) {
                    return { ...e, comments: (e.comments || []).map(c => c.id === optimisticComment.id ? { ...c, id: newCommentId } : c) };
                }
                return e;
            }));
        } catch (error) {
            setToastNotification({ message: 'Kunde inte lägga till kommentar.', type: 'error' });
            setTimelineEvents(originalEvents);
        }
    };
    
    const newEventsCount = useMemo(() => {
        if (!lastViewTimestamp) return 0;
        const updatedEventIds = new Set<string>();
        timelineEvents.forEach(event => {
            let hasNewActivity = false;
            if (event.userId !== currentUser.uid && event.timestamp > lastViewTimestamp) {
                hasNewActivity = true;
            }
            (event.comments || []).forEach(comment => {
                if (comment.authorUid !== currentUser.uid && comment.timestamp > lastViewTimestamp) {
                    hasNewActivity = true;
                }
            });

            if (hasNewActivity) {
                updatedEventIds.add(event.id);
            }
        });
        return updatedEventIds.size;
    }, [timelineEvents, lastViewTimestamp, currentUser.uid]);


    const tabs = [
        { key: 'flode', label: 'Flöde', notificationCount: newEventsCount },
        { key: 'hantera', label: 'Kompisar', notificationCount: pendingRequestsCount },
    ];
    
    const TabButton: FC<{ tab: typeof tabs[0], isActive: boolean, onClick: () => void }> = ({ tab, isActive, onClick }) => (
        <button onClick={onClick} className={`relative flex-1 py-4 px-1 text-center font-semibold border-b-4 transition-colors ${isActive ? 'border-primary text-primary' : 'border-transparent text-neutral hover:text-primary-lighter'}`}>
            <span className="text-sm">{tab.label}</span>
            {tab.notificationCount > 0 && <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center ring-2 ring-white">{tab.notificationCount > 9 ? '9+' : tab.notificationCount}</span>}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-white">
            <header className="flex-shrink-0 bg-white shadow-md z-10">
                <nav className="flex items-center justify-around">
                    {tabs.map(tab => <TabButton key={tab.key} tab={tab} isActive={activeTab === tab.key} onClick={() => setActiveTab(tab.key as any)} />)}
                </nav>
            </header>
            
            <main className="flex-grow overflow-y-auto bg-neutral-light/50">
                {activeTab === 'flode' && (
                    <div className="p-2 sm:p-4 space-y-4">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full py-16"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div></div>
                        ) : timelineEvents.length > 0 ? (
                            timelineEvents.map(event => (
                                <TimelineEventCard 
                                    key={`${event.id}-${event.timestamp}`}
                                    event={event}
                                    currentUser={currentUser}
                                    userProfile={userProfile}
                                    onTogglePepp={handleTogglePepp}
                                    onAddComment={handleAddComment}
                                    onToggleLike={handleToggleLike}
                                    lastViewTimestamp={lastViewTimestamp}
                                />
                            ))
                        ) : (
                            <div className="text-center py-16 px-4">
                                <h3 className="text-xl font-semibold text-neutral-dark">Ditt flöde är tomt!</h3>
                                <p className="text-neutral mt-2">När du och dina kompisar loggar mätningar, når nya nivåer eller klarar era mål kommer det att dyka upp här. Hitta och lägg till kompisar för att komma igång!</p>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'hantera' && (
                     <FriendManagementView 
                        currentUser={currentUser} 
                        userProfile={userProfile}
                        setToastNotification={setToastNotification}
                        onDataChanged={onDataChanged}
                        buddyDetails={buddyDetails}
                        achievements={achievements}
                        initialTab={initialSubTab}
                    />
                )}
            </main>
        </div>
    );
};