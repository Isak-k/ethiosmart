import {
  collection,
  query,
  where,
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
  writeBatch,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { CommunityChannel, CommunityMessage, ReplyReference } from '@/types/community';
import { Department } from '@/integrations/firebase/types';
import { getDepartments } from '@/lib/departments';

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

export interface ClearMessagesOptions {
  channelId: string;
  olderThanDays?: number; // 0 or undefined = all messages
  preservePinned?: boolean; // default true
  softDelete?: boolean; // default false (permanent deletion reclaims Firestore storage)
}

export interface ClearMessagesResult {
  channelId: string;
  deletedCount: number;
}

export interface ClearAllChannelsOptions {
  channelIds?: string[];
  olderThanDays?: number;
  preservePinned?: boolean;
  softDelete?: boolean;
}

export interface ClearAllChannelsResult {
  totalDeleted: number;
  channelResults: Record<string, number>;
}

export interface ChannelStorageStat {
  channelId: string;
  name: string;
  messageCount: number;
}

export interface ChatStorageStats {
  totalMessages: number;
  channels: ChannelStorageStat[];
}

/**
 * Permanently cleans / purges messages in a specific channel based on age.
 * Uses batched writes (up to 400 docs per batch) to efficiently delete from Firestore.
 */
export async function clearChannelMessages(
  options: ClearMessagesOptions
): Promise<ClearMessagesResult> {
  const { channelId, olderThanDays = 0, preservePinned = true, softDelete = false } = options;
  const messagesRef = collection(db, 'communityChannels', channelId, 'messages');

  const cutoffDate =
    olderThanDays > 0 ? new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) : null;

  let snapshot;
  if (cutoffDate) {
    try {
      const q = query(messagesRef, where('createdAt', '<=', Timestamp.fromDate(cutoffDate)));
      snapshot = await getDocs(q);
    } catch (queryErr) {
      console.warn(`Query with timestamp filter failed for ${channelId}, using full scan:`, queryErr);
      snapshot = await getDocs(messagesRef);
    }
  } else {
    snapshot = await getDocs(messagesRef);
  }

  const docsToDelete = snapshot.docs.filter((docSnap) => {
    const data = docSnap.data();
    if (preservePinned && Boolean(data.isPinned)) {
      return false;
    }
    if (cutoffDate) {
      let createdDate: Date | null = null;
      if (data.createdAt?.toDate) {
        createdDate = data.createdAt.toDate();
      } else if (data.createdAt?.seconds) {
        createdDate = new Date(data.createdAt.seconds * 1000);
      } else if (data.createdAt) {
        createdDate = new Date(data.createdAt);
      }
      if (createdDate && createdDate.getTime() > cutoffDate.getTime()) {
        return false;
      }
    }
    return true;
  });

  let deletedCount = 0;
  for (let i = 0; i < docsToDelete.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = docsToDelete.slice(i, i + 400);

    for (const docSnap of chunk) {
      if (softDelete) {
        batch.update(docSnap.ref, {
          deleted: true,
          text: '[Message cleared by admin retention cleanup]',
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.delete(docSnap.ref);
      }
    }

    await batch.commit();
    deletedCount += chunk.length;
  }

  return { channelId, deletedCount };
}

/**
 * Cleans messages across all community channels (Announcements, General, and all Department channels).
 */
export async function clearAllChannelsMessages(
  options: ClearAllChannelsOptions = {}
): Promise<ClearAllChannelsResult> {
  const { channelIds, olderThanDays = 0, preservePinned = true, softDelete = false } = options;

  let targetChannels: string[] = [];
  if (channelIds && channelIds.length > 0) {
    targetChannels = channelIds;
  } else {
    targetChannels = ['announcements', 'general'];
    try {
      const depts = await getDepartments();
      depts.forEach((d) => {
        if (d.id) targetChannels.push(`dept_${d.id}`);
      });
    } catch (err) {
      console.error('Error fetching departments for chat cleanup:', err);
    }
  }

  let totalDeleted = 0;
  const channelResults: Record<string, number> = {};

  for (const chId of targetChannels) {
    try {
      const res = await clearChannelMessages({
        channelId: chId,
        olderThanDays,
        preservePinned,
        softDelete,
      });
      channelResults[chId] = res.deletedCount;
      totalDeleted += res.deletedCount;
    } catch (err) {
      console.error(`Failed to clear messages in channel ${chId}:`, err);
      channelResults[chId] = 0;
    }
  }

  return { totalDeleted, channelResults };
}

/**
 * Inspects chat storage by checking message counts for all channels.
 */
export async function getChatStorageStats(channels?: CommunityChannel[]): Promise<ChatStorageStats> {
  let targetChannels = channels;
  if (!targetChannels || targetChannels.length === 0) {
    try {
      const depts = await getDepartments();
      targetChannels = buildCommunityChannels(depts, { userRole: 'admin' });
    } catch {
      targetChannels = BUILTIN_SYSTEM_CHANNELS;
    }
  }

  const stats: ChannelStorageStat[] = [];
  let total = 0;

  for (const channel of targetChannels) {
    try {
      const messagesRef = collection(db, 'communityChannels', channel.id, 'messages');
      let count = 0;
      try {
        const countSnap = await getCountFromServer(messagesRef);
        count = countSnap.data().count;
      } catch {
        const snap = await getDocs(messagesRef);
        count = snap.size;
      }

      stats.push({
        channelId: channel.id,
        name: channel.name,
        messageCount: count,
      });
      total += count;
    } catch {
      stats.push({
        channelId: channel.id,
        name: channel.name,
        messageCount: 0,
      });
    }
  }

  return { totalMessages: total, channels: stats };
}
