

import React, { useState, useEffect, useRef, useMemo, FC } from 'react';
import type { User } from '@firebase/auth';
import { Peppkompis, Chat, ChatMessage } from '../types';
import { listenForMessages, sendMessage, getChatId, markChatAsRead, fetchBuddies, listenForChats, toggleMessageLike, deleteMessage } from '../services/firestoreService';
import { ArrowLeftIcon, PaperAirplaneIcon, UserCircleIcon, UserGroupIcon, CameraIcon, HeartIcon, UploadIcon, ChatBubbleLeftRightIcon, TrashIcon } from './icons';
import { playAudio } from '../services/audioService';
import CameraModal from './CameraModal';
import ChatImagePreviewModal from './ChatImagePreviewModal';

interface ChatViewProps {
    currentUser: User;
    activeBuddy: Peppkompis | null;
    onSelectBuddy: (buddy: Peppkompis | null) => void;
    onBack: () => void;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

// --- ChatList Component ---
const ChatList: FC<{ chats: Chat[], onSelectChat: (buddy: Peppkompis) => void, currentUser: User }> = ({ chats, onSelectChat, currentUser }) => {
    return (
        <div className="flex-grow overflow-y-auto custom-scrollbar">
            {chats.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center text-neutral p-4">
                    <p>Du har inga chattar ännu. <br />Gå till 'Konto' &gt; 'Peppkompis' för att lägga till vänner!</p>
                </div>
            ) : (
                <ul className="divide-y divide-neutral-light">
                    {chats.map(chat => {
                        const buddy = chat.participants.find(p => p.uid !== currentUser.uid);
                        if (!buddy) return null;
                        
                        const unreadCount = chat.unreadCounts?.[currentUser.uid] || 0;

                        return (
                            <li key={chat.id}>
                                <button
                                    onClick={() => onSelectChat(buddy)}
                                    className="w-full flex items-center p-4 text-left hover:bg-neutral-light/50 transition-colors"
                                >
                                    <UserCircleIcon className="w-12 h-12 text-neutral-dark mr-4 flex-shrink-0" />
                                    <div className="flex-grow min-w-0">
                                        <div className="flex justify-between items-center">
                                            <p className={`font-semibold truncate ${unreadCount > 0 ? 'text-neutral-dark' : 'text-neutral-dark'}`}>{buddy.name}</p>
                                            {chat.lastMessage?.timestamp && (
                                                <p className="text-xs text-neutral flex-shrink-0 ml-2">
                                                    {new Date(chat.lastMessage.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className={`text-sm truncate ${unreadCount > 0 ? 'text-primary font-medium' : 'text-neutral'}`}>
                                                {chat.lastMessage ? (
                                                    (chat.lastMessage.senderId === currentUser.uid ? 'Du: ' : '') + 
                                                    (chat.lastMessage.text || '📷 Bild')
                                                ) : 'Inga meddelanden än'}
                                            </p>
                                            {unreadCount > 0 && (
                                                <span className="flex-shrink-0 ml-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};


// --- ChatMessages Component (replaces ChatContent) ---
const ChatMessages: FC<{ chatId: string, currentUser: User, setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void }> = ({ chatId, currentUser, setToastNotification }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = listenForMessages(chatId, setMessages);
        markChatAsRead(chatId, currentUser.uid).catch(err => console.error("Failed to mark chat as read:", err));
        return () => unsubscribe();
    }, [chatId, currentUser.uid]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);
    
    const handleToggleLike = async (messageId: string) => {
        try {
            await toggleMessageLike(chatId, messageId, currentUser.uid);
            playAudio('uiClick', 0.5);
        } catch (error) {
            console.error("Failed to toggle like on message:", error);
            setToastNotification({ message: "Kunde inte gilla meddelande.", type: 'error' });
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (window.confirm("Är du säker på att du vill ta bort detta meddelande? Detta kan inte ångras.")) {
            try {
                await deleteMessage(chatId, messageId);
                // Realtime listener will handle UI update.
                setToastNotification({ message: 'Meddelande borttaget.', type: 'success' });
            } catch (error) {
                console.error("Failed to delete message:", error);
                setToastNotification({ message: 'Kunde inte ta bort meddelande.', type: 'error' });
            }
        }
    };


    return (
        <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
            {messages.map(msg => {
                const isMyMessage = msg.senderId === currentUser.uid;
                const hasLikes = msg.likes && Object.keys(msg.likes).length > 0;
                
                return (
                    <div key={msg.id} className={`flex flex-col w-full ${isMyMessage ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-end gap-2 w-full group ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                             {isMyMessage && (
                                <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="p-1.5 text-neutral hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 flex-shrink-0"
                                    aria-label="Ta bort meddelande"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                            {!isMyMessage && <UserCircleIcon className="w-6 h-6 text-neutral-dark flex-shrink-0 self-end" />}
                            
                            <div 
                                onDoubleClick={() => handleToggleLike(msg.id)}
                                className={`max-w-xs sm:max-w-md rounded-2xl shadow-sm overflow-hidden cursor-pointer ${isMyMessage ? 'bg-primary text-white rounded-br-none' : 'bg-neutral-light rounded-bl-none'}`}>
                                {msg.imageDataUrl && (
                                    <img src={msg.imageDataUrl} alt="Bild i chatt" className="w-full h-auto object-cover" />
                                )}
                                {msg.text && (
                                    <p className={`text-sm break-words px-4 py-2 ${isMyMessage ? 'text-white' : 'text-neutral-dark'}`}>{msg.text}</p>
                                )}
                            </div>
                        </div>
                        
                        {hasLikes && (
                            <div className={`flex items-center gap-1 mt-1 px-1.5 py-0.5 text-xs bg-red-100 border border-red-200 text-red-600 rounded-full shadow-sm ${isMyMessage ? 'mr-12' : 'ml-8'}`}>
                                <HeartIcon className="w-3 h-3"/>
                                <span>{Object.keys(msg.likes!).length}</span>
                            </div>
                        )}
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
};


// --- Main ChatView Component ---
export const ChatView: FC<ChatViewProps> = ({ currentUser, activeBuddy, onSelectBuddy, onBack, setToastNotification }) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [showCameraModal, setShowCameraModal] = useState(false);
    const [imageForPreview, setImageForPreview] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = listenForChats(currentUser.uid, (realtimeChats) => {
            fetchBuddies(currentUser.uid).then(userBuddies => {
                const allChatBuddies = new Map<string, Peppkompis>();
                realtimeChats.forEach(c => {
                    const buddy = c.participants.find(p => p.uid !== currentUser.uid);
                    if (buddy) allChatBuddies.set(buddy.uid, buddy);
                });
                userBuddies.forEach(b => {
                    if (!allChatBuddies.has(b.uid)) allChatBuddies.set(b.uid, b);
                });
                
                const finalChats: Chat[] = [];
                allChatBuddies.forEach((buddy, uid) => {
                    const chatId = getChatId(currentUser.uid, uid);
                    const existingChat = realtimeChats.find(c => c.id === chatId);
                    if (existingChat) {
                        finalChats.push(existingChat);
                    } else {
                        finalChats.push({
                            id: chatId,
                            participants: [ { uid: currentUser.uid, name: currentUser.displayName || 'Jag', email: currentUser.email || '' }, buddy ],
                            participantUids: [currentUser.uid, uid],
                            unreadCounts: {}
                        });
                    }
                });
                setChats(finalChats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)));
                setIsLoading(false);
            }).catch(error => {
                console.error("Failed to fetch buddies for chat list merge:", error);
                setToastNotification({ message: 'Kunde inte uppdatera kompislistan i chatten.', type: 'error' });
                setChats(realtimeChats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)));
                setIsLoading(false);
            });
        });
        return () => unsubscribe();
    }, [currentUser.uid, currentUser.displayName, currentUser.email, setToastNotification]);

    const activeChat = useMemo(() => {
        if (!activeBuddy) return null;
        const foundChat = chats.find(c => c.participantUids.includes(activeBuddy.uid));
        if (foundChat) return foundChat;
        return {
            id: getChatId(currentUser.uid, activeBuddy.uid),
            participants: [ { uid: currentUser.uid, name: currentUser.displayName || 'Jag', email: currentUser.email || '' }, activeBuddy ],
            participantUids: [currentUser.uid, activeBuddy.uid],
            unreadCounts: {}
        };
    }, [activeBuddy, chats, currentUser]);

    const handleSend = async (text: string, imageDataUrl?: string) => {
        if (!activeChat) return;
        if (!text.trim() && !imageDataUrl) return;
        setIsSending(true);
        try {
            await sendMessage(activeChat.id, currentUser.uid, activeChat.participants, text, imageDataUrl);
            setNewMessage('');
            setImageForPreview(null);
            if (imageInputRef.current) imageInputRef.current.value = '';
            playAudio('uiClick', 0.7);
        } catch (error) {
            console.error("Error sending message:", error);
            setToastNotification({ message: 'Kunde inte skicka meddelande.', type: 'error' });
        } finally {
            setIsSending(false);
        }
    };
    
    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setToastNotification({ message: 'Bilden är för stor (max 5MB).', type: 'error' });
            if (imageInputRef.current) imageInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (!e.target?.result) {
                setToastNotification({ message: 'Kunde inte läsa bildfil.', type: 'error' });
                return;
            }
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;
                let { width, height } = img;
                if (width > height) {
                    if (width > MAX_WIDTH) { height = Math.round(height * (MAX_WIDTH / width)); width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width = Math.round(width * (MAX_HEIGHT / height)); height = MAX_HEIGHT; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { setToastNotification({ message: 'Kunde inte bearbeta bilden.', type: 'error' }); return; }
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setImageForPreview(dataUrl);
            };
            img.onerror = () => { setToastNotification({ message: 'Kunde inte ladda den valda bilden.', type: 'error' }); };
            img.src = e.target.result as string;
        };
        reader.onerror = () => { setToastNotification({ message: 'Kunde inte läsa filen.', type: 'error' }); };
        reader.readAsDataURL(file);
    };

    const handleImageCapture = (base64ImageData: string) => {
        setShowCameraModal(false);
        setImageForPreview(`data:image/jpeg;base64,${base64ImageData}`);
    };

    const handleSelectChat = (buddy: Peppkompis) => {
        onSelectBuddy(buddy);
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div></div>;
    }

    if (activeBuddy && activeChat) {
        return (
            <>
                <div className="animate-fade-in w-full h-full flex flex-col bg-white rounded-xl shadow-soft-lg border border-neutral-light overflow-hidden">
                    <header className="flex items-center p-3 border-b border-neutral-light flex-shrink-0 z-10 bg-white">
                        <div className="flex items-center gap-2">
                            <button onClick={() => onSelectBuddy(null)} className="p-2 text-neutral-dark hover:text-primary rounded-full interactive-transition">
                                <ArrowLeftIcon className="w-6 h-6" />
                            </button>
                            <UserCircleIcon className="w-9 h-9 text-neutral-dark" />
                            <div>
                                <h1 className="text-base font-semibold text-neutral-dark leading-tight">{activeBuddy?.name || 'Chatt'}</h1>
                            </div>
                        </div>
                    </header>
                    
                    <ChatMessages chatId={activeChat.id} currentUser={currentUser} setToastNotification={setToastNotification} />

                    <div className="p-4 border-t border-neutral-light flex-shrink-0 bg-white">
                        <div className="flex items-center gap-2">
                             <input
                                type="file"
                                ref={imageInputRef}
                                onChange={handleImageSelect}
                                accept="image/*"
                                className="hidden"
                                id="chat-image-input"
                            />
                            <button
                                onClick={() => imageInputRef.current?.click()}
                                className="p-3 bg-neutral-light text-neutral-dark rounded-full shadow-sm hover:bg-gray-200 disabled:opacity-50 interactive-transition"
                                aria-label="Ladda upp bild"
                                disabled={isSending}
                            >
                                <UploadIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setShowCameraModal(true)}
                                className="p-3 bg-neutral-light text-neutral-dark rounded-full shadow-sm hover:bg-gray-200 disabled:opacity-50 interactive-transition"
                                aria-label="Ta bild"
                                disabled={isSending}
                            >
                                <CameraIcon className="w-5 h-5" />
                            </button>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => { if (e.key === 'Enter') handleSend(newMessage, undefined) }}
                                placeholder="Skriv ett meddelande..."
                                className="flex-grow px-4 py-3 bg-neutral-light border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                disabled={isSending}
                            />
                            <button
                                onClick={() => handleSend(newMessage, undefined)}
                                disabled={!newMessage.trim() || isSending}
                                className="p-3 bg-primary text-white rounded-full shadow-sm hover:bg-primary-darker disabled:opacity-50 disabled:cursor-not-allowed interactive-transition"
                                aria-label="Skicka meddelande"
                            >
                                {isSending && !imageForPreview ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : <PaperAirplaneIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
                {showCameraModal && (
                    <CameraModal
                        show={showCameraModal}
                        onClose={() => setShowCameraModal(false)}
                        onImageCapture={handleImageCapture}
                        onCameraError={(msg) => {
                            setToastNotification({ message: `Kamerafel: ${msg}`, type: 'error' });
                            setShowCameraModal(false);
                        }}
                    />
                )}
                {imageForPreview && (
                    <ChatImagePreviewModal
                        imageDataUrl={imageForPreview}
                        isSending={isSending}
                        onClose={() => {
                            setImageForPreview(null);
                            if (imageInputRef.current) imageInputRef.current.value = '';
                        }}
                        onSend={(caption, dataUrl) => handleSend(caption, dataUrl)}
                    />
                )}
            </>
        );
    }
    
    // Fallback to chat list view
    return (
        <div className="animate-fade-in w-full h-full flex flex-col bg-white rounded-xl shadow-soft-lg border border-neutral-light">
            <header className="flex items-center p-4 border-b border-neutral-light flex-shrink-0">
                <button onClick={onBack} className="p-2 -ml-2 text-neutral hover:text-primary rounded-md">
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>
                <div className="flex items-center mx-auto pr-8">
                    <UserGroupIcon className="w-7 h-7 text-primary mr-2.5" />
                    <h1 className="text-xl font-bold text-neutral-dark">Chattar</h1>
                </div>
            </header>
            <ChatList chats={chats} onSelectChat={handleSelectChat} currentUser={currentUser} />
        </div>
    );
};
