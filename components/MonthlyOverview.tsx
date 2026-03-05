
import React, { useMemo, useState, useEffect } from 'react';
import { PastDaysSummaryCollection } from '../types';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';

interface MonthlyOverviewProps {
  pastDaysData: PastDaysSummaryCollection;
  currentDate: Date;
  viewingDate: Date;
  onDateSelect: (date: Date) => void;
}

const getLocalISODateString = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "ERROR_INVALID_DATE";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); 
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(d.setDate(diff));
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getISOWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNumber;
};

const shortDayNamesSwedish = ["M", "T", "O", "T", "F", "L", "S"];

const MonthlyOverview: React.FC<MonthlyOverviewProps> = ({ 
  pastDaysData, 
  currentDate, 
  viewingDate, 
  onDateSelect 
}) => {
  const [browseDate, setBrowseDate] = useState(new Date(viewingDate));

  useEffect(() => {
    setBrowseDate(new Date(viewingDate));
  }, [viewingDate]);

  const todayISO = useMemo(() => getLocalISODateString(currentDate), [currentDate]);
  
  const weekStart = getStartOfWeek(browseDate);
  const weekNumber = getISOWeekNumber(weekStart);
  
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

  const handlePrevWeek = () => {
    setBrowseDate(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setBrowseDate(prev => addDays(prev, 7));
  };

  const currentWeekStart = getStartOfWeek(new Date());
  const isFutureWeek = weekStart > currentWeekStart;

  return (
    <div className="bg-white p-5 rounded-3xl shadow-soft-xl border border-neutral-light">
      <div className="flex justify-center items-center mb-6 relative">
        <div className="flex items-center gap-4">
            <button 
                onClick={handlePrevWeek} 
                className="p-1.5 rounded-full hover:bg-neutral-light transition-colors text-neutral-dark active:scale-95"
                aria-label="Föregående vecka"
            >
                <ArrowLeftIcon className="w-5 h-5" />
            </button>
            
            <div className="text-center min-w-[140px]">
                <h3 className="text-lg font-bold text-neutral-dark select-none">
                    Historik v.{weekNumber}
                </h3>
                <p className="text-xs text-neutral">
                    {weekStart.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}
                </p>
            </div>

            <button 
                onClick={handleNextWeek} 
                className={`p-1.5 rounded-full transition-colors text-neutral-dark active:scale-95 ${isFutureWeek ? 'opacity-30 cursor-default' : 'hover:bg-neutral-light'}`}
                aria-label="Nästa vecka"
                disabled={isFutureWeek}
            >
                <ArrowRightIcon className="w-5 h-5" />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 sm:gap-4">
        {weekDays.map((dayDate, index) => {
            const dayISO = getLocalISODateString(dayDate);
            const isFutureDay = dayDate > currentDate;
            const isToday = dayISO === todayISO;
            const isClickable = !isFutureDay;
            const isViewingThisDay = dayISO === getLocalISODateString(viewingDate);
            
            const summary = pastDaysData[dayISO];
            const waterGoalWasMet = summary?.waterGoalMet === true;
            
            let bgColor = 'bg-gray-200';
            let iconColorClass = 'text-gray-700';

            if (isFutureDay) {
                bgColor = 'bg-gray-100';
                iconColorClass = 'text-gray-400';
            } else if (isToday) {
                bgColor = 'bg-secondary/30';
                iconColorClass = 'text-secondary-darker';
            } else { 
                if (summary) {
                    // Om goalMet är sant (av dagslogik eller sparpott) -> Grön
                    if (summary.goalMet) {
                        bgColor = 'bg-primary/70';
                        iconColorClass = 'text-white';
                    } else {
                        bgColor = 'bg-secondary/70';
                        iconColorClass = 'text-white';
                    }
                } else { 
                    bgColor = 'bg-neutral-light';
                    iconColorClass = 'text-neutral-dark';
                }
            }

            return (
                <div key={dayISO} className="flex flex-col items-center gap-1">
                    <div className="relative w-full h-24 flex justify-center">
                        <button 
                            onClick={() => {
                                if (isClickable) {
                                    onDateSelect(dayDate);
                                    setBrowseDate(dayDate); 
                                }
                            }} 
                            disabled={!isClickable} 
                            className={`flex flex-col items-center justify-center p-1 rounded-full text-xs sm:text-sm font-medium transition-all w-full max-w-[24px] sm:max-w-[32px] h-full focus:outline-none ${bgColor} ${isFutureDay ? 'opacity-60' : ''} ${isClickable ? 'cursor-pointer hover:scale-105 active:scale-95 hover:shadow-lg' : 'cursor-default'} ${isViewingThisDay ? 'ring-2 ring-offset-2 ring-secondary' : ''}`}
                        >
                            {summary?.proteinGoalMet && (
                                <span role="img" aria-label="Proteinmål uppnått" title="Proteinmål uppnått" className="text-base leading-none">💪</span>
                            )}
                        </button>
                    </div>
                    <span className={`text-xs font-bold ${waterGoalWasMet ? 'text-blue-500' : 'text-neutral-400'}`}>
                      {shortDayNamesSwedish[index]}
                    </span>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default MonthlyOverview;
