
import React, { useMemo, useState } from 'react';
import { PastDaysSummaryCollection, WeightLogEntry, UserProfileData, GoalType, GoalSettings, Achievement, AIStructuredFeedbackResponse, Reactions, AIDataForJourneyAnalysis, StreakSaver } from '../types';
import { PencilIcon, TrophyIcon, AICoachIcon, ChevronDownIcon, ChevronUpIcon, SparklesIcon } from './icons';
import { Dumbbell, PieChart } from 'lucide-react';
import { calculateGoalTimeline } from '../utils/timelineUtils.ts';
import GamificationCard from './GamificationCard.tsx';
import GoalTimeline from './JourneyGoalTimeline.tsx';
import ProfileAndGoalEditor from './JourneyProfileEditor.tsx';
import AchievementsView from './AchievementsView.tsx';

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
type Tab = 'goals' | 'achievements';

export const JourneyView: React.FC<JourneyViewProps> = (props) => {
  const { 
      weightLogs, userProfile, goals, onSaveProfileAndGoals, 
      onOpenLogWeightModal, playAudio, 
      initialTab, highestStreak, highestLevelId, minSafeCalories,
      setToastNotification, achievements, unlockedAchievements, achievementInteractions, journeyAnalysisFeedback,
      setShowAICoachModal,
      onDiscussSavedAnalysis,
  } = props;

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if(initialTab === 'profile') return 'goals';
    if(initialTab === 'achievements') return 'achievements';
    return 'goals'; 
  });

  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);
  const [isGamificationCardExpanded, setIsGamificationCardExpanded] = useState(false);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const juneFirst = useMemo(() => new Date(currentYear, 5, 1), [currentYear]); 

  const filteredWeightLogs = useMemo(() => {
    return weightLogs.filter(log => new Date(log.loggedAt) >= juneFirst);
  }, [weightLogs, juneFirst]);
  
  const timeline = useMemo(() => calculateGoalTimeline(userProfile), [userProfile]);
  
  const latestWeightLog = filteredWeightLogs.length > 0 ? filteredWeightLogs[filteredWeightLogs.length - 1] : null;
  const previousWeightLog = filteredWeightLogs.length > 1 ? filteredWeightLogs[filteredWeightLogs.length - 2] : null;

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

  const { goalProgress, goalDisplayString } = useMemo(() => {
    let startValueKg, currentValueKg, goalChangeKg, goalUnit;

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
        return { goalProgress: 0, goalDisplayString: 'Inget aktivt mål' };
    }
    
    // Display String Logic
    const datePart = userProfile.goalCompletionDate ? ` till ${new Date(userProfile.goalCompletionDate+'T00:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}` : '';
    let displayString = "";
    
    if (userProfile.mainGoalCompleted) {
        displayString = "Du har nått ditt mål!";
    } else if (userProfile.measurementMethod === 'scale' && userProfile.desiredWeightChangeKg) {
        displayString = `Nå en viktförändring på ${userProfile.desiredWeightChangeKg > 0 ? '+' : ''}${userProfile.desiredWeightChangeKg.toFixed(1).replace('.',',')} kg${datePart}`;
    } else {
        const changes = [];
        if (userProfile.desiredFatMassChangeKg) changes.push(`${userProfile.desiredFatMassChangeKg > 0 ? '+' : ''}${userProfile.desiredFatMassChangeKg.toFixed(1).replace('.',',')} kg fett`);
        if (userProfile.desiredMuscleMassChangeKg) changes.push(`${userProfile.desiredMuscleMassChangeKg > 0 ? '+' : ''}${userProfile.desiredMuscleMassChangeKg.toFixed(1).replace('.',',')} kg muskler`);
        if (changes.length > 0) displayString = `Nå en förändring på ${changes.join(' och ')}${datePart}`;
        else displayString = 'Bibehålla nuvarande form';
    }

    if (startValueKg == null || currentValueKg == null || userProfile.mainGoalCompleted) {
        return { goalProgress: 0, goalDisplayString: displayString };
    }

    const totalChangeNeeded = Math.abs(goalChangeKg || 0);
    let changeAchieved;
    if ((goalChangeKg || 0) > 0) { // Gain goal
        changeAchieved = currentValueKg - startValueKg;
    } else { // Loss goal
        changeAchieved = startValueKg - currentValueKg;
    }
    
    changeAchieved = Math.max(0, changeAchieved);

    if (totalChangeNeeded < 0.01) {
        return { goalProgress: 100, goalDisplayString: displayString };
    }

    const progressRaw = (changeAchieved / totalChangeNeeded) * 100;
    return {
        goalProgress: Math.max(0, Math.min(progressRaw, 100)),
        goalDisplayString: displayString
    };
  }, [latestWeightLog, userProfile]);

  return (
    <>
      <div className="animate-fade-in relative pb-0 flex flex-col gap-3">
            
        {/* HERO CARD - BODY COMPOSITION */}
        <div className="bg-white rounded-3xl shadow-soft-xl p-5 border border-neutral-light relative overflow-hidden">
            <div className="flex flex-col items-center">
                <h2 className="text-lg font-bold text-neutral-dark mb-4 uppercase tracking-wide opacity-80">Kroppssammansättning</h2>
                
                {/* Main Metric - Weight */}
                <div className="text-center mb-6">
                    <span className="text-5xl font-extrabold block text-neutral-dark">
                        {latestWeight ? `${latestWeight.toFixed(1).replace('.',',')}` : 'N/A'}
                        <span className="text-2xl ml-1 text-neutral">kg</span>
                    </span>
                    <span className={`text-base font-semibold ${weightChangeDetails.colorClass} bg-neutral-light/50 px-3 py-1 rounded-full mt-2 inline-block`}>
                        {weightChangeDetails.text}
                    </span>
                </div>

                {/* Secondary Metrics */}
                <div className="flex gap-4 w-full justify-center">
                    {latestMuscle != null && (
                        <div className="flex-1 bg-orange-50 rounded-2xl p-3 flex flex-col items-center border border-orange-100">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Dumbbell className="w-4 h-4 text-orange-500" />
                                <span className="text-xs font-bold text-orange-700 uppercase">Muskler</span>
                            </div>
                            <span className="text-xl font-bold text-neutral-dark">
                                {latestMuscle.toFixed(1).replace('.',',')}
                            </span>
                            <span className={`text-xs font-semibold ${muscleChangeDetails.colorClass}`}>
                                {muscleChangeDetails.text}
                            </span>
                        </div>
                    )}
                    
                    {latestFat != null && (
                        <div className="flex-1 bg-yellow-50 rounded-2xl p-3 flex flex-col items-center border border-yellow-100">
                            <div className="flex items-center gap-1.5 mb-1">
                                <PieChart className="w-4 h-4 text-yellow-600" />
                                <span className="text-xs font-bold text-yellow-700 uppercase">Fett</span>
                            </div>
                            <span className="text-xl font-bold text-neutral-dark">
                                {latestFat.toFixed(1).replace('.',',')}
                            </span>
                            <span className={`text-xs font-semibold ${fatChangeDetails.colorClass}`}>
                                {fatChangeDetails.text}
                            </span>
                        </div>
                    )}
                </div>

                <button
                    onClick={onOpenLogWeightModal}
                    className="mt-6 w-full py-3.5 bg-primary hover:bg-primary-darker text-white font-bold rounded-2xl shadow-md active:scale-95 interactive-transition flex items-center justify-center gap-2"
                >
                    <PencilIcon className="w-5 h-5" />
                    Logga mätning
                </button>
            </div>
        </div>

        {/* Tabs & Content */}
        <div className="bg-white p-2 rounded-2xl shadow-soft-lg border border-neutral-light">
            <div className="flex p-1 bg-neutral-light/50 rounded-xl">
                <button
                    onClick={() => setActiveTab('goals')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'goals' ? 'bg-white text-primary shadow-sm' : 'text-neutral hover:text-neutral-dark'}`}
                >
                    Mål & Framsteg
                </button>
                <button
                    onClick={() => setActiveTab('achievements')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'achievements' ? 'bg-white text-primary shadow-sm' : 'text-neutral hover:text-neutral-dark'}`}
                >
                    Bragder
                </button>
            </div>

            <div className="mt-4 p-2">
                {activeTab === 'goals' && (
                    <div className="space-y-3 animate-fade-in">
                        {/* Current Goal Card */}
                        <div className="bg-neutral-light/30 p-4 rounded-2xl border border-neutral-light">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-neutral-dark flex items-center gap-2">
                                    <TrophyIcon className="w-5 h-5 text-accent" />
                                    Ditt Mål
                                </h3>
                                {!userProfile.mainGoalCompleted && (
                                    <span className="text-xs font-bold text-primary bg-white px-2 py-1 rounded-md shadow-sm">
                                        {goalProgress.toFixed(0)}% klart
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-medium text-neutral-dark mb-3">
                                {goalDisplayString}
                            </p>
                            {!userProfile.mainGoalCompleted && (
                                <div className="w-full bg-white rounded-full h-3 shadow-inner overflow-hidden">
                                    <div className="bg-primary h-full rounded-full" style={{ width: `${goalProgress}%` }}></div>
                                </div>
                            )}
                        </div>

                        <GoalTimeline 
                            milestones={timeline.milestones} 
                            paceFeedback={timeline.paceFeedback} 
                            weightLogs={filteredWeightLogs} 
                            goalType={userProfile.goalType} 
                            currentAppDate={new Date()}
                        />
                        
                        <ProfileAndGoalEditor initialProfile={userProfile} initialGoals={goals} onSave={onSaveProfileAndGoals} />
                        
                        <GamificationCard
                            goals={goals}
                            minSafeCalories={minSafeCalories}
                            highestStreak={highestStreak}
                            highestLevelId={highestLevelId}
                            isExpanded={isGamificationCardExpanded}
                            onToggle={() => {
                                playAudio('uiClick');
                                setIsGamificationCardExpanded(prev => !prev);
                            }}
                        />

                        {/* AI Analysis Card */}
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                            {journeyAnalysisFeedback ? (
                                <>
                                    <button
                                        onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                                        className="w-full flex justify-between items-center text-left group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-full shadow-sm">
                                                <SparklesIcon className="w-6 h-6 text-indigo-500" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-indigo-900">Analys från Coachen</h3>
                                                <p className="text-xs text-indigo-700/70">
                                                    {new Date(journeyAnalysisFeedback.analysisDate || Date.now()).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                                                </p>
                                            </div>
                                        </div>
                                        {isAnalysisExpanded ? <ChevronUpIcon className="w-5 h-5 text-indigo-400" /> : <ChevronDownIcon className="w-5 h-5 text-indigo-400" />}
                                    </button>
                                    
                                    {isAnalysisExpanded && (
                                        <div className="mt-4 space-y-4 animate-fade-in border-t border-indigo-100/50 pt-4">
                                            {journeyAnalysisFeedback.sections.map((section, index) => (
                                                <div key={index}>
                                                    <h4 className="text-sm font-bold text-indigo-900 mb-1 flex items-center gap-2">
                                                        <span>{section.emoji}</span>
                                                        {section.title}
                                                    </h4>
                                                    <p className="text-sm text-indigo-800/80 leading-relaxed pl-6">
                                                        {section.content.replace(/\n/g, ' ')}
                                                    </p>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => onDiscussSavedAnalysis(journeyAnalysisFeedback.analysisDate)}
                                                className="w-full mt-2 py-3 bg-white text-indigo-600 font-bold text-sm rounded-xl shadow-sm border border-indigo-100 hover:bg-indigo-50 interactive-transition flex items-center justify-center gap-2"
                                            >
                                                <AICoachIcon className="w-5 h-5" />
                                                Diskutera analysen
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <SparklesIcon className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                                    <p className="text-indigo-900 font-medium">Din analys kommer snart!</p>
                                    <p className="text-xs text-indigo-700/70 mt-1">Logga några dagar till så dyker den upp här.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {activeTab === 'achievements' && (
                    <div className="animate-fade-in">
                        <AchievementsView 
                            userProfile={userProfile}
                            achievements={achievements}
                            unlockedAchievements={unlockedAchievements}
                            achievementInteractions={achievementInteractions}
                            setToastNotification={setToastNotification}
                        />
                    </div>
                )}
            </div>
        </div>
      </div>
      
      {/* FAB for Coach */}
      <div className="fixed right-6 bottom-6 z-40">
          <button
            onClick={() => { playAudio('uiClick'); setShowAICoachModal(true); }}
            className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-blue-600 active:scale-95 transform transition-all animate-pulse-blue"
            aria-label="Fråga Flexibot AI-Coach"
          >
            <AICoachIcon className="w-8 h-8" />
          </button>
      </div>

    </>
  );
};
