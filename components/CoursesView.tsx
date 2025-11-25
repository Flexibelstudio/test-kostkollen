import React, { useState } from 'react';
import { UserProfileData } from '../types';
import { CourseIcon, SparklesIcon, CheckCircleIcon, VenusIcon, BalanceScaleIcon, InformationCircleIcon } from './icons';
import CourseInfoModal from './course/CourseInfoModal';

export interface Review {
  quote: string;
  fullText: string;
  author: string;
}

export interface CourseInfo {
  id: 'praktisk-viktkontroll' | 'maxa-klimakteriet';
  title: string;
  cardDescription: string;
  longDescription: string;
  whatYouGet: string[];
  howItWorks: string;
  forWhom: string;
  reviews?: Review[];
  // price removed as courses are now free
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

export const ALL_COURSES: CourseInfo[] = [
  {
    id: 'praktisk-viktkontroll',
    title: 'Praktisk Viktkontroll',
    cardDescription: 'Ta din hälsoresa till nästa nivå med vår exklusiva kurs "Praktisk Viktkontroll". Få tillgång till 12 lektioner fyllda med kunskap och verktyg för att bygga hållbara vanor. Nya lektioner låses upp genom att du bygger din dagliga streak, vilket gör lärandet till en motiverande del av din resa.',
    longDescription: 'Ta din hälsoresa till nästa nivå med vår exklusiva kurs. \'Praktisk Viktkontroll\' är designad för dig som vill ha verklig och hållbar förändring, inte bara en tillfällig lösning. Här får du kunskapen och verktygen för att bygga vanor som håller livet ut.',
    whatYouGet: [
        'En komplett resa som guidar dig vecka för vecka.',
        'Lär dig allt från att sätta realistiska mål till att hantera platåer och sociala utmaningar.',
        'Fokus ligger på att bygga en livsstil du trivs med, inte på strikta dieter.',
        'Kursen är integrerad med din logg och dina framsteg i appen.'
    ],
    howItWorks: 'Vi tror på att lärande och handling går hand i hand. Därför låser du upp nya lektioner genom att bygga din dagliga streak. När du har hållit din streak i 7 nya dagar låses nästa lektion upp. På så sätt blir lärandet en motiverande och integrerad del av din resa.',
    forWhom: 'Perfekt för dig som är trött på jojobantning och vill förstå din kropp bättre för att skapa en långsiktig hälsa och nå dina mål en gång för alla.',
    reviews: [
      {
        quote: '5,5 kg mindre fett - och mer energi än på länge!',
        fullText: 'Att delta i Praktisk viktkontroll var den bästa investeringen jag gjorde under 2024. Med praktisk hjälp och tydliga verktyg har jag bytt ut gamla vanor mot nya, hållbara en i taget. Resultatet? 5,5 kg mindre fett, ökad muskelmassa och en kropp som känns pigg och full av energi!',
        author: 'Isabelle'
      },
      {
        quote: 'Jag känner mig piggare och orkar mer!',
        fullText: 'Jag är jättenöjd med Praktisk viktkontroll, det har gett mig ett helt nytt tänk kring mat och hjälpt mig att planera mina dagar bättre. När jag kombinerade träningen med kostprogrammet märkte jag snabbt skillnad - jag känner mig piggare och har mycket mer energi i vardagen. Jag är supernöjd!',
        author: 'Jana'
      },
      {
        quote: 'Minus 6 kg fett - och en helt ny syn på kost och hälsa!',
        fullText: 'Mitt bästa beslut 2024 var att anmäla mig till Praktisk viktkontroll. Jag fått ett helt nytt sätt att tänka kring kost, hälsa och vanor. Resultatet? Jag har tappat 6 kg fett - och fått verktyg jag kommer bära med mig resten av livet!',
        author: 'Elisabeth'
      }
    ],
    Icon: BalanceScaleIcon,
  },
  {
    id: 'maxa-klimakteriet',
    title: 'Maxa Klimakteriet',
    cardDescription: 'Förstå och hantera de fysiska och mentala förändringarna under klimakteriet. Lär dig om kost, träning och livsstilsstrategier för att må så bra som möjligt under denna nya fas i livet. Nya lektioner låses upp när du slutför den föregående.',
    longDescription: 'Den här kursen är för dig som vill förstå och hantera de fysiska och mentala förändringarna under klimakteriet. Vi går igenom kost, träning och livsstilsstrategier för att du ska må så bra som möjligt under denna nya fas i livet.',
    whatYouGet: [
        'Fokus på hormonell balans.',
        'Strategier för att bibehålla muskelmassa och skeletthälsa.',
        'Hantering av specifika symtom som vallningar och sömnproblem.',
        'Kunskap för att känna dig stark och energifylld.'
    ],
    howItWorks: 'Nya lektioner låses upp sekventiellt när du slutför den föregående, så du kan ta kursen helt i din egen takt utan press.',
    forWhom: 'För kvinnor i eller på väg in i klimakteriet som vill ta ett proaktivt grepp om sin hälsa och sitt välmående.',
    Icon: VenusIcon,
  },
];

interface CoursesViewProps {
  userProfile: UserProfileData;
  onNavigateToCourse: (courseId: CourseInfo['id']) => void;
  onExpressInterest: (courseId: CourseInfo['id']) => void; // Kept for backward compatibility, effectively just opens course now
}

const CourseCard: React.FC<{
  course: CourseInfo;
  onActivate: () => void;
  onShowInfo: () => void;
  hasStarted: boolean;
}> = ({ course, onActivate, onShowInfo, hasStarted }) => {

  return (
    <div className="bg-white p-6 rounded-xl shadow-soft-lg border border-neutral-light flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
            <div className="flex items-center flex-grow">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                    <course.Icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-neutral-dark text-left">{course.title}</h3>
            </div>
            <button
                onClick={onShowInfo}
                className="p-1 text-neutral hover:text-primary rounded-full hover:bg-primary-100/70 flex-shrink-0"
                aria-label={`Mer information om ${course.title}`}
                title={`Mer information om ${course.title}`}
            >
                <InformationCircleIcon className="w-6 h-6"/>
            </button>
        </div>

        <div className="flex-grow flex flex-col text-center">
            <p className="text-neutral-dark text-base leading-relaxed mb-6">
                {course.cardDescription}
            </p>
            
            <div className="mt-auto">
                <button
                    onClick={onActivate}
                    className={`w-full px-6 py-3 font-semibold rounded-lg shadow-md active:scale-95 transform transition-all ${hasStarted ? 'bg-secondary hover:bg-secondary-darker text-white' : 'bg-primary hover:bg-primary-darker text-white'}`}
                >
                    {hasStarted ? "Gå till kursen" : "Starta kursen"}
                </button>
            </div>
        </div>
    </div>
  );
};


export const CoursesView: React.FC<CoursesViewProps> = ({ userProfile, onNavigateToCourse }) => {
  const [selectedCourseForInfo, setSelectedCourseForInfo] = useState<CourseInfo | null>(null);

  const hasStartedCourse = (courseId: string) => {
      // A simple check if they have *any* progress could be done here if we had access to progress.
      // For now, since we removed the "isCourseActive" flag, we can assume all courses are available.
      // The 'started' state is ideally passed from parent, but for UI simplicity:
      // "Starta kursen" is fine for everyone initially.
      return false; 
  };

  return (
    <>
        <div className="animate-fade-in space-y-6">
            <section>
                <div className="bg-primary-100/50 p-4 rounded-xl border border-primary-200 mb-4 text-center">
                    <p className="text-primary-darker font-medium">
                        🎉 Goda nyheter! Alla kurser ingår nu i ditt medlemskap utan extra kostnad.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ALL_COURSES.map(course => (
                    <CourseCard
                        key={course.id}
                        course={course}
                        onActivate={() => onNavigateToCourse(course.id)}
                        onShowInfo={() => setSelectedCourseForInfo(course)}
                        hasStarted={true} // Simplified for now to "Gå till kursen" style or similar
                    />
                ))}
                </div>
            </section>
        </div>
        {selectedCourseForInfo && (
            <CourseInfoModal 
                show={!!selectedCourseForInfo}
                onClose={() => setSelectedCourseForInfo(null)}
                course={selectedCourseForInfo}
            />
        )}
    </>
  );
};