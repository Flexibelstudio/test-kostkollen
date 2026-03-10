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
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { Chat, ChatMessage, ChatType, NotificationLevel } from '../types';

// --- CHAT CREATION ---

export const createChat = async (
  type: ChatType,
  name: string,
  description: string,
  creatorId: string,
  initialMembers: string[] = []
): Promise<string> => {
  const members = Array.from(new Set([creatorId, ...initialMembers]));
  
  const memberSettings: Record<string, any> = {};
  members.forEach(uid => {
    memberSettings[uid] = {
      notificationLevel: 'all',
      lastReadTimestamp: Date.now()
    };
  });

  const chatData: Omit<Chat, 'id'> = {
    type,
    name,
    description,
    members,
    admins: [creatorId],
    memberSettings,
    createdAt: Date.now(),
    createdBy: creatorId
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
  const memberQuery = query(
    collection(db, 'chats'),
    where('members', 'array-contains', userId),
    orderBy('lastMessage.timestamp', 'desc')
  );

  return onSnapshot(memberQuery, (snapshot) => {
    const chats: Chat[] = [];
    snapshot.forEach(doc => {
      chats.push({ id: doc.id, ...doc.data() } as Chat);
    });
    callback(chats);
  });
};

export const subscribeToPublicRooms = (
  callback: (chats: Chat[]) => void
) => {
  const publicQuery = query(
    collection(db, 'chats'),
    where('type', '==', 'public_room'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(publicQuery, (snapshot) => {
    const chats: Chat[] = [];
    snapshot.forEach(doc => {
      chats.push({ id: doc.id, ...doc.data() } as Chat);
    });
    callback(chats);
  });
};

export const subscribeToChatMessages = (
  chatId: string,
  callback: (messages: ChatMessage[]) => void
) => {
  const q = query(
    collection(db, `chats/${chatId}/messages`),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() } as ChatMessage);
    });
    callback(messages);
  });
};

// --- CHAT ACTIONS ---

export const sendMessage = async (
  chatId: string,
  senderId: string,
  senderName: string,
  text: string,
  senderPhotoURL?: string
) => {
  const timestamp = Date.now();
  
  // Create message
  const messageData: Omit<ChatMessage, 'id'> = {
    chatId,
    senderId,
    senderName,
    text,
    timestamp,
    senderPhotoURL
  };

  await addDoc(collection(db, `chats/${chatId}/messages`), messageData);

  // Update chat lastMessage
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: {
      text,
      timestamp,
      senderId
    }
  });
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
