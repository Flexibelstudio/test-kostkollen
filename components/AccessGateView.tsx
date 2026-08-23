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
import { Flame, Target, Trophy, Clock, Zap, Loader2, Sparkles } from 'lucide-react';
import { startBootcampCheckout } from '../services/bootcampAccessService';
import { isTestingToolAllowed } from '../utils/testingToolHostnames';

interface AccessGateViewProps {
  userProfile: UserProfileData;
  onStartBootcampCheckout?: () => Promise<void>;
  onSimulatedGrant?: () => Promise<void>;
  onOpenSubscriptionModal: () => void;
  onLogout: () => void;
  isLoading?: boolean;
}

export const AccessGateView: React.FC<AccessGateViewProps> = ({
  userProfile,
  onStartBootcampCheckout,
  onSimulatedGrant,
  onOpenSubscriptionModal,
  onLogout,
  isLoading = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartBootcamp = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      if (onStartBootcampCheckout) {
        await onStartBootcampCheckout();
      } else {
        await startBootcampCheckout();
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Betalning via Stripe är inte konfigurerad ännu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulatedGrant = async () => {
    if (!isTestingToolAllowed() || !onSimulatedGrant) return;
    setIsSimulating(true);
    setErrorMessage(null);
    try {
      await onSimulatedGrant();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Kunde inte simulera köp.');
    } finally {
      setIsSimulating(false);
    }
  };

  const busy = isLoading || isProcessing || isSimulating;

  return (
    <div className="min-h-[100dvh] bg-[#FAF6EF] text-[#56524D] flex flex-col justify-between">
      {/* Toppmeny med logo och utloggning */}
      <header className="w-full bg-white border-b border-[#F1EAE0] px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Kostloggen.se" className="h-10 w-10" />
            <div>
              <span className="font-extrabold text-[#56524D] text-lg tracking-tight block leading-tight">Kostloggen</span>
              <span className="text-[11px] text-[#7A756E] font-medium block">General Börjes Kost- & Disciplinsystem</span>
            </div>
          </div>
          
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#7A756E] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-[#F1EAE0] hover:border-red-200"
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
            <div className="inline-flex items-center gap-1.5 bg-[#F6E2D9] text-[#D96E4A] border border-[#D96E4A]/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <ShieldCheckIcon className="w-4 h-4 text-[#D96E4A]" />
              <span>Fullständig Programåtkomst</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#56524D] tracking-tight leading-tight">
              Ta kontroll över din hälsa med Kostloggen
            </h1>
            
            <p className="text-sm sm:text-base text-[#7A756E] max-w-lg mx-auto leading-relaxed">
              Välj <strong className="text-[#56524D]">General Börjes 12-veckors Bootcamp</strong> som ditt kompletta program, eller teckna en löpande månadsprenumeration.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium text-center">
              {errorMessage}
            </div>
          )}

          {/* PRIMÄRT ERBJUDANDE: BOOTCAMP (995 KR) */}
          <div className="bg-white rounded-2xl border-2 border-[#D96E4A] shadow-md p-6 relative overflow-hidden transition-all">
            <div className="absolute top-0 right-0 bg-[#D96E4A] text-white text-[11px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
              <SparklesIcon className="w-3.5 h-3.5" />
              Rekommenderat val
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-[#F1EAE0] pb-3 pr-24 sm:pr-0">
                <div>
                  <h2 className="text-xl font-black text-[#56524D] tracking-tight flex items-center gap-2">
                    <span>General Börjes Bootcamp</span>
                  </h2>
                  <p className="text-xs text-[#7A756E] font-bold mt-0.5">
                    12 veckor med daglig loggning, tydliga krav och en general som håller dig ansvarig
                  </p>
                </div>
                <div className="sm:text-right">
                  <span className="text-2xl sm:text-3xl font-black text-[#56524D]">{BOOTCAMP_PRICE_LABEL}</span>
                  <span className="text-xs text-[#7A756E] block font-normal">engångskostnad (12 veckor)</span>
                </div>
              </div>

              {/* Innehållsförteckning Bootcamp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-1 text-xs text-[#56524D]">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#F6E2D9] text-[#D96E4A] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </div>
                  <span><strong>3 dagars grundutbildning</strong> för en kontrollerad och säker inmönstring</span>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#F6E2D9] text-[#D96E4A] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </div>
                  <span><strong>AI-fotologgning</strong> av måltider med omedelbar makroanalys</span>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#F6E2D9] text-[#D96E4A] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </div>
                  <span><strong>Dagliga morgonbriefingar</strong> och disciplinerade kvällsrapporter</span>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#F6E2D9] text-[#D96E4A] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    ✓
                  </div>
                  <span><strong>Full app-tillgång i 84 dagar</strong> till kurser, community & sparpott</span>
                </div>
              </div>

              {/* Primär Knapp */}
              <button
                onClick={handleStartBootcamp}
                disabled={busy}
                className="w-full bg-[#D96E4A] hover:bg-[#C05A38] active:bg-[#B04E2E] text-white font-bold py-3.5 px-5 rounded-xl text-base shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Öppnar kassan...</span>
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

          {/* TESTVERKTYG: SIMULERAT KÖP (Endast i godkända testmiljöer, aldrig i produktion) */}
          {isTestingToolAllowed() && (
            <div className="bg-[#F1EAE0] border border-[#E2D8CC] rounded-2xl p-4 text-xs space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-[#56524D]">
                  <Sparkles className="w-4 h-4 text-[#7A756E]" />
                  <span>Testfunktion (Endast synlig i utvecklings-/testmiljö)</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#E2D8CC] text-[#56524D]">
                  Dev/Staging
                </span>
              </div>
              <p className="text-[#7A756E] leading-relaxed">
                Denna knapp visas inte på produktionsdomänen. Den låter dig simulera ett godkänt köp av 12-veckors Bootcampen utan betalning för att testa grundutbildningen och appen.
              </p>
              <button
                onClick={handleSimulatedGrant}
                disabled={busy}
                className="w-full bg-[#56524D] hover:bg-[#3D3A36] active:bg-[#2B2825] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Simulerar köp...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheckIcon className="w-4 h-4" />
                    <span>Simulera godkänt Bootcamp-köp (Testfunktion)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* SEKUNDÄRT ERBJUDANDE: ABONNEMANG */}
          <div className="bg-white/80 backdrop-blur-xs rounded-xl border border-[#F1EAE0] p-4 sm:p-5 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[#56524D] font-bold text-sm">
                  <CreditCardIcon className="w-4 h-4 text-[#7A756E]" />
                  <span>Föredrar du månadsprenumeration?</span>
                </div>
                <p className="text-xs text-[#7A756E]">
                  Löpande åtkomst till Kostloggens loggning för 95 kr/månad utan bindningstid.
                </p>
              </div>

              <button
                onClick={onOpenSubscriptionModal}
                disabled={busy}
                className="px-4 py-2.5 bg-[#F1EAE0] hover:bg-[#E2D8CC] text-[#56524D] font-semibold text-xs rounded-xl border border-[#E2D8CC] transition-colors whitespace-nowrap active:scale-98"
              >
                Hantera / Välj Abonnemang
              </button>
            </div>
          </div>

          {/* Trygghetsgaranti & Information */}
          <div className="text-center text-xs text-[#7A756E] space-y-1">
            <p>
              Inloggad som <strong className="text-[#56524D]">{userProfile.name || 'Soldat'}</strong>
            </p>
            <p className="text-[11px] text-[#7A756E]/80">
              Coacher och administratörer har alltid obegränsad fri åtkomst.
            </p>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-[#7A756E] border-t border-[#F1EAE0] bg-white/50">
        Kostloggen © {new Date().getFullYear()} · Generalens Bootcamp
      </footer>
    </div>
  );
};

export default AccessGateView;
