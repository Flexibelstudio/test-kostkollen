import React, { useState, useEffect, useCallback } from 'react';
import { PostTemplate, ScheduledPost, PostCategory, BootcampCohort } from '../types';
import { subscribeToCohorts } from '../services/bootcampService';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, where } from 'firebase/firestore';
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
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editingScheduledPost, setEditingScheduledPost] = useState<ScheduledPost | null>(null);

  useEffect(() => {
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
    if (!draggedTemplate) return;

    try {
      await addDoc(collection(db, 'scheduledPosts'), {
        templateId: draggedTemplate.id,
        groupId: selectedCohort,
        excludedGroups: [],
        content: draggedTemplate.content,
        category: draggedTemplate.category,
        programWeek: week,
        programDay: day,
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
      });
      setToastNotification({ message: 'Inlägg schemalagt', type: 'success' });
    } catch (error) {
      console.error("Error scheduling post:", error);
      setToastNotification({ message: 'Kunde inte schemalägga inlägg', type: 'error' });
    } finally {
      setDraggedTemplate(null);
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
    { id: 1, name: 'Mån' },
    { id: 2, name: 'Tis' },
    { id: 3, name: 'Ons' },
    { id: 4, name: 'Tor' },
    { id: 5, name: 'Fre' },
    { id: 6, name: 'Lör' },
    { id: 7, name: 'Sön' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
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
                                className={`text-[10px] p-1.5 rounded border ${getCategoryColor(post.category)} relative group/post shadow-sm`}
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
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-white/90 rounded-md shadow-sm p-0.5">
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

      {editingScheduledPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
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
                  Vecka {editingScheduledPost.programWeek}, {editingScheduledPost.programDay ? ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'][editingScheduledPost.programDay - 1] : ''}
                </div>
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
        </div>
      )}

      {isAIModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl min-h-[90vh] my-8 flex flex-col relative">
            <button 
              onClick={() => {
                setIsAIModalOpen(false);
                setEditingTemplateId(null);
              }} 
              className="absolute top-6 right-6 z-10 text-neutral-400 hover:text-neutral-600 bg-white rounded-full p-1 shadow-sm"
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
                      const templateRef = await addDoc(collection(db, 'postTemplates'), {
                        title: title || `Börje-inlägg ${format(new Date(), 'yyyy-MM-dd')}`,
                        content: draft,
                        category: category,
                        targetGroups: targetGroups || ['all'],
                        createdAt: serverTimestamp(),
                        createdBy: currentUser.uid,
                      });

                      // 2. Schedule
                      if (selectedWeek && selectedDay) {
                        await addDoc(collection(db, 'scheduledPosts'), {
                          templateId: templateRef.id,
                          groupId: selectedCohort,
                          excludedGroups: [],
                          content: draft,
                          category: category,
                          programWeek: selectedWeek,
                          programDay: selectedDay,
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
                  }
                }}
              />
          </div>
        </div>
      )}
    </div>
  );
};

export default BootcampContentLibrary;
