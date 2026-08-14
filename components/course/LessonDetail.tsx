
import React, { useState, useEffect, useRef } from 'react';
import { CourseLesson, UserLessonProgress, UserProfileData, WeightLogEntry, PastDaySummary, AIDataForLessonIntro } from '../../types';
import { ArrowLeftIcon, CheckCircleIcon, CheckIcon, InformationCircleIcon, SparklesIcon, BookOpenIcon, PlusCircleIcon, ChartLineIcon, XMarkIcon, ChevronDownIcon } from '../icons';
import { getAIPersonalizedLessonIntro } from '../../services/geminiService';

interface LessonDetailProps {
  lesson: CourseLesson;
  progress: UserLessonProgress | undefined;
  onToggleFocusPoint: (lessonId: string, focusPointId: string) => void;
  onSaveProgress: (lessonId: string, data: Partial<UserLessonProgress>) => Promise<void>;
  onMarkComplete: (lessonId: string) => void;
  onOpenSpeedDial: () => void;
  onNavigateToJourney: (tab: 'calendar' | 'profile' | 'achievements') => void;
  userProfile: UserProfileData;
  weightLogs: WeightLogEntry[];
  pastDaysSummary: PastDaySummary[];
  onOpenLogWeightModal: () => void;
  onClose: () => void;
  isBootcamp?: boolean;
}

const LessonDetail: React.FC<LessonDetailProps> = ({
  lesson,
  progress,
  onToggleFocusPoint,
  onSaveProgress,
  onMarkComplete,
  onOpenSpeedDial,
  onNavigateToJourney,
  userProfile,
  weightLogs,
  pastDaysSummary,
  onOpenLogWeightModal,
  onClose,
  isBootcamp
}) => {
  const [reflectionAnswer, setReflectionAnswer] = useState(progress?.reflectionAnswer || '');
  const [whyAnswer, setWhyAnswer] = useState(progress?.whyAnswer || '');
  const [smartGoalAnswer, setSmartGoalAnswer] = useState(progress?.smartGoalAnswer || '');
  
  const isDirty = useRef(false);

  const [aiIntro, setAiIntro] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetailedTextExpanded, setIsDetailedTextExpanded] = useState(false);

  // Sync state with props if they change externally (only if not dirty)
  useEffect(() => {
    if (progress && !isDirty.current) {
        setReflectionAnswer(prev => progress.reflectionAnswer !== undefined ? progress.reflectionAnswer : prev);
        setWhyAnswer(prev => progress.whyAnswer !== undefined ? progress.whyAnswer : prev);
        setSmartGoalAnswer(prev => progress.smartGoalAnswer !== undefined ? progress.smartGoalAnswer : prev);
    }
  }, [progress]);

  useEffect(() => {
    const fetchAiIntro = async () => {
      if (lesson.aiPromptHint) {
        setIsLoadingAi(true);
        setAiIntro(null);
        try {
          const dataForIntro: AIDataForLessonIntro = {
            userName: userProfile.name,
            lessonTitle: lesson.title,
            userProfile,
            pastDaysSummary,
            weightLogs,
          };
          const intro = await getAIPersonalizedLessonIntro(lesson.aiPromptHint, dataForIntro);
          setAiIntro(intro);
        } catch (error) {
          console.error("Failed to fetch AI intro:", error);
          setAiIntro(null);
        } finally {
          setIsLoadingAi(false);
        }
      }
    };
    fetchAiIntro();
  }, [lesson.id, lesson.aiPromptHint, userProfile, weightLogs, pastDaysSummary]);


  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
        // Create a single update object with ALL fields
        const updates: Partial<UserLessonProgress> = {};
        
        // Always include current state values to prevent overwriting with old data
        updates.reflectionAnswer = reflectionAnswer;
        
        if (lesson.specialAction?.type === 'writeWhy') {
            updates.whyAnswer = whyAnswer;
        }
        
        if (lesson.specialAction?.type === 'smartGoal') {
            updates.smartGoalAnswer = smartGoalAnswer;
        }

        await onSaveProgress(lesson.id, updates);
        isDirty.current = false; // Reset dirty state after save
        onClose();

    } catch (error) {
        console.error("Failed to save lesson details:", error);
    } finally {
        setIsSaving(false);
    }
  };


  const handleCtaClick = (action: 'openSpeedDial' | 'navigateToJourneyCalendar' | 'navigateToJourneyGoals' | 'openLogWeightModal') => {
    switch (action) {
      case 'openSpeedDial':
        onOpenSpeedDial();
        break;
      case 'navigateToJourneyCalendar':
        onNavigateToJourney('calendar');
        break;
      case 'navigateToJourneyGoals':
        onNavigateToJourney('profile');
        break;
      case 'openLogWeightModal':
        onOpenLogWeightModal();
        break;
    }
  };


  const allFocusPointsCompleted = lesson.focusPoints.every(fp => progress?.completedFocusPoints?.includes(fp.id));

  return (
    <div className="animate-fade-in pb-10">
      <article className={`p-6 sm:p-8 rounded-3xl shadow-soft-xl border ${isBootcamp ? 'bg-white dark:bg-[#1A2B1C] border-neutral-light dark:border-[#3A4B3C]' : 'bg-white dark:bg-neutral-darker border-neutral-light'}`}>
        <header className={`mb-8 pb-6 border-b ${isBootcamp ? 'border-neutral-light dark:border-[#3A4B3C]' : 'border-neutral-light/70'}`}>
            <div className="flex justify-between items-start mb-4">
                <button
                    onClick={onClose}
                    className={`p-2 -ml-2 rounded-full active:scale-95 transition-all ${isBootcamp ? 'text-neutral dark:text-neutral-400 hover:text-[#D96E4A] hover:bg-[#F6E2D9]' : 'text-neutral hover:text-primary hover:bg-primary-50'}`}
                    aria-label="Tillbaka till kursöversikt"
                >
                    <ArrowLeftIcon className="w-8 h-8" />
                </button>
                <h1 className={`text-2xl sm:text-3xl font-extrabold flex-1 text-center pr-6 leading-tight ${isBootcamp ? 'text-neutral-dark dark:text-white' : 'text-neutral-dark'}`}>{lesson.title}</h1>
            </div>
           {isLoadingAi && (
            <div className={`p-4 rounded-xl text-sm flex items-center justify-center ${isBootcamp ? 'bg-[#F6E2D9] text-[#D96E4A]' : 'bg-primary-100/60 text-primary-darker'}`}>
              <SparklesIcon className="w-5 h-5 mr-2 animate-pulse" />
              Flexibot skräddarsyr din lektion...
            </div>
          )}
          {aiIntro && !isLoadingAi && (
            <div className={`p-4 mb-4 rounded-xl border shadow-sm ${isBootcamp ? 'bg-[#F6E2D9]/60 border-[#D96E4A]/30' : 'bg-primary-100/60 border-primary-200/80'}`}>
                <p className={`text-base italic ${isBootcamp ? 'text-neutral-dark dark:text-neutral-300' : 'text-neutral-dark'}`}>
                    <SparklesIcon className={`w-5 h-5 mr-2 inline-block align-text-bottom ${isBootcamp ? 'text-[#D96E4A]' : 'text-primary'}`} />
                    {aiIntro}
                </p>
            </div>
          )}
          <p className={`text-lg mt-4 text-center leading-relaxed font-medium max-w-2xl mx-auto ${isBootcamp ? 'text-neutral-dark dark:text-neutral-300' : 'text-neutral-dark'}`}>{lesson.introduction}</p>
        </header>
        
        {lesson.detailedText && (
          <div className="my-8 py-2">
            <button
              onClick={() => setIsDetailedTextExpanded(!isDetailedTextExpanded)}
              className={`w-full flex justify-between items-center text-left p-4 rounded-xl transition-colors ${isBootcamp ? 'hover:bg-neutral-light/50 dark:hover:bg-[#2A3B2C]' : 'hover:bg-neutral-light/50'}`}
              aria-expanded={isDetailedTextExpanded}
              aria-controls={`lesson-detailed-text-${lesson.id}`}
            >
              <h3 className={`text-xl font-bold ${isBootcamp ? 'text-neutral-dark dark:text-white' : 'text-neutral-dark'}`}>Läs mer om lektionen</h3>
              <ChevronDownIcon
                className={`w-6 h-6 transition-transform duration-300 ${isDetailedTextExpanded ? 'rotate-180' : ''} ${isBootcamp ? 'text-neutral-dark dark:text-white' : 'text-neutral-dark'}`}
              />
            </button>
            <div
              id={`lesson-detailed-text-${lesson.id}`}
              className={`overflow-hidden transition-[max-height] duration-500 ease-in-out ${isDetailedTextExpanded ? 'max-h-[2000px]' : 'max-h-0'}`}
            >
              <div className={`pt-4 px-4 text-base space-y-4 leading-relaxed ${isBootcamp ? 'text-neutral-dark dark:text-neutral-300' : 'text-neutral-dark'}`}>
                {lesson.detailedText.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {lesson.specialAction && (
          <section className={`mb-10 p-6 rounded-2xl border ${isBootcamp ? 'bg-[#F6E2D9]/50 border-[#D96E4A]/30' : 'bg-[#F6E2D9]/60 border-[#D96E4A]/30'}`}>
            <h2 className={`text-xl font-bold mb-2 ${isBootcamp ? 'text-[#56524D]' : 'text-[#56524D]'}`}>{lesson.specialAction.prompt}</h2>
            {lesson.specialAction.description && <p className={`text-base mb-4 ${isBootcamp ? 'text-neutral-dark dark:text-neutral-300' : 'text-neutral-dark'}`}>{lesson.specialAction.description}</p>}
            
                 <textarea
                  value={lesson.specialAction.type === 'writeWhy' ? whyAnswer : smartGoalAnswer} 
                  onChange={(e) => {
                      isDirty.current = true;
                      if (lesson.specialAction?.type === 'writeWhy') {
                          setWhyAnswer(e.target.value);
                      } else {
                          setSmartGoalAnswer(e.target.value);
                      }
                  }}
                  rows={5}
                  className={`w-full p-4 border rounded-xl shadow-sm focus:outline-none focus:ring-2 text-base ${isBootcamp ? 'bg-white dark:bg-[#1A2B1C] border-neutral-light focus:ring-[#D96E4A] dark:text-white' : 'border-neutral-light focus:ring-primary'}`}
                  placeholder="Skriv dina tankar här..."
                  aria-label={lesson.specialAction.prompt}
                />
          </section>
        )}


        <section className="mb-10">
          <h2 className={`text-2xl font-bold mb-5 ${isBootcamp ? 'text-neutral-dark dark:text-white' : 'text-neutral-dark'}`}>Fokus denna lektion:</h2>
          <ul className="space-y-4">
            {lesson.focusPoints.map(point => (
              <li key={point.id} className="space-y-3">
                <button
                  onClick={() => onToggleFocusPoint(lesson.id, point.id)}
                  className={`flex items-center w-full p-4 rounded-xl border-2 interactive-transition active:scale-[0.98] shadow-sm
                    ${progress?.completedFocusPoints?.includes(point.id)
                      ? (isBootcamp ? 'bg-[#E8EFE9] border-[#8C9A86] text-[#2B3B2C]' : 'bg-[#E8EFE9] border-[#8C9A86] text-[#2B3B2C]')
                      : (isBootcamp ? 'bg-white border-neutral-light hover:border-[#D96E4A] text-neutral-dark' : 'bg-white dark:bg-neutral-darker border-neutral-light hover:border-[#D96E4A] text-neutral-dark dark:text-white')
                    }`}
                  aria-pressed={progress?.completedFocusPoints?.includes(point.id)}
                >
                  <div className="flex-shrink-0 w-8 h-8 mr-4 flex items-center justify-center">
                    {progress?.completedFocusPoints?.includes(point.id) ? (
                      <CheckCircleIcon className={`w-8 h-8 ${isBootcamp ? 'text-[#8C9A86]' : 'text-[#8C9A86]'}`} />
                    ) : (
                      <div className={`w-6 h-6 border-2 rounded-full transition-colors ${isBootcamp ? 'border-neutral-300 group-hover:border-[#D96E4A]' : 'border-neutral-300 group-hover:border-[#D96E4A]'}`}></div>
                    )}
                  </div>
                  <span className="flex-grow text-left text-base sm:text-lg font-medium">{point.text}</span>
                </button>
                {point.cta && (
                    <div className="pl-14">
                        <button 
                            onClick={() => handleCtaClick(point.cta!.action)}
                            className={`px-5 py-2 text-sm font-bold text-white rounded-lg shadow-md active:scale-95 transform interactive-transition flex items-center ${isBootcamp ? 'bg-[#D96E4A] hover:bg-[#C05A38]' : 'bg-[#D96E4A] hover:bg-[#C05A38]'}`}
                        >
                            {point.cta.action === 'openSpeedDial' && <PlusCircleIcon className="w-4 h-4 mr-2"/>}
                            {point.cta.action === 'navigateToJourneyCalendar' && <BookOpenIcon className="w-4 h-4 mr-2"/>}
                            {point.cta.action === 'navigateToJourneyGoals' && <ChartLineIcon className="w-4 h-4 mr-2"/>}
                            {point.cta.action === 'openLogWeightModal' && <PlusCircleIcon className="w-4 h-4 mr-2"/>}
                            {point.cta.label}
                        </button>
                    </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {lesson.tips && lesson.tips.length > 0 && (
          <section className={`mb-10 p-6 border rounded-2xl ${isBootcamp ? 'bg-[#F6E2D9]/40 border-[#D96E4A]/30' : 'bg-[#F6E2D9]/40 border-[#D96E4A]/30'}`}>
            <h2 className={`text-xl font-bold mb-4 flex items-center ${isBootcamp ? 'text-[#D96E4A]' : 'text-[#D96E4A]'}`}>
                <InformationCircleIcon className="w-6 h-6 mr-2" />
                Tips!
            </h2>
            <ul className="space-y-3">
              {lesson.tips.map(tip => (
                <li key={tip.id} className="flex items-start">
                  <p className={`text-base leading-relaxed ${isBootcamp ? 'text-[#56524D]' : 'text-[#56524D]'}`}>{tip.text}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-10">
          <h2 className={`text-xl font-bold mb-3 ${isBootcamp ? 'text-neutral-dark dark:text-white' : 'text-neutral-dark'}`}>{lesson.reflection.question}</h2>
          <textarea
            value={reflectionAnswer}
            onChange={(e) => {
                isDirty.current = true;
                setReflectionAnswer(e.target.value);
            }}
            rows={4}
            className={`w-full p-4 border rounded-xl shadow-sm focus:outline-none focus:ring-2 text-base ${isBootcamp ? 'bg-white border-neutral-light focus:ring-[#D96E4A] dark:text-white' : 'border-neutral-light focus:ring-primary'}`}
            placeholder="Dina tankar och reflektioner..."
            aria-label={lesson.reflection.question}
          />
        </section>
        
        {progress?.isCompleted ? (
           <div className={`mt-10 p-6 border rounded-2xl text-center ${isBootcamp ? 'bg-[#E8EFE9] border-[#8C9A86]/40' : 'bg-[#E8EFE9] border-[#8C9A86]/40'}`}>
            <CheckCircleIcon className={`w-12 h-12 mx-auto mb-3 ${isBootcamp ? 'text-[#8C9A86]' : 'text-[#8C9A86]'}`} />
            <p className={`text-xl font-bold ${isBootcamp ? 'text-[#2B3B2C]' : 'text-[#2B3B2C]'}`}>Bra jobbat, du har slutfört denna lektion!</p>
          </div>
        ) : allFocusPointsCompleted ? (
          <div className="mt-10 text-center">
            <button
              onClick={() => onMarkComplete(lesson.id)}
              className={`px-10 py-4 text-white text-xl font-bold rounded-2xl shadow-lg focus:outline-none focus:ring-4 active:scale-95 transform interactive-transition ${isBootcamp ? 'bg-[#D96E4A] hover:bg-[#C05A38] focus:ring-[#D96E4A]/30' : 'bg-[#D96E4A] hover:bg-[#C05A38] focus:ring-[#D96E4A]/30'}`}
            >
              <CheckIcon className="w-6 h-6 inline mr-2" /> Markera lektion som slutförd
            </button>
          </div>
        ) : null}

        <div className="mt-10 pt-8 border-t border-neutral-light/70 text-center">
            <button
                onClick={handleSaveAndClose}
                disabled={isSaving}
                className="w-full sm:w-auto px-8 py-3 bg-secondary text-white text-lg font-semibold rounded-xl shadow-md hover:bg-secondary-darker focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-opacity-50 active:scale-95 transform interactive-transition disabled:opacity-60"
            >
                {isSaving ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white mx-auto"></div>
                ) : (
                    <>
                        <CheckIcon className="w-5 h-5 inline mr-2" />
                        Spara & Stäng
                    </>
                )}
            </button>
        </div>
      </article>
    </div>
  );
};

export default LessonDetail;
