
import React, { useMemo } from 'react';
import { PastDaysSummaryCollection } from '../types';
import { Dumbbell, Leaf } from 'lucide-react';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';
import { getISOWeekNumber } from '../utils/dateUtils';
import { MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, FIBER_DAILY_TARGET_GRAMS } from '../constants';

interface DailyStats {
    calories: number;
    calorieGoal: number;
    proteinGoalMet: boolean;
    waterGoalMet: boolean;
    goalMet: boolean;
    fiberGoalMet?: boolean;
}

interface WeeklyActivityChartProps {
  pastDaysSummary: PastDaysSummaryCollection;
  currentAppDate: Date;
  viewingDate: Date;
  onDateSelect: (date: Date) => void;
  currentViewStats?: DailyStats; // Live stats for currently viewed day
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  goalType?: string;
  isSummarizingYesterday?: boolean;
  bankedCalories?: number; // Tillagt för att kunna räkna ut färg live
  isBootcamp?: boolean;
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
  onPrevWeek,
  onNextWeek,
  onToday,
  isSummarizingYesterday = false,
  bankedCalories = 0,
  isBootcamp = false
}) => {
  const referenceDate = new Date(viewingDate);
  referenceDate.setHours(0, 0, 0, 0);

  const dayOfWeek = referenceDate.getDay(); 
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() + mondayOffset);

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    weekDays.push(day);
  }

  const today = new Date(currentAppDate);
  today.setHours(0, 0, 0, 0);
  const viewingDateISO = getLocalISODateString(viewingDate);
  
  const yesterday = new Date(currentAppDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = getLocalISODateString(yesterday);
  
  const currentWeekMonday = new Date(today);
  const currentDayOfWeek = currentWeekMonday.getDay();
  const currentMondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  currentWeekMonday.setDate(currentWeekMonday.getDate() + currentMondayOffset);
  
  const isCurrentWeek = monday.getTime() === currentWeekMonday.getTime();
  const weekNumber = getISOWeekNumber(monday);

  return (
    <div className={`${'bg-white border-neutral-light'} p-5 rounded-3xl shadow-soft-xl border`}>
      <div className="flex justify-center items-center mb-6 relative">
        <div className="flex items-center gap-4">
            <button 
                onClick={onPrevWeek} 
                className="p-1.5 rounded-full hover:bg-neutral-light transition-colors text-neutral-dark active:scale-95"
                aria-label="Föregående vecka"
            >
                <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-neutral-dark select-none min-w-[80px] text-center">
                Vecka {weekNumber}
            </h3>
            <button 
                onClick={onNextWeek} 
                disabled={isCurrentWeek}
                className={`p-1.5 rounded-full transition-colors text-neutral-dark active:scale-95 ${isCurrentWeek ? 'opacity-30 cursor-default' : 'hover:bg-neutral-light'}`}
                aria-label="Nästa vecka"
            >
                <ArrowRightIcon className="w-5 h-5" />
            </button>
        </div>
        
        {!isCurrentWeek && (
            <button 
                onClick={onToday}
                className="absolute right-0 text-xs font-semibold text-primary hover:underline px-2 py-1"
            >
                Till idag
            </button>
        )}
      </div>
      
      <div className="flex justify-between items-end h-28 gap-2 sm:gap-4 relative z-10 px-1">
          {weekDays.map(day => {
            const dayISO = getLocalISODateString(day);
            const isFutureDay = day > today;
            const isViewing = dayISO === viewingDateISO;
            const isYesterday = dayISO === yesterdayISO;
            const showSpinner = isSummarizingYesterday && isYesterday;
            
            let calories = 0;
            let calorieGoal = 2000;
            let proteinGoalMet = false;
            let waterGoalMet = false;
            let goalMet = false;
            let fiberGoalMet = false;

            const summary = pastDaysSummary[dayISO];

            if (isViewing && currentViewStats) {
                calories = currentViewStats.calories;
                calorieGoal = currentViewStats.calorieGoal;
                proteinGoalMet = currentViewStats.proteinGoalMet;
                waterGoalMet = currentViewStats.waterGoalMet;
                fiberGoalMet = Boolean(currentViewStats.fiberGoalMet);
                
                const minSafe = calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
                const overage = Math.max(0, calories - calorieGoal);
                
                // Live check: Nådd mål ELLER räddad av sparpott
                if (calories >= minSafe) {
                    if (calories <= calorieGoal) {
                        goalMet = true;
                    } else if (overage <= bankedCalories) {
                        goalMet = true;
                    }
                }
            } else if (summary) {
                calories = summary.consumedCalories;
                calorieGoal = summary.calorieGoal;
                proteinGoalMet = summary.proteinGoalMet;
                waterGoalMet = summary.waterGoalMet || false;
                goalMet = summary.goalMet;
                // Dagar loggade innan fibrerna infordes saknar faltet helt och
                // far ingen markor - de ska inte se ut som misslyckanden.
                fiberGoalMet = typeof summary.consumedFiber === 'number'
                    && summary.consumedFiber >= FIBER_DAILY_TARGET_GRAMS;
            }
            
            const dayLabel = day.toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '').charAt(0).toUpperCase();
            const hasLog = calories > 0;
            
            // Stapeln ska visa samma sak som dagens ring pa startsidan:
            // under minimigransen = orange, over budget = morkt orange, mal natt = gront.
            const minSafeForDay = calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL;
            let barColor = 'bg-[#F1EAE0]';

            if (hasLog) {
                if (goalMet) {
                    barColor = 'bg-[#7BA05B]';
                } else if (calories < minSafeForDay) {
                    barColor = 'bg-[#D96E4A]';
                } else {
                    barColor = 'bg-[#C05A38]';
                }
            }

            let heightPercentage = 0;
            if (calorieGoal > 0) {
                heightPercentage = Math.min((calories / calorieGoal) * 100, 100);
            }

            const surplus = Math.max(0, calories - calorieGoal);
            const isOverGoal = calories > calorieGoal;

            const dayLabelColor = waterGoalMet ? 'text-[#7BA05B] font-bold' : (isViewing ? 'text-[#56524D] dark:text-[#FAF6EF] font-bold' : 'text-[#7A756E] dark:text-[#C2BCB4]');

            return (
                <button
                    key={dayISO}
                    onClick={() => !isFutureDay && onDateSelect(day)}
                    disabled={isFutureDay}
                    className={`group flex flex-col items-center justify-end w-full h-full relative focus:outline-none transition-transform active:scale-95 ${isFutureDay ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
                >
                    <div className="relative w-full flex flex-col items-center justify-end h-full pb-6">
                        {isOverGoal && !showSpinner && (
                            <span className="absolute -top-6 text-xs font-bold text-[#C05A38] animate-fade-in">
                                +{surplus.toFixed(0)}
                            </span>
                        )}

                        <div className={`w-full max-w-[24px] sm:max-w-[32px] h-full bg-[#F1EAE0] dark:bg-[#34302C] border border-[#E2D8CC] dark:border-[#484440] rounded-full relative overflow-hidden flex flex-col-reverse justify-start ${isViewing ? 'ring-2 ring-offset-2 ring-[#D96E4A]' : ''}`}>
                            {showSpinner ? (
                                <div className="w-full h-full flex items-end justify-center pb-2 animate-fade-in">
                                     <div className="w-5 h-5 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div 
                                    className={`w-full ${barColor} rounded-full transition-all duration-500 ease-out relative`} 
                                    style={{ height: `${heightPercentage}%` }}
                                >
                                    {proteinGoalMet && hasLog && (
                                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-full flex justify-center">
                                            <Dumbbell className="w-3 h-3 sm:w-4 sm:h-4 text-white drop-shadow-sm" />
                                        </div>
                                    )}
                                    {/* Fibermarkoren sitter hogst upp i stapeln sa den aldrig krockar med hanteln. */}
                                    {fiberGoalMet && hasLog && (
                                        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-full flex justify-center">
                                            <Leaf className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white drop-shadow-sm" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="absolute bottom-0 text-center w-full">
                        <span className={`block text-xs sm:text-sm ${dayLabelColor} transition-colors`}>
                            {dayLabel}
                        </span>
                    </div>
                </button>
            );
          })}
      </div>
    </div>
  );
};

export default WeeklyActivityChart;
