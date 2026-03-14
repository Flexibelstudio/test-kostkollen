import React, { useState } from 'react';
import { reactivateSubscription } from '../services/firestoreService';
import { LogOut, CreditCard } from 'lucide-react';

interface Props {
  onLogout: () => void;
}

const PendingSubscriptionScreen: React.FC<Props> = ({ onLogout }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await reactivateSubscription();
      window.location.href = url;
    } catch (err: any) {
      console.error("Failed to create checkout session:", err);
      setError("Kunde inte starta betalningen. Försök igen senare.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-light flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-soft-xl max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-primary-100 text-primary-darker rounded-full flex items-center justify-center mx-auto">
          <CreditCard className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-bold text-neutral-dark">Välkommen till Kostloggen!</h1>
        
        <p className="text-neutral">
          För att få tillgång till appen och alla dess funktioner behöver du starta din prenumeration.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-3 px-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-70 flex items-center justify-center"
        >
          {loading ? 'Laddar...' : 'Starta prenumeration'}
        </button>

        <button
          onClick={onLogout}
          className="w-full py-3 px-4 bg-white text-neutral-dark border border-neutral-light rounded-xl font-semibold hover:bg-neutral-light/50 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Logga ut
        </button>
      </div>
    </div>
  );
};

export default PendingSubscriptionScreen;
