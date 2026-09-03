
import React, { useState, useEffect } from 'react';
import { UserCircleIcon, ArrowRightOnRectangleIcon, LockClosedIcon, CheckCircleIcon, SparklesIcon } from './icons';
import { functions, db } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from '@firebase/firestore';

interface PendingApprovalScreenProps {
  onLogout: () => void;
  userEmail?: string | null;
  userId?: string;
}

const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({ onLogout, userEmail, userId }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  
  // Kontrollera om vi är på success-sidan OCH har ett session_id (äkta retur från Stripe)
  const [isSuccessMode, setIsSuccessMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const hasSessionId = urlParams.has('session_id');
        const isSuccessPath = window.location.pathname.endsWith('/success');

        if (isSuccessPath && hasSessionId) {
            setIsSuccessMode(true);
        } else if (isSuccessPath && !hasSessionId) {
            // Om användaren går till /success manuellt utan ID, skicka tillbaka till start
            window.location.href = '/';
        }
    }
  }, []);

  // Safety Timeout: Om isSuccessMode är sant men vi inte blir approved inom 8 sekunder,
  // anta att session_id är gammalt/ogiltigt och visa betalningsvyn igen.
  useEffect(() => {
    // FIX: Use ReturnType<typeof setTimeout> instead of NodeJS.Timeout to avoid namespace errors in browser environments
    let safetyTimer: ReturnType<typeof setTimeout>;

    if (isSuccessMode && !isApproved) {
        safetyTimer = setTimeout(() => {
            console.warn("Betalningsverifiering tog för lång tid eller sessionen är ogiltig. Återgår.");
            setIsSuccessMode(false);
            
            // Rensa URL snyggt utan att ladda om sidan
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.delete('session_id');
                // Om vi var på /success, byt till root '/'
                const newPath = url.pathname.endsWith('/success') ? '/' : url.pathname;
                window.history.replaceState({}, '', newPath + url.search);
            }
        }, 8000);
    }

    return () => clearTimeout(safetyTimer);
  }, [isSuccessMode, isApproved]);

  // Auto-redirect logic
  useEffect(() => {
    if (!userId) return;

    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === 'approved') {
                if (isSuccessMode) {
                    // Success mode (payment just happened) -> Set approved state to show animation, 
                    // redirect will happen via the timer effect below.
                    setIsApproved(true);
                } else {
                    // Standard waiting mode -> Immediate redirect/reload
                    window.location.reload();
                }
            }
        }
    });

    return () => unsubscribe();
  }, [userId, isSuccessMode]);

  // Timer effect for redirect
  useEffect(() => {
      if (isApproved && isSuccessMode) {
          const timer = setTimeout(() => {
              window.location.href = '/?payment_success=true';
          }, 4000); // 4 second delay
          return () => clearTimeout(timer);
      }
  }, [isApproved, isSuccessMode]);

  const handleSubscribe = async () => {
    if (!functions) {
        alert("Kunde inte ansluta till betaltjänsten just nu (Functions ej initierat).");
        return;
    }
    
    setIsLoading(true);
    try {
        const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
        const currentOrigin = window.location.origin;

        console.log("Startar betalningssession med returnUrl:", currentOrigin);

        const result = await createCheckoutSession({ returnUrl: currentOrigin });
        const data = result.data as { url: string; sessionId: string };
        
        if (data && data.url) {
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('pending_checkout_type', 'subscription');
            }
            window.location.href = data.url; 
        } else {
            console.error("Ingen URL mottogs från Stripe", data);
            throw new Error("Ingen betallänk mottogs från servern.");
        }
    } catch (error: any) {
        console.error("Failed to start subscription:", error);
        alert(`Ett fel uppstod: ${error.message || "Vänligen försök igen."}`);
        setIsLoading(false);
    }
  };

  if (isSuccessMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
        <div className="bg-white p-10 rounded-3xl shadow-soft-xl w-full max-w-lg text-center animate-scale-in border border-neutral-light/50">
          <div className="w-24 h-24 bg-[#E8EFE9] rounded-full flex items-center justify-center mx-auto mb-6 animate-check-pop-in">
            <CheckCircleIcon className="w-14 h-14 text-[#2B3B2C]" />
          </div>
          
          {isApproved ? (
             // APPROVED STATE
             <>
                <h2 className="text-3xl font-extrabold text-neutral-dark mb-4">Allt klart!</h2>
                <p className="text-neutral-dark text-lg mb-8 font-medium">
                    Ditt konto är nu aktiverat och redo att användas.
                </p>
                <div className="flex justify-center items-center gap-3 mb-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                    <span className="text-neutral font-medium">Skickar dig vidare...</span>
                </div>
             </>
          ) : (
             // WAITING FOR WEBHOOK STATE
             <>
                <h2 className="text-3xl font-extrabold text-neutral-dark mb-4">Betalning mottagen!</h2>
                <p className="text-neutral-dark text-lg mb-8 font-medium">
                    Tack! Vi håller på att aktivera ditt konto och ställa in allt åt dig. Detta tar oftast bara några sekunder...
                </p>
                
                <div className="flex justify-center items-center gap-3 mb-8 bg-neutral-light/50 p-4 rounded-xl">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                    <span className="text-neutral font-medium">Synkroniserar...</span>
                </div>

                <p className="text-xs text-neutral mb-6 opacity-70">
                    Sidan uppdateras automatiskt så fort ditt konto är redo. Stäng inte fönstret.
                </p>
             </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
      <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-soft-xl w-full max-w-lg text-center animate-scale-in border border-neutral-light/50 relative overflow-hidden">
        
        {/* Decorational background blob */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>

        <div className="relative z-10">
            <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <UserCircleIcon className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-3xl font-extrabold text-neutral-dark mb-3">Nästan klart!</h2>
            <p className="text-neutral font-medium text-base mb-1">{userEmail}</p>
            <p className="text-neutral-dark text-lg mb-8 leading-relaxed">
              Starta din gratisvecka så är du igång på 30 sekunder.
            </p>
            
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6 mb-8 text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-2 py-1 rounded-bl-lg">PREMIUM</div>
                <h3 className="font-bold text-primary-darker text-lg mb-2 flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-primary" /> Allt detta ingår:
                </h3>
                <ul className="space-y-2 text-sm text-neutral-dark">
                    <li className="flex items-start gap-2"><CheckCircleIcon className="w-4 h-4 text-[#2B3B2C] mt-0.5" /> Obegränsad loggning & statistik</li>
                    <li className="flex items-start gap-2"><CheckCircleIcon className="w-4 h-4 text-[#2B3B2C] mt-0.5" /> Personlig AI-Coachning</li>
                    <li className="flex items-start gap-2"><CheckCircleIcon className="w-4 h-4 text-[#2B3B2C] mt-0.5" /> Kurser (Viktkontroll & Klimakteriet)</li>
                    <li className="flex items-start gap-2"><CheckCircleIcon className="w-4 h-4 text-[#2B3B2C] mt-0.5" /> Community & Peppkompisar</li>
                </ul>
            </div>
            
            <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="flex items-center justify-center w-full px-6 py-4 mb-4 bg-gradient-to-r from-primary to-primary-darker hover:from-primary-darker hover:to-primary-darker text-white font-bold text-lg rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transform transition-all disabled:opacity-70 disabled:cursor-wait group"
            >
            {isLoading ? (
                <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                    Laddar betalning...
                </>
            ) : (
                <>
                    <SparklesIcon className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                    Starta 7 dagar gratis
                </>
            )}
            </button>

            {/* Trygghetsrader precis vid knappen */}
            <div className="w-full flex flex-col gap-1.5 items-start text-sm font-semibold text-[#2B3B2C] mb-6 bg-[#E8EFE9]/60 py-3.5 px-4 rounded-xl border border-[#2B3B2C]/20 text-left">
                <div className="flex items-center gap-2">
                    <span className="text-[#2B3B2C]">✓</span>
                    <span>Inga pengar dras idag – du lägger bara in ditt kort</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[#2B3B2C]">✓</span>
                    <span>Vi påminner dig innan provperioden tar slut</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[#2B3B2C]">✓</span>
                    <span>Avsluta med ett klick</span>
                </div>
            </div>

            <p className="text-neutral text-xs mb-8 text-left px-1 leading-relaxed">
            Därefter 95 kr/mån. Betalningen hanteras säkert via Stripe. Ingen bindningstid.
            </p>
            
            <button
            onClick={onLogout}
            className="flex items-center justify-center w-full px-6 py-3 text-neutral-dark font-semibold hover:bg-neutral-light rounded-xl transition-all text-sm"
            >
            <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
            Logga ut
            </button>
        </div>
      </div>
    </div>
  );
};

export default PendingApprovalScreen;
