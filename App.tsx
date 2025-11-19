import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUserContext } from './context/UserContext';

// Pages & Layout
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import JourneyPage from './pages/JourneyPage';
import CoursesPage from './pages/CoursesPage';
import CourseOverviewPage from './pages/CourseOverviewPage';
import LessonDetailPage from './pages/LessonDetailPage';
import CommunityPage from './pages/CommunityPage';
import SplashScreen from './components/SplashScreen';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import CoachDashboard from './components/CoachDashboard';
import { AuthForm } from './components/AuthForm';

export const App = () => {
  const { currentUser, authLoading, userStatus, userRole, isDataLoading } = useUserContext();

  if (authLoading || (currentUser && isDataLoading)) {
    return <SplashScreen />;
  }

  if (!currentUser) {
    return <AuthForm onAuthStateChange={() => {}} />;
  }

  if (userStatus === 'pending') {
    return <PendingApprovalScreen onLogout={() => window.location.reload()} userEmail={currentUser.email} />;
  }

  if (userRole === 'coach') {
      // Simplified for brevity: Coach logic could also be routed, but keeping it conditional here for now
      // return <CoachDashboard ... />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="journey" element={<JourneyPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="courses/:courseId" element={<CourseOverviewPage />} />
          <Route path="courses/:courseId/lessons/:lessonId" element={<LessonDetailPage />} />
          <Route path="community" element={<CommunityPage />} />
          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};