
import React from 'react';
import { CheckCircleIcon, SparklesIcon, ChartLineIcon, CourseIcon, PlusIcon } from './icons.tsx';

interface OnboardingCompletionScreenProps {
  onFinish: () => void;
  coachName: string;
}

const OnboardingCompletionScreen: React.FC<OnboardingCompletionScreenProps> = ({ onFinish, coachName }) => {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
      <div className="text-center">
        <CheckCircleIcon className="w-20 h-20 text-primary mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-neutral-dark mb-3">Välkommen till din nya hälsoresa!</h2>
        <p className="text-lg text-neutral-dark mb-6">
          Du är nu redo att ta kontroll över din hälsa. Här är ett par saker för att komma igång på bästa sätt.
        </p>
      </div>

      <div className="space-y-6 text-base text-neutral-dark">
        <div className="flex items-start space-x-4 p-4 bg-primary-100/50 rounded-lg">
          <SparklesIcon className="w-8 h-8 text-primary mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg text-primary-darker">Din Personliga AI-Coach</h3>
            <p>
              Din coach "{coachName}" är redo att ge dig daglig feedback och de insikter du behöver för att lyckas.
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-4 p-4 bg-secondary-100/50 rounded-lg">
          <ChartLineIcon className="w-8 h-8 text-secondary mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg text-secondary-darker">En Vana för Framgång: Veckomätning</h3>
            <p>
              För att följa dina framsteg rekommenderar vi starkt att du väger dig <strong>en gång i veckan</strong>.
              För absolut bästa resultat, använd en avancerad våg (som InBody) som mäter både din <strong>fettmassa och muskelmassa</strong>. Detta ger en mycket tydligare bild av din utveckling än bara vikten.
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-4 p-4 bg-[#F1EAE0]/60 rounded-lg">
          <CourseIcon className="w-8 h-8 text-[#D96E4A] mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg text-[#56524D]">Ta Nästa Steg med Kursen Praktisk Viktkontroll</h3>
            <p>
              För en djupare förståelse och ännu bättre resultat, överväg vår kurs "Praktisk Viktkontroll". Nya lektioner låses upp när du bygger din streak. Läs mer om kursen genom att klicka på kurs i huvudmenyn.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-[#E8EFE9] border border-[#2B3B2C]/20 rounded-xl flex items-center justify-center sm:justify-start">
        <div className="bg-primary text-white p-2 rounded-full mr-4 shadow-sm flex-shrink-0">
            <PlusIcon className="w-6 h-6" />
        </div>
        <p className="text-neutral-dark font-medium">
            Tryck på ➕-knappen för att prata med din coach eller logga mat.
        </p>
      </div>

      <div className="mt-10 text-center">
        <button
          onClick={onFinish}
          className="w-full sm:w-auto px-10 py-4 bg-primary text-white text-xl font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform interactive-transition"
        >
          Kom igång!
        </button>
      </div>
    </div>
  );
};

export default OnboardingCompletionScreen;
