
import React from 'react';
import { CoursesView, CourseInfo } from '../components/CoursesView';
import { useUserContext } from '../context/UserContext';

interface CoursesPageProps {
  onNavigateToCourse: (courseId: CourseInfo['id']) => void;
}

const CoursesPage: React.FC<CoursesPageProps> = ({ onNavigateToCourse }) => {
  const { userProfile } = useUserContext();

  return (
    <CoursesView
      userProfile={userProfile}
      onNavigateToCourse={onNavigateToCourse}
    />
  );
};

export default CoursesPage;
