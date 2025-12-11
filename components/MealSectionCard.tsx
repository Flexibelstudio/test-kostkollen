
import React, { useMemo } from 'react';
import { LoggedMeal, NutritionalInfo } from '../types';
import MealItemCard from './MealItemCard';
import { XMarkIcon } from './icons';

interface MealSectionCardProps {
  title: string;
  icon: string;
  meals: LoggedMeal[];
  onDeleteMeal: (id: string) => void;
  onUpdateMeal: (id: string, data: NutritionalInfo) => void;
  onSaveCommon: (meal: LoggedMeal) => void;
  isEditable: boolean;
  isOpen: boolean;       // Controlled from parent
  onOpen: () => void;    // Controlled from parent
  onClose: () => void;   // Controlled from parent
}

const MealSectionCard: React.FC<MealSectionCardProps> = ({
  title,
  icon,
  meals,
  onDeleteMeal,
  onUpdateMeal,
  onSaveCommon,
  isEditable,
  isOpen,
  onOpen,
  onClose
}) => {
  // Calculate totals for this specific meal section
  const totals = useMemo(() => meals.reduce((acc, meal) => ({
    calories: acc.calories + meal.nutritionalInfo.calories,
    protein: acc.protein + meal.nutritionalInfo.protein,
    carbs: acc.carbs + meal.nutritionalInfo.carbohydrates,
    fat: acc.fat + meal.nutritionalInfo.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [meals]);

  const isEmpty = meals.length === 0;

  const handleCardClick = () => {
    if (!isEmpty) {
        onOpen();
    }
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onClose();
  };

  // --- Modal Content ---
  const renderModal = () => (
    <div 
        className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-fade-in"
        onClick={handleCloseModal}
    >
        <div 
            className="bg-white w-full max-w-lg rounded-2xl shadow-soft-xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-light/70 flex justify-between items-center bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <span className="text-3xl" role="img" aria-label={title}>{icon}</span>
                    <div>
                        <h3 className="text-2xl font-bold text-neutral-dark">{title}</h3>
                        <p className="text-sm text-neutral font-medium">{Math.round(totals.calories)} kcal totalt</p>
                    </div>
                </div>
                <button 
                    onClick={handleCloseModal}
                    className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 transition-colors"
                >
                    <XMarkIcon className="w-7 h-7" />
                </button>
            </div>

            {/* Content Container with Scroll */}
            <div className="overflow-y-auto custom-scrollbar flex-grow bg-neutral-light/30">
                
                {/* Macro Summary Row */}
                <div className="grid grid-cols-3 gap-3 p-4">
                    <div className="bg-white p-3 rounded-xl border border-primary-200/50 shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-bold text-primary uppercase mb-1">Protein</span>
                        <div className="flex items-center gap-1 text-primary-darker">
                            <span className="text-lg font-extrabold">{Math.round(totals.protein)}</span>
                            <span className="text-xs font-medium">g</span>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-yellow-200/50 shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-bold text-yellow-600 uppercase mb-1">Kolhydrater</span>
                        <div className="flex items-center gap-1 text-neutral-dark">
                            <span className="text-lg font-extrabold">{Math.round(totals.carbs)}</span>
                            <span className="text-xs font-medium">g</span>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-orange-200/50 shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-bold text-orange-600 uppercase mb-1">Fett</span>
                        <div className="flex items-center gap-1 text-neutral-dark">
                            <span className="text-lg font-extrabold">{Math.round(totals.fat)}</span>
                            <span className="text-xs font-medium">g</span>
                        </div>
                    </div>
                </div>

                {/* Meals List */}
                <div className="px-4 pb-4 space-y-3">
                    {meals.map(meal => (
                        <MealItemCard
                            key={meal.id}
                            meal={meal}
                            onDelete={onDeleteMeal}
                            onUpdate={onUpdateMeal}
                            onSelectForCommonSave={onSaveCommon}
                            isReadOnly={!isEditable}
                        />
                    ))}
                </div>
            </div>
            {/* Footer removed as requested */}
        </div>
    </div>
  );

  // --- Dashboard Card View ---
  return (
    <>
      <div 
        onClick={handleCardClick}
        className={`bg-white rounded-2xl shadow-soft-lg border border-neutral-light p-4 flex items-center justify-between transition-all duration-200 
            ${isEmpty 
                ? 'opacity-80 cursor-default' 
                : 'cursor-pointer group hover:shadow-soft-xl hover:scale-[1.01] active:scale-[0.99]'
            }`}
      >
        {/* Left Side: Icon & Title */}
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-neutral-light/50 flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                {icon}
            </div>
            <div>
                <h3 className="text-lg font-bold text-neutral-dark leading-tight">{title}</h3>
                <p className="text-xs text-neutral font-medium">
                    {isEmpty ? 'Inget loggat' : `${meals.length} ${meals.length === 1 ? 'val' : 'val'}`}
                </p>
            </div>
        </div>

        {/* Right Side: Calories (No Add Button) */}
        <div className="flex items-center gap-3">
            <span className={`text-base font-bold ${totals.calories > 0 ? 'text-neutral-dark' : 'text-neutral/50'}`}>
                {Math.round(totals.calories)} kcal
            </span>
        </div>
      </div>

      {isOpen && renderModal()}
    </>
  );
};

export default MealSectionCard;
