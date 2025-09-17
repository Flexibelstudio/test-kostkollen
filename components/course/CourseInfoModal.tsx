import React from 'react';
import { InformationCircleIcon, XMarkIcon } from '../icons';
import { ALL_COURSES, CourseInfo } from '../CoursesView'; // Import from CoursesView

interface CourseInfoModalProps {
  onClose: () => void;
  show: boolean;
  courseId: CourseInfo['id'];
}

const CourseInfoModal: React.FC<CourseInfoModalProps> = ({ onClose, show, courseId }) => {
  if (!show) {
    return null;
  }
  
  const course = ALL_COURSES.find(c => c.id === courseId);
  
  if (!course) return null; // Or show an error

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-info-modal-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light max-h-[90vh] overflow-y-auto custom-scrollbar w-full max-w-lg animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <InformationCircleIcon className="w-8 h-8 text-primary mr-3" />
            <h2 id="course-info-modal-title" className="text-2xl sm:text-3xl font-bold text-neutral-dark">
              Om kursen: {course.title}
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

        <div className="space-y-4 text-base text-neutral-dark">
          <p>
            {course.longDescription}
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-light/70 text-center">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform"
          >
            Jag förstår
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseInfoModal;
