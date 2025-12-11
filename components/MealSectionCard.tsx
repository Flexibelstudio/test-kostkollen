
import React, { useState, useMemo } from 'react';
import { LoggedMeal, NutritionalInfo } from '../types';
import MealItemCard from './MealItemCard';
import { PlusIcon, XMarkIcon, ProteinIcon, LeafIcon } from './icons';

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Calculate totals for this specific meal section
  const totals = useMemo(() => meals.reduce((acc, meal) => ({
    calories: acc.calories + meal.nutritionalInfo.calories,
    protein: acc.protein + meal.nutritionalInfo.protein,
    carbs: acc.carbs + meal.nutritionalInfo.carbohydrates,
    fat: acc.fat + meal.nutritionalInfo.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [meals]);

  const handleCardClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsModalOpen(false);
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the modal
    onAddClick();
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
                        <div className="text-center py-10 bg-white/50 rounded-xl border border-dashed border-neutral-light mx-2">
                            <p className="text-neutral mb-2">Ingenting loggat här än.</p>
                            <button onClick={() => { handleCloseModal(); onAddClick(); }} className="text-primary font-semibold hover:underline">
                                Lägg till {title.toLowerCase()} nu
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer with Add Button */}
            {isEditable && (
                <div className="p-4 border-t border-neutral-light/70 bg-white">
                    <button
                        onClick={() => { handleCloseModal(); onAddClick(); }}
                        className="w-full py-3.5 flex items-center justify-center gap-2 text-white bg-primary hover:bg-primary-darker font-bold rounded-xl shadow-md active:scale-95 transition-all"
                    >
                        <PlusIcon className="w-6 h-6" />
                        <span>Lägg till {title}</span>
                    </button>
                </div>
            )}
        </div>
    </div>
  );

  // --- Dashboard Card View ---
  return (
    <>
      <div 
        onClick={handleCardClick}
        className="bg-white rounded-2xl shadow-soft-lg border border-neutral-light p-4 flex items-center justify-between cursor-pointer group hover:shadow-soft-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
      >
        {/* Left Side: Icon & Title */}
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-neutral-light/50 flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-neutral-dark">{title}</h3>
        </div>

        {/* Right Side: Calories & Add Button */}
        <div className="flex items-center gap-3">
            <span className={`text-base font-bold ${totals.calories > 0 ? 'text-neutral-dark' : 'text-neutral/50'}`}>
                {Math.round(totals.calories)} kcal
            </span>
            
            {isEditable && (
                <button
                    onClick={handleQuickAdd}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-100 text-primary-darker hover:bg-primary hover:text-white transition-all active:scale-90"
                    aria-label={`Snabbtillägg till ${title}`}
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            )}
        </div>
      </div>

      {isModalOpen && renderModal()}
    </>
  );
};

export default MealSectionCard;
