/**
 * Tests for Mathematical Parser
 * Tests extraction, normalization, and preparation of mathematical questions
 */

import {
  extractVerticalFractions,
  normalizeUnicodeSymbols,
  prepareMathText,
  isMathematicalAnswer,
  containsMathematicalContent,
  prepareMathematicalQuestion,
} from '../math-parser';

describe('Math Parser - Vertical Fraction Extraction', () => {
  test('should extract simple vertical fractions', () => {
    const text = `4
    ─
    3`;
    const result = extractVerticalFractions(text);
    expect(result).toContain('4/3');
  });

  test('should preserve non-fraction content', () => {
    const text = 'Calculate: 4 ÷ 3';
    const result = extractVerticalFractions(text);
    expect(result).toContain('Calculate');
  });

  test('should handle multiple vertical fractions', () => {
    const text = `4     3     4
    ─ +   ─ ×   ─
    3     2     9`;
    const result = extractVerticalFractions(text);
    // Should preserve or convert fractions
    expect(result).toBeTruthy();
  });
});

describe('Math Parser - Unicode Symbol Normalization', () => {
  test('should normalize Unicode fractions', () => {
    expect(normalizeUnicodeSymbols('⁴⁄₃')).toBe('4/3');
    expect(normalizeUnicodeSymbols('³⁄₂')).toBe('3/2');
    expect(normalizeUnicodeSymbols('⁴⁄₉')).toBe('4/9');
  });

  test('should normalize common Unicode fractions', () => {
    expect(normalizeUnicodeSymbols('¾')).toBe('3/4');
    expect(normalizeUnicodeSymbols('½')).toBe('1/2');
    expect(normalizeUnicodeSymbols('¼')).toBe('1/4');
  });

  test('should normalize Unicode operators', () => {
    expect(normalizeUnicodeSymbols('3 × 4')).toBe('3 * 4');
    expect(normalizeUnicodeSymbols('3 ÷ 4')).toBe('3 / 4');
    expect(normalizeUnicodeSymbols('5 − 2')).toBe('5 - 2');
  });

  test('should normalize Unicode superscripts', () => {
    expect(normalizeUnicodeSymbols('2²')).toBe('2^2');
    expect(normalizeUnicodeSymbols('3³')).toBe('3^3');
    expect(normalizeUnicodeSymbols('x⁴')).toBe('x^4');
  });

  test('should handle mixed Unicode content', () => {
    const input = '(3⁄4)² × 2';
    const result = normalizeUnicodeSymbols(input);
    expect(result).toContain('3/4');
    expect(result).toContain('^2');
    expect(result).toContain('*');
  });

  test('should preserve non-Unicode content', () => {
    const result = normalizeUnicodeSymbols('Calculate 2 + 3');
    expect(result).toContain('Calculate');
    expect(result).toContain('2');
    expect(result).toContain('3');
  });
});

describe('Math Parser - Text Preparation', () => {
  test('should prepare text with all normalizations', () => {
    const text = 'Calculate: (3⁄4)² × 2';
    const result = prepareMathText(text);
    expect(result).toContain('3/4');
    expect(result).toContain('^2');
  });

  test('should handle optional normalizations', () => {
    const text = 'Result: ¾ × 2';
    const resultWithNormalization = prepareMathText(text, {
      detectMath: true,
      allowVerticalFractions: true,
      normalizeUnicode: true,
      preserveOriginal: true,
    });
    expect(resultWithNormalization).toContain('3/4');

    const resultWithoutNormalization = prepareMathText(text, {
      detectMath: true,
      allowVerticalFractions: false,
      normalizeUnicode: false,
      preserveOriginal: true,
    });
    expect(resultWithoutNormalization).toContain('¾');
  });
});

describe('Math Parser - Answer Detection', () => {
  test('should detect fraction answers', () => {
    expect(isMathematicalAnswer('1/2')).toBe(true);
    expect(isMathematicalAnswer('3/4')).toBe(true);
    expect(isMathematicalAnswer('1/2 + 3/4')).toBe(true);
  });

  test('should detect power answers', () => {
    expect(isMathematicalAnswer('2^3')).toBe(true);
    expect(isMathematicalAnswer('3^2 + 1')).toBe(true);
  });

  test('should detect decimal answers', () => {
    expect(isMathematicalAnswer('0.5 + 0.25')).toBe(true);
    expect(isMathematicalAnswer('1.5 * 2')).toBe(true);
  });

  test('should detect operator-based answers', () => {
    expect(isMathematicalAnswer('3 + 4')).toBe(true);
    expect(isMathematicalAnswer('10 - 5')).toBe(true);
    expect(isMathematicalAnswer('2 * 3')).toBe(true);
  });

  test('should not detect non-mathematical text', () => {
    expect(isMathematicalAnswer('Hello')).toBe(false);
    expect(isMathematicalAnswer('word')).toBe(false);
  });

  test('should handle edge cases', () => {
    expect(isMathematicalAnswer('')).toBe(false);
    expect(isMathematicalAnswer('   ')).toBe(false);
  });
});

describe('Math Parser - Content Detection', () => {
  test('should detect mathematical content in questions', () => {
    const question = {
      questionText: 'What is 3/4 + 1/2?',
      questionType: 'short-answer' as const,
    };
    expect(containsMathematicalContent(question)).toBe(true);
  });

  test('should detect mathematical content in options', () => {
    const question = {
      questionText: 'Choose the answer',
      options: ['1/2', '3/4'],
      questionType: 'mcq' as const,
    };
    expect(containsMathematicalContent(question)).toBe(true);
  });

  test('should detect mathematical content in answers', () => {
    const question = {
      questionText: 'What is the result?',
      correctAnswers: ['1/2', '0.5'],
      questionType: 'short-answer' as const,
    };
    expect(containsMathematicalContent(question)).toBe(true);
  });

  test('should return false for non-mathematical questions', () => {
    const question = {
      questionText: 'What is the capital of France?',
      options: ['Paris', 'London', 'Berlin'],
      questionType: 'mcq' as const,
    };
    expect(containsMathematicalContent(question)).toBe(false);
  });
});

describe('Math Parser - Question Preparation', () => {
  test('should prepare mathematical question', () => {
    const question = {
      questionText: 'Calculate: (3⁄4)²',
      questionType: 'short-answer' as const,
      correctAnswers: ['9/16'],
    };
    const result = prepareMathematicalQuestion(question);
    expect(result.questionText).toContain('3/4');
    expect(result.tags).toContain('mathematical');
  });

  test('should preserve existing tags', () => {
    const question = {
      questionText: 'What is 1/2 + 1/4?',
      questionType: 'short-answer' as const,
      correctAnswers: ['3/4'],
      tags: ['algebra', 'fractions'],
    };
    const result = prepareMathematicalQuestion(question);
    expect(result.tags).toContain('algebra');
    expect(result.tags).toContain('fractions');
    expect(result.tags).toContain('mathematical');
  });

  test('should not duplicate mathematical tag', () => {
    const question = {
      questionText: 'What is 2^3?',
      questionType: 'short-answer' as const,
      correctAnswers: ['8'],
      tags: ['mathematical'],
    };
    const result = prepareMathematicalQuestion(question);
    const mathTags = result.tags?.filter(t => t === 'mathematical') || [];
    expect(mathTags).toHaveLength(1);
  });

  test('should handle MCQ questions with mathematical options', () => {
    const question = {
      questionText: 'What is 1/2 + 1/4?',
      questionType: 'mcq' as const,
      options: ['1/4', '3/4', '1/2', '5/4'],
      correctOptionIndex: 1,
    };
    const result = prepareMathematicalQuestion(question);
    expect(result.tags).toContain('mathematical');
  });

  test('should prepare multiple questions', () => {
    const questions = [
      {
        questionText: 'What is 1/2?',
        questionType: 'short-answer' as const,
        correctAnswers: ['1/2'],
      },
      {
        questionText: 'What is the capital?',
        questionType: 'short-answer' as const,
        correctAnswers: ['Paris'],
      },
    ];
    const result = (require('../math-parser')).prepareMathematicalQuestions(questions);
    expect(result[0].tags).toContain('mathematical');
    expect(result[1].tags).not.toContain('mathematical');
  });
});

describe('Math Parser - Unicode Handling', () => {
  test('should handle pasted content from Word/Docs', () => {
    // Simulate content from Word that includes Unicode fractions
    const wordContent = 'Calculate: ⁴⁄₃ + ³⁄₂';
    const result = prepareMathText(wordContent);
    expect(result).toContain('4/3');
    expect(result).toContain('3/2');
  });

  test('should handle superscript powers from PDF', () => {
    const pdfContent = 'What is 2² + 3³?';
    const result = prepareMathText(pdfContent);
    expect(result).toContain('2^2');
    expect(result).toContain('3^3');
  });
});
