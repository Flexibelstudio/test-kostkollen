import React, { useState } from 'react';
import { OnboardingChecklistState } from '../types';
import { ChevronDownIcon } from './icons';

interface OnboardingChecklistProps {
  state: OnboardingChecklistState;
  onNavigate: (view: 'journey' | 'community') => void;
  onTriggerLog: () => void;
  onScrollToWater: () => void;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  state,
  onNavigate,
  onTriggerLog,
  onScrollToWater,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (!state) return null;

  const allComplete = Object.values(state.items).every(Boolean);
  const completedCount = Object.values(state.items).filter(Boolean).length + 1; // +1 for the pre-checked one
  const totalCount = 5;

  const items = [
    { key: 'profileSet', text: 'Sätt dina personliga mål', completed: true, action: () => {} },
    { key: 'mealLogged', text: 'Logga din första måltid', completed: state.items.mealLogged, action: onTriggerLog },
    { key: 'waterLogged', text: 'Logga ditt vattenintag för dagen', completed: state.items.waterLogged, action: onScrollToWater },
    { key: 'journeyViewed', text: 'Utforska din "Min resa"-sida', completed: state.items.journeyViewed, action: () => onNavigate('journey') },
    { key: 'communityViewed', text: 'Hitta och lägg till en peppkompis', completed: state.items.communityViewed, action: () => onNavigate('community') },
  ];

  return (
    <div className="bg-white p-5 sm:p-6 rounded-xl shadow-soft-lg border border-neutral-light mb-6 animate-fade-slide-in relative transition-all duration-300">
      
      {/* Clickable Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center text-left"
        aria-expanded={isExpanded}
        aria-controls="onboarding-checklist-content"
      >
        <h3 className="text-xl font-semibold text-neutral-dark">Kom igång-checklista</h3>
        <div className="flex items-center">
            <span className="text-sm font-medium text-neutral mr-2">{completedCount}/{totalCount}</span>
            <ChevronDownIcon className={`w-6 h-6 text-neutral-dark transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Collapsible Content */}
      <div
        id="onboarding-checklist-content"
        className={`overflow-hidden transition-[max-height,margin-top] duration-500 ease-in-out ${isExpanded ? 'max-h-96 mt-3' : 'max-h-0 mt-0'}`}
      >
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
    </div>
  );
};
