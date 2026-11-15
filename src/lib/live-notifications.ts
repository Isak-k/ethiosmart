import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { auth } from '@/integrations/firebase/client';
import { db } from '@/integrations/firebase/client';
import { getCachedData, setCachedData } from '@/lib/app-cache';

export interface AppNotification {
  id: string;
  type: 'exam' | 'book' | 'short_note' | 'announcement' | 'payment';
  title: string;
  description: string;
  link: string;
  timestamp: number;
  departmentId?: string;
  departmentName?: string;
  isRead?: boolean;
}

const READ_NOTIFICATIONS_KEY = 'exampro_read_notifications_v1';

export function getReadNotificationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(READ_NOTIFICATIONS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markNotificationAsRead(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const readSet = getReadNotificationIds();
    readSet.add(id);
    localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(Array.from(readSet)));
  } catch (err) {
    console.warn('Error saving read notification:', err);
  }
}

export function markAllNotificationsAsRead(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const readSet = getReadNotificationIds();
    ids.forEach((id) => readSet.add(id));
    localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(Array.from(readSet)));
  } catch (err) {
    console.warn('Error saving read notifications:', err);
  }
}

/**
 * Fetch latest notifications across exams, books, study notes, and announcements
 */
export async function fetchRecentNotifications(userDeptId?: string): Promise<AppNotification[]> {
  const cacheKey = `recent_notifications_${userDeptId || 'all'}`;
  const cached = getCachedData<AppNotification[]>(cacheKey);
  if (cached) return cached;

  const notifications: AppNotification[] = [];
  const readIds = getReadNotificationIds();

  try {
    // 1. Fetch published exams
    const examsRef = collection(db, 'exams');
    const examsQuery = query(
      examsRef,
      where('isPublished', '==', true),
      limit(10)
    );
    const examsSnap = await getDocs(examsQuery);

    examsSnap.docs.forEach((doc) => {
      const data = doc.data();
      // Department filter
      if (
        userDeptId &&
        userDeptId !== 'all' &&
        data.departmentId &&
        data.departmentId !== 'all' &&
        data.departmentId !== userDeptId &&
        !(Array.isArray(data.departmentIds) && (data.departmentIds.includes(userDeptId) || data.departmentIds.includes('all')))
      ) {
        return;
      }

      let ts = Date.now();
      if (data.createdAt?.toMillis) ts = data.createdAt.toMillis();
      else if (data.createdAt?.seconds) ts = data.createdAt.seconds * 1000;

      notifications.push({
        id: `exam_${doc.id}`,
        type: 'exam',
        title: `New Exam: ${data.title || 'Untitled Exam'}`,
        description: data.description || 'A new exam has been published. Practice and test your knowledge!',
        link: `/dashboard/exams`,
        timestamp: ts,
        departmentId: data.departmentId,
        isRead: readIds.has(`exam_${doc.id}`),
      });
    });

    // 2. Fetch published books & short notes
    const booksRef = collection(db, 'books');
    const booksQuery = query(
      booksRef,
      where('status', '==', 'published'),
      limit(10)
    );
    const booksSnap = await getDocs(booksQuery);

    booksSnap.docs.forEach((doc) => {
      const data = doc.data();
      // Department filter
      if (
        userDeptId &&
        userDeptId !== 'all' &&
        data.departmentId &&
        data.departmentId !== 'all' &&
        data.departmentId !== userDeptId &&
        !(Array.isArray(data.departmentIds) && (data.departmentIds.includes(userDeptId) || data.departmentIds.includes('all')))
      ) {
        return;
      }

      let ts = Date.now();
      if (data.createdAt?.toMillis) ts = data.createdAt.toMillis();
      else if (data.createdAt?.seconds) ts = data.createdAt.seconds * 1000;

      const isNote = data.resourceType === 'short_note';
      notifications.push({
        id: `book_${doc.id}`,
        type: isNote ? 'short_note' : 'book',
        title: isNote ? `New Study Note: ${data.title}` : `New Textbook: ${data.title}`,
        description: data.description || (isNote ? 'Quick revision notes have been uploaded.' : 'A new curriculum textbook is available.'),
        link: `/dashboard/books/${doc.id}`,
        timestamp: ts,
        departmentId: data.departmentId,
        isRead: readIds.has(`book_${doc.id}`),
      });
    });

    // 3. Fetch announcements
    try {
      const announceRef = collection(db, 'communityChannels', 'announcements', 'messages');
      const announceQuery = query(announceRef, orderBy('createdAt', 'desc'), limit(5));
      const announceSnap = await getDocs(announceQuery);

      announceSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.deleted) return;

        let ts = Date.now();
        if (data.createdAt?.toMillis) ts = data.createdAt.toMillis();
        else if (data.createdAt?.seconds) ts = data.createdAt.seconds * 1000;

        notifications.push({
          id: `announcement_${doc.id}`,
          type: 'announcement',
          title: `Announcement: ${data.userName || 'Campus Admin'}`,
          description: data.text ? data.text.slice(0, 140) : 'New campus announcement posted.',
          link: `/dashboard/community`,
          timestamp: ts,
          isRead: readIds.has(`announcement_${doc.id}`),
        });
      });
    } catch (e) {
      // Announcements channel collection might be empty initially
    }

    // 4. Payment status notifications for the signed-in account
    if (auth.currentUser) {
      try {
        const paymentRef = collection(db, 'userNotifications', auth.currentUser.uid, 'items');
        const paymentSnap = await getDocs(query(paymentRef, orderBy('createdAt', 'desc'), limit(10)));
        paymentSnap.docs.forEach((doc) => {
          const data = doc.data();
          const ts = data.createdAt?.toMillis?.() || Date.now();
          notifications.push({
            id: 'payment_' + doc.id,
            type: 'payment',
            title: data.title || 'Payment update',
            description: data.description || 'Your payment status has changed.',
            link: data.link || '/dashboard/payment',
            timestamp: ts,
            isRead: readIds.has('payment_' + doc.id) || data.isRead === true,
          });
        });
      } catch (e) {
        console.warn('Payment notifications could not be loaded:', e);
      }
    }

    // Sort newest first
    notifications.sort((a, b) => b.timestamp - a.timestamp);
    setCachedData(cacheKey, notifications, 2 * 60 * 1000); // 2 minute cache
    return notifications;
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return [];
  }
}

/**
 * Subscribe to real-time new publications for the top notification banner
 */
export function subscribeToLivePublications(
  userDeptId: string | undefined,
  onNewItem: (item: AppNotification) => void
): () => void {
  const mountTime = Date.now() - 30000; // Ignore items older than 30 seconds before mount
  const readIds = getReadNotificationIds();

  // 1. Listen for new exams
  const examsRef = collection(db, 'exams');
  const unsubExams = onSnapshot(examsRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        if (!data.isPublished) return;

        // Department filter
        if (
          userDeptId &&
          userDeptId !== 'all' &&
          data.departmentId &&
          data.departmentId !== 'all' &&
          data.departmentId !== userDeptId &&
          !(Array.isArray(data.departmentIds) && (data.departmentIds.includes(userDeptId) || data.departmentIds.includes('all')))
        ) {
          return;
        }

        let ts = Date.now();
        if (data.createdAt?.toMillis) ts = data.createdAt.toMillis();
        else if (data.createdAt?.seconds) ts = data.createdAt.seconds * 1000;

        const notifId = `exam_${change.doc.id}`;
        if (ts > mountTime && !readIds.has(notifId)) {
          onNewItem({
            id: notifId,
            type: 'exam',
            title: `New Exam: ${data.title || 'Untitled Exam'}`,
            description: data.description || 'A new exam is now available for your department!',
            link: `/dashboard/exams`,
            timestamp: ts,
            departmentId: data.departmentId,
            isRead: false,
          });
        }
      }
    });
  }, (err) => console.warn('Live exams listener notice:', err));

  // 2. Listen for new books/study notes
  const booksRef = collection(db, 'books');
  const unsubBooks = onSnapshot(booksRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        if (data.status !== 'published') return;

        // Department filter
        if (
          userDeptId &&
          userDeptId !== 'all' &&
          data.departmentId &&
          data.departmentId !== 'all' &&
          data.departmentId !== userDeptId &&
          !(Array.isArray(data.departmentIds) && (data.departmentIds.includes(userDeptId) || data.departmentIds.includes('all')))
        ) {
          return;
        }

        let ts = Date.now();
        if (data.createdAt?.toMillis) ts = data.createdAt.toMillis();
        else if (data.createdAt?.seconds) ts = data.createdAt.seconds * 1000;

        const notifId = `book_${change.doc.id}`;
        if (ts > mountTime && !readIds.has(notifId)) {
          const isNote = data.resourceType === 'short_note';
          onNewItem({
            id: notifId,
            type: isNote ? 'short_note' : 'book',
            title: isNote ? `New Study Note: ${data.title}` : `New Textbook: ${data.title}`,
            description: data.description || (isNote ? 'New study notes uploaded to your library.' : 'New textbook available for download.'),
            link: `/dashboard/books/${change.doc.id}`,
            timestamp: ts,
            departmentId: data.departmentId,
            isRead: false,
          });
        }
      }
    });
  }, (err) => console.warn('Live books listener notice:', err));

  return () => {
    unsubExams();
    unsubBooks();
  };
}
