import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PostTemplate, ScheduledPost, PostCategory, BootcampCohort } from '../types';
import { subscribeToCohorts } from '../services/bootcampService';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, where, getDoc, setDoc } from 'firebase/firestore';
import { PlusIcon, CalendarIcon, ArchiveBoxIcon, CheckIcon, XMarkIcon, TrashIcon, PencilIcon, SparklesIcon } from './icons';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import CoachStudioView from './CoachStudioView';

interface BootcampContentLibraryProps {
  setToastNotification: (notif: { message: string; type: 'success' | 'error' } | null) => void;
  currentUser: any;
}

const BootcampContentLibrary: React.FC<BootcampContentLibraryProps> = ({ setToastNotification, currentUser }) => {
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [cohorts, setCohorts] = useState<BootcampCohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  
  // Template Form State
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Calendar State
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [draggedTemplate, setDraggedTemplate] = useState<PostTemplate | null>(null);
  const [draggedScheduledPost, setDraggedScheduledPost] = useState<ScheduledPost | null>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('08:00');
  const [editingScheduledPost, setEditingScheduledPost] = useState<ScheduledPost | null>(null);
  const [schedulingTemplate, setSchedulingTemplate] = useState<PostTemplate | null>(null);
  const [scheduleWeek, setScheduleWeek] = useState<number>(1);
  const [scheduleDay, setScheduleDay] = useState<number>(1);
  const [scheduleTime, setScheduleTime] = useState<string>('08:00');

  useEffect(() => {
    const initSolo = async () => {
      try {
        const soloRef = doc(db, 'bootcampCohorts', 'solo');
        const soloDoc = await getDoc(soloRef);
        const now = new Date();
        const stockholmTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
        const todayString = `${stockholmTime.getFullYear()}-${String(stockholmTime.getMonth() + 1).padStart(2, '0')}-${String(stockholmTime.getDate()).padStart(2, '0')}`;
        
        if (!soloDoc.exists()) {
          await setDoc(soloRef, {
            name: "Solo-trupp",
            status: "active",
            startDate: todayString,
            isPublic: false,
            createdAt: Date.now(),
            createdBy: "system"
          });
          console.log("Initialized solo bootcamp with startDate:", todayString);
        } else if (!soloDoc.data().startDate) {
          await updateDoc(soloRef, {
            startDate: todayString
          });
          console.log("Updated solo bootcamp with startDate:", todayString);
        }
      } catch (e) {
        console.error("Failed to init solo bootcamp", e);
      }
    };
    initSolo();

    const unsubscribeCohorts = subscribeToCohorts((data) => {
      setCohorts(data);
    });

    const q = query(collection(db, 'postTemplates'), orderBy('createdAt', 'desc'));
    const unsubscribeTemplates = onSnapshot(q, (snapshot) => {
      const fetchedTemplates: PostTemplate[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedTemplates.push({
          id: doc.id,
          title: data.title,
          content: data.content,
          category: data.category,
          targetGroups: data.targetGroups || ['all'],
          createdAt: data.createdAt?.toMillis() || Date.now(),
          createdBy: data.createdBy,
        });
      });
      setTemplates(fetchedTemplates);
    }, (error) => {
      console.error("Error fetching templates:", error);
    });

    return () => {
      unsubscribeCohorts();
      unsubscribeTemplates();
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'scheduledPosts'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts: ScheduledPost[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        posts.push({
          id: doc.id,
          templateId: data.templateId,
          groupId: data.groupId,
          excludedGroups: data.excludedGroups || [],
          content: data.content,
          category: data.category,
          scheduledFor: data.scheduledFor?.toMillis(),
          programWeek: data.programWeek,
          programDay: data.programDay,
          publishTime: data.publishTime,
          status: data.status,
          createdAt: data.createdAt?.toMillis() || Date.now(),
          createdBy: data.createdBy,
        });
      });
      setScheduledPosts(posts);
    }, (error) => {
      console.error("Error fetching scheduled posts:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteTemplate = async (id: string) => {
    if (window.confirm('Är du säker på att du vill ta bort denna mall?')) {
      try {
        await deleteDoc(doc(db, 'postTemplates', id));
        setToastNotification({ message: 'Mall borttagen', type: 'success' });
      } catch (error) {
        console.error("Error deleting template:", error);
        setToastNotification({ message: 'Kunde inte ta bort mall', type: 'error' });
      }
    }
  };

  const handleEditTemplate = (template: PostTemplate) => {
    setEditingTemplateId(template.id);
    setSelectedWeek(null);
    setSelectedDay(null);
    setIsAIModalOpen(true);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'fakta': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cta': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pepp': return 'bg-pink-100 text-pink-800 border-pink-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleDragStart = (template: PostTemplate) => {
    setDraggedTemplate(template);
  };

  const handleDropToGrid = async (week: number, day: number) => {
    if (draggedTemplate) {
      setSchedulingTemplate(draggedTemplate);
      setScheduleWeek(week);
      setScheduleDay(day);
      setScheduleTime('08:00');
      setDraggedTemplate(null);
    } else if (draggedScheduledPost) {
      const postId = draggedScheduledPost.id;
      const oldWeek = draggedScheduledPost.programWeek;
      const oldDay = draggedScheduledPost.programDay;

      // Om inlägget släpps på samma cell, gör ingenting
      if (oldWeek === week && oldDay === day) {
        setDraggedScheduledPost(null);
        return;
      }

      try {
        await updateDoc(doc(db, 'scheduledPosts', postId), {
          programWeek: week,
          programDay: day,
          updatedAt: serverTimestamp()
        });
        setToastNotification({ message: 'Inlägget flyttat!', type: 'success' });
      } catch (error) {
        console.error("Error moving scheduled post:", error);
        setToastNotification({ message: 'Kunde inte flytta inlägget', type: 'error' });
      } finally {
        setDraggedScheduledPost(null);
      }
    }
  };

  const handleDeleteScheduledPost = async (id: string) => {
    if (window.confirm('Är du säker på att du vill ta bort detta schemalagda inlägg?')) {
      try {
        await deleteDoc(doc(db, 'scheduledPosts', id));
        setToastNotification({ message: 'Schemalagt inlägg borttaget', type: 'success' });
      } catch (error) {
        console.error("Error deleting scheduled post:", error);
        setToastNotification({ message: 'Kunde inte ta bort schemalagt inlägg', type: 'error' });
      }
    }
  };

  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = [
    { id: 1, name: 'Dag 1' },
    { id: 2, name: 'Dag 2' },
    { id: 3, name: 'Dag 3' },
    { id: 4, name: 'Dag 4' },
    { id: 5, name: 'Dag 5' },
    { id: 6, name: 'Dag 6' },
    { id: 7, name: 'Dag 7' },
  ];

  const getCohortCurrentDay = (cohortId: string) => {
    const cohort = cohorts.find(c => c.id === cohortId);
    if (!cohort || !cohort.startDate) return 'Okänt startdatum';
    
    let startStockholmString;
    if (typeof cohort.startDate === 'string') {
        startStockholmString = cohort.startDate.split('T')[0];
    } else if (cohort.startDate && typeof (cohort.startDate as any).toDate === 'function') {
        const d = (cohort.startDate as any).toDate();
        const st = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
        startStockholmString = `${st.getFullYear()}-${String(st.getMonth() + 1).padStart(2, '0')}-${String(st.getDate()).padStart(2, '0')}`;
    } else {
        return 'Ogiltigt startdatum';
    }

    const startDate = new Date(startStockholmString);
    const now = new Date();
    const stockholmTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
    const todayString = `${stockholmTime.getFullYear()}-${String(stockholmTime.getMonth() + 1).padStart(2, '0')}-${String(stockholmTime.getDate()).padStart(2, '0')}`;
    const today = new Date(todayString);
    
    if (today < startDate) return `Börjar ${startStockholmString}`;
    
    const diffTime = Math.abs(today.getTime() - startDate.getTime());
    let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (cohort.id === 'solo') {
        diffDays = diffDays % 84;
    }
    
    const currentWeek = Math.floor(diffDays / 7) + 1;
    const currentDay = (diffDays % 7) + 1;
    
    return `Idag: Vecka ${currentWeek}, Dag ${currentDay} (Startade ${startStockholmString})`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-sm font-medium text-neutral-600 bg-neutral-100 px-4 py-2 rounded-lg">
          {selectedCohort !== 'all' ? getCohortCurrentDay(selectedCohort) : 'Välj en specifik trupp för att se aktuell dag'}
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            className="px-4 py-2 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm bg-white"
          >
            <option value="all">Alla trupper (Master-schema)</option>
            {cohorts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 flex flex-col shadow-sm">
          <div className="overflow-x-auto custom-scrollbar pr-2">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-8 gap-2 mb-2 sticky top-0 bg-white/95 backdrop-blur z-10 py-2 border-b border-neutral-100">
                <div className="font-bold text-neutral-500 text-sm text-center">Vecka</div>
                {days.map(day => (
                  <div key={day.id} className="font-bold text-neutral-dark text-center text-sm">{day.name}</div>
                ))}
              </div>
              <div className="space-y-2 pb-4">
                {weeks.map(week => (
                  <div key={week} className="grid grid-cols-8 gap-2">
                    <div className="flex items-center justify-center font-bold text-neutral-500 bg-white/50 rounded-lg text-sm">
                      V. {week}
                    </div>
                    {days.map(day => {
                      const postsForCell = scheduledPosts.filter(p => {
                        if (p.programWeek !== week || p.programDay !== day.id) return false;
                        if (selectedCohort === 'all') return p.groupId === 'all';
                        if (p.groupId === selectedCohort) return true;
                        if (p.groupId === 'all' && !p.excludedGroups?.includes(selectedCohort)) return true;
                        return false;
                      });

                      return (
                        <div 
                          key={`${week}-${day.id}`}
                          className="min-h-[100px] bg-white border border-neutral-200 rounded-lg p-1.5 hover:border-primary/50 transition-colors cursor-pointer flex flex-col gap-1.5 group/cell"
                          onClick={() => {
                            setSelectedWeek(week);
                            setSelectedDay(day.id);
                            setIsAIModalOpen(true);
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDropToGrid(week, day.id);
                          }}
                        >
                          {postsForCell.map(post => {
                            const template = templates.find(t => t.id === post.templateId);
                            const title = template ? template.title : 'Inlägg';
                            return (
                              <div 
                                key={post.id} 
                                className={`text-[10px] p-1.5 rounded border ${getCategoryColor(post.category)} relative group/post shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors`}
                                draggable
                                onDragStart={(e) => {
                                  setDraggedScheduledPost(post);
                                }}
                                onDragEnd={() => setDraggedScheduledPost(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingScheduledPost(post);
                                }}
                              >
                                <div className="font-bold line-clamp-1 mb-0.5">{title}</div>
                                <div className="line-clamp-2 opacity-80 leading-tight">{post.content}</div>
                                {post.groupId === 'all' && post.excludedGroups && post.excludedGroups.length > 0 && (
                                  <div className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded mt-1 w-max">
                                    Avvikelser ({post.excludedGroups.length})
                                  </div>
                                )}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteScheduledPost(post.id);
                                  }}
                                  className="absolute top-0.5 right-0.5 opacity-0 group-hover/post:opacity-100 bg-white/90 rounded-full p-0.5 text-red-500 hover:text-red-700 shadow-sm"
                                >
                                  <XMarkIcon className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                          <div className="mt-auto pt-1 flex justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                            <PlusIcon className="w-4 h-4 text-neutral-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-neutral-light/30 p-6 rounded-xl border border-neutral-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-neutral-dark">Dina Mallar</h3>
            <button
              onClick={() => {
                setSelectedWeek(null);
                setSelectedDay(null);
                setEditingTemplateId(null);
                setIsAIModalOpen(true);
              }}
              className="px-4 py-2 bg-white text-primary rounded-lg hover:bg-primary/10 transition-colors border border-neutral-200 shadow-sm font-medium flex items-center gap-2"
              title="Skapa ny mall"
            >
              <PlusIcon className="w-4 h-4" />
              Skapa ny mall
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {templates.map(template => (
              <div 
                key={template.id} 
                className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors group relative flex flex-col h-full"
                draggable
                onDragStart={() => handleDragStart(template)}
                onDragEnd={() => setDraggedTemplate(null)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold border ${getCategoryColor(template.category)} uppercase tracking-wider`}>
                    {template.category}
                  </span>
                  <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-white/90 rounded-md shadow-sm p-0.5">
                    <button onClick={(e) => { e.stopPropagation(); handleEditTemplate(template); }} className="p-1.5 text-neutral-400 hover:text-primary transition-colors">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }} className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h5 className="font-bold text-base text-neutral-dark mb-2 pr-12">{template.title}</h5>
                <p className="text-sm text-neutral line-clamp-3 flex-1">{template.content}</p>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex justify-between items-center">
                  <span className="text-xs text-neutral-400 font-medium">Dra till kalender</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSchedulingTemplate(template);
                      setScheduleWeek(1);
                      setScheduleDay(1);
                    }}
                    className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-2 py-1.5 rounded-md transition-colors"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Schemalägg
                  </button>
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <div className="col-span-full py-12 text-center text-neutral-500 bg-white rounded-xl border border-neutral-200 border-dashed">
                Inga mallar skapade ännu. Klicka på "Skapa ny mall" för att komma igång.
              </div>
            )}
          </div>
        </div>
      </div>

      {editingScheduledPost && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-neutral-light">
              <h3 className="text-xl font-bold text-neutral-dark">Hantera schemalagt inlägg</h3>
              <button onClick={() => setEditingScheduledPost(null)} className="text-neutral-400 hover:text-neutral-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-neutral-dark mb-1">Innehåll</label>
                <div className="text-sm text-neutral bg-neutral-50 p-3 rounded-lg border border-neutral-light max-h-40 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                  {editingScheduledPost.content}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-neutral-dark mb-1">Schemalagt till</label>
                <div className="text-sm text-neutral bg-neutral-50 p-3 rounded-lg border border-neutral-light">
                  Vecka {editingScheduledPost.programWeek}, {editingScheduledPost.programDay ? `Dag ${editingScheduledPost.programDay}` : ''}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-dark mb-1">Tid för publicering</label>
                <input
                  type="time"
                  value={editingScheduledPost.publishTime || '08:00'}
                  onChange={async (e) => {
                    const newTime = e.target.value;
                    setEditingScheduledPost({ ...editingScheduledPost, publishTime: newTime });
                    try {
                      await updateDoc(doc(db, 'scheduledPosts', editingScheduledPost.id), {
                        publishTime: newTime
                      });
                    } catch (error) {
                      console.error("Error updating time:", error);
                      setToastNotification({ message: 'Kunde inte uppdatera tid', type: 'error' });
                    }
                  }}
                  className="w-full p-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                />
              </div>

              {editingScheduledPost.groupId !== 'all' && (
                <div>
                  <label className="block text-sm font-bold text-neutral-dark mb-1">Målgrupp</label>
                  <div className="text-sm text-neutral bg-neutral-50 p-3 rounded-lg border border-neutral-light">
                    Endast för: {cohorts.find(c => c.id === editingScheduledPost.groupId)?.name || 'Okänd trupp'}
                  </div>
                </div>
              )}

              {editingScheduledPost.groupId === 'all' && (
                <div>
                  <label className="block text-sm font-bold text-neutral-dark mb-2">Dölj för specifika trupper</label>
                  <p className="text-xs text-neutral mb-3">Kryssa i de trupper som <strong>inte</strong> ska se detta inlägg.</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {cohorts.map(cohort => (
                      <label key={cohort.id} className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded-lg cursor-pointer border border-transparent hover:border-neutral-light transition-colors">
                        <input 
                          type="checkbox" 
                          className="rounded text-primary focus:ring-primary"
                          checked={editingScheduledPost.excludedGroups?.includes(cohort.id) || false}
                          onChange={async (e) => {
                            const isChecked = e.target.checked;
                            let newExcluded = [...(editingScheduledPost.excludedGroups || [])];
                            if (isChecked) {
                              newExcluded.push(cohort.id);
                            } else {
                              newExcluded = newExcluded.filter(id => id !== cohort.id);
                            }
                            
                            // Optimistic update
                            setEditingScheduledPost({ ...editingScheduledPost, excludedGroups: newExcluded });
                            
                            try {
                              await updateDoc(doc(db, 'scheduledPosts', editingScheduledPost.id), {
                                excludedGroups: newExcluded
                              });
                            } catch (error) {
                              console.error("Error updating exclusions:", error);
                              setToastNotification({ message: 'Kunde inte uppdatera undantag', type: 'error' });
                            }
                          }}
                        />
                        <span className="text-sm font-medium text-neutral-dark">{cohort.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-neutral-light bg-neutral-50 flex justify-between items-center">
              <button
                onClick={() => {
                  if (window.confirm('Är du säker på att du vill ta bort detta schemalagda inlägg?')) {
                    handleDeleteScheduledPost(editingScheduledPost.id);
                    setEditingScheduledPost(null);
                  }
                }}
                className="text-red-500 hover:text-red-700 font-bold text-sm flex items-center gap-1 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                Ta bort inlägg
              </button>
              <button
                onClick={() => setEditingScheduledPost(null)}
                className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary-dark transition-colors"
              >
                Klar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {schedulingTemplate && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-neutral-light">
              <h3 className="text-xl font-bold text-neutral-dark">Schemalägg mall</h3>
              <button onClick={() => setSchedulingTemplate(null)} className="text-neutral-400 hover:text-neutral-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-neutral-dark mb-1">Mall</label>
                <div className="text-sm text-neutral bg-neutral-50 p-3 rounded-lg border border-neutral-light">
                  {schedulingTemplate.title}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-neutral-dark mb-1">Vecka</label>
                  <select
                    value={scheduleWeek}
                    onChange={(e) => setScheduleWeek(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>Vecka {w}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-dark mb-1">Dag</label>
                  <select
                    value={scheduleDay}
                    onChange={(e) => setScheduleDay(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                  >
                    {['Dag 1', 'Dag 2', 'Dag 3', 'Dag 4', 'Dag 5', 'Dag 6', 'Dag 7'].map((d, i) => (
                      <option key={i + 1} value={i + 1}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-dark mb-1">Tid (valfritt)</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full p-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                />
                <p className="text-xs text-neutral-500 mt-1">Om ingen tid anges publiceras inlägget kl 08:00.</p>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-light bg-neutral-50 flex justify-end gap-3">
              <button
                onClick={() => setSchedulingTemplate(null)}
                className="px-4 py-2 text-neutral hover:text-neutral-dark font-medium transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={async () => {
                  const cohortName = selectedCohort === 'all' ? 'alla trupper' : cohorts.find(c => c.id === selectedCohort)?.name || 'vald trupp';
                  const dayName = `Dag ${scheduleDay}`;
                  const confirmMsg = `Bekräfta schemaläggning:\n\nInlägget kommer att publiceras automatiskt i flödet för ${cohortName}.\nNär: Vecka ${scheduleWeek}, ${dayName} kl ${scheduleTime || '08:00'}.\n\nVill du fortsätta?`;
                  
                  if (!window.confirm(confirmMsg)) return;

                  try {
                    await addDoc(collection(db, 'scheduledPosts'), {
                      templateId: schedulingTemplate.id,
                      groupId: selectedCohort,
                      content: schedulingTemplate.content,
                      category: schedulingTemplate.category,
                      programWeek: scheduleWeek,
                      programDay: scheduleDay,
                      publishTime: scheduleTime || '08:00',
                      status: 'pending',
                      createdAt: serverTimestamp(),
                      createdBy: currentUser.uid,
                    });
                    setToastNotification({ message: 'Mallen har schemalagts!', type: 'success' });
                    setSchedulingTemplate(null);
                  } catch (error) {
                    console.error("Error scheduling template:", error);
                    setToastNotification({ message: 'Kunde inte schemalägga mallen.', type: 'error' });
                  }
                }}
                className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-colors flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Schemalägg
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isAIModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-black/50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsAIModalOpen(false);
              setEditingTemplateId(null);
            }
          }}
        >
          <div 
            className="flex min-h-full justify-center items-start p-4 md:p-8"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsAIModalOpen(false);
                setEditingTemplateId(null);
              }
            }}
          >
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl min-h-[90vh] flex flex-col relative">
            {selectedWeek && selectedDay && (
              <div className="p-4 bg-primary/5 border-b border-primary/10 flex flex-wrap gap-6 items-center rounded-t-3xl">
                <div>
                  <span className="text-sm font-bold text-neutral-dark">Schemaläggs till: </span>
                  <span className="text-sm text-neutral">Vecka {selectedWeek}, Dag {selectedDay}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold text-neutral-dark">Tid för publicering:</label>
                  <input 
                    type="time" 
                    value={selectedTime} 
                    onChange={e => setSelectedTime(e.target.value)} 
                    className="px-2 py-1 rounded-md border border-neutral-300 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}
            <button 
              onClick={() => {
                setIsAIModalOpen(false);
                setEditingTemplateId(null);
              }} 
              className={`absolute ${selectedWeek ? 'top-20' : 'top-6'} right-6 z-10 text-neutral-400 hover:text-neutral-600 bg-white rounded-full p-1 shadow-sm`}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            <CoachStudioView 
              currentUser={currentUser}
              setToastNotification={setToastNotification}
              lockedCoach="hard"
              hideCategory={false}
              showTemplateFields={true}
              initialTitle={editingTemplateId ? templates.find(t => t.id === editingTemplateId)?.title : ''}
              initialTargetGroups={editingTemplateId ? templates.find(t => t.id === editingTemplateId)?.targetGroups : ['all']}
              initialContent={editingTemplateId ? templates.find(t => t.id === editingTemplateId)?.content : ''}
              initialCategory={editingTemplateId ? templates.find(t => t.id === editingTemplateId)?.category : 'general'}
              className="flex-1 h-full shadow-none border-none"
              onPublish={async (draft, category, coach, title, targetGroups) => {
                  try {
                    if (editingTemplateId) {
                      // Update existing template
                      await updateDoc(doc(db, 'postTemplates', editingTemplateId), {
                        title: title || `Börje-inlägg ${format(new Date(), 'yyyy-MM-dd')}`,
                        content: draft,
                        category: category,
                        targetGroups: targetGroups || ['all'],
                      });
                      setToastNotification({ message: 'Mall uppdaterad!', type: 'success' });
                    } else {
                      // 1. Save as template
                      
                      // 2. Schedule
                      if (selectedWeek && selectedDay) {
                        const cohortName = selectedCohort === 'all' ? 'alla trupper' : cohorts.find(c => c.id === selectedCohort)?.name || 'vald trupp';
                        const dayName = `Dag ${selectedDay}`;
                        const confirmMsg = `Bekräfta schemaläggning:\n\nInlägget kommer att sparas som en mall OCH publiceras automatiskt i flödet för ${cohortName}.\nNär: Vecka ${selectedWeek}, ${dayName} kl ${selectedTime || '08:00'}.\n\nVill du fortsätta?`;
                        
                        if (!window.confirm(confirmMsg)) return;
                      }

                      const templateRef = await addDoc(collection(db, 'postTemplates'), {
                        title: title || `Börje-inlägg ${format(new Date(), 'yyyy-MM-dd')}`,
                        content: draft,
                        category: category,
                        targetGroups: targetGroups || ['all'],
                        createdAt: serverTimestamp(),
                        createdBy: currentUser.uid,
                      });

                      if (selectedWeek && selectedDay) {
                        await addDoc(collection(db, 'scheduledPosts'), {
                          templateId: templateRef.id,
                          groupId: selectedCohort,
                          excludedGroups: [],
                          content: draft,
                          category: category,
                          programWeek: selectedWeek,
                          programDay: selectedDay,
                          publishTime: selectedTime || '08:00',
                          status: 'scheduled',
                          createdAt: serverTimestamp(),
                          createdBy: currentUser.uid,
                        });
                        setToastNotification({ message: 'Inlägg sparat och schemalagt!', type: 'success' });
                      } else {
                        setToastNotification({ message: 'Inlägg sparat i biblioteket!', type: 'success' });
                      }
                    }
                    setIsAIModalOpen(false);
                    setEditingTemplateId(null);
                  } catch (error) {
                    console.error("Error saving AI post:", error);
                    setToastNotification({ message: 'Ett fel uppstod när inlägget skulle sparas.', type: 'error' });
                    throw error;
                  }
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default BootcampContentLibrary;
