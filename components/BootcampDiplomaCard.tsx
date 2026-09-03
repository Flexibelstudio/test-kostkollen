import React, { useState } from 'react';
import { BootcampRankDef, BORJE_SIGNATURE_DARK, BORJE_SIGNATURE_LIGHT } from '../utils/bootcampUtils';
import { RankBadge } from './RankBadge';

interface BootcampDiplomaCardProps {
  rankDef: BootcampRankDef;
  userName: string;
  streakDays: number;
  promotionDate?: string;
  id?: string;
  className?: string;
}

export const BootcampDiplomaCard: React.FC<BootcampDiplomaCardProps> = ({
  rankDef,
  userName,
  streakDays,
  promotionDate,
  id,
  className = ''
}) => {
  const [sigError, setSigError] = useState(false);

  const formattedDate = promotionDate 
    ? promotionDate 
    : new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });

  const signatureSrc = rankDef.theme === 'dark' ? BORJE_SIGNATURE_LIGHT : BORJE_SIGNATURE_DARK;

  // Material escalation styling based on rank theme
  const getCardStyle = () => {
    switch (rankDef.theme) {
      case 'dark':
        return {
          cardBg: 'bg-[#56524D] text-[#FAF6EF]',
          border: 'border-2 border-[#D96E4A] ring-1 ring-[#D96E4A]/40 shadow-xl',
          innerBorder: 'border border-[#D96E4A]/30',
          headerText: 'text-[#D96E4A]',
          titleText: 'text-[#FAF6EF]',
          badgeBg: 'bg-[#3D3935] border border-[#D96E4A]/40',
          quoteBoxBg: 'bg-[#3D3935]/80 border border-[#D96E4A]/20',
          accentColor: 'text-[#D96E4A]',
          mutedText: 'text-[#FAF6EF]/70',
          divider: 'border-[#D96E4A]/30'
        };
      case 'sand':
        return {
          cardBg: 'bg-[#F1EAE0] text-[#56524D]',
          border: 'border-2 border-[#D96E4A] shadow-soft-lg',
          innerBorder: 'border-2 border-dashed border-[#D96E4A]/40',
          headerText: 'text-[#C05A38]',
          titleText: 'text-[#56524D]',
          badgeBg: 'bg-[#FAF6EF] border border-[#D96E4A]/30 shadow-sm',
          quoteBoxBg: 'bg-[#FAF6EF]/90 border border-[#D96E4A]/20',
          accentColor: 'text-[#D96E4A]',
          mutedText: 'text-[#7A756E]',
          divider: 'border-[#D96E4A]/30'
        };
      case 'light':
      default:
        return {
          cardBg: 'bg-[#FAF6EF] text-[#56524D]',
          border: 'border border-[#56524D]/30 shadow-soft-lg',
          innerBorder: 'border border-[#56524D]/20',
          headerText: 'text-[#7A756E]',
          titleText: 'text-[#56524D]',
          badgeBg: 'bg-white border border-[#56524D]/20 shadow-sm',
          quoteBoxBg: 'bg-white/80 border border-[#56524D]/15',
          accentColor: 'text-[#D96E4A]',
          mutedText: 'text-[#7A756E]',
          divider: 'border-[#56524D]/20'
        };
    }
  };

  const style = getCardStyle();

  return (
    <div
      id={id}
      className={`relative rounded-3xl p-6 sm:p-8 overflow-hidden transition-all duration-300 ${style.cardBg} ${style.border} ${className}`}
      style={{ fontFamily: "'Jost', sans-serif" }}
    >
      {/* Decorative Frame */}
      <div className={`rounded-2xl p-5 sm:p-6 h-full flex flex-col justify-between ${style.innerBorder}`}>
        
        {/* Header */}
        <div className="text-center space-y-1 mb-4">
          <div className="flex items-center justify-center gap-2">
            <span className={`h-px w-8 ${style.accentColor} bg-current opacity-40`} />
            <p className={`text-xs uppercase tracking-[0.25em] font-bold ${style.headerText}`}>
              GENERALENS BOOTCAMP
            </p>
            <span className={`h-px w-8 ${style.accentColor} bg-current opacity-40`} />
          </div>
          <h2 className={`text-xs uppercase tracking-widest font-semibold ${style.mutedText}`}>
            BEFORDRINGSBEVIS
          </h2>
        </div>

        {/* Badge & Title */}
        <div className="flex flex-col items-center text-center my-2">
          <div className="mb-3 flex items-center justify-center">
            <RankBadge
              rank={rankDef.name}
              size="lg"
              animated={true}
            />
          </div>

          <p className={`text-sm ${style.mutedText} font-medium`}>Härmed befordras</p>
          <p className={`text-xl sm:text-2xl font-bold font-serif ${style.titleText} my-0.5`}>
            {userName || 'Soldat'}
          </p>
          <p className={`text-sm font-semibold uppercase tracking-wider ${style.accentColor}`}>
            till
          </p>
          <h1 className={`text-3xl sm:text-4xl font-black font-serif tracking-tight mt-1 mb-2 ${style.titleText}`}>
            {rankDef.name}
          </h1>

          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${style.badgeBg} ${style.accentColor} mb-4`}>
            <span>🎖️ Bragd:</span>
            <span>{rankDef.req === 0 ? 'Mönstrad i truppen' : `${streakDays} dagar i följd`}</span>
          </div>
        </div>

        {/* Quote / Börjes Text */}
        <div className={`p-4 sm:p-5 rounded-xl my-2 text-left relative ${style.quoteBoxBg}`}>
          <div className="absolute -top-2.5 left-4 px-2 text-xs uppercase font-bold tracking-wider bg-inherit rounded text-[#D96E4A]">
            Börjes Order & Vitsord
          </div>
          <p className="text-base sm:text-lg leading-relaxed font-normal italic pt-1">
            "{rankDef.quote}"
          </p>
        </div>

        {/* Footer & Signature */}
        <div className={`pt-4 mt-4 border-t ${style.divider} flex flex-col sm:flex-row items-center justify-between gap-3 text-xs`}>
          <div className="text-center sm:text-left">
            <p className={style.mutedText}>Datum för befordran</p>
            <p className="font-bold text-sm">{formattedDate}</p>
          </div>

          <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
            <div className="min-h-[48px] flex items-center justify-center sm:justify-end">
              {!sigError && (
                <img
                  src={signatureSrc}
                  alt="Börjes signatur"
                  className="w-[180px] sm:w-[220px] max-h-12 object-contain"
                  onError={() => setSigError(true)}
                />
              )}
            </div>
            <p className={`font-semibold text-xs ${style.mutedText} mt-1`}>
              General Börje, Högkvarteret
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

