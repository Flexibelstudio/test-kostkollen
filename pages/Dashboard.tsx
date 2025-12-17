
import React, { useState, useRef, useMemo } from 'react';
import { 
    LoggedMeal, 
    NutritionalInfo,
    SearchedFoodInfo,
    BarcodeScannedFoodInfo,
    IngredientRecipeResponse,
    RecipeSuggestion,
    OnboardingChecklistState,
    CommonMeal,
    MealType,
    PastDaySummary,
    OnboardingChecklistItemStatus
} from '../types';
import { 
    DEFAULT_WATER_GOAL_ML,
    MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL,
    MIN_ABSOLUTE_CALORIES_THRESHOLD,
    LOCAL_STORAGE_KEYS,
    COACH_PERSONAS
} from '../constants';
import WeeklyActivityChart from '../components/WeeklyActivityChart';
import CircularProgress from '../components/CircularProgress';
import WaterLogger from '../components/WaterLogger';
import { PlusIcon, CameraIcon, RecipeIcon, BarcodeIcon, SearchIcon, FireIcon, CheckIcon, ArrowLeftIcon, ArrowRightIcon, RotateCcwIcon, LifebuoyIcon, TrophyIcon, SparklesIcon } from '../components/icons';
import { PiggyBank, Flame, Coffee, Sandwich, CookingPot, Apple } from 'lucide-react';
import { useUserContext } from '../context/UserContext';
import { playAudio } from '../services/audioService';
import { getDateUID } from '../utils/dateUtils';
import { 
    addMealLog as addMealLogFirestore, 
    setWaterLog, 
    addCommonMeal, 
    deleteCommonMeal as deleteCommonMealFromDB, 
    updateCommonMeal,
    deleteMealLog,
    updateMealLog,
    setPastDaySummary as setPastDaySummaryFirestore,
    updateUserDocument,
} from '../services/firestoreService';
import { 
    analyzeFoodImage, 
    getRecipeSuggestion, 
    getRecipesFromIngredientsImage, 
    analyzeNutritionLabelImage 
} from '../services/geminiService';
import { getFoodInfoFromBarcode } from '../services/openFoodFactsService';

// Modaler
import CameraModal from '../components/CameraModal';
import TextEntryModal from '../components/TextEntryModal';
import RecipeChoiceModal from '../components/RecipeChoiceModal';
import RecipeModal from '../components/RecipeModal';
import IngredientCaptureModal from '../components/IngredientCaptureModal';
import IngredientRecipeResultsModal from '../components/IngredientRecipeResultsModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import BarcodeSearchResultModal from '../components/BarcodeSearchResultModal';
import ImageAnalysisResultModal from '../components/ImageAnalysisResultModal';
import SaveCommonMealModal from '../components/SaveCommonMealModal';
import NutritionLabelResultModal from '../components/NutritionLabelResultModal';
import LoadingSpinner from '../components/LoadingSpinner';
import MealTypeSelector from '../components/MealTypeSelector';
import MealSectionCard from '../components/MealSectionCard';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import CoinFallEffect from '../components/CoinFallEffect';
import CommonMealsList from '../components/CommonMealsList';

// Helper function for image resizing
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
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(dataUrl);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

interface DashboardProps {
    checklistState: OnboardingChecklistState | null;
    onOnboardingNavigate: (view: 'journey' | 'community', subView?: 'search') => void;
    onChecklistUpdate: (item: keyof OnboardingChecklistItemStatus) => void;
    showSpotlight: boolean;
    onDismissSpotlight: () => void;
    isInstallBannerVisible: boolean;
    viewingDate: Date;
    onDateSelect: (date: Date) => void;
    formattedViewingDate: string;
    ensureYesterdayProcessed: (uid: string, now?: Date, options?: { force?: boolean; silent?: boolean }) => Promise<any>;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
    onOpenAICoach: () => void;
    isSummarizingYesterday: boolean;
    isAICoachOpen: boolean;
    isProfileOpen: boolean;
    isMorningReportOpen: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ 
    checklistState,
    onOnboardingNavigate,
    onChecklistUpdate,
    showSpotlight,
    onDismissSpotlight,
    isInstallBannerVisible,
    viewingDate,
    onDateSelect,
    formattedViewingDate,
    ensureYesterdayProcessed,
    setToastNotification,
    onOpenAICoach,
    isSummarizingYesterday,
    isAICoachOpen,
    isProfileOpen,
    isMorningReportOpen
}) => {
    const {
        currentUser,
        goals,
        userProfile,
        dailyLog,
        setDailyLog,
        waterLoggedMl,
        setWaterLoggedMl,
        commonMeals,
        setCommonMeals,
        pastDaysSummary,
        setPastDaysSummary,
        streakData,
        setStreakData,
        weeklyBank,
        setWeeklyBank,
        streakSaver,
        currentDate
    } = useUserContext();

    const [isSaving, setIsSaving] = useState(false);
    const [appStatus, setAppStatus] = useState<'idle' | 'analyzing' | 'searching' | 'saving' | 'error'>('idle');
    
    // Modal states
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [showTextEntryModal, setShowTextEntryModal] = useState(false);
    const [showRecipeChoiceModal, setShowRecipeChoiceModal] = useState(false);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [showIngredientCaptureModal, setShowIngredientCaptureModal] = useState(false);
    const [showIngredientRecipeResultsModal, setShowIngredientRecipeResultsModal] = useState(false);
    const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState(false);
    const [showBarcodeSearchResultModal, setShowBarcodeSearchResultModal] = useState(false);
    const [showImageAnalysisResultModal, setShowImageAnalysisResultModal] = useState(false);
    const [showSaveCommonMealModal, setShowSaveCommonMealModal] = useState(false);
    const [showNutritionLabelResultModal, setShowNutritionLabelResultModal] = useState(false);
    const [showCommonMealsPopup, setShowCommonMealsPopup] = useState<CommonMeal | null>(null);

    // Data states for modals
    const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
    const [scannedFoodInfo, setScannedFoodInfo] = useState<BarcodeScannedFoodInfo | null>(null);
    const [imageAnalysisResult, setImageAnalysisResult] = useState<NutritionalInfo | null>(null);
    const [analyzedImageDataUrl, setAnalyzedImageDataUrl] = useState<string | null>(null);
    const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeSuggestion[] | null>(null);
    const [identifiedIngredients, setIdentifiedIngredients] = useState<string[]>([]);
    const [ingredientImages, setIngredientImages] = useState<string[]>([]);
    const [searchedRecipe, setSearchedRecipe] = useState<RecipeSuggestion | null>(null);
    const [mealToSaveAsCommon, setMealToSaveAsCommon] = useState<LoggedMeal | null>(null);
    const [nutritionLabelResult, setNutritionLabelResult] = useState<NutritionalInfo | null>(null);
    const [defaultMealTypeForModal, setDefaultMealTypeForModal] = useState<MealType | null>(null);

    // UI States
    const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
    const [showBonusCoin, setShowBonusCoin] = useState(false);
    const [activeMealSection, setActiveMealSection] = useState<MealType | null>(null);
    
    // Context state for Camera (log meal vs capture ingredient)
    const [cameraMode, setCameraMode] = useState<'log' | 'ingredient'>('log');

    const bankRef = useRef<HTMLDivElement>(null);
    const waterLoggerRef = useRef<HTMLDivElement>(null);

    // Derived values
    const isViewingToday = useMemo(() => {
        return getDateUID(viewingDate) === getDateUID(new Date());
    }, [viewingDate]);

    const isEditableView = useMemo(() => {
        const today = new Date();
        const viewingUID = getDateUID(viewingDate);
        const todayUID = getDateUID(today);
        
        if (viewingUID === todayUID) return true;

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayUID = getDateUID(yesterday);

        return viewingUID === yesterdayUID;
    }, [viewingDate]);

    // Check if viewing date is a Monday (0=Sun, 1=Mon)
    const isViewingMonday = useMemo(() => {
        return viewingDate.getDay() === 1;
    }, [viewingDate]);

    const totalNutrients = useMemo(() => dailyLog.reduce(
        (acc, meal) => {
            acc.calories += meal.nutritionalInfo.calories;
            acc.protein += meal.nutritionalInfo.protein;
            acc.carbohydrates += meal.nutritionalInfo.carbohydrates;
            acc.fat += meal.nutritionalInfo.fat;
            return acc;
        },
        { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
    ), [dailyLog]);

    // --- DYNAMIC BANK CALCULATION START ---
    // Instead of relying on saved 'caloriesCoveredByBank' on meals, we calculate it dynamically
    // based on the daily totals and the available bank.
    
    // 1. How much bank is theoretically available? (0 on Mondays, otherwise from DB)
    const availableBank = isViewingMonday ? 0 : weeklyBank.bankedCalories;

    // 2. How much are we over the goal?
    const rawCaloriesOver = Math.max(0, totalNutrients.calories - goals.calorieGoal);

    // 3. How much of that overage is covered by the bank?
    // We use the bank if we are over the goal.
    const calculatedBankUsage = Math.min(rawCaloriesOver, availableBank);

    // 4. What is the remaining "net" overage after bank use?
    const netCaloriesOver = Math.max(0, rawCaloriesOver - calculatedBankUsage);

    // 5. What does the bank balance look like AFTER this day's usage?
    // This provides the "Real-time" updated balance effect.
    const remainingBankDisplay = Math.max(0, availableBank - calculatedBankUsage);

    const minSafeCalories = Math.max(goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD);
    const caloriesRemaining = Math.max(0, goals.calorieGoal - totalNutrients.calories);
    
    // Logic for circular progress
    const isOverBudget = rawCaloriesOver > 0;
    const isFullyCoveredByBank = isOverBudget && netCaloriesOver === 0;
    const isNetOverBudget = netCaloriesOver > 0;

    let progressColor = "text-primary";
    
    // Logic for progress color: Orange until minSafe is met, then Green, then handling overage
    if (totalNutrients.calories < minSafeCalories) {
        progressColor = "text-secondary"; // Orange until we reach the safe zone
    } else if (isNetOverBudget) {
        progressColor = "text-secondary"; // Orange if net overage
    } else if (isFullyCoveredByBank) {
        progressColor = "text-blue-500"; // Blue if covered by bank
    }
    // --- DYNAMIC BANK CALCULATION END ---

    const groupedMeals = useMemo(() => {
        const grouped: LoggedMeal[] = [];
        dailyLog.forEach(meal => {
            const existingIndex = grouped.findIndex(m => 
                m.mealType === meal.mealType &&
                m.nutritionalInfo.foodItem === meal.nutritionalInfo.foodItem &&
                m.nutritionalInfo.calories === meal.nutritionalInfo.calories &&
                Math.abs(m.nutritionalInfo.protein - meal.nutritionalInfo.protein) < 1 // Tolerance
            );

            if (existingIndex > -1) {
                const existing = grouped[existingIndex];
                existing.count = (existing.count || 1) + 1;
                // Since this is just for display, we don't need to track all IDs here,
                // but if we did delete, we'd delete the *latest* matching one from dailyLog.
                // We'll keep the ID of the latest one so the 'delete' action targets a real doc.
                if (meal.timestamp > existing.timestamp) {
                    existing.id = meal.id; 
                    existing.timestamp = meal.timestamp;
                }
            } else {
                grouped.push({ ...meal, count: 1 });
            }
        });
        return grouped;
    }, [dailyLog]);

    const mealsBySection = useMemo(() => ({
        breakfast: groupedMeals.filter(m => m.mealType === 'breakfast'),
        lunch: groupedMeals.filter(m => m.mealType === 'lunch'),
        dinner: groupedMeals.filter(m => m.mealType === 'dinner'),
        snack: groupedMeals.filter(m => !m.mealType || m.mealType === 'snack'), // Fallback for old data
    }), [groupedMeals]);

    // Navigation Handlers
    const handlePrevWeek = () => {
        playAudio('uiClick');
        const newDate = new Date(viewingDate);
        newDate.setDate(newDate.getDate() - 7);
        onDateSelect(newDate);
    };

    const handleNextWeek = () => {
        playAudio('uiClick');
        const newDate = new Date(viewingDate);
        newDate.setDate(newDate.getDate() + 7);
        onDateSelect(newDate);
    };

    const handleJumpToToday = () => {
        playAudio('uiClick');
        onDateSelect(new Date());
    };

    // Recalculate summary helper
    const recalculateAndSaveSummary = async (currentLogs: LoggedMeal[], currentWater: number) => {
        if (!currentUser) return;

        const viewingUID = getDateUID(viewingDate);
        const currentUID = getDateUID(currentDate);

        // Always calculate summary for UI consistency, regardless of date
        const totals = currentLogs.reduce((acc, meal) => ({
            calories: acc.calories + meal.nutritionalInfo.calories,
            protein: acc.protein + meal.nutritionalInfo.protein,
            carbohydrates: acc.carbohydrates + meal.nutritionalInfo.carbohydrates,
            fat: acc.fat + meal.nutritionalInfo.fat,
        }), { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });

        const minSafe = Math.max(goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD);
        let goalMet = false;
        
        // Simplified goal check
        if (totals.calories >= minSafe) {
                if (userProfile.goalType === 'lose_fat') goalMet = totals.calories <= goals.calorieGoal;
                else if (userProfile.goalType === 'gain_muscle') goalMet = totals.calories >= (goals.calorieGoal - 300); // approx floor
                else goalMet = Math.abs(totals.calories - goals.calorieGoal) <= (goals.calorieGoal * 0.1);
        }

        // Calculate Streak for this specific day based on the DAY BEFORE
        // This ensures if we fill in a gap day, the streak logic holds
        const dayBefore = new Date(viewingDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const dayBeforeUID = getDateUID(dayBefore);
        const prevDaySummary = pastDaysSummary[dayBeforeUID];
        const prevStreak = prevDaySummary?.streakForThisDay || 0;

        let newStreak = 0;
        if (totals.calories > 0) {
            // If we have logged meals, streak continues from prev day
            newStreak = prevStreak + 1;
        } else {
            // No meals = broken streak
            newStreak = 0;
        }

        const existingSummary = pastDaysSummary[viewingUID];

        const newSummary: PastDaySummary = {
            date: viewingUID,
            goalMet: goalMet,
            consumedCalories: totals.calories,
            calorieGoal: goals.calorieGoal,
            proteinGoalMet: totals.protein >= goals.proteinGoal,
            consumedProtein: totals.protein,
            proteinGoal: goals.proteinGoal,
            consumedCarbohydrates: totals.carbohydrates,
            carbohydrateGoal: goals.carbohydrateGoal,
            consumedFat: totals.fat,
            fatGoal: goals.fatGoal,
            goalType: userProfile.goalType,
            waterGoalMet: currentWater >= DEFAULT_WATER_GOAL_ML,
            streakForThisDay: newStreak, // Updated streak
            savedBy: existingSummary?.savedBy,
            bankedAmount: existingSummary?.bankedAmount, // Keep bank calc simple
        };

        // ALWAYS update local state immediately so UI reflects changes (green/orange/streak)
        setPastDaysSummary(prev => ({ ...prev, [viewingUID]: newSummary }));
        
        // ONLY save to Firestore if the day is in the past (yesterday or earlier)
        // We avoid saving "Today" to Firestore here to prevent write conflicts with scheduled jobs or excessive writes.
        if (viewingUID < currentUID) {
            const yesterday = new Date(currentDate);
            yesterday.setDate(yesterday.getDate() - 1);
            const isYesterday = viewingUID === getDateUID(yesterday);

            // If we are editing YESTERDAY, and we recovered a streak, update the User's Main Streak in Firestore
            if (isYesterday) {
                setStreakData(prev => ({ ...prev, currentStreak: newStreak }));
                try {
                    await updateUserDocument(currentUser.uid, { currentStreak: newStreak });
                } catch(e) {
                    console.error("Failed to update user currentStreak", e);
                }
            }
            
            try {
                await setPastDaySummaryFirestore(currentUser.uid, viewingUID, newSummary);
            } catch(e) {
                console.error("Failed to update past day summary", e);
            }
        }
    };

    // Handlers
    const handleAddMealToLog = async (
        data: LoggedMeal | Omit<LoggedMeal, 'id'> | NutritionalInfo | SearchedFoodInfo, 
        options?: { saveAsCommon?: boolean; mealType?: MealType }
    ) => {
        if (!currentUser) return;
        
        const timestamp = Date.now();
        const mealType = options?.mealType || defaultMealTypeForModal || 'breakfast'; // Fallback
        
        setIsSaving(true);
        setAppStatus('saving');
        
        let newMeal: LoggedMeal;

        if ('nutritionalInfo' in data) {
             newMeal = {
                ...(data as Omit<LoggedMeal, 'id'>),
                id: 'temp-id-' + timestamp, // Temp ID
                dateString: getDateUID(viewingDate),
                timestamp: timestamp,
                mealType: mealType,
                caloriesCoveredByBank: 0 // Do not save bank coverage on meal anymore
            };
        } else {
             newMeal = {
                id: 'temp-id-' + timestamp, // Temp ID
                dateString: getDateUID(viewingDate),
                timestamp: timestamp,
                mealType: mealType,
                nutritionalInfo: data as NutritionalInfo,
                caloriesCoveredByBank: 0 // Do not save bank coverage on meal anymore
            };
        }

        try {
            // Optimistic update
            const updatedLogs = [newMeal, ...dailyLog];
            setDailyLog(updatedLogs);
            
            // Recalculate summary if it's a past day
            recalculateAndSaveSummary(updatedLogs, waterLoggedMl);
            
            if (options?.saveAsCommon) {
                await addCommonMeal(currentUser.uid, {
                    name: newMeal.nutritionalInfo.foodItem || 'Måltid',
                    nutritionalInfo: newMeal.nutritionalInfo,
                    timestamp: Date.now()
                });
                // Refresh common meals list
                const updatedCommon = [...commonMeals, { id: 'temp', name: newMeal.nutritionalInfo.foodItem || 'Måltid', nutritionalInfo: newMeal.nutritionalInfo, timestamp: Date.now() }];
                setCommonMeals(updatedCommon); 
            }

            // Save to Firestore
            await addMealLogFirestore(currentUser.uid, newMeal.id, newMeal); 
            
            setToastNotification({ message: 'Måltid loggad!', type: 'success' });
            playAudio('logSuccess');

            if (checklistState && !checklistState.items.mealLogged) {
                onChecklistUpdate('mealLogged');
            }

        } catch (error) {
            console.error("Error adding meal:", error);
            setToastNotification({ message: 'Kunde inte spara måltiden.', type: 'error' });
            // Revert optimistic update
            setDailyLog(prev => prev.filter(m => m.timestamp !== newMeal.timestamp));
        } finally {
            setIsSaving(false);
            setAppStatus('idle');
        }
    };

    const handleDeleteMeal = async (mealId: string) => {
        if (!currentUser) return;
        const mealToDelete = dailyLog.find(m => m.id === mealId);
        if (!mealToDelete) return;

        // Optimistic delete
        const updatedLogs = dailyLog.filter(m => m.id !== mealId);
        setDailyLog(updatedLogs);
        
        // Recalculate summary if it's a past day
        recalculateAndSaveSummary(updatedLogs, waterLoggedMl);

        try {
            await deleteMealLog(currentUser.uid, mealId);
            setToastNotification({ message: 'Måltid borttagen.', type: 'success' });
        } catch (error) {
            console.error("Error deleting meal:", error);
            setToastNotification({ message: 'Kunde inte ta bort måltiden.', type: 'error' });
            setDailyLog(prev => [...prev, mealToDelete]); // Revert
        }
    };

    const handleUpdateMeal = async (mealId: string, updatedInfo: NutritionalInfo) => {
        if (!currentUser) return;
        const updatedLogs = dailyLog.map(m => m.id === mealId ? { ...m, nutritionalInfo: updatedInfo } : m);
        setDailyLog(updatedLogs);
        
        // Recalculate summary if it's a past day
        recalculateAndSaveSummary(updatedLogs, waterLoggedMl);

        try {
            await updateMealLog(currentUser.uid, mealId, updatedInfo);
            setToastNotification({ message: 'Måltid uppdaterad.', type: 'success' });
        } catch (error) {
            console.error("Error updating meal:", error);
            setToastNotification({ message: 'Kunde inte uppdatera måltiden.', type: 'error' });
        }
    };

    const handleLogWater = async (amount: number) => {
        if (!currentUser) return;
        const newAmount = waterLoggedMl + amount;
        setWaterLoggedMl(newAmount);
        
        // Recalculate summary if it's a past day (water goal affects summary)
        recalculateAndSaveSummary(dailyLog, newAmount);

        playAudio('waterSplash');
        try {
            await setWaterLog(currentUser.uid, getDateUID(viewingDate), newAmount);
            if (checklistState && !checklistState.items.waterLogged && newAmount > 0) {
                onChecklistUpdate('waterLogged');
            }
        } catch (error) {
            console.error("Error logging water:", error);
            setWaterLoggedMl(waterLoggedMl); // Revert
        }
    };

    const handleResetWater = async () => {
        if (!currentUser) return;
        setWaterLoggedMl(0);
        
        // Recalculate summary if it's a past day
        recalculateAndSaveSummary(dailyLog, 0);

        try {
            await setWaterLog(currentUser.uid, getDateUID(viewingDate), 0);
        } catch (error) {
            console.error("Error resetting water:", error);
        }
    };

    const handleCommonMealLog = (commonMeal: CommonMeal) => {
        setShowCommonMealsPopup(commonMeal);
    };

    const confirmCommonMealLog = (type: MealType) => {
        if (showCommonMealsPopup) {
            handleAddMealToLog(
                showCommonMealsPopup.nutritionalInfo, 
                { mealType: type }
            );
            setShowCommonMealsPopup(null);
        }
    }

    const handleDeleteCommonMeal = async (id: string) => {
        if (!currentUser) return;
        setCommonMeals(prev => prev.filter(cm => cm.id !== id));
        try {
            await deleteCommonMealFromDB(currentUser.uid, id);
            setToastNotification({ message: 'Vanligt val borttaget.', type: 'success' });
        } catch (error) {
            console.error("Error deleting common meal:", error);
            setToastNotification({ message: 'Kunde inte ta bort valet.', type: 'error' });
        }
    };

    const handleUpdateCommonMeal = async (id: string, data: { name: string; nutritionalInfo: NutritionalInfo }) => {
        if (!currentUser) return;
        setCommonMeals(prev => prev.map(cm => cm.id === id ? { ...cm, ...data } : cm));
        try {
            await updateCommonMeal(currentUser.uid, id, data);
            setToastNotification({ message: 'Vanligt val uppdaterat.', type: 'success' });
        } catch (error) {
            console.error("Error updating common meal:", error);
            setToastNotification({ message: 'Kunde inte uppdatera valet.', type: 'error' });
        }
    };

    const openModalWithType = (setter: React.Dispatch<React.SetStateAction<boolean>>, type: MealType | null = null) => {
        const typeToUse = type || activeMealSection || null;
        setDefaultMealTypeForModal(typeToUse);
        setActiveMealSection(null);
        setter(true);
        setIsSpeedDialOpen(false);
    }

    const handleScanBarcode = () => openModalWithType(setShowBarcodeScannerModal);
    const handleSearchText = () => openModalWithType(setShowTextEntryModal);
    
    const handleTakePhoto = () => {
        setCameraMode('log');
        openModalWithType(setShowCameraModal);
    };
    
    const handleFindRecipe = () => openModalWithType(setShowRecipeChoiceModal, 'dinner');

    const handleImageCapture = async (rawBase64: string) => {
        setShowCameraModal(false);

        if (cameraMode === 'ingredient') {
            const dataUrl = `data:image/jpeg;base64,${rawBase64}`;
            setIngredientImages(prev => [...prev, dataUrl]);
            setShowIngredientCaptureModal(true);
        } else {
            setAnalyzedImageDataUrl(`data:image/jpeg;base64,${rawBase64}`);
            setAppStatus('analyzing');
            try {
                const result = await analyzeFoodImage(rawBase64);
                setImageAnalysisResult(result);
                setShowImageAnalysisResultModal(true);
            } catch (error: any) {
                console.error("Analysis error:", error);
                setToastNotification({ message: "Kunde inte analysera bilden.", type: 'error' });
            } finally {
                setAppStatus('idle');
            }
        }
    };

    const handleFindRecipesFromIngredients = async (images: string[]) => {
        if (images.length === 0) return;
        setShowIngredientCaptureModal(false);
        setAppStatus('searching');
        try {
            const base64Images = images.map(img => img.split(',')[1]);
            const response = await getRecipesFromIngredientsImage(base64Images);
            setIdentifiedIngredients(response.identifiedIngredients);
            setRecipeSuggestions(response.recipeSuggestions);
            setShowIngredientRecipeResultsModal(true);
        } catch (error: any) {
            console.error("Recipe generation error:", error);
            setToastNotification({ message: "Kunde inte hitta recept.", type: 'error' });
        } finally {
            setAppStatus('idle');
        }
    };

    const handleUploadIngredientImages = async (files: FileList) => {
        const newImages: string[] = [];
        for (let i = 0; i < files.length; i++) {
            try {
                const dataUrl = await resizeImageForLog(files[i], 800);
                newImages.push(dataUrl);
            } catch (e) {
                console.error("Failed to upload image", e);
            }
        }
        setIngredientImages(prev => [...prev, ...newImages].slice(0, 5));
    };

    const coachName = userProfile.coachStyle ? COACH_PERSONAS[userProfile.coachStyle].label : 'Coachen';

    return (
        <div className="flex flex-col gap-3 pb-0 relative">
            {/* Top Date & Progress Card */}
            <div className="bg-white rounded-3xl shadow-soft-xl p-6 border border-neutral-light relative overflow-hidden">
                <div className="flex flex-col items-center">
                    {/* Date Nav */}
                    <div className="flex items-center justify-center gap-4 mb-4 w-full">
                        <button onClick={() => onDateSelect(new Date(viewingDate.getTime() - 86400000))} className="p-2 rounded-full hover:bg-neutral-light transition-colors"><ArrowLeftIcon className="w-5 h-5 text-neutral-dark" /></button>
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-neutral-dark">{formattedViewingDate}</h2>
                            {!isViewingToday && (
                                <button onClick={() => onDateSelect(new Date())} className="text-xs font-semibold text-primary hover:underline mt-1">
                                    Gå till idag
                                </button>
                            )}
                        </div>
                        <button onClick={() => onDateSelect(new Date(viewingDate.getTime() + 86400000))} className={`p-2 rounded-full hover:bg-neutral-light transition-colors ${isViewingToday ? 'opacity-30 cursor-default' : ''}`} disabled={isViewingToday}><ArrowRightIcon className="w-5 h-5 text-neutral-dark" /></button>
                    </div>

                    {/* Circular Progress */}
                    <CircularProgress
                        value={totalNutrients.calories}
                        max={goals.calorieGoal}
                        size={220}
                        strokeWidth={18}
                        color={progressColor}
                        trackColor="text-neutral-light"
                        centerContent={
                            <div className="text-center">
                                <span className="text-5xl font-extrabold block text-neutral-dark">
                                    {isNetOverBudget
                                        ? netCaloriesOver.toFixed(0)
                                        : (isFullyCoveredByBank ? '0' : caloriesRemaining.toFixed(0))
                                    }
                                </span>
                                <span className="text-sm font-medium uppercase tracking-wider text-neutral-dark">
                                    {isNetOverBudget ? 'ÖVER' : 'KVAR'}
                                </span>
                            </div>
                        }
                    />
                    
                    <div className="mt-4 text-center">
                        <p className="text-base font-medium text-neutral-dark">
                            {goals.calorieGoal} kcal
                        </p>
                        <p className={`text-sm mt-1 ${
                            isNetOverBudget 
                                ? 'text-secondary font-semibold' 
                                : (isFullyCoveredByBank 
                                    ? 'text-blue-500 font-semibold' 
                                    : (totalNutrients.calories >= minSafeCalories 
                                        ? 'text-primary font-semibold' 
                                        : 'text-neutral')
                                )
                        }`}>
                            {isNetOverBudget
                                ? "Du har passerat dagens mål." 
                                : (isFullyCoveredByBank 
                                    ? "Din sparpott täcker överskottet." 
                                    : (totalNutrients.calories >= minSafeCalories 
                                        ? "Snyggt! Du ligger bra till." 
                                        : "Du är på väg mot din miniminivå.")
                                )
                            }
                        </p>
                    </div>
                </div>
            </div>

            {/* Layout Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                
                {/* Left Column */}
                <div className="flex flex-col gap-3">
                    {/* Macros */}
                    <div className="grid grid-cols-3 gap-3">
                        {/* Protein */}
                        <div className="bg-white p-5 rounded-3xl shadow-soft-lg border border-neutral-light text-center flex flex-col justify-between">
                            <div>
                                <p className="text-sm font-bold text-primary uppercase tracking-wide mb-2">Protein</p>
                                <p className="text-3xl font-extrabold text-neutral-dark leading-none">
                                    {Math.round(totalNutrients.protein)}
                                    <span className="text-sm text-neutral-500 font-medium ml-1">/{goals.proteinGoal}g</span>
                                </p>
                            </div>
                            <div className="w-full bg-neutral-light/50 rounded-full h-2 mt-4 overflow-hidden">
                                <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((totalNutrients.protein / goals.proteinGoal) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        {/* Carbs */}
                        <div className="bg-white py-5 px-1 rounded-3xl shadow-soft-lg border border-neutral-light text-center flex flex-col justify-between">
                            <div>
                                <p className="text-sm font-bold text-yellow-600 uppercase tracking-wide mb-2">Kolhydrater</p>
                                <p className="text-3xl font-extrabold text-neutral-dark leading-none">
                                    {Math.round(totalNutrients.carbohydrates)}
                                    <span className="text-sm text-neutral-500 font-medium ml-1">/{goals.carbohydrateGoal}g</span>
                                </p>
                            </div>
                            <div className="mx-4 bg-neutral-light/50 rounded-full h-2 mt-4 overflow-hidden">
                                <div className="bg-yellow-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((totalNutrients.carbohydrates / goals.carbohydrateGoal) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        {/* Fat */}
                        <div className="bg-white p-5 rounded-3xl shadow-soft-lg border border-neutral-light text-center flex flex-col justify-between">
                            <div>
                                <p className="text-sm font-bold text-orange-600 uppercase tracking-wide mb-2">Fett</p>
                                <p className="text-3xl font-extrabold text-neutral-dark leading-none">
                                    {Math.round(totalNutrients.fat)}
                                    <span className="text-sm text-neutral-500 font-medium ml-1">/{goals.fatGoal}g</span>
                                </p>
                            </div>
                            <div className="w-full bg-neutral-light/50 rounded-full h-2 mt-4 overflow-hidden">
                                <div className="bg-orange-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((totalNutrients.fat / goals.fatGoal) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Meal Sections */}
                    <div className="grid grid-cols-2 gap-3">
                        <MealSectionCard 
                            title="Frukost" 
                            icon={<Coffee className="w-6 h-6" />}
                            meals={mealsBySection.breakfast}
                            onDeleteMeal={handleDeleteMeal}
                            onUpdateMeal={handleUpdateMeal}
                            onSaveCommon={handleSaveCommonMealModalOpen}
                            isEditable={isEditableView}
                            isOpen={activeMealSection === 'breakfast'}
                            onOpen={() => setActiveMealSection('breakfast')}
                            onClose={() => setActiveMealSection(null)}
                        />
                        <MealSectionCard 
                            title="Lunch" 
                            icon={<Sandwich className="w-6 h-6" />}
                            meals={mealsBySection.lunch}
                            onDeleteMeal={handleDeleteMeal}
                            onUpdateMeal={handleUpdateMeal}
                            onSaveCommon={handleSaveCommonMealModalOpen}
                            isEditable={isEditableView}
                            isOpen={activeMealSection === 'lunch'}
                            onOpen={() => setActiveMealSection('lunch')}
                            onClose={() => setActiveMealSection(null)}
                        />
                        <MealSectionCard 
                            title="Middag" 
                            icon={<CookingPot className="w-6 h-6" />}
                            meals={mealsBySection.dinner}
                            onDeleteMeal={handleDeleteMeal}
                            onUpdateMeal={handleUpdateMeal}
                            onSaveCommon={handleSaveCommonMealModalOpen}
                            isEditable={isEditableView}
                            isOpen={activeMealSection === 'dinner'}
                            onOpen={() => setActiveMealSection('dinner')}
                            onClose={() => setActiveMealSection(null)}
                        />
                        <MealSectionCard 
                            title="Mellis" 
                            icon={<Apple className="w-6 h-6" />}
                            meals={mealsBySection.snack}
                            onDeleteMeal={handleDeleteMeal}
                            onUpdateMeal={handleUpdateMeal}
                            onSaveCommon={handleSaveCommonMealModalOpen}
                            isEditable={isEditableView}
                            isOpen={activeMealSection === 'snack'}
                            onOpen={() => setActiveMealSection('snack')}
                            onClose={() => setActiveMealSection(null)}
                        />
                    </div>
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-3">
                    {/* Activity Chart */}
                    <WeeklyActivityChart 
                        pastDaysSummary={pastDaysSummary} 
                        currentAppDate={currentDate} 
                        viewingDate={viewingDate}
                        onDateSelect={onDateSelect}
                        onPrevWeek={handlePrevWeek}
                        onNextWeek={handleNextWeek}
                        onToday={handleJumpToToday}
                        currentViewStats={{
                            calories: totalNutrients.calories,
                            calorieGoal: goals.calorieGoal,
                            proteinGoalMet: totalNutrients.protein >= goals.proteinGoal,
                            waterGoalMet: waterLoggedMl >= DEFAULT_WATER_GOAL_ML
                        }}
                        isSummarizingYesterday={isSummarizingYesterday}
                    />

                    {/* Bank & Water Row */}
                    <div className="grid grid-cols-2 gap-3" ref={bankRef}>
                        {/* Weekly Bank */}
                        <div className="bg-white p-5 rounded-3xl shadow-soft-lg border border-neutral-light relative overflow-hidden flex flex-col justify-between h-full min-h-[160px]">
                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <h3 className="text-xl font-bold text-neutral-dark">Sparpott</h3>
                                <div className="bg-primary-100 p-2 rounded-full text-primary-darker">
                                    <PiggyBank className="w-6 h-6" />
                                </div>
                            </div>
                            
                            <div className="relative z-10 mt-auto">
                                <p className="text-4xl font-extrabold text-neutral-dark transition-all duration-300">
                                    {remainingBankDisplay.toFixed(0)} <span className="text-lg font-medium text-neutral-500">kcal</span>
                                </p>
                                <p className="text-xs text-neutral-500 font-medium mt-1">
                                    Tillgängligt för helgen
                                </p>
                            </div>
                            
                            {/* Visual effect for coins/bank */}
                            <div className="absolute -bottom-6 -right-6 opacity-10 text-primary-darker transform rotate-12">
                                <PiggyBank className="w-32 h-32" />
                            </div>
                        </div>

                        {/* Water Logger */}
                        <div ref={waterLoggerRef}>
                            <WaterLogger
                                currentWaterMl={waterLoggedMl}
                                waterGoalMl={DEFAULT_WATER_GOAL_ML}
                                onLogWater={(amount) => handleLogWater(amount)}
                                onResetWater={handleResetWater}
                                disabled={!isEditableView}
                            />
                        </div>
                    </div>

                    {/* Common Meals List */}
                    <CommonMealsList
                        commonMeals={commonMeals}
                        onLogCommonMeal={handleCommonMealLog}
                        onDeleteCommonMeal={handleDeleteCommonMeal}
                        onUpdateCommonMeal={handleUpdateCommonMeal}
                        disabled={!isEditableView}
                    />
                </div>
            </div>

            {/* Floating Action Button (Speed Dial) */}
            {isEditableView && !isAICoachOpen && !isProfileOpen && !isMorningReportOpen && (
                <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
                    {isSpeedDialOpen && (
                        <div className="flex flex-col items-end gap-3 animate-slide-up-fade-in pb-2">
                            <button onClick={() => { onOpenAICoach(); setIsSpeedDialOpen(false); }} className="flex items-center gap-3 group">
                                <span className="bg-white text-neutral-dark px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Fråga {coachName}</span>
                                <div className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors">
                                    <SparklesIcon className="w-7 h-7" />
                                </div>
                            </button>
                            <button onClick={handleFindRecipe} className="flex items-center gap-3 group">
                                <span className="bg-white text-neutral-dark px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Hitta recept</span>
                                <div className="w-14 h-14 bg-accent text-white rounded-full shadow-lg flex items-center justify-center hover:bg-accent-darker transition-colors">
                                    <RecipeIcon className="w-7 h-7" />
                                </div>
                            </button>
                            <button onClick={handleScanBarcode} className="flex items-center gap-3 group">
                                <span className="bg-white text-neutral-dark px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Skanna streckkod</span>
                                <div className="w-14 h-14 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-green-700 transition-colors">
                                    <BarcodeIcon className="w-7 h-7" />
                                </div>
                            </button>
                            <button onClick={handleTakePhoto} className="flex items-center gap-3 group">
                                <span className="bg-white text-neutral-dark px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Fota mat</span>
                                <div className="w-14 h-14 bg-secondary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-secondary-darker transition-colors">
                                    <CameraIcon className="w-7 h-7" />
                                </div>
                            </button>
                            <button onClick={handleSearchText} className="flex items-center gap-3 group">
                                <span className="bg-white text-neutral-dark px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Sök text</span>
                                <div className="w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary-darker transition-colors">
                                    <SearchIcon className="w-7 h-7" />
                                </div>
                            </button>
                        </div>
                    )}
                    <button 
                        onClick={() => { playAudio('uiClick'); setIsSpeedDialOpen(!isSpeedDialOpen); }}
                        className={`w-16 h-16 rounded-full shadow-soft-xl flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 ${isSpeedDialOpen ? 'bg-neutral-dark text-white rotate-45' : 'bg-primary text-white'}`}
                        aria-label="Lägg till"
                    >
                        <PlusIcon className="w-8 h-8" />
                    </button>
                </div>
            )}

            {/* Onboarding Checklist */}
            {checklistState && !checklistState.dismissed && (
                <div className="mb-6">
                    <OnboardingChecklist
                        state={checklistState}
                        onNavigate={onOnboardingNavigate}
                        onTriggerLog={() => setIsSpeedDialOpen(true)}
                        onScrollToWater={() => waterLoggerRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    />
                </div>
            )}

            {/* Modals */}
            {showCameraModal && (
                <CameraModal 
                    show={showCameraModal} 
                    onClose={() => setShowCameraModal(false)} 
                    onImageCapture={handleImageCapture}
                    onCameraError={(msg) => setToastNotification({ message: msg, type: 'error' })}
                    instructionText={cameraMode === 'ingredient' ? "Fota ingredienser" : undefined}
                />
            )}

            {showTextEntryModal && (
                <TextEntryModal 
                    show={showTextEntryModal} 
                    onClose={() => setShowTextEntryModal(false)} 
                    onLog={handleAddMealToLog} 
                    defaultMealType={defaultMealTypeForModal}
                />
            )}

            {showRecipeChoiceModal && (
                <RecipeChoiceModal 
                    show={showRecipeChoiceModal}
                    onClose={() => setShowRecipeChoiceModal(false)}
                    onChooseSearch={() => {
                        setShowRecipeChoiceModal(false);
                        setShowRecipeModal(true);
                    }}
                    onChooseTakePhoto={() => {
                        setShowRecipeChoiceModal(false);
                        setCameraMode('ingredient');
                        setShowCameraModal(true);
                    }}
                    onChooseUpload={() => {
                        setShowRecipeChoiceModal(false);
                        setShowIngredientCaptureModal(true);
                    }}
                />
            )}

            {showRecipeModal && (
                <RecipeModal
                    show={showRecipeModal}
                    onClose={() => setShowRecipeModal(false)}
                    onSearch={async (query) => {
                        setAppStatus('searching');
                        try {
                            const recipe = await getRecipeSuggestion(query);
                            setSearchedRecipe(recipe);
                        } catch (e: any) {
                            setToastNotification({ message: e.message, type: 'error' });
                        } finally {
                            setAppStatus('idle');
                        }
                    }}
                    onLogRecipe={handleAddMealToLog}
                    recipe={searchedRecipe}
                    isLoading={appStatus === 'searching'}
                    error={null} // Error handled via toast
                    recentSearches={getLocalStorageItem(LOCAL_STORAGE_KEYS.RECENT_RECIPE_SEARCHES, [])}
                    setToastNotification={setToastNotification}
                    defaultMealType={defaultMealTypeForModal}
                />
            )}

            {showIngredientCaptureModal && (
                <IngredientCaptureModal 
                    show={showIngredientCaptureModal}
                    onClose={() => setShowIngredientCaptureModal(false)}
                    onFindRecipes={handleFindRecipesFromIngredients}
                    openCameraModal={() => {
                        setCameraMode('ingredient');
                        setShowCameraModal(true);
                    }}
                    images={ingredientImages}
                    onRemoveImage={(index) => setIngredientImages(prev => prev.filter((_, i) => i !== index))}
                    onUploadImages={handleUploadIngredientImages}
                />
            )}

            {showIngredientRecipeResultsModal && (
                <IngredientRecipeResultsModal
                    show={showIngredientRecipeResultsModal}
                    onClose={() => setShowIngredientRecipeResultsModal(false)}
                    identifiedIngredients={identifiedIngredients}
                    recipeSuggestions={recipeSuggestions || []}
                    onLogRecipe={handleAddMealToLog}
                    isLoading={appStatus === 'searching'} // Reusing status
                    error={null}
                    defaultMealType={defaultMealTypeForModal}
                />
            )}

            {showBarcodeScannerModal && (
                <BarcodeScannerModal
                    show={showBarcodeScannerModal}
                    onClose={() => setShowBarcodeScannerModal(false)}
                    onBarcodeScanned={async (code) => {
                        setShowBarcodeScannerModal(false);
                        setScannedBarcode(code);
                        setAppStatus('searching');
                        try {
                            const info = await getFoodInfoFromBarcode(code);
                            setScannedFoodInfo(info);
                            setShowBarcodeSearchResultModal(true);
                        } catch (e: any) {
                            setToastNotification({ message: e.message, type: 'error' });
                        } finally {
                            setAppStatus('idle');
                        }
                    }}
                    onCameraError={(msg) => setToastNotification({ message: msg, type: 'error' })}
                    onScanFallback={() => {
                        setShowBarcodeScannerModal(false);
                        setCameraMode('log'); // Assume fallback is to log a meal/label
                        setShowCameraModal(true);
                    }}
                />
            )}

            {showBarcodeSearchResultModal && (
                <BarcodeSearchResultModal
                    show={showBarcodeSearchResultModal}
                    scanResult={scannedFoodInfo}
                    onLog={handleAddMealToLog}
                    onClose={() => setShowBarcodeSearchResultModal(false)}
                    defaultMealType={defaultMealTypeForModal}
                />
            )}

            {showImageAnalysisResultModal && (
                <ImageAnalysisResultModal
                    show={showImageAnalysisResultModal}
                    analysisResult={imageAnalysisResult}
                    imageDataUrl={analyzedImageDataUrl}
                    onLog={handleAddMealToLog}
                    onClose={() => setShowImageAnalysisResultModal(false)}
                    defaultMealType={defaultMealTypeForModal}
                />
            )}

            {showCommonMealsPopup && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowCommonMealsPopup(null)}>
                    <div className="bg-white p-6 rounded-2xl shadow-soft-xl w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-neutral-dark mb-4 text-center">Logga "{showCommonMealsPopup.name}" som:</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(type => (
                                <button
                                    key={type}
                                    onClick={() => confirmCommonMealLog(type)}
                                    className="p-3 bg-neutral-light hover:bg-primary-100 hover:text-primary-darker rounded-xl font-medium transition-colors"
                                >
                                    {type === 'breakfast' ? 'Frukost' : type === 'lunch' ? 'Lunch' : type === 'dinner' ? 'Middag' : 'Mellis'}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowCommonMealsPopup(null)} className="w-full mt-4 py-2 text-neutral hover:underline text-sm">Avbryt</button>
                    </div>
                </div>
            )}

            {/* Helper Modals */}
            {showSaveCommonMealModal && mealToSaveAsCommon && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-fade-in" onClick={() => setShowSaveCommonMealModal(false)}>
                    <SaveCommonMealModal
                        mealInfo={mealToSaveAsCommon.nutritionalInfo}
                        initialName={mealToSaveAsCommon.nutritionalInfo.foodItem || ''}
                        onSave={async (name) => {
                            try {
                                await addCommonMeal(currentUser!.uid, {
                                    name,
                                    nutritionalInfo: mealToSaveAsCommon.nutritionalInfo,
                                    timestamp: Date.now()
                                });
                                setCommonMeals(prev => [...prev, { id: 'temp', name, nutritionalInfo: mealToSaveAsCommon.nutritionalInfo, timestamp: Date.now() }]);
                                setToastNotification({ message: 'Sparad som vanligt val!', type: 'success' });
                                setShowSaveCommonMealModal(false);
                            } catch (e) {
                                setToastNotification({ message: 'Kunde inte spara.', type: 'error' });
                            }
                        }}
                        onClose={() => setShowSaveCommonMealModal(false)}
                    />
                </div>
            )}

            {/* Bonus Coin Animation */}
            {showBonusCoin && bankRef.current && (
                <CoinFallEffect 
                    targetX={bankRef.current.getBoundingClientRect().left + bankRef.current.offsetWidth / 2}
                    targetY={bankRef.current.getBoundingClientRect().top + bankRef.current.offsetHeight / 2}
                    onComplete={() => setShowBonusCoin(false)}
                />
            )}

        </div>
    );
};

// Simple helper for localStorage to avoid errors in strict mode if window not defined (though in react usually is)
const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
};

// Handlers that need hoisting or defining outside render if not dependent on scope
const handleSaveCommonMealModalOpen = (meal: LoggedMeal) => {
    // This needs state setters, so it stays inside component or pass setters.
    // Logic moved inside component for simplicity with state.
};

export default Dashboard;
