
import React, { useState, useEffect } from 'react';
import { UserCircleIcon, ArrowRightOnRectangleIcon, LockClosedIcon, CheckCircleIcon } from './icons';
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
  const isSuccessMode = typeof window !== 'undefined' && window.location.pathname.endsWith('/success');

  // Auto-redirect if user status changes to 'approved'
  useEffect(() => {
    if (!userId) return;

    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === 'approved') {
                // Force a reload to re-initialize the entire app state cleanly
                // If we are on /success, redirect to root clean
                if (window.location.pathname.endsWith('/success')) {
                    window.location.href = '/?payment_success=true';
                } else {
                    window.location.reload();
                }
            }
        }
    });

    return () => unsubscribe();
  }, [userId]);

  const handleSubscribe = async () => {
    if (!functions) {
        alert("Kunde inte ansluta till betaltjänsten just nu (Functions ej initierat).");
        return;
    }
    
    setIsLoading(true);
    try {
        // Backend-funktionen heter nu 'createCheckoutSession'
        const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
        
        // Hämta aktuell origin (t.ex. https://staging--... eller https://app.kostloggen.se)
        const currentOrigin = window.location.origin;

        console.log("Startar betalningssession med returnUrl:", currentOrigin);

        // Skicka med returnUrl till backend
        const result = await createCheckoutSession({ returnUrl: currentOrigin });
        
        // Backend returnerar { sessionId: string, url: string }
        const data = result.data as { url: string; sessionId: string };
        
        if (data && data.url) {
            window.location.href = data.url; // Skicka användaren till Stripe
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
        <div className="bg-white p-8 rounded-xl shadow-soft-xl w-full max-w-lg text-center animate-fade-in">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
            <CheckCircleIcon className="w-16 h-16 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-neutral-dark mb-4">Betalning mottagen!</h2>
          <p className="text-neutral-dark text-lg mb-8">
            Tack! Vi håller på att aktivera ditt konto och ställa in allt åt dig. Detta tar oftast bara några sekunder...
          </p>
          
          <div className="flex justify-center items-center gap-3 mb-8">
             <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
             <span className="text-neutral font-medium">Synkroniserar...</span>
          </div>

          <p className="text-xs text-neutral">
            Sidan uppdateras automatiskt så fort ditt konto är redo. Stäng inte fönstret.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
      <div className="bg-white p-8 rounded-xl shadow-soft-xl w-full max-w-lg text-center animate-fade-in">
        <UserCircleIcon className="w-20 h-20 text-primary mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-neutral-dark mb-3">Kul att du vill ta tag i din hälsa!</h2>
        <p className="text-neutral-dark text-lg mb-6">
          Ditt konto ({userEmail}) väntar på att godkännas. För att aktivera ditt konto och få tillgång till appen behöver du starta din prenumeration.
        </p>
        
        <button
          onClick={handleSubscribe}
          disabled={isLoading}
          className="flex items-center justify-center w-full px-6 py-4 mb-6 bg-primary hover:bg-primary-darker text-white font-bold text-lg rounded-xl shadow-md active:scale-95 transform transition-all disabled:opacity-70 disabled:cursor-wait"
        >
          {isLoading ? (
            <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                Laddar betalning...
            </>
          ) : (
            <>
                <LockClosedIcon className="w-5 h-5 mr-2" />
                Starta prenumeration (95 kr/mån)
            </>
          )}
        </button>

        <p className="text-neutral text-sm mb-8">
          Betalningen hanteras säkert via Stripe. Ingen bindningstid.
          <br/>
          Ditt konto aktiveras automatiskt direkt efter betalning.
        </p>
        
        <button
          onClick={onLogout}
          className="flex items-center justify-center w-full px-6 py-3 bg-secondary hover:bg-secondary-darker text-white font-semibold rounded-lg shadow-md active:scale-95 transform transition-all"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
          Logga ut
        </button>
      </div>
    </div>
  );
};

export default PendingApprovalScreen;
