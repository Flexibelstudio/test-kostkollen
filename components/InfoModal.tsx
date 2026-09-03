
import React from 'react';
import { InformationCircleIcon, XMarkIcon, CameraIcon, UploadIcon, SearchIcon, FireIcon, CheckCircleIcon, LeafIcon, ProteinIcon, BarcodeIcon, TrophyIcon, LifebuoyIcon, UserGroupIcon, CourseIcon, SparklesIcon, CalendarIcon, ScaleIcon } from './icons.tsx';
import { BookOpen, Droplets, Pin } from 'lucide-react';

interface InfoModalProps {
  onClose: () => void;
  userName?: string;
}

const InfoModal: React.FC<InfoModalProps> = ({ onClose, userName }) => {
  
  const features = [
    {
        icon: <div className="text-2xl">➕</div>,
        color: "bg-[#84A98C]/20 text-[#56524D]",
        title: "Logga Måltider",
        description: "Använd plus-knappen för snabbåtkomst! Fota, skanna streckkod, sök text eller hitta recept. AI hjälper dig med näringsvärden."
    },
    {
        icon: <SparklesIcon className="w-6 h-6" />,
        color: "bg-[#F6E2D9] text-primary",
        title: "AI-Analys & Coach",
        description: "Få automatisk näringsanalys av dina bilder och personlig feedback från din AI-coach i chatten."
    },
    {
        icon: <UserGroupIcon className="w-6 h-6" />,
        color: "bg-neutral-light text-neutral-dark",
        title: "Community",
        description: "Hitta Peppkompisar, dela dina framsteg och stötta varandra för att nå era mål tillsammans."
    },
    {
        icon: <div className="text-2xl">🏦</div>,
        color: "bg-[#F6E2D9] text-primary",
        title: "Sparpott",
        description: "Kalorier du har 'över' på bra dagar sparas till helgen. Unna dig något extra utan att spräcka veckobudgeten!"
    },
    {
        icon: <CourseIcon className="w-6 h-6" />,
        color: "bg-neutral-light text-neutral-dark",
        title: "Kurser",
        description: "Få djupare kunskap genom våra kurser 'Praktisk Viktkontroll' och 'Maxa Klimakteriet'. Ingår i medlemskapet."
    },
    {
        icon: <TrophyIcon className="w-6 h-6" />,
        color: "bg-[#F6E2D9] text-primary",
        title: "Bragder & Streaks",
        description: "Håll igång din streak genom att logga dagligen och lås upp nya nivåer och utmärkelser."
    },
    {
        icon: <Droplets className="w-6 h-6" />,
        color: "bg-neutral-light text-neutral-dark",
        title: "Vattenloggning",
        description: "Håll koll på hydreringen enkelt via dashboarden. Målet anpassas efter dina behov."
    },
    {
        icon: <Pin className="w-6 h-6" />,
        color: "bg-[#F6E2D9] text-primary",
        title: "Vanliga Val",
        description: "Spara dina favoritmåltider för blixtsnabb loggning. Klicka på nålen (📌) när du loggar."
    }
  ];
  
  const welcomeMessage = userName ? `Välkommen, ${userName}!` : "Välkommen till Kostloggen!";

  return (
    <div 
        className="bg-white rounded-3xl shadow-soft-xl border border-neutral-light w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
    >
      {/* Header */}
      <div className="p-6 sm:p-8 pb-4 flex items-start justify-between bg-white z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-primary shadow-sm">
            <InformationCircleIcon className="w-7 h-7" />
          </div>
          <div>
            <h2 id="info-modal-title" className="text-2xl sm:text-3xl font-extrabold text-neutral-dark leading-tight">
                {welcomeMessage}
            </h2>
            <p className="text-sm text-neutral font-medium mt-1">Din guide till en hälsosammare livsstil.</p>
          </div>
        </div>
        <button
            onClick={onClose}
            className="p-2 text-neutral hover:text-red-500 rounded-xl hover:bg-red-50 active:scale-90 transition-all"
            aria-label="Stäng"
        >
            <XMarkIcon className="w-8 h-8" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-grow overflow-y-auto custom-scrollbar p-6 sm:p-8 pt-2">
        <div className="mb-8 p-5 bg-neutral-light/40 rounded-2xl border border-neutral-light">
            <p className="text-base sm:text-lg text-neutral-dark leading-relaxed">
                Kostloggen är din personliga assistent för att enkelt logga måltider, hålla koll på näring, använda en flexibel veckobudget och nå dina hälsomål med stöd av AI och community.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
                <div key={index} className="p-5 rounded-2xl border border-neutral-light hover:border-primary/30 hover:shadow-md transition-all duration-300 bg-white group">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${feature.color} group-hover:scale-110 transition-transform duration-300`}>
                            {feature.icon}
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-neutral-dark mb-1 group-hover:text-primary transition-colors">{feature.title}</h4>
                            <p className="text-sm text-neutral leading-relaxed">{feature.description}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-neutral-light/50 bg-gray-50 flex justify-end">
        <button
          onClick={onClose}
          className="w-full sm:w-auto px-8 py-3.5 bg-neutral-dark text-white text-base font-bold rounded-xl shadow-lg hover:bg-black focus:outline-none focus:ring-4 focus:ring-neutral-300 active:scale-95 transform transition-all"
        >
          Jag förstår, låt oss köra!
        </button>
      </div>
    </div>
  );
};

export default InfoModal;
