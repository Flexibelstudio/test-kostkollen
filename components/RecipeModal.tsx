
import React, { useState, useEffect, FC, useMemo } from 'react';
import { RecipeSuggestion, NutritionalInfo, MealType } from '../types';
import { SearchIcon, XMarkIcon, CheckIcon as LogIcon, RecipeIcon as TitleIcon, InformationCircleIcon, ShareIcon, ChevronDownIcon } from './icons';
import { playAudio } from '../services/audioService';
import MealTypeSelector from './MealTypeSelector';

interface RecipeModalProps {
  show: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<void>;
  onLogRecipe: (nutritionalInfo: NutritionalInfo, mealType: MealType) => void;
  recipe: RecipeSuggestion | null;
  isLoading: boolean;
  error: string | null;
  isLoggingDisabled?: boolean;
  recentSearches: string[];
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  defaultMealType?: MealType;
}

const parseServings = (servingsStr: string | undefined): number => {
  if (!servingsStr) return 1;
  const match = servingsStr.match(/(\d+(\.\d+)?)/);
  if (match && match[1]) {
    const num = parseFloat(match[1]);
    return num > 0 ? num : 1;
  }
  return 1;
};

const AccordionSection: FC<{
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ title, children, isOpen, onToggle }) => (
  <div className="border-b border-neutral-light/70">
    <button
      onClick={onToggle}
      className="w-full flex justify-between items-center py-4 text-left group"
      aria-expanded={isOpen}
    >
      <h4 className="text-lg font-semibold text-neutral-dark group-hover:text-primary transition-colors">{title}</h4>
      <ChevronDownIcon
        className={`w-6 h-6 text-neutral-dark transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
    {isOpen && (
      <div className="pb-4 text-neutral-dark animate-fade-in">
        {children}
      </div>
    )}
  </div>
);

const RecipeModal: React.FC<RecipeModalProps> = ({
  show,
  onClose,
  onSearch,
  onLogRecipe,
  recipe,
  isLoading,
  error,
  isLoggingDisabled = false,
  recentSearches,
  setToastNotification,
  defaultMealType = 'dinner'
}) => {
  const [query, setQuery] = useState('');
  const [portionsToLog, setPortionsToLog] = useState<string>("1");
  const [canShare, setCanShare] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['recipe-and-instructions']));
  const [selectedMealType, setSelectedMealType] = useState<MealType>(defaultMealType);


  useEffect(() => {
    if (typeof navigator.share === 'function') {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
      setSelectedMealType(defaultMealType);
  }, [defaultMealType, show]);

  useEffect(() => {
    if (recipe && !recipe.error) {
      setPortionsToLog("1");
      setExpandedSections(new Set(['recipe-and-instructions']));
    }
  }, [recipe]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleRecentSearchClick = (searchTerm: string) => {
    playAudio('uiClick');
    setQuery(searchTerm);
    onSearch(searchTerm);
  };
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
        const newSet = new Set(prev);
        if (newSet.has(section)) {
            newSet.delete(section);
        } else {
            newSet.add(section);
        }
        return newSet;
    });
};


  const handleAdjustPortions = (direction: 'increase' | 'decrease') => {
    const amount = 0.5;
    const currentValue = parseFloat(portionsToLog.replace(',', '.')) || 0;
    let newValue = direction === 'increase' ? currentValue + amount : currentValue - amount;
    newValue = Math.max(0.5, Math.round(newValue * 10) / 10);
    setPortionsToLog(String(newValue));
  };


  const handleLog = () => {
    if (recipe && !recipe.error) {
      const recipeBaseServings = parseServings(recipe.servings);
      const numPortionsToLog = parseFloat(portionsToLog.replace(',', '.')) || 1;

      if (numPortionsToLog <= 0) {
        setToastNotification({ message: "Antal portioner måste vara större än 0.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
        return;
      }
      
      const { totalNutritionalInfo, title } = recipe;

      const loggedNutritionalInfo: NutritionalInfo = {
        foodItem: `${title} (${numPortionsToLog.toLocaleString('sv-SE')} port.)`,
        calories: Math.round((totalNutritionalInfo.calories / recipeBaseServings) * numPortionsToLog),
        protein: Math.round((totalNutritionalInfo.protein / recipeBaseServings) * numPortionsToLog),
        carbohydrates: Math.round((totalNutritionalInfo.carbohydrates / recipeBaseServings) * numPortionsToLog),
        fat: Math.round((totalNutritionalInfo.fat / recipeBaseServings) * numPortionsToLog),
      };
      onLogRecipe(loggedNutritionalInfo, selectedMealType);
    }
  };

  const handleShareRecipe = async () => {
    if (!recipe || recipe.error || !navigator.share) {
      setToastNotification({ message: "Kan inte dela recept just nu eller så stöds inte delning.", type: 'error' });
      setTimeout(() => setToastNotification(null), 3000);
      return;
    }
    playAudio('uiClick');

    const ingredientsText = recipe.ingredients.map(ing => `- ${ing.item}`).join('\n');
    const instructionsText = recipe.instructions.map((step, idx) => `${idx + 1}. ${step}`).join('\n');
    
    const shareData = {
      title: `Recept: ${recipe.title}`,
      text: `${recipe.description}\n\nFörberedelsetid: ${recipe.prepTime}\nTillagningstid: ${recipe.cookTime}\nPortioner: ${recipe.servings}\n\nIngredienser:\n${ingredientsText}\n\nInstruktioner:\n${instructionsText}\n${recipe.chefTip ? `\nKockens tips: ${recipe.chefTip}\n` : '\n'}Delat från Kostloggen.se`,
    };

    try {
      await navigator.share(shareData);
    } catch (err) {
      console.error('Error sharing recipe:', err);
      setToastNotification({ message: "Kunde inte dela receptet. Försök igen.", type: 'error' });
      setTimeout(() => setToastNotification(null), 3000);
    }
  };

  const recipeServings = useMemo(() => parseServings(recipe?.servings), [recipe?.servings]);

  if (!show) return null;

  // FIX: Changed 'icon' type from JSX.Element to React.ReactNode to resolve namespace error.
  const renderNutrient = (label: string, value: number | undefined, unit: string, icon: React.ReactNode) => (
    <div className="flex items-center text-sm text-neutral-dark">
      {icon}
      <span className="ml-1.5">{label}: {value !== undefined ? Math.round(value) : '?'} {unit}</span>
    </div>
  );
  
  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-modal-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center">
            <TitleIcon className="w-7 h-7 text-primary mr-2.5" />
            <h2 id="recipe-modal-title" className="text-2xl font-semibold text-neutral-dark">
              Receptidéer
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
            aria-label="Stäng receptsökning"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="mb-5 flex-shrink-0">
          <label htmlFor="recipeQuery" className="sr-only">Sök recept (t.ex. "lätt kycklingpasta")</label>
          <div className="flex gap-2">
            <input
              type="text"
              id="recipeQuery"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Vad vill du laga?"
              className="flex-grow w-full px-4 py-2.5 bg-white border border-neutral-light rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-base"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="flex-shrink-0 px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-lg shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center interactive-transition"
            >
              <SearchIcon className={`w-5 h-5 ${isLoading ? 'hidden' : 'inline sm:mr-2'}`} />
              <span className={`hidden sm:inline ${isLoading ? 'hidden' : 'inline'}`}>Sök</span>
              {isLoading && (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              )}
            </button>
          </div>
        </form>

        <div className="overflow-y-auto custom-scrollbar flex-grow min-h-[200px] -mr-4 pr-4">
          {isLoading && !recipe && !error && (
            <div className="flex flex-col items-center justify-center h-full text-neutral-dark py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-secondary mb-4"></div>
              <p className="text-lg">Letar efter smarriga recept...</p>
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md text-center">
              <p className="font-medium">Ett fel uppstod:</p>
              <p>{error}</p>
            </div>
          )}
           {!recipe && !error && !isLoading && recentSearches.length > 0 && (
            <div className="mb-4">
              <h4 className="text-md font-semibold text-neutral-dark mb-2">Tidigare sökningar:</h4>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((searchTerm, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRecentSearchClick(searchTerm)}
                    className="px-3 py-1.5 bg-neutral-light hover:bg-gray-300 text-neutral-dark rounded-md text-sm shadow-sm active:scale-95 interactive-transition"
                  >
                    {searchTerm}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!recipe && !error && !isLoading && recentSearches.length === 0 && (
            <p className="text-neutral text-center py-4">Inga tidigare sökningar.</p>
          )}

          {recipe && recipe.error && (
             <div className="p-4 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-center">
                <p className="font-medium">Förtydliga din fråga:</p>
                <p>{recipe.error}</p>
            </div>
          )}
          {recipe && !recipe.error && (
            <div className="space-y-1 animate-fade-in">
                <div className="text-center mb-4">
                    <h3 className="text-2xl font-bold text-neutral-darker">{recipe.title}</h3>
                    <p className="text-base text-neutral-dark italic">{recipe.description}</p>
                </div>
              
                <AccordionSection title="Översikt & Näringsinnehåll" isOpen={expandedSections.has('nutrition')} onToggle={() => toggleSection('nutrition')}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-neutral-dark">
                            <p><strong>Förberedelse:</strong> {recipe.prepTime}</p>
                            <p><strong>Tillagning:</strong> {recipe.cookTime}</p>
                            <p><strong>Portioner:</strong> {recipe.servings}</p>
                        </div>
                        {recipe.totalNutritionalInfo && (
                            <div>
                                <h4 className="text-md font-semibold text-neutral-dark mb-2">Näringsvärde (per portion):</h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-neutral-light p-3 rounded-md">
                                  {renderNutrient("Kalorier", recipe.totalNutritionalInfo.calories / recipeServings, "kcal", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>)}
                                  {renderNutrient("Protein", recipe.totalNutritionalInfo.protein / recipeServings, "g", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Protein">💪</span>)}
                                  {renderNutrient("Kolhydrater", recipe.totalNutritionalInfo.carbohydrates / recipeServings, "g", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>)}
                                  {renderNutrient("Fett", recipe.totalNutritionalInfo.fat / recipeServings, "g", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>)}
                                </div>
                            </div>
                        )}
                        {recipe.chefTip && (
                            <div className="p-3 bg-primary-100/60 rounded-md border border-primary-200">
                                <p className="text-sm font-medium text-primary-darker flex items-start">
                                <InformationCircleIcon className="w-5 h-5 mr-1.5 flex-shrink-0 mt-0.5" />
                                <span><strong>Kockens tips:</strong> {recipe.chefTip}</span>
                                </p>
                            </div>
                        )}
                    </div>
                </AccordionSection>

                <AccordionSection title="Recept & Instruktioner" isOpen={expandedSections.has('recipe-and-instructions')} onToggle={() => toggleSection('recipe-and-instructions')}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-lg font-semibold text-neutral-dark mb-2">Ingredienser:</h4>
                            <ul className="list-disc list-inside space-y-1 text-neutral-dark pl-2">
                            {recipe.ingredients.map((ing, idx) => (
                                <li key={idx}>{ing.item}</li>
                            ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-neutral-dark mb-2">Instruktioner:</h4>
                            <ol className="list-decimal list-inside space-y-3 text-neutral-dark pl-2">
                            {recipe.instructions.map((step, idx) => (
                                <li key={idx} className="pl-1">{step}</li>
                            ))}
                            </ol>
                        </div>
                    </div>
                </AccordionSection>
            </div>
          )}
        </div>

        {recipe && !recipe.error && (
          <div className="mt-6 flex flex-col gap-4 flex-shrink-0 pt-4 border-t border-neutral-light/70">
            {/* Meal Type Selection */}
            <div>
                <label className="block text-sm font-medium text-neutral-dark mb-1">Måltidstyp</label>
                <MealTypeSelector selectedType={selectedMealType} onSelect={setSelectedMealType} />
            </div>

            <div className="flex flex-row gap-2 justify-between items-center">
                {/* Share button */}
                <button
                type="button"
                onClick={handleShareRecipe}
                disabled={isLoading || !canShare}
                className="h-11 w-11 flex items-center justify-center bg-primary text-white rounded-lg shadow-sm active:scale-95 disabled:opacity-50 interactive-transition"
                title={!canShare ? "Dela stöds inte i din webbläsare" : "Dela receptet"}
                >
                <ShareIcon className="w-6 h-6" />
                </button>
                
                {/* Stepper and Log button group */}
                <div className="flex items-center gap-2">
                <button 
                    type="button" 
                    onClick={() => handleAdjustPortions('decrease')} 
                    className="h-11 w-11 flex items-center justify-center bg-neutral-light text-neutral-dark text-2xl rounded-lg shadow-sm active:scale-95 disabled:opacity-50 interactive-transition"
                    aria-label="Minska antal portioner"
                    disabled={isLoggingDisabled || isLoading}
                >
                    -
                </button>
                <input
                    type="text"
                    value={portionsToLog}
                    onChange={(e) => {
                        const val = e.target.value.replace(',', '.');
                        if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setPortionsToLog(val);
                        }
                    }}
                    inputMode="decimal"
                    className="h-11 w-11 text-center text-lg font-bold bg-white border border-neutral-light rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="1"
                    disabled={isLoggingDisabled || isLoading}
                    aria-label="Antal portioner"
                />
                <button 
                    type="button" 
                    onClick={() => handleAdjustPortions('increase')} 
                    className="h-11 w-11 flex items-center justify-center bg-neutral-light text-neutral-dark text-2xl rounded-lg shadow-sm active:scale-95 disabled:opacity-50 interactive-transition"
                    aria-label="Öka antal portioner"
                    disabled={isLoggingDisabled || isLoading}
                >
                    +
                </button>
            
                <button
                    type="button"
                    onClick={handleLog}
                    disabled={isLoggingDisabled || isLoading || !portionsToLog.trim() || parseFloat(portionsToLog.replace(',', '.')) <=0}
                    className="h-11 w-11 flex items-center justify-center bg-secondary text-white rounded-lg shadow-sm active:scale-95 disabled:opacity-50 interactive-transition"
                    title={isLoggingDisabled ? "Loggning är endast tillgänglig för idag" : parseFloat(portionsToLog.replace(',', '.')) <=0 ? "Ange ett giltigt antal portioner" : "Logga specificerat antal portioner"}
                >
                    <LogIcon className="w-6 h-6" />
                </button>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeModal;
