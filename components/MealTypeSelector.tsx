import React from 'react';
import { MealType } from '../types';

interface MealTypeSelectorProps {
  selectedType: MealType;
  onSelect: (type: MealType) => void;
  className?: string;
}

const MealTypeSelector: React.FC<MealTypeSelectorProps> = ({ selectedType, onSelect, className = '' }) => {
  const options: { type: MealType; label: string; icon: string }[] = [
    { type: 'breakfast', label: 'Frukost', icon: '☕' },
    { type: 'lunch', label: 'Lunch', icon: '🥗' },
    { type: 'dinner', label: 'Middag', icon: '🍛' },
    { type: 'snack', label: 'Mellis', icon: '🍎' },
  ];

  return (
    <div className={`flex justify-between gap-2 ${className}`}>
      {options.map((option) => (
        <button
          key={option.type}
          type="button"
          onClick={() => onSelect(option.type)}
          className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-200 ${
            selectedType === option.type
              ? 'bg-primary-100 border-primary text-primary-darker shadow-sm'
              : 'bg-neutral-light/50 border-transparent text-neutral hover:bg-neutral-light'
          }`}
        >
          <span className="text-xl mb-1">{option.icon}</span>
          <span className="text-xs font-semibold">{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default MealTypeSelector;