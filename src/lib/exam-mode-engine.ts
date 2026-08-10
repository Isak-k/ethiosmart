/**
 * Exam Mode Engine
 * Handles timed exams with NO instant feedback
 * Shows only Correct/Wrong/Skipped summary after submission
 * Supports all question types: MCQ, True/False, Short Answer, Essay
 */

import { Question } from '@/integrations/firebase/types';
import { evaluateQuestion, calculateExamScore } from './question-evaluation';

// ExamQuestion is just Question - no extension needed
export type ExamQuestion = Question;

export interface ExamAnswer {
  questionId: string;
  answer: string | number | boolean | null; // Unified answer field
  isCorrect: boolean | null;
  marks: number;
}

export interface ExamModeSummary {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  pendingCount: number; // Essays and manual grading
  skippedCount: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passStatus: 'pass' | 'fail';
  timeSpentSeconds: number;
}

export interface ExamModeResult {
  attemptId: string;
  summary: ExamModeSummary;
  answers: ExamAnswer[];
  completedAt: number;
}

/**
 * Calculate exam mode summary (only counts, no details)
 * Works with all question types
 */
export function calculateExamModeSummary(
  questions: ExamQuestion[],
  answers: Map<string, string | number | boolean | null>,
  timeSpentSeconds: number,
  passingPercentage: number = 50
): ExamModeSummary {
  let correctCount = 0;
  let incorrectCount = 0;
  let pendingCount = 0;
  let skippedCount = 0;
  let totalScore = 0;

  questions.forEach((question) => {
    const answer = answers.get(question.questionId) ?? null;
    const evaluation = evaluateQuestion(question, answer);

    totalScore += evaluation.earnedMarks;

    if (evaluation.feedback?.includes('skipped')) {
      skippedCount++;
    } else if (evaluation.feedback?.includes('pending')) {
      pendingCount++;
    } else if (evaluation.isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  const maxScore = questions.reduce((sum, q) => sum + q.marks, 0);
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const passStatus = percentage >= passingPercentage ? 'pass' : 'fail';

  return {
    totalQuestions: questions.length,
    correctCount,
    incorrectCount,
    pendingCount,
    skippedCount,
    totalScore,
    maxScore,
    percentage: Math.round(percentage),
    passStatus,
    timeSpentSeconds,
  };
}

/**
 * Calculate exam mode result
 * Works with all question types
 */
export function calculateExamModeResult(
  attemptId: string,
  questions: ExamQuestion[],
  answers: Map<string, string | number | boolean | null>,
  timeSpentSeconds: number,
  passingPercentage: number = 50
): ExamModeResult {
  const answersArray: ExamAnswer[] = [];

  questions.forEach((question) => {
    const answer = answers.get(question.questionId) ?? null;
    const evaluation = evaluateQuestion(question, answer);

    answersArray.push({
      questionId: question.questionId,
      answer,
      isCorrect: null, // Don't reveal correctness in exam mode
      marks: evaluation.earnedMarks,
    });
  });

  const summary = calculateExamModeSummary(
    questions,
    answers,
    timeSpentSeconds,
    passingPercentage
  );

  return {
    attemptId,
    summary,
    answers: answersArray,
    completedAt: Date.now(),
  };
}

/**
 * Format summary for display
 */
export function formatExamModeSummary(summary: ExamModeSummary): string {
  return `Correct: ${summary.correctCount}\nWrong: ${summary.incorrectCount}\nSkipped: ${summary.skippedCount}`;
}

/**
 * Check if user passed
 */
export function checkExamModePass(
  summary: ExamModeSummary,
  passingPercentage: number = 50
): boolean {
  return summary.percentage >= passingPercentage;
}

/**
 * Get result status emoji/color
 */
export function getExamModeResultStatus(summary: ExamModeSummary): {
  status: 'pass' | 'fail';
  emoji: string;
  color: string;
  message: string;
} {
  const passed = summary.passStatus === 'pass';

  return {
    status: summary.passStatus,
    emoji: passed ? '✓' : '✗',
    color: passed ? 'green' : 'red',
    message: passed ? 'You Passed!' : 'You Failed',
  };
}

/**
 * Convert to exam format (no conversion needed - Question type is already compatible)
 */
export function convertToExamQuestions(questions: Question[]): ExamQuestion[] {
  return questions as ExamQuestion[];
}

/**
 * Build summary display
 */
export interface SummaryDisplay {
  title: string;
  summary: ExamModeSummary;
  displayText: string;
  passed: boolean;
  emoji: string;
  color: string;
  scoreDisplay: string;
  statusMessage: string;
}

export function buildExamModeSummaryDisplay(
  summary: ExamModeSummary
): SummaryDisplay {
  const statusInfo = getExamModeResultStatus(summary);

  return {
    title: 'Exam Completed',
    summary,
    displayText: formatExamModeSummary(summary),
    passed: statusInfo.status === 'pass',
    emoji: statusInfo.emoji,
    color: statusInfo.color,
    scoreDisplay: `${summary.totalScore}/${summary.maxScore}`,
    statusMessage: statusInfo.message,
  };
}
