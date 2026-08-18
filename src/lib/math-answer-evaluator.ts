/**
 * Mathematical Answer Evaluation
 * Extends standard text answer evaluation to handle mathematical equivalence
 */

import {
  evaluateTextAnswer as evaluateTextAnswerBase,
  TextAnswerEvaluation,
  ShortAnswerQuestion,
  Question,
  isShortAnswerQuestion,
} from '@/integrations/firebase/types';
import {
  isStudentMathAnswerCorrect,
  areMathExpressionsEquivalent,
  containsMathematicalExpression,
} from './math-engine';
import { isMathematicalAnswer } from './math-parser';

/**
 * Extended evaluation configuration
 */
export interface MathTextAnswerEvaluation extends TextAnswerEvaluation {
  isMathematical?: boolean; // Hint that this contains mathematical content
  mathTolerance?: number; // Tolerance for decimal comparison (default: 0.00001)
}

/**
 * Evaluate a text answer with mathematical awareness
 * Falls back to standard text evaluation if not mathematical
 */
export function evaluateTextAnswerWithMath(
  evaluation: MathTextAnswerEvaluation
): boolean {
  const { studentAnswer, correctAnswers, isMathematical } = evaluation;

  // Detect mathematical content
  const hasMathContent = 
    isMathematical ||
    correctAnswers.some(ans => isMathematicalAnswer(ans)) ||
    isMathematicalAnswer(studentAnswer);

  if (!hasMathContent) {
    // Fall back to standard text evaluation
    const baseEval: TextAnswerEvaluation = {
      studentAnswer,
      correctAnswers,
      caseSensitive: evaluation.caseSensitive,
      requireExactMatch: evaluation.requireExactMatch,
    };
    return evaluateTextAnswerBase(baseEval);
  }

  // Try mathematical evaluation first
  try {
    if (isStudentMathAnswerCorrect(studentAnswer, correctAnswers)) {
      return true;
    }
  } catch {
    // If mathematical evaluation fails, continue to text-based
  }

  // Fall back to text evaluation if mathematical evaluation fails
  const baseEval: TextAnswerEvaluation = {
    studentAnswer,
    correctAnswers,
    caseSensitive: evaluation.caseSensitive,
    requireExactMatch: evaluation.requireExactMatch,
  };
  return evaluateTextAnswerBase(baseEval);
}

/**
 * Check if a question contains mathematical content
 */
export function questionContainsMath(question: Question | Partial<Question>): boolean {
  const texts = [];

  if (typeof question.questionText === 'string') {
    texts.push(question.questionText);
  }

  if ('options' in question && Array.isArray(question.options)) {
    texts.push(...question.options);
  }

  if ('correctAnswers' in question && Array.isArray(question.correctAnswers)) {
    texts.push(...question.correctAnswers);
  }

  if ('explanation' in question && typeof question.explanation === 'string') {
    texts.push(question.explanation);
  }

  return texts.some(text => 
    typeof text === 'string' && isMathematicalAnswer(text)
  );
}

/**
 * Evaluate short answer question with mathematical awareness
 */
export function evaluateShortAnswerWithMath(
  question: ShortAnswerQuestion,
  studentAnswer: string | null
): boolean {
  if (!studentAnswer || !studentAnswer.trim()) {
    return false;
  }

  const correctAnswers = question.correctAnswers || [];
  if (correctAnswers.length === 0) {
    return true; // Accept any non-empty answer if no correct answers defined
  }

  const hasMath = questionContainsMath(question);

  const evaluation: MathTextAnswerEvaluation = {
    studentAnswer,
    correctAnswers,
    caseSensitive: question.caseSensitive || false,
    requireExactMatch: question.requireExactMatch || false,
    isMathematical: hasMath,
  };

  return evaluateTextAnswerWithMath(evaluation);
}

/**
 * Get detailed feedback for a mathematical answer
 */
export interface AnswerFeedback {
  isCorrect: boolean;
  wasEvaluatedAsMath: boolean;
  studentAnswerNormalized?: string;
  matchedCorrectAnswer?: string;
  explanation?: string;
}

export function getDetailedMathFeedback(
  studentAnswer: string,
  correctAnswers: string[],
  questionExplanation?: string
): AnswerFeedback {
  if (!studentAnswer.trim() || correctAnswers.length === 0) {
    return {
      isCorrect: false,
      wasEvaluatedAsMath: false,
    };
  }

  const hasMathContent = correctAnswers.some(ans => isMathematicalAnswer(ans));

  if (!hasMathContent) {
    return {
      isCorrect: false,
      wasEvaluatedAsMath: false,
    };
  }

  // Try to find matching answer
  for (const correctAnswer of correctAnswers) {
    try {
      if (areMathExpressionsEquivalent(studentAnswer, correctAnswer)) {
        return {
          isCorrect: true,
          wasEvaluatedAsMath: true,
          studentAnswerNormalized: studentAnswer,
          matchedCorrectAnswer: correctAnswer,
          explanation: questionExplanation,
        };
      }
    } catch {
      // Continue checking other answers
    }
  }

  return {
    isCorrect: false,
    wasEvaluatedAsMath: true,
    explanation: questionExplanation,
  };
}

/**
 * Prepare a short answer question for mathematical evaluation
 */
export function prepareShortAnswerForMathEvaluation(
  question: ShortAnswerQuestion
): ShortAnswerQuestion {
  // Tags are added at Firebase level after question is saved
  // This function ensures mathematical evaluation is enabled
  return question;
}
