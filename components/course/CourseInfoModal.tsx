

import React from 'react';
import { InformationCircleIcon, XMarkIcon } from '../icons';

interface CourseInfoModalProps {
  onClose: () => void;
  show: boolean;
}

const CourseInfoModal: React.FC<CourseInfoModalProps> = ({ onClose, show }) => {
  if (!show) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-info-modal-title"
    >
      <div
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light max-h-[90vh] overflow-y-auto custom-scrollbar w-full max-w-lg animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <InformationCircleIcon className="w-8 h-8 text-primary mr-3" />
            <h2 id="course-info-modal-title" className="text-2xl sm:text-3xl font-bold text-neutral-dark">
              Om Kursen
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 active:scale-90 transform transition-transform"
            aria-label="Stäng informationsrutan"
          >
            <XMarkIcon className="w-7 h-7" />
          </button>
        </div>

        <div className="space-y-4 text-base text-neutral-dark">
          <p className="font-semibold text-lg text-primary-darker">Praktisk Viktkontroll – Din Resa Mot Hållbar Hälsa</p>
          <p>
            Välkommen till kursen "Praktisk Viktkontroll"! Detta program är noggrant utformat för att ge dig de verktyg, kunskaper och det stöd du behöver för att uppnå en hållbar viktkontroll och en hälsosammare livsstil.
          </p>
          <p>
            Vi fokuserar på att bygga starka, positiva vanor kring både kost och motion. Du kommer att lära dig att lyssna på din kropps signaler, förstå dina hungermönster och effektivt hantera de utmaningar som kan uppstå längs vägen.
          </p>
          <p>
            Kursen består av ett antal lektioner med specifika fokusområden, praktiska tips och reflektionsfrågor som hjälper dig att integrera lärdomarna i din vardag. Lektionerna låses upp i takt med att du bygger din dagliga streak, vilket uppmuntrar till konsekvens och hållbara framsteg.
          </p>
          <p>
            Kursen är mer än bara information; den är en guide som uppmuntrar till handling och självinsikt. Målet är att du efter avslutad kurs ska känna dig trygg i dina nya vanor och ha en stabil grund för att fortsätta din hälsoresa på egen hand.
          </p>
          <p className="font-medium">
            Lycka till – vi ser fram emot att följa dina framsteg!
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-light/70 text-center">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform"
          >
            Jag förstår
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseInfoModal;