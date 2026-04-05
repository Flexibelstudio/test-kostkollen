
import React, { useState, useEffect, useMemo, FC, useCallback, useRef } from 'react';
import type { User } from '@firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Peppkompis, TimelineEvent, Achievement, BuddyDetails, UserProfileData, PeppkompisRequest, TimelineComment, Reactions, PostCategory, UserRole, Chat } from '../types';
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
    toggleReactionOnComment,
    fetchCommunityTimeline,
    _fetchCommunityTimelinePaginated,
    listenToCommunityTimeline,
    createUserPost,
    cancelFriendRequest,
    deleteTimelineEvent
} from '../services/firestoreService';
import { subscribeToUserChats, sendMessage } from '../services/chatService';
import { 
    HeartIcon, 
    TrashIcon, CheckIcon, XMarkIcon, UserPlusIcon, SearchIcon, ArrowRightIcon,
    ShareIcon, PencilIcon, CameraIcon, SmileIcon
} from './icons';
import { User as UserIcon, Dumbbell, PieChart, MoreHorizontal, Image as ImageIcon, Send, RefreshCw, PlusIcon } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { playAudio } from '../services/audioService';
import { Avatar } from './UserProfileModal';
import Lightbox from './Lightbox';
import { ChatRoomsView } from './ChatRoomsView';
import CameraModal from './CameraModal';
import { COACH_PERSONAS } from '../constants';
import { uploadImageToStorage, base64ToBlob } from '../utils/storageUtils';
import { getBootcampRankInfo } from '../utils/bootcampUtils';

// --- HELPER FUNCTIONS ---

export const resizeImage = (file: File, maxSize: number): Promise<string> => {
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

import { calculateProgressPercentage, getGoalShortDescription } from '../utils/progressUtils';


// --- SUB-COMPONENTS ---

export const CreatePostWidget: FC<{
    currentUser: User;
    userProfile: UserProfileData;
    onPostCreated: (post: TimelineEvent) => void;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    userRole?: UserRole;
    isCoachDashboard?: boolean;
    activeBootcamp?: any;
    initialText?: string | null;
}> = ({ currentUser, userProfile, onPostCreated, setToastNotification, userRole, isCoachDashboard, activeBootcamp, initialText }) => {
    const [isExpanded, setIsExpanded] = useState(!!initialText);
    const [text, setText] = useState(initialText || '');
    const [image, setImage] = useState<string | null>(null);
    const [category, setCategory] = useState<PostCategory>('general');
    const [visibility, setVisibility] = useState<'global' | 'friends' | 'bootcamp' | 'bootcamp_and_friends'>('friends');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialText) {
            setText(initialText);
            setIsExpanded(true);
        }
    }, [initialText]);

    const isCoach = userRole === 'coach' && isCoachDashboard;
    const displayPhotoURL = isCoach ? '/favicon.png' : userProfile.photoURL;
    const displayName = isCoach ? 'Kostloggen' : (userProfile.name || 'Du');

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const resized = await resizeImage(file, 1024);
                setImage(resized);
                setIsExpanded(true); 
            } catch (error) {
                setToastNotification({ message: 'Kunde inte ladda upp bild.', type: 'error' });
            }
        }
    };

    const handleSubmit = async () => {
        if (!text.trim() && !image) return;
        setIsSubmitting(true);
        playAudio('uiClick');

        try {
            let finalImageUrl = image || undefined;
            
            // If image is a base64 string (from resizeImage or CameraModal), upload it to Storage
            if (image && image.startsWith('data:image')) {
                try {
                    const blob = await base64ToBlob(image);
                    const fileName = `post_${Date.now()}.jpg`;
                    const path = `timeline_images/${currentUser.uid}/${fileName}`;
                    finalImageUrl = await uploadImageToStorage(blob, path);
                } catch (uploadError) {
                    console.error("Error uploading image to storage:", uploadError);
                    setToastNotification({ message: 'Kunde inte ladda upp bilden till servern.', type: 'error' });
                    setIsSubmitting(false);
                    return;
                }
            }

            const isGlobal = isCoach || visibility === 'global';
            const isBootcampPost = visibility === 'bootcamp' || visibility === 'bootcamp_and_friends';
            
            let title = 'skapade ett inlägg';
            if (isGlobal) {
                title = 'delade ett meddelande till alla';
            } else if (isCoach && isBootcampPost) {
                title = 'delade ett meddelande till truppen';
            }

            const newPost = await createUserPost(
                currentUser.uid, 
                text, 
                category, 
                finalImageUrl, 
                isCoach ? 'global' : visibility, 
                isCoach ? displayName : undefined, 
                isCoach ? displayPhotoURL : undefined,
                activeBootcamp?.cohortId
            );
            
            const optimisticEvent: TimelineEvent = {
                id: newPost.id,
                type: 'user_post',
                timestamp: Date.now(),
                title: title,
                description: text,
                icon: (isGlobal || isCoach) ? '📢' : category === 'pepp' ? '💖' : category === 'workout' ? '💪' : category === 'food' ? '🥗' : category === 'question' ? '❓' : '📝',
                userId: currentUser.uid,
                userName: displayName,
                userPhotoURL: displayPhotoURL,
                gender: userProfile.gender,
                reactions: {},
                comments: [],
                relatedDocPath: `users/${currentUser.uid}/posts/${newPost.id}`,
                category: category,
                imageUrl: image || undefined,
                visibleTo: newPost.visibleTo,
                isGlobal: isGlobal,
                streakAtPost: newPost.streakAtPost,
                bootcampStreakAtPost: newPost.bootcampStreakAtPost,
                goalTextAtPost: newPost.goalTextAtPost,
                progressAtPost: newPost.progressAtPost,
                bootcampId: newPost.bootcampId
            };
            
            onPostCreated(optimisticEvent);
            setText('');
            setImage(null);
            setCategory('general');
            setToastNotification({ message: 'Inlägg publicerat!', type: 'success' });
            playAudio('logSuccess');
            setIsExpanded(false);
        } catch (error) {
            console.error(error);
            setToastNotification({ message: 'Kunde inte skapa inlägg.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const categories: { id: PostCategory, label: string, icon: string }[] = [
        { id: 'pepp', label: 'Pepp', icon: '💖' },
        { id: 'workout', label: 'Träning', icon: '💪' },
        { id: 'food', label: 'Mat', icon: '🥗' },
        { id: 'question', label: 'Fråga', icon: '❓' },
    ];

    const toggleCategory = (catId: PostCategory) => {
        setCategory(prev => prev === catId ? 'general' : catId);
    };

    if (!isExpanded) {
        return (
            <div 
                onClick={() => setIsExpanded(true)}
                className="bg-white dark:bg-neutral-darker rounded-2xl shadow-sm border border-neutral-light p-3 mb-6 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-dark transition-colors active:scale-[0.99] select-none"
            >
                <Avatar photoURL={displayPhotoURL} gender={userProfile.gender} size={40} className="flex-shrink-0" />
                <div className="flex-grow bg-[#ffffff] rounded-full px-4 py-2.5 text-[#6B7280] text-sm font-medium border border-[#E5E7EB]">
                    Vad tänker du på? Dela med dig...
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-neutral-darker rounded-2xl shadow-sm border border-neutral-light p-4 mb-6 relative animate-fade-in">
            <button 
                onClick={() => setIsExpanded(false)}
                className="absolute top-2 right-2 p-2 text-neutral-400 hover:text-neutral-dark dark:hover:text-white rounded-full hover:bg-neutral-light dark:hover:bg-neutral-dark transition-colors z-10"
                title="Stäng"
            >
                <XMarkIcon className="w-5 h-5" />
            </button>

            <div className="flex gap-3">
                <Avatar photoURL={displayPhotoURL} gender={userProfile.gender} size={48} className="flex-shrink-0" />
                <div className="flex-grow">
                    <p className="font-bold text-sm text-neutral-dark dark:text-white mb-2">{displayName}</p>
                    <textarea
                        autoFocus
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Vad tänker du på? Dela med dig till dina kompisar..."
                        className="w-full bg-[#ffffff] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3bab5a] min-h-[100px] resize-none pr-8 text-[#000000] border border-[#E5E7EB] placeholder-[#9CA3AF]"
                    />
                    {image && (
                        <div className="relative mt-2 inline-block bg-white rounded-lg p-1 border border-neutral-light">
                            <img src={image} alt="Preview" className="h-24 w-auto rounded-md object-contain" />
                            <button 
                                onClick={() => setImage(null)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                            >
                                <XMarkIcon className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                    
                    {activeBootcamp && !isCoach && (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                            <span className="text-neutral-500 font-medium">Synligt för:</span>
                            <select
                                value={visibility}
                                onChange={(e) => setVisibility(e.target.value as any)}
                                className="bg-neutral-50 border border-neutral-200 text-neutral-dark rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="friends">Mina kompisar</option>
                                <option value="bootcamp">Bara bootcamp</option>
                                <option value="bootcamp_and_friends">Båda (Bootcamp & Kompisar)</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-center mt-3 gap-3 pt-3 border-t border-neutral-light/50">
                 <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 hide-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border ${
                                category === cat.id 
                                    ? 'bg-primary-100 border-primary text-primary-darker' 
                                    : 'bg-white dark:bg-neutral-darker border-neutral-light text-neutral hover:bg-neutral-light dark:hover:bg-neutral-dark'
                            }`}
                        >
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                    <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageSelect} />
                    
                    <button onClick={() => setShowCameraModal(true)} className="p-2 text-neutral hover:text-primary hover:bg-primary-50 rounded-full transition-colors" title="Ta bild">
                        <CameraIcon className="w-5 h-5" />
                    </button>

                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-neutral hover:text-primary hover:bg-primary-50 rounded-full transition-colors" title="Ladda upp bild">
                        <ImageIcon className="w-5 h-5" />
                    </button>
                    
                    <button 
                        onClick={handleSubmit}
                        disabled={(!text.trim() && !image) || isSubmitting}
                        className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-full shadow-md hover:bg-primary-darker active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-2"
                    >
                        {isSubmitting ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent" /> : <Send className="w-4 h-4" />}
                        Publicera
                    </button>
                </div>
            </div>

            <CameraModal 
                show={showCameraModal} 
                onClose={() => setShowCameraModal(false)} 
                onImageCapture={(imageDataUrl) => { 
                    setImage('data:image/jpeg;base64,' + imageDataUrl); 
                    setIsExpanded(true); 
                    setShowCameraModal(false); 
                }} 
                onCameraError={(err) => setToastNotification({message: err, type: 'error'})} 
                instructionText="Ta en bild att dela"
                hideTip={true}
            />
        </div>
    );
};

const BuddyCard: FC<{ 
    buddy: BuddyDetails; 
    achievements: Achievement[]; 
    onRemove: () => void; 
    currentUser: User;
}> = ({ buddy, achievements, onRemove, currentUser }) => {
    const [showMenu, setShowMenu] = useState(false);

    const progressPercentage = useMemo(() => {
        return calculateProgressPercentage(
            buddy.measurementMethod,
            buddy.goalStartWeight, buddy.currentWeight, buddy.desiredWeightChangeKg,
            buddy.goalStartFatMassKg, buddy.currentFatMass, buddy.desiredFatMassChangeKg,
            buddy.goalStartMuscleMassKg, buddy.currentMuscleMass, buddy.desiredMuscleMassChangeKg,
            buddy.mainGoalCompleted
        );
    }, [buddy]);
    
    const goalDescription = useMemo(() => {
        if (buddy.mainGoalCompleted) return "Mål uppnått!";
        const desc = getGoalShortDescription(buddy.measurementMethod, buddy.desiredWeightChangeKg, buddy.desiredFatMassChangeKg, buddy.desiredMuscleMassChangeKg);
        return desc !== 'Mål: Bibehålla' ? desc : (buddy.goalSummary || 'Inget specifikt mål');
    }, [buddy]);

    return (
        <div className="bg-white dark:bg-neutral-darker p-4 rounded-xl shadow-soft-lg border border-neutral-light/70 space-y-3 relative">
             <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <Avatar photoURL={buddy.photoURL} gender={buddy.gender} size={48} />
                    <div>
                        <h3 className="text-xl font-bold text-neutral-dark">{buddy.name}</h3>
                        <p className="text-xs text-neutral flex items-center gap-2 mt-0.5">
                            {buddy.currentStreak !== undefined && buddy.currentStreak > 0 && (
                                <span className="font-medium text-orange-500">🔥 {buddy.currentStreak}</span>
                            )}
                            {buddy.bootcampStreak !== undefined && buddy.bootcampStreak > 0 && (
                                <span className="font-medium text-yellow-600">🎖️ {buddy.bootcampStreak}</span>
                            )}
                            <span className="text-neutral-300">|</span>
                            <span className="truncate">{goalDescription}</span>
                        </p>
                    </div>
                </div>
                
                <div className="relative">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        className="p-1.5 text-neutral-400 hover:text-neutral-dark dark:hover:text-white rounded-full hover:bg-neutral-light dark:hover:bg-neutral-dark transition-colors"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-neutral-darker rounded-lg shadow-xl border border-neutral-light z-30 animate-scale-in origin-top-right overflow-hidden">
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
            {showMenu && (
                <div className="fixed inset-0 z-20 cursor-default" onClick={() => setShowMenu(false)}></div>
            )}

            <div>
                <div className="w-full bg-neutral-light dark:bg-neutral-dark rounded-full h-2.5 shadow-inner">
                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
                </div>
                <p className="text-right text-sm font-semibold text-primary-darker mt-1">{progressPercentage.toFixed(0)}%</p>
            </div>
        </div>
    );
};

const renderWeightDescription = (description: string) => {
    const parts = description.split('\n'); 
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

                let colorClass = 'text-accent'; 
                if (changeNum > 0) {
                    if (label === 'Muskler') colorClass = 'text-primary'; 
                    else colorClass = 'text-red-600'; 
                } else if (changeNum < 0) {
                    if (label === 'Muskler') colorClass = 'text-red-600'; 
                    else colorClass = 'text-primary'; 
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

export const TimelineEventCard: FC<{
    event: TimelineEvent;
    currentUser: User;
    userProfile: UserProfileData;
    onTogglePepp: (event: TimelineEvent, emoji: string) => void;
    onAddComment: (event: TimelineEvent, text: string, imageBase64?: string) => Promise<void>;
    onToggleLike: (event: TimelineEvent, commentId: string) => void;
    onToggleCommentReaction: (event: TimelineEvent, commentId: string, emoji: string) => void;
    onDelete: (eventId: string) => void;
    onImageClick: (src: string, alt: string) => void;
    onShare?: (event: TimelineEvent) => void;
    lastViewTimestamp: number | null;
    buddyDetails: BuddyDetails[]; // Passed for stats lookup
    currentStreak: number; // Current user's streak
    activeBootcamp?: any;
    setToastNotification?: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}> = ({ event, currentUser, userProfile, onTogglePepp, onAddComment, onToggleLike, onToggleCommentReaction, onDelete, onImageClick, onShare, lastViewTimestamp, buddyDetails, currentStreak, activeBootcamp, setToastNotification }) => {
    const [newComment, setNewComment] = useState('');
    const [commentImage, setCommentImage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showReactionMenu, setShowReactionMenu] = useState(false);
    const [activeCommentReactionId, setActiveCommentReactionId] = useState<string | null>(null);
    const [activeCommentEmojiPickerId, setActiveCommentEmojiPickerId] = useState<string | null>(null);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const reactionMenuRef = useRef<HTMLDivElement>(null);
    const commentReactionMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
            if (reactionMenuRef.current && !reactionMenuRef.current.contains(e.target as Node)) {
                setShowReactionMenu(false);
            }
            if (commentReactionMenuRef.current && !commentReactionMenuRef.current.contains(e.target as Node)) {
                setActiveCommentReactionId(null);
                setActiveCommentEmojiPickerId(null);
            }
        };
        if (showEmojiPicker || showReactionMenu || activeCommentReactionId || activeCommentEmojiPickerId) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker, showReactionMenu, activeCommentReactionId, activeCommentEmojiPickerId]);

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newComment.trim() && !commentImage) || isSubmitting) return;
        setIsSubmitting(true);
        
        try {
            let finalImageUrl = commentImage || undefined;
            
            if (commentImage && commentImage.startsWith('data:image')) {
                try {
                    const blob = await base64ToBlob(commentImage);
                    const fileName = `comment_${Date.now()}.jpg`;
                    const path = `comment_images/${currentUser.uid}/${fileName}`;
                    finalImageUrl = await uploadImageToStorage(blob, path);
                } catch (uploadError) {
                    console.error("Error uploading comment image to storage:", uploadError);
                    if (setToastNotification) setToastNotification({ message: 'Kunde inte ladda upp bilden till servern.', type: 'error' });
                    setIsSubmitting(false);
                    return;
                }
            }

            await onAddComment(event, newComment, finalImageUrl);
            setNewComment('');
            setCommentImage(null);
        } catch (error) {
            console.error("Error submitting comment:", error);
            if (setToastNotification) setToastNotification({ message: 'Kunde inte skicka kommentar.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const resized = await resizeImage(file, 1024);
                setCommentImage(resized);
            } catch (error) {
                console.error("Error resizing image:", error);
            }
        }
    };

    const handleDelete = async () => {
        if (window.confirm("Är du säker på att du vill ta bort det här inlägget? Det går inte att ångra.")) {
            onDelete(event.id);
        }
    };
    
    const isNewEvent = lastViewTimestamp !== null && event.timestamp > lastViewTimestamp && event.userId !== currentUser.uid;

    // --- COMPACT STATS LOGIC ---
    const isCurrentUser = event.userId === currentUser.uid;
    
    // Check if the post was made by a coach persona
    const isCoachPersona = event.userName && 
        Object.values(COACH_PERSONAS).some(coach => coach.label === event.userName);
    const isBorje = event.userName === 'Börje' || event.userName === 'General Börje';

    const isGlobalPost = event.isGlobal || event.visibleTo?.includes('GLOBAL');

    const displayName = isBorje || isCoachPersona 
        ? event.userName 
        : (isGlobalPost ? 'Kostloggen' : (isCurrentUser ? 'Du' : event.userName));
        
    const displayPhotoURL = isBorje || isCoachPersona 
        ? event.userPhotoURL 
        : (isGlobalPost ? '/favicon.png' : event.userPhotoURL);

    return (
    <div id={`event-${event.id}`} className={`group relative p-4 rounded-2xl shadow-sm border transition-colors duration-500 ease-out mb-4 ${
        isNewEvent 
            ? 'bg-green-50/50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
            : isBorje
                ? 'bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : (isGlobalPost || isCoachPersona)
                ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : 'bg-white dark:bg-neutral-darker border-neutral-light'
    }`}>
        <div className="flex items-start gap-3">
            <Avatar photoURL={displayPhotoURL} gender={event.gender} size={42} />
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                        <p className="text-sm text-neutral-dark font-medium leading-tight flex items-center flex-wrap gap-1">
                            <span className="font-bold">{displayName}</span>
                            {isGlobalPost && !event.bootcampId && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    Officiellt
                                </span>
                            )}
                            {event.bootcampId && event.type === 'user_post' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                    🎖️ General Börjes Bootcamp
                                </span>
                            )}
                            {event.type === 'user_post' ? '' : ` ${event.title}`}
                        </p>
                        
                        {/* --- COMPACT STATS ROW --- */}
                        {!isGlobalPost && !isCoachPersona && (() => {
                            // Fallback to current user profile or buddy details if event doesn't have the highest streak
                            let effectiveHighestStreak = event.highestBootcampStreak;
                            if (effectiveHighestStreak === undefined) {
                                if (event.userId === currentUser.uid) {
                                    effectiveHighestStreak = userProfile.highestBootcampStreak;
                                } else {
                                    const buddy = buddyDetails.find(b => b.uid === event.userId);
                                    if (buddy) {
                                        effectiveHighestStreak = buddy.highestBootcampStreak;
                                    }
                                }
                            }

                            const hasBootcampStreak = event.bootcampStreakAtPost !== undefined && event.bootcampStreakAtPost > 0;
                            const hasHighestStreak = effectiveHighestStreak !== undefined && effectiveHighestStreak > 0;
                            
                            if (!(
                                (event.streakAtPost !== undefined && event.streakAtPost > 0) || 
                                hasBootcampStreak || 
                                hasHighestStreak ||
                                event.goalTextAtPost || 
                                (event.progressAtPost !== undefined && event.progressAtPost > 0)
                            )) {
                                return null;
                            }

                            const rankName = hasHighestStreak ? getBootcampRankInfo(effectiveHighestStreak!, 0, 'fas1').currentRank : '';

                            return (
                                <div className="mt-1 mb-2 w-full">
                                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-medium mb-1 flex-wrap">
                                        {event.streakAtPost !== undefined && event.streakAtPost > 0 && (
                                            <span className="flex items-center gap-0.5 text-orange-600"><span className="text-xs">🔥</span> {event.streakAtPost}</span>
                                        )}
                                        {hasBootcampStreak && (
                                            <>
                                                {event.streakAtPost !== undefined && event.streakAtPost > 0 && <span className="text-neutral-300">|</span>}
                                                <span className="flex items-center gap-0.5 text-yellow-600"><span className="text-xs">🎖️</span> {event.bootcampStreakAtPost}</span>
                                            </>
                                        )}
                                        {hasHighestStreak && rankName && (
                                            <>
                                                {((event.streakAtPost !== undefined && event.streakAtPost > 0) || hasBootcampStreak) && <span className="text-neutral-300">|</span>}
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-full">
                                                    {rankName}
                                                </span>
                                            </>
                                        )}
                                        {event.goalTextAtPost && (
                                            <>
                                                {((event.streakAtPost !== undefined && event.streakAtPost > 0) || hasBootcampStreak || hasHighestStreak) && <span className="text-neutral-300">|</span>}
                                                <span className="truncate">{event.goalTextAtPost}</span>
                                            </>
                                        )}
                                    </div>
                                    {event.progressAtPost !== undefined && event.progressAtPost > 0 && (
                                        <div className="h-1 w-full bg-neutral-light dark:bg-neutral-dark rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{width: `${event.progressAtPost}%`}} />
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                        {/* ------------------------- */}
                    </div>

                    <div className="flex items-start gap-2 ml-2">
                        <span className="text-xs text-neutral whitespace-nowrap mt-0.5">
                            {new Date(event.timestamp).toLocaleString('sv-SE', {
                                ...(new Date(event.timestamp).toDateString() === new Date().toDateString() 
                                    ? { hour: '2-digit', minute: '2-digit' } 
                                    : { month: 'short', day: 'numeric' })
                            })}
                        </span>
                        {isCurrentUser && onShare && (
                            <button 
                                onClick={() => onShare(event)}
                                className="text-neutral-400 hover:text-primary transition-colors p-0.5 ml-1"
                                title="Dela till chatt"
                            >
                                <ShareIcon className="w-4 h-4" />
                            </button>
                        )}
                        {isCurrentUser && (
                            <button 
                                onClick={handleDelete}
                                className="text-neutral-400 hover:text-red-500 transition-colors p-0.5 ml-1"
                                title="Ta bort inlägg"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
                
                {event.category && event.type === 'user_post' && (
                    <span className="inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-semibold bg-neutral-light dark:bg-neutral-dark text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
                        {event.icon} {event.category === 'workout' ? 'Träning' : event.category === 'food' ? 'Mat' : event.category === 'pepp' ? 'Pepp' : event.category === 'question' ? 'Fråga' : 'Allmänt'}
                    </span>
                )}

                {/* Content Area */}
                <div className="mt-1">
                    {event.type === 'weight' ? (
                        renderWeightDescription(event.description)
                    ) : (
                        <p className="text-base text-neutral-dark whitespace-pre-wrap leading-relaxed break-words">{event.description}</p>
                    )}
                    
                    {event.imageUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden shadow-sm border border-neutral-light/50 max-h-[400px] bg-white flex items-center justify-center">
                             <img 
                                src={event.imageUrl} 
                                alt="Inläggsbild" 
                                className="max-w-full max-h-[400px] object-contain cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() => onImageClick(event.imageUrl!, `Bild från ${event.userName}`)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Reactions and Action Bar */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 ml-[50px]">
            {/* Add Reaction Button */}
            <div className="relative" ref={reactionMenuRef}>
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        setShowReactionMenu(!showReactionMenu);
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 transition-colors border border-transparent hover:border-neutral-300 dark:hover:border-neutral-600"
                    title="Reagera"
                >
                    <SmileIcon className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 bg-white dark:bg-neutral-darker rounded-full p-[1px]">
                        <PlusIcon className="w-2.5 h-2.5 text-neutral-500" />
                    </span>
                </button>
                
                {/* Reaction Menu Dropdown */}
                {showReactionMenu && (
                    <div className="absolute bottom-full left-0 mb-2 flex gap-1 bg-white dark:bg-neutral-dark shadow-lg border border-neutral-light dark:border-neutral-dark rounded-full p-1.5 z-20 animate-fade-in">
                        {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                            <button 
                                key={emoji}
                                onClick={(e) => {
                                    e.preventDefault();
                                    onTogglePepp(event, emoji);
                                    setShowReactionMenu(false);
                                }} 
                                className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-darker text-lg transition-transform hover:scale-110 ${!!event.reactions?.[emoji]?.[currentUser.uid] ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`} 
                                title={emoji}
                            >
                                {emoji}
                            </button>
                        ))}
                        <div className="relative" ref={emojiPickerRef}>
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    setShowEmojiPicker(!showEmojiPicker);
                                }} 
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-darker text-neutral transition-transform hover:scale-110" 
                                title="Fler emojis"
                            >
                                <PlusIcon className="w-4 h-4" />
                            </button>
                            {showEmojiPicker && (
                                <div className="absolute bottom-full right-0 mb-2 z-50">
                                    <EmojiPicker 
                                        onEmojiClick={(emojiData) => {
                                            onTogglePepp(event, emojiData.emoji);
                                            setShowEmojiPicker(false);
                                            setShowReactionMenu(false);
                                        }}
                                        autoFocusSearch={false}
                                        theme={Theme.LIGHT}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Existing Reactions */}
            {Object.entries(event.reactions || {}).map(([emoji, users]) => {
                const count = Object.keys(users).length;
                if (count === 0) return null;
                const hasReacted = !!users[currentUser.uid];
                
                return (
                    <button 
                        key={emoji} 
                        onClick={(e) => {
                            e.preventDefault();
                            onTogglePepp(event, emoji);
                        }} 
                        onMouseDown={(e) => e.preventDefault()}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all active:scale-95 border
                            ${hasReacted 
                                ? 'bg-primary-50 border-primary text-primary-darker shadow-sm' 
                                : 'bg-white dark:bg-neutral-darker border-neutral-light dark:border-neutral-dark text-neutral-600 dark:text-neutral-300'
                            }`}
                    >
                        <span>{emoji}</span>
                        <span className="font-semibold">{count}</span>
                    </button>
                )
            })}
        </div>
        
        {/* Comments Section */}
        {((event.comments && event.comments.length > 0) || newComment || commentImage) && (
             <div className="space-y-3 mt-4 ml-[50px]">
                {(event.comments || []).map(comment => {
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
                    const isNewComment = lastViewTimestamp !== null && comment.timestamp > lastViewTimestamp && comment.authorUid !== currentUser.uid;

                    return (
                        <div key={comment.id} className="flex items-start gap-2 group">
                            <Avatar photoURL={comment.authorPhotoURL} size={28} />
                            <div className="flex-1">
                                <div 
                                    onDoubleClick={() => onToggleCommentReaction(event, comment.id, '❤️')} 
                                    className={`rounded-2xl rounded-tl-none px-3 py-2 text-sm relative transition-colors duration-500 ease-out ${isNewComment ? 'bg-green-50 dark:bg-green-900/20' : 'bg-neutral-light/60 dark:bg-neutral-dark'}`}
                                >
                                    <p className="font-bold text-neutral-dark text-xs mb-0.5">{comment.authorUid === currentUser.uid ? 'Du' : comment.authorName}</p>
                                    {comment.text && <p className="text-neutral-dark break-words leading-snug">{comment.text}</p>}
                                    {comment.imageUrl && (
                                        <div className="mt-2 rounded-lg overflow-hidden max-w-xs">
                                            <img src={comment.imageUrl} alt="Kommentar bild" className="w-full h-auto object-cover cursor-pointer" onClick={() => onImageClick(comment.imageUrl!, 'Kommentar bild')} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 ml-1 relative">
                                    <span className="text-[10px] text-neutral-400">
                                        {new Date(comment.timestamp).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                    
                                    <div className="relative" ref={activeCommentReactionId === comment.id ? commentReactionMenuRef : null}>
                                        <button 
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setActiveCommentReactionId(activeCommentReactionId === comment.id ? null : comment.id);
                                                setActiveCommentEmojiPickerId(null);
                                            }}
                                            className={`relative flex items-center justify-center w-6 h-6 rounded-full transition-colors border border-transparent ${userReactionEmoji ? 'bg-primary-50 text-primary border-primary-200 dark:bg-primary-900/20 dark:border-primary-800' : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-600'}`}
                                            title="Reagera"
                                        >
                                            <SmileIcon className="w-3.5 h-3.5" />
                                            <span className="absolute -top-0.5 -right-0.5 bg-white dark:bg-neutral-darker rounded-full p-[1px]">
                                                <PlusIcon className="w-2 h-2 text-neutral-500" />
                                            </span>
                                        </button>
                                        
                                        {activeCommentReactionId === comment.id && (
                                            <div className="absolute bottom-full left-0 mb-2 flex gap-1 bg-white dark:bg-neutral-dark shadow-lg border border-neutral-light dark:border-neutral-dark rounded-full p-1.5 z-20 animate-fade-in">
                                                {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                                                    <button 
                                                        key={emoji}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            onToggleCommentReaction(event, comment.id, emoji);
                                                            setActiveCommentReactionId(null);
                                                        }} 
                                                        className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-darker text-lg transition-transform hover:scale-110 ${!!comment.reactions?.[emoji]?.[currentUser.uid] ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`} 
                                                        title={emoji}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                                <div className="relative">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setActiveCommentEmojiPickerId(activeCommentEmojiPickerId === comment.id ? null : comment.id);
                                                        }} 
                                                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-darker text-neutral transition-transform hover:scale-110" 
                                                        title="Fler emojis"
                                                    >
                                                        <PlusIcon className="w-4 h-4" />
                                                    </button>
                                                    {activeCommentEmojiPickerId === comment.id && (
                                                        <div className="absolute bottom-full right-0 mb-2 z-50">
                                                            <EmojiPicker 
                                                                onEmojiClick={(emojiData) => {
                                                                    onToggleCommentReaction(event, comment.id, emojiData.emoji);
                                                                    setActiveCommentReactionId(null);
                                                                    setActiveCommentEmojiPickerId(null);
                                                                }}
                                                                autoFocusSearch={false}
                                                                theme={Theme.LIGHT}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {hasReactions && (
                                        <div className="flex items-center gap-1">
                                            {Object.entries(reactionCounts).map(([emoji, count]) => {
                                                const hasReacted = !!comment.reactions?.[emoji]?.[currentUser.uid];
                                                return (
                                                    <button 
                                                        key={emoji} 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            onToggleCommentReaction(event, comment.id, emoji);
                                                        }}
                                                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-all active:scale-95 border shadow-sm
                                                            ${hasReacted 
                                                                ? 'bg-primary-50 border-primary text-primary-darker' 
                                                                : 'bg-white dark:bg-neutral-darker border-neutral-light dark:border-neutral-dark text-neutral-600 dark:text-neutral-300'
                                                            }`}
                                                    >
                                                        <span>{emoji}</span>
                                                        <span className="font-semibold">{count}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        <form onSubmit={handleCommentSubmit} className="flex items-start gap-3 mt-4 ml-[50px]">
                <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={32} />
                <div className="flex-1">
                    <div className="relative flex items-center">
                        <input
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            className="w-full pl-4 pr-20 py-2 text-sm bg-[#ffffff] text-[#000000] rounded-full border border-[#E5E7EB] focus:border-[#3bab5a]/50 focus:outline-none focus:ring-2 focus:ring-[#3bab5a]/20 transition-all placeholder-[#9CA3AF]"
                            placeholder="Skriv en kommentar..."
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setShowCameraModal(true)}
                                className="p-1.5 rounded-full text-neutral-400 hover:text-primary hover:bg-primary-50 transition-colors"
                                title="Ta bild"
                            >
                                <CameraIcon className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1.5 rounded-full text-neutral-400 hover:text-primary hover:bg-primary-50 transition-colors"
                                title="Ladda upp bild"
                            >
                                <ImageIcon className="w-4 h-4" />
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting || (!newComment.trim() && !commentImage)} 
                                className={`p-1.5 rounded-full transition-all ${newComment.trim() || commentImage ? 'text-primary hover:bg-primary-50' : 'text-neutral-300'}`}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </div>
                    {commentImage && (
                        <div className="mt-2 relative inline-block">
                            <img src={commentImage} alt="Preview" className="h-20 w-auto rounded-lg object-cover border border-neutral-light" />
                            <button 
                                type="button" 
                                onClick={() => setCommentImage(null)}
                                className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 shadow-md text-neutral-400 hover:text-red-500"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
        </form>

        <CameraModal 
            show={showCameraModal} 
            onClose={() => setShowCameraModal(false)} 
            onImageCapture={(imageDataUrl) => { 
                setCommentImage('data:image/jpeg;base64,' + imageDataUrl); 
                setShowCameraModal(false); 
            }} 
            onCameraError={(err) => console.error(err)} 
            instructionText="Ta en bild att dela i kommentar"
            hideTip={true}
        />
    </div>
    );
};

// --- Friend Management Component ---
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

    const inviteText = `Haka på mig och gå ner i vikt med Kostloggen så kan vi peppa varandra! 🌟\n\nAnvänd koden GRATIS30 när du skapar ditt konto så får du 30 dagar helt gratis!\n\nLadda ner appen och lägg till mig som kompis här: https://app.kostloggen.se`;

    const handleShareViaApp = async () => {
        setShowInviteOptionsModal(false);
        playAudio('uiClick');
        
        if (navigator.share) {
            try {
                await navigator.share({
                    text: inviteText,
                });
            } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    console.error('Error sharing:', error);
                    setToastNotification({ message: 'Kunde inte dela inbjudan.', type: 'error' });
                }
            }
        } else {
            // Fallback for desktop
            navigator.clipboard.writeText(inviteText).then(() => {
                setToastNotification({ message: 'Inbjudningstext kopierad!', type: 'success' });
            }, () => {
                setToastNotification({ message: 'Kunde inte kopiera texten.', type: 'error' });
            });
        }
    };
    
    const handleCopyToClipboard = () => {
        playAudio('uiClick');
        navigator.clipboard.writeText(inviteText).then(() => {
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
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-neutral-light rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-neutral-darker"
                                placeholder="Sök bland dina kompisar..."
                            />
                        </div>
                        {filteredBuddyDetails.length === 0 ? (
                            <p className="text-sm text-neutral text-center py-8">
                                {buddySearchQuery ? 'Inga kompisar matchade din sökning.' : 'Du har inga kompisar än.'}
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {filteredBuddyDetails.map(buddy => (
                                    <BuddyCard
                                        key={buddy.uid}
                                        buddy={buddy}
                                        achievements={achievements}
                                        onRemove={() => handleRemoveBuddyRequest(buddy)}
                                        currentUser={currentUser}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'search':
                return (
                    <div className="animate-fade-in space-y-4">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                             <input 
                                type="search" 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-neutral-light rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-neutral-darker"
                                placeholder="Sök bland användare..."
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            {searchResults.map(user => {
                                const isBuddy = buddyDetails.some(b => b.uid === user.uid);
                                const hasPendingRequest = outgoingRequests.some(r => r.toUid === user.uid);
                                return (
                                    <div key={user.uid} className="flex items-center justify-between bg-white dark:bg-neutral-darker p-2 rounded-md border border-neutral-light">
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
                    <div className="space-y-4 bg-white dark:bg-neutral-darker p-4 rounded-lg border border-neutral-light">
                        <h4 className="font-semibold">Inkommande ({requests.length})</h4>
                        {requests.length > 0 ? requests.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-neutral-light dark:bg-neutral-dark p-2 rounded-lg">
                                <p className="font-semibold text-sm">{req.fromName}</p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleRequestAction(req, 'declined')} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><XMarkIcon className="w-5 h-5" /></button>
                                    <button onClick={() => handleRequestAction(req, 'accepted')} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><CheckIcon className="w-5 h-5" /></button>
                                </div>
                            </div>
                        )) : <p className="text-sm text-neutral">Inga nya förfrågningar.</p>}
                         <h4 className="font-semibold pt-2 border-t">Utgående ({outgoingRequests.length})</h4>
                        {outgoingRequests.length > 0 ? outgoingRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-neutral-light dark:bg-neutral-dark p-2 rounded-lg">
                                <p className="font-semibold text-sm">{allSearchableUsers.find(u => u.uid === req.toUid)?.name || 'Okänd'}</p>
                                <button onClick={() => handleCancelRequest(req.id)} className="text-xs font-semibold text-red-600 px-2 py-1 bg-red-100 rounded-full hover:bg-red-200">Avbryt</button>
                            </div>
                        )) : <p className="text-sm text-neutral">Inga utgående förfrågningar.</p>}
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex-shrink-0 px-4 pt-4">
                <nav className="flex -mb-px border-b border-neutral-light">
                    <button onClick={() => setActiveTab('buddies')} className={`py-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'buddies' ? 'border-primary text-primary' : 'border-transparent text-neutral hover:text-primary'}`}>Mina kompisar</button>
                    <button onClick={() => setActiveTab('search')} className={`py-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'search' ? 'border-primary text-primary' : 'border-transparent text-neutral hover:text-primary'}`}>Hitta kompisar</button>
                    <button onClick={() => setActiveTab('requests')} className={`relative py-2 px-4 font-medium text-sm border-b-2 ${activeTab === 'requests' ? 'border-primary text-primary' : 'border-transparent text-neutral hover:text-primary'}`}>
                        Förfrågningar
                        {requests.length > 0 && <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{requests.length}</span>}
                    </button>
                </nav>
            </div>
            
            {(activeTab === 'buddies' || activeTab === 'search') && (
                <div className="flex-shrink-0 w-full bg-gradient-to-r from-primary to-primary-darker text-white flex items-center justify-between px-4 py-2.5 shadow-sm mt-0">
                    <div className="flex flex-col text-sm">
                        <span className="font-medium">Ge bort 30 dagar gratis! 🎁</span>
                        <span className="text-primary-50 text-xs mt-0.5">
                            app.kostloggen.se | Kod: <span className="font-bold bg-white/20 px-1 py-0.5 rounded ml-0.5">GRATIS30</span>
                        </span>
                    </div>
                    <button 
                        onClick={() => setShowInviteOptionsModal(true)}
                        className="whitespace-nowrap px-3 py-1.5 bg-white text-primary text-xs font-bold rounded shadow-sm hover:bg-gray-50 transition-colors"
                    >
                        Bjud in
                    </button>
                </div>
            )}

            <div className="flex-grow overflow-y-auto custom-scrollbar p-4">
                {renderTabContent()}
            </div>
            {buddyToRemove && (
                <div
                    className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in"
                    onClick={() => setBuddyToRemove(null)}
                    role="dialog" aria-modal="true" aria-labelledby="confirm-remove-buddy-title"
                >
                    <div className="bg-white dark:bg-neutral-darker p-6 rounded-lg shadow-soft-xl w-full max-w-sm animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 id="confirm-remove-buddy-title" className="text-lg font-semibold text-neutral-dark mb-4">Bekräfta borttagning</h3>
                        <p className="text-neutral mb-6">Är du säker på att du vill ta bort <strong>{buddyToRemove.name}</strong> som Peppkompis?</p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setBuddyToRemove(null)} className="px-4 py-2 text-neutral-dark dark:text-white bg-neutral-light dark:bg-neutral-dark hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md active:scale-95 interactive-transition">Avbryt</button>
                            <button onClick={confirmRemoveBuddy} className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md active:scale-95 interactive-transition">Ja, ta bort</button>
                        </div>
                    </div>
                </div>
            )}
            {showInviteOptionsModal && (
                <div
                    className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in"
                    onClick={() => setShowInviteOptionsModal(false)}
                >
                    <div className="bg-white dark:bg-neutral-darker p-6 rounded-lg shadow-soft-xl w-full max-w-sm animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-neutral-dark mb-4">Bjud in en vän</h3>
                        <div className="space-y-3">
                            <button onClick={handleShareViaApp} className="w-full flex items-center justify-center px-4 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm">
                                <ShareIcon className="w-5 h-5 mr-2" /> Dela via app
                            </button>
                             <p className="text-xs text-neutral text-center">Obs: Vissa appar som Messenger kan ignorera texten.</p>
                            <button
                                onClick={handleCopyToClipboard}
                                disabled={isCopied}
                                className="w-full flex items-center justify-center px-4 py-2.5 text-base font-medium text-neutral-dark dark:text-white bg-neutral-light dark:bg-neutral-dark hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md shadow-sm disabled:bg-green-100 disabled:text-green-700"
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

const ShareModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    event: TimelineEvent | null;
    currentUser: User;
    userProfile: UserProfileData;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}> = ({ isOpen, onClose, event, currentUser, userProfile, setToastNotification }) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [isSharing, setIsSharing] = useState(false);
    const [customMessage, setCustomMessage] = useState('');

    useEffect(() => {
        if (isOpen && currentUser) {
            const unsubscribe = subscribeToUserChats(currentUser.uid, (fetchedChats) => {
                setChats(fetchedChats);
            });
            setCustomMessage(''); // Reset message when opened
            return () => unsubscribe();
        }
    }, [isOpen, currentUser]);

    if (!isOpen || !event) return null;

    const handleShare = async (chat: Chat) => {
        if (isSharing) return;
        setIsSharing(true);
        try {
            const messageText = customMessage.trim();
            
            const sharedEventPreview = {
                id: event.id,
                title: event.title,
                description: event.description,
                icon: event.icon,
                ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
                type: event.type
            };

            await sendMessage(chat.id, currentUser.uid, userProfile.name || 'En kompis', messageText, userProfile.photoURL, undefined, undefined, sharedEventPreview);
            setToastNotification({ message: 'Händelsen har delats!', type: 'success' });
            onClose();
        } catch (error) {
            console.error("Error sharing event:", error);
            setToastNotification({ message: 'Kunde inte dela händelsen.', type: 'error' });
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-neutral-light flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-neutral-dark">Dela till chatt</h2>
                    <button onClick={onClose} className="p-2 hover:bg-neutral-light rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6 text-neutral" />
                    </button>
                </div>
                <div className="p-4 border-b border-neutral-light bg-neutral-light/50">
                    <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Skriv ett meddelande (frivilligt)..."
                        className="w-full p-3 rounded-xl border border-neutral-light focus:border-primary focus:ring-1 focus:ring-primary resize-none text-sm"
                        rows={2}
                    />
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    {chats.length === 0 ? (
                        <p className="text-center text-neutral py-8">Du är inte med i några chattar än.</p>
                    ) : (
                        <div className="space-y-2">
                            {chats.map(chat => (
                                <button
                                    key={chat.id}
                                    onClick={() => handleShare(chat)}
                                    disabled={isSharing}
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-neutral-light hover:border-primary hover:bg-primary-50/30 transition-colors text-left disabled:opacity-50"
                                >
                                    <span className="font-semibold text-neutral-dark truncate pr-4">{chat.name || 'Gruppchatt'}</span>
                                    <ShareIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const CommunityView: React.FC<{ 
  currentUser: User;
  userProfile: UserProfileData;
  achievements: Achievement[];
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  pendingRequestsCount: number;
  unreadChatsCount: number;
  initialTab?: 'flode' | 'hantera' | 'chatt';
  initialSubTab?: 'buddies' | 'search' | 'requests';
  highlightEventId?: string | null;
  initialChatId?: string | null;
  initialPostText?: string | null;
  timelineEvents: TimelineEvent[];
  setTimelineEvents: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
  buddyDetails: BuddyDetails[];
  isLoading: boolean;
  activeBootcamp?: any;
  onDataChanged: () => void;
  lastViewTimestamp: number | null;
  currentStreak: number;
  userRole: UserRole;
}> = ({ 
  currentUser,
  userProfile,
  achievements,
  setToastNotification,
  pendingRequestsCount,
  unreadChatsCount,
  initialTab = 'flode',
  initialSubTab = 'buddies',
  highlightEventId = null,
  initialChatId = null,
  initialPostText = null,
  timelineEvents,
  setTimelineEvents,
  buddyDetails,
  isLoading,
  activeBootcamp,
  onDataChanged,
  lastViewTimestamp,
  currentStreak,
  userRole
}) => {
  const [activeTab, setActiveTab] = useState<'flode' | 'hantera' | 'chatt'>(initialTab);
  const [effectiveLastViewTimestamp, setEffectiveLastViewTimestamp] = useState(lastViewTimestamp);
  
  const previousTabRef = useRef(activeTab);
  useEffect(() => {
    if (previousTabRef.current === 'flode' && activeTab !== 'flode') {
      setEffectiveLastViewTimestamp(Date.now());
    }
    previousTabRef.current = activeTab;
  }, [activeTab]);
  
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [lightboxImage, setLightboxImage] = useState<{ src: string, alt: string } | null>(null);
  const [shareEvent, setShareEvent] = useState<TimelineEvent | null>(null);
  
  // Real-time & Pagination State
  // Initialize with timelineEvents to show cached data immediately if available
  const [realtimeEvents, setRealtimeEvents] = useState<TimelineEvent[]>(Array.isArray(timelineEvents) ? timelineEvents : []);
  const [historicalEvents, setHistoricalEvents] = useState<TimelineEvent[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Sync prop to state when it changes (e.g. initial load finishes in App.tsx or new realtime events arrive)
  useEffect(() => {
      if (Array.isArray(timelineEvents)) {
          setRealtimeEvents(timelineEvents);
      }
  }, [timelineEvents]);

  // Combine and deduplicate
  const visibleEvents = useMemo(() => {
      const rt = Array.isArray(realtimeEvents) ? realtimeEvents : [];
      const hist = Array.isArray(historicalEvents) ? historicalEvents : [];
      
      const all = [...rt, ...hist];
      const seen = new Set();
      return all.filter(e => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
      }).sort((a,b) => b.timestamp - a.timestamp);
  }, [realtimeEvents, historicalEvents]);

  // Scroll to highlighted event
  useEffect(() => {
      if (highlightEventId && activeTab === 'flode') {
          // Give the DOM a moment to render the events
          setTimeout(() => {
              const element = document.getElementById(`event-${highlightEventId}`);
              if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Add a temporary highlight class
                  element.classList.add('ring-4', 'ring-primary', 'ring-opacity-50', 'transition-all', 'duration-1000');
                  setTimeout(() => {
                      element.classList.remove('ring-4', 'ring-primary', 'ring-opacity-50');
                  }, 2000);
              }
          }, 300);
      }
  }, [highlightEventId, activeTab, visibleEvents.length]);

  // Initial Real-time Listener is now handled by App.tsx
  // We just rely on the timelineEvents prop updating.
  useEffect(() => {
      if (Array.isArray(timelineEvents) && timelineEvents.length > 0 && historicalEvents.length === 0) {
          // We don't have lastDoc here directly from App.tsx listener, 
          // but we can assume hasMore is true initially if we got 20 events.
          // For pagination to work perfectly, App.tsx would need to pass lastDoc.
          // For now, we'll just let the user scroll and if they hit the bottom, 
          // loadMoreEvents will fetch from the last event's timestamp.
          setHasMore(timelineEvents.length >= 20);
      }
  }, [timelineEvents, historicalEvents.length]);

  const loadMoreEvents = async () => {
      if (isLoadingMore || !hasMore) return;
      setIsLoadingMore(true);
      try {
          // Use the last event in visibleEvents as the starting point for pagination
          const lastEvent = visibleEvents[visibleEvents.length - 1];
          // We need a document snapshot for true pagination, but we can approximate with timestamp
          // Actually, _fetchCommunityTimelinePaginated takes a snapshot. 
          // Since we don't have it, we might need to fetch it or change the pagination logic.
          // For now, let's keep the existing lastDoc logic if it was set, otherwise we can't paginate easily without it.
          // To fix this properly, App.tsx should pass down lastDoc, or we just fetch the next batch using the last event's timestamp.
          
          // Let's fetch the document snapshot for the last event
          if (lastEvent) {
              const lastEventDoc = await getDoc(doc(db, 'communityTimeline', lastEvent.id));
              
              const { events, lastDoc: newLastDoc } = await _fetchCommunityTimelinePaginated(currentUser.uid, lastEventDoc, 10, activeBootcamp?.cohortId);
              setHistoricalEvents(prev => [...prev, ...events]);
              setHasMore(events.length === 10);
          }
      } catch (e) {
          setToastNotification({ message: 'Kunde inte ladda fler händelser.', type: 'error' });
      } finally {
          setIsLoadingMore(false);
      }
  };

    const handleTogglePepp = async (event: TimelineEvent, newEmoji: string) => {
        if (!event.id) return;
        playAudio('uiClick', 0.6);
        const fromUser = { uid: currentUser.uid, name: userProfile.name || 'En kompis' };
        
        const updateEventList = (list: TimelineEvent[]) => list.map(e => {
            if (e.id === event.id) {
                const newReactions: Reactions = JSON.parse(JSON.stringify(e.reactions || {}));
                const hasReactedWithThisEmoji = !!newReactions[newEmoji]?.[fromUser.uid];
                
                if (hasReactedWithThisEmoji) {
                    delete newReactions[newEmoji][fromUser.uid];
                    if (Object.keys(newReactions[newEmoji]).length === 0) {
                        delete newReactions[newEmoji];
                    }
                } else {
                    if (!newReactions[newEmoji]) newReactions[newEmoji] = {};
                    newReactions[newEmoji][fromUser.uid] = fromUser.name;
                }
                return { ...e, reactions: newReactions };
            }
            return e;
        });

        setRealtimeEvents(prev => updateEventList(prev));
        setHistoricalEvents(prev => updateEventList(prev));

        try { 
            await togglePeppOnTimelineEvent(fromUser, event, newEmoji); 
        } catch (error) {
            console.error("Error toggling pepp:", error);
            setToastNotification({ message: 'Kunde inte skicka reaktion.', type: 'error' });
        }
    };
    
    const handleToggleCommentReaction = async (event: TimelineEvent, commentId: string, emoji: string) => {
        playAudio('uiClick');
        const fromUser = { uid: currentUser.uid, name: userProfile.name || 'Användare' };
        
        // Optimistic update
        const updateEventList = (list: TimelineEvent[]) => list.map(e => {
            if (e.id === event.id) {
                return {
                    ...e,
                    comments: (e.comments || []).map(c => {
                        if (c.id === commentId) {
                            const newReactions = { ...(c.reactions || {}) };
                            const hasReactedWithThisEmoji = !!newReactions[emoji]?.[currentUser.uid];
                            
                            if (hasReactedWithThisEmoji) {
                                delete newReactions[emoji][currentUser.uid];
                                if (Object.keys(newReactions[emoji]).length === 0) {
                                    delete newReactions[emoji];
                                }
                            } else {
                                if (!newReactions[emoji]) newReactions[emoji] = {};
                                newReactions[emoji][currentUser.uid] = fromUser.name;
                            }

                            return { ...c, reactions: newReactions };
                        }
                        return c;
                    })
                };
            }
            return e;
        });

        setRealtimeEvents(prev => updateEventList(prev));
        setHistoricalEvents(prev => updateEventList(prev));
        
        try { await toggleReactionOnComment(fromUser, event.id, commentId, emoji); } catch (error) {
            setToastNotification({ message: 'Kunde inte reagera på kommentar.', type: 'error' });
        }
    };

    const handleToggleLike = async (event: TimelineEvent, commentId: string) => {
        playAudio('uiClick', 0.5);
        const fromUser = { uid: currentUser.uid, name: userProfile.name || 'En kompis' };
        
        const updateEventList = (list: TimelineEvent[]) => list.map(e => {
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
        });

        setRealtimeEvents(prev => updateEventList(prev));
        setHistoricalEvents(prev => updateEventList(prev));
        
        try { await toggleLikeOnComment(fromUser, event, commentId); } catch (error) {
            setToastNotification({ message: 'Kunde inte gilla kommentar.', type: 'error' });
        }
    };
    
    const handleAddComment = async (event: TimelineEvent, text: string, imageBase64?: string) => {
        if (!text.trim() && !imageBase64) return;
        playAudio('uiClick');
        const clientTimestamp = Date.now();
        const optimisticComment: TimelineComment = { 
            id: `local-${clientTimestamp}`, 
            authorUid: currentUser.uid, 
            authorName: userProfile.name || 'Användare', 
            authorPhotoURL: userProfile.photoURL, 
            text: text.trim(), 
            timestamp: clientTimestamp, 
            imageUrl: imageBase64,
            likes: {},
            reactions: {}
        };
        
        const updateEventList = (list: TimelineEvent[]) => list.map(e => 
            e.id === event.id ? { ...e, comments: [...(e.comments || []), optimisticComment] } : e
        );

        setRealtimeEvents(prev => updateEventList(prev));
        setHistoricalEvents(prev => updateEventList(prev));

        try {
            const commentDataForFirestore = { 
                authorUid: optimisticComment.authorUid, 
                authorName: optimisticComment.authorName, 
                authorPhotoURL: optimisticComment.authorPhotoURL, 
                text: optimisticComment.text, 
                timestamp: optimisticComment.timestamp,
                imageUrl: optimisticComment.imageUrl,
                likes: optimisticComment.likes,
                reactions: optimisticComment.reactions
            };
            await addCommentToTimelineEvent(event.id, commentDataForFirestore);
        } catch (error) {
            setToastNotification({ message: 'Kunde inte lägga till kommentar.', type: 'error' });
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        setRealtimeEvents(prev => prev.filter(e => e.id !== eventId));
        setHistoricalEvents(prev => prev.filter(e => e.id !== eventId));
        
        try {
            await deleteTimelineEvent(eventId);
            setToastNotification({ message: "Inlägget raderat.", type: 'success' });
            playAudio('uiClick');
        } catch (error) {
            console.error(error);
            setToastNotification({ message: "Kunde inte radera inlägget.", type: 'error' });
        }
    };
    
    const newEventsCount = useMemo(() => {
        if (!effectiveLastViewTimestamp || activeTab === 'flode') return 0;
        let count = 0;
        visibleEvents.forEach(event => {
            if (event.userId !== currentUser.uid && event.timestamp > effectiveLastViewTimestamp) count++;
        });
        return count;
    }, [visibleEvents, effectiveLastViewTimestamp, currentUser.uid, activeTab]);


    const tabs = [
        { key: 'flode', label: 'Flöde', notificationCount: newEventsCount },
        { key: 'hantera', label: 'Kompisar', notificationCount: pendingRequestsCount },
        { key: 'chatt', label: 'Chatt', notificationCount: unreadChatsCount },
    ];
    
    const TabButton: FC<{ tab: typeof tabs[0], isActive: boolean, onClick: () => void }> = ({ tab, isActive, onClick }) => (
        <button onClick={onClick} className={`relative flex-1 py-4 px-1 text-center font-semibold border-b-4 transition-colors ${isActive ? 'border-primary text-primary' : 'border-transparent text-neutral hover:text-primary-lighter'}`}>
            <span className="text-sm">{tab.label}</span>
            {tab.notificationCount > 0 && <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center ring-2 ring-white">{tab.notificationCount > 9 ? '9+' : tab.notificationCount}</span>}
        </button>
    );

    return (
        <div className="flex flex-col flex-grow w-full h-full bg-transparent">
            <header className="flex-shrink-0 bg-white dark:bg-neutral-darker shadow-md z-10 sticky top-0">
                <nav className="flex items-center justify-around">
                    {tabs.map(tab => <TabButton key={tab.key} tab={tab} isActive={activeTab === tab.key} onClick={() => setActiveTab(tab.key as any)} />)}
                </nav>
            </header>
            
            <main className={`flex-grow bg-transparent ${activeTab === 'chatt' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
                {activeTab === 'flode' && (
                    <div className="p-2 sm:p-4 max-w-2xl mx-auto w-full">
                        <CreatePostWidget 
                            currentUser={currentUser} 
                            userProfile={userProfile} 
                            onPostCreated={(post) => setTimelineEvents(prev => [post, ...prev])}
                            setToastNotification={setToastNotification} 
                            userRole={userRole}
                            activeBootcamp={activeBootcamp}
                            initialText={initialPostText}
                        />
                        {visibleEvents.length > 0 ? (
                            <>
                                <div className="space-y-4">
                                    {visibleEvents.map(event => (
                                        <TimelineEventCard 
                                            key={`${event.id}-${event.timestamp}`}
                                            event={event}
                                            currentUser={currentUser}
                                            userProfile={userProfile}
                                            onTogglePepp={handleTogglePepp}
                                            onAddComment={handleAddComment}
                                            onToggleLike={handleToggleLike}
                                            onToggleCommentReaction={handleToggleCommentReaction}
                                            onDelete={handleDeleteEvent}
                                            onImageClick={(src, alt) => setLightboxImage({ src, alt })}
                                            onShare={(event) => setShareEvent(event)}
                                            lastViewTimestamp={effectiveLastViewTimestamp}
                                            buddyDetails={buddyDetails}
                                            currentStreak={currentStreak}
                                        />
                                    ))}
                                </div>

                                <div className="py-6 text-center">
                                    {hasMore ? (
                                        <button 
                                            onClick={loadMoreEvents} 
                                            disabled={isLoadingMore}
                                            className="px-6 py-2 bg-white dark:bg-neutral-darker border border-neutral-light text-neutral-dark font-semibold rounded-full shadow-sm hover:bg-gray-50 dark:hover:bg-neutral-dark active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
                                        >
                                            {isLoadingMore ? <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /> : <RefreshCw className="w-4 h-4" />}
                                            Ladda fler
                                        </button>
                                    ) : (
                                        <p className="text-sm text-neutral">Du har nått slutet på flödet.</p>
                                    )}
                                </div>
                            </>
                        ) : !isLoading && timelineEvents.length === 0 ? (
                             <div className="text-center py-16 px-4">
                                <h3 className="text-xl font-semibold text-neutral-dark">Ditt flöde är tomt!</h3>
                                <p className="text-neutral mt-2">Bli den första att skriva något eller lägg till fler kompisar!</p>
                            </div>
                        ) : (
                            <div className="flex justify-center items-center py-16">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'hantera' && (
                     <div className="max-w-4xl mx-auto w-full">
                        <FriendManagementView 
                            currentUser={currentUser} 
                            userProfile={userProfile}
                            setToastNotification={setToastNotification}
                            onDataChanged={onDataChanged}
                            buddyDetails={buddyDetails}
                            achievements={achievements}
                            initialTab={initialSubTab}
                        />
                    </div>
                )}
                {activeTab === 'chatt' && (
                    <div className="max-w-4xl mx-auto w-full flex-grow flex flex-col min-h-0">
                        <ChatRoomsView 
                            currentUser={currentUser}
                            userProfile={userProfile}
                            setToastNotification={setToastNotification}
                            buddyDetails={buddyDetails}
                            initialChatId={initialChatId}
                        />
                    </div>
                )}
            </main>
            
            <Lightbox 
                isOpen={!!lightboxImage} 
                src={lightboxImage?.src || ''} 
                alt={lightboxImage?.alt || ''} 
                onClose={() => setLightboxImage(null)} 
            />
            <ShareModal
                isOpen={!!shareEvent}
                onClose={() => setShareEvent(null)}
                event={shareEvent}
                currentUser={currentUser}
                userProfile={userProfile}
                setToastNotification={setToastNotification}
            />
        </div>
    );
};

export default CommunityView;
