import React, { useState, useEffect, useMemo } from 'react';
import { Peppkompis, LoggedMeal, GoalSettings, UserProfileData } from '../types';
import { fetchBuddyDailyData } from '../services/firestoreService';
import LoadingSpinner from './LoadingSpinner';
import ProgressDisplay from './ProgressDisplay';
import MealItemCard from './MealItemCard';
import WaterLogger from './WaterLogger';
import { FireIcon, ProteinIcon, LeafIcon, XMarkIcon, ArrowLeftIcon, ArrowRightIcon } from './icons';
import { MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD, DEFAULT_WATER_GOAL_ML } from '../constants';

const getDateUID = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface BuddyLogViewProps {
    buddy: Peppkompis;
    onClose: () => void;
}

const BuddyLogView: React.FC<BuddyLogViewProps> = ({ buddy, onClose }) => {
    const [viewingDate, setViewingDate] = useState(new Date());
    const [dailyData, setDailyData] = useState<{ meals: LoggedMeal[]; water: number; goals: GoalSettings; profile: UserProfileData; } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const dateUID = getDateUID(viewingDate);
                const data = await fetchBuddyDailyData(buddy.uid, dateUID);
                setDailyData(data);
            } catch (err: any) {
                setError(err.message || 'Kunde inte ladda kompisens data.');
                setDailyData(null);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [buddy.uid, viewingDate]);
    
    const changeDate = (offset: number) => {
        setViewingDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setDate(newDate.getDate() + offset);
            return newDate;
        });
    };
    
    const isViewingToday = useMemo(() => getDateUID(viewingDate) === getDateUID(new Date()), [viewingDate]);

    const totalNutrients = useMemo(() => {
        return dailyData?.meals.reduce(
            (acc, meal) => {
                acc.calories += meal.nutritionalInfo.calories;
                acc.protein += meal.nutritionalInfo.protein;
                acc.carbohydrates += meal.nutritionalInfo.carbohydrates;
                acc.fat += meal.nutritionalInfo.fat;
                return acc;
            },
            { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
        ) || { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };
    }, [dailyData]);

    const minSafeCalories = useMemo(() => {
        if (!dailyData) return 0;
        const goalBasedMin = dailyData.goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
        return Math.max(goalBasedMin, MIN_ABSOLUTE_CALORIES_THRESHOLD);
    }, [dailyData]);

    return (
        <div className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-light/70 flex-shrink-0">
                    <div>
                        <h2 id="buddy-log-view-title" className="text-2xl font-semibold text-neutral-dark">
                            {buddy.name}s Logg
                        </h2>
                         <div className="flex items-center mt-2 gap-2">
                            <button onClick={() => changeDate(-1)} className="p-1 rounded-full hover:bg-neutral-light"><ArrowLeftIcon className="w-5 h-5" /></button>
                            <span className="font-semibold text-neutral-dark">{viewingDate.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                            <button onClick={() => changeDate(1)} disabled={isViewingToday} className="p-1 rounded-full hover:bg-neutral-light disabled:opacity-50"><ArrowRightIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90" aria-label="Stäng">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="flex-grow overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full"><LoadingSpinner message="Laddar data..." /></div>
                    ) : error ? (
                        <p className="text-center text-red-500">{error}</p>
                    ) : dailyData ? (
                        <div className="space-y-4">
                            <ProgressDisplay
                                label="Kalorier"
                                current={totalNutrients.calories}
                                goal={dailyData.goals.calorieGoal}
                                unit="kcal"
                                icon={<span role="img" aria-label="Kalorier">🔥</span>}
                                minSafeThreshold={minSafeCalories}
                                bankedCaloriesAvailable={0} // Can't see buddy's bank
                                amountCoveredByBankToday={0}
                            />
                            <ProgressDisplay
                                label="Protein"
                                current={totalNutrients.protein}
                                goal={dailyData.goals.proteinGoal}
                                unit="g"
                                icon={<span role="img" aria-label="Protein">💪</span>}
                                minSafeThreshold={0}
                                bankedCaloriesAvailable={0}
                            />
                            <WaterLogger
                                currentWaterMl={dailyData.water}
                                waterGoalMl={DEFAULT_WATER_GOAL_ML}
                                onLogWater={() => {}}
                                onResetWater={() => {}}
                                disabled={true}
                            />
                            <h3 className="text-lg font-semibold pt-2">Loggade måltider</h3>
                            {dailyData.meals.length > 0 ? (
                                dailyData.meals.map(meal => (
                                    <MealItemCard
                                        key={meal.id}
                                        meal={meal}
                                        onDelete={() => {}}
                                        onUpdate={() => {}}
                                        onSelectForCommonSave={() => {}}
                                        isReadOnly={true}
                                    />
                                ))
                            ) : (
                                <p className="text-neutral text-center py-4">Inga måltider loggade denna dag.</p>
                            )}
                        </div>
                    ) : (
                         <p className="text-neutral text-center py-4">Ingen data för denna dag.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BuddyLogView;
