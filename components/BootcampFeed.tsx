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
import { generateBorjePost } from '../services/geminiService';
import { auth } from '../firebase';
import { Heart, MessageCircle, Send, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Avatar } from './UserProfileModal';
import { resizeImage } from './CommunityView';
import ToastNotification from './ToastNotification';

interface BootcampFeedProps {
  cohortId: string;
  userProfile: UserProfileData;
}

const BootcampFeed: React.FC<BootcampFeedProps> = ({ cohortId, userProfile }) => {
  const [posts, setPosts] = useState<BootcampPost[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = (userProfile as any).role === 'admin' || userProfile.name === 'Karin' || userProfile.name === 'Börje';
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiBrief, setAiBrief] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleGenerateAIPost = async () => {
    if (!aiBrief.trim()) return;
    setIsGenerating(true);
    try {
      const generatedText = await generateBorjePost(aiBrief);
      setNewPostText(`/general ${generatedText}`);
      setShowAIGenerator(false);
      setAiBrief('');
    } catch (error: any) {
      setToast({ message: error.message || 'Kunde inte generera inlägg', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
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
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      
      {/* Create Post Area */}
      <div className="bg-white p-4 border-b border-neutral-light">
        {isAdmin && (
          <div className="mb-4">
            <button
              onClick={() => setShowAIGenerator(!showAIGenerator)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-darker transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {showAIGenerator ? 'Stäng AI-assistent' : 'Skapa inlägg som General Börje (AI)'}
            </button>
            
            {showAIGenerator && (
              <div className="mt-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl">
                    B
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-dark">Börja skapa ett inlägg</h4>
                    <p className="text-sm text-neutral-600">Beskriv vad du vill att General Börje ska skriva om.</p>
                  </div>
                </div>
                
                <div className="relative">
                  <textarea
                    value={aiBrief}
                    onChange={(e) => setAiBrief(e.target.value)}
                    placeholder="Skriv en brief till Börje... (t.ex. 'Skriv ett peppigt inlägg om att dricka vatten')"
                    className="w-full p-3 pr-12 bg-white rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary resize-none min-h-[80px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerateAIPost();
                      }
                    }}
                  />
                  <button
                    onClick={handleGenerateAIPost}
                    disabled={isGenerating || !aiBrief.trim()}
                    className="absolute bottom-3 right-3 p-2 bg-primary text-white rounded-full disabled:opacity-50 hover:bg-primary-darker transition-colors"
                  >
                    {isGenerating ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleCreatePost}>
          <div className="flex gap-3">
            <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={40} />
            <div className="flex-1">
              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder={isAdmin ? "Skriv i truppen... (Börja med /general för officiellt inlägg)" : "Dela något med truppen..."}
                className="w-full p-3 bg-neutral-50 rounded-xl border-none focus:ring-2 focus:ring-primary resize-none min-h-[80px]"
              />
              {newPostImage && (
                <div className="relative mt-2 inline-block">
                  <img src={newPostImage} alt="Preview" className="h-32 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setNewPostImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="flex justify-between items-center mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-neutral-500 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                >
                  <ImageIcon className="w-6 h-6" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || (!newPostText.trim() && !newPostImage)}
                  className="px-4 py-2 bg-primary text-white font-bold rounded-full hover:bg-primary-darker disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Skicka
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Feed Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
