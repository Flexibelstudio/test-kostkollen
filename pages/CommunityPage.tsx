import React from 'react';
import { CommunityView } from '../components/CommunityView';
import { useUserContext } from '../context/UserContext';
import { ACHIEVEMENT_DEFINITIONS } from '../constants';

const CommunityPage: React.FC = () => {
    const { currentUser, userProfile } = useUserContext();
    
    if (!currentUser) return null;

    return (
        <CommunityView
            key={Date.now()}
            currentUser={currentUser}
            userProfile={userProfile}
            achievements={ACHIEVEMENT_DEFINITIONS}
            setToastNotification={() => {}}
            pendingRequestsCount={0}
            timelineEvents={[]}
            setTimelineEvents={() => {}}
            buddyDetails={[]}
            isLoading={false}
            onDataChanged={() => {}}
            lastViewTimestamp={null}
        />
    );
};
export default CommunityPage;