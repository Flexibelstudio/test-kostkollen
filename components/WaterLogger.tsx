

import React from 'react';
import { WaterDropIcon, RotateCcwIcon, PlusCircleIcon } from './icons';

interface WaterLoggerProps {
  currentWaterMl: number;
  waterGoalMl: number;
  onLogWater: (amountMl: number) => void;
  onResetWater: () => void;
  disabled?: boolean; // New prop
}

const WaterLogger: React.FC<WaterLoggerProps> = ({
  currentWaterMl,
  waterGoalMl,
  onLogWater,
  onResetWater,
  disabled = false, // Default to false
}) => {
  const fillPercentage = waterGoalMl > 0 ? Math.min((currentWaterMl / waterGoalMl) * 100, 100) : 0;

  const logAmounts = [250, 500]; // Standard amounts to log in ml

  const buttonBaseClass = "flex items-center justify-center px-3.5 py-2 text-sm font-medium rounded-lg shadow-sm transform active:scale-95 interactive-transition";

  return (
    <div className={`p-5 bg-white shadow-soft-lg rounded-xl border border-neutral-light interactive-transition ${disabled ? 'opacity-60' : 'hover:shadow-soft-xl'}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-2xl font-semibold text-neutral-dark flex items-center">
          <span className="mr-2" role="img" aria-label="Vatten">💧</span>
          Vattenintag
        </h3>
        {currentWaterMl > 0 && (
          <button
            onClick={onResetWater}
            className={`p-1.5 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 transform active:scale-90 interactive-transition ${disabled ? 'cursor-not-allowed' : ''}`}
            aria-label="Nollställ vattenintag"
            disabled={disabled}
          >
            <RotateCcwIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      {disabled && <p className="text-xs text-orange-500 text-center -mt-2 mb-2">Vattenloggning är inaktiverad för detta datum.</p>}
      <div className="mb-4">
        <div className="text-center mb-1 text-base text-neutral-dark font-medium">
          {currentWaterMl === 0 && waterGoalMl > 0 ? (
            "Logga ditt första glas!"
          ) : (
            `${currentWaterMl.toFixed(0)} ml / ${waterGoalMl.toFixed(0)} ml`
          )}
        </div>
        <div className="w-full bg-neutral-light rounded-full h-6 shadow-inner overflow-hidden">
          <div
            className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${fillPercentage}%` }}
            role="progressbar"
            aria-valuenow={currentWaterMl}
            aria-valuemin={0}
            aria-valuemax={waterGoalMl}
            aria-label={`Vattenintag ${fillPercentage.toFixed(0)}%`}
          >
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5 justify-center">
        {logAmounts.map((amount) => (
          <button
            key={amount}
            onClick={() => onLogWater(amount)}
            className={`${buttonBaseClass} bg-blue-500 hover:bg-blue-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={`Logga ${amount} ml vatten`}
            disabled={disabled}
          >
            <PlusCircleIcon className="w-5 h-5 mr-1.5" />
            {amount} ml
          </button>
        ))}
      </div>
       {currentWaterMl >= waterGoalMl && waterGoalMl > 0 && (
        <p className="text-sm text-primary-darker mt-3 text-center font-medium animate-fade-in">
          🎉 Bra jobbat! Du har nått ditt vattenmål!
        </p>
      )}
    </div>
  );
};

export default WaterLogger;