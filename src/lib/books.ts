import app, { db } from '@/integrations/firebase/client';
import { getFunctions, httpsCallable } from 'firebase/functions';
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

const BOOKS_COLLECTION = 'books';
const BOOKMARKS_COLLECTION = 'bookBookmarks';
const contentFunctions = getFunctions(app);
const getStudentBookCatalogCallable = httpsCallable(contentFunctions, 'getStudentBookCatalog');
const getStudentBookCallable = httpsCallable(contentFunctions, 'getStudentBook');

/**
 * Fetch all books matching filter options with department & role protection.
 */
export async function getBooks(
  options: BookFilterOptions = {},
  userRole?: string,
  userDeptId?: string
): Promise<Book[]> {
  const cacheKey = `books_${userRole || 'student'}_${userDeptId || 'all'}_${JSON.stringify(options)}`;
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  // Student catalogs are delivered by a callable that omits protected fields.
  // Always ask the server first; only previously cached metadata is a fallback.
  if (!isAdmin) {
    try {
      const response = await getStudentBookCatalogCallable();
      const payload = response.data as { books?: Book[] };
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
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    // Fetch books with fallback:
    // If student, query specifically where status == 'published'
    // If that fails (e.g. index/permission rule variations), fall back to basic getDocs
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
      return {
        id: d.id,
        ...data,
      } as Book;
    });

    // 1. Role-based status filtering: Non-admins ONLY see published resources
    if (!isAdmin) {
      list = list.filter((b) => b.status === 'published' || !b.status);
    } else if (options.status && options.status !== 'all') {
      list = list.filter((b) => b.status === options.status);
    }

    // 2. Sort by createdAt descending in memory (resilient against Firestore index issues)
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

    // 3. Department filtering:
    const targetDeptId = options.departmentId || (!isAdmin && userDeptId && userDeptId !== 'all' ? userDeptId : undefined);
    if (targetDeptId && targetDeptId !== 'all') {
      list = list.filter((b) => {
        if (!b.departmentId || b.departmentId === 'all') return true;
        if (b.departmentId === targetDeptId) return true;
        if (Array.isArray(b.departmentIds) && (b.departmentIds.includes(targetDeptId) || b.departmentIds.includes('all'))) return true;
        return false;
      });
    }

    // 4. Subject filtering
    if (options.subjectId && options.subjectId !== 'all') {
      list = list.filter((b) => b.subjectId === options.subjectId);
    }

    // 5. Resource type filtering ('textbook' vs 'short_note')
    if (options.resourceType && options.resourceType !== 'all') {
      list = list.filter((b) => b.resourceType === options.resourceType);
    }

    // 6. Search query filtering (matches title, author, description, subject, or chapter labels)
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

    // Auto-cache all fetched books and notes on device and in-memory cache
    saveDeviceBooks(list).catch(() => {});
    setCachedData(cacheKey, list, 3 * 60 * 1000);

    return list;
  } catch (error) {
    console.warn('Error fetching books from Firestore, loading from device storage:', error);
    try {
      const deviceList = await getDeviceBooks(options, userRole, userDeptId);
      if (deviceList && deviceList.length > 0) {
        return deviceList;
      }
    } catch (deviceErr) {
      console.warn('Error reading books from device storage:', deviceErr);
    }
    return [];
  }
}

/**
 * Fetch a single book by ID
 */
export async function getBook(id: string): Promise<Book | null> {
  try {
    const response = await getStudentBookCallable({ bookId: id });
    const payload = response.data as { book: Book };
    const book = {
      ...restoreFirestoreData(payload.book),
      id: payload.book.id || id,
    } as Book;
    saveDeviceBooks([book]).catch(() => {});
    return book;
  } catch (error) {
    console.warn(`Secure book fetch failed for ${id}; trying previously authorized offline content:`, error);
  }

  // Offline device storage fallback
  try {
    const deviceBook = await getDeviceBook(id);
    if (deviceBook) return deviceBook;
  } catch {
    // ignore
  }

  return null;
}

/**
 * Create a new book document
 */
export async function createBook(input: BookInput, creatorId: string): Promise<string> {
  const booksRef = collection(db, BOOKS_COLLECTION);
  const now = serverTimestamp();

  // If coverImageUrl is empty, automatically look up the subject's cover
  let coverImageUrl = input.coverImageUrl?.trim() || '';
  if (!coverImageUrl && input.subjectId) {
    try {
      const sub = await getSubject(input.subjectId);
      if (sub) {
        coverImageUrl = sub.coverImageUrl || getSubjectCover(sub.name).url;
      }
    } catch (err) {
      console.warn('Could not auto-fetch subject cover in createBook:', err);
    }
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
    coverImageUrl: coverImageUrl,
    // Interactive Shortnotes fields
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

  if (input.chapterNumber !== undefined) {
    data.chapterNumber = input.chapterNumber;
  }
  if (input.examId) {
    data.examId = input.examId;
  }
  if (input.gradeLevel) {
    data.gradeLevel = input.gradeLevel;
  }
  if (input.courseName) {
    data.courseName = input.courseName;
  }
  if (input.subjectCategory) {
    data.subjectCategory = input.subjectCategory;
  }
  if (input.subjectName) {
    data.subjectName = input.subjectName;
  }
  if (input.departmentName) {
    data.departmentName = input.departmentName;
  }
  if (input.generationSettings) {
    data.generationSettings = input.generationSettings;
  }

  // Deeply strip any undefined values to satisfy Firestore addDoc validation
  const cleanData = removeUndefinedFields(data);
  const docRef = await addDoc(booksRef, cleanData);
  invalidateCacheKey('books_');
  return docRef.id;
}

/**
 * Update an existing book document
 */
export async function updateBook(id: string, updates: Partial<Book>): Promise<void> {
  const docRef = doc(db, BOOKS_COLLECTION, id);

  // If subjectId is specified and no custom coverImageUrl is set, sync subject cover
  if (updates.subjectId && !updates.coverImageUrl) {
    try {
      const sub = await getSubject(updates.subjectId);
      if (sub) {
        updates.coverImageUrl = sub.coverImageUrl || getSubjectCover(sub.name).url;
      }
    } catch (err) {
      console.warn('Could not auto-fetch subject cover in updateBook:', err);
    }
  }

  // Deeply strip any undefined keys or nested undefined values to satisfy Firestore updateDoc validation
  const cleanUpdates = removeUndefinedFields(updates);
  if (cleanUpdates.status !== undefined) {
    cleanUpdates.status = cleanUpdates.status === 'draft' ? 'draft' : 'published';
  }
  cleanUpdates.updatedAt = serverTimestamp();

  await updateDoc(docRef, cleanUpdates);
  invalidateCacheKey('books_');
}

/**
 * Delete a book document
 */
export async function deleteBook(id: string): Promise<void> {
  const docRef = doc(db, BOOKS_COLLECTION, id);
  await deleteDoc(docRef);
  invalidateCacheKey('books_');
}

/**
 * Increment view count
 */
export async function incrementBookView(id: string): Promise<void> {
  try {
    const docRef = doc(db, BOOKS_COLLECTION, id);
    await updateDoc(docRef, {
      viewCount: increment(1),
    });
  } catch (e) {
    console.warn(`Could not increment view for book ${id}:`, e);
  }
}

/**
 * Increment download count
 */
export async function incrementBookDownload(id: string): Promise<void> {
  try {
    const docRef = doc(db, BOOKS_COLLECTION, id);
    await updateDoc(docRef, {
      downloadCount: increment(1),
    });
  } catch (e) {
    console.warn(`Could not increment download for book ${id}:`, e);
  }
}

/**
 * Get all book IDs bookmarked by a user
 */
export async function getUserBookBookmarks(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const bookmarksRef = collection(db, BOOKMARKS_COLLECTION);
    const q = query(bookmarksRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data().bookId as string);
  } catch (error) {
    console.error('Error fetching user bookmarks:', error);
    return [];
  }
}

/**
 * Toggle a bookmark for a user (add if missing, remove if present).
 * Returns true if book is now bookmarked, false if unbookmarked.
 */
export async function toggleBookBookmark(userId: string, bookId: string): Promise<boolean> {
  if (!userId || !bookId) return false;
  const bookmarkDocId = `${userId}_${bookId}`;
  const docRef = doc(db, BOOKMARKS_COLLECTION, bookmarkDocId);

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await deleteDoc(docRef);
      return false;
    } else {
      await updateDoc(docRef, {
        userId,
        bookId,
        createdAt: serverTimestamp(),
      }).catch(async () => {
        // Fallback to set if document doesn't exist
        const { setDoc } = await import('firebase/firestore');
        await setDoc(docRef, {
          userId,
          bookId,
          createdAt: serverTimestamp(),
        });
      });
      return true;
    }
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    return false;
  }
}

/**
 * Fetch recently added books for the shelf
 */
export async function getRecentBooks(limitCount = 6, userDeptId?: string): Promise<Book[]> {
  try {
    const allBooks = await getBooks({}, 'student', userDeptId);
    return allBooks.slice(0, limitCount);
  } catch (e) {
    console.error('Error fetching recent books:', e);
    return [];
  }
}
