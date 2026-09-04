
import React, { useMemo } from 'react';
import { LoggedMeal, NutritionalInfo } from '../types';
import MealItemCard from './MealItemCard';
import { XMarkIcon } from './icons';
import { sumMealNutrients } from '../utils/nutritionTotals';

interface MealSectionCardProps {
  title: string;
  icon: React.ReactNode;
  meals: LoggedMeal[];
  onDeleteMeal: (id: string) => void;
  onUpdateMeal: (id: string, data: NutritionalInfo) => void;
  onSaveCommon: (meal: LoggedMeal) => void;
  isEditable: boolean;
  isOpen: boolean;       // Controlled from parent
  onOpen: () => void;    // Controlled from parent
  onClose: () => void;   // Controlled from parent
  recommendedCalories?: number;
  isBootcamp?: boolean;
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
  onClose,
  recommendedCalories,
  isBootcamp = false
}) => {
  // Calculate totals for this specific meal section
  const totals = useMemo(() => sumMealNutrients(meals), [meals]);

  const isEmpty = meals.length === 0;

  const handleCardClick = () => {
    onOpen();
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onClose();
  };

  // Single terracotta theme for all meal icons
  const theme = { bg: 'bg-[#F6E2D9]', text: 'text-[#D96E4A]' };

  // --- Modal Content ---
  const renderModal = () => (
    <div 
        className="fixed inset-0 bg-[#56524D]/70 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-fade-in"
        onClick={handleCloseModal}
    >
        <div 
            className="bg-white dark:bg-[#2B2825] w-full max-w-lg rounded-[22px] shadow-soft-xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-light dark:border-[#484440] flex justify-between items-center bg-white dark:bg-[#2B2825] sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#F6E2D9] text-[#D96E4A]">
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-2xl font-serif font-medium text-[#56524D] dark:text-[#FAF6EF]">{title}</h3>
                        <p className="text-sm text-[#7A756E] dark:text-[#C2BCB4] font-medium">
                            {Math.round(totals.calories)} kcal totalt
                            {recommendedCalories && ` / ~${recommendedCalories} kcal`}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={handleCloseModal}
                    className="p-2 text-[#7A756E] hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                >
                    <XMarkIcon className="w-7 h-7" />
                </button>
            </div>

            {/* Content Container with Scroll */}
            <div className="overflow-y-auto custom-scrollbar flex-grow bg-[#FAF6EF]/50 dark:bg-[#34302C]/50">
                
                {/* Macro Summary Row */}
                <div className="grid grid-cols-3 gap-3 p-4">
                    <div className="bg-white dark:bg-[#2B2825] p-3 rounded-2xl border border-neutral-light dark:border-[#484440] shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-semibold text-[#D96E4A] uppercase mb-1">Protein</span>
                        <div className="flex items-center gap-1 text-[#56524D] dark:text-[#FAF6EF]">
                            <span className="text-lg font-bold">{Math.round(totals.protein)}</span>
                            <span className="text-xs font-medium">g</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#2B2825] p-3 rounded-2xl border border-neutral-light dark:border-[#484440] shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-semibold text-[#D96E4A] uppercase mb-1">Kolhydrater</span>
                        <div className="flex items-center gap-1 text-[#56524D] dark:text-[#FAF6EF]">
                            <span className="text-lg font-bold">{Math.round(totals.carbohydrates)}</span>
                            <span className="text-xs font-medium">g</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#2B2825] p-3 rounded-2xl border border-neutral-light dark:border-[#484440] shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-semibold text-[#D96E4A] uppercase mb-1">Fett</span>
                        <div className="flex items-center gap-1 text-[#56524D] dark:text-[#FAF6EF]">
                            <span className="text-lg font-bold">{Math.round(totals.fat)}</span>
                            <span className="text-xs font-medium">g</span>
                        </div>
                    </div>
                </div>

                {/* Meals List */}
                <div className="px-4 pb-4 space-y-3">
                    {isEmpty ? (
                        <div className="text-center py-8 text-[#7A756E] dark:text-[#C2BCB4]">
                            <p className="text-base">Inga måltider loggade än.</p>
                        </div>
                    ) : (
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
                    )}
                </div>
            </div>
        </div>
    </div>
  );

  // --- Dashboard Card View ---
  return (
    <>
      <div 
        onClick={handleCardClick}
        className={`
            ${'bg-white dark:bg-[#2B2825] border-neutral-light dark:border-[#484440]'} rounded-[22px] p-4 border shadow-soft-xl 
            transition-all duration-300 ease-out flex flex-col justify-between h-36 min-h-[44px]
            ${isEmpty 
                ? 'hover:border-[#D96E4A]/40 cursor-pointer group' 
                : 'hover:shadow-md hover:scale-[1.01] cursor-pointer hover:border-[#D96E4A]/30 group'
            }
        `}
      >
        <div className="flex justify-between items-start">
            <div className={`
                w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-colors duration-300
                ${'bg-[#F6E2D9] text-[#D96E4A]'}
            `}>
                {icon}
            </div>
            
            <div className="text-right">
                 <span className={`block text-2xl font-serif font-medium leading-none transition-colors ${totals.calories > 0 ? ('text-[#56524D] dark:text-[#FAF6EF]') : ('text-[#7A756E] dark:text-[#C2BCB4]')}`}>
                    {Math.round(totals.calories)}
                 </span>
                 <span className={`text-xs font-sans tracking-wide transition-colors ${totals.calories > 0 ? ('text-[#7A756E] dark:text-[#C2BCB4]') : ('text-[#7A756E]')}`}>
                    kcal {recommendedCalories && `/ ~${recommendedCalories}`}
                 </span>
            </div>
        </div>

        <div className="flex justify-between items-end mt-2">
            <div>
                <h3 className={`text-lg font-serif font-medium leading-tight mb-0.5 ${'text-[#56524D] dark:text-[#FAF6EF]'}`}>{title}</h3>
                <p className={`text-sm font-sans transition-colors ${isEmpty ? ('text-[#7A756E] dark:text-[#C2BCB4]') : ('text-[#56524D] dark:text-[#FAF6EF]')}`}>
                    {isEmpty ? 'Inget loggat' : `${meals.length} ${meals.length === 1 ? 'val' : 'val'}`}
                </p>
            </div>
        </div>
      </div>

      {isOpen && renderModal()}
    </>
  );
};

export default MealSectionCard;
