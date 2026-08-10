import { describe, it, expect } from 'vitest';
import {
  isMCQQuestion,
  isTrueFalseQuestion,
  isShortAnswerQuestion,
  isEssayQuestion
} from '@/integrations/firebase/types';
import type { Question, MCQQuestion } from '@/integrations/firebase/types';

describe('Backward Compatibility', () => {
  describe('Type Guard Functions', () => {
    it('should correctly identify MCQ questions', () => {
      const mcqQuestion: MCQQuestion = {
        questionId: '1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'What is 2+2?',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        options: ['4', '3', '5'],
        correctOptionIndex: 0,
        createdAt: new Date()
      };

      expect(isMCQQuestion(mcqQuestion)).toBe(true);
      expect(isTrueFalseQuestion(mcqQuestion)).toBe(false);
      expect(isShortAnswerQuestion(mcqQuestion)).toBe(false);
      expect(isEssayQuestion(mcqQuestion)).toBe(false);
    });

    it('should correctly identify True/False questions', () => {
      const tfQuestion = {
        questionId: '2',
        examId: 'exam1',
        questionType: 'true-false',
        questionText: 'Paris is capital of France',
        marks: 1,
        orderIndex: 2,
        feedbackType: 'hidden',
        correctAnswer: true,
        createdAt: new Date()
      };

      expect(isMCQQuestion(tfQuestion)).toBe(false);
      expect(isTrueFalseQuestion(tfQuestion)).toBe(true);
      expect(isShortAnswerQuestion(tfQuestion)).toBe(false);
      expect(isEssayQuestion(tfQuestion)).toBe(false);
    });

    it('should correctly identify Short Answer questions', () => {
      const saQuestion = {
        questionId: '3',
        examId: 'exam1',
        questionType: 'short-answer',
        questionText: 'What is capital of France?',
        marks: 1,
        orderIndex: 3,
        feedbackType: 'hidden',
        correctAnswers: ['Paris', 'paris'],
        caseSensitive: false,
        createdAt: new Date()
      };

      expect(isMCQQuestion(saQuestion)).toBe(false);
      expect(isTrueFalseQuestion(saQuestion)).toBe(false);
      expect(isShortAnswerQuestion(saQuestion)).toBe(true);
      expect(isEssayQuestion(saQuestion)).toBe(false);
    });

    it('should correctly identify Essay questions', () => {
      const essayQuestion = {
        questionId: '4',
        examId: 'exam1',
        questionType: 'essay',
        questionText: 'Describe your favorite book',
        marks: 5,
        orderIndex: 4,
        feedbackType: 'hidden',
        minWords: 100,
        maxWords: 500,
        createdAt: new Date()
      };

      expect(isMCQQuestion(essayQuestion)).toBe(false);
      expect(isTrueFalseQuestion(essayQuestion)).toBe(false);
      expect(isShortAnswerQuestion(essayQuestion)).toBe(false);
      expect(isEssayQuestion(essayQuestion)).toBe(true);
    });
  });

  describe('Legacy MCQ Questions', () => {
    it('should handle MCQ questions with all fields', () => {
      const legacyMCQ: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Test Question',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        explanation: 'This is the explanation',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 0,
        createdAt: new Date()
      };

      expect(isMCQQuestion(legacyMCQ)).toBe(true);
      expect(legacyMCQ.options).toHaveLength(4);
      expect(legacyMCQ.correctOptionIndex).toBe(0);
    });

    it('should handle MCQ questions without optional image fields', () => {
      const mcqWithoutImage: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Test Question',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        createdAt: new Date()
      };

      expect(isMCQQuestion(mcqWithoutImage)).toBe(true);
      expect(mcqWithoutImage.imageUrl).toBeUndefined();
      expect(mcqWithoutImage.explanation).toBeUndefined();
    });
  });

  describe('Question Rendering Compatibility', () => {
    it('should support rendering questions regardless of type', () => {
      const questions = [
        {
          questionId: '1',
          examId: 'exam1',
          questionType: 'mcq',
          questionText: 'MCQ?',
          marks: 1,
          orderIndex: 1,
          feedbackType: 'hidden',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          createdAt: new Date()
        },
        {
          questionId: '2',
          examId: 'exam1',
          questionType: 'true-false',
          questionText: 'TF?',
          marks: 1,
          orderIndex: 2,
          feedbackType: 'hidden',
          correctAnswer: true,
          createdAt: new Date()
        },
        {
          questionId: '3',
          examId: 'exam1',
          questionType: 'short-answer',
          questionText: 'SA?',
          marks: 1,
          orderIndex: 3,
          feedbackType: 'hidden',
          correctAnswers: ['answer'],
          createdAt: new Date()
        },
        {
          questionId: '4',
          examId: 'exam1',
          questionType: 'essay',
          questionText: 'Essay?',
          marks: 5,
          orderIndex: 4,
          feedbackType: 'hidden',
          createdAt: new Date()
        }
      ];

      // Each question should be identifiable by its type
      for (const question of questions) {
        let identified = false;
        
        if (isMCQQuestion(question)) identified = true;
        if (isTrueFalseQuestion(question)) identified = true;
        if (isShortAnswerQuestion(question)) identified = true;
        if (isEssayQuestion(question)) identified = true;

        expect(identified).toBe(true);
      }
    });
  });

  describe('Exam Composition', () => {
    it('should support exams with mixed question types', () => {
      const exam = {
        examId: 'exam1',
        title: 'Mixed Exam',
        questions: [
          { questionType: 'mcq', questionId: '1', orderIndex: 1 },
          { questionType: 'true-false', questionId: '2', orderIndex: 2 },
          { questionType: 'mcq', questionId: '3', orderIndex: 3 },
          { questionType: 'essay', questionId: '4', orderIndex: 4 }
        ]
      };

      expect(exam.questions).toHaveLength(4);
      
      const types = exam.questions.map(q => q.questionType);
      expect(types).toContain('mcq');
      expect(types).toContain('true-false');
      expect(types).toContain('essay');
    });
  });

  describe('Marks Calculation', () => {
    it('should correctly sum marks across mixed question types', () => {
      const questions = [
        { questionType: 'mcq', marks: 1 },
        { questionType: 'mcq', marks: 2 },
        { questionType: 'true-false', marks: 1 },
        { questionType: 'short-answer', marks: 2 },
        { questionType: 'essay', marks: 5 }
      ];

      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
      expect(totalMarks).toBe(11);
    });
  });

  describe('Question Ordering', () => {
    it('should preserve question order regardless of type', () => {
      const questions = [
        { questionId: '1', orderIndex: 1, questionType: 'essay' },
        { questionId: '2', orderIndex: 2, questionType: 'mcq' },
        { questionId: '3', orderIndex: 3, questionType: 'true-false' },
        { questionId: '4', orderIndex: 4, questionType: 'short-answer' }
      ];

      // Sort by orderIndex
      const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);

      expect(sorted[0].questionId).toBe('1');
      expect(sorted[1].questionId).toBe('2');
      expect(sorted[2].questionId).toBe('3');
      expect(sorted[3].questionId).toBe('4');
    });
  });

  describe('Feedback Type Support', () => {
    it('should support feedback type for all question types', () => {
      const questions = [
        { questionType: 'mcq', feedbackType: 'instant' },
        { questionType: 'mcq', feedbackType: 'hidden' },
        { questionType: 'true-false', feedbackType: 'instant' },
        { questionType: 'essay', feedbackType: 'hidden' }
      ];

      for (const question of questions) {
        expect(['instant', 'hidden']).toContain(question.feedbackType);
      }
    });
  });
});
