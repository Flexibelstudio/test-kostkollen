
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
  /** Förhandsvisning av en låst kurs: allt går att läsa, inget går att spara. */
  isPreview?: boolean;
  /** Text som förklarar hur kursen låses upp. Visas i botten av förhandsvisningen. */
  previewUnlockText?: string;
  /** Lektionens plats i kursen, t.ex. "Lektion 1 av 12". */
  previewPositionText?: string;
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
  isBootcamp,
  isPreview = false,
  previewUnlockText,
  previewPositionText
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
      if (lesson.aiPromptHint && !isPreview) {
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
      {isPreview && (
        <div className="mb-3 px-4 py-2.5 rounded-2xl bg-[#F6E2D9] border border-[#D96E4A]/30 flex items-center gap-2 text-[#56524D]">
          <BookOpenIcon className="w-5 h-5 text-[#D96E4A] flex-shrink-0" />
          <span className="text-sm font-bold">Förhandsvisning</span>
          {previewPositionText && <span className="text-sm text-[#7A756E]">· {previewPositionText}</span>}
        </div>
      )}
      <article className={`p-6 sm:p-8 rounded-3xl shadow-soft-xl border ${'bg-white dark:bg-neutral-darker border-neutral-light'}`}>
        <header className={`mb-8 pb-6 border-b ${'border-neutral-light/70'}`}>
            <div className="flex justify-between items-start mb-4">
                <button
                    onClick={onClose}
                    className={`p-2 -ml-2 rounded-full active:scale-95 transition-all ${'text-neutral hover:text-primary hover:bg-primary-50'}`}
                    aria-label="Tillbaka till kursöversikt"
                >
                    <ArrowLeftIcon className="w-8 h-8" />
                </button>
                <h1 className={`text-2xl sm:text-3xl font-extrabold flex-1 text-center pr-6 leading-tight ${'text-neutral-dark'}`}>{lesson.title}</h1>
            </div>
           {isLoadingAi && (
            <div className={`p-4 rounded-xl text-sm flex items-center justify-center ${'bg-primary-100/60 text-primary-darker'}`}>
              <SparklesIcon className="w-5 h-5 mr-2 animate-pulse" />
              Flexibot skräddarsyr din lektion...
            </div>
          )}
          {aiIntro && !isLoadingAi && (
            <div className={`p-4 mb-4 rounded-xl border shadow-sm ${'bg-primary-100/60 border-primary-200/80'}`}>
                <p className={`text-base italic ${'text-neutral-dark'}`}>
                    <SparklesIcon className={`w-5 h-5 mr-2 inline-block align-text-bottom ${'text-primary'}`} />
                    {aiIntro}
                </p>
            </div>
          )}
          <p className={`text-lg mt-4 text-center leading-relaxed font-medium max-w-2xl mx-auto ${'text-neutral-dark'}`}>{lesson.introduction}</p>
        </header>
        
        {lesson.detailedText && (
          <div className="my-8 py-2">
            <button
              onClick={() => setIsDetailedTextExpanded(!isDetailedTextExpanded)}
              className={`w-full flex justify-between items-center text-left p-4 rounded-xl transition-colors ${'hover:bg-neutral-light/50'}`}
              aria-expanded={isDetailedTextExpanded}
              aria-controls={`lesson-detailed-text-${lesson.id}`}
            >
              <h3 className={`text-xl font-bold ${'text-neutral-dark'}`}>Läs mer om lektionen</h3>
              <ChevronDownIcon
                className={`w-6 h-6 transition-transform duration-300 ${isDetailedTextExpanded ? 'rotate-180' : ''} ${'text-neutral-dark'}`}
              />
            </button>
            <div
              id={`lesson-detailed-text-${lesson.id}`}
              className={`overflow-hidden transition-[max-height] duration-500 ease-in-out ${isDetailedTextExpanded ? 'max-h-[2000px]' : 'max-h-0'}`}
            >
              <div className={`pt-4 px-4 text-base space-y-4 leading-relaxed ${'text-neutral-dark'}`}>
                {lesson.detailedText.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {lesson.specialAction && (
          <section className={`mb-10 p-6 rounded-2xl border ${'bg-[#F6E2D9]/60 border-[#D96E4A]/30'}`}>
            <h2 className={`text-xl font-bold mb-2 ${'text-[#56524D]'}`}>{lesson.specialAction.prompt}</h2>
            {lesson.specialAction.description && <p className={`text-base mb-4 ${'text-neutral-dark'}`}>{lesson.specialAction.description}</p>}
            
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
                  readOnly={isPreview}
                  disabled={isPreview}
                  className={`w-full p-4 border rounded-xl shadow-sm focus:outline-none focus:ring-2 text-base ${'border-neutral-light focus:ring-primary'} ${isPreview ? 'bg-neutral-light/40 cursor-not-allowed' : ''}`}
                  placeholder={isPreview ? 'Här skriver du dina egna svar när du har kursen.' : 'Skriv dina tankar här...'}
                  aria-label={lesson.specialAction.prompt}
                />
          </section>
        )}


        <section className="mb-10">
          <h2 className={`text-2xl font-bold mb-5 ${'text-neutral-dark'}`}>Fokus denna lektion:</h2>
          <ul className="space-y-4">
            {lesson.focusPoints.map(point => (
              <li key={point.id} className="space-y-3">
                <button
                  onClick={() => { if (!isPreview) onToggleFocusPoint(lesson.id, point.id); }}
                  disabled={isPreview}
                  className={`flex items-center w-full p-4 rounded-xl border-2 interactive-transition shadow-sm ${isPreview ? 'cursor-default' : 'active:scale-[0.98]'}
                    ${progress?.completedFocusPoints?.includes(point.id)
                      ? ('bg-[#E8EFE9] border-[#7BA05B] text-[#2B3B2C]')
                      : ('bg-white dark:bg-neutral-darker border-neutral-light hover:border-[#D96E4A] text-neutral-dark dark:text-white')
                    }`}
                  aria-pressed={progress?.completedFocusPoints?.includes(point.id)}
                >
                  <div className="flex-shrink-0 w-8 h-8 mr-4 flex items-center justify-center">
                    {progress?.completedFocusPoints?.includes(point.id) ? (
                      <CheckCircleIcon className={`w-8 h-8 ${'text-[#7BA05B]'}`} />
                    ) : (
                      <div className={`w-6 h-6 border-2 rounded-full transition-colors ${'border-neutral-300 group-hover:border-[#D96E4A]'}`}></div>
                    )}
                  </div>
                  <span className="flex-grow text-left text-base sm:text-lg font-medium">{point.text}</span>
                </button>
                {point.cta && !isPreview && (
                    <div className="pl-14">
                        <button 
                            onClick={() => handleCtaClick(point.cta!.action)}
                            className={`px-5 py-2 text-sm font-bold text-white rounded-lg shadow-md active:scale-95 transform interactive-transition flex items-center ${'bg-[#D96E4A] hover:bg-[#C05A38]'}`}
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
          <section className={`mb-10 p-6 border rounded-2xl ${'bg-[#F6E2D9]/40 border-[#D96E4A]/30'}`}>
            <h2 className={`text-xl font-bold mb-4 flex items-center ${'text-[#D96E4A]'}`}>
                <InformationCircleIcon className="w-6 h-6 mr-2" />
                Tips!
            </h2>
            <ul className="space-y-3">
              {lesson.tips.map(tip => (
                <li key={tip.id} className="flex items-start">
                  <p className={`text-base leading-relaxed ${'text-[#56524D]'}`}>{tip.text}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-10">
          <h2 className={`text-xl font-bold mb-3 ${'text-neutral-dark'}`}>{lesson.reflection.question}</h2>
          <textarea
            value={reflectionAnswer}
            onChange={(e) => {
                isDirty.current = true;
                setReflectionAnswer(e.target.value);
            }}
            rows={4}
            readOnly={isPreview}
            disabled={isPreview}
            className={`w-full p-4 border rounded-xl shadow-sm focus:outline-none focus:ring-2 text-base ${'border-neutral-light focus:ring-primary'} ${isPreview ? 'bg-neutral-light/40 cursor-not-allowed' : ''}`}
            placeholder={isPreview ? 'Dina reflektioner sparas när du har kursen – och Flexibot svarar på dem.' : 'Dina tankar och reflektioner...'}
            aria-label={lesson.reflection.question}
          />
        </section>
        
        {isPreview ? (
          <div className="mt-10 p-6 rounded-2xl border text-center bg-[#FAF6EF] dark:bg-[#34302C] border-[#F1EAE0] dark:border-[#484440]">
            <p className="text-xl font-bold text-[#56524D] dark:text-[#FAF6EF] mb-2">Det här var lektion 1.</p>
            {previewUnlockText && (
              <p className="text-base text-[#7A756E] dark:text-[#C2BCB4] max-w-md mx-auto leading-relaxed mb-5">
                {previewUnlockText}
              </p>
            )}
            <button
              onClick={onClose}
              className="px-8 py-3 bg-[#D96E4A] hover:bg-[#C05A38] text-white text-lg font-semibold rounded-xl shadow-md active:scale-95 transform interactive-transition"
            >
              Tillbaka till kurserna
            </button>
          </div>
        ) : progress?.isCompleted ? (
           <div className={`mt-10 p-6 border rounded-2xl text-center ${'bg-[#E8EFE9] border-[#7BA05B]/40'}`}>
            <CheckCircleIcon className={`w-12 h-12 mx-auto mb-3 ${'text-[#7BA05B]'}`} />
            <p className={`text-xl font-bold ${'text-[#2B3B2C]'}`}>Bra jobbat, du har slutfört denna lektion!</p>
          </div>
        ) : allFocusPointsCompleted ? (
          <div className="mt-10 text-center">
            <button
              onClick={() => onMarkComplete(lesson.id)}
              className={`px-10 py-4 text-white text-xl font-bold rounded-2xl shadow-lg focus:outline-none focus:ring-4 active:scale-95 transform interactive-transition ${'bg-[#D96E4A] hover:bg-[#C05A38] focus:ring-[#D96E4A]/30'}`}
            >
              <CheckIcon className="w-6 h-6 inline mr-2" /> Markera lektion som slutförd
            </button>
          </div>
        ) : null}

        {!isPreview && <div className="mt-10 pt-8 border-t border-neutral-light/70 text-center">
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
        </div>}
      </article>
    </div>
  );
};

export default LessonDetail;
