import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
    LoggedMeal, 
    NutritionalInfo,
    SearchedFoodInfo,
    BarcodeScannedFoodInfo,
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
    LOCAL_STORAGE_KEYS,
    COACH_PERSONAS
} from '../constants';
import WeeklyActivityChart from '../components/WeeklyActivityChart';
import CircularProgress from '../components/CircularProgress';
import WaterLogger from '../components/WaterLogger';
import MacroCard from '../components/MacroCard';
import { PlusIcon, CameraIcon, RecipeIcon, BarcodeIcon, SearchIcon, CheckIcon, ArrowLeftIcon, ArrowRightIcon, TrophyIcon, SparklesIcon, XMarkIcon, BookmarkIcon, ShieldCheckIcon } from '../components/icons';
import { PiggyBank, Coffee, Sandwich, CookingPot, Apple, Flame } from 'lucide-react';
import { useUserContext } from '../context/UserContext';
import { playAudio } from '../services/audioService';
import { getDateUID, getSuggestedMealType } from '../utils/dateUtils';
import { 
    sumMealNutrients, 
    calculateRemainingCalories, 
    getMealDateUID 
} from '../utils/nutritionTotals';
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
import { recordModalRenderStart, recordFirestoreSaveStart, finishPhotoPipeline } from '../utils/photoPipelineProfiler';
import PhotoTimingPanel from '../components/PhotoTimingPanel';
import { pushModalState, replaceModalState, closeModalState, subscribeToHistory } from '../utils/navigationHistory';

// Modaler
import CameraModal from '../components/CameraModal';
import TextEntryModal from '../components/TextEntryModal';
import ProteinInfoModal from '../components/ProteinInfoModal';
import RecipeChoiceModal from '../components/RecipeChoiceModal';
import RecipeModal from '../components/RecipeModal';
import IngredientCaptureModal from '../components/IngredientCaptureModal';
import IngredientRecipeResultsModal from '../components/IngredientRecipeResultsModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import BarcodeSearchResultModal from '../components/BarcodeSearchResultModal';
import ImageAnalysisResultModal from '../components/ImageAnalysisResultModal';
import SaveCommonMealModal from '../components/SaveCommonMealModal';
import NutritionLabelResultModal from '../components/NutritionLabelResultModal';
import FoodRatingModal from '../components/FoodRatingModal';
import MyRecipesModal from '../components/MyRecipesModal';
import LoadingSpinner from '../components/LoadingSpinner';
import MealTypeSelector from '../components/MealTypeSelector';
import MealSectionCard from '../components/MealSectionCard';
import MealStructureGuide from '../components/MealStructureGuide';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import CoinFallEffect from '../components/CoinFallEffect';
import CommonMealsList from '../components/CommonMealsList';
import BootcampOnboardingCard from '../components/BootcampOnboardingCard';
import ReadOnlyBanner from '../components/ReadOnlyBanner';
import { completeBootcampOnboardingTask, checkAndAdvanceBootcampAccess } from '../services/bootcampAccessService';
import { hasAppAccess, isReadOnlyUser } from '../utils/accessControl';
import { BootcampOnboardingTaskId } from '../types';

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

const calculateProgressPercentage = (
    method: 'scale' | 'inbody' | undefined,
    startWeight?: number, currentWeight?: number, desiredWeightChange?: number,
    startFat?: number, currentFat?: number, desiredFatChange?: number,
    startMuscle?: number, currentMuscle?: number, desiredMuscleChange?: number,
    isGoalCompleted?: boolean
): number => {
    if (isGoalCompleted) return 100;

    let start, current, goalChange;

    const isScaleGoal = method === 'scale';
    const isFatLossGoal = !isScaleGoal && desiredFatChange && desiredFatChange < 0;
    const isMuscleGainGoal = !isScaleGoal && desiredMuscleChange && desiredMuscleChange > 0;

    if (isFatLossGoal) {
        if (currentFat != null && startFat != null) {
            start = startFat;
            current = currentFat;
            goalChange = desiredFatChange;
        } else {
            start = startWeight;
            current = currentWeight;
            goalChange = desiredFatChange;
        }
    } else if (isMuscleGainGoal) {
        if (currentMuscle != null && startMuscle != null) {
            start = startMuscle;
            current = currentMuscle;
            goalChange = desiredMuscleChange;
        } else {
            start = startWeight;
            current = currentWeight;
            goalChange = desiredMuscleChange;
        }
    } else {
        start = startWeight;
        current = currentWeight;
        goalChange = desiredWeightChange;
    }
    
    if (start == null || current == null || !goalChange) return 0;
    
    const totalChangeNeeded = Math.abs(goalChange);
    let changeAchieved;
    
    if (goalChange > 0) { 
        changeAchieved = current - start;
    } else { 
        changeAchieved = start - current;
    }
    
    changeAchieved = Math.max(0, changeAchieved);

    if (totalChangeNeeded < 0.01) return 100;

    const progressRaw = (changeAchieved / totalChangeNeeded) * 100;
    return Math.max(0, Math.min(progressRaw, 100));
};

const getGoalShortDescription = (
    method: 'scale' | 'inbody' | undefined,
    desiredWeightChange?: number,
    desiredFatChange?: number,
    desiredMuscleChange?: number
): string => {
    if (method === 'scale' && desiredWeightChange) {
        return `${desiredWeightChange > 0 ? '+' : ''}${desiredWeightChange.toFixed(1).replace('.', ',')} kg`;
    } else if (method === 'inbody') {
        if (desiredFatChange) return `${desiredFatChange > 0 ? '+' : ''}${desiredFatChange.toFixed(1).replace('.', ',')} kg fett`;
        if (desiredMuscleChange) return `${desiredMuscleChange > 0 ? '+' : ''}${desiredMuscleChange.toFixed(1).replace('.', ',')} kg muskler`;
    }
    return 'Bibehålla vikten';
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
    activeBootcamp: any | null;
    hasCompletedTodaysReport?: boolean;
    onShareRecipe?: (recipeText: string) => void;
    onOpenBootcamp?: () => void;
    onOpenSubscription?: () => void;
    isReadOnly?: boolean;
    onOpenGraduationOffer?: () => void;
}

import { getBootcampRankInfo } from '../utils/bootcampUtils';
import { RankBadge } from '../components/RankBadge';

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
    setToastNotification,
    onOpenAICoach,
    isSummarizingYesterday,
    isAICoachOpen,
    isProfileOpen,
    isMorningReportOpen,
    activeBootcamp,
    hasCompletedTodaysReport,
    onShareRecipe,
    onOpenBootcamp,
    onOpenSubscription,
    isReadOnly = false,
    onOpenGraduationOffer,
}) => {
    const {
        currentUser,
        goals,
        userProfile,
        setUserProfile,
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
        highestStreak,
        setHighestStreak,
        weeklyBank,
        currentDate,
        isInitialDataLoaded,
        isDataLoading // Hämta denna för att veta om vi laddar data
    } = useUserContext();

    const [isSaving, setIsSaving] = useState(false);
    const [appStatus, setAppStatus] = useState<'idle' | 'analyzing' | 'searching' | 'searching_recipe' | 'saving' | 'error'>('idle');
    
    // Modal states
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [showTextEntryModal, setShowTextEntryModal] = useState(false);

    // Auto-advance Bootcamp Grundutbildning om 3 dygn passerat
    useEffect(() => {
        if (currentUser && userProfile?.bootcampAccess && !userProfile.bootcampAccess.onboardingCompletedDate) {
            checkAndAdvanceBootcampAccess(currentUser.uid, userProfile).then(res => {
                if (res.updated && res.bootcampAccess) {
                    setUserProfile(prev => ({ ...prev, bootcampAccess: res.bootcampAccess! }));
                }
            });
        }
    }, [currentUser, userProfile?.bootcampAccess, setUserProfile]);

    const handleBootcampOnboardingTaskAction = (taskId: BootcampOnboardingTaskId) => {
        switch (taskId) {
            case 'log_meal_photo':
                handleTakePhoto();
                break;
            case 'log_meal_search':
                handleSearchText();
                break;
            case 'log_water':
                handleLogWater(250);
                if (waterLoggerRef.current) {
                    waterLoggerRef.current.scrollIntoView({ behavior: 'smooth' });
                }
                break;
            case 'weigh_in_and_goal':
                window.dispatchEvent(new CustomEvent('open-log-weight-modal'));
                break;
            case 'read_morning_briefing':
                onOpenAICoach();
                if (currentUser && userProfile?.bootcampAccess && !userProfile.bootcampAccess.onboardingCompletedDate) {
                    completeBootcampOnboardingTask(currentUser.uid, 'read_morning_briefing', userProfile).then(updated => {
                        if (updated) {
                            setUserProfile(prev => ({ ...prev, bootcampAccess: updated }));
                        }
                    });
                }
                break;
        }
    };
    const [showRecipeChoiceModal, setShowRecipeChoiceModal] = useState(false);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [showMyRecipesModal, setShowMyRecipesModal] = useState(false);
    const [isRecipeSaved, setIsRecipeSaved] = useState(false);
    const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(new Set());
    const [showIngredientCaptureModal, setShowIngredientCaptureModal] = useState(false);
    const [showIngredientRecipeResultsModal, setShowIngredientRecipeResultsModal] = useState(false);
    const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState(false);
    const [showBarcodeSearchResultModal, setShowBarcodeSearchResultModal] = useState(false);
    const [showImageAnalysisResultModal, setShowImageAnalysisResultModal] = useState(false);
    const [showSaveCommonMealModal, setShowSaveCommonMealModal] = useState(false);
    const [showNutritionLabelResultModal, setShowNutritionLabelResultModal] = useState(false);
    const [showFoodRatingModal, setShowFoodRatingModal] = useState(false);
    const [foodRatingData, setFoodRatingData] = useState<{ nutritionalInfo: NutritionalInfo, mealType: MealType } | null>(null);
    const [showCommonMealsPopup, setShowCommonMealsPopup] = useState<CommonMeal | null>(null);
    const [selectedCommonMealType, setSelectedCommonMealType] = useState<MealType | null>(null);
    const [selectedCommonMealPortion, setSelectedCommonMealPortion] = useState<number>(1);

    // Data states for modals
    const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
    const [scannedFoodInfo, setScannedFoodInfo] = useState<BarcodeScannedFoodInfo | null>(null);
    const [imageAnalysisResult, setImageAnalysisResult] = useState<NutritionalInfo | null>(null);
    const [analyzedImageDataUrl, setAnalyzedImageDataUrl] = useState<string | null>(null);
    const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);
    const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeSuggestion[] | null>(null);
    const [identifiedIngredients, setIdentifiedIngredients] = useState<string[]>([]);
    const [ingredientImages, setIngredientImages] = useState<string[]>([]);
    const [searchedRecipe, setSearchedRecipe] = useState<RecipeSuggestion | null>(null);
    const [mealToSaveAsCommon, setMealToSaveAsCommon] = useState<LoggedMeal | null>(null);
    const [nutritionLabelResult, setNutritionLabelResult] = useState<NutritionalInfo | null>(null);
    const [defaultMealTypeForModal, setDefaultMealTypeForModal] = useState<MealType | null>(null);
    
    // Camera context state
    const [cameraMode, setCameraMode] = useState<'mealAnalysis' | 'ingredientCapture' | 'nutritionLabel'>('mealAnalysis');

    // UI States
    const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
    const [showBonusCoin, setShowBonusCoin] = useState(false);
    const [activeMealSection, setActiveMealSection] = useState<MealType | null>(null); // Lifted state for open section
    const [showProteinInfoModal, setShowProteinInfoModal] = useState(false);

    const bankRef = useRef<HTMLDivElement>(null);
    const waterLoggerRef = useRef<HTMLDivElement>(null);

    // Sync modal state with history popstate
    useEffect(() => {
        const unsubscribe = subscribeToHistory((state) => {
            setShowCameraModal(state.modal === 'camera');
            setShowImageAnalysisResultModal(state.modal === 'imageAnalysis');
            setShowTextEntryModal(state.modal === 'textEntry');
            setShowRecipeChoiceModal(state.modal === 'recipeChoice');
            setShowRecipeModal(state.modal === 'recipe');
            setShowMyRecipesModal(state.modal === 'myRecipes');
            setShowIngredientCaptureModal(state.modal === 'ingredientCapture');
            setShowIngredientRecipeResultsModal(state.modal === 'ingredientResults');
            setShowBarcodeScannerModal(state.modal === 'barcodeScanner');
            setShowBarcodeSearchResultModal(state.modal === 'barcodeResult');
            setShowNutritionLabelResultModal(state.modal === 'nutritionLabel');
            setShowFoodRatingModal(state.modal === 'foodRating');
            setShowProteinInfoModal(state.modal === 'proteinInfo');
            if (state.modal !== 'saveCommonMeal') {
                setMealToSaveAsCommon(null);
                setShowSaveCommonMealModal(false);
            }
        });
        return unsubscribe;
    }, []);

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

    const totalNutrients = useMemo(() => sumMealNutrients(dailyLog), [dailyLog]);

    // --- DYNAMIC BANK CALCULATION START ---
    const availableBank = isViewingMonday ? 0 : weeklyBank.bankedCalories;
    const remainingCalc = useMemo(() => {
        return calculateRemainingCalories(
            goals.calorieGoal,
            totalNutrients.calories,
            availableBank,
            userProfile?.goalType
        );
    }, [goals.calorieGoal, totalNutrients.calories, availableBank, userProfile?.goalType]);

    const {
        rawCaloriesOver,
        calculatedBankUsage,
        netCaloriesOver,
        remainingBankDisplay,
        minSafeCalories,
        caloriesRemaining,
        isOverBudget,
        isFullyCoveredByBank,
        isNetOverBudget,
        goalMet: currentGoalMet,
        progressColor
    } = remainingCalc;
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
        const newDate = new Date(viewingDate);
        newDate.setDate(newDate.getDate() - 7);
        onDateSelect(newDate);
    };

    const handleNextWeek = () => {
        const newDate = new Date(viewingDate);
        newDate.setDate(newDate.getDate() + 7);
        onDateSelect(newDate);
    };

    const handleJumpToToday = () => {
        onDateSelect(new Date());
    };

    // Recalculate summary helper
    const recalculateAndSaveSummary = async (currentLogs: LoggedMeal[], currentWater: number) => {
        if (!currentUser) return;

        const viewingUID = getDateUID(viewingDate);
        const currentUID = getDateUID(currentDate);

        const totals = sumMealNutrients(currentLogs);
        const { goalMet } = calculateRemainingCalories(
            goals.calorieGoal,
            totals.calories,
            availableBank,
            userProfile.goalType
        );

        // --- STREAK LOGIC: Check previous day to determine new streak ---
        const dayBefore = new Date(viewingDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const dayBeforeUID = getDateUID(dayBefore);
        const prevDaySummary = pastDaysSummary[dayBeforeUID];
        const prevStreak = prevDaySummary?.streakForThisDay || 0;

        // FIXED LOGIC: Strict check for activity. Any calories > 0 means the day is active.
        let newStreak = 0;
        if (totals.calories > 0) {
            newStreak = prevStreak + 1;
        } else {
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
            streakForThisDay: newStreak, 
            savedBy: existingSummary?.savedBy,
            bankedAmount: existingSummary?.bankedAmount,
        };

        setPastDaysSummary(prev => ({ ...prev, [viewingUID]: newSummary }));
        
        // Spara BARA till databasen om det är en historisk dag. Dagens datum får ALDRIG sparas ner i förtid!
        if (viewingUID < currentUID) {
            try {
                await setPastDaySummaryFirestore(currentUser.uid, viewingUID, newSummary);
            } catch(e) {
                console.error("Failed to update past day summary", e);
            }

            // --- RIPPLE EFFECT: Recalculate streaks for all subsequent days up to yesterday ---
            const yesterday = new Date(currentDate);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayUID = getDateUID(yesterday);

            let currentRippleDate = new Date(viewingDate);
            currentRippleDate.setDate(currentRippleDate.getDate() + 1);
            let currentRippleUID = getDateUID(currentRippleDate);
            let runningStreak = newStreak;
            
            const updatedSummaries: Record<string, PastDaySummary> = {};
            let highestStreakReached = Math.max(highestStreak, newStreak);

            while (currentRippleUID <= yesterdayUID) {
                const summaryToUpdate = pastDaysSummary[currentRippleUID];
                if (summaryToUpdate) {
                    if (summaryToUpdate.consumedCalories > 0) {
                        runningStreak += 1;
                    } else {
                        runningStreak = 0;
                    }
                    
                    if (summaryToUpdate.streakForThisDay !== runningStreak) {
                        const updatedSummary = { ...summaryToUpdate, streakForThisDay: runningStreak };
                        updatedSummaries[currentRippleUID] = updatedSummary;
                        highestStreakReached = Math.max(highestStreakReached, runningStreak);
                        
                        try {
                            await setPastDaySummaryFirestore(currentUser.uid, currentRippleUID, updatedSummary);
                        } catch(e) {
                            console.error(`Failed to update past day summary for ${currentRippleUID}`, e);
                        }
                    }
                } else {
                    runningStreak = 0;
                }
                
                currentRippleDate.setDate(currentRippleDate.getDate() + 1);
                currentRippleUID = getDateUID(currentRippleDate);
            }

            if (Object.keys(updatedSummaries).length > 0) {
                setPastDaysSummary(prev => ({ ...prev, ...updatedSummaries }));
            }

            // Update user's current streak to whatever the streak was on yesterday
            const finalYesterdayStreak = updatedSummaries[yesterdayUID]?.streakForThisDay 
                ?? (yesterdayUID === viewingUID ? newStreak : pastDaysSummary[yesterdayUID]?.streakForThisDay) 
                ?? 0;

            setStreakData(prev => ({ ...prev, currentStreak: finalYesterdayStreak }));
            
            const userUpdates: any = { currentStreak: finalYesterdayStreak };
            if (highestStreakReached > highestStreak) {
                userUpdates.highestStreak = highestStreakReached;
                setHighestStreak(highestStreakReached);
            }
            
            try {
                await updateUserDocument(currentUser.uid, userUpdates);
            } catch(e) {
                console.error("Failed to update user currentStreak", e);
            }
        }
    };

    // SELF-HEALING EFFECT (Fixad för att undvika spökdata)
    useEffect(() => {
        // 1. Kör inte om data laddas eller användaren saknas
        if (!isInitialDataLoaded || !currentUser || isDataLoading) return;
        
        const viewingUID = getDateUID(viewingDate);
        
        // 2. ID-KONTROLL: Är maten i loggen verkligen för den här dagen?
        // Om vi precis bytt datum men dailyLog inte uppdaterats än -> AVBRYT.
        if (dailyLog.length > 0) {
            const logDate = dailyLog[0].dateString;
            if (logDate !== viewingUID) {
                return; // Matloggen matchar inte visningsdatumet. Rör ingenting.
            }
        }

        // 3. Räkna ut "Sanningen" från loggen
        const actualCalories = sumMealNutrients(dailyLog).calories;
        
        // 4. Hämta nuvarande status
        const summary = pastDaysSummary[viewingUID];
        const summaryCalories = summary?.consumedCalories || 0;
        
        // 5. STÄDPATRULLEN: Hitta felmatchningar
        // Fall A: Loggen har mat (>0), men summeringen säger 0 (det ursprungliga felet).
        // Fall B: Loggen är tom (0), men summeringen säger att vi ätit (spökdata).
        if (Math.abs(actualCalories - summaryCalories) > 1) { // 1 kcal tolerans
            console.log(`Self-healing triggered for ${viewingUID}. Log: ${actualCalories}, Summary: ${summaryCalories}`);
            recalculateAndSaveSummary(dailyLog, waterLoggedMl);
        }
    }, [dailyLog, viewingDate, isInitialDataLoaded, currentUser, pastDaysSummary, waterLoggedMl, isDataLoading]);


    // Handlers
    const handleAddMealToLog = async (
        data: LoggedMeal | Omit<LoggedMeal, 'id'> | NutritionalInfo | SearchedFoodInfo, 
        options?: { saveAsCommon?: boolean; mealType?: MealType; skipRatingModal?: boolean; portionMultiplier?: number }
    ) => {
        if (!currentUser) return;
        if (!hasAppAccess(userProfile)) {
            onOpenSubscription?.();
            return;
        }
        
        const timestamp = Date.now();
        const mealType = options?.mealType || defaultMealTypeForModal || 'breakfast'; 
        const multiplier = options?.portionMultiplier || 1;
        
        setIsSaving(true);
        setAppStatus('saving');
        
        let newMeal: LoggedMeal;

        if ('nutritionalInfo' in data) {
             newMeal = {
                ...(data as Omit<LoggedMeal, 'id'>),
                id: 'temp-id-' + timestamp, 
                dateString: getDateUID(viewingDate),
                timestamp: timestamp,
                mealType: mealType,
                caloriesCoveredByBank: 0
            };
        } else {
             newMeal = {
                id: 'temp-id-' + timestamp, 
                dateString: getDateUID(viewingDate),
                timestamp: timestamp,
                mealType: mealType,
                nutritionalInfo: data as NutritionalInfo,
                caloriesCoveredByBank: 0
            };
        }

        if (multiplier !== 1) {
            newMeal.nutritionalInfo = {
                ...newMeal.nutritionalInfo,
                calories: newMeal.nutritionalInfo.calories * multiplier,
                protein: newMeal.nutritionalInfo.protein * multiplier,
                carbohydrates: newMeal.nutritionalInfo.carbohydrates * multiplier,
                fat: newMeal.nutritionalInfo.fat * multiplier,
            };
        }

        try {
            const updatedLogs = [newMeal, ...dailyLog];
            setDailyLog(updatedLogs);
            recalculateAndSaveSummary(updatedLogs, waterLoggedMl);
            
            if (options?.saveAsCommon) {
                const timestamp = Date.now();
                const newCommonId = await addCommonMeal(currentUser.uid, {
                    name: newMeal.nutritionalInfo.foodItem || 'Måltid',
                    nutritionalInfo: newMeal.nutritionalInfo,
                    timestamp
                });
                // Fix: Use the actual ID from Firestore for the local state immediately
                setCommonMeals(prev => [...prev, { 
                    id: newCommonId, 
                    name: newMeal.nutritionalInfo.foodItem || 'Måltid', 
                    nutritionalInfo: newMeal.nutritionalInfo, 
                    timestamp
                }]); 
            }

            recordFirestoreSaveStart();
            await addMealLogFirestore(currentUser.uid, newMeal.id, newMeal); 
            finishPhotoPipeline(); 
            
            if (options?.skipRatingModal) {
                setToastNotification({ message: 'Måltid loggad!', type: 'success' });
            } else {
                // Show Food Rating Modal instead of just toast
                setFoodRatingData({ nutritionalInfo: newMeal.nutritionalInfo, mealType: newMeal.mealType });
                pushModalState('foodRating');
                setShowFoodRatingModal(true);
            }
            playAudio('logSuccess');

            if (checklistState && !checklistState.items.mealLogged) {
                onChecklistUpdate('mealLogged');
            }

            // Grundutbildning inmönstrings-uppgifter
            if (currentUser && userProfile?.bootcampAccess && !userProfile.bootcampAccess.onboardingCompletedDate) {
                const isPhoto = Boolean(newMeal.imageUrl || (newMeal.nutritionalInfo && (newMeal.nutritionalInfo as any).source === 'camera') || cameraMode === 'mealAnalysis');
                const taskId: BootcampOnboardingTaskId = isPhoto ? 'log_meal_photo' : 'log_meal_search';
                completeBootcampOnboardingTask(currentUser.uid, taskId, userProfile).then(updated => {
                    if (updated) {
                        setUserProfile(prev => ({ ...prev, bootcampAccess: updated }));
                    }
                });
            }

        } catch (error) {
            console.error("Error adding meal:", error);
            setToastNotification({ message: 'Kunde inte spara måltiden.', type: 'error' });
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

        const updatedLogs = dailyLog.filter(m => m.id !== mealId);
        setDailyLog(updatedLogs);
        recalculateAndSaveSummary(updatedLogs, waterLoggedMl);

        try {
            await deleteMealLog(currentUser.uid, mealId);
            setToastNotification({ message: 'Måltid borttagen.', type: 'success' });
        } catch (error) {
            console.error("Error deleting meal:", error);
            setToastNotification({ message: 'Kunde inte ta bort måltiden.', type: 'error' });
            setDailyLog(prev => [...prev, mealToDelete]); 
        }
    };

    const handleUpdateMeal = async (mealId: string, updatedInfo: NutritionalInfo) => {
        if (!currentUser) return;
        const updatedLogs = dailyLog.map(m => m.id === mealId ? { ...m, nutritionalInfo: updatedInfo } : m);
        setDailyLog(updatedLogs);
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
        if (!hasAppAccess(userProfile)) {
            onOpenSubscription?.();
            return;
        }
        const newAmount = waterLoggedMl + amount;
        setWaterLoggedMl(newAmount);
        recalculateAndSaveSummary(dailyLog, newAmount);
        try {
            await setWaterLog(currentUser.uid, getDateUID(viewingDate), newAmount);
            if (checklistState && !checklistState.items.waterLogged && newAmount > 0) {
                onChecklistUpdate('waterLogged');
            }
            if (currentUser && userProfile?.bootcampAccess && !userProfile.bootcampAccess.onboardingCompletedDate && newAmount > 0) {
                completeBootcampOnboardingTask(currentUser.uid, 'log_water', userProfile).then(updated => {
                    if (updated) {
                        setUserProfile(prev => ({ ...prev, bootcampAccess: updated }));
                    }
                });
            }
        } catch (error) {
            console.error("Error logging water:", error);
            setWaterLoggedMl(waterLoggedMl); 
        }
    };

    const handleResetWater = async () => {
        if (!currentUser) return;
        setWaterLoggedMl(0);
        recalculateAndSaveSummary(dailyLog, 0);
        try {
            await setWaterLog(currentUser.uid, getDateUID(viewingDate), 0);
        } catch (error) {
            console.error("Error resetting water:", error);
        }
    };

    const handleCommonMealLog = (commonMeal: CommonMeal) => {
        setSelectedCommonMealType(getSuggestedMealType());
        setSelectedCommonMealPortion(1);
        setShowCommonMealsPopup(commonMeal);
    };

    const confirmCommonMealLog = (type: MealType) => {
        if (showCommonMealsPopup) {
            handleAddMealToLog(
                showCommonMealsPopup.nutritionalInfo, 
                { mealType: type, skipRatingModal: true, portionMultiplier: selectedCommonMealPortion }
            );
            setShowCommonMealsPopup(null);
            setSelectedCommonMealType(null);
            setSelectedCommonMealPortion(1);
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

    const openModalWithType = (setter: React.Dispatch<React.SetStateAction<boolean>>, modalName?: string, type: MealType | null = null) => {
        if (!hasAppAccess(userProfile)) {
            onOpenSubscription?.();
            return;
        }
        const typeToUse = type || activeMealSection || getSuggestedMealType();
        setDefaultMealTypeForModal(typeToUse);
        setActiveMealSection(null);
        if (modalName) {
            pushModalState(modalName);
        }
        setter(true);
        setIsSpeedDialOpen(false);
    }

    const handleScanBarcode = () => openModalWithType(setShowBarcodeScannerModal, 'barcodeScanner');
    const handleSearchText = () => openModalWithType(setShowTextEntryModal, 'textEntry');
    const handleTakePhoto = () => {
        setCameraMode('mealAnalysis'); 
        openModalWithType(setShowCameraModal, 'camera');
    };
    const handleRecipes = () => {
        setSearchedRecipe(null);
        openModalWithType(setShowRecipeChoiceModal, 'recipeChoice'); 
    };
    const handleFindRecipe = handleRecipes;
    const handleMyRecipes = () => openModalWithType(setShowMyRecipesModal, 'myRecipes');

    const handleSaveRecipe = async (recipe: RecipeSuggestion) => {
        if (!currentUser) return;
        try {
            const { addSavedRecipe } = await import('../services/firestoreService');
            await addSavedRecipe(currentUser.uid, {
                timestamp: Date.now(),
                recipe
            });
            setIsRecipeSaved(true);
            setSavedRecipeIds(prev => new Set(prev).add(recipe.title));
            setToastNotification({ message: 'Receptet har sparats i din receptbank!', type: 'success' });
        } catch (error) {
            console.error("Error saving recipe:", error);
            setToastNotification({ message: 'Kunde inte spara receptet.', type: 'error' });
        }
    };

    const coachPersona = userProfile.coachStyle && COACH_PERSONAS[userProfile.coachStyle] ? COACH_PERSONAS[userProfile.coachStyle] : COACH_PERSONAS['balanced'];
    const coachName = coachPersona.label;

    const currentHour = new Date().getHours();
    const showEveningReportCTA = activeBootcamp && currentHour >= 18 && !hasCompletedTodaysReport;

    let ctaText = "Dags för kvällsrapport!";
    if (userProfile.coachStyle === 'hard') {
        ctaText = "Dags för kvällsrapport, soldat!";
    } else if (userProfile.coachStyle === 'soft') {
        ctaText = "Dags för kvällsrapport, vännen!";
    }

    return (
        <div className="flex flex-col gap-3 pb-28 sm:pb-32 relative">
            {/* Läsläge Banner */}
            {isReadOnly && (
                <ReadOnlyBanner 
                    onOpenOffer={() => {
                        if (onOpenGraduationOffer) {
                            onOpenGraduationOffer();
                        } else {
                            onOpenSubscription?.();
                        }
                    }} 
                />
            )}

            {/* Börjes Grundutbildning Kort under inmönstring */}
            {userProfile?.bootcampAccess && !userProfile.bootcampAccess.onboardingCompletedDate && (
                <BootcampOnboardingCard 
                    userProfile={userProfile}
                    onActionClick={handleBootcampOnboardingTaskAction}
                />
            )}

            {/* Gratisperiod Nedräkningsrad */}
            {userProfile.subscriptionStatus === 'trialing' && userProfile.currentPeriodEnd && (() => {
                const getTrialDaysLeftLocal = (endStr: string) => {
                    const end = new Date(endStr);
                    const now = new Date();
                    const diffTime = end.getTime() - now.getTime();
                    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                };
                
                const formatTrialEndDateLocal = (endStr: string) => {
                    const date = new Date(endStr);
                    const day = date.getDate();
                    const months = [
                        'januari', 'februari', 'mars', 'april', 'maj', 'juni',
                        'juli', 'augusti', 'september', 'oktober', 'november', 'december'
                    ];
                    return `${day} ${months[date.getMonth()]}`;
                };

                const daysLeft = getTrialDaysLeftLocal(userProfile.currentPeriodEnd);
                const dateStr = formatTrialEndDateLocal(userProfile.currentPeriodEnd);
                
                const text = daysLeft > 3 
                    ? `Gratisperiod: ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagar'} kvar`
                    : `${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagar'} kvar av din gratisperiod · Första dragningen ${dateStr} (95 kr)`;

                return (
                    <button 
                        type="button"
                        onClick={onOpenSubscription}
                        className="w-full bg-[#F6E2D9] hover:bg-[#F6E2D9]/80 text-primary border border-primary/20 px-4 py-3.5 rounded-2xl flex items-center justify-between transition-all active:scale-[0.99] text-xs sm:text-sm font-semibold shadow-sm"
                    >
                        <div className="flex items-center gap-2 text-left">
                            <span className="text-primary">✨</span>
                            <span>{text}</span>
                        </div>
                        <ArrowRightIcon className="w-4 h-4 text-primary flex-shrink-0 ml-2" />
                    </button>
                );
            })()}

            {/* Bootcamp CTA */}
            {showEveningReportCTA && (
                <button 
                    onClick={onOpenBootcamp}
                    className="w-full bg-primary hover:bg-primary-darker text-white font-bold py-4 px-6 rounded-2xl shadow-lg flex items-center justify-between transition-transform active:scale-95"
                >
                    <span>{ctaText}</span>
                    <ArrowRightIcon className="w-5 h-5" />
                </button>
            )}

            {/* Bootcamp Progress Report */}
            {activeBootcamp && (() => {
                const rankInfo = getBootcampRankInfo(Math.max(activeBootcamp.longestStreak || 0, userProfile.highestBootcampStreak || 0), activeBootcamp.currentStreak || 0, activeBootcamp.status);
                return (
                <div className="bg-white dark:!bg-[#2A3B2C] rounded-3xl shadow-soft-xl p-5 border border-[#4A5B4C] relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#3A4B3C] flex items-center justify-center text-white overflow-hidden p-0.5">
                                <RankBadge rank={rankInfo.currentRank} size="sm" className="w-full h-full" />
                            </div>
                            <h3 className="text-lg font-bold text-neutral-dark dark:text-white">Bootcamp Lägesrapport</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-full">
                                {activeBootcamp.status === 'fas1' ? 'Fas 1' : 'Fas 2'}
                            </span>
                            <span className="text-xs font-bold px-2.5 py-1 bg-[#E8EFE9] text-[#2B3B2C] rounded-full inline-flex items-center gap-1">
                                <RankBadge rank={rankInfo.currentRank} size="sm" className="w-4 h-4" />
                                {rankInfo.currentRank}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <div>
                            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-300 uppercase tracking-wider">Streak</p>
                            <p className="text-xl font-extrabold text-neutral-dark dark:text-white flex items-center gap-1">
                                {activeBootcamp.currentStreak} <Flame className="w-5 h-5 text-[#D96E4A]" />
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-neutral-500 dark:text-neutral-300 uppercase tracking-wider">
                                {rankInfo.nextRank ? `Nästa: ${rankInfo.nextRank}` : 'Högsta graden nådd!'}
                            </p>
                            <p className="text-sm font-bold text-neutral-dark dark:text-white">
                                {rankInfo.nextRank ? `${rankInfo.daysToNext} dagar kvar` : 'Bra jobbat!'}
                            </p>
                        </div>
                    </div>
                    <div className="w-full bg-neutral-light rounded-full h-2 mt-2 overflow-hidden">
                        <div 
                            className="bg-[#D96E4A] h-full rounded-full transition-all duration-500" 
                            style={{ width: `${rankInfo.progress}%` }}
                        ></div>
                    </div>
                </div>
                );
            })()}

            {/* Top Date & Progress Card */}
            <div className={`rounded-3xl shadow-soft-xl py-6 border relative overflow-hidden ${activeBootcamp ? 'bg-white border-[#D96E4A]/30' : 'bg-white border-neutral-light'}`}>
                {activeBootcamp && (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-[#D96E4A] text-white text-xs font-bold px-3 py-1 rounded-b-lg uppercase tracking-widest flex items-center gap-1 shadow-md z-10">
                        <TrophyIcon className="w-3 h-3 text-[#F6E2D9]" />
                        Bootcamp Aktiv
                    </div>
                )}
                <div className="flex flex-col items-center">
                    {/* Date Nav */}
                    <div className={`flex items-center justify-center gap-4 mb-6 w-full px-6 ${activeBootcamp ? 'mt-2' : ''}`}>
                        <button onClick={() => onDateSelect(new Date(viewingDate.getTime() - 86400000))} className="p-2 rounded-full hover:bg-neutral-light transition-colors"><ArrowLeftIcon className="w-5 h-5 text-neutral-dark" /></button>
                        <div className="text-center">
                            <h2 className="text-lg font-bold text-neutral-dark uppercase tracking-wider">{formattedViewingDate}</h2>
                            {!isViewingToday && (
                                <button onClick={() => onDateSelect(new Date())} className="text-xs font-semibold text-primary hover:underline mt-1 block w-full text-center">
                                    Gå till idag
                                </button>
                            )}
                        </div>
                        <button onClick={() => onDateSelect(new Date(viewingDate.getTime() + 86400000))} className={`p-2 rounded-full hover:bg-neutral-light transition-colors ${isViewingToday ? 'opacity-30 cursor-default' : ''}`} disabled={isViewingToday}><ArrowRightIcon className="w-5 h-5 text-neutral-dark" /></button>
                    </div>

                    {/* Lifesum Style Header */}
                    <div className="flex w-full items-center justify-between mb-6 px-6">
                        {/* Left: Ätit */}
                        <div className="text-center flex-1">
                            <p className="text-sm font-medium text-neutral-dark mb-1">Ätit</p>
                            <p className="text-2xl font-bold text-neutral-dark">{Math.round(totalNutrients.calories)}</p>
                        </div>

                        {/* Center: Circular Progress */}
                        <div className="flex-shrink-0 mx-2">
                            <CircularProgress
                                value={totalNutrients.calories}
                                max={goals.calorieGoal}
                                size={180}
                                strokeWidth={14}
                                color={progressColor}
                                trackColor="#F1EAE0"
                                centerContent={
                                    <div className="text-center">
                                        <span className="text-sm font-medium text-neutral-dark mb-1 block">
                                            {isNetOverBudget ? 'Överskridit' : 'Återstående'}
                                        </span>
                                        <span className="text-4xl font-bold block text-neutral-dark leading-none tracking-tight">
                                            {isNetOverBudget
                                                ? netCaloriesOver.toFixed(0)
                                                : (isFullyCoveredByBank ? '0' : caloriesRemaining.toFixed(0))
                                            }
                                        </span>
                                        <span className="text-xs font-medium text-neutral-500 mt-2 block">
                                            Mål {goals.calorieGoal} kcal
                                        </span>
                                    </div>
                                }
                            />
                        </div>

                        {/* Right: Sparpott */}
                        <div className="text-center flex-1">
                            <p className="text-sm font-medium text-neutral-dark mb-1">Sparpott</p>
                            <p className="text-2xl font-bold text-neutral-dark">{Math.round(remainingBankDisplay)}</p>
                        </div>
                    </div>

                    {/* Macros Integrated */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full px-4 sm:px-6 items-stretch">
                        <MacroCard 
                            label="Kolhydrater"
                            current={totalNutrients.carbohydrates}
                            goal={goals.carbohydrateGoal}
                            trackColor="#EAE0D8"
                            barColor="#A6826B"
                            isBootcamp={!!activeBootcamp}
                        />
                        <MacroCard 
                            label="Protein"
                            current={totalNutrients.protein}
                            goal={goals.proteinGoal}
                            trackColor="#F6E2D9"
                            barColor="#D96E4A"
                            isBootcamp={!!activeBootcamp}
                            onInfoClick={() => { pushModalState('proteinInfo'); setShowProteinInfoModal(true); }}
                            infoAriaLabel="Information om proteinmål"
                        />
                        <MacroCard 
                            label="Fett"
                            current={totalNutrients.fat}
                            goal={goals.fatGoal}
                            trackColor="#E8EFE9"
                            barColor="#8C9A86"
                            isBootcamp={!!activeBootcamp}
                        />
                    </div>

                    {/* Kompakt horisontell rad med sparade val (chips) direkt under makrostaplarna */}
                    {commonMeals && commonMeals.length > 0 && (
                        <div className="w-full px-4 sm:px-6 mt-3 pt-3 border-t border-neutral-light/70 dark:border-[#484440]/60">
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar -mx-1 px-1">
                                {commonMeals.map((meal) => (
                                    <button
                                        key={`chip-${meal.timestamp}-${meal.id}`}
                                        onClick={() => isEditableView && handleCommonMealLog(meal)}
                                        disabled={!isEditableView}
                                        className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-neutral-light/60 hover:bg-[#F6E2D9]/70 dark:bg-[#34302C] dark:hover:bg-[#3E3A36] border border-neutral-light/80 dark:border-[#484440] hover:border-primary/40 rounded-xl text-left active:scale-95 transition-all shadow-xs group"
                                        title={`Logga ${meal.name} (${Math.round(meal.nutritionalInfo.calories)} kcal)`}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-primary/70 group-hover:bg-primary transition-colors shrink-0" />
                                        <span className="text-xs font-bold text-neutral-dark dark:text-[#FAF6EF] whitespace-nowrap truncate max-w-[140px] sm:max-w-[180px]">
                                            {meal.name}
                                        </span>
                                        <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 bg-white/80 dark:bg-[#2B2825] px-1.5 py-0.5 rounded-md border border-neutral-light dark:border-[#484440] shrink-0">
                                            {Math.round(meal.nutritionalInfo.calories)} kcal
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Vatten & Streak (Snabbåtkomst ovanför matloggen) */}
            <div className="grid grid-cols-2 gap-3 items-stretch">
                <div ref={waterLoggerRef} className="h-full flex flex-col">
                    <WaterLogger
                        currentWaterMl={waterLoggedMl}
                        waterGoalMl={DEFAULT_WATER_GOAL_ML}
                        onLogWater={(amount) => handleLogWater(amount)}
                        onResetWater={handleResetWater}
                        disabled={!isEditableView}
                        isBootcamp={!!activeBootcamp}
                    />
                </div>
                <div className="flex flex-col h-full justify-between">
                    {/* Streak Card */}
                    <div className={`${activeBootcamp ? 'bg-white border-[#D96E4A]/30' : 'bg-white border-neutral-light'} p-3.5 sm:p-4 rounded-2xl shadow-soft-lg border flex items-center gap-3 sm:gap-4 relative overflow-hidden group hover:shadow-soft-xl transition-all duration-300 h-full`}>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#F6E2D9] flex items-center justify-center text-[#D96E4A] shadow-sm relative z-10 shrink-0">
                            <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="relative z-10 flex-1 min-w-0">
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-0.5 whitespace-nowrap">Streak</p>
                            <p className="text-xl sm:text-2xl font-extrabold text-neutral-dark leading-none truncate">
                                {streakData.currentStreak} 
                                <span className="text-xs sm:text-sm font-medium text-neutral ml-1">dagar</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Meal Sections (Matlogg - Placerad högt upp för snabbaste loggning) */}
            <div className={`${activeBootcamp ? 'bg-white dark:!bg-[#3A4B3C] border-[#4A5B4C]' : 'bg-white border-neutral-light'} p-5 rounded-3xl shadow-soft-xl border`}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-neutral-dark uppercase tracking-wider">Matlogg</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <MealSectionCard 
                        title="Frukost" 
                        icon={<Coffee className="w-6 h-6" />} 
                        meals={mealsBySection.breakfast} 
                        onDeleteMeal={handleDeleteMeal}
                        onUpdateMeal={handleUpdateMeal}
                        onSaveCommon={(meal) => { setMealToSaveAsCommon(meal); pushModalState('saveCommonMeal'); setShowSaveCommonMealModal(true); }}
                        isEditable={isEditableView}
                        isOpen={activeMealSection === 'breakfast'}
                        onOpen={() => setActiveMealSection('breakfast')}
                        onClose={() => setActiveMealSection(null)}
                        recommendedCalories={Math.round(goals.calorieGoal * 0.25)}
                        isBootcamp={!!activeBootcamp}
                    />
                    <MealSectionCard 
                        title="Lunch" 
                        icon={<Sandwich className="w-6 h-6" />} 
                        meals={mealsBySection.lunch} 
                        onDeleteMeal={handleDeleteMeal}
                        onUpdateMeal={handleUpdateMeal}
                        onSaveCommon={(meal) => { setMealToSaveAsCommon(meal); pushModalState('saveCommonMeal'); setShowSaveCommonMealModal(true); }}
                        isEditable={isEditableView}
                        isOpen={activeMealSection === 'lunch'}
                        onOpen={() => setActiveMealSection('lunch')}
                        onClose={() => setActiveMealSection(null)}
                        recommendedCalories={Math.round(goals.calorieGoal * 0.35)}
                        isBootcamp={!!activeBootcamp}
                    />
                    <MealSectionCard 
                        title="Middag" 
                        icon={<CookingPot className="w-6 h-6" />} 
                        meals={mealsBySection.dinner} 
                        onDeleteMeal={handleDeleteMeal}
                        onUpdateMeal={handleUpdateMeal}
                        onSaveCommon={(meal) => { setMealToSaveAsCommon(meal); pushModalState('saveCommonMeal'); setShowSaveCommonMealModal(true); }}
                        isEditable={isEditableView}
                        isOpen={activeMealSection === 'dinner'}
                        onOpen={() => setActiveMealSection('dinner')}
                        onClose={() => setActiveMealSection(null)}
                        recommendedCalories={Math.round(goals.calorieGoal * 0.30)}
                        isBootcamp={!!activeBootcamp}
                    />
                    <MealSectionCard 
                        title="Mellanmål" 
                        icon={<Apple className="w-6 h-6" />} 
                        meals={mealsBySection.snack} 
                        onDeleteMeal={handleDeleteMeal}
                        onUpdateMeal={handleUpdateMeal}
                        onSaveCommon={(meal) => { setMealToSaveAsCommon(meal); pushModalState('saveCommonMeal'); setShowSaveCommonMealModal(true); }}
                        isEditable={isEditableView}
                        isOpen={activeMealSection === 'snack'}
                        onOpen={() => setActiveMealSection('snack')}
                        onClose={() => setActiveMealSection(null)}
                        recommendedCalories={Math.round(goals.calorieGoal * 0.10)}
                        isBootcamp={!!activeBootcamp}
                    />
                </div>
            </div>

            {/* Layout Columns under matloggen: Ditt mål, Veckoöversikt & Sparade vanliga val */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                
                {/* Left Column */}
                <div className="flex flex-col gap-3">
                    {/* Goal Progress Card */}
                    <div className={`${activeBootcamp ? 'bg-white dark:!bg-[#3A4B3C] border-[#4A5B4C]' : 'bg-white border-neutral-light'} p-3.5 sm:p-4 rounded-2xl shadow-soft-lg border flex items-center gap-3 sm:gap-4 relative overflow-hidden group hover:shadow-soft-xl transition-all duration-300`}>
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${activeBootcamp ? 'bg-[#E8EFE9] text-[#2B3B2C]' : 'bg-primary-100 text-primary-darker'} flex items-center justify-center shadow-sm relative z-10 shrink-0`}>
                            <TrophyIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center">
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-0.5 whitespace-nowrap">Ditt Mål</p>
                            <p className="text-sm font-bold text-neutral-dark leading-tight truncate">
                                {userProfile.mainGoalCompleted ? 'Mål uppnått!' : getGoalShortDescription(
                                    userProfile.measurementMethod,
                                    userProfile.desiredWeightChangeKg,
                                    userProfile.desiredFatMassChangeKg,
                                    userProfile.desiredMuscleMassChangeKg
                                )}
                            </p>
                            <div className="flex items-center justify-between text-xs font-bold text-primary mt-1 mb-1">
                                <span className="whitespace-nowrap">
                                    {`${Math.round(calculateProgressPercentage(
                                        userProfile.measurementMethod,
                                        userProfile.goalStartWeight, userProfile.currentWeightKg, userProfile.desiredWeightChangeKg,
                                        userProfile.goalStartFatMassKg, userProfile.bodyFatMassKg, userProfile.desiredFatMassChangeKg,
                                        userProfile.goalStartMuscleMassKg, userProfile.skeletalMuscleMassKg, userProfile.desiredMuscleMassChangeKg,
                                        userProfile.mainGoalCompleted
                                    ))}% klart`}
                                </span>
                            </div>
                            <div className="w-full bg-neutral-light rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className="bg-primary h-full rounded-full transition-all duration-500" 
                                    style={{ 
                                        width: `${calculateProgressPercentage(
                                            userProfile.measurementMethod,
                                            userProfile.goalStartWeight, userProfile.currentWeightKg, userProfile.desiredWeightChangeKg,
                                            userProfile.goalStartFatMassKg, userProfile.bodyFatMassKg, userProfile.desiredFatMassChangeKg,
                                            userProfile.goalStartMuscleMassKg, userProfile.skeletalMuscleMassKg, userProfile.desiredMuscleMassChangeKg,
                                            userProfile.mainGoalCompleted
                                        )}%` 
                                    }}
                                ></div>
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
                        goalType={userProfile.goalType} 
                        currentViewStats={{ 
                            calories: totalNutrients.calories,
                            calorieGoal: goals.calorieGoal,
                            proteinGoalMet: totalNutrients.protein >= goals.proteinGoal,
                            waterGoalMet: waterLoggedMl >= DEFAULT_WATER_GOAL_ML,
                            goalMet: currentGoalMet
                        }}
                        isSummarizingYesterday={isSummarizingYesterday}
                        bankedCalories={weeklyBank.bankedCalories}
                        isBootcamp={!!activeBootcamp}
                    />
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-3">
                    <CommonMealsList 
                        commonMeals={commonMeals}
                        onLogCommonMeal={handleCommonMealLog}
                        onDeleteCommonMeal={handleDeleteCommonMeal}
                        onUpdateCommonMeal={handleUpdateCommonMeal}
                        onShowRating={(nutritionalInfo) => {
                            setFoodRatingData({ nutritionalInfo, mealType: 'snack' }); // default to snack for rating display
                            pushModalState('foodRating');
                            setShowFoodRatingModal(true);
                        }}
                        disabled={!isEditableView}
                        isBootcamp={!!activeBootcamp}
                    />
                </div>
            </div>

            {/* Backdrop for Speed Dial */}
            {isEditableView && isSpeedDialOpen && (
                <div 
                    className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm z-[40] animate-fade-in"
                    onClick={() => setIsSpeedDialOpen(false)}
                />
            )}

            {/* Floating Action Button (FAB) */}
            {isEditableView && !isAICoachOpen && !isProfileOpen && !isMorningReportOpen && (
                <div className="fixed bottom-6 right-6 z-[50] flex flex-col items-end gap-3 pointer-events-none">
                    {isSpeedDialOpen && (
                        <div className="flex flex-col items-end gap-3 animate-slide-up-fade-in pointer-events-auto">
                            {/* 1. Chatta med coachen (längst upp) */}
                            <button onClick={() => { onOpenAICoach(); setIsSpeedDialOpen(false); }} className="flex items-center gap-3 group">
                                <span className="bg-white dark:bg-[#2B2825] text-[#56524D] dark:text-[#FAF6EF] px-3.5 py-1.5 rounded-full shadow-md text-sm font-medium whitespace-nowrap border border-[#F1EAE0]">
                                    Chatta med {coachName}
                                </span>
                                <div className="w-12 h-12 rounded-full shadow-md flex items-center justify-center bg-white dark:bg-[#2B2825] text-[#D96E4A] border border-[#F1EAE0] group-hover:bg-[#F6E2D9] transition-colors">
                                    <SparklesIcon className="w-6 h-6 text-[#D96E4A]" />
                                </div>
                            </button>

                            {/* 2. Recept (slår ihop Hitta recept & Mina recept) */}
                            <button onClick={handleRecipes} className="flex items-center gap-3 group">
                                <span className="bg-white dark:bg-[#2B2825] text-[#56524D] dark:text-[#FAF6EF] px-3.5 py-1.5 rounded-full shadow-md text-sm font-medium whitespace-nowrap border border-[#F1EAE0]">
                                    Recept
                                </span>
                                <div className="w-12 h-12 bg-white dark:bg-[#2B2825] text-[#D96E4A] rounded-full shadow-md border border-[#F1EAE0] flex items-center justify-center group-hover:bg-[#F6E2D9] transition-colors">
                                    <RecipeIcon className="w-6 h-6 text-[#D96E4A]" />
                                </div>
                            </button>

                            {/* 3. Skanna kod */}
                            <button onClick={handleScanBarcode} className="flex items-center gap-3 group">
                                <span className="bg-white dark:bg-[#2B2825] text-[#56524D] dark:text-[#FAF6EF] px-3.5 py-1.5 rounded-full shadow-md text-sm font-medium whitespace-nowrap border border-[#F1EAE0]">
                                    Skanna kod
                                </span>
                                <div className="w-12 h-12 bg-white dark:bg-[#2B2825] text-[#D96E4A] rounded-full shadow-md border border-[#F1EAE0] flex items-center justify-center group-hover:bg-[#F6E2D9] transition-colors">
                                    <BarcodeIcon className="w-6 h-6 text-[#D96E4A]" />
                                </div>
                            </button>

                            {/* 4. Sök & logga */}
                            <button onClick={handleSearchText} className="flex items-center gap-3 group">
                                <span className="bg-white dark:bg-[#2B2825] text-[#56524D] dark:text-[#FAF6EF] px-3.5 py-1.5 rounded-full shadow-md text-sm font-medium whitespace-nowrap border border-[#F1EAE0]">
                                    Sök & logga
                                </span>
                                <div className="w-12 h-12 bg-white dark:bg-[#2B2825] text-[#D96E4A] rounded-full shadow-md border border-[#F1EAE0] flex items-center justify-center group-hover:bg-[#F6E2D9] transition-colors">
                                    <SearchIcon className="w-5 h-6 text-[#D96E4A]" />
                                </div>
                            </button>

                            {/* 5. Fota mat (närmast tummen / längst ner) */}
                            <button onClick={handleTakePhoto} className="flex items-center gap-3 group">
                                <span className="bg-white dark:bg-[#2B2825] text-[#56524D] dark:text-[#FAF6EF] px-3.5 py-1.5 rounded-full shadow-md text-sm font-medium whitespace-nowrap border border-[#F1EAE0]">
                                    Fota mat
                                </span>
                                <div className="w-12 h-12 bg-white dark:bg-[#2B2825] text-[#D96E4A] rounded-full shadow-md border border-[#F1EAE0] flex items-center justify-center group-hover:bg-[#F6E2D9] transition-colors">
                                    <CameraIcon className="w-6 h-6 text-[#D96E4A]" />
                                </div>
                            </button>
                        </div>
                    )}
                    <button 
                        onClick={() => { setIsSpeedDialOpen(!isSpeedDialOpen); }}
                        className={`pointer-events-auto w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 overflow-hidden ${isSpeedDialOpen ? 'bg-[#56524D] text-white rotate-45' : 'bg-[#D96E4A] text-white hover:bg-[#C05A38]'}`}
                        aria-label="Lägg till"
                    >
                        <PlusIcon className="w-7 h-7" />
                    </button>
                </div>
            )}

            {/* Checklist & Spotlight (Onboarding) */}
            {checklistState && !checklistState.dismissed && (
                <div className="mb-4 max-w-lg mx-auto w-full">
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
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-fade-in" onClick={() => setShowCommonMealsPopup(null)}>
                    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-soft-xl w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-neutral-dark">Logga {showCommonMealsPopup.name}</h3>
                            <button onClick={() => setShowCommonMealsPopup(null)} className="p-1 text-neutral hover:text-red-500 rounded-full transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-neutral-500 mb-3 uppercase tracking-wider">Välj måltidstyp:</label>
                            <MealTypeSelector 
                                selectedType={selectedCommonMealType} 
                                onSelect={(type) => setSelectedCommonMealType(type)} 
                                className="w-full" 
                            />
                        </div>

                        <div className="mb-8">
                            <label className="block text-sm font-bold text-neutral-500 mb-3 uppercase tracking-wider">Portionsstorlek:</label>
                            <div className="flex items-center gap-2">
                                {[0.5, 0.75, 1, 1.5, 2].map(multiplier => (
                                    <button
                                        key={multiplier}
                                        onClick={() => setSelectedCommonMealPortion(multiplier)}
                                        className={`flex-1 py-2 px-1 rounded-xl font-bold text-sm transition-all ${
                                            selectedCommonMealPortion === multiplier
                                                ? 'bg-primary text-white shadow-md'
                                                : 'bg-neutral-light text-neutral-dark hover:bg-neutral-200'
                                        }`}
                                    >
                                        {multiplier * 100}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => selectedCommonMealType && confirmCommonMealLog(selectedCommonMealType)}
                                disabled={!selectedCommonMealType}
                                className="w-full py-4 bg-primary text-white font-bold text-lg rounded-xl shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                <CheckIcon className="w-6 h-6" /> Logga som {
                                    selectedCommonMealType === 'breakfast' ? 'frukost' :
                                    selectedCommonMealType === 'lunch' ? 'lunch' :
                                    selectedCommonMealType === 'dinner' ? 'middag' : 'mellis'
                                }
                            </button>
                            <button onClick={() => setShowCommonMealsPopup(null)} className="w-full py-2 text-neutral text-sm font-medium hover:text-neutral-dark transition-colors">Avbryt</button>
                        </div>
                    </div>
                </div>
            )}

            {showCameraModal && (
                <CameraModal 
                    show={showCameraModal} 
                    onClose={() => closeModalState('camera', () => setShowCameraModal(false))} 
                    onImageCapture={async (imgData) => { 
                        setShowCameraModal(false); 
                        if (cameraMode === 'mealAnalysis') {
                            const dataUrl = `data:image/jpeg;base64,${imgData}`;
                            setAnalyzedImageDataUrl(dataUrl); 
                            setImageAnalysisResult(null);
                            setIsAnalyzingPhoto(true);
                            // 1. ÖVERLAPPA VÄNTAN: Öppna bekräftelsevyn OMEDELBART efter att fotot tagits
                            recordModalRenderStart();
                            replaceModalState('imageAnalysis');
                            setShowImageAnalysisResultModal(true); 

                            // 2. Analysen körs i bakgrunden medan användaren väljer måltidstyp och portion
                            analyzeFoodImage(imgData)
                                .then((result) => {
                                    setImageAnalysisResult(result);
                                })
                                .catch((e: any) => {
                                    alert(e.message || 'Kunde inte analysera bilden.');
                                    closeModalState('imageAnalysis', () => setShowImageAnalysisResultModal(false));
                                })
                                .finally(() => {
                                    setIsAnalyzingPhoto(false);
                                });
                        } else if (cameraMode === 'ingredientCapture') {
                            setIngredientImages(prev => [...prev, `data:image/jpeg;base64,${imgData}`]);
                            replaceModalState('ingredientCapture');
                            setShowIngredientCaptureModal(true); 
                        } else if (cameraMode === 'nutritionLabel') {
                            setAppStatus('analyzing');
                            try {
                                const result = await analyzeNutritionLabelImage(imgData);
                                setNutritionLabelResult(result);
                                replaceModalState('nutritionLabel');
                                setShowNutritionLabelResultModal(true);
                            } catch (e: any) {
                                alert(e.message);
                            } finally {
                                setAppStatus('idle');
                            }
                        }
                    }} 
                    onCameraError={(err) => alert(err)} 
                />
            )}
            {showTextEntryModal && <TextEntryModal show={showTextEntryModal} onClose={() => closeModalState('textEntry', () => setShowTextEntryModal(false))} onLog={handleAddMealToLog} defaultMealType={defaultMealTypeForModal} />}
            {showRecipeChoiceModal && (
                <RecipeChoiceModal 
                    show={showRecipeChoiceModal} 
                    onClose={() => closeModalState('recipeChoice', () => setShowRecipeChoiceModal(false))} 
                    onChooseSearch={() => { replaceModalState('recipe'); setShowRecipeChoiceModal(false); setShowRecipeModal(true); }} 
                    onChooseTakePhoto={() => { replaceModalState('ingredientCapture'); setShowRecipeChoiceModal(false); setShowIngredientCaptureModal(true); }} 
                    onChooseUpload={() => { replaceModalState('ingredientCapture'); setShowRecipeChoiceModal(false); setShowIngredientCaptureModal(true); }} 
                    onChooseMyRecipes={() => { replaceModalState('myRecipes'); setShowRecipeChoiceModal(false); setShowMyRecipesModal(true); }}
                />
            )}
            {showRecipeModal && <RecipeModal show={showRecipeModal} onClose={() => closeModalState('recipe', () => { setShowRecipeModal(false); setIsRecipeSaved(false); })} onSearch={async (q) => { setAppStatus('searching_recipe'); setIsRecipeSaved(false); try { const res = await getRecipeSuggestion(q); setSearchedRecipe(res); } catch(e:any) { alert(e.message); } finally { setAppStatus('idle'); } }} onLogRecipe={handleAddMealToLog} recipe={searchedRecipe} isLoading={appStatus === 'searching_recipe'} error={null} recentSearches={getLocalStorageItem(LOCAL_STORAGE_KEYS.RECENT_RECIPE_SEARCHES, [])} setToastNotification={setToastNotification} defaultMealType={defaultMealTypeForModal} onSaveRecipe={handleSaveRecipe} isSaved={isRecipeSaved} onShareRecipe={onShareRecipe} />}
            {showMyRecipesModal && <MyRecipesModal show={showMyRecipesModal} onClose={() => closeModalState('myRecipes', () => setShowMyRecipesModal(false))} onShareRecipe={onShareRecipe} onLogRecipe={handleAddMealToLog} />}
            {showIngredientCaptureModal && (
                <IngredientCaptureModal 
                    show={showIngredientCaptureModal} 
                    onClose={() => closeModalState('ingredientCapture', () => setShowIngredientCaptureModal(false))} 
                    images={ingredientImages} 
                    onRemoveImage={(i) => setIngredientImages(prev => prev.filter((_, idx) => idx !== i))} 
                    onUploadImages={async (files) => { for(let i=0; i<files.length; i++) { const base64 = await resizeImageForLog(files[i], 800); setIngredientImages(prev => [...prev, base64]); } }} 
                    openCameraModal={() => { 
                        setCameraMode('ingredientCapture'); 
                        replaceModalState('camera');
                        setShowIngredientCaptureModal(false); 
                        setShowCameraModal(true); 
                    }} 
                    onFindRecipes={async (imgs) => { setShowIngredientCaptureModal(false); setAppStatus('analyzing'); try { const base64s = imgs.map(d => d.split(',')[1]); const res = await getRecipesFromIngredientsImage(base64s); setIdentifiedIngredients(res.identifiedIngredients); setRecipeSuggestions(res.recipeSuggestions); replaceModalState('ingredientResults'); setShowIngredientRecipeResultsModal(true); } catch(e:any) { alert(e.message); } finally { setAppStatus('idle'); } }} 
                />
            )}
            {showIngredientRecipeResultsModal && <IngredientRecipeResultsModal show={showIngredientRecipeResultsModal} onClose={() => closeModalState('ingredientResults', () => setShowIngredientRecipeResultsModal(false))} identifiedIngredients={identifiedIngredients} recipeSuggestions={recipeSuggestions || []} onLogRecipe={handleAddMealToLog} isLoading={false} error={null} defaultMealType={defaultMealTypeForModal || 'dinner'} onSaveRecipe={handleSaveRecipe} savedRecipeIds={savedRecipeIds} />}
            {showBarcodeScannerModal && <BarcodeScannerModal show={showBarcodeScannerModal} onClose={() => closeModalState('barcodeScanner', () => setShowBarcodeScannerModal(false))} onBarcodeScanned={async (code) => { setShowBarcodeScannerModal(false); setScannedBarcode(code); setAppStatus('searching'); try { const info = await getFoodInfoFromBarcode(code); setScannedFoodInfo(info); replaceModalState('barcodeResult'); setShowBarcodeSearchResultModal(true); } catch(e:any) { alert(e.message); } finally { setAppStatus('idle'); } }} onCameraError={(e) => alert(e)} onScanFallback={() => { setCameraMode('nutritionLabel'); replaceModalState('camera'); setShowBarcodeScannerModal(false); setShowCameraModal(true); }} />}
            {showBarcodeSearchResultModal && scannedFoodInfo && <BarcodeSearchResultModal show={showBarcodeSearchResultModal} scanResult={scannedFoodInfo} onLog={handleAddMealToLog} onClose={() => closeModalState('barcodeResult', () => setShowBarcodeSearchResultModal(false))} defaultMealType={defaultMealTypeForModal} />}
            {showImageAnalysisResultModal && analyzedImageDataUrl && (
                <ImageAnalysisResultModal 
                    show={showImageAnalysisResultModal} 
                    analysisResult={imageAnalysisResult} 
                    imageDataUrl={analyzedImageDataUrl} 
                    isLoading={isAnalyzingPhoto}
                    onLog={handleAddMealToLog} 
                    onClose={() => {
                        setIsAnalyzingPhoto(false);
                        closeModalState('imageAnalysis', () => setShowImageAnalysisResultModal(false));
                    }} 
                    defaultMealType={defaultMealTypeForModal} 
                />
            )}
            {showSaveCommonMealModal && mealToSaveAsCommon && <SaveCommonMealModal mealInfo={mealToSaveAsCommon.nutritionalInfo} initialName={mealToSaveAsCommon.nutritionalInfo.foodItem || ''} onClose={() => closeModalState('saveCommonMeal', () => { setMealToSaveAsCommon(null); setShowSaveCommonMealModal(false); })} onSave={async (name) => { try { const timestamp = Date.now(); const newId = await addCommonMeal(currentUser?.uid || '', { name, nutritionalInfo: mealToSaveAsCommon.nutritionalInfo, timestamp }); setCommonMeals(prev => [...prev, { id: newId, name, nutritionalInfo: mealToSaveAsCommon.nutritionalInfo, timestamp }]); closeModalState('saveCommonMeal', () => { setMealToSaveAsCommon(null); setShowSaveCommonMealModal(false); }); setToastNotification({message: 'Sparat som vanligt val!', type:'success'}); } catch(e) { alert("Kunde inte spara"); } }} />}
            {showNutritionLabelResultModal && nutritionLabelResult && <NutritionLabelResultModal show={showNutritionLabelResultModal} onClose={() => closeModalState('nutritionLabel', () => setShowNutritionLabelResultModal(false))} analysisResult={nutritionLabelResult} onLog={handleAddMealToLog} defaultMealType={defaultMealTypeForModal} />}
            {showFoodRatingModal && foodRatingData && userProfile && (
                <FoodRatingModal 
                    show={showFoodRatingModal} 
                    onClose={() => closeModalState('foodRating', () => setShowFoodRatingModal(false))} 
                    nutritionalInfo={foodRatingData.nutritionalInfo} 
                    mealType={foodRatingData.mealType} 
                    userProfile={userProfile} 
                />
            )}
            
            {showProteinInfoModal && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => closeModalState('proteinInfo', () => setShowProteinInfoModal(false))}>
                    <div onClick={e => e.stopPropagation()}>
                        <ProteinInfoModal onClose={() => closeModalState('proteinInfo', () => setShowProteinInfoModal(false))} />
                    </div>
                </div>
            )}

            {appStatus !== 'idle' && appStatus !== 'searching_recipe' && <LoadingSpinner message={appStatus === 'analyzing' ? 'Analyserar...' : appStatus === 'saving' ? 'Sparar...' : 'Söker...'} />}
            
            {/* Diskret tidsmätningspanel (endast synlig under TESTING_TOOL_ALLOWED_HOSTNAMES) */}
            <PhotoTimingPanel />
        </div>
    );
};

const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
};

export default Dashboard;