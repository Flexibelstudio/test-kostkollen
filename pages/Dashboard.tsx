import React, { useMemo } from 'react';
import { 
    PastDaysSummaryCollection, 
    LoggedMeal, 
    UserProfileData, 
    GoalSettings, 
    WeeklyCalorieBank, 
    Level,
    OnboardingChecklistState,
    CommonMeal,
    NutritionalInfo
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
    COMMON_MEAL_LOG_ICON_SVG
} from '../constants';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import WeeklyProgressDays from '../components/WeeklyProgressDays';
import ProgressDisplay from '../components/ProgressDisplay';
import WaterLogger from '../components/WaterLogger';
import { CommonMealsList } from '../components/CommonMealsList';
import MealItemCard from '../components/MealItemCard';
import { PlusIcon, CameraIcon, RecipeIcon, UploadIcon, BarcodeIcon, SearchIcon, XMarkIcon } from '../components/icons';

interface DashboardProps {
    checklistState: OnboardingChecklistState | null;
    onOnboardingNavigate: (view: 'journey' | 'community', subView?: 'search') => void;
    onTriggerLog: () => void;
    onScrollToWater: () => void;
    waterLoggerRef: React.RefObject<HTMLDivElement>;
    
    streakData: { currentStreak: number };
    highestStreak: number;
    currentLevel: Level;
    userProfile: UserProfileData;
    weeklyBank: WeeklyCalorieBank;
    
    pastDaysSummary: PastDaysSummaryCollection;
    currentAppDate: Date;
    viewingDate: Date;
    onDateSelect: (date: Date) => void;
    formattedViewingDate: string;
    
    dailyLog: LoggedMeal[];
    goals: GoalSettings;
    
    waterLoggedMl: number;
    waterGoalMl: number;
    onLogWater: (amountMl: number, event: React.MouseEvent<HTMLButtonElement>) => void;
    onResetWater: () => void;
    isEditableLogDate: boolean;
    
    commonMeals: CommonMeal[];
    onLogCommonMeal: (commonMeal: CommonMeal) => void;
    onDeleteCommonMeal: (id: string) => void;
    onUpdateCommonMeal: (id: string, data: { name: string; nutritionalInfo: NutritionalInfo }) => void;
    
    onDeleteMeal: (id: string) => void;
    onUpdateMeal: (id: string, info: NutritionalInfo) => void;
    onOpenSaveCommonMealModal: (meal: LoggedMeal) => void;
    
    showSpeedDial: boolean;
    onToggleSpeedDial: () => void;
    onAddOptionSelect: (option: 'camera' | 'upload' | 'text' | 'recipe' | 'barcode') => void;
    
    showSpotlight: boolean;
    onDismissSpotlight: () => void;
    isInstallBannerVisible: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
    checklistState,
    onOnboardingNavigate,
    onTriggerLog,
    onScrollToWater,
    waterLoggerRef,
    streakData,
    highestStreak,
    currentLevel,
    userProfile,
    weeklyBank,
    pastDaysSummary,
    currentAppDate,
    viewingDate,
    onDateSelect,
    formattedViewingDate,
    dailyLog,
    goals,
    waterLoggedMl,
    waterGoalMl,
    onLogWater,
    onResetWater,
    isEditableLogDate,
    commonMeals,
    onLogCommonMeal,
    onDeleteCommonMeal,
    onUpdateCommonMeal,
    onDeleteMeal,
    onUpdateMeal,
    onOpenSaveCommonMealModal,
    showSpeedDial,
    onToggleSpeedDial,
    onAddOptionSelect,
    showSpotlight,
    onDismissSpotlight,
    isInstallBannerVisible
}) => {

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
        if (dailyLog.length === 0) {
          return [];
        }
    
        const commonMealGroups = new Map<string, LoggedMeal[]>();
        const otherMeals: LoggedMeal[] = [];
    
        // Separate common meals from others
        for (const meal of dailyLog) {
          if (meal.commonMealId && !['manual', 'text_search', 'recipe', 'ingredient_recipe', 'barcode', 'nutrition_label'].includes(meal.commonMealId)) {
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
    
            const totalNutritionalInfo = sortedGroup.reduce((acc, meal) => {
              acc.calories += meal.nutritionalInfo.calories;
              acc.protein += meal.nutritionalInfo.protein;
              acc.carbohydrates += meal.nutritionalInfo.carbohydrates;
              acc.fat += meal.nutritionalInfo.fat;
              return acc;
            }, { 
              calories: 0, protein: 0, carbohydrates: 0, fat: 0, 
              foodItem: representativeMeal.nutritionalInfo.foodItem 
            });
    
            processedMeals.push({
              ...representativeMeal,
              nutritionalInfo: totalNutritionalInfo,
              count: sortedGroup.length,
              originalIds: sortedGroup.map(m => m.id),
            });
          } else {
            processedMeals.push(...group);
          }
        }
    
        return processedMeals.sort((a, b) => b.timestamp - a.timestamp);
    
      }, [dailyLog]);

    return (
        <>
            <div className="space-y-3">
              {checklistState && (
                <OnboardingChecklist 
                    state={checklistState}
                    onNavigate={onOnboardingNavigate}
                    onTriggerLog={onTriggerLog}
                    onScrollToWater={onScrollToWater}
                />
              )}
              <section aria-labelledby="daily-overview-heading" className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
                <h2 id="daily-overview-heading" className="sr-only">Daglig Översikt</h2>
                <div className="flex items-start justify-between w-full mb-2 gap-4">
                    <div className="text-center">
                        <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">Streak</h3>
                        <p className="text-lg font-bold text-secondary">{streakData.currentStreak} dagar</p>
                        {highestStreak > 0 && highestStreak > streakData.currentStreak && (
                            <p className="text-xs text-neutral mt-0.5">(Rekord: {highestStreak})</p>
                        )}
                    </div>
                    <div className="text-center">
                        <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">Nivå</h3>
                        <p className="text-lg font-bold text-primary truncate" title={currentLevel.name}>{currentLevel.name}</p>
                    </div>
                    {userProfile?.goalType !== 'gain_muscle' ? (
                        <div className="text-center">
                            <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">Sparpott</h3>
                            <p className="text-lg font-bold text-primary">{weeklyBank.bankedCalories.toFixed(0)} kcal</p>
                        </div>
                    ) : (
                        <div className="text-center opacity-50">
                            <h3 className="text-base font-semibold text-neutral-dark whitespace-nowrap">Sparpott</h3>
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
                 <p className="text-xl font-semibold text-neutral-dark text-center mt-3 -mb-1">{formattedViewingDate}</p>

                 <div className="mt-4">
                  <ProgressDisplay
                      label="Kalorier"
                      current={totalNutrients.calories}
                      goal={goals.calorieGoal}
                      unit="kcal"
                      icon={<span className="text-2xl" role="img" aria-label="Kalorier">🔥</span>}
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
                    icon={<span className="text-2xl" role="img" aria-label="Protein">💪</span>}
                    minSafeThreshold={0} bankedCaloriesAvailable={0} 
                  />
                  <ProgressDisplay
                    label="Kolhydrater"
                    current={totalNutrients.carbohydrates}
                    goal={goals.carbohydrateGoal}
                    unit="g"
                    icon={<span className="text-2xl" role="img" aria-label="Kolhydrater">🍞</span>}
                    minSafeThreshold={0} bankedCaloriesAvailable={0} 
                  />
                  <ProgressDisplay
                    label="Fett"
                    current={totalNutrients.fat}
                    goal={goals.fatGoal}
                    unit="g"
                    icon={<span className="text-2xl" role="img" aria-label="Fett">🥑</span>}
                    minSafeThreshold={0} bankedCaloriesAvailable={0} 
                  />
                </div>
              </section>
            
              <WaterLogger 
                ref={waterLoggerRef}
                currentWaterMl={waterLoggedMl} 
                waterGoalMl={waterGoalMl} 
                onLogWater={onLogWater}
                onResetWater={onResetWater}
                disabled={!isEditableLogDate}
              />
              <CommonMealsList
                commonMeals={commonMeals}
                onLogCommonMeal={onLogCommonMeal}
                onDeleteCommonMeal={onDeleteCommonMeal}
                onUpdateCommonMeal={onUpdateCommonMeal}
                disabled={!isEditableLogDate}
              />

              <section aria-labelledby="meal-log-heading">
                <div className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
                    <h3 id="meal-log-heading" className="text-xl font-semibold text-neutral-dark mb-4">
                    Loggade måltider
                    </h3>
                    {groupedDailyLog.length > 0 ? (
                    <div className="space-y-4">
                        {groupedDailyLog.map((meal) => (
                        <MealItemCard
                            key={meal.id}
                            meal={meal}
                            onDelete={onDeleteMeal}
                            onUpdate={onUpdateMeal}
                            onSelectForCommonSave={onOpenSaveCommonMealModal}
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

            {showSpotlight && (
                <div 
                    className="fixed inset-0 z-40 animate-fade-in"
                    style={{ background: `radial-gradient(circle at calc(100vw - 56px) calc(100vh - 56px), transparent 36px, rgba(0,0,0,0.7) 37px)`}}
                    onClick={onDismissSpotlight}
                >
                    <div className="absolute w-64 p-4 bg-white rounded-lg shadow-xl animate-fade-slide-in" style={{ bottom: '104px', right: '32px'}}>
                    <p className="text-neutral-dark font-medium">Här loggar du allt! Prova att fota din första måltid.</p>
                    <div className="absolute -bottom-2 right-4 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-white" />
                    </div>
                </div>
            )}
        
        {!showSpeedDial && (
          <div className={`fixed right-6 z-40 transition-all duration-300 ${isInstallBannerVisible ? 'bottom-28' : 'bottom-6'}`}>
            <button
              onClick={onToggleSpeedDial}
              className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center text-white shadow-xl hover:bg-secondary-darker active:scale-95 transform transition-all animate-scale-in"
              aria-label="Lägg till måltid"
              aria-haspopup="true"
              aria-expanded="false"
              disabled={!isEditableLogDate}
            >
              <PlusIcon className="w-8 h-8" />
            </button>
          </div>
        )}
        
        {showSpeedDial && (
            <div
                className="fixed inset-0 bg-neutral-dark/60 backdrop-blur-sm z-50 flex flex-col justify-end items-end p-6 animate-fade-in"
                onClick={onToggleSpeedDial}
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-food-heading"
            >
                <div className="w-full max-w-sm flex flex-col items-end" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-col items-end space-y-4 w-full mb-6">
                        <div className="flex justify-end items-center gap-4 w-full">
                            <button onClick={() => onAddOptionSelect('camera')} className="px-4 py-2 bg-white text-neutral-dark font-semibold rounded-lg shadow-lg hover:bg-neutral-light interactive-transition">Fota din mat</button>
                            <button onClick={() => onAddOptionSelect('camera')} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg hover:bg-neutral-light interactive-transition" title="Fota din mat"><CameraIcon className="w-7 h-7" /></button>
                        </div>
                        <div className="flex justify-end items-center gap-4 w-full">
                            <button onClick={() => onAddOptionSelect('recipe')} className="px-4 py-2 bg-white text-neutral-dark font-semibold rounded-lg shadow-lg hover:bg-neutral-light interactive-transition">Hitta Recept</button>
                            <button onClick={() => onAddOptionSelect('recipe')} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg hover:bg-neutral-light interactive-transition" title="Hitta Recept"><RecipeIcon className="w-7 h-7" /></button>
                        </div>
                        <div className="flex justify-end items-center gap-4 w-full">
                            <button onClick={() => onAddOptionSelect('upload')} className="px-4 py-2 bg-white text-neutral-dark font-semibold rounded-lg shadow-lg hover:bg-neutral-light interactive-transition">Ladda upp matbild</button>
                            <button onClick={() => onAddOptionSelect('upload')} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg hover:bg-neutral-light interactive-transition" title="Ladda upp matbild"><UploadIcon className="w-7 h-7" /></button>
                        </div>
                        <div className="flex justify-end items-center gap-4 w-full">
                            <button onClick={() => onAddOptionSelect('barcode')} className="px-4 py-2 bg-white text-neutral-dark font-semibold rounded-lg shadow-lg hover:bg-neutral-light interactive-transition">Skanna Streckkod</button>
                            <button onClick={() => onAddOptionSelect('barcode')} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg hover:bg-neutral-light interactive-transition" title="Skanna Streckkod"><BarcodeIcon className="w-7 h-7" /></button>
                        </div>
                        <div className="flex justify-end items-center gap-4 w-full">
                            <button onClick={() => onAddOptionSelect('text')} className="px-4 py-2 bg-white text-neutral-dark font-semibold rounded-lg shadow-lg hover:bg-neutral-light interactive-transition">Sök & Logga</button>
                            <button onClick={() => onAddOptionSelect('text')} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-neutral-dark shadow-lg hover:bg-neutral-light interactive-transition" title="Sök & Logga"><SearchIcon className="w-7 h-7" /></button>
                        </div>
                    </div>
                    <button
                        onClick={onToggleSpeedDial}
                        className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center text-white shadow-xl hover:bg-secondary-darker active:scale-95 transform transition-all"
                        aria-label="Stäng"
                    >
                        <XMarkIcon className="w-8 h-8"/>
                    </button>
                </div>
            </div>
        )}
        </>
    );
};

export default Dashboard;