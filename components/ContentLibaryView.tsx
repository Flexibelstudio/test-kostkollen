import React, { useState, useEffect, useCallback } from 'react';
import { PostTemplate, ScheduledPost, PostCategory, BootcampCohort } from '../types';
import { subscribeToCohorts } from '../services/bootcampService';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { PlusIcon, CalendarIcon, ArchiveBoxIcon, CheckIcon, XMarkIcon, TrashIcon, PencilIcon } from './icons';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import sv from 'date-fns/locale/sv';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';

const DnDCalendar = withDragAndDrop(Calendar);

const locales = {
  'sv': sv,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

interface ContentLibraryViewProps {
  setToastNotification: (notif: { message: string; type: 'success' | 'error' } | null) => void;
  currentUser: any;
}

const ContentLibraryView: React.FC<ContentLibraryViewProps> = ({ setToastNotification, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'library' | 'calendar'>('library');
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [cohorts, setCohorts] = useState<BootcampCohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  
  // Template Form State
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateCategory, setTemplateCategory] = useState<PostCategory>('fakta');
  const [templateTargetGroups, setTemplateTargetGroups] = useState<string[]>(['all']);

  // Calendar State
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [draggedTemplate, setDraggedTemplate] = useState<PostTemplate | null>(null);

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
    if (selectedCohort === 'all') {
      setScheduledPosts([]);
      return;
    }

    const q = query(
      collection(db, 'scheduledPosts'),
      where('groupId', '==', selectedCohort)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts: ScheduledPost[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        posts.push({
          id: doc.id,
          templateId: data.templateId,
          groupId: data.groupId,
          content: data.content,
          category: data.category,
          scheduledFor: data.scheduledFor?.toMillis() || Date.now(),
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
  }, [selectedCohort]);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateTitle.trim() || !templateContent.trim()) {
      setToastNotification({ message: 'Fyll i titel och innehåll', type: 'error' });
      return;
    }

    try {
      if (editingTemplateId) {
        await updateDoc(doc(db, 'postTemplates', editingTemplateId), {
          title: templateTitle,
          content: templateContent,
          category: templateCategory,
          targetGroups: templateTargetGroups,
        });
        setToastNotification({ message: 'Mall uppdaterad', type: 'success' });
      } else {
        await addDoc(collection(db, 'postTemplates'), {
          title: templateTitle,
          content: templateContent,
          category: templateCategory,
          targetGroups: templateTargetGroups,
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid,
        });
        setToastNotification({ message: 'Mall skapad', type: 'success' });
      }
      
      setIsCreatingTemplate(false);
      setEditingTemplateId(null);
      setTemplateTitle('');
      setTemplateContent('');
      setTemplateCategory('fakta');
      setTemplateTargetGroups(['all']);
    } catch (error) {
      console.error("Error saving template:", error);
      setToastNotification({ message: 'Ett fel uppstod', type: 'error' });
    }
  };

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
    setTemplateTitle(template.title);
    setTemplateContent(template.content);
    setTemplateCategory(template.category);
    setTemplateTargetGroups(template.targetGroups);
    setIsCreatingTemplate(true);
  };

  const toggleTargetGroup = (group: string) => {
    setTemplateTargetGroups(prev => {
      if (group === 'all') return ['all'];
      const newGroups = prev.filter(g => g !== 'all');
      if (newGroups.includes(group)) {
        return newGroups.filter(g => g !== group).length === 0 ? ['all'] : newGroups.filter(g => g !== group);
      } else {
        return [...newGroups, group];
      }
    });
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

  const dragFromOutsideItem = useCallback(() => {
    return draggedTemplate;
  }, [draggedTemplate]);

  const handleDrop = async (date: Date) => {
    if (!draggedTemplate || selectedCohort === 'all') return;

    try {
      // Create a new date object to avoid mutating the original
      const scheduledDate = new Date(date);
      
      // If dropping on month view, the time might be 00:00:00, let's set a default time like 09:00
      if (scheduledDate.getHours() === 0 && scheduledDate.getMinutes() === 0) {
        scheduledDate.setHours(9, 0, 0, 0);
      }

      await addDoc(collection(db, 'scheduledPosts'), {
        templateId: draggedTemplate.id,
        groupId: selectedCohort,
        content: draggedTemplate.content,
        category: draggedTemplate.category,
        scheduledFor: Timestamp.fromDate(scheduledDate),
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

  const calendarEvents = scheduledPosts.map(post => {
    const template = templates.find(t => t.id === post.templateId);
    return {
      id: post.id,
      title: template ? template.title : 'Okänd mall',
      start: new Date(post.scheduledFor),
      end: new Date(post.scheduledFor),
      allDay: true,
      resource: post,
    };
  });

  const EventComponent = ({ event }: any) => {
    const post = event.resource as ScheduledPost;
    return (
      <div className="flex justify-between items-start w-full h-full overflow-hidden p-1">
        <span className="break-words w-full pr-4 text-xs font-medium">{event.title}</span>
        <button 
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleDeleteScheduledPost(post.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 rounded transition-opacity absolute right-1 top-1 z-10 text-neutral-dark"
        >
          <XMarkIcon className="w-3 h-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-dark">Innehållsbibliotek & Schema</h2>
          <p className="text-neutral">Hantera 12-veckorsplanen, CTA och Pepp-inlägg</p>
        </div>
        <div className="flex bg-neutral-light/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'library' ? 'bg-white text-primary shadow-sm' : 'text-neutral hover:text-neutral-dark'}`}
          >
            Bibliotek
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'calendar' ? 'bg-white text-primary shadow-sm' : 'text-neutral hover:text-neutral-dark'}`}
          >
            Kalender
          </button>
        </div>
      </div>

      {activeTab === 'library' && (
        <div className="space-y-6">
          {!isCreatingTemplate ? (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-neutral-dark">Dina Mallar</h3>
                <button
                  onClick={() => setIsCreatingTemplate(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-darker transition-colors text-sm font-medium"
                >
                  <PlusIcon className="w-4 h-4" />
                  Skapa ny mall
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                  <div key={template.id} className="bg-white p-5 rounded-xl border border-neutral-light shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getCategoryColor(template.category)} uppercase tracking-wider`}>
                        {template.category}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEditTemplate(template)} className="p-1.5 text-neutral hover:text-primary rounded-md transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteTemplate(template.id)} className="p-1.5 text-neutral hover:text-red-500 rounded-md transition-colors">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-bold text-neutral-dark mb-2 line-clamp-2">{template.title}</h4>
                    <p className="text-sm text-neutral line-clamp-3 flex-grow mb-4">{template.content}</p>
                    <div className="mt-auto pt-3 border-t border-neutral-light/50">
                      <p className="text-xs text-neutral-500 font-medium">
                        Visas för: {template.targetGroups.includes('all') ? 'Alla grupper' : template.targetGroups.join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-neutral-light/30 rounded-xl border border-dashed border-neutral-300">
                    <ArchiveBoxIcon className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-neutral-dark mb-1">Inga mallar än</h3>
                    <p className="text-neutral text-sm mb-4">Skapa din första mall för att börja bygga 12-veckorsplanen.</p>
                    <button
                      onClick={() => setIsCreatingTemplate(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-darker transition-colors text-sm font-medium"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Skapa ny mall
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-neutral-light shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-neutral-dark">{editingTemplateId ? 'Redigera mall' : 'Skapa ny mall'}</h3>
                <button onClick={() => { setIsCreatingTemplate(false); setEditingTemplateId(null); }} className="p-2 text-neutral hover:bg-neutral-light rounded-full transition-colors">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTemplate} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-neutral-dark mb-1">Titel (endast för dig)</label>
                  <input
                    type="text"
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    placeholder="T.ex. Vecka 1: Isbrytaren"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-dark mb-1">Innehåll</label>
                  <textarea
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    className="w-full px-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all min-h-[150px] resize-y"
                    placeholder="Skriv inlägget här..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-dark mb-2">Kategori</label>
                    <div className="flex flex-wrap gap-2">
                      {(['fakta', 'cta', 'pepp', 'general'] as PostCategory[]).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setTemplateCategory(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border uppercase tracking-wider transition-colors ${
                            templateCategory === cat 
                              ? getCategoryColor(cat) 
                              : 'bg-white text-neutral border-neutral-light hover:border-neutral-400'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-dark mb-2">Målgrupper</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggleTargetGroup('all')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          templateTargetGroups.includes('all')
                            ? 'bg-neutral-dark text-white border-neutral-dark'
                            : 'bg-white text-neutral border-neutral-light hover:border-neutral-400'
                        }`}
                      >
                        Alla
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTargetGroup('bootcamp')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          templateTargetGroups.includes('bootcamp')
                            ? 'bg-neutral-dark text-white border-neutral-dark'
                            : 'bg-white text-neutral border-neutral-light hover:border-neutral-400'
                        }`}
                      >
                        Bootcamps
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTargetGroup('solo')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          templateTargetGroups.includes('solo')
                            ? 'bg-neutral-dark text-white border-neutral-dark'
                            : 'bg-white text-neutral border-neutral-light hover:border-neutral-400'
                        }`}
                      >
                        Solo
                      </button>
                    </div>
                    <p className="text-xs text-neutral mt-2">
                      Välj vilka grupper detta inlägg är relevant för. Solo-användare kanske inte ska se tidsbundna bootcamp-inlägg.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-neutral-light">
                  <button
                    type="button"
                    onClick={() => { setIsCreatingTemplate(false); setEditingTemplateId(null); }}
                    className="px-5 py-2 text-neutral hover:bg-neutral-light rounded-lg transition-colors font-medium"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-darker transition-colors font-medium flex items-center gap-2"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Spara mall
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="bg-white p-6 rounded-xl border border-neutral-light shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-lg font-semibold text-neutral-dark">Schemalägg Inlägg</h3>
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-4 py-2 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
            >
              <option value="all">Välj en grupp/bootcamp...</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {selectedCohort === 'all' ? (
            <div className="py-12 text-center bg-neutral-light/30 rounded-xl border border-dashed border-neutral-300">
              <CalendarIcon className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-neutral-dark mb-1">Välj en grupp</h3>
              <p className="text-neutral text-sm">Välj en bootcamp eller grupp ovan för att börja schemalägga inlägg.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Drag and Drop implementation will go here. For now, a placeholder */}
              <div className="lg:col-span-1 bg-neutral-light/30 p-4 rounded-xl border border-neutral-200">
                <h4 className="font-semibold text-neutral-dark mb-4">Dina Mallar</h4>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {templates.map(template => (
                    <div 
                      key={template.id} 
                      className="bg-white p-3 rounded-lg border border-neutral-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                      draggable
                      onDragStart={() => handleDragStart(template)}
                      onDragEnd={() => setDraggedTemplate(null)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getCategoryColor(template.category)} uppercase tracking-wider`}>
                          {template.category}
                        </span>
                      </div>
                      <h5 className="font-bold text-sm text-neutral-dark line-clamp-1">{template.title}</h5>
                      <p className="text-xs text-neutral line-clamp-2 mt-1">{template.content}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="lg:col-span-2 bg-neutral-light/30 p-4 rounded-xl border border-neutral-200">
                <h4 className="font-semibold text-neutral-dark mb-4">Kalender (Vecka 1-12)</h4>
                <div 
                  className="h-[600px] bg-white rounded-lg p-2"
                  onDragOver={(e) => e.preventDefault()}
                >
                  <DnDCalendar
                    localizer={localizer}
                    events={calendarEvents}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    views={[Views.MONTH, Views.WEEK]}
                    defaultView={Views.MONTH}
                    components={{
                      event: EventComponent
                    }}
                    onSelectSlot={(slotInfo) => {
                      if (draggedTemplate) {
                        handleDrop(slotInfo.start);
                      }
                    }}
                    onEventDrop={async ({ event, start }) => {
                      try {
                        const post = event.resource as ScheduledPost;
                        await updateDoc(doc(db, 'scheduledPosts', post.id), {
                          scheduledFor: Timestamp.fromDate(new Date(start as Date))
                        });
                        setToastNotification({ message: 'Inlägg flyttat', type: 'success' });
                      } catch (error) {
                        console.error("Error moving post:", error);
                        setToastNotification({ message: 'Kunde inte flytta inlägg', type: 'error' });
                      }
                    }}
                    onDropFromOutside={({ start }) => {
                      if (draggedTemplate) {
                        handleDrop(start as Date);
                      }
                    }}
                    dragFromOutsideItem={
                      draggedTemplate ? dragFromOutsideItem : undefined
                    }
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    draggableAccessor={() => true}
                    resizable={false}
                    popup
                    step={60}
                    timeslots={1}
                    selectable
                    onSelectEvent={(event) => {
                      if (window.confirm('Vill du ta bort detta schemalagda inlägg?')) {
                        const post = event.resource as ScheduledPost;
                        handleDeleteScheduledPost(post.id);
                      }
                    }}
                    eventPropGetter={(event) => {
                      const post = event.resource as ScheduledPost;
                      return {
                        className: `border ${getCategoryColor(post.category)}`
                      };
                    }}
                    messages={{
                      next: "Nästa",
                      previous: "Föregående",
                      today: "Idag",
                      month: "Månad",
                      week: "Vecka",
                      day: "Dag"
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContentLibraryView;
