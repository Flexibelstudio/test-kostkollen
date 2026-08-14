
import React, { useState } from 'react';
import { CourseLesson, UserCourseProgress } from '../../types';
import { CourseIcon, CheckCircleIcon, ArrowRightIcon, LockClosedIcon, InformationCircleIcon } from '../icons';
import CourseInfoModal from './CourseInfoModal';
import { ALL_COURSES, CourseInfo } from '../CoursesView';

interface CourseOverviewProps {
  lessons: CourseLesson[];
  userProgress: UserCourseProgress;
  onSelectLesson: (lessonId: string) => void;
  currentStreak: number;
  courseId: CourseInfo['id'];
  isBootcamp?: boolean;
}

const CourseOverview: React.FC<CourseOverviewProps> = ({ lessons, userProgress, onSelectLesson, currentStreak, courseId, isBootcamp }) => {
  const [showCourseInfoModal, setShowCourseInfoModal] = useState(false);
  
  const course = ALL_COURSES.find(c => c.id === courseId);

  let lastUnlockedIndex = -1;
  for (let i = lessons.length - 1; i >= 0; i--) {
    if (userProgress[lessons[i].id]?.unlockedAt) {
      lastUnlockedIndex = i;
      break;
    }
  }

  // För tidsbaserad logik (Klimakteriet)
  const firstLessonProg = lessons.length > 0 ? userProgress[lessons[0].id] : null;
  const activatedAt = firstMkLessonProg_Helper_ActivatedAt(firstLessonProg);

  function firstMkLessonProg_Helper_ActivatedAt(prog: any) {
      return prog?.unlockedAt || null;
  }

  return (
    <>
      <div className="animate-fade-in pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${isBootcamp ? 'bg-[#3A4B3C] text-primary' : 'bg-primary-100 text-primary'}`}>
                 <CourseIcon className="w-6 h-6" />
            </div>
            <h1 className={`text-2xl sm:text-3xl font-extrabold ${isBootcamp ? 'text-neutral-dark dark:text-white' : 'text-neutral-dark'}`}>{course?.title}</h1>
          </div>
          <button
            onClick={() => setShowCourseInfoModal(true)}
            className="p-3 text-neutral hover:text-primary hover:bg-primary-50 rounded-full active:scale-95 transition-all"
            aria-label="Information om kursen"
            title="Information om kursen"
          >
            <InformationCircleIcon className="w-7 h-7" />
          </button>
        </div>
        
        {lessons.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-neutral-darker rounded-3xl shadow-soft-lg border border-neutral-light">
             <p className="text-neutral text-lg">Inga lektioner tillgängliga just nu.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {lessons.map((lesson, index) => {
              const progress = userProgress[lesson.id];
              const isUnlocked = !!userProgress[lesson.id]?.unlockedAt;
              const isLessonCompleted = progress?.isCompleted || false;
              
              if (!isUnlocked) {
                const isNextLockedLesson = lastUnlockedIndex !== -1 ? index === lastUnlockedIndex + 1 : index === 0;

                let unlockMessage = "";
                let showStreakFlames = false;
                let progressFlames = 0;

                if (courseId === 'praktisk-viktkontroll') {
                    unlockMessage = "Låses upp efter en ny 7-dagars streak!";
                    if (isNextLockedLesson) {
                        showStreakFlames = true;
                        const lastUnlockedProgress = lastUnlockedIndex > -1 ? userProgress[lessons[lastUnlockedIndex].id] : null;
                        const streakAtUnlock = lastUnlockedProgress?.streakAtUnlock ?? 0;
                        if (currentStreak >= streakAtUnlock) {
                            progressFlames = currentStreak - streakAtUnlock;
                        } else {
                            progressFlames = currentStreak;
                        }
                        progressFlames = Math.max(0, Math.min(7, progressFlames));
                    }
                } else { // maxa-klimakteriet (Tidsbaserad)
                    if (activatedAt) {
                        const nextUnlockDate = new Date(activatedAt + (index * 7 * 24 * 60 * 60 * 1000));
                        const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
                        const dateStr = nextUnlockDate.toLocaleDateString('sv-SE', options);
                        unlockMessage = `Låses upp på ${dateStr}.`;
                    } else {
                        unlockMessage = "Låses upp veckovis efter start.";
                    }
                }

                return (
                  <div
                    key={lesson.id}
                    className={`w-full text-left p-6 rounded-3xl border relative overflow-hidden group select-none ${isBootcamp ? 'bg-neutral-light/50 dark:bg-[#1A2B1C] border-neutral-light dark:border-[#3A4B3C]' : 'bg-gray-50/80 dark:bg-black border-neutral-light/60 dark:border-neutral-dark/60'}`}
                    aria-label={`${lesson.title} (låst)`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-grow z-10 opacity-60">
                         <div className="flex items-center mb-2">
                          <LockClosedIcon className="w-5 h-5 text-neutral mr-2.5" />
                          <h2 className={`text-xl font-bold ${isBootcamp ? 'text-neutral-dark dark:text-white' : 'text-neutral-dark dark:text-white'}`}>{lesson.title}</h2>
                        </div>
                        <p className="text-base text-neutral leading-relaxed">{lesson.introduction}</p>
                      </div>
                      
                      <div className={`flex-shrink-0 z-10 px-3 py-1.5 rounded-lg border self-start sm:self-center ${isBootcamp ? 'bg-white/50 dark:bg-[#2A3B2C] border-neutral-light dark:border-[#4A5B4C]' : 'bg-white/50 dark:bg-neutral-dark/50 border-neutral-light/50'}`}>
                          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
                            Låst
                          </p>
                      </div>
                    </div>
                    
                    <div className={`mt-4 pt-4 border-t opacity-80 ${isBootcamp ? 'border-neutral-light dark:border-[#3A4B3C]' : 'border-gray-200/60 dark:border-neutral-dark/60'}`}>
                         <p className="text-sm font-medium text-accent flex items-center gap-2">
                            {unlockMessage}
                         </p>
                         {showStreakFlames && (
                            <div className="mt-2 flex gap-1">
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <span 
                                        key={i} 
                                        className={`text-lg transition-all ${i < progressFlames ? 'opacity-100 scale-110' : 'opacity-20 grayscale'}`}
                                        title={`${i + 1} av 7 dagar`}
                                    >
                                        🔥
                                    </span>
                                ))}
                            </div>
                         )}
                    </div>
                  </div>
                );
              }

              const completedFocusPoints = progress?.completedFocusPoints?.length || 0;
              const totalFocusPoints = lesson.focusPoints.length;
              const progressPercentage = totalFocusPoints > 0 ? (completedFocusPoints / totalFocusPoints) * 100 : 0;

              return (
                <button
                  key={lesson.id}
                  onClick={() => onSelectLesson(lesson.id)}
                  className={`w-full text-left p-6 rounded-3xl shadow-soft-lg border hover:shadow-soft-xl hover:scale-[1.01] transition-all duration-300 group relative overflow-hidden ${isBootcamp ? 'bg-white dark:bg-[#2A3B2C] border-neutral-light dark:border-[#4A5B4C] hover:border-primary/30' : 'bg-white dark:bg-neutral-darker border-neutral-light hover:border-primary/30'}`}
                  aria-label={`Gå till ${lesson.title}`}
                >
                  <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-grow">
                       <div className="flex items-center mb-2">
                        <h2 className={`text-xl font-bold transition-colors ${isBootcamp ? 'text-neutral-dark dark:text-white group-hover:text-primary' : 'text-neutral-dark group-hover:text-primary'}`}>{lesson.title}</h2>
                        {isLessonCompleted && <CheckCircleIcon className="w-6 h-6 text-[#84A98C] ml-2 animate-scale-in" />}
                      </div>
                      <p className={`text-base leading-relaxed line-clamp-2 ${isBootcamp ? 'text-neutral dark:text-neutral-300' : 'text-neutral'}`}>{lesson.introduction}</p>
                    </div>
                    
                    <div className="flex-shrink-0 self-start sm:self-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm ${isBootcamp ? 'bg-[#F6E2D9] text-primary group-hover:bg-primary group-hover:text-white' : 'bg-primary-50 text-primary group-hover:bg-primary group-hover:text-white'}`}>
                             <ArrowRightIcon className="w-5 h-5" />
                        </div>
                    </div>
                  </div>

                  {totalFocusPoints > 0 && !isLessonCompleted && (
                      <div className="relative z-10 mt-5">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Framsteg</span>
                            <span className={`text-xs font-bold ${isBootcamp ? 'text-primary' : 'text-primary'}`}>{Math.round(progressPercentage)}%</span>
                        </div>
                        <div className={`w-full rounded-full h-2 overflow-hidden ${isBootcamp ? 'bg-neutral-light dark:bg-[#1A2B1C]' : 'bg-neutral-light'}`}>
                            <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${isBootcamp ? 'bg-primary' : 'bg-primary'}`}
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                        </div>
                      </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {course && <CourseInfoModal show={showCourseInfoModal} onClose={() => setShowCourseInfoModal(false)} course={course} />}
    </>
  );
};

export default CourseOverview;
