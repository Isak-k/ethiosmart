import { describe, it, expect } from 'vitest';
import { parseCSVQuestions, parseJSONQuestions } from '../question-parser';
import { validateImportedQuestions } from '../import-validator';
import { NewQuestionInput } from '../validations';

describe('Bulk Import - Question Type Support', () => {
  describe('MCQ Questions', () => {
    it('should parse and validate MCQ from CSV', () => {
      const csv = `questionType,questionText,marks,feedbackType,options,correctOptionIndex
mcq,What is 2+2?,1,instant,"3;4;5;6",1`;

      const parsed = parseCSVQuestions(csv);
      expect(parsed.successCount).toBe(1);

      const validated = validateImportedQuestions(parsed.questions);
      expect(validated.valid).toBe(true);
      expect(validated.validQuestions[0].questionType).toBe('mcq');
    });

    it('should parse MCQ from JSON', () => {
      const json = JSON.stringify([{
        questionType: 'mcq',
        questionText: 'Test?',
        marks: 1,
        feedbackType: 'instant',
        options: ['A', 'B', 'C'],
        correctOptionIndex: 0
      }]);

      const parsed = parseJSONQuestions(json);
      expect(parsed.successCount).toBe(1);
      expect(parsed.questions[0].questionType).toBe('mcq');
    });

    it('should reject MCQ with invalid option index', () => {
      const questions: NewQuestionInput[] = [{
        questionType: 'mcq',
        questionText: 'Test?',
        marks: 1,
        feedbackType: 'instant',
        options: ['A', 'B'],
        correctOptionIndex: 5
      }];

      const validated = validateImportedQuestions(questions);
      expect(validated.valid).toBe(false);
    });
  });

  describe('True/False Questions', () => {
    it('should parse and validate True/False from CSV', () => {
      const csv = `questionType,questionText,marks,feedbackType,correctAnswer
true-false,Is earth round?,1,instant,true`;

      const parsed = parseCSVQuestions(csv);
      expect(parsed.successCount).toBe(1);

      const validated = validateImportedQuestions(parsed.questions);
      expect(validated.valid).toBe(true);
      if ('correctAnswer' in validated.validQuestions[0]) {
        expect(validated.validQuestions[0].correctAnswer).toBe(true);
      }
    });

    it('should parse True/False from JSON', () => {
      const json = JSON.stringify([{
        questionType: 'true-false',
        questionText: 'Test?',
        marks: 1,
        feedbackType: 'instant',
        correctAnswer: false
      }]);

      const parsed = parseJSONQuestions(json);
      expect(parsed.successCount).toBe(1);
      expect(parsed.questions[0].questionType).toBe('true-false');
    });
  });

  describe('Short Answer Questions', () => {
    it('should parse and validate Short Answer from CSV', () => {
      const csv = `questionType,questionText,marks,feedbackType,correctAnswers,caseSensitive
short-answer,What is 2+2?,1,instant,"Four;4",false`;

      const parsed = parseCSVQuestions(csv);
      expect(parsed.successCount).toBe(1);

      const validated = validateImportedQuestions(parsed.questions);
      expect(validated.valid).toBe(true);
      if ('correctAnswers' in validated.validQuestions[0]) {
        expect(validated.validQuestions[0].correctAnswers).toContain('Four');
      }
    });

    it('should parse Short Answer from JSON', () => {
      const json = JSON.stringify([{
        questionType: 'short-answer',
        questionText: 'Test?',
        marks: 1,
        feedbackType: 'instant',
        correctAnswers: ['answer1', 'answer2'],
        caseSensitive: true,
        requireExactMatch: false
      }]);

      const parsed = parseJSONQuestions(json);
      expect(parsed.successCount).toBe(1);
      expect(parsed.questions[0].questionType).toBe('short-answer');
    });

    it('should reject Short Answer with no correct answers', () => {
      const questions: NewQuestionInput[] = [{
        questionType: 'short-answer',
        questionText: 'Test?',
        marks: 1,
        feedbackType: 'instant',
        correctAnswers: []
      }];

      const validated = validateImportedQuestions(questions);
      expect(validated.valid).toBe(false);
    });
  });

  describe('Essay Questions', () => {
    it('should parse and validate Essay from CSV', () => {
      const csv = `questionType,questionText,marks,feedbackType,minWords,maxWords
essay,Write about it,5,instant,200,500`;

      const parsed = parseCSVQuestions(csv);
      expect(parsed.successCount).toBe(1);

      const validated = validateImportedQuestions(parsed.questions);
      expect(validated.valid).toBe(true);
      if ('minWords' in validated.validQuestions[0]) {
        expect(validated.validQuestions[0].minWords).toBe(200);
      }
    });

    it('should parse Essay from JSON with rubric', () => {
      const json = JSON.stringify([{
        questionType: 'essay',
        questionText: 'Test?',
        marks: 5,
        feedbackType: 'instant',
        minWords: 100,
        maxWords: 500,
        rubricPoints: [
          { criteria: 'Clarity', points: 3 },
          { criteria: 'Evidence', points: 2 }
        ]
      }]);

      const parsed = parseJSONQuestions(json);
      expect(parsed.successCount).toBe(1);
      expect(parsed.questions[0].questionType).toBe('essay');
    });

    it('should reject Essay with minWords > maxWords', () => {
      const questions: NewQuestionInput[] = [{
        questionType: 'essay',
        questionText: 'Test?',
        marks: 5,
        feedbackType: 'instant',
        minWords: 500,
        maxWords: 100
      }];

      const validated = validateImportedQuestions(questions);
      expect(validated.valid).toBe(false);
    });
  });

  describe('Mixed Question Types', () => {
    it('should parse mixed types from JSON', () => {
      const json = JSON.stringify([
        {
          questionType: 'mcq',
          questionText: 'Q1?',
          marks: 1,
          feedbackType: 'instant',
          options: ['A', 'B'],
          correctOptionIndex: 0
        },
        {
          questionType: 'true-false',
          questionText: 'Q2?',
          marks: 1,
          feedbackType: 'instant',
          correctAnswer: true
        },
        {
          questionType: 'short-answer',
          questionText: 'Q3?',
          marks: 1,
          feedbackType: 'instant',
          correctAnswers: ['ans']
        },
        {
          questionType: 'essay',
          questionText: 'Q4?',
          marks: 3,
          feedbackType: 'instant',
          minWords: 50,
          maxWords: 200
        }
      ]);

      const parsed = parseJSONQuestions(json);
      expect(parsed.successCount).toBe(4);
      expect(parsed.questions).toHaveLength(4);

      const types = parsed.questions.map(q => q.questionType);
      expect(types).toEqual(['mcq', 'true-false', 'short-answer', 'essay']);
    });

    it('should validate mixed types correctly', () => {
      const questions: NewQuestionInput[] = [
        {
          questionType: 'mcq',
          questionText: 'Q1?',
          marks: 1,
          feedbackType: 'instant',
          options: ['A', 'B'],
          correctOptionIndex: 0
        },
        {
          questionType: 'true-false',
          questionText: 'Q2?',
          marks: 1,
          feedbackType: 'instant',
          correctAnswer: true
        },
        {
          questionType: 'short-answer',
          questionText: 'Q3?',
          marks: 1,
          feedbackType: 'instant',
          correctAnswers: ['ans']
        },
        {
          questionType: 'essay',
          questionText: 'Q4?',
          marks: 3,
          feedbackType: 'instant'
        }
      ];

      const validated = validateImportedQuestions(questions);
      expect(validated.valid).toBe(true);
      expect(validated.validQuestions).toHaveLength(4);
    });
  });

  describe('Image Support - All Types', () => {
    it('should preserve image URLs for all types', () => {
      const questions: NewQuestionInput[] = [
        {
          questionType: 'mcq',
          questionText: 'Q1?',
          marks: 1,
          feedbackType: 'instant',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          imageUrl: 'https://example.com/img1.jpg',
          imageDisplayMode: 'main'
        },
        {
          questionType: 'true-false',
          questionText: 'Q2?',
          marks: 1,
          feedbackType: 'instant',
          correctAnswer: true,
          imageUrl: 'https://example.com/img2.jpg',
          imageDisplayMode: 'background'
        },
        {
          questionType: 'short-answer',
          questionText: 'Q3?',
          marks: 1,
          feedbackType: 'instant',
          correctAnswers: ['ans'],
          imageUrl: 'https://example.com/img3.jpg',
          imageDisplayMode: 'inline'
        },
        {
          questionType: 'essay',
          questionText: 'Q4?',
          marks: 3,
          feedbackType: 'instant',
          imageUrl: 'https://example.com/img4.jpg'
        }
      ];

      const validated = validateImportedQuestions(questions);
      expect(validated.valid).toBe(true);

      for (const q of validated.validQuestions) {
        expect(q.imageUrl).toBeDefined();
        expect(q.imageUrl?.startsWith('https://')).toBe(true);
      }
    });
  });

  describe('Field Preservation', () => {
    it('should preserve all type-specific fields through validation', () => {
      const csv = `questionType,questionText,marks,feedbackType,options,correctOptionIndex,explanation
mcq,Test MCQ?,2,instant,"A;B;C",1,Explanation text`;

      const parsed = parseCSVQuestions(csv);
      const question = parsed.questions[0];

      expect(question.marks).toBe(2);
      expect(question.explanation).toBe('Explanation text');
      expect(question.feedbackType).toBe('instant');
      if ('options' in question) {
        expect(question.options).toContain('A');
        expect(question.correctOptionIndex).toBe(1);
      }

      const validated = validateImportedQuestions([question]);
      expect(validated.validQuestions[0].marks).toBe(2);
      expect(validated.validQuestions[0].explanation).toBe('Explanation text');
    });
  });
});
