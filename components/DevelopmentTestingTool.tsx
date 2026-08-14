
import React from 'react';

interface DevelopmentTestingToolProps {
  onSimulateSuccessfulDay: () => void;
  onSimulateUnsuccessfulDay: () => void;
  currentDate: string;
}

const DevelopmentTestingTool: React.FC<DevelopmentTestingToolProps> = ({
  onSimulateSuccessfulDay,
  onSimulateUnsuccessfulDay,
  currentDate,
}) => {
  return (
    <section aria-labelledby="dev-tool-heading" className="bg-[#F6E2D9]/50 border-2 border-[#D96E4A] p-5 sm:p-6 rounded-xl shadow-lg mt-8">
      <h2 id="dev-tool-heading" className="text-2xl font-bold text-[#56524D] mb-3 text-center">
        <span role="img" aria-label="Under Construction">🧪</span> Testverktyg för utvecklare <span role="img" aria-label="Warning">⚠️</span>
      </h2>
      <p className="text-center text-[#7A756E] mb-4">
        Nuvarande simulerat datum: <strong>{currentDate}</strong>
      </p>
      <p className="text-sm text-[#7A756E] mb-5 text-center">
        Använd dessa knappar för att snabbt testa streak-, nivå- och sparpottfunktioner. Varje klick simulerar en hel dag och avancerar till nästa.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={onSimulateSuccessfulDay}
          className="flex-1 px-4 py-3 bg-[#2B3B2C] hover:bg-[#1E291F] text-white rounded-lg shadow-md font-medium text-base active:scale-95 transform transition-all flex items-center justify-center"
        >
          Jag klarade dagen ✅
        </button>
        <button
          onClick={onSimulateUnsuccessfulDay}
          className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md font-medium text-base active:scale-95 transform transition-all flex items-center justify-center"
        >
          Jag klarade inte dagen ❌
        </button>
      </div>
    </section>
  );
};

export default DevelopmentTestingTool;
