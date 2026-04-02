
import React from 'react';
import { PlusIcon } from './icons';

interface WaterLoggerProps {
  currentWaterMl: number;
  waterGoalMl: number;
  onLogWater: (amountMl: number, event: React.MouseEvent<HTMLButtonElement>) => void;
  onResetWater: () => void;
  disabled?: boolean;
  isBootcamp?: boolean;
}

const WaterLogger = React.forwardRef<HTMLDivElement, WaterLoggerProps>(({
  currentWaterMl,
  waterGoalMl,
  onLogWater,
  onResetWater,
  disabled = false,
  isBootcamp = false,
}, ref) => {
  const fillPercentage = waterGoalMl > 0 ? Math.min((currentWaterMl / waterGoalMl) * 100, 100) : 0;
  const standardGlassMl = 250;

  const handleAddGlass = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!disabled) {
          onLogWater(standardGlassMl, e);
      }
  };

  return (
    <div ref={ref} className={`relative overflow-hidden ${isBootcamp ? 'bg-[#E5EFE7] dark:!bg-[#3A4B3C] border-[#4A5B4C]' : 'bg-white border-neutral-light'} rounded-2xl shadow-soft-lg border h-full min-h-[160px] flex flex-col justify-between group select-none ${disabled ? 'opacity-70' : ''}`}>
        
        {/* Background Fill Level */}
        <div 
            className="absolute bottom-0 left-0 right-0 bg-blue-300/60 transition-all duration-700 ease-in-out z-0" 
            style={{ height: `${fillPercentage}%` }} 
        />

        <div className="relative z-10 flex justify-between items-start p-5 pb-0">
            <div>
                <h3 className="text-xl font-bold text-neutral-dark">Vatten</h3>
                <p className="text-xs text-neutral-500 font-medium">Tryck + för ett glas</p>
            </div>
            <button 
                onClick={handleAddGlass}
                disabled={disabled}
                className="w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-md flex items-center justify-center active:scale-90 transition-transform z-20"
                aria-label="Logga 250ml vatten"
            >
                <PlusIcon className="w-6 h-6" />
            </button>
        </div>

        <div className="relative z-10 mt-auto p-5 pt-4">
            <p className="text-4xl font-extrabold text-neutral-dark">{(currentWaterMl / 1000).toFixed(1)} <span className="text-2xl font-bold text-neutral-500">L</span></p>
            <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wide">Mål: {(waterGoalMl / 1000).toFixed(1)} L</p>
                {currentWaterMl > 0 && (
                    <button 
                        onClick={onResetWater} 
                        disabled={disabled}
                        className="text-xs text-red-400 hover:text-red-600 hover:underline z-20"
                    >
                        Töm
                    </button>
                )}
            </div>
        </div>
    </div>
  );
});

export default WaterLogger;
