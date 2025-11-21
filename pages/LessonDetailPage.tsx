
import React from 'react';
import LessonDetail from '../components/course/LessonDetail';
import { useUserContext } from '../context/UserContext';
import { CourseLesson } from '../types';
import { courseLessons, menopauseCourseLessons } from '../courseData';
import { CourseInfo } from '../components/CoursesView';

interface LessonDetailPageProps {
  currentLessonId: string;
  activeCourse: CourseInfo;
  onClose: () => void;
  onOpenSpeedDial: () => void;
  onNavigateToJourney: (tab: 'calendar' | 'profile' | 'achievements') => void;
  onOpenLogWeightModal: () => void;
  onMarkLessonComplete: (lessonId: string) => Promise<void>;
  onSaveReflection: (lessonId: string, answer: string) => Promise<void>;
  onSaveWhyAnswer: (lessonId: string, answer: string) => Promise<void>;
  onSaveSmartGoalAnswer: (lessonId: string, answer: string) => Promise<void>;
  onToggleFocusPoint: (lessonId: string, focusPointId: string) => void;
}

const LessonDetailPage: React.FC<LessonDetailPageProps> = ({
  currentLessonId,
  activeCourse,
  onClose,
  onOpenSpeedDial,
  onNavigateToJourney,
  onOpenLogWeightModal,
  onMarkLessonComplete,
  onSaveReflection,
  onSaveWhyAnswer,
  onSaveSmartGoalAnswer,
  onToggleFocusPoint
}) => {
  const { userCourseProgress, userProfile, weightLogs, pastDaysSummary } = useUserContext();

  const lessonsForDetail = activeCourse.id === 'maxa-klimakteriet' ? menopauseCourseLessons : courseLessons;
  const currentLesson = lessonsForDetail.find(l => l.id === currentLessonId);

  if (!currentLesson) return null;

  return (
    <LessonDetail
      lesson={currentLesson}
      progress={userCourseProgress[currentLessonId]}
      onToggleFocusPoint={onToggleFocusPoint}
      onSaveReflection={onSaveReflection}
      onMarkComplete={onMarkLessonComplete}
      onClose={onClose}
      onOpenSpeedDial={onOpenSpeedDial}
      onNavigateToJourney={onNavigateToJourney}
      onSaveWhyAnswer={onSaveWhyAnswer}
      onSaveSmartGoalAnswer={onSaveSmartGoalAnswer}
      userProfile={userProfile}
      weightLogs={weightLogs}
      pastDaysSummary={Object.values(pastDaysSummary)}
      onOpenLogWeightModal={onOpenLogWeightModal}
    />
  );
};

export default LessonDetailPage;
