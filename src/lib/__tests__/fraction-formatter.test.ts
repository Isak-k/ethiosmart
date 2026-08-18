/**
 * Tests for Fraction Formatter
 */

import {
  formatFraction,
  formatFractionsInText,
  expressionToLatex,
  getFractionDisplay,
  containsFractions,
  extractFractions,
  isValidFraction,
} from '../fraction-formatter';

describe('Fraction Formatter - Basic Formatting', () => {
  test('should format simple fractions', () => {
    const result = formatFraction('1/2');
    expect(result).toBeDefined();
    expect(result?.simplified).toBe('1/2');
    expect(result?.decimal).toBeCloseTo(0.5);
  });

  test('should simplify fractions', () => {
    const result = formatFraction('2/4');
    expect(result?.simplified).toBe('1/2');
    expect(result?.decimal).toBeCloseTo(0.5);
  });

  test('should handle fractions with spaces', () => {
    const result = formatFraction('1 / 2');
    expect(result?.simplified).toBe('1/2');
  });

  test('should handle negative fractions', () => {
    const result = formatFraction('-1/2');
    expect(result?.simplified).toBe('-1/2');
    expect(result?.decimal).toBeCloseTo(-0.5);
  });

  test('should generate LaTeX', () => {
    const result = formatFraction('1/2');
    expect(result?.latex).toBe('\\frac{1}{2}');
  });

  test('should provide HTML representation', () => {
    const result = formatFraction('1/2');
    expect(result?.html).toContain('<sup>1</sup>');
    expect(result?.html).toContain('<sub>2</sub>');
  });

  test('should provide Unicode representation', () => {
    const result = formatFraction('1/2');
    expect(result?.unicode).toBe('½');
  });
});

describe('Fraction Formatter - Common Fractions', () => {
  test('should convert 1/2 to ½', () => {
    const result = formatFraction('1/2');
    expect(result?.unicode).toBe('½');
  });

  test('should convert 1/3 to ⅓', () => {
    const result = formatFraction('1/3');
    expect(result?.unicode).toBe('⅓');
  });

  test('should convert 2/3 to ⅔', () => {
    const result = formatFraction('2/3');
    expect(result?.unicode).toBe('⅔');
  });

  test('should convert 1/4 to ¼', () => {
    const result = formatFraction('1/4');
    expect(result?.unicode).toBe('¼');
  });

  test('should convert 3/4 to ¾', () => {
    const result = formatFraction('3/4');
    expect(result?.unicode).toBe('¾');
  });

  test('should convert 1/8 to ⅛', () => {
    const result = formatFraction('1/8');
    expect(result?.unicode).toBe('⅛');
  });

  test('should convert 5/8 to ⅝', () => {
    const result = formatFraction('5/8');
    expect(result?.unicode).toBe('⅝');
  });
});

describe('Fraction Formatter - Text Processing', () => {
  test('should format fractions in text', () => {
    const text = 'What is 1/2 + 1/4?';
    const result = formatFractionsInText(text);
    expect(result).toContain('½');
    expect(result).toContain('¼');
  });

  test('should handle multiple fractions', () => {
    const text = '1/2, 1/3, 1/4, 1/5';
    const result = formatFractionsInText(text);
    expect(result).toContain('½');
    expect(result).toContain('⅓');
  });

  test('should preserve non-fraction text', () => {
    const text = 'Calculate 1/2 + 1/2';
    const result = formatFractionsInText(text);
    expect(result).toContain('Calculate');
  });
});

describe('Fraction Formatter - LaTeX Conversion', () => {
  test('should convert expression to LaTeX', () => {
    const result = expressionToLatex('1/2 + 1/4');
    expect(result).toContain('\\frac{1}{2}');
    expect(result).toContain('\\frac{1}{4}');
  });

  test('should convert operators to LaTeX', () => {
    const result = expressionToLatex('1/2 * 1/2');
    expect(result).toContain('\\times');
  });

  test('should convert powers in LaTeX', () => {
    const result = expressionToLatex('2^3');
    expect(result).toContain('^{3}');
  });
});

describe('Fraction Formatter - Display', () => {
  test('should provide display info', () => {
    const result = getFractionDisplay('1/2');
    expect(result.display).toBe('½');
    expect(result.tooltip).toContain('1/2');
    expect(result.tooltip).toContain('0.5');
  });

  test('should provide LaTeX in display info', () => {
    const result = getFractionDisplay('1/2');
    expect(result.latex).toBe('\\frac{1}{2}');
  });

  test('should handle invalid fractions gracefully', () => {
    const result = getFractionDisplay('invalid');
    expect(result.display).toBe('invalid');
  });
});

describe('Fraction Formatter - Detection', () => {
  test('should detect fractions in text', () => {
    expect(containsFractions('1/2')).toBe(true);
    expect(containsFractions('What is 1/2?')).toBe(true);
    expect(containsFractions('No fractions here')).toBe(false);
  });

  test('should extract all fractions', () => {
    const fractions = extractFractions('1/2 + 1/4 = 3/4');
    expect(fractions).toContain('1/2');
    expect(fractions).toContain('1/4');
    expect(fractions).toContain('3/4');
  });

  test('should extract fractions with spaces', () => {
    const fractions = extractFractions('1 / 2 + 1/4');
    expect(fractions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Fraction Formatter - Validation', () => {
  test('should validate correct fractions', () => {
    expect(isValidFraction('1/2')).toBe(true);
    expect(isValidFraction('3/4')).toBe(true);
    expect(isValidFraction('-1/2')).toBe(true);
  });

  test('should reject invalid fractions', () => {
    expect(isValidFraction('1/')).toBe(false);
    expect(isValidFraction('/2')).toBe(false);
    expect(isValidFraction('1/0')).toBe(false);
    expect(isValidFraction('abc')).toBe(false);
  });
});

describe('Fraction Formatter - Edge Cases', () => {
  test('should handle improper fractions', () => {
    const result = formatFraction('7/4');
    expect(result?.simplified).toBe('7/4');
    expect(result?.decimal).toBeCloseTo(1.75);
  });

  test('should handle whole numbers as fractions', () => {
    const result = formatFraction('4/2');
    expect(result?.simplified).toBe('2/1');
    expect(result?.decimal).toBe(2);
  });

  test('should handle large fractions', () => {
    const result = formatFraction('100/200');
    expect(result?.simplified).toBe('1/2');
  });

  test('should handle negative denominators', () => {
    const result = formatFraction('1/-2');
    expect(result?.simplified).toBe('-1/2');
  });
});
