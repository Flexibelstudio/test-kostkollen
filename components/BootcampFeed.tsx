import React, { useState, useEffect, useRef } from 'react';
import { BootcampPost, BootcampComment, UserProfileData } from '../types';
import { 
  subscribeToBootcampPosts, 
  createBootcampPost, 
  likeBootcampPost, 
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
        authorPhotoURL
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

  const handleAddComment = async (postId: string) => {
    if (!auth.currentUser || !commentText.trim()) return;
    try {
      await addBootcampComment(
        cohortId,
        postId,
        auth.currentUser.uid,
        userProfile.name || 'Okänd',
        commentText.trim(),
        userProfile.photoURL
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

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} min sedan`;
    if (diffHours < 24) return `${diffHours} h sedan`;
    if (diffDays === 1) return 'Igår';
    return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
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
              <div key={post.id} className={`bg-white p-4 rounded-2xl shadow-sm border ${post.isOfficial ? 'border-primary/50 bg-primary/5' : 'border-neutral-100'}`}>
                {/* Post Header */}
                <div className="flex items-center gap-3 mb-3">
                  {post.isOfficial ? (
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl">
                      B
                    </div>
                  ) : (
                    <Avatar photoURL={post.authorPhotoURL} size={40} />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-dark">{post.authorName}</span>
                      {post.isOfficial && (
                        <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Generalen
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-neutral-500">{formatTime(post.timestamp)}</span>
                  </div>
                </div>

                {/* Post Content */}
                <p className="text-neutral-dark whitespace-pre-wrap mb-3">{post.text}</p>
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="Post attachment" className="rounded-xl w-full max-h-96 object-cover mb-3" />
                )}

                {/* Post Actions */}
                <div className="flex items-center gap-4 pt-3 border-t border-neutral-100">
                  <button 
                    onClick={() => handleLikePost(post.id)}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isLiked ? 'text-red-500' : 'text-neutral-500 hover:text-red-500'}`}
                  >
                    {isLiked ? <Heart className="w-5 h-5 fill-current" /> : <Heart className="w-5 h-5" />}
                    <span>{likeCount > 0 ? likeCount : 'Peppa'}</span>
                  </button>
                  <button 
                    onClick={() => setCommentingOn(commentingOn === post.id ? null : post.id)}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-primary transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>{post.comments?.length || 0} Kommentarer</span>
                  </button>
                </div>

                {/* Comments Section */}
                {(post.comments?.length > 0 || commentingOn === post.id) && (
                  <div className="mt-4 space-y-3 bg-neutral-50 p-3 rounded-xl">
                    {post.comments?.map(comment => {
                      const isCommentLiked = auth.currentUser && comment.likes && comment.likes[auth.currentUser.uid];
                      const commentLikeCount = Object.keys(comment.likes || {}).length;
                      
                      return (
                        <div key={comment.id} className="flex gap-2">
                          <Avatar photoURL={comment.authorPhotoURL} size={32} />
                          <div className="flex-1">
                            <div className="bg-white p-2.5 rounded-2xl rounded-tl-none border border-neutral-200 shadow-sm">
                              <span className="font-bold text-sm text-neutral-dark block">{comment.authorName}</span>
                              <span className="text-sm text-neutral-700">{comment.text}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 ml-2 text-xs text-neutral-500">
                              <span>{formatTime(comment.timestamp)}</span>
                              <button 
                                onClick={() => handleLikeComment(post.id, comment.id)}
                                className={`font-medium ${isCommentLiked ? 'text-red-500' : 'hover:text-red-500'}`}
                              >
                                {isCommentLiked ? 'Peppad' : 'Peppa'} {commentLikeCount > 0 && `(${commentLikeCount})`}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {commentingOn === post.id && (
                      <div className="flex gap-2 mt-2">
                        <Avatar photoURL={userProfile.photoURL} gender={userProfile.gender} size={32} />
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Skriv en kommentar..."
                            className="flex-1 p-2 text-sm rounded-full border border-neutral-300 focus:ring-2 focus:ring-primary focus:border-transparent"
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
                            className="p-2 bg-primary text-white rounded-full disabled:opacity-50 hover:bg-primary-darker"
                          >
                            <Send className="w-4 h-4" />
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
