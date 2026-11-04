import { Book } from '@/types/book';
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
 * Download a book file from Google Drive via backend proxy or direct link and store offline
 */
export async function downloadAndSaveBookOffline(
  book: Book,
  onProgress?: (message: string) => void
): Promise<void> {
  const fileId = book.driveFileId || extractDriveFileId(book.driveUrl || '');
  if (!fileId) {
    throw new Error('This resource does not have a valid Google Drive file ID.');
  }

  onProgress?.('Connecting to Google Drive...');

  let blob: Blob | null = null;
  let resolvedFileName = `${book.title}.pdf`;

  // 1. Try local dev bridge / proxy first
  try {
    onProgress?.('Downloading document file...');
    const proxyUrl = `/api/drive/download?fileId=${encodeURIComponent(fileId)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        const potentialBlob = await res.blob();
        if (potentialBlob.size > 50) {
          const head = new Uint8Array(await potentialBlob.slice(0, 5).arrayBuffer());
          if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
            blob = potentialBlob;
            const disposition = res.headers.get('content-disposition');
            if (disposition) {
              const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
              if (match && match[1]) {
                resolvedFileName = decodeURIComponent(match[1]);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Proxy download attempt failed, falling back to direct URL:', e);
  }

  // 2. Fallback to direct Google Drive export download
  if (!blob || blob.size === 0) {
    try {
      const directUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
      const res = await fetch(directUrl, { mode: 'cors' });
      if (res.ok) {
        blob = await res.blob();
      }
    } catch (e) {
      console.warn('Direct fetch failed:', e);
    }
  }

  if (!blob || blob.size === 0) {
    throw new Error(
      'Could not download file from Google Drive. Please ensure the file is shared with "Anyone with the link can view".'
    );
  }

  // Ensure downloaded payload is valid PDF binary
  const headBytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const isPdf = headBytes[0] === 0x25 && headBytes[1] === 0x50 && headBytes[2] === 0x44 && headBytes[3] === 0x46;
  if (!isPdf) {
    throw new Error('The downloaded content is not a valid PDF file. Please ensure public access permissions are enabled on the Google Drive file.');
  }

  onProgress?.('Saving to local storage for offline browsing...');
  await saveBookOffline(book, blob, resolvedFileName);

  // Increment download counter in Firestore (non-blocking)
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
