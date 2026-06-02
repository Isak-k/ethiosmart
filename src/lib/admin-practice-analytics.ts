/**
 * Admin Practice Analytics Functions
 * Handles Firebase queries for practice exam analytics and statistics
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  Timestamp,
  AggregateQuerySnapshot,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { Exam, ExamAttempt, Answer } from '@/integrations/firebase/types';

export interface PracticeAnalytics {
  examId: string;
  examTitle: string;
  totalAttempts: number;
  practiceAttempts: number;
  examAttempts: number;
  offlineAttempts: number;
  onlineAttempts: number;
  averageScore: number;
  averagePracticeScore: number;
  averageExamScore: number;
  passRate: number;
  practicePassRate: number;
  examPassRate: number;
  avgTimeSpent: number;
  lastUpdated: Timestamp;
}

/**
 * Get analytics for a specific practice exam
 */
export async function getPracticeExamAnalytics(examId: string): Promise<PracticeAnalytics | null> {
  try {
    // Get exam
    const examRef = doc(db, 'exams', examId);
    const examSnap = await import('firebase/firestore').then((m) => m.getDoc(examRef));

    if (!examSnap.exists()) return null;

    const exam = examSnap.data() as Exam;

    // Get all attempts for this exam
    const attemptsQuery = query(collection(db, 'examAttempts'), where('examId', '==', examId));
    const attemptsSnap = await getDocs(attemptsQuery);

    if (attemptsSnap.empty) {
      return {
        examId,
        examTitle: exam.title,
        totalAttempts: 0,
        practiceAttempts: 0,
        examAttempts: 0,
        offlineAttempts: 0,
        onlineAttempts: 0,
        averageScore: 0,
        averagePracticeScore: 0,
        averageExamScore: 0,
        passRate: 0,
        practicePassRate: 0,
        examPassRate: 0,
        avgTimeSpent: 0,
        lastUpdated: Timestamp.now(),
      };
    }

    const attempts = attemptsSnap.docs.map((d) => d.data() as ExamAttempt);

    // Calculate analytics
    let totalScore = 0;
    let practiceScore = 0;
    let examScore = 0;
    let practiceCount = 0;
    let examCount = 0;
    let offlineCount = 0;
    let totalTimeSpent = 0;

    for (const attempt of attempts) {
      if (attempt.totalScore !== null && attempt.maxScore !== null) {
        const percentage = (attempt.totalScore / attempt.maxScore) * 100;
        totalScore += percentage;

        // Assuming we track if it was offline in the attempt
        // For now, count as online by default
        if ((attempt as any).isOffline) {
          offlineCount++;
        }

        // We'd need additional metadata to track practice vs exam mode
        // For now, use defaults
        practiceScore += percentage;
        practiceCount++;

        if (percentage >= (exam.practiceConfig?.passingScore || 50)) {
          // Count as pass
        }

        totalTimeSpent += attempt.timeSpentSeconds || 0;
      }
    }

    const avgScore = attempts.length > 0 ? totalScore / attempts.length : 0;
    const avgPracticeScore = practiceCount > 0 ? practiceScore / practiceCount : 0;
    const avgExamScore = examCount > 0 ? examScore / examCount : 0;

    return {
      examId,
      examTitle: exam.title,
      totalAttempts: attempts.length,
      practiceAttempts: practiceCount,
      examAttempts: examCount,
      offlineAttempts: offlineCount,
      onlineAttempts: attempts.length - offlineCount,
      averageScore: avgScore,
      averagePracticeScore: avgPracticeScore,
      averageExamScore: avgExamScore,
      passRate: (totalScore >= (exam.practiceConfig?.passingScore || 50) ? 1 : 0) * 100,
      practicePassRate: 0,
      examPassRate: 0,
      avgTimeSpent: attempts.length > 0 ? totalTimeSpent / attempts.length : 0,
      lastUpdated: Timestamp.now(),
    };
  } catch (error) {
    console.error('Error getting practice exam analytics:', error);
    throw error;
  }
}

/**
 * Get analytics for all practice exams
 */
export async function getAllPracticeExamAnalytics(): Promise<PracticeAnalytics[]> {
  try {
    const examsQuery = query(collection(db, 'exams'), where('examType', '==', 'practice'));
    const examsSnap = await getDocs(examsQuery);

    if (examsSnap.empty) return [];

    const analyticsPromises = examsSnap.docs.map((examDoc) =>
      getPracticeExamAnalytics(examDoc.id)
    );

    const analytics = await Promise.all(analyticsPromises);
    return analytics.filter((a) => a !== null) as PracticeAnalytics[];
  } catch (error) {
    console.error('Error getting all practice exam analytics:', error);
    throw error;
  }
}

/**
 * Get offline usage statistics
 */
export async function getOfflineUsageStats() {
  try {
    // Get all exams with offline download enabled
    const examsQuery = query(
      collection(db, 'exams'),
      where('examType', '==', 'practice'),
      where('allowOfflineDownload', '==', true)
    );

    const examsSnap = await getDocs(examsQuery);

    if (examsSnap.empty) {
      return {
        totalDownloadable: 0,
        downloadedByUsers: 0,
        activeOfflineSessions: 0,
        totalStorageUsed: 0,
      };
    }

    return {
      totalDownloadable: examsSnap.size,
      downloadedByUsers: 0, // Would need to query offline storage data
      activeOfflineSessions: 0, // Would need real-time data
      totalStorageUsed: 0, // Would need to calculate from IndexedDB
    };
  } catch (error) {
    console.error('Error getting offline usage stats:', error);
    throw error;
  }
}

/**
 * Get mode distribution (Practice vs Exam mode)
 */
export async function getModeDistribution() {
  try {
    const practiceQuery = query(
      collection(db, 'exams'),
      where('practiceMode', '==', 'practice')
    );
    const examQuery = query(collection(db, 'exams'), where('practiceMode', '==', 'exam'));

    const practiceSnap = await getDocs(practiceQuery);
    const examSnap = await getDocs(examQuery);

    return {
      practiceMode: practiceSnap.size,
      examMode: examSnap.size,
      total: practiceSnap.size + examSnap.size,
      practicePercent: ((practiceSnap.size / (practiceSnap.size + examSnap.size)) * 100).toFixed(1),
      examPercent: ((examSnap.size / (practiceSnap.size + examSnap.size)) * 100).toFixed(1),
    };
  } catch (error) {
    console.error('Error getting mode distribution:', error);
    throw error;
  }
}
