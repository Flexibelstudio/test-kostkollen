
import React from 'react';
import { CommunityView } from '../components/CommunityView';
import { useUserContext } from '../context/UserContext';
import { ACHIEVEMENT_DEFINITIONS } from '../constants';
import { TimelineEvent, BuddyDetails } from '../types';

interface CommunityPageProps {
  pendingRequestsCount: number;
  initialTab: 'flode' | 'hantera';
  initialSubTab: 'buddies' | 'search' | 'requests';
  highlightEventId: string | null;
  timelineEvents: TimelineEvent[];
  setTimelineEvents: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
  buddyDetails: BuddyDetails[];
  isLoading: boolean;
  onDataChanged: () => void;
  lastViewTimestamp: number | null;
  setToastNotification: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  communityViewKey: number;
}

const CommunityPage: React.FC<CommunityPageProps> = ({
  pendingRequestsCount,
  initialTab,
  initialSubTab,
  highlightEventId,
  timelineEvents,
  setTimelineEvents,
  buddyDetails,
  isLoading,
  onDataChanged,
  lastViewTimestamp,
  setToastNotification,
  communityViewKey
}) => {
  const { currentUser, userProfile } = useUserContext();

  if (!currentUser) return null;

  return (
    <CommunityView
      key={communityViewKey}
      currentUser={currentUser}
      userProfile={userProfile}
      achievements={ACHIEVEMENT_DEFINITIONS}
      setToastNotification={setToastNotification}
      pendingRequestsCount={pendingRequestsCount}
      initialTab={initialTab}
      initialSubTab={initialSubTab}
      highlightEventId={highlightEventId}
      timelineEvents={timelineEvents}
      setTimelineEvents={setTimelineEvents}
      buddyDetails={buddyDetails}
      isLoading={isLoading}
      onDataChanged={onDataChanged}
      lastViewTimestamp={lastViewTimestamp}
    />
  );
};

export default CommunityPage;
