import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();
const SETTINGS_PATH = 'paymentSettings/config';

type BookData = FirebaseFirestore.DocumentData & { id: string };

function requireAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Please sign in first.');
  }
  return context.auth.uid;
}

function timestampValue(value: any): number {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAdminProfile(profile: FirebaseFirestore.DocumentData): boolean {
  return profile.role === 'admin' || profile.role === 'superadmin';
}

function matchesDepartment(book: BookData, departmentId: string): boolean {
  if (!departmentId || departmentId === 'all') return true;
  if (!book.departmentId || book.departmentId === 'all' || book.departmentId === departmentId) return true;
  return Array.isArray(book.departmentIds) &&
    (book.departmentIds.includes('all') || book.departmentIds.includes(departmentId));
}

function publicBookMetadata(book: BookData) {
  return {
    id: book.id,
    title: book.title || '',
    resourceType: book.resourceType || 'textbook',
    departmentId: book.departmentId || '',
    departmentIds: Array.isArray(book.departmentIds) ? book.departmentIds : [],
    departmentName: book.departmentName || '',
    subjectId: book.subjectId || '',
    subjectName: book.subjectName || '',
    chapterId: book.chapterId || '',
    chapterTitle: book.chapterTitle || '',
    chapterNumber: book.chapterNumber ?? null,
    description: book.description || '',
    author: book.author || '',
    edition: book.edition || '',
    publicationYear: book.publicationYear || '',
    language: book.language || 'English',
    chapterLabels: Array.isArray(book.chapterLabels) ? book.chapterLabels : [],
    status: book.status || 'published',
    mimeType: book.mimeType || '',
    fileSizeBytes: Number(book.fileSizeBytes || 0),
    pageCount: Number(book.pageCount || 0),
    coverImageUrl: book.coverImageUrl || '',
    readingTimeMinutes: Number(book.readingTimeMinutes || 0),
    createdAt: book.createdAt || null,
    updatedAt: book.updatedAt || null,
  };
}

async function getPublishedBooksForDepartment(departmentId: string): Promise<BookData[]> {
  const snapshot = await db.collection('books').where('status', '==', 'published').get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as BookData))
    .filter((book) => matchesDepartment(book, departmentId))
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt) || a.id.localeCompare(b.id));
}

function getFreeAccess(settings: FirebaseFirestore.DocumentData) {
  return settings.freeAccess || {};
}

function hasExplicitFreeAccess(book: BookData, free: FirebaseFirestore.DocumentData): boolean {
  const freeNoteIds = Array.isArray(free.freeNoteIds) ? free.freeNoteIds : [];
  const freeChapterIds = Array.isArray(free.freeChapterIds) ? free.freeChapterIds : [];
  return freeNoteIds.includes(book.id) ||
    (!!book.chapterId && freeChapterIds.includes(book.chapterId)) ||
    (!!book.id && freeChapterIds.includes(book.id));
}

function isWithinFreeNoteAllowance(book: BookData, books: BookData[], free: FirebaseFirestore.DocumentData): boolean {
  const count = Math.max(0, Math.floor(Number(free.freeNotesCount) || 0));
  if (count === 0 || book.resourceType !== 'short_note') return false;
  const notes = books.filter((item) => item.resourceType === 'short_note');
  return notes.slice(0, count).some((item) => item.id === book.id);
}

function isWithinFreeChapterAllowance(book: BookData, books: BookData[], free: FirebaseFirestore.DocumentData): boolean {
  const count = Math.max(0, Math.floor(Number(free.freeChaptersPerSubject) || 0));
  if (count === 0 || !book.subjectId || !book.chapterId) return false;
  const chapters = Array.from(new Set(
    books.filter((item) => item.subjectId === book.subjectId && item.chapterId)
      .sort((a, b) => (Number(a.chapterNumber) || 0) - (Number(b.chapterNumber) || 0) || a.id.localeCompare(b.id))
      .map((item) => item.chapterId as string)
  ));
  return chapters.slice(0, count).includes(book.chapterId);
}

/**
 * Returns safe book listing metadata only. Protected content and Drive identifiers
 * are deliberately omitted. This callable is an additive migration endpoint;
 * existing student clients are not switched until their UI is migrated.
 */
export const getStudentBookCatalog = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  const [profileSnap, settingsSnap, accountSnap, books] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.doc(SETTINGS_PATH).get(),
    db.collection('paymentAccounts').doc(uid).get(),
    getPublishedBooksForDepartment('all'),
  ]);
  if (!profileSnap.exists) throw new functions.https.HttpsError('permission-denied', 'Student profile not found.');
  const profile = profileSnap.data() || {};
  const lifetime = profileSnap.data()?.paymentAccess?.lifetime === true ||
    accountSnap.data()?.paymentAccess?.lifetime === true;
  const free = getFreeAccess(settingsSnap.data() || {});
  const isAdmin = isAdminProfile(profile);
  const departmentId = String(profile.departmentId || profile.department || '');
  const filtered = books.filter((book) => matchesDepartment(book, departmentId));
  return {
    books: filtered.map((book) => {
      const freeAccess = free.enabled !== false && (
        hasExplicitFreeAccess(book, free) ||
        isWithinFreeNoteAllowance(book, filtered, free) ||
        isWithinFreeChapterAllowance(book, filtered, free)
      );
      return {
        ...publicBookMetadata(book),
        access: isAdmin || lifetime || freeAccess ? 'available' : 'restricted',
      };
    }),
    access: { lifetime, isAdmin },
  };
});

/**
 * Returns a complete book only after server-side entitlement validation.
 * Free usage is tracked separately for notes and chapters, per student.
 */
export const getStudentBook = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const bookId = typeof data?.bookId === 'string' ? data.bookId.trim() : '';
  if (!bookId || bookId.length > 150) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid book ID is required.');
  }

  const [profileSnap, settingsSnap, accountSnap, bookSnap, allBooks] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.doc(SETTINGS_PATH).get(),
    db.collection('paymentAccounts').doc(uid).get(),
    db.collection('books').doc(bookId).get(),
    getPublishedBooksForDepartment('all'),
  ]);
  if (!profileSnap.exists) throw new functions.https.HttpsError('permission-denied', 'Student profile not found.');
  if (!bookSnap.exists) throw new functions.https.HttpsError('not-found', 'This learning resource was not found.');

  const profile = profileSnap.data() || {};
  const book = { id: bookSnap.id, ...bookSnap.data() } as BookData;
  if (book.status && book.status !== 'published' && !isAdminProfile(profile)) {
    throw new functions.https.HttpsError('not-found', 'This learning resource is not available.');
  }
  const departmentId = String(profile.departmentId || profile.department || '');
  if (!isAdminProfile(profile) && !matchesDepartment(book, departmentId)) {
    throw new functions.https.HttpsError('permission-denied', 'This resource is not available for your department.');
  }

  const settings = settingsSnap.data() || {};
  const free = getFreeAccess(settings);
  const lifetime = profile.paymentAccess?.lifetime === true ||
    accountSnap.data()?.paymentAccess?.lifetime === true;
  const isAdmin = isAdminProfile(profile);
  const catalogBooks = allBooks.filter((item) => matchesDepartment(item, departmentId));
  const freeById = hasExplicitFreeAccess(book, free);
  const freeByNoteCount = free.enabled !== false &&
    isWithinFreeNoteAllowance(book, catalogBooks, free);
  const freeByChapterCount = free.enabled !== false &&
    isWithinFreeChapterAllowance(book, catalogBooks, free);

  if (!isAdmin && !lifetime && free.enabled === false) {
    throw new functions.https.HttpsError('permission-denied', 'Payment approval is required to access this resource.');
  }
  if (!isAdmin && !lifetime && !freeById && !freeByNoteCount && !freeByChapterCount) {
    throw new functions.https.HttpsError('permission-denied', 'This resource requires approved lifetime access.');
  }

  if (!isAdmin && !lifetime && (freeById || freeByNoteCount || freeByChapterCount)) {
    const usageRef = db.collection('freeAccessUsage').doc(uid);
    await db.runTransaction(async (tx) => {
      const usageSnap = await tx.get(usageRef);
      const usage = usageSnap.data() || {};
      const grantedNotes: string[] = Array.isArray(usage.grantedNoteIds) ? usage.grantedNoteIds : [];
      const grantedChapters: string[] = Array.isArray(usage.grantedChapterIds) ? usage.grantedChapterIds : [];
      const nextNotes = new Set(grantedNotes);
      const nextChapters = new Set(grantedChapters);
      if (book.resourceType === 'short_note' && freeByNoteCount) nextNotes.add(book.id);
      if (book.chapterId && freeByChapterCount) nextChapters.add(book.subjectId + ':' + book.chapterId);
      if (freeById && book.resourceType === 'short_note') nextNotes.add(book.id);
      if (freeById && book.chapterId) nextChapters.add(book.subjectId + ':' + book.chapterId);
      tx.set(usageRef, {
        grantedNoteIds: Array.from(nextNotes),
        grantedChapterIds: Array.from(nextChapters),
        noteUsageCount: nextNotes.size,
        chapterUsageCount: nextChapters.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  }

  return {
    book: {
      ...book,
      id: book.id,
    },
    entitlement: lifetime ? 'lifetime' : isAdmin ? 'admin' : 'free',
  };
});
