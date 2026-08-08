/**
 * Extensible Question Model for ExamPro
 * Supports: MCQ, True/False, Short Answer, Essay
 * 100% backward compatible with existing MCQ-only system
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// QUESTION TYPE DEFINITIONS
// ============================================================================

export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'essay';

/**
 * Base question interface - shared by all question types
 */
export interface BaseQuestion {
  questionId: string;
  examId: string;
  questionText: string;
  marks: number;
  orderIndex: number;
  feedbackType: 'instant' | 'hidden';
  explanation?: string;
  imageUrl?: string;           // Optional image for any question type
  imageAltText?: string;       // Accessibility: alt text for image
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Metadata for analytics/filtering
  questionType: QuestionType;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

/**
 * MCQ Question - fully backward compatible with existing schema
 */
export interface MCQQuestion extends BaseQuestion {
  questionType: 'mcq';
  options: string[];                    // 2-6 options
  correctOptionIndex: number;
  optionImages?: string[];              // Optional per-option images (future)
  multiSelect?: boolean;                // Future: multiple correct answers
}

/**
 * True/False Question
 */
export interface TrueFalseQuestion extends BaseQuestion {
  questionType: 'true_false';
  correctAnswer: boolean;
}

/**
 * Short Answer Question - pattern matching based
 */
export interface ShortAnswerQuestion extends BaseQuestion {
  questionType: 'short_answer';
  acceptedAnswers: string[];           // Multiple valid answers
  caseSensitive?: boolean;             // Default: false
  charLimit?: number;                  // Character limit (e.g., 100, 500)
}

/**
 * Essay Question - requires manual grading
 */
export interface EssayQuestion extends BaseQuestion {
  questionType: 'essay';
  minWords?: number;                   // Minimum word count
  maxWords?: number;                   // Maximum word count
  rubric?: GradingRubric;              // Optional rubric for scoring
  requiresManualGrading: boolean;      // Always true for essays
}

/**
 * Grading rubric for essay questions
 */
export interface GradingRubric {
  criteria: GradingCriterion[];
  totalPoints: number;
}

/**
 * Individual grading criterion
 */
export interface GradingCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
}

/**
 * Union type for all question types
 */
export type Question = 
  | MCQQuestion 
  | TrueFalseQuestion 
  | ShortAnswerQuestion 
  | EssayQuestion;

// ============================================================================
// ANSWER TYPE DEFINITIONS
// ============================================================================

export type AnswerType = 'mcq' | 'true_false' | 'short_answer' | 'essay';

/**
 * Base answer interface - shared by all answer types
 */
export interface BaseAnswer {
  questionId: string;
  attemptId: string;
  answeredAt: Timestamp | null;
  timeSpentSeconds: number | null;
}

/**
 * MCQ Answer
 */
export interface MCQAnswer extends BaseAnswer {
  questionType: 'mcq';
  selectedOptionIndex: number | null;
  isCorrect: boolean | null;
}

/**
 * True/False Answer
 */
export interface TrueFalseAnswer extends BaseAnswer {
  questionType: 'true_false';
  selectedAnswer: boolean | null;
  isCorrect: boolean | null;
}

/**
 * Short Answer Response
 */
export interface ShortAnswerAnswer extends BaseAnswer {
  questionType: 'short_answer';
  studentResponse: string | null;
  isCorrect: boolean | null;
  matchedAnswer?: string;              // Which accepted answer matched
}

/**
 * Essay Answer - requires manual grading
 */
export interface EssayAnswer extends BaseAnswer {
  questionType: 'essay';
  studentResponse: string | null;
  wordCount?: number;
  manualScore?: number;                // Score given by teacher
  manualFeedback?: string;             // Teacher feedback
  graderUserId?: string;               // User ID of grader
  gradedAt?: Timestamp;
  autoScore?: number;                  // Preliminary score from rubric
}

/**
 * Union type for all answer types
 */
export type Answer = 
  | MCQAnswer 
  | TrueFalseAnswer 
  | ShortAnswerAnswer 
  | EssayAnswer;

// ============================================================================
// ESSAY GRADING COLLECTION TYPES
// ============================================================================

/**
 * Essay document for manual grading workflow
 */
export interface Essay {
  essayId: string;
  attemptId: string;
  examId: string;
  questionId: string;
  studentId: string;
  studentResponse: string;
  wordCount: number;
  marks: number;
  status: 'pending' | 'graded' | 'rejected';
  manualScore?: number;
  manualFeedback?: string;
  gradedBy?: string;                   // User ID of grader
  gradedAt?: Timestamp;
  createdAt: Timestamp;
}

/**
 * Reusable grading rubric
 */
export interface Rubric {
  rubricId: string;
  name: string;
  description?: string;
  criteria: GradingCriterion[];
  totalPoints: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isMCQQuestion(q: Question): q is MCQQuestion {
  return q.questionType === 'mcq';
}

export function isTrueFalseQuestion(q: Question): q is TrueFalseQuestion {
  return q.questionType === 'true_false';
}

export function isShortAnswerQuestion(q: Question): q is ShortAnswerQuestion {
  return q.questionType === 'short_answer';
}

export function isEssayQuestion(q: Question): q is EssayQuestion {
  return q.questionType === 'essay';
}

export function isMCQAnswer(a: Answer): a is MCQAnswer {
  return a.questionType === 'mcq';
}

export function isTrueFalseAnswer(a: Answer): a is TrueFalseAnswer {
  return a.questionType === 'true_false';
}

export function isShortAnswerAnswer(a: Answer): a is ShortAnswerAnswer {
  return a.questionType === 'short_answer';
}

export function isEssayAnswer(a: Answer): a is EssayAnswer {
  return a.questionType === 'essay';
}

export function isAutoGradable(question: Question): boolean {
  return question.questionType !== 'essay';
}

export function requiresManualGrading(question: Question): boolean {
  return isEssayQuestion(question) && question.requiresManualGrading;
}

// ============================================================================
// VALIDATION & UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the correct answer for a question (for auto-gradable questions)
 */
export function getCorrectAnswer(question: Question): any {
  switch (question.questionType) {
    case 'mcq':
      return (question as MCQQuestion).correctOptionIndex;
    case 'true_false':
      return (question as TrueFalseQuestion).correctAnswer;
    case 'short_answer':
      return (question as ShortAnswerQuestion).acceptedAnswers;
    case 'essay':
      return null; // Requires manual grading
  }
}

/**
 * Validate a student's answer and return correctness
 */
export function validateAnswer(
  question: Question,
  answer: Answer
): { isCorrect: boolean; feedback?: string } {
  // MCQ validation
  if (isMCQQuestion(question) && isMCQAnswer(answer)) {
    const mcqQ = question as MCQQuestion;
    return {
      isCorrect: answer.selectedOptionIndex === mcqQ.correctOptionIndex
    };
  }
  
  // True/False validation
  if (isTrueFalseQuestion(question) && isTrueFalseAnswer(answer)) {
    const tfQ = question as TrueFalseQuestion;
    const tfA = answer as TrueFalseAnswer;
    return {
      isCorrect: tfA.selectedAnswer === tfQ.correctAnswer
    };
  }
  
  // Short answer validation
  if (isShortAnswerQuestion(question) && isShortAnswerAnswer(answer)) {
    const saQ = question as ShortAnswerQuestion;
    const saA = answer as ShortAnswerAnswer;
    
    if (saA.studentResponse === null || saA.studentResponse === '') {
      return { isCorrect: false };
    }
    
    const normalize = (s: string) => 
      saQ.caseSensitive ? s : s.toLowerCase().trim();
    
    const studentNorm = normalize(saA.studentResponse);
    
    const matched = saQ.acceptedAnswers.find(
      a => normalize(a) === studentNorm
    );
    
    return {
      isCorrect: !!matched,
      feedback: matched ? 'Correct' : 'Incorrect'
    };
  }
  
  // Essay validation (requires manual grading)
  if (isEssayQuestion(question) && isEssayAnswer(answer)) {
    return {
      isCorrect: false,
      feedback: 'Awaiting manual grading'
    };
  }
  
  return { isCorrect: false };
}

/**
 * Check if answer is complete (not skipped)
 */
export function isAnswerComplete(question: Question, answer: Answer): boolean {
  switch (question.questionType) {
    case 'mcq':
      return (answer as MCQAnswer).selectedOptionIndex !== null;
    case 'true_false':
      return (answer as TrueFalseAnswer).selectedAnswer !== null;
    case 'short_answer':
      return !!(answer as ShortAnswerAnswer).studentResponse;
    case 'essay':
      return !!(answer as EssayAnswer).studentResponse;
  }
}

/**
 * Count words in a string (for essay word limits)
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Validate essay word count against question requirements
 */
export function validateEssayWordCount(
  question: EssayQuestion,
  essay: string
): { valid: boolean; message?: string } {
  const wordCount = countWords(essay);
  
  if (question.minWords && wordCount < question.minWords) {
    return {
      valid: false,
      message: `Essay must have at least ${question.minWords} words (current: ${wordCount})`
    };
  }
  
  if (question.maxWords && wordCount > question.maxWords) {
    return {
      valid: false,
      message: `Essay must not exceed ${question.maxWords} words (current: ${wordCount})`
    };
  }
  
  return { valid: true };
}

// ============================================================================
// BACKWARD COMPATIBILITY HELPERS
// ============================================================================

/**
 * Convert legacy question to new format
 * Used for defensive reading when loading questions
 */
export function ensureQuestionType(data: any): Question {
  if (!data.questionType) {
    // Default to MCQ for legacy questions
    data.questionType = 'mcq';
  }
  return data as Question;
}

/**
 * Convert legacy answer to new format
 * Used for defensive reading when loading answers
 */
export function ensureAnswerType(data: any, questionType: QuestionType): Answer {
  if (!data.questionType) {
    data.questionType = questionType;
  }
  return data as Answer;
}
