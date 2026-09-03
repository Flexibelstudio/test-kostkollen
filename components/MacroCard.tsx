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
  /** Ersatter "x/y g"-texten. Anvands nar vardet inte ar kant an. */
  displayValue?: string;
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
  displayValue,
}) => {
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;

  return (
    <div
      // Samma innerkortsspråk som statistikkorten i matloggen och korten i
      // "Mina vanliga val": vit botten, tunn ram och en lätt skugga. Korten
      // ligger inuti ett kort som redan har djup, så skuggan ska vara diskret.
      className={`flex flex-col justify-between bg-white dark:bg-[#2B2825] border border-[#F1EAE0] dark:border-[#484440] rounded-2xl p-3 sm:p-4 shadow-soft-sm text-center h-full`}
    >
      <div>
        <div className="h-4 sm:h-5 flex items-center justify-center mb-1">
          {/* Info-ikonen ska sitta tatt intill ordet, som en forlangning av det,
              och ordet plus ikon ska centreras som EN enhet i kortet. Darfor
              inline-flex med minimal marginal - inte en egen kolumn med luft. */}
          <p className="text-xs font-bold text-neutral-dark uppercase tracking-wider leading-none inline-flex items-center justify-center whitespace-nowrap">
            <span>{label}</span>
            {onInfoClick && (
              <button
                type="button"
                onClick={onInfoClick}
                className="-ml-px text-neutral-400 hover:text-primary transition-colors inline-flex items-center justify-center leading-none align-middle"
                aria-label={infoAriaLabel || `Information om ${label.toLowerCase()}mål`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-3 h-3 block"
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
          {displayValue ?? `${Math.round(current)}/${goal}g`}
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
