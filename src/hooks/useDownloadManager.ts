/**
 * useDownloadManager Hook
 * React hook for managing exam downloads
 */

import { useEffect, useState } from 'react';
import { Exam, Question, PracticeExamConfig } from '@/integrations/firebase/types';
import {
  downloadExamWithData,
  deleteDownloadedExam,
  isExamDownloadedAndValid,
  getDownloadProgress,
  getDownloadStats,
  getAvailableStorage,
  isStorageQuotaExceeded,
  DownloadProgress,
  DownloadStats,
} from '@/lib/offline-download-manager-v2';
import { useToast } from '@/components/ui/use-toast';

export interface UseDownloadManagerResult {
  isDownloaded: boolean;
  isDownloading: boolean;
  progress: number;
  error: string | null;
  stats: DownloadStats | null;
  availableStorage: {
    available: number;
    estimatedString: string;
  } | null;
  quotaExceeded: boolean;
  
  downloadExam: (
    exam: Exam,
    questions: Question[],
    practiceConfig?: PracticeExamConfig | null
  ) => Promise<void>;
  deleteExam: (examId: string) => Promise<void>;
  cancelDownload: () => void;
  refreshStats: () => Promise<void>;
}

/**
 * Hook for managing exam downloads
 */
export function useDownloadManager(examId?: string): UseDownloadManagerResult {
  const { toast } = useToast();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DownloadStats | null>(null);
  const [availableStorage, setAvailableStorage] = useState<{
    available: number;
    estimatedString: string;
  } | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Check download status
  const checkDownloadStatus = async () => {
    if (!examId) return;

    try {
      const downloaded = await isExamDownloadedAndValid(examId);
      setIsDownloaded(downloaded);
    } catch (err) {
      console.error('Error checking download status:', err);
    }
  };

  // Refresh stats
  const refreshStats = async () => {
    try {
      const [downloadStats, available, quotaExceeded] = await Promise.all([
        getDownloadStats(),
        getAvailableStorage(),
        isStorageQuotaExceeded(),
      ]);

      setStats(downloadStats);
      setAvailableStorage(available);
      setQuotaExceeded(quotaExceeded);
    } catch (err) {
      console.error('Error refreshing stats:', err);
    }
  };

  // Download exam
  const downloadExam = async (
    exam: Exam,
    questions: Question[],
    practiceConfig?: PracticeExamConfig | null
  ) => {
    try {
      setIsDownloading(true);
      setError(null);
      setProgress(0);

      // Create abort controller for cancellation
      const controller = new AbortController();
      setAbortController(controller);

      // Track progress
      const handleProgress = (progressData: DownloadProgress) => {
        if (controller.signal.aborted) return;
        setProgress(progressData.progress);
      };

      // Download
      await downloadExamWithData(exam, questions, practiceConfig, handleProgress);

      setIsDownloaded(true);
      setProgress(100);

      toast({
        title: 'Download Complete',
        description: `${exam.title} is now available offline`,
      });

      // Refresh stats
      await refreshStats();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Download failed';
      setError(errorMsg);

      toast({
        title: 'Download Failed',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
      setAbortController(null);
    }
  };

  // Delete exam
  const deleteExam = async (id: string) => {
    try {
      await deleteDownloadedExam(id);
      if (id === examId) {
        setIsDownloaded(false);
      }

      toast({
        title: 'Exam Deleted',
        description: 'Exam removed from offline storage',
      });

      // Refresh stats
      await refreshStats();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Delete failed';
      toast({
        title: 'Delete Failed',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  // Cancel download
  const cancelDownload = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsDownloading(false);
      setError('Download cancelled');
    }
  };

  // Initialize
  useEffect(() => {
    checkDownloadStatus();
    refreshStats();

    const interval = setInterval(() => {
      refreshStats();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [examId]);

  return {
    isDownloaded,
    isDownloading,
    progress,
    error,
    stats,
    availableStorage,
    quotaExceeded,
    downloadExam,
    deleteExam,
    cancelDownload,
    refreshStats,
  };
}

/**
 * Hook for downloading multiple exams
 */
export function useBatchDownload() {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const downloadBatch = async (
    exams: Array<{
      exam: Exam;
      questions: Question[];
      practiceConfig?: PracticeExamConfig | null;
    }>
  ) => {
    try {
      setIsDownloading(true);
      setError(null);
      setProgress(0);

      for (let i = 0; i < exams.length; i++) {
        const { exam, questions, practiceConfig } = exams[i];

        try {
          await downloadExamWithData(exam, questions, practiceConfig, () => {
            setProgress(Math.round(((i + 1) / exams.length) * 100));
          });
        } catch (err) {
          console.error(`Failed to download ${exam.title}:`, err);
          // Continue with next
        }
      }

      toast({
        title: 'Batch Download Complete',
        description: `Downloaded ${exams.length} exam${exams.length !== 1 ? 's' : ''}`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Batch download failed';
      setError(errorMsg);

      toast({
        title: 'Batch Download Failed',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return { isDownloading, progress, error, downloadBatch };
}
