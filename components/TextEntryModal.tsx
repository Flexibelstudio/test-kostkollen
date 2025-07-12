
import React, { useState, useEffect } from 'react';
import { SearchedFoodInfo } from '../types.ts';
import { getNutritionalInfoForTextSearch } from '../services/geminiService.ts';
import { FireIcon, ProteinIcon, LeafIcon, CheckIcon, XMarkIcon, SearchIcon } from './icons.tsx';
import { playAudio } from '../services/audioService.ts';

interface TextEntryModalProps {
  show: boolean;
  onClose: () => void;
  onLog: (foodInfo: SearchedFoodInfo, options: { saveAsCommon: boolean }) => void;
}

const TextEntryModal: React.FC<TextEntryModalProps> = ({ show, onClose, onLog }) => {
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

        playAudio('uiClick');
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
        playAudio('uiClick');
        const numQuantity = parseFloat(quantity) || 0;
        const finalServingDescription = numQuantity === 1 
          ? editedServingDescription
          : `${numQuantity.toLocaleString('sv-SE')} × ${baseValues?.servingDescription || editedServingDescription}`;
    
        const dataToLog: SearchedFoodInfo = {
          foodItem: editedFoodItem,
          servingDescription: finalServingDescription, 
          calories: Math.round(parseFloat(editedCalories) || 0),
          protein: Math.round(parseFloat(editedProtein) || 0),
          carbohydrates: Math.round(parseFloat(editedCarbohydrates) || 0),
          fat: Math.round(parseFloat(editedFat) || 0),
        };
        onLog(dataToLog, { saveAsCommon }); 
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
        const val = e.target.value;
        if (val === "" || /^\d*\.?\d*$/.test(val)) {
            setQuantity(val);
        }
    };
    
    const createNumericHandler = (setter: React.Dispatch<React.SetStateAction<string>>) => {
        return (e: React.ChangeEvent<HTMLInputElement>) => {
            const { value } = e.target;
            if (value === '') {
                setter('0');
                return;
            }
            if (/^\d+$/.test(value)) {
                setter(String(parseInt(value, 10)));
            }
        };
    };

    if (!show) return null;

    const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-neutral-light rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-base";
    const labelClass = "block text-sm font-medium text-neutral-dark";

    return (
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center">
                    <SearchIcon className="w-7 h-7 text-primary mr-2.5" />
                    <h2 id="text-entry-modal-title" className="text-2xl font-semibold text-neutral-dark">
                        {searchResult ? "Sökresultat" : "Logga med text"}
                    </h2>
                </div>
                <button onClick={handleClose} className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90" aria-label="Stäng">
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>
            
            <form onSubmit={handleSearch} className="mb-4">
                <label htmlFor="textQueryInput" className="sr-only">Ange livsmedel eller måltid</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        id="textQueryInput"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Skriv vad du har ätit..."
                        className="flex-grow px-4 py-2.5 bg-white border border-neutral-light rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-base"
                        autoFocus
                    />
                    <button type="submit" disabled={!query.trim() || isLoading} className="px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center">
                        {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : <SearchIcon className="w-5 h-5" />}
                    </button>
                </div>
            </form>

            {!searchResult && !isLoading && !error && (
                <div className="text-center text-sm text-neutral-dark py-4 text-balance border-t border-neutral-light/50 mt-4">
                    Ange en måltid eller ett livsmedel, så hjälper AI:n dig att uppskatta näringsinnehållet. <br/> Exempel: "en näve mandlar" eller "kyckling med ris och broccoli".
                </div>
            )}
            
            {isLoading && (
                <div className="flex items-center justify-center text-neutral-dark p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mr-3"></div>
                    Söker...
                </div>
            )}
            
            {error && !isLoading && <p className="text-red-500 text-sm mt-2 animate-fade-in">{error}</p>}
            
            {searchResult && !isLoading && (
                <div className="mt-6 space-y-4 animate-fade-in border-t border-neutral-light/70 pt-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="foodItemTextModal" className={labelClass}>Livsmedel</label>
                            <input type="text" id="foodItemTextModal" value={editedFoodItem} onChange={(e) => setEditedFoodItem(e.target.value)} className={inputClass} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-5">
                            <div>
                                <label htmlFor="servingDescriptionTextModal" className={labelClass}>Basportion (för Antal = 1)</label>
                                <input type="text" id="servingDescriptionTextModal" value={editedServingDescription} onChange={(e) => setEditedServingDescription(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label htmlFor="quantityTextModal" className={labelClass}>Antal</label>
                                <input type="text" id="quantityTextModal" value={quantity} onChange={handleQuantityChange} className={inputClass} placeholder="1" inputMode="decimal" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-5 gap-y-3 pt-2">
                            <div>
                                <label htmlFor="caloriesTextModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kalorier">🔥</span>Kalorier (kcal)</label>
                                <input type="number" id="caloriesTextModal" value={editedCalories} onChange={createNumericHandler(setEditedCalories)} min="0" step="1" className={inputClass} />
                            </div>
                            <div>
                                <label htmlFor="proteinTextModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Protein">💪</span>Protein (g)</label>
                                <input type="number" id="proteinTextModal" value={editedProtein} onChange={createNumericHandler(setEditedProtein)} min="0" step="1" className={inputClass} />
                            </div>
                            <div>
                                <label htmlFor="carbohydratesTextModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Kolhydrater">🍞</span>Kolhydrater (g)</label>
                                <input type="number" id="carbohydratesTextModal" value={editedCarbohydrates} onChange={createNumericHandler(setEditedCarbohydrates)} min="0" step="1" className={inputClass} />
                            </div>
                            <div>
                                <label htmlFor="fatTextModal" className={`${labelClass} flex items-center`}><span className="w-4 h-4 mr-1 flex items-center justify-center" role="img" aria-label="Fett">🥑</span>Fett (g)</label>
                                <input type="number" id="fatTextModal" value={editedFat} onChange={createNumericHandler(setEditedFat)} min="0" step="1" className={inputClass} />
                            </div>
                        </div>
                        
                        <div className="mt-4 pt-3 border-t border-neutral-light/60">
                            <label htmlFor="saveAsCommonText" className="flex items-center text-base text-neutral-dark cursor-pointer">
                                <input type="checkbox" id="saveAsCommonText" name="saveAsCommon" checked={saveAsCommon} onChange={(e) => setSaveAsCommon(e.target.checked)} className="h-5 w-5 text-primary border-neutral-light rounded focus:ring-primary mr-2.5" />
                                <span className="mr-1.5" role="img" aria-hidden="true">📌</span>
                                Spara som vanligt val
                            </label>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-3.5 space-y-3 sm:space-y-0 pt-4">
                        <button type="button" onClick={handleClose} className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-md shadow-sm active:scale-95 transform">
                            <XMarkIcon className="w-5 h-5 inline mr-1.5" />
                            Avbryt
                        </button>
                        <button type="button" onClick={handleLog} className="w-full sm:w-auto px-5 py-2.5 text-base font-medium text-white bg-primary hover:bg-primary-darker rounded-md shadow-sm active:scale-95 transform">
                            <CheckIcon className="w-5 h-5 inline mr-1.5" />
                            Logga måltid
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TextEntryModal;
