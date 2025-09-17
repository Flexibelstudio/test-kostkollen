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

  return (
    <>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <CourseIcon className="w-8 h-8 text-primary mr-3 flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-dark">Kurs: {course?.title}</h1>
          </div>
          <button
            onClick={() => setShowCourseInfoModal(true)}
            className="p-2 text-primary hover:text-primary-darker hover:bg-primary-100 rounded-full active:scale-95 interactive-transition"
            aria-label="Information om kursen"
            title="Information om kursen"
          >
            <InformationCircleIcon className="w-7 h-7 sm:w-8 sm:h-8" />
          </button>
        </div>
        
        {lessons.length === 0 ? (
          <p className="text-neutral text-center">Inga lektioner tillgängliga just nu.</p>
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
                } else { // maxa-klimakteriet
                    unlockMessage = "Låses upp när föregående lektion är klar.";
                }

                return (
                  <div
                    key={lesson.id}
                    className="w-full text-left bg-neutral-light p-5 rounded-xl shadow-md border border-gray-300 opacity-70"
                    aria-label={`${lesson.title} (låst)`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div className="flex-grow mb-3 sm:mb-0">
                         <div className="flex items-center mb-1">
                          <LockClosedIcon className="w-5 h-5 text-neutral mr-2 flex-shrink-0" />
                          <h2 className="text-xl font-semibold text-neutral">{lesson.title}</h2>
                        </div>
                        <p className="text-sm text-neutral-dark">{lesson.introduction}</p>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0 ml-0 sm:ml-4">
                          <p className="text-sm font-semibold text-accent text-right">
                            {unlockMessage}
                          </p>
                      </div>
                    </div>
                     {showStreakFlames && (
                        <div className="mt-3 pt-3 border-t border-gray-400/50">
                            <h4 className="text-sm font-semibold text-neutral-dark text-center mb-1">Dina framsteg:</h4>
                            <div className="flex justify-center items-center gap-1">
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <span 
                                        key={i} 
                                        className="text-2xl transition-all"
                                        style={{ 
                                            opacity: i < progressFlames ? 1 : 0.3, 
                                            filter: i < progressFlames ? 'none' : 'grayscale(1)',
                                            transform: i < progressFlames ? 'scale(1.1)' : 'scale(1)',
                                        }}
                                        title={`${i + 1} av 7 dagar`}
                                    >
                                        🔥
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
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
                  className="w-full text-left bg-white p-5 rounded-xl shadow-soft-lg border border-neutral-light focus:outline-none group interactive-transition hover:shadow-soft-xl hover:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-95"
                  aria-label={`Gå till ${lesson.title}`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div className="flex-grow mb-3 sm:mb-0">
                       <div className="flex items-center mb-1">
                        <h2 className="text-xl font-semibold text-primary-darker">{lesson.title}</h2>
                      </div>
                      <p className="text-sm text-neutral-dark truncate-2-lines">{lesson.introduction}</p>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0 ml-0 sm:ml-4">
                      {isLessonCompleted ? (
                        <CheckCircleIcon className="w-7 h-7 text-green-500" />
                      ) : totalFocusPoints > 0 ? (
                          <div className="text-sm text-neutral">
                            {completedFocusPoints}/{totalFocusPoints}
                          </div>
                      ) : null}
                      <ArrowRightIcon className="w-6 h-6 text-primary opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-transform duration-150" />
                    </div>
                  </div>
                  {totalFocusPoints > 0 && !isLessonCompleted && (
                      <>
                        <div className="mt-3">
                            <div className="w-full bg-neutral-light rounded-full h-2.5">
                            <div
                                className="bg-accent h-2.5 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                            </div>
                        </div>
                        <p className="text-xs text-accent mt-1.5 font-medium">
                            {completedFocusPoints > 0 ? `Fortsätt så, du är på god väg!` : `Dyk in och börja med fokusområdena!`}
                        </p>
                      </>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <CourseInfoModal show={showCourseInfoModal} onClose={() => setShowCourseInfoModal(false)} courseId={courseId} />
    </>
  );
};

export default CourseOverview;
