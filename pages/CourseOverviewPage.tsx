
import React from 'react';
import CourseOverview from '../components/course/CourseOverview';
import { useUserContext } from '../context/UserContext';
import { CourseInfo, ALL_COURSES } from '../components/CoursesView';
import { courseLessons, menopauseCourseLessons } from '../courseData';

interface CourseOverviewPageProps {
  activeCourse: CourseInfo;
  onSelectLesson: (lessonId: string) => void;
}

const CourseOverviewPage: React.FC<CourseOverviewPageProps> = ({ activeCourse, onSelectLesson }) => {
  const { userCourseProgress, streakData } = useUserContext();
  
  const lessonsForOverview = activeCourse.id === 'maxa-klimakteriet' ? menopauseCourseLessons : courseLessons;

  return (
    <CourseOverview
      lessons={lessonsForOverview}
      userProgress={userCourseProgress}
      onSelectLesson={onSelectLesson}
      currentStreak={streakData.currentStreak}
      courseId={activeCourse.id}
    />
  );
};

export default CourseOverviewPage;
