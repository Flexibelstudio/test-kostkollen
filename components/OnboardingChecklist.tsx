
import React, { useState } from 'react';
import { OnboardingChecklistState } from '../types';
import { ChevronDownIcon, CheckCircleIcon } from './icons';

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

  // Profile set is considered automatically done if they are here
  const completedCount = Object.values(state.items).filter(Boolean).length + 1; 
  const totalCount = 5;
  const progress = (completedCount / totalCount) * 100;
  const allComplete = completedCount === totalCount;

  const items = [
    { key: 'profileSet', text: 'Sätt dina personliga mål', completed: true, action: () => {} },
    { key: 'mealLogged', text: 'Logga din första måltid', completed: state.items.mealLogged, action: onTriggerLog },
    { key: 'waterLogged', text: 'Logga ditt vattenintag', completed: state.items.waterLogged, action: onScrollToWater },
    { key: 'journeyViewed', text: 'Utforska "Min resa"', completed: state.items.journeyViewed, action: () => onNavigate('journey') },
    { key: 'communityViewed', text: 'Kolla in Community', completed: state.items.communityViewed, action: () => onNavigate('community') },
  ];

  return (
    <div className="bg-white p-6 rounded-3xl shadow-soft-xl border border-neutral-light animate-fade-slide-in relative transition-all duration-300 overflow-hidden">
      
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center text-left focus:outline-none group"
        aria-expanded={isExpanded}
        aria-controls="onboarding-checklist-content"
      >
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-colors ${allComplete ? 'bg-primary text-white' : 'bg-primary-100 text-primary-darker'}`}>
                {completedCount}/{totalCount}
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-neutral-dark group-hover:text-primary transition-colors">Kom igång</h3>
        </div>
        <div className={`p-2 rounded-full bg-neutral-light group-hover:bg-gray-200 transition-colors ${isExpanded ? 'bg-gray-200' : ''}`}>
            <ChevronDownIcon className={`w-5 h-5 text-neutral-dark transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Progress Bar */}
      <div className={`mt-4 w-full bg-neutral-light rounded-full h-1.5 overflow-hidden transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 mt-0'}`}>
         <div className="bg-primary h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
      </div>

      {/* Content */}
      <div
        id="onboarding-checklist-content"
        className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}
      >
          <ul className="space-y-2">
            {items.map(item => (
              <li key={item.key}>
                <button
                  onClick={item.action}
                  disabled={item.completed}
                  className={`w-full text-left flex items-center p-3 rounded-xl transition-all duration-200 border border-transparent group
                    ${item.completed 
                        ? 'bg-green-50/50 text-neutral-400 cursor-default' 
                        : 'bg-neutral-light/30 hover:bg-white hover:border-primary/20 hover:shadow-sm text-neutral-dark'
                    }`}
                >
                  <div className="mr-3 flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                    {item.completed ? (
                        <CheckCircleIcon className="w-6 h-6 text-primary" />
                    ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-neutral-300 bg-white group-hover:border-primary transition-colors"></div>
                    )}
                  </div>
                  <span className={`text-sm sm:text-base font-medium ${item.completed ? 'line-through decoration-neutral-300' : ''}`}>
                    {item.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          
          {allComplete && (
            <div className="mt-4 p-3 bg-primary-100/50 rounded-xl text-center animate-fade-in">
                <p className="text-primary-darker font-bold">
                Snyggt jobbat! Du har koll på grunderna! 🚀
                </p>
            </div>
          )}
      </div>
    </div>
  );
};
