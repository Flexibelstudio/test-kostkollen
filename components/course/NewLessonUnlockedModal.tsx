
import React from 'react';
import { BookOpenIcon } from '../icons'; // Using StarIcon for more celebration

interface NewLessonUnlockedModalProps {
  lessonTitle: string;
  onClose: () => void;
}

const NewLessonUnlockedModal: React.FC<NewLessonUnlockedModalProps> = ({ lessonTitle, onClose }) => {
  if (!lessonTitle) return null;

  return (
    <div 
        className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-fade-in"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-lesson-modal-title"
    >
      <div 
        className="bg-white p-8 rounded-xl shadow-soft-xl text-center max-w-md w-full animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-24 h-24 mx-auto mb-5">
            <BookOpenIcon className="w-24 h-24 text-primary opacity-50" />
            <span className="text-7xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" role="img" aria-hidden="true">📌</span>
        </div>
        <h2 id="new-lesson-modal-title" className="text-3xl font-bold text-neutral-dark mb-3">Ny Lektion Upplåst!</h2>
        <p className="text-xl text-neutral-dark mb-2">
          Starkt jobbat! Du har låst upp:
        </p>
        <p className="text-2xl font-semibold text-primary mb-6">
          {lessonTitle}
        </p>
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform"
        >
          Utforska Lektionen!
        </button>
      </div>
    </div>
  );
};

export default NewLessonUnlockedModal;