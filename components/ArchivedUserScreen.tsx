
import React from 'react';
import { ArrowRightOnRectangleIcon, ArchiveBoxIcon } from './icons';

interface ArchivedUserScreenProps {
  onLogout: () => void;
}

const ArchivedUserScreen: React.FC<ArchivedUserScreenProps> = ({ onLogout }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-light p-4">
      <div className="bg-white p-8 rounded-xl shadow-soft-xl w-full max-w-md text-center animate-fade-in">
        <div className="w-20 h-20 bg-neutral-light rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-dark">
            <ArchiveBoxIcon className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-dark mb-3">Ditt konto är pausat</h2>
        <p className="text-neutral-dark text-lg mb-6">
          Ditt konto har arkiverats och är för närvarande pausat. All din data finns kvar, men du kan inte använda appen just nu.
        </p>
        <p className="text-neutral mb-8 text-sm">
          Kontakta din coach om du vill återaktivera ditt konto och fortsätta din resa.
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

export default ArchivedUserScreen;
