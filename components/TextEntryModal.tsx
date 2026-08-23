
import React, { useState, useEffect } from 'react';
import { SearchedFoodInfo, MealType } from '../types.ts';
import { getNutritionalInfoForTextSearch } from '../services/geminiService.ts';
import { CheckIcon, XMarkIcon, SearchIcon, PencilIcon } from './icons.tsx';
import MealTypeSelector from './MealTypeSelector';
import { resolveNutritionalFieldValue } from '../utils/nutritionTotals.ts';

interface TextEntryModalProps {
  show: boolean;
  onClose: () => void;
  onLog: (foodInfo: SearchedFoodInfo, options: { saveAsCommon: boolean, mealType: MealType }) => void;
  defaultMealType?: MealType | null;
}

const PLACEHOLDER_EXAMPLES = [
    "Vad har du ätit?",
    "T.ex. 2 ägg, kaffe och en macka med ost",
    "T.ex. Kyckling, ris och broccoli",
    "T.ex. Havregrynsgröt med mjölk och äppelmos",
    "T.ex. En banan och en proteinshake"
];

const SUGGESTION_CHIPS = [
    "Havregrynsgröt, mjölk & äppelmos",
    "Kyckling, ris och broccoli",
    "2 st stekta ägg och en macka",
    "Lax med potatis och sås"
];

const TextEntryModal: React.FC<TextEntryModalProps> = ({ 
    show, 
    onClose, 
    onLog, 
    defaultMealType = null,
}) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string|null>(null);
    
    const [searchResult, setSearchResult] = useState<SearchedFoodInfo | null>(null);
    const [editedFoodItem, setEditedFoodItem] = useState('');
    const [editedServingDescription, setEditedServingDescription] = useState('');
    const [quantity, setQuantity] = useState("1");
    
    const [editedCalories, setEditedCalories] = useState("0");
    const [editedProtein, setEditedProtein] = useState("0");
    const [editedCarbohydrates, setEditedCarbohydrates] = useState("0");
    const [editedFat, setEditedFat] = useState("0");
  
    const [baseValues, setBaseValues] = useState<SearchedFoodInfo | null>(null);
    const [saveAsCommon, setSaveAsCommon] = useState<boolean>(false); 
    const [selectedMealType, setSelectedMealType] = useState<MealType | null>(defaultMealType);
    
    const [placeholderIndex, setPlaceholderIndex] = useState(0);

    useEffect(() => {
        if (show) {
            setSelectedMealType(defaultMealType);
            // Start rotating placeholder
            const interval = setInterval(() => {
                setPlaceholderIndex(prev => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [show, defaultMealType]);

    useEffect(() => {
        if (searchResult) {
            setBaseValues(searchResult);
            setEditedFoodItem(searchResult.foodItem);
            setEditedServingDescription(searchResult.servingDescription);
            setQuantity("1");
            setSaveAsCommon(false);
      
            setEditedCalories(String(Math.round(searchResult.calories || 0)));
            setEditedProtein(String(Math.round(searchResult.protein || 0)));
            setEditedCarbohydrates(String(Math.round(searchResult.carbohydrates || 0)));
            setEditedFat(String(Math.round(searchResult.fat || 0)));
        }
    }, [searchResult]);

    useEffect(() => {
        if (baseValues) {
            const numQuantity = parseFloat(quantity) || 0;
            setEditedCalories(String(Math.round((baseValues.calories || 0) * numQuantity)));
            setEditedProtein(String(Math.round((baseValues.protein || 0) * numQuantity)));
            setEditedCarbohydrates(String(Math.round((baseValues.carbohydrates || 0) * numQuantity)));
            setEditedFat(String(Math.round((baseValues.fat || 0) * numQuantity)));
        }
    }, [quantity, baseValues]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setError(null);
        setSearchResult(null);

        try {
            const result = await getNutritionalInfoForTextSearch(query.trim());
            setSearchResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ett okänt fel uppstod vid sökning.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleLog = () => {
        if (!selectedMealType) return;
        const numQuantity = parseFloat(quantity) || 0;
        const finalServingDescription = numQuantity === 1 
          ? editedServingDescription
          : `${numQuantity.toLocaleString('sv-SE')} × ${baseValues?.servingDescription || editedServingDescription}`;
    
        const baseCalories = (baseValues?.calories || 0) * numQuantity;
        const baseProtein = (baseValues?.protein || 0) * numQuantity;
        const baseCarbs = (baseValues?.carbohydrates || 0) * numQuantity;
        const baseFat = (baseValues?.fat || 0) * numQuantity;

        const dataToLog: SearchedFoodInfo = {
          foodItem: editedFoodItem,
          servingDescription: finalServingDescription, 
          calories: baseValues ? resolveNutritionalFieldValue(baseCalories, editedCalories) : (parseFloat(editedCalories.replace(',', '.')) || 0),
          protein: baseValues ? resolveNutritionalFieldValue(baseProtein, editedProtein) : (parseFloat(editedProtein.replace(',', '.')) || 0),
          carbohydrates: baseValues ? resolveNutritionalFieldValue(baseCarbs, editedCarbohydrates) : (parseFloat(editedCarbohydrates.replace(',', '.')) || 0),
          fat: baseValues ? resolveNutritionalFieldValue(baseFat, editedFat) : (parseFloat(editedFat.replace(',', '.')) || 0),
        };
        onLog(dataToLog, { saveAsCommon, mealType: selectedMealType }); 
        handleClose();
    };

    const handleClose = () => {
        setQuery('');
        setSearchResult(null);
        setIsLoading(false);
        setError(null);
        setBaseValues(null);
        onClose();
    };

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(',', '.');
        if (val === "" || /^\d*\.?\d*$/.test(val)) {
            setQuantity(val);
        }
    };
    
    const createNumericHandler = (setter: React.Dispatch<React.SetStateAction<string>>) => {
        return (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = e.target.value.replace(',', '.');
            if (val === '') {
                setter('0');
                return;
            }
            if (/^\d*\.?\d*$/.test(val)) {
                setter(val);
            }
        };
    };
    
    const handleChipClick = (suggestion: string) => {
        setQuery(suggestion);
    };

    if (!show) return null;

    const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base text-neutral-dark";
    const labelClass = "block text-sm font-medium text-neutral-dark";

    return (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-start justify-center z-[120] p-4 pt-20 animate-fade-in" onClick={handleClose}>
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5 flex-shrink-0">
                    <div className="flex items-center">
                        <SearchIcon className="w-7 h-7 text-primary mr-2.5" />
                        <h2 id="text-entry-modal-title" className="text-2xl font-semibold text-neutral-dark">
                            Sök & Logga
                        </h2>
                    </div>
                    <button onClick={handleClose} className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90" aria-label="Stäng">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                
                <form onSubmit={handleSearch} className="mb-2 flex-shrink-0">
                    <label htmlFor="textQueryInput" className="sr-only">Ange livsmedel eller måltid</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            id="textQueryInput"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
                            className="flex-grow px-4 py-2.5 bg-white border border-neutral-light rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-base text-neutral-dark transition-all placeholder:transition-opacity placeholder:duration-300"
                            autoFocus
                        />
                        <button type="submit" disabled={!query.trim() || isLoading} className="px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center">
                            {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : <SearchIcon className="w-5 h-5" />}
                        </button>
                    </div>
                </form>
                
                {!searchResult && !isLoading && (
                    <div className="mb-4">
                        <p className="text-xs text-neutral-500 font-medium mb-2 uppercase tracking-wide">Tips: Du kan skriva hela måltider!</p>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTION_CHIPS.map((chip) => (
                                <button
                                    key={chip}
                                    onClick={() => handleChipClick(chip)}
                                    className="px-3 py-1.5 bg-neutral-light/50 hover:bg-neutral-light text-neutral-dark text-xs sm:text-sm rounded-full border border-neutral-light/80 transition-colors"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {isLoading && (
                    <div className="flex items-center justify-center text-neutral-dark p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mr-3"></div>
                        <span className="text-lg">Frågar AI om näringsinnehåll...</span>
                    </div>
                )}
                
                {error && !isLoading && <p className="text-red-500 text-sm mt-2 animate-fade-in text-center p-4">{error}</p>}
                
                {searchResult && !isLoading && (
                    <div className="mt-6 space-y-4 animate-fade-in border-t border-neutral-light/70 pt-6">
                        <div className="space-y-4">
                            
                            {/* Meal Type Selector */}
                            <div>
                                <label className={labelClass + " mb-1"}>Måltidstyp</label>
                                <MealTypeSelector selectedType={selectedMealType} onSelect={setSelectedMealType} />
                                {!selectedMealType && <p className="text-xs text-red-500 mt-1">Välj måltidstyp för att logga.</p>}
                            </div>

                            <div>
                                <label htmlFor="foodItemTextModal" className={labelClass}>Livsmedel</label>
                                 <div className="relative">
                                    <input type="text" id="foodItemTextModal" value={editedFoodItem} onChange={(e) => setEditedFoodItem(e.target.value)} className={`${inputClass} pr-8`} />
                                    <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-x-5">
                                <div>
                                    <label htmlFor="servingDescriptionTextModal" className={labelClass}>Basportion (för Antal = 1)</label>
                                     <div className="relative">
                                        <input type="text" id="servingDescriptionTextModal" value={editedServingDescription} onChange={(e) => setEditedServingDescription(e.target.value)} className={`${inputClass} pr-8`} />
                                        <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="quantityTextModal" className={labelClass}>Antal</label>
                                     <div className="relative">
                                        <input type="text" id="quantityTextModal" value={quantity} onChange={handleQuantityChange} className={`${inputClass} pr-8`} placeholder="1" inputMode="decimal" />
                                        <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-1.5 ml-1">Tips: Du kan skriva t.ex. 0.5 eller 1.5 för att justera portionen.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-5 gap-y-3 pt-2">
                                <div>
                                    <label htmlFor="caloriesTextModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>Kalorier (kcal)</label>
                                    <div className="relative">
                                        <input type="number" id="caloriesTextModal" value={editedCalories} onChange={createNumericHandler(setEditedCalories)} min="0" step="any" className={`${inputClass} pr-8`} />
                                        <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="proteinTextModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Protein">💪</span>Protein (g)</label>
                                     <div className="relative">
                                        <input type="number" id="proteinTextModal" value={editedProtein} onChange={createNumericHandler(setEditedProtein)} min="0" step="any" className={`${inputClass} pr-8`} />
                                        <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="carbohydratesTextModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>Kolhydrater (g)</label>
                                    <div className="relative">
                                        <input type="number" id="carbohydratesTextModal" value={editedCarbohydrates} onChange={createNumericHandler(setEditedCarbohydrates)} min="0" step="any" className={`${inputClass} pr-8`} />
                                        <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="fatTextModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>Fett (g)</label>
                                    <div className="relative">
                                        <input type="number" id="fatTextModal" value={editedFat} onChange={createNumericHandler(setEditedFat)} min="0" step="any" className={`${inputClass} pr-8`} />
                                        <PencilIcon className="absolute top-1/2 right-2.5 -translate-y-1/2 w-4 h-4 text-neutral/50 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-neutral-light/60">
                                <label htmlFor="saveAsCommonText" className="flex items-center text-base text-neutral-dark cursor-pointer">
                                    <input type="checkbox" id="saveAsCommonText" name="saveAsCommon" checked={saveAsCommon} onChange={(e) => setSaveAsCommon(e.target.checked)} className="h-5 w-5 text-primary border-neutral-light rounded focus:ring-primary mr-2.5" />
                                    <span className="mr-1.5" role="img" aria-hidden="true">📌</span>
                                    Spara som vanligt val
                                    {searchResult.foodItem.includes(',') && <span className="ml-2 text-xs text-primary font-medium">(Perfekt för måltider!)</span>}
                                </label>
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3.5 pt-4">
                            <button type="button" onClick={handleClose} className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm active:scale-95 transform">
                                <XMarkIcon className="w-5 h-5 inline mr-1.5" />
                                Avbryt
                            </button>
                            <button type="button" onClick={handleLog} disabled={!selectedMealType} className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed">
                                <CheckIcon className="w-5 h-5 inline mr-1.5" />
                                Logga
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TextEntryModal;
