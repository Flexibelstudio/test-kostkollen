import React, { useState, useEffect } from 'react';
import { SavedRecipe } from '../types';
import { getSavedRecipes, deleteSavedRecipe } from '../services/firestoreService';
import { useUserContext } from '../context/UserContext';
import { XMarkIcon, TrashIcon, ShareIcon } from './icons';
import { playAudio } from '../services/audioService';
import RecipeModal from './RecipeModal';

interface MyRecipesModalProps {
  show: boolean;
  onClose: () => void;
}

const MyRecipesModal: React.FC<MyRecipesModalProps> = ({ show, onClose }) => {
  const { currentUser } = useUserContext();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null);

  useEffect(() => {
    if (show && currentUser) {
      loadRecipes();
    }
  }, [show, currentUser]);

  const loadRecipes = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const fetchedRecipes = await getSavedRecipes(currentUser.uid);
      setRecipes(fetchedRecipes);
    } catch (error) {
      console.error("Error loading recipes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    
    if (window.confirm('Är du säker på att du vill ta bort detta recept?')) {
      try {
        await deleteSavedRecipe(currentUser.uid, id);
        setRecipes(prev => prev.filter(r => r.id !== id));
      } catch (error) {
        console.error("Error deleting recipe:", error);
      }
    }
  };

  const handleShare = async (recipe: SavedRecipe, e: React.MouseEvent) => {
    e.stopPropagation();
    playAudio('uiClick');

    const ingredientsText = recipe.recipe.ingredients.map(ing => `- ${ing.item}`).join('\n');
    const instructionsText = recipe.recipe.instructions.map((step, idx) => `${idx + 1}. ${step}`).join('\n');
    
    const shareText = `Recept: ${recipe.recipe.title}\n\n${recipe.recipe.description}\n\nFörberedelsetid: ${recipe.recipe.prepTime}\nTillagningstid: ${recipe.recipe.cookTime}\nPortioner: ${recipe.recipe.servings}\n\nIngredienser:\n${ingredientsText}\n\nInstruktioner:\n${instructionsText}\n${recipe.recipe.chefTip ? `\nKockens tips: ${recipe.recipe.chefTip}\n` : '\n'}Delat från Kostloggen.se`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Recept: ${recipe.recipe.title}`,
          text: shareText,
        });
      } catch (err) {
        console.error('Error sharing recipe:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        alert('Receptet har kopierats till urklipp!');
      } catch (err) {
        console.error('Failed to copy text: ', err);
        alert('Kunde inte kopiera receptet.');
      }
    }
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-3xl shadow-soft-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
          
          <div className="flex justify-between items-center p-6 border-b border-neutral-light bg-neutral-light/30">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📖</span>
              <h2 className="text-2xl font-bold text-neutral-dark">Mina recept</h2>
            </div>
            <button onClick={onClose} className="p-2 text-neutral hover:bg-neutral-light rounded-full transition-colors">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-12 bg-neutral-light/30 rounded-2xl border border-dashed border-neutral-light">
                <div className="text-5xl mb-4 opacity-50">👩‍🍳</div>
                <h3 className="text-lg font-bold text-neutral-dark mb-2">Din receptbank är tom</h3>
                <p className="text-neutral mb-4 max-w-md mx-auto">
                  När du får ett receptförslag från AI-coachen kan du spara det här för att enkelt hitta det igen.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recipes.map(savedRecipe => (
                  <div 
                    key={savedRecipe.id}
                    onClick={() => {
                      playAudio('uiClick');
                      setSelectedRecipe(savedRecipe);
                    }}
                    className="bg-white border border-neutral-light rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow group relative"
                  >
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleShare(savedRecipe, e)}
                        className="p-1.5 bg-white text-neutral hover:text-primary rounded-full shadow-sm border border-neutral-light"
                        title="Dela recept"
                      >
                        <ShareIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(savedRecipe.id, e)}
                        className="p-1.5 bg-white text-neutral hover:text-red-500 rounded-full shadow-sm border border-neutral-light"
                        title="Ta bort"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <h3 className="font-bold text-neutral-dark mb-1 pr-16 line-clamp-2">{savedRecipe.recipe.title}</h3>
                    <p className="text-xs text-neutral line-clamp-2 mb-3 h-8">{savedRecipe.recipe.description}</p>
                    
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <div className="flex items-center gap-1">
                        <span>⏱️</span> {savedRecipe.recipe.prepTime}
                      </div>
                      <div className="flex items-center gap-1">
                        <span>🔥</span> {Math.round(savedRecipe.recipe.totalNutritionalInfo.calories)} kcal
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedRecipe && (
        <RecipeModal
          show={!!selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          recipe={selectedRecipe.recipe}
          onLog={() => {
            // Handle logging from saved recipe if needed
            // For now, just close the modal
            setSelectedRecipe(null);
          }}
          defaultMealType="lunch" // Or whatever makes sense
        />
      )}
    </>
  );
};

export default MyRecipesModal;
