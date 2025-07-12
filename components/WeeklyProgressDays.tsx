
import React from 'react';
import { PastDaysSummaryCollection } from '../types';
import { CheckCircleIcon, XCircleIcon } from './icons'; // Assuming these icons are suitable

interface WeeklyProgressDaysProps {
  pastDaysSummary: PastDaysSummaryCollection;
  currentAppDate: Date; // To determine the current week
  onDayClick: (date: Date) => void;
  viewingDate: Date; // To highlight the currently viewed day
}

const getDayShortName = (dayIndex: number): string => {
  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday in JS Date.getDay()
  // We want Mån, Tis, Ons, Tor, Fre, Lör, Sön
  const swedishDayNames = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
  return swedishDayNames[dayIndex];
};

const getLocalISODateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const WeeklyProgressDays: React.FC<WeeklyProgressDaysProps> = ({
  pastDaysSummary,
  currentAppDate,
  onDayClick,
  viewingDate,
}) => {
  const today = new Date(currentAppDate);
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Calculate offset to get to Monday
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
    <div className="mt-4 mb-3 p-3 bg-neutral-light/50 rounded-lg shadow-sm">
      <h4 className="text-sm font-semibold text-neutral-dark mb-2 text-center">Veckoöversikt</h4>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekDays.map(day => {
          const dayISO = getLocalISODateString(day);
          
          const isFutureDay = day > today;
          const isToday = dayISO === todayISO;
          const isViewingThisDay = dayISO === viewingDateISO;
          const summary = pastDaysSummary[dayISO];
          const waterGoalWasMet = summary?.waterGoalMet === true;

          let bgColor = 'bg-gray-200 hover:bg-gray-300';
          let iconColorClass = 'text-gray-700';
          let ariaLabel = `Status för ${day.toLocaleDateString('sv-SE', { weekday: 'long' })}: `;

          if (isToday) {
            bgColor = 'bg-accent/30 hover:bg-accent/40';
            iconColorClass = 'text-accent-darker';
            ariaLabel += 'Idag, pågående.';
          } else if (isFutureDay) {
            bgColor = 'bg-gray-100';
            iconColorClass = 'text-gray-400 cursor-default';
            ariaLabel += 'Framtida dag.';
          } else { // It's a past day
            if (summary) {
              if (summary.goalMet) {
                bgColor = 'bg-primary/70 hover:bg-primary';
                iconColorClass = 'text-white';
                ariaLabel += 'Mål uppnått.';
              } else {
                bgColor = 'bg-secondary/70 hover:bg-secondary';
                iconColorClass = 'text-white';
                ariaLabel += 'Mål ej uppnått.';
              }
            } else { // Past day, no summary
              bgColor = 'bg-neutral-light hover:bg-gray-300';
              ariaLabel += 'Ej loggad.';
            }
          }
          
          return (
            <div key={dayISO} className="relative">
              <button
                onClick={() => !isFutureDay && onDayClick(day)}
                disabled={isFutureDay}
                className={`flex flex-col items-center justify-around p-1 rounded-md text-xs sm:text-sm font-medium transition-all aspect-square w-full
                  ${bgColor} 
                  ${isFutureDay ? 'opacity-60' : 'active:scale-90'}
                  ${isViewingThisDay && !isToday ? 'ring-2 ring-offset-1 ring-accent-darker' : ''}
                  ${isToday ? 'ring-2 ring-accent' : ''}
                `}
                aria-label={ariaLabel}
                title={ariaLabel}
              >
                <span className={`text-xs font-bold ${iconColorClass}`}>{getDayShortName(day.getDay())}</span>
                
                {/* Icons Container */}
                <div className="flex justify-center items-center w-full px-0.5" style={{ height: '16px' }}>
                  {summary ? (
                    <>
                      <div className="w-4 h-4 flex items-center justify-center">
                        {summary.proteinGoalMet && <span role="img" aria-label="Proteinmål uppnått" title="Proteinmål uppnått" className="text-sm">💪</span>}
                      </div>
                    </>
                  ) : (
                    <div style={{height: '16px'}}></div> // Placeholder
                  )}
                </div>
                
                <span className={`text-lg font-bold ${iconColorClass}`}>{day.getDate()}</span>
              </button>
              {waterGoalWasMet && (
                  <div 
                      className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-3/5 h-[3px] bg-blue-400 rounded-full"
                      title="Vattenmål uppnått"
                  ></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyProgressDays;