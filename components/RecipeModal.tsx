
import React, { useState, useEffect } from 'react';
import { RecipeSuggestion, NutritionalInfo } from '../types';
import { SearchIcon, XMarkIcon, CheckIcon as LogIcon, RecipeIcon as TitleIcon, FireIcon, ProteinIcon, LeafIcon, InformationCircleIcon, ShareIcon } from './icons';
// Removed: import { AppStatus } from '../types';
import { playAudio } from '../services/audioService';

interface RecipeModalProps {
  show: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<void>;
  onLogRecipe: (nutritionalInfo: NutritionalInfo) => void; // Changed to accept NutritionalInfo directly
  recipe: RecipeSuggestion | null;
  isLoading: boolean; 
  error: string | null;
  isLoggingDisabled?: boolean;
  recentSearches: string[];
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const parseServings = (servingsStr: string | undefined): number => {
  if (!servingsStr) return 1;
  const match = servingsStr.match(/(\d+(\.\d+)?)/); // Extracts first number (integer or decimal)
  if (match && match[1]) {
    const num = parseFloat(match[1]);
    return num > 0 ? num : 1;
  }
  return 1; // Default to 1 serving if parsing fails
};


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
}) => {
  const [query, setQuery] = useState('');
  const [portionsToLog, setPortionsToLog] = useState<string>("1");
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (typeof navigator.share === 'function') {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
    if (recipe && !recipe.error) {
      setPortionsToLog("1"); // Reset portions when a new recipe is loaded
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

  const handleLog = () => {
    if (recipe && !recipe.error) {
      const recipeBaseServings = parseServings(recipe.servings);
      const numPortionsToLog = parseFloat(portionsToLog) || 1;

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
      onLogRecipe(loggedNutritionalInfo);
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
      // url: window.location.href // Optional: if you want to share a link to the app
    };

    try {
      await navigator.share(shareData);
      // Success is usually handled by the OS share sheet, no toast needed here.
    } catch (err) {
      console.error('Error sharing recipe:', err);
      setToastNotification({ message: "Kunde inte dela receptet. Försök igen.", type: 'error' });
      setTimeout(() => setToastNotification(null), 3000);
    }
  };


  if (!show) return null;

  const renderNutrient = (label: string, value: number | undefined, unit: string, icon: JSX.Element) => (
    <div className="flex items-center text-sm text-neutral-dark">
      {icon}
      <span className="ml-1.5">{label}: {value !== undefined ? Math.round(value) : '?'} {unit}</span>
    </div>
  );
  
  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";


  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-modal-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-scale-in"
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
          <div className="flex gap-3">
            <input
              type="text"
              id="recipeQuery"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Vad vill du laga? (t.ex. 'lätt kycklingpasta')"
              className="flex-grow px-4 py-2.5 bg-white border border-neutral-light rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-base"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-lg shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center interactive-transition"
            >
              <SearchIcon className={`w-5 h-5 mr-2 ${isLoading ? 'hidden' : 'inline'}`} />
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : "Sök"}
            </button>
          </div>
        </form>

        <div className="overflow-y-auto custom-scrollbar flex-grow min-h-[200px]">
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
           {/* Display Recent Searches if no recipe/error and not loading */}
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
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-2xl font-bold text-neutral-darker">{recipe.title}</h3>
              <p className="text-base text-neutral-dark italic">{recipe.description}</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-neutral-dark">
                <p><strong>Förb.:</strong> {recipe.prepTime}</p>
                <p><strong>Tillagn.:</strong> {recipe.cookTime}</p>
                <p><strong>Portioner (recept):</strong> {recipe.servings}</p>
              </div>

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
                <ol className="list-decimal list-inside space-y-2 text-neutral-dark pl-2">
                  {recipe.instructions.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>

              {recipe.chefTip && (
                <div className="p-3 bg-primary-100/60 rounded-md border border-primary-200">
                  <p className="text-sm font-medium text-primary-darker flex items-center">
                    <InformationCircleIcon className="w-5 h-5 mr-1.5 flex-shrink-0" />
                    Kockens tips: <span className="font-normal text-neutral-dark">{recipe.chefTip}</span>
                  </p>
                </div>
              )}

              {recipe.totalNutritionalInfo && (
                <div>
                  <h4 className="text-lg font-semibold text-neutral-dark mb-2">Uppskattat näringsinnehåll (hela receptet):</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-neutral-light p-3 rounded-md">
                    {renderNutrient("Kalorier", recipe.totalNutritionalInfo.calories, "kcal", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>)}
                    {renderNutrient("Protein", recipe.totalNutritionalInfo.protein, "g", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Protein">💪</span>)}
                    {renderNutrient("Kolhydrater", recipe.totalNutritionalInfo.carbohydrates, "g", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>)}
                    {renderNutrient("Fett", recipe.totalNutritionalInfo.fat, "g", <span className="w-4 h-4 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>)}
                  </div>
                   <p className="text-xs text-neutral mt-1.5">Observera: Näringsvärden är en uppskattning för hela receptet.</p>
                </div>
              )}
               {/* Input for number of portions to log */}
               <div className="pt-3">
                <label htmlFor="portionsToLogInput" className="block text-base font-medium text-neutral-dark mb-1.5">Antal portioner att logga:</label>
                <input
                  type="number"
                  id="portionsToLogInput"
                  value={portionsToLog}
                  onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                          setPortionsToLog(val);
                      }
                  }}
                  min="0.1"
                  step="0.1"
                  className={`${inputClass} w-full sm:w-40`}
                  placeholder="t.ex. 1.5"
                  disabled={isLoggingDisabled || isLoading}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-center flex-shrink-0 border-t border-neutral-light/70 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm active:scale-95 interactive-transition"
          >
            Stäng
          </button>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
            {recipe && !recipe.error && (
              <button
                type="button"
                onClick={handleShareRecipe}
                disabled={isLoading || !canShare}
                className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center interactive-transition"
                title={!canShare ? "Dela stöds inte i din webbläsare" : "Dela receptet"}
              >
                <ShareIcon className="w-5 h-5 mr-2" />
                Dela
              </button>
            )}
            {recipe && !recipe.error && (
              <button
                type="button"
                onClick={handleLog}
                disabled={isLoggingDisabled || isLoading || !portionsToLog.trim() || parseFloat(portionsToLog) <=0}
                className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-secondary hover:bg-secondary-darker rounded-md shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center interactive-transition"
                title={isLoggingDisabled ? "Receptloggning är endast tillgänglig för idag" : parseFloat(portionsToLog) <=0 ? "Ange ett giltigt antal portioner" : "Logga specificerat antal portioner"}
              >
                <LogIcon className="w-5 h-5 mr-2" />
                Logga Portioner
              </button>
            )}
          </div>
        </div>
         {isLoggingDisabled && recipe && !recipe.error && (
          <p className="text-xs text-orange-500 text-center mt-3 flex-shrink-0">
              Loggning är endast tillgänglig för idag.
          </p>
        )}
      </div>
    </div>
  );
};

export default RecipeModal;