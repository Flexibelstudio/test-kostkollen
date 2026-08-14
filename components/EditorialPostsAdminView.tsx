import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { ScheduledPost, PostCategory, UserRole } from '../types';
import { COACH_PERSONAS } from '../constants';
import { Plus, Trash2, Send, Clock, Calendar, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { createUserPost } from '../services/firestoreService';

interface EditorialPostsAdminViewProps {
  currentUser: User;
  userRole: UserRole;
  setToastNotification: (notif: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
}

export const EditorialPostsAdminView: React.FC<EditorialPostsAdminViewProps> = ({
  currentUser,
  userRole,
  setToastNotification
}) => {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [senderType, setSenderType] = useState<'kostloggen' | 'coach' | 'custom'>('kostloggen');
  const [senderName, setSenderName] = useState('Kostloggen');
  const [customSenderName, setCustomSenderName] = useState('');
  const [category, setCategory] = useState<PostCategory>('pepp');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [publishMode, setPublishMode] = useState<'now' | 'scheduled_date' | 'program_schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('08:00');
  const [programWeek, setProgramWeek] = useState(1);
  const [programDay, setProgramDay] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdminOrCoach = userRole === 'admin' || userRole === 'coach';

  // Listen to scheduled posts
  useEffect(() => {
    if (!db || !isAdminOrCoach) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'scheduledPosts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts: ScheduledPost[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as ScheduledPost));
      
      // Filter for editorial posts or general scheduled posts
      setScheduledPosts(posts.filter(p => p.isEditorial || p.groupId === 'all' || p.groupId === 'editorial'));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to scheduledPosts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdminOrCoach]);

  if (!isAdminOrCoach) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-neutral-light text-center max-w-xl mx-auto my-8 shadow-sm">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-neutral-dark mb-2">Ingen behörighet</h2>
        <p className="text-neutral text-sm">Denna sida är endast tillgänglig för administratörer och coacher.</p>
      </div>
    );
  }

  const handleSenderTypeChange = (type: 'kostloggen' | 'coach' | 'custom') => {
    setSenderType(type);
    if (type === 'kostloggen') {
      setSenderName('Kostloggen');
    } else if (type === 'coach') {
      setSenderName('Coach Mikael');
    } else {
      setSenderName(customSenderName || 'Redaktionen');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setToastNotification({ message: 'Vänligen fyll i innehåll för inlägget.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    const effectiveSender = senderType === 'custom' ? (customSenderName.trim() || 'Kostloggen') : senderName;

    try {
      if (publishMode === 'now') {
        // Publish immediately to communityTimeline as editorial post
        const photoURL = effectiveSender === 'Kostloggen' 
          ? '/favicon.png' 
          : (COACH_PERSONAS[effectiveSender as keyof typeof COACH_PERSONAS]?.imageUrl || '/favicon.png');

        const postData = {
          content: content.trim(),
          title: title.trim() || undefined,
          category,
          isEditorial: true,
          senderType,
          senderName: effectiveSender,
          userName: effectiveSender,
          userPhotoURL: photoURL,
          isGlobal: true,
          visibleTo: ['GLOBAL', 'all', 'editorial'],
          timestamp: Date.now(),
          type: 'user_post' as const,
          userId: `editorial_${effectiveSender.toLowerCase().replace(/\s+/g, '_')}`,
          gender: 'female' as const,
          reactions: {},
          comments: [],
          relatedDocPath: 'editorial'
        };

        const eventId = `editorial_${Date.now()}`;
        await setDoc(doc(db, 'communityTimeline', eventId), postData);

        // Also save a record in scheduledPosts marked as published
        await addDoc(collection(db, 'scheduledPosts'), {
          content: content.trim(),
          title: title.trim() || undefined,
          category,
          groupId: 'all',
          status: 'published',
          isEditorial: true,
          senderType,
          senderName: effectiveSender,
          createdAt: Date.now(),
          createdBy: currentUser.uid
        });

        setToastNotification({ message: `Redaktionellt inlägg publicerat som ${effectiveSender}!`, type: 'success' });
      } else {
        // Save as scheduled post
        let scheduledForTimestamp: number | undefined = undefined;
        if (publishMode === 'scheduled_date' && scheduledDate) {
          scheduledForTimestamp = new Date(`${scheduledDate}T${scheduledTime || '08:00'}:00`).getTime();
        }

        await addDoc(collection(db, 'scheduledPosts'), {
          content: content.trim(),
          title: title.trim() || undefined,
          category,
          groupId: 'all',
          status: 'pending',
          isEditorial: true,
          senderType,
          senderName: effectiveSender,
          scheduledFor: scheduledForTimestamp,
          programWeek: publishMode === 'program_schedule' ? programWeek : undefined,
          programDay: publishMode === 'program_schedule' ? programDay : undefined,
          publishTime: scheduledTime || '08:00',
          createdAt: Date.now(),
          createdBy: currentUser.uid
        });

        setToastNotification({ message: 'Redaktionellt inlägg schemalagt!', type: 'success' });
      }

      // Reset form
      setContent('');
      setTitle('');
    } catch (error) {
      console.error("Error creating editorial post:", error);
      setToastNotification({ message: 'Kunde inte spara inlägget.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishNow = async (post: ScheduledPost) => {
    if (!window.confirm('Vill du publicera detta inlägg i flödet nu?')) return;

    try {
      const effectiveSender = post.senderName || 'Kostloggen';
      const photoURL = effectiveSender === 'Kostloggen' 
        ? '/favicon.png' 
        : (COACH_PERSONAS[effectiveSender as keyof typeof COACH_PERSONAS]?.imageUrl || '/favicon.png');

      const postData = {
        content: post.content,
        title: post.title || undefined,
        category: post.category,
        isEditorial: true,
        senderType: post.senderType || 'kostloggen',
        senderName: effectiveSender,
        userName: effectiveSender,
        userPhotoURL: photoURL,
        isGlobal: true,
        visibleTo: ['GLOBAL', 'all', 'editorial'],
        timestamp: Date.now(),
        type: 'user_post' as const,
        userId: `editorial_${effectiveSender.toLowerCase().replace(/\s+/g, '_')}`,
        gender: 'female' as const,
        reactions: {},
        comments: [],
        relatedDocPath: 'editorial'
      };

      const eventId = `editorial_${Date.now()}`;
      await setDoc(doc(db, 'communityTimeline', eventId), postData);

      // Update scheduledPost status
      await updateDoc(doc(db, 'scheduledPosts', post.id), {
        status: 'published'
      });

      setToastNotification({ message: 'Inlägget har publicerats i flödet!', type: 'success' });
    } catch (error) {
      console.error("Error publishing post now:", error);
      setToastNotification({ message: 'Kunde inte publicera inlägget.', type: 'error' });
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Är du säker på att du vill radera detta redaktionella inlägg?')) return;

    try {
      await deleteDoc(doc(db, 'scheduledPosts', id));
      setToastNotification({ message: 'Inlägg raderat.', type: 'success' });
    } catch (error) {
      console.error("Error deleting post:", error);
      setToastNotification({ message: 'Kunde inte radera inlägget.', type: 'error' });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-neutral-light">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-[#F6E2D9] text-[#D96E4A] rounded-2xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-fraunces text-neutral-dark">Redaktionella Inlägg</h1>
            <p className="text-sm text-neutral mt-0.5">
              Skapa och schemalägg inlägg från Kostloggen och coacherna för användare med få kompisar eller hela communityt.
            </p>
          </div>
        </div>
      </div>

      {/* Creation Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-neutral-light space-y-6">
        <h2 className="text-lg font-bold text-neutral-dark flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#D96E4A]" />
          Skapa nytt redaktionellt inlägg
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Sender Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral mb-2">
              Avsändare
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSenderTypeChange('kostloggen')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    senderType === 'kostloggen'
                      ? 'bg-[#F6E2D9] border-[#D96E4A] text-[#D96E4A]'
                      : 'bg-neutral-50 border-neutral-light text-neutral'
                  }`}
                >
                  Kostloggen
                </button>
                <button
                  type="button"
                  onClick={() => handleSenderTypeChange('coach')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    senderType === 'coach'
                      ? 'bg-[#F6E2D9] border-[#D96E4A] text-[#D96E4A]'
                      : 'bg-neutral-50 border-neutral-light text-neutral'
                  }`}
                >
                  Coach
                </button>
                <button
                  type="button"
                  onClick={() => handleSenderTypeChange('custom')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    senderType === 'custom'
                      ? 'bg-[#F6E2D9] border-[#D96E4A] text-[#D96E4A]'
                      : 'bg-neutral-50 border-neutral-light text-neutral'
                  }`}
                >
                  Anpassad
                </button>
              </div>

              {senderType === 'coach' && (
                <select
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-light rounded-xl text-sm outline-none focus:border-[#D96E4A]"
                >
                  {Object.values(COACH_PERSONAS).map(c => (
                    <option key={c.label} value={c.label}>{c.label}</option>
                  ))}
                  <option value="General Börje">General Börje</option>
                  <option value="Kostloggen Coach-team">Kostloggen Coach-team</option>
                </select>
              )}

              {senderType === 'custom' && (
                <input
                  type="text"
                  placeholder="Namn på avsändare (t.ex. 'Gästexpert Maria')"
                  value={customSenderName}
                  onChange={(e) => setCustomSenderName(e.target.value)}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-light rounded-xl text-sm outline-none focus:border-[#D96E4A]"
                />
              )}
            </div>
          </div>

          {/* Category Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral mb-2">
              Kategori
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PostCategory)}
              className="w-full p-2.5 bg-neutral-50 border border-neutral-light rounded-xl text-sm outline-none focus:border-[#D96E4A]"
            >
              <option value="pepp">Pepp & Motivation</option>
              <option value="fakta">Fakta & Vetenskap</option>
              <option value="food">Tips, Mat & Recept</option>
              <option value="workout">Träningstips</option>
              <option value="general">Allmänt</option>
            </select>
          </div>
        </div>

        {/* Title (Optional) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral mb-1">
            Rubrik (frivillig)
          </label>
          <input
            type="text"
            placeholder="T.ex. Dagens pepptanke eller 3 enkla lunchtips"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 bg-neutral-50 border border-neutral-light rounded-xl text-sm outline-none focus:border-[#D96E4A]"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral mb-1">
            Inläggstext *
          </label>
          <textarea
            rows={4}
            placeholder="Skriv redaktionellt inlägg här..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-3 bg-neutral-50 border border-neutral-light rounded-xl text-sm outline-none focus:border-[#D96E4A]"
          />
        </div>

        {/* Publishing Options */}
        <div className="space-y-3 pt-2 border-t border-neutral-light">
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral mb-2">
            Publicering
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input
                type="radio"
                name="publishMode"
                checked={publishMode === 'now'}
                onChange={() => setPublishMode('now')}
                className="accent-[#D96E4A]"
              />
              Publicera direkt i flödet
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input
                type="radio"
                name="publishMode"
                checked={publishMode === 'scheduled_date'}
                onChange={() => setPublishMode('scheduled_date')}
                className="accent-[#D96E4A]"
              />
              Schemalägg för datum & tid
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input
                type="radio"
                name="publishMode"
                checked={publishMode === 'program_schedule'}
                onChange={() => setPublishMode('program_schedule')}
                className="accent-[#D96E4A]"
              />
              Schemalägg för programvecka/dag
            </label>
          </div>

          {publishMode === 'scheduled_date' && (
            <div className="flex items-center gap-3 pt-2">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="p-2.5 bg-neutral-50 border border-neutral-light rounded-xl text-sm"
              />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="p-2.5 bg-neutral-50 border border-neutral-light rounded-xl text-sm"
              />
            </div>
          )}

          {publishMode === 'program_schedule' && (
            <div className="flex items-center gap-4 pt-2">
              <div>
                <span className="text-xs text-neutral mr-2 font-medium">Vecka:</span>
                <select
                  value={programWeek}
                  onChange={(e) => setProgramWeek(Number(e.target.value))}
                  className="p-2 bg-neutral-50 border border-neutral-light rounded-xl text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(w => (
                    <option key={w} value={w}>Vecka {w}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-xs text-neutral mr-2 font-medium">Dag:</span>
                <select
                  value={programDay}
                  onChange={(e) => setProgramDay(Number(e.target.value))}
                  className="p-2 bg-neutral-50 border border-neutral-light rounded-xl text-sm"
                >
                  {[
                    { id: 1, name: 'Måndag' },
                    { id: 2, name: 'Tisdag' },
                    { id: 3, name: 'Onsdag' },
                    { id: 4, name: 'Torsdag' },
                    { id: 5, name: 'Fredag' },
                    { id: 6, name: 'Lördag' },
                    { id: 7, name: 'Söndag' },
                  ].map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Submit button */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-[#D96E4A] hover:bg-[#C05A38] text-white font-bold rounded-2xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : publishMode === 'now' ? (
              <>
                <Send className="w-4 h-4" />
                Publicera nu
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Spara & Schemalägg
              </>
            )}
          </button>
        </div>
      </form>

      {/* List of Redaktionella Inlägg */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-neutral-light space-y-4">
        <h2 className="text-lg font-bold text-neutral-dark flex items-center justify-between">
          <span>Bibliotek & Schemalagda Inlägg ({scheduledPosts.length})</span>
        </h2>

        {loading ? (
          <div className="py-12 text-center text-neutral text-sm">Laddar inlägg...</div>
        ) : scheduledPosts.length === 0 ? (
          <div className="py-12 text-center text-neutral bg-neutral-50 rounded-2xl border border-dashed border-neutral-light p-6">
            <p className="font-semibold text-neutral-dark mb-1">Inga redaktionella inlägg finns ännu</p>
            <p className="text-sm text-neutral">Skapa ditt första inlägg med formuläret ovan för att fylla flödet med inspirerande innehåll.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledPosts.map(post => {
              const sender = post.senderName || 'Kostloggen';
              const isPublished = post.status === 'published';

              return (
                <div
                  key={post.id}
                  className="p-4 rounded-2xl border border-neutral-light bg-neutral-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors hover:bg-neutral-50"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F6E2D9] text-[#D96E4A]">
                        {sender}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-200 text-neutral-dark capitalize">
                        {post.category}
                      </span>
                      {isPublished ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#84A98C]/20 text-[#56524D] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Publicerad
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Schemalagd
                        </span>
                      )}
                      {post.programWeek && post.programDay && (
                        <span className="text-xs font-semibold text-neutral-500">
                          (V.{post.programWeek} Dag {post.programDay})
                        </span>
                      )}
                    </div>

                    {post.title && (
                      <h3 className="font-bold text-neutral-dark text-sm">{post.title}</h3>
                    )}
                    <p className="text-sm text-neutral line-clamp-2">{post.content}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    {!isPublished && (
                      <button
                        onClick={() => handlePublishNow(post)}
                        className="px-3 py-1.5 bg-[#84A98C] hover:bg-[#6b8c73] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                        title="Publicera direkt nu"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Publicera nu
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-2 text-neutral hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                      title="Radera inlägg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
