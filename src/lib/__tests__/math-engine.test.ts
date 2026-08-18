/**
 * Tests for Mathematical Expression Engine
 * Covers parsing, evaluation, and equivalence checking
 */

import {
  evaluateMathExpression,
  areMathExpressionsEquivalent,
  isStudentMathAnswerCorrect,
  containsMathematicalExpression,
  toLatex,
} from '../math-engine';

describe('Math Engine - Basic Numbers', () => {
  test('should evaluate whole numbers', () => {
    expect(evaluateMathExpression('5')).toMatchObject({ decimal: 5 });
    expect(evaluateMathExpression('42')).toMatchObject({ decimal: 42 });
  });

  test('should evaluate decimals', () => {
    const result = evaluateMathExpression('0.5');
    expect(result.decimal).toBeCloseTo(0.5);
  });

  test('should evaluate negative numbers', () => {
    expect(evaluateMathExpression('-5')).toMatchObject({ decimal: -5 });
    expect(evaluateMathExpression('-0.5')).toMatchObject({ decimal: expect.closeTo(-0.5) });
  });
});

describe('Math Engine - Fractions', () => {
  test('should parse and evaluate simple fractions', () => {
    const result = evaluateMathExpression('1/2');
    expect(result.decimal).toBeCloseTo(0.5);
    expect(result.displayText).toBe('1/2');
  });

  test('should normalize fractions to lowest terms', () => {
    const result = evaluateMathExpression('2/4');
    expect(result.displayText).toBe('1/2');
    expect(result.decimal).toBeCloseTo(0.5);
  });

  test('should handle improper fractions', () => {
    const result = evaluateMathExpression('7/4');
    expect(result.decimal).toBeCloseTo(1.75);
    expect(result.displayText).toBe('7/4');
  });

  test('should handle negative fractions', () => {
    const result = evaluateMathExpression('-3/5');
    expect(result.decimal).toBeCloseTo(-0.6);
    expect(result.displayText).toBe('-3/5');
  });

  test('should recognize equivalent fractions', () => {
    expect(areMathExpressionsEquivalent('1/2', '2/4')).toBe(true);
    expect(areMathExpressionsEquivalent('1/2', '0.5')).toBe(true);
    expect(areMathExpressionsEquivalent('3/4', '6/8')).toBe(true);
  });
});

describe('Math Engine - Decimal Operations', () => {
  test('should evaluate decimal addition', () => {
    const result = evaluateMathExpression('2.5 + 3.75');
    expect(result.decimal).toBeCloseTo(6.25);
  });

  test('should evaluate decimal subtraction', () => {
    const result = evaluateMathExpression('5.5 - 2.25');
    expect(result.decimal).toBeCloseTo(3.25);
  });

  test('should evaluate decimal multiplication', () => {
    const result = evaluateMathExpression('1.5 * 0.4');
    expect(result.decimal).toBeCloseTo(0.6);
  });

  test('should evaluate decimal division', () => {
    const result = evaluateMathExpression('6.25 / 2.5');
    expect(result.decimal).toBeCloseTo(2.5);
  });
});

describe('Math Engine - Four Basic Operations', () => {
  test('should evaluate addition', () => {
    const result = evaluateMathExpression('3/4 + 2/5');
    // 3/4 + 2/5 = 15/20 + 8/20 = 23/20 = 1.15
    expect(result.decimal).toBeCloseTo(1.15);
  });

  test('should evaluate subtraction', () => {
    const result = evaluateMathExpression('5/6 - 1/3');
    // 5/6 - 1/3 = 5/6 - 2/6 = 3/6 = 1/2
    expect(result.decimal).toBeCloseTo(0.5);
  });

  test('should evaluate multiplication', () => {
    const result = evaluateMathExpression('2/3 * 3/5');
    // 2/3 * 3/5 = 6/15 = 2/5 = 0.4
    expect(result.decimal).toBeCloseTo(0.4);
  });

  test('should evaluate division', () => {
    const result = evaluateMathExpression('4/5 / 2/3');
    // 4/5 ÷ 2/3 = 4/5 * 3/2 = 12/10 = 6/5 = 1.2
    expect(result.decimal).toBeCloseTo(1.2);
  });

  test('should support Unicode operators', () => {
    expect(areMathExpressionsEquivalent('3/4 × 2/5', '3/4 * 2/5')).toBe(true);
    expect(areMathExpressionsEquivalent('4/5 ÷ 2/3', '4/5 / 2/3')).toBe(true);
  });
});

describe('Math Engine - Order of Operations', () => {
  test('should follow PEMDAS - multiplication before addition', () => {
    const result = evaluateMathExpression('4/3 + 3/2 * 4/9');
    // Should be: 4/3 + (3/2 * 4/9) = 4/3 + 12/18 = 4/3 + 2/3 = 6/3 = 2
    expect(result.decimal).toBeCloseTo(2);
  });

  test('should follow PEMDAS - parentheses first', () => {
    const result = evaluateMathExpression('(2 + 3) * 4');
    expect(result.decimal).toBeCloseTo(20);
  });

  test('should follow PEMDAS - left to right for same precedence', () => {
    const result = evaluateMathExpression('10 - 5 - 2');
    // Should be (10 - 5) - 2 = 3, not 10 - (5 - 2) = 7
    expect(result.decimal).toBeCloseTo(3);
  });

  test('should handle complex mixed operations', () => {
    const result = evaluateMathExpression('2/3 * (4/5 + 1/2)');
    // 4/5 + 1/2 = 8/10 + 5/10 = 13/10
    // 2/3 * 13/10 = 26/30 = 13/15 ≈ 0.867
    expect(result.decimal).toBeCloseTo(0.867, 1);
  });
});

describe('Math Engine - Powers and Exponents', () => {
  test('should evaluate simple powers', () => {
    expect(evaluateMathExpression('2^3').decimal).toBeCloseTo(8);
    expect(evaluateMathExpression('5^2').decimal).toBeCloseTo(25);
    expect(evaluateMathExpression('10^4').decimal).toBeCloseTo(10000);
  });

  test('should evaluate powers with fractions', () => {
    const result = evaluateMathExpression('(3/4)^2');
    // (3/4)^2 = 9/16 = 0.5625
    expect(result.decimal).toBeCloseTo(0.5625);
  });

  test('should evaluate negative powers', () => {
    const result = evaluateMathExpression('2^-3');
    // 2^-3 = 1/8 = 0.125
    expect(result.decimal).toBeCloseTo(0.125);
  });

  test('should evaluate power expressions with operations', () => {
    const result = evaluateMathExpression('2^3 + 4');
    // 8 + 4 = 12
    expect(result.decimal).toBeCloseTo(12);
  });

  test('should handle Unicode superscripts', () => {
    // x² → x^2
    expect(areMathExpressionsEquivalent('2²', '2^2')).toBe(true);
    expect(areMathExpressionsEquivalent('3³', '3^3')).toBe(true);
  });
});

describe('Math Engine - Parentheses', () => {
  test('should handle simple parentheses', () => {
    expect(evaluateMathExpression('(2 + 3) * 4').decimal).toBeCloseTo(20);
    expect(evaluateMathExpression('(5 - 2) * 3').decimal).toBeCloseTo(9);
  });

  test('should handle nested parentheses', () => {
    const result = evaluateMathExpression('2 * ((3 + 4) / 7)');
    // (3 + 4) = 7, 7/7 = 1, 2 * 1 = 2
    expect(result.decimal).toBeCloseTo(2);
  });

  test('should handle parentheses with fractions', () => {
    const result = evaluateMathExpression('(3/4 + 1/2) * 2');
    // 3/4 + 1/2 = 5/4, 5/4 * 2 = 10/4 = 2.5
    expect(result.decimal).toBeCloseTo(2.5);
  });
});

describe('Math Engine - Equivalence Checking', () => {
  test('should recognize mathematically equivalent expressions', () => {
    expect(areMathExpressionsEquivalent('1/2', '2/4')).toBe(true);
    expect(areMathExpressionsEquivalent('1/2', '0.5')).toBe(true);
    expect(areMathExpressionsEquivalent('3/4', '0.75')).toBe(true);
  });

  test('should recognize different expressions as not equivalent', () => {
    expect(areMathExpressionsEquivalent('1/2', '1/3')).toBe(false);
    expect(areMathExpressionsEquivalent('0.5', '0.6')).toBe(false);
  });

  test('should handle complex equivalent expressions', () => {
    expect(areMathExpressionsEquivalent('3/2 + 1/2', '2')).toBe(true);
    expect(areMathExpressionsEquivalent('2^3', '8')).toBe(true);
  });

  test('should use tolerance for floating-point comparison', () => {
    expect(areMathExpressionsEquivalent('0.3333333', '1/3', 0.0001)).toBe(true);
  });
});

describe('Math Engine - Student Answers', () => {
  test('should recognize correct mathematical answers', () => {
    expect(isStudentMathAnswerCorrect('1/2', ['1/2'])).toBe(true);
    expect(isStudentMathAnswerCorrect('2/4', ['1/2'])).toBe(true);
    expect(isStudentMathAnswerCorrect('0.5', ['1/2'])).toBe(true);
  });

  test('should recognize incorrect answers', () => {
    expect(isStudentMathAnswerCorrect('1/3', ['1/2'])).toBe(false);
    expect(isStudentMathAnswerCorrect('0.6', ['0.5'])).toBe(false);
  });

  test('should handle multiple correct answers', () => {
    expect(isStudentMathAnswerCorrect('1/2', ['2/4', '0.5', '4/8'])).toBe(true);
    expect(isStudentMathAnswerCorrect('0.5', ['1/2', '2/4'])).toBe(true);
  });

  test('should handle empty or blank answers', () => {
    expect(isStudentMathAnswerCorrect('', ['1/2'])).toBe(false);
    expect(isStudentMathAnswerCorrect('  ', ['1/2'])).toBe(false);
  });
});

describe('Math Engine - Expression Detection', () => {
  test('should detect mathematical expressions', () => {
    expect(containsMathematicalExpression('1/2')).toBe(true);
    expect(containsMathematicalExpression('2^3')).toBe(true);
    expect(containsMathematicalExpression('3/4 + 1/2')).toBe(true);
    expect(containsMathematicalExpression('0.5 * 2')).toBe(true);
  });

  test('should not detect non-mathematical text', () => {
    expect(containsMathematicalExpression('Hello world')).toBe(false);
    expect(containsMathematicalExpression('1234567')).toBe(true); // Numbers are mathematical
  });
});

describe('Math Engine - LaTeX Conversion', () => {
  test('should convert expressions to LaTeX', () => {
    const latex = toLatex('1/2');
    expect(latex).toContain('\\frac');
  });

  test('should handle LaTeX for fractions', () => {
    const result = evaluateMathExpression('1/2');
    expect(result.latex).toContain('\\frac');
  });
});

describe('Math Engine - Error Handling', () => {
  test('should throw error for division by zero', () => {
    expect(() => evaluateMathExpression('1/0')).toThrow();
    expect(() => evaluateMathExpression('5 / 0')).toThrow();
  });

  test('should throw error for invalid expressions', () => {
    expect(() => evaluateMathExpression('(')).toThrow();
    expect(() => evaluateMathExpression('1 +* 2')).toThrow();
  });
});
