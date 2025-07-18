

import React from 'react';
import { InformationCircleIcon, XMarkIcon, CameraIcon, UploadIcon, SearchIcon, FireIcon, CheckCircleIcon, LeafIcon, ProteinIcon, BarcodeIcon, TrophyIcon } from './icons.tsx';

interface InfoModalProps {
  onClose: () => void;
  userName?: string;
}

const InfoModal: React.FC<InfoModalProps> = ({ onClose, userName }) => {
  const FeatureItem: React.FC<{icon: React.ReactNode, title: string, children: React.ReactNode}> = ({ icon, title, children }) => (
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0 mt-1">{icon}</div>
      <div>
        <h4 className="text-xl font-semibold text-neutral-dark">{title}</h4>
        <p className="text-neutral text-base">{children}</p>
      </div>
    </div>
  );
  
  const welcomeMessage = userName ? `Välkommen till kostloggen, ${userName}!` : "Välkommen till kostloggen!";

  return (
    <div 
        className="bg-white p-6 sm:p-8 rounded-xl shadow-soft-xl border border-neutral-light max-h-[90vh] overflow-y-auto custom-scrollbar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <InformationCircleIcon className="w-8 h-8 text-primary mr-3" />
          <h2 id="info-modal-title" className="text-3xl font-bold text-neutral-dark">{welcomeMessage}</h2>
        </div>
        <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-md hover:bg-red-100 active:scale-90 transform transition-transform"
            aria-label="Stäng informationsrutan"
        >
            <XMarkIcon className="w-7 h-7" />
        </button>
      </div>

      <p className="text-lg text-neutral mb-8">
        Kostloggen är din personliga assistent för att enkelt logga dina måltider, hålla koll på ditt näringsintag, använda en flexibel veckobudget med vår 'Sparpott', få coachning, delta i kurs och nå dina hälsomål. Så här fungerar det:
      </p>

      <div className="space-y-6">
        <FeatureItem icon={<span className="text-2xl w-6 text-center">➕</span>} title="Logga Måltider Mångsidigt">
          Använd plus-knappen (➕) nere till höger för snabbåtkomst! Skanna en streckkod (<BarcodeIcon className="w-5 h-5 inline-block" />), ta ett foto (<CameraIcon className="w-5 h-5 inline-block" />), ladda upp en bild (<UploadIcon className="w-5 h-5 inline-block" />), sök efter livsmedel med text (<SearchIcon className="w-5 h-5 inline-block" />), eller hitta och logga hela recept (📖). Appen föreslår näringsinnehåll som du kan granska och logga (<CheckCircleIcon className="w-5 h-5 inline-block text-primary" />).
        </FeatureItem>
        
        <FeatureItem icon={<span className="text-2xl w-6 text-center">🤖</span>} title="AI-Driven Näringsanalys">
          Vid foto- och textsökning får du en AI-driven uppskattning av kalorier (kcal), protein (g), kolhydrater (g) och fett (g) för dina måltider.
        </FeatureItem>

        <FeatureItem icon={<span className="text-2xl w-6 text-center">🧍‍♂️</span>} title="Personlig Profil & Mål">
          Under "Min Profil" (🧍‍♂️) anger du dina grunddata och önskade förändringar i fett/muskelmassa. Baserat på detta beräknar appen ett primärt mål (t.ex. fettminskning) och rekommenderade dagsmål för kalorier (<span role="img" aria-label="Kalorier">🔥</span>), protein (<span role="img" aria-label="Protein">💪</span>), kolhydrater (<span role="img" aria-label="Kolhydrater">🍞</span>) och fett (<span role="img" aria-label="Fett">🥑</span>). Du kan sedan justera dessa mål manuellt.
        </FeatureItem>

        <FeatureItem 
            icon={<span className="text-2xl w-6 text-center">🏦</span>} 
            title="Flexibel Sparpott (Veckovis)"
        >
            Ät smart och spara! Kalorier du har kvar (inom ett hälsosamt intervall) i slutet av dagen läggs automatiskt till din veckovisa 'Sparpott'. Använd dessa sparade kalorier för att unna dig något extra senare i veckan. Sparpotten nollställs varje måndag.
        </FeatureItem>
        
        <FeatureItem icon={<span className="text-2xl w-6 text-center">📆</span>} title="Automatisk Dagavslutning, Streaks & Nivåer">
            Varje dag vid midnatt utvärderas din logg. För att bygga din streak (dagar i rad du når målet) och låsa upp nya nivåer (t.ex. 🌱, 🥉, 🥇), behöver du äta inom ett hälsosamt kaloriintervall – varken för lågt, eller över ditt dagliga mål (efter eventuell användning av sparpotten). Kalorier som blir över (inom det hälsosamma intervallet) hamnar i din Sparpott!
        </FeatureItem>

        <FeatureItem icon={<span className="text-2xl w-6 text-center">🧭</span>} title="Följ din Resa">
          Under "Min resa" (🧭) kan du följa dina framsteg över tid. Se en kalenderöversikt över uppnådda mål och en detaljerad vy av din viktutveckling med diagram för vikt, muskel- och fettmassa. Du kan logga din vikt och kroppssammansättning (från t.ex. en InBody-våg) här.
        </FeatureItem>
        
        <FeatureItem icon={<TrophyIcon className="w-6 h-6 text-accent" />} title="Bragder och Belöningar">
          Lås upp 'Bragder' genom att nå milstolpar som att hålla en lång streak, slutföra kursen eller nå dina övergripande mål. Visa dina framsteg under "Min Resa" och fira dina framgångar!
        </FeatureItem>

        <FeatureItem icon={<span className="text-2xl w-6 text-center">🧠</span>} title="Din AI Coach">
           Få personlig feedback, tips och uppmuntran från din AI Coach (🧠). Coachen analyserar din logg, dina mål och eventuella kursframsteg för att ge dig relevant stöd.
        </FeatureItem>

        <FeatureItem icon={<span className="text-2xl w-6 text-center">🎓</span>} title="Kurs: Praktisk Viktkontroll">
          Som ett tillval kan du få tillgång till vår djupgående kurs 'Praktisk Viktkontroll'. Kursen är ett kraftfullt verktyg för att bygga hållbara vanor och få en djupare förståelse för din hälsoresa. Kursen är en separat tjänst och måste aktiveras av din coach. När den är aktiv, låser du upp nya lektioner genom att bygga din dagliga streak.
        </FeatureItem>

         <FeatureItem icon={<span className="text-2xl w-6 text-center">📖</span>} title="Upptäck Recept">
          Sök efter receptidéer direkt i appen. Få förslag med ingredienser, instruktioner och uppskattade näringsvärden. Logga enkelt en eller flera portioner av receptet.
        </FeatureItem>

        <FeatureItem icon={<span className="text-2xl w-6 text-center">💧</span>} title="Logga Vattenintag">
          Håll koll på hur mycket vatten du dricker varje dag för att säkerställa god hydrering.
        </FeatureItem>

        <FeatureItem icon={<span className="text-2xl w-6 text-center">📌</span>} title="Spara Vanliga Val">
          Spara måltider du ofta äter som 'Vanliga val'. Du kan antingen markera en måltid som 'vanligt val' direkt när du loggar den (via kryssrutan med 📌-ikonen), eller spara en redan loggad måltid från din dagbok via dess pushpin-ikon (📌).
        </FeatureItem>

      </div>

      <div className="mt-10 pt-6 border-t border-neutral-light/70 text-center">
        <button
          onClick={onClose}
          className="px-8 py-3 bg-primary text-white text-lg font-semibold rounded-lg shadow-md hover:bg-primary-darker focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 active:scale-95 transform"
        >
          Jag förstår!
        </button>
      </div>
    </div>
  );
};

export default InfoModal;