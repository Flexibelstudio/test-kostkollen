import React, { useState, useEffect, useCallback } from 'react';
import type { User } from '@firebase/auth';
import { Peppkompis, PeppkompisRequest } from '../types';
import { updateUserSearchableStatus, searchUserByEmail, sendFriendRequest, fetchFriendRequests, updateFriendRequestStatus, fetchBuddies, removeBuddy } from '../services/firestoreService';
import { UserGroupIcon, SearchIcon, CheckIcon, XMarkIcon, UserPlusIcon, TrashIcon, EyeIcon } from './icons';
import BuddyLogView from './BuddyLogView';

interface BuddySystemViewProps {
    currentUser: User;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const BuddySystemView: React.FC<BuddySystemViewProps> = ({ currentUser, setToastNotification }) => {
    const [isSearchable, setIsSearchable] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [searchEmail, setSearchEmail] = useState('');
    const [searchResult, setSearchResult] = useState<Peppkompis | null | 'not_found'>(null);
    const [isSearching, setIsSearching] = useState(false);
    
    const [requests, setRequests] = useState<PeppkompisRequest[]>([]);
    const [buddies, setBuddies] = useState<Peppkompis[]>([]);

    const [selectedBuddy, setSelectedBuddy] = useState<Peppkompis | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [reqs, budds, searchableStatus] = await Promise.all([
                fetchFriendRequests(currentUser.uid),
                fetchBuddies(currentUser.uid),
                updateUserSearchableStatus(currentUser.uid) // Also fetches current status
            ]);
            setRequests(reqs);
            setBuddies(budds);
            setIsSearchable(searchableStatus);
        } catch (error) {
            console.error("Error fetching buddy data:", error);
            setToastNotification({ message: 'Kunde inte ladda Peppkompis-data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [currentUser.uid, setToastNotification]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleSearchable = async (newStatus: boolean) => {
        setIsSearchable(newStatus);
        try {
            await updateUserSearchableStatus(currentUser.uid, newStatus);
            setToastNotification({ message: `Din synlighet har ${newStatus ? 'aktiverats' : 'avaktiverats'}.`, type: 'success' });
        } catch (error) {
            console.error("Error updating searchable status:", error);
            setToastNotification({ message: 'Kunde inte uppdatera synlighet.', type: 'error' });
            setIsSearchable(!newStatus); // Revert on error
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchEmail.trim()) return;
        setIsSearching(true);
        setSearchResult(null);
        try {
            const result = await searchUserByEmail(searchEmail, currentUser.uid);
            setSearchResult(result || 'not_found');
        } catch (error) {
            console.error("Error searching user:", error);
            setToastNotification({ message: 'Ett fel uppstod vid sökning.', type: 'error' });
        } finally {
            setIsSearching(false);
        }
    };

    const handleSendRequest = async (toUserUid: string) => {
        try {
            await sendFriendRequest({ uid: currentUser.uid, name: currentUser.displayName || 'En användare', email: currentUser.email || '' }, toUserUid);
            setToastNotification({ message: 'Förfrågan skickad!', type: 'success' });
            setSearchResult(null);
            setSearchEmail('');
        } catch (error) {
            console.error("Error sending request:", error);
            setToastNotification({ message: (error as Error).message || 'Kunde inte skicka förfrågan.', type: 'error' });
        }
    };

    const handleRequestAction = async (request: PeppkompisRequest, status: 'accepted' | 'declined') => {
        try {
            await updateFriendRequestStatus(request, status);
            setRequests(prev => prev.filter(r => r.id !== request.id));
            if (status === 'accepted') {
                setBuddies(prev => [...prev, { uid: request.fromUid, name: request.fromName, email: request.fromEmail }]);
                setToastNotification({ message: `Du är nu Peppkompis med ${request.fromName}!`, type: 'success' });
            } else {
                 setToastNotification({ message: `Förfrågan från ${request.fromName} har avvisats.`, type: 'success' });
            }
        } catch (error) {
             console.error("Error handling request:", error);
             setToastNotification({ message: 'Kunde inte hantera förfrågan.', type: 'error' });
        }
    };

    const handleRemoveBuddy = async (buddyUid: string, buddyName: string) => {
        if (window.confirm(`Är du säker på att du vill ta bort ${buddyName} som Peppkompis?`)) {
            try {
                await removeBuddy(currentUser.uid, buddyUid);
                setBuddies(prev => prev.filter(b => b.uid !== buddyUid));
                setToastNotification({ message: `${buddyName} har tagits bort från dina Peppkompisar.`, type: 'success' });
            } catch (error) {
                console.error("Error removing buddy:", error);
                setToastNotification({ message: 'Kunde inte ta bort Peppkompis.', type: 'error' });
            }
        }
    };

    return (
        <>
            <div className="space-y-6">
                <section className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
                    <h3 className="text-xl font-semibold text-neutral-dark mb-3">Min Status</h3>
                    <div className="flex items-center justify-between bg-neutral-light p-3 rounded-lg">
                        <label htmlFor="searchableToggle" className="text-base font-medium text-neutral-dark">Gör mig sökbar via e-post</label>
                        <button
                            id="searchableToggle"
                            role="switch"
                            aria-checked={isSearchable}
                            onClick={() => handleToggleSearchable(!isSearchable)}
                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${isSearchable ? 'bg-primary' : 'bg-gray-400'}`}
                        >
                            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isSearchable ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </section>

                <section className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
                    <h3 className="text-xl font-semibold text-neutral-dark mb-3">Hitta en Peppkompis</h3>
                    <form onSubmit={handleSearch}>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="email"
                                value={searchEmail}
                                onChange={e => setSearchEmail(e.target.value)}
                                placeholder="Ange e-postadress..."
                                className="flex-grow px-4 py-2 bg-white border border-neutral-light rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-base"
                                disabled={isSearching}
                            />
                            <button
                                type="submit"
                                disabled={!searchEmail.trim() || isSearching}
                                className="px-5 py-2 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-lg shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center"
                            >
                                <SearchIcon className="w-5 h-5 mr-2" />
                                {isSearching ? 'Söker...' : 'Sök'}
                            </button>
                        </div>
                    </form>
                    {searchResult && (
                        <div className="mt-4 p-3 border-t border-neutral-light">
                            {searchResult === 'not_found' ? (
                                <p className="text-neutral text-center">Ingen användare hittades med den e-postadressen eller så är de inte sökbara.</p>
                            ) : (
                                <div className="flex items-center justify-between bg-primary-100/50 p-3 rounded-md">
                                    <div>
                                        <p className="font-semibold text-neutral-dark">{searchResult.name}</p>
                                        <p className="text-sm text-neutral">{searchResult.email}</p>
                                    </div>
                                    <button onClick={() => handleSendRequest(searchResult.uid)} className="p-2 text-primary hover:text-white hover:bg-primary rounded-full active:scale-90 transition-colors">
                                        <UserPlusIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <section className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
                    <h3 className="text-xl font-semibold text-neutral-dark mb-3">Inkommande förfrågningar ({requests.length})</h3>
                    <div className="space-y-3">
                        {isLoading ? (
                            <p className="text-neutral text-center">Laddar...</p>
                        ) : requests.length === 0 ? (
                            <p className="text-neutral text-center">Inga nya förfrågningar.</p>
                        ) : (
                            requests.map(req => (
                                <div key={req.id} className="flex items-center justify-between bg-neutral-light p-3 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-neutral-dark">{req.fromName}</p>
                                        <p className="text-sm text-neutral">{req.fromEmail}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleRequestAction(req, 'declined')} className="p-2 text-red-600 hover:bg-red-100 rounded-full active:scale-90 transition-colors" aria-label="Avvisa">
                                            <XMarkIcon className="w-6 h-6" />
                                        </button>
                                        <button onClick={() => handleRequestAction(req, 'accepted')} className="p-2 text-green-600 hover:bg-green-100 rounded-full active:scale-90 transition-colors" aria-label="Godkänn">
                                            <CheckIcon className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
                    <h3 className="text-xl font-semibold text-neutral-dark mb-3">Mina Peppkompisar ({buddies.length})</h3>
                    <div className="space-y-3">
                        {isLoading ? (
                            <p className="text-neutral text-center">Laddar...</p>
                        ) : buddies.length === 0 ? (
                            <p className="text-neutral text-center">Du har inga Peppkompisar ännu. Hitta en kompis för att komma igång!</p>
                        ) : (
                            buddies.map(buddy => (
                                <div key={buddy.uid} className="flex items-center justify-between bg-neutral-light p-3 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-neutral-dark">{buddy.name}</p>
                                        <p className="text-sm text-neutral">{buddy.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                         <button onClick={() => setSelectedBuddy(buddy)} className="p-2 text-primary hover:bg-primary-100 rounded-full active:scale-90 transition-colors" aria-label="Visa sammanfattning">
                                            <EyeIcon className="w-6 h-6" />
                                        </button>
                                        <button onClick={() => handleRemoveBuddy(buddy.uid, buddy.name)} className="p-2 text-red-600 hover:bg-red-100 rounded-full active:scale-90 transition-colors" aria-label="Ta bort">
                                            <TrashIcon className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

            </div>

            {selectedBuddy && (
                <BuddyLogView
                    buddy={selectedBuddy}
                    onClose={() => setSelectedBuddy(null)}
                />
            )}
        </>
    );
};

export default BuddySystemView;