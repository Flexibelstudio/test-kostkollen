import React, { useState, useEffect, useCallback, FC, useMemo } from 'react';
import type { User } from '@firebase/auth';
import { Peppkompis, BuddyDetails, Achievement, PeppkompisRequest } from '../types';
import { 
    fetchBuddyDetailsList, 
    fetchFriendRequests, 
    searchForBuddies,
    sendFriendRequest,
    updateFriendRequestStatus,
    removeBuddy,
    fetchBuddies,
    fetchOutgoingFriendRequests
} from '../services/firestoreService';
import { UserPlusIcon, XMarkIcon, SearchIcon, CheckIcon } from './icons';
import BuddyListView from './BuddyListView';
import LoadingSpinner from './LoadingSpinner';
import { Avatar } from './UserProfileModal';


const FriendManagementModal: FC<{
    currentUser: User;
    onClose: () => void;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    onDataChanged: () => void;
}> = ({ currentUser, onClose, setToastNotification, onDataChanged }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [allSearchableUsers, setAllSearchableUsers] = useState<Peppkompis[]>([]);
    const [requests, setRequests] = useState<PeppkompisRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<PeppkompisRequest[]>([]);
    const [buddies, setBuddies] = useState<Peppkompis[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoadingData(true);
        try {
            const [reqs, outReqs, budds, allUsers] = await Promise.all([
                fetchFriendRequests(currentUser.uid),
                fetchOutgoingFriendRequests(currentUser.uid),
                fetchBuddies(currentUser.uid),
                searchForBuddies(currentUser.uid),
            ]);
            setRequests(reqs);
            setOutgoingRequests(outReqs);
            setBuddies(budds);
            setAllSearchableUsers(allUsers);
        } catch (error) {
            setToastNotification({ message: "Kunde inte ladda kompisdata.", type: 'error' });
        } finally {
            setIsLoadingData(false);
        }
    }, [currentUser.uid, setToastNotification]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return allSearchableUsers;
        return allSearchableUsers.filter(user =>
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
        );
    }, [searchQuery, allSearchableUsers]);
    
    const handleSendRequest = async (toUser: Peppkompis) => {
        try {
            await sendFriendRequest({ uid: currentUser.uid, name: currentUser.displayName || 'En användare', email: currentUser.email || '' }, toUser.uid);
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
            fetchData();
            onDataChanged(); // Notify parent to refetch data
            setToastNotification({ message: `Förfrågan ${status === 'accepted' ? 'godkänd' : 'avvisad'}.`, type: 'success' });
        } catch (error) {
            setToastNotification({ message: 'Kunde inte hantera förfrågan.', type: 'error' });
        }
    };

    const handleRemoveBuddy = async (buddyUid: string, buddyName: string) => {
        if (window.confirm(`Är du säker på att du vill ta bort ${buddyName} som Peppkompis?`)) {
            try {
                await removeBuddy(currentUser.uid, buddyUid);
                fetchData();
                onDataChanged(); // Notify parent to refetch data
                setToastNotification({ message: `${buddyName} har tagits bort.`, type: 'success' });
            } catch (error) {
                setToastNotification({ message: 'Kunde inte ta bort kompis.', type: 'error' });
            }
        }
    };


    return (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white p-6 rounded-xl shadow-soft-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-neutral-dark flex items-center">
                        <UserPlusIcon className="w-6 h-6 mr-2 text-primary" />
                        Hitta & Hantera Kompisar
                    </h2>
                     <button onClick={onClose} className="p-2 text-neutral hover:text-red-500 rounded-full active:scale-90"><XMarkIcon className="w-6 h-6" /></button>
                </header>
                <div className="overflow-y-auto custom-scrollbar space-y-4">
                    <section className="border-t pt-4">
                        {!isSearching ? (
                            <button 
                                onClick={() => setIsSearching(true)} 
                                className="w-full flex items-center justify-center gap-2 p-3 bg-neutral-light hover:bg-gray-200 text-neutral-dark font-semibold rounded-lg interactive-transition"
                            >
                                <SearchIcon className="w-5 h-5" /> Sök efter nya kompisar
                            </button>
                        ) : (
                            <div className="animate-fade-in">
                                <label htmlFor="buddySearch" className="block text-sm font-medium text-neutral-dark mb-1">Sök efter användare</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <SearchIcon className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <input id="buddySearch" type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md" placeholder="Sök på namn eller e-post..." autoFocus/>
                                </div>
                                {/* Search Results Section */}
                                <div className="mt-4">
                                    <h3 className="text-base font-semibold text-neutral-dark mb-2">
                                        {searchQuery ? `Sökresultat` : 'Sökbara användare'} ({searchResults.length})
                                    </h3>
                                    {isLoadingData ? (
                                        <p className="text-sm text-neutral mt-2">Laddar användare...</p>
                                    ) : searchResults.length > 0 ? (
                                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                            {searchResults.map(user => {
                                                const isBuddy = buddies.some(b => b.uid === user.uid);
                                                const hasPendingRequest = outgoingRequests.some(r => r.toUid === user.uid);
                                                return (
                                                    <div key={user.uid} className="flex items-center justify-between bg-neutral-light/60 p-2 rounded-md">
                                                        <div className="flex items-center gap-2">
                                                            <Avatar photoURL={user.photoURL} gender={user.gender} size={32} />
                                                            <div>
                                                                <p className="font-semibold text-neutral-dark text-sm">{user.name}</p>
                                                                <p className="text-xs text-neutral">{user.email}</p>
                                                            </div>
                                                        </div>
                                                        {isBuddy ? (
                                                        <span className="text-xs font-semibold text-primary px-2 py-1 bg-primary-100 rounded-full">Kompis</span>
                                                        ) : hasPendingRequest ? (
                                                        <span className="text-xs font-semibold text-yellow-600 px-2 py-1 bg-yellow-100 rounded-full">Väntar</span>
                                                        ) : (
                                                        <button onClick={() => handleSendRequest(user)} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title={`Skicka kompis-förfrågan till ${user.name}`}><UserPlusIcon className="w-5 h-5" /></button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-neutral mt-2">Inga användare hittades.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>


                     {/* Requests Section */}
                     {requests.length > 0 && (
                        <section className="border-t pt-4">
                            <h3 className="text-base font-semibold text-neutral-dark">Inkommande förfrågningar ({requests.length})</h3>
                            <div className="space-y-2 mt-2">
                                {requests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between bg-neutral-light p-3 rounded-lg">
                                        <div>
                                            <p className="font-semibold text-neutral-dark">{req.fromName}</p>
                                            <p className="text-sm text-neutral">{req.fromEmail}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleRequestAction(req, 'declined')} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><XMarkIcon className="w-5 h-5" /></button>
                                            <button onClick={() => handleRequestAction(req, 'accepted')} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><CheckIcon className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                    {/* Buddy List Section */}
                    {!isSearching && (
                        <section className="border-t pt-4">
                            <h3 className="text-base font-semibold text-neutral-dark">Mina Peppkompisar ({buddies.length})</h3>
                            <div className="space-y-2 mt-2">
                                {buddies.length === 0 ? <p className="text-sm text-neutral">Du har inga kompisar än.</p> : buddies.map(buddy => (
                                    <div key={buddy.uid} className="flex items-center justify-between bg-neutral-light p-3 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Avatar photoURL={buddy.photoURL} gender={buddy.gender} size={32} />
                                            <div>
                                                <p className="font-semibold text-neutral-dark text-sm">{buddy.name}</p>
                                                <p className="text-xs text-neutral">{buddy.email}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleRemoveBuddy(buddy.uid, buddy.name)} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title={`Ta bort ${buddy.name}`}><UserPlusIcon className="w-5 h-5" style={{ transform: 'rotate(45deg)' }}/></button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};


interface BuddySystemViewProps {
    currentUser: User;
    achievements: Achievement[];
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    pendingRequestsCount: number;
    onDataChanged: () => void;
    onStartChat: (buddy: Peppkompis) => void;
}

const BuddySystemView: React.FC<BuddySystemViewProps> = ({ currentUser, achievements, setToastNotification, pendingRequestsCount, onDataChanged, onStartChat }) => {
    const [buddies, setBuddies] = useState<BuddyDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showFriendManagement, setShowFriendManagement] = useState(false);

    const loadBuddies = useCallback(async () => {
        setIsLoading(true);
        try {
            const buddyDetails = await fetchBuddyDetailsList(currentUser.uid);
            setBuddies(buddyDetails);
        } catch (error) {
            setToastNotification({ message: "Kunde inte ladda kompislista.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [currentUser.uid, setToastNotification]);

    useEffect(() => {
        loadBuddies();
    }, [loadBuddies]);

    const handleDataChangedAndReload = () => {
        onDataChanged(); // Notify parent
        loadBuddies();   // Also reload self
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-neutral-dark">Mina Peppkompisar</h3>
                <button
                    onClick={() => setShowFriendManagement(true)}
                    className="relative flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg shadow-sm hover:bg-primary-darker interactive-transition"
                >
                    <UserPlusIcon className="w-5 h-5" />
                    Hitta/Hantera
                    {pendingRequestsCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold ring-1 ring-white">
                            {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                        </span>
                    )}
                </button>
            </div>
            {isLoading ? (
                <div className="flex justify-center items-center py-10"><LoadingSpinner message="Laddar kompisar..." /></div>
            ) : (
                <BuddyListView buddies={buddies} currentUser={currentUser} setToastNotification={setToastNotification} onStartChat={onStartChat} />
            )}
            {showFriendManagement && (
                <FriendManagementModal
                    currentUser={currentUser}
                    onClose={() => setShowFriendManagement(false)}
                    setToastNotification={setToastNotification}
                    onDataChanged={handleDataChangedAndReload}
                />
            )}
        </div>
    );
};

export default BuddySystemView;