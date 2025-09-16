import React from 'react';
import { XMarkIcon } from './icons';

interface UpdateNoticeModalProps {
  show: boolean;
  onClose: () => void;
}

const UpdateNoticeModal: React.FC<UpdateNoticeModalProps> = ({ show, onClose }) => {
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
        <div className="text-center mb-4 flex-shrink-0">
          <span className="text-5xl" role="img" aria-label="Sparkles">✨</span>
          <h2 id="update-notice-title" className="text-2xl font-bold text-neutral-dark mt-2">
            Kostloggen har blivit ännu smartare!
          </h2>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-grow">
            <p className="text-base text-neutral-dark mb-6">
                Hej! Vi har jobbat hårt med att göra Kostloggen ännu smartare, och vi tackar för ditt tålamod om du märkt av några störningar under tiden. Nu är vi glada att kunna presentera flera spännande uppdateringar som gör din hälsoresa ännu enklare och mer insiktsfull.
            </p>

            <div className="space-y-4 text-left">
                <div className="flex items-start gap-4 p-3 bg-primary-100/50 rounded-lg">
                    <span className="text-3xl mt-1">🤖</span>
                    <div>
                        <h3 className="font-semibold text-neutral-dark">Din nya AI-Coach är här!</h3>
                        <p className="text-sm text-neutral-dark">
                            Vi introducerar din personliga AI-coach. Du kan nu chatta direkt för att få snabba svar, be om en graf över din viktutveckling, eller få en analys av din vecka. Du hittar coachen under "Min Resa".
                        </p>
                    </div>
                </div>
                 <div className="flex items-start gap-4 p-3 bg-secondary-100/50 rounded-lg">
                    <span className="text-3xl mt-1">🧭</span>
                    <div>
                        <h3 className="font-semibold text-neutral-dark">En mer fokuserad "Min Resa"</h3>
                        <p className="text-sm text-neutral-dark">
                            För att göra det enklare har vi samlat allt som rör dina framsteg under fliken "Min Resa". Den gamla "Utveckling"-fliken är borttagen, och den kraftfulla AI-analysen du är van vid finns nu här istället, redo att diskuteras med din nya coach.
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <div className="mt-6 text-center flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform interactive-transition"
          >
            Grymt, jag förstår!
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNoticeModal;