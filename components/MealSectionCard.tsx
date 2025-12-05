
import React from 'react';
import { LoggedMeal, NutritionalInfo } from '../types';
import MealItemCard from './MealItemCard';
import { PlusIcon } from './icons';

interface MealSectionCardProps {
  title: string;
  icon: string;
  meals: LoggedMeal[];
  onDeleteMeal: (id: string) => void;
  onUpdateMeal: (id: string, data: NutritionalInfo) => void;
  onSaveCommon: (meal: LoggedMeal) => void;
  onAddClick: () => void;
  isEditable: boolean;
}

const MealSectionCard: React.FC<MealSectionCardProps> = ({
  title,
  icon,
  meals,
  onDeleteMeal,
  onUpdateMeal,
  onSaveCommon,
  onAddClick,
  isEditable
}) => {
  const totalCalories = meals.reduce((sum, meal) => sum + meal.nutritionalInfo.calories, 0);

  return (
    <div className="bg-white rounded-2xl shadow-soft-lg border border-neutral-light overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 bg-neutral-light/30 border-b border-neutral-light/60 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label={title}>{icon}</span>
          <h3 className="text-lg font-bold text-neutral-dark">{title}</h3>
        </div>
        <div className="text-sm font-semibold text-neutral-dark bg-white px-3 py-1 rounded-full shadow-sm border border-neutral-light">
          {Math.round(totalCalories)} kcal
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 flex-grow">
        {meals.length > 0 ? (
          meals.map(meal => (
            <MealItemCard
              key={meal.id}
              meal={meal}
              onDelete={onDeleteMeal}
              onUpdate={onUpdateMeal}
              onSelectForCommonSave={onSaveCommon}
              isReadOnly={!isEditable}
            />
          ))
        ) : (
          <div className="text-center py-6 text-neutral opacity-60">
            <p className="text-sm">Ingen {title.toLowerCase()} loggad än.</p>
          </div>
        )}
      </div>

      {/* Footer Action */}
      {isEditable && (
        <div className="p-3 border-t border-neutral-light/60 bg-neutral-light/10">
          <button
            onClick={onAddClick}
            className="w-full py-2 flex items-center justify-center gap-2 text-primary hover:text-primary-darker font-medium hover:bg-primary-100 rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Lägg till {title.toLowerCase()}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MealSectionCard;
