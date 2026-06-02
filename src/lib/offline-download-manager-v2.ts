/**
 * Offline Download Manager v2
 * Advanced download management with progress tracking, storage quota, and version control
 */

import { Exam, Question, PracticeExamConfig } from '@/integrations/firebase/types';
import { 
  saveExamOffline, 
  saveQuestionsOffline, 
  savePracticeConfig,
  deleteOfflineExam,
  getOfflineStorageSize,
  getOfflineExam,
  getOfflineQuestions,
  getPracticeConfig,
  initOfflineDB
} from './offline-storage';
import { 
  trackDownloadedExam, 
  untrackDownloadedExam,
  getDownloadedExamIds 
} from './offline-state';

export interface DownloadProgress {
  examId: string;
  examTitle: string;
  progress: number; // 0-100
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
  downloadedAt?: number;
}

export interface DownloadStats {
  totalSize: number;
  totalExams: number;
  estimatedStorageUsage: string;
  storagePercentage: number;
}

// In-memory download progress tracker
const downloadProgress = new Map<string, DownloadProgress>();

/**
 * Estimate exam download size
 */
function estimateExamSize(exam: Exam, questionCount: number): number {
  // Rough estimation: 2KB per question + 5KB for exam metadata
  const questionsSize = questionCount * 2048;
  const configSize = 1024; // Practice config
  const metadataSize = 5120;
  return questionsSize + configSize + metadataSize;
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
 * Download exam with all data (metadata + questions + config)
 */
export async function downloadExamWithData(
  exam: Exam,
  questions: Question[],
  practiceConfig?: PracticeExamConfig | null,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const examId = exam.examId;
  
  try {
    // Initialize progress
    const progress: DownloadProgress = {
      examId,
      examTitle: exam.title,
      progress: 0,
      status: 'downloading',
    };
    downloadProgress.set(examId, progress);
    onProgress?.(progress);

    // Save exam metadata (20%)
    await saveExamOffline(exam);
    progress.progress = 20;
    onProgress?.(progress);

    // Save questions (60%)
    await saveQuestionsOffline(examId, questions);
    progress.progress = 60;
    onProgress?.(progress);

    // Save practice config if provided (80%)
    if (practiceConfig) {
      await savePracticeConfig(examId, practiceConfig);
    }
    progress.progress = 80;
    onProgress?.(progress);

    // Track downloaded exam (100%)
    trackDownloadedExam(examId);
    progress.progress = 100;
    progress.status = 'completed';
    progress.downloadedAt = Date.now();
    downloadProgress.set(examId, progress);
    onProgress?.(progress);

    console.log(`✓ Exam downloaded successfully: ${exam.title}`);
  } catch (error) {
    console.error('Download failed:', error);
    const progress: DownloadProgress = {
      examId,
      examTitle: exam.title,
      progress: downloadProgress.get(examId)?.progress || 0,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    downloadProgress.set(examId, progress);
    onProgress?.(progress);
    throw error;
  }
}

/**
 * Delete downloaded exam
 */
export async function deleteDownloadedExam(examId: string): Promise<void> {
  try {
    await deleteOfflineExam(examId);
    untrackDownloadedExam(examId);
    downloadProgress.delete(examId);
    console.log(`✓ Exam deleted: ${examId}`);
  } catch (error) {
    console.error('Failed to delete exam:', error);
    throw error;
  }
}

/**
 * Check if exam is downloaded
 */
export async function isExamDownloadedAndValid(examId: string): Promise<boolean> {
  try {
    const exam = await getOfflineExam(examId);
    if (!exam) return false;

    const questions = await getOfflineQuestions(examId);
    return questions.length > 0;
  } catch (error) {
    console.warn('Error checking exam validity:', error);
    return false;
  }
}

/**
 * Get download progress for an exam
 */
export function getDownloadProgress(examId: string): DownloadProgress | null {
  return downloadProgress.get(examId) || null;
}

/**
 * Get all active downloads
 */
export function getAllDownloadProgress(): DownloadProgress[] {
  return Array.from(downloadProgress.values());
}

/**
 * Clear download progress (when download completes)
 */
export function clearDownloadProgress(examId: string): void {
  downloadProgress.delete(examId);
}

/**
 * Get storage usage statistics
 */
export async function getDownloadStats(): Promise<DownloadStats> {
  try {
    const totalSize = await getOfflineStorageSize();
    const downloadedIds = getDownloadedExamIds();

    // Calculate storage percentage (assuming 50MB quota for IndexedDB)
    const storageQuota = 50 * 1024 * 1024; // 50MB
    const storagePercentage = Math.min((totalSize / storageQuota) * 100, 100);

    return {
      totalSize,
      totalExams: downloadedIds.length,
      estimatedStorageUsage: formatStorageSize(totalSize),
      storagePercentage,
    };
  } catch (error) {
    console.error('Failed to get download stats:', error);
    return {
      totalSize: 0,
      totalExams: 0,
      estimatedStorageUsage: '0 B',
      storagePercentage: 0,
    };
  }
}

/**
 * Get storage available (estimate)
 */
export async function getAvailableStorage(): Promise<{
  available: number;
  estimatedString: string;
}> {
  try {
    const stats = await getDownloadStats();
    const storageQuota = 50 * 1024 * 1024; // 50MB
    const available = Math.max(0, storageQuota - stats.totalSize);

    return {
      available,
      estimatedString: formatStorageSize(available),
    };
  } catch (error) {
    console.error('Failed to get available storage:', error);
    return {
      available: 0,
      estimatedString: '0 B',
    };
  }
}

/**
 * Check if storage quota exceeded
 */
export async function isStorageQuotaExceeded(): Promise<boolean> {
  try {
    const stats = await getDownloadStats();
    return stats.storagePercentage >= 95; // 95% threshold
  } catch (error) {
    console.error('Error checking storage quota:', error);
    return false;
  }
}

/**
 * Batch download multiple exams
 */
export async function batchDownloadExams(
  exams: Array<{
    exam: Exam;
    questions: Question[];
    practiceConfig?: PracticeExamConfig | null;
  }>,
  onProgress?: (examIndex: number, total: number, progress: DownloadProgress) => void
): Promise<void> {
  for (let i = 0; i < exams.length; i++) {
    const { exam, questions, practiceConfig } = exams[i];
    
    try {
      await downloadExamWithData(
        exam,
        questions,
        practiceConfig,
        (progress) => {
          onProgress?.(i + 1, exams.length, progress);
        }
      );
    } catch (error) {
      console.error(`Failed to download exam ${i + 1}/${exams.length}:`, error);
      // Continue with next exam instead of throwing
    }
  }
}

/**
 * Update downloaded exam (if questions changed)
 */
export async function updateDownloadedExam(
  exam: Exam,
  questions: Question[],
  practiceConfig?: PracticeExamConfig | null
): Promise<void> {
  try {
    // Delete old version
    await deleteOfflineExam(exam.examId);
    
    // Download new version
    await downloadExamWithData(exam, questions, practiceConfig);
    
    console.log(`✓ Exam updated: ${exam.title}`);
  } catch (error) {
    console.error('Failed to update exam:', error);
    throw error;
  }
}

/**
 * Validate downloaded exam integrity
 */
export async function validateDownloadedExam(examId: string): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    const exam = await getOfflineExam(examId);
    if (!exam) {
      issues.push('Exam metadata not found');
      return { isValid: false, issues };
    }

    const questions = await getOfflineQuestions(examId);
    if (questions.length === 0) {
      issues.push('No questions found');
    } else if (questions.length !== exam.questionCount) {
      issues.push(`Expected ${exam.questionCount} questions, found ${questions.length}`);
    }

    // Check if practice config exists for practice exams
    if (exam.examType === 'practice') {
      const config = await getPracticeConfig(examId);
      if (!config) {
        issues.push('Practice config missing');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  } catch (error) {
    issues.push(`Error validating exam: ${error instanceof Error ? error.message : 'Unknown'}`);
    return { isValid: false, issues };
  }
}

/**
 * Get all downloaded exams with their status
 */
export async function getAllDownloadedExams(): Promise<Array<{
  exam: Exam;
  status: 'valid' | 'invalid';
  issues: string[];
  estimatedSize: string;
}>> {
  try {
    const downloadedIds = getDownloadedExamIds();
    const results = [];

    for (const examId of downloadedIds) {
      try {
        const exam = await getOfflineExam(examId);
        if (exam) {
          const validation = await validateDownloadedExam(examId);
          const estimatedSize = formatStorageSize(estimateExamSize(exam, exam.questionCount));

          results.push({
            exam,
            status: validation.isValid ? 'valid' : 'invalid',
            issues: validation.issues,
            estimatedSize,
          });
        }
      } catch (error) {
        console.warn(`Error loading downloaded exam ${examId}:`, error);
      }
    }

    return results;
  } catch (error) {
    console.error('Failed to get downloaded exams:', error);
    return [];
  }
}

/**
 * Clear all downloads
 */
export async function clearAllDownloads(): Promise<void> {
  try {
    const downloadedIds = getDownloadedExamIds();
    
    for (const examId of downloadedIds) {
      try {
        await deleteOfflineExam(examId);
        untrackDownloadedExam(examId);
      } catch (error) {
        console.warn(`Error deleting exam ${examId}:`, error);
      }
    }

    downloadProgress.clear();
    console.log('✓ All downloads cleared');
  } catch (error) {
    console.error('Failed to clear all downloads:', error);
    throw error;
  }
}
