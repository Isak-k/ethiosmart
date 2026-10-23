import { Subject, Chapter } from '@/types/subject';
import { Book, BookFilterOptions } from '@/types/book';
import { Exam, Department } from '@/integrations/firebase/types';

const DB_NAME = 'exam_pro_device_data';
const DB_VERSION = 1;

const STORE_SUBJECTS = 'subjects';
const STORE_CHAPTERS = 'chapters';
const STORE_EXAMS = 'exams';
const STORE_BOOKS = 'books';
const STORE_DEPARTMENTS = 'departments';
const STORE_META = 'sync_meta';

// Fast synchronous localStorage keys for 0ms initial render
const LS_SUBJECTS_KEY = 'exampro_cache_subjects_v2';
const LS_EXAMS_KEY = 'exampro_cache_exams_v2';
const LS_BOOKS_KEY = 'exampro_cache_books_v2';
const LS_DEPTS_KEY = 'exampro_cache_depts_v2';
const LS_SYNC_META_KEY = 'exampro_cache_meta_v2';

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or initialize IndexedDB instance for device data storage
 */
export function getDeviceDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn('Device storage IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_SUBJECTS)) {
        db.createObjectStore(STORE_SUBJECTS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
        const chapterStore = db.createObjectStore(STORE_CHAPTERS, { keyPath: 'id' });
        chapterStore.createIndex('subjectId', 'subjectId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_EXAMS)) {
        const examStore = db.createObjectStore(STORE_EXAMS, { keyPath: 'examId' });
        examStore.createIndex('departmentId', 'departmentId', { unique: false });
        examStore.createIndex('subjectId', 'subjectId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        const bookStore = db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
        bookStore.createIndex('resourceType', 'resourceType', { unique: false });
        bookStore.createIndex('subjectId', 'subjectId', { unique: false });
        bookStore.createIndex('departmentId', 'departmentId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_DEPARTMENTS)) {
        db.createObjectStore(STORE_DEPARTMENTS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
  });

  return dbPromise;
}

// -----------------------------------------------------------------------------
// SUBJECTS & CHAPTERS STORAGE
// -----------------------------------------------------------------------------

export async function saveDeviceSubjects(subjects: Subject[]): Promise<void> {
  if (!Array.isArray(subjects) || subjects.length === 0) return;

  // 1. Fast localStorage snapshot
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_SUBJECTS_KEY, JSON.stringify(subjects));
    }
  } catch (e) {
    // ignore quota error
  }

  // 2. Persistent IndexedDB store
  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_SUBJECTS], 'readwrite');
    const store = tx.objectStore(STORE_SUBJECTS);

    for (const subject of subjects) {
      if (subject?.id) {
        store.put(subject);
      }
    }
  } catch (err) {
    console.warn('Failed to save subjects to device IndexedDB:', err);
  }
}

export async function getDeviceSubjects(departmentId?: string): Promise<Subject[]> {
  // 1. Try IndexedDB
  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_SUBJECTS], 'readonly');
    const store = tx.objectStore(STORE_SUBJECTS);
    const request = store.getAll();

    const list: Subject[] = await new Promise((resolve) => {
      request.onsuccess = () => resolve((request.result as Subject[]) || []);
      request.onerror = () => resolve([]);
    });

    if (list && list.length > 0) {
      return filterSubjectsByDept(list, departmentId);
    }
  } catch {
    // fallback to localStorage
  }

  // 2. Fallback to localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_SUBJECTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return filterSubjectsByDept(parsed, departmentId);
        }
      }
    }
  } catch {
    // ignore
  }

  return [];
}

function filterSubjectsByDept(subjects: Subject[], departmentId?: string): Subject[] {
  if (!departmentId || departmentId === 'all') {
    return subjects;
  }
  return subjects.filter((s) => {
    if (!s.departmentIds || s.departmentIds.length === 0) return true;
    return s.departmentIds.includes(departmentId) || s.departmentIds.includes('all');
  });
}

export async function saveDeviceChapters(subjectId: string, chapters: Chapter[]): Promise<void> {
  if (!subjectId || !Array.isArray(chapters)) return;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`exampro_cache_chapters_${subjectId}`, JSON.stringify(chapters));
    }
  } catch {
    // ignore
  }

  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_CHAPTERS], 'readwrite');
    const store = tx.objectStore(STORE_CHAPTERS);

    for (const chapter of chapters) {
      if (chapter?.id) {
        store.put({
          ...chapter,
          subjectId,
        });
      }
    }
  } catch (err) {
    console.warn(`Failed to save chapters for subject ${subjectId}:`, err);
  }
}

export async function getDeviceChapters(subjectId: string): Promise<Chapter[]> {
  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_CHAPTERS], 'readonly');
    const store = tx.objectStore(STORE_CHAPTERS);
    const index = store.index('subjectId');
    const request = index.getAll(IDBKeyRange.only(subjectId));

    const list: Chapter[] = await new Promise((resolve) => {
      request.onsuccess = () => resolve((request.result as Chapter[]) || []);
      request.onerror = () => resolve([]);
    });

    if (list && list.length > 0) {
      return list.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    }
  } catch {
    // fallback
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`exampro_cache_chapters_${subjectId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
        }
      }
    }
  } catch {
    // ignore
  }

  return [];
}

// -----------------------------------------------------------------------------
// EXAMS STORAGE
// -----------------------------------------------------------------------------

export async function saveDeviceExams(exams: Exam[]): Promise<void> {
  if (!Array.isArray(exams) || exams.length === 0) return;

  try {
    if (typeof localStorage !== 'undefined') {
      // Save compact representation in localStorage
      const compact = exams.map((e) => ({
        examId: e.examId,
        title: e.title,
        description: e.description,
        durationMinutes: e.durationMinutes,
        questionCount: e.questionCount,
        departmentId: e.departmentId,
        departmentIds: e.departmentIds,
        subjectId: (e as any).subjectId,
        chapterId: (e as any).chapterId,
        chapterTitle: (e as any).chapterTitle,
        isPublished: e.isPublished,
        allowOfflineDownload: e.allowOfflineDownload,
        maxAttempts: e.maxAttempts,
      }));
      localStorage.setItem(LS_EXAMS_KEY, JSON.stringify(compact));
    }
  } catch {
    // ignore
  }

  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_EXAMS], 'readwrite');
    const store = tx.objectStore(STORE_EXAMS);

    for (const exam of exams) {
      if (exam?.examId) {
        store.put(exam);
      }
    }
  } catch (err) {
    console.warn('Failed to save exams to device storage:', err);
  }
}

export async function getDeviceExams(departmentId?: string, subjectId?: string): Promise<Exam[]> {
  let list: Exam[] = [];

  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_EXAMS], 'readonly');
    const store = tx.objectStore(STORE_EXAMS);
    const request = store.getAll();

    list = await new Promise((resolve) => {
      request.onsuccess = () => resolve((request.result as Exam[]) || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    // fallback
  }

  if (!list || list.length === 0) {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(LS_EXAMS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  // Filter by department
  if (departmentId && departmentId !== 'all') {
    list = list.filter((exam) => {
      if (!exam.departmentId && (!exam.departmentIds || exam.departmentIds.length === 0)) {
        return true;
      }
      if (exam.departmentId && exam.departmentId === departmentId) {
        return true;
      }
      if (exam.departmentIds && exam.departmentIds.includes(departmentId)) {
        return true;
      }
      return false;
    });
  }

  // Filter by subject
  if (subjectId && subjectId !== 'all') {
    list = list.filter((exam) => (exam as any).subjectId === subjectId);
  }

  return list;
}

export async function getDeviceExam(examId: string): Promise<Exam | null> {
  if (!examId) return null;

  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_EXAMS], 'readonly');
    const store = tx.objectStore(STORE_EXAMS);
    const request = store.get(examId);

    const exam = await new Promise<Exam | null>((resolve) => {
      request.onsuccess = () => resolve((request.result as Exam) || null);
      request.onerror = () => resolve(null);
    });

    if (exam) return exam;
  } catch {
    // fallback
  }

  const all = await getDeviceExams();
  return all.find((e) => e.examId === examId) || null;
}

// -----------------------------------------------------------------------------
// BOOKS & SHORTNOTES STORAGE
// -----------------------------------------------------------------------------

export async function saveDeviceBooks(books: Book[]): Promise<void> {
  if (!Array.isArray(books) || books.length === 0) return;

  // 1. Fast localStorage snapshot (strip large binary data if any to conserve quota)
  try {
    if (typeof localStorage !== 'undefined') {
      const summary = books.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        description: b.description,
        coverImageUrl: b.coverImageUrl,
        resourceType: b.resourceType,
        subjectId: b.subjectId,
        subjectName: b.subjectName,
        departmentId: b.departmentId,
        departmentIds: b.departmentIds,
        driveFileId: b.driveFileId,
        chapterLabels: b.chapterLabels,
        status: b.status,
        allowDownload: b.allowDownload,
        // Preserve shortnote structure
        sections: b.sections,
        keyTerms: b.keyTerms,
        keyTakeaways: b.keyTakeaways,
      }));
      localStorage.setItem(LS_BOOKS_KEY, JSON.stringify(summary));
    }
  } catch (e) {
    // ignore quota error
  }

  // 2. Full IndexedDB persistence (capable of storing full books & shortnotes content)
  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_BOOKS], 'readwrite');
    const store = tx.objectStore(STORE_BOOKS);

    for (const book of books) {
      if (book?.id) {
        store.put(book);
      }
    }
  } catch (err) {
    console.warn('Failed to save books to device storage:', err);
  }
}

export async function getDeviceBooks(
  options: BookFilterOptions = {},
  userRole?: string,
  userDeptId?: string
): Promise<Book[]> {
  let list: Book[] = [];

  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_BOOKS], 'readonly');
    const store = tx.objectStore(STORE_BOOKS);
    const request = store.getAll();

    list = await new Promise((resolve) => {
      request.onsuccess = () => resolve((request.result as Book[]) || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    // fallback
  }

  if (!list || list.length === 0) {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(LS_BOOKS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  // 1. Filter by status
  if (!isAdmin) {
    list = list.filter((b) => b.status === 'published' || !b.status);
  } else if (options.status && options.status !== 'all') {
    list = list.filter((b) => b.status === options.status);
  }

  // 2. Filter by department
  const targetDeptId = options.departmentId || userDeptId;
  if (targetDeptId && targetDeptId !== 'all') {
    list = list.filter((b) => {
      if (!b.departmentId || b.departmentId === 'all') return true;
      if (b.departmentId === targetDeptId) return true;
      if (Array.isArray(b.departmentIds) && (b.departmentIds.includes(targetDeptId) || b.departmentIds.includes('all'))) {
        return true;
      }
      return false;
    });
  }

  // 3. Filter by subject
  if (options.subjectId && options.subjectId !== 'all') {
    list = list.filter((b) => b.subjectId === options.subjectId);
  }

  // 4. Filter by resource type
  if (options.resourceType && options.resourceType !== 'all') {
    list = list.filter((b) => b.resourceType === options.resourceType);
  }

  // 5. Search query filtering
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
}

export async function getDeviceBook(id: string): Promise<Book | null> {
  if (!id) return null;

  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_BOOKS], 'readonly');
    const store = tx.objectStore(STORE_BOOKS);
    const request = store.get(id);

    const book = await new Promise<Book | null>((resolve) => {
      request.onsuccess = () => resolve((request.result as Book) || null);
      request.onerror = () => resolve(null);
    });

    if (book) return book;
  } catch {
    // fallback
  }

  const all = await getDeviceBooks();
  return all.find((b) => b.id === id) || null;
}

// -----------------------------------------------------------------------------
// DEPARTMENTS STORAGE
// -----------------------------------------------------------------------------

export async function saveDeviceDepartments(departments: Department[]): Promise<void> {
  if (!Array.isArray(departments) || departments.length === 0) return;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_DEPTS_KEY, JSON.stringify(departments));
    }
  } catch {
    // ignore
  }

  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_DEPARTMENTS], 'readwrite');
    const store = tx.objectStore(STORE_DEPARTMENTS);

    for (const dept of departments) {
      if (dept?.id) {
        store.put(dept);
      }
    }
  } catch (err) {
    console.warn('Failed to save departments to device storage:', err);
  }
}

export async function getDeviceDepartments(): Promise<Department[]> {
  try {
    const db = await getDeviceDB();
    const tx = db.transaction([STORE_DEPARTMENTS], 'readonly');
    const store = tx.objectStore(STORE_DEPARTMENTS);
    const request = store.getAll();

    const list: Department[] = await new Promise((resolve) => {
      request.onsuccess = () => resolve((request.result as Department[]) || []);
      request.onerror = () => resolve([]);
    });

    if (list && list.length > 0) return list;
  } catch {
    // fallback
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_DEPTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {
    // ignore
  }

  return [];
}

// -----------------------------------------------------------------------------
// STATS & BACKGROUND SYNC
// -----------------------------------------------------------------------------

export interface DeviceStorageStats {
  subjectsCount: number;
  examsCount: number;
  booksCount: number;
  notesCount: number;
  lastSyncedAt: number | null;
  isReadyOffline: boolean;
}

export async function getDeviceStorageStats(): Promise<DeviceStorageStats> {
  const [subjects, exams, books] = await Promise.all([
    getDeviceSubjects(),
    getDeviceExams(),
    getDeviceBooks(),
  ]);

  const textbooks = books.filter((b) => b.resourceType !== 'short_note');
  const notes = books.filter((b) => b.resourceType === 'short_note');

  let lastSyncedAt: number | null = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_SYNC_META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.lastSyncedAt) lastSyncedAt = Number(parsed.lastSyncedAt);
      }
    }
  } catch {
    // ignore
  }

  return {
    subjectsCount: subjects.length,
    examsCount: exams.length,
    booksCount: textbooks.length,
    notesCount: notes.length,
    lastSyncedAt,
    isReadyOffline: subjects.length > 0 || exams.length > 0 || books.length > 0,
  };
}

export function updateDeviceSyncTimestamp(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        LS_SYNC_META_KEY,
        JSON.stringify({ lastSyncedAt: Date.now() })
      );
    }
  } catch {
    // ignore
  }
}
