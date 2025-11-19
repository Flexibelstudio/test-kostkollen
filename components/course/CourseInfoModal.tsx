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
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light max-h-[90vh] overflow-y-auto custom-scrollbar w-full max-w-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <course.Icon className="w-8 h-8 text-primary mr-3" />
            <h2 id="course-info-modal-title" className="text-2xl sm:text-3xl font-bold text-neutral-dark">
              Om {course.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 active:scale-90 transform transition-transform"
            aria-label="Stäng informationsrutan"
          >
            <XMarkIcon className="w-7 h-7" />
          </button>
        </div>

        <div className="space-y-6 text-base text-neutral-dark">
          <p className="italic">{course.longDescription}</p>

          <div className="p-4 bg-primary-100/50 rounded-lg border border-primary-200/70">
            <h3 className="font-semibold text-lg text-primary-darker mb-2">Vad du får:</h3>
            <ul className="list-disc list-inside space-y-1">
                {course.whatYouGet.map((point, index) => <li key={index}>{point}</li>)}
            </ul>
          </div>
          
          {hasReviews && (
            <div className="p-4 bg-secondary-100/50 rounded-lg border border-secondary-200/70">
                <h3 className="font-semibold text-lg text-secondary-darker mb-3 text-center">Vad våra medlemmar säger:</h3>
                <div className="relative overflow-hidden min-h-[220px] flex items-center">
                    <div className="flex transition-transform duration-300 ease-in-out w-full" style={{ transform: `translateX(-${currentReviewIndex * 100}%)` }}>
                        {course.reviews!.map((review, index) => (
                            <div key={index} className="w-full flex-shrink-0 px-4 space-y-4 text-left">
                                <h4 className="text-xl font-semibold text-neutral-dark flex items-center gap-2">
                                    <span className="text-yellow-400 text-2xl">⭐</span>
                                    <span>"{review.quote}"</span>
                                </h4>
                                <p className="text-base text-neutral-dark italic">
                                    {review.fullText}
                                </p>
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center mr-2">
                                        <UserCircleIcon className="w-5 h-5 text-primary"/>
                                    </div>
                                    <p className="font-semibold text-neutral-dark">- {review.author}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                 <div className="flex items-center justify-center mt-4">
                    <button onClick={prevReview} className="p-2 rounded-full hover:bg-secondary-200/50" aria-label="Föregående recension"><ArrowLeftIcon className="w-5 h-5"/></button>
                    <div className="flex gap-2 mx-4">
                        {course.reviews!.map((_, index) => (
                            <button key={index} onClick={() => setCurrentReviewIndex(index)} className={`w-2.5 h-2.5 rounded-full transition-colors ${currentReviewIndex === index ? 'bg-secondary' : 'bg-secondary-200/60'}`}></button>
                        ))}
                    </div>
                    <button onClick={nextReview} className="p-2 rounded-full hover:bg-secondary-200/50" aria-label="Nästa recension"><ArrowRightIcon className="w-5 h-5"/></button>
                </div>
            </div>
          )}

          <div className="p-4 bg-neutral-light/60 rounded-lg">
            <h3 className="font-semibold text-lg text-neutral-dark mb-2">Hur det fungerar:</h3>
            <p>{course.howItWorks}</p>
          </div>
          
          <div className="p-4 bg-neutral-light/60 rounded-lg">
            <h3 className="font-semibold text-lg text-neutral-dark mb-2">För vem passar kursen?</h3>
            <p>{course.forWhom}</p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-light/70 flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-primary text-white text-base font-medium rounded-lg shadow-md hover:bg-primary-darker active:scale-95 transform"
            >
              Stäng
            </button>
        </div>
      </div>
    </div>
  );
};

export default CourseInfoModal;