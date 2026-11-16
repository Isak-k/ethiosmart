import { callBackend, isBackendPermissionDenied } from '@/lib/api/backend';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { Book, BookInput, BookFilterOptions } from '@/types/book';
import { getSubject } from '@/lib/subjects';
import { getSubjectCover } from '@/lib/subject-covers';
import { removeUndefinedFields, restoreFirestoreData } from '@/lib/firestore-utils';
import { getCachedData, setCachedData, invalidateCacheKey } from '@/lib/app-cache';
import {
  saveDeviceBooks,
  getDeviceBooks,
  getDeviceBook,
} from '@/lib/device-storage';
import { db } from '@/integrations/firebase/client';

const BOOKS_COLLECTION = 'books';
const BOOKMARKS_COLLECTION = 'bookBookmarks';

export async function getBooks(
  options: BookFilterOptions = {},
  userRole?: string,
  userDeptId?: string
): Promise<Book[]> {
  const cacheKey = `books_${userRole || 'student'}_${userDeptId || 'all'}_${JSON.stringify(options)}`;
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  if (!isAdmin) {
    try {
      const payload = await callBackend<{ books?: Book[] }>('/api/content-access/getStudentBookCatalog');
      let list = payload.books || [];
      const targetDeptId = options.departmentId || userDeptId;
      if (targetDeptId && targetDeptId !== 'all') {
        list = list.filter((book) =>
          !book.departmentId || book.departmentId === 'all' ||
          book.departmentId === targetDeptId ||
          (Array.isArray(book.departmentIds) &&
            (book.departmentIds.includes(targetDeptId) || book.departmentIds.includes('all')))
        );
      }
      if (options.subjectId && options.subjectId !== 'all') {
        list = list.filter((book) => book.subjectId === options.subjectId);
      }
      if (options.resourceType && options.resourceType !== 'all') {
        list = list.filter((book) => book.resourceType === options.resourceType);
      }
      if (options.searchQuery?.trim()) {
        const search = options.searchQuery.toLowerCase().trim();
        list = list.filter((book) =>
          book.title?.toLowerCase().includes(search) ||
          book.author?.toLowerCase().includes(search) ||
          book.description?.toLowerCase().includes(search) ||
          book.subjectName?.toLowerCase().includes(search) ||
          (Array.isArray(book.chapterLabels) && book.chapterLabels.some((label) => label.toLowerCase().includes(search)))
        );
      }
      setCachedData(cacheKey, list, 60 * 1000);
      return list;
    } catch (error) {
      console.warn('Secure book catalog unavailable; falling back to cached device metadata:', error);
      try {
        return await getDeviceBooks(options, userRole, userDeptId);
      } catch {
        return [];
      }
    }
  }

  const cachedList = getCachedData<Book[]>(cacheKey);
  if (cachedList) return cachedList;

  try {
    const booksRef = collection(db, BOOKS_COLLECTION);
    let snapshot;
    try {
      if (!isAdmin) {
        const q = query(booksRef, where('status', '==', 'published'));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(booksRef);
      }
    } catch (queryErr) {
      console.warn('Filtered books query failed, trying basic collection fetch:', queryErr);
      snapshot = await getDocs(booksRef);
    }

    let list: Book[] = snapshot.docs.map((d) => {
      const data = restoreFirestoreData(d.data());
      return { id: d.id, ...data } as Book;
    });

    if (!isAdmin) {
      list = list.filter((b) => b.status === 'published' || !b.status);
    } else if (options.status && options.status !== 'all') {
      list = list.filter((b) => b.status === options.status);
    }

    list.sort((a, b) => {
      const getMillis = (val: any) => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (typeof val.seconds === 'number') return val.seconds * 1000;
        const parsed = new Date(val).getTime();
        return isNaN(parsed) ? 0 : parsed;
      };
      return getMillis(b.createdAt) - getMillis(a.createdAt);
    });

    const targetDeptId = options.departmentId || (!isAdmin && userDeptId && userDeptId !== 'all' ? userDeptId : undefined);
    if (targetDeptId && targetDeptId !== 'all') {
      list = list.filter((b) => {
        if (!b.departmentId || b.departmentId === 'all') return true;
        if (b.departmentId === targetDeptId) return true;
        if (Array.isArray(b.departmentIds) && (b.departmentIds.includes(targetDeptId) || b.departmentIds.includes('all'))) return true;
        return false;
      });
    }
    if (options.subjectId && options.subjectId !== 'all') {
      list = list.filter((b) => b.subjectId === options.subjectId);
    }
    if (options.resourceType && options.resourceType !== 'all') {
      list = list.filter((b) => b.resourceType === options.resourceType);
    }
    if (options.searchQuery && options.searchQuery.trim().length > 0) {
      const qLower = options.searchQuery.toLowerCase().trim();
      list = list.filter((b) => {
        const titleMatch = b.title?.toLowerCase().includes(qLower);
        const authorMatch = b.author?.toLowerCase().includes(qLower);
        const descMatch = b.description?.toLowerCase().includes(qLower);
        const subjectMatch = b.subjectName?.toLowerCase().includes(qLower);
        const chapterMatch = Array.isArray(b.chapterLabels) && b.chapterLabels.some((c) => c.toLowerCase().includes(qLower));
        return titleMatch || authorMatch || descMatch || subjectMatch || chapterMatch;
      });
    }

    saveDeviceBooks(list).catch(() => {});
    setCachedData(cacheKey, list, 3 * 60 * 1000);
    return list;
  } catch (error) {
    console.warn('Error fetching books from Firestore, loading from device storage:', error);
    try {
      const deviceList = await getDeviceBooks(options, userRole, userDeptId);
      if (deviceList && deviceList.length > 0) return deviceList;
    } catch {}
    return [];
  }
}

export async function getBook(id: string): Promise<Book | null> {
  try {
    const payload = await callBackend<{ book: Book }>('/api/content-access/getStudentBook', { bookId: id });
    const book = { ...restoreFirestoreData(payload.book), id: payload.book.id || id } as Book;
    saveDeviceBooks([book]).catch(() => {});
    return book;
  } catch (error) {
    if (isBackendPermissionDenied(error)) throw error;
    console.warn(`Secure book fetch failed for ${id}; trying previously authorized offline content:`, error);
  }

  try {
    const deviceBook = await getDeviceBook(id);
    if (deviceBook) return deviceBook;
  } catch {}
  return null;
}

export async function createBook(input: BookInput, creatorId: string): Promise<string> {
  const booksRef = collection(db, BOOKS_COLLECTION);
  const now = serverTimestamp();

  let coverImageUrl = input.coverImageUrl?.trim() || '';
  if (!coverImageUrl && input.subjectId) {
    try {
      const sub = await getSubject(input.subjectId);
      if (sub) coverImageUrl = sub.coverImageUrl || getSubjectCover(sub.name).url;
    } catch {}
  }

  const data: Record<string, any> = {
    title: input.title.trim(),
    resourceType: input.resourceType,
    departmentId: input.departmentId,
    departmentIds: input.departmentIds || [],
    subjectId: input.subjectId,
    chapterId: input.chapterId || '',
    chapterTitle: input.chapterTitle || '',
    sourceType: input.sourceType || 'resource',
    sourceResourceId: input.sourceResourceId || '',
    driveUrl: input.driveUrl?.trim() || '',
    driveFileId: input.driveFileId?.trim() || '',
    storagePath: input.storagePath?.trim() || '',
    description: input.description?.trim() || '',
    author: input.author?.trim() || '',
    edition: input.edition?.trim() || '',
    publicationYear: input.publicationYear || '',
    language: input.language || 'English',
    chapterLabels: input.chapterLabels || [],
    status: input.status === 'draft' ? 'draft' : 'published',
    allowDownload: input.allowDownload ?? true,
    mimeType: input.mimeType || (input.resourceType === 'short_note' ? 'text/markdown' : 'application/pdf'),
    fileSizeBytes: input.fileSizeBytes || (input.content ? new Blob([input.content]).size : 0),
    pageCount: input.pageCount || (input.sections ? input.sections.length : 0),
    coverImageUrl,
    content: input.content || '',
    summary: input.summary || '',
    learningOutcomes: input.learningOutcomes || [],
    keyTakeaways: input.keyTakeaways || [],
    keyTerms: input.keyTerms || [],
    sections: input.sections || [],
    exercises: input.exercises || [],
    readingTimeMinutes: input.readingTimeMinutes || Math.max(1, Math.ceil((input.content || '').split(/\s+/).length / 200)),
    createdBy: creatorId,
    createdAt: now,
    updatedAt: now,
    viewCount: 0,
    downloadCount: 0,
  };

  if (input.chapterNumber !== undefined) data.chapterNumber = input.chapterNumber;
  if (input.examId) data.examId = input.examId;
  if (input.gradeLevel) data.gradeLevel = input.gradeLevel;
  if (input.courseName) data.courseName = input.courseName;
  if (input.subjectCategory) data.subjectCategory = input.subjectCategory;
  if (input.subjectName) data.subjectName = input.subjectName;
  if (input.departmentName) data.departmentName = input.departmentName;
  if (input.generationSettings) data.generationSettings = input.generationSettings;

  const cleanData = removeUndefinedFields(data);
  const docRef = await addDoc(booksRef, cleanData);
  invalidateCacheKey('books_');
  return docRef.id;
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<void> {
  const docRef = doc(db, BOOKS_COLLECTION, id);
  if (updates.subjectId && !updates.coverImageUrl) {
    try {
      const sub = await getSubject(updates.subjectId);
      if (sub) updates.coverImageUrl = sub.coverImageUrl || getSubjectCover(sub.name).url;
    } catch {}
  }
  const cleanUpdates = removeUndefinedFields(updates);
  if (cleanUpdates.status !== undefined) {
    cleanUpdates.status = cleanUpdates.status === 'draft' ? 'draft' : 'published';
  }
  cleanUpdates.updatedAt = serverTimestamp();
  await updateDoc(docRef, cleanUpdates);
  invalidateCacheKey('books_');
}

export async function deleteBook(id: string): Promise<void> {
  const docRef = doc(db, BOOKS_COLLECTION, id);
  await deleteDoc(docRef);
  invalidateCacheKey('books_');
}

export async function incrementBookView(id: string): Promise<void> {
  try {
    const docRef = doc(db, BOOKS_COLLECTION, id);
    await updateDoc(docRef, { viewCount: increment(1) });
  } catch {}
}

export async function incrementBookDownload(id: string): Promise<void> {
  try {
    const docRef = doc(db, BOOKS_COLLECTION, id);
    await updateDoc(docRef, { downloadCount: increment(1) });
  } catch {}
}

export async function getUserBookBookmarks(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const bookmarksRef = collection(db, BOOKMARKS_COLLECTION);
    const q = query(bookmarksRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data().bookId as string);
  } catch { return []; }
}

export async function toggleBookBookmark(userId: string, bookId: string): Promise<boolean> {
  if (!userId || !bookId) return false;
  const bookmarkDocId = `${userId}_${bookId}`;
  const docRef = doc(db, BOOKMARKS_COLLECTION, bookmarkDocId);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) { await deleteDoc(docRef); return false; }
    else {
      await updateDoc(docRef, { userId, bookId, createdAt: serverTimestamp() }).catch(async () => {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(docRef, { userId, bookId, createdAt: serverTimestamp() });
      });
      return true;
    }
  } catch { return false; }
}

export async function getRecentBooks(limitCount = 6, userDeptId?: string): Promise<Book[]> {
  try {
    const allBooks = await getBooks({}, 'student', userDeptId);
    return allBooks.slice(0, limitCount);
  } catch { return []; }
}
