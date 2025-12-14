
import React, { useState, useEffect } from 'react';
import { CommonMeal, NutritionalInfo } from '../types.ts';
import { CheckIcon, XMarkIcon, PencilIcon, TrashIcon } from './icons.tsx';
import { 
  MoreHorizontal, 
  Soup, Egg, Sandwich, CupSoda, Drumstick, Beef, Fish, Salad, Carrot,
  Pizza, Coffee, Cake, Cookie, IceCream, Apple, Utensils, Croissant, Wine
} from 'lucide-react';
import { playAudio } from '../services/audioService.ts';

interface CommonMealsListProps {
  commonMeals: CommonMeal[];
  onLogCommonMeal: (commonMeal: CommonMeal) => void;
  onDeleteCommonMeal: (commonMealId: string) => void;
  onUpdateCommonMeal: (commonMealId: string, updatedData: { name: string; nutritionalInfo: NutritionalInfo }) => void;
  disabled?: boolean;
}

// Helper to match a Lucide icon and color theme based on the meal name
const getMealIcon = (name: string) => {
  const n = name.toLowerCase();
  const iconProps = { className: "w-6 h-6", strokeWidth: 2 };

  // Drinks (Coffee/Tea)
  if (n.includes('kaffe') || n.includes('te ') || n.includes('latte') || n.includes('espresso') || n.includes('cappuccino')) {
    return { icon: <Coffee {...iconProps} />, bg: 'bg-amber-100', text: 'text-amber-700' };
  }
  
  // Drinks (Cold)
  if (n.includes('smoothie') || n.includes('shake') || n.includes('dryck') || n.includes('vatten') || n.includes('juice') || n.includes('läsk') || n.includes('saft') || n.includes('mjölk')) {
    return { icon: <CupSoda {...iconProps} />, bg: 'bg-blue-100', text: 'text-blue-600' };
  }
  
  // Alcohol
  if (n.includes('öl') || n.includes('vin') || n.includes('cider') || n.includes('bubbel')) {
     return { icon: <Wine {...iconProps} />, bg: 'bg-purple-100', text: 'text-purple-700' };
  }

  // Breakfast / Porridge / Dairy
  if (n.includes('gröt') || n.includes('havre') || n.includes('oat') || n.includes('soppa') || n.includes('yoghurt') || n.includes('fil') || n.includes('kvarg') || n.includes('bowl') || n.includes('flingor') || n.includes('müsli')) {
    return { icon: <Soup {...iconProps} />, bg: 'bg-pink-100', text: 'text-pink-600' }; 
  }

  // Eggs
  if (n.includes('ägg') || n.includes('omelett') || n.includes('kokt')) {
    return { icon: <Egg {...iconProps} />, bg: 'bg-yellow-100', text: 'text-yellow-600' };
  }

  // Bread / Sandwiches
  if (n.includes('bröd') || n.includes('macka') || n.includes('toast') || n.includes('smörgås') || n.includes('knäcke') || n.includes('baguette') || n.includes('fralla')) {
    return { icon: <Sandwich {...iconProps} />, bg: 'bg-orange-100', text: 'text-orange-600' };
  }
  if (n.includes('croissant') || n.includes('bulle') || n.includes('wiener')) {
      return { icon: <Croissant {...iconProps} />, bg: 'bg-amber-100', text: 'text-amber-700' };
  }

  // Poultry
  if (n.includes('kyckling') || n.includes('fågel') || n.includes('kalkon') || n.includes('anka')) {
    return { icon: <Drumstick {...iconProps} />, bg: 'bg-orange-100', text: 'text-orange-700' };
  }

  // Meat
  if (n.includes('kött') || n.includes('biff') || n.includes('burgare') || n.includes('färs') || n.includes('korv') || n.includes('stek') || n.includes('skinka') || n.includes('bacon')) {
    return { icon: <Beef {...iconProps} />, bg: 'bg-red-100', text: 'text-red-700' };
  }

  // Fish/Seafood
  if (n.includes('fisk') || n.includes('lax') || n.includes('torsk') || n.includes('räkor') || n.includes('skaldjur') || n.includes('tonfisk') || n.includes('sushi')) {
    return { icon: <Fish {...iconProps} />, bg: 'bg-cyan-100', text: 'text-cyan-700' };
  }

  // Green / Veg
  if (n.includes('sallad') || n.includes('grönsak') || n.includes('vegetarisk') || n.includes('vegan') || n.includes('avokado') || n.includes('böna') || n.includes('lins')) {
    return { icon: <Salad {...iconProps} />, bg: 'bg-green-100', text: 'text-green-600' };
  }
  if (n.includes('morot') || n.includes('rotfrukt') || n.includes('potatis')) {
      return { icon: <Carrot {...iconProps} />, bg: 'bg-orange-50', text: 'text-orange-600' };
  }

  // Pizza / Fast food
  if (n.includes('pizza') || n.includes('taco') || n.includes('kebab')) {
    return { icon: <Pizza {...iconProps} />, bg: 'bg-yellow-100', text: 'text-yellow-700' };
  }

  // Sweets
  if (n.includes('kaka') || n.includes('tårta') || n.includes('bakelse')) {
    return { icon: <Cake {...iconProps} />, bg: 'bg-pink-100', text: 'text-pink-500' };
  }
  if (n.includes('kex') || n.includes('cookie') || n.includes('godis') || n.includes('choklad')) {
    return { icon: <Cookie {...iconProps} />, bg: 'bg-amber-100', text: 'text-amber-800' };
  }
  if (n.includes('glass') || n.includes('sorbet')) {
      return { icon: <IceCream {...iconProps} />, bg: 'bg-purple-100', text: 'text-purple-600' };
  }

  // Fruit
  if (n.includes('äpple') || n.includes('banan') || n.includes('frukt') || n.includes('bär') || n.includes('päron') || n.includes('apelsin')) {
    return { icon: <Apple {...iconProps} />, bg: 'bg-green-100', text: 'text-green-700' };
  }

  // Default
  return { icon: <Utensils {...iconProps} />, bg: 'bg-neutral-100', text: 'text-neutral-600' };
};

const CommonMealCard: React.FC<{
  meal: CommonMeal;
  onLog: (meal: CommonMeal) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { name: string; nutritionalInfo: NutritionalInfo }) => void;
  disabled: boolean;
}> = ({ meal, onLog, onDelete, onUpdate, disabled }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Edit state
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
    setShowMenu(false);
  };

  const createNumericHandler = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      if (value === '') { setter('0'); return; }
      if (/^\d+$/.test(value)) { setter(String(parseInt(value, 10))); }
    };
  };

  const inputClass = "block w-full px-2 py-1.5 bg-neutral-light/50 border border-neutral-light rounded-md text-sm focus:ring-primary focus:border-primary";

  if (isEditing) {
    return (
      <div className="bg-white shadow-soft-xl rounded-2xl p-4 border-2 border-primary-lighter relative space-y-3 animate-fade-in col-span-2 sm:col-span-1">
        <div>
          <label className="block text-xs font-semibold text-neutral-dark mb-1">Namn</label>
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-neutral">Kcal</label>
            <input type="number" value={editedCalories} onChange={createNumericHandler(setEditedCalories)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral">Protein</label>
            <input type="number" value={editedProtein} onChange={createNumericHandler(setEditedProtein)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral">Kolh</label>
            <input type="number" value={editedCarbs} onChange={createNumericHandler(setEditedCarbs)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral">Fett</label>
            <input type="number" value={editedFat} onChange={createNumericHandler(setEditedFat)} className={inputClass} />
          </div>
        </div>
        <div className="flex justify-end space-x-2 mt-2">
          <button onClick={() => setIsEditing(false)} className="p-2 text-neutral hover:bg-neutral-light rounded-full"><XMarkIcon className="w-5 h-5" /></button>
          <button onClick={handleSave} className="p-2 text-white bg-primary hover:bg-primary-darker rounded-full shadow-sm"><CheckIcon className="w-5 h-5" /></button>
        </div>
      </div>
    );
  }

  const { icon, bg, text } = getMealIcon(meal.name);

  return (
    <div className={`relative group bg-white rounded-2xl border border-neutral-light shadow-sm hover:shadow-md transition-all duration-200 ${disabled ? 'opacity-60' : ''}`}>
      {/* Menu Trigger */}
      <div className="absolute top-2 right-2 z-20">
        <button 
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="p-1.5 text-neutral-400 hover:text-neutral-dark rounded-full hover:bg-neutral-light transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
        
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-neutral-light z-30 animate-scale-in origin-top-right overflow-hidden">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowMenu(false); }}
              className="w-full text-left px-3 py-2 text-sm text-neutral-dark hover:bg-neutral-light flex items-center gap-2"
            >
              <PencilIcon className="w-3.5 h-3.5" /> Redigera
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(meal.id); setShowMenu(false); }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-neutral-light"
            >
              <TrashIcon className="w-3.5 h-3.5" /> Ta bort
            </button>
          </div>
        )}
      </div>

      {/* Main Clickable Area */}
      <button
        onClick={() => !disabled && !showMenu && onLog(meal)}
        disabled={disabled}
        className="w-full h-full p-4 flex flex-col items-center justify-center text-center cursor-pointer outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-2xl active:scale-95 transition-transform"
      >
        {/* Updated Icon Container with Squircle and dynamic color */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 shadow-sm ${bg} ${text}`}>
          {icon}
        </div>
        
        <h4 className="font-bold text-neutral-dark text-sm leading-tight mb-1 line-clamp-2 w-full">
          {meal.name}
        </h4>
        <p className="text-xs font-medium text-neutral-500 bg-neutral-light/50 px-2 py-0.5 rounded-full">
          {meal.nutritionalInfo.calories.toFixed(0)} kcal
        </p>
      </button>
      
      {/* Overlay click to close menu */}
      {showMenu && (
        <div className="fixed inset-0 z-10 cursor-default" onClick={() => setShowMenu(false)}></div>
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
      <div className="bg-white p-5 rounded-3xl shadow-soft-xl border border-neutral-light">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📌</span>
            <h3 className="text-lg font-bold text-neutral-dark">Mina vanliga val</h3>
          </div>
        </div>

        {disabled && commonMeals.length > 0 && (
          <p className="text-xs text-orange-500 text-center mb-4 bg-orange-50 p-2 rounded-lg border border-orange-100">
            Loggning av vanliga val är inaktiverad för detta datum.
          </p>
        )}
        
        {commonMeals.length === 0 ? (
           <div className="text-center py-8 bg-neutral-light/30 rounded-2xl border border-dashed border-neutral-light">
             <div className="text-4xl mb-2 opacity-50">🍽️</div>
             <p className="text-sm text-neutral font-medium">Inga sparade val än.</p>
             <p className="text-xs text-neutral-400 mt-1 px-4">
              Spara en måltid med <span className="inline-block bg-gray-100 rounded px-1 text-black">📌</span>-knappen för att se den här.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {commonMeals.map((meal) => (
              <CommonMealCard
                key={meal.timestamp}
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
                className="bg-white p-6 rounded-2xl shadow-soft-xl w-full max-w-sm animate-scale-in text-center"
                onClick={(e) => e.stopPropagation()} 
            >
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrashIcon className="w-8 h-8" />
                </div>
                <h3 id={`confirm-delete-common-title-${mealToConfirm.id}`} className="text-xl font-bold text-neutral-dark mb-2">Ta bort val?</h3>
                <p className="text-neutral mb-6 text-sm">
                    Är du säker på att du vill ta bort <strong>"{mealToConfirm.name}"</strong>? Du kan inte ångra detta.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => setMealIdToConfirmDelete(null)}
                        className="flex-1 px-4 py-3 text-neutral-dark bg-neutral-light hover:bg-gray-200 rounded-xl font-semibold active:scale-95 transition-all"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleConfirmDelete}
                        className="flex-1 px-4 py-3 text-white bg-red-500 hover:bg-red-600 rounded-xl font-semibold shadow-lg shadow-red-200 active:scale-95 transition-all"
                    >
                        Ta bort
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default CommonMealsList;
