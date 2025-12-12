
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
    PastDaySummary
} from '../types';
import { 
    DEFAULT_WATER_GOAL_ML,
    MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL,
    MIN_ABSOLUTE_CALORIES_THRESHOLD,
    LOCAL_STORAGE_KEYS,
} from '../constants';
import WeeklyActivityChart from '../components/WeeklyActivityChart';
import CircularProgress from '../components/CircularProgress';
import WaterLogger from '../components/WaterLogger';
import { PlusIcon, CameraIcon, RecipeIcon, BarcodeIcon, SearchIcon, FireIcon, CheckIcon, ArrowLeftIcon, ArrowRightIcon, RotateCcwIcon, LifebuoyIcon, TrophyIcon } from '../components/icons';
import { PiggyBank, Flame } from 'lucide-react';
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
    showSpotlight: boolean;
    onDismissSpotlight: () => void;
    isInstallBannerVisible: boolean;
    viewingDate: Date;
    onDateSelect: (date: Date) => void;
    formattedViewingDate: string;
    ensureYesterdayProcessed: (uid: string, now?: Date, options?: { force?: boolean; silent?: boolean }) => Promise<any>;
    setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
    checklistState,
    onOnboardingNavigate,
    showSpotlight,
    onDismissSpotlight,
    isInstallBannerVisible,
    viewingDate,
    onDateSelect,
    formattedViewingDate,
    ensureYesterdayProcessed,
    setToastNotification
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
    const [activeMealSection, setActiveMealSection] = useState<MealType | null>(null); // Lifted state for open section

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

    const totalCoveredByBank = useMemo(() => {
        // On Mondays, the bank resets. You cannot use bank from previous week.
        if (isViewingMonday) return 0;

        return dailyLog.reduce(
            (sum, meal) => sum + (meal.caloriesCoveredByBank || 0), 0
        );
    }, [dailyLog, isViewingMonday]);

    const minSafeCalories = Math.max(goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD);
    const caloriesRemaining = Math.max(0, goals.calorieGoal - totalNutrients.calories);
    
    const rawCaloriesOver = Math.max(0, totalNutrients.calories - goals.calorieGoal);
    // Net overage is total overage minus what the bank covered.
    const netCaloriesOver = Math.max(0, rawCaloriesOver - totalCoveredByBank);
    
    // Logic for circular progress
    const isOverBudget = rawCaloriesOver > 0;
    // If we are over budget, but bank covers it all (netOver is 0), then it's fully covered.
    // Note: On Mondays, totalCoveredByBank is forced to 0, so this will be false if over budget.
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
                mealType: mealType
            };
        } else {
             newMeal = {
                id: 'temp-id-' + timestamp, // Temp ID
                dateString: getDateUID(viewingDate),
                timestamp: timestamp,
                mealType: mealType,
                nutritionalInfo: data as NutritionalInfo
            };
        }

        try {
            // Calculate bank usage
            const caloriesBefore = totalNutrients.calories;
            const caloriesAfter = caloriesBefore + newMeal.nutritionalInfo.calories;
            
            let coveredByBank = 0;
            // Only consider using bank if it's NOT Monday
            if (caloriesAfter > goals.calorieGoal && !isViewingMonday) {
                const overage = caloriesAfter - goals.calorieGoal;
                const availableBank = weeklyBank.bankedCalories;
                if (availableBank > 0) {
                    const previouslyCovered = dailyLog.reduce((sum, m) => sum + (m.caloriesCoveredByBank || 0), 0);
                    const newTotalCovered = Math.min(availableBank, previouslyCovered + overage);
                    coveredByBank = Math.max(0, newTotalCovered - previouslyCovered);
                }
            }
            newMeal.caloriesCoveredByBank = coveredByBank;

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

    // Modal openers with "context awareness"
    // If a specific type is passed, we use it. 
    // If NOT passed, we check `activeMealSection`.
    // If still null, default to null (force user to choose).
    const openModalWithType = (setter: React.Dispatch<React.SetStateAction<boolean>>, type: MealType | null = null) => {
        const typeToUse = type || activeMealSection || null;
        setDefaultMealTypeForModal(typeToUse);
        
        // IMPORTANT: Close the section list view when we start a logging action
        setActiveMealSection(null);
        
        setter(true);
        setIsSpeedDialOpen(false);
    }

    const handleScanBarcode = () => openModalWithType(setShowBarcodeScannerModal);
    const handleSearchText = () => openModalWithType(setShowTextEntryModal);
    const handleTakePhoto = () => openModalWithType(setShowCameraModal);
    const handleFindRecipe = () => openModalWithType(setShowRecipeChoiceModal, 'dinner'); // Recipe usually for dinner

    // Context-aware openers (from Section Cards 'Add' button - removed in child but kept for logic structure if needed later)
    // Actually, the section card add button is removed per request, but the Section Card itself is clickable to OPEN.
    // The requirement: "Remove + on meal cards, remove Add button in modal".
    // AND "Can fab button be visible when modal is open?" -> YES.
    // AND "Question 1 close" -> When FAB is clicked, modal closes.

    // --- RENDER ---

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

                    {/* Water & Streak/Bank */}
                    <div className="grid grid-cols-2 gap-3">
                        <div ref={waterLoggerRef} className="h-full">
                            <WaterLogger
                                currentWaterMl={waterLoggedMl}
                                waterGoalMl={DEFAULT_WATER_GOAL_ML}
                                onLogWater={(amount) => handleLogWater(amount)}
                                onResetWater={handleResetWater}
                                disabled={!isEditableView}
                            />
                        </div>
                        <div className="flex flex-col gap-3">
                            {/* Streak Card */}
                            <div className="bg-white p-4 rounded-2xl shadow-soft-lg border border-neutral-light flex items-center gap-4 relative overflow-hidden group hover:shadow-soft-xl transition-all duration-300">
                                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm relative z-10">
                                    <Flame className="w-7 h-7" />
                                </div>
                                <div className="relative z-10 flex-1">
                                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Streak</p>
                                    <p className="text-2xl font-extrabold text-neutral-dark leading-none">
                                        {streakData.currentStreak} 
                                        <span className="text-sm font-medium text-neutral ml-1">dagar</span>
                                    </p>
                                </div>
                            </div>

                            {/* Bank Card */}
                            <div ref={bankRef} className="bg-white p-4 rounded-2xl shadow-soft-lg border border-neutral-light flex items-center gap-4 relative overflow-hidden group hover:shadow-soft-xl transition-all duration-300">
                                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-darker shadow-sm relative z-10">
                                    <PiggyBank className="w-7 h-7" />
                                </div>
                                <div className="relative z-10 flex-1">
                                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Sparpott</p>
                                    <p className="text-2xl font-extrabold text-neutral-dark leading-none">
                                        {weeklyBank.bankedCalories} 
                                        <span className="text-sm font-medium text-neutral ml-1">kcal</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Weekly Activity */}
                    <WeeklyActivityChart 
                        pastDaysSummary={pastDaysSummary}
                        currentAppDate={new Date()}
                        viewingDate={viewingDate}
                        onDateSelect={onDateSelect}
                        onPrevWeek={handlePrevWeek}
                        onNextWeek={handleNextWeek}
                        onToday={handleJumpToToday}
                        goalType={userProfile.goalType} // Pass goalType here
                        currentViewStats={{ // Pass live stats for current day
                            calories: totalNutrients.calories,
                            calorieGoal: goals.calorieGoal,
                            proteinGoalMet: totalNutrients.protein >= goals.proteinGoal,
                            waterGoalMet: waterLoggedMl >= DEFAULT_WATER_GOAL_ML
                        }}
                    />
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-3">
                    
                    <CommonMealsList 
                        commonMeals={commonMeals}
                        onLogCommonMeal={handleCommonMealLog}
                        onDeleteCommonMeal={handleDeleteCommonMeal}
                        onUpdateCommonMeal={handleUpdateCommonMeal}
                        disabled={!isEditableView}
                    />

                    {/* Meal Sections */}
                    <div className="bg-white p-5 rounded-3xl shadow-soft-xl border border-neutral-light">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xl font-bold text-neutral-dark">Måltider</h3>
                        </div>
                        <div className="space-y-2">
                            <MealSectionCard 
                                title="Frukost" 
                                icon="☕" 
                                meals={mealsBySection.breakfast} 
                                onDeleteMeal={handleDeleteMeal}
                                onUpdateMeal={handleUpdateMeal}
                                onSaveCommon={(meal) => setMealToSaveAsCommon(meal)}
                                isEditable={isEditableView}
                                isOpen={activeMealSection === 'breakfast'}
                                onOpen={() => setActiveMealSection('breakfast')}
                                onClose={() => setActiveMealSection(null)}
                            />
                            <MealSectionCard 
                                title="Lunch" 
                                icon="🥪" 
                                meals={mealsBySection.lunch} 
                                onDeleteMeal={handleDeleteMeal}
                                onUpdateMeal={handleUpdateMeal}
                                onSaveCommon={(meal) => setMealToSaveAsCommon(meal)}
                                isEditable={isEditableView}
                                isOpen={activeMealSection === 'lunch'}
                                onOpen={() => setActiveMealSection('lunch')}
                                onClose={() => setActiveMealSection(null)}
                            />
                            <MealSectionCard 
                                title="Middag" 
                                icon="🍝" 
                                meals={mealsBySection.dinner} 
                                onDeleteMeal={handleDeleteMeal}
                                onUpdateMeal={handleUpdateMeal}
                                onSaveCommon={(meal) => setMealToSaveAsCommon(meal)}
                                isEditable={isEditableView}
                                isOpen={activeMealSection === 'dinner'}
                                onOpen={() => setActiveMealSection('dinner')}
                                onClose={() => setActiveMealSection(null)}
                            />
                            <MealSectionCard 
                                title="Mellanmål" 
                                icon="🍿" 
                                meals={mealsBySection.snack} 
                                onDeleteMeal={handleDeleteMeal}
                                onUpdateMeal={handleUpdateMeal}
                                onSaveCommon={(meal) => setMealToSaveAsCommon(meal)}
                                isEditable={isEditableView}
                                isOpen={activeMealSection === 'snack'}
                                onOpen={() => setActiveMealSection('snack')}
                                onClose={() => setActiveMealSection(null)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Backdrop for Speed Dial */}
            {isEditableView && isSpeedDialOpen && (
                <div 
                    className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm z-[100] animate-fade-in"
                    onClick={() => setIsSpeedDialOpen(false)}
                />
            )}

            {/* Floating Action Button (FAB) */}
            {isEditableView && (
                <div className="fixed bottom-6 right-6 z-[105] flex flex-col items-end gap-3 pointer-events-none">
                    {isSpeedDialOpen && (
                        <div className="flex flex-col items-end gap-3 animate-slide-up-fade-in pointer-events-auto">
                            <button onClick={handleTakePhoto} className="flex items-center gap-3">
                                <span className="bg-white text-neutral-dark px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap">Fota mat</span>
                                <div className="w-12 h-12 bg-secondary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-secondary-darker transition-colors"><CameraIcon className="w-6 h-6" /></div>
                            </button>
                            <button onClick={handleScanBarcode} className="flex items-center gap-3">
                                <span className="bg-white text-neutral-dark px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap">Skanna kod</span>
                                <div className="w-12 h-12 bg-accent text-white rounded-full shadow-lg flex items-center justify-center hover:bg-accent-darker transition-colors"><BarcodeIcon className="w-6 h-6" /></div>
                            </button>
                            <button onClick={handleSearchText} className="flex items-center gap-3">
                                <span className="bg-white text-neutral-dark px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap">Sök & logga</span>
                                <div className="w-12 h-12 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors"><SearchIcon className="w-6 h-6" /></div>
                            </button>
                            <button onClick={handleFindRecipe} className="flex items-center gap-3">
                                <span className="bg-white text-neutral-dark px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap">Hitta recept</span>
                                <div className="w-12 h-12 bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-purple-600 transition-colors"><RecipeIcon className="w-6 h-6" /></div>
                            </button>
                        </div>
                    )}
                    <button 
                        onClick={() => { playAudio('uiClick'); setIsSpeedDialOpen(!isSpeedDialOpen); }}
                        className={`pointer-events-auto w-16 h-16 rounded-full shadow-soft-xl flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 ${isSpeedDialOpen ? 'bg-neutral-dark text-white rotate-45' : 'bg-primary text-white'}`}
                        aria-label="Lägg till"
                    >
                        <PlusIcon className="w-8 h-8" />
                    </button>
                </div>
            )}

            {/* Checklist & Spotlight (Onboarding) */}
            {checklistState && !checklistState.dismissed && (
                <div className="mt-8 mb-4 max-w-lg mx-auto">
                    <OnboardingChecklist 
                        state={checklistState}
                        onNavigate={onOnboardingNavigate}
                        onTriggerLog={() => { setIsSpeedDialOpen(true); }}
                        onScrollToWater={() => { waterLoggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                    />
                </div>
            )}
            
            {showSpotlight && (
                <div className="fixed inset-0 bg-black/50 z-[100] pointer-events-none">
                    <div className="absolute bottom-6 right-6 w-16 h-16 rounded-full ring-4 ring-white animate-pulse pointer-events-auto cursor-pointer" onClick={onDismissSpotlight}></div>
                    <div className="absolute bottom-28 right-6 bg-white p-4 rounded-xl shadow-lg w-64 pointer-events-auto">
                        <h4 className="font-bold text-neutral-dark mb-1">Här är magin! ✨</h4>
                        <p className="text-sm text-neutral">Använd plus-knappen för att logga allt: kameran, sök, recept och streckkod.</p>
                        <button onClick={onDismissSpotlight} className="mt-3 text-sm font-semibold text-primary hover:underline w-full text-right">Fattar!</button>
                    </div>
                </div>
            )}

            {/* Effects & Modals */}
            {showBonusCoin && bankRef.current && (
                <CoinFallEffect 
                    targetX={bankRef.current.getBoundingClientRect().left + bankRef.current.offsetWidth / 2} 
                    targetY={bankRef.current.getBoundingClientRect().top + bankRef.current.offsetHeight / 2} 
                    onComplete={() => setShowBonusCoin(false)} 
                />
            )}

            {/* All Modals */}
            {showCommonMealsPopup && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-60 flex items-center justify-center z-[90] p-4 animate-fade-in" onClick={() => setShowCommonMealsPopup(null)}>
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-neutral-dark mb-4">Välj måltid för "{showCommonMealsPopup.name}"</h3>
                        <MealTypeSelector selectedType={null} onSelect={(type) => confirmCommonMealLog(type)} className="w-full" />
                        <button onClick={() => setShowCommonMealsPopup(null)} className="mt-4 w-full py-2 text-neutral text-sm hover:underline">Avbryt</button>
                    </div>
                </div>
            )}

            {showCameraModal && <CameraModal show={showCameraModal} onClose={() => setShowCameraModal(false)} onImageCapture={async (imgData) => { setShowCameraModal(false); setAnalyzedImageDataUrl(`data:image/jpeg;base64,${imgData}`); setAppStatus('analyzing'); try { const result = await analyzeFoodImage(imgData); setImageAnalysisResult(result); setShowImageAnalysisResultModal(true); } catch (e: any) { alert(e.message); } finally { setAppStatus('idle'); } }} onCameraError={(err) => alert(err)} />}
            {showTextEntryModal && <TextEntryModal show={showTextEntryModal} onClose={() => setShowTextEntryModal(false)} onLog={handleAddMealToLog} defaultMealType={defaultMealTypeForModal} />}
            {showRecipeChoiceModal && <RecipeChoiceModal show={showRecipeChoiceModal} onClose={() => setShowRecipeChoiceModal(false)} onChooseSearch={() => { setShowRecipeChoiceModal(false); setShowRecipeModal(true); }} onChooseTakePhoto={() => { setShowRecipeChoiceModal(false); setShowIngredientCaptureModal(true); }} onChooseUpload={() => { setShowRecipeChoiceModal(false); setShowIngredientCaptureModal(true); }} />}
            {showRecipeModal && <RecipeModal show={showRecipeModal} onClose={() => setShowRecipeModal(false)} onSearch={async (q) => { setAppStatus('searching'); try { const res = await getRecipeSuggestion(q); setSearchedRecipe(res); } catch(e:any) { alert(e.message); } finally { setAppStatus('idle'); } }} onLogRecipe={handleAddMealToLog} recipe={searchedRecipe} isLoading={appStatus === 'searching'} error={null} recentSearches={getLocalStorageItem(LOCAL_STORAGE_KEYS.RECENT_RECIPE_SEARCHES, [])} setToastNotification={setToastNotification} defaultMealType={defaultMealTypeForModal} />}
            {showIngredientCaptureModal && <IngredientCaptureModal show={showIngredientCaptureModal} onClose={() => setShowIngredientCaptureModal(false)} images={ingredientImages} onRemoveImage={(i) => setIngredientImages(prev => prev.filter((_, idx) => idx !== i))} onUploadImages={async (files) => { for(let i=0; i<files.length; i++) { const base64 = await resizeImageForLog(files[i], 800); setIngredientImages(prev => [...prev, base64]); } }} openCameraModal={() => { setShowIngredientCaptureModal(false); setShowCameraModal(true); /* Logic needs loop back to capture modal */ }} onFindRecipes={async (imgs) => { setShowIngredientCaptureModal(false); setAppStatus('analyzing'); try { const base64s = imgs.map(d => d.split(',')[1]); const res = await getRecipesFromIngredientsImage(base64s); setIdentifiedIngredients(res.identifiedIngredients); setRecipeSuggestions(res.recipeSuggestions); setShowIngredientRecipeResultsModal(true); } catch(e:any) { alert(e.message); } finally { setAppStatus('idle'); } }} />}
            {showIngredientRecipeResultsModal && <IngredientRecipeResultsModal show={showIngredientRecipeResultsModal} onClose={() => setShowIngredientRecipeResultsModal(false)} identifiedIngredients={identifiedIngredients} recipeSuggestions={recipeSuggestions || []} onLogRecipe={handleAddMealToLog} isLoading={false} error={null} defaultMealType={defaultMealTypeForModal || 'dinner'} />}
            {showBarcodeScannerModal && <BarcodeScannerModal show={showBarcodeScannerModal} onClose={() => setShowBarcodeScannerModal(false)} onBarcodeScanned={async (code) => { setShowBarcodeScannerModal(false); setScannedBarcode(code); setAppStatus('searching'); try { const info = await getFoodInfoFromBarcode(code); setScannedFoodInfo(info); setShowBarcodeSearchResultModal(true); } catch(e:any) { alert(e.message); } finally { setAppStatus('idle'); } }} onCameraError={(e) => alert(e)} onScanFallback={() => { setShowBarcodeScannerModal(false); setShowCameraModal(true); /* Logic needs redirect to NutritionLabel flow */ }} />}
            {showBarcodeSearchResultModal && scannedFoodInfo && <BarcodeSearchResultModal show={showBarcodeSearchResultModal} scanResult={scannedFoodInfo} onLog={handleAddMealToLog} onClose={() => setShowBarcodeSearchResultModal(false)} defaultMealType={defaultMealTypeForModal} />}
            {showImageAnalysisResultModal && imageAnalysisResult && analyzedImageDataUrl && <ImageAnalysisResultModal show={showImageAnalysisResultModal} analysisResult={imageAnalysisResult} imageDataUrl={analyzedImageDataUrl} onLog={handleAddMealToLog} onClose={() => setShowImageAnalysisResultModal(false)} defaultMealType={defaultMealTypeForModal} />}
            {showSaveCommonMealModal && mealToSaveAsCommon && <SaveCommonMealModal mealInfo={mealToSaveAsCommon.nutritionalInfo} initialName={mealToSaveAsCommon.nutritionalInfo.foodItem || ''} onClose={() => setMealToSaveAsCommon(null)} onSave={async (name) => { try { await addCommonMeal(currentUser?.uid || '', { name, nutritionalInfo: mealToSaveAsCommon.nutritionalInfo, timestamp: Date.now() }); setMealToSaveAsCommon(null); setToastNotification({message: 'Sparat som vanligt val!', type:'success'}); } catch(e) { alert("Kunde inte spara"); } }} />}
            {showNutritionLabelResultModal && nutritionLabelResult && <NutritionLabelResultModal show={showNutritionLabelResultModal} onClose={() => setShowNutritionLabelResultModal(false)} analysisResult={nutritionLabelResult} onLog={handleAddMealToLog} defaultMealType={defaultMealTypeForModal} />}
            
            {appStatus !== 'idle' && <LoadingSpinner message={appStatus === 'analyzing' ? 'Analyserar...' : appStatus === 'saving' ? 'Sparar...' : 'Söker...'} />}
        </div>
    );
};

// Helper for local storage (duplicated to avoid import issues if utils not fully shared yet, or move to utils)
const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
};

export default Dashboard;
