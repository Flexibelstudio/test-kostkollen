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
  invitePermission: 'admin_only' | 'everyone' = 'everyone',
  requiresApproval: boolean = false,
  isSystemGroup: boolean = false
): Promise<string> => {
  if (!db) return '';
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
    requiresApproval,
    isSystemGroup,
    pendingMembers: [],
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
  if (!db) return () => {};
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

export const subscribeToSystemGroups = (
  callback: (chats: Chat[]) => void
) => {
  if (!db) return () => {};
  const systemQuery = query(
    collection(db, 'chats'),
    where('isSystemGroup', '==', true)
  );

  return onSnapshot(systemQuery, (snapshot) => {
    const chats: Chat[] = [];
    snapshot.forEach((doc) => {
      chats.push({ id: doc.id, ...doc.data() } as Chat);
    });
    
    // Sort client-side
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
  if (!db) return () => {};
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
  if (!db) return () => {};
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

export const sendDirectMessage = async (
  senderId: string,
  senderName: string,
  recipientId: string,
  recipientName: string,
  text: string
) => {
  if (!db) return;
  
  // Try to find an existing direct chat between these two users
  const q = query(
    collection(db, 'chats'),
    where('type', '==', 'direct'),
    where('members', 'array-contains', senderId)
  );
  
  const snapshot = await getDocs(q);
  let chatId: string | null = null;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.members.includes(recipientId)) {
      chatId = doc.id;
    }
  });
  
  // If no chat exists, create one
  if (!chatId) {
    const chatName = `${senderName} & ${recipientName}`;
    chatId = await createChat(
      'direct',
      chatName,
      'Direktmeddelande',
      senderId,
      [recipientId],
      'admin_only',
      false,
      false
    );
  }
  
  // Send the message
  await sendMessage(chatId, senderId, senderName, text);
};

export const sendMessage = async (
  chatId: string,
  senderId: string,
  senderName: string,
  text: string,
  senderPhotoURL?: string,
  imageUrl?: string,
  replyTo?: ChatMessage['replyTo'],
  sharedEventPreview?: ChatMessage['sharedEventPreview']
) => {
  if (!db) return;
  const timestamp = Date.now();
  
  // Create message
  const messageData: Omit<ChatMessage, 'id'> = {
    chatId,
    senderId,
    senderName,
    text,
    timestamp,
    ...(senderPhotoURL ? { senderPhotoURL } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(sharedEventPreview ? { sharedEventPreview } : {})
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
  if (!db) return;
  const chatRef = doc(db, 'chats', chatId);
  
  const memberSettings: Record<string, any> = {};
  userIds.forEach(uid => {
    memberSettings[uid] = {
      notificationLevel: 'all',
      lastReadTimestamp: Date.now()
    };
  });

  await setDoc(chatRef, {
    members: arrayUnion(...userIds),
    memberSettings
  }, { merge: true });
};

export const removeMemberFromChat = async (chatId: string, userId: string) => {
  if (!db) return;
  const chatRef = doc(db, 'chats', chatId);
  
  const updates: Record<string, any> = {
    members: arrayRemove(userId)
  };
  
  // We don't strictly need to delete the memberSettings, but we could.
  // Leaving it is fine, it just won't be used.
  await updateDoc(chatRef, updates);
};

export const updateChatName = async (chatId: string, newName: string) => {
  if (!db) return;
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, { name: newName });
};

export const deleteChat = async (chatId: string) => {
  if (!db) return;
  const chatRef = doc(db, 'chats', chatId);
  // Note: For a complete deletion, you'd also want to delete all messages in the subcollection.
  // In a real production app, this is often done via a Cloud Function to avoid client-side timeouts.
  // For now, we'll just delete the main chat document.
  await deleteDoc(chatRef);
};

export const editMessage = async (chatId: string, messageId: string, newText: string) => {
  if (!db) return;
  const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
  await updateDoc(messageRef, {
    text: newText,
    isEdited: true
  });
};

export const deleteMessage = async (chatId: string, messageId: string) => {
  if (!db) return;
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
  if (!db) return;
  const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
  const { deleteField } = await import('firebase/firestore');
  
  if (isAdding) {
    // First, get the current message to remove any existing reactions from this user
    const messageDoc = await getDoc(messageRef);
    if (messageDoc.exists()) {
      const data = messageDoc.data();
      const updates: any = {};
      
      // Remove user from all other reactions
      if (data.reactions) {
        Object.keys(data.reactions).forEach(existingEmoji => {
          if (existingEmoji !== emoji && data.reactions[existingEmoji] && data.reactions[existingEmoji][userId]) {
            updates[`reactions.${existingEmoji}.${userId}`] = deleteField();
          }
        });
      }
      
      // Add the new reaction
      updates[`reactions.${emoji}.${userId}`] = userName;
      
      await updateDoc(messageRef, updates);
    }
  } else {
    await updateDoc(messageRef, {
      [`reactions.${emoji}.${userId}`]: deleteField()
    });
  }
};

export const joinPublicRoom = async (chatId: string, userId: string, requiresApproval: boolean = false) => {
  if (!db) return;
  const chatRef = doc(db, 'chats', chatId);
  
  if (requiresApproval) {
    await setDoc(chatRef, {
      pendingMembers: arrayUnion(userId)
    }, { merge: true });
  } else {
    await setDoc(chatRef, {
      members: arrayUnion(userId),
      memberSettings: {
        [userId]: {
          notificationLevel: 'all',
          lastReadTimestamp: Date.now()
        }
      }
    }, { merge: true });
  }
};

export const approveMember = async (chatId: string, userId: string) => {
  if (!db) return;
  const chatRef = doc(db, 'chats', chatId);
  await setDoc(chatRef, {
    pendingMembers: arrayRemove(userId),
    members: arrayUnion(userId),
    memberSettings: {
      [userId]: {
        notificationLevel: 'all',
        lastReadTimestamp: Date.now()
      }
    }
  }, { merge: true });
};

export const rejectMember = async (chatId: string, userId: string) => {
  if (!db) return;
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    pendingMembers: arrayRemove(userId)
  });
};

export const leaveChat = async (chatId: string, userId: string) => {
  if (!db) return;
  const chatRef = doc(db, 'chats', chatId);
  // We don't delete the memberSettings to keep history, but we remove them from members array
  await updateDoc(chatRef, {
    members: arrayRemove(userId)
  });
};

export const updateLastRead = async (chatId: string, userId: string) => {
  if (!db) return;
  const chatRef = doc(db, 'chats', chatId);
  await setDoc(chatRef, {
    memberSettings: {
      [userId]: {
        lastReadTimestamp: Date.now()
      }
    }
  }, { merge: true });
};

export const updateNotificationSettings = async (
  chatId: string, 
  userId: string, 
  level: NotificationLevel
) => {
  if (!db) return;
  const chatRef = doc(db, 'chats', chatId);
  await setDoc(chatRef, {
    memberSettings: {
      [userId]: {
        notificationLevel: level
      }
    }
  }, { merge: true });
};
