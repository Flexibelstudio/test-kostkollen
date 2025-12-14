
import React, { useMemo } from 'react';
import { LoggedMeal, NutritionalInfo } from '../types';
import MealItemCard from './MealItemCard';
import { XMarkIcon } from './icons';

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
    onOpen();
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onClose();
  };

  // Determine color theme based on title
  const getTheme = () => {
    const t = title.toLowerCase();
    if (t.includes('frukost')) return { bg: 'bg-orange-100', text: 'text-orange-600' };
    if (t.includes('lunch')) return { bg: 'bg-green-100', text: 'text-green-600' };
    if (t.includes('middag')) return { bg: 'bg-indigo-100', text: 'text-indigo-600' };
    if (t.includes('mellis') || t.includes('mellanmål')) return { bg: 'bg-purple-100', text: 'text-purple-600' };
    return { bg: 'bg-primary-50', text: 'text-primary-darker' }; // Default
  };

  const theme = getTheme();

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
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${theme.bg} ${theme.text}`}>
                        {icon}
                    </div>
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
                    {isEmpty ? (
                        <div className="text-center py-8 text-neutral opacity-60">
                            <p>Inga måltider loggade än.</p>
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
            bg-white rounded-2xl p-4 border border-neutral-light shadow-sm 
            transition-all duration-300 ease-out flex flex-col justify-between h-32
            ${isEmpty 
                ? 'opacity-100 hover:border-primary/40 cursor-pointer group' 
                : 'hover:shadow-md hover:scale-[1.02] cursor-pointer hover:border-primary/20 group'
            }
        `}
      >
        <div className="flex justify-between items-start">
            {/* Updated Icon Container with Squircle */}
            <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-colors duration-300
                ${theme.bg} ${theme.text}
            `}>
                {icon}
            </div>
            
            <div className="text-right">
                 <span className={`block text-xl font-extrabold leading-none transition-colors ${totals.calories > 0 ? 'text-neutral-dark' : 'text-neutral-200 group-hover:text-neutral-300'}`}>
                    {Math.round(totals.calories)}
                 </span>
                 <span className={`text-[10px] font-bold uppercase tracking-wide transition-colors ${totals.calories > 0 ? 'text-neutral-400' : 'text-neutral-200 group-hover:text-neutral-300'}`}>kcal</span>
            </div>
        </div>

        <div className="flex justify-between items-end mt-2">
            <div>
                <h3 className="text-base font-bold text-neutral-dark leading-tight mb-0.5">{title}</h3>
                <p className={`text-xs font-medium transition-colors ${isEmpty ? 'text-neutral-400' : 'text-neutral-500'}`}>
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
