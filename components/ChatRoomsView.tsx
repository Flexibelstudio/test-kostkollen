import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import { UserProfileData, Chat, ChatMessage, Peppkompis, BuddyDetails, ChatType, ChatMemberSettings } from '../types';
import { subscribeToUserChats, subscribeToPublicRooms, subscribeToChatMessages, sendMessage, createChat, joinPublicRoom, updateLastRead, updateNotificationSettings, addMembersToChat, editMessage, deleteMessage, deleteChat, removeMemberFromChat, updateChatName, toggleReactionMessage } from '../services/chatService';
import { Avatar } from './UserProfileModal';
import { SearchIcon, PlusIcon, ChevronLeftIcon, BellIcon, UserPlusIcon } from './icons';
import { Users as UsersIcon, BellOff as BellOffIcon, AtSign as AtSignIcon, Globe as GlobeIcon, Lock as LockIcon, Shield as ShieldIcon, Heart as HeartIcon, Camera as CameraIcon } from 'lucide-react';
import { searchForBuddies } from '../services/firestoreService';
import EmojiPicker from 'emoji-picker-react';

const resizeImage = (file: File, maxSize: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context failed'));
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

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
        <div className="flex flex-col flex-grow h-full bg-neutral-light/30">
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
            className="bg-white p-4 rounded-xl shadow-sm border border-neutral-light flex flex-col gap-1 cursor-pointer hover:bg-gray-50 transition-colors"
        >
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                    <h3 className="font-bold text-neutral-dark truncate text-[17px]">{chat.name || 'Gruppchatt'}</h3>
                    {chat.type === 'public_room' ? <GlobeIcon className="w-4 h-4 text-blue-500 flex-shrink-0" /> : 
                     chat.type === 'private_group' ? <LockIcon className="w-4 h-4 text-orange-400 flex-shrink-0" /> : 
                     chat.type === 'coach_group' ? <ShieldIcon className="w-4 h-4 text-primary flex-shrink-0" /> : null}
                </div>
                {chat.lastMessage && (
                    <span className="text-xs text-neutral flex-shrink-0 mt-1">
                        {new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
            <div className="flex justify-between items-center">
                <p className="text-sm text-neutral truncate pr-2">
                    {chat.lastMessage ? `${chat.lastMessage.senderId === currentUser.uid ? 'Du' : chat.lastMessage.senderName || 'Någon'}: ${chat.lastMessage.text}` : 'Inga meddelanden än'}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {isMuted && <BellOffIcon className="w-3.5 h-3.5 text-neutral" />}
                    {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {unreadCount}
                        </span>
                    )}
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
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [showAdminMenu, setShowAdminMenu] = useState(false);
    const [newChatName, setNewChatName] = useState(chat.name || '');
    const [optimisticName, setOptimisticName] = useState(chat.name || '');
    const [isEditingName, setIsEditingName] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);

    const isAdmin = chat.admins?.includes(currentUser.uid) || chat.createdBy === currentUser.uid;
    const canInvite = chat.type === 'public_room' || chat.invitePermission === 'everyone' || isAdmin;

    useEffect(() => {
        setOptimisticName(chat.name || '');
        setNewChatName(chat.name || '');
    }, [chat.name]);

    const creatorName = useMemo(() => {
        if (!chat.createdBy) return null;
        if (chat.createdBy === currentUser.uid) return 'Dig';
        const buddy = buddyDetails.find(b => b.uid === chat.createdBy);
        return buddy ? buddy.name : 'Någon';
    }, [chat.createdBy, currentUser.uid, buddyDetails]);

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
        if (!newMessage.trim() && !selectedImage) return;

        const text = newMessage.trim();
        const imageToSend = selectedImage;
        
        setNewMessage('');
        setSelectedImage(null);
        setEditingMessageId(null);

        try {
            if (editingMessageId) {
                await editMessage(chat.id, editingMessageId, text);
            } else {
                await sendMessage(
                    chat.id, 
                    currentUser.uid, 
                    userProfile.name || 'Användare', 
                    text, 
                    userProfile.photoURL,
                    imageToSend || undefined
                );
            }
        } catch (error) {
            setToastNotification({ message: 'Kunde inte skicka meddelande.', type: 'error' });
        }
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingImage(true);
        try {
            const resized = await resizeImage(file, 1024);
            setSelectedImage(resized);
        } catch (error) {
            setToastNotification({ message: 'Kunde inte ladda upp bild.', type: 'error' });
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (window.confirm('Är du säker på att du vill radera meddelandet?')) {
            try {
                await deleteMessage(chat.id, messageId);
            } catch (error) {
                setToastNotification({ message: 'Kunde inte radera meddelandet.', type: 'error' });
            }
        }
    };

    const handleStartEdit = (msg: ChatMessage) => {
        setEditingMessageId(msg.id);
        setNewMessage(msg.text);
        setSelectedImage(msg.imageUrl || null);
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
            <div className="flex flex-col flex-grow h-full bg-white">
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
        <div className="flex flex-col flex-grow h-full bg-neutral-light/30">
            {/* Header */}
            <div className="flex-shrink-0 bg-white border-b border-neutral-light p-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 -ml-2 text-neutral hover:text-neutral-dark rounded-full hover:bg-gray-100">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={newChatName}
                                        onChange={(e) => setNewChatName(e.target.value)}
                                        className="font-bold text-neutral-dark leading-tight bg-gray-100 rounded px-1 outline-none focus:ring-2 focus:ring-primary w-full max-w-[200px]"
                                        autoFocus
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
                                                if (newChatName.trim() && newChatName !== chat.name) {
                                                    try {
                                                        setOptimisticName(newChatName.trim());
                                                        await updateChatName(chat.id, newChatName.trim());
                                                        setToastNotification({ message: 'Gruppnamn uppdaterat', type: 'success' });
                                                    } catch (error) {
                                                        setToastNotification({ message: 'Kunde inte uppdatera namn', type: 'error' });
                                                        setNewChatName(chat.name || '');
                                                        setOptimisticName(chat.name || '');
                                                    }
                                                }
                                                setIsEditingName(false);
                                            } else if (e.key === 'Escape') {
                                                setNewChatName(chat.name || '');
                                                setIsEditingName(false);
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={async () => {
                                            if (newChatName.trim() && newChatName !== chat.name) {
                                                try {
                                                    setOptimisticName(newChatName.trim());
                                                    await updateChatName(chat.id, newChatName.trim());
                                                    setToastNotification({ message: 'Gruppnamn uppdaterat', type: 'success' });
                                                } catch (error) {
                                                    setToastNotification({ message: 'Kunde inte uppdatera namn', type: 'error' });
                                                    setNewChatName(chat.name || '');
                                                    setOptimisticName(chat.name || '');
                                                }
                                            }
                                            setIsEditingName(false);
                                        }}
                                        className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary-dark"
                                    >
                                        Spara
                                    </button>
                                </div>
                            ) : (
                                <h2 className="font-bold text-neutral-dark leading-tight">{optimisticName || 'Gruppchatt'}</h2>
                            )}
                            {chat.type === 'public_room' ? <GlobeIcon className="w-4 h-4 text-blue-500 flex-shrink-0" /> : 
                             chat.type === 'private_group' ? <LockIcon className="w-4 h-4 text-orange-400 flex-shrink-0" /> : 
                             chat.type === 'coach_group' ? <ShieldIcon className="w-4 h-4 text-primary flex-shrink-0" /> : null}
                        </div>
                        <p className="text-xs text-neutral">
                            {chat.members.length} {chat.members.length === 1 ? 'medlem' : 'medlemmar'}
                            {creatorName && ` • Skapad av ${creatorName}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {canInvite && (
                        <button 
                            onClick={() => {
                                if (availableBuddies.length > 0) {
                                    setIsAddingMembers(true);
                                } else {
                                    setToastNotification({ message: 'Du har inga fler vänner att lägga till.', type: 'error' });
                                }
                            }} 
                            className={`p-2 rounded-full transition-colors ${availableBuddies.length > 0 ? 'text-neutral hover:text-primary hover:bg-primary-50' : 'text-gray-300 cursor-not-allowed'}`} 
                            title="Lägg till kompisar"
                        >
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
                    {isAdmin && (
                        <div className="relative">
                            <button onClick={() => setShowAdminMenu(!showAdminMenu)} className="p-2 text-neutral hover:text-neutral-dark rounded-full hover:bg-gray-100">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>
                            {showAdminMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-neutral-light py-1 z-20">
                                    <button onClick={() => { setIsEditingName(true); setShowAdminMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-neutral-dark hover:bg-gray-50 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> Byt namn
                                    </button>
                                    <button onClick={async () => {
                                        if (window.confirm('Är du säker på att du vill radera gruppen? Detta kan inte ångras.')) {
                                            try {
                                                await deleteChat(chat.id);
                                                onBack();
                                                setToastNotification({ message: 'Grupp raderad', type: 'success' });
                                            } catch (error) {
                                                setToastNotification({ message: 'Kunde inte radera grupp', type: 'error' });
                                            }
                                        }
                                        setShowAdminMenu(false);
                                    }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> Radera grupp
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
                {messages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId || (msg.timestamp - messages[index - 1].timestamp > 5 * 60 * 1000);

                    // Calculate who has read this message
                    const readBy = Object.entries(chat.memberSettings as Record<string, ChatMemberSettings>)
                        .filter(([uid, settings]) => uid !== currentUser.uid && uid !== msg.senderId && settings.lastReadTimestamp >= msg.timestamp)
                        .map(([uid]) => uid);

                    const isLastMessage = index === messages.length - 1;

                    const hasReactions = (msg.likes?.length || 0) > 0 || Object.keys(msg.reactions || {}).length > 0;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {showHeader && !isMe && (
                                <div className="flex items-center gap-2 mb-1 ml-1">
                                    <Avatar photoURL={msg.senderPhotoURL} size={20} />
                                    <span className="text-xs font-medium text-neutral">{msg.senderName}</span>
                                </div>
                            )}
                            <div className={`max-w-[80%] px-4 py-2 rounded-2xl relative group ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-white border border-neutral-light text-neutral-dark rounded-bl-sm shadow-sm'} ${hasReactions ? 'mb-3' : ''}`}>
                                {msg.imageUrl && (
                                    <div className="bg-white rounded-lg p-1 mb-2">
                                        <img src={msg.imageUrl} alt="Bifogad bild" className="max-w-full rounded-lg" />
                                    </div>
                                )}
                                <p className={`text-[15px] leading-relaxed break-words ${msg.isDeleted ? 'italic opacity-70' : ''}`}>{msg.text}</p>
                                {msg.isEdited && !msg.isDeleted && (
                                    <span className="text-[10px] opacity-70 ml-2">(redigerad)</span>
                                )}
                                
                                {/* Reactions */}
                                {(msg.likes?.length || 0) > 0 || Object.keys(msg.reactions || {}).length > 0 ? (
                                    <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} bg-white border border-neutral-light rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm text-xs text-neutral-dark z-10`}>
                                        {Object.entries(msg.reactions || {}).map(([emoji, users]) => {
                                            const count = Object.keys(users).length;
                                            if (count === 0) return null;
                                            return (
                                                <div key={emoji} className="flex items-center gap-0.5">
                                                    <span>{emoji}</span>
                                                    <span>{count}</span>
                                                </div>
                                            );
                                        })}
                                        {/* Legacy likes */}
                                        {msg.likes && msg.likes.length > 0 && !msg.reactions?.['❤️'] && (
                                            <div className="flex items-center gap-0.5">
                                                <HeartIcon className="w-3 h-3 fill-red-500 text-red-500" />
                                                <span>{msg.likes.length}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                                
                                {/* Message Actions */}
                                {!msg.isDeleted && (
                                    <div className={`absolute top-2 ${isMe ? '-left-32' : '-right-32'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white shadow-sm border border-neutral-light rounded-lg p-1 z-10`}>
                                        <button 
                                            onClick={() => {
                                                const hasReacted = !!msg.reactions?.['👍']?.[currentUser.uid];
                                                toggleReactionMessage(chat.id, msg.id, currentUser.uid, userProfile.name || 'Användare', '👍', !hasReacted);
                                            }} 
                                            className={`p-1 rounded hover:bg-gray-100 ${!!msg.reactions?.['👍']?.[currentUser.uid] ? 'bg-primary-50' : ''}`} 
                                            title="Tumme upp"
                                        >
                                            👍
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const hasReacted = !!msg.reactions?.['❤️']?.[currentUser.uid] || msg.likes?.includes(currentUser.uid);
                                                toggleReactionMessage(chat.id, msg.id, currentUser.uid, userProfile.name || 'Användare', '❤️', !hasReacted);
                                            }} 
                                            className={`p-1 rounded hover:bg-gray-100 ${!!msg.reactions?.['❤️']?.[currentUser.uid] || msg.likes?.includes(currentUser.uid) ? 'bg-primary-50' : ''}`} 
                                            title="Hjärta"
                                        >
                                            ❤️
                                        </button>
                                        <div className="relative">
                                            <button 
                                                onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === msg.id ? null : msg.id)} 
                                                className="p-1 rounded hover:bg-gray-100 text-neutral" 
                                                title="Fler emojis"
                                            >
                                                <PlusIcon className="w-4 h-4" />
                                            </button>
                                            {showEmojiPickerFor === msg.id && (
                                                <div className="absolute bottom-full mb-2 right-0 z-50">
                                                    <div className="fixed inset-0" onClick={() => setShowEmojiPickerFor(null)}></div>
                                                    <div className="relative">
                                                        <EmojiPicker 
                                                            onEmojiClick={(emojiData) => {
                                                                const hasReacted = !!msg.reactions?.[emojiData.emoji]?.[currentUser.uid];
                                                                toggleReactionMessage(chat.id, msg.id, currentUser.uid, userProfile.name || 'Användare', emojiData.emoji, !hasReacted);
                                                                setShowEmojiPickerFor(null);
                                                            }}
                                                            width={280}
                                                            height={350}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {(isMe || isAdmin) && (
                                            <>
                                                {isMe && (
                                                    <button onClick={() => handleStartEdit(msg)} className="p-1 text-neutral hover:text-primary rounded hover:bg-gray-100" title="Redigera">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                )}
                                                <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 text-neutral hover:text-red-500 rounded hover:bg-gray-100" title="Radera">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
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
            <div className="flex-shrink-0 bg-white border-t border-neutral-light p-3">
                {editingMessageId && (
                    <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-t-lg border-b border-gray-200 text-sm text-neutral-dark">
                        <span className="flex items-center gap-1">
                            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            Redigerar meddelande
                        </span>
                        <button onClick={() => { setEditingMessageId(null); setNewMessage(''); setSelectedImage(null); }} className="text-neutral hover:text-neutral-dark">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}
                {selectedImage && (
                    <div className="relative inline-block mb-2 ml-12 bg-white rounded-lg p-1 border border-neutral-light">
                        <img src={selectedImage} alt="Vald bild" className="h-20 rounded-md object-contain" />
                        <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md border border-neutral-light text-neutral hover:text-red-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}
                <form onSubmit={handleSend} className="flex items-end gap-2">
                    <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                    />
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                        ref={cameraInputRef}
                        onChange={handleImageSelect}
                    />
                    <button 
                        type="button" 
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="p-3 text-neutral hover:text-primary rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 mb-0.5"
                        title="Ta bild"
                    >
                        <CameraIcon className="w-6 h-6" />
                    </button>
                    <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="p-3 text-neutral hover:text-primary rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 mb-0.5"
                        title="Välj bild"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </button>
                    <div className="flex-grow bg-gray-100 rounded-2xl border border-transparent focus-within:border-primary focus-within:bg-white transition-all overflow-hidden">
                        <textarea 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Skriv ett meddelande..."
                            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none appearance-none resize-none max-h-32 py-3 px-4 text-[15px] m-0 block"
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
                        disabled={(!newMessage.trim() && !selectedImage) || isUploadingImage}
                        className="p-3 bg-primary text-white rounded-full disabled:opacity-50 disabled:bg-neutral hover:bg-primary-darker transition-colors flex-shrink-0 mb-0.5"
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
    const [invitePermission, setInvitePermission] = useState<'admin_only' | 'everyone'>('everyone');
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
                selectedBuddies,
                isPublic ? 'everyone' : invitePermission
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
        <div className="flex flex-col flex-grow h-full bg-white">
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

                {!isPublic && (
                    <div className="mt-4 bg-gray-50 dark:bg-neutral-dark p-3 rounded-lg border border-neutral-light dark:border-neutral-600">
                        <label className="block text-sm font-medium text-neutral-dark dark:text-white mb-2">Vem får bjuda in fler personer?</label>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="invitePermission" 
                                    value="everyone" 
                                    checked={invitePermission === 'everyone'} 
                                    onChange={() => setInvitePermission('everyone')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span className="text-sm text-neutral-dark dark:text-gray-200">Alla i gruppen</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="invitePermission" 
                                    value="admin_only" 
                                    checked={invitePermission === 'admin_only'} 
                                    onChange={() => setInvitePermission('admin_only')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span className="text-sm text-neutral-dark dark:text-gray-200">Bara jag (Admin)</span>
                            </label>
                        </div>
                    </div>
                )}

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
