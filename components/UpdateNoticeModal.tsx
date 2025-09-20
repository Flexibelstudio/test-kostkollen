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
        <div className="text-center mb-4 flex-shrink-0">
          <span className="text-5xl" role="img" aria-label="Kvinnosymbol">♀️</span>
          <h2 id="update-notice-title" className="text-2xl font-bold text-neutral-dark mt-2">
            Nyhet: Känn dig stark och må bra genom klimakteriet!
          </h2>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-grow">
          <p className="text-base text-neutral-dark mb-4">
            Hej! Vi vet att klimakteriet är en naturlig fas i livet, men det innebär också stora förändringar för kroppen, ämnesomsättningen och energin. Många känner sig vilsna – men det behöver inte vara så.
          </p>
          <p className="text-base text-neutral-dark mb-6">
            Därför lanserar vi nu vår nya, efterlängtade kurs: <strong>Maxa Klimakteriet!</strong> Den är skapad för att ge dig kunskapen och verktygen du behöver för att inte bara hantera, utan <em>maxa</em> den här perioden i livet.
          </p>

          <div className="space-y-3 text-left bg-primary-100/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-neutral-dark mb-2">I kursen får du lära dig:</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🥗</span>
                <p className="text-neutral-dark"><strong className="font-semibold">Anpassa kosten:</strong> Förstå hur du ska äta för hormonell balans, minskad inflammation och för att behålla din värdefulla muskelmassa.</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">💪</span>
                <p className="text-neutral-dark"><strong className="font-semibold">Träna smartare, inte hårdare:</strong> Upptäck den effektiva styrketräningen som stärker skelettet, boostar ämnesomsättningen och ger dig mer energi.</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🧠</span>
                <p className="text-neutral-dark"><strong className="font-semibold">Hantera symtomen:</strong> Få konkreta strategier för att förbättra sömnen, hantera vallningar och balansera humöret.</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">✨</span>
                <p className="text-neutral-dark"><strong className="font-semibold">Ta kontrollen:</strong> Känn dig starkare, piggare och mer i kontroll över din hälsa än någonsin tidigare.</p>
              </li>
            </ul>
          </div>

          <p className="text-base text-neutral-dark mt-6">
            Det här är din chans att investera i dig själv och navigera klimakteriet med självförtroende. <strong>För endast 295 kr får du livslång tillgång till hela kursen och allt material.</strong>
          </p>
        </div>

        <div className="mt-6 text-center flex-shrink-0 space-y-3">
          {onNavigateToCourses && (
            <button
              onClick={onNavigateToCourses}
              className="w-full sm:w-auto px-8 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform interactive-transition"
            >
              Läs mer & kom igång!
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 text-sm font-medium text-neutral hover:text-neutral-dark hover:bg-neutral-light rounded-lg interactive-transition"
          >
            Kanske senare
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNoticeModal;