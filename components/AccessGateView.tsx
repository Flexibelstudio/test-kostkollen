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
  CreditCardIcon,
  CheckCircleIcon
} from './icons';
import { Flame, Target, Trophy, Clock, Zap, Loader2, Sparkles } from 'lucide-react';
import { startBootcampCheckout } from '../services/bootcampAccessService';
import { isTestingToolAllowed } from '../utils/testingToolHostnames';

interface AccessGateViewProps {
  userProfile: UserProfileData;
  onStartBootcampCheckout?: () => Promise<void>;
  onSimulatedGrant?: () => Promise<void>;
  onOpenSubscriptionModal: () => void;
  /** Går direkt till Stripe för abonnemanget - ingen mellanruta. */
  onStartSubscriptionCheckout?: () => Promise<void>;
  onLogout: () => void;
  isLoading?: boolean;
  /**
   * Den framräknade planen. Visas överst så att personen ser vad appen kommit
   * fram till innan hon ombeds betala - hela poängen med att flytta profilen
   * före köpvalet.
   */
  planSummary?: {
    calorieGoal?: number;
    proteinGoal?: number;
    goalType?: string;
  };
}

export const AccessGateView: React.FC<AccessGateViewProps> = ({
  userProfile,
  onStartBootcampCheckout,
  onSimulatedGrant,
  onOpenSubscriptionModal,
  onStartSubscriptionCheckout,
  onLogout,
  isLoading = false,
  planSummary
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStartingSubscription, setIsStartingSubscription] = useState(false);

  const handleStartSubscription = async () => {
    if (!onStartSubscriptionCheckout) {
      onOpenSubscriptionModal();
      return;
    }
    setIsStartingSubscription(true);
    setErrorMessage(null);
    try {
      await onStartSubscriptionCheckout();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Kunde inte starta abonnemanget. Försök igen.');
      setIsStartingSubscription(false);
    }
  };
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

  const busy = isLoading || isProcessing || isSimulating || isStartingSubscription;

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

          {/* Den framräknade planen. Personen ska se vad hon får innan hon betalar. */}
          {planSummary?.calorieGoal ? (
            <div className="bg-white rounded-2xl border border-[#F1EAE0] shadow-soft-lg p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-[#7A756E] mb-2">Din plan är klar</p>
              <p className="text-4xl font-serif font-medium text-[#56524D] leading-none">
                {Math.round(planSummary.calorieGoal)}
                <span className="text-lg font-sans text-[#7A756E] ml-1.5">kcal/dag</span>
              </p>
              {planSummary.proteinGoal ? (
                <p className="text-sm text-[#7A756E] mt-2">
                  varav minst {Math.round(planSummary.proteinGoal)} g protein
                </p>
              ) : null}
              <p className="text-sm text-[#56524D] mt-3 leading-relaxed">
                Så här ser din dagliga budget ut. Välj nedan hur du vill köra.
              </p>
            </div>
          ) : null}

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

          {/* Testverktyget för simulerat köp är borttaget härifrån. Betalning med
              Stripes testkort på teststage gör samma sak och testar dessutom
              webhooken - vilket simuleringen aldrig gjorde, och som var precis
              det som var trasigt. Verktyget finns kvar i coachvyn. */
          }

          {/* ABONNEMANG - jämbördigt alternativ, inte en fotnot. Gratisveckan är
              det starkaste argumentet och ska synas, inte gömmas i småtext. */}
          <div className="bg-white rounded-2xl border-2 border-[#F1EAE0] shadow-soft-lg p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <CreditCardIcon className="w-5 h-5 text-[#D96E4A]" />
              <h2 className="font-bold text-lg text-[#56524D]">Bara logga i appen</h2>
            </div>

            <p className="text-3xl font-serif font-medium text-[#56524D] leading-none mt-3">
              7 dagar gratis
            </p>
            <p className="text-sm text-[#7A756E] mt-1.5">
              Sedan 95 kr/mån. Ingen bindningstid – avsluta när du vill.
            </p>

            <ul className="mt-4 space-y-1.5 text-sm text-[#56524D]">
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-[#7BA05B] mt-0.5 shrink-0" />
                <span>Logga med foto, sök eller streckkod</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-[#7BA05B] mt-0.5 shrink-0" />
                <span>Din AI-coach, sparpotten och veckoöversikten</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-[#7BA05B] mt-0.5 shrink-0" />
                <span>Kursen Maxa Klimakteriet ingår</span>
              </li>
            </ul>

            <button
              onClick={handleStartSubscription}
              disabled={busy}
              className="mt-5 w-full py-3.5 px-6 bg-[#56524D] hover:bg-[#3D3A36] text-white font-bold rounded-xl transition-colors active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isStartingSubscription ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Öppnar betalningen...</span>
                </>
              ) : (
                <span>Starta 7 dagar gratis</span>
              )}
            </button>
            <p className="text-xs text-[#7A756E] text-center mt-2">
              Du betalar inget idag.
            </p>
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
