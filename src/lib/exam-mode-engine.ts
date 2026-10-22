/**
 * Exam Mode Engine
 * Handles timed exams with NO instant feedback
 * Shows only Correct/Wrong/Skipped summary after submission
 */

import { Question } from '@/integrations/firebase/types';

export interface ExamQuestion {
  questionId: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  marks: number;
  orderIndex: number;
  feedbackType: 'instant' | 'hidden';
  imageUrl?: string;
}

export interface ExamAnswer {
  questionId: string;
  selectedOptionIndex: number | null;
  isCorrect: boolean | null;
  marks: number;
}

export interface ExamModeSummary {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
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
 */
export function calculateExamModeSummary(
  questions: ExamQuestion[],
  answers: Map<string, number | null>, // questionId -> selectedOptionIndex | null
  timeSpentSeconds: number,
  passingPercentage: number = 50
): ExamModeSummary {
  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;
  let totalScore = 0;

  questions.forEach((question) => {
    const selectedOptionIndex = answers.get(question.questionId);

    if (selectedOptionIndex === null || selectedOptionIndex === undefined) {
      // Skipped
      skippedCount++;
    } else if (selectedOptionIndex === question.correctOptionIndex) {
      // Correct
      correctCount++;
      totalScore += question.marks;
    } else {
      // Incorrect
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
 */
export function calculateExamModeResult(
  attemptId: string,
  questions: ExamQuestion[],
  answers: Map<string, number | null>,
  timeSpentSeconds: number,
  passingPercentage: number = 50
): ExamModeResult {
  const answersArray: ExamAnswer[] = [];

  questions.forEach((question) => {
    const selectedOptionIndex = answers.get(question.questionId);

    if (selectedOptionIndex === null || selectedOptionIndex === undefined) {
      answersArray.push({
        questionId: question.questionId,
        selectedOptionIndex: null,
        isCorrect: null, // Don't reveal correctness in exam mode
        marks: 0,
      });
    } else {
      const isCorrect = selectedOptionIndex === question.correctOptionIndex;
      const marks = isCorrect ? question.marks : 0;

      answersArray.push({
        questionId: question.questionId,
        selectedOptionIndex,
        isCorrect: null, // Don't reveal correctness in exam mode
        marks,
      });
    }
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
 * Convert to exam format
 */
export function convertToExamQuestions(questions: Question[]): ExamQuestion[] {
  return questions.map((q) => ({
    questionId: q.questionId,
    questionText: q.questionText,
    options: q.options || [],
    correctOptionIndex: q.correctOptionIndex ?? 0,
    marks: q.marks,
    orderIndex: q.orderIndex,
    feedbackType: q.feedbackType,
    imageUrl: q.imageUrl,
  }));
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
