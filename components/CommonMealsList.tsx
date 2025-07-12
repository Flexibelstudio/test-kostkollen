
import React, { useState, useEffect } from 'react';
import { CommonMeal, NutritionalInfo } from '../types.ts';
import { PlusCircleIcon, TrashIcon, FireIcon, XMarkIcon, CheckIcon, PencilIcon, ChevronDownIcon, ChevronUpIcon, ProteinIcon, LeafIcon } from './icons.tsx';
import { playAudio } from '../services/audioService.ts';

interface CommonMealsListProps {
  commonMeals: CommonMeal[];
  onLogCommonMeal: (commonMeal: CommonMeal) => void;
  onDeleteCommonMeal: (commonMealId: string) => void;
  onUpdateCommonMeal: (commonMealId: string, updatedData: { name: string; nutritionalInfo: NutritionalInfo }) => void;
  disabled?: boolean;
}

const CommonMealCard: React.FC<{
  meal: CommonMeal;
  onLog: (meal: CommonMeal) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { name: string; nutritionalInfo: NutritionalInfo }) => void;
  disabled: boolean;
}> = ({ meal, onLog, onDelete, onUpdate, disabled }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const [editedName, setEditedName] = useState(meal.name);
  const [editedCalories, setEditedCalories] = useState(meal.nutritionalInfo.calories.toString());
  const [editedProtein, setEditedProtein] = useState(meal.nutritionalInfo.protein.toString());
  const [editedCarbs, setEditedCarbs] = useState(meal.nutritionalInfo.carbohydrates.toString());
  const [editedFat, setEditedFat] = useState(meal.nutritionalInfo.fat.toString());

  useEffect(() => {
    if (!isEditing) {
      setEditedName(meal.name);
      setEditedCalories(meal.nutritionalInfo.calories.toString());
      setEditedProtein(meal.nutritionalInfo.protein.toString());
      setEditedCarbs(meal.nutritionalInfo.carbohydrates.toString());
      setEditedFat(meal.nutritionalInfo.fat.toString());
    }
  }, [isEditing, meal]);

  const handleSave = () => {
    const updatedData = {
      name: editedName.trim(),
      nutritionalInfo: {
        foodItem: editedName.trim(),
        calories: Math.round(parseFloat(editedCalories) || 0),
        protein: Math.round(parseFloat(editedProtein) || 0),
        carbohydrates: Math.round(parseFloat(editedCarbs) || 0),
        fat: Math.round(parseFloat(editedFat) || 0),
      },
    };
    onUpdate(meal.id, updatedData);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };
  
  const createNumericHandler = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        if (value === '') {
            setter('0');
            return;
        }
        if (/^\d+$/.test(value)) {
            setter(String(parseInt(value, 10)));
        }
    };
  };
  
  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";

  if (isEditing) {
    return (
      <div className="bg-white shadow-soft-xl rounded-lg p-5 border border-primary-lighter relative space-y-4 animate-fade-in">
        <div>
          <label htmlFor={`foodItem-${meal.id}`} className="block text-sm font-medium text-neutral-dark">Måltid</label>
          <input
            type="text"
            id={`foodItem-${meal.id}`}
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className={inputClass}
            aria-label="Måltidsnamn"
          />
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <div>
            <label htmlFor={`calories-${meal.id}`} className="block text-sm font-medium text-neutral-dark">Kalorier (kcal)</label>
            <input type="number" id={`calories-${meal.id}`} value={editedCalories} onChange={createNumericHandler(setEditedCalories)} min="0" step="1" className={inputClass} aria-label="Kalorier" />
          </div>
          <div>
            <label htmlFor={`protein-${meal.id}`} className="block text-sm font-medium text-neutral-dark">Protein (g)</label>
            <input type="number" id={`protein-${meal.id}`} value={editedProtein} onChange={createNumericHandler(setEditedProtein)} min="0" step="1" className={inputClass} aria-label="Protein" />
          </div>
          <div>
            <label htmlFor={`carbs-${meal.id}`} className="block text-sm font-medium text-neutral-dark">Kolhydrater (g)</label>
            <input type="number" id={`carbs-${meal.id}`} value={editedCarbs} onChange={createNumericHandler(setEditedCarbs)} min="0" step="1" className={inputClass} aria-label="Kolhydrater" />
          </div>
          <div>
            <label htmlFor={`fat-${meal.id}`} className="block text-sm font-medium text-neutral-dark">Fett (g)</label>
            <input type="number" id={`fat-${meal.id}`} value={editedFat} onChange={createNumericHandler(setEditedFat)} min="0" step="1" className={inputClass} aria-label="Fett" />
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={handleCancelEdit}
            className="p-2.5 text-neutral hover:text-red-600 rounded-full hover:bg-red-100 active:scale-90 transform interactive-transition"
            aria-label="Avbryt ändringar"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <button
            onClick={handleSave}
            className="p-2.5 text-neutral hover:text-green-600 rounded-full hover:bg-green-100 active:scale-90 transform interactive-transition"
            aria-label="Spara ändringar"
          >
            <CheckIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white shadow-soft-lg rounded-lg p-4 border border-neutral-light relative animate-fade-slide-in group interactive-transition hover:shadow-soft-xl ${disabled ? 'opacity-70' : 'hover:scale-[1.02]'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-grow min-w-0">
          <div>
            <h4 className="text-base sm:text-lg font-semibold text-neutral-dark truncate">{meal.name}</h4>
            <p className="text-sm text-neutral flex items-center">
              <span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>
              {meal.nutritionalInfo.calories.toFixed(0)} kcal
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0 ml-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-neutral-dark hover:text-primary-darker rounded-full hover:bg-primary-100 active:scale-90 interactive-transition"
              aria-expanded={isExpanded}
              aria-controls={`common-meal-details-${meal.id}`}
              title={isExpanded ? "Dölj detaljer" : "Visa detaljer"}
            >
              {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
            <button
                onClick={() => onLog(meal)}
                className={`p-2 rounded-full text-white ${disabled ? 'bg-neutral cursor-not-allowed' : 'bg-primary hover:bg-primary-darker active:scale-90 interactive-transition'}`}
                aria-label={`Logga ${meal.name}`}
                title={`Logga ${meal.name}`}
                disabled={disabled}
            >
                <PlusCircleIcon className="w-6 h-6" />
            </button>
          </div>
      </div>
      {isExpanded && (
        <div id={`common-meal-details-${meal.id}`} className="mt-3 pt-3 border-t border-neutral-light/60 animate-fade-in">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:text-base text-neutral">
            <div className="flex items-center">
              <span className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>
              <span>Kalorier: {Math.round(meal.nutritionalInfo.calories).toFixed(0)} kcal</span>
            </div>
            <div className="flex items-center">
              <span className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Protein">💪</span>
              <span>Protein: {Math.round(meal.nutritionalInfo.protein).toFixed(0)} g</span>
            </div>
            <div className="flex items-center">
              <span className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>
              <span>Kolhydrater: {Math.round(meal.nutritionalInfo.carbohydrates).toFixed(0)} g</span>
            </div>
            <div className="flex items-center">
              <span className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>
              <span>Fett: {Math.round(meal.nutritionalInfo.fat).toFixed(0)} g</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-light/50 flex justify-end space-x-3">
            <button
                onClick={() => setIsEditing(true)}
                className="flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-dark bg-neutral-light hover:bg-gray-200 rounded-md shadow-sm active:scale-95 interactive-transition"
                aria-label="Redigera vanligt val"
                title="Redigera vanligt val"
            >
                <PencilIcon className="w-4 h-4 mr-1.5" /> Redigera
            </button>
            <button
                onClick={() => onDelete(meal.id)}
                className="flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-md shadow-sm active:scale-95 interactive-transition"
                aria-label="Ta bort vanligt val"
                title="Ta bort vanligt val"
            >
                <TrashIcon className="w-4 h-4 mr-1.5" /> Ta bort
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const CommonMealsList: React.FC<CommonMealsListProps> = ({ commonMeals, onLogCommonMeal, onDeleteCommonMeal, onUpdateCommonMeal, disabled = false }) => {
  const [mealIdToConfirmDelete, setMealIdToConfirmDelete] = useState<string | null>(null);

  const handleDeleteRequest = (mealId: string) => {
    playAudio('uiClick');
    setMealIdToConfirmDelete(mealId);
  };
  
  const handleConfirmDelete = () => {
    if (mealIdToConfirmDelete) {
      playAudio('uiClick');
      onDeleteCommonMeal(mealIdToConfirmDelete);
      setMealIdToConfirmDelete(null);
    }
  };
  
  const handleLogClick = (meal: CommonMeal) => {
    if (disabled) return;
    playAudio('uiClick');
    onLogCommonMeal(meal);
  };

  const mealToConfirm = mealIdToConfirmDelete ? commonMeals.find(cm => cm.id === mealIdToConfirmDelete) : null;

  return (
    <>
      <div className="p-6 bg-white shadow-soft-lg rounded-xl border border-neutral-light">
        <div className="flex items-center pb-3 border-b border-neutral-light/70 mb-3">
          <span className="text-3xl mr-2.5" role="img" aria-hidden="true">📌</span>
          <h3 className="text-2xl font-semibold text-neutral-dark">Mina vanliga val</h3>
        </div>

        {disabled && commonMeals.length > 0 && (
          <p className="text-xs text-orange-500 text-center -mt-2 mb-2">Loggning av vanliga val är inaktiverad för detta datum.</p>
        )}
        
        {commonMeals.length === 0 ? (
           <p className="text-base text-neutral text-center py-4">
            Spara en måltid från din logg (med <span role="img" aria-hidden="true">📌</span>-ikonen) för att snabbt kunna logga den härifrån.
          </p>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1.5 custom-scrollbar">
            {commonMeals.map((meal) => (
              <CommonMealCard
                key={meal.id}
                meal={meal}
                onLog={handleLogClick}
                onDelete={handleDeleteRequest}
                onUpdate={onUpdateCommonMeal}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </div>

      {mealToConfirm && (
        <div 
            className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[105] p-4 animate-fade-in"
            onClick={() => setMealIdToConfirmDelete(null)} 
            role="dialog"
            aria-modal="true"
            aria-labelledby={`confirm-delete-common-title-${mealToConfirm.id}`}
        >
            <div 
                className="bg-white p-6 rounded-lg shadow-soft-xl w-full max-w-sm animate-scale-in"
                onClick={(e) => e.stopPropagation()} 
            >
                <h3 id={`confirm-delete-common-title-${mealToConfirm.id}`} className="text-lg font-semibold text-neutral-dark mb-4">Bekräfta borttagning</h3>
                <p className="text-neutral mb-6">
                    Är du säker på att du vill ta bort det vanliga valet "{mealToConfirm.name}"? Detta kan inte ångras.
                </p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={() => setMealIdToConfirmDelete(null)}
                        className="px-4 py-2 text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md active:scale-95 interactive-transition"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleConfirmDelete}
                        className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md active:scale-95 interactive-transition"
                    >
                        Ja, ta bort
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};
