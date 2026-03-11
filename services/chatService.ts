import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDoc, 
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Chat, ChatMessage, ChatType, NotificationLevel } from '../types';

// --- CHAT CREATION ---

export const createChat = async (
  type: ChatType,
  name: string,
  description: string,
  creatorId: string,
  initialMembers: string[] = [],
  invitePermission: 'admin_only' | 'everyone' = 'everyone'
): Promise<string> => {
  const members = Array.from(new Set([creatorId, ...initialMembers]));
  
  const memberSettings: Record<string, any> = {};
  members.forEach(uid => {
    memberSettings[uid] = {
      notificationLevel: 'all',
      lastReadTimestamp: Date.now()
    };
  });

  const now = Date.now();
  const chatData: Omit<Chat, 'id'> = {
    type,
    name,
    description,
    members,
    admins: [creatorId],
    invitePermission,
    memberSettings,
    createdAt: now,
    createdBy: creatorId,
    lastMessage: {
      text: 'Chatten skapades',
      timestamp: now,
      senderId: 'system'
    }
  };

  const chatRef = await addDoc(collection(db, 'chats'), chatData);
  return chatRef.id;
};

// --- CHAT SUBSCRIPTIONS ---

export const subscribeToUserChats = (
  userId: string,
  callback: (chats: Chat[]) => void
) => {
  // Query 1: Chats where user is a member
  // We remove orderBy here to avoid requiring a composite index in Firestore.
  // We will sort the results in memory instead.
  const memberQuery = query(
    collection(db, 'chats'),
    where('members', 'array-contains', userId)
  );

  return onSnapshot(memberQuery, (snapshot) => {
    const chats: Chat[] = [];
    snapshot.forEach(doc => {
      chats.push({ id: doc.id, ...doc.data() } as Chat);
    });
    
    // Sort in memory (newest first)
    chats.sort((a, b) => {
      const timeA = a.lastMessage?.timestamp || a.createdAt;
      const timeB = b.lastMessage?.timestamp || b.createdAt;
      return timeB - timeA;
    });
    
    callback(chats);
  });
};

export const subscribeToPublicRooms = (
  callback: (chats: Chat[]) => void
) => {
  // Remove orderBy to avoid composite index requirement
  const publicQuery = query(
    collection(db, 'chats'),
    where('type', '==', 'public_room')
  );

  return onSnapshot(publicQuery, (snapshot) => {
    const chats: Chat[] = [];
    snapshot.forEach(doc => {
      chats.push({ id: doc.id, ...doc.data() } as Chat);
    });
    
    // Sort in memory (newest first)
    chats.sort((a, b) => b.createdAt - a.createdAt);
    
    callback(chats);
  });
};

export const subscribeToChatMessages = (
  chatId: string,
  messageLimit: number,
  callback: (messages: ChatMessage[]) => void
) => {
  const q = query(
    collection(db, `chats/${chatId}/messages`),
    orderBy('timestamp', 'desc'),
    limit(messageLimit)
  );

  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() } as ChatMessage);
    });
    // Reverse to get chronological order
    callback(messages.reverse());
  });
};

// --- CHAT ACTIONS ---

export const sendMessage = async (
  chatId: string,
  senderId: string,
  senderName: string,
  text: string,
  senderPhotoURL?: string,
  imageUrl?: string
) => {
  const timestamp = Date.now();
  
  // Create message
  const messageData: Omit<ChatMessage, 'id'> = {
    chatId,
    senderId,
    senderName,
    text,
    timestamp,
    senderPhotoURL,
    ...(imageUrl ? { imageUrl } : {})
  };

  await addDoc(collection(db, `chats/${chatId}/messages`), messageData);

  // Update chat lastMessage
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: {
      text: imageUrl ? (text || 'Skickade en bild') : text,
      timestamp,
      senderId,
      senderName
    }
  });
};

export const addMembersToChat = async (chatId: string, userIds: string[]) => {
  const chatRef = doc(db, 'chats', chatId);
  
  const updates: Record<string, any> = {
    members: arrayUnion(...userIds)
  };

  userIds.forEach(uid => {
    updates[`memberSettings.${uid}`] = {
      notificationLevel: 'all',
      lastReadTimestamp: Date.now()
    };
  });

  await updateDoc(chatRef, updates);
};

export const removeMemberFromChat = async (chatId: string, userId: string) => {
  const chatRef = doc(db, 'chats', chatId);
  
  const updates: Record<string, any> = {
    members: arrayRemove(userId)
  };
  
  // We don't strictly need to delete the memberSettings, but we could.
  // Leaving it is fine, it just won't be used.
  await updateDoc(chatRef, updates);
};

export const updateChatName = async (chatId: string, newName: string) => {
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, { name: newName });
};

export const deleteChat = async (chatId: string) => {
  const chatRef = doc(db, 'chats', chatId);
  // Note: For a complete deletion, you'd also want to delete all messages in the subcollection.
  // In a real production app, this is often done via a Cloud Function to avoid client-side timeouts.
  // For now, we'll just delete the main chat document.
  await deleteDoc(chatRef);
};

export const editMessage = async (chatId: string, messageId: string, newText: string) => {
  const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
  await updateDoc(messageRef, {
    text: newText,
    isEdited: true
  });
};

export const deleteMessage = async (chatId: string, messageId: string) => {
  const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
  await updateDoc(messageRef, {
    text: 'Meddelandet har raderats',
    imageUrl: null,
    isDeleted: true
  });
};

export const toggleReactionMessage = async (
  chatId: string, 
  messageId: string, 
  userId: string, 
  userName: string, 
  emoji: string, 
  isAdding: boolean
) => {
  const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
  if (isAdding) {
    await updateDoc(messageRef, {
      [`reactions.${emoji}.${userId}`]: userName
    });
  } else {
    // We can't easily delete a specific key with updateDoc without FieldValue.delete(),
    // but setting it to null or using deleteField() works.
    // Let's import deleteField from firestore.
    const { deleteField } = await import('firebase/firestore');
    await updateDoc(messageRef, {
      [`reactions.${emoji}.${userId}`]: deleteField()
    });
  }
};

export const joinPublicRoom = async (chatId: string, userId: string) => {
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    members: arrayUnion(userId),
    [`memberSettings.${userId}`]: {
      notificationLevel: 'mentions', // Default to mentions for public rooms
      lastReadTimestamp: Date.now()
    }
  });
};

export const leaveChat = async (chatId: string, userId: string) => {
  const chatRef = doc(db, 'chats', chatId);
  // We don't delete the memberSettings to keep history, but we remove them from members array
  await updateDoc(chatRef, {
    members: arrayRemove(userId)
  });
};

export const updateLastRead = async (chatId: string, userId: string) => {
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    [`memberSettings.${userId}.lastReadTimestamp`]: Date.now()
  });
};

export const updateNotificationSettings = async (
  chatId: string, 
  userId: string, 
  level: NotificationLevel
) => {
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    [`memberSettings.${userId}.notificationLevel`]: level
  });
};
