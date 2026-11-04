import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { CommunityChannel, CommunityMessage, ReplyReference } from '@/types/community';
import { Department } from '@/integrations/firebase/types';

export const BUILTIN_SYSTEM_CHANNELS: CommunityChannel[] = [
  {
    id: 'announcements',
    name: 'Official Announcements',
    description: 'Important university notices, exam schedules, and updates from instructors.',
    category: 'announcements',
    icon: '📢',
    isOfficialOnly: true,
    displayOrder: 1,
  },
  {
    id: 'general',
    name: 'General Campus Lounge',
    description: 'Connect with peers, discuss university life, share study tips and general discussions.',
    category: 'general',
    icon: '🌍',
    displayOrder: 2,
  },
];

/**
 * Builds the list of community channels according to user role:
 * - Student: Sees Official Announcements and ONLY their assigned department chat.
 * - Admin / Instructor: Sees Official Announcements, General Lounge, and ALL department chats.
 * - Chat by subject is removed.
 */
export function buildCommunityChannels(
  departments: Department[] = [],
  options?: {
    userRole?: string;
    userDepartmentId?: string;
  }
): CommunityChannel[] {
  const { userRole = 'student', userDepartmentId } = options || {};
  const isAdmin =
    userRole === 'admin' ||
    userRole === 'examiner' ||
    userRole === 'teacher' ||
    userRole === 'superadmin';

  if (isAdmin) {
    // Admin sees Announcements + General Lounge + ALL Department channels
    const channels: CommunityChannel[] = [...BUILTIN_SYSTEM_CHANNELS];

    departments.forEach((dept, idx) => {
      if (!dept.id || !dept.name) return;
      channels.push({
        id: `dept_${dept.id}`,
        name: `${dept.name} Department`,
        description: `Discussions and group study for ${dept.name} students.`,
        category: 'department',
        departmentId: dept.id,
        icon: '🏛️',
        displayOrder: 10 + idx,
      });
    });

    return channels;
  }

  // Student role:
  // 1. Official Announcements
  const channels: CommunityChannel[] = [BUILTIN_SYSTEM_CHANNELS[0]];

  // 2. ONLY their assigned department chat
  const matchingDept = departments.find(
    (d) => d.id === userDepartmentId || d.name?.toLowerCase() === userDepartmentId?.toLowerCase()
  );

  if (matchingDept) {
    channels.push({
      id: `dept_${matchingDept.id}`,
      name: `${matchingDept.name} Department`,
      description: `Discussions and study group for ${matchingDept.name} students.`,
      category: 'department',
      departmentId: matchingDept.id,
      icon: '🏛️',
      displayOrder: 2,
    });
  } else if (userDepartmentId) {
    channels.push({
      id: `dept_${userDepartmentId}`,
      name: 'My Department Chat',
      description: 'Discussions and group study with department peers.',
      category: 'department',
      departmentId: userDepartmentId,
      icon: '🏛️',
      displayOrder: 2,
    });
  } else if (departments.length > 0) {
    const firstDept = departments[0];
    channels.push({
      id: `dept_${firstDept.id}`,
      name: `${firstDept.name} Department`,
      description: `Discussions and group study for ${firstDept.name} students.`,
      category: 'department',
      departmentId: firstDept.id,
      icon: '🏛️',
      displayOrder: 2,
    });
  }

  return channels;
}

/**
 * Subscribes to real-time messages in a specific channel.
 */
export function subscribeToChannelMessages(
  channelId: string,
  onUpdate: (messages: CommunityMessage[]) => void,
  onError?: (error: Error) => void
): () => void {
  const messagesRef = collection(db, 'communityChannels', channelId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: CommunityMessage[] = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            channelId,
            userId: data.userId || '',
            userName: data.userName || 'Anonymous',
            userEmail: data.userEmail || '',
            userRole: data.userRole || 'student',
            userAvatar: data.userAvatar,
            text: data.text || '',
            isPinned: Boolean(data.isPinned),
            pinnedBy: data.pinnedBy,
            pinnedAt: data.pinnedAt,
            replyTo: data.replyTo,
            reactions: data.reactions || {},
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            deleted: Boolean(data.deleted),
          } as CommunityMessage;
        })
        .filter((m) => !m.deleted)
        // Reverse so chronological order (oldest -> newest) for top-to-bottom chat
        .reverse();

      onUpdate(msgs);
    },
    (err) => {
      console.error(`Error subscribing to channel ${channelId}:`, err);
      if (onError) onError(err);
    }
  );
}

/**
 * Sends a message to a channel.
 */
export async function sendCommunityMessage(params: {
  channelId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userRole: 'admin' | 'examiner' | 'student' | 'teacher';
  userAvatar?: string;
  text: string;
  replyTo?: ReplyReference;
}): Promise<string> {
  const { channelId, userId, userName, userEmail, userRole, userAvatar, text, replyTo } = params;
  const messagesRef = collection(db, 'communityChannels', channelId, 'messages');

  const docRef = await addDoc(messagesRef, {
    channelId,
    userId,
    userName,
    userEmail: userEmail || '',
    userRole: userRole || 'student',
    userAvatar: userAvatar || '',
    text: text.trim(),
    replyTo: replyTo || null,
    reactions: {},
    isPinned: false,
    deleted: false,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Toggles an emoji reaction on a message.
 */
export async function toggleMessageReaction(params: {
  channelId: string;
  messageId: string;
  emoji: string;
  userId: string;
  currentReactions?: Record<string, string[]>;
}): Promise<void> {
  const { channelId, messageId, emoji, userId, currentReactions = {} } = params;
  const messageDocRef = doc(db, 'communityChannels', channelId, 'messages', messageId);

  const existingUsers = currentReactions[emoji] || [];
  const hasReacted = existingUsers.includes(userId);

  let updatedUsers: string[];
  if (hasReacted) {
    updatedUsers = existingUsers.filter((id) => id !== userId);
  } else {
    updatedUsers = [...existingUsers, userId];
  }

  const updatedReactions = {
    ...currentReactions,
    [emoji]: updatedUsers,
  };

  if (updatedUsers.length === 0) {
    delete updatedReactions[emoji];
  }

  await updateDoc(messageDocRef, {
    reactions: updatedReactions,
  });
}

/**
 * Pins or unpins a message.
 */
export async function pinCommunityMessage(params: {
  channelId: string;
  messageId: string;
  isPinned: boolean;
  pinnedBy: string;
}): Promise<void> {
  const { channelId, messageId, isPinned, pinnedBy } = params;
  const messageDocRef = doc(db, 'communityChannels', channelId, 'messages', messageId);

  await updateDoc(messageDocRef, {
    isPinned,
    pinnedBy: isPinned ? pinnedBy : null,
    pinnedAt: isPinned ? serverTimestamp() : null,
  });
}

/**
 * Deletes a message (soft delete so references stay clean).
 */
export async function deleteCommunityMessage(params: {
  channelId: string;
  messageId: string;
}): Promise<void> {
  const { channelId, messageId } = params;
  const messageDocRef = doc(db, 'communityChannels', channelId, 'messages', messageId);

  await updateDoc(messageDocRef, {
    deleted: true,
    text: '[This message was deleted]',
    updatedAt: serverTimestamp(),
  });
}
