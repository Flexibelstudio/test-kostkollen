import React, { useState, useEffect } from 'react';
import { LoggedMeal, NutritionalInfo } from '../types.ts';
import { TrashIcon, PencilIcon, CheckIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon, BookmarkIcon } from './icons.tsx';
import { Flame, Dumbbell, Wheat, Droplet } from 'lucide-react';
import { resolveUpdatedNutrients } from '../utils/nutritionTotals.ts';

interface MealItemCardProps {
  meal: LoggedMeal;
  onDelete: (mealId: string) => void;
  onUpdate: (mealId: string, updatedInfo: NutritionalInfo) => void;
  onSelectForCommonSave: (meal: LoggedMeal) => void;
  isReadOnly?: boolean; // New prop
  isNewlyAdded?: boolean;
}

const MealItemCard: React.FC<MealItemCardProps> = ({ meal, onDelete, onUpdate, onSelectForCommonSave, isReadOnly = false, isNewlyAdded = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedFoodItem, setEditedFoodItem] = useState(meal.nutritionalInfo.foodItem || '');
  const [editedCalories, setEditedCalories] = useState(meal.nutritionalInfo.calories.toString());
  const [editedProtein, setEditedProtein] = useState(meal.nutritionalInfo.protein.toString());
  const [editedCarbohydrates, setEditedCarbohydrates] = useState(meal.nutritionalInfo.carbohydrates.toString());
  const [editedFat, setEditedFat] = useState(meal.nutritionalInfo.fat.toString());
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // State for dropdown

  useEffect(() => {
    if (!isEditing) {
      setEditedFoodItem(meal.nutritionalInfo.foodItem || '');
      setEditedCalories(Math.round(meal.nutritionalInfo.calories).toString());
      setEditedProtein(Math.round(meal.nutritionalInfo.protein).toString());
      setEditedCarbohydrates(Math.round(meal.nutritionalInfo.carbohydrates).toString());
      setEditedFat(Math.round(meal.nutritionalInfo.fat).toString());
    }
  }, [isEditing, meal.nutritionalInfo]);

  const handleSave = () => {
    if (isReadOnly) return;
    const updatedInfo: NutritionalInfo = resolveUpdatedNutrients(meal.nutritionalInfo, {
      foodItem: editedFoodItem,
      calories: editedCalories,
      protein: editedProtein,
      carbohydrates: editedCarbohydrates,
      fat: editedFat,
    });
    onUpdate(meal.id, updatedInfo);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };
  
  const createNumericHandler = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(',', '.');
        if (value === '') {
            setter('0');
            return;
        }
        if (/^\d*\.?\d*$/.test(value)) {
            setter(value);
        }
    };
  };

  const inputClass = `mt-1 block w-full px-3 py-2 bg-white dark:bg-[#34302C] border border-[#F1EAE0] dark:border-[#484440] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D96E4A] text-base ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`;

  const confirmDelete = () => {
    if (isReadOnly) return;
    onDelete(meal.id);
    setShowConfirmDeleteModal(false);
  }

  const showActualImage = meal.imageUrl && 
                          !meal.imageUrl.startsWith('data:image/svg+xml');


  if (isEditing && !isReadOnly) {
    return (
      <div className="bg-white dark:bg-[#2B2825] shadow-soft-xl rounded-2xl p-5 border border-[#F1EAE0] dark:border-[#484440] relative space-y-4 animate-fade-in">
        <div>
          <label htmlFor={`foodItem-${meal.id}`} className="block text-sm font-medium text-[#56524D] dark:text-[#FAF6EF]">Måltid</label>
           <div className="relative">
              <input
                type="text"
                id={`foodItem-${meal.id}`}
                value={editedFoodItem}
                onChange={(e) => setEditedFoodItem(e.target.value)}
                className={`${inputClass} pr-8`}
                aria-label="Måltidsnamn"
                readOnly={isReadOnly}
              />
              <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-[#7A756E] pointer-events-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <div>
            <label htmlFor={`calories-${meal.id}`} className="block text-sm font-medium text-[#56524D] dark:text-[#FAF6EF]">Kalorier (kcal)</label>
             <div className="relative">
                <input type="number" id={`calories-${meal.id}`} value={editedCalories} onChange={createNumericHandler(setEditedCalories)} min="0" step="any" className={`${inputClass} pr-8`} aria-label="Kalorier" readOnly={isReadOnly}/>
                <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-[#7A756E] pointer-events-none" />
            </div>
          </div>
          <div>
            <label htmlFor={`protein-${meal.id}`} className="block text-sm font-medium text-[#56524D] dark:text-[#FAF6EF]">Protein (g)</label>
             <div className="relative">
                <input type="number" id={`protein-${meal.id}`} value={editedProtein} onChange={createNumericHandler(setEditedProtein)} min="0" step="any" className={`${inputClass} pr-8`} aria-label="Protein" readOnly={isReadOnly}/>
                <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-[#7A756E] pointer-events-none" />
            </div>
          </div>
          <div>
            <label htmlFor={`carbs-${meal.id}`} className="block text-sm font-medium text-[#56524D] dark:text-[#FAF6EF]">Kolhydrater (g)</label>
             <div className="relative">
                <input type="number" id={`carbs-${meal.id}`} value={editedCarbohydrates} onChange={createNumericHandler(setEditedCarbohydrates)} min="0" step="any" className={`${inputClass} pr-8`} aria-label="Kolhydrater" readOnly={isReadOnly}/>
                <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-[#7A756E] pointer-events-none" />
            </div>
          </div>
          <div>
            <label htmlFor={`fat-${meal.id}`} className="block text-sm font-medium text-[#56524D] dark:text-[#FAF6EF]">Fett (g)</label>
             <div className="relative">
                <input type="number" id={`fat-${meal.id}`} value={editedFat} onChange={createNumericHandler(setEditedFat)} min="0" step="any" className={`${inputClass} pr-8`} aria-label="Fett" readOnly={isReadOnly}/>
                <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-[#7A756E] pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={handleCancelEdit}
            className="p-2.5 text-[#7A756E] hover:text-red-600 rounded-full hover:bg-red-50 active:scale-90 transform transition-transform"
            aria-label="Avbryt ändringar"
            disabled={isReadOnly}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <button
            onClick={handleSave}
            className="p-2.5 text-white bg-[#D96E4A] hover:bg-[#C05A38] rounded-full active:scale-90 transform transition-transform shadow-sm"
            aria-label="Spara ändringar"
            disabled={isReadOnly}
          >
            <CheckIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`bg-white dark:bg-[#2B2825] shadow-soft-xl rounded-2xl p-4 border border-[#F1EAE0] dark:border-[#484440] relative group hover:shadow-md ${!isReadOnly ? 'hover:scale-[1.01]' : ''} ${isReadOnly ? 'opacity-70' : ''} ${isNewlyAdded ? 'animate-meal-drop-bounce' : 'animate-fade-slide-in'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-grow min-w-0">
            {meal.imageUrl && (
              <img
                src={meal.imageUrl}
                alt={meal.nutritionalInfo.foodItem || "Måltidsbild"}
                className="w-10 h-10 object-cover rounded-xl flex-shrink-0"
              />
            )}
            <h4 className="text-base sm:text-lg font-medium text-[#56524D] dark:text-[#FAF6EF] truncate">
              {meal.nutritionalInfo.foodItem || "Loggad måltid"}
              {meal.count && meal.count > 1 && <span className="text-[#7A756E] font-medium text-base ml-1.5">{`x${meal.count}`}</span>}
            </h4>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0 ml-2">
            {!isReadOnly && (
              <>
                <button
                  onClick={() => onSelectForCommonSave(meal)}
                  className="p-2 text-[#7A756E] hover:text-[#D96E4A] rounded-full hover:bg-[#F6E2D9]/50 active:scale-90 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                  aria-label="Spara som vanligt val"
                  title="Spara som vanligt val"
                >
                  <BookmarkIcon className="w-4 h-4 text-[#D96E4A]" />
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-[#7A756E] hover:text-[#56524D] rounded-full hover:bg-[#F1EAE0] active:scale-90 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center disabled:opacity-50"
                  aria-label="Redigera måltid"
                  title={meal.count && meal.count > 1 ? "Kan inte redigera en grupperad måltid" : "Redigera måltid"}
                  disabled={isReadOnly || (!!meal.count && meal.count > 1)}
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowConfirmDeleteModal(true)}
                  className="p-2 text-[#7A756E] hover:text-red-600 rounded-full hover:bg-red-50 active:scale-90 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                  aria-label="Ta bort måltid"
                  title="Ta bort måltid"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-[#7A756E] hover:text-[#56524D] rounded-full hover:bg-[#F1EAE0] active:scale-90 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-expanded={isExpanded}
              aria-controls={`meal-details-${meal.id}`}
              aria-label={isExpanded ? "Dölj detaljer" : "Visa detaljer"}
              title={isExpanded ? "Dölj detaljer" : "Visa detaljer"}
            >
              {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div id={`meal-details-${meal.id}`} className="mt-3 pt-3 border-t border-[#F1EAE0] dark:border-[#484440] animate-fade-in">
            {showActualImage && meal.imageUrl && (
              <img
                  src={meal.imageUrl}
                  alt={meal.nutritionalInfo.foodItem || "Analyserad måltid"}
                  className="w-full sm:w-28 h-28 object-cover rounded-xl shadow-sm mb-3"
              />
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-[#56524D] dark:text-[#FAF6EF]">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#D96E4A]" />
                <span>Kalorier: {Math.round(meal.nutritionalInfo.calories).toFixed(0)} kcal</span>
              </div>
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-[#D96E4A]" />
                <span>Protein: {Math.round(meal.nutritionalInfo.protein).toFixed(0)} g</span>
              </div>
              <div className="flex items-center gap-2">
                <Wheat className="w-4 h-4 text-[#D96E4A]" />
                <span>Kolhydrater: {Math.round(meal.nutritionalInfo.carbohydrates).toFixed(0)} g</span>
              </div>
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-[#D96E4A]" />
                <span>Fett: {Math.round(meal.nutritionalInfo.fat).toFixed(0)} g</span>
              </div>
            </div>
            <p className="text-xs text-[#7A756E] dark:text-[#C2BCB4] mt-2.5">
              Loggad: {new Date(meal.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {isReadOnly && <p className="text-xs text-[#D96E4A] mt-1">Denna dag är bearbetad, loggen är skrivskyddad.</p>}
          </div>
        )}
      </div>

      {showConfirmDeleteModal && !isReadOnly && (
        <div
            className="fixed inset-0 bg-[#56524D]/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in"
            onClick={() => setShowConfirmDeleteModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`confirm-delete-title-${meal.id}`}
            aria-describedby={`confirm-delete-desc-${meal.id}`}
        >
          <div
            className="bg-white dark:bg-[#2B2825] p-6 rounded-[22px] shadow-soft-xl w-full max-w-sm animate-scale-in text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/40 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrashIcon className="w-7 h-7" />
            </div>
            <h3 id={`confirm-delete-title-${meal.id}`} className="text-xl font-serif font-medium text-[#56524D] dark:text-[#FAF6EF] mb-2">Bekräfta borttagning</h3>
            <p id={`confirm-delete-desc-${meal.id}`} className="text-sm text-[#7A756E] dark:text-[#C2BCB4] mb-6">
              {meal.count && meal.count > 1
                ? `Vill du ta bort en av dina ${meal.count} loggningar av "${meal.nutritionalInfo.foodItem}"?`
                : `Är du säker på att du vill ta bort "${meal.nutritionalInfo.foodItem || 'denna måltid'}"?`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDeleteModal(false)}
                className="flex-1 px-4 py-3 text-[#56524D] bg-[#F1EAE0] hover:bg-[#E5DCD0] rounded-full font-medium active:scale-95 transition-all"
              >
                Avbryt
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 text-white bg-red-600 hover:bg-red-700 rounded-full font-medium shadow-md active:scale-95 transition-all"
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

export default MealItemCard;