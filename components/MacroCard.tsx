import React from 'react';

interface MacroCardProps {
  label: string;
  current: number;
  goal: number;
  barColor: string;
  trackColor: string;
  isBootcamp?: boolean;
  onInfoClick?: () => void;
  infoAriaLabel?: string;
}

export const MacroCard: React.FC<MacroCardProps> = ({
  label,
  current,
  goal,
  barColor,
  trackColor,
  isBootcamp = false,
  onInfoClick,
  infoAriaLabel,
}) => {
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;

  return (
    <div
      className={`flex flex-col justify-between ${
        isBootcamp
          ? 'bg-white dark:!bg-[#3A4B3C] border-[#4A5B4C]'
          : 'bg-neutral-50 border-neutral-light'
      } rounded-2xl p-3 sm:p-4 border text-center h-full`}
    >
      <div>
        <div className="h-4 sm:h-5 flex items-center justify-center mb-1">
          <p className="text-xs font-bold text-neutral-dark uppercase tracking-wider leading-none flex items-center justify-center">
            <span>{label}</span>
            {onInfoClick && (
              <button
                type="button"
                onClick={onInfoClick}
                className="ml-1 text-neutral-400 hover:text-primary transition-colors inline-flex items-center justify-center leading-none"
                aria-label={infoAriaLabel || `Information om ${label.toLowerCase()}mål`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-3.5 h-3.5 block"
                >
                  <path
                    fillRule="evenodd"
                    d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </p>
        </div>
        <p className="text-xs sm:text-sm text-neutral-500 mb-2 leading-tight">
          {Math.round(current)}/{goal}g
        </p>
      </div>
      <div
        className="w-full rounded-full h-1.5 overflow-hidden mt-auto"
        style={{ backgroundColor: trackColor }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
};

export default MacroCard;
