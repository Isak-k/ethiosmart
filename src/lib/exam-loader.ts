/**
 * Exam Loader Service
 * Intelligently loads exams from offline storage or Firebase
 * Always prefers offline storage for practice exams
 */

import { Exam, Question, PracticeExamConfig } from '@/integrations/firebase/types';
import { getOfflineExam, getOfflineQuestions, getPracticeConfig, initOfflineDB } from './offline-storage';
import { getExam, getQuestions } from '@/lib/firebase-exams';
import { isExamDownloaded } from './offline-state';

export interface LoadedExamData {
  exam: Exam;
  questions: Question[];
  practiceConfig: PracticeExamConfig | null;
  source: 'offline' | 'firebase';
  isOfflineMode: boolean;
}

/**
 * Load exam with all data (prefers offline, falls back to Firebase)
 */
export async function loadExamData(examId: string, forceOnline = false): Promise<LoadedExamData> {
  // If exam is practice type and downloaded, ALWAYS use offline
  if (!forceOnline && isExamDownloaded(examId)) {
    try {
      const offlineExam = await getOfflineExam(examId);
      if (offlineExam && offlineExam.examType === 'practice') {
        console.log('✓ Loading practice exam from offline storage');
        const questions = await getOfflineQuestions(examId);
        const config = await getPracticeConfig(examId);
        
        return {
          exam: offlineExam,
          questions,
          practiceConfig: config,
          source: 'offline',
          isOfflineMode: true,
        };
      }
    } catch (error) {
      console.warn('Failed to load practice exam from offline:', error);
    }
  }

  // Try Firebase first (for normal exams or when online)
  try {
    const exam = await getExam(examId);
    const questions = await getQuestions(examId);
    
    // Check if this is a practice exam
    if (exam.examType === 'practice') {
      // Try to get practice config from offline if downloaded
      let config = null;
      if (isExamDownloaded(examId)) {
        try {
          config = await getPracticeConfig(examId);
        } catch (error) {
          console.warn('Could not get practice config from offline:', error);
        }
      }

      return {
        exam,
        questions,
        practiceConfig: config,
        source: 'firebase',
        isOfflineMode: false,
      };
    }

    return {
      exam,
      questions,
      practiceConfig: null,
      source: 'firebase',
      isOfflineMode: false,
    };
  } catch (firebaseError) {
    console.warn('Firebase load failed, trying offline:', firebaseError);
    
    // Fall back to offline if Firebase fails
    if (isExamDownloaded(examId)) {
      try {
        const offlineExam = await getOfflineExam(examId);
        if (offlineExam) {
          const questions = await getOfflineQuestions(examId);
          const config = await getPracticeConfig(examId);

          console.log('✓ Loaded exam from offline storage (Firebase failed)');
          return {
            exam: offlineExam,
            questions,
            practiceConfig: config,
            source: 'offline',
            isOfflineMode: true,
          };
        }
      } catch (offlineError) {
        console.error('Both Firebase and offline failed:', offlineError);
        throw new Error('Could not load exam from any source');
      }
    }

    throw firebaseError;
  }
}

/**
 * Load only exam metadata (fast)
 */
export async function loadExamMetadata(examId: string, forceOnline = false): Promise<Exam> {
  if (!forceOnline && isExamDownloaded(examId)) {
    try {
      const exam = await getOfflineExam(examId);
      if (exam) {
        return exam;
      }
    } catch (error) {
      console.warn('Failed to load exam metadata from offline:', error);
    }
  }

  try {
    return await getExam(examId);
  } catch (firebaseError) {
    if (isExamDownloaded(examId)) {
      try {
        const exam = await getOfflineExam(examId);
        if (exam) {
          return exam;
        }
      } catch (offlineError) {
        throw new Error('Could not load exam metadata');
      }
    }
    throw firebaseError;
  }
}

/**
 * Load only questions (can be large)
 */
export async function loadExamQuestions(examId: string, forceOnline = false): Promise<Question[]> {
  if (!forceOnline && isExamDownloaded(examId)) {
    try {
      const questions = await getOfflineQuestions(examId);
      if (questions.length > 0) {
        return questions;
      }
    } catch (error) {
      console.warn('Failed to load questions from offline:', error);
    }
  }

  try {
    return await getQuestions(examId);
  } catch (firebaseError) {
    if (isExamDownloaded(examId)) {
      try {
        const questions = await getOfflineQuestions(examId);
        if (questions.length > 0) {
          return questions;
        }
      } catch (offlineError) {
        throw new Error('Could not load questions');
      }
    }
    throw firebaseError;
  }
}

/**
 * Load practice config for an exam
 */
export async function loadPracticeConfig(examId: string): Promise<PracticeExamConfig | null> {
  try {
    // Try offline first
    const config = await getPracticeConfig(examId);
    if (config) {
      return config;
    }

    // If not offline, try to get from exam data
    const exam = await loadExamMetadata(examId);
    return exam.practiceConfig || null;
  } catch (error) {
    console.warn('Could not load practice config:', error);
    return null;
  }
}

/**
 * Check if exam can be loaded
 */
export async function canLoadExam(examId: string, requireOffline = false): Promise<boolean> {
  try {
    if (requireOffline) {
      if (!isExamDownloaded(examId)) {
        return false;
      }
      const exam = await getOfflineExam(examId);
      return exam !== null;
    }

    // Can load if either offline or Firebase available
    const isOfflineAvailable = isExamDownloaded(examId) && (await getOfflineExam(examId)) !== null;
    if (isOfflineAvailable) {
      return true;
    }

    // Try Firebase
    try {
      await getExam(examId);
      return true;
    } catch {
      return false;
    }
  } catch (error) {
    console.error('Error checking if exam can be loaded:', error);
    return false;
  }
}

/**
 * Get exam load status
 */
export async function getExamLoadStatus(examId: string): Promise<{
  canLoadOffline: boolean;
  canLoadOnline: boolean;
  isDownloaded: boolean;
  isPracticeExam: boolean;
}> {
  const isDownloaded = isExamDownloaded(examId);
  
  let canLoadOffline = false;
  let isPracticeExam = false;
  
  if (isDownloaded) {
    try {
      const exam = await getOfflineExam(examId);
      canLoadOffline = exam !== null;
      isPracticeExam = exam?.examType === 'practice';
    } catch (error) {
      console.warn('Error checking offline status:', error);
    }
  }

  let canLoadOnline = false;
  try {
    await getExam(examId);
    canLoadOnline = true;
  } catch (error) {
    canLoadOnline = false;
  }

  return {
    canLoadOffline,
    canLoadOnline,
    isDownloaded,
    isPracticeExam,
  };
}

/**
 * Pre-load exam data (for faster access)
 */
export async function preloadExamData(examId: string): Promise<LoadedExamData | null> {
  try {
    return await loadExamData(examId);
  } catch (error) {
    console.warn('Could not preload exam data:', error);
    return null;
  }
}
