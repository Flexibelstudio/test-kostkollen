import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import { UserProfileData, Chat, ChatMessage, Peppkompis } from '../types';
import { subscribeToUserChats, subscribeToPublicRooms, subscribeToChatMessages, sendMessage, createChat, joinPublicRoom, updateLastRead, updateNotificationSettings, addMembersToChat } from '../services/chatService';
import { Avatar } from './UserProfileModal';
import { SearchIcon, PlusIcon, ChevronLeftIcon, BellIcon, UserPlusIcon } from './icons';
import { Users as UsersIcon, BellOff as BellOffIcon, AtSign as AtSignIcon, Globe as GlobeIcon, Lock as LockIcon, Shield as ShieldIcon } from 'lucide-react';
import { searchForBuddies } from '../services/firestoreService';

interface ChatRoomsViewProps {
    currentUser: User;
    userProfile: UserProfileData;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    buddyDetails: BuddyDetails[];
}

export const ChatRoomsView: React.FC<ChatRoomsViewProps> = ({ currentUser, userProfile, setToastNotification, buddyDetails }) => {
    const [activeTab, setActiveTab] = useState<'my_chats' | 'discover'>('my_chats');
    const [myChats, setMyChats] = useState<Chat[]>([]);
    const [publicRooms, setPublicRooms] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    useEffect(() => {
        const unsubscribeMyChats = subscribeToUserChats(currentUser.uid, setMyChats);
        const unsubscribePublicRooms = subscribeToPublicRooms(setPublicRooms);

        return () => {
            unsubscribeMyChats();
            unsubscribePublicRooms();
        };
    }, [currentUser.uid]);

    const handleJoinPublicRoom = async (chat: Chat) => {
        try {
            await joinPublicRoom(chat.id, currentUser.uid);
            setSelectedChat(chat);
        } catch (error) {
            setToastNotification({ message: 'Kunde inte gå med i rummet.', type: 'error' });
        }
    };

    if (selectedChat) {
        return (
            <ChatWindow 
                chat={selectedChat} 
                currentUser={currentUser} 
                userProfile={userProfile} 
                onBack={() => setSelectedChat(null)} 
                setToastNotification={setToastNotification}
                buddyDetails={buddyDetails}
            />
        );
    }

    if (isCreatingGroup) {
        return (
            <CreateGroupView 
                currentUser={currentUser}
                userProfile={userProfile}
                onBack={() => setIsCreatingGroup(false)}
                onGroupCreated={(chat) => {
                    setIsCreatingGroup(false);
                    setSelectedChat(chat);
                }}
                setToastNotification={setToastNotification}
                buddyDetails={buddyDetails}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-neutral-light/30">
            <div className="flex-shrink-0 bg-white border-b border-neutral-light p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-primary-darker">Chattar</h2>
                    <button 
                        onClick={() => setIsCreatingGroup(true)}
                        className="p-2 bg-primary text-white rounded-full shadow-sm hover:bg-primary-darker transition-colors"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex space-x-2">
                    <button 
                        onClick={() => setActiveTab('my_chats')}
                        className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'my_chats' ? 'bg-primary text-white shadow-sm' : 'bg-neutral-light text-neutral-dark hover:bg-gray-200'}`}
                    >
                        Mina chattar
                    </button>
                    <button 
                        onClick={() => setActiveTab('discover')}
                        className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'discover' ? 'bg-primary text-white shadow-sm' : 'bg-neutral-light text-neutral-dark hover:bg-gray-200'}`}
                    >
                        Upptäck
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-3">
                {activeTab === 'my_chats' ? (
                    myChats.length > 0 ? (
                        myChats.map(chat => (
                            <ChatListItem 
                                key={chat.id} 
                                chat={chat} 
                                currentUser={currentUser} 
                                onClick={() => setSelectedChat(chat)} 
                            />
                        ))
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-neutral-dark font-medium">Du är inte med i några chattar än.</p>
                            <p className="text-neutral text-sm mt-1">Skapa en ny grupp eller upptäck öppna rum!</p>
                        </div>
                    )
                ) : (
                    publicRooms.filter(room => !room.members.includes(currentUser.uid)).length > 0 ? (
                        publicRooms.filter(room => !room.members.includes(currentUser.uid)).map(chat => (
                            <div key={chat.id} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-light flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-neutral-dark">{chat.name}</h3>
                                    <p className="text-sm text-neutral">{chat.description}</p>
                                    <p className="text-xs text-neutral mt-1 flex items-center gap-1">
                                        <UsersIcon className="w-3 h-3" /> {chat.members.length} medlemmar
                                    </p>
                                </div>
                                <button 
                                    onClick={() => handleJoinPublicRoom(chat)}
                                    className="px-4 py-2 bg-primary-100 text-primary-darker font-semibold rounded-lg hover:bg-primary-200 transition-colors"
                                >
                                    Gå med
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-neutral-dark font-medium">Inga nya öppna rum att upptäcka just nu.</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

const ChatListItem: React.FC<{ chat: Chat, currentUser: User, onClick: () => void }> = ({ chat, currentUser, onClick }) => {
    const unreadCount = 0; // TODO: Calculate based on lastReadTimestamp and message timestamps
    const isMuted = chat.memberSettings[currentUser.uid]?.notificationLevel === 'mute';

    return (
        <div 
            onClick={onClick}
            className="bg-white p-3 rounded-xl shadow-sm border border-neutral-light flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
        >
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-darker font-bold text-lg flex-shrink-0">
                {chat.name ? chat.name.charAt(0).toUpperCase() : <UsersIcon className="w-6 h-6" />}
            </div>
            <div className="flex-grow min-w-0">
                <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-1.5 truncate pr-2">
                        {chat.type === 'public_room' ? <GlobeIcon className="w-3.5 h-3.5 text-neutral flex-shrink-0" /> : 
                         chat.type === 'private_group' ? <LockIcon className="w-3.5 h-3.5 text-neutral flex-shrink-0" /> : 
                         chat.type === 'coach_group' ? <ShieldIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : null}
                        <h3 className="font-bold text-neutral-dark truncate">{chat.name || 'Gruppchatt'}</h3>
                    </div>
                    {chat.lastMessage && (
                        <span className="text-xs text-neutral flex-shrink-0">
                            {new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
                <div className="flex justify-between items-center mt-0.5">
                    <p className="text-sm text-neutral truncate pr-2">
                        {chat.lastMessage ? `${chat.lastMessage.senderId === currentUser.uid ? 'Du' : 'Någon'}: ${chat.lastMessage.text}` : 'Inga meddelanden än'}
                    </p>
                    <div className="flex items-center gap-1">
                        {isMuted && <BellOffIcon className="w-3 h-3 text-neutral" />}
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ChatWindow: React.FC<{ 
    chat: Chat, 
    currentUser: User, 
    userProfile: UserProfileData, 
    onBack: () => void,
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void,
    buddyDetails?: BuddyDetails[]
}> = ({ chat, currentUser, userProfile, onBack, setToastNotification, buddyDetails = [] }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [isAddingMembers, setIsAddingMembers] = useState(false);
    const [selectedBuddies, setSelectedBuddies] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = subscribeToChatMessages(chat.id, (newMessages) => {
            setMessages(newMessages);
            updateLastRead(chat.id, currentUser.uid);
        });
        return () => unsubscribe();
    }, [chat.id, currentUser.uid]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const text = newMessage.trim();
        setNewMessage('');

        try {
            await sendMessage(
                chat.id, 
                currentUser.uid, 
                userProfile.name || 'Användare', 
                text, 
                userProfile.photoURL
            );
        } catch (error) {
            setToastNotification({ message: 'Kunde inte skicka meddelande.', type: 'error' });
        }
    };

    const handleSettingChange = async (level: 'all' | 'mentions' | 'mute') => {
        try {
            await updateNotificationSettings(chat.id, currentUser.uid, level);
            setShowSettings(false);
            setToastNotification({ message: 'Notisinställningar uppdaterade.', type: 'success' });
        } catch (error) {
            setToastNotification({ message: 'Kunde inte uppdatera inställningar.', type: 'error' });
        }
    };

    const handleAddMembers = async () => {
        if (selectedBuddies.length === 0) return;
        try {
            await addMembersToChat(chat.id, selectedBuddies);
            setToastNotification({ message: 'Kompisar tillagda!', type: 'success' });
            setIsAddingMembers(false);
            setSelectedBuddies([]);
        } catch (error) {
            setToastNotification({ message: 'Kunde inte lägga till kompisar.', type: 'error' });
        }
    };

    const toggleBuddy = (uid: string) => {
        setSelectedBuddies(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const currentSetting = chat.memberSettings[currentUser.uid]?.notificationLevel || 'all';
    
    // Filter out buddies that are already in the chat
    const availableBuddies = buddyDetails.filter(b => !chat.members.includes(b.uid));

    if (isAddingMembers) {
        return (
            <div className="flex flex-col h-full bg-white">
                <div className="flex items-center gap-3 p-4 border-b border-neutral-light">
                    <button onClick={() => setIsAddingMembers(false)} className="p-2 -ml-2 text-neutral hover:text-neutral-dark rounded-full hover:bg-gray-100">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <h2 className="text-xl font-bold text-neutral-dark">Lägg till kompisar</h2>
                </div>
                <div className="p-4 flex-grow overflow-y-auto">
                    {availableBuddies.length > 0 ? (
                        <div className="space-y-2">
                            {availableBuddies.map(buddy => (
                                <div 
                                    key={buddy.uid} 
                                    onClick={() => toggleBuddy(buddy.uid)}
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${selectedBuddies.includes(buddy.uid) ? 'bg-primary-50 border-primary' : 'border-neutral-light hover:bg-gray-50'}`}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={selectedBuddies.includes(buddy.uid)}
                                        readOnly
                                        className="w-5 h-5 text-primary rounded focus:ring-primary"
                                    />
                                    <Avatar photoURL={buddy.photoURL} size={40} />
                                    <span className="font-bold text-neutral-dark">{buddy.name}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-neutral-dark font-medium">Alla dina kompisar är redan med i chatten.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-neutral-light">
                    <button 
                        onClick={handleAddMembers}
                        disabled={selectedBuddies.length === 0}
                        className="w-full py-3 bg-primary text-white font-bold rounded-lg disabled:opacity-50 hover:bg-primary-darker transition-colors"
                    >
                        Lägg till ({selectedBuddies.length})
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-neutral-light/30">
            {/* Header */}
            <div className="flex-shrink-0 bg-white border-b border-neutral-light p-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 -ml-2 text-neutral hover:text-neutral-dark rounded-full hover:bg-gray-100">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            {chat.type === 'public_room' ? <GlobeIcon className="w-4 h-4 text-neutral flex-shrink-0" /> : 
                             chat.type === 'private_group' ? <LockIcon className="w-4 h-4 text-neutral flex-shrink-0" /> : 
                             chat.type === 'coach_group' ? <ShieldIcon className="w-4 h-4 text-primary flex-shrink-0" /> : null}
                            <h2 className="font-bold text-neutral-dark leading-tight">{chat.name || 'Gruppchatt'}</h2>
                        </div>
                        <p className="text-xs text-neutral">{chat.members.length} medlemmar</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {availableBuddies.length > 0 && (
                        <button onClick={() => setIsAddingMembers(true)} className="p-2 text-neutral hover:text-primary rounded-full hover:bg-primary-50 transition-colors" title="Lägg till kompisar">
                            <UserPlusIcon className="w-5 h-5" />
                        </button>
                    )}
                    <div className="relative">
                        <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-neutral hover:text-neutral-dark rounded-full hover:bg-gray-100">
                            {currentSetting === 'mute' ? <BellOffIcon className="w-5 h-5" /> : currentSetting === 'mentions' ? <AtSignIcon className="w-5 h-5" /> : <BellIcon className="w-5 h-5" />}
                        </button>
                        {showSettings && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-neutral-light py-1 z-20">
                                <button onClick={() => handleSettingChange('all')} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${currentSetting === 'all' ? 'text-primary font-bold' : 'text-neutral-dark'}`}>
                                    <BellIcon className="w-4 h-4" /> Alla meddelanden
                                </button>
                                <button onClick={() => handleSettingChange('mentions')} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${currentSetting === 'mentions' ? 'text-primary font-bold' : 'text-neutral-dark'}`}>
                                    <AtSignIcon className="w-4 h-4" /> Endast @mentions
                                </button>
                                <button onClick={() => handleSettingChange('mute')} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${currentSetting === 'mute' ? 'text-primary font-bold' : 'text-neutral-dark'}`}>
                                    <BellOffIcon className="w-4 h-4" /> Stör ej (Mute)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
                {messages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId || (msg.timestamp - messages[index - 1].timestamp > 5 * 60 * 1000);

                    // Calculate who has read this message
                    const readBy = Object.entries(chat.memberSettings)
                        .filter(([uid, settings]) => uid !== currentUser.uid && uid !== msg.senderId && settings.lastReadTimestamp >= msg.timestamp)
                        .map(([uid]) => uid);

                    const isLastMessage = index === messages.length - 1;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {showHeader && !isMe && (
                                <div className="flex items-center gap-2 mb-1 ml-1">
                                    <Avatar photoURL={msg.senderPhotoURL} size={20} />
                                    <span className="text-xs font-medium text-neutral">{msg.senderName}</span>
                                </div>
                            )}
                            <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-white border border-neutral-light text-neutral-dark rounded-bl-sm shadow-sm'}`}>
                                <p className="text-[15px] leading-relaxed break-words">{msg.text}</p>
                            </div>
                            <span className="text-[10px] text-neutral mt-1 mx-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            
                            {/* Read Receipts (Messenger style) */}
                            {isMe && isLastMessage && readBy.length > 0 && (
                                <div className="flex items-center gap-0.5 mt-1 mr-1 justify-end">
                                    {readBy.slice(0, 3).map(uid => (
                                        <div key={uid} className="w-3.5 h-3.5 rounded-full bg-gray-300 border border-white overflow-hidden">
                                            {/* Ideally we'd have the user's photoURL here, but we only have their UID in memberSettings. 
                                                For a perfect implementation, we'd need a user cache or store avatars in memberSettings. 
                                                Using a generic avatar for now. */}
                                            <UsersIcon className="w-full h-full text-white p-0.5" />
                                        </div>
                                    ))}
                                    {readBy.length > 3 && (
                                        <span className="text-[10px] text-neutral ml-1">+{readBy.length - 3}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 bg-white border-t border-neutral-light p-3 pb-safe">
                <form onSubmit={handleSend} className="flex items-end gap-2">
                    <div className="flex-grow bg-neutral-light/50 rounded-2xl border border-neutral-light focus-within:border-primary transition-all">
                        <textarea 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Skriv ett meddelande..."
                            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none max-h-32 py-2.5 px-4 text-[15px]"
                            rows={1}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                            style={{ minHeight: '44px' }}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={!newMessage.trim()}
                        className="p-3 bg-primary text-white rounded-full disabled:opacity-50 disabled:bg-neutral hover:bg-primary-darker transition-colors flex-shrink-0"
                    >
                        <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

const CreateGroupView: React.FC<{
    currentUser: User;
    userProfile: UserProfileData;
    onBack: () => void;
    onGroupCreated: (chat: Chat) => void;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    buddyDetails: BuddyDetails[];
}> = ({ currentUser, userProfile, onBack, onGroupCreated, setToastNotification, buddyDetails }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedBuddies, setSelectedBuddies] = useState<string[]>([]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIsSubmitting(true);

        try {
            const type: ChatType = isPublic ? 'public_room' : 'private_group';
            // For coach_group, we'd check if userProfile.role === 'coach' and add an option, 
            // but let's keep it simple for now or assume coaches create coach_groups.
            const finalType = (userProfile as any).role === 'coach' && isPublic ? 'coach_group' : type;

            const chatId = await createChat(
                finalType,
                name.trim(),
                description.trim(),
                currentUser.uid,
                selectedBuddies
            );

            // We don't have the full chat object immediately, but the subscription will pick it up.
            // For now, we just go back.
            setToastNotification({ message: 'Grupp skapad!', type: 'success' });
            onBack();
        } catch (error) {
            setToastNotification({ message: 'Kunde inte skapa grupp.', type: 'error' });
            setIsSubmitting(false);
        }
    };

    const toggleBuddy = (uid: string) => {
        setSelectedBuddies(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center gap-3 p-4 border-b border-neutral-light">
                <button onClick={onBack} className="p-2 -ml-2 text-neutral hover:text-neutral-dark rounded-full hover:bg-gray-100">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-neutral-dark">Skapa ny grupp</h2>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4 overflow-y-auto">
                <div>
                    <label className="block text-sm font-medium text-neutral-dark mb-1">Gruppnamn</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="T.ex. Tjejmilen 2026"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-dark mb-1">Beskrivning (valfritt)</label>
                    <input 
                        type="text" 
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="Vad handlar gruppen om?"
                    />
                </div>
                <div className="flex items-center gap-3 p-3 bg-neutral-light/30 rounded-lg border border-neutral-light">
                    <input 
                        type="checkbox" 
                        id="isPublic"
                        checked={isPublic}
                        onChange={e => setIsPublic(e.target.checked)}
                        className="w-5 h-5 text-primary rounded focus:ring-primary"
                    />
                    <label htmlFor="isPublic" className="text-sm text-neutral-dark">
                        <span className="font-bold block">Öppet rum</span>
                        <span className="text-neutral">Alla i appen kan se och gå med i detta rum.</span>
                    </label>
                </div>

                {!isPublic && buddyDetails.length > 0 && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-neutral-dark mb-2">Bjud in kompisar</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border border-neutral-light rounded-lg p-2">
                            {buddyDetails.map(buddy => (
                                <div 
                                    key={buddy.uid} 
                                    onClick={() => toggleBuddy(buddy.uid)}
                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedBuddies.includes(buddy.uid) ? 'bg-primary-100' : 'hover:bg-gray-50'}`}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={selectedBuddies.includes(buddy.uid)}
                                        readOnly
                                        className="w-4 h-4 text-primary rounded focus:ring-primary"
                                    />
                                    <Avatar photoURL={buddy.photoURL} size={32} />
                                    <span className="font-medium text-sm text-neutral-dark">{buddy.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={!name.trim() || isSubmitting}
                    className="w-full py-3 bg-primary text-white font-bold rounded-lg disabled:opacity-50 hover:bg-primary-darker transition-colors mt-6"
                >
                    {isSubmitting ? 'Skapar...' : 'Skapa grupp'}
                </button>
            </form>
        </div>
    );
};
