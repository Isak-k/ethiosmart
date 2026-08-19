import { Timestamp } from 'firebase/firestore';

export type QuestionType = 'mcq' | 'true-false' | 'short-answer' | 'essay';

export interface BaseQuestion {
  questionId: string;
  examId: string;
  questionText: string;
  marks: number;
  orderIndex: number;
  feedbackType: 'instant' | 'hidden';
  explanation?: string;
  imageUrl?: string;
  imageAltText?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  questionType: QuestionType;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  imageDisplayMode?: 'inline' | 'background' | 'main';
}

export interface MCQQuestion extends BaseQuestion {
  questionType: 'mcq';
  options: string[];
  correctOptionIndex: number;
  optionImages?: string[];
  multiSelect?: boolean;
}

export interface TrueFalseQuestion extends BaseQuestion {
  questionType: 'true-false';
  correctAnswer: boolean;
}

export interface ShortAnswerQuestion extends BaseQuestion {
  questionType: 'short-answer';
  correctAnswers: string[];
  caseSensitive?: boolean;
  requireExactMatch?: boolean;
  charLimit?: number;
  requiresManualGrading?: boolean;
}

export interface EssayQuestion extends BaseQuestion {
  questionType: 'essay';
  minWords?: number;
  maxWords?: number;
  rubric?: GradingRubric;
  rubricPoints?: { criteria: string; points: number }[];
  requiresManualGrading: boolean;
}

export interface GradingRubric {
  criteria: GradingCriterion[];
  totalPoints: number;
}

export interface GradingCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
}

export type Question = 
  | MCQQuestion 
  | TrueFalseQuestion 
  | ShortAnswerQuestion 
  | EssayQuestion;

export type AnswerType = 'mcq' | 'true-false' | 'short-answer' | 'essay';

export interface BaseAnswer {
  questionId: string;
  attemptId: string;
  answeredAt: Timestamp | null;
  timeSpentSeconds: number | null;
}

export interface MCQAnswer extends BaseAnswer {
  questionType: 'mcq';
  selectedOptionIndex: number | null;
  isCorrect: boolean | null;
}

export interface TrueFalseAnswer extends BaseAnswer {
  questionType: 'true-false';
  selectedAnswer: boolean | null;
  isCorrect: boolean | null;
}

export interface ShortAnswerAnswer extends BaseAnswer {
  questionType: 'short-answer';
  studentResponse: string | null;
  isCorrect: boolean | null;
  matchedAnswer?: string;
  manualScore?: number;
  manualFeedback?: string;
  graderUserId?: string;
  gradedAt?: Timestamp;
}

export interface EssayAnswer extends BaseAnswer {
  questionType: 'essay';
  studentResponse: string | null;
  wordCount?: number;
  manualScore?: number;
  manualFeedback?: string;
  graderUserId?: string;
  gradedAt?: Timestamp;
  autoScore?: number;
}

export type Answer = 
  | MCQAnswer 
  | TrueFalseAnswer 
  | ShortAnswerAnswer 
  | EssayAnswer;

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
  gradedBy?: string;
  gradedAt?: Timestamp;
  createdAt: Timestamp;
}

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

function normalizeType(value: string): string {
  return value.replace(/_/g, '-');
}

export function isMCQQuestion(q: Question): q is MCQQuestion {
  return q && normalizeType(q.questionType) === 'mcq';
}

export function isTrueFalseQuestion(q: Question): q is TrueFalseQuestion {
  return q && normalizeType(q.questionType) === 'true-false';
}

export function isShortAnswerQuestion(q: Question): q is ShortAnswerQuestion {
  return q && normalizeType(q.questionType) === 'short-answer';
}

export function isEssayQuestion(q: Question): q is EssayQuestion {
  return q && normalizeType(q.questionType) === 'essay';
}

export function isMCQAnswer(a: Answer): a is MCQAnswer {
  return a && normalizeType(a.questionType) === 'mcq';
}

export function isTrueFalseAnswer(a: Answer): a is TrueFalseAnswer {
  return a && normalizeType(a.questionType) === 'true-false';
}

export function isShortAnswerAnswer(a: Answer): a is ShortAnswerAnswer {
  return a && normalizeType(a.questionType) === 'short-answer';
}

export function isEssayAnswer(a: Answer): a is EssayAnswer {
  return a && normalizeType(a.questionType) === 'essay';
}

export function isAutoGradable(question: Question): boolean {
  return !isEssayQuestion(question);
}

export function requiresManualGrading(question: Question): boolean {
  return isEssayQuestion(question) && (question as EssayQuestion).requiresManualGrading;
}

export function getCorrectAnswer(question: Question): any {
  const q = question as any;
  switch (normalizeType(question.questionType)) {
    case 'mcq':
      return q.correctOptionIndex;
    case 'true-false':
      return q.correctAnswer;
    case 'short-answer':
      return q.correctAnswers;
    case 'essay':
      return null;
  }
}

export function validateAnswer(
  question: Question,
  answer: Answer
): { isCorrect: boolean; feedback?: string } {
  const qType = normalizeType(question.questionType);

  if (qType === 'mcq') {
    const mcqQ = question as unknown as MCQQuestion;
    const mcqA = answer as unknown as MCQAnswer;
    return {
      isCorrect: mcqA.selectedOptionIndex === mcqQ.correctOptionIndex
    };
  }
  
  if (qType === 'true-false') {
    const tfQ = question as unknown as TrueFalseQuestion;
    const tfA = answer as unknown as TrueFalseAnswer;
    return {
      isCorrect: tfA.selectedAnswer === tfQ.correctAnswer
    };
  }
  
  if (qType === 'short-answer') {
    const saQ = question as unknown as ShortAnswerQuestion;
    const saA = answer as unknown as ShortAnswerAnswer;
    
    if (saA.studentResponse === null || saA.studentResponse === '') {
      return { isCorrect: false };
    }
    
    const normalize = (s: string) => 
      saQ.caseSensitive ? s : s.toLowerCase().trim();
    
    const studentNorm = normalize(saA.studentResponse);
    
    const matched = saQ.correctAnswers.find(
      a => normalize(a) === studentNorm
    );
    
    return {
      isCorrect: !!matched,
      feedback: matched ? 'Correct' : 'Incorrect'
    };
  }
  
  if (qType === 'essay') {
    return {
      isCorrect: false,
      feedback: 'Awaiting manual grading'
    };
  }
  
  return { isCorrect: false };
}

export function isAnswerComplete(question: Question, answer: Answer): boolean {
  const qType = normalizeType(question.questionType);
  switch (qType) {
    case 'mcq':
      return (answer as unknown as MCQAnswer).selectedOptionIndex !== null;
    case 'true-false':
      return (answer as unknown as TrueFalseAnswer).selectedAnswer !== null;
    case 'short-answer':
      return !!(answer as unknown as ShortAnswerAnswer).studentResponse;
    case 'essay':
      return !!(answer as unknown as EssayAnswer).studentResponse;
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

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

export function ensureQuestionType(data: any): Question {
  if (!data.questionType) {
    data.questionType = 'mcq';
  }
  data.questionType = normalizeType(data.questionType);
  if (!data.requiresManualGrading && isEssayQuestion(data as Question)) {
    data.requiresManualGrading = true;
  }
  return data as Question;
}

export function ensureAnswerType(data: any, questionType: QuestionType): Answer {
  if (!data.questionType) {
    data.questionType = normalizeType(questionType);
  } else {
    data.questionType = normalizeType(data.questionType);
  }
  return data as Answer;
}
