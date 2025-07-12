import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { User } from '@firebase/auth';
import { PastDaysSummaryCollection, PastDaySummary, WeightLogEntry, UserProfileData, GoalType, GoalSettings, ActivityLevel, Achievement, TimelineEvent } from '../types';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, PencilIcon, ChartLineIcon, SparklesIcon, FireIcon, ProteinIcon, LeafIcon, UserCircleIcon, InformationCircleIcon, CheckIcon, BookOpenIcon, TrophyIcon, BarcodeIcon, PersonIcon, UserGroupIcon } from './icons';
import WeightChart from './WeightChart.tsx'; 
import { calculateGoalTimeline, TimelineMilestone } from '../utils/timelineUtils.ts';
import GamificationCard from './GamificationCard.tsx';
import GoalTimeline from './JourneyGoalTimeline.tsx';
import ProfileAndGoalEditor from './JourneyProfileEditor.tsx';
import AchievementsView from './AchievementsView.tsx';
import BuddySystemView from './BuddySystemView.tsx';
import { fetchTimelineForCurrentUser } from '../services/firestoreService';
import { auth } from '../firebase';


interface JourneyViewProps {
  pastDaysData: PastDaysSummaryCollection;
  weightLogs: WeightLogEntry[];
  userProfile: UserProfileData;
  goals: GoalSettings;
  onSaveProfileAndGoals: (profile: UserProfileData, goals: GoalSettings) => void;
  onOpenLogWeightModal: () => void;
  playAudio: (sound: any, volume?: number) => void;
  onUpdateSimpleDayStatus: (dateStr: string, metGoal: boolean) => Promise<void>;
  viewingDate: Date;
  setViewingDate: (date: Date) => void;
  currentDate: Date;
  initialTab: 'weight' | 'calendar' | 'profile' | 'achievements';
  highestStreak: number;
  highestLevelId: string | null;
  minSafeCalories: number;
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  achievements: Achievement[];
  unlockedAchievements: { [id: string]: string };
}
type Tab = 'measurements' | 'overview' | 'goals' | 'achievements';


const getLocalISODateString = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "ERROR_INVALID_DATE";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); 
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(d.setDate(diff));
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getISOWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNumber;
};

const shortDayNamesSwedish = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const TabButton: React.FC<{label: string, isActive: boolean, onClick: () => void}> = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      className={`flex items-center justify-center px-4 py-3 text-sm sm:text-base font-semibold rounded-t-lg border-b-4 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-primary/50
        ${isActive 
          ? 'border-primary text-primary' 
          : 'border-transparent text-neutral hover:text-primary'
        }`}
    >
      {label}
    </button>
);

const StatCard: React.FC<{
    title: string;
    value: string;
    change?: { text: string; colorClass: string };
    icon: React.ReactNode;
    colorClass: string;
}> = ({ title, value, change, icon, colorClass }) => (
    <div className="bg-white p-4 rounded-xl shadow-soft-lg border border-neutral-light/70 flex items-center space-x-4 h-full">
        <div className={`p-3 rounded-full ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-neutral">{title}</p>
            <p className="text-xl font-bold text-neutral-dark">{value}</p>
            {change && <p className={`text-sm font-semibold mt-1 ${change.colorClass}`}>{change.text}</p>}
        </div>
    </div>
);


export const JourneyView: React.FC<JourneyViewProps> = (props) => {
  const { 
      pastDaysData, weightLogs, userProfile, goals, onSaveProfileAndGoals, 
      onOpenLogWeightModal, playAudio, onUpdateSimpleDayStatus, 
      viewingDate, setViewingDate, currentDate,
      initialTab, highestStreak, highestLevelId, minSafeCalories,
      setToastNotification, achievements, unlockedAchievements
  } = props;

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if(initialTab === 'weight') return 'measurements';
    if(initialTab === 'calendar') return 'overview';
    if(initialTab === 'profile') return 'goals';
    if(initialTab === 'achievements') return 'achievements';
    return 'measurements';
  });

  const [selectedDateForStatusChange, setSelectedDateForStatusChange] = useState<string | null>(null);
  const [showStatusChangeModal, setShowStatusChangeModal] = useState<boolean>(false);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);
  
  const timeline = useMemo(() => calculateGoalTimeline(userProfile), [userProfile]);
  
  const validPastDaysArray = useMemo(() => Object.values(pastDaysData).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [pastDaysData]);
  const validPastDaysDataCollection: PastDaysSummaryCollection = useMemo(() => validPastDaysArray.reduce((acc, summary) => ({ ...acc, [summary.date]: summary }), {}), [validPastDaysArray]);
  
  const weeksMap = useMemo(() => {
    const map = new Map<string, (PastDaySummary | null)[]>();
    if (validPastDaysArray.length > 0) {
      let earliestDate = new Date(validPastDaysArray[validPastDaysArray.length - 1].date);
      let latestDate = new Date(validPastDaysArray[0].date);
      let currentWeekStart = getStartOfWeek(latestDate);
      const earliestWeekStart = getStartOfWeek(earliestDate);
      while (currentWeekStart >= earliestWeekStart) {
        const weekDays: (PastDaySummary | null)[] = Array.from({ length: 7 }, (_, i) => {
          const day = addDays(currentWeekStart, i);
          return validPastDaysDataCollection[getLocalISODateString(day)] || null;
        });
        map.set(getLocalISODateString(currentWeekStart), weekDays);
        currentWeekStart = addDays(currentWeekStart, -7);
      }
    }
    return map;
  }, [validPastDaysArray, validPastDaysDataCollection]);
  
  const todayISO = useMemo(() => getLocalISODateString(currentDate), [currentDate]);

  useEffect(() => {
    if (activeTab === 'achievements') {
        const loadTimeline = async () => {
            if (!auth.currentUser) return;
            setIsLoadingTimeline(true);
            try {
                const events = await fetchTimelineForCurrentUser(auth.currentUser.uid, achievements);
                setTimelineEvents(events);
            } catch (error) {
                console.error("Failed to load timeline for achievements view:", error);
                setToastNotification({ message: 'Kunde inte ladda data för bragder.', type: 'error' });
            } finally {
                setIsLoadingTimeline(false);
            }
        };
        loadTimeline();
    }
  }, [activeTab, achievements, setToastNotification]);


  const handleDateSelect = (date: Date) => {
    playAudio('uiClick');
    const dateStr = getLocalISODateString(date);
    const appEffectiveDateStr = getLocalISODateString(currentDate);
    const yesterdayStr = getLocalISODateString(addDays(currentDate, -1));
    
    if (dateStr === yesterdayStr && dateStr < appEffectiveDateStr) {
      setSelectedDateForStatusChange(dateStr);
      setShowStatusChangeModal(true);
    } else {
      setShowStatusChangeModal(false);
      setSelectedDateForStatusChange(null);
      setViewingDate(date);
    }
  };

  const handleConfirmStatusChange = async (metGoal: boolean) => {
    if (selectedDateForStatusChange) {
      await onUpdateSimpleDayStatus(selectedDateForStatusChange, metGoal);
      setShowStatusChangeModal(false);
      setViewingDate(new Date(selectedDateForStatusChange));
      setSelectedDateForStatusChange(null);
    }
  };
  
  const latestWeightLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
  const previousWeightLog = weightLogs.length > 1 ? weightLogs[weightLogs.length - 2] : null;

  const latestWeight = latestWeightLog?.weightKg;
  const latestMuscle = latestWeightLog?.skeletalMuscleMassKg;
  const latestFat = latestWeightLog?.bodyFatMassKg;

  let weightChange: number | undefined;
  let muscleChange: number | undefined;
  let fatChange: number | undefined;

  if (latestWeightLog && previousWeightLog) {
      weightChange = latestWeightLog.weightKg - previousWeightLog.weightKg;
      if (latestWeightLog.skeletalMuscleMassKg != null && previousWeightLog.skeletalMuscleMassKg != null) {
          muscleChange = latestWeightLog.skeletalMuscleMassKg - previousWeightLog.skeletalMuscleMassKg;
      }
      if (latestWeightLog.bodyFatMassKg != null && previousWeightLog.bodyFatMassKg != null) {
          fatChange = latestWeightLog.bodyFatMassKg - previousWeightLog.bodyFatMassKg;
      }
  }
  
    const formatChange = (change: number | undefined, invertColors: boolean = false): { text: string; colorClass: string } | undefined => {
        if (change === undefined || change === null || isNaN(change)) {
            return undefined;
        }

        if (Math.abs(change) < 0.05) {
            return { text: '±0,0 kg', colorClass: 'text-neutral' };
        }

        const sign = change > 0 ? '+' : '';
        const formattedValue = `${sign}${change.toFixed(1).replace('.', ',')} kg`;

        let colorClass = 'text-neutral';
        if (change > 0) {
            colorClass = invertColors ? 'text-red-600' : 'text-green-600';
        } else if (change < 0) {
            colorClass = invertColors ? 'text-green-600' : 'text-red-600';
        }
        
        return { text: formattedValue, colorClass };
    };


  return (
    <>
      <div className="animate-fade-in">
        <div className="flex items-center mb-6">
          <ChartLineIcon className="w-8 h-8 text-primary mr-3" />
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-dark">Min Resa</h1>
        </div>
            
        <div className="space-y-6">
            <section aria-labelledby="journey-summary-heading">
                <h2 id="journey-summary-heading" className="sr-only">Sammanfattning av resan</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard 
                        title="Vikt" 
                        value={latestWeight ? `${latestWeight.toFixed(1)} kg` : 'N/A'} 
                        change={formatChange(weightChange, true)}
                        icon={<PersonIcon className="w-6 h-6 text-primary-darker"/>} 
                        colorClass="bg-primary-100" 
                    />
                    {latestMuscle != null && (
                        <StatCard 
                            title="Muskler" 
                            value={latestMuscle ? `${latestMuscle.toFixed(1)} kg` : 'N/A'} 
                            change={formatChange(muscleChange, false)}
                            icon={<ProteinIcon className="w-6 h-6 text-secondary-darker"/>} 
                            colorClass="bg-secondary-100"
                        />
                    )}
                    {latestFat != null && (
                        <StatCard 
                            title="Fett" 
                            value={latestFat ? `${latestFat.toFixed(1)} kg` : 'N/A'} 
                            change={formatChange(fatChange, true)}
                            icon={<FireIcon className="w-6 h-6 text-accent-darker"/>} 
                            colorClass="bg-accent/30"
                        />
                    )}
                </div>
                 <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onOpenLogWeightModal}
                        className="flex-1 px-5 py-3 bg-primary hover:bg-primary-darker text-white font-semibold rounded-lg shadow-soft-lg active:scale-95 interactive-transition flex items-center justify-center"
                    >
                        Logga ny mätning
                    </button>
                </div>
            </section>

            <div className="bg-white p-2 sm:p-4 rounded-xl shadow-soft-lg border border-neutral-light">
              <nav className="border-b border-neutral-light -mx-2 sm:-mx-4 px-2 sm:px-4 mb-4">
                  <div role="tablist" className="flex items-center justify-around sm:justify-start sm:space-x-4">
                      <TabButton label="Utveckling" isActive={activeTab === 'measurements'} onClick={() => setActiveTab('measurements')} />
                      <TabButton label="Översikt" isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                      <TabButton label="Mål" isActive={activeTab === 'goals'} onClick={() => setActiveTab('goals')} />
                      <TabButton label="Bragder" isActive={activeTab === 'achievements'} onClick={() => setActiveTab('achievements')} />
                  </div>
              </nav>

              {activeTab === 'overview' && (
              <div className="animate-fade-in bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light">
                 <h3 className="text-xl font-semibold text-neutral-dark mb-3">Kalenderöversikt</h3>
                  {validPastDaysArray.length === 0 ? (
                  <p className="text-center text-neutral-dark mt-6">Ingen historik tillgänglig. Börja logga för att se dina framsteg!</p>
                  ) : (
                  Array.from(weeksMap.entries()).map(([weekKey, weekDays]) => (
                      <div key={weekKey} className="mb-4">
                      <h4 className="text-base font-semibold text-neutral-dark mb-1.5 ml-1">
                          Vecka {getISOWeekNumber(new Date(weekKey))}
                      </h4>
                      <div className="grid grid-cols-7 gap-1 sm:gap-2">
                          {weekDays.map((daySummary, index) => {
                            const dateForCell = addDays(new Date(weekKey), index);
                            const cellDateISO = getLocalISODateString(dateForCell);
                            const isToday = cellDateISO === todayISO;
                            const isFutureDay = cellDateISO > todayISO;
                            const isActionable = !isToday && !isFutureDay;
                            const isViewingCell = cellDateISO === getLocalISODateString(viewingDate);
                            const waterGoalWasMet = daySummary?.waterGoalMet === true;

                            let cellBgColor = 'bg-neutral-light border-gray-300 hover:bg-gray-200';
                            if (daySummary) {
                                cellBgColor = daySummary.goalMet ? 'bg-primary-100 border-primary hover:bg-primary-200' : 'bg-secondary-100 border-secondary hover:bg-secondary-200';
                            } else if (isToday) {
                                cellBgColor = 'bg-accent/30 border-accent';
                            } else if (isFutureDay) {
                                cellBgColor = 'bg-gray-200 border-gray-300';
                            }
                            
                            let ringClass = '';
                            if (isToday) {
                                // Don't add another ring if today is also the viewing date
                                ringClass = 'ring-2 ring-offset-1 ring-accent';
                            } else if (isViewingCell) {
                                ringClass = 'ring-2 ring-offset-1 ring-accent-darker';
                            }


                          return (
                              <div key={index} className="flex justify-center relative">
                                <button
                                  onClick={() => handleDateSelect(dateForCell)}
                                  disabled={!isActionable}
                                  className={`w-10 h-14 sm:w-12 sm:h-16 flex flex-col items-center justify-around rounded-lg border-2 transition-all duration-150 group p-0.5
                                    ${cellBgColor}
                                    ${ringClass}
                                    ${!isActionable ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                                  `}
                                >
                                  {/* Day name */}
                                  <span className="text-xs font-bold text-neutral-dark">{shortDayNamesSwedish[(dateForCell.getDay() + 6) % 7]}</span>
                                  
                                  {/* Icons container */}
                                  <div className="flex justify-center items-center w-full px-1" style={{ height: '12px' }}>
                                    {daySummary ? (
                                      <>
                                        <div className="w-3 h-3 flex items-center justify-center">
                                          {daySummary.proteinGoalMet && <span role="img" aria-label="Proteinmål uppnått" title="Proteinmål uppnått" className="text-xs">💪</span>}
                                        </div>
                                      </>
                                    ) : (
                                      <div style={{height: '12px'}}></div> /* Placeholder */
                                    )}
                                  </div>

                                  {/* Date number */}
                                  <span className="text-lg font-bold text-neutral-dark">{dateForCell.getDate()}</span>
                                </button>
                                {waterGoalWasMet && (
                                    <div 
                                        className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-3/5 h-[3px] bg-blue-400 rounded-full"
                                        title="Vattenmål uppnått"
                                    ></div>
                                )}
                              </div>
                          )
                          })}
                      </div>
                      </div>
                  ))
                  )}
              </div>
              )}
              {activeTab === 'measurements' && (
              <div className="animate-fade-in space-y-6">
                  <WeightChart data={weightLogs} />
                   <GamificationCard
                      goals={goals}
                      minSafeCalories={minSafeCalories}
                      highestStreak={highestStreak}
                      highestLevelId={highestLevelId}
                  />
              </div>
              )}
              {activeTab === 'goals' && (
                  <div className="animate-fade-in space-y-6">
                       <GoalTimeline 
                          milestones={timeline.milestones}
                          paceFeedback={timeline.paceFeedback}
                          weightLogs={weightLogs}
                          goalType={userProfile.goalType}
                          currentAppDate={currentDate}
                      />
                      <ProfileAndGoalEditor 
                          initialProfile={userProfile}
                          initialGoals={goals}
                          onSave={onSaveProfileAndGoals}
                      />
                  </div>
              )}
              {activeTab === 'achievements' && (
                  <div className="animate-fade-in space-y-6">
                      <AchievementsView
                          userProfile={userProfile}
                          achievements={achievements}
                          unlockedAchievements={unlockedAchievements}
                          timelineEvents={timelineEvents}
                          setToastNotification={setToastNotification}
                      />
                  </div>
              )}
            </div>
        </div>
      </div>
      {showStatusChangeModal && selectedDateForStatusChange && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowStatusChangeModal(false)}>
              <div className="bg-white p-6 rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-bold mb-4">Ändra Status</h3>
                  <p>Uppfyllde du dina mål för {new Date(selectedDateForStatusChange).toLocaleDateString('sv-SE')}?</p>
                  <div className="flex justify-end gap-4 mt-4">
                      <button onClick={() => handleConfirmStatusChange(true)} className="px-4 py-2 bg-green-500 text-white rounded">Ja</button>
                      <button onClick={() => handleConfirmStatusChange(false)} className="px-4 py-2 bg-red-500 text-white rounded">Nej</button>
                      <button onClick={() => setShowStatusChangeModal(false)} className="px-4 py-2 bg-gray-300 rounded">Avbryt</button>
                  </div>
              </div>
          </div>
      )}
    </>
  );
};
