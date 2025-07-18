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
        <h2 className="text-3xl font-bold text-neutral-dark mb-3">Tack för din registrering!</h2>
        <p className="text-neutral-dark text-lg mb-2">
          Ditt konto ({userEmail}) väntar på att bli godkänt av en coach.
        </p>
        <p className="text-neutral mb-8">
          Du kommer att kunna logga in så snart ditt konto har aktiverats. Detta sker vanligtvis inom 24 timmar.
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
