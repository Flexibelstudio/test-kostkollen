
import React, { useState, useEffect } from 'react';
import { UserProfileData, UserCourseProgress, BootcampParticipant, GoalSettings, WeightLogEntry, WeeklyCalorieBank } from '../types';
import { CourseIcon, SparklesIcon, CheckCircleIcon, VenusIcon, BalanceScaleIcon, InformationCircleIcon, ArrowRightIcon, ShieldCheckIcon, CoachAvatar } from './icons';
import CourseInfoModal from './course/CourseInfoModal';
import BootcampLandingView from './BootcampLandingView';
import BootcampDashboard from './BootcampDashboard';
import { getUserActiveBootcamp, abortBootcamp } from '../services/bootcampService';
import { cancelCourse } from '../services/firestoreService';
import { courseLessons, menopauseCourseLessons } from '../courseData';
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
  weightLogs: WeightLogEntry[];
  weeklyBank: WeeklyCalorieBank;
  onNavigateToCourse: (courseId: CourseInfo['id']) => void;
  /** Öppnar lektion 1 i läsläge för en låst kurs. */
  onPreviewLesson: (courseId: CourseInfo['id']) => void;
  onSaveProfileAndGoals: (profile: UserProfileData, goals: GoalSettings) => Promise<void>;
  onSaveWeightLog: (data: Omit<WeightLogEntry, 'id'>) => Promise<void>;
  onCourseAborted: () => Promise<void>;
  ensureYesterdayProcessed?: (uid: string, now?: Date, options?: any, manualLogOverride?: any, prefetchedWater?: number) => Promise<void>;
  activeBootcamp: BootcampParticipant | null;
  initialOpenBootcamp?: boolean;
  onBootcampStateChange?: (isOpen: boolean) => void;
  /** Truppens flöde, renderat av App. Skickas vidare till Bootcampvyn. */
  bootcampFeedSlot?: React.ReactNode;
}

const CourseCard: React.FC<{
  course: CourseInfo;
  onActivate: () => void;
  onShowInfo: () => void;
  onAbort?: () => void;
  hasStarted: boolean;
  isLocked?: boolean;
  lockedReason?: string;
  isBootcamp?: boolean;
  lessonTitles?: string[];
  onPreview?: () => void;
}> = ({ course, onActivate, onShowInfo, onAbort, hasStarted, isLocked, lockedReason, isBootcamp, lessonTitles, onPreview }) => {

  const baseClasses = `bg-white dark:bg-[#2B2825] p-6 rounded-[22px] shadow-soft-xl border border-[#F1EAE0] dark:border-[#484440] flex flex-col h-full relative overflow-hidden group transition-all duration-300 ${isLocked ? 'opacity-75' : 'hover:scale-[1.01]'}`;

  const titleClasses = "text-2xl font-serif font-medium text-[#56524D] dark:text-[#FAF6EF] mb-2";
  const descClasses = "text-[#7A756E] dark:text-[#C2BCB4] text-base leading-relaxed mb-4";
  const iconContainerClasses = `w-20 h-20 rounded-2xl flex items-center justify-center ${isLocked ? 'bg-[#F1EAE0] text-[#7A756E]' : 'bg-[#F6E2D9] text-[#D96E4A]'}`;

  return (
    <div className={baseClasses}>
        {isBootcamp && (
            <div className="absolute top-0 right-0 bg-[#D96E4A] text-white text-xs font-medium px-3.5 py-1.5 rounded-bl-xl tracking-wide">
                12 veckor
            </div>
        )}
        <div className="flex flex-col items-center text-center flex-grow mb-6">
            <div className="relative mb-4">
                <div className={iconContainerClasses}>
                    {isBootcamp ? (
                        <CoachAvatar coachKey="borje" className="w-full h-full rounded-2xl" />
                    ) : (
                        <course.Icon className="w-10 h-10" />
                    )}
                </div>
                {hasStarted && (
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#2B2825] rounded-full p-1 shadow-sm">
                        <CheckCircleIcon className="w-6 h-6 text-[#D96E4A]" />
                    </div>
                )}
                {isLocked && (
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#2B2825] rounded-full p-1 shadow-sm">
                        <svg className="w-6 h-6 text-[#7A756E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                )}
            </div>
            
            <h3 className={titleClasses}>{course.title}</h3>
            
            <p className={descClasses}>
                {course.cardDescription}
            </p>

            <button
                onClick={onShowInfo}
                className={`text-sm font-medium flex items-center gap-1 mt-auto interactive-transition ${'text-[#D96E4A] hover:text-[#C05A38] hover:underline'}`}
            >
                <InformationCircleIcon className="w-4 h-4"/> Läs mer om kursen
            </button>
        </div>

        <div className={`mt-auto pt-4 border-t flex flex-col gap-2 ${'border-[#F1EAE0] dark:border-[#484440]'}`}>
            {isLocked ? (
                <div className="w-full flex flex-col gap-3">
                    {lessonTitles && lessonTitles.length > 0 && (
                        <div className="text-left">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#7A756E] mb-2">
                                {lessonTitles.length} lektioner ingår
                            </p>
                            <ul className="space-y-1.5">
                                {lessonTitles.slice(0, 4).map((title, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-[#56524D] dark:text-[#C2BCB4]">
                                        <span className="text-[#D96E4A] font-bold flex-shrink-0">{i + 1}.</span>
                                        <span className="leading-snug">{title}</span>
                                    </li>
                                ))}
                            </ul>
                            {lessonTitles.length > 4 && (
                                <p className="text-sm text-[#7A756E] mt-1.5 pl-5">…och {lessonTitles.length - 4} till</p>
                            )}
                        </div>
                    )}
                    <div className={`w-full py-2.5 px-4 flex flex-col items-center justify-center text-center rounded-2xl border ${'bg-[#F1EAE0] border-[#F1EAE0] text-[#7A756E]'}`}>
                        <span className="text-sm font-bold mb-0.5">Låst</span>
                        <span className="text-xs">{lockedReason}</span>
                    </div>
                    {onPreview && (
                        <button
                            onClick={onPreview}
                            className="w-full py-3 px-6 flex items-center justify-center gap-2 font-medium rounded-full border-2 border-[#D96E4A] text-[#D96E4A] hover:bg-[#F6E2D9] active:scale-95 transform transition-all"
                        >
                            Läs lektion 1 gratis
                            <ArrowRightIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            ) : (
                <button
                    onClick={onActivate}
                    className="w-full py-3.5 px-6 flex items-center justify-center gap-2 font-medium rounded-full shadow-md active:scale-95 transform transition-all bg-[#D96E4A] hover:bg-[#C05A38] text-white"
                >
                    {hasStarted ? "Fortsätt kursen" : "Starta kursen"}
                    <ArrowRightIcon className="w-5 h-5" />
                </button>
            )}
            {hasStarted && onAbort && !isLocked && (
                <div className="mt-2 text-center">
                    <button
                        onClick={onAbort}
                        className={`text-xs underline transition-colors ${'text-[#7A756E] hover:text-[#56524D]'}`}
                    >
                        Avsluta {'kurs'}
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};


export const CoursesView: React.FC<CoursesViewProps> = ({ userProfile, goals, userProgress, weightLogs, weeklyBank, onNavigateToCourse, onPreviewLesson, onSaveProfileAndGoals, onSaveWeightLog, onCourseAborted, ensureYesterdayProcessed, activeBootcamp, initialOpenBootcamp, onBootcampStateChange, bootcampFeedSlot }) => {
  const [selectedCourseForInfo, setSelectedCourseForInfo] = useState<CourseInfo | null>(null);
  const [showBootcampLanding, setShowBootcampLanding] = useState(initialOpenBootcamp || false);
  const [courseToAbort, setCourseToAbort] = useState<CourseInfo | null>(null);
  const [isAborting, setIsAborting] = useState(false);

  useEffect(() => {
    if (initialOpenBootcamp) {
      setShowBootcampLanding(true);
    }
  }, [initialOpenBootcamp]);

  useEffect(() => {
    if (onBootcampStateChange) {
      onBootcampStateChange(showBootcampLanding);
    }
  }, [showBootcampLanding, onBootcampStateChange]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleJoinSuccess = async (profileUpdates: UserProfileData, goalUpdates: GoalSettings) => {
    await onSaveProfileAndGoals(profileUpdates, goalUpdates);
    // App.tsx listens to active bootcamp changes, so it will update automatically
  };

  const handleAbortConfirm = async () => {
    if (!courseToAbort || !auth.currentUser) return;
    
    setIsAborting(true);
    try {
      if (courseToAbort.id === 'bootcamp' && activeBootcamp) {
        await abortBootcamp(auth.currentUser.uid, activeBootcamp.cohortId);
        // App.tsx listens to active bootcamp changes, so it will update automatically
      } else {
        await cancelCourse(auth.currentUser.uid, courseToAbort.id as 'praktisk-viktkontroll' | 'maxa-klimakteriet');
        await onCourseAborted();
      }
    } catch (error) {
      console.error("Error aborting course:", error);
      alert("Ett fel uppstod när kursen skulle avbrytas.");
    } finally {
      setIsAborting(false);
      setCourseToAbort(null);
    }
  };

  if (showBootcampLanding) {
    if (activeBootcamp) {
      return <BootcampDashboard participant={activeBootcamp} userProfile={userProfile} goals={goals} weightLogs={weightLogs} weeklyBank={weeklyBank} onBack={() => setShowBootcampLanding(false)} ensureYesterdayProcessed={ensureYesterdayProcessed} onSaveProfileAndGoals={onSaveProfileAndGoals} onSaveWeightLog={onSaveWeightLog} bootcampFeedSlot={bootcampFeedSlot} />;
    }
    return <BootcampLandingView onBack={() => setShowBootcampLanding(false)} userProfile={userProfile} goals={goals} onJoinSuccess={handleJoinSuccess} onSaveWeightLog={onSaveWeightLog} />;
  }

  const handleActivateCourse = (courseId: CourseInfo['id'], hasStarted: boolean) => {
    if (!hasStarted) {
      const isPvStarted = !!userProgress['lektion1']?.unlockedAt;
      const isMkStarted = !!userProgress['m-lektion1']?.unlockedAt;
      const isBootcampStarted = !!activeBootcamp;

      if (courseId !== 'praktisk-viktkontroll' && isPvStarted) {
          alert("Du kan bara gå en kurs/bootcamp i taget. Avsluta din pågående kurs för att starta en ny.");
          return;
      }
      if (courseId !== 'maxa-klimakteriet' && isMkStarted) {
          alert("Du kan bara gå en kurs/bootcamp i taget. Avsluta din pågående kurs för att starta en ny.");
          return;
      }
      if (courseId !== 'bootcamp' && isBootcampStarted) {
          alert("Du kan bara gå en kurs/bootcamp i taget. Avsluta din pågående kurs för att starta en ny.");
          return;
      }
    }

    if (courseId === 'bootcamp') {
      setShowBootcampLanding(true);
    } else {
      onNavigateToCourse(courseId);
    }
  };

  return (
    <>
        <div className="animate-fade-in flex flex-col gap-3 pb-28 sm:pb-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {ALL_COURSES.map(course => {
                let hasStarted = false;
                let isLocked = false;
                let lockedReason = '';

                if (course.id === 'praktisk-viktkontroll') {
                  hasStarted = !!userProgress['lektion1']?.unlockedAt;
                  if (!userProfile.hasCompletedBootcamp && !hasStarted) {
                    isLocked = true;
                    lockedReason = 'Slutför en Bootcamp för att låsa upp denna kurs.';
                  }
                } else if (course.id === 'maxa-klimakteriet') {
                  hasStarted = !!userProgress['m-lektion1']?.unlockedAt;
                } else if (course.id === 'bootcamp') {
                  hasStarted = !!activeBootcamp; 
                }

                return (
                    <CourseCard
                        key={course.id}
                        course={course}
                        onActivate={() => handleActivateCourse(course.id, hasStarted)}
                        onShowInfo={() => setSelectedCourseForInfo(course)}
                        onAbort={hasStarted ? () => setCourseToAbort(course) : undefined}
                        hasStarted={hasStarted} 
                        isLocked={isLocked}
                        lockedReason={lockedReason}
                        isBootcamp={course.id === 'bootcamp'}
                        lessonTitles={
                          course.id === 'praktisk-viktkontroll' ? courseLessons.map(l => l.title)
                          : course.id === 'maxa-klimakteriet' ? menopauseCourseLessons.map(l => l.title)
                          : undefined
                        }
                        onPreview={isLocked && course.id !== 'bootcamp' ? () => onPreviewLesson(course.id) : undefined}
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
        
        {courseToAbort && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-neutral-darker rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                    <h3 className="text-xl font-bold text-neutral-dark mb-4">Avbryt {courseToAbort.title}?</h3>
                    <p className="text-neutral mb-6">
                        Är du säker på att du vill avbryta? 
                        {courseToAbort.id === 'bootcamp' 
                            ? " Om du avbryter bootcampen måste du köpa den igen för att starta om." 
                            : " All din framsteg i kursen kommer att raderas och du kan börja om från början."}
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setCourseToAbort(null)}
                            className="flex-1 py-3 rounded-xl font-semibold text-neutral-dark bg-neutral-light/50 hover:bg-neutral-light transition-colors"
                            disabled={isAborting}
                        >
                            Ångra
                        </button>
                        <button 
                            onClick={handleAbortConfirm}
                            className="flex-1 py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center"
                            disabled={isAborting}
                        >
                            {isAborting ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                "Ja, avbryt"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};
