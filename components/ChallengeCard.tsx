import React, { useState } from 'react';
import type { Challenge, BuddyDetails, UserProfileData } from '../types';
import { getChallengeDates, leaveChallenge, createChallenge } from '../services/challengeService';
import { UserPlusIcon, CheckIcon, XMarkIcon } from './icons';
import { Flag, Trophy, Sparkles, LogOut, Calendar, Users, ChevronRight } from 'lucide-react';
import { Avatar } from './UserProfileModal';

interface ChallengeCardProps {
    challenge: Challenge | null;
    currentUserId: string;
    currentUserProfile: UserProfileData;
    buddyDetails: BuddyDetails[];
    onChallengeUpdated?: () => void;
    setToastNotification?: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
}

const WEEKDAY_NAMES = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
    challenge,
    currentUserId,
    currentUserProfile,
    buddyDetails,
    onChallengeUpdated,
    setToastNotification
}) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedBuddyIds, setSelectedBuddyIds] = useState<string[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    // Utmaningskortet ar ihopfallt som standard nar ingen utmaning pagar,
    // sa att man kommer at sina kompisar utan att scrolla forbi det.
    const [isExpanded, setIsExpanded] = useState(false);

    // If no active challenge, show the "Starta utmaning" card
    if (!challenge) {
        return (
            <div className="bg-[#F6E2D9]/70 border border-[#D96E4A]/30 rounded-2xl px-4 py-3 shadow-sm">
                <button
                    type="button"
                    onClick={() => setIsExpanded(v => !v)}
                    className="w-full flex items-center gap-3 text-left cursor-pointer"
                    aria-expanded={isExpanded}
                >
                    <div className="w-9 h-9 rounded-lg bg-[#D96E4A] text-white flex items-center justify-center shadow-sm flex-shrink-0">
                        <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-serif text-base font-bold text-neutral-dark flex-1 min-w-0">
                        7-dagars Matloggningsutmaning
                    </h3>
                    <ChevronRight className={`w-5 h-5 text-[#D96E4A] flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                <div className={isExpanded ? 'block' : 'hidden'}>
                <p className="text-base text-neutral-600 mt-3 leading-relaxed">
                    Utmana dina kompisar att logga maten varje dag i sju dagar. Tävla i konsekvens, inte i resultat!
                </p>

                <div className="pt-3 flex items-center justify-between gap-3">
                    <p className="text-base text-neutral-500 font-medium">
                        {buddyDetails.length === 0 
                            ? 'Bjud in kompisar först för att kunna utmana dem.' 
                            : `${buddyDetails.length} ${buddyDetails.length === 1 ? 'kompis' : 'kompisar'} tillgängliga`}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            if (buddyDetails.length === 0) {
                                setToastNotification?.({ message: 'Du behöver ha minst en kompis tillagd för att starta en utmaning.', type: 'info' });
                                return;
                            }
                            setShowCreateModal(true);
                        }}
                        className="px-4 py-2.5 bg-[#D96E4A] hover:bg-[#C05A38] text-white text-base font-bold rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-2 cursor-pointer flex-shrink-0"
                    >
                        <Sparkles className="w-4 h-4" /> Starta utmaning
                    </button>
                </div>
                </div>

                {/* Create Challenge Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-neutral-dark/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowCreateModal(false)}>
                        <div className="bg-[#FAF8F5] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-neutral-light/60 animate-scale-in" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between border-b border-neutral-200/60 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <Trophy className="w-6 h-6 text-[#D96E4A]" />
                                    <h3 className="font-serif text-2xl font-bold text-neutral-dark">
                                        Skapa 7-dagars utmaning
                                    </h3>
                                </div>
                                <button type="button" onClick={() => setShowCreateModal(false)} className="p-1 text-neutral-400 hover:text-neutral-700 rounded-full">
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <p className="text-base text-neutral-600 leading-relaxed">
                                Välj vilka kompisar du vill bjuda in till utmaningen. Målet är enkelt: logga din mat varje dag i sju dagar. Ingen poängsättning eller viktjämförelse – alla som klarar alla 7 dagar firas lika!
                            </p>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">
                                    Välj deltagare ({selectedBuddyIds.length} valda)
                                </label>
                                {buddyDetails.map(buddy => {
                                    const isSelected = selectedBuddyIds.includes(buddy.uid);
                                    return (
                                        <div
                                            key={buddy.uid}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedBuddyIds(prev => prev.filter(id => id !== buddy.uid));
                                                } else {
                                                    setSelectedBuddyIds(prev => [...prev, buddy.uid]);
                                                }
                                            }}
                                            className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                                                isSelected 
                                                    ? 'bg-[#F6E2D9]/80 border-[#D96E4A] shadow-xs' 
                                                    : 'bg-white border-neutral-200 hover:border-neutral-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar photoURL={buddy.photoURL} size={36} />
                                                <span className="text-base font-bold text-neutral-dark">
                                                    {buddy.name}
                                                </span>
                                            </div>
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                                                isSelected ? 'bg-[#D96E4A] border-[#D96E4A] text-white' : 'border-neutral-300 bg-white'
                                            }`}>
                                                {isSelected && <CheckIcon className="w-4 h-4" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-2 flex items-center gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-5 py-2.5 text-neutral-600 hover:text-neutral-900 text-base font-semibold cursor-pointer"
                                >
                                    Avbryt
                                </button>
                                <button
                                    type="button"
                                    disabled={selectedBuddyIds.length === 0 || isCreating}
                                    onClick={async () => {
                                        setIsCreating(true);
                                        try {
                                            const invitedBuddies = buddyDetails.filter(b => selectedBuddyIds.includes(b.uid));
                                            await createChallenge(
                                                { uid: currentUserId, name: currentUserProfile.name || 'Jag', photoURL: currentUserProfile.photoURL },
                                                invitedBuddies
                                            );
                                            setToastNotification?.({ message: 'Utmaningen har startat! Peppa varandra!', type: 'success' });
                                            setShowCreateModal(false);
                                            onChallengeUpdated?.();
                                        } catch (e) {
                                            console.error("Error creating challenge", e);
                                            setToastNotification?.({ message: 'Kunde inte skapa utmaningen.', type: 'error' });
                                        } finally {
                                            setIsCreating(false);
                                        }
                                    }}
                                    className="px-6 py-3 bg-[#D96E4A] hover:bg-[#C05A38] text-white text-base font-bold rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                                >
                                    <Trophy className="w-5 h-5 text-white" /> Starta utmaning
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Active or completed challenge view
    const dates = getChallengeDates(challenge.startDate);
    const activeParticipants = Object.values(challenge.participants || {}).filter(p => !p.leftAt);
    
    // Calculate current day number (1-7)
    const todayStr = dates[0]; // fallback
    const parts = challenge.startDate.split('-');
    const startDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const nowObj = new Date();
    const diffTime = nowObj.getTime() - startDateObj.getTime();
    const currentDayNum = Math.min(7, Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1));

    // Check completed participants
    const completedParticipants = activeParticipants.filter(p => {
        return dates.every(d => p.dailyStatus?.[d] === true);
    });

    const isChallengeFinished = currentDayNum > 7 || challenge.status === 'completed';

    return (
        <div className="bg-[#FAF8F5] border border-[#D96E4A]/30 rounded-2xl p-5 shadow-sm space-y-5">
            {/* Challenge Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200/80 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#D96E4A] text-white flex items-center justify-center shadow-md flex-shrink-0">
                        <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-serif text-xl font-bold text-neutral-dark">
                                {challenge.title || '7-dagars matloggningsutmaning'}
                            </h3>
                            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                                isChallengeFinished 
                                    ? 'bg-[#84A98C]/20 text-[#56524D]' 
                                    : 'bg-[#F6E2D9] text-[#D96E4A]'
                            }`}>
                                {isChallengeFinished ? 'Slutförd' : `Dag ${currentDayNum} av 7`}
                            </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {challenge.startDate} till {challenge.endDate}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setShowLeaveConfirm(true)}
                        className="px-3 py-1.5 text-base font-semibold text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Lämna utmaningen"
                    >
                        <LogOut className="w-4 h-4" /> Lämna
                    </button>
                </div>
            </div>

            {/* Leave Confirmation Modal */}
            {showLeaveConfirm && (
                <div className="fixed inset-0 bg-neutral-dark/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowLeaveConfirm(false)}>
                    <div className="bg-[#FAF8F5] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-neutral-200" onClick={e => e.stopPropagation()}>
                        <h4 className="font-serif text-xl font-bold text-neutral-dark">
                            Lämna utmaningen?
                        </h4>
                        <p className="text-base text-neutral-600 leading-relaxed">
                            Du lämnar utmaningen utan att det visas som ett misslyckande för de andra deltagarna.
                        </p>
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowLeaveConfirm(false)}
                                className="px-4 py-2 text-neutral-600 text-base font-semibold cursor-pointer"
                            >
                                Avbryt
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    setShowLeaveConfirm(false);
                                    await leaveChallenge(challenge.id, currentUserId);
                                    setToastNotification?.({ message: 'Du har lämnat utmaningen.', type: 'info' });
                                    onChallengeUpdated?.();
                                }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-base font-bold rounded-xl shadow-xs cursor-pointer"
                            >
                                Ja, lämna
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Completed Summary Recognition Banner */}
            {isChallengeFinished && (
                <div className="bg-[#84A98C]/10 border border-[#84A98C]/30 rounded-xl p-4 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-[#56524D] font-bold text-base">
                        <Sparkles className="w-5 h-5 text-[#84A98C]" />
                        Utmaningen är avslutad!
                    </div>
                    <p className="text-base text-[#7A756E] leading-relaxed">
                        {completedParticipants.length > 0 ? (
                            <span>
                                Fantastiskt jobbat! Följande deltagare klarade alla 7 dagar: {' '}
                                <strong>{completedParticipants.map(p => p.name).join(', ')}</strong> 🎉
                            </span>
                        ) : (
                            <span>Grymt kämpat alla deltagare! Nya vanor tar tid att bygga.</span>
                        )}
                    </p>
                </div>
            )}

            {/* Shared Grid of Participants */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider px-1">
                    <span>Deltagare ({activeParticipants.length})</span>
                    <span className="hidden sm:inline">7 Dagar Matloggning</span>
                </div>

                <div className="space-y-2.5">
                    {activeParticipants.map(participant => {
                        const isSelf = participant.uid === currentUserId;
                        const userDatesLoggedCount = dates.filter(d => participant.dailyStatus?.[d] === true).length;

                        return (
                            <div 
                                key={participant.uid} 
                                className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    isSelf ? 'bg-[#F6E2D9]/40 border-[#D96E4A]/40' : 'bg-white border-neutral-200/80'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar photoURL={participant.photoURL} size={36} />
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-base font-bold text-neutral-dark">
                                                {participant.name} {isSelf && '(Jag)'}
                                            </span>
                                            {userDatesLoggedCount === 7 && (
                                                <span className="text-xs bg-[#F6E2D9] text-[#D96E4A] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Trophy className="w-3 h-3 text-[#D96E4A]" /> 7/7
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-base text-neutral-500">
                                            {userDatesLoggedCount} av 7 dagar loggade
                                        </p>
                                    </div>
                                </div>

                                {/* 7 Day Squares */}
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    {dates.map((dStr, idx) => {
                                        const isLogged = participant.dailyStatus?.[dStr] === true;
                                        const dateObj = new Date(parseInt(dStr.split('-')[0]), parseInt(dStr.split('-')[1]) - 1, parseInt(dStr.split('-')[2]));
                                        const dayName = WEEKDAY_NAMES[dateObj.getDay()];
                                        
                                        const todaySE = getChallengeDates(new Date().toISOString().split('T')[0])[0]; // current date comparison
                                        const isFuture = dStr > todaySE;

                                        return (
                                            <div key={dStr} className="flex flex-col items-center gap-1">
                                                <span className="text-xs font-semibold text-neutral-400">
                                                    {dayName}
                                                </span>
                                                <div 
                                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-all ${
                                                        isLogged 
                                                            ? 'bg-[#D96E4A] text-white shadow-xs scale-100' 
                                                             : isFuture 
                                                            ? 'bg-neutral-100 border border-neutral-200 text-neutral-300' 
                                                            : 'bg-neutral-50 border-2 border-dashed border-neutral-300 text-neutral-400'
                                                    }`}
                                                    title={`${dayName} (${dStr}): ${isLogged ? 'Loggat' : isFuture ? 'Kommande' : 'Ej loggat'}`}
                                                >
                                                    {isLogged ? (
                                                        <CheckIcon className="w-4 h-4 text-white" />
                                                    ) : (
                                                        <span className="text-xs">{idx + 1}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
