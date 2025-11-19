import React from 'react';
import { CoursesView } from '../components/CoursesView';
import { useUserContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';

const CoursesPage: React.FC = () => {
    const { userProfile } = useUserContext();
    const navigate = useNavigate();

    return (
        <CoursesView 
            userProfile={userProfile} 
            onNavigateToCourse={(id) => navigate(`/courses/${id}`)} 
        />
    );
};
export default CoursesPage;