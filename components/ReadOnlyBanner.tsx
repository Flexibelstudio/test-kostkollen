import React from 'react';
import { Sparkles, Lock, ChevronRight } from 'lucide-react';

interface ReadOnlyBannerProps {
  onOpenOffer: () => void;
}

export const ReadOnlyBanner: React.FC<ReadOnlyBannerProps> = ({ onOpenOffer }) => {
  return (
    <div className="w-full bg-[#FAF6EF] border-b border-neutral-light py-2.5 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-[#56524D]">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <div className="w-5 h-5 rounded-full bg-[#F6E2D9] text-[#D96E4A] flex items-center justify-center flex-shrink-0">
            <Lock className="w-3 h-3" />
          </div>
          <span>
            <strong>Läsläge aktivt:</strong> Din historik, dina resultat och dina diplom finns kvar. Ny loggning är pausad.
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenOffer}
          className="inline-flex items-center gap-1.5 font-bold text-[#D96E4A] hover:text-[#C05A38] transition-colors whitespace-nowrap cursor-pointer hover:underline underline-offset-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Återuppta loggning med abonnemang</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default ReadOnlyBanner;
