
import React, { useState, useEffect } from 'react';
import { LoggedMeal, NutritionalInfo } from '../types.ts';
import { FireIcon, ProteinIcon, LeafIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from './icons.tsx';
import { MANUAL_LOG_FOOD_ICON_SVG, COMMON_MEAL_LOG_ICON_SVG } from '../constants.ts';

interface MealItemCardProps {
  meal: LoggedMeal;
  onDelete: (mealId: string) => void;
  onUpdate: (mealId: string, updatedInfo: NutritionalInfo) => void;
  onSelectForCommonSave: (meal: LoggedMeal) => void;
  isReadOnly?: boolean; // New prop
}

const MealItemCard: React.FC<MealItemCardProps> = ({ meal, onDelete, onUpdate, onSelectForCommonSave, isReadOnly = false }) => {
  const formatForDisplay = (num: number) => num.toLocaleString('sv-SE', { maximumFractionDigits: 2, useGrouping: false });

  const [isEditing, setIsEditing] = useState(false);
  const [editedFoodItem, setEditedFoodItem] = useState(meal.nutritionalInfo.foodItem || '');
  const [editedCalories, setEditedCalories] = useState(formatForDisplay(meal.nutritionalInfo.calories));
  const [editedProtein, setEditedProtein] = useState(formatForDisplay(meal.nutritionalInfo.protein));
  const [editedCarbohydrates, setEditedCarbohydrates] = useState(formatForDisplay(meal.nutritionalInfo.carbohydrates));
  const [editedFat, setEditedFat] = useState(formatForDisplay(meal.nutritionalInfo.fat));
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // State for dropdown

  useEffect(() => {
    if (!isEditing) {
      setEditedFoodItem(meal.nutritionalInfo.foodItem || '');
      setEditedCalories(formatForDisplay(meal.nutritionalInfo.calories));
      setEditedProtein(formatForDisplay(meal.nutritionalInfo.protein));
      setEditedCarbohydrates(formatForDisplay(meal.nutritionalInfo.carbohydrates));
      setEditedFat(formatForDisplay(meal.nutritionalInfo.fat));
    }
  }, [isEditing, meal.nutritionalInfo]);

  const handleSave = () => {
    if (isReadOnly) return;
    const parseValue = (val: string) => parseFloat(val.replace(',', '.')) || 0;
    const updatedInfo: NutritionalInfo = {
      foodItem: editedFoodItem.trim(),
      calories: parseValue(editedCalories),
      protein: parseValue(editedProtein),
      carbohydrates: parseValue(editedCarbohydrates),
      fat: parseValue(editedFat),
    };
    onUpdate(meal.id, updatedInfo);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };
  
  const createNumericHandler = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const valueWithDot = value.replace(',', '.');
        const validDecimalRegex = /^\d*\.?\d{0,2}$/;
        if (valueWithDot === '' || validDecimalRegex.test(valueWithDot)) {
            setter(value);
        }
    };
  };

  const inputClass = `mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base ${isReadOnly ? 'bg-neutral-light/70 cursor-not-allowed' : ''}`;

  const confirmDelete = () => {
    if (isReadOnly) return;
    onDelete(meal.id);
    setShowConfirmDeleteModal(false);
  }

  // Determine if the imageDataUrl is an actual image or one of the placeholder SVGs
  const showActualImage = meal.imageDataUrl && 
                          meal.imageDataUrl !== MANUAL_LOG_FOOD_ICON_SVG && 
                          meal.imageDataUrl !== COMMON_MEAL_LOG_ICON_SVG;


  if (isEditing && !isReadOnly) {
    return (
      <div className={`bg-white shadow-soft-xl rounded-lg p-5 border border-primary-lighter relative space-y-4 animate-fade-in`}> {/* Enhanced shadow for editing state */}
        <div>
          <label htmlFor={`foodItem-${meal.id}`} className="block text-sm font-medium text-neutral-dark">Måltid</label>
          <input
            type="text"
            id={`foodItem-${meal.id}`}
            value={editedFoodItem}
            onChange={(e) => setEditedFoodItem(e.target.value)}
            className={inputClass}
            aria-label="Måltidsnamn"
            readOnly={isReadOnly}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <div>
            <label htmlFor={`calories-${meal.id}`} className="block text-sm font-medium text-neutral-dark">Kalorier (kcal)</label>
            <input type="text" inputMode="decimal" id={`calories-${meal.id}`} value={editedCalories} onChange={createNumericHandler(setEditedCalories)} className={inputClass} aria-label="Kalorier" readOnly={isReadOnly}/>
          </div>
          <div>
            <label htmlFor={`protein-${meal.id}`} className="block text-sm font-medium text-neutral-dark">Protein (g)</label>
            <input type="text" inputMode="decimal" id={`protein-${meal.id}`} value={editedProtein} onChange={createNumericHandler(setEditedProtein)} className={inputClass} aria-label="Protein" readOnly={isReadOnly}/>
          </div>
          <div>
            <label htmlFor={`carbs-${meal.id}`} className="block text-sm font-medium text-neutral-dark">Kolhydrater (g)</label>
            <input type="text" inputMode="decimal" id={`carbs-${meal.id}`} value={editedCarbohydrates} onChange={createNumericHandler(setEditedCarbohydrates)} className={inputClass} aria-label="Kolhydrater" readOnly={isReadOnly}/>
          </div>
          <div>
            <label htmlFor={`fat-${meal.id}`} className="block text-sm font-medium text-neutral-dark">Fett (g)</label>
            <input type="text" inputMode="decimal" id={`fat-${meal.id}`} value={editedFat} onChange={createNumericHandler(setEditedFat)} className={inputClass} aria-label="Fett" readOnly={isReadOnly}/>
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={handleCancelEdit}
            className="p-2.5 text-neutral hover:text-red-600 rounded-full hover:bg-red-100 active:scale-90 transform interactive-transition"
            aria-label="Avbryt ändringar"
            disabled={isReadOnly}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <button
            onClick={handleSave}
            className="p-2.5 text-neutral hover:text-green-600 rounded-full hover:bg-green-100 active:scale-90 transform interactive-transition"
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
      <div className={`bg-white shadow-soft-lg rounded-lg p-4 border border-neutral-light relative animate-fade-slide-in interactive-transition group hover:shadow-soft-xl ${!isReadOnly ? 'hover:scale-[1.02]' : ''} ${isReadOnly ? 'opacity-70' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-grow min-w-0"> {/* min-w-0 for truncation */}
            {showActualImage && meal.imageDataUrl && (
              <img
                src={meal.imageDataUrl}
                alt={meal.nutritionalInfo.foodItem || "Måltidsbild"}
                className="w-10 h-10 object-cover rounded-md flex-shrink-0"
              />
            )}
            <h4 className="text-base sm:text-lg font-semibold text-neutral-dark truncate">
              {meal.nutritionalInfo.foodItem || "Loggad måltid"}
            </h4>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0 ml-2">
            {!isReadOnly && (
              <>
                <button
                  onClick={() => onSelectForCommonSave(meal)}
                  className="p-1.5 text-neutral-dark hover:text-accent-darker rounded-full hover:bg-amber-100 active:scale-90 interactive-transition"
                  aria-label="Spara som vanligt val"
                  title="Spara som vanligt val"
                >
                  <span className="text-xl" role="img" aria-hidden="true">📌</span>
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 text-neutral-dark hover:text-secondary-darker rounded-full hover:bg-secondary-100 active:scale-90 interactive-transition"
                  aria-label="Redigera måltid"
                  title="Redigera måltid"
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowConfirmDeleteModal(true)}
                  className="p-1.5 text-neutral-dark hover:text-red-600 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
                  aria-label="Ta bort måltid"
                  title="Ta bort måltid"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-neutral-dark hover:text-primary-darker rounded-full hover:bg-primary-100 active:scale-90 interactive-transition"
              aria-expanded={isExpanded}
              aria-controls={`meal-details-${meal.id}`}
              aria-label={isExpanded ? "Dölj detaljer" : "Visa detaljer"}
              title={isExpanded ? "Dölj detaljer" : "Visa detaljer"}
            >
              {isExpanded ? <ChevronUpIcon className="w-5 h-5 transition-transform duration-200 ease-in-out" /> : <ChevronDownIcon className="w-5 h-5 transition-transform duration-200 ease-in-out" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div id={`meal-details-${meal.id}`} className="mt-3 pt-3 border-t border-neutral-light/60 animate-fade-in">
            {showActualImage && meal.imageDataUrl && (
              <img
                  src={meal.imageDataUrl}
                  alt={meal.nutritionalInfo.foodItem || "Analyserad måltid"}
                  className="w-full sm:w-28 h-28 object-cover rounded-md shadow mb-3"
              />
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:text-base text-neutral">
              <div className="flex items-center">
                <span className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>
                <span>Kalorier: {meal.nutritionalInfo.calories.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kcal</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Protein">💪</span>
                <span>Protein: {meal.nutritionalInfo.protein.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} g</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>
                <span>Kolhydrater: {meal.nutritionalInfo.carbohydrates.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} g</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>
                <span>Fett: {meal.nutritionalInfo.fat.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} g</span>
              </div>
            </div>
             {meal.caloriesCoveredByBank && meal.caloriesCoveredByBank > 0 && (
                <p className="text-xs text-blue-600 mt-1.5">
                    ({meal.caloriesCoveredByBank.toFixed(0)} kcal från sparpotten)
                </p>
            )}
            <p className="text-xs sm:text-sm text-gray-400 mt-2.5">
              Loggad: {new Date(meal.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {isReadOnly && <p className="text-xs text-orange-500 mt-1">Denna dag är bearbetad, loggen är skrivskyddad.</p>}
          </div>
        )}
      </div>

      {showConfirmDeleteModal && !isReadOnly && (
        <div
            className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in"
            onClick={() => setShowConfirmDeleteModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`confirm-delete-title-${meal.id}`}
            aria-describedby={`confirm-delete-desc-${meal.id}`}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-soft-xl w-full max-w-sm animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={`confirm-delete-title-${meal.id}`} className="text-lg font-semibold text-neutral-dark mb-4">Bekräfta borttagning</h3>
            <p id={`confirm-delete-desc-${meal.id}`} className="text-neutral mb-6">
              Är du säker på att du vill ta bort "{meal.nutritionalInfo.foodItem || 'denna måltid'}"?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmDeleteModal(false)}
                className="px-4 py-2 text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md active:scale-95 interactive-transition"
              >
                Avbryt
              </button>
              <button
                onClick={confirmDelete}
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

export default MealItemCard;
