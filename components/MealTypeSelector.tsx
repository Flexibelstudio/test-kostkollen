
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
            bg: "bg-[#F6E2D9]",
            text: "text-[#D96E4A]",
            border: "border-[#F6E2D9]",
            hoverBorder: "hover:border-[#D96E4A]/50",
            activeBorder: "border-[#D96E4A] ring-1 ring-[#D96E4A]"
        },
        lunch: {
            bg: "bg-[#F6E2D9]",
            text: "text-[#D96E4A]",
            border: "border-[#F6E2D9]",
            hoverBorder: "hover:border-[#D96E4A]/50",
            activeBorder: "border-[#D96E4A] ring-1 ring-[#D96E4A]"
        },
        dinner: {
            bg: "bg-[#F6E2D9]",
            text: "text-[#D96E4A]",
            border: "border-[#F6E2D9]",
            hoverBorder: "hover:border-[#D96E4A]/50",
            activeBorder: "border-[#D96E4A] ring-1 ring-[#D96E4A]"
        },
        snack: {
            bg: "bg-[#F6E2D9]",
            text: "text-[#D96E4A]",
            border: "border-[#F6E2D9]",
            hoverBorder: "hover:border-[#D96E4A]/50",
            activeBorder: "border-[#D96E4A] ring-1 ring-[#D96E4A]"
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
