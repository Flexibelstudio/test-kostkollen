import React from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from './icons';

interface InfoPopoverModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Liten förklaringsruta för info-knapparna på startsidans kort.
 *
 * Ligger på z-140, samma nivå som matbetyget, så den alltid hamnar över
 * det som redan är öppet.
 */
export const InfoPopoverModal: React.FC<InfoPopoverModalProps> = ({ title, onClose, children }) => {
  return createPortal(
    <div
      className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[140] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#2B2825] w-full max-w-sm rounded-[22px] shadow-soft-xl p-5 animate-scale-in max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-serif font-medium text-[#56524D] dark:text-[#FAF6EF]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mr-1.5 -mt-1 text-[#7A756E] hover:text-[#56524D] rounded-full hover:bg-neutral-light transition-colors flex-shrink-0"
            aria-label="Stäng"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2.5 text-sm text-[#56524D] dark:text-[#C2BCB4] leading-relaxed">
          {children}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-5 px-6 py-2.5 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-darker active:scale-95 interactive-transition"
        >
          Jag förstår
        </button>
      </div>
    </div>,
    document.body
  );
};

export default InfoPopoverModal;
