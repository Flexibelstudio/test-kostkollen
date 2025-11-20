import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  LoggedMeal,
  UserProfileData,
  GoalSettings,
  WeeklyCalorieBank,
  Level,
  OnboardingChecklistState,
  CommonMeal,
  NutritionalInfo,
  SearchedFoodInfo,
  BarcodeScannedFoodInfo,
  IngredientRecipeResponse,
  RecipeSuggestion,
  PastDaySummary,
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
  LOCAL_STORAGE_KEYS,
} from '../constants';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import WeeklyProgressDays from '../components/WeeklyProgressDays';
import ProgressDisplay from '../components/ProgressDisplay';
import WaterLogger from '../components/WaterLogger';
import { CommonMealsList } from '../components/CommonMealsList';
import MealItemCard from '../components/MealItemCard';
import {
  PlusIcon,
  CameraIcon,
  RecipeIcon,
  UploadIcon,
  BarcodeIcon,
  SearchIcon,
  XMarkIcon,
} from '../components/icons';
import { useUserContext } from '../context/UserContext';
import { playAudio } from '../services/audioService';
import { getDateUID } from '../utils/dateUtils';
import {
  addMealLog as addMealLogFirestore,
  setWaterLog,
  addCommonMeal,
  deleteCommonMeal as deleteCommonMealFromDB,
  updateCommonMeal,
  updateMealLog,
  updateUserDocument,
} from '../services/firestoreService';
import {
  analyzeFoodImage,
  getRecipeSuggestion,
  getRecipesFromIngredientsImage,
  analyzeNutritionLabelImage,
} from '../services/geminiService';
import { getFoodInfoFromBarcode } from '../services/openFoodFactsService';
import { db } from '../firebase';
import { collection, doc, writeBatch } from '@firebase/firestore';

// Modals
import CameraModal from '../components/CameraModal';
import TextEntryModal from '../components/TextEntryModal';
import RecipeModal from '../components/RecipeModal';
import IngredientCaptureModal from '../components/IngredientCaptureModal';
import IngredientRecipeResultsModal from '../components/IngredientRecipeResultsModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import BarcodeSearchResultModal from '../components/BarcodeSearchResultModal';
import ImageAnalysisResultModal from '../components/ImageAnalysisResultModal';
import SaveCommonMealModal from '../components/SaveCommonMealModal';
import NutritionLabelResultModal from '../components/NutritionLabelResultModal';

// ---------- Hjälpare för bild-resize ----------
const resizeImageForLog = (file: File, maxSize: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      if (!event.target?.result) {
        return reject(new Error('File could not be read.'));
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

// ---------- Props-typer ----------
interface StreakDataProps {
  currentStreak: number;
  lastDateStreakChecked?: string | null;
}

interface DashboardProps {
  checklistState: OnboardingChecklistState | null;
  onOnboardingNavigate: (view: 'journey' | 'community', subView?: 'search') => void;
  showSpotlight: boolean;
  onDismissSpotlight: () => void;
  isInstallBannerVisible: boolean;
  viewingDate: Date;
  onDateSelect: (date: Date) => void;
  formattedViewingDate: string;
  ensureYesterdayProcessed: (
    uid: string,
    now?: Date,
    options?: any,
    manualLogOverride?: LoggedMeal[]
  ) => Promise<any>;
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;

  // Nya props från App.tsx
  streakData: StreakDataProps;
  highestStreak: number;
  currentLevel?: Level | null;
  userProfile: UserProfileData;
  weeklyBank: WeeklyCalorieBank;
  pastDaysSummary: Record<string, PastDaySummary>;
  currentAppDate: Date;
  dailyLog: LoggedMeal[];
  goals: GoalSettings;
  waterLoggedMl: number;
  waterGoalMl: number;
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
  setToastNotification,
  streakData,
  highestStreak,
  currentLevel,
  userProfile,
  weeklyBank,
  pastDaysSummary,
  currentAppDate,
  dailyLog,
  goals,
  waterLoggedMl,
  waterGoalMl,
}) => {
  // Vi hämtar bara det vi behöver från context för uppdateringar, inte för att läsa daglig data
  const {
    currentUser,
    userRole,
    userStatus,
    setWeeklyBank,
    setDailyLog,
    setWaterLoggedMl,
    commonMeals,
    setCommonMeals,
    setStreakData,
    setHighestStreak,
    setPastDaysSummary,
  } = useUserContext();

  // Säkerställ att saker som KAN vara undefined alltid beter sig som array
  const safeDailyLog: LoggedMeal[] = Array.isArray(dailyLog) ? dailyLog : [];
  const safeCommonMeals: CommonMeal[] = Array.isArray(commonMeals) ? commonMeals : [];

  // --- Local State ---
  const [showSpeedDial, setShowSpeedDial] = useState(false);
  const waterLoggerRef = useRef<HTMLDivElement | null>(null);

  // Modal states
  const [showTextEntryModal, setShowTextEntryModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showRecipeChoiceModal, setShowRecipeChoiceModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showIngredientCaptureModal, setShowIngredientCaptureModal] = useState(false);
  const [showIngredientRecipeResultsModal, setShowIngredientRecipeResultsModal] =
    useState(false);
  const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState(false);
  const [showNutritionLabelResultModal, setShowNutritionLabelResultModal] =
    useState(false);
  const [showSaveCommonMealModal, setShowSaveCommonMealModal] = useState(false);

  // Data for modals
  const [cameraImageForAnalysis, setCameraImageForAnalysis] = useState<string | null>(null);
  const [analysisResultForModal, setAnalysisResultForModal] =
    useState<NutritionalInfo | null>(null);
  const [ingredientImagesForCapture, setIngredientImagesForCapture] = useState<string[]>(
    []
  );
  const [ingredientAnalysisResult, setIngredientAnalysisResult] =
    useState<IngredientRecipeResponse | null>(null);
  const [currentRecipe, setCurrentRecipe] = useState<RecipeSuggestion | null>(null);
  const [recentRecipeSearches, setRecentRecipeSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.RECENT_RECIPE_SEARCHES);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [barcodeScanResult, setBarcodeScanResult] =
    useState<BarcodeScannedFoodInfo | null>(null);
  const [nutritionLabelResult, setNutritionLabelResult] =
    useState<NutritionalInfo | null>(null);
  const [mealToSaveAsCommon, setMealToSaveAsCommon] = useState<LoggedMeal | null>(null);

  // Processing states
  const [appStatus, setAppStatus] = useState<
    'IDLE' | 'ANALYZING' | 'SEARCHING_RECIPE' | 'ANALYZING_INGREDIENTS' | 'SEARCHING_BARCODE'
  >('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCapturingForIngredients, setIsCapturingForIngredients] = useState(false);
  const [isCapturingForLabel, setIsCapturingForLabel] = useState(false);

  // --- Derived state ---

  const isViewingToday = useMemo(() => {
    const todayStr = getDateUID(currentAppDate);
    const viewingDateStr = getDateUID(viewingDate);
    return todayStr === viewingDateStr;
  }, [currentAppDate, viewingDate]);

  const isViewingAppYesterday = useMemo(() => {
    const yesterday = new Date(currentAppDate);
    yesterday.setDate(currentAppDate.getDate() - 1);
    return viewingDate.toDateString() === yesterday.toDateString();
  }, [viewingDate, currentAppDate]);

  const isEditableLogDate = useMemo(
    () => isViewingToday || isViewingAppYesterday,
    [isViewingToday, isViewingAppYesterday]
  );

  const totalNutrients = useMemo(() => {
    return safeDailyLog.reduce(
      (acc, meal) => {
        acc.calories += meal.nutritionalInfo.calories;
        acc.protein += meal.nutritionalInfo.protein;
        acc.carbohydrates += meal.nutritionalInfo.carbohydrates;
        acc.fat += meal.nutritionalInfo.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
    );
  }, [safeDailyLog]);

  const minSafeCalories = useMemo(() => {
    const goalBasedMin = goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
    return Math.max(goalBasedMin, MIN_ABSOLUTE_CALORIES_THRESHOLD);
  }, [goals.calorieGoal]);

  const totalCaloriesCoveredByBankToday = useMemo(() => {
    return safeDailyLog.reduce(
      (sum, meal) => sum + (meal.caloriesCoveredByBank || 0),
      0
    );
  }, [safeDailyLog]);

  const currentLevelName = currentLevel?.name ?? 'Nivå';

  const groupedDailyLog = useMemo(() => {
    if (!safeDailyLog || safeDailyLog.length === 0) return [];

    const commonMealGroups = new Map<string, LoggedMeal[]>();
    const otherMeals: LoggedMeal[] = [];

    for (const meal of safeDailyLog) {
      if (
        meal.commonMealId &&
        !['manual', 'text_search', 'recipe', 'ingredient_recipe', 'barcode', 'nutrition_label'].includes(
          meal.commonMealId
        )
      ) {
        if (!commonMealGroups.has(meal.commonMealId)) {
          commonMealGroups.set(meal.commonMealId, []);
        }
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

        const totalNutritionalInfo = sortedGroup.reduce(
          (acc, meal) => {
            acc.calories += meal.nutritionalInfo.calories;
            acc.protein += meal.nutritionalInfo.protein;
            acc.carbohydrates += meal.nutritionalInfo.carbohydrates;
            acc.fat += meal.nutritionalInfo.fat;
            return acc;
          },
          {
            calories: 0,
            protein: 0,
            carbohydrates: 0,
            fat: 0,
            foodItem: representativeMeal.nutritionalInfo.foodItem,
          }
        );

        processedMeals.push({
          ...representativeMeal,
          nutritionalInfo: totalNutritionalInfo,
          count: sortedGroup.length,
          originalIds: sortedGroup.map((m) => m.id),
        });
      } else {
        processedMeals.push(...group);
      }
    }

    return processedMeals.sort((a, b) => b.timestamp - a.timestamp);
  }, [safeDailyLog]);

  // --- Helpers ---

  const openModal = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    playAudio('uiClick');
    setter(true);
  };

  const closeModal = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    playAudio('uiClick');
    setter(false);
  };

  const handleFabClick = () => {
    playAudio('uiClick');
    if (showSpotlight) onDismissSpotlight();
    if (!isEditableLogDate) {
      setToastNotification({
        message: 'Du kan endast logga för idag eller igår.',
        type: 'error',
      });
      setTimeout(() => setToastNotification(null), 3000);
      return;
    }
    setShowSpeedDial((prev) => !prev);
  };

  const handleScrollToWater = () => {
    waterLoggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleLogWater = async (amountMl: number) => {
    if (!isEditableLogDate || !currentUser) {
      setToastNotification({
        message: 'Du kan endast logga vatten för idag och igår.',
        type: 'error',
      });
      setTimeout(() => setToastNotification(null), 3000);
      return;
    }
    playAudio('waterSplash');
    const newTotalWater = waterLoggedMl + amountMl;
    setWaterLoggedMl(newTotalWater);
    const dateUID = getDateUID(viewingDate);
    try {
      await setWaterLog(currentUser.uid, dateUID, newTotalWater);
    } catch (error) {
      console.error('Water log error', error);
      setWaterLoggedMl((current) => current - amountMl);
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
      console.error('Reset water error', error);
      setWaterLoggedMl(previousAmount);
    }
  };

  const addMealToLog = async (
    nutritionalInfo: NutritionalInfo,
    options: { base64Image?: string; commonMealId?: string } = {}
  ) => {
    if (!isEditableLogDate || !currentUser) {
      setToastNotification({
        message: 'Du kan endast logga måltider för idag och igår.',
        type: 'error',
      });
      setTimeout(() => setToastNotification(null), 3000);
      return;
    }

    const mealLogCollectionRef = collection(db, 'users', currentUser.uid, 'mealLogs');
    const mealLogDocRef = doc(mealLogCollectionRef);
    const mealId = mealLogDocRef.id;

    let finalImageUrl: string | undefined = options.base64Image;
    const originalDailyLog = [...safeDailyLog];
    const originalBankState: WeeklyCalorieBank = { ...weeklyBank };

    if (!finalImageUrl) {
      if (options.commonMealId === 'manual') finalImageUrl = MANUAL_LOG_FOOD_ICON_SVG;
      else if (options.commonMealId === 'text_search') finalImageUrl = SEARCH_ICON_SVG;
      else if (options.commonMealId === 'recipe' || options.commonMealId === 'ingredient_recipe')
        finalImageUrl = RECIPE_ICON_SVG;
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
      imageUrl: finalImageUrl,
      commonMealId: options.commonMealId,
    };

    let newBankState = originalBankState;
    if (
      totalNutrients.calories + newMealData.nutritionalInfo.calories >
        goals.calorieGoal &&
      originalBankState.bankedCalories > 0
    ) {
      const overshoot =
        totalNutrients.calories + newMealData.nutritionalInfo.calories - goals.calorieGoal;
      const canUseFromBank = Math.min(overshoot, originalBankState.bankedCalories);
      if (canUseFromBank > 0) {
        (newMealData as any).caloriesCoveredByBank = canUseFromBank;
        newBankState = {
          ...originalBankState,
          bankedCalories: Math.max(0, originalBankState.bankedCalories - canUseFromBank),
        };
      }
    }

    const optimisticMeal: LoggedMeal = { ...newMealData, id: mealId };
    const updatedLog = [optimisticMeal, ...safeDailyLog];
    setDailyLog(updatedLog);
    if (newBankState.bankedCalories !== originalBankState.bankedCalories) {
      setWeeklyBank(newBankState);
    }

    playAudio('logSuccess', 0.8);
    setToastNotification({
      message: `"${optimisticMeal.nutritionalInfo.foodItem}" loggades!`,
      type: 'success',
    });
    setTimeout(() => setToastNotification(null), 3000);

    try {
      await addMealLogFirestore(currentUser.uid, mealId, newMealData);
      if (newBankState.bankedCalories !== originalBankState.bankedCalories) {
        await updateUserDocument(currentUser.uid, {
          weeklyBank: newBankState,
          role: userRole!,
          status: userStatus!,
        });
      }

      if (isViewingAppYesterday) {
        const processResult = await ensureYesterdayProcessed(
          currentUser.uid,
          currentAppDate,
          { force: true, silent: true },
          updatedLog
        );
        if (processResult) {
          if (processResult.summary) {
            setPastDaysSummary((prev) => ({
              ...prev,
              [processResult.summary!.date]: processResult.summary!,
            }));
          }
          setStreakData(processResult.streakData);
          setWeeklyBank(processResult.weeklyBank);
          setHighestStreak(processResult.highestStreak);
        }
      }
    } catch (error) {
      console.error('Add meal error:', error);
      setDailyLog(originalDailyLog);
      setWeeklyBank(originalBankState);
    } finally {
      setCameraImageForAnalysis(null);
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (!isEditableLogDate || !currentUser) return;
    playAudio('uiClick');

    const originalDailyLog = [...safeDailyLog];
    const originalWeeklyBank = { ...weeklyBank };
    const updatedLogUnsorted = safeDailyLog.filter((meal) => meal.id !== mealId);
    setDailyLog(updatedLogUnsorted);

    try {
      const batch = writeBatch(db);
      const mealToDeleteRef = doc(db, 'users', currentUser.uid, 'mealLogs', mealId);
      batch.delete(mealToDeleteRef);
      await batch.commit();

      setToastNotification({ message: 'Måltid borttagen.', type: 'success' });
      setTimeout(() => setToastNotification(null), 3000);

      if (isViewingAppYesterday) {
        const processResult = await ensureYesterdayProcessed(
          currentUser.uid,
          currentAppDate,
          { force: true, silent: true },
          updatedLogUnsorted
        );
        if (processResult) {
          setStreakData(processResult.streakData);
          setWeeklyBank(processResult.weeklyBank);
        }
      }
    } catch (error) {
      console.error('Delete error', error);
      setDailyLog(originalDailyLog);
      setWeeklyBank(originalWeeklyBank);
    }
  };

  const handleUpdateMeal = async (mealId: string, updatedInfo: NutritionalInfo) => {
    if (!isEditableLogDate || !currentUser) return;
    playAudio('uiClick');
    const updatedLog = safeDailyLog.map((m) =>
      m.id === mealId ? { ...m, nutritionalInfo: updatedInfo } : m
    );
    setDailyLog(updatedLog);
    try {
      await updateMealLog(currentUser.uid, mealId, updatedInfo);
      setToastNotification({ message: 'Måltid uppdaterad.', type: 'success' });
      setTimeout(() => setToastNotification(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // --- Common Meals ---
  const handleOpenSaveCommonMealModal = (meal: LoggedMeal) => {
    let mealToSave: LoggedMeal = meal;
    if ((meal as any).count && (meal as any).count > 1) {
      const count = (meal as any).count as number;
      const singleNutrition: NutritionalInfo = {
        foodItem: meal.nutritionalInfo.foodItem,
        calories: meal.nutritionalInfo.calories / count,
        protein: meal.nutritionalInfo.protein / count,
        carbohydrates: meal.nutritionalInfo.carbohydrates / count,
        fat: meal.nutritionalInfo.fat / count,
      };
      mealToSave = { ...meal, nutritionalInfo: singleNutrition };
    }
    setMealToSaveAsCommon(mealToSave);
    openModal(setShowSaveCommonMealModal);
  };

  const saveCommonMeal = async (name: string) => {
    if (!currentUser || !mealToSaveAsCommon) return;
    const cleanInfo = { ...mealToSaveAsCommon.nutritionalInfo };
    cleanInfo.foodItem = name;
    const newCommonMealData = { name, nutritionalInfo: cleanInfo, timestamp: Date.now() };

    try {
      const newDocId = await addCommonMeal(currentUser.uid, newCommonMealData);
      setCommonMeals((prev) => [{ ...newCommonMealData, id: newDocId }, ...prev]);
      setShowSaveCommonMealModal(false);
      setMealToSaveAsCommon(null);
      setToastNotification({ message: `"${name}" sparad!`, type: 'success' });
      playAudio('logSuccess', 0.8);
      setTimeout(() => setToastNotification(null), 2500);
    } catch (error) {
      console.error(error);
    }
  };

  const logCommonMeal = (commonMeal: CommonMeal) => {
    if (!isEditableLogDate) return;
    addMealToLog(commonMeal.nutritionalInfo, { commonMealId: commonMeal.id });
  };

  const deleteCommonMeal = async (commonMealId: string) => {
    if (!currentUser) return;
    try {
      await deleteCommonMealFromDB(currentUser.uid, commonMealId);
      setCommonMeals((prev) => prev.filter((cm) => cm.id !== commonMealId));
      setToastNotification({ message: 'Vanligt val borttaget.', type: 'success' });
      setTimeout(() => setToastNotification(null), 3000);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateCommonMeal = async (
    commonMealId: string,
    updatedData: { name: string; nutritionalInfo: NutritionalInfo }
  ) => {
    if (!currentUser) return;
    playAudio('uiClick');
    try {
      await updateCommonMeal(currentUser.uid, commonMealId, updatedData);
      setCommonMeals((prev) =>
        prev.map((cm) => (cm.id === commonMealId ? { ...cm, ...updatedData } : cm))
      );
      setToastNotification({ message: 'Vanligt val uppdaterat.', type: 'success' });
      setTimeout(() => setToastNotification(null), 3000);
    } catch (error) {
      console.error(error);
    }
  };

  // --- FAB / alternativ ---
  const handleAddOptionSelect = (
    option: 'camera' | 'upload' | 'text' | 'recipe' | 'barcode'
  ) => {
    setShowSpeedDial(false);
    playAudio('uiClick');
    switch (option) {
      case 'camera':
        setIsCapturingForIngredients(false);
        setIsCapturingForLabel(false);
        openModal(setShowCameraModal);
        break;
      case 'upload':
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

  // --- Bild / AI ---
  const handleImageCapture = async (base64ImageData: string) => {
    setShowCameraModal(false);
    if (isCapturingForIngredients) {
      setIngredientImagesForCapture((prev) => [
        ...prev,
        `data:image/jpeg;base64,${base64ImageData}`,
      ]);
      openModal(setShowIngredientCaptureModal);
    } else if (isCapturingForLabel) {
      setAppStatus('ANALYZING');
      try {
        const analysis = await analyzeNutritionLabelImage(base64ImageData);
        setNutritionLabelResult(analysis);
        setShowNutritionLabelResultModal(true);
      } catch (e) {
        console.error(e);
        setErrorMessage('Analysfel');
      } finally {
        setAppStatus('IDLE');
        setIsCapturingForLabel(false);
      }
    } else {
      setCameraImageForAnalysis(base64ImageData);
      setAppStatus('ANALYZING');
      try {
        const analysis = await analyzeFoodImage(base64ImageData);
        setAnalysisResultForModal(analysis);
      } catch (e) {
        console.error(e);
        setErrorMessage('Analysfel');
      } finally {
        setAppStatus('IDLE');
      }
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAppStatus('ANALYZING');
      try {
        const resizedBase64 = await resizeImageForLog(file, 800);
        handleImageCapture(resizedBase64);
      } catch (error) {
        console.error(error);
        setAppStatus('IDLE');
      }
    }
    if (event.target) event.target.value = '';
  };

  const handleLogFromModal = (
    foodInfo: NutritionalInfo | SearchedFoodInfo,
    options: { saveAsCommon: boolean }
  ) => {
    const base64ForUpload = cameraImageForAnalysis
      ? `data:image/jpeg;base64,${cameraImageForAnalysis}`
      : undefined;
    addMealToLog(foodInfo as NutritionalInfo, {
      base64Image: base64ForUpload,
      commonMealId: 'text_search',
    });
    if (options.saveAsCommon) {
      saveCommonMeal(foodInfo.foodItem || 'Okänt val');
    }
    setAnalysisResultForModal(null);
    setCameraImageForAnalysis(null);
  };

  // --- Recept ---
  const handleRecipeSearch = async (query: string) => {
    setAppStatus('SEARCHING_RECIPE');
    setCurrentRecipe(null);
    try {
      const result = await getRecipeSuggestion(query);
      setCurrentRecipe(result);
      if (!(result as any).error) {
        const next = [query, ...recentRecipeSearches.filter((s) => s !== query)].slice(0, 5);
        setRecentRecipeSearches(next);
        localStorage.setItem(LOCAL_STORAGE_KEYS.RECENT_RECIPE_SEARCHES, JSON.stringify(next));
      }
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setAppStatus('IDLE');
    }
  };

  const handleLogRecipe = (nutritionalInfo: NutritionalInfo) => {
    if (!isEditableLogDate) return;
    addMealToLog(nutritionalInfo, { commonMealId: 'recipe' });
    setShowRecipeModal(false);
    setToastNotification({
      message: `"${nutritionalInfo.foodItem}" loggades!`,
      type: 'success',
    });
    setTimeout(() => setToastNotification(null), 3000);
  };

  const handleIngredientImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      openModal(setShowIngredientCaptureModal);
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () =>
          setIngredientImagesForCapture((prev) => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }
    if (event.target) event.target.value = '';
  };

  const handleFindRecipesFromIngredients = async (images: string[]) => {
    setShowIngredientCaptureModal(false);
    setAppStatus('ANALYZING_INGREDIENTS');
    try {
      const base64Images = images.map((img) => img.split(',')[1]);
      const result = await getRecipesFromIngredientsImage(base64Images);
      setIngredientAnalysisResult(result);
      setShowIngredientRecipeResultsModal(true);
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setAppStatus('IDLE');
      setIsCapturingForIngredients(false);
    }
  };

  // --- Streckkod / etikett ---
  const handleBarcodeScanned = async (barcode: string) => {
    setShowBarcodeScannerModal(false);
    setAppStatus('SEARCHING_BARCODE');
    try {
      const result = await getFoodInfoFromBarcode(barcode);
      setBarcodeScanResult(result);
    } catch (e: any) {
      setToastNotification({ message: e.message, type: 'error' });
      setTimeout(() => setToastNotification(null), 3500);
    } finally {
      setAppStatus('IDLE');
    }
  };

  const handleLogFromBarcode = (nutritionalInfo: NutritionalInfo) => {
    addMealToLog(nutritionalInfo, { commonMealId: 'barcode' });
    setBarcodeScanResult(null);
  };

  const handleLogFromLabel = (info: NutritionalInfo) => {
    addMealToLog(info, { commonMealId: 'nutrition_label' });
    setShowNutritionLabelResultModal(false);
    setNutritionLabelResult(null);
  };

  // ---------- Render ----------
  return (
    <>
      <div className="space-y-3">
        {checklistState && (
          <OnboardingChecklist
            state={checklistState}
            onNavigate={onOnboardingNavigate}
            onTriggerLog={handleFabClick}
            onScrollToWater={handleScrollToWater}
          />
        )}

        {/* Daglig översikt */}
        <section
          aria-labelledby="daily-overview-heading"
          className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light"
        >
          <h2 id="daily-overview-heading" className="sr-only">
            Daglig Översikt
          </h2>
          <div className="flex items-start justify-between w-full mb-2 gap-4">
            <div className="text-center">
              <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">
                Streak
              </h3>
              <p className="text-lg font-bold text-secondary">
                {streakData.currentStreak} dagar
              </p>
              {highestStreak > 0 && highestStreak > streakData.currentStreak && (
                <p className="text-xs text-neutral mt-0.5">
                  (Rekord: {highestStreak})
                </p>
              )}
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">
                Nivå
              </h3>
              <p className="text-lg font-bold text-primary truncate" title={currentLevelName}>
                {currentLevelName}
              </p>
            </div>
            {userProfile?.goalType !== 'gain_muscle' ? (
              <div className="text-center">
                <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">
                  Sparpott
                </h3>
                <p className="text-lg font-bold text-primary">
                  {weeklyBank.bankedCalories.toFixed(0)} kcal
                </p>
              </div>
            ) : (
              <div className="text-center opacity-50">
                <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">
                  Sparpott
                </h3>
                <p className="text-lg font-bold text-neutral">Inaktiv</p>
              </div>
            )}
          </div>

          <WeeklyProgressDays
            pastDaysSummary={pastDaysSummary}
            currentAppDate={currentAppDate}
            viewingDate={viewingDate}
            onDateSelect={onDateSelect}
          />

          <p className="text-xl font-semibold text-neutral-dark text-center mt-3 -mb-1">
            {formattedViewingDate}
          </p>

          <div className="mt-4">
            <ProgressDisplay
              label="Kalorier"
              current={totalNutrients.calories}
              goal={goals.calorieGoal}
              unit="kcal"
              icon={
                <span className="text-2xl" role="img" aria-label="Kalorier">
                  🔥
                </span>
              }
              minSafeThreshold={minSafeCalories}
              bankedCaloriesAvailable={weeklyBank.bankedCalories}
              amountCoveredByBankToday={totalCaloriesCoveredByBankToday}
              goalType={userProfile?.goalType ?? 'lose_fat'}
            />
            <ProgressDisplay
              label="Protein"
              current={totalNutrients.protein}
              goal={goals.proteinGoal}
              unit="g"
              icon={
                <span className="text-2xl" role="img" aria-label="Protein">
                  💪
                </span>
              }
              minSafeThreshold={0}
              bankedCaloriesAvailable={0}
            />
            <ProgressDisplay
              label="Kolhydrater"
              current={totalNutrients.carbohydrates}
              goal={goals.carbohydrateGoal}
              unit="g"
              icon={
                <span className="text-2xl" role="img" aria-label="Kolhydrater">
                  🍞
                </span>
              }
              minSafeThreshold={0}
              bankedCaloriesAvailable={0}
            />
            <ProgressDisplay
              label="Fett"
              current={totalNutrients.fat}
              goal={goals.fatGoal}
              unit="g"
              icon={
                <span className="text-2xl" role="img" aria-label="Fett">
                  🥑
                </span>
              }
              minSafeThreshold={0}
              bankedCaloriesAvailable={0}
            />
          </div>
        </section>

        {/* Vatten */}
        <WaterLogger
          ref={waterLoggerRef}
          currentWaterMl={waterLoggedMl}
          waterGoalMl={waterGoalMl || DEFAULT_WATER_GOAL_ML}
          onLogWater={handleLogWater}
          onResetWater={handleResetWater}
          disabled={!isEditableLogDate}
        />

        {/* Vanliga val */}
        <CommonMealsList
          commonMeals={safeCommonMeals}
          onLogCommonMeal={logCommonMeal}
          onDeleteCommonMeal={deleteCommonMeal}
          onUpdateCommonMeal={handleUpdateCommonMeal}
          disabled={!isEditableLogDate}
        />

        {/* Loggade måltider */}
        <section aria-labelledby="meal-log-heading">
          <div className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
            <h3
              id="meal-log-heading"
              className="text-xl font-semibold text-neutral-dark mb-4"
            >
              Loggade måltider
            </h3>
            {groupedDailyLog.length > 0 ? (
              <div className="space-y-4">
                {groupedDailyLog.map((meal) => (
                  <MealItemCard
                    key={meal.id}
                    meal={meal}
                    onDelete={handleDeleteMeal}
                    onUpdate={handleUpdateMeal}
                    onSelectForCommonSave={handleOpenSaveCommonMealModal}
                    isReadOnly={!isEditableLogDate}
                    isNewlyAdded={false}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-neutral py-6 bg-neutral-light/50 p-6 rounded-lg">
                Inga måltider loggade än idag. Använd plus-knappen för att lägga till!
              </p>
            )}
          </div>
        </section>
      </div>

      {/* FAB */}
      {!showSpeedDial && (
        <div
          className={`fixed right-6 z-40 transition-all duration-300 ${
            isInstallBannerVisible ? 'bottom-28' : 'bottom-6'
          }`}
        >
          <button
            onClick={handleFabClick}
            className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center text-white shadow-xl hover:bg-secondary-darker active:scale-95 transform transition-all animate-scale-in"
            aria-label="Lägg till måltid"
          >
            <PlusIcon className="w-8 h-8" />
          </button>
        </div>
      )}

      {/* Speed dial */}
      {showSpeedDial && (
        <div
          className="fixed inset-0 bg-neutral-dark/60 backdrop-blur-sm z-50 flex flex-col justify-end items-end p-6 animate-fade-in"
          onClick={() => setShowSpeedDial(false)}
        >
          <div
            className="w-full max-w-sm flex flex-col items-end"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-end space-y-4 w-full mb-6">
              <div className="flex justify-end items-center gap-4 w-full">
                <button
                  onClick={() => handleAddOptionSelect('camera')}
                  className="px-4 py-2 bg-white text-neutral-dark font-semibold rounded-lg shadow-lg hover:bg-neutral-light interactive-transition"
                >
                  Fota din mat
                </button>
                <button
                  onClick={() => handleAddOptionSelect('camera')}
                  className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg hover:bg-neutral-light interactive-transition"
                >
                  <CameraIcon className="w-7 h-7" />
                </button>
              </div>
              <div className="flex justify-end items-center gap-4 w-full">
                <button
                  onClick={() => handleAddOptionSelect('recipe')}
                  className="px-4 py-2 bg-white text-neutral-dark font-semibold rounded-lg shadow-lg hover:bg-neutral-light interactive-transition"
                >
                  Recept
                </button>
                <button
                  onClick={() => handleAddOptionSelect('recipe')}
                  className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg hover:bg-neutral-light interactive-transition"
                >
                  <RecipeIcon className="w-7 h-7" />
                </button>
              </div>
              <div className="flex justify-end items-center gap-4 w-full">
                <button
                  onClick={() => handleAddOptionSelect('upload')}
                  className="px-4 py-2 bg-white text-neutral-dark font-semibold rounded-lg shadow-lg hover:bg-neutral-light interactive-transition"
                >
                  Ladda upp bild
                </button>
                <button
                  onClick={() => handleAddOptionSelect('upload')}
                  className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg hover:bg-neutral-light interactive-transition"
                >
                  <UploadIcon className="w-7 h-7" />
                </button>
              </div>
              <div className="flex justify-end items-center gap-4 w-full">
                <button
                  onClick={() => handleAddOptionSelect('barcode')}
                  className="px-4 py-2 bg-white text-neutral-dark font-semibold rounded-lg shadow-lg hover:bg-neutral-light interactive-transition"
                >
                  Skanna Streckkod
                </button>
                <button
                  onClick={() => handleAddOptionSelect('barcode')}
                  className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg hover:bg-neutral-light interactive-transition"
                >
                  <BarcodeIcon className="w-7 h-7" />
                </button>
              </div>
              <div className="flex justify-end items-center gap-4 w-full">
                <button
                  onClick={() => handleAddOptionSelect('text')}
                  className="px-4 py-2 bg-white text-neutral-dark font-semibold rounded-lg shadow-lg hover:bg-neutral-light interactive-transition"
                >
                  Sök & Logga
                </button>
                <button
                  onClick={() => handleAddOptionSelect('text')}
                  className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg hover:bg-neutral-light interactive-transition"
                >
                  <SearchIcon className="w-7 h-7" />
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowSpeedDial(false)}
              className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center text-white shadow-xl hover:bg-secondary-darker active:scale-95 transform transition-all"
            >
              <XMarkIcon className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}

      {/* Dolda inputs */}
      <input
        type="file"
        id="imageUploadInputMain"
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
      />
      <input
        type="file"
        id="ingredientUploadInput"
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleIngredientImageUpload}
      />

      {/* Modaler */}
      {showTextEntryModal && (
        <div
          className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in"
          onClick={() => closeModal(setShowTextEntryModal)}
        >
          <div onClick={(e) => e.stopPropagation()} className="animate-scale-in">
            <TextEntryModal
              show={showTextEntryModal}
              onClose={() => closeModal(setShowTextEntryModal)}
              onLog={handleLogFromModal}
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
            setToastNotification({ message: msg, type: 'error' });
          }}
        />
      )}

      {showRecipeChoiceModal && (
        <RecipeChoiceModal
          show={showRecipeChoiceModal}
          onClose={() => closeModal(setShowRecipeChoiceModal)}
          onChooseSearch={() => {
            closeModal(setShowRecipeChoiceModal);
            openModal(setShowRecipeModal);
          }}
          onChooseTakePhoto={() => {
            closeModal(setShowRecipeChoiceModal);
            setIsCapturingForIngredients(true);
            setIngredientImagesForCapture([]);
            openModal(setShowCameraModal);
          }}
          onChooseUpload={() => {
            closeModal(setShowRecipeChoiceModal);
            setIsCapturingForIngredients(true);
            setIngredientImagesForCapture([]);
            document.getElementById('ingredientUploadInput')?.click();
          }}
        />
      )}

      {showRecipeModal && (
        <RecipeModal
          show={showRecipeModal}
          onClose={() => closeModal(setShowRecipeModal)}
          onSearch={handleRecipeSearch}
          onLogRecipe={handleLogRecipe}
          recipe={currentRecipe}
          isLoading={appStatus === 'SEARCHING_RECIPE'}
          error={errorMessage}
          isLoggingDisabled={!isEditableLogDate}
          recentSearches={recentRecipeSearches}
          setToastNotification={setToastNotification}
        />
      )}

      {showIngredientCaptureModal && (
        <IngredientCaptureModal
          show={showIngredientCaptureModal}
          onClose={() => closeModal(setShowIngredientCaptureModal)}
          onFindRecipes={handleFindRecipesFromIngredients}
          openCameraModal={() => {
            closeModal(setShowIngredientCaptureModal);
            openModal(setShowCameraModal);
          }}
          images={ingredientImagesForCapture}
          onRemoveImage={(idx) =>
            setIngredientImagesForCapture((prev) => prev.filter((_, i) => i !== idx))
          }
          onUploadImages={(files) => {
            Array.from(files).forEach((f) => {
              const r = new FileReader();
              r.onload = () =>
                setIngredientImagesForCapture((p) => [...p, r.result as string]);
              r.readAsDataURL(f);
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
          onLogRecipe={handleLogRecipe}
          isLoading={appStatus === 'ANALYZING_INGREDIENTS'}
          error={errorMessage}
          isLoggingDisabled={!isEditableLogDate}
        />
      )}

      {showBarcodeScannerModal && (
        <BarcodeScannerModal
          show={showBarcodeScannerModal}
          onClose={() => closeModal(setShowBarcodeScannerModal)}
          onBarcodeScanned={handleBarcodeScanned}
          onCameraError={(msg) =>
            setToastNotification({ message: msg, type: 'error' })
          }
          onScanFallback={() => {
            closeModal(setShowBarcodeScannerModal);
            setIsCapturingForLabel(true);
            openModal(setShowCameraModal);
          }}
        />
      )}

      {barcodeScanResult && (
        <div
          className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in"
          onClick={() => setBarcodeScanResult(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="animate-scale-in">
            <BarcodeSearchResultModal
              scanResult={barcodeScanResult}
              onLog={handleLogFromBarcode}
              onClose={() => setBarcodeScanResult(null)}
            />
          </div>
        </div>
      )}

      {analysisResultForModal && (
        <div
          className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in"
          onClick={() => setAnalysisResultForModal(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="animate-scale-in">
            <ImageAnalysisResultModal
              analysisResult={analysisResultForModal}
              imageDataUrl={
                cameraImageForAnalysis
                  ? `data:image/jpeg;base64,${cameraImageForAnalysis}`
                  : undefined
              }
              onLog={handleLogFromModal}
              onClose={() => setAnalysisResultForModal(null)}
            />
          </div>
        </div>
      )}

      {showSaveCommonMealModal && mealToSaveAsCommon && (
        <div
          className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in"
          onClick={() => closeModal(setShowSaveCommonMealModal)}
        >
          <div onClick={(e) => e.stopPropagation()} className="animate-scale-in">
            <SaveCommonMealModal
              mealInfo={mealToSaveAsCommon.nutritionalInfo}
              initialName={mealToSaveAsCommon.nutritionalInfo.foodItem || ''}
              onSave={(name) => saveCommonMeal(name)}
              onClose={() => closeModal(setShowSaveCommonMealModal)}
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
          onLog={handleLogFromLabel}
        />
      )}
    </>
  );
};

export default Dashboard;
