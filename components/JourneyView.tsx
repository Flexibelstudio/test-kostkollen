
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { User } from '@firebase/auth';
import { PastDaysSummaryCollection, PastDaySummary, WeightLogEntry, UserProfileData, GoalType, GoalSettings, ActivityLevel, Achievement, TimelineEvent, AIStructuredFeedbackResponse, CompletedGoal, StreakSaver, Reactions, AIDataForJourneyAnalysis } from '../types';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, PencilIcon, ChartLineIcon, SparklesIcon, UserCircleIcon, InformationCircleIcon, CheckIcon, BookOpenIcon, TrophyIcon, BarcodeIcon, UserGroupIcon, ChevronDownIcon, ChevronUpIcon, ShareIcon, HeartIcon, XMarkIcon, LifebuoyIcon, AICoachIcon } from './icons';
import { User as UserIcon, Dumbbell, PieChart } from 'lucide-react';
import WeightChart from './WeightChart.tsx'; 
import { calculateGoalTimeline, TimelineMilestone } from '../utils/timelineUtils.ts';
import GamificationCard from './GamificationCard.tsx';
import GoalTimeline from './JourneyGoalTimeline.tsx';
import ProfileAndGoalEditor from './JourneyProfileEditor.tsx';
import AchievementsView from './AchievementsView.tsx';
import { fetchTimelineForCurrentUser } from '../services/firestoreService.ts';
import { auth } from '../firebase';
import { playAudio } from '../services/audioService';

interface JourneyViewProps {
  pastDaysData: PastDaysSummaryCollection;
  weightLogs: WeightLogEntry[];
  userProfile: UserProfileData;
  goals: GoalSettings;
  onSaveProfileAndGoals: (profile: UserProfileData, goals: GoalSettings) => void;
  onOpenLogWeightModal: () => void;
  playAudio: (sound: any, volume?: number) => void;
  viewingDate: Date;
  setViewingDate: (date: Date) => void;
  currentDate: Date;
  initialTab: 'calendar' | 'profile' | 'achievements';
  highestStreak: number;
  highestLevelId: string | null;
  minSafeCalories: number;
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  achievements: Achievement[];
  unlockedAchievements: { [id: string]: string };
  achievementInteractions: { [id: string]: { reactions: Reactions } };
  journeyAnalysisFeedback: AIStructuredFeedbackResponse | null;
  onNavigateToMainWithDate: (date: Date) => void;
  streakSaver: StreakSaver | null;
  analysisContext: AIDataForJourneyAnalysis;
  setShowAICoachModal: (show: boolean) => void;
  onDiscussSavedAnalysis: (analysisDate?: string) => void;
}
type Tab = 'overview' | 'goals' | 'achievements';


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

const TabButton: React.FC<{label: string, isActive: boolean, onClick: () => void, notificationCount?: number}> = ({ label, isActive, onClick, notificationCount }) => (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      className={`relative flex-1 py-4 text-center font-semibold border-b-4 transition-colors duration-200
        ${isActive 
          ? 'border-primary text-primary' 
          : 'border-transparent text-neutral hover:border-primary-lighter'
        }`}
    >
      {label}
      {notificationCount && notificationCount > 0 && (
         <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold ring-2 ring-white">
            {notificationCount > 9 ? '9+' : notificationCount}
        </span>
      )}
    </button>
);

const CompactStatCard: React.FC<{
    label: string;
    value: string;
    change?: { text: string; colorClass: string };
    icon: React.ReactElement<{ className?: string }>;
    iconBgColor: string;
    iconColor: string;
}> = ({ label, value, change, icon, iconBgColor, iconColor }) => (
    <div className="bg-white p-3 sm:p-4 rounded-xl shadow-soft-lg border border-neutral-light/70 flex flex-col flex-1 justify-center text-center">
        <div className="flex items-center justify-center text-xs sm:text-sm text-neutral gap-2">
            <div className={`flex-shrink-0 p-1.5 rounded-full ${iconBgColor} ${iconColor}`}>
                {React.cloneElement(icon, { className: "w-4 h-4" })}
            </div>
            <span className="font-semibold">{label}</span>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-neutral-dark mt-1 whitespace-nowrap">{value}</p>
        {change && (
            <p className={`text-xs sm:text-sm font-semibold ${change.colorClass}`}>{change.text}</p>
        )}
    </div>
);


export const JourneyView: React.FC<JourneyViewProps> = (props) => {
  const { 
      pastDaysData, weightLogs, userProfile, goals, onSaveProfileAndGoals, 
      onOpenLogWeightModal, playAudio, 
      viewingDate, setViewingDate, currentDate,
      initialTab, highestStreak, highestLevelId, minSafeCalories,
      setToastNotification, achievements, unlockedAchievements, achievementInteractions, journeyAnalysisFeedback,
      onNavigateToMainWithDate,
      streakSaver,
      analysisContext,
      setShowAICoachModal,
      onDiscussSavedAnalysis
  } = props;

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if(initialTab === 'calendar') return 'overview';
    if(initialTab === 'profile') return 'goals';
    if(initialTab === 'achievements') return 'achievements';
    return 'overview';
  });

  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);
  const [isGamificationCardExpanded, setIsGamificationCardExpanded] = useState(false);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const juneFirst = useMemo(() => new Date(currentYear, 5, 1), [currentYear]); // June 1st of current year

  const validPastDaysArray = useMemo(() => {
    return Object.values(pastDaysData)
      .filter(summary => new Date(summary.date) >= juneFirst)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [pastDaysData, juneFirst]);

  const filteredWeightLogs = useMemo(() => {
    return weightLogs.filter(log => new Date(log.loggedAt) >= juneFirst);
  }, [weightLogs, juneFirst]);
  
  const timeline = useMemo(() => calculateGoalTimeline(userProfile), [userProfile]);
  
    const weeksMap = useMemo(() => {
        const map = new Map<string, (PastDaySummary | null)[]>();
        if (validPastDaysArray.length === 0) return map;

        const summariesByDate = new Map<string, PastDaySummary>(validPastDaysArray.map(s => [s.date, s]));
        const firstDateInLog = new Date(validPastDaysArray[validPastDaysArray.length - 1].date + 'T12:00:00Z');
        const lastDateInLog = new Date(validPastDaysArray[0].date + 'T12:00:00Z');

        let currentWeekStart = getStartOfWeek(lastDateInLog);

        // Ensure we always show the current week, even if it has no logs yet.
        const currentAppWeekStart = getStartOfWeek(new Date(currentDate));
        if(currentWeekStart < currentAppWeekStart) {
            currentWeekStart = currentAppWeekStart;
        }

        const earliestWeekStart = getStartOfWeek(firstDateInLog);

        while (currentWeekStart >= earliestWeekStart) {
            const weekDays: (PastDaySummary | null)[] = [];
            for (let i = 0; i < 7; i++) {
                const day = addDays(currentWeekStart, i);
                if (day > currentDate) {
                    weekDays.push(null); // Future days are null
                } else {
                    weekDays.push(summariesByDate.get(getLocalISODateString(day)) || null); // Return null for unlogged past days
                }
            }
            map.set(getLocalISODateString(currentWeekStart), weekDays);
            currentWeekStart = addDays(currentWeekStart, -7);
        }
        return map;
    }, [validPastDaysArray, currentDate]);

    const monthlyGroupedSummaries = useMemo(() => {
        const grouped = new Map<number, Map<number, { weekStartISO: string; weekData: (PastDaySummary | null)[] }[]>>();
        weeksMap.forEach((weekData, weekStartISO) => {
            const weekStartDate = new Date(weekStartISO + 'T12:00:00Z');
            const year = weekStartDate.getFullYear();
            const month = weekStartDate.getMonth(); // 0-11
    
            if (!grouped.has(year)) {
                grouped.set(year, new Map());
            }
            const yearMap = grouped.get(year)!;
            if (!yearMap.has(month)) {
                yearMap.set(month, []);
            }
            yearMap.get(month)!.push({ weekStartISO, weekData });
        });
        return grouped;
    }, [weeksMap]);

    const currentMonth = currentDate.getMonth();
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    const toggleSection = (key: string) => {
        playAudio('uiClick');
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

  const todayISO = useMemo(() => getLocalISODateString(currentDate), [currentDate]);

  const handleDateSelect = (date: Date) => {
    playAudio('uiClick');
    onNavigateToMainWithDate(date);
  };
  
  const latestWeightLog = filteredWeightLogs.length > 0 ? filteredWeightLogs[filteredWeightLogs.length - 1] : null;
  const previousWeightLog = filteredWeightLogs.length > 1 ? filteredWeightLogs[filteredWeightLogs.length - 2] : null;
  const firstWeightLog = filteredWeightLogs.length > 0 ? filteredWeightLogs[0] : null;

  const latestWeight = latestWeightLog?.weightKg ?? userProfile.currentWeightKg;
  const latestMuscle = latestWeightLog?.skeletalMuscleMassKg ?? userProfile.skeletalMuscleMassKg;
  const latestFat = latestWeightLog?.bodyFatMassKg ?? userProfile.bodyFatMassKg;

  let weightChangeNum: number | undefined;
  let muscleChangeNum: number | undefined;
  let fatChangeNum: number | undefined;

  if (latestWeightLog && previousWeightLog) {
      weightChangeNum = latestWeightLog.weightKg - previousWeightLog.weightKg;
      if (latestWeightLog.skeletalMuscleMassKg != null && previousWeightLog.skeletalMuscleMassKg != null) {
          muscleChangeNum = latestWeightLog.skeletalMuscleMassKg - previousWeightLog.skeletalMuscleMassKg;
      }
      if (latestWeightLog.bodyFatMassKg != null && previousWeightLog.bodyFatMassKg != null) {
          fatChangeNum = latestWeightLog.bodyFatMassKg - previousWeightLog.bodyFatMassKg;
      }
  }

  const formatChangeWithColor = (
    change: number | undefined,
    goalType: GoalType,
    dataType: 'weight' | 'muscle' | 'fat',
    measurementMethod: 'inbody' | 'scale' | undefined,
    muscleChangeForWeight: number | undefined,
    fatChangeForWeight: number | undefined
  ): { text: string; colorClass: string } => {
      if (change === undefined || change === null || isNaN(change)) {
          return { text: '-', colorClass: 'text-neutral' };
      }
  
      if (Math.abs(change) < 0.05) {
          return { text: '±0,0 kg', colorClass: 'text-accent' };
      }
  
      const sign = change > 0 ? '+' : '';
      const formattedValue = `${sign}${change.toFixed(1).replace('.', ',')} kg`;
  
      let colorClass = 'text-neutral';
  
      switch (dataType) {
          case 'muscle':
              if (change > 0) colorClass = 'text-primary-darker'; // always good
              else if (change < 0) colorClass = 'text-red-600'; // always bad
              break;
          case 'fat':
              if (goalType === 'lose_fat') {
                  if (change < 0) colorClass = 'text-primary-darker'; // good
                  else if (change > 0) colorClass = 'text-red-600'; // bad
              }
              break;
          case 'weight':
              if (measurementMethod === 'inbody') {
                  if (change < 0 && fatChangeForWeight !== undefined && fatChangeForWeight < 0) {
                      colorClass = 'text-primary-darker'; // good: weight loss from fat
                  } else if (change > 0 && muscleChangeForWeight !== undefined && muscleChangeForWeight > 0) {
                      colorClass = 'text-primary-darker'; // good: weight gain from muscle
                  } else if (change !== 0) {
                      colorClass = 'text-red-600'; // bad: weight loss from muscle or gain from fat
                  }
              } else { // 'scale'
                  if (change < 0 && (goalType === 'lose_fat' || userProfile.desiredWeightChangeKg && userProfile.desiredWeightChangeKg < 0)) {
                      colorClass = 'text-primary-darker';
                  } else if (change > 0 && (goalType === 'gain_muscle' || userProfile.desiredWeightChangeKg && userProfile.desiredWeightChangeKg > 0)) {
                      colorClass = 'text-primary-darker';
                  } else if (change !== 0) {
                      colorClass = 'text-red-600';
                  }
              }
              break;
      }
      
      return { text: formattedValue, colorClass };
  };

  const weightChangeDetails = formatChangeWithColor(weightChangeNum, userProfile.goalType, 'weight', userProfile.measurementMethod, muscleChangeNum, fatChangeNum);
  const muscleChangeDetails = formatChangeWithColor(muscleChangeNum, userProfile.goalType, 'muscle', userProfile.measurementMethod, undefined, undefined);
  const fatChangeDetails = formatChangeWithColor(fatChangeNum, userProfile.goalType, 'fat', userProfile.measurementMethod, undefined, undefined);

  const { goalProgress, goalProgressText, startValue, targetValue } = useMemo(() => {
    let startValueKg, currentValueKg, goalChangeKg, goalUnit;

    // Determine which metric is the goal
    const isScaleGoal = userProfile.measurementMethod === 'scale' && userProfile.desiredWeightChangeKg;
    const isFatLossGoal = userProfile.desiredFatMassChangeKg && userProfile.desiredFatMassChangeKg < 0;
    const isMuscleGainGoal = userProfile.desiredMuscleMassChangeKg && userProfile.desiredMuscleMassChangeKg > 0;

    if (isFatLossGoal) {
        startValueKg = userProfile.goalStartFatMassKg;
        currentValueKg = latestWeightLog?.bodyFatMassKg;
        goalChangeKg = userProfile.desiredFatMassChangeKg;
        goalUnit = 'kg fett';
    } else if (isMuscleGainGoal) {
        startValueKg = userProfile.goalStartMuscleMassKg;
        currentValueKg = latestWeightLog?.skeletalMuscleMassKg;
        goalChangeKg = userProfile.desiredMuscleMassChangeKg;
        goalUnit = 'kg muskler';
    } else if (isScaleGoal) {
        startValueKg = userProfile.goalStartWeight;
        currentValueKg = latestWeightLog?.weightKg;
        goalChangeKg = userProfile.desiredWeightChangeKg;
        goalUnit = 'kg vikt';
    } else {
        // No active goal or data to calculate progress
        return { goalProgress: 0, goalProgressText: 'Inget aktivt mål', startValue: undefined, targetValue: undefined };
    }
    
    if (startValueKg == null || currentValueKg == null || userProfile.mainGoalCompleted) {
        return { goalProgress: 0, goalProgressText: 'Väntar på mätning', startValue: startValueKg, targetValue: startValueKg != null && goalChangeKg != null ? startValueKg + goalChangeKg : undefined };
    }

    const targetValueKg = startValueKg + goalChangeKg;
    
    // Use absolute values to avoid confusion with signs
    const totalChangeNeeded = Math.abs(goalChangeKg);
    
    let changeAchieved;
    if (goalChangeKg > 0) { // Gain goal
        changeAchieved = currentValueKg - startValueKg;
    } else { // Loss goal
        changeAchieved = startValueKg - currentValueKg;
    }
    
    // Don't show negative progress
    changeAchieved = Math.max(0, changeAchieved);

    if (totalChangeNeeded < 0.01) { // Effectively zero
        return { goalProgress: 100, goalProgressText: 'Mål uppnått', startValue: startValueKg, targetValue: targetValueKg };
    }

    const progressRaw = (changeAchieved / totalChangeNeeded) * 100;
    const progressClamped = Math.max(0, Math.min(progressRaw, 100));
    
    const unit = goalUnit.split(' ')[1] || 'kg';

    return {
        goalProgress: progressClamped,
        goalProgressText: `${currentValueKg.toFixed(1).replace('.',',')} / ${targetValueKg.toFixed(1).replace('.',',')} ${unit}`,
        startValue: startValueKg,
        targetValue: targetValueKg
    };
  }, [latestWeightLog, userProfile]);

  const goalDisplayString = useMemo(() => {
    const { measurementMethod, desiredWeightChangeKg, desiredFatMassChangeKg, desiredMuscleMassChangeKg, goalType, goalCompletionDate } = userProfile;
    const datePart = goalCompletionDate ? ` till ${new Date(goalCompletionDate+'T00:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}` : '';
    
    if (userProfile.mainGoalCompleted) {
        return "Du har nått ditt mål!";
    }

    if (measurementMethod === 'scale' && desiredWeightChangeKg) {
        return `Nå en viktförändring på ${desiredWeightChangeKg > 0 ? '+' : ''}${desiredWeightChangeKg.toFixed(1).replace('.',',')} kg${datePart}`;
    }
    const changes = [];
    if (desiredFatMassChangeKg) {
        changes.push(`${desiredFatMassChangeKg > 0 ? '+' : ''}${desiredFatMassChangeKg.toFixed(1).replace('.',',')} kg fett`);
    }
    if (desiredMuscleMassChangeKg) {
        changes.push(`${desiredMuscleMassChangeKg > 0 ? '+' : ''}${desiredMuscleMassChangeKg.toFixed(1).replace('.',',')} kg muskler`);
    }
    if (changes.length > 0) {
        return `Nå en förändring på ${changes.join(' och ')}${datePart}`;
    }
    
    const goalTypeDisplayMap: Record<GoalType, string> = {
        lose_fat: 'Minska fettmassa / vikt',
        maintain: 'Behålla nuvarande vikt/sammansättning',
        gain_muscle: 'Öka muskelmassa / vikt',
    };
    return goalTypeDisplayMap[goalType];
  }, [userProfile]);

  return (
    <>
      <div className="animate-fade-in relative pb-20">
            
        <div className="space-y-6">
            <section aria-labelledby="journey-summary-heading">
                <h2 id="journey-summary-heading" className="sr-only">Sammanfattning av resan</h2>
                <div className="flex flex-row gap-3">
                    <CompactStatCard 
                        label="Vikt" 
                        value={latestWeight ? `${latestWeight.toFixed(1).replace('.',',')} kg` : 'N/A'} 
                        change={weightChangeDetails}
                        icon={<UserIcon />} 
                        iconBgColor="bg-green-100" 
                        iconColor="text-green-600"
                    />
                    {latestMuscle != null && (
                        <CompactStatCard 
                            label="Muskler" 
                            value={latestMuscle ? `${latestMuscle.toFixed(1).replace('.',',')} kg` : 'N/A'} 
                            change={muscleChangeDetails}
                            icon={<Dumbbell />}
                            iconBgColor="bg-orange-100" 
                            iconColor="text-orange-500"
                        />
                    )}
                    {latestFat != null && (
                        <CompactStatCard 
                            label="Fett" 
                            value={latestFat ? `${latestFat.toFixed(1).replace('.',',')} kg` : 'N/A'} 
                            change={fatChangeDetails}
                            icon={<PieChart />}
                            iconBgColor="bg-yellow-100"
                            iconColor="text-yellow-500"
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
                  <div role="tablist" className="flex items-center justify-around">
                      <TabButton label="Översikt" isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                      <TabButton label="Mål" isActive={activeTab === 'goals'} onClick={() => setActiveTab('goals')} />
                      <TabButton label="Bragder" isActive={activeTab === 'achievements'} onClick={() => setActiveTab('achievements')} />
                  </div>
              </nav>

              <div className="mt-4">
                {activeTab === 'overview' && (() => {
                    const monthNames = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
                    const sortedYears = Array.from(monthlyGroupedSummaries.keys()).sort((a, b) => b - a);

                    return (
                        <div className="space-y-6">
                            {sortedYears.map(year => {
                                const isCurrentYear = year === currentYear;
                                const yearKey = `${year}`;
                                const isYearExpanded = expandedSections.has(yearKey);
                                const monthsMap = monthlyGroupedSummaries.get(year)!;
                                const sortedMonths = Array.from(monthsMap.keys()).sort((a, b) => b - a);

                                const yearContent = (
                                    <div className={`space-y-4 ${!isCurrentYear ? 'pl-4 border-l-2 border-neutral-light/70 ml-2' : ''}`}>
                                        {sortedMonths.map(month => {
                                            const monthKey = `${year}-${month}`;
                                            const isMonthExpanded = expandedSections.has(monthKey);
                                            const weeksData = monthsMap.get(month)!;
                                            const isCurrentMonthInView = year === currentYear && month === currentMonth;

                                            return (
                                                <div key={monthKey}>
                                                    {!isCurrentMonthInView && (
                                                        <button onClick={() => toggleSection(monthKey)} className="w-full flex justify-between items-center text-left p-2 rounded-md hover:bg-neutral-light/70" aria-expanded={isMonthExpanded}>
                                                            <h4 className="text-xl font-semibold text-neutral-dark">{monthNames[month]}</h4>
                                                            <ChevronDownIcon className={`w-6 h-6 text-neutral-dark transition-transform ${isMonthExpanded ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    )}
                                                    {(isMonthExpanded || isCurrentMonthInView) && (
                                                        <div className={`mt-2 space-y-4 animate-fade-in ${isCurrentMonthInView ? '' : 'pl-2'}`}>
                                                            {weeksData.map((week, weekIndex) => {
                                                                const weekStartDate = new Date(week.weekStartISO + 'T12:00:00Z');
                                                                const weekNumber = getISOWeekNumber(weekStartDate);
                                                                return (
                                                                    <div key={`${monthKey}-w${weekIndex}`}>
                                                                        <h5 className="text-base font-semibold text-neutral-dark mb-2">Vecka {weekNumber}</h5>
                                                                        <div className="grid grid-cols-7 gap-1 sm:gap-2">
                                                                            {week.weekData.map((summary, index) => {
                                                                                const dayDate = addDays(weekStartDate, index);
                                                                                const dayISO = getLocalISODateString(dayDate);
                                                                                const isFutureDay = dayDate > currentDate;
                                                                                const isToday = dayISO === todayISO;
                                                                                const isYesterday = dayISO === getLocalISODateString(addDays(currentDate, -1));
                                                                                const isClickable = !isFutureDay;
                                                                                const isViewingThisDay = dayISO === getLocalISODateString(viewingDate);
                                                                                const waterGoalWasMet = summary?.waterGoalMet === true;
                                                                                
                                                                                let bgColor = 'bg-gray-200';
                                                                                let iconColorClass = 'text-gray-700';

                                                                                if (isFutureDay) {
                                                                                    bgColor = 'bg-gray-100';
                                                                                    iconColorClass = 'text-gray-400';
                                                                                } else if (isToday) {
                                                                                    bgColor = 'bg-secondary/30';
                                                                                    iconColorClass = 'text-secondary-darker';
                                                                                } else { // Past day
                                                                                    if (summary) {
                                                                                        if (summary.goalMet) {
                                                                                            bgColor = 'bg-primary/70';
                                                                                            iconColorClass = 'text-white';
                                                                                        } else {
                                                                                            bgColor = 'bg-secondary/70';
                                                                                            iconColorClass = 'text-white';
                                                                                        }
                                                                                    } else { // Past day, no summary
                                                                                        bgColor = 'bg-neutral-light';
                                                                                        iconColorClass = 'text-neutral-dark';
                                                                                    }
                                                                                }

                                                                                return (
                                                                                    <div key={dayISO} className="relative">
                                                                                        <button onClick={() => isClickable && handleDateSelect(dayDate)} disabled={!isClickable} className={`flex flex-col items-center justify-around p-1 rounded-md text-xs sm:text-sm font-medium transition-all aspect-square w-full focus:outline-none ${bgColor} ${isFutureDay ? 'opacity-60' : ''} ${isClickable ? 'cursor-pointer hover:scale-105 active:scale-95 hover:shadow-lg hover:ring-2 hover:ring-secondary' : 'cursor-default'} ${isViewingThisDay ? 'ring-2 ring-offset-1 ring-secondary' : ''}`}>
                                                                                            <span className={`text-xs font-bold ${iconColorClass}`}>{shortDayNamesSwedish[index]}</span>
                                                                                            <div className="flex justify-center items-center w-full px-0.5 space-x-0.5" style={{ height: '16px' }}>
                                                                                                {summary && (
                                                                                                    <>
                                                                                                        <div className="w-4 h-4 flex items-center justify-center">
                                                                                                            {summary.proteinGoalMet && <span role="img" aria-label="Proteinmål uppnått" title="Proteinmål uppnått" className="text-sm">💪</span>}
                                                                                                        </div>
                                                                                                        <div className="w-4 h-4 flex items-center justify-center">
                                                                                                            {summary.savedBy === 'streakSaver' && <LifebuoyIcon className="w-4 h-4 text-secondary" title="Streak räddad"/>}
                                                                                                        </div>
                                                                                                    </>
                                                                                                )}
                                                                                            </div>
                                                                                            <span className={`text-lg font-bold ${iconColorClass}`}>{dayDate.getDate()}</span>
                                                                                        </button>
                                                                                        {waterGoalWasMet && <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-3/5 h-[3px] bg-blue-400 rounded-full" title="Vattenmål uppnått"></div>}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                );

                                if (isCurrentYear) {
                                    return <div key={yearKey}>{yearContent}</div>;
                                } else {
                                    return (
                                        <div key={yearKey}>
                                            <button onClick={() => toggleSection(yearKey)} className="w-full flex justify-between items-center text-left p-2 rounded-md hover:bg-neutral-light/70" aria-expanded={isYearExpanded}>
                                                <h3 className="text-2xl font-bold text-neutral-dark">{year}</h3>
                                                <ChevronDownIcon className={`w-6 h-6 text-neutral-dark transition-transform ${isYearExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isYearExpanded && <div className="mt-2 animate-fade-in">{yearContent}</div>}
                                        </div>
                                    );
                                }
                            })}

                            <GamificationCard
                                goals={goals}
                                minSafeCalories={minSafeCalories}
                                highestStreak={highestStreak}
                                highestLevelId={highestLevelId}
                                streakSaver={streakSaver}
                                isExpanded={isGamificationCardExpanded}
                                onToggle={() => {
                                    playAudio('uiClick');
                                    setIsGamificationCardExpanded(prev => !prev);
                                }}
                            />
                            
                            <div className="bg-white p-4 sm:p-5 rounded-xl shadow-soft-lg border border-neutral-light mt-4">
                                {journeyAnalysisFeedback ? (
                                    <>
                                        <button
                                            onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                                            className="w-full flex justify-between items-center text-left mb-2 group"
                                            aria-expanded={isAnalysisExpanded}
                                            aria-controls="journey-analysis-panel"
                                        >
                                            <div className="flex items-center">
                                                <SparklesIcon className="w-6 h-6 text-secondary mr-2" />
                                                <div>
                                                    <h3 className="text-xl font-semibold text-neutral-dark group-hover:text-secondary transition-colors">AI-analysen från din coach</h3>
                                                    <p className="text-xs text-neutral">
                                                        {new Date(journeyAnalysisFeedback.analysisDate || Date.now()).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric'})}
                                                    </p>
                                                </div>
                                            </div>
                                            {isAnalysisExpanded ? <ChevronUpIcon className="w-6 h-6 text-neutral" /> : <ChevronDownIcon className="w-6 h-6 text-neutral" />}
                                        </button>
                                        {isAnalysisExpanded && (
                                            <div id="journey-analysis-panel" className="mt-4 space-y-4 animate-fade-in">
                                                {journeyAnalysisFeedback.sections.map((section, index) => (
                                                    <div key={index} className="pt-3 border-t border-neutral-light/50">
                                                        <h4 className="text-lg font-bold text-neutral-dark mb-1 flex items-center">
                                                            <span className="text-xl mr-2">{section.emoji}</span>
                                                            {section.title}
                                                        </h4>
                                                        <div className="text-neutral-dark space-y-1 text-sm pl-8">
                                                            {section.content.split('\n').map((line, lineIdx) => (
                                                                <p key={lineIdx}>{line.replace(/•/g, '• ')}</p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                 <div className="mt-4 pt-4 border-t border-neutral-light/50">
                                                    <button
                                                        onClick={() => onDiscussSavedAnalysis(journeyAnalysisFeedback.analysisDate)}
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-base sm:text-lg font-medium text-secondary-darker bg-secondary-100 hover:bg-secondary-200 rounded-md shadow-sm interactive-transition active:scale-95"
                                                    >
                                                        <AICoachIcon className="w-6 h-6 flex-shrink-0"/>
                                                        <span className="text-center">Diskutera analysen med din coach</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center p-4">
                                        <SparklesIcon className="w-10 h-10 text-secondary mx-auto mb-3" />
                                        <h3 className="text-xl font-semibold text-neutral-dark">Personlig Analys från Coachen</h3>
                                        <p className="text-neutral mt-2 text-sm">
                                            Din analys kommer att visas här när du har loggat några dagar och gjort minst två invägningar.
                                        </p>
                                    </div>
                                )}
                            </div>

                        </div>
                    );
                })()}
                
                {activeTab === 'goals' && (
                  <div className="space-y-6">
                    <section aria-labelledby="current-goal-heading">
                        <h3 id="current-goal-heading" className="text-xl font-semibold text-neutral-dark mb-3">Ditt Aktuella Mål</h3>
                        <div className="bg-white p-4 rounded-xl shadow-soft-lg border border-neutral-light/70">
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <p className="text-lg text-neutral-dark font-medium text-center sm:text-left">{goalDisplayString}</p>
                            </div>
                            {!userProfile.mainGoalCompleted && (
                                <div className="mt-3">
                                    <div className="w-full bg-neutral-light rounded-full h-2.5 shadow-inner">
                                        <div className="bg-primary h-2.5 rounded-full" style={{ width: `${goalProgress}%` }}></div>
                                    </div>
                                     <p className="text-right text-sm font-semibold text-primary-darker mt-1">{goalProgress.toFixed(0)}%</p>
                                </div>
                            )}
                        </div>
                    </section>
                    <GoalTimeline milestones={timeline.milestones} paceFeedback={timeline.paceFeedback} weightLogs={filteredWeightLogs} goalType={userProfile.goalType} currentAppDate={currentDate}/>
                    <ProfileAndGoalEditor initialProfile={userProfile} initialGoals={goals} onSave={onSaveProfileAndGoals} />
                    
                    {userProfile.completedGoals && userProfile.completedGoals.length > 0 && (
                        <section aria-labelledby="completed-goals-heading">
                            <h3 id="completed-goals-heading" className="text-xl font-semibold text-neutral-dark mb-3">Uppnådda Huvudmål</h3>
                            <div className="bg-white p-4 rounded-xl shadow-soft-lg border border-neutral-light/70 space-y-3">
                                {[...userProfile.completedGoals]
                                    .sort((a, b) => new Date(b.achievedOn).getTime() - new Date(a.achievedOn).getTime())
                                    .map((goal) => (
                                        <div key={goal.id} className="p-3 bg-primary-100/60 rounded-lg border border-primary-200">
                                            <p className="font-semibold text-primary-darker flex items-center">
                                                <TrophyIcon className="w-5 h-5 mr-2 text-accent" />
                                                {goal.description}
                                            </p>
                                            <p className="text-sm text-neutral-dark pl-7">
                                                Uppnådd den {new Date(goal.achievedOn).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </p>
                                        </div>
                                    ))
                                }
                            </div>
                        </section>
                    )}
                  </div>
                )}
                
                {activeTab === 'achievements' && (
                  <AchievementsView 
                    userProfile={userProfile}
                    achievements={achievements}
                    unlockedAchievements={unlockedAchievements}
                    achievementInteractions={achievementInteractions}
                    setToastNotification={setToastNotification}
                  />
                )}

              </div>
            </div>
        </div>
      </div>
      
      <div className="fixed right-6 bottom-6 z-40">
          <button
            onClick={() => { playAudio('uiClick'); setShowAICoachModal(true); }}
            className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-blue-600 active:scale-95 transform transition-all animate-pulse-blue"
            aria-label="Fråga Flexibot AI-Coach"
          >
            <AICoachIcon className="w-10 h-10" />
          </button>
      </div>

    </>
  );
};