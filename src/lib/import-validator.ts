/**
 * Import Validator
 * Validates bulk imported questions with detailed per-question error reporting
 */

import { NewQuestionInput } from './validations';
import { validateQuestionBeforeSave } from './question-validator';

export interface ImportValidationError {
  index: number; // Row number in import data (0-indexed)
  displayIndex: number; // Human-readable index (1-indexed)
  questionText?: string; // Preview of question
  questionType: string; // Question type
  errors: string[]; // Array of specific field errors
}

export interface ImportValidationResult {
  valid: boolean;
  validQuestions: NewQuestionInput[];
  invalidQuestions: ImportValidationError[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
}

/**
 * Validate all imported questions
 * Returns both valid questions and detailed error information for invalid ones
 */
export function validateImportedQuestions(
  questions: NewQuestionInput[]
): ImportValidationResult {
  const validQuestions: NewQuestionInput[] = [];
  const invalidQuestions: ImportValidationError[] = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const result = validateQuestionBeforeSave(question);

    if (result.valid) {
      validQuestions.push(question);
    } else {
      const errors = result.errors || [];
      const errorMessages = errors.map(err => {
        // Format error message for display
        return formatErrorMessage(err.field, err.message, question.questionType);
      });

      invalidQuestions.push({
        index: i,
        displayIndex: i + 1,
        questionText: question.questionText,
        questionType: question.questionType,
        errors: errorMessages
      });
    }
  }

  return {
    valid: invalidQuestions.length === 0,
    validQuestions,
    invalidQuestions,
    summary: {
      total: questions.length,
      valid: validQuestions.length,
      invalid: invalidQuestions.length
    }
  };
}

/**
 * Format validation error message for user display
 */
function formatErrorMessage(field: string, message: string, questionType: string): string {
  // Clean up field name
  const fieldName = field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  // Provide contextual help for common errors
  const context = getErrorContext(field, questionType);
  const contextHelp = context ? ` ${context}` : '';

  return `${fieldName}: ${message}${contextHelp}`;
}

/**
 * Provide helpful context for specific validation errors
 */
function getErrorContext(field: string, questionType: string): string {
  const fieldLower = field.toLowerCase();

  // Common contextual help
  if (fieldLower.includes('option') && questionType === 'mcq') {
    return '(MCQ must have 2-6 options)';
  }
  if (fieldLower === 'correctanswers' && questionType === 'short-answer') {
    return '(At least 1 acceptable answer required)';
  }
  if (fieldLower === 'correctanswerindex' && questionType === 'mcq') {
    return '(Must match an option number)';
  }
  if (fieldLower === 'marks') {
    return '(Must be 1-100)';
  }
  if (fieldLower === 'minwords' || fieldLower === 'maxwords') {
    return '(Max words must be >= Min words)';
  }

  return '';
}

/**
 * Get count of valid/invalid questions by type
 */
export function getValidationStatsByType(result: ImportValidationResult): {
  [questionType: string]: { total: number; valid: number; invalid: number };
} {
  const stats: {
    [questionType: string]: { total: number; valid: number; invalid: number };
  } = {};

  // Count valid
  for (const question of result.validQuestions) {
    if (!stats[question.questionType]) {
      stats[question.questionType] = { total: 0, valid: 0, invalid: 0 };
    }
    stats[question.questionType].total++;
    stats[question.questionType].valid++;
  }

  // Count invalid
  for (const invalid of result.invalidQuestions) {
    if (!stats[invalid.questionType]) {
      stats[invalid.questionType] = { total: 0, valid: 0, invalid: 0 };
    }
    stats[invalid.questionType].total++;
    stats[invalid.questionType].invalid++;
  }

  return stats;
}

/**
 * Generate human-readable validation report
 */
export function generateValidationReport(result: ImportValidationResult): string {
  let report = '';

  report += `\n📊 Import Validation Report\n`;
  report += `${'='.repeat(50)}\n\n`;

  // Summary
  report += `✅ Valid: ${result.summary.valid}/${result.summary.total}\n`;
  report += `❌ Invalid: ${result.summary.invalid}/${result.summary.total}\n\n`;

  // By type
  const stats = getValidationStatsByType(result);
  if (Object.keys(stats).length > 0) {
    report += `By Question Type:\n`;
    for (const [type, counts] of Object.entries(stats)) {
      report += `  • ${type}: ${counts.valid} valid, ${counts.invalid} invalid\n`;
    }
    report += '\n';
  }

  // Invalid details
  if (result.invalidQuestions.length > 0) {
    report += `Invalid Questions:\n`;
    report += `${'-'.repeat(50)}\n`;
    for (const invalid of result.invalidQuestions.slice(0, 10)) {
      report += `\nQuestion ${invalid.displayIndex} (${invalid.questionType}):\n`;
      if (invalid.questionText) {
        report += `  Text: "${invalid.questionText.substring(0, 50)}..."\n`;
      }
      report += `  Issues:\n`;
      for (const error of invalid.errors) {
        report += `    - ${error}\n`;
      }
    }

    if (result.invalidQuestions.length > 10) {
      report += `\n... and ${result.invalidQuestions.length - 10} more invalid questions\n`;
    }
  }

  return report;
}

/**
 * Filter questions to return only valid ones
 * Optionally log which questions are being skipped
 */
export function filterValidQuestions(
  result: ImportValidationResult,
  logSkipped = false
): NewQuestionInput[] {
  if (logSkipped && result.invalidQuestions.length > 0) {
    console.warn('Skipping invalid questions:');
    result.invalidQuestions.forEach(invalid => {
      console.warn(`  Question ${invalid.displayIndex}: ${invalid.errors.join(', ')}`);
    });
  }

  return result.validQuestions;
}

/**
 * Check if any questions can be imported
 */
export function canImport(result: ImportValidationResult): boolean {
  return result.validQuestions.length > 0;
}

/**
 * Get detailed error for a specific question
 */
export function getQuestionErrors(
  result: ImportValidationResult,
  questionIndex: number
): string[] {
  const invalid = result.invalidQuestions.find(q => q.index === questionIndex);
  return invalid ? invalid.errors : [];
}
