
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useUserContext } from '../context/UserContext';
import { useOutletContext } from 'react-router-dom';
import { getDateUID } from '../utils/dateUtils';
import { LoggedMeal, NutritionalInfo, AppStatus, RecipeSuggestion, BarcodeScannedFoodInfo, IngredientRecipeResponse } from '../types';
import { deleteMealLog, updateMealLog, addCommonMeal, deleteCommonMeal, updateCommonMeal, addMealLog } from '../services/firestoreService';
import { playAudio } from '../services/audioService';
import { MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD } from '../constants';
import { analyzeFoodImage, getRecipeSuggestion, getRecipesFromIngredientsImage, analyzeNutritionLabelImage } from '../services/geminiService';
import { getFoodInfoFromBarcode } from '../services/openFoodFactsService';
import { PlusIcon, CameraIcon, RecipeIcon, UploadIcon, BarcodeIcon, SearchIcon, XMarkIcon, FireIcon, ProteinIcon, LeafIcon, SparklesIcon } from '../components/icons';
import { FileText } from 'lucide-react';

// Components
import ProgressDisplay from '../components/ProgressDisplay';
import WeeklyProgressDays from '../components/WeeklyProgressDays';
import WaterLogger from '../components/WaterLogger';
import { CommonMealsList } from '../components/CommonMealsList';
import MealItemCard from '../components/MealItemCard';
import SaveCommonMealModal from '../components/SaveCommonMealModal';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import LoadingSpinner from '../components/LoadingSpinner';
import CoinFallEffect from '../components/CoinFallEffect';

// Modals
import CameraModal from '../components/CameraModal';
import TextEntryModal from '../components/TextEntryModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import RecipeModal from '../components/RecipeModal';
import IngredientCaptureModal from '../components/IngredientCaptureModal';
import ImageAnalysisResultModal from '../components/ImageAnalysisResultModal';
import BarcodeSearchResultModal from '../components/BarcodeSearchResultModal';
import IngredientRecipeResultsModal from '../components/IngredientRecipeResultsModal';
import NutritionLabelResultModal from '../components/NutritionLabelResultModal';

interface OutletContextType {
  setShowConfetti: (v: boolean) => void;
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

const Dashboard: React.FC = () => {
    const { 
        dailyLog, setDailyLog, waterLoggedMl, setWaterLoggedMl, 
        goals, weeklyBank, setWeeklyBank, streakData, pastDaysSummary,
        currentDate, commonMeals, setCommonMeals, userProfile, currentUser, 
        userRole, userStatus, hasCompletedOnboarding, isInitialDataLoaded
    } = useUserContext();
    
    const { setShowConfetti, setToastNotification } = useOutletContext<OutletContextType>() || { setShowConfetti: () => {}, setToastNotification: () => {} };

    // Local state
    const [viewingDate, setViewingDate] = useState<Date>(currentDate);
    const [showSaveCommonMealModal, setShowSaveCommonMealModal] = useState(false);
    const [mealToSaveAsCommon, setMealToSaveAsCommon] = useState<LoggedMeal | null>(null);
    const waterLoggerRef = useRef<HTMLDivElement>(null);
    const [showBonusEffect, setShowBonusEffect] = useState(false);

    // FAB & Modal States
    const [showSpeedDial, setShowSpeedDial] = useState(false);
    const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    // Modal Visibility
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [showTextEntryModal, setShowTextEntryModal] = useState(false);
    const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState(false);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [showIngredientCaptureModal, setShowIngredientCaptureModal] = useState(false);
    
    // Analysis Results State
    const [cameraImageForAnalysis, setCameraImageForAnalysis] = useState<string | null>(null);
    const [analysisResultForModal, setAnalysisResultForModal] = useState<NutritionalInfo | null>(null);
    const [barcodeScanResult, setBarcodeScanResult] = useState<BarcodeScannedFoodInfo | null>(null);
    const [currentRecipe, setCurrentRecipe] = useState<RecipeSuggestion | null>(null);
    const [ingredientImagesForCapture, setIngredientImagesForCapture] = useState<string[]>([]);
    const [ingredientAnalysisResult, setIngredientAnalysisResult] = useState<IngredientRecipeResponse | null>(null);
    const [showIngredientRecipeResultsModal, setShowIngredientRecipeResultsModal] = useState(false);
    const [showNutritionLabelResultModal, setShowNutritionLabelResultModal] = useState(false);
    const [nutritionLabelResult, setNutritionLabelResult] = useState<NutritionalInfo | null>(null);
    
    const [isCapturingForIngredients, setIsCapturingForIngredients] = useState(false);
    const [isCapturingForLabel, setIsCapturingForLabel] = useState(false);

    // --- Computed Values ---
    const isViewingToday = useMemo(() => getDateUID(currentDate) === getDateUID(viewingDate), [currentDate, viewingDate]);
    const formattedViewingDate = useMemo(() => viewingDate.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }), [viewingDate]);
    const viewingDateUID = useMemo(() => getDateUID(viewingDate), [viewingDate]);

    const totalNutrients = useMemo(() => dailyLog.reduce((acc, meal) => ({
        calories: acc.calories + meal.nutritionalInfo.calories,
        protein: acc.protein + meal.nutritionalInfo.protein,
        carbohydrates: acc.carbohydrates + meal.nutritionalInfo.carbohydrates,
        fat: acc.fat + meal.nutritionalInfo.fat
    }), { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }), [dailyLog]);

    const minSafeCalories = useMemo(() => Math.max(goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD), [goals.calorieGoal]);
    const totalCaloriesCoveredByBankToday = useMemo(() => dailyLog.reduce((sum, meal) => sum + (meal.caloriesCoveredByBank || 0), 0), [dailyLog]);
    
    // Display data for previous days if not today
    const displayNutrients = useMemo(() => {
        if (isViewingToday) return totalNutrients;
        const summary = pastDaysSummary[viewingDateUID];
        return summary ? {
            calories: summary.consumedCalories,
            protein: summary.consumedProtein,
            carbohydrates: summary.consumedCarbohydrates,
            fat: summary.consumedFat
        } : { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };
    }, [isViewingToday, totalNutrients, pastDaysSummary, viewingDateUID]);

    const displayWater = useMemo(() => {
        if (isViewingToday) return waterLoggedMl;
        return 0; // Historical water logs not stored in summaries currently
    }, [isViewingToday, waterLoggedMl]);


    // --- Handlers ---

    const handleDateSelect = (date: Date) => setViewingDate(date);

    // Meal Management
    const handleDeleteMeal = async (mealId: string) => {
        if (!currentUser) return;
        playAudio('uiClick');
        const mealToDelete = dailyLog.find(m => m.id === mealId);
        if(mealToDelete) {
            setDailyLog(prev => prev.filter(m => m.id !== mealId));
            await deleteMealLog(currentUser.uid, mealId);
            setToastNotification({ message: 'Måltid borttagen.', type: 'success' });
        }
    };

    const handleUpdateMeal = async (mealId: string, info: NutritionalInfo) => {
        if (!currentUser) return;
        playAudio('uiClick');
        setDailyLog(prev => prev.map(m => m.id === mealId ? { ...m, nutritionalInfo: info } : m));
        await updateMealLog(currentUser.uid, mealId, info);
        setToastNotification({ message: 'Måltid uppdaterad.', type: 'success' });
    };

    const handleLogMeal = async (nutritionalInfo: NutritionalInfo, options: { saveAsCommon: boolean } = { saveAsCommon: false }) => {
        if (!currentUser) return;

        const newMeal: Omit<LoggedMeal, 'id'> = {
            nutritionalInfo,
            timestamp: Date.now(),
            dateString: getDateUID(currentDate),
            imageUrl: cameraImageForAnalysis || undefined, // Attach image if available from camera flow
        };

        try {
            const generatedId = `meal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            await addMealLog(currentUser.uid, generatedId, newMeal);
            
            const mealWithId = { ...newMeal, id: generatedId }; 
            setDailyLog(prev => [mealWithId, ...prev]);
            
            playAudio('logSuccess', 0.6);
            setToastNotification({ message: `Loggade ${nutritionalInfo.foodItem}!`, type: 'success' });

            if (options.saveAsCommon) {
                 await addCommonMeal(currentUser.uid, {
                    name: nutritionalInfo.foodItem || 'Sparad måltid',
                    nutritionalInfo: nutritionalInfo,
                    timestamp: Date.now(),
                });
                // Refresh common meals locally would require fetching or optimistic update
                // setCommonMeals(...) 
            }

            // Reset states
            setCameraImageForAnalysis(null);
            setAnalysisResultForModal(null);
            setBarcodeScanResult(null);
            setCurrentRecipe(null);
            setIngredientAnalysisResult(null);
            setNutritionLabelResult(null);
            
            // Close all modals
            setShowCameraModal(false);
            setShowTextEntryModal(false);
            setShowBarcodeScannerModal(false);
            setShowRecipeModal(false);
            setShowIngredientCaptureModal(false);
            setShowIngredientRecipeResultsModal(false);
            setShowNutritionLabelResultModal(false);
            
            setShowSpeedDial(false); // Close menu
            
        } catch (error) {
            console.error("Error logging meal:", error);
            setToastNotification({ message: 'Kunde inte spara måltid.', type: 'error' });
        }
    };
    
    // Common Meals
    const handleSaveAsCommon = (meal: LoggedMeal) => {
        setMealToSaveAsCommon(meal);
        setShowSaveCommonMealModal(true);
    };
    
    const confirmSaveCommon = async (name: string) => {
        if (!currentUser || !mealToSaveAsCommon) return;
        const newCommonMeal: Omit<LoggedMeal, 'id'> = { // Type hack, reusing LoggedMeal type for now
            ...mealToSaveAsCommon,
            nutritionalInfo: { ...mealToSaveAsCommon.nutritionalInfo, foodItem: name }
        };
        // Actually CommonMeal type is slightly different
        await addCommonMeal(currentUser.uid, {
            name: name,
            nutritionalInfo: mealToSaveAsCommon.nutritionalInfo,
            timestamp: Date.now()
        });
        setToastNotification({ message: 'Sparad som vanligt val!', type: 'success' });
        setShowSaveCommonMealModal(false);
        setMealToSaveAsCommon(null);
        // Ideally refresh common meals here
    };
    
    const handleLogCommonMeal = (commonMeal: any) => {
        handleLogMeal(commonMeal.nutritionalInfo);
    };
    
    const handleDeleteCommonMeal = async (id: string) => {
        if (!currentUser) return;
        setCommonMeals(prev => prev.filter(cm => cm.id !== id));
        await deleteCommonMeal(currentUser.uid, id);
    };

    const handleUpdateCommonMeal = async (id: string, data: { name: string; nutritionalInfo: NutritionalInfo }) => {
        if (!currentUser) return;
        setCommonMeals(prev => prev.map(cm => cm.id === id ? { ...cm, ...data } : cm));
        await updateCommonMeal(currentUser.uid, id, data);
    };

    // Water
    const handleLogWater = (amount: number) => {
        const newAmount = waterLoggedMl + amount;
        setWaterLoggedMl(newAmount);
        playAudio('waterSplash');
    };
    const handleResetWater = () => setWaterLoggedMl(0);

    // --- AI & Camera Flows ---

    const handleImageCapture = async (imageDataUrl: string) => {
        setCameraImageForAnalysis(imageDataUrl);
        setShowCameraModal(false); // Close camera, start analysis
        setAppStatus(AppStatus.ANALYZING);

        try {
            let result;
            if (isCapturingForIngredients) {
                setIngredientImagesForCapture(prev => [...prev, imageDataUrl]);
                setAppStatus(AppStatus.IDLE);
                setShowIngredientCaptureModal(true); // Re-open capture modal
                return;
            } else if (isCapturingForLabel) {
                result = await analyzeNutritionLabelImage(imageDataUrl);
                setNutritionLabelResult(result);
                setShowNutritionLabelResultModal(true);
            } else {
                // Standard food analysis
                result = await analyzeFoodImage(imageDataUrl);
                setAnalysisResultForModal(result);
                // Implicitly opens result modal via effect or conditional render if we were using one
                // But here we are using state to trigger modal rendering in the return block
            }
        } catch (error: any) {
            setErrorMessage(error.message || "Kunde inte analysera bilden.");
            setToastNotification({ message: "Analys misslyckades.", type: 'error' });
        } finally {
            setAppStatus(AppStatus.IDLE);
            setIsCapturingForIngredients(false);
            setIsCapturingForLabel(false);
        }
    };

    const handleTextSearch = async (query: string) => {
       // Handled inside TextEntryModal, but if we needed global loader:
       // setAppStatus(AppStatus.ANALYZING_TEXT);
    };

    const handleBarcodeScanned = async (barcode: string) => {
        setShowBarcodeScannerModal(false);
        setAppStatus(AppStatus.SEARCHING_BARCODE);
        try {
            const result = await getFoodInfoFromBarcode(barcode);
            setBarcodeScanResult(result);
        } catch (error: any) {
             setToastNotification({ message: error.message || "Kunde inte hitta varan.", type: 'error' });
        } finally {
            setAppStatus(AppStatus.IDLE);
        }
    };

    const handleRecipeSearch = async (query: string) => {
        // Logic handled inside RecipeModal, mostly
    };
    
    const handleIngredientsAnalysis = async (images: string[]) => {
        setShowIngredientCaptureModal(false);
        setAppStatus(AppStatus.ANALYZING_INGREDIENTS);
        try {
            const result = await getRecipesFromIngredientsImage(images);
            setIngredientAnalysisResult(result);
            setShowIngredientRecipeResultsModal(true);
        } catch (error: any) {
            setToastNotification({ message: "Kunde inte generera recept.", type: 'error' });
        } finally {
            setAppStatus(AppStatus.IDLE);
        }
    };


    // --- Render ---
    
    if (!currentUser) return null;

    return (
        <div className="space-y-6 pb-24"> {/* Added padding bottom for FAB */}
             {/* 1. Weekly Calendar */}
             <WeeklyProgressDays 
                pastDaysSummary={pastDaysSummary}
                currentAppDate={currentDate}
                viewingDate={viewingDate}
                onDateSelect={handleDateSelect}
            />
            
            {/* 2. Daily Summary Header */}
            <header className="bg-white p-5 rounded-xl shadow-soft-lg border border-neutral-light">
                <div className="flex justify-between items-center mb-4">
                     <h2 className="text-2xl font-bold text-neutral-dark capitalize">
                        {isViewingToday ? 'Idag' : formattedViewingDate}
                    </h2>
                    {!isViewingToday && (
                        <button onClick={() => setViewingDate(currentDate)} className="text-sm text-primary hover:underline">
                            Gå till idag
                        </button>
                    )}
                </div>

                {/* Progress Bars */}
                <ProgressDisplay
                    label="Kalorier"
                    current={displayNutrients.calories}
                    goal={goals.calorieGoal}
                    unit="kcal"
                    icon={<FireIcon className="w-5 h-5 text-red-500" />}
                    minSafeThreshold={minSafeCalories}
                    bankedCaloriesAvailable={weeklyBank.bankedCalories}
                    amountCoveredByBankToday={totalCaloriesCoveredByBankToday}
                    goalType={userProfile.goalType}
                />
                 <div className="grid grid-cols-3 gap-4 mt-4">
                    <ProgressDisplay
                        label="Protein"
                        current={displayNutrients.protein}
                        goal={goals.proteinGoal}
                        unit="g"
                        icon={<ProteinIcon className="w-4 h-4 text-primary" />}
                        minSafeThreshold={0}
                        bankedCaloriesAvailable={0}
                    />
                     <ProgressDisplay
                        label="Kolhydrater"
                        current={displayNutrients.carbohydrates}
                        goal={goals.carbohydrateGoal}
                        unit="g"
                        icon={<LeafIcon className="w-4 h-4 text-yellow-500" />}
                        minSafeThreshold={0}
                        bankedCaloriesAvailable={0}
                    />
                     <ProgressDisplay
                        label="Fett"
                        current={displayNutrients.fat}
                        goal={goals.fatGoal}
                        unit="g"
                        icon={<LeafIcon className="w-4 h-4 text-orange-500" />} // Reusing leaf for fat/macros generally if distinct icon not available
                        minSafeThreshold={0}
                        bankedCaloriesAvailable={0}
                    />
                 </div>
            </header>

            {/* 3. Onboarding Checklist (only if needed) */}
            {!hasCompletedOnboarding && isInitialDataLoaded && isViewingToday && (
                 <OnboardingChecklist 
                    state={{ firstSeenDate: '2024-01-01', items: { mealLogged: dailyLog.length > 0, waterLogged: waterLoggedMl > 0, journeyViewed: false, communityViewed: false }, dismissed: false }}
                    onNavigate={() => {}}
                    onTriggerLog={() => { setShowSpeedDial(true); }}
                    onScrollToWater={() => waterLoggerRef.current?.scrollIntoView({ behavior: 'smooth' })}
                 />
            )}

            {/* 4. Meals List */}
            <section aria-label="Loggade måltider" className="space-y-4">
                <h3 className="text-xl font-semibold text-neutral-dark px-1">Loggade måltider</h3>
                 {isViewingToday && dailyLog.length === 0 && (
                     <div className="text-center py-10 bg-white/50 rounded-xl border-dashed border-2 border-neutral-light">
                         <p className="text-neutral font-medium">Inga måltider loggade idag än.</p>
                         <button onClick={() => setShowSpeedDial(true)} className="mt-2 text-primary font-semibold hover:underline">
                             Logga din frukost nu!
                         </button>
                     </div>
                 )}
                 
                 {[...dailyLog].reverse().map((meal) => (
                     <MealItemCard
                        key={meal.id}
                        meal={meal}
                        onDelete={handleDeleteMeal}
                        onUpdate={handleUpdateMeal}
                        onSelectForCommonSave={handleSaveAsCommon}
                        isReadOnly={!isViewingToday}
                     />
                 ))}
            </section>

            {/* 5. Common Meals (Only visible today) */}
            {isViewingToday && (
                <CommonMealsList
                    commonMeals={commonMeals}
                    onLogCommonMeal={handleLogCommonMeal}
                    onDeleteCommonMeal={handleDeleteCommonMeal}
                    onUpdateCommonMeal={handleUpdateCommonMeal}
                />
            )}

            {/* 6. Water Logger */}
            <WaterLogger
                ref={waterLoggerRef}
                currentWaterMl={displayWater}
                waterGoalMl={2000}
                onLogWater={(amount) => isViewingToday && handleLogWater(amount)}
                onResetWater={() => isViewingToday && handleResetWater()}
                disabled={!isViewingToday}
            />
            
            {/* 7. FAB & Speed Dial (Only on Dashboard) */}
            {isViewingToday && (
                <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end space-y-3">
                    {/* Speed Dial Menu */}
                    <div className={`transition-all duration-200 flex flex-col items-end space-y-3 ${showSpeedDial ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'}`}>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-white bg-black/70 px-2 py-1 rounded shadow-sm backdrop-blur-sm">Kamera</span>
                            <button onClick={() => { playAudio('uiClick'); setShowCameraModal(true); setShowSpeedDial(false); }} className="w-12 h-12 bg-white text-neutral-dark rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform">
                                <CameraIcon className="w-6 h-6 text-primary" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-white bg-black/70 px-2 py-1 rounded shadow-sm backdrop-blur-sm">Sök text</span>
                            <button onClick={() => { playAudio('uiClick'); setShowTextEntryModal(true); setShowSpeedDial(false); }} className="w-12 h-12 bg-white text-neutral-dark rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform">
                                <SearchIcon className="w-6 h-6 text-secondary" />
                            </button>
                        </div>
                         <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-white bg-black/70 px-2 py-1 rounded shadow-sm backdrop-blur-sm">Streckkod</span>
                            <button onClick={() => { playAudio('uiClick'); setShowBarcodeScannerModal(true); setShowSpeedDial(false); }} className="w-12 h-12 bg-white text-neutral-dark rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform">
                                <BarcodeIcon className="w-6 h-6 text-accent" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-white bg-black/70 px-2 py-1 rounded shadow-sm backdrop-blur-sm">Recept</span>
                            <button onClick={() => { playAudio('uiClick'); setShowRecipeModal(true); setShowSpeedDial(false); }} className="w-12 h-12 bg-white text-neutral-dark rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform">
                                <RecipeIcon className="w-6 h-6 text-purple-600" />
                            </button>
                        </div>
                         <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-white bg-black/70 px-2 py-1 rounded shadow-sm backdrop-blur-sm">Skafferi</span>
                             <button onClick={() => { playAudio('uiClick'); setIsCapturingForIngredients(true); setShowIngredientCaptureModal(true); setShowSpeedDial(false); }} className="w-12 h-12 bg-white text-neutral-dark rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform">
                                <SparklesIcon className="w-6 h-6 text-amber-500" />
                            </button>
                        </div>
                    </div>

                    {/* Main FAB */}
                    <button
                        onClick={() => { playAudio('uiClick'); setShowSpeedDial(!showSpeedDial); }}
                        className={`w-16 h-16 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 ${showSpeedDial ? 'bg-neutral-dark rotate-45' : 'bg-primary hover:bg-primary-darker hover:scale-105 active:scale-95'}`}
                        aria-label={showSpeedDial ? "Stäng meny" : "Logga mat"}
                    >
                        <PlusIcon className="w-8 h-8" />
                    </button>
                </div>
            )}
            
            {/* --- MODALS --- */}
            
            {/* Camera */}
            <CameraModal 
                show={showCameraModal} 
                onClose={() => setShowCameraModal(false)}
                onImageCapture={handleImageCapture}
                onCameraError={(msg) => setToastNotification({ message: msg, type: 'error' })}
                instructionText={isCapturingForLabel ? "Fota näringsdeklarationen" : "Fota din måltid"}
            />

            {/* Analysis Result (Single Image) */}
            {analysisResultForModal && cameraImageForAnalysis && (
                 <ImageAnalysisResultModal
                    analysisResult={analysisResultForModal}
                    imageDataUrl={`data:image/jpeg;base64,${cameraImageForAnalysis}`}
                    onLog={handleLogMeal}
                    onClose={() => { setAnalysisResultForModal(null); setCameraImageForAnalysis(null); }}
                />
            )}

            {/* Text Entry */}
            <TextEntryModal
                show={showTextEntryModal}
                onClose={() => setShowTextEntryModal(false)}
                onLog={handleLogMeal}
            />

            {/* Barcode Scanner */}
            <BarcodeScannerModal 
                show={showBarcodeScannerModal}
                onClose={() => setShowBarcodeScannerModal(false)}
                onBarcodeScanned={handleBarcodeScanned}
                onCameraError={(msg) => setToastNotification({ message: msg, type: 'error' })}
                onScanFallback={() => { setShowBarcodeScannerModal(false); setIsCapturingForLabel(true); setShowCameraModal(true); }}
            />
            
            {/* Barcode Result */}
            {barcodeScanResult && (
                <BarcodeSearchResultModal
                    scanResult={barcodeScanResult}
                    onLog={handleLogMeal}
                    onClose={() => setBarcodeScanResult(null)}
                />
            )}
            
            {/* Nutrition Label Result */}
            <NutritionLabelResultModal
                show={showNutritionLabelResultModal}
                onClose={() => setShowNutritionLabelResultModal(false)}
                analysisResult={nutritionLabelResult || { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }}
                onLog={(info) => { handleLogMeal(info); setShowNutritionLabelResultModal(false); }}
            />

            {/* Recipe Search */}
            <RecipeModal
                show={showRecipeModal}
                onClose={() => setShowRecipeModal(false)}
                onSearch={async (q) => {
                     setAppStatus(AppStatus.ANALYZING_TEXT);
                     try {
                         const res = await getRecipeSuggestion(q);
                         setCurrentRecipe(res);
                     } catch(e) { setToastNotification({message: "Kunde inte hitta recept", type: 'error'}); }
                     finally { setAppStatus(AppStatus.IDLE); }
                }}
                onLogRecipe={(info) => { handleLogMeal(info); setShowRecipeModal(false); }}
                recipe={currentRecipe}
                isLoading={appStatus === AppStatus.ANALYZING_TEXT}
                error={null}
                recentSearches={[]}
                setToastNotification={setToastNotification}
                isLoggingDisabled={!isViewingToday}
            />

            {/* Ingredient Capture (Pantry) */}
            <IngredientCaptureModal
                show={showIngredientCaptureModal}
                onClose={() => setShowIngredientCaptureModal(false)}
                onFindRecipes={handleIngredientsAnalysis}
                openCameraModal={() => { setIsCapturingForIngredients(true); setShowCameraModal(true); }}
                images={ingredientImagesForCapture.map(b64 => `data:image/jpeg;base64,${b64}`)}
                onRemoveImage={(idx) => setIngredientImagesForCapture(prev => prev.filter((_, i) => i !== idx))}
                onUploadImages={async (files) => {
                    // Helper to convert file to base64 - simplified for brevity
                    const toBase64 = (file: File) => new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
                        reader.readAsDataURL(file);
                    });
                    for(let i=0; i<files.length; i++) {
                        const b64 = await toBase64(files[i]);
                        setIngredientImagesForCapture(prev => [...prev, b64]);
                    }
                }}
            />
            
            {/* Ingredient Results */}
            <IngredientRecipeResultsModal
                show={showIngredientRecipeResultsModal}
                onClose={() => setShowIngredientRecipeResultsModal(false)}
                identifiedIngredients={ingredientAnalysisResult?.identifiedIngredients || []}
                recipeSuggestions={ingredientAnalysisResult?.recipeSuggestions || []}
                onLogRecipe={(info) => { handleLogMeal(info); setShowIngredientRecipeResultsModal(false); }}
                isLoading={appStatus === AppStatus.ANALYZING_INGREDIENTS}
                error={null}
                isLoggingDisabled={!isViewingToday}
            />

            {/* Save Common Meal */}
            {showSaveCommonMealModal && mealToSaveAsCommon && (
                <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
                     <SaveCommonMealModal
                        mealInfo={mealToSaveAsCommon.nutritionalInfo}
                        initialName={mealToSaveAsCommon.nutritionalInfo.foodItem || ''}
                        onSave={confirmSaveCommon}
                        onClose={() => { setShowSaveCommonMealModal(false); setMealToSaveAsCommon(null); }}
                     />
                </div>
            )}

            {/* Global Loader */}
            {appStatus !== AppStatus.IDLE && !showRecipeModal && !showIngredientRecipeResultsModal && (
                 <LoadingSpinner message={
                     appStatus === AppStatus.ANALYZING ? "Analyserar mat..." :
                     appStatus === AppStatus.ANALYZING_TEXT ? "Söker..." :
                     appStatus === AppStatus.ANALYZING_INGREDIENTS ? "Skapar recept..." :
                     appStatus === AppStatus.SEARCHING_BARCODE ? "Hämtar produkt..." : "Laddar..."
                 } />
            )}
            
            {showBonusEffect && <CoinFallEffect targetX={window.innerWidth - 40} targetY={window.innerHeight - 40} onComplete={() => setShowBonusEffect(false)} />}

        </div>
    );
};

export default Dashboard;
