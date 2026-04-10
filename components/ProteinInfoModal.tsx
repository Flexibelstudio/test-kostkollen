import React from 'react';
import { InformationCircleIcon, XMarkIcon } from './icons.tsx';

interface ProteinInfoModalProps {
  onClose: () => void;
}

const ProteinInfoModal: React.FC<ProteinInfoModalProps> = ({ onClose }) => {
  return (
    <div
      className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light w-full max-w-lg animate-scale-in max-h-[85vh] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="protein-info-title"
    >
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div className="flex items-center">
          <InformationCircleIcon className="w-7 h-7 text-primary mr-2.5" />
          <h2 id="protein-info-title" className="text-2xl font-semibold text-neutral-dark">
            Om ditt proteinmål
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
          <p>
            Ditt proteinmål är en rekommenderad miniminivå. Att äta mer är bara positivt! 
          </p>
          <p>
            För optimal mättnad och muskeluppbyggnad kan du med fördel sikta på 2 till 2,2 gram per kilo kroppsvikt. Det gör alltså inget om du går över målet – tvärtom.
          </p>
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

export default ProteinInfoModal;
