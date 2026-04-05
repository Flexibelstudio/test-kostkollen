import React, { useState, useEffect } from 'react';
import { TimelineEvent, UserProfileData } from '../types';
import { 
  listenToBootcampTimeline,
  togglePeppOnTimelineEvent,
  addCommentToTimelineEvent,
  toggleLikeOnComment,
  deleteTimelineEvent
} from '../services/firestoreService';
import { auth } from '../firebase';
import { TimelineEventCard } from './CommunityView';

interface BootcampFeedProps {
  cohortId: string;
  userProfile: UserProfileData;
  hideCreatePost?: boolean;
  activeBootcamp?: any;
}

const BootcampFeed: React.FC<BootcampFeedProps> = ({ cohortId, userProfile, activeBootcamp }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (!cohortId || !auth.currentUser) return;
    const unsubscribe = listenToBootcampTimeline(cohortId, (fetchedEvents) => {
      setEvents(fetchedEvents);
    });
    return () => unsubscribe();
  }, [cohortId]);

  if (!auth.currentUser) return null;

  const handleTogglePepp = async (event: TimelineEvent, emoji: string) => {
    if (!auth.currentUser) return;
    try {
      await togglePeppOnTimelineEvent(
        { uid: auth.currentUser.uid, name: userProfile.name || 'Användare' },
        event,
        emoji
      );
    } catch (error) {
      console.error("Failed to react:", error);
    }
  };

  const handleAddComment = async (event: TimelineEvent, text: string) => {
    if (!auth.currentUser) return;
    try {
      await addCommentToTimelineEvent(event.id, {
        authorUid: auth.currentUser.uid,
        authorName: userProfile.name || 'Okänd',
        text,
        authorPhotoURL: userProfile.photoURL,
        timestamp: Date.now(),
        likes: {}
      });
    } catch (error) {
      console.error("Failed to add comment:", error);
    }
  };

  const handleToggleLike = async (event: TimelineEvent, commentId: string) => {
    if (!auth.currentUser) return;
    try {
      await toggleLikeOnComment(
        { uid: auth.currentUser.uid, name: userProfile.name || 'Användare' },
        event,
        commentId
      );
    } catch (error) {
      console.error("Failed to like comment:", error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!auth.currentUser) return;
    if (window.confirm('Är du säker på att du vill ta bort detta inlägg?')) {
      try {
        await deleteTimelineEvent(eventId);
      } catch (error) {
        console.error("Failed to delete event:", error);
      }
    }
  };

  return (
    <div className="space-y-4">
      {events.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">
          <p>Inga inlägg i denna bootcamp ännu.</p>
        </div>
      ) : (
        events.map((event) => (
          <TimelineEventCard
            key={event.id}
            event={event}
            currentUser={auth.currentUser!}
            userProfile={userProfile}
            onTogglePepp={handleTogglePepp}
            onAddComment={handleAddComment}
            onToggleLike={handleToggleLike}
            onToggleCommentReaction={async (event, commentId, emoji) => {
                // Placeholder for now, or implement it if needed
            }}
            onDelete={handleDeleteEvent}
            onImageClick={() => {}}
            lastViewTimestamp={null}
            buddyDetails={[]}
            currentStreak={0}
            activeBootcamp={activeBootcamp}
          />
        ))
      )}
    </div>
  );
};

export default BootcampFeed;
