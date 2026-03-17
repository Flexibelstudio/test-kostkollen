
import React, { useState, useEffect } from 'react';
import { UserProfileData, UserCourseProgress, BootcampParticipant } from '../types';
import { CourseIcon, SparklesIcon, CheckCircleIcon, VenusIcon, BalanceScaleIcon, InformationCircleIcon, ArrowRightIcon, ShieldCheckIcon } from './icons';
import CourseInfoModal from './course/CourseInfoModal';
import BootcampLandingView from './BootcampLandingView';
import BootcampDashboard from './BootcampDashboard';
import { getUserActiveBootcamp } from '../services/bootcampService';
import { auth } from '../firebase';

export interface Review {
  quote: string;
  fullText: string;
  author: string;
}

export interface CourseInfo {
  id: 'praktisk-viktkontroll' | 'maxa-klimakteriet' | 'bootcamp';
  title: string;
  cardDescription: string;
  longDescription: string;
  whatYouGet: string[];
  howItWorks: string;
  forWhom: string;
  reviews?: Review[];
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

export const ALL_COURSES: CourseInfo[] = [
  {
    id: 'bootcamp',
    title: 'General Börjes 12-veckors Bootcamp',
    cardDescription: 'En stenhård kickstart för fettnedgång. 12 veckor av disciplin, svett och resultat. Antingen kör du solo eller mönstrar in i en trupp.',
    longDescription: 'Detta är inget för veklingar. General Börjes Bootcamp är designat för att krossa fettet med disciplin och tydliga regler. Du loggar allt, du når dina mål, och du gör det varje dag.',
    whatYouGet: [
        'En 12-veckors strukturerad plan uppdelad i faser.',
        'Stenhård uppföljning av kalorier, protein, vatten och steg.',
        'Daglig kvällsrapport till General Börje.',
        'Möjlighet att köra solo eller i en gemensam trupp med chatt.'
    ],
    howItWorks: 'Du måste uppfylla alla dagliga krav för att få en "Grön Dag". Klarar du 14 gröna dagar i rad låser du upp nästa fas. Misslyckas du bryts din streak och du får börja om (eller rädda den med en retroaktiv loggning).',
    forWhom: 'För dig som vill ha snabba resultat, tydliga regler och en spark i baken.',
    Icon: ShieldCheckIcon,
  },
  {
    id: 'praktisk-viktkontroll',
    title: 'Praktisk Viktkontroll',
    cardDescription: 'Ta din hälsoresa till nästa nivå. Få tillgång till 12 lektioner fyllda med kunskap och verktyg för att bygga hållbara vanor. Nya lektioner låses upp genom att du bygger din dagliga streak.',
    longDescription: 'Ta din hälsoresa till nästa nivå med vår exklusiva kurs. \'Praktisk Viktkontroll\' är designad för dig som vill ha verklig och hållbar förändring, inte bara en tillfällig lösning. Här får du kunskapen och verktygen för att bygga vanor som håller livet ut.',
    whatYouGet: [
        'En komplett resa som guidar dig vecka för vecka.',
        'Lär dig allt från att sätta realistiska mål till att hantera platåer och sociala utmaningar.',
        'Fokus ligger på att bygga en livsstil du trivs med, inte på strikta dieter.',
        'Kursen är integrerad med din logg och dina framsteg i appen.'
    ],
    howItWorks: 'Vi tror på att lärande och handling går hand i hand. därför låser du upp nya lektioner genom att bygga din dagliga streak. När du har hållit din streak in 7 nya dagar låses nästa lektion upp. På så sätt blir lärandet en motiverande och integrerad del av din resa.',
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
    cardDescription: 'Förstå och hantera förändringarna under klimakteriet. Lär dig om kost, träning och livsstilsstrategier för att må så bra som möjligt. En ny lektion låses upp varje vecka.',
    longDescription: 'Den här kursen är för dig som vill förstå och hantera de fysiska och mentala förändringarna under klimakteriet. Vi går igenom kost, träning och livsstilsstrategier för att du ska må så bra som möjligt under denna nya fas i livet.',
    whatYouGet: [
        'Fokus på hormonell balans.',
        'Strategier för att bibehålla muskelmassa och skeletthälsa.',
        'Hantering av specifika symtom som vallningar och sömnproblem.',
        'Kunskap för att känna dig stark och energifylld.'
    ],
    howItWorks: 'En ny lektion låses upp varje vecka, så du kan ta till dig kunskapen i lugn och ro och applicera den i din vardag.',
    forWhom: 'För kvinnor i eller på väg in i klimakteriet som vill ta ett proaktivt grepp om sin hälsa och sitt välmående.',
    Icon: VenusIcon,
  },
];

interface CoursesViewProps {
  userProfile: UserProfileData;
  goals: GoalSettings;
  userProgress: UserCourseProgress;
  onNavigateToCourse: (courseId: CourseInfo['id']) => void;
  onSaveProfileAndGoals: (profile: UserProfileData, goals: GoalSettings) => Promise<void>;
}

const CourseCard: React.FC<{
  course: CourseInfo;
  onActivate: () => void;
  onShowInfo: () => void;
  hasStarted: boolean;
}> = ({ course, onActivate, onShowInfo, hasStarted }) => {

  return (
    <div className="bg-white dark:bg-neutral-darker p-6 rounded-3xl shadow-soft-xl border border-neutral-light flex flex-col h-full relative overflow-hidden group hover:scale-[1.01] transition-all duration-300">
        <div className="flex flex-col items-center text-center flex-grow mb-6">
            <div className="relative mb-4">
                {/* Updated Icon Container to Squircle (rounded-2xl) */}
                <div className="w-20 h-20 bg-neutral-light/50 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                    <course.Icon className="w-10 h-10" />
                </div>
                {hasStarted && (
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-neutral-darker rounded-full p-1 shadow-sm">
                        <CheckCircleIcon className="w-6 h-6 text-primary" />
                    </div>
                )}
            </div>
            
            <h3 className="text-2xl font-extrabold text-neutral-dark mb-2">{course.title}</h3>
            
            <p className="text-neutral text-base leading-relaxed mb-4">
                {course.cardDescription}
            </p>

            <button
                onClick={onShowInfo}
                className="text-sm font-semibold text-primary hover:text-primary-darker hover:underline flex items-center gap-1 mt-auto interactive-transition"
            >
                <InformationCircleIcon className="w-4 h-4"/> Läs mer om kursen
            </button>
        </div>

        <div className="mt-auto pt-4 border-t border-neutral-light/50">
            <button
                onClick={onActivate}
                className={`w-full py-4 flex items-center justify-center gap-2 font-bold rounded-2xl shadow-md active:scale-95 transform transition-all ${
                    hasStarted 
                    ? 'bg-secondary hover:bg-secondary-darker text-white' 
                    : 'bg-primary hover:bg-primary-darker text-white'
                }`}
            >
                {hasStarted ? "Fortsätt kursen" : "Starta kursen"}
                <ArrowRightIcon className="w-5 h-5" />
            </button>
        </div>
    </div>
  );
};


export const CoursesView: React.FC<CoursesViewProps> = ({ userProfile, goals, userProgress, onNavigateToCourse, onSaveProfileAndGoals }) => {
  const [selectedCourseForInfo, setSelectedCourseForInfo] = useState<CourseInfo | null>(null);
  const [showBootcampLanding, setShowBootcampLanding] = useState(false);
  const [activeBootcamp, setActiveBootcamp] = useState<BootcampParticipant | null>(null);
  const [isLoadingBootcamp, setIsLoadingBootcamp] = useState(true);

  const fetchBootcamp = async () => {
    if (auth.currentUser) {
      const participant = await getUserActiveBootcamp(auth.currentUser.uid);
      setActiveBootcamp(participant);
    }
    setIsLoadingBootcamp(false);
  };

  useEffect(() => {
    fetchBootcamp();
  }, []);

  const handleJoinSuccess = async (profileUpdates: UserProfileData, goalUpdates: GoalSettings) => {
    await onSaveProfileAndGoals(profileUpdates, goalUpdates);
    await fetchBootcamp(); // Refresh bootcamp status
  };

  if (showBootcampLanding) {
    if (activeBootcamp) {
      return <BootcampDashboard participant={activeBootcamp} userProfile={userProfile} goals={goals} onBack={() => setShowBootcampLanding(false)} />;
    }
    return <BootcampLandingView onBack={() => setShowBootcampLanding(false)} userProfile={userProfile} goals={goals} onJoinSuccess={handleJoinSuccess} />;
  }

  return (
    <>
        <div className="animate-fade-in flex flex-col gap-3 pb-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {ALL_COURSES.map(course => {
                let hasStarted = false;
                if (course.id === 'praktisk-viktkontroll') {
                  hasStarted = !!userProgress['lektion1']?.unlockedAt;
                } else if (course.id === 'maxa-klimakteriet') {
                  hasStarted = !!userProgress['m-lektion1']?.unlockedAt;
                } else if (course.id === 'bootcamp') {
                  hasStarted = !!activeBootcamp; 
                }

                return (
                    <CourseCard
                        key={course.id}
                        course={course}
                        onActivate={() => {
                          if (course.id === 'bootcamp') {
                            setShowBootcampLanding(true);
                          } else {
                            onNavigateToCourse(course.id);
                          }
                        }}
                        onShowInfo={() => setSelectedCourseForInfo(course)}
                        hasStarted={hasStarted} 
                    />
                );
            })}
            </div>
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
