import React, { useState } from 'react';
import { JourneyView } from '../components/JourneyView';
import { useUserContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { playAudio } from '../services/audioService';
import { AIDataForJourneyAnalysis } from '../types';
import AICoachModal from '../components/AICoachModal';

const JourneyPage: React.FC = () => {
    const context = useUserContext();
    const navigate = useNavigate();
    const [viewingDate, setViewingDate] = useState(context.currentDate);
    const [showAICoachModal, setShowAICoachModal] = useState(false);
    const [coachContext, setCoachContext] = useState<{ type: 'from_analysis'; date?: string } | null>(null);

    // Construct analysis context
    const analysisContext: AIDataForJourneyAnalysis = {
        userProfile: context.userProfile,
        goals: context.goals,
        allWeightLogs: context.weightLogs,
        last30DaysSummaries: Object.values(context.pastDaysSummary), // simplified
        goalTimeline: { milestones: [], paceFeedback: null }, // Recalculated inside component usually
        mentalWellbeingLogs: context.mentalWellbeingLogs,
        currentStreak: context.streakData.currentStreak
    };

    return (
        <>
            <JourneyView 
                pastDaysData={context.pastDaysSummary}
                weightLogs={context.weightLogs}
                userProfile={context.userProfile}
                goals={context.goals}
                onSaveProfileAndGoals={() => { /* Implemented in component */ }}
                onOpenLogWeightModal={() => { /* Implemented in component via local state */ }}
                playAudio={playAudio}
                viewingDate={viewingDate}
                setViewingDate={setViewingDate}
                currentDate={context.currentDate}
                initialTab={'calendar'}
                highestStreak={context.highestStreak}
                highestLevelId={context.highestLevelId}
                minSafeCalories={1200} // Should be calc
                setToastNotification={() => {}}
                achievements={[]} // Pass definitions
                unlockedAchievements={context.unlockedAchievements}
                achievementInteractions={context.achievementInteractions}
                journeyAnalysisFeedback={context.journeyAnalysisFeedback}
                onNavigateToMainWithDate={(d) => navigate('/')}
                streakSaver={context.streakSaver}
                analysisContext={analysisContext}
                setShowAICoachModal={setShowAICoachModal}
                onDiscussSavedAnalysis={(date) => { setCoachContext({ type: 'from_analysis', date }); setShowAICoachModal(true); }}
            />
             <AICoachModal 
                show={showAICoachModal} 
                onClose={() => setShowAICoachModal(false)} 
                analysisContext={analysisContext} 
                initialContext={coachContext}
            />
        </>
    );
};
export default JourneyPage;