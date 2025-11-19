import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CourseOverview from '../components/course/CourseOverview';
import { useUserContext } from '../context/UserContext';
import { courseLessons, menopauseCourseLessons } from '../courseData';

const CourseOverviewPage: React.FC = () => {
    const { courseId } = useParams<{ courseId: string }>();
    const { userCourseProgress, streakData } = useUserContext();
    const navigate = useNavigate();

    const lessons = courseId === 'maxa-klimakteriet' ? menopauseCourseLessons : courseLessons;

    return (
        <CourseOverview
            lessons={lessons}
            userProgress={userCourseProgress}
            onSelectLesson={(lessonId) => navigate(`/courses/${courseId}/lessons/${lessonId}`)}
            currentStreak={streakData.currentStreak}
            courseId={courseId as any}
        />
    );
};
export default CourseOverviewPage;