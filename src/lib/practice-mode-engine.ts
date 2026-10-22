/**
 * Practice Mode Engine
 * Handles practice exams with instant feedback and explanations
 * Mode: Shows feedback immediately as user answers
 */

import { Question } from '@/integrations/firebase/types';
import { 
  savePracticeAnswer, 
  getPracticeAnswers, 
  submitPracticeExam,
  PracticeExamResult 
} from './offline-practice-exam';

export interface PracticeQuestion {
  questionId: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  marks: number;
  explanation?: string;
  feedbackType: 'instant' | 'hidden';
  orderIndex: number;
  imageUrl?: string;
}

export interface PracticeModeAnswer {
  questionId: string;
  selectedOptionIndex: number | null;
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
  correctOption: number;
}

export interface PracticeModeResult {
  attemptId: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passStatus: 'pass' | 'fail';
  correctCount: number;
  incorrectCount: number;
  answers: PracticeModeAnswer[];
  completedAt: number;
}

/**
 * Get instant feedback for an answer in practice mode
 */
export function getPracticeModeFeedback(
  question: PracticeQuestion,
  selectedOptionIndex: number | null
): PracticeModeFeedback {
  if (selectedOptionIndex === null) {
    return {
      isCorrect: false,
      feedback: 'You skipped this question',
      explanation: question.explanation,
      earnedMarks: 0,
      totalMarks: question.marks,
      correctOption: question.correctOptionIndex,
    };
  }

  const isCorrect = selectedOptionIndex === question.correctOptionIndex;
  const earnedMarks = isCorrect ? question.marks : 0;

  return {
    isCorrect,
    feedback: isCorrect 
      ? `✓ Correct! You earned ${earnedMarks} marks`
      : `✗ Incorrect. The correct answer is: ${question.options[question.correctOptionIndex]}`,
    explanation: question.explanation,
    earnedMarks,
    totalMarks: question.marks,
    correctOption: question.correctOptionIndex,
  };
}

/**
 * Calculate practice mode result
 */
export function calculatePracticeModeResult(
  attemptId: string,
  questions: PracticeQuestion[],
  answers: Map<string, number>, // questionId -> selectedOptionIndex
  passingPercentage: number = 50
): PracticeModeResult {
  let totalScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  const answersArray: PracticeModeAnswer[] = [];

  questions.forEach((question) => {
    const selectedOptionIndex = answers.get(question.questionId);
    
    if (selectedOptionIndex === null || selectedOptionIndex === undefined) {
      // Skipped
      answersArray.push({
        questionId: question.questionId,
        selectedOptionIndex: null,
        isCorrect: false,
        marks: 0,
      });
    } else {
      const isCorrect = selectedOptionIndex === question.correctOptionIndex;
      const marks = isCorrect ? question.marks : 0;
      
      totalScore += marks;
      if (isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }

      answersArray.push({
        questionId: question.questionId,
        selectedOptionIndex,
        isCorrect,
        marks,
        feedback: getPracticeModeFeedback(question, selectedOptionIndex).feedback,
        explanation: question.explanation,
      });
    }
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
    answers: answersArray,
    completedAt: Date.now(),
  };
}

/**
 * Save practice mode answer with instant feedback
 */
export async function savePracticeModeAnswer(
  attemptId: string,
  questionId: string,
  selectedOptionIndex: number | null,
  isCorrect: boolean,
  marks: number
): Promise<void> {
  await savePracticeAnswer(
    attemptId,
    questionId,
    selectedOptionIndex ?? -1,
    isCorrect,
    marks
  );
}

/**
 * Convert to practice format
 */
export function convertToPracticeQuestions(questions: Question[]): PracticeQuestion[] {
  return questions.map((q) => ({
    questionId: q.questionId,
    questionText: q.questionText,
    options: q.options || [],
    correctOptionIndex: q.correctOptionIndex ?? 0,
    marks: q.marks,
    explanation: q.explanation,
    feedbackType: q.feedbackType,
    orderIndex: q.orderIndex,
    imageUrl: q.imageUrl,
  }));
}
