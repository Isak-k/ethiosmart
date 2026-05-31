import { useState, useCallback } from 'react';
import { Exam, Question } from '@/integrations/firebase/types';
import { getQuestions } from '@/lib/firebase-exams';
import {
  saveExamOffline,
  saveQuestionsOffline,
  getDownloadedExams,
  getDownloadMetadata,
  deleteOfflineExam,
  getOfflineStorageSize,
} from '@/lib/offline-storage';
import { useToast } from '@/hooks/use-toast';

interface DownloadProgress {
  examId: string;
  status: 'idle' | 'downloading' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
}

export function useOfflineDownload() {
  const { toast } = useToast();
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map());
  const [downloadedExams, setDownloadedExams] = useState<Exam[]>([]);

  const downloadExam = useCallback(
    async (exam: Exam, departmentId?: string) => {
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
          newMap.set(examId, { examId, status: 'completed', progress: 100 });
          return newMap;
        });

        toast({
          title: 'Download Complete',
          description: `"${exam.title}" has been downloaded for offline use.`,
        });

        // Refresh downloaded exams list
        const exams = await getDownloadedExams(departmentId);
        setDownloadedExams(exams);
      } catch (error: any) {
        console.error('Error downloading exam:', error);
        setDownloadProgress((prev) => {
          const newMap = new Map(prev);
          newMap.set(examId, {
            examId,
            status: 'failed',
            progress: 0,
            error: error?.message || 'Failed to download exam',
          });
          return newMap;
        });

        toast({
          title: 'Download Failed',
          description: error?.message || 'Failed to download exam. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const deleteDownloadedExam = useCallback(
    async (examId: string, departmentId?: string) => {
      try {
        await deleteOfflineExam(examId);

        toast({
          title: 'Deleted',
          description: 'Offline exam data has been removed.',
        });

        // Refresh downloaded exams list
        const exams = await getDownloadedExams(departmentId);
        setDownloadedExams(exams);
      } catch (error: any) {
        console.error('Error deleting offline exam:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete offline data.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const checkDownloadStatus = useCallback(async (examId: string): Promise<boolean> => {
    try {
      const metadata = await getDownloadMetadata(examId);
      return metadata?.status === 'completed';
    } catch (error) {
      console.error('Error checking download status:', error);
      return false;
    }
  }, []);

  const getStorageInfo = useCallback(async () => {
    try {
      const size = await getOfflineStorageSize();
      const sizeInMB = (size / (1024 * 1024)).toFixed(2);
      return {
        bytes: size,
        mb: parseFloat(sizeInMB),
        formatted: `${sizeInMB} MB`,
      };
    } catch (error) {
      console.error('Error getting storage size:', error);
      return { bytes: 0, mb: 0, formatted: '0 MB' };
    }
  }, []);

  const loadDownloadedExams = useCallback(async (departmentId?: string) => {
    try {
      const exams = await getDownloadedExams(departmentId);
      setDownloadedExams(exams);
    } catch (error) {
      console.error('Error loading downloaded exams:', error);
    }
  }, []);

  return {
    downloadExam,
    deleteDownloadedExam,
    checkDownloadStatus,
    getStorageInfo,
    loadDownloadedExams,
    downloadProgress,
    downloadedExams,
  };
}
