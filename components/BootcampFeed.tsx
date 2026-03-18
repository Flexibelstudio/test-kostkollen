import React, { useState, useEffect, useRef } from 'react';
import { BootcampPost, BootcampComment, UserProfileData } from '../types';
import { 
  subscribeToBootcampPosts, 
  createBootcampPost, 
  likeBootcampPost, 
  reactToBootcampPost,
  addBootcampComment, 
  likeBootcampComment 
} from '../services/bootcampService';
import { auth } from '../firebase';
import { Heart, MessageCircle, Send, Image as ImageIcon } from 'lucide-react';
import { CameraIcon, XMarkIcon } from './icons';
import { Avatar } from './UserProfileModal';
import { resizeImage } from './CommunityView';
import ToastNotification from './ToastNotification';

interface BootcampFeedProps {
  cohortId: string;
  userProfile: UserProfileData;
  hideCreatePost?: boolean;
  activeBootcamp?: any;
}

const BootcampFeed: React.FC<BootcampFeedProps> = ({ cohortId, userProfile, hideCreatePost, activeBootcamp }) => {
  const [posts, setPosts] = useState<BootcampPost[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = (userProfile as any).role === 'admin' || userProfile.name === 'Karin' || userProfile.name === 'Börje';

  useEffect(() => {
    if (!cohortId) return;
    const unsubscribe = subscribeToBootcampPosts(cohortId, (fetchedPosts) => {
      setPosts(fetchedPosts);
    });
    return () => unsubscribe();
  }, [cohortId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Bilden är för stor (max 5MB)', type: 'error' });
      return;
    }

    try {
      const resizedBase64 = await resizeImage(file, 800);
      setNewPostImage(resizedBase64);
    } catch (error) {
      console.error('Error resizing image:', error);
      setToast({ message: 'Kunde inte ladda upp bilden', type: 'error' });
    }
  };

  const handleCreatePost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!auth.currentUser || (!newPostText.trim() && !newPostImage)) return;

    setIsSubmitting(true);
    try {
      const isOfficial = isAdmin && newPostText.includes('/general');
      const text = isOfficial ? newPostText.replace('/general', '').trim() : newPostText.trim();
      const authorName = isOfficial ? 'General Börje' : (userProfile.name || 'Okänd');
      const authorPhotoURL = isOfficial ? undefined : userProfile.photoURL;

      await createBootcampPost(
        cohortId,
        auth.currentUser.uid,
        authorName,
        text,
        newPostImage || undefined,
        isOfficial,
        authorPhotoURL,
        isOfficial ? undefined : userProfile.gender
      );
      setNewPostText('');
      setNewPostImage(null);
      setIsExpanded(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    } catch (error) {
      console.error('Error creating post:', error);
      setToast({ message: 'Kunde inte skapa inlägg', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!auth.currentUser) return;
    try {
      await likeBootcampPost(cohortId, postId, auth.currentUser.uid, userProfile.name || 'Okänd');
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleReactToPost = async (postId: string, emoji: string) => {
    if (!auth.currentUser) return;
    try {
      await reactToBootcampPost(cohortId, postId, auth.currentUser.uid, userProfile.name || 'Okänd', emoji);
    } catch (error) {
      console.error('Error reacting to post:', error);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!auth.currentUser || !commentText.trim()) return;
    try {
      await addBootcampComment(
        cohortId,
        postId,
        auth.currentUser.uid,
        userProfile.name || 'Okänd',
        commentText.trim(),
        userProfile.photoURL,
        userProfile.gender
      );
      setCommentText('');
      setCommentingOn(null);
    } catch (error) {
      console.error('Error adding comment:', error);
      setToast({ message: 'Kunde inte lägga till kommentar', type: 'error' });
    }
  };

  const handleLikeComment = async (postId: string, commentId: string) => {
    if (!auth.currentUser) return;
    try {
      await likeBootcampComment(cohortId, postId, commentId, auth.currentUser.uid, userProfile.name || 'Okänd');
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50 rounded-3xl overflow-hidden border border-neutral-light">
      {toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Feed Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Create Post Area */}
        {!hideCreatePost && (
          <div className="mb-6">
            {!isExpanded ? (
              <div 
                onClick={() => setIsExpanded(true)}
              className="bg-white dark:bg-neutral-darker rounded-2xl shadow-sm border border-neutral-light p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-dark transition-colors active:scale-[0.99] select-none"
            >
              <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={40} className="flex-shrink-0" />
              <div className="flex-grow bg-[#ffffff] rounded-full px-4 py-2.5 text-[#6B7280] text-sm font-medium border border-[#E5E7EB]">
                {isAdmin ? "Skriv i truppen... (Börja med /general för officiellt inlägg)" : "Vad tänker du på? Dela med dig..."}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-darker rounded-2xl shadow-sm border border-neutral-light p-4 relative animate-fade-in">
              <button 
                  onClick={() => setIsExpanded(false)}
                  className="absolute top-2 right-2 p-2 text-neutral-400 hover:text-neutral-dark dark:hover:text-white rounded-full hover:bg-neutral-light dark:hover:bg-neutral-dark transition-colors z-10"
                  title="Stäng"
              >
                  <XMarkIcon className="w-5 h-5" />
              </button>

              <div className="flex gap-3">
                  <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={48} className="flex-shrink-0" />
                  <div className="flex-grow">
                      <p className="font-bold text-sm text-neutral-dark dark:text-white mb-2">{userProfile.name}</p>
                      <textarea
                          autoFocus
                          value={newPostText}
                          onChange={(e) => setNewPostText(e.target.value)}
                          placeholder={isAdmin ? "Skriv i truppen... (Börja med /general för officiellt inlägg)" : "Vad tänker du på? Dela med dig till dina kompisar..."}
                          className="w-full bg-[#ffffff] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3bab5a] min-h-[100px] resize-none pr-8 text-[#000000] border border-[#E5E7EB] placeholder-[#9CA3AF]"
                      />
                      {newPostImage && (
                          <div className="relative mt-2 inline-block bg-white rounded-lg p-1 border border-neutral-light">
                              <img src={newPostImage} alt="Preview" className="h-24 w-auto rounded-md object-contain" />
                              <button 
                                  onClick={() => setNewPostImage(null)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                              >
                                  <XMarkIcon className="w-3 h-3" />
                              </button>
                          </div>
                      )}
                  </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-center mt-3 gap-3 pt-3 border-t border-neutral-light/50">
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end ml-auto">
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                      <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload} />
                      
                      <button onClick={() => cameraInputRef.current?.click()} className="p-2 text-neutral hover:text-primary hover:bg-primary-50 rounded-full transition-colors" title="Ta bild">
                          <CameraIcon className="w-5 h-5" />
                      </button>

                      <button onClick={() => fileInputRef.current?.click()} className="p-2 text-neutral hover:text-primary hover:bg-primary-50 rounded-full transition-colors" title="Ladda upp bild">
                          <ImageIcon className="w-5 h-5" />
                      </button>
                      
                      <button 
                          onClick={handleCreatePost}
                          disabled={(!newPostText.trim() && !newPostImage) || isSubmitting}
                          className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-full shadow-md hover:bg-primary-darker active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-2"
                      >
                          {isSubmitting ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent" /> : <Send className="w-4 h-4" />}
                          Publicera
                      </button>
                  </div>
              </div>
            </div>
          )}
        </div>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-10 text-neutral-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Inga inlägg i truppen ännu. Bli den första att skriva!</p>
          </div>
        ) : (
          posts.map((post) => {
            const isLiked = auth.currentUser && post.likes && post.likes[auth.currentUser.uid];
            const likeCount = Object.keys(post.likes || {}).length;

            return (
              <div key={post.id} className={`p-4 rounded-2xl shadow-sm border transition-colors duration-500 ease-out mb-4 ${
                post.isOfficial
                  ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-neutral-darker border-neutral-light'
              }`}>
                {/* Post Header */}
                <div className="flex items-start gap-3">
                  <Avatar photoURL={post.isOfficial ? '/favicon.png' : post.authorPhotoURL} gender={post.authorGender} size={42} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <p className="text-sm text-neutral-dark font-medium leading-tight flex items-center flex-wrap gap-1">
                          <span className="font-bold">{post.isOfficial ? 'General Börje' : post.authorName}</span>
                          {post.isOfficial && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Officiellt
                            </span>
                          )}
                        </p>
                        
                        {/* --- COMPACT STATS ROW --- */}
                        {!post.isOfficial && (
                            (post.streakAtPost !== undefined && post.streakAtPost > 0) || 
                            (post.bootcampStreakAtPost !== undefined && post.bootcampStreakAtPost > 0) || 
                            post.goalTextAtPost || 
                            (post.progressAtPost !== undefined && post.progressAtPost > 0)
                        ) && (
                            <div className="mt-1 mb-2 w-full max-w-[200px]">
                                <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-medium mb-0.5">
                                    {post.streakAtPost !== undefined && post.streakAtPost > 0 && (
                                        <span className="flex items-center gap-0.5 text-orange-600"><span className="text-xs">🔥</span> {post.streakAtPost}</span>
                                    )}
                                    {post.bootcampStreakAtPost !== undefined && post.bootcampStreakAtPost > 0 && (
                                        <>
                                            {post.streakAtPost !== undefined && post.streakAtPost > 0 && <span className="text-neutral-300">|</span>}
                                            <span className="flex items-center gap-0.5 text-yellow-600"><span className="text-xs">🎖️</span> {post.bootcampStreakAtPost}</span>
                                        </>
                                    )}
                                    {post.goalTextAtPost && (
                                        <>
                                            {((post.streakAtPost !== undefined && post.streakAtPost > 0) || (post.bootcampStreakAtPost !== undefined && post.bootcampStreakAtPost > 0)) && <span className="text-neutral-300">|</span>}
                                            <span className="truncate">{post.goalTextAtPost}</span>
                                        </>
                                    )}
                                </div>
                                {post.progressAtPost !== undefined && post.progressAtPost > 0 && (
                                    <div className="h-1 w-full bg-neutral-light dark:bg-neutral-dark rounded-full overflow-hidden">
                                        <div className="h-full bg-primary" style={{width: `${post.progressAtPost}%`}} />
                                    </div>
                                )}
                            </div>
                        )}
                        {/* ------------------------- */}
                      </div>
                      <div className="flex items-start gap-2 ml-2">
                        <span className="text-xs text-neutral whitespace-nowrap mt-0.5">
                          {new Date(post.timestamp).toLocaleString('sv-SE', {
                            ...(new Date(post.timestamp).toDateString() === new Date().toDateString() 
                              ? { hour: '2-digit', minute: '2-digit' } 
                              : { month: 'short', day: 'numeric' })
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Post Content */}
                    <div className="mt-1">
                      <p className="text-base text-neutral-dark whitespace-pre-wrap leading-relaxed break-words">{post.text}</p>
                      
                      {post.imageUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden shadow-sm border border-neutral-light/50 max-h-[400px] bg-white flex items-center justify-center">
                          <img 
                            src={post.imageUrl} 
                            alt="Inläggsbild" 
                            className="max-w-full max-h-[400px] object-contain cursor-pointer hover:opacity-95 transition-opacity" 
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Post Actions */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-neutral-light/50 ml-[50px]">
                  {['👍', '💪', '🔥', '🎉', '❤️'].map(emoji => {
                    const usersWhoReacted = (post.reactions || {})[emoji] || {};
                    const count = Object.keys(usersWhoReacted).length;
                    const hasReacted = auth.currentUser && !!usersWhoReacted[auth.currentUser.uid];

                    return (
                      <button 
                        key={emoji} 
                        onClick={() => handleReactToPost(post.id, emoji)} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all active:scale-95 border
                          ${hasReacted 
                            ? 'bg-primary-50 border-primary text-primary-darker shadow-sm' 
                            : 'bg-transparent border-transparent hover:bg-neutral-light text-neutral-500 hover:text-neutral-dark'
                          }`}
                      >
                        <span className={`text-lg transition-transform ${hasReacted ? 'scale-110' : ''}`}>{emoji}</span>
                        {count > 0 && <span className="font-semibold text-xs">{count}</span>}
                      </button>
                    )
                  })}
                  
                  <button 
                    onClick={() => setCommentingOn(commentingOn === post.id ? null : post.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-500 hover:text-primary transition-colors ml-auto"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>{post.comments?.length || 0} Kommentarer</span>
                  </button>
                </div>

                {/* Comments Section */}
                {(post.comments?.length > 0 || commentingOn === post.id) && (
                  <div className="space-y-3 mt-4 ml-[50px]">
                    {post.comments?.map(comment => {
                      const isCommentLiked = auth.currentUser && comment.likes && comment.likes[auth.currentUser.uid];
                      const commentLikeCount = Object.keys(comment.likes || {}).length;
                      
                      return (
                        <div key={comment.id} className="flex items-start gap-2 group">
                          <Avatar photoURL={comment.authorPhotoURL} gender={comment.authorGender} size={28} />
                          <div className="flex-1">
                            <div 
                              onDoubleClick={() => handleLikeComment(post.id, comment.id)}
                              className="bg-neutral-light/60 rounded-2xl rounded-tl-none px-3 py-2 text-sm relative transition-colors duration-500 ease-out"
                            >
                              <p className="font-bold text-neutral-dark text-xs mb-0.5">{comment.authorUid === auth.currentUser?.uid ? 'Du' : comment.authorName}</p>
                              <p className="text-neutral-dark break-words leading-snug">{comment.text}</p>
                            </div>
                            <div className="flex items-center gap-3 mt-1 ml-1">
                              <span className="text-[10px] text-neutral-400">
                                {new Date(comment.timestamp).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})}
                              </span>
                              <button 
                                onClick={() => handleLikeComment(post.id, comment.id)}
                                className={`text-xs font-semibold flex items-center gap-1 transition-colors ${isCommentLiked ? 'text-red-500' : 'text-neutral-400 hover:text-red-500'}`}
                              >
                                {isCommentLiked ? 'Gillat' : 'Gilla'}
                                {commentLikeCount > 0 && <span className="bg-white px-1.5 rounded-full shadow-sm border border-neutral-light text-[10px]">{commentLikeCount} ❤️</span>}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {commentingOn === post.id && (
                      <div className="flex items-center gap-3 mt-4">
                        <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={32} />
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Skriv en kommentar..."
                            className="w-full bg-neutral-light/30 border border-neutral-light focus:border-primary focus:ring-1 focus:ring-primary rounded-full py-2.5 pl-4 pr-12 text-sm transition-all"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment(post.id);
                              }
                            }}
                          />
                          <button 
                            onClick={() => handleAddComment(post.id)}
                            disabled={!commentText.trim()}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-full disabled:opacity-50 hover:bg-primary-darker transition-transform active:scale-95"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BootcampFeed;
