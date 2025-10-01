import React from 'react';
import { XMarkIcon } from './icons';

interface UpdateNoticeModalProps {
  show: boolean;
  onClose: () => void;
  onNavigateToCourses?: () => void;
}

const UpdateNoticeModal: React.FC<UpdateNoticeModalProps> = ({ show, onClose, onNavigateToCourses }) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-notice-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl w-full max-w-lg animate-scale-in max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 id="update-notice-title" className="text-2xl font-bold text-neutral-dark">
                Uppdateringar som gör din resa enklare!
            </h2>
            <button
                onClick={onClose}
                className="p-2 text-neutral hover:text-red-500 rounded-full hover:bg-red-100 active:scale-90"
                aria-label="Stäng"
            >
                <XMarkIcon className="w-6 h-6" />
            </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-grow">
          <p className="text-base text-neutral-dark mb-6">
            Hej! Vi har lyssnat på er feedback och gjort några spännande uppdateringar i Kostloggen för att göra appen ännu bättre och mer motiverande.
          </p>

          <div className="space-y-4 text-left bg-primary-100/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-neutral-dark mb-2">Här är de viktigaste nyheterna:</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🔥</span>
                <p className="text-neutral-dark"><strong className="font-semibold">Streaks blir enklare och mer rättvisa!</strong><br/>Nu får du din streak genom att logga minst en måltid per dag. Det handlar om att bygga vanan, inte om att vara perfekt varje dag. Konsekvens över tid är det som ger resultat!</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🗓️</span>
                <p className="text-neutral-dark"><strong className="font-semibold">Missat en dag? Inga problem!</strong><br/>Du kan nu gå tillbaka och logga för gårdagen. Perfekt för att hålla din streak vid liv även om du glömmer bort att logga en kväll.</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🛡️</span>
                <p className="text-neutral-dark"><strong className="font-semibold">Streakräddaren har gått i pension.</strong><br/>Eftersom du nu kan logga för gårdagen har vi tagit bort den gamla "streakräddaren". Det blir enklare och mer logiskt!</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">♀️</span>
                 <p className="text-neutral-dark"><strong className="font-semibold">Ny kurs: Maxa Klimakteriet!</strong><br/>Vi har lanserat en helt ny kurs speciellt framtagen för att hjälpa dig navigera klimakteriet med kunskap om kost, träning och välmående. Du hittar den under "Kurs" i menyn.</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 text-center flex-shrink-0 space-y-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform interactive-transition"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNoticeModal;
