
import React, { useState } from 'react';
import { InformationCircleIcon, XMarkIcon, ArrowLeftIcon, ArrowRightIcon, UserCircleIcon } from '../icons';
import { CourseInfo } from '../CoursesView';

interface CourseInfoModalProps {
  onClose: () => void;
  show: boolean;
  course: CourseInfo;
}

const CourseInfoModal: React.FC<CourseInfoModalProps> = ({ onClose, show, course }) => {
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  if (!show || !course) {
    return null;
  }

  const hasReviews = course.reviews && course.reviews.length > 0;

  const nextReview = () => {
    if (hasReviews) {
      setCurrentReviewIndex((prevIndex) => (prevIndex + 1) % course.reviews!.length);
    }
  };

  const prevReview = () => {
    if (hasReviews) {
      setCurrentReviewIndex((prevIndex) => (prevIndex - 1 + course.reviews!.length) % course.reviews!.length);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-info-modal-title"
    >
      <div
        className="bg-white dark:bg-neutral-darker p-6 sm:p-8 rounded-3xl shadow-soft-xl border border-neutral-light dark:border-neutral-dark max-h-[90vh] overflow-y-auto custom-scrollbar w-full max-w-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mr-4 shadow-sm">
                 <course.Icon className="w-6 h-6 text-primary" />
            </div>
            <h2 id="course-info-modal-title" className="text-2xl sm:text-3xl font-extrabold text-neutral-dark dark:text-white">
              Om {course.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-90 transform transition-transform"
            aria-label="Stäng informationsrutan"
          >
            <XMarkIcon className="w-7 h-7" />
          </button>
        </div>

        <div className="space-y-6 text-base text-neutral-dark dark:text-neutral-200 leading-relaxed">
          {course.id === 'bootcamp' && (
            <div className="w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-neutral-dark bg-black relative aspect-video mb-6">
              <video 
                controls 
                preload="metadata"
                className="w-full h-full object-cover"
              >
                <source src="/general-briefing.mp4" type="video/mp4" />
                Din webbläsare stöder inte videouppspelning.
              </video>
              <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">
                LIVE FEED • HÖGKVARTERET
              </div>
            </div>
          )}

          <p className="italic text-lg text-neutral-dark/80 dark:text-neutral-300">{course.longDescription}</p>

          <div className="p-6 bg-primary-100/50 dark:bg-primary-900/20 rounded-2xl border border-primary-200/70 dark:border-primary-800/50">
            <h3 className="font-bold text-lg text-primary-darker dark:text-primary-light mb-3">Vad du får:</h3>
            <ul className="space-y-2">
                {course.whatYouGet.map((point, index) => (
                    <li key={index} className="flex items-start">
                        <span className="mr-2 text-primary font-bold">✓</span>
                        {point}
                    </li>
                ))}
            </ul>
          </div>
          
          {hasReviews && (
            <div className="p-6 bg-secondary-100/50 dark:bg-secondary-900/20 rounded-2xl border border-secondary-200/70 dark:border-secondary-800/50">
                <h3 className="font-bold text-lg text-secondary-darker dark:text-secondary-light mb-4 text-center">Vad våra medlemmar säger:</h3>
                <div className="relative overflow-hidden min-h-[220px] flex items-center">
                    <div className="flex transition-transform duration-300 ease-in-out w-full" style={{ transform: `translateX(-${currentReviewIndex * 100}%)` }}>
                        {course.reviews!.map((review, index) => (
                            <div key={index} className="w-full flex-shrink-0 px-4 space-y-4 text-left">
                                <h4 className="text-xl font-bold text-neutral-dark dark:text-white flex items-center gap-2">
                                    <span className="text-yellow-400 text-2xl">⭐</span>
                                    <span>"{review.quote}"</span>
                                </h4>
                                <p className="text-base text-neutral-dark dark:text-neutral-300 italic leading-relaxed">
                                    {review.fullText}
                                </p>
                                <div className="flex items-center mt-2">
                                    <div className="w-10 h-10 rounded-full bg-white dark:bg-neutral-dark flex items-center justify-center mr-3 shadow-sm">
                                        <UserCircleIcon className="w-6 h-6 text-primary"/>
                                    </div>
                                    <p className="font-bold text-neutral-dark dark:text-white">{review.author}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                 <div className="flex items-center justify-center mt-6">
                    <button onClick={prevReview} className="p-2 rounded-full hover:bg-secondary-200/50 active:scale-95 transition-all" aria-label="Föregående recension"><ArrowLeftIcon className="w-6 h-6 text-secondary-darker"/></button>
                    <div className="flex gap-2 mx-4">
                        {course.reviews!.map((_, index) => (
                            <button key={index} onClick={() => setCurrentReviewIndex(index)} className={`w-2.5 h-2.5 rounded-full transition-colors ${currentReviewIndex === index ? 'bg-secondary' : 'bg-secondary-200/60'}`}></button>
                        ))}
                    </div>
                    <button onClick={nextReview} className="p-2 rounded-full hover:bg-secondary-200/50 active:scale-95 transition-all" aria-label="Nästa recension"><ArrowRightIcon className="w-6 h-6 text-secondary-darker"/></button>
                </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-neutral-light/60 dark:bg-neutral-dark/60 rounded-2xl">
                <h3 className="font-bold text-lg text-neutral-dark dark:text-white mb-2">Hur det fungerar:</h3>
                <p className="text-neutral dark:text-neutral-400">{course.howItWorks}</p>
              </div>
              
              <div className="p-5 bg-neutral-light/60 dark:bg-neutral-dark/60 rounded-2xl">
                <h3 className="font-bold text-lg text-neutral-dark dark:text-white mb-2">För vem passar kursen?</h3>
                <p className="text-neutral dark:text-neutral-400">{course.forWhom}</p>
              </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-light/70 dark:border-neutral-dark/70 flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-8 py-3 bg-primary text-white text-lg font-bold rounded-2xl shadow-md hover:bg-primary-darker active:scale-95 transform transition-all"
            >
              Stäng
            </button>
        </div>
      </div>
    </div>
  );
};

export default CourseInfoModal;
