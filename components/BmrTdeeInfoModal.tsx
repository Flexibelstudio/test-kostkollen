

import React from 'react';
import { InformationCircleIcon, XMarkIcon } from './icons.tsx';

interface BmrTdeeInfoModalProps {
  onClose: () => void;
}

const BmrTdeeInfoModal: React.FC<BmrTdeeInfoModalProps> = ({ onClose }) => {
  return (
    <div
      className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light w-full max-w-lg animate-scale-in max-h-[85vh] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bmr-tdee-info-title"
    >
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div className="flex items-center">
          <InformationCircleIcon className="w-7 h-7 text-primary mr-2.5" />
          <h2 id="bmr-tdee-info-title" className="text-2xl font-semibold text-neutral-dark">
            Vad är BMR & TDEE?
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 active:scale-90 interactive-transition"
          aria-label="Stäng"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar -mr-4 pr-4">
        <div className="space-y-4 text-base text-neutral-dark">
          <div>
            <h3 className="font-semibold text-lg text-primary-darker">Basalmetabolism (BMR)</h3>
            <p>
              Din BMR är mängden energi (kalorier) din kropp behöver för att upprätthålla grundläggande livsfunktioner i fullständig vila – som andning, blodcirkulation och cellproduktion. Det är din energiförbrukning om du skulle ligga helt stilla i ett rum med perfekt temperatur en hel dag.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-lg text-primary-darker">Totalt Dagligt Energibehov (TDEE)</h3>
            <p>
              Din TDEE är det totala antalet kalorier du förbränner under en hel dag. Det inkluderar din BMR plus all energi du använder för fysisk aktivitet – från att gå till jobbet och vardagssysslor till strukturerad träning.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-lg text-primary-darker">Hur vi använder det</h3>
            <p>
              Vi använder din TDEE som utgångspunkt. Beroende på ditt mål (fettminskning, underhåll eller muskelökning) justerar vi detta värde för att skapa ditt personliga dagliga kalorimål.
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-8 pt-6 border-t border-neutral-light/70 text-center flex-shrink-0">
        <button
          onClick={onClose}
          className="w-full sm:w-auto px-6 py-2.5 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-darker active:scale-95 interactive-transition"
        >
          Jag förstår
        </button>
      </div>
    </div>
  );
};

export default BmrTdeeInfoModal;