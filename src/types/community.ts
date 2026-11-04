import { Timestamp } from 'firebase/firestore';

export type ChannelCategory = 'announcements' | 'general' | 'department' | 'subject';

export interface CommunityChannel {
  id: string;
  name: string;
  description: string;
  category: ChannelCategory;
  icon?: string;
  departmentId?: string;
  subjectId?: string;
  isOfficialOnly?: boolean; // Only admins/teachers can post top-level announcements
  displayOrder?: number;
}

export interface MessageReactionMap {
  [emoji: string]: string[]; // array of userIds
}

export interface ReplyReference {
  id: string;
  userName: string;
  userRole?: string;
  text: string;
}

export interface CommunityMessage {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userRole: 'admin' | 'examiner' | 'student' | 'teacher';
  userAvatar?: string;
  text: string;
  isPinned?: boolean;
  pinnedBy?: string;
  pinnedAt?: Timestamp | any;
  replyTo?: ReplyReference;
  reactions?: MessageReactionMap;
  createdAt: Timestamp | any;
  updatedAt?: Timestamp | any;
  deleted?: boolean;
}
