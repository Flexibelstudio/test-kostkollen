import React, { useState } from 'react';
import { CourseLesson, UserCourseProgress } from '../../types';
import { CourseIcon, CheckCircleIcon, ArrowRightIcon, ArrowLeftIcon, LockClosedIcon, InformationCircleIcon, UserCircleIcon } from '../icons';
import CourseInfoModal from './CourseInfoModal'; // Import the new modal

interface CourseOverviewProps {
  lessons: CourseLesson[];
  userProgress: UserCourseProgress;
  onSelectLesson: (lessonId: string) => void;
  isCourseActive: boolean;
  currentStreak: number;
  onExpressCourseInterest: () => void;
  courseInterest?: boolean;
}

const reviews = [
  {
    quote: "Minus 6 kg fett - och en helt ny syn på kost och hälsa!",
    text: "Mitt bästa beslut 2024 var att anmäla mig till Praktisk viktkontroll. Jag fått ett helt nytt sätt att tänka kring kost, hälsa och vanor. Resultatet? Jag har tappat 6 kg fett - och fått verktyg jag kommer bära med mig resten av livet!",
    author: "Elisabeth"
  },
  {
    quote: "5,5 kg mindre fett - och mer energi än på länge!",
    text: "Att delta i Praktisk viktkontroll var den bästa investeringen jag gjorde under 2024. Med praktisk hjälp och tydliga verktyg har jag bytt ut gamla vanor mot nya, hållbara en i taget. Resultatet? 5,5 kg mindre fett, ökad muskelmassa och en kropp som känns pigg och full av energi!",
    author: "Isabelle"
  },
  {
    quote: "Jag känner mig piggare och orkar mer!",
    text: "Jag är jättenöjd med Praktisk viktkontroll, det har gett mig ett helt nytt tänk kring mat och hjälpt mig att planera mina dagar bättre. När jag kombinerade träningen med kostprogrammet märkte jag snabbt skillnad - jag känner mig piggare och har mycket mer energi i vardagen. Jag är supernöjd!",
    author: "Jana"
  }
];

const CourseOverview: React.FC<CourseOverviewProps> = ({ lessons, userProgress, onSelectLesson, isCourseActive, currentStreak, onExpressCourseInterest, courseInterest }) => {
  const [showCourseInfoModal, setShowCourseInfoModal] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  const nextReview = () => {
    setCurrentReviewIndex(prevIndex => (prevIndex + 1) % reviews.length);
  };

  const prevReview = () => {
    setCurrentReviewIndex(prevIndex => (prevIndex - 1 + reviews.length) % reviews.length);
  };

  const goToReview = (index: number) => {
    setCurrentReviewIndex(index);
  };


  return (
    <>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <CourseIcon className="w-8 h-8 text-primary mr-3 flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-dark">Kurs: Praktisk Viktkontroll</h1>
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
        
        {!isCourseActive ? (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-dark text-center mb-6">Vad säger våra medlemmar?</h2>
              <div className="relative w-full max-w-xl mx-auto">
                <div className="overflow-hidden rounded-xl">
                  {/* Carousel Wrapper */}
                  <div
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentReviewIndex * 100}%)` }}
                  >
                    {reviews.map((review, index) => (
                      <div key={index} className="w-full flex-shrink-0 p-1">
                        {/* Card content */}
                        <div className="bg-white p-5 rounded-xl shadow-soft-lg border border-neutral-light flex flex-col justify-center h-full min-h-[260px] sm:min-h-[240px]">
                          <p className="text-lg font-semibold text-neutral-dark mb-4 text-center">⭐ "{review.quote}"</p>
                          <p className="text-neutral-dark italic text-base text-center">{review.text}</p>
                          <div className="flex items-center mt-3 pt-2 border-t border-neutral-light/50">
                            <UserCircleIcon className="w-8 h-8 text-primary mr-3 flex-shrink-0" />
                            <p className="font-semibold text-sm text-neutral">- {review.author}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <button
                  onClick={prevReview}
                  className="absolute top-1/2 -left-3 sm:-left-5 -translate-y-1/2 transform bg-white/70 hover:bg-white rounded-full p-2 shadow-lg interactive-transition z-10"
                  aria-label="Föregående omdöme"
                >
                  <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-dark" />
                </button>
                <button
                  onClick={nextReview}
                  className="absolute top-1/2 -right-3 sm:-right-5 -translate-y-1/2 transform bg-white/70 hover:bg-white rounded-full p-2 shadow-lg interactive-transition z-10"
                  aria-label="Nästa omdöme"
                >
                  <ArrowRightIcon className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-dark" />
                </button>
              </div>
               {/* Dot Indicators */}
              <div className="mt-4 flex justify-center space-x-2">
                {reviews.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToReview(index)}
                    className={`w-3 h-3 rounded-full interactive-transition ${
                      currentReviewIndex === index ? 'bg-primary scale-110' : 'bg-neutral-light hover:bg-primary-lighter'
                    }`}
                    aria-label={`Gå till omdöme ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          
            <div className="text-center bg-white p-6 sm:p-8 rounded-xl shadow-soft-lg border border-neutral-light">
                <div className="w-20 h-20 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                  <CourseIcon className="w-12 h-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-dark mb-3">Lås upp din fulla potential!</h2>
                <p className="text-neutral-dark max-w-lg mx-auto mb-4">
                    Ta din hälsoresa till nästa nivå med vår exklusiva kurs <strong>"Praktisk Viktkontroll"</strong>. Få tillgång till 12 lektioner fyllda med kunskap, praktiska övningar och verktyg för att bygga hållbara vanor.
                </p>
                <p className="text-3xl font-bold text-primary my-4">1995 kr</p>
                <p className="text-sm text-neutral mb-6">(Engångskostnad)</p>

                {courseInterest ? (
                  <div className="mt-4">
                    <button
                      disabled
                      className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3 bg-green-200 text-green-800 font-semibold rounded-lg shadow-sm cursor-not-allowed"
                    >
                      <CheckCircleIcon className="w-5 h-5 mr-2" />
                      Intresse anmält, inväntar coach
                    </button>
                     <p className="text-xs text-neutral mt-2">Din coach kommer att aktivera kursen och återkomma till dig för betalning.</p>
                  </div>
                ) : (
                   <div className="mt-4">
                      <button
                      onClick={onExpressCourseInterest}
                      className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3 bg-primary hover:bg-primary-darker text-white font-semibold rounded-lg shadow-md active:scale-95 transform transition-all"
                      >
                      Ja, jag vill aktivera kursen!
                      </button>
                   </div>
                )}
            </div>
          </>
        ) : lessons.length === 0 ? (
          <p className="text-neutral text-center">Inga lektioner tillgängliga just nu.</p>
        ) : (
          <div className="space-y-4">
            {lessons.map(lesson => {
              const progress = userProgress[lesson.id];
              const isUnlocked = !!userProgress[lesson.id]?.unlockedAt;
              const isLessonCompleted = progress?.isCompleted || false;
              
              if (!isUnlocked) {
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
                      <div className="flex items-center space-x-3 flex-shrink-0 ml-0 sm:ml-4">
                        <p className="text-sm font-semibold text-accent">
                          Låses upp efter en ny 7-dagars streak!
                        </p>
                      </div>
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
      <CourseInfoModal show={showCourseInfoModal} onClose={() => setShowCourseInfoModal(false)} />
    </>
  );
};

export default CourseOverview;