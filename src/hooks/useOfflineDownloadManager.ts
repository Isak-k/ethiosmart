/**
 * Hook for managing offline downloads
 */

import { useState, useCallback } from 'react';
import { Exam, Question } from '@/integrations/firebase/types';
import { getQuestions } from '@/lib/firebase-exams';
import {
  saveExamOffline,
  saveQuestionsOffline,
  getOfflineExam,
  getOfflineQuestions,
} from '@/lib/offline-storage';
import {
  saveDownloadMetadata,
  getDownloadMetadata,
  getDownloadedExamsForDepartment,
  deleteDownloadedExam,
  getDownloadStorageUsage,
  clearAllDownloads,
  getDownloadStatus,
  formatStorageSize,
  estimateExamSize,
  DownloadMetadata,
  DownloadStatus,
} from '@/lib/offline-download-manager';
import { useToast } from '@/components/ui/use-toast';

interface DownloadProgress {
  examId: string;
  status: 'idle' | 'downloading' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
}

export function useOfflineDownloadManager() {
  const { toast } = useToast();
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map());
  const [storageUsage, setStorageUsage] = useState<number>(0);

  // Download an exam for offline use
  const downloadExam = useCallback(
    async (exam: Exam, departmentId: string) => {
      const examId = exam.examId;

      try {
        setDownloadProgress((prev) => {
          const newMap = new Map(prev);
          newMap.set(examId, { examId, status: 'downloading', progress: 10 });
          return newMap;
        });

        // Save exam metadata
        await saveExamOffline(exam, departmentId);
        setDownloadProgress((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(examId) || { examId, status: 'downloading', progress: 0 };
          current.progress = 30;
          newMap.set(examId, current);
          return newMap;
        });

        // Fetch and save questions
        const questions = await getQuestions(examId);
        await saveQuestionsOffline(examId, questions);

        setDownloadProgress((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(examId) || { examId, status: 'downloading', progress: 0 };
          current.progress = 70;
          newMap.set(examId, current);
          return newMap;
        });

        // Save download metadata
        const estimatedSize = estimateExamSize(exam, questions.length);
        const metadata: DownloadMetadata = {
          examId,
          departmentId,
          examTitle: exam.title,
          downloadedAt: Date.now(),
          size: estimatedSize,
          questionCount: questions.length,
          status: 'completed',
          version: 1,
        };

        await saveDownloadMetadata(metadata);

        setDownloadProgress((prev) => {
          const newMap = new Map(prev);
          newMap.set(examId, { examId, status: 'completed', progress: 100 });
          return newMap;
        });

        // Update storage usage
        const usage = await getDownloadStorageUsage();
        setStorageUsage(usage);

        toast({
          title: 'Download Complete',
          description: `${exam.title} downloaded successfully (${formatStorageSize(estimatedSize)})`,
        });

        console.log(`✓ Exam downloaded: ${exam.title}`);
      } catch (error) {
        console.error('Download error:', error);
        setDownloadProgress((prev) => {
          const newMap = new Map(prev);
          newMap.set(examId, {
            examId,
            status: 'failed',
            progress: 0,
            error: error instanceof Error ? error.message : 'Download failed',
          });
          return newMap;
        });

        toast({
          title: 'Download Failed',
          description: error instanceof Error ? error.message : 'Failed to download exam',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // Get download status for an exam
  const getStatus = useCallback(
    async (exam: Exam, remoteVersion?: number): Promise<DownloadStatus> => {
      return getDownloadStatus(exam, remoteVersion);
    },
    []
  );

  // Delete a downloaded exam
  const deleteDownload = useCallback(
    async (examId: string) => {
      try {
        await deleteDownloadedExam(examId);

        // Update storage usage
        const usage = await getDownloadStorageUsage();
        setStorageUsage(usage);

        toast({
          title: 'Download Deleted',
          description: 'Exam removed from offline storage',
        });

        console.log(`✓ Download deleted: ${examId}`);
      } catch (error) {
        console.error('Delete error:', error);
        toast({
          title: 'Delete Failed',
          description: error instanceof Error ? error.message : 'Failed to delete download',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // Get all downloaded exams for a department
  const getDownloadedExams = useCallback(
    async (departmentId: string): Promise<DownloadMetadata[]> => {
      return getDownloadedExamsForDepartment(departmentId);
    },
    []
  );

  // Clear all downloads
  const clearAllDownloadsForDepartment = useCallback(
    async () => {
      try {
        await clearAllDownloads();

        // Update storage usage
        setStorageUsage(0);

        toast({
          title: 'Cache Cleared',
          description: 'All offline downloads have been removed',
        });

        console.log('✓ All downloads cleared');
      } catch (error) {
        console.error('Clear error:', error);
        toast({
          title: 'Clear Failed',
          description: error instanceof Error ? error.message : 'Failed to clear downloads',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // Get current storage usage
  const updateStorageUsage = useCallback(async () => {
    const usage = await getDownloadStorageUsage();
    setStorageUsage(usage);
  }, []);

  return {
    downloadProgress,
    storageUsage,
    formatStorageSize,
    downloadExam,
    getStatus,
    deleteDownload,
    getDownloadedExams,
    clearAllDownloadsForDepartment,
    updateStorageUsage,
  };
}
