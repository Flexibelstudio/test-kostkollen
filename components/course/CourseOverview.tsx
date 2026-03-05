
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
}

const CourseOverview: React.FC<CourseOverviewProps> = ({ lessons, userProgress, onSelectLesson, currentStreak, courseId }) => {
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
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center shadow-sm">
                 <CourseIcon className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-dark">{course?.title}</h1>
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
          <div className="text-center py-12 bg-white rounded-3xl shadow-soft-lg border border-neutral-light">
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
                    className="w-full text-left bg-gray-50/80 p-6 rounded-3xl border border-neutral-light/60 relative overflow-hidden group select-none"
                    aria-label={`${lesson.title} (låst)`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-grow z-10 opacity-60">
                         <div className="flex items-center mb-2">
                          <LockClosedIcon className="w-5 h-5 text-neutral mr-2.5" />
                          <h2 className="text-xl font-bold text-neutral-dark">{lesson.title}</h2>
                        </div>
                        <p className="text-base text-neutral leading-relaxed">{lesson.introduction}</p>
                      </div>
                      
                      <div className="flex-shrink-0 z-10 bg-white/50 px-3 py-1.5 rounded-lg border border-neutral-light/50 self-start sm:self-center">
                          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
                            Låst
                          </p>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-200/60 opacity-80">
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
                  className="w-full text-left bg-white p-6 rounded-3xl shadow-soft-lg border border-neutral-light hover:shadow-soft-xl hover:scale-[1.01] hover:border-primary/30 transition-all duration-300 group relative overflow-hidden"
                  aria-label={`Gå till ${lesson.title}`}
                >
                  <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-grow">
                       <div className="flex items-center mb-2">
                        <h2 className="text-xl font-bold text-neutral-dark group-hover:text-primary transition-colors">{lesson.title}</h2>
                        {isLessonCompleted && <CheckCircleIcon className="w-6 h-6 text-green-500 ml-2 animate-scale-in" />}
                      </div>
                      <p className="text-base text-neutral leading-relaxed line-clamp-2">{lesson.introduction}</p>
                    </div>
                    
                    <div className="flex-shrink-0 self-start sm:self-center">
                        <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shadow-sm">
                             <ArrowRightIcon className="w-5 h-5" />
                        </div>
                    </div>
                  </div>

                  {totalFocusPoints > 0 && !isLessonCompleted && (
                      <div className="relative z-10 mt-5">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Framsteg</span>
                            <span className="text-xs font-bold text-primary">{Math.round(progressPercentage)}%</span>
                        </div>
                        <div className="w-full bg-neutral-light rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
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
