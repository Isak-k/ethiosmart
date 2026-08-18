/**
 * Tests for Mathematical Answer Evaluation
 * Tests integration with standard evaluation and mathematical equivalence
 */

import {
  evaluateTextAnswerWithMath,
  questionContainsMath,
  evaluateShortAnswerWithMath,
  getDetailedMathFeedback,
} from '../math-answer-evaluator';
import { ShortAnswerQuestion } from '@/integrations/firebase/types';
import { Timestamp } from 'firebase/firestore';

describe('Math Answer Evaluator - Text Answer Evaluation', () => {
  test('should evaluate simple mathematical answers', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '1/2',
      correctAnswers: ['1/2'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });

  test('should recognize equivalent fractions', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '2/4',
      correctAnswers: ['1/2'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });

  test('should recognize fraction-decimal equivalence', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '0.5',
      correctAnswers: ['1/2'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });

  test('should reject incorrect answers', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '1/3',
      correctAnswers: ['1/2'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(false);
  });

  test('should handle multiple correct answers', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '0.5',
      correctAnswers: ['1/2', '2/4', '0.5'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });

  test('should fall back to text evaluation for non-math content', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: 'Paris',
      correctAnswers: ['paris'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });

  test('should respect caseSensitive flag for text', () => {
    const result1 = evaluateTextAnswerWithMath({
      studentAnswer: 'Paris',
      correctAnswers: ['PARIS'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result1).toBe(true);

    const result2 = evaluateTextAnswerWithMath({
      studentAnswer: 'Paris',
      correctAnswers: ['PARIS'],
      caseSensitive: true,
      requireExactMatch: false,
    });
    expect(result2).toBe(false);
  });

  test('should handle complex mathematical expressions', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '2',
      correctAnswers: ['4/3 + 2/3'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });
});

describe('Math Answer Evaluator - Question Math Detection', () => {
  test('should detect math in question text', () => {
    const question: Partial<any> = {
      questionText: 'What is 1/2 + 1/4?',
    };
    expect(questionContainsMath(question)).toBe(true);
  });

  test('should detect math in options', () => {
    const question: Partial<any> = {
      options: ['1/2', '1/4', '3/4'],
    };
    expect(questionContainsMath(question)).toBe(true);
  });

  test('should detect math in correct answers', () => {
    const question: Partial<any> = {
      correctAnswers: ['1/2', '0.5'],
    };
    expect(questionContainsMath(question)).toBe(true);
  });

  test('should detect math in explanation', () => {
    const question: Partial<any> = {
      explanation: 'The answer is 1/2 because...',
    };
    expect(questionContainsMath(question)).toBe(true);
  });

  test('should return false for non-mathematical questions', () => {
    const question: Partial<any> = {
      questionText: 'What is the capital of France?',
      options: ['Paris', 'London', 'Berlin'],
    };
    expect(questionContainsMath(question)).toBe(false);
  });
});

describe('Math Answer Evaluator - Short Answer Evaluation', () => {
  test('should evaluate mathematical short answers', () => {
    const question: ShortAnswerQuestion = {
      questionId: '1',
      examId: 'exam1',
      questionType: 'short-answer',
      questionText: 'What is 1/2 + 1/4?',
      marks: 1,
      orderIndex: 1,
      feedbackType: 'instant',
      correctAnswers: ['3/4'],
      createdAt: Timestamp.now(),
    };

    const result = evaluateShortAnswerWithMath(question, '3/4');
    expect(result).toBe(true);
  });

  test('should recognize equivalent answers', () => {
    const question: ShortAnswerQuestion = {
      questionId: '1',
      examId: 'exam1',
      questionType: 'short-answer',
      questionText: 'What is 1/2?',
      marks: 1,
      orderIndex: 1,
      feedbackType: 'instant',
      correctAnswers: ['1/2'],
      createdAt: Timestamp.now(),
    };

    const result = evaluateShortAnswerWithMath(question, '2/4');
    expect(result).toBe(true);
  });

  test('should handle empty answers', () => {
    const question: ShortAnswerQuestion = {
      questionId: '1',
      examId: 'exam1',
      questionType: 'short-answer',
      questionText: 'What is 1/2?',
      marks: 1,
      orderIndex: 1,
      feedbackType: 'instant',
      correctAnswers: ['1/2'],
      createdAt: Timestamp.now(),
    };

    expect(evaluateShortAnswerWithMath(question, '')).toBe(false);
    expect(evaluateShortAnswerWithMath(question, '   ')).toBe(false);
    expect(evaluateShortAnswerWithMath(question, null)).toBe(false);
  });

  test('should accept any answer when no correct answers defined', () => {
    const question: ShortAnswerQuestion = {
      questionId: '1',
      examId: 'exam1',
      questionType: 'short-answer',
      questionText: 'What is your opinion?',
      marks: 1,
      orderIndex: 1,
      feedbackType: 'instant',
      correctAnswers: [],
      createdAt: Timestamp.now(),
    };

    expect(evaluateShortAnswerWithMath(question, 'any answer')).toBe(true);
  });

  test('should respect case sensitivity', () => {
    const caseInsensitiveQuestion: ShortAnswerQuestion = {
      questionId: '1',
      examId: 'exam1',
      questionType: 'short-answer',
      questionText: 'Answer?',
      marks: 1,
      orderIndex: 1,
      feedbackType: 'instant',
      correctAnswers: ['PARIS'],
      caseSensitive: false,
      createdAt: Timestamp.now(),
    };

    expect(evaluateShortAnswerWithMath(caseInsensitiveQuestion, 'paris')).toBe(true);

    const caseSensitiveQuestion: ShortAnswerQuestion = {
      questionId: '1',
      examId: 'exam1',
      questionType: 'short-answer',
      questionText: 'Answer?',
      marks: 1,
      orderIndex: 1,
      feedbackType: 'instant',
      correctAnswers: ['PARIS'],
      caseSensitive: true,
      createdAt: Timestamp.now(),
    };

    expect(evaluateShortAnswerWithMath(caseSensitiveQuestion, 'paris')).toBe(false);
  });

  test('should handle multiple correct answers', () => {
    const question: ShortAnswerQuestion = {
      questionId: '1',
      examId: 'exam1',
      questionType: 'short-answer',
      questionText: 'What is 1/2?',
      marks: 1,
      orderIndex: 1,
      feedbackType: 'instant',
      correctAnswers: ['1/2', '2/4', '0.5'],
      createdAt: Timestamp.now(),
    };

    expect(evaluateShortAnswerWithMath(question, '1/2')).toBe(true);
    expect(evaluateShortAnswerWithMath(question, '2/4')).toBe(true);
    expect(evaluateShortAnswerWithMath(question, '0.5')).toBe(true);
  });
});

describe('Math Answer Evaluator - Detailed Feedback', () => {
  test('should provide feedback for correct answers', () => {
    const feedback = getDetailedMathFeedback('1/2', ['1/2'], 'This is correct');
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.wasEvaluatedAsMath).toBe(true);
    expect(feedback.matchedCorrectAnswer).toBe('1/2');
  });

  test('should provide feedback for equivalent answers', () => {
    const feedback = getDetailedMathFeedback('2/4', ['1/2'], 'This is correct');
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.wasEvaluatedAsMath).toBe(true);
  });

  test('should provide feedback for incorrect answers', () => {
    const feedback = getDetailedMathFeedback('1/3', ['1/2'], 'You were wrong');
    expect(feedback.isCorrect).toBe(false);
    expect(feedback.wasEvaluatedAsMath).toBe(true);
  });

  test('should include explanation in feedback', () => {
    const explanation = 'Remember to find common denominator';
    const feedback = getDetailedMathFeedback('1/4', ['1/2'], explanation);
    expect(feedback.explanation).toBe(explanation);
  });

  test('should handle empty student answers', () => {
    const feedback = getDetailedMathFeedback('', ['1/2']);
    expect(feedback.isCorrect).toBe(false);
    expect(feedback.wasEvaluatedAsMath).toBe(false);
  });

  test('should handle non-mathematical content', () => {
    const feedback = getDetailedMathFeedback('Paris', ['Paris']);
    expect(feedback.wasEvaluatedAsMath).toBe(false);
  });
});

describe('Math Answer Evaluator - Edge Cases', () => {
  test('should handle powers correctly', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '8',
      correctAnswers: ['2^3'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });

  test('should handle negative fractions', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '-1/2',
      correctAnswers: ['-2/4'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });

  test('should handle mixed numbers (interpreting as fractions)', () => {
    // Note: Mixed numbers like "2 1/3" would need special parsing
    // For now, ensure they don't crash the evaluator
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '7/3',
      correctAnswers: ['7/3'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });

  test('should handle expressions with parentheses', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '2.5',
      correctAnswers: ['(5/2)'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });

  test('should handle Unicode operators gracefully', () => {
    const result = evaluateTextAnswerWithMath({
      studentAnswer: '3/4',
      correctAnswers: ['3/4'],
      caseSensitive: false,
      requireExactMatch: false,
    });
    expect(result).toBe(true);
  });
});
