import React, { useState, useEffect, useRef, useMemo, FC, useCallback } from 'react';
import type { User } from '@firebase/auth';
import { Peppkompis, Chat, ChatMessage, TimelineEvent, Achievement, Gender, BuddyDetails, UserProfileData, WeightLogEntry } from '../types';
import { 
    listenForMessages, sendMessage, getChatId, markChatAsRead, fetchBuddies, 
    listenForChats, toggleMessageLike, deleteMessage, 
    addPeppToWeightLog, addPeppToAchievement, removePeppFromWeightLog, removePeppFromAchievement,
    fetchTimelineForBuddy,
    fetchBuddyDetailsList
} from '../services/firestoreService';
import { 
    ArrowLeftIcon, PaperAirplaneIcon, UserCircleIcon, CameraIcon, HeartIcon, 
    UploadIcon, TrashIcon, CheckIcon, XMarkIcon, UserPlusIcon, PlusCircleIcon, SearchIcon
} from './icons';
import { playAudio } from '../services/audioService';
import CameraModal from './CameraModal';
import ChatImagePreviewModal from './ChatImagePreviewModal';
import BuddySystemView from './BuddySystemView';
import { Avatar } from './UserProfileModal';

// --- Internal Components for CommunityView ---

const ChatList: FC<{ chats: Chat[], onSelectChat: (buddy: Peppkompis) => void, currentUser: User, buddiesMap: Map<string, BuddyDetails> }> = ({ chats, onSelectChat, currentUser, buddiesMap }) => {
    return (
        <div className="space-y-1">
            {chats.length === 0 ? (
                <p className="text-center text-neutral py-10">Inga chattar än. Lägg till en kompis för att börja chatta!</p>
            ) : (
                chats.map(chat => {
                    const buddy = chat.participants.find(p => p.uid !== currentUser.uid);
                    if (!buddy) return null;
                    const unreadCount = chat.unreadCounts?.[currentUser.uid] || 0;
                    const buddyDetails = buddiesMap.get(buddy.uid);

                    return (
                        <button
                            key={chat.id}
                            onClick={() => onSelectChat(buddy)}
                            className="w-full text-left p-3 flex items-center gap-4 hover:bg-neutral-light/50 transition-colors rounded-lg"
                        >
                            <Avatar photoURL={buddyDetails?.photoURL} gender={buddyDetails?.gender} size={48} />
                            <div className="flex-grow overflow-hidden">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold truncate">{buddy.name}</p>
                                    {chat.lastMessage?.timestamp && (
                                        <p className="text-xs text-neutral flex-shrink-0 ml-2">
                                            {typeof chat.lastMessage.timestamp === 'number' ? new Date(chat.lastMessage.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'Nyss'}
                                        </p>
                                    )}
                                </div>
                                <div className="flex justify-between items-start">
                                    <p className={`text-sm text-neutral truncate ${unreadCount > 0 ? 'font-bold text-neutral-dark' : ''}`}>
                                        {chat.lastMessage?.text || 'Börja chatta...'}
                                    </p>
                                    {unreadCount > 0 && (
                                        <span className="flex-shrink-0 ml-2 mt-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })
            )}
        </div>
    );
};


const ChatContent: FC<{ chat: Chat, currentUser: User, onBack: () => void, setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void, buddiesMap: Map<string, BuddyDetails> }> = ({ chat, currentUser, onBack, setToastNotification, buddiesMap }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [imageForPreview, setImageForPreview] = useState<string | null>(null);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

    const buddy = useMemo(() => chat.participants.find(p => p.uid !== currentUser.uid), [chat, currentUser]);
    const buddyDetails = useMemo(() => buddy ? buddiesMap.get(buddy.uid) : undefined, [buddy, buddiesMap]);

    useEffect(() => {
        const unsubscribe = listenForMessages(chat.id, setMessages);
        markChatAsRead(chat.id, currentUser.uid).catch(err => console.error("Failed to mark chat as read:", err));
        return () => unsubscribe();
    }, [chat.id, currentUser.uid]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (text: string, imageDataUrl?: string) => {
        if (!text.trim() && !imageDataUrl) return;
        setIsSending(true);
        try {
            await sendMessage(chat.id, currentUser.uid, chat.participants, text, imageDataUrl);
            setNewMessage('');
            setImageForPreview(null);
            if (imageInputRef.current) imageInputRef.current.value = '';
            playAudio('uiClick', 0.7);
        } catch (error) {
            setToastNotification({ message: 'Kunde inte skicka meddelande.', type: 'error' });
        } finally {
            setIsSending(false);
        }
    };

    const handleToggleLike = async (messageId: string) => {
        try {
            await toggleMessageLike(chat.id, messageId, currentUser.uid);
            playAudio('uiClick', 0.5);
        } catch (error) {
            setToastNotification({ message: "Kunde inte gilla meddelande.", type: 'error' });
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (window.confirm("Är du säker på att du vill ta bort detta meddelande?")) {
            try {
                await deleteMessage(chat.id, messageId);
            } catch (error) {
                setToastNotification({ message: 'Kunde inte ta bort meddelande.', type: 'error' });
            }
        }
    };

    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => setImageForPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleImageCapture = (base64ImageData: string) => {
        setShowCameraModal(false);
        setImageForPreview(`data:image/jpeg;base64,${base64ImageData}`);
    };
    
    const buddyUnreadCount = chat.unreadCounts?.[buddy!.uid] || 0;

    return (
        <>
            <div className="w-full h-full flex flex-col bg-white">
                <header className="flex items-center p-3 border-b border-neutral-light flex-shrink-0">
                    <button onClick={onBack} className="p-2"><ArrowLeftIcon className="w-6 h-6" /></button>
                    <Avatar photoURL={buddyDetails?.photoURL} gender={buddyDetails?.gender} size={36} className="mx-2" />
                    <h1 className="text-base font-semibold">{buddy?.name || 'Chatt'}</h1>
                </header>
                <div className="flex-grow overflow-y-auto p-4 space-y-2 bg-neutral-light/50">
                    {messages.map((msg, index) => {
                        const isMyMessage = msg.senderId === currentUser.uid;
                        
                        let statusText = null;
                        const isLastInMyBatch = isMyMessage && (index === messages.length - 1 || messages[index + 1].senderId !== currentUser.uid);

                        if (isLastInMyBatch) {
                             // The race condition happens here. If `buddyUnreadCount` is stale (0), it shows "Läst".
                             // By checking if the last message in the whole chat is ours, we can assume it's "Skickat"
                             // as it can't have been read yet.
                            const lastOverallMessage = messages[messages.length - 1];
                            if (lastOverallMessage.id === msg.id) {
                                statusText = 'Skickat';
                            } else {
                                statusText = buddyUnreadCount > 0 ? 'Skickat' : 'Läst';
                            }
                        }

                        return (
                            <div key={msg.id} className={`flex flex-col w-full ${isMyMessage ? 'items-end' : 'items-start'}`}>
                                <div className={`flex items-end gap-2 w-full group ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {isMyMessage && <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 opacity-0 group-hover:opacity-100"><TrashIcon className="w-4 h-4 text-neutral" /></button>}
                                    <div onDoubleClick={() => handleToggleLike(msg.id)} className={`max-w-xs sm:max-w-md rounded-2xl shadow-sm ${isMyMessage ? 'bg-primary text-white' : 'bg-neutral-light'}`}>
                                        {msg.imageDataUrl && <img src={msg.imageDataUrl} alt="Chattbild" className="w-full h-auto object-cover rounded-t-2xl" />}
                                        {msg.text && <p className="text-sm break-words px-4 py-2">{msg.text}</p>}
                                    </div>
                                </div>
                                 <div className={`flex items-center gap-2 mt-1 text-xs ${isMyMessage ? 'mr-10' : 'ml-2'}`}>
                                    <span className="text-neutral">
                                        {new Date(msg.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {statusText && (
                                        <span className={statusText === 'Läst' ? 'text-blue-500 font-semibold' : 'text-neutral'}>
                                            {statusText}
                                        </span>
                                    )}
                                </div>
                                {msg.likes && Object.keys(msg.likes).length > 0 && (
                                    <div className={`flex items-center gap-1 text-xs mt-1 bg-white border border-neutral-light shadow-sm rounded-full px-1.5 py-0.5 ${isMyMessage ? 'mr-10' : 'ml-2'}`}>
                                        <HeartIcon className="w-3 h-3 text-red-500" />
                                        <span className="text-neutral font-medium">{Object.keys(msg.likes).length}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
                 <div className="p-4 border-t border-neutral-light flex-shrink-0 relative">
                    {showAttachmentMenu && (
                        <div className="absolute bottom-full left-4 mb-2 bg-white shadow-lg rounded-lg border border-neutral-light p-2 space-y-2 animate-fade-slide-in">
                           <button onClick={() => { setShowCameraModal(true); setShowAttachmentMenu(false); }} className="w-full flex items-center gap-3 p-2 text-sm text-neutral-dark hover:bg-neutral-light/50 rounded-md"><CameraIcon className="w-5 h-5"/> Ta Foto</button>
                           <button onClick={() => { imageInputRef.current?.click(); setShowAttachmentMenu(false); }} className="w-full flex items-center gap-3 p-2 text-sm text-neutral-dark hover:bg-neutral-light/50 rounded-md"><UploadIcon className="w-5 h-5"/> Välj Bild</button>
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <input type="file" ref={imageInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" id="chat-image-input" />
                        <button onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="p-3 bg-neutral-light rounded-full hover:bg-gray-200"><PlusCircleIcon className="w-5 h-5" /></button>
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') handleSend(newMessage) }} placeholder="Skriv ett meddelande..." className="flex-1 min-w-0 px-4 py-3 bg-neutral-light rounded-full focus:outline-none" />
                        <button onClick={() => handleSend(newMessage)} disabled={!newMessage.trim() || isSending} className="p-3 bg-primary text-white rounded-full shadow-sm hover:bg-primary-darker disabled:opacity-50"><PaperAirplaneIcon className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>
            {showCameraModal && <CameraModal show={showCameraModal} onClose={() => setShowCameraModal(false)} onImageCapture={handleImageCapture} onCameraError={(msg) => setToastNotification({ message: `Kamerafel: ${msg}`, type: 'error' })} />}
            {imageForPreview && <ChatImagePreviewModal imageDataUrl={imageForPreview} isSending={isSending} onClose={() => setImageForPreview(null)} onSend={(caption, dataUrl) => handleSend(caption, dataUrl)} />}
        </>
    );
};

interface EnrichedTimelineEvent extends TimelineEvent {
    buddyName: string;
    buddyUid: string;
    photoURL?: string;
    gender?: Gender;
}

const ColoredEventDescription: FC<{ description: string }> = ({ description }) => {
    const parts = description.split(' | ');

    return (
        <p className="text-sm text-neutral-dark mt-1">
        {parts.map((part, index) => {
            const match = part.match(/\(([^)]+)\)/); // Match content inside parentheses
            if (!match) {
            return <span key={index}>{part}{index < parts.length - 1 ? ' | ' : ''}</span>;
            }

            const value = match[1];
            let colorClass = 'text-neutral'; // Default for muscle gain/loss
            let signIsGood = false;
            let signIsBad = false;

            if (value.includes('+')) {
                signIsGood = true;
            } else if (value.includes('-')) {
                signIsBad = true;
            }

            // Invert logic for weight and fat
            if (part.toLowerCase().includes('fett') || part.toLowerCase().includes('vikt')) {
                if (signIsGood) { // Gain is bad
                    colorClass = 'text-red-600';
                } else if (signIsBad) { // Loss is good
                    colorClass = 'text-primary-darker';
                }
            } else { // Normal logic for muscle
                    if (signIsGood) { // Gain is good
                    colorClass = 'text-primary-darker';
                } else if (signIsBad) { // Loss is bad
                    colorClass = 'text-red-600';
                }
            }

            if (value.includes('±')) {
                colorClass = 'text-accent'; // Yellow for no change
            }

            const textBefore = part.substring(0, match.index);
            const textAfter = part.substring(match.index! + match[0].length);
            
            return (
            <span key={index}>
                {textBefore}
                <span className={`font-semibold ${colorClass}`}>({value})</span>
                {textAfter}
                {index < parts.length - 1 ? ' | ' : ''}
            </span>
            );
        })}
        </p>
    );
};


const TimelineEventCard: FC<{ event: EnrichedTimelineEvent, currentUser: User, setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void }> = ({ event, currentUser, setToastNotification }) => {
    return (
        <div className="bg-white p-4 rounded-xl shadow-soft-lg border border-neutral-light/70">
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-neutral-light/50">
                <Avatar size={48} photoURL={event.photoURL} gender={event.gender} />
                <p className="text-base font-bold text-neutral-dark">{event.buddyName}</p>
            </div>
            
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 pt-1">
                     <span className="text-3xl">{event.icon}</span>
                </div>
                <div className="flex-grow">
                    <h4 className="text-base font-semibold text-neutral-dark">{event.title}</h4>
                    <ColoredEventDescription description={event.description} />
                    <div className="flex items-center justify-end mt-2">
                        <p className="text-xs text-neutral">{new Date(event.timestamp).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};


const Timeline: FC<{ currentUser: User; achievements: Achievement[]; setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void; buddiesMap: Map<string, BuddyDetails>; }> = ({ currentUser, achievements, setToastNotification, buddiesMap }) => {
    const [timelineEvents, setTimelineEvents] = useState<EnrichedTimelineEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadTimeline = useCallback(async () => {
        setIsLoading(true);
        try {
            const allBuddiesAndSelf = Array.from(buddiesMap.values());
            
            const allEventsPromises = allBuddiesAndSelf.map(async (buddy) => {
                const events = await fetchTimelineForBuddy(buddy.uid, currentUser.uid, achievements);
                return events.map(e => ({ ...e, buddyName: buddy.name, buddyUid: buddy.uid, photoURL: buddy.photoURL, gender: buddy.gender }));
            });
            
            const eventsByBuddy = await Promise.all(allEventsPromises);
            const flattenedEvents = eventsByBuddy.flat();
            
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const startOfYesterdayTimestamp = yesterday.getTime();
            
            const filteredEvents = flattenedEvents.filter(event => event.timestamp >= startOfYesterdayTimestamp);

            filteredEvents.sort((a, b) => b.timestamp - a.timestamp);
            setTimelineEvents(filteredEvents.slice(0, 50)); // Limit to most recent 50 events
        } catch (error) {
            console.error("Failed to load timeline:", error);
            setToastNotification({ message: 'Kunde inte ladda tidslinjen.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [currentUser.uid, achievements, setToastNotification, buddiesMap]);

    useEffect(() => {
        if (buddiesMap.size > 0) {
            loadTimeline();
        }
    }, [loadTimeline, buddiesMap]);


    return (
        <div className="p-4 space-y-4">
            {isLoading ? (
                 <div className="flex justify-center items-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
            ) : timelineEvents.length === 0 ? (
                <p className="text-center text-neutral py-10">Inget har hänt än. Logga en mätning eller få en ny bragd för att se den här!</p>
            ) : (
                timelineEvents.map(event => (
                    <TimelineEventCard key={`${event.id}-${event.buddyUid}`} event={event} currentUser={currentUser} setToastNotification={setToastNotification} />
                ))
            )}
        </div>
    );
};

// --- Main Community View ---
interface CommunityViewProps {
    currentUser: User;
    userProfile: UserProfileData;
    achievements: Achievement[];
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    unreadChatsCount: number;
    pendingRequestsCount: number;
    weightLogs: WeightLogEntry[];
    streakData: { currentStreak: number };
    unlockedAchievements: { [id: string]: string };
}

const TabButton: FC<{label: string, isActive: boolean, onClick: () => void, notificationCount?: number}> = ({ label, isActive, onClick, notificationCount }) => (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      className={`relative flex-1 py-4 text-center font-semibold border-b-4 transition-colors duration-200
        ${isActive 
          ? 'border-primary text-primary' 
          : 'border-transparent text-neutral hover:border-primary-lighter'
        }`}
    >
      {label}
      {notificationCount > 0 && (
         <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold ring-2 ring-white">
            {notificationCount > 9 ? '9+' : notificationCount}
        </span>
      )}
    </button>
);


export const CommunityView: FC<CommunityViewProps> = ({ currentUser, userProfile, achievements, setToastNotification, unreadChatsCount, pendingRequestsCount, weightLogs, streakData, unlockedAchievements }) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'chats' | 'buddies'>('timeline');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatBuddy, setSelectedChatBuddy] = useState<Peppkompis | null>(null);
  const [buddiesMap, setBuddiesMap] = useState<Map<string, BuddyDetails>>(new Map());
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  const loadBuddyDetails = useCallback(async () => {
    try {
        const buddyList = await fetchBuddyDetailsList(currentUser.uid);
        const newMap = new Map<string, BuddyDetails>();
        buddyList.forEach(b => newMap.set(b.uid, b));

        const firstWeightLog = weightLogs.length > 0 ? weightLogs[0] : null;
        const startWeight = userProfile.goalStartWeight ?? firstWeightLog?.weightKg;
        const currentWeight = userProfile.currentWeightKg;
        const totalWeightChange = (startWeight != null && currentWeight != null) ? currentWeight - startWeight : undefined;

        const startMuscleMass = firstWeightLog?.skeletalMuscleMassKg;
        const currentMuscleMass = userProfile.skeletalMuscleMassKg;
        const muscleMassChange = (startMuscleMass != null && currentMuscleMass != null) ? currentMuscleMass - startMuscleMass : undefined;
        
        const startFatMass = firstWeightLog?.bodyFatMassKg;
        const currentFatMass = userProfile.bodyFatMassKg;
        const fatMassChange = (startFatMass != null && currentFatMass != null) ? currentFatMass - startFatMass : undefined;
        
        const selfDetails: BuddyDetails = {
            uid: currentUser.uid,
            name: currentUser.displayName || "Du",
            email: currentUser.email || '',
            photoURL: userProfile.photoURL,
            gender: userProfile.gender,
            goalSummary: `${userProfile.goalType === 'lose_fat' ? 'Fettminskning' : userProfile.goalType === 'gain_muscle' ? 'Muskelökning' : 'Bibehålla'}`,
            currentStreak: streakData.currentStreak,
            unlockedAchievements: unlockedAchievements,
            yesterdayPeppCount: 0, 
            currentUserHasPepped: false,
            startWeight,
            currentWeight,
            totalWeightChange,
            currentMuscleMass,
            muscleMassChange,
            currentFatMass,
            fatMassChange,
            measurementMethod: userProfile.measurementMethod,
            desiredWeightChangeKg: userProfile.desiredWeightChangeKg,
            desiredFatMassChangeKg: userProfile.desiredFatMassChangeKg,
            desiredMuscleMassChangeKg: userProfile.desiredMuscleMassChangeKg,
            goalType: userProfile.goalType,
            mainGoalCompleted: userProfile.mainGoalCompleted,
            goalStartWeight: userProfile.goalStartWeight,
        };
        newMap.set(currentUser.uid, selfDetails);

        setBuddiesMap(newMap);
    } catch (error) {
        setToastNotification({ message: "Kunde inte ladda kompisdetaljer.", type: 'error' });
    }
  }, [currentUser, userProfile, setToastNotification, weightLogs, streakData, unlockedAchievements]);

  useEffect(() => {
      loadBuddyDetails();
      const unsubscribe = listenForChats(currentUser.uid, setChats);
      return () => unsubscribe();
  }, [currentUser.uid, loadBuddyDetails]);

  const handleStartChat = (buddy: Peppkompis) => {
    setActiveTab('chats');
    setSelectedChatBuddy(buddy);
    playAudio('uiClick');
  };

  const chatSearchResults = useMemo(() => {
    if (!chatSearchQuery) return [];
    const query = chatSearchQuery.toLowerCase();
    const allBuddies = Array.from(buddiesMap.values()).filter(b => b.uid !== currentUser.uid);
    return allBuddies.filter(b => b.name.toLowerCase().includes(query) || b.email.toLowerCase().includes(query));
  }, [chatSearchQuery, buddiesMap, currentUser.uid]);

  const handleTabClick = (tab: 'timeline' | 'chats' | 'buddies') => {
      setActiveTab(tab);
      if (selectedChatBuddy) {
          setSelectedChatBuddy(null);
      }
      playAudio('uiClick');
  };

  const handleBackFromChat = () => {
      setSelectedChatBuddy(null);
  };

  const selectedChat = useMemo(() => {
    if (!selectedChatBuddy) return null;
    const chatId = getChatId(currentUser.uid, selectedChatBuddy.uid);
    // Find existing chat or create a temporary one for display
    return chats.find(c => c.id === chatId) || {
        id: chatId,
        participants: [
            { uid: currentUser.uid, name: currentUser.displayName || '', email: currentUser.email || '' },
            selectedChatBuddy
        ],
        participantUids: [currentUser.uid, selectedChatBuddy.uid],
        unreadCounts: {},
    };
  }, [selectedChatBuddy, chats, currentUser]);

  const handleBuddyDataChanged = () => {
      loadBuddyDetails();
  }

  let mainContent;
  if (selectedChatBuddy && selectedChat) {
      mainContent = (
          <ChatContent 
              chat={selectedChat} 
              currentUser={currentUser} 
              onBack={handleBackFromChat} 
              setToastNotification={setToastNotification} 
              buddiesMap={buddiesMap} 
          />
      );
  } else {
      let tabContent;
      switch (activeTab) {
          case 'timeline':
              tabContent = <Timeline currentUser={currentUser} achievements={achievements} setToastNotification={setToastNotification} buddiesMap={buddiesMap} />;
              break;
          case 'chats':
              tabContent = (
                <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-neutral-light/70 flex-shrink-0">
                        <div className="relative">
                            <input
                                type="search"
                                value={chatSearchQuery}
                                onChange={e => setChatSearchQuery(e.target.value)}
                                placeholder="Sök kompis att chatta med..."
                                className="w-full pl-10 pr-4 py-2 bg-neutral-light rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="w-5 h-5 text-neutral" />
                            </div>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                        {chatSearchQuery ? (
                            <div className="p-2 space-y-1">
                                {chatSearchResults.length > 0 ? chatSearchResults.map(buddy => (
                                    <button key={buddy.uid} onClick={() => handleStartChat(buddy)} className="w-full text-left p-3 flex items-center gap-4 hover:bg-neutral-light/50 transition-colors rounded-lg">
                                        <Avatar photoURL={buddy.photoURL} gender={buddy.gender} size={48} />
                                        <div className="flex-grow overflow-hidden">
                                            <p className="font-semibold truncate">{buddy.name}</p>
                                            <p className="text-sm text-neutral truncate">{buddy.email}</p>
                                        </div>
                                    </button>
                                )) : <p className="text-center text-neutral py-10">Inga kompisar matchade sökningen.</p>}
                            </div>
                        ) : (
                            <ChatList chats={chats} onSelectChat={handleStartChat} currentUser={currentUser} buddiesMap={buddiesMap} />
                        )}
                    </div>
                </div>
              );
              break;
          case 'buddies':
              tabContent = <div className="p-4"><BuddySystemView currentUser={currentUser} achievements={achievements} setToastNotification={setToastNotification} pendingRequestsCount={pendingRequestsCount} onDataChanged={handleBuddyDataChanged} onStartChat={handleStartChat} /></div>;
              break;
          default:
              tabContent = null;
      }
      mainContent = <div className="flex-grow overflow-y-auto custom-scrollbar">{tabContent}</div>;
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="flex-shrink-0 border-b border-neutral-light">
        <nav className="flex items-center justify-around">
            <TabButton label="Flöde" isActive={activeTab === 'timeline' && !selectedChatBuddy} onClick={() => handleTabClick('timeline')} notificationCount={0} />
            <TabButton label="Chattar" isActive={activeTab === 'chats' || !!selectedChatBuddy} onClick={() => handleTabClick('chats')} notificationCount={unreadChatsCount} />
            <TabButton label="Kompisar" isActive={activeTab === 'buddies'} onClick={() => handleTabClick('buddies')} notificationCount={pendingRequestsCount} />
        </nav>
      </header>
      
      <main className="flex-grow flex flex-col overflow-hidden relative">
        {mainContent}
      </main>
    </div>
  );
}