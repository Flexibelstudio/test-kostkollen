
import React from 'react';
import { JourneyView } from '../components/JourneyView';
import { useUserContext } from '../context/UserContext';
import { AIDataForJourneyAnalysis, StreakSaver, AIStructuredFeedbackResponse, GoalSettings, UserProfileData } from '../types';
import { playAudio } from '../services/audioService';
import { calculateGoalTimeline } from '../utils/timelineUtils';
import { ACHIEVEMENT_DEFINITIONS, MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD } from '../constants';

interface JourneyPageProps {
  viewingDate: Date;
  setViewingDate: (date: Date) => void;
  initialTab: 'calendar' | 'profile' | 'achievements';
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  onNavigateToMainWithDate: (date: Date) => void;
  onOpenLogWeightModal: () => void;
  setShowAICoachModal: (show: boolean) => void;
  onDiscussSavedAnalysis: (analysisDate?: string) => void;
  onSaveProfileAndGoals: (profile: UserProfileData, goals: GoalSettings, newPhotoDataUrl?: string | null) => void;
}

const JourneyPage: React.FC<JourneyPageProps> = ({
  viewingDate,
  setViewingDate,
  initialTab,
  setToastNotification,
  onNavigateToMainWithDate,
  onOpenLogWeightModal,
  setShowAICoachModal,
  onDiscussSavedAnalysis,
  onSaveProfileAndGoals,
}) => {
  const {
    userProfile,
    goals,
    pastDaysSummary,
    weightLogs,
    streakData,
    streakSaver,
    highestStreak,
    highestLevelId,
    unlockedAchievements,
    achievementInteractions,
    journeyAnalysisFeedback,
    mentalWellbeingLogs,
    currentDate
  } = useUserContext();

  const minSafeCalories = Math.max(goals.calorieGoal * MIN_SAFE_CALORIE_PERCENTAGE_OF_GOAL, MIN_ABSOLUTE_CALORIES_THRESHOLD);

  // Prepare analysis context for AI Coach if needed immediately, mostly managed by App.tsx currently
  const analysisContext: AIDataForJourneyAnalysis = {
    userProfile,
    goals,
    allWeightLogs: weightLogs,
    last30DaysSummaries: Object.values(pastDaysSummary),
    mentalWellbeingLogs,
    goalTimeline: calculateGoalTimeline(userProfile),
    currentStreak: streakData.currentStreak
  };

  return (
    <JourneyView
      pastDaysData={pastDaysSummary}
      weightLogs={weightLogs}
      userProfile={userProfile}
      goals={goals}
      onSaveProfileAndGoals={(p, g) => onSaveProfileAndGoals(p, g)} // Photo handling in App.tsx mostly or modal
      onOpenLogWeightModal={onOpenLogWeightModal}
      playAudio={playAudio}
      viewingDate={viewingDate}
      setViewingDate={setViewingDate}
      currentDate={currentDate}
      initialTab={initialTab}
      highestStreak={highestStreak}
      highestLevelId={highestLevelId}
      minSafeCalories={minSafeCalories}
      setToastNotification={setToastNotification}
      achievements={ACHIEVEMENT_DEFINITIONS}
      unlockedAchievements={unlockedAchievements}
      achievementInteractions={achievementInteractions}
      journeyAnalysisFeedback={journeyAnalysisFeedback}
      onNavigateToMainWithDate={onNavigateToMainWithDate}
      streakSaver={streakSaver}
      analysisContext={analysisContext}
      setShowAICoachModal={setShowAICoachModal}
      onDiscussSavedAnalysis={onDiscussSavedAnalysis}
    />
  );
};

export default JourneyPage;
