/**
 * Practice Mode Engine
 * Handles practice exams with instant feedback and explanations
 * Supports all question types: MCQ, True/False, Short Answer, Essay
 * Mode: Shows feedback immediately as user answers
 */

import { Question } from '@/integrations/firebase/types';
import { evaluateQuestion, calculateExamScore } from './question-evaluation';
import { 
  savePracticeAnswer, 
  getPracticeAnswers, 
  submitPracticeExam,
  PracticeExamResult 
} from './offline-practice-exam';

// PracticeQuestion is just Question - no extension needed
export type PracticeQuestion = Question;

export interface PracticeModeAnswer {
  questionId: string;
  answer: string | number | boolean | null; // Unified answer field
  isCorrect: boolean;
  marks: number;
  feedback?: string;
  explanation?: string;
}

export interface PracticeModeFeedback {
  isCorrect: boolean;
  feedback: string;
  explanation?: string;
  earnedMarks: number;
  totalMarks: number;
}

export interface PracticeModeResult {
  attemptId: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passStatus: 'pass' | 'fail';
  correctCount: number;
  incorrectCount: number;
  pendingCount: number; // For essays awaiting manual grading
  skippedCount: number;
  answers: PracticeModeAnswer[];
  completedAt: number;
}

/**
 * Get instant feedback for an answer in practice mode
 * Works with all question types
 */
export function getPracticeModeFeedback(
  question: PracticeQuestion,
  answer: string | number | boolean | null
): PracticeModeFeedback {
  const evaluation = evaluateQuestion(question, answer);
  
  return {
    isCorrect: evaluation.isCorrect,
    feedback: evaluation.feedback || '',
    explanation: evaluation.explanation,
    earnedMarks: evaluation.earnedMarks,
    totalMarks: evaluation.totalMarks,
  };
}

/**
 * Calculate practice mode result
 * Works with all question types
 */
export function calculatePracticeModeResult(
  attemptId: string,
  questions: PracticeQuestion[],
  answers: Map<string, string | number | boolean | null>,
  passingPercentage: number = 50
): PracticeModeResult {
  let totalScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let pendingCount = 0;
  let skippedCount = 0;
  const answersArray: PracticeModeAnswer[] = [];

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

    answersArray.push({
      questionId: question.questionId,
      answer,
      isCorrect: evaluation.isCorrect,
      marks: evaluation.earnedMarks,
      feedback: evaluation.feedback,
      explanation: question.explanation,
    });
  });

  const maxScore = questions.reduce((sum, q) => sum + q.marks, 0);
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const passStatus = percentage >= passingPercentage ? 'pass' : 'fail';

  return {
    attemptId,
    totalScore,
    maxScore,
    percentage: Math.round(percentage),
    passStatus,
    correctCount,
    incorrectCount,
    pendingCount,
    skippedCount,
    answers: answersArray,
    completedAt: Date.now(),
  };
}

/**
 * Save practice mode answer with instant feedback
 * Works with all answer types (number, boolean, string)
 */
export async function savePracticeModeAnswer(
  attemptId: string,
  questionId: string,
  answer: string | number | boolean | null,
  isCorrect: boolean,
  marks: number
): Promise<void> {
  // Convert answer to storage format - delegate properly based on type
  await savePracticeAnswer(
    attemptId,
    questionId,
    answer ?? null,
    isCorrect,
    marks
  );
}

/**
 * Convert to practice format (no conversion needed - Question type is already compatible)
 */
export function convertToPracticeQuestions(questions: Question[]): PracticeQuestion[] {
  return questions as PracticeQuestion[];
}
