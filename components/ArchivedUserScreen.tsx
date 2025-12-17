
import React, { useState } from 'react';
import { ArrowRightOnRectangleIcon, ArchiveBoxIcon, CreditCardIcon } from './icons';
import { reactivateSubscription } from '../services/firestoreService';

interface ArchivedUserScreenProps {
  onLogout: () => void;
}

const ArchivedUserScreen: React.FC<ArchivedUserScreenProps> = ({ onLogout }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleReactivate = async () => {
      setIsLoading(true);
      try {
          const url = await reactivateSubscription();
          window.location.href = url;
      } catch (error) {
          alert("Kunde inte starta betalning. Försök igen.");
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
      <div className="bg-white p-8 rounded-xl shadow-soft-xl w-full max-w-md text-center animate-fade-in border border-neutral-light/50">
        <div className="w-20 h-20 bg-neutral-light rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-dark">
            <ArchiveBoxIcon className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-dark mb-3">Ditt konto är pausat</h2>
        <p className="text-neutral-dark text-lg mb-6 leading-relaxed">
          Din prenumeration har löpt ut. Men lugn, all din data finns kvar! Återaktivera ditt konto för att fortsätta där du slutade.
        </p>
        
        <button
          onClick={handleReactivate}
          disabled={isLoading}
          className="w-full mb-4 px-6 py-3.5 bg-primary hover:bg-primary-darker text-white font-bold text-lg rounded-xl shadow-lg shadow-primary/20 active:scale-95 transform transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-wait"
        >
            {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
                <>
                    <CreditCardIcon className="w-5 h-5 mr-2" />
                    Återaktivera prenumeration
                </>
            )}
        </button>

        <button
          onClick={onLogout}
          className="flex items-center justify-center w-full px-6 py-3 text-neutral-dark hover:bg-neutral-light rounded-xl transition-all font-medium"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
          Logga ut
        </button>
      </div>
    </div>
  );
};

export default ArchivedUserScreen;
