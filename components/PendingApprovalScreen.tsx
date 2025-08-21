import React from 'react';
import { UserCircleIcon, ArrowRightOnRectangleIcon } from './icons';

interface PendingApprovalScreenProps {
  onLogout: () => void;
  userEmail?: string | null;
}

const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({ onLogout, userEmail }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
      <div className="bg-white p-8 rounded-xl shadow-soft-xl w-full max-w-lg text-center animate-fade-in">
        <UserCircleIcon className="w-20 h-20 text-primary mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-neutral-dark mb-3">Kul att du vill ta tag i din hälsa!</h2>
        <p className="text-neutral-dark text-lg mb-6">
          Ditt konto ({userEmail}) väntar på att godkännas av en coach. För att vi ska kunna aktivera det behöver du först starta en prenumeration, om du inte redan har gjort det.
        </p>
        <a
          href="https://buy.stripe.com/cNi5kEgia4yu0sp5Lt8Ra04"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full px-6 py-3 mb-6 bg-primary hover:bg-primary-darker text-white font-semibold rounded-lg shadow-md active:scale-95 transform transition-all"
        >
          Starta prenumeration
        </a>
        <p className="text-neutral mb-8">
          Du kommer kunna logga in så snart ditt konto är aktiverat. Det sker oftast inom 2 timmar på vardagar.
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
