import React from 'react';
import { LeafIcon } from './icons';

interface FiberRowProps {
  /** Summerade fibrer för dagen i gram. */
  current: number;
  /** Dagligt mål i gram. */
  target: number;
  /** False när ingen loggad måltid alls bar ett fibervärde. */
  hasData: boolean;
}

/**
 * Fibrer visas medvetet annorlunda än makrona.
 *
 * Det här är ett samlarmål, inte ett tak: ingen röd färg, inget "du missade",
 * och siffran avrundas till hela gram eftersom uppskattningen inte är
 * exaktare än så. Saknas fibervärden helt visar raden det i klartext i
 * stället för att påstå att dagen var fiberfri.
 */
export const FiberRow: React.FC<FiberRowProps> = ({ current, target, hasData }) => {
  const rounded = Math.round(current);
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const targetMet = hasData && current >= target;

  return (
    <div className="w-full bg-neutral-50 border border-neutral-light rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <LeafIcon className={`w-4 h-4 flex-shrink-0 ${targetMet ? 'text-[#7BA05B]' : 'text-[#7A756E]'}`} />
          <span className="text-xs font-bold text-neutral-dark uppercase tracking-wider">Fibrer</span>
        </div>
        <span className="text-xs sm:text-sm text-neutral-500 whitespace-nowrap">
          {hasData ? `${rounded}/${target} g` : `– /${target} g`}
        </span>
      </div>

      <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: '#E8EFE9' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${hasData ? percentage : 0}%`, backgroundColor: '#7BA05B' }}
        />
      </div>

      <p className="text-[11px] text-neutral-500 mt-2 leading-snug">
        {!hasData
          ? 'Fibrer räknas från och med nu – logga en måltid så fylls raden i.'
          : targetMet
            ? 'Fint, du är i mål med fibrerna i dag.'
            : 'Ett riktmärke att sträva mot, inget du kan missa. Baljväxter, fullkorn, frukt och grönt drar upp det snabbt.'}
      </p>
    </div>
  );
};

export default FiberRow;
