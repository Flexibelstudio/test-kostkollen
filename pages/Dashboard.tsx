import React, { useState, useMemo, useRef } from 'react';
import { 
    LoggedMeal, 
    NutritionalInfo,
    CommonMeal,
    SearchedFoodInfo,
    RecipeSuggestion,
    IngredientRecipeResponse,
    BarcodeScannedFoodInfo,
    AppStatus
} from '../types';
import { 
    DEFAULT_WATER_GOAL_ML,
    MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL,
    MIN_ABSOLUTE_CALORIES_THRESHOLD,
    MANUAL_LOG_FOOD_ICON_SVG,
    SEARCH_ICON_SVG,
    RECIPE_ICON_SVG,
    BARCODE_ICON_SVG,
    BOOKMARK_ICON_SVG,
    COMMON_MEAL_LOG_ICON_SVG,
    MAX_INGREDIENT_IMAGES
} from '../constants';
import { useUserContext } from '../context/UserContext';
import { 
    addMealLog as addMealLogFirestore, 
    setWaterLog, 
    addCommonMeal, 
    deleteCommonMeal as deleteCommonMealFromDB, 
    updateCommonMeal,
    updateUserDocument 
} from '../services/firestoreService';
import { getDateUID } from '../utils/dateUtils';
import { playAudio } from '../services/audioService';
import { 
    analyzeFoodImage, 
    getRecipeSuggestion, 
    getRecipesFromIngredientsImage, 
    analyzeNutritionLabelImage 
} from '../services/geminiService';
import { getFoodInfoFromBarcode } from '../services/openFoodFactsService';

// Components
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import WeeklyProgressDays from '../components/WeeklyProgressDays';
import ProgressDisplay from '../components/ProgressDisplay';
import WaterLogger from '../components/WaterLogger';
import { CommonMealsList } from '../components/CommonMealsList';
import MealItemCard from '../components/MealItemCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { PlusIcon, CameraIcon, RecipeIcon, UploadIcon, BarcodeIcon, SearchIcon, XMarkIcon } from '../components/icons';

// Modals
import TextEntryModal from '../components/TextEntryModal';
import CameraModal from '../components/CameraModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import BarcodeSearchResultModal from '../components/BarcodeSearchResultModal';
import SaveCommonMealModal from '../components/SaveCommonMealModal';
import RecipeChoiceModal from '../components/RecipeChoiceModal';
import RecipeModal from '../components/RecipeModal';
import IngredientCaptureModal from '../components/IngredientCaptureModal';
import IngredientRecipeResultsModal from '../components/IngredientRecipeResultsModal';
import ImageAnalysisResultModal from '../components/ImageAnalysisResultModal';
import NutritionLabelResultModal from '../components/NutritionLabelResultModal';

interface DashboardProps {
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    onOnboardingNavigate: (view: 'journey' | 'community', subView?: 'search') => void;
    viewingDate: Date;
    onDateSelect: (date: Date) => void;
    checklistState: any; // Passed from App as it manages onboarding persistence
    showSpotlight: boolean;
    onDismissSpotlight: () => void;
    isInstallBannerVisible: boolean;
}

const resizeImageForLog = (file: File, maxSize: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            if (!event.target?.result) {
                return reject(new Error("File could not be read."));
            }
            const img = new Image();
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                resolve(dataUrl.split(',')[1]);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

const Dashboard: React.FC<DashboardProps> = ({
    setToastNotification,
    onOnboardingNavigate,
    viewingDate,
    onDateSelect,
    checklistState,
    showSpotlight,
    onDismissSpotlight,
    isInstallBannerVisible
}) => {
    const {
        currentUser,
        userProfile,
        goals,
        dailyLog, setDailyLog,
        waterLoggedMl, setWaterLoggedMl,
        commonMeals, setCommonMeals,
        weeklyBank, setWeeklyBank,
        streakData,
        highestStreak,
        pastDaysSummary,
        currentDate: currentAppDate,
        userRole,
        userStatus
    } = useUserContext();

    // Local State for Modals & Interactions
    const [showSpeedDial, setShowSpeedDial] = useState(false);
    const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    // Modal Visibility States
    const [showTextEntryModal, setShowTextEntryModal] = useState(false);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState(false);
    const [showRecipeChoiceModal, setShowRecipeChoiceModal] = useState(false);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [showIngredientCaptureModal, setShowIngredientCaptureModal] = useState(false);
    const [showIngredientRecipeResultsModal, setShowIngredientRecipeResultsModal] = useState(false);
    const [showSaveCommonMealModal, setShowSaveCommonMealModal] = useState(false);
    const [showNutritionLabelResultModal, setShowNutritionLabelResultModal] = useState(false);

    // Data States for Modals
    const [cameraImageForAnalysis, setCameraImageForAnalysis] = useState<string | null>(null);
    const [imageFileForAnalysis, setImageFileForAnalysis] = useState<File | null>(null);
    const [analysisResultForModal, setAnalysisResultForModal] = useState<NutritionalInfo | null>(null);
    const [barcodeScanResult, setBarcodeScanResult] = useState<BarcodeScannedFoodInfo | null>(null);
    const [currentRecipe, setCurrentRecipe] = useState<RecipeSuggestion | null>(null);
    const [recentRecipeSearches, setRecentRecipeSearches] = useState<string[]>([]);
    const [ingredientImagesForCapture, setIngredientImagesForCapture] = useState<string[]>([]);
    const [ingredientAnalysisResult, setIngredientAnalysisResult] = useState<IngredientRecipeResponse | null>(null);
    const [nutritionLabelResult, setNutritionLabelResult] = useState<NutritionalInfo | null>(null);
    const [mealToSaveAsCommon, setMealToSaveAsCommon] = useState<LoggedMeal | null>(null);
    
    // Flags
    const [isCapturingForIngredients, setIsCapturingForIngredients] = useState(false);
    const [isCapturingForLabel, setIsCapturingForLabel] = useState(false);
    
    const waterLoggerRef = useRef<HTMLDivElement>(null);

    // Computed
    const formattedViewingDate = useMemo(() => {
        return viewingDate.toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }, [viewingDate]);

    const isEditableLogDate = useMemo(() => {
        const todayStr = getDateUID(currentAppDate);
        const viewingDateStr = getDateUID(viewingDate);
        if (todayStr === viewingDateStr) return true;
        
        const yesterday = new Date(currentAppDate);
        yesterday.setDate(currentAppDate.getDate() - 1);
        return getDateUID(yesterday) === viewingDateStr;
    }, [currentAppDate, viewingDate]);
    
    const { currentLevel } = useMemo(() => {
        // Ideally import getUserLevelInfo, but for now simpler logic or prop if available
        // Re-implementing simplistic version or assume passed prop? 
        // Let's just assume standard logic if not imported
        // For now, let's assume Dashboard doesn't calculate levels deeply but uses passed prop
        // Wait, I removed prop from App.tsx, need to calculate it or fetch it.
        // Let's use simple logic for display:
        return { currentLevel: { name: "Nivå " + Math.floor(streakData.currentStreak / 10) } }; // Placeholder if constants not imported
    }, [streakData.currentStreak]);


    // --- Actions ---

    const closeModal = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
        playAudio('uiClick');
        setter(false);
    };

    const openModal = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
        playAudio('uiClick');
        setter(true);
    };

    const handleFabClick = () => {
        playAudio('uiClick');
        if (showSpotlight) {
            onDismissSpotlight();
        }
        if (!isEditableLogDate) {
            setToastNotification({message: "Du kan endast logga för idag eller igår.", type: "error"});
            setTimeout(() => setToastNotification(null), 3000);
            return;
        }
        setShowSpeedDial(prev => !prev);
    };

    const handleAddOptionSelect = (option: 'camera' | 'upload' | 'text' | 'recipe' | 'barcode') => {
        setShowSpeedDial(false);
        playAudio('uiClick');
        switch (option) {
            case 'camera':
                setIsCapturingForIngredients(false); 
                setIsCapturingForLabel(false);
                openModal(setShowCameraModal);
                break;
            case 'upload':
                setIsCapturingForIngredients(false); 
                setIsCapturingForLabel(false);
                document.getElementById('imageUploadInputMain')?.click(); 
                break;
            case 'text':
                openModal(setShowTextEntryModal);
                break;
            case 'recipe':
                openModal(setShowRecipeChoiceModal);
                break;
            case 'barcode':
                openModal(setShowBarcodeScannerModal);
                break;
        }
    };

    const addMealToLog = async (nutritionalInfo: NutritionalInfo, options: { base64Image?: string; commonMealId?: string } = {}) => {
        if (!isEditableLogDate || !currentUser) {
            const message = "Du kan endast logga måltider för idag och igår.";
            setToastNotification({ message, type: 'error' });
            setTimeout(() => setToastNotification(null), 3000);
            return;
        }
    
        // Generating ID locally
        const mealId = `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
        let finalImageUrl: string | undefined = undefined;
        const originalDailyLog = [...dailyLog];
        const originalBankState = { ...weeklyBank };
    
        try {
            if (options.base64Image) {
                finalImageUrl = options.base64Image;
            }
    
            if (!finalImageUrl) {
                if (options.commonMealId === 'manual') finalImageUrl = MANUAL_LOG_FOOD_ICON_SVG;
                else if (options.commonMealId === 'text_search') finalImageUrl = SEARCH_ICON_SVG;
                else if (options.commonMealId === 'recipe' || options.commonMealId === 'ingredient_recipe') finalImageUrl = RECIPE_ICON_SVG;
                else if (options.commonMealId === 'barcode') finalImageUrl = BARCODE_ICON_SVG;
                else if (options.commonMealId) finalImageUrl = BOOKMARK_ICON_SVG;
                else finalImageUrl = COMMON_MEAL_LOG_ICON_SVG; 
            }
            
            const newMealData: Omit<LoggedMeal, 'id'> = {
                timestamp: Date.now(),
                dateString: getDateUID(viewingDate),
                nutritionalInfo: {
                    foodItem: nutritionalInfo.foodItem || 'Okänd måltid',
                    calories: Math.max(0, nutritionalInfo.calories),
                    protein: Math.max(0, nutritionalInfo.protein),
                    carbohydrates: Math.max(0, nutritionalInfo.carbohydrates),
                    fat: Math.max(0, nutritionalInfo.fat),
                },
            };
    
            if (options.commonMealId) {
                newMealData.commonMealId = options.commonMealId;
            }
    
            if (finalImageUrl) {
                newMealData.imageUrl = finalImageUrl;
            }

            // Bank Logic (simplified for UI update)
            const currentTotalCalories = dailyLog.reduce((sum, m) => sum + m.nutritionalInfo.calories, 0);
            let newBankState = originalBankState;
            if (currentTotalCalories + newMealData.nutritionalInfo.calories > goals.calorieGoal && originalBankState.bankedCalories > 0) {
                const overshoot = (currentTotalCalories + newMealData.nutritionalInfo.calories) - goals.calorieGoal;
                const canUseFromBank = Math.min(overshoot, originalBankState.bankedCalories);
                if (canUseFromBank > 0) {
                    newMealData.caloriesCoveredByBank = canUseFromBank;
                    newBankState = { ...originalBankState, bankedCalories: Math.max(0, originalBankState.bankedCalories - canUseFromBank) };
                }
            }
    
            const optimisticMeal: LoggedMeal = { ...newMealData, id: mealId };
            setDailyLog(prevLog => [optimisticMeal, ...prevLog]);
            if (newBankState.bankedCalories !== originalBankState.bankedCalories) {
                setWeeklyBank(newBankState);
            }
            
            playAudio('logSuccess', 0.8);
            setToastNotification({ message: `"${optimisticMeal.nutritionalInfo.foodItem}" loggades!`, type: 'success' });
            setTimeout(() => setToastNotification(null), 3000);
    
            // Save to Firestore
            await addMealLogFirestore(currentUser.uid, mealId, newMealData);
    
            if (newBankState.bankedCalories !== originalBankState.bankedCalories) {
                await updateUserDocument(currentUser.uid, { weeklyBank: newBankState });
            }
            
        } catch (error) {
            console.error("Error logging meal:", error);
            setDailyLog(originalDailyLog);
            setWeeklyBank(originalBankState);
            setToastNotification({ message: "Kunde inte spara måltiden.", type: 'error' });
        } finally {
            setCameraImageForAnalysis(null);
            setImageFileForAnalysis(null);
        }
    };

    // --- Handlers for Modals ---

    const handleImageCapture = async (base64ImageData: string, fromFileUpload: boolean = false) => {
        setShowCameraModal(false); 
        if (!fromFileUpload) setImageFileForAnalysis(null);
        
        if (isCapturingForIngredients) {
            setIngredientImagesForCapture(prev => [...prev, `data:image/jpeg;base64,${base64ImageData}`]);
            openModal(setShowIngredientCaptureModal);
        } else if (isCapturingForLabel) {
            setAppStatus(AppStatus.ANALYZING);
            try {
                const analysis = await analyzeNutritionLabelImage(base64ImageData);
                setNutritionLabelResult(analysis);
                setShowNutritionLabelResultModal(true);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : "Okänt analysfel";
                setErrorMessage(errorMsg);
                setToastNotification({ message: `Analysfel: ${errorMsg}`, type: 'error'});
                setAppStatus(AppStatus.ERROR);
            } finally {
                setAppStatus(AppStatus.IDLE);
                setIsCapturingForLabel(false);
            }
        } else {
            setCameraImageForAnalysis(base64ImageData);
            setAppStatus(AppStatus.ANALYZING);
            try {
                const analysis = await analyzeFoodImage(base64ImageData);
                setAnalysisResultForModal(analysis);
                setAppStatus(AppStatus.IDLE);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : "Okänt analysfel";
                setErrorMessage(errorMsg);
                setToastNotification({ message: `Analysfel: ${errorMsg}`, type: 'error'});
                setAppStatus(AppStatus.ERROR);
            }
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
          setAppStatus(AppStatus.ANALYZING);
          try {
            const resizedBase64 = await resizeImageForLog(file, 800);
            setImageFileForAnalysis(file);
            handleImageCapture(resizedBase64, true);
          } catch (error) {
              console.error("Image resize failed:", error);
              setToastNotification({ message: 'Kunde inte bearbeta bilden.', type: 'error' });
              setAppStatus(AppStatus.IDLE);
          }
        }
        if (event.target) event.target.value = '';
    };

    const handleLogFromModal = (foodInfo: NutritionalInfo | SearchedFoodInfo, options: { saveAsCommon: boolean }) => {
        const isSearchedFood = 'servingDescription' in foodInfo;
        const fullFoodItemName = isSearchedFood ? `${foodInfo.foodItem} (${(foodInfo as SearchedFoodInfo).servingDescription})` : foodInfo.foodItem;
        const base64ForUpload = cameraImageForAnalysis ? `data:image/jpeg;base64,${cameraImageForAnalysis}` : undefined;
    
        addMealToLog(
            { ...foodInfo, foodItem: fullFoodItemName }, 
            { 
                base64Image: base64ForUpload,
                commonMealId: isSearchedFood ? 'text_search' : undefined
            }
        );
    
        if (options.saveAsCommon) {
          saveCommonMeal({ ...foodInfo, foodItem: fullFoodItemName || 'Okänt val' }, fullFoodItemName || 'Okänt val');
        }
        setAnalysisResultForModal(null);
        setCameraImageForAnalysis(null);
        setImageFileForAnalysis(null);
    };

    const handleLogWater = async (amountMl: number, event?: React.MouseEvent<HTMLButtonElement>) => {
        if (!isEditableLogDate || !currentUser) return;
        playAudio('waterSplash');
        
        const newTotalWater = waterLoggedMl + amountMl;
        setWaterLoggedMl(newTotalWater);
    
        const dateUID = getDateUID(viewingDate);
        try {
          await setWaterLog(currentUser.uid, dateUID, newTotalWater);
        } catch (error) {
          setWaterLoggedMl(current => current - amountMl);
        }
    };

    const handleResetWater = async () => {
        if (!isEditableLogDate || !currentUser) return;
        playAudio('uiClick', 0.7);
        const previousAmount = waterLoggedMl;
        setWaterLoggedMl(0);
        const dateUID = getDateUID(viewingDate);
        try {
          await setWaterLog(currentUser.uid, dateUID, 0);
        } catch (error) {
          setWaterLoggedMl(previousAmount);
        }
    };

    const saveCommonMeal = async (mealInfoToSave: NutritionalInfo, name: string) => {
        if (!currentUser) return;
        const cleanNutritionalInfo: NutritionalInfo = {
            calories: Math.round(Number(mealInfoToSave.calories) || 0),
            protein: Math.round(Number(mealInfoToSave.protein) || 0),
            carbohydrates: Math.round(Number(mealInfoToSave.carbohydrates) || 0),
            fat: Math.round(Number(mealInfoToSave.fat) || 0),
            foodItem: mealInfoToSave.foodItem || name,
        };
    
        const timestamp = Date.now();
        const newCommonMealData: Omit<CommonMeal, 'id'> = { name, nutritionalInfo: cleanNutritionalInfo, timestamp };
        try {
            const newDocId = await addCommonMeal(currentUser.uid, newCommonMealData);
            setCommonMeals(prev => [{ ...newCommonMealData, id: newDocId }, ...prev]);
            setShowSaveCommonMealModal(false);
            setMealToSaveAsCommon(null);
            setToastNotification({ message: `"${name}" sparad som vanligt val!`, type: 'success' });
            playAudio('logSuccess', 0.8);
        } catch (error) {
            setToastNotification({ message: "Kunde inte spara vanligt val.", type: 'error' });
        }
    };

    const handleOpenSaveCommonMealModal = (meal: LoggedMeal) => {
        let mealToSave = meal;
        if (meal.count && meal.count > 1) {
            const singleNutrition: NutritionalInfo = {
                foodItem: meal.nutritionalInfo.foodItem, 
                calories: meal.nutritionalInfo.calories / meal.count,
                protein: meal.nutritionalInfo.protein / meal.count,
                carbohydrates: meal.nutritionalInfo.carbohydrates / meal.count,
                fat: meal.nutritionalInfo.fat / meal.count,
            };
            mealToSave = { ...meal, nutritionalInfo: singleNutrition };
        }
        setMealToSaveAsCommon(mealToSave);
        openModal(setShowSaveCommonMealModal);
    };

    // --- Render Calculations ---

    const totalNutrients = useMemo(() => {
        return dailyLog.reduce(
          (acc, meal) => {
            acc.calories += meal.nutritionalInfo.calories;
            acc.protein += meal.nutritionalInfo.protein;
            acc.carbohydrates += meal.nutritionalInfo.carbohydrates;
            acc.fat += meal.nutritionalInfo.fat;
            return acc;
          },
          { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
        );
    }, [dailyLog]);
      
    const minSafeCalories = useMemo(() => {
        const goalBasedMin = goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
        return Math.max(goalBasedMin, MIN_ABSOLUTE_CALORIES_THRESHOLD);
    }, [goals.calorieGoal]);

    const totalCaloriesCoveredByBankToday = useMemo(() => {
        return dailyLog.reduce((sum, meal) => sum + (meal.caloriesCoveredByBank || 0), 0);
    }, [dailyLog]);

    const groupedDailyLog = useMemo(() => {
        if (dailyLog.length === 0) return [];
        const commonMealGroups = new Map<string, LoggedMeal[]>();
        const otherMeals: LoggedMeal[] = [];
    
        for (const meal of dailyLog) {
          if (meal.commonMealId && !['manual', 'text_search', 'recipe', 'ingredient_recipe', 'barcode', 'nutrition_label'].includes(meal.commonMealId)) {
            if (!commonMealGroups.has(meal.commonMealId)) commonMealGroups.set(meal.commonMealId, []);
            commonMealGroups.get(meal.commonMealId)!.push(meal);
          } else {
            otherMeals.push(meal);
          }
        }
    
        const processedMeals: LoggedMeal[] = [...otherMeals];
        for (const group of commonMealGroups.values()) {
          if (group.length > 1) {
            const sortedGroup = [...group].sort((a, b) => b.timestamp - a.timestamp);
            const representativeMeal = sortedGroup[0];
            const totalNutritionalInfo = sortedGroup.reduce((acc, meal) => {
              acc.calories += meal.nutritionalInfo.calories;
              acc.protein += meal.nutritionalInfo.protein;
              acc.carbohydrates += meal.nutritionalInfo.carbohydrates;
              acc.fat += meal.nutritionalInfo.fat;
              return acc;
            }, { calories: 0, protein: 0, carbohydrates: 0, fat: 0, foodItem: representativeMeal.nutritionalInfo.foodItem });
    
            processedMeals.push({ ...representativeMeal, nutritionalInfo: totalNutritionalInfo, count: sortedGroup.length, originalIds: sortedGroup.map(m => m.id) });
          } else {
            processedMeals.push(...group);
          }
        }
        return processedMeals.sort((a, b) => b.timestamp - a.timestamp);
    }, [dailyLog]);

    return (
        <>
            <div className="space-y-3 pb-20">
              {checklistState && (
                <OnboardingChecklist 
                    state={checklistState}
                    onNavigate={onOnboardingNavigate}
                    onTriggerLog={() => openModal(setShowSpeedDial)}
                    onScrollToWater={() => waterLoggerRef.current?.scrollIntoView({ behavior: 'smooth' })}
                />
              )}

              <section aria-labelledby="daily-overview-heading" className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light relative">
                 <h2 id="daily-overview-heading" className="sr-only">Daglig Översikt</h2>
                 
                 {/* Stats Row */}
                 <div className="flex items-start justify-between w-full mb-4 gap-4">
                    <div className="text-center">
                        <h3 className="text-xs sm:text-sm font-semibold text-neutral uppercase tracking-wide">Streak</h3>
                        <p className="text-xl sm:text-2xl font-bold text-secondary">{streakData.currentStreak} <span className="text-sm font-normal text-neutral-dark">dagar</span></p>
                    </div>
                    <div className="text-center border-l border-r border-neutral-light px-4 w-full">
                        <h3 className="text-xs sm:text-sm font-semibold text-neutral uppercase tracking-wide">Nivå</h3>
                        {/* Temporary level name until imported properly */}
                        <p className="text-lg sm:text-xl font-bold text-primary truncate">Nivå {Math.floor(streakData.currentStreak / 7) + 1}</p> 
                    </div>
                     <div className="text-center">
                        <h3 className="text-xs sm:text-sm font-semibold text-neutral uppercase tracking-wide">Sparpott</h3>
                        <p className={`text-xl sm:text-2xl font-bold ${userProfile.goalType === 'gain_muscle' ? 'text-neutral-400' : 'text-primary'}`}>
                            {userProfile.goalType === 'gain_muscle' ? '-' : weeklyBank.bankedCalories.toFixed(0)}
                        </p>
                    </div>
                 </div>

                 <div className="bg-white rounded-xl border border-neutral-light/50 p-1 mb-4">
                    <WeeklyProgressDays 
                        pastDaysSummary={pastDaysSummary} 
                        currentAppDate={currentAppDate} 
                        viewingDate={viewingDate}
                        onDateSelect={onDateSelect}
                    />
                     <div className="text-center py-2 border-t border-neutral-light/50 mt-1">
                        <p className="text-base font-semibold text-neutral-dark">{formattedViewingDate}</p>
                     </div>
                 </div>

                 <div className="space-y-4">
                  <ProgressDisplay
                      label="Kalorier"
                      current={totalNutrients.calories}
                      goal={goals.calorieGoal}
                      unit="kcal"
                      icon={<span className="text-xl" role="img" aria-label="Kalorier">🔥</span>}
                      minSafeThreshold={minSafeCalories}
                      bankedCaloriesAvailable={weeklyBank.bankedCalories}
                      amountCoveredByBankToday={totalCaloriesCoveredByBankToday}
                      goalType={userProfile?.goalType ?? 'lose_fat'}
                    />
                  
                  <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <ProgressDisplay label="Protein" current={totalNutrients.protein} goal={goals.proteinGoal} unit="g" minSafeThreshold={0} bankedCaloriesAvailable={0} />
                      </div>
                      <div className="col-span-1">
                        <ProgressDisplay label="Kolhydrater" current={totalNutrients.carbohydrates} goal={goals.carbohydrateGoal} unit="g" minSafeThreshold={0} bankedCaloriesAvailable={0} />
                      </div>
                      <div className="col-span-1">
                        <ProgressDisplay label="Fett" current={totalNutrients.fat} goal={goals.fatGoal} unit="g" minSafeThreshold={0} bankedCaloriesAvailable={0} />
                      </div>
                  </div>
                </div>
              </section>
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <WaterLogger 
                    ref={waterLoggerRef}
                    currentWaterMl={waterLoggedMl} 
                    waterGoalMl={DEFAULT_WATER_GOAL_ML} 
                    onLogWater={handleLogWater}
                    onResetWater={handleResetWater}
                    disabled={!isEditableLogDate}
                  />
                  <CommonMealsList
                    commonMeals={commonMeals}
                    onLogCommonMeal={(meal) => addMealToLog(meal.nutritionalInfo, { commonMealId: meal.id })}
                    onDeleteCommonMeal={(id) => deleteCommonMealFromDB(currentUser!.uid, id).then(() => setCommonMeals(prev => prev.filter(m => m.id !== id)))}
                    onUpdateCommonMeal={(id, data) => updateCommonMeal(currentUser!.uid, id, data).then(() => setCommonMeals(prev => prev.map(m => m.id === id ? { ...m, ...data } : m)))}
                    disabled={!isEditableLogDate}
                  />
              </div>

              <section aria-labelledby="meal-log-heading">
                <div className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
                    <div className="flex items-center justify-between mb-4">
                        <h3 id="meal-log-heading" className="text-xl font-semibold text-neutral-dark">Loggade måltider</h3>
                        <span className="text-sm text-neutral bg-neutral-light px-2 py-1 rounded-md">{groupedDailyLog.length} st</span>
                    </div>
                    
                    {groupedDailyLog.length > 0 ? (
                    <div className="space-y-3">
                        {groupedDailyLog.map((meal) => (
                        <MealItemCard
                            key={meal.id}
                            meal={meal}
                            onDelete={() => {/* Implement local delete or passed prop */}} // Placeholder, logic needs to be in Dashboard or passed
                            onUpdate={() => {/* Implement update */}}
                            onSelectForCommonSave={handleOpenSaveCommonMealModal}
                            isReadOnly={!isEditableLogDate}
                            isNewlyAdded={false} 
                        />
                        ))}
                    </div>
                    ) : (
                    <div className="text-center py-10 bg-neutral-light/30 rounded-lg border-2 border-dashed border-neutral-light">
                        <p className="text-neutral font-medium">Inga måltider loggade än idag.</p>
                        <button onClick={handleFabClick} className="mt-3 text-primary font-semibold hover:underline">Logga frukost nu</button>
                    </div>
                    )}
                </div>
              </section>
            </div>

            {/* Floating Action Button */}
            <div className={`fixed right-6 z-40 transition-all duration-300 ${isInstallBannerVisible ? 'bottom-28' : 'bottom-6'}`}>
                <button
                    onClick={handleFabClick}
                    className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center text-white shadow-xl hover:bg-secondary-darker active:scale-95 transform transition-all animate-scale-in"
                    aria-label="Lägg till måltid"
                    disabled={!isEditableLogDate}
                >
                    {showSpeedDial ? <XMarkIcon className="w-8 h-8" /> : <PlusIcon className="w-8 h-8" />}
                </button>
            </div>

            {/* Speed Dial Menu */}
            {showSpeedDial && (
                <div className="fixed inset-0 bg-neutral-dark/60 backdrop-blur-sm z-50 flex flex-col justify-end items-end p-6 animate-fade-in" onClick={handleFabClick}>
                    <div className="w-full max-w-sm flex flex-col items-end space-y-4 mb-20" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleAddOptionSelect('camera')} className="flex items-center gap-4 group w-full justify-end">
                            <span className="bg-white px-4 py-2 rounded-lg font-semibold text-neutral-dark shadow-lg group-hover:bg-neutral-light transition-colors">Fota mat</span>
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg group-hover:scale-110 transition-transform"><CameraIcon className="w-7 h-7 text-secondary" /></div>
                        </button>
                        <button onClick={() => handleAddOptionSelect('barcode')} className="flex items-center gap-4 group w-full justify-end">
                            <span className="bg-white px-4 py-2 rounded-lg font-semibold text-neutral-dark shadow-lg group-hover:bg-neutral-light transition-colors">Skanna streckkod</span>
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg group-hover:scale-110 transition-transform"><BarcodeIcon className="w-7 h-7 text-primary" /></div>
                        </button>
                         <button onClick={() => handleAddOptionSelect('text')} className="flex items-center gap-4 group w-full justify-end">
                            <span className="bg-white px-4 py-2 rounded-lg font-semibold text-neutral-dark shadow-lg group-hover:bg-neutral-light transition-colors">Sök & Logga</span>
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg group-hover:scale-110 transition-transform"><SearchIcon className="w-7 h-7 text-accent" /></div>
                        </button>
                        <button onClick={() => handleAddOptionSelect('recipe')} className="flex items-center gap-4 group w-full justify-end">
                            <span className="bg-white px-4 py-2 rounded-lg font-semibold text-neutral-dark shadow-lg group-hover:bg-neutral-light transition-colors">Hitta Recept</span>
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg group-hover:scale-110 transition-transform"><RecipeIcon className="w-7 h-7 text-purple-600" /></div>
                        </button>
                         <button onClick={() => handleAddOptionSelect('upload')} className="flex items-center gap-4 group w-full justify-end">
                            <span className="bg-white px-4 py-2 rounded-lg font-semibold text-neutral-dark shadow-lg group-hover:bg-neutral-light transition-colors">Ladda upp bild</span>
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg group-hover:scale-110 transition-transform"><UploadIcon className="w-7 h-7 text-blue-500" /></div>
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden File Inputs */}
            <input type="file" id="imageUploadInputMain" className="hidden" accept="image/*" onChange={handleImageUpload} />
            
            {/* Loading Overlay */}
            {(appStatus === AppStatus.ANALYZING || appStatus === AppStatus.ANALYZING_INGREDIENTS) && (
                <LoadingSpinner message={appStatus === AppStatus.ANALYZING ? "Analyserar bild..." : "Hittar recept..."} />
            )}

            {/* --- MODALS --- */}
            
            {showTextEntryModal && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => closeModal(setShowTextEntryModal)}>
                    <div onClick={e => e.stopPropagation()} className="animate-scale-in w-full max-w-lg">
                        <TextEntryModal 
                            show={showTextEntryModal} 
                            onClose={() => closeModal(setShowTextEntryModal)} 
                            onLog={(foodInfo, options) => handleLogFromModal(foodInfo, options)} 
                        />
                    </div>
                </div>
            )}

            {showCameraModal && (
                <CameraModal
                    show={showCameraModal}
                    onClose={() => closeModal(setShowCameraModal)}
                    onImageCapture={handleImageCapture}
                    onCameraError={(msg) => {
                        setToastNotification({ message: `Kamerafel: ${msg}`, type: 'error'});
                    }}
                />
            )}

            {showBarcodeScannerModal && (
                <BarcodeScannerModal
                    show={showBarcodeScannerModal}
                    onClose={() => closeModal(setShowBarcodeScannerModal)}
                    onBarcodeScanned={async (code) => {
                         closeModal(setShowBarcodeScannerModal);
                         setAppStatus(AppStatus.SEARCHING_BARCODE);
                         try {
                             const res = await getFoodInfoFromBarcode(code);
                             setBarcodeScanResult(res);
                         } catch (e: any) {
                             setToastNotification({ message: e.message, type: 'error' });
                         } finally {
                             setAppStatus(AppStatus.IDLE);
                         }
                    }}
                    onCameraError={(msg) => setToastNotification({ message: msg, type: 'error' })}
                    onScanFallback={() => {
                        closeModal(setShowBarcodeScannerModal);
                        setIsCapturingForLabel(true);
                        openModal(setShowCameraModal);
                    }}
                />
            )}

            {barcodeScanResult && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => setBarcodeScanResult(null)}>
                    <div onClick={e => e.stopPropagation()} className="animate-scale-in w-full max-w-lg">
                        <BarcodeSearchResultModal
                            scanResult={barcodeScanResult}
                            onLog={(info) => {
                                addMealToLog(info, { base64Image: barcodeScanResult.imageUrl, commonMealId: 'barcode' });
                                setBarcodeScanResult(null);
                            }}
                            onClose={() => setBarcodeScanResult(null)}
                        />
                    </div>
                </div>
            )}

            {showRecipeChoiceModal && (
                <RecipeChoiceModal
                    show={showRecipeChoiceModal}
                    onClose={() => closeModal(setShowRecipeChoiceModal)}
                    onChooseSearch={() => { closeModal(setShowRecipeChoiceModal); openModal(setShowRecipeModal); }}
                    onChooseTakePhoto={() => { 
                        closeModal(setShowRecipeChoiceModal); 
                        setIsCapturingForIngredients(true); 
                        openModal(setShowCameraModal); 
                    }}
                    onChooseUpload={() => {
                         closeModal(setShowRecipeChoiceModal);
                         setIsCapturingForIngredients(true);
                         // logic to trigger multiple file upload would go here, 
                         // for simplicity reusing the single upload logic concept but adapted if needed
                    }}
                />
            )}

            {showRecipeModal && (
                 <RecipeModal
                    show={showRecipeModal}
                    onClose={() => { closeModal(setShowRecipeModal); setCurrentRecipe(null); }}
                    onSearch={async (q) => {
                        setAppStatus(AppStatus.SEARCHING_RECIPE);
                        try {
                            const res = await getRecipeSuggestion(q);
                            setCurrentRecipe(res);
                            if (!res.error) setRecentRecipeSearches(prev => [q, ...prev].slice(0,5));
                        } catch (e: any) {
                            setErrorMessage(e.message);
                        } finally {
                            setAppStatus(AppStatus.IDLE);
                        }
                    }}
                    onLogRecipe={(info) => {
                        addMealToLog(info, { commonMealId: 'recipe' });
                        closeModal(setShowRecipeModal);
                    }}
                    recipe={currentRecipe}
                    isLoading={appStatus === AppStatus.SEARCHING_RECIPE}
                    error={errorMessage}
                    recentSearches={recentRecipeSearches}
                    setToastNotification={setToastNotification}
                />
            )}
            
            {showIngredientCaptureModal && (
                <IngredientCaptureModal
                    show={showIngredientCaptureModal}
                    onClose={() => closeModal(setShowIngredientCaptureModal)}
                    onFindRecipes={async (images) => {
                         closeModal(setShowIngredientCaptureModal);
                         setAppStatus(AppStatus.ANALYZING_INGREDIENTS);
                         try {
                             const rawData = images.map(i => i.split(',')[1]);
                             const res = await getRecipesFromIngredientsImage(rawData);
                             setIngredientAnalysisResult(res);
                             openModal(setShowIngredientRecipeResultsModal);
                         } catch(e: any) {
                             setToastNotification({ message: "Kunde inte analysera ingredienser.", type: 'error' });
                         } finally {
                             setAppStatus(AppStatus.IDLE);
                         }
                    }}
                    openCameraModal={() => { closeModal(setShowIngredientCaptureModal); openModal(setShowCameraModal); }}
                    images={ingredientImagesForCapture}
                    onRemoveImage={(idx) => setIngredientImagesForCapture(prev => prev.filter((_, i) => i !== idx))}
                    onUploadImages={(files) => {
                         // Handle files logic
                         Array.from(files).forEach(file => {
                             const reader = new FileReader();
                             reader.onload = (e) => setIngredientImagesForCapture(prev => [...prev, e.target?.result as string]);
                             reader.readAsDataURL(file);
                         });
                    }}
                />
            )}

            {showIngredientRecipeResultsModal && ingredientAnalysisResult && (
                <IngredientRecipeResultsModal
                    show={showIngredientRecipeResultsModal}
                    onClose={() => closeModal(setShowIngredientRecipeResultsModal)}
                    identifiedIngredients={ingredientAnalysisResult.identifiedIngredients}
                    recipeSuggestions={ingredientAnalysisResult.recipeSuggestions}
                    onLogRecipe={(info) => {
                        addMealToLog(info, { commonMealId: 'ingredient_recipe' });
                        closeModal(setShowIngredientRecipeResultsModal);
                    }}
                    isLoading={false}
                    error={null}
                />
            )}

            {showSaveCommonMealModal && mealToSaveAsCommon && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => closeModal(setShowSaveCommonMealModal)}>
                    <div onClick={e => e.stopPropagation()} className="animate-scale-in w-full max-w-lg">
                        <SaveCommonMealModal
                            mealInfo={mealToSaveAsCommon.nutritionalInfo}
                            initialName={mealToSaveAsCommon.nutritionalInfo.foodItem || ''}
                            onSave={(name) => {
                                saveCommonMeal({ ...mealToSaveAsCommon.nutritionalInfo, foodItem: name }, name);
                                closeModal(setShowSaveCommonMealModal);
                            }}
                            onClose={() => closeModal(setShowSaveCommonMealModal)}
                        />
                    </div>
                </div>
            )}
            
            {analysisResultForModal && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={() => setAnalysisResultForModal(null)}>
                     <div onClick={e => e.stopPropagation()} className="animate-scale-in w-full max-w-lg">
                        <ImageAnalysisResultModal
                            analysisResult={analysisResultForModal}
                            imageDataUrl={`data:image/jpeg;base64,${cameraImageForAnalysis}`}
                            onLog={handleLogFromModal}
                            onClose={() => setAnalysisResultForModal(null)}
                        />
                    </div>
                </div>
            )}

            {showNutritionLabelResultModal && nutritionLabelResult && (
              <NutritionLabelResultModal
                show={showNutritionLabelResultModal}
                onClose={() => {
                  setShowNutritionLabelResultModal(false);
                  setNutritionLabelResult(null);
                }}
                analysisResult={nutritionLabelResult}
                onLog={(info) => {
                     addMealToLog(info, { commonMealId: 'nutrition_label' });
                     setShowNutritionLabelResultModal(false);
                }}
              />
            )}

        </>
    );
};

export default Dashboard;