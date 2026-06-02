/**
 * useExamLoader Hook
 * React hook for loading exam data (offline-first)
 */

import { useEffect, useState } from 'react';
import { Exam, Question, PracticeExamConfig } from '@/integrations/firebase/types';
import { 
  loadExamData, 
  loadExamMetadata, 
  loadExamQuestions, 
  loadPracticeConfig,
  canLoadExam,
  getExamLoadStatus,
  LoadedExamData 
} from '@/lib/exam-loader';

export interface UseExamLoaderOptions {
  examId: string;
  autoLoad?: boolean;
  forceOnline?: boolean;
}

export interface UseExamLoaderResult {
  data: LoadedExamData | null;
  exam: Exam | null;
  questions: Question[];
  practiceConfig: PracticeExamConfig | null;
  loading: boolean;
  error: Error | null;
  source: 'offline' | 'firebase' | null;
  isOfflineMode: boolean;
  canLoad: boolean;
  loadStatus: {
    canLoadOffline: boolean;
    canLoadOnline: boolean;
    isDownloaded: boolean;
    isPracticeExam: boolean;
  } | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to load exam data (automatically uses offline storage if available)
 */
export function useExamLoader(options: UseExamLoaderOptions): UseExamLoaderResult {
  const { examId, autoLoad = true, forceOnline = false } = options;

  const [data, setData] = useState<LoadedExamData | null>(null);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<Error | null>(null);
  const [canLoad, setCanLoad] = useState(false);
  const [loadStatus, setLoadStatus] = useState(null);

  const loadData = async () => {
    if (!examId) return;

    try {
      setLoading(true);
      setError(null);

      // Check if exam can be loaded
      const canLoadExamData = await canLoadExam(examId, false);
      setCanLoad(canLoadExamData);

      if (!canLoadExamData) {
        throw new Error('Exam not available offline or online');
      }

      // Get load status
      const status = await getExamLoadStatus(examId);
      setLoadStatus(status);

      // Load exam data
      const loadedData = await loadExamData(examId, forceOnline);
      setData(loadedData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load exam');
      setError(error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) {
      loadData();
    }
  }, [examId, autoLoad, forceOnline]);

  return {
    data,
    exam: data?.exam || null,
    questions: data?.questions || [],
    practiceConfig: data?.practiceConfig || null,
    loading,
    error,
    source: data?.source || null,
    isOfflineMode: data?.isOfflineMode || false,
    canLoad,
    loadStatus,
    refetch: loadData,
  };
}

/**
 * Hook to load only exam metadata (fast)
 */
export function useExamMetadata(examId: string, enabled = true) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !examId) return;

    const load = async () => {
      try {
        setLoading(true);
        const data = await loadExamMetadata(examId);
        setExam(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load exam'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [examId, enabled]);

  return { exam, loading, error };
}

/**
 * Hook to load only exam questions
 */
export function useExamQuestions(examId: string, enabled = true) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !examId) return;

    const load = async () => {
      try {
        setLoading(true);
        const data = await loadExamQuestions(examId);
        setQuestions(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load questions'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [examId, enabled]);

  return { questions, loading, error };
}

/**
 * Hook to load practice configuration
 */
export function usePracticeConfig(examId: string, enabled = true) {
  const [config, setConfig] = useState<PracticeExamConfig | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !examId) return;

    const load = async () => {
      try {
        setLoading(true);
        const data = await loadPracticeConfig(examId);
        setConfig(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load config'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [examId, enabled]);

  return { config, loading, error };
}
