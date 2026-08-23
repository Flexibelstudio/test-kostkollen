import React, { useState } from 'react';
import { UserProfileData } from '../types';
import { 
  BOOTCAMP_PRICE_LABEL, 
  BOOTCAMP_DURATION_WEEKS 
} from '../utils/accessControl';
import { 
  ShieldCheckIcon, 
  SparklesIcon, 
  CheckIcon, 
  ArrowRightOnRectangleIcon, 
  CreditCardIcon 
} from './icons';
import { Flame, Target, Trophy, Clock, Zap, Loader2 } from 'lucide-react';

interface AccessGateViewProps {
  userProfile: UserProfileData;
  onGrantBootcampAccess: () => Promise<void>;
  onOpenSubscriptionModal: () => void;
  onLogout: () => void;
  isLoading?: boolean;
}

export const AccessGateView: React.FC<AccessGateViewProps> = ({
  userProfile,
  onGrantBootcampAccess,
  onOpenSubscriptionModal,
  onLogout,
  isLoading = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartBootcamp = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await onGrantBootcampAccess();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Kunde inte starta Bootcampen. Försök igen.');
    } finally {
      setIsProcessing(false);
    }
  };

  const busy = isLoading || isProcessing;

  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] text-neutral-800 flex flex-col justify-between">
      {/* Toppmeny med logo och utloggning */}
      <header className="w-full bg-white border-b border-neutral-200/80 px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Kostloggen.se" className="h-10 w-10" />
            <div>
              <span className="font-extrabold text-neutral-900 text-lg tracking-tight block leading-tight">Kostloggen</span>
              <span className="text-[11px] text-neutral-500 font-medium block">General Börjes Tränings- & Kostsystem</span>
            </div>
          </div>
          
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-neutral-200 hover:border-red-200"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            <span>Logga ut</span>
          </button>
        </div>
      </header>

      {/* Huvudinnehåll */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-grow flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl space-y-6">
          
          {/* Header & Presentation */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-emerald-100/80 text-emerald-900 border border-emerald-300/60 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <ShieldCheckIcon className="w-4 h-4 text-emerald-700" />
              <span>Fullständig Programåtkomst</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight leading-tight">
              Ta kontroll över din hälsa med Kostloggen
            </h1>
            
            <p className="text-sm sm:text-base text-neutral-600 max-w-lg mx-auto leading-relaxed">
              Välj <strong className="text-neutral-900">General Börjes 12-veckors Bootcamp</strong> som ditt kompletta program, eller teckna en löpande månadsprenumeration.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium text-center">
              {errorMessage}
            </div>
          )}

          {/* PRIMÄRT ERBJUDANDE: BOOTCAMP (995 KR) */}
          <div className="bg-white rounded-2xl border-2 border-emerald-600/80 shadow-md p-6 relative overflow-hidden transition-all">
            <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
              <SparklesIcon className="w-3.5 h-3.5" />
              Rekommenderat val
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-neutral-100 pb-3 pr-24 sm:pr-0">
                <div>
                  <h2 className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
                    <span>General Börjes Bootcamp</span>
                  </h2>
                  <p className="text-xs text-emerald-700 font-bold mt-0.5">
                    {BOOTCAMP_DURATION_WEEKS} veckors intensivt tränings- och kostprogram
                  </p>
                </div>
                <div className="sm:text-right">
                  <span className="text-2xl sm:text-3xl font-black text-neutral-900">{BOOTCAMP_PRICE_LABEL}</span>
                  <span className="text-xs text-neutral-500 block font-normal">engångskostnad (12 veckor)</span>
                </div>
              </div>

              {/* Innehållsförteckning Bootcamp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-1 text-xs text-neutral-700">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </div>
                  <span><strong>3 dagars grundutbildning</strong> för en kontrollerad och säker inmönstring</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </div>
                  <span><strong>AI-fotologgning</strong> av måltider med omedelbar makroanalys</span>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </div>
                  <span><strong>Dagliga morgonbriefingar</strong> och disciplinerade kvällsrapporter</span>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </div>
                  <span><strong>Full app-tillgång i 84 dagar</strong> till kurser, community & sparpott</span>
                </div>
              </div>

              {/* Primär Knapp */}
              <button
                onClick={handleStartBootcamp}
                disabled={busy}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3.5 px-5 rounded-xl text-base shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Aktiverar Bootcamp...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheckIcon className="w-5 h-5" />
                    <span>Köp Bootcamp ({BOOTCAMP_PRICE_LABEL})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SEKUNDÄRT ERBJUDANDE: ABONNEMANG */}
          <div className="bg-white/80 backdrop-blur-xs rounded-xl border border-neutral-200 p-4 sm:p-5 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-neutral-800 font-bold text-sm">
                  <CreditCardIcon className="w-4 h-4 text-neutral-600" />
                  <span>Föredrar du månadsprenumeration?</span>
                </div>
                <p className="text-xs text-neutral-500">
                  Löpande åtkomst till Kostloggens loggning för 95 kr/månad utan bindningstid.
                </p>
              </div>

              <button
                onClick={onOpenSubscriptionModal}
                disabled={busy}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-xs rounded-xl border border-neutral-300 transition-colors whitespace-nowrap active:scale-98"
              >
                Hantera / Välj Abonnemang
              </button>
            </div>
          </div>

          {/* Trygghetsgaranti & Information */}
          <div className="text-center text-xs text-neutral-500 space-y-1">
            <p>
              Inloggad som <strong className="text-neutral-700">{userProfile.name || 'Soldat'}</strong>
            </p>
            <p className="text-[11px] text-neutral-400">
              Coacher och administratörer har alltid obegränsad fri åtkomst.
            </p>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-neutral-400 border-t border-neutral-200/60 bg-white/50">
        Kostloggen © {new Date().getFullYear()} · General Börjes Tränings- & Kostsystem
      </footer>
    </div>
  );
};

export default AccessGateView;
