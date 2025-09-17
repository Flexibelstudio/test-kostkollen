import React from 'react';
import { UserProfileData } from '../types';
import { CourseIcon, SparklesIcon, CheckCircleIcon } from './icons';

export interface CourseInfo {
  id: 'praktisk-viktkontroll' | 'maxa-klimakteriet';
  title: string;
  description: string;
  longDescription: string;
  price: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

export const ALL_COURSES: CourseInfo[] = [
  {
    id: 'praktisk-viktkontroll',
    title: 'Praktisk Viktkontroll',
    description: 'Lär dig bygga hållbara vanor för kost och hälsa med vår grundkurs.',
    longDescription: 'Ta din hälsoresa till nästa nivå med vår exklusiva kurs. Få tillgång till 12 lektioner fyllda med kunskap och verktyg för att bygga hållbara vanor. Nya lektioner låses upp genom att du bygger din dagliga streak, vilket gör lärandet till en motiverande del av din resa.',
    price: '295 kr',
    Icon: CourseIcon,
  },
  {
    id: 'maxa-klimakteriet',
    title: 'Maxa Klimakteriet',
    description: 'Få verktygen för att hantera och optimera din hälsa under klimakteriet.',
    longDescription: 'Den här kursen är för dig som vill förstå och hantera de fysiska och mentala förändringarna under klimakteriet. Vi går igenom kost, träning och livsstilsstrategier för att du ska må så bra som möjligt under denna nya fas i livet. Nya lektioner låses upp sekventiellt när du slutför den föregående, så du kan ta kursen i din egen takt.',
    price: '295 kr',
    Icon: SparklesIcon,
  },
];

interface CoursesViewProps {
  userProfile: UserProfileData;
  onNavigateToCourse: (courseId: CourseInfo['id']) => void;
  onExpressInterest: (courseId: CourseInfo['id']) => void;
}

const CourseCard: React.FC<{
  course: CourseInfo;
  userProfile: UserProfileData;
  isActive: boolean;
  onActivate: () => void;
}> = ({ course, userProfile, isActive, onActivate }) => {
    let interestShown = false;
    let statusText = "";
    if (course.id === 'praktisk-viktkontroll' && userProfile.courseInterest) {
        interestShown = true;
        statusText = "Inväntar godkännande";
    }
    if (course.id === 'maxa-klimakteriet' && userProfile.menopauseCourseInterest) {
        interestShown = true;
        statusText = "Inväntar godkännande";
    }

  return (
    <div className="bg-white p-6 rounded-xl shadow-soft-lg border border-neutral-light flex flex-col justify-between min-h-[320px]">
      <div>
        <div className="flex items-center mb-3">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
            <course.Icon className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-neutral-dark">{course.title}</h3>
        </div>
        <p className="text-neutral-dark mb-4 text-sm">{course.longDescription}</p>
      </div>
      <div className="mt-auto pt-4">
        {isActive ? (
          <button
            onClick={onActivate}
            className="w-full px-6 py-3 bg-primary hover:bg-primary-darker text-white font-semibold rounded-lg shadow-md active:scale-95 transform transition-all"
          >
            Fortsätt kursen
          </button>
        ) : (
          interestShown ? (
             <button
              disabled
              className="w-full inline-flex justify-center items-center px-6 py-3 bg-green-200 text-green-800 font-semibold rounded-lg shadow-sm cursor-not-allowed"
            >
              <CheckCircleIcon className="w-5 h-5 mr-2" />
              {statusText}
            </button>
          ) : (
             <button
              onClick={onActivate}
              className="w-full px-6 py-3 bg-secondary hover:bg-secondary-darker text-white font-semibold rounded-lg shadow-md active:scale-95 transform transition-all"
            >
              Visa intresse
            </button>
          )
        )}
      </div>
    </div>
  );
};


export const CoursesView: React.FC<CoursesViewProps> = ({ userProfile, onNavigateToCourse, onExpressInterest }) => {
  const activeCourses = ALL_COURSES.filter(course => {
    if (course.id === 'praktisk-viktkontroll') return userProfile.isCourseActive;
    if (course.id === 'maxa-klimakteriet') return userProfile.menopauseCourseActive; // Future proofing
    return false;
  });

  const discoverCourses = ALL_COURSES.filter(course => !activeCourses.some(ac => ac.id === course.id));

  return (
    <div className="animate-fade-in space-y-8">
      
      <section>
        <div className="bg-white p-6 rounded-xl shadow-soft-lg border border-neutral-light">
          <h2 className="text-2xl font-semibold text-neutral-dark mb-4">Dina Aktiva Kurser</h2>
          {activeCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeCourses.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  userProfile={userProfile}
                  isActive={true}
                  onActivate={() => onNavigateToCourse(course.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-neutral text-center py-4">Du har inga aktiva kurser just nu.</p>
          )}
        </div>
      </section>
      
      {discoverCourses.length > 0 && (
          <section>
             <div className="bg-white p-6 rounded-xl shadow-soft-lg border border-neutral-light">
              <h2 className="text-2xl font-semibold text-neutral-dark mb-4">Upptäck Fler Kurser</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {discoverCourses.map(course => (
                  <CourseCard
                      key={course.id}
                      course={course}
                      userProfile={userProfile}
                      isActive={false}
                      onActivate={() => onExpressInterest(course.id)}
                  />
                  ))}
              </div>
            </div>
          </section>
      )}
    </div>
  );
};
