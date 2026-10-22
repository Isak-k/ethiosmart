import { db } from '@/integrations/firebase/client';
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

const BOOKS_COLLECTION = 'books';
const BOOKMARKS_COLLECTION = 'bookBookmarks';

/**
 * Fetch all books matching filter options with department & role protection.
 */
export async function getBooks(
  options: BookFilterOptions = {},
  userRole?: string,
  userDeptId?: string
): Promise<Book[]> {
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
      const data = d.data();
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
    const targetDeptId = options.departmentId;
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

    return list;
  } catch (error) {
    console.error('Error fetching books from Firestore:', error);
    return [];
  }
}

/**
 * Fetch a single book by ID
 */
export async function getBook(id: string): Promise<Book | null> {
  try {
    const docRef = doc(db, BOOKS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...snap.data(),
    } as Book;
  } catch (error) {
    console.error(`Error fetching book ${id}:`, error);
    return null;
  }
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

  const data: Omit<Book, 'id'> = {
    title: input.title.trim(),
    resourceType: input.resourceType,
    departmentId: input.departmentId,
    departmentIds: input.departmentIds || [],
    subjectId: input.subjectId,
    chapterId: input.chapterId || '',
    chapterTitle: input.chapterTitle || '',
    driveUrl: input.driveUrl?.trim() || '',
    driveFileId: input.driveFileId?.trim() || '',
    description: input.description?.trim() || '',
    author: input.author?.trim() || '',
    edition: input.edition?.trim() || '',
    publicationYear: input.publicationYear || '',
    language: input.language || 'English',
    chapterLabels: input.chapterLabels || [],
    status: input.status || 'published',
    allowDownload: input.allowDownload ?? true,
    mimeType: input.mimeType || (input.resourceType === 'short_note' ? 'text/markdown' : 'application/pdf'),
    fileSizeBytes: input.fileSizeBytes || (input.content ? new Blob([input.content]).size : 0),
    pageCount: input.pageCount || (input.sections ? input.sections.length : 0),
    coverImageUrl: coverImageUrl,
    // Interactive Shortnotes fields
    content: input.content || '',
    summary: input.summary || '',
    keyTakeaways: input.keyTakeaways || [],
    keyTerms: input.keyTerms || [],
    sections: input.sections || [],
    readingTimeMinutes: input.readingTimeMinutes || Math.max(1, Math.ceil((input.content || '').split(/\s+/).length / 200)),
    createdBy: creatorId,
    createdAt: now,
    updatedAt: now,
    viewCount: 0,
    downloadCount: 0,
  };

  const docRef = await addDoc(booksRef, data);
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

  // Strip any undefined keys to satisfy Firestore updateDoc validation
  const cleanUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  cleanUpdates.updatedAt = serverTimestamp();

  await updateDoc(docRef, cleanUpdates);
}

/**
 * Delete a book document
 */
export async function deleteBook(id: string): Promise<void> {
  const docRef = doc(db, BOOKS_COLLECTION, id);
  await deleteDoc(docRef);
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
