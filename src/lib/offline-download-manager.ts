/**
 * Offline Download Manager
 * Manages downloading, storing, and managing offline content for departments and exams
 */

import { Exam, Question } from '@/integrations/firebase/types';
import { initOfflineDB } from './offline-storage';

const DOWNLOAD_METADATA_STORE = 'download_metadata';
const DOWNLOAD_CACHE_STORE = 'download_cache';

export interface DownloadMetadata {
  examId: string;
  departmentId: string;
  examTitle: string;
  downloadedAt: number;
  size: number; // in bytes
  questionCount: number;
  status: 'completed' | 'partial' | 'failed';
  version: number; // for update detection
}

export interface DownloadStatus {
  examId: string;
  status: 'not-downloaded' | 'downloaded' | 'update-available' | 'downloading' | 'failed';
  downloadedAt?: number;
  size?: number;
  progress?: number; // 0-100 for downloading
  error?: string;
}

/**
 * Initialize download metadata stores
 */
async function initDownloadStores(): Promise<IDBDatabase> {
  const db = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOWNLOAD_METADATA_STORE, DOWNLOAD_CACHE_STORE], 'readwrite');
    
    transaction.onerror = () => {
      console.error('Transaction error:', transaction.error);
      reject(transaction.error);
    };

    transaction.oncomplete = () => {
      resolve(db);
    };

    // Create stores if they don't exist
    try {
      if (!db.objectStoreNames.contains(DOWNLOAD_METADATA_STORE)) {
        db.createObjectStore(DOWNLOAD_METADATA_STORE, { keyPath: 'examId' });
      }
      if (!db.objectStoreNames.contains(DOWNLOAD_CACHE_STORE)) {
        db.createObjectStore(DOWNLOAD_CACHE_STORE, { keyPath: 'examId' });
      }
    } catch (error) {
      // Stores might already exist
      console.log('Download stores already exist or error creating:', error);
    }
  });
}

/**
 * Save download metadata
 */
export async function saveDownloadMetadata(metadata: DownloadMetadata): Promise<void> {
  const db = await initDownloadStores();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOWNLOAD_METADATA_STORE, 'readwrite');
    const store = transaction.objectStore(DOWNLOAD_METADATA_STORE);
    const request = store.put(metadata);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log(`✓ Download metadata saved for exam: ${metadata.examId}`);
      resolve();
    };
  });
}

/**
 * Get download metadata for an exam
 */
export async function getDownloadMetadata(examId: string): Promise<DownloadMetadata | null> {
  const db = await initDownloadStores();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOWNLOAD_METADATA_STORE, 'readonly');
    const store = transaction.objectStore(DOWNLOAD_METADATA_STORE);
    const request = store.get(examId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Get all downloaded exams for a department
 */
export async function getDownloadedExamsForDepartment(departmentId: string): Promise<DownloadMetadata[]> {
  const db = await initDownloadStores();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOWNLOAD_METADATA_STORE, 'readonly');
    const store = transaction.objectStore(DOWNLOAD_METADATA_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const allMetadata = request.result as DownloadMetadata[];
      const filtered = allMetadata.filter(m => m.departmentId === departmentId);
      resolve(filtered);
    };
  });
}

/**
 * Delete downloaded exam
 */
export async function deleteDownloadedExam(examId: string): Promise<void> {
  const db = await initDownloadStores();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOWNLOAD_METADATA_STORE, DOWNLOAD_CACHE_STORE], 'readwrite');
    
    const metadataStore = transaction.objectStore(DOWNLOAD_METADATA_STORE);
    const cacheStore = transaction.objectStore(DOWNLOAD_CACHE_STORE);
    
    metadataStore.delete(examId);
    cacheStore.delete(examId);

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      console.log(`✓ Downloaded exam deleted: ${examId}`);
      resolve();
    };
  });
}

/**
 * Get total storage used by downloads
 */
export async function getDownloadStorageUsage(): Promise<number> {
  const db = await initDownloadStores();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOWNLOAD_METADATA_STORE, 'readonly');
    const store = transaction.objectStore(DOWNLOAD_METADATA_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const allMetadata = request.result as DownloadMetadata[];
      const totalSize = allMetadata.reduce((sum, m) => sum + (m.size || 0), 0);
      resolve(totalSize);
    };
  });
}

/**
 * Clear all downloads
 */
export async function clearAllDownloads(): Promise<void> {
  const db = await initDownloadStores();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOWNLOAD_METADATA_STORE, DOWNLOAD_CACHE_STORE], 'readwrite');
    
    const metadataStore = transaction.objectStore(DOWNLOAD_METADATA_STORE);
    const cacheStore = transaction.objectStore(DOWNLOAD_CACHE_STORE);
    
    metadataStore.clear();
    cacheStore.clear();

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      console.log('✓ All downloads cleared');
      resolve();
    };
  });
}

/**
 * Get download status for an exam
 */
export async function getDownloadStatus(exam: Exam, remoteVersion?: number): Promise<DownloadStatus> {
  const metadata = await getDownloadMetadata(exam.examId);

  if (!metadata) {
    return {
      examId: exam.examId,
      status: 'not-downloaded',
    };
  }

  // Check if update is available
  if (remoteVersion && remoteVersion > metadata.version) {
    return {
      examId: exam.examId,
      status: 'update-available',
      downloadedAt: metadata.downloadedAt,
      size: metadata.size,
    };
  }

  return {
    examId: exam.examId,
    status: 'downloaded',
    downloadedAt: metadata.downloadedAt,
    size: metadata.size,
  };
}

/**
 * Format bytes to human-readable size
 */
export function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Estimate download size for an exam
 */
export function estimateExamSize(exam: Exam, questionCount: number): number {
  // Rough estimation: 2KB per question + 5KB for exam metadata
  const questionsSize = questionCount * 2048;
  const metadataSize = 5120;
  return questionsSize + metadataSize;
}
