
import React, { useState, useEffect } from 'react';
import { UserCircleIcon, ArrowRightOnRectangleIcon, LockClosedIcon } from './icons';
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

  // Auto-redirect if user status changes to 'approved'
  useEffect(() => {
    if (!userId) return;

    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === 'approved') {
                // Force a reload to re-initialize the entire app state cleanly
                window.location.reload();
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
        
        console.log("Startar betalningssession...");
        const result = await createCheckoutSession();
        
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
