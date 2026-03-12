
import React from 'react';
import { CheckCircleIcon } from './icons'; // Or a more celebratory icon like a trophy if available

interface GoalMetModalProps {
  data: {
    date: string; // YYYY-MM-DD
    description: string;
  };
  onClose: () => void;
}

const GoalMetModal: React.FC<GoalMetModalProps> = ({ data, onClose }) => {
  if (!data) return null;

  const formattedDate = new Date(data.date + 'T00:00:00Z').toLocaleDateString('sv-SE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-met-modal-title"
    >
      <div
        className="bg-white p-8 rounded-xl shadow-soft-xl text-center max-w-md w-full animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <CheckCircleIcon className="w-24 h-24 mx-auto mb-5 text-primary animate-scale-in" />
        <h2 id="goal-met-modal-title" className="text-3xl font-bold text-neutral-dark mb-3">
          Mål Uppnått!
        </h2>
        <p className="text-xl text-neutral-dark mb-2">
          Fantastiskt! Du klarade ditt mål för {formattedDate}!
        </p>
        {data.description && (
            <p className="text-2xl font-semibold text-accent mb-6">
                {data.description} 🔥
            </p>
        )}
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform"
        >
          Fortsätt så!
        </button>
      </div>
    </div>
  );
};

export default GoalMetModal;
