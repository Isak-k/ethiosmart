/**
 * Practice Exam Results Firebase Queries
 * Handles fetching, filtering, and exporting practice exam results
 */

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  limit,
  startAfter,
  QueryConstraint,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { ExamAttempt, Answer } from '@/integrations/firebase/types';

export interface PracticeExamResult {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  examId: string;
  examTitle: string;
  mode: 'practice' | 'exam';
  score: number;
  maxScore: number;
  scorePercentage: number;
  timeSpentSeconds: number;
  isOffline: boolean;
  submittedAt: string;
  correctAnswers: number;
  wrongAnswers: number;
  skippedAnswers: number;
  passed: boolean;
}

export interface ResultFilters {
  examId?: string;
  studentId?: string;
  studentEmail?: string;
  mode?: 'practice' | 'exam';
  startDate?: Date;
  endDate?: Date;
  isOffline?: boolean;
  pageSize?: number;
  pageNumber?: number;
}

/**
 * Get all practice exam results with optional filtering
 */
export async function getPracticeResults(
  filters?: ResultFilters
): Promise<PracticeExamResult[]> {
  try {
    const constraints: QueryConstraint[] = [
      where('isSubmitted', '==', true),
      orderBy('submittedAt', 'desc'),
    ];

    // Add date range filter if provided
    if (filters?.startDate) {
      constraints.push(where('submittedAt', '>=', Timestamp.fromDate(filters.startDate)));
    }
    if (filters?.endDate) {
      constraints.push(where('submittedAt', '<=', Timestamp.fromDate(filters.endDate)));
    }

    // Add pagination
    const pageSize = filters?.pageSize || 50;
    if (pageSize) {
      constraints.push(limit(pageSize));
    }

    const q = query(collection(db, 'examAttempts'), ...constraints);
    const attemptSnap = await getDocs(q);

    if (attemptSnap.empty) return [];

    const results: PracticeExamResult[] = [];

    for (const attemptDoc of attemptSnap.docs) {
      const attempt = attemptDoc.data() as ExamAttempt;

      // Filter by exam if specified
      if (filters?.examId && attempt.examId !== filters.examId) continue;

      // Filter by student if specified
      if (filters?.studentId && attempt.studentId !== filters.studentId) continue;
      if (filters?.studentEmail && attempt.studentEmail !== filters.studentEmail) continue;

      // Get exam to check practice mode
      const examDoc = await getDoc(doc(db, 'exams', attempt.examId));
      const exam = examDoc.data();

      if (!exam || exam.examType !== 'practice') continue;

      const mode: 'practice' | 'exam' = exam.practiceMode || 'practice';

      // Filter by mode if specified
      if (filters?.mode && mode !== filters.mode) continue;

      // Get answers to calculate correct/wrong/skipped
      const answersQuery = query(
        collection(db, 'answers'),
        where('attemptId', '==', attempt.attemptId)
      );
      const answersSnap = await getDocs(answersQuery);
      const answers = answersSnap.docs.map((d) => d.data() as Answer);

      let correctCount = 0;
      let wrongCount = 0;
      let skippedCount = 0;

      for (const answer of answers) {
        if (answer.selectedOptionIndex === null) {
          skippedCount++;
        } else if (answer.isCorrect) {
          correctCount++;
        } else {
          wrongCount++;
        }
      }

      const scorePercentage =
        attempt.maxScore && attempt.totalScore !== null
          ? (attempt.totalScore / attempt.maxScore) * 100
          : 0;

      const passed = scorePercentage >= (exam.practiceConfig?.passingScore || 50);

      results.push({
        id: attemptDoc.id,
        studentId: attempt.studentId,
        studentName: attempt.studentName,
        studentEmail: attempt.studentEmail,
        examId: attempt.examId,
        examTitle: attempt.examTitle,
        mode,
        score: attempt.totalScore || 0,
        maxScore: attempt.maxScore || 0,
        scorePercentage,
        timeSpentSeconds: attempt.timeSpentSeconds || 0,
        isOffline: (attempt as any).isOffline || false,
        submittedAt: attempt.submittedAt?.toDate().toISOString() || new Date().toISOString(),
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        skippedAnswers: skippedCount,
        passed,
      });
    }

    return results;
  } catch (error) {
    console.error('Error getting practice results:', error);
    throw error;
  }
}

/**
 * Get results for a specific exam
 */
export async function getPracticeResultsByExam(
  examId: string
): Promise<PracticeExamResult[]> {
  return getPracticeResults({ examId });
}

/**
 * Get results for a specific student
 */
export async function getPracticeResultsByStudent(
  studentId: string
): Promise<PracticeExamResult[]> {
  return getPracticeResults({ studentId });
}

/**
 * Get results by practice mode
 */
export async function getPracticeResultsByMode(
  mode: 'practice' | 'exam'
): Promise<PracticeExamResult[]> {
  return getPracticeResults({ mode });
}

/**
 * Get results within a date range
 */
export async function getPracticeResultsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<PracticeExamResult[]> {
  return getPracticeResults({ startDate, endDate });
}

/**
 * Calculate statistics from results
 */
export function calculateResultStats(results: PracticeExamResult[]) {
  if (results.length === 0) {
    return {
      total: 0,
      practice: 0,
      exam: 0,
      avgScore: 0,
      avgTime: 0,
      passRate: 0,
      practicePassRate: 0,
      examPassRate: 0,
      offlineCount: 0,
      onlineCount: 0,
    };
  }

  const practiceResults = results.filter((r) => r.mode === 'practice');
  const examResults = results.filter((r) => r.mode === 'exam');

  const avgScore = results.reduce((sum, r) => sum + r.scorePercentage, 0) / results.length;
  const avgTime = results.reduce((sum, r) => sum + r.timeSpentSeconds, 0) / results.length;
  const passCount = results.filter((r) => r.passed).length;
  const passRate = (passCount / results.length) * 100;

  const practicePassCount = practiceResults.filter((r) => r.passed).length;
  const practicePassRate =
    practiceResults.length > 0 ? (practicePassCount / practiceResults.length) * 100 : 0;

  const examPassCount = examResults.filter((r) => r.passed).length;
  const examPassRate = examResults.length > 0 ? (examPassCount / examResults.length) * 100 : 0;

  const offlineCount = results.filter((r) => r.isOffline).length;
  const onlineCount = results.length - offlineCount;

  return {
    total: results.length,
    practice: practiceResults.length,
    exam: examResults.length,
    avgScore: avgScore.toFixed(1),
    avgTime: (avgTime / 60).toFixed(1), // Convert to minutes
    passRate: passRate.toFixed(1),
    practicePassRate: practicePassRate.toFixed(1),
    examPassRate: examPassRate.toFixed(1),
    offlineCount,
    onlineCount,
  };
}

/**
 * Export results as CSV
 */
export function exportPracticeResultsCSV(results: PracticeExamResult[]): string {
  const headers = [
    'Student Name',
    'Student Email',
    'Exam',
    'Mode',
    'Score',
    'Percentage',
    'Correct',
    'Wrong',
    'Skipped',
    'Time (min)',
    'Status',
    'Online/Offline',
    'Date',
  ];

  const rows = results.map((r) => [
    r.studentName,
    r.studentEmail,
    r.examTitle,
    r.mode === 'practice' ? 'Learning' : 'Assessment',
    `${r.score}/${r.maxScore}`,
    `${r.scorePercentage.toFixed(1)}%`,
    r.correctAnswers,
    r.wrongAnswers,
    r.skippedAnswers,
    (r.timeSpentSeconds / 60).toFixed(1),
    r.passed ? 'Passed' : 'Failed',
    r.isOffline ? 'Offline' : 'Online',
    new Date(r.submittedAt).toLocaleString(),
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadResultsCSV(
  results: PracticeExamResult[],
  filename: string = 'practice-results.csv'
): void {
  try {
    const csv = exportPracticeResultsCSV(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading results:', error);
    throw error;
  }
}

/**
 * Export results as JSON
 */
export function exportPracticeResultsJSON(results: PracticeExamResult[]): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Download JSON file
 */
export function downloadResultsJSON(
  results: PracticeExamResult[],
  filename: string = 'practice-results.json'
): void {
  try {
    const json = exportPracticeResultsJSON(results);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading results:', error);
    throw error;
  }
}

/**
 * Group results by exam
 */
export function groupResultsByExam(results: PracticeExamResult[]) {
  const grouped: { [examId: string]: PracticeExamResult[] } = {};

  for (const result of results) {
    if (!grouped[result.examId]) {
      grouped[result.examId] = [];
    }
    grouped[result.examId].push(result);
  }

  return grouped;
}

/**
 * Group results by student
 */
export function groupResultsByStudent(results: PracticeExamResult[]) {
  const grouped: { [studentId: string]: PracticeExamResult[] } = {};

  for (const result of results) {
    if (!grouped[result.studentId]) {
      grouped[result.studentId] = [];
    }
    grouped[result.studentId].push(result);
  }

  return grouped;
}

/**
 * Sort results by property
 */
export function sortResults(
  results: PracticeExamResult[],
  sortBy: keyof PracticeExamResult,
  ascending = false
): PracticeExamResult[] {
  const sorted = [...results];
  sorted.sort((a, b) => {
    const valA = a[sortBy];
    const valB = b[sortBy];

    if (typeof valA === 'string') {
      return ascending ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
    }

    if (typeof valA === 'number') {
      return ascending ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    }

    return 0;
  });

  return sorted;
}
