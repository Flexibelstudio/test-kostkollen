import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LessonDetail from '../components/course/LessonDetail';
import { useUserContext } from '../context/UserContext';
import { courseLessons, menopauseCourseLessons } from '../courseData';
import { saveCourseProgress } from '../services/firestoreService';

const LessonDetailPage: React.FC = () => {
    const { courseId, lessonId } = useParams<{ courseId: string, lessonId: string }>();
    const context = useUserContext();
    const navigate = useNavigate();

    const allLessons = [...courseLessons, ...menopauseCourseLessons];
    const lesson = allLessons.find(l => l.id === lessonId);

    if (!lesson) return <div>Lektion hittades inte.</div>;

    return (
        <LessonDetail 
            lesson={lesson}
            progress={context.userCourseProgress[lessonId!]}
            onToggleFocusPoint={async (lId, fpId) => {
                // Simple toggle logic duplicating App.tsx logic for brevity, ideally in a hook
                const p = context.userCourseProgress[lId] || {};
                const completed = p.completedFocusPoints || [];
                const newCompleted = completed.includes(fpId) ? completed.filter(i => i !== fpId) : [...completed, fpId];
                const newP = { ...p, completedFocusPoints: newCompleted };
                context.setUserCourseProgress(prev => ({ ...prev, [lId]: newP }));
                if(context.currentUser) await saveCourseProgress(context.currentUser.uid, lId, newP, context.userRole!, context.userStatus!);
            }}
            onSaveReflection={async () => {}}
            onSaveWhyAnswer={async () => {}}
            onSaveSmartGoalAnswer={async () => {}}
            onMarkComplete={async () => {}}
            onOpenSpeedDial={() => {}}
            onNavigateToJourney={() => navigate('/journey')}
            userProfile={context.userProfile}
            weightLogs={context.weightLogs}
            pastDaysSummary={Object.values(context.pastDaysSummary)}
            onOpenLogWeightModal={() => {}}
            onClose={() => navigate(`/courses/${courseId}`)}
        />
    );
};
export default LessonDetailPage;