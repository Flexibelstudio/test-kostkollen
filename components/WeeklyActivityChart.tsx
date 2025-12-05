
import React from 'react';
import { PastDaysSummaryCollection } from '../types';
import { Dumbbell } from 'lucide-react';

interface DailyStats {
    calories: number;
    calorieGoal: number;
    proteinGoalMet: boolean;
    waterGoalMet: boolean;
}

interface WeeklyActivityChartProps {
  pastDaysSummary: PastDaysSummaryCollection;
  currentAppDate: Date;
  viewingDate: Date;
  onDateSelect: (date: Date) => void;
  currentViewStats?: DailyStats; // Live stats for the actively viewed day
}

const getLocalISODateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const WeeklyActivityChart: React.FC<WeeklyActivityChartProps> = ({
  pastDaysSummary,
  currentAppDate,
  viewingDate,
  onDateSelect,
  currentViewStats,
}) => {
  const today = new Date(currentAppDate);
  today.setHours(0, 0, 0, 0);

  // Calculate current week (Monday to Sunday)
  const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    weekDays.push(day);
  }

  const todayISO = getLocalISODateString(today);
  const viewingDateISO = getLocalISODateString(viewingDate);

  return (
    <div className="bg-white p-5 rounded-3xl shadow-soft-xl border border-neutral-light">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-neutral-dark">Veckoaktivitet</h3>
      </div>
      
      <div className="flex justify-between items-end h-28 gap-2 sm:gap-4 relative z-10 px-1">
          {weekDays.map(day => {
            const dayISO = getLocalISODateString(day);
            const isFutureDay = day > today;
            const isToday = dayISO === todayISO;
            const isViewing = dayISO === viewingDateISO;
            
            // Determine data source: Use live stats if viewing, otherwise historical summary
            let calories = 0;
            let calorieGoal = 2000;
            let proteinGoalMet = false;
            let waterGoalMet = false;

            if (isViewing && currentViewStats) {
                calories = currentViewStats.calories;
                calorieGoal = currentViewStats.calorieGoal;
                proteinGoalMet = currentViewStats.proteinGoalMet;
                waterGoalMet = currentViewStats.waterGoalMet;
            } else {
                const summary = pastDaysSummary[dayISO];
                if (summary) {
                    calories = summary.consumedCalories;
                    calorieGoal = summary.calorieGoal;
                    proteinGoalMet = summary.proteinGoalMet;
                    waterGoalMet = summary.waterGoalMet || false;
                }
            }
            
            const dayLabel = day.toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '').charAt(0).toUpperCase();
            
            // Logic for visual
            const isOverGoal = calories > calorieGoal;
            const hasLog = calories > 0;
            const surplus = Math.max(0, calories - calorieGoal);
            
            // Height calculation: Cap visual at 100%
            let heightPercentage = 0;
            if (calorieGoal > 0) {
                heightPercentage = Math.min((calories / calorieGoal) * 100, 100);
            }

            // Colors
            let barColor = 'bg-neutral-100'; // Default gray/empty
            if (hasLog) {
                barColor = isOverGoal ? 'bg-secondary' : 'bg-primary';
            }

            // Water indicator: Blue letter if goal met
            const dayLabelColor = waterGoalMet ? 'text-blue-500 font-bold' : (isViewing ? 'text-neutral-dark font-bold' : 'text-neutral');

            return (
                <button
                    key={dayISO}
                    onClick={() => !isFutureDay && onDateSelect(day)}
                    disabled={isFutureDay}
                    className={`group flex flex-col items-center justify-end w-full h-full relative focus:outline-none transition-transform active:scale-95 ${isFutureDay ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
                >
                    <div className="relative w-full flex flex-col items-center justify-end h-full pb-6">
                        {/* Surplus Text */}
                        {isOverGoal && (
                            <span className="absolute -top-6 text-[10px] sm:text-xs font-bold text-secondary animate-fade-in">
                                +{surplus.toFixed(0)}
                            </span>
                        )}

                        {/* Bar Track */}
                        <div className={`w-full max-w-[24px] sm:max-w-[32px] h-full bg-neutral-light/40 rounded-full relative overflow-hidden flex flex-col-reverse justify-start ${isViewing ? 'ring-2 ring-offset-2 ring-primary/30' : ''}`}>
                            {/* Filled Bar */}
                            <div 
                                className={`w-full ${barColor} rounded-full transition-all duration-700 ease-out relative`} 
                                style={{ height: `${heightPercentage}%` }}
                            >
                                {/* Protein Icon inside bar (only if logged and protein met) */}
                                {proteinGoalMet && hasLog && (
                                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-full flex justify-center">
                                        <Dumbbell className="w-3 h-3 sm:w-4 sm:h-4 text-white drop-shadow-sm" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Day Label (Water Indicator) */}
                    <div className="absolute bottom-0 text-center w-full">
                        <span className={`block text-xs sm:text-sm ${dayLabelColor} transition-colors`}>
                            {dayLabel}
                        </span>
                        {/* Today dot indicator if not viewing water met (to keep track of today) */}
                        {isToday && !waterGoalMet && (
                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-neutral-dark rounded-full"></div>
                        )}
                    </div>
                </button>
            );
          })}
      </div>
    </div>
  );
};

export default WeeklyActivityChart;
