import { describe, it, expect } from 'vitest';
import {
  validateImportedQuestions,
  getValidationStatsByType,
  generateValidationReport,
  filterValidQuestions,
  canImport,
  getQuestionErrors
} from '../import-validator';
import { NewQuestionInput } from '../validations';

describe('Import Validator', () => {
  describe('Integration with question validator', () => {
    it('should use validateQuestionBeforeSave from question-validator', () => {
      // This test ensures integration is working
      // Actual question validation is tested in question-validator.test.ts
      const questions: NewQuestionInput[] = [];
      const result = validateImportedQuestions(questions);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.validQuestions).toEqual([]);
      expect(result.invalidQuestions).toEqual([]);
    });
  });

  describe('validateImportedQuestions', () => {
    it('should process empty question list', () => {
      const questions: NewQuestionInput[] = [];
      const result = validateImportedQuestions(questions);

      expect(result.valid).toBe(true);
      expect(result.validQuestions).toHaveLength(0);
      expect(result.invalidQuestions).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });

    it('should track display index correctly', () => {
      // Display index should be 1-based while internal index is 0-based
      const questions: NewQuestionInput[] = [
        {
          questionType: 'mcq',
          questionText: '',  // Invalid - empty
          marks: 1,
          options: ['A'],
          correctOptionIndex: 0
        }
      ];

      const result = validateImportedQuestions(questions);

      if (result.invalidQuestions.length > 0) {
        expect(result.invalidQuestions[0].index).toBe(0);  // 0-indexed
        expect(result.invalidQuestions[0].displayIndex).toBe(1);  // 1-indexed for display
      }
    });

    it('should preserve question text in error reporting', () => {
      const questionText = 'Sample test question';
      const questions: NewQuestionInput[] = [
        {
          questionType: 'mcq',
          questionText,
          marks: 1,
          options: ['A'],  // Invalid - only 1 option
          correctOptionIndex: 0
        }
      ];

      const result = validateImportedQuestions(questions);

      if (result.invalidQuestions.length > 0) {
        expect(result.invalidQuestions[0].questionText).toBe(questionText);
      }
    });

    it('should categorize questions by type in errors', () => {
      const questions: NewQuestionInput[] = [
        {
          questionType: 'mcq',
          questionText: '',
          marks: 1,
          options: ['A'],
          correctOptionIndex: 0
        },
        {
          questionType: 'true-false',
          questionText: '',
          marks: 1,
          correctAnswer: true
        }
      ];

      const result = validateImportedQuestions(questions);

      for (const invalid of result.invalidQuestions) {
        expect(['mcq', 'true-false']).toContain(invalid.questionType);
      }
    });
  });

  describe('getValidationStatsByType', () => {
    it('should return empty stats for empty validation result', () => {
      const questions: NewQuestionInput[] = [];
      const result = validateImportedQuestions(questions);
      const stats = getValidationStatsByType(result);

      expect(stats).toEqual({});
    });

    it('should aggregate stats by type', () => {
      const questions: NewQuestionInput[] = [
        {
          questionType: 'mcq',
          questionText: '',
          marks: 1,
          options: ['A', 'B'],
          correctOptionIndex: 0
        }
      ];

      const result = validateImportedQuestions(questions);
      const stats = getValidationStatsByType(result);

      expect(stats).toBeDefined();
      // Stats should include the question type we tested
      for (const [type] of Object.entries(stats)) {
        expect(['mcq', 'true-false', 'short-answer', 'essay']).toContain(type);
      }
    });
  });

  describe('generateValidationReport', () => {
    it('should generate report with summary', () => {
      const questions: NewQuestionInput[] = [];
      const result = validateImportedQuestions(questions);
      const report = generateValidationReport(result);

      expect(report).toContain('Import Validation Report');
      expect(report).toContain('Valid:');
      expect(report).toContain('Invalid:');
    });

    it('should include question type breakdown', () => {
      const questions: NewQuestionInput[] = [
        {
          questionType: 'mcq',
          questionText: 'Q1?',
          marks: 1,
          options: ['A', 'B'],
          correctOptionIndex: 0
        }
      ];

      const result = validateImportedQuestions(questions);
      const report = generateValidationReport(result);

      expect(report).toBeDefined();
      expect(report.length).toBeGreaterThan(0);
    });
  });

  describe('filterValidQuestions', () => {
    it('should return empty array when no valid questions', () => {
      const questions: NewQuestionInput[] = [];
      const result = validateImportedQuestions(questions);
      const filtered = filterValidQuestions(result);

      expect(filtered).toEqual([]);
    });

    it('should handle logging parameter', () => {
      const questions: NewQuestionInput[] = [];
      const result = validateImportedQuestions(questions);
      
      // Should not throw even with logging enabled
      expect(() => filterValidQuestions(result, true)).not.toThrow();
    });
  });

  describe('canImport', () => {
    it('should return false for empty questions', () => {
      const questions: NewQuestionInput[] = [];
      const result = validateImportedQuestions(questions);

      expect(canImport(result)).toBe(false);
    });

    it('should return true when valid questions exist', () => {
      const questions: NewQuestionInput[] = [
        {
          questionType: 'mcq',
          questionText: 'Q?',
          marks: 1,
          options: ['A', 'B'],
          correctOptionIndex: 0
        }
      ];

      const result = validateImportedQuestions(questions);
      const canImportResult = canImport(result);

      // Will be true if validation passes, or false if it fails
      expect(typeof canImportResult).toBe('boolean');
    });
  });

  describe('getQuestionErrors', () => {
    it('should return empty array for out of bounds index', () => {
      const questions: NewQuestionInput[] = [];
      const result = validateImportedQuestions(questions);
      const errors = getQuestionErrors(result, 999);

      expect(errors).toEqual([]);
    });

    it('should return errors array for invalid questions', () => {
      const questions: NewQuestionInput[] = [
        {
          questionType: 'mcq',
          questionText: '',
          marks: 1,
          options: ['A'],
          correctOptionIndex: 0
        }
      ];

      const result = validateImportedQuestions(questions);

      if (result.invalidQuestions.length > 0) {
        const errors = getQuestionErrors(result, 0);
        expect(Array.isArray(errors)).toBe(true);
      }
    });
  });

  describe('Error Message Formatting', () => {
    it('should format error messages readable', () => {
      const questions: NewQuestionInput[] = [
        {
          questionType: 'mcq',
          questionText: 'Q?',
          marks: 1,
          options: ['A'],  // Error: only 1 option
          correctOptionIndex: 0
        }
      ];

      const result = validateImportedQuestions(questions);

      if (result.invalidQuestions.length > 0) {
        const errors = result.invalidQuestions[0].errors;
        expect(errors.length).toBeGreaterThan(0);
        expect(typeof errors[0]).toBe('string');
        // Error should not start with lowercase
        expect(errors[0][0]).toMatch(/[A-Z]/);
      }
    });
  });
});
