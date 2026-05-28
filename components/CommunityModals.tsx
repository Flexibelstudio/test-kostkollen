import React, { useState, useEffect, useRef, FC } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@firebase/auth';
import { TimelineEvent, TimelineComment, BuddyDetails, UserProfileData } from '../types';
import { Avatar } from './UserProfileModal';
import { XMarkIcon, CameraIcon, CheckIcon, SmileIcon, TrashIcon, PlusIcon } from './icons';
import { Users as UsersIcon, Image as ImageIcon, Send, ThumbsUp } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { playAudio } from '../services/audioService';

// ==========================================
// 1. FLOATING REACTION PICKER (FACEBOOK STYLE)
// ==========================================
interface FloatingReactionPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectEmoji: (emoji: string) => void;
    currentUserReaction?: string | null;
    className?: string;
    triggerRect?: { left: number; top: number; width: number; height: number } | null;
}

export const FloatingReactionPicker: FC<FloatingReactionPickerProps> = ({
    isOpen,
    onClose,
    onSelectEmoji,
    currentUserReaction,
    className = "",
    triggerRect
}) => {
    const [showFullPicker, setShowFullPicker] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                // Ignore clicks that occur inside the full emoji picker portal
                const target = e.target as HTMLElement;
                if (target.closest('[data-portal="emoji-picker"]') || target.closest('.EmojiPickerReact')) {
                    return;
                }
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Dynamic theme detection
            setIsDark(
                document.documentElement.classList.contains('dark') || 
                document.body.classList.contains('dark')
            );
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

    const element = (
        <div 
            ref={containerRef} 
            className={triggerRect ? "" : `absolute z-40 ${className}`}
            style={triggerRect ? {
                position: 'fixed',
                left: (() => {
                    let x = triggerRect.left + triggerRect.width / 2;
                    // Prevent going offscreen (picker width is ~300px)
                    x = Math.max(165, x);
                    x = Math.min(window.innerWidth - 165, x);
                    return x;
                })(),
                top: (() => {
                    const pickerHeight = 56;
                    const showBelow = triggerRect.top < pickerHeight + 25;
                    return showBelow 
                        ? triggerRect.top + triggerRect.height + 8 
                        : triggerRect.top - 8;
                })(),
                transform: (() => {
                    const pickerHeight = 56;
                    const showBelow = triggerRect.top < pickerHeight + 25;
                    return showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
                })(),
                zIndex: 150
            } : undefined}
        >
            <motion.div 
                initial={{ opacity: 0, scale: 0.85, y: triggerRect ? 5 : 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: triggerRect ? 5 : 10 }}
                transition={{ type: "spring", damping: 18, stiffness: 300 }}
                className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 shadow-2xl border border-neutral-200 dark:border-neutral-800 rounded-full p-1.5 whitespace-nowrap animate-scale-in"
            >
                {emojis.map((emoji) => (
                    <motion.button 
                        key={emoji}
                        type="button"
                        whileHover={{ scale: 1.35, y: -8 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelectEmoji(emoji);
                            onClose();
                        }} 
                        className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-2xl transition-all cursor-pointer select-none ${currentUserReaction === emoji ? 'bg-primary-50 dark:bg-primary-900/30 font-bold scale-110' : ''}`} 
                        title={emoji}
                    >
                        {emoji}
                    </motion.button>
                ))}
                
                <div className="relative">
                    <motion.button 
                        type="button"
                        whileHover={{ scale: 1.25 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowFullPicker(!showFullPicker);
                        }} 
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral transition-colors cursor-pointer" 
                        title="Fler emojis"
                    >
                        <PlusIcon className="w-5 h-5 text-neutral-500" />
                    </motion.button>

                    {showFullPicker && createPortal(
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" data-portal="emoji-picker">
                            {/* Backdrop overlay with blur */}
                            <div 
                                className="absolute inset-0 bg-black/40 backdrop-blur-[1.5px]" 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowFullPicker(false);
                                }}
                            />
                            {/* Centered card holding the picker */}
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                                className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden p-2.5 border border-neutral-200 dark:border-neutral-800 flex flex-col items-center z-10"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="w-full flex items-center justify-between px-3 pb-2 mb-2 border-b border-neutral-100 dark:border-neutral-800">
                                    <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200">Välj emoji</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowFullPicker(false)}
                                        className="text-xs font-semibold text-primary dark:text-primary-light hover:underline px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors cursor-pointer"
                                    >
                                        Stäng
                                    </button>
                                </div>
                                <EmojiPicker 
                                    onEmojiClick={(emojiData) => {
                                        onSelectEmoji(emojiData.emoji);
                                        setShowFullPicker(false);
                                        onClose();
                                    }}
                                    autoFocusSearch={true}
                                    theme={isDark ? Theme.DARK : Theme.LIGHT}
                                    width={290}
                                    height={380}
                                />
                            </motion.div>
                        </div>,
                        document.body
                    )}
                </div>
            </motion.div>
        </div>
    );

    return triggerRect ? createPortal(element, document.body) : element;
};


// ==========================================
// 2. REACTIONS LIST BOTTOM SHEET/POPUP
// ==========================================
interface ReactionsBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    reactions: Record<string, Record<string, string>> | null; // { emoji: { uid: name } }
    likes?: string[]; // fallback for legacy likes [uid]
    currentUser: User;
    buddyDetails: BuddyDetails[];
    sentFriendRequests: Set<string>;
    onAddFriend?: (userId: string, userName: string) => void;
}

export const ReactionsBottomSheet: FC<ReactionsBottomSheetProps> = ({
    isOpen,
    onClose,
    reactions,
    likes = [],
    currentUser,
    buddyDetails,
    sentFriendRequests,
    onAddFriend
}) => {
    // Dynamic Tabs based on actual reactions
    const reactMap = reactions || {};
    
    // Calculate compiled user lists of all reactions (including duplicates)
    const rawReactionsList = React.useMemo(() => {
        const list: { uid: string; name: string; emoji: string }[] = [];

        // 1. Core reactions map
        Object.entries(reactMap).forEach(([emoji, users]) => {
            Object.entries(users).forEach(([uid, name]) => {
                list.push({ uid, name, emoji });
            });
        });

        // 2. Legacy Likes
        likes.forEach(uid => {
            const hasAny = list.some(item => item.uid === uid);
            if (!hasAny) {
                const buddy = buddyDetails.find(b => b.uid === uid);
                const name = uid === currentUser.uid ? 'Du' : (buddy?.name || 'Kompis');
                list.push({ uid, name, emoji: '❤️' });
            }
        });

        return list;
    }, [reactMap, likes, buddyDetails, currentUser.uid]);

    // Group counts
    const tabCounts = React.useMemo(() => {
        const counts: Record<string, number> = {};
        rawReactionsList.forEach(item => {
            counts[item.emoji] = (counts[item.emoji] || 0) + 1;
        });
        return counts;
    }, [rawReactionsList]);

    const emojisUsed = Object.keys(tabCounts).sort((a, b) => tabCounts[b] - tabCounts[a]);
    const [selectedTab, setSelectedTab] = useState<string>('all'); // 'all' or emoji

    // Grouping for the 'all' tab
    const groupedUsers = React.useMemo(() => {
        const groups: Record<string, { uid: string; name: string; emojis: string[] }> = {};
        rawReactionsList.forEach(item => {
            if (!groups[item.uid]) {
                groups[item.uid] = { uid: item.uid, name: item.name, emojis: [] };
            }
            if (!groups[item.uid].emojis.includes(item.emoji)) {
                groups[item.uid].emojis.push(item.emoji);
            }
        });
        return Object.values(groups);
    }, [rawReactionsList]);

    // Construct the display list
    const displayList = React.useMemo(() => {
        if (selectedTab === 'all') {
            return groupedUsers;
        } else {
            return rawReactionsList
                .filter(item => item.emoji === selectedTab)
                .map(item => ({
                    uid: item.uid,
                    name: item.name,
                    emojis: [selectedTab]
                }));
        }
    }, [selectedTab, groupedUsers, rawReactionsList]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center pt-10 pb-6">
                {/* Backdrop overlay */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black"
                />

                {/* Bottom Sheet Modal Container */}
                <motion.div 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="absolute bottom-0 md:relative md:bottom-auto w-full max-w-lg bg-white dark:bg-neutral-900 rounded-t-[24px] md:rounded-[20px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] md:max-h-[75vh]"
                >
                    {/* Top Drag Indicator (only for mobile bottom-sheet feel) */}
                    <div className="w-full h-6 flex items-center justify-center shrink-0 md:hidden">
                        <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-lg text-neutral-800 dark:text-neutral-100">Reaktioner</span>
                            <span className="text-sm px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full font-bold text-neutral-500">
                                {rawReactionsList.length}
                            </span>
                        </div>
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="p-1 px-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-300 rounded-full transition-colors cursor-pointer"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Emojis Tabs Horizontal List */}
                    <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900/40 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2 overflow-x-auto shrink-0 hide-scrollbar select-none">
                        <button
                            onClick={() => setSelectedTab('all')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5
                                ${selectedTab === 'all' 
                                    ? 'bg-primary text-white shadow-sm' 
                                    : 'bg-white dark:bg-neutral-800 text-neutral hover:bg-neutral-100 border border-neutral-100 dark:border-neutral-700'
                                }`}
                        >
                            <span>Alla</span>
                            <span className={selectedTab === 'all' ? 'text-white/90' : 'text-neutral-400'}>{rawReactionsList.length}</span>
                        </button>

                        {emojisUsed.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => setSelectedTab(emoji)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5
                                    ${selectedTab === emoji 
                                        ? 'bg-primary text-white shadow-sm' 
                                        : 'bg-white dark:bg-neutral-800 text-neutral hover:bg-neutral-100 border border-neutral-100 dark:border-neutral-700'
                                    }`}
                            >
                                <span className="text-sm leading-none">{emoji}</span>
                                <span className={selectedTab === emoji ? 'text-white/90' : 'text-neutral-500 font-semibold'}>{tabCounts[emoji]}</span>
                            </button>
                        ))}
                    </div>

                    {/* User list (scrollable) */}
                    <div className="flex-grow overflow-y-auto p-4 space-y-3.5 custom-scrollbar min-h-[250px]">
                        {displayList.length > 0 ? (
                            displayList.map(item => {
                                const isMe = item.uid === currentUser.uid;
                                const isFriend = buddyDetails.some(b => b.uid === item.uid);
                                const isPending = sentFriendRequests.has(item.uid);
                                const buddyInfo = buddyDetails.find(b => b.uid === item.uid);

                                return (
                                    <div key={item.uid} className="flex items-center justify-between gap-3 group">
                                        <div className="flex items-center gap-3">
                                            {/* Avatar with Emoji overlay badge */}
                                            <div className="relative">
                                                <Avatar photoURL={buddyInfo?.photoURL} size={48} />
                                                <div className="absolute -bottom-1 -right-2 flex items-center -space-x-1 select-none">
                                                    {item.emojis.map((em, idx) => (
                                                        <div key={idx} className="w-5.5 h-5.5 rounded-full bg-white dark:bg-neutral-950 shadow-md border border-neutral-100 dark:border-neutral-800 flex items-center justify-center text-[11px] select-none shrink-0" style={{ zIndex: 10 + idx }}>
                                                            {em}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="font-bold text-[15px] text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                                                    {isMe ? 'Du' : item.name}
                                                    {isFriend && (
                                                        <span className="text-[10px] bg-green-50 dark:bg-green-950/30 text-green-600 px-1.5 py-0.5 rounded-full border border-green-100 font-bold">
                                                            Kompis
                                                        </span>
                                                    )}
                                                </h4>
                                                <p className="text-xs text-neutral-400">
                                                    {isMe ? 'Skaparen av ögonblicket' : 'Kostloggen-medlem'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Friend Request Trigger */}
                                        {!isMe && !isFriend && onAddFriend && (
                                            isPending ? (
                                                <div className="flex items-center gap-1 px-3 py-1.5 bg-green-50 rounded-full text-xs font-bold text-green-600 border border-green-100">
                                                    <CheckIcon className="w-4 h-4" />
                                                    <span>Skickad</span>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => onAddFriend(item.uid, item.name)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/20 dark:hover:bg-primary-950/40 rounded-full text-xs font-bold text-primary dark:text-primary-light transition-colors cursor-pointer shadow-sm border border-primary-100/30"
                                                >
                                                    <UsersIcon className="w-3.5 h-3.5" />
                                                    <span>+ Kompis</span>
                                                </button>
                                            )
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-neutral-400">Inga reaktioner hittades för denna kategori.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};


// ==========================================
// 3. COMMENTS BOTTOM SHEET (FACEBOOK STYLE)
// ==========================================
interface CommentsBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    event: TimelineEvent;
    currentUser: User;
    userProfile: UserProfileData;
    onAddComment: (event: TimelineEvent, text: string, imageBase64?: string) => Promise<void>;
    onDeleteComment?: (eventId: string, commentId: string) => void;
    onToggleCommentReaction: (event: TimelineEvent, commentId: string, emoji: string) => void;
    onAddFriend?: (userId: string, userName: string) => void;
    sentFriendRequests: Set<string>;
    buddyDetails: BuddyDetails[];
    onImageClick: (src: string, alt: string) => void;
    setToastNotification?: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

export const CommentsBottomSheet: FC<CommentsBottomSheetProps> = ({
    isOpen,
    onClose,
    event,
    currentUser,
    userProfile,
    onAddComment,
    onDeleteComment,
    onToggleCommentReaction,
    onAddFriend,
    sentFriendRequests,
    buddyDetails,
    onImageClick,
    setToastNotification
}) => {
    const [newComment, setNewComment] = useState('');
    const [commentImage, setCommentImage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeCommentReactionId, setActiveCommentReactionId] = useState<string | null>(null);
    const [commentReactionTriggerRect, setCommentReactionTriggerRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [showReactionOverlayFor, setShowReactionOverlayFor] = useState<string | null>(null); // For hover list of who reacted

    const fileInputRef = useRef<HTMLInputElement>(null);
    const commentsListEndRef = useRef<HTMLDivElement>(null);

    // Lock body scroll of parent page when modal active
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            if (commentsListEndRef.current) {
                setTimeout(() => {
                    commentsListEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 300);
            }
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newComment.trim() && !commentImage) || isSubmitting) return;
        setIsSubmitting(true);
        playAudio('uiClick');

        try {
            await onAddComment(event, newComment, commentImage || undefined);
            setNewComment('');
            setCommentImage(null);
            
            // Auto scroll comments list bottom
            setTimeout(() => {
                commentsListEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (error) {
            console.error(error);
            if (setToastNotification) setToastNotification({ message: 'Kunde inte skicka kommentar.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    const maxSize = 1024;
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
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        setCommentImage(canvas.toDataURL('image/jpeg', 0.8));
                    }
                };
            };
        }
    };

    // Calculate sum of post reactions
    const reactSumCount = Object.values(event.reactions || {}).reduce((acc, currentObj) => acc + Object.keys(currentObj).length, 0);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop overlay */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black"
                />

                {/* Bottom Sheet Modal Container */}
                <motion.div 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 220 }}
                    className="absolute bottom-0 md:relative md:bottom-auto w-full max-w-lg bg-white dark:bg-neutral-900 rounded-t-[24px] md:rounded-[20px] shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[75vh]"
                >
                    {/* Top Drag Indicator (only for mobile bottom-sheet feel) */}
                    <div className="w-full h-5 flex items-center justify-center shrink-0 md:hidden">
                        <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            {/* Little visual of top 2 reactions */}
                            <div className="flex items-center select-none text-sm leading-none">
                                {Object.keys(event.reactions || {}).slice(0, 2).map(emoji => (
                                    <span key={emoji} className="-mr-1">{emoji}</span>
                                ))}
                                {reactSumCount > 0 && (
                                    <span className="text-xs font-bold text-neutral-500 ml-2">
                                        {reactSumCount} reaktioner
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-neutral-300">|</span>
                            <span className="font-bold text-[15px] text-neutral-800 dark:text-neutral-100">
                                Kommentarer ({event.comments?.length || 0})
                            </span>
                        </div>
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="p-1 px-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-300 rounded-full transition-colors cursor-pointer"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Comments list (scrollable) */}
                    <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar bg-neutral-50/55 dark:bg-neutral-900/10">
                        {event.comments && event.comments.length > 0 ? (
                            event.comments.map(comment => {
                                const reactions = comment.reactions || {};
                                const reactionCounts: { [emoji: string]: number } = {};
                                let userReactionEmoji: string | null = null;
                                
                                Object.keys(reactions).forEach(emoji => {
                                    reactionCounts[emoji] = Object.keys(reactions[emoji]).length;
                                    if (reactions[emoji][currentUser.uid]) {
                                        userReactionEmoji = emoji;
                                    }
                                });
                                
                                const hasReactions = Object.keys(reactionCounts).length > 0;
                                const isMyComment = comment.authorUid === currentUser.uid;

                                return (
                                    <div key={comment.id} className="flex items-start gap-2.5 group animate-fade-in">
                                        <Avatar photoURL={comment.authorPhotoURL} size={36} />
                                        <div className="flex-1 min-w-0">
                                            {/* Comment Bubble base */}
                                            <div className="rounded-2xl rounded-tl-none px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-sm relative">
                                                {/* Trash icon for comment author */}
                                                {onDeleteComment && isMyComment && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (window.confirm("Är du säker på att du vill ta bort kommentaren?")) {
                                                                onDeleteComment(event.id, comment.id);
                                                            }
                                                        }}
                                                        className="absolute top-2 right-2 p-1 text-neutral-400 hover:text-red-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors"
                                                        title="Ta bort kommentar"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}

                                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                    <p className="font-bold text-neutral-800 dark:text-neutral-100 text-[14px]">
                                                        {isMyComment ? 'Du' : comment.authorName}
                                                    </p>
                                                    {!isMyComment && onAddFriend && !buddyDetails.some(b => b.uid === comment.authorUid) && (
                                                        sentFriendRequests.has(comment.authorUid) ? (
                                                            <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 rounded-md text-[9px] font-bold text-green-600 border border-green-100 leading-none">
                                                                <CheckIcon className="w-2.5 h-2.5" />
                                                                <span>Skickad</span>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={() => onAddFriend(comment.authorUid, comment.authorName)}
                                                                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary-100/80 hover:bg-primary-100 rounded-md text-[9px] font-bold text-primary transition-colors cursor-pointer leading-none"
                                                                title="Lägg till kompis"
                                                            >
                                                                <span>+ Kompis</span>
                                                            </button>
                                                        )
                                                    )}
                                                </div>

                                                {/* Text & Image attached */}
                                                {comment.text && <p className="text-neutral-700 dark:text-neutral-200 text-base break-words leading-relaxed">{comment.text}</p>}
                                                {comment.imageUrl && (
                                                    <div className="mt-2 rounded-lg overflow-hidden max-w-[200px] border border-neutral-200 dark:border-neutral-700">
                                                        <img 
                                                            src={comment.imageUrl} 
                                                            alt="Kommentar bild" 
                                                            className="w-full h-auto object-cover cursor-pointer hover:scale-102 transition-transform" 
                                                            onClick={() => onImageClick(comment.imageUrl!, 'Kommentar bild')} 
                                                        />
                                                    </div>
                                                )}

                                                {/* FLOATING COMMENT REACTIONS LIST (Facebook style) */}
                                                {hasReactions && (
                                                    <div 
                                                        onClick={() => {
                                                            setShowReactionOverlayFor(comment.id);
                                                        }}
                                                        className="absolute -bottom-2.5 right-2 flex items-center gap-1 bg-white dark:bg-neutral-700 shadow-md border border-neutral-200 dark:border-neutral-600 rounded-full px-2 py-0.5 text-[10px] z-10 cursor-pointer hover:scale-108 active:scale-95 transition-all select-none"
                                                    >
                                                        {Object.entries(comment.reactions || {}).map(([emoji, users]) => {
                                                            const count = Object.keys(users).length;
                                                            if (count === 0) return null;
                                                            return (
                                                                <span key={emoji} className="flex items-center gap-0.5" title={emoji}>
                                                                    <span>{emoji}</span>
                                                                    <span className="text-neutral-500 dark:text-neutral-300 font-bold">{count}</span>
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Sub Action Bar: Time indicator / React Trigger details */}
                                            <div className="flex items-center gap-3 mt-1.5 ml-2.5 select-none relative">
                                                <span className="text-[12px] text-neutral-400">
                                                    {new Date(comment.timestamp).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                                <span className="text-[12px] text-neutral-300">·</span>

                                                {/* Hold trigger or simple click React trigger */}
                                                <div className="relative">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setCommentReactionTriggerRect({
                                                                left: rect.left,
                                                                top: rect.top,
                                                                width: rect.width,
                                                                height: rect.height
                                                            });
                                                            setActiveCommentReactionId(activeCommentReactionId === comment.id ? null : comment.id);
                                                        }}
                                                        className={`flex items-center gap-1.5 text-[12.5px] font-bold hover:underline cursor-pointer transition-colors
                                                            ${userReactionEmoji ? 'text-primary dark:text-primary-light font-extrabold' : 'text-neutral-500 hover:text-neutral-800'}`}
                                                    >
                                                        <ThumbsUp className="w-3.5 h-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                                                        <span>{userReactionEmoji ? 'Gillar' : 'Gilla'}</span>
                                                    </button>

                                                    {/* Custom Emojis tray popup */}
                                                    <AnimatePresence>
                                                        {activeCommentReactionId === comment.id && (
                                                            <FloatingReactionPicker 
                                                                 isOpen={true} 
                                                                 currentUserReaction={userReactionEmoji}
                                                                 onSelectEmoji={(emoji) => {
                                                                     onToggleCommentReaction(event, comment.id, emoji);
                                                                     setActiveCommentReactionId(null);
                                                                 }}
                                                                 onClose={() => setActiveCommentReactionId(null)}
                                                                 triggerRect={commentReactionTriggerRect}
                                                            />
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Nested Reaction list Bottom-sheet modal viewer proxy */}
                                        {showReactionOverlayFor === comment.id && (
                                            <ReactionsBottomSheet 
                                                isOpen={true}
                                                onClose={() => setShowReactionOverlayFor(null)}
                                                reactions={comment.reactions || {}}
                                                currentUser={currentUser}
                                                buddyDetails={buddyDetails}
                                                sentFriendRequests={sentFriendRequests}
                                                onAddFriend={onAddFriend}
                                            />
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-10">
                                <span className="text-3xl">💬</span>
                                <h3 className="font-bold text-neutral-500 dark:text-neutral-400 mt-2">Inga kommentarer än</h3>
                                <p className="text-neutral-400 text-sm mt-1">Bli först med att kommentera det här inlägget!</p>
                            </div>
                        )}
                        <div ref={commentsListEndRef} />
                    </div>

                    {/* Bottom Comment Input bar */}
                    <div className="shrink-0 bg-white dark:bg-neutral-800 border-t border-neutral-100 dark:border-neutral-700 p-3 select-none">
                        {commentImage && (
                            <div className="relative inline-block mb-2 bg-neutral-100 p-1.5 rounded-lg border border-neutral-200">
                                <img src={commentImage} alt="Förhandsgranskning" className="h-16 rounded-md object-contain" />
                                <button 
                                    type="button"
                                    onClick={() => setCommentImage(null)}
                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                    title="Ta bort bild"
                                >
                                    <XMarkIcon className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
                            <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={36} className="shrink-0" />
                            <div className="flex-1 min-w-0 bg-neutral-100 dark:bg-neutral-700/60 rounded-full px-3 py-1.5 flex items-center gap-2 border border-neutral-200/50 dark:border-neutral-700 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder={`Kommentera som ${userProfile.name || 'Du'}...`}
                                    className="flex-1 bg-transparent text-sm text-neutral-850 dark:text-neutral-100 focus:outline-none placeholder-neutral-400 py-1"
                                    disabled={isSubmitting}
                                />
                                
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-1.5 text-neutral-400 hover:text-primary dark:hover:text-primary-light hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-all"
                                        title="Ladda upp bild"
                                        disabled={isSubmitting}
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleImageChange} 
                                        accept="image/*" 
                                        className="hidden" 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCameraModal(true)}
                                        className="p-1.5 text-neutral-400 hover:text-primary dark:hover:text-primary-light hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-all"
                                        title="Ta foto"
                                        disabled={isSubmitting}
                                    >
                                        <CameraIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className={`p-2.5 rounded-full text-white shadow-md select-none transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0
                                    ${(!newComment.trim() && !commentImage) || isSubmitting
                                        ? 'bg-neutral-300 dark:bg-neutral-700 cursor-not-allowed text-neutral-400 shadow-none'
                                        : 'bg-primary hover:bg-primary-dark shadow-primary/20'
                                    }`}
                                disabled={(!newComment.trim() && !commentImage) || isSubmitting}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
