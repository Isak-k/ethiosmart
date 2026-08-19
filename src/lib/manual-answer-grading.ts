/**
 * Manual Answer Grading Service
 * Handles grading of short answers and essays that require manual review
 */

import { Timestamp } from 'firebase/firestore';
import { EssayQuestion, ShortAnswerQuestion, isEssayQuestion, isShortAnswerQuestion } from '@/integrations/firebase/types';

export type ManualQuestionType = EssayQuestion | ShortAnswerQuestion;

export interface ManualGradingPayload {
  score: number;
  feedback: string;
  graderId: string;
  graderName?: string;
}

/**
 * Check if a question requires manual grading
 */
export function requiresManualGrading(question: ManualQuestionType): boolean {
  if (isEssayQuestion(question)) {
    return question.requiresManualGrading !== false;
  }
  if (isShortAnswerQuestion(question)) {
    return question.requiresManualGrading === true;
  }
  return false;
}

/**
 * Get the status of an answer (pending, graded, auto-graded)
 */
export function getAnswerGradingStatus(
  question: ManualQuestionType,
  manualScore: number | undefined,
  autoScore?: number
): 'pending' | 'graded' | 'auto-graded' {
  if (manualScore !== undefined) {
    return 'graded';
  }
  if (!requiresManualGrading(question)) {
    return 'auto-graded';
  }
  return 'pending';
}

/**
 * Validate grading input
 */
export function validateGradingInput(
  score: number,
  feedback: string,
  maxScore: number
): { valid: boolean; error?: string } {
  if (score < 0 || score > maxScore) {
    return {
      valid: false,
      error: `Score must be between 0 and ${maxScore}`,
    };
  }

  if (feedback.trim().length === 0) {
    return {
      valid: false,
      error: 'Feedback is required',
    };
  }

  return { valid: true };
}

/**
 * Format grading payload for storage
 */
export function formatGradingPayload(payload: ManualGradingPayload) {
  return {
    manualScore: payload.score,
    manualFeedback: payload.feedback,
    graderUserId: payload.graderId,
    gradedAt: Timestamp.now(),
  };
}

/**
 * Get display text for question type with grading capability
 */
export function getQuestionTypeLabel(question: ManualQuestionType): string {
  if (isEssayQuestion(question)) {
    return 'Essay';
  }
  if (isShortAnswerQuestion(question)) {
    return 'Short Answer';
  }
  return 'Text Answer';
}
