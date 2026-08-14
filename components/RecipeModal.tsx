import React, { useState, useEffect, FC, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { RecipeSuggestion, NutritionalInfo, MealType } from '../types';
import { SearchIcon, XMarkIcon, CheckIcon as LogIcon, RecipeIcon as TitleIcon, InformationCircleIcon, ShareIcon, ChevronDownIcon, BookmarkIcon, CheckIcon } from './icons';
import MealTypeSelector from './MealTypeSelector';

interface RecipeModalProps {
  show: boolean;
  onClose: () => void;
  onSearch?: (query: string) => Promise<void>;
  onLogRecipe: (nutritionalInfo: NutritionalInfo, options: { saveAsCommon: boolean, mealType: MealType }) => void;
  recipe: RecipeSuggestion | null;
  isLoading?: boolean;
  error?: string | null;
  isLoggingDisabled?: boolean;
  recentSearches?: string[];
  setToastNotification?: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  defaultMealType?: MealType | null;
  hideSearch?: boolean;
  onSaveRecipe?: (recipe: RecipeSuggestion) => void;
  isSaved?: boolean;
  onShareRecipe?: (recipeText: string) => void;
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
  isLoading = false,
  error = null,
  isLoggingDisabled = false,
  recentSearches = [],
  setToastNotification,
  defaultMealType = null,
  hideSearch = false,
  onSaveRecipe,
  isSaved = false,
  onShareRecipe
}) => {
  const [query, setQuery] = useState('');
  const [portionsToLog, setPortionsToLog] = useState<string>("1");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['recipe-and-instructions']));
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(defaultMealType);

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
    if (query.trim() && onSearch) {
      onSearch(query.trim());
    }
  };

  const handleRecentSearchClick = (searchTerm: string) => {
    setQuery(searchTerm);
    if (onSearch) {
      onSearch(searchTerm);
    }
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


  const extractNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const match = val.match(/[\d.,]+/);
      if (match) {
        return parseFloat(match[0].replace(',', '.'));
      }
    }
    return 0;
  };

  const handleLog = () => {
    if (recipe && !recipe.error) {
      if (!selectedMealType) return; // Should be disabled, but safety check

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
        calories: Math.round(extractNumber(totalNutritionalInfo.calories) * numPortionsToLog),
        protein: Math.round(extractNumber(totalNutritionalInfo.protein) * numPortionsToLog),
        carbohydrates: Math.round(extractNumber(totalNutritionalInfo.carbohydrates) * numPortionsToLog),
        fat: Math.round(extractNumber(totalNutritionalInfo.fat) * numPortionsToLog),
      };
      onLogRecipe(loggedNutritionalInfo, { saveAsCommon: false, mealType: selectedMealType });
      onClose(); // Close modal immediately after logging
    }
  };

  const handleShareRecipe = async () => {
    if (!recipe || recipe.error) {
      setToastNotification({ message: "Kan inte dela recept just nu.", type: 'error' });
      setTimeout(() => setToastNotification(null), 3000);
      return;
    }

    const ingredientsText = recipe.ingredients.map(ing => `- ${ing.item}`).join('\n');
    const instructionsText = recipe.instructions.map((step, idx) => `${idx + 1}. ${step}`).join('\n');
    
    const recipeServings = parseServings(recipe.servings);
    const kcal = recipe.totalNutritionalInfo ? Math.round(extractNumber(recipe.totalNutritionalInfo.calories)) : '?';
    const protein = recipe.totalNutritionalInfo ? Math.round(extractNumber(recipe.totalNutritionalInfo.protein)) : '?';
    const carbs = recipe.totalNutritionalInfo ? Math.round(extractNumber(recipe.totalNutritionalInfo.carbohydrates)) : '?';
    const fat = recipe.totalNutritionalInfo ? Math.round(extractNumber(recipe.totalNutritionalInfo.fat)) : '?';

    const macrosText = `Näringsvärde per portion:\nKalorier: ${kcal} kcal\nProtein: ${protein} g\nKolhydrater: ${carbs} g\nFett: ${fat} g`;

    const shareText = `Recept: ${recipe.title}\n\n${recipe.description}\n\nFörberedelsetid: ${recipe.prepTime}\nTillagningstid: ${recipe.cookTime}\nPortioner: ${recipe.servings}\n\n${macrosText}\n\nIngredienser:\n${ingredientsText}\n\nInstruktioner:\n${instructionsText}\n${recipe.chefTip ? `\nKockens tips: ${recipe.chefTip}\n` : '\n'}Delat från Kostloggen.se`;

    if (onShareRecipe) {
      onShareRecipe(shareText);
      onClose();
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: `Recept: ${recipe.title}`,
          text: shareText,
        });
      } catch (err) {
        console.error('Error sharing recipe:', err);
        setToastNotification({ message: "Kunde inte dela receptet. Försök igen.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setToastNotification({ message: "Receptet har kopierats till urklipp!", type: 'success' });
        setTimeout(() => setToastNotification(null), 3000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
        setToastNotification({ message: "Kunde inte kopiera receptet.", type: 'error' });
        setTimeout(() => setToastNotification(null), 3000);
      }
    }
  };

  const recipeServings = useMemo(() => parseServings(recipe?.servings), [recipe?.servings]);

  if (!show) return null;

  // FIX: Changed 'icon' type from JSX.Element to React.ReactNode to resolve namespace error.
  const renderNutrient = (label: string, value: any, unit: string, icon: React.ReactNode) => {
    const numValue = extractNumber(value);
    return (
      <div className="flex items-center text-sm text-neutral-dark">
        {icon}
        <span className="ml-1.5">{label}: {value !== undefined && !isNaN(numValue) ? Math.round(numValue) : '?'} {unit}</span>
      </div>
    );
  };
  
  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-fade-in"
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
            {!hideSearch && <TitleIcon className="w-7 h-7 text-primary mr-2.5" />}
            <h2 id="recipe-modal-title" className="text-2xl font-semibold text-neutral-dark">
              {hideSearch ? recipe?.title || 'Recept' : 'Receptidéer'}
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

        {!hideSearch && (
          <form onSubmit={handleSearchSubmit} className="mb-5 flex-shrink-0">
            <label htmlFor="recipeQuery" className="sr-only">Sök recept (t.ex. "vegetarisk frukost på ca 450 kcal och 37 g protein")</label>
            <div className="flex gap-2">
              <input
                type="text"
                id="recipeQuery"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='T.ex. "vegetarisk frukost på ca 450 kcal och 37 g protein"'
                className="flex-grow w-full px-4 py-2.5 bg-white border border-neutral-light rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-base text-neutral-dark"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="flex-shrink-0 px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-lg shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center interactive-transition"
              >
                <SearchIcon className="w-5 h-5 inline sm:mr-2" />
                <span className="hidden sm:inline">Sök</span>
              </button>
            </div>
          </form>
        )}

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
           {!hideSearch && !recipe && !error && !isLoading && recentSearches.length > 0 && (
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
          {!hideSearch && !recipe && !error && !isLoading && recentSearches.length === 0 && (
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
                                  {renderNutrient("Kalorier", recipe.totalNutritionalInfo.calories, "kcal", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>)}
                                  {renderNutrient("Protein", recipe.totalNutritionalInfo.protein, "g", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Protein">💪</span>)}
                                  {renderNutrient("Kolhydrater", recipe.totalNutritionalInfo.carbohydrates, "g", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>)}
                                  {renderNutrient("Fett", recipe.totalNutritionalInfo.fat, "g", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>)}
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
                {!selectedMealType && <p className="text-xs text-red-500 mt-1">Välj måltidstyp för att logga.</p>}
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex flex-row gap-2 justify-between items-center">
                    <div className="flex gap-2">
                      {/* Share button */}
                      <button
                      type="button"
                      onClick={handleShareRecipe}
                      disabled={isLoading}
                      className="h-11 w-11 flex items-center justify-center bg-primary text-white rounded-lg shadow-sm active:scale-95 disabled:opacity-50 interactive-transition"
                      title="Dela receptet"
                      >
                      <ShareIcon className="w-6 h-6" />
                      </button>

                      {/* Save button */}
                      {onSaveRecipe && (
                        <button
                        type="button"
                        onClick={() => onSaveRecipe(recipe)}
                        disabled={isLoading || isSaved}
                        className={`h-11 w-11 flex items-center justify-center rounded-lg shadow-sm active:scale-95 disabled:opacity-50 interactive-transition ${isSaved ? 'bg-[#2B3B2C] text-white' : 'bg-primary text-white'}`}
                        title={isSaved ? "Sparat" : "Spara i din receptbank"}
                        >
                          {isSaved ? <CheckIcon className="w-6 h-6" /> : <BookmarkIcon className="w-6 h-6" />}
                        </button>
                      )}
                    </div>
                    
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
                        className="h-11 w-11 text-center text-lg font-bold bg-white border border-neutral-light rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-primary text-neutral-dark"
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
                        disabled={isLoggingDisabled || isLoading || !portionsToLog.trim() || parseFloat(portionsToLog.replace(',', '.') || "1") <=0 || !selectedMealType}
                        className="h-11 w-11 flex items-center justify-center bg-secondary text-white rounded-lg shadow-sm active:scale-95 disabled:opacity-50 interactive-transition"
                        title={isLoggingDisabled ? "Loggning är endast tillgänglig för idag" : parseFloat(portionsToLog.replace(',', '.')) <=0 ? "Ange ett giltigt antal portioner" : "Logga specificerat antal portioner"}
                    >
                        <LogIcon className="w-6 h-6" />
                    </button>
                    </div>
                </div>
                <div className="flex items-center justify-end mt-1">
                    <p className="text-[10px] text-neutral-500">Tips: Du kan skriva t.ex. 0.5 eller 1.5 för att justera portionen.</p>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeModal;
