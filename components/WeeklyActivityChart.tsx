
import React, { useMemo } from 'react';
import { PastDaysSummaryCollection } from '../types';
import { Dumbbell } from 'lucide-react';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';
import { getISOWeekNumber } from '../utils/dateUtils';
import { MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL } from '../constants';

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
    <div className={`${isBootcamp ? 'bg-white dark:!bg-[#3A4B3C] border-[#4A5B4C]' : 'bg-white border-neutral-light'} p-5 rounded-3xl shadow-soft-xl border`}>
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

            const summary = pastDaysSummary[dayISO];

            if (isViewing && currentViewStats) {
                calories = currentViewStats.calories;
                calorieGoal = currentViewStats.calorieGoal;
                proteinGoalMet = currentViewStats.proteinGoalMet;
                waterGoalMet = currentViewStats.waterGoalMet;
                
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
            }
            
            const dayLabel = day.toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '').charAt(0).toUpperCase();
            const hasLog = calories > 0;
            
            let barColor = 'bg-neutral-100'; 
            
            if (hasLog) {
                // Nu använder vi den uppdaterade goalMet som inkluderar sparpott-räddning
                if (goalMet) {
                    barColor = 'bg-primary'; 
                } else {
                    barColor = 'bg-secondary'; 
                }
            }

            let heightPercentage = 0;
            if (calorieGoal > 0) {
                heightPercentage = Math.min((calories / calorieGoal) * 100, 100);
            }

            const surplus = Math.max(0, calories - calorieGoal);
            const isOverGoal = calories > calorieGoal;

            const dayLabelColor = waterGoalMet ? 'text-blue-500 font-bold' : (isViewing ? 'text-neutral-dark font-bold' : 'text-neutral');

            return (
                <button
                    key={dayISO}
                    onClick={() => !isFutureDay && onDateSelect(day)}
                    disabled={isFutureDay}
                    className={`group flex flex-col items-center justify-end w-full h-full relative focus:outline-none transition-transform active:scale-95 ${isFutureDay ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
                >
                    <div className="relative w-full flex flex-col items-center justify-end h-full pb-6">
                        {isOverGoal && !showSpinner && (
                            <span className="absolute -top-6 text-[10px] sm:text-xs font-bold text-secondary animate-fade-in">
                                +{surplus.toFixed(0)}
                            </span>
                        )}

                        <div className={`w-full max-w-[24px] sm:max-w-[32px] h-full bg-neutral-light/40 rounded-full relative overflow-hidden flex flex-col-reverse justify-start ${isViewing ? 'ring-2 ring-offset-2 ring-primary/30' : ''}`}>
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
