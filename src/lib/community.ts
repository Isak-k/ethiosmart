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
import { Subject } from '@/types/subject';

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
  {
    id: 'study-tips',
    name: 'Study Tips & Exam Prep',
    description: 'Share past exam tips, revision guides, mnemonics, and preparation strategies.',
    category: 'general',
    icon: '💡',
    displayOrder: 3,
  },
];

/**
 * Builds the complete list of community channels combining built-in lounges,
 * department study halls, and subject-specific discussion rooms.
 */
export function buildCommunityChannels(
  departments: Department[] = [],
  subjects: Subject[] = []
): CommunityChannel[] {
  const channels: CommunityChannel[] = [...BUILTIN_SYSTEM_CHANNELS];

  // Department channels
  departments.forEach((dept, idx) => {
    if (!dept.id || !dept.name) return;
    channels.push({
      id: `dept_${dept.id}`,
      name: dept.name,
      description: `Discussions, group study, and notices for ${dept.name} students.`,
      category: 'department',
      departmentId: dept.id,
      icon: '🏛️',
      displayOrder: 10 + idx,
    });
  });

  // Subject channels
  subjects.forEach((subj, idx) => {
    if (!subj.id || !subj.name) return;
    channels.push({
      id: `subject_${subj.id}`,
      name: subj.name,
      description: `Course questions, practice problem reviews, and study group for ${subj.name}.`,
      category: 'subject',
      subjectId: subj.id,
      departmentId: subj.departmentIds?.[0],
      icon: '📚',
      displayOrder: 100 + idx,
    });
  });

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
