

import React, { useState, useEffect } from 'react';
import { CourseLesson, UserLessonProgress, UserProfileData, WeightLogEntry, PastDaySummary, AIDataForLessonIntro } from '../../types';
import { ArrowLeftIcon, CheckCircleIcon, CheckIcon, InformationCircleIcon, SparklesIcon, BookOpenIcon, PlusCircleIcon, ChartLineIcon, XMarkIcon } from '../icons';
import { getAIPersonalizedLessonIntro } from '../../services/geminiService';

interface LessonDetailProps {
  lesson: CourseLesson;
  progress: UserLessonProgress | undefined;
  onToggleFocusPoint: (lessonId: string, focusPointId: string) => void;
  onSaveReflection: (lessonId: string, answer: string) => Promise<void>;
  onSaveWhyAnswer: (lessonId: string, answer: string) => Promise<void>;
  onSaveSmartGoalAnswer: (lessonId: string, answer: string) => Promise<void>;
  onMarkComplete: (lessonId: string) => void;
  onOpenSpeedDial: () => void;
  onNavigateToJourney: (tab: 'weight' | 'calendar' | 'profile' | 'achievements') => void;
  userProfile: UserProfileData;
  weightLogs: WeightLogEntry[];
  pastDaysSummary: PastDaySummary[];
  onOpenLogWeightModal: () => void;
  onClose: () => void;
}

const LessonDetail: React.FC<LessonDetailProps> = ({
  lesson,
  progress,
  onToggleFocusPoint,
  onSaveReflection,
  onSaveWhyAnswer,
  onSaveSmartGoalAnswer,
  onMarkComplete,
  onOpenSpeedDial,
  onNavigateToJourney,
  userProfile,
  weightLogs,
  pastDaysSummary,
  onOpenLogWeightModal,
  onClose
}) => {
  const [reflectionAnswer, setReflectionAnswer] = useState(progress?.reflectionAnswer || '');
  const [whyAnswer, setWhyAnswer] = useState(progress?.whyAnswer || '');
  const [smartGoalAnswer, setSmartGoalAnswer] = useState(progress?.smartGoalAnswer || '');
  
  const [aiIntro, setAiIntro] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);


  useEffect(() => {
    setReflectionAnswer(progress?.reflectionAnswer || '');
    setWhyAnswer(progress?.whyAnswer || '');
    setSmartGoalAnswer(progress?.smartGoalAnswer || '');
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
          setAiIntro(null); // Fallback to no AI intro on error
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
        const promises: Promise<void>[] = [];
        
        if (reflectionAnswer.trim() !== (progress?.reflectionAnswer || '')) {
            promises.push(onSaveReflection(lesson.id, reflectionAnswer));
        }

        if (lesson.specialAction?.type === 'writeWhy' && onSaveWhyAnswer) {
            if (whyAnswer.trim() !== (progress?.whyAnswer || '')) {
                promises.push(onSaveWhyAnswer(lesson.id, whyAnswer));
            }
        }
        
        if (lesson.specialAction?.type === 'smartGoal' && onSaveSmartGoalAnswer) {
             if (smartGoalAnswer.trim() !== (progress?.smartGoalAnswer || '')) {
                promises.push(onSaveSmartGoalAnswer(lesson.id, smartGoalAnswer));
            }
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }

        onClose();

    } catch (error) {
        console.error("Failed to save lesson details:", error);
        // Error toast is handled by parent App.tsx
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
    <div className="animate-fade-in">
      <article className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-lg border border-neutral-light">
        <header className="mb-6 pb-4 border-b border-neutral-light/70">
            <div className="flex justify-between items-start mb-2">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 text-neutral hover:text-primary rounded-md hover:bg-primary-100 active:scale-90"
                    aria-label="Tillbaka till kursöversikt"
                >
                    <ArrowLeftIcon className="w-7 h-7" />
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold text-neutral-dark flex-1 text-center pr-4">{lesson.title}</h1>
            </div>
           {isLoadingAi && (
            <div className="p-3 bg-primary-100/60 rounded-lg text-sm text-primary-darker flex items-center">
              <SparklesIcon className="w-5 h-5 mr-2 animate-pulse" />
              Flexibot skräddarsyr din lektion...
            </div>
          )}
          {aiIntro && !isLoadingAi && (
            <div className="p-3 mb-2 bg-primary-100/60 rounded-lg border border-primary-200/80">
                <p className="text-base text-neutral-dark italic">
                    <SparklesIcon className="w-5 h-5 mr-1.5 text-primary inline-block" />
                    {aiIntro}
                </p>
            </div>
          )}
          <p className="text-base text-neutral-dark mt-2 text-center">{lesson.introduction}</p>
        </header>

        {lesson.specialAction && (
          <section className="mb-8 p-5 bg-primary-100/70 rounded-lg border border-primary-200">
            <h2 className="text-xl font-semibold text-primary-darker mb-2">{lesson.specialAction.prompt}</h2>
            {lesson.specialAction.description && <p className="text-sm text-neutral-dark mb-3">{lesson.specialAction.description}</p>}
            
                 <textarea
                  value={lesson.specialAction.type === 'writeWhy' ? whyAnswer : smartGoalAnswer} 
                  onChange={(e) => {
                      if (lesson.specialAction?.type === 'writeWhy') {
                          setWhyAnswer(e.target.value);
                      } else {
                          setSmartGoalAnswer(e.target.value);
                      }
                  }}
                  rows={5}
                  className="w-full p-3 border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-base"
                  placeholder="Skriv dina tankar här..."
                  aria-label={lesson.specialAction.prompt}
                />
          </section>
        )}


        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-neutral-dark mb-4">Fokus denna lektion:</h2>
          <ul className="space-y-3">
            {lesson.focusPoints.map(point => (
              <li key={point.id} className="space-y-2">
                <button
                  onClick={() => onToggleFocusPoint(lesson.id, point.id)}
                  className={`flex items-center w-full p-3 rounded-md border interactive-transition active:scale-[0.98]
                    ${progress?.completedFocusPoints?.includes(point.id)
                      ? 'bg-primary-100 border-primary text-primary-darker hover:bg-primary-200'
                      : 'bg-neutral-light/70 border-neutral-light hover:bg-gray-200 text-neutral-dark'
                    }`}
                  aria-pressed={progress?.completedFocusPoints?.includes(point.id)}
                >
                  <div className="flex-shrink-0 w-6 h-6 mr-3">
                    {progress?.completedFocusPoints?.includes(point.id) ? (
                      <CheckCircleIcon className="w-6 h-6 text-primary" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-neutral rounded-full group-hover:border-primary-darker transition-colors"></div>
                    )}
                  </div>
                  <span className="flex-grow text-left text-base">{point.text}</span>
                </button>
                {point.cta && (
                    <div className="pl-9">
                        <button 
                            onClick={() => handleCtaClick(point.cta!.action)}
                            className="px-4 py-1.5 text-sm font-semibold text-white bg-secondary hover:bg-secondary-darker rounded-md shadow-sm active:scale-95 transform interactive-transition"
                        >
                            {point.cta.action === 'openSpeedDial' && <PlusCircleIcon className="w-4 h-4 mr-1.5 inline"/>}
                            {point.cta.action === 'navigateToJourneyCalendar' && <BookOpenIcon className="w-4 h-4 mr-1.5 inline"/>}
                            {point.cta.action === 'navigateToJourneyGoals' && <ChartLineIcon className="w-4 h-4 mr-1.5 inline"/>}
                            {point.cta.action === 'openLogWeightModal' && <PlusCircleIcon className="w-4 h-4 mr-1.5 inline"/>}
                            {point.cta.label}
                        </button>
                    </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {lesson.tips && lesson.tips.length > 0 && (
          <section className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-lg">
            <h2 className="text-xl font-semibold text-amber-700 mb-3">Tips!</h2>
            <ul className="space-y-2">
              {lesson.tips.map(tip => (
                <li key={tip.id} className="flex items-start">
                  <InformationCircleIcon className="w-5 h-5 text-amber-600 mr-2.5 mt-0.5 flex-shrink-0" />
                  <p className="text-base text-amber-800">{tip.text}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-neutral-dark mb-3">{lesson.reflection.question}</h2>
          <textarea
            value={reflectionAnswer}
            onChange={(e) => setReflectionAnswer(e.target.value)}
            rows={4}
            className="w-full p-3 border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-base"
            placeholder="Dina tankar och reflektioner..."
            aria-label={lesson.reflection.question}
          />
        </section>
        
        {progress?.isCompleted ? (
           <div className="mt-8 p-4 bg-primary-100 border border-primary-200 rounded-lg text-center">
            <CheckCircleIcon className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-lg font-semibold text-primary-darker">Bra jobbat, du har slutfört denna lektion!</p>
          </div>
        ) : allFocusPointsCompleted ? (
          <div className="mt-8 text-center">
            <button
              onClick={() => onMarkComplete(lesson.id)}
              className="px-8 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-95 transform interactive-transition"
            >
              <CheckIcon className="w-5 h-5 inline mr-2" /> Markera lektion som slutförd
            </button>
          </div>
        ) : null}

        <div className="mt-8 pt-6 border-t border-neutral-light/70 text-center">
            <button
                onClick={handleSaveAndClose}
                disabled={isSaving}
                className="w-full sm:w-auto px-8 py-3 bg-secondary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-secondary-darker focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-opacity-50 active:scale-95 transform interactive-transition disabled:opacity-60"
            >
                {isSaving ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mx-auto"></div>
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