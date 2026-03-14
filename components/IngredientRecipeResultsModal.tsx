
import React, { useState, useEffect } from 'react';
import { RecipeSuggestion, NutritionalInfo, MealType } from '../types';
import { XMarkIcon, SparklesIcon, FireIcon, ProteinIcon, LeafIcon, CheckIcon as LogIcon, InformationCircleIcon } from './icons';
import { playAudio } from '../services/audioService';
import MealTypeSelector from './MealTypeSelector';

interface IngredientRecipeResultsModalProps {
  show: boolean;
  onClose: () => void;
  identifiedIngredients: string[];
  recipeSuggestions: RecipeSuggestion[];
  onLogRecipe: (nutritionalInfo: NutritionalInfo, options: { saveAsCommon: boolean, mealType: MealType }) => void;
  isLoading: boolean;
  error: string | null;
  isLoggingDisabled?: boolean;
  defaultMealType?: MealType | null;
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

const IngredientRecipeResultsModal: React.FC<IngredientRecipeResultsModalProps> = ({
  show,
  onClose,
  identifiedIngredients,
  recipeSuggestions,
  onLogRecipe,
  isLoading,
  error,
  isLoggingDisabled = false,
  defaultMealType = null,
}) => {
  const [portionsToLog, setPortionsToLog] = useState<{ [recipeTitle: string]: string }>({});
  const [selectedMealTypes, setSelectedMealTypes] = useState<{ [recipeTitle: string]: MealType | null }>({});

  useEffect(() => {
    // Initialize portion state when new recipes are loaded
    if (recipeSuggestions) {
      const initialPortions: { [key: string]: string } = {};
      const initialTypes: { [key: string]: MealType | null } = {};
      recipeSuggestions.forEach(recipe => {
        initialPortions[recipe.title] = "1";
        initialTypes[recipe.title] = defaultMealType; 
      });
      setPortionsToLog(initialPortions);
      setSelectedMealTypes(initialTypes);
    }
  }, [recipeSuggestions, defaultMealType]);


  if (!show) return null;

  const handlePortionsChange = (recipeTitle: string, value: string) => {
    const val = value.replace(',', '.');
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
        setPortionsToLog(prev => ({ ...prev, [recipeTitle]: val }));
    }
  };

  const handleMealTypeChange = (recipeTitle: string, type: MealType) => {
      setSelectedMealTypes(prev => ({ ...prev, [recipeTitle]: type }));
  };

  const handleLog = (recipe: RecipeSuggestion) => {
    if (!selectedMealTypes[recipe.title]) return; // Should be disabled, safe guard
    playAudio('uiClick');
    const recipeBaseServings = parseServings(recipe.servings);
    const numPortionsToLog = parseFloat(portionsToLog[recipe.title].replace(',', '.') || "1") || 1;

    if (numPortionsToLog <= 0) {
      alert("Antal portioner måste vara större än 0."); // Replace with toast later
      return;
    }
    
    const loggedNutritionalInfo: NutritionalInfo = {
      foodItem: `${recipe.title} (${numPortionsToLog.toLocaleString('sv-SE')} port. från skafferi)`,
      calories: Math.round((recipe.totalNutritionalInfo.calories / recipeBaseServings) * numPortionsToLog),
      protein: Math.round((recipe.totalNutritionalInfo.protein / recipeBaseServings) * numPortionsToLog),
      carbohydrates: Math.round((recipe.totalNutritionalInfo.carbohydrates / recipeBaseServings) * numPortionsToLog),
      fat: Math.round((recipe.totalNutritionalInfo.fat / recipeBaseServings) * numPortionsToLog),
    };
    onLogRecipe(loggedNutritionalInfo, { saveAsCommon: false, mealType: selectedMealTypes[recipe.title] as MealType });
    onClose(); // Close modal immediately after logging
  };
  
  // FIX: Changed 'icon' type from JSX.Element to React.ReactNode to resolve namespace error.
  const renderNutrient = (label: string, value: number | undefined, unit: string, icon: React.ReactNode) => (
    <div className="flex items-center text-sm text-neutral-dark">
      {icon}
      <span className="ml-1.5">{label}: {value !== undefined ? Math.round(value) : '?'} {unit}</span>
    </div>
  );
  
  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";


  return (
    <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center">
            <SparklesIcon className="w-7 h-7 text-primary mr-2.5" />
            <h2 id="ingredient-results-modal-title" className="text-2xl font-semibold text-neutral-dark">
              AI Receptförslag
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90 interactive-transition"
            aria-label="Stäng"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-grow min-h-[200px]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-neutral-dark py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-secondary mb-4"></div>
              <p className="text-lg">Analyserar och skapar recept...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md text-center">
              <p className="font-medium">Ett fel uppstod:</p>
              <p>{error}</p>
            </div>
          )}
          {!isLoading && !error && (
            <>
              {identifiedIngredients.length > 0 && (
                <div className="mb-5 p-4 bg-neutral-light rounded-lg">
                  <h3 className="text-lg font-semibold text-neutral-dark mb-2">Identifierade ingredienser:</h3>
                  <p className="text-neutral-dark text-sm">
                    {identifiedIngredients.join(', ') || "Inga tydliga ingredienser kunde identifieras."}
                  </p>
                </div>
              )}

              {recipeSuggestions.length === 0 && identifiedIngredients.length > 0 && (
                <p className="text-neutral text-center py-6">AI:n kunde inte skapa några receptförslag med de identifierade ingredienserna. Prova med andra bilder eller lägg till fler vanliga skafferivaror om du har.</p>
              )}
              {recipeSuggestions.length === 0 && identifiedIngredients.length === 0 && (
                 <p className="text-neutral text-center py-6">Inga ingredienser eller recept kunde identifieras. Försök igen med tydligare bilder.</p>
              )}

              <div className="space-y-4">
                {recipeSuggestions.map((recipe) => (
                  <div key={recipe.title} className="bg-white p-4 rounded-lg shadow-md border border-neutral-light/70">
                    <h3 className="text-xl font-bold text-primary-darker">{recipe.title}</h3>
                    <p className="text-sm text-neutral-dark italic">{recipe.description}</p>
                    <div className="text-xs text-neutral-dark mt-1 mb-3">
                      <span>Förb: {recipe.prepTime}</span> | <span>Tillagn: {recipe.cookTime}</span> | <span>Port: {recipe.servings}</span>
                    </div>

                    <div id={`recipe-details-${recipe.title.replace(/\s+/g, '-')}`} className="mt-3 pt-3 border-t border-neutral-light/50 space-y-3">
                        <div>
                          <h4 className="text-md font-semibold text-neutral-dark mb-1">Ingredienser:</h4>
                          <ul className="list-disc list-inside space-y-0.5 text-sm text-neutral-dark pl-2">
                            {recipe.ingredients.map((ing, idx) => <li key={idx}>{ing.item}</li>)}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-md font-semibold text-neutral-dark mb-1">Instruktioner:</h4>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-dark pl-2">
                            {recipe.instructions.map((step, idx) => <li key={idx}>{step}</li>)}
                          </ol>
                        </div>
                        {recipe.chefTip && (
                          <div className="p-2 bg-primary-100/50 rounded-md border border-primary-200/70">
                            <p className="text-xs font-medium text-primary-darker flex items-center">
                                <InformationCircleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                                Kockens tips: <span className="font-normal text-neutral-dark">{recipe.chefTip}</span>
                            </p>
                          </div>
                        )}
                        {recipe.totalNutritionalInfo && (
                          <div>
                            <h4 className="text-md font-semibold text-neutral-dark mb-1">Uppskattat näringsinnehåll (hela receptet):</h4>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 bg-neutral-light/70 p-2 rounded-md text-xs">
                              {renderNutrient("Kcal", recipe.totalNutritionalInfo.calories, "", <span className="w-3 h-3 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>)}
                              {renderNutrient("P", recipe.totalNutritionalInfo.protein, "g", <span className="w-3 h-3 flex items-center justify-center" role="img" aria-label="Protein">💪</span>)}
                              {renderNutrient("K", recipe.totalNutritionalInfo.carbohydrates, "g", <span className="w-3 h-3 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>)}
                              {renderNutrient("F", recipe.totalNutritionalInfo.fat, "g", <span className="w-3 h-3 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>)}
                            </div>
                          </div>
                        )}
                        
                        <div className="pt-2 space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-neutral-dark mb-1">Måltidstyp</label>
                                <MealTypeSelector 
                                    selectedType={selectedMealTypes[recipe.title] || defaultMealType} 
                                    onSelect={(type) => handleMealTypeChange(recipe.title, type)} 
                                />
                                {!selectedMealTypes[recipe.title] && <p className="text-xs text-red-500 mt-1">Välj måltidstyp för att logga.</p>}
                            </div>
                            <div>
                                <label htmlFor={`portions-${recipe.title}`} className="block text-sm font-medium text-neutral-dark mb-0.5">Antal portioner att logga:</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    id={`portions-${recipe.title}`}
                                    value={portionsToLog[recipe.title] || "1"}
                                    onChange={(e) => handlePortionsChange(recipe.title, e.target.value)}
                                    className={`${inputClass} w-full sm:w-32 py-1.5 text-sm mb-1`}
                                    placeholder="1"
                                    disabled={isLoggingDisabled}
                                />
                                <p className="text-[10px] text-neutral-500 ml-1">Tips: Du kan skriva t.ex. 0.5 eller 1.5 för att justera portionen.</p>
                            </div>
                        </div>

                        <button
                          onClick={() => handleLog(recipe)}
                          disabled={isLoggingDisabled || !portionsToLog[recipe.title]?.trim() || parseFloat(portionsToLog[recipe.title].replace(',', '.') || "1") <=0 || !selectedMealTypes[recipe.title]}
                          className="w-full mt-2 px-4 py-2 text-sm font-medium text-white bg-secondary hover:bg-secondary-darker rounded-md shadow-sm active:scale-95 disabled:opacity-50 interactive-transition flex items-center justify-center"
                        >
                          <LogIcon className="w-4 h-4 mr-2" /> Logga Recept
                        </button>
                        {isLoggingDisabled && (
                            <p className="text-xs text-orange-500 text-center mt-1">Loggning är endast tillgänglig för idag.</p>
                        )}
                      </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-auto pt-5 flex-shrink-0 border-t border-neutral-light/70">
          <button
            onClick={onClose}
            className="w-full px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm active:scale-95 interactive-transition"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
};

export default IngredientRecipeResultsModal;
