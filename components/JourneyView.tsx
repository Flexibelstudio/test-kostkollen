
import React, { useMemo, useState } from 'react';
import { PastDaysSummaryCollection, WeightLogEntry, UserProfileData, GoalType, GoalSettings, Achievement, Reactions, AIDataForJourneyAnalysis, StreakSaver } from '../types';
import { PencilIcon, TrophyIcon, SparklesIcon, PlusIcon, ScaleIcon, ExclamationTriangleIcon } from './icons';
import { Dumbbell, PieChart, Target } from 'lucide-react';
import { calculateGoalTimeline } from '../utils/timelineUtils.ts';
import GoalTimeline from './JourneyGoalTimeline.tsx';
import ProfileAndGoalEditor from './JourneyProfileEditor.tsx';
import AchievementsView from './AchievementsView.tsx';
import { COACH_PERSONAS } from '../constants';

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
  onNavigateToMainWithDate: (date: Date) => void;
  streakSaver: StreakSaver | null;
  analysisContext: AIDataForJourneyAnalysis;
  setShowAICoachModal: (show: boolean) => void;
  isAICoachOpen: boolean;
  isProfileOpen: boolean;
  isMorningReportOpen: boolean;
}
type Tab = 'goals' | 'achievements';

export const JourneyView: React.FC<JourneyViewProps> = (props) => {
  const { 
      weightLogs, userProfile, goals, onSaveProfileAndGoals, 
      onOpenLogWeightModal, playAudio, 
      initialTab, minSafeCalories,
      setToastNotification, achievements, unlockedAchievements, achievementInteractions,
      setShowAICoachModal, isAICoachOpen, isProfileOpen, isMorningReportOpen
  } = props;

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if(initialTab === 'profile') return 'goals';
    if(initialTab === 'achievements') return 'achievements';
    return 'goals'; 
  });

  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isFullGoalEdit, setIsFullGoalEdit] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Filter logs to only show those AFTER the goalStartDate
  const filteredWeightLogs = useMemo(() => {
    if (!userProfile.goalStartDate) return weightLogs;
    const startDate = new Date(userProfile.goalStartDate).getTime();
    return weightLogs.filter(log => log.loggedAt >= startDate);
  }, [weightLogs, userProfile.goalStartDate]);
  
  const timeline = useMemo(() => {
      // Create an effective profile that backfills goalStartDate from the first log if missing
      const effectiveProfile = {
          ...userProfile,
          goalStartDate: userProfile.goalStartDate || (weightLogs.length > 0 ? new Date(weightLogs[0].loggedAt).toISOString().split('T')[0] : undefined)
      };
      // Calculate timeline using the filtered logs (relevant to current goal)
      return calculateGoalTimeline(effectiveProfile, filteredWeightLogs);
  }, [userProfile, filteredWeightLogs, weightLogs]);
  
  // Find latest measurements
  const latestWeightValue = useMemo(() => [...filteredWeightLogs].reverse().find(l => l.weightKg != null)?.weightKg ?? userProfile.currentWeightKg, [filteredWeightLogs, userProfile.currentWeightKg]);
  const latestMuscleValue = useMemo(() => [...filteredWeightLogs].reverse().find(l => l.skeletalMuscleMassKg != null)?.skeletalMuscleMassKg ?? userProfile.skeletalMuscleMassKg, [filteredWeightLogs, userProfile.skeletalMuscleMassKg]);
  const latestFatValue = useMemo(() => [...filteredWeightLogs].reverse().find(l => l.bodyFatMassKg != null)?.bodyFatMassKg ?? userProfile.bodyFatMassKg, [filteredWeightLogs, userProfile.bodyFatMassKg]);

  const latestWeightLog = filteredWeightLogs.length > 0 ? filteredWeightLogs[filteredWeightLogs.length - 1] : null;
  const previousWeightLog = filteredWeightLogs.length > 1 ? filteredWeightLogs[filteredWeightLogs.length - 2] : null;

  let weightChangeNum: number | undefined;
  let muscleChangeNum: number | undefined;
  let fatChangeNum: number | undefined;

  if (latestWeightLog) {
      if (previousWeightLog) {
          // Case 1: We have at least two logs in the current period -> Compare latest vs previous
          weightChangeNum = latestWeightLog.weightKg - previousWeightLog.weightKg;
          if (latestWeightLog.skeletalMuscleMassKg != null && previousWeightLog.skeletalMuscleMassKg != null) {
              muscleChangeNum = latestWeightLog.skeletalMuscleMassKg - previousWeightLog.skeletalMuscleMassKg;
          }
          if (latestWeightLog.bodyFatMassKg != null && previousWeightLog.bodyFatMassKg != null) {
              fatChangeNum = latestWeightLog.bodyFatMassKg - previousWeightLog.bodyFatMassKg;
          }
      } else {
          // Case 2: We only have ONE log in the current period (fresh start) -> Compare latest vs Start Values
          if (userProfile.goalStartWeight != null) {
             weightChangeNum = latestWeightLog.weightKg - userProfile.goalStartWeight;
          }
          
          if (latestWeightLog.skeletalMuscleMassKg != null && userProfile.goalStartMuscleMassKg != null) {
             muscleChangeNum = latestWeightLog.skeletalMuscleMassKg - userProfile.goalStartMuscleMassKg;
          }
          
          if (latestWeightLog.bodyFatMassKg != null && userProfile.goalStartFatMassKg != null) {
             fatChangeNum = latestWeightLog.bodyFatMassKg - userProfile.goalStartFatMassKg;
          }
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
              if (userProfile.desiredMuscleMassChangeKg && userProfile.desiredMuscleMassChangeKg > 0) {
                  if (change > 0) colorClass = 'text-primary-darker';
                  else if (change < 0) colorClass = 'text-red-600';
              } else {
                  if (change > 0) colorClass = 'text-primary-darker'; 
                  else if (change < 0) colorClass = 'text-red-600'; 
              }
              break;
          case 'fat':
              if (userProfile.desiredFatMassChangeKg && userProfile.desiredFatMassChangeKg > 0) {
                  if (change > 0) colorClass = 'text-primary-darker';
                  else if (change < 0) colorClass = 'text-red-600';
              } else if (userProfile.desiredFatMassChangeKg && userProfile.desiredFatMassChangeKg < 0) {
                  if (change < 0) colorClass = 'text-primary-darker';
                  else if (change > 0) colorClass = 'text-red-600';
              } else if (goalType === 'lose_fat') {
                  if (change < 0) colorClass = 'text-primary-darker'; 
                  else if (change > 0) colorClass = 'text-red-600'; 
              }
              break;
          case 'weight':
              const desiredWeightChange = userProfile.desiredWeightChangeKg || 0;
              if (desiredWeightChange > 0) {
                  if (change > 0) colorClass = 'text-primary-darker';
                  else if (change < 0) colorClass = 'text-red-600';
              } else if (desiredWeightChange < 0) {
                  if (change < 0) colorClass = 'text-primary-darker';
                  else if (change > 0) colorClass = 'text-red-600';
              } else {
                  if (measurementMethod === 'inbody') {
                      if (change < 0 && fatChangeForWeight !== undefined && fatChangeForWeight < 0) {
                          colorClass = 'text-primary-darker'; 
                      } else if (change > 0 && muscleChangeForWeight !== undefined && muscleChangeForWeight > 0) {
                          colorClass = 'text-primary-darker'; 
                      } else if (change !== 0) {
                          colorClass = 'text-red-600'; 
                      }
                  } else { 
                      if (change < 0 && goalType === 'lose_fat') {
                          colorClass = 'text-primary-darker';
                      } else if (change > 0 && goalType === 'gain_muscle') {
                          colorClass = 'text-primary-darker';
                      } else if (change !== 0) {
                          colorClass = 'text-red-600';
                      }
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
    let startValueKg, currentValueKg, goalChangeKg;

    const isScaleGoal = userProfile.measurementMethod === 'scale';
    const hasFatGoal = !isScaleGoal && userProfile.desiredFatMassChangeKg != null && userProfile.desiredFatMassChangeKg !== 0;
    const hasMuscleGoal = !isScaleGoal && userProfile.desiredMuscleMassChangeKg != null && userProfile.desiredMuscleMassChangeKg !== 0;

    let primaryGoal = 'weight';
    if (hasFatGoal && hasMuscleGoal) {
        primaryGoal = userProfile.goalType === 'gain_muscle' ? 'muscle' : 'fat';
    } else if (hasFatGoal) {
        primaryGoal = 'fat';
    } else if (hasMuscleGoal) {
        primaryGoal = 'muscle';
    }

    // Logic: Favor specific values if available, otherwise fallback to weight for progress tracking
    if (primaryGoal === 'fat') {
        if (latestFatValue != null && userProfile.goalStartFatMassKg != null) {
            startValueKg = userProfile.goalStartFatMassKg;
            currentValueKg = latestFatValue;
            goalChangeKg = userProfile.desiredFatMassChangeKg;
        } else {
            // FALLBACK: User has Fat Goal but logs only Weight
            startValueKg = userProfile.goalStartWeight;
            currentValueKg = latestWeightValue;
            goalChangeKg = userProfile.desiredFatMassChangeKg; 
        }
    } else if (primaryGoal === 'muscle') {
        if (latestMuscleValue != null && userProfile.goalStartMuscleMassKg != null) {
            startValueKg = userProfile.goalStartMuscleMassKg;
            currentValueKg = latestMuscleValue;
            goalChangeKg = userProfile.desiredMuscleMassChangeKg;
        } else {
            // FALLBACK: User has Muscle Gain Goal but logs only Weight
            startValueKg = userProfile.goalStartWeight;
            currentValueKg = latestWeightValue;
            goalChangeKg = userProfile.desiredMuscleMassChangeKg;
        }
    } else {
        // Scale Mode or Fallback for InBody without specific comp goal (uses weight)
        startValueKg = userProfile.goalStartWeight;
        currentValueKg = latestWeightValue;
        goalChangeKg = userProfile.desiredWeightChangeKg;
    }
    
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
        else if (userProfile.desiredWeightChangeKg) displayString = `Nå en viktförändring på ${userProfile.desiredWeightChangeKg > 0 ? '+' : ''}${userProfile.desiredWeightChangeKg.toFixed(1).replace('.',',')} kg${datePart}`; // Fallback description
        else displayString = 'Bibehålla nuvarande form';
    }

    if (startValueKg == null || currentValueKg == null || userProfile.mainGoalCompleted || goalChangeKg == null) {
        return { goalProgress: 0, goalDisplayString: displayString };
    }

    const totalChangeNeeded = Math.abs(goalChangeKg);
    let changeAchieved;
    
    // Strict logic: Progress is only movement in the desired direction
    if (goalChangeKg > 0) { 
        // Goal: Gain weight/muscle. Progress = Current - Start
        changeAchieved = currentValueKg - startValueKg;
    } else { 
        // Goal: Lose weight/fat. Progress = Start - Current
        changeAchieved = startValueKg - currentValueKg;
    }
    
    // If changeAchieved is negative, it means we went the wrong way. Clamp to 0.
    changeAchieved = Math.max(0, changeAchieved);

    if (totalChangeNeeded < 0.01) {
        return { goalProgress: 100, goalDisplayString: displayString };
    }

    const progressRaw = (changeAchieved / totalChangeNeeded) * 100;
    return {
        goalProgress: Math.max(0, Math.min(progressRaw, 100)),
        goalDisplayString: displayString
    };
  }, [latestWeightValue, latestMuscleValue, latestFatValue, userProfile]);

  const handleStartNewGoal = () => {
      setShowResetConfirmModal(false);
      setIsProfileEditing(true);
      setIsFullGoalEdit(true);
  };

  const handleEditToggle = (isEditing: boolean) => {
      setIsProfileEditing(isEditing);
      if (!isEditing) {
          setIsFullGoalEdit(false);
      }
  };

  const coachName = userProfile.coachStyle && COACH_PERSONAS[userProfile.coachStyle] ? COACH_PERSONAS[userProfile.coachStyle].label : 'Coachen';

  return (
    <>
      <div className="animate-fade-in relative pb-0 flex flex-col gap-3">
            
        {/* HERO CARD - BODY COMPOSITION */}
        <div className="bg-white dark:bg-neutral-darker rounded-3xl shadow-soft-xl p-5 border border-neutral-light relative overflow-hidden">
            <div className="flex flex-col items-center">
                <h2 className="text-lg font-bold text-neutral-dark mb-4 uppercase tracking-wide opacity-80">Kroppssammansättning</h2>
                
                {/* Main Metric - Weight */}
                <div className="text-center mb-6">
                    <span className="text-5xl font-extrabold block text-neutral-dark">
                        {latestWeightValue ? `${latestWeightValue.toFixed(1).replace('.',',')}` : 'N/A'}
                        <span className="text-2xl ml-1 text-neutral">kg</span>
                    </span>
                    <span className={`text-base font-semibold ${weightChangeDetails.colorClass} bg-neutral-light/50 px-3 py-1 rounded-full mt-2 inline-block`}>
                        {weightChangeDetails.text}
                    </span>
                </div>

                {/* Secondary Metrics - Only Show if InBody is selected */}
                {userProfile.measurementMethod === 'inbody' && (
                    <div className="flex gap-4 w-full justify-center">
                        <div className="flex-1 bg-white rounded-2xl p-4 flex flex-col items-center border border-neutral-light shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 mb-2">
                                <Dumbbell className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-neutral-500 uppercase mb-0.5">Muskler</span>
                            <span className="text-xl font-bold text-neutral-dark">
                                {latestMuscleValue != null ? latestMuscleValue.toFixed(1).replace('.',',') : '-'}
                            </span>
                            <span className={`text-xs font-semibold ${muscleChangeDetails.colorClass}`}>
                                {muscleChangeDetails.text}
                            </span>
                        </div>
                        
                        <div className="flex-1 bg-white rounded-2xl p-4 flex flex-col items-center border border-neutral-light shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600 mb-2">
                                <PieChart className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-neutral-500 uppercase mb-0.5">Fett</span>
                            <span className="text-xl font-bold text-neutral-dark">
                                {latestFatValue != null ? latestFatValue.toFixed(1).replace('.',',') : '-'}
                            </span>
                            <span className={`text-xs font-semibold ${fatChangeDetails.colorClass}`}>
                                {fatChangeDetails.text}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {isProfileEditing ? (
            <div className="animate-fade-in">
                <ProfileAndGoalEditor 
                    initialProfile={userProfile} 
                    initialGoals={goals} 
                    onSave={onSaveProfileAndGoals} 
                    isEditing={isProfileEditing}
                    setIsEditing={handleEditToggle}
                    isFullGoalEdit={isFullGoalEdit}
                    latestMeasuredWeight={latestWeightValue}
                    latestMeasuredMuscle={latestMuscleValue}
                    latestMeasuredFat={latestFatValue}
                />
            </div>
        ) : (
            <div className="bg-white dark:bg-neutral-darker p-2 rounded-2xl shadow-soft-lg border border-neutral-light">
                <div className="flex p-1 bg-neutral-light/50 rounded-xl">
                    <button
                        onClick={() => setActiveTab('goals')}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'goals' ? 'bg-white dark:bg-neutral-dark text-primary shadow-sm' : 'text-neutral hover:text-neutral-dark dark:hover:text-white'}`}
                    >
                        Mål & Framsteg
                    </button>
                    <button
                        onClick={() => setActiveTab('achievements')}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${activeTab === 'achievements' ? 'bg-white dark:bg-neutral-dark text-primary shadow-sm' : 'text-neutral hover:text-neutral-dark dark:hover:text-white'}`}
                    >
                        Bragder
                    </button>
                </div>

                <div className="mt-4 p-2">
                    {activeTab === 'goals' && (
                        <div className="space-y-3 animate-fade-in">
                            <div className="bg-neutral-light/30 p-4 rounded-2xl border border-neutral-light">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-neutral-dark flex items-center gap-2">
                                        <TrophyIcon className="w-5 h-5 text-accent" />
                                        Ditt Mål
                                    </h3>
                                    {!userProfile.mainGoalCompleted && (
                                        <span className="text-xs font-bold text-primary bg-white dark:bg-neutral-darker px-2 py-1 rounded-md shadow-sm">
                                            {goalProgress.toFixed(0)}% klart
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-medium text-neutral-dark mb-3">
                                    {goalDisplayString}
                                </p>
                                {!userProfile.mainGoalCompleted && (
                                    <div className="w-full bg-white dark:bg-neutral-darker rounded-full h-3 shadow-inner overflow-hidden">
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
                            
                            <ProfileAndGoalEditor 
                                initialProfile={userProfile} 
                                initialGoals={goals} 
                                onSave={onSaveProfileAndGoals} 
                                isEditing={false}
                                setIsEditing={handleEditToggle}
                                isFullGoalEdit={isFullGoalEdit}
                                latestMeasuredWeight={latestWeightValue}
                                latestMeasuredMuscle={latestMuscleValue}
                                latestMeasuredFat={latestFatValue}
                            />
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
        )}
      </div>
      
      {isSpeedDialOpen && (
          <div 
              className="fixed inset-0 bg-neutral-dark bg-opacity-70 backdrop-blur-sm z-[100] animate-fade-in"
              onClick={() => setIsSpeedDialOpen(false)}
          />
      )}

      {!isProfileEditing && !isAICoachOpen && !isProfileOpen && !isMorningReportOpen && (
        <div className="fixed bottom-6 right-6 z-[105] flex flex-col items-end gap-3 pointer-events-none">
            {isSpeedDialOpen && (
                <div className="flex flex-col items-end gap-3 animate-slide-up-fade-in pointer-events-auto">
                    <button onClick={() => { playAudio('uiClick'); setShowAICoachModal(true); setIsSpeedDialOpen(false); }} className="flex items-center gap-3">
                        <span className="bg-white dark:bg-neutral-darker text-neutral-dark dark:text-white px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap border border-neutral-light">Chatta med {coachName}</span>
                        <div className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-white dark:bg-neutral-darker overflow-hidden border-2 border-primary">
                            {userProfile.coachStyle && COACH_PERSONAS[userProfile.coachStyle] && COACH_PERSONAS[userProfile.coachStyle].imageUrl ? (
                                <img src={COACH_PERSONAS[userProfile.coachStyle].imageUrl} alt={coachName} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xl">{userProfile.coachStyle && COACH_PERSONAS[userProfile.coachStyle] ? COACH_PERSONAS[userProfile.coachStyle].emoji : '🤖'}</span>
                            )}
                        </div>
                    </button>
                    <button onClick={() => { playAudio('uiClick'); setShowResetConfirmModal(true); setIsSpeedDialOpen(false); }} className="flex items-center gap-3">
                        <span className="bg-white dark:bg-neutral-darker text-neutral-dark dark:text-white px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap border border-neutral-light">Nytt Mål</span>
                        <div className="w-12 h-12 bg-secondary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-secondary-darker transition-colors"><Target className="w-6 h-6" /></div>
                    </button>
                    <button onClick={() => { playAudio('uiClick'); onOpenLogWeightModal(); setIsSpeedDialOpen(false); }} className="flex items-center gap-3">
                        <span className="bg-white dark:bg-neutral-darker text-neutral-dark dark:text-white px-3 py-1.5 rounded-lg shadow-md text-sm font-medium whitespace-nowrap border border-neutral-light">Logga Vikt</span>
                        <div className="w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary-darker transition-colors"><ScaleIcon className="w-6 h-6" /></div>
                    </button>
                </div>
            )}
            <button 
                onClick={() => { playAudio('uiClick'); setIsSpeedDialOpen(!isSpeedDialOpen); }}
                className={`pointer-events-auto w-16 h-16 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 overflow-hidden border-2 border-primary ${isSpeedDialOpen ? 'bg-red-500 text-white rotate-45 border-red-500' : 'bg-white dark:bg-neutral-darker text-primary'}`}
                aria-label="Lägg till"
            >
                {isSpeedDialOpen ? (
                    <PlusIcon className="w-8 h-8" />
                ) : (
                    userProfile.coachStyle && COACH_PERSONAS[userProfile.coachStyle] && COACH_PERSONAS[userProfile.coachStyle].imageUrl ? (
                        <img src={COACH_PERSONAS[userProfile.coachStyle].imageUrl} alt={coachName} className="w-full h-full object-cover" />
                    ) : (
                        <PlusIcon className="w-8 h-8" />
                    )
                )}
            </button>
        </div>
      )}

      {showResetConfirmModal && (
        <div
            className="fixed inset-0 bg-neutral-dark bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[110] animate-fade-in"
            onClick={() => setShowResetConfirmModal(false)}
        >
            <div className="bg-white dark:bg-neutral-darker p-6 rounded-3xl shadow-soft-xl w-full max-w-sm animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-neutral-dark mb-4 flex items-center"><ExclamationTriangleIcon className="w-6 h-6 mr-2 text-yellow-500"/> Sätta ett nytt mål?</h3>
                <p className="text-neutral mb-6">
                    Detta kommer att markera ditt nuvarande mål som slutfört och låter dig ställa in ett nytt. Vill du fortsätta?
                </p>
                <div className="flex justify-end space-x-3">
                    <button onClick={() => setShowResetConfirmModal(false)} className="px-5 py-2.5 text-neutral-dark bg-neutral-light hover:bg-gray-300 rounded-xl active:scale-95 interactive-transition font-medium">Avbryt</button>
                    <button onClick={handleStartNewGoal} className="px-5 py-2.5 text-white bg-primary hover:bg-primary-darker rounded-xl active:scale-95 interactive-transition font-medium">Ja, sätt nytt mål</button>
                </div>
            </div>
        </div>
      )}

    </>
  );
};
