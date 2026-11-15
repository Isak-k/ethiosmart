import { Book } from '@/types/book';
import { auth } from '@/integrations/firebase/client';
import { incrementBookDownload } from '@/lib/books';
import { formatFileSize, extractDriveFileId } from '@/lib/google-drive';

const DB_NAME = 'exam_pro_offline_books';
const DB_VERSION = 1;
const STORE_NAME = 'offline_books';

export interface OfflineBookRecord {
  bookId: string;
  book: Book;
  blob: Blob;
  mimeType: string;
  fileName: string;
  size: number;
  downloadedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize IndexedDB instance for offline books storage
 */
export function initOfflineBooksDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Offline books IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
        store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Check if a book is already downloaded and saved offline
 */
export async function isBookSavedOffline(bookId: string): Promise<boolean> {
  try {
    const db = await initOfflineBooksDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(bookId);

      request.onsuccess = () => {
        resolve(Boolean(request.result));
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  } catch (err) {
    console.error('Error checking offline book status:', err);
    return false;
  }
}

/**
 * Retrieve a specific offline book record by bookId
 */
export async function getOfflineBook(bookId: string): Promise<OfflineBookRecord | null> {
  try {
    const db = await initOfflineBooksDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(bookId);

      request.onsuccess = () => {
        const record = (request.result as OfflineBookRecord) || null;
        if (record && record.blob) {
          // Ensure PDF MIME type is correctly attached so modern browser PDF viewers can render it
          const isPdf =
            record.fileName?.toLowerCase().endsWith('.pdf') ||
            record.mimeType === 'application/pdf' ||
            record.book?.mimeType === 'application/pdf';
          if (isPdf && record.blob.type !== 'application/pdf') {
            record.blob = new Blob([record.blob], { type: 'application/pdf' });
          }
        }
        resolve(record);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error(`Error loading offline book ${bookId}:`, err);
    return null;
  }
}

/**
 * Retrieve all books saved offline for offline library browsing
 */
export async function getAllOfflineBooks(): Promise<OfflineBookRecord[]> {
  try {
    const db = await initOfflineBooksDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result as OfflineBookRecord[]) || [];
        // Sort newest downloaded first
        records.sort((a, b) => b.downloadedAt - a.downloadedAt);
        resolve(records);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Error getting all offline books:', err);
    return [];
  }
}

/**
 * Save book metadata and file blob into IndexedDB
 */
export async function saveBookOffline(
  book: Book,
  blob: Blob,
  fileName?: string
): Promise<void> {
  const db = await initOfflineBooksDB();
  const cleanFileName =
    fileName || `${book.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

  const isPdf =
    cleanFileName.toLowerCase().endsWith('.pdf') ||
    book.mimeType === 'application/pdf' ||
    blob.type === 'application/pdf';

  const effectiveBlob =
    isPdf && blob.type !== 'application/pdf'
      ? new Blob([blob], { type: 'application/pdf' })
      : blob;

  const record: OfflineBookRecord = {
    bookId: book.id,
    book,
    blob: effectiveBlob,
    mimeType: isPdf ? 'application/pdf' : effectiveBlob.type || 'application/octet-stream',
    fileName: cleanFileName,
    size: effectiveBlob.size,
    downloadedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Read a fetch Response into a Blob while reporting download progress (0-100).
 * When the server sends a Content-Length header we stream the body and report the
 * real percentage; otherwise we fall back to reading the whole body at once.
 */
async function readResponseWithProgress(
  res: Response,
  onProgressPercent?: (percent: number) => void
): Promise<Blob> {
  const total = Number(res.headers.get('content-length')) || 0;
  const contentType = res.headers.get('content-type') || '';
  if (!res.body || !onProgressPercent || total <= 0) {
    return res.blob();
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgressPercent(Math.min(99, Math.round((received / total) * 100)));
    }
  }
  return new Blob(chunks as BlobPart[], contentType ? { type: contentType } : undefined);
}

/**
 * Download a book file from Google Drive via backend proxy or direct link and store offline
 */
export async function downloadAndSaveBookOffline(
  book: Book,
  onProgress?: (message: string) => void,
  onProgressPercent?: (percent: number) => void
): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Please sign in again before downloading this resource.');
  }

  onProgress?.('Verifying your access and connecting...');
  const idToken = await auth.currentUser.getIdToken();
  const proxyUrl = `/api/drive/download?bookId=${encodeURIComponent(book.id)}`;
  const response = await fetch(proxyUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.error || 'You are not authorized to download this resource.');
  }

  onProgress?.('Downloading authorized document...');
  const blob = await readResponseWithProgress(response, onProgressPercent);
  const headBytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const isPdf = headBytes[0] === 0x25 && headBytes[1] === 0x50 &&
    headBytes[2] === 0x44 && headBytes[3] === 0x46;
  if (!isPdf) {
    throw new Error('The downloaded content is not a valid PDF document.');
  }

  const disposition = response.headers.get('content-disposition');
  const fileNameMatch = disposition?.match(/filename="([^"]+)"/i);
  const resolvedFileName = fileNameMatch?.[1]
    ? decodeURIComponent(fileNameMatch[1])
    : `${book.title}.pdf`;

  onProgress?.('Saving to local storage for offline browsing...');
  await saveBookOffline(book, blob, resolvedFileName);
  incrementBookDownload(book.id).catch(() => {});
}

/**
 * Remove an offline book from IndexedDB to free up storage space
 */
export async function deleteOfflineBook(bookId: string): Promise<void> {
  const db = await initOfflineBooksDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(bookId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Remove all offline books from IndexedDB
 */
export async function clearAllOfflineBooks(): Promise<void> {
  const db = await initOfflineBooksDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Get total storage usage of offline books
 */
export async function getOfflineBooksStorageStats(): Promise<{
  totalBytes: number;
  formattedSize: string;
  count: number;
}> {
  const records = await getAllOfflineBooks();
  const totalBytes = records.reduce((acc, r) => acc + (r.size || 0), 0);
  return {
    totalBytes,
    formattedSize: formatFileSize(totalBytes),
    count: records.length,
  };
}

/**
 * Export / save an offline book blob directly to the user's computer
 */
export async function exportOfflineBookToDisk(bookId: string): Promise<void> {
  const record = await getOfflineBook(bookId);
  if (!record) {
    throw new Error('Resource is not available offline.');
  }

  const url = URL.createObjectURL(record.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = record.fileName || `${record.book.title}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
