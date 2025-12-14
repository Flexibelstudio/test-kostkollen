
import React from 'react';
import { MealType } from '../types';
import { Coffee, Sandwich, CookingPot, Apple } from 'lucide-react';

interface MealTypeSelectorProps {
  selectedType: MealType | null;
  onSelect: (type: MealType) => void;
  className?: string;
}

const MealTypeSelector: React.FC<MealTypeSelectorProps> = ({ selectedType, onSelect, className = '' }) => {
  const options: { type: MealType; label: string; Icon: React.ElementType }[] = [
    { type: 'breakfast', label: 'Frukost', Icon: Coffee },
    { type: 'lunch', label: 'Lunch', Icon: Sandwich },
    { type: 'dinner', label: 'Middag', Icon: CookingPot },
    { type: 'snack', label: 'Mellis', Icon: Apple },
  ];

  const getButtonStyles = (type: MealType, isSelected: boolean) => {
    const baseClasses = "flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 active:scale-95";
    
    // Färger som matchar MealSectionCard på startsidan
    const colors = {
        breakfast: {
            bg: "bg-orange-100",
            text: "text-orange-700",
            border: "border-orange-200",
            hoverBorder: "hover:border-orange-400",
            activeBorder: "border-orange-600 ring-1 ring-orange-600"
        },
        lunch: {
            bg: "bg-green-100",
            text: "text-green-700",
            border: "border-green-200",
            hoverBorder: "hover:border-green-400",
            activeBorder: "border-green-600 ring-1 ring-green-600"
        },
        dinner: {
            bg: "bg-indigo-100",
            text: "text-indigo-700",
            border: "border-indigo-200",
            hoverBorder: "hover:border-indigo-400",
            activeBorder: "border-indigo-600 ring-1 ring-indigo-600"
        },
        snack: {
            bg: "bg-purple-100",
            text: "text-purple-700",
            border: "border-purple-200",
            hoverBorder: "hover:border-purple-400",
            activeBorder: "border-purple-600 ring-1 ring-purple-600"
        }
    };

    const c = colors[type];

    if (isSelected) {
        // Vald: Full färg, skarp border, lite större
        return `${baseClasses} ${c.bg} ${c.text} ${c.activeBorder} shadow-md scale-[1.02] opacity-100`;
    } else {
        // Ej vald: Fortfarande färgad bakgrund men lite genomskinlig och mjukare border
        return `${baseClasses} ${c.bg} ${c.text} ${c.border} ${c.hoverBorder} opacity-70 hover:opacity-100 hover:scale-[1.01]`;
    }
  };

  return (
    <div className={`grid grid-cols-4 gap-2 sm:gap-3 ${className}`}>
      {options.map((option) => {
        const isSelected = selectedType === option.type;
        return (
          <button
            key={option.type}
            type="button"
            onClick={() => onSelect(option.type)}
            className={getButtonStyles(option.type, isSelected)}
          >
            <option.Icon 
                className={`w-7 h-7 mb-1.5 transition-transform duration-200 ${isSelected ? 'scale-110 stroke-[2.5px]' : 'stroke-[2px]'}`} 
            />
            <span className={`text-xs font-bold`}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default MealTypeSelector;
