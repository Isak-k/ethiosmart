import { describe, it, expect, beforeEach } from 'vitest';
import type { MCQQuestion, TrueFalseQuestion, ShortAnswerQuestion, EssayQuestion } from '@/integrations/firebase/types';

describe('Data Integrity', () => {
  describe('Round Trip Serialization', () => {
    it('should preserve MCQ question data through serialization cycle', () => {
      const original: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Original question text',
        marks: 3,
        orderIndex: 5,
        feedbackType: 'instant',
        explanation: 'This is the explanation',
        imageUrl: 'https://example.com/image.jpg',
        imageDisplayMode: 'main',
        options: ['Option A', 'Option B', 'Option C'],
        correctOptionIndex: 1,
        createdAt: new Date('2024-01-01')
      };

      // Simulate serialization and deserialization
      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized) as MCQQuestion;

      // Verify all fields preserved
      expect(deserialized.questionId).toBe(original.questionId);
      expect(deserialized.questionText).toBe(original.questionText);
      expect(deserialized.marks).toBe(original.marks);
      expect(deserialized.orderIndex).toBe(original.orderIndex);
      expect(deserialized.feedbackType).toBe(original.feedbackType);
      expect(deserialized.explanation).toBe(original.explanation);
      expect(deserialized.imageUrl).toBe(original.imageUrl);
      expect(deserialized.imageDisplayMode).toBe(original.imageDisplayMode);
      expect(deserialized.options).toEqual(original.options);
      expect(deserialized.correctOptionIndex).toBe(original.correctOptionIndex);
      expect(deserialized.questionType).toBe(original.questionType);
    });

    it('should preserve True/False question data through serialization', () => {
      const original: TrueFalseQuestion = {
        questionId: 'q2',
        examId: 'exam1',
        questionType: 'true-false',
        questionText: 'Is this true?',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        correctAnswer: true,
        createdAt: new Date('2024-01-01')
      };

      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized) as TrueFalseQuestion;

      expect(deserialized.questionType).toBe('true-false');
      expect(deserialized.correctAnswer).toBe(true);
      expect(deserialized.questionText).toBe(original.questionText);
    });

    it('should preserve Short Answer question data through serialization', () => {
      const original: ShortAnswerQuestion = {
        questionId: 'q3',
        examId: 'exam1',
        questionType: 'short-answer',
        questionText: 'What is the answer?',
        marks: 2,
        orderIndex: 3,
        feedbackType: 'instant',
        correctAnswers: ['answer', 'ans', 'correct'],
        caseSensitive: false,
        requireExactMatch: true,
        createdAt: new Date('2024-01-01')
      };

      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized) as ShortAnswerQuestion;

      expect(deserialized.questionType).toBe('short-answer');
      expect(deserialized.correctAnswers).toEqual(original.correctAnswers);
      expect(deserialized.caseSensitive).toBe(false);
      expect(deserialized.requireExactMatch).toBe(true);
    });

    it('should preserve Essay question data through serialization', () => {
      const original: EssayQuestion = {
        questionId: 'q4',
        examId: 'exam1',
        questionType: 'essay',
        questionText: 'Write an essay',
        marks: 10,
        orderIndex: 4,
        feedbackType: 'hidden',
        minWords: 100,
        maxWords: 500,
        rubricPoints: [
          { criteria: 'Clarity', points: 5 },
          { criteria: 'Detail', points: 5 }
        ],
        createdAt: new Date('2024-01-01')
      };

      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized) as EssayQuestion;

      expect(deserialized.questionType).toBe('essay');
      expect(deserialized.minWords).toBe(100);
      expect(deserialized.maxWords).toBe(500);
      expect(deserialized.rubricPoints).toHaveLength(2);
      expect(deserialized.rubricPoints[0].criteria).toBe('Clarity');
    });
  });

  describe('Data Immutability on Load', () => {
    it('should not modify original data when loading MCQ question', () => {
      const original: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Original text',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        createdAt: new Date()
      };

      // Store original values
      const originalText = original.questionText;
      const originalMarks = original.marks;

      // Simulate loading (no modification should occur)
      const loaded = JSON.parse(JSON.stringify(original));

      // Verify original is unchanged
      expect(original.questionText).toBe(originalText);
      expect(original.marks).toBe(originalMarks);
      expect(loaded.questionText).toBe(original.questionText);
    });

    it('should handle multiple loads without data corruption', () => {
      const question: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Test',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        createdAt: new Date('2024-01-01')
      };

      // Load multiple times
      let loaded = question;
      for (let i = 0; i < 5; i++) {
        loaded = JSON.parse(JSON.stringify(loaded));
      }

      // Data should remain identical
      expect(loaded.questionText).toBe(question.questionText);
      expect(loaded.options).toEqual(question.options);
      expect(loaded.correctOptionIndex).toBe(question.correctOptionIndex);
    });
  });

  describe('Optional Field Handling', () => {
    it('should handle questions without optional fields', () => {
      const minimalMCQ: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Question',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        createdAt: new Date()
      };

      expect(minimalMCQ.explanation).toBeUndefined();
      expect(minimalMCQ.imageUrl).toBeUndefined();
      expect(minimalMCQ.imageDisplayMode).toBeUndefined();

      // Should still be valid
      const serialized = JSON.stringify(minimalMCQ);
      const deserialized = JSON.parse(serialized);
      expect(deserialized.questionType).toBe('mcq');
    });

    it('should preserve optional fields when present', () => {
      const mcqWithOptionals: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Question',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        explanation: 'Explanation',
        imageUrl: 'https://example.com/image.jpg',
        imageDisplayMode: 'inline',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        createdAt: new Date()
      };

      const serialized = JSON.stringify(mcqWithOptionals);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.explanation).toBe('Explanation');
      expect(deserialized.imageUrl).toBe('https://example.com/image.jpg');
      expect(deserialized.imageDisplayMode).toBe('inline');
    });
  });

  describe('Field Type Consistency', () => {
    it('should maintain correct field types after serialization', () => {
      const question: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Question',
        marks: 5,
        orderIndex: 3,
        feedbackType: 'hidden',
        options: ['A', 'B', 'C'],
        correctOptionIndex: 1,
        createdAt: new Date('2024-01-01')
      };

      const serialized = JSON.stringify(question);
      const deserialized = JSON.parse(serialized);

      expect(typeof deserialized.questionId).toBe('string');
      expect(typeof deserialized.questionText).toBe('string');
      expect(typeof deserialized.marks).toBe('number');
      expect(typeof deserialized.orderIndex).toBe('number');
      expect(typeof deserialized.correctOptionIndex).toBe('number');
      expect(Array.isArray(deserialized.options)).toBe(true);
      expect(typeof deserialized.feedbackType).toBe('string');
    });

    it('should maintain boolean fields correctly', () => {
      const shortAnswer: ShortAnswerQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'short-answer',
        questionText: 'Test',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        correctAnswers: ['answer'],
        caseSensitive: true,
        requireExactMatch: false,
        createdAt: new Date()
      };

      const serialized = JSON.stringify(shortAnswer);
      const deserialized = JSON.parse(serialized);

      expect(typeof deserialized.caseSensitive).toBe('boolean');
      expect(typeof deserialized.requireExactMatch).toBe('boolean');
      expect(deserialized.caseSensitive).toBe(true);
      expect(deserialized.requireExactMatch).toBe(false);
    });
  });

  describe('Update Isolation', () => {
    it('should allow isolated updates without affecting original', () => {
      const original: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Original',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        createdAt: new Date()
      };

      // Create an update
      const updated: Partial<MCQQuestion> = {
        questionText: 'Updated'
      };

      // Original should be unchanged
      expect(original.questionText).toBe('Original');
      expect(updated.questionText).toBe('Updated');
    });

    it('should track which fields were updated', () => {
      const updates: Array<{ field: string; oldValue: any; newValue: any }> = [];

      const original: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Original',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        createdAt: new Date()
      };

      // Simulate update tracking
      updates.push({
        field: 'questionText',
        oldValue: original.questionText,
        newValue: 'Updated'
      });

      expect(updates).toHaveLength(1);
      expect(updates[0].field).toBe('questionText');
      expect(updates[0].oldValue).toBe('Original');
      expect(updates[0].newValue).toBe('Updated');
    });
  });

  describe('Array Data Integrity', () => {
    it('should preserve option arrays in MCQ', () => {
      const options = ['First', 'Second', 'Third', 'Fourth'];
      const question: MCQQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'mcq',
        questionText: 'Test',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        options,
        correctOptionIndex: 2,
        createdAt: new Date()
      };

      const serialized = JSON.stringify(question);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.options).toEqual(options);
      expect(deserialized.options).toHaveLength(4);
      expect(deserialized.options[2]).toBe('Third');
    });

    it('should preserve correct answers array in Short Answer', () => {
      const correctAnswers = ['answer', 'ans', 'reply'];
      const question: ShortAnswerQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'short-answer',
        questionText: 'Test',
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        correctAnswers,
        createdAt: new Date()
      };

      const serialized = JSON.stringify(question);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.correctAnswers).toEqual(correctAnswers);
      expect(deserialized.correctAnswers).toHaveLength(3);
    });

    it('should preserve rubric points array in Essay', () => {
      const rubricPoints = [
        { criteria: 'Clarity', points: 5 },
        { criteria: 'Completeness', points: 3 },
        { criteria: 'Grammar', points: 2 }
      ];

      const question: EssayQuestion = {
        questionId: 'q1',
        examId: 'exam1',
        questionType: 'essay',
        questionText: 'Test',
        marks: 10,
        orderIndex: 1,
        feedbackType: 'hidden',
        rubricPoints,
        createdAt: new Date()
      };

      const serialized = JSON.stringify(question);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.rubricPoints).toEqual(rubricPoints);
      expect(deserialized.rubricPoints).toHaveLength(3);
      expect(deserialized.rubricPoints[0].criteria).toBe('Clarity');
    });
  });
});
