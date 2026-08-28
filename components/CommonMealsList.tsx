
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CommonMeal, NutritionalInfo } from '../types.ts';
import { CheckIcon, XMarkIcon, PencilIcon, TrashIcon, SmileIcon, BookmarkIcon, ArrowRightIcon } from './icons.tsx';
import { 
  MoreHorizontal, 
  Soup, Egg, Sandwich, CupSoda, Drumstick, Beef, Fish, Salad, Carrot,
  Pizza, Coffee, Cake, Cookie, IceCream, Apple, Utensils, Croissant, Wine
} from 'lucide-react';
import { resolveUpdatedNutrients } from '../utils/nutritionTotals.ts';
import { fileToSquareThumbnail } from '../utils/imageUtils.ts';

interface CommonMealsListProps {
  commonMeals: CommonMeal[];
  onLogCommonMeal: (commonMeal: CommonMeal) => void;
  onDeleteCommonMeal: (commonMealId: string) => void;
  onUpdateCommonMeal: (commonMealId: string, updatedData: { name: string; nutritionalInfo: NutritionalInfo; imageUrl?: string | null }) => void;
  onShowRating?: (nutritionalInfo: NutritionalInfo) => void;
  disabled?: boolean;
  isBootcamp?: boolean;
  /** true = rendera utan eget vitt kort (inbäddad i annat kort, t.ex. under makrostaplarna) */
  embedded?: boolean;
}

// Helper to match a Lucide icon and color theme based on the meal name
const getMealIcon = (name: string) => {
  const n = name.toLowerCase();
  const iconProps = { className: "w-6 h-6", strokeWidth: 2 };
  const defaultTheme = { bg: 'bg-[#F6E2D9]', text: 'text-[#D96E4A]' };

  // Drinks (Coffee/Tea)
  if (n.includes('kaffe') || n.includes('te ') || n.includes('latte') || n.includes('espresso') || n.includes('cappuccino')) {
    return { icon: <Coffee {...iconProps} />, ...defaultTheme };
  }
  
  // Drinks (Cold)
  if (n.includes('smoothie') || n.includes('shake') || n.includes('dryck') || n.includes('vatten') || n.includes('juice') || n.includes('läsk') || n.includes('saft') || n.includes('mjölk')) {
    return { icon: <CupSoda {...iconProps} />, ...defaultTheme };
  }
  
  // Alcohol
  if (n.includes('öl') || n.includes('vin') || n.includes('cider') || n.includes('bubbel')) {
     return { icon: <Wine {...iconProps} />, ...defaultTheme };
  }

  // Breakfast / Porridge / Dairy
  if (n.includes('gröt') || n.includes('havre') || n.includes('oat') || n.includes('soppa') || n.includes('yoghurt') || n.includes('fil') || n.includes('kvarg') || n.includes('bowl') || n.includes('flingor') || n.includes('müsli')) {
    return { icon: <Soup {...iconProps} />, ...defaultTheme }; 
  }

  // Eggs
  if (n.includes('ägg') || n.includes('omelett') || n.includes('kokt')) {
    return { icon: <Egg {...iconProps} />, ...defaultTheme };
  }

  // Bread / Sandwiches
  if (n.includes('bröd') || n.includes('macka') || n.includes('toast') || n.includes('smörgås') || n.includes('knäcke') || n.includes('baguette') || n.includes('fralla')) {
    return { icon: <Sandwich {...iconProps} />, ...defaultTheme };
  }
  if (n.includes('croissant') || n.includes('bulle') || n.includes('wiener')) {
      return { icon: <Croissant {...iconProps} />, ...defaultTheme };
  }

  // Poultry
  if (n.includes('kyckling') || n.includes('fågel') || n.includes('kalkon') || n.includes('anka')) {
    return { icon: <Drumstick {...iconProps} />, ...defaultTheme };
  }

  // Meat
  if (n.includes('kött') || n.includes('biff') || n.includes('burgare') || n.includes('färs') || n.includes('korv') || n.includes('stek') || n.includes('skinka') || n.includes('bacon')) {
    return { icon: <Beef {...iconProps} />, ...defaultTheme };
  }

  // Fish/Seafood
  if (n.includes('fisk') || n.includes('lax') || n.includes('torsk') || n.includes('räkor') || n.includes('skaldjur') || n.includes('tonfisk') || n.includes('sushi')) {
    return { icon: <Fish {...iconProps} />, ...defaultTheme };
  }

  // Green / Veg
  if (n.includes('sallad') || n.includes('grönsak') || n.includes('vegetarisk') || n.includes('vegan') || n.includes('avokado') || n.includes('böna') || n.includes('lins')) {
    return { icon: <Salad {...iconProps} />, ...defaultTheme };
  }
  if (n.includes('morot') || n.includes('rotfrukt') || n.includes('potatis')) {
      return { icon: <Carrot {...iconProps} />, ...defaultTheme };
  }

  // Pizza / Fast food
  if (n.includes('pizza') || n.includes('taco') || n.includes('kebab')) {
    return { icon: <Pizza {...iconProps} />, ...defaultTheme };
  }

  // Sweets
  if (n.includes('kaka') || n.includes('tårta') || n.includes('bakelse')) {
    return { icon: <Cake {...iconProps} />, ...defaultTheme };
  }
  if (n.includes('kex') || n.includes('cookie') || n.includes('godis') || n.includes('choklad')) {
    return { icon: <Cookie {...iconProps} />, ...defaultTheme };
  }
  if (n.includes('glass') || n.includes('sorbet')) {
      return { icon: <IceCream {...iconProps} />, ...defaultTheme };
  }

  // Fruit
  if (n.includes('äpple') || n.includes('banan') || n.includes('frukt') || n.includes('bär') || n.includes('päron') || n.includes('apelsin')) {
    return { icon: <Apple {...iconProps} />, ...defaultTheme };
  }

  // Default
  return { icon: <Utensils {...iconProps} />, ...defaultTheme };
};

const CommonMealCard: React.FC<{
  meal: CommonMeal;
  onLog: (meal: CommonMeal) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { name: string; nutritionalInfo: NutritionalInfo; imageUrl?: string | null }) => void;
  onShowRating?: (nutritionalInfo: NutritionalInfo) => void;
  disabled: boolean;
  isBootcamp?: boolean;
}> = ({ meal, onLog, onDelete, onUpdate, onShowRating, disabled, isBootcamp }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // Korten ligger i en vagratt scrollande behallare. En meny som ritas inuti
  // kortet klipps darfor bort vid kortkanten - den maste ut ur flodet helt.
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const openMenu = () => {
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setShowMenu(true);
  };

  // Edit state
  const [editedName, setEditedName] = useState(meal.name);
  const [editedCalories, setEditedCalories] = useState(Math.round(meal.nutritionalInfo.calories).toString());
  const [editedProtein, setEditedProtein] = useState(Math.round(meal.nutritionalInfo.protein).toString());
  const [editedCarbs, setEditedCarbs] = useState(Math.round(meal.nutritionalInfo.carbohydrates).toString());
  const [editedFat, setEditedFat] = useState(Math.round(meal.nutritionalInfo.fat).toString());
  const [editedImage, setEditedImage] = useState<string | null>(meal.imageUrl || null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditedName(meal.name);
      setEditedCalories(Math.round(meal.nutritionalInfo.calories).toString());
      setEditedProtein(Math.round(meal.nutritionalInfo.protein).toString());
      setEditedCarbs(Math.round(meal.nutritionalInfo.carbohydrates).toString());
      setEditedFat(Math.round(meal.nutritionalInfo.fat).toString());
      setEditedImage(meal.imageUrl || null);
      setImageError(null);
    }
  }, [isEditing, meal]);

  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageBusy(true);
    setImageError(null);
    try {
      setEditedImage(await fileToSquareThumbnail(file));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Bilden kunde inte läsas in.');
    } finally {
      setImageBusy(false);
    }
  };

  const handleSave = () => {
    const updatedNutrients = resolveUpdatedNutrients(meal.nutritionalInfo, {
      foodItem: meal.nutritionalInfo.foodItem,
      calories: editedCalories,
      protein: editedProtein,
      carbohydrates: editedCarbs,
      fat: editedFat,
    });
    const updatedData = {
      name: editedName.trim(),
      nutritionalInfo: {
        ...updatedNutrients,
        foodItem: editedName.trim(),
      },
      // null i stallet for undefined - undefined stryks bort innan skrivningen,
      // och da hade en borttagen bild aldrig raderats i databasen.
      imageUrl: editedImage ?? null,
    };
    onUpdate(meal.id, updatedData);
    setIsEditing(false);
    setShowMenu(false);
  };

  const createNumericHandler = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(',', '.');
      if (val === '') { setter('0'); return; }
      if (/^\d*\.?\d*$/.test(val)) { setter(val); }
    };
  };

  const inputClass = "block w-full px-2 py-1.5 bg-neutral-light/50 border border-neutral-light rounded-md text-sm focus:ring-primary focus:border-primary";

  if (isEditing) {
    // Redigeringen lag tidigare inuti sjalva kortet. Nar korten blev lagre fick
    // sex falt samsas om 118 px och formularet blev obrukbart. Den ligger nu
    // som en egen ruta ovanpa sidan i stallet.
    return createPortal(
      <div
        className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[130] p-4 animate-fade-in"
        onClick={() => setIsEditing(false)}
        role="dialog"
        aria-modal="true"
      >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white shadow-soft-xl rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto space-y-3 animate-scale-in">
        <h3 className="text-lg font-serif font-medium text-[#56524D] mb-1">Redigera vanligt val</h3>

        {/* Bilden ar frivillig. Ett foto gor valet mycket snabbare att hitta i
            raden an ett generiskt ikonval. */}
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F1EAE0] border border-neutral-light flex items-center justify-center flex-shrink-0">
            {editedImage ? (
              <img src={editedImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <Utensils className="w-6 h-6 text-[#D96E4A]/60" />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={imageBusy}
              className="text-sm font-semibold text-primary hover:text-primary-darker text-left disabled:opacity-50"
            >
              {imageBusy ? 'Läser in…' : editedImage ? 'Byt bild' : 'Lägg till bild'}
            </button>
            {editedImage && !imageBusy && (
              <button
                type="button"
                onClick={() => setEditedImage(null)}
                className="text-sm text-neutral-500 hover:text-red-600 text-left"
              >
                Ta bort bild
              </button>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            ref={imageInputRef}
            onChange={handleImageSelected}
            className="hidden"
            aria-hidden="true"
          />
        </div>
        {imageError && <p className="text-xs text-red-600">{imageError}</p>}
        <div>
          <label className="block text-xs font-semibold text-neutral-dark mb-1">Namn</label>
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className={inputClass}
          />
        </div>
        {meal.nutritionalInfo.foodItem && (
          <div className="bg-neutral-light/30 p-2 rounded-lg border border-neutral-light">
            <label className="block text-xs uppercase tracking-wider font-bold text-neutral-500 mb-0.5">Ursprungligt innehåll</label>
            <p className="text-xs text-neutral-dark italic break-words">{meal.nutritionalInfo.foodItem}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-neutral">Kcal</label>
            <input type="number" min="0" step="any" value={editedCalories} onChange={createNumericHandler(setEditedCalories)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral">Protein</label>
            <input type="number" min="0" step="any" value={editedProtein} onChange={createNumericHandler(setEditedProtein)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral">Kolh</label>
            <input type="number" min="0" step="any" value={editedCarbs} onChange={createNumericHandler(setEditedCarbs)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral">Fett</label>
            <input type="number" min="0" step="any" value={editedFat} onChange={createNumericHandler(setEditedFat)} className={inputClass} />
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          {onShowRating && (
            <button 
              onClick={() => onShowRating(meal.nutritionalInfo)} 
              className="text-xs font-semibold text-primary hover:text-primary-darker flex items-center gap-1"
            >
              <SmileIcon className="w-4 h-4" /> Se matbetyg
            </button>
          )}
          <div className="flex justify-end space-x-2 ml-auto">
            <button onClick={() => setIsEditing(false)} className="p-2 text-neutral hover:bg-neutral-light rounded-full" aria-label="Avbryt"><XMarkIcon className="w-5 h-5" /></button>
            <button onClick={handleSave} className="p-2 text-white bg-primary hover:bg-primary-darker rounded-full shadow-sm" aria-label="Spara"><CheckIcon className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
      </div>,
      document.body
    );
  }

  const { icon, bg, text } = getMealIcon(meal.name);

  return (
    <div className={`relative group w-full h-[118px] snap-start ${'bg-white'} rounded-2xl border border-neutral-light shadow-soft-sm hover:shadow-soft-md transition-all duration-200 ${disabled ? 'opacity-60' : ''}`}>
      {/* Menu Trigger */}
      <div className="absolute top-2 right-2 z-20">
        <button
          ref={menuButtonRef}
          onClick={(e) => { e.stopPropagation(); showMenu ? setShowMenu(false) : openMenu(); }}
          className="p-1.5 text-neutral-400 hover:text-neutral-dark rounded-full hover:bg-neutral-light transition-colors"
          aria-label={`Alternativ för ${meal.name}`}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Menyn ritas i body med fast position, annars klipps den av kortet
          och av den vagratt scrollande raden runt omkring. */}
      {showMenu && menuPosition && createPortal(
        <>
          <div className="fixed inset-0 z-[130]" onClick={() => setShowMenu(false)} />
          <div
            className="fixed w-36 bg-white rounded-xl shadow-soft-xl border border-neutral-light z-[131] animate-scale-in origin-top-right overflow-hidden"
            style={{ top: menuPosition.top, right: menuPosition.right }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowMenu(false); }}
              className="w-full text-left px-3 py-2.5 text-sm text-neutral-dark hover:bg-neutral-light flex items-center gap-2"
            >
              <PencilIcon className="w-3.5 h-3.5" /> Redigera
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(meal.id); setShowMenu(false); }}
              className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-neutral-light"
            >
              <TrashIcon className="w-3.5 h-3.5" /> Ta bort
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Main Clickable Area */}
      <button
        onClick={() => !disabled && !showMenu && onLog(meal)}
        disabled={disabled}
        className="w-full h-full px-3 py-2.5 flex flex-col items-center justify-center text-center cursor-pointer outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-2xl active:scale-95 transition-transform"
      >
        {/* Updated Icon Container with Squircle and dynamic color */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 shadow-soft-sm shrink-0 overflow-hidden ${meal.imageUrl ? 'bg-[#F1EAE0]' : `${bg} ${text}`}`}>
          {meal.imageUrl ? (
            <img src={meal.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            icon
          )}
        </div>
        
        <h4 className="font-bold text-neutral-dark text-sm leading-tight mb-1 line-clamp-2 w-full break-words">
          {meal.name}
        </h4>
        <p className="text-xs font-medium text-neutral-500 bg-neutral-light/50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
          {meal.nutritionalInfo.calories.toFixed(0)} kcal
        </p>
      </button>
      
    </div>
  );
};

export const CommonMealsList: React.FC<CommonMealsListProps> = ({ commonMeals, onLogCommonMeal, onDeleteCommonMeal, onUpdateCommonMeal, onShowRating, disabled = false, isBootcamp = false, embedded = false }) => {
  const [mealIdToConfirmDelete, setMealIdToConfirmDelete] = useState<string | null>(null);

  const handleDeleteRequest = (mealId: string) => {
    setMealIdToConfirmDelete(mealId);
  };
  
  const handleConfirmDelete = () => {
    if (mealIdToConfirmDelete) {
      onDeleteCommonMeal(mealIdToConfirmDelete);
      setMealIdToConfirmDelete(null);
    }
  };
  
  const handleLogClick = (meal: CommonMeal) => {
    if (disabled) return;
    onLogCommonMeal(meal);
  };

  // Mest använda först. Vid lika antal: senast använd, därefter nyast sparad.
  // Val som aldrig loggats (useCount saknas) hamnar sist men behåller inbördes ordning.
  const sortedMeals = useMemo(() => {
    return [...commonMeals].sort((a, b) => {
      const countDiff = (b.useCount || 0) - (a.useCount || 0);
      if (countDiff !== 0) return countDiff;
      const usedDiff = (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
      if (usedDiff !== 0) return usedDiff;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [commonMeals]);

  // Vid få val ska rutan krympa: 1-3 val ryms på en rad, fler staplas i två.
  // Grid-klasserna måste vara kompletta strängar - Tailwind kan inte tolka ihopsatta klassnamn.
  const rowsClass = sortedMeals.length <= 3 ? 'grid-rows-1' : 'grid-rows-2';
  // Två kolumner får plats. Fler kort än så betyder att raden går att scrolla,
  // och det måste synas - annars tror användaren att listan tar slut vid kort två.
  const visibleColumns = 2;
  const rowCount = sortedMeals.length <= 3 ? 1 : 2;
  const isScrollable = sortedMeals.length > visibleColumns * rowCount;

  const mealToConfirm = mealIdToConfirmDelete ? commonMeals.find(cm => cm.id === mealIdToConfirmDelete) : null;

  return (
    <>
      <div className={embedded
        ? 'w-full'
        : `${'bg-white dark:bg-[#2B2825] border-[#F1EAE0] dark:border-[#484440]'} p-6 rounded-[22px] shadow-soft-xl border`}>
        <div className={`flex items-center justify-between ${embedded ? 'mb-2.5' : 'mb-4'}`}>
          <div className="flex items-center gap-2.5">
            <BookmarkIcon className={`${embedded ? 'w-4 h-4' : 'w-5 h-5'} text-[#D96E4A]`} />
            <h3 className={`${embedded ? 'text-sm font-bold uppercase tracking-wider text-[#7A756E]' : 'text-lg font-serif font-medium text-[#56524D]'} dark:text-[#FAF6EF]`}>Mina vanliga val</h3>
          </div>
        </div>

        {disabled && commonMeals.length > 0 && (
          <p className="text-xs text-[#D96E4A] text-center mb-4 bg-[#F6E2D9] p-2.5 rounded-xl border border-[#EAC5B8]">
            Loggning av vanliga val är inaktiverad för detta datum.
          </p>
        )}
        
        {commonMeals.length === 0 ? (
           <div className={`text-center bg-[#FAF6EF] dark:bg-[#34302C] rounded-[22px] border border-[#F1EAE0] dark:border-[#484440] ${embedded ? 'py-3 px-3' : 'py-8 px-4'}`}>
             <Utensils className={`text-[#D96E4A]/60 mx-auto ${embedded ? 'w-5 h-5 mb-1' : 'w-8 h-8 mb-2'}`} />
             <p className={`text-[#56524D] dark:text-[#FAF6EF] font-medium ${embedded ? 'text-xs' : 'text-base'}`}>Inga sparade val än.</p>
             {!embedded && (
               <p className="text-sm text-[#7A756E] dark:text-[#C2BCB4] mt-1 max-w-xs mx-auto leading-relaxed">
                Spara din favoritmåltid med spar-knappen när du loggat för att snabbt hitta den här igen.
              </p>
             )}
          </div>
        ) : (
          <div className="relative">
            <div className={`grid ${rowsClass} grid-flow-col auto-cols-[calc(50%-0.3125rem)] items-start gap-2.5 overflow-x-auto snap-x snap-mandatory scrollbar-none no-scrollbar -mx-1 px-1 pb-2`}>
            {sortedMeals.map((meal) => (
              <CommonMealCard
                key={meal.id}
                meal={meal}
                onLog={handleLogClick}
                onDelete={handleDeleteRequest}
                onUpdate={onUpdateCommonMeal}
                onShowRating={onShowRating}
                disabled={disabled}
                isBootcamp={isBootcamp}
              />
            ))}
            </div>

            {isScrollable && (
              <>
                {/* Toning i högerkanten så att nästa kort tydligt fortsätter utanför bild */}
                <div className="pointer-events-none absolute top-0 right-0 h-full w-10 bg-gradient-to-l from-white dark:from-[#2B2825] to-transparent" />
                <p className="flex items-center justify-end gap-1 text-[11px] font-medium text-[#7A756E] dark:text-[#C2BCB4] mt-0.5 pr-1">
                  Dra i sidled för fler
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </p>
              </>
            )}
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
