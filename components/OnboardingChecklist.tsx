import React from 'react';
import { OnboardingChecklistState } from '../types';
import { XMarkIcon } from './icons';

interface OnboardingChecklistProps {
  state: OnboardingChecklistState;
  onDismiss: () => void;
  onNavigate: (view: 'journey' | 'community') => void;
  onTriggerLog: () => void;
  onScrollToWater: () => void;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  state,
  onDismiss,
  onNavigate,
  onTriggerLog,
  onScrollToWater,
}) => {
  if (!state) return null;

  const allComplete = Object.values(state.items).every(Boolean);

  const items = [
    { key: 'profileSet', text: 'Sätt dina personliga mål', completed: true, action: () => {} },
    { key: 'mealLogged', text: 'Logga din första måltid', completed: state.items.mealLogged, action: onTriggerLog },
    { key: 'waterLogged', text: 'Logga ditt vattenintag för dagen', completed: state.items.waterLogged, action: onScrollToWater },
    { key: 'journeyViewed', text: 'Utforska din "Min resa"-sida', completed: state.items.journeyViewed, action: () => onNavigate('journey') },
    { key: 'communityViewed', text: 'Hitta och lägg till en peppkompis', completed: state.items.communityViewed, action: () => onNavigate('community') },
  ];

  return (
    <div className="bg-white p-5 sm:p-6 rounded-xl shadow-soft-lg border border-neutral-light mb-6 animate-fade-slide-in relative">
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1.5 text-neutral hover:text-red-500 rounded-full hover:bg-red-100/70 interactive-transition"
        aria-label="Dölj checklista"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
      <h3 className="text-xl font-semibold text-neutral-dark mb-3">Kom igång-checklista</h3>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item.key}>
            <button
              onClick={item.action}
              disabled={item.completed}
              className="w-full text-left flex items-center p-2 rounded-md hover:bg-neutral-light/60 disabled:opacity-70 disabled:cursor-default disabled:hover:bg-transparent interactive-transition"
            >
              <span className="text-xl mr-3">{item.completed ? '✅' : '⬜️'}</span>
              <span className={`text-base ${item.completed ? 'text-neutral line-through' : 'text-neutral-dark'}`}>
                {item.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {allComplete && (
        <p className="text-center text-primary font-semibold mt-4 animate-fade-in">
          Snyggt! Du har koll på grunderna!
        </p>
      )}
    </div>
  );
};
