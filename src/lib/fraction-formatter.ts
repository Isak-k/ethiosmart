/**
 * Fraction Formatter
 * Converts standard fraction notation (1/2, 3/4, etc.) to formatted display
 * Provides LaTeX, HTML, and Unicode representations
 */

export interface FractionFormat {
  original: string; // "1/2"
  simplified: string; // "1/2" or "2/4" -> "1/2"
  decimal: number; // 0.5
  latex: string; // "\frac{1}{2}"
  unicode: string; // "½"
  html: string; // "<sup>1</sup>/<sub>2</sub>"
  display: string; // "1/2" (fallback)
}

/**
 * Parse a fraction string into numerator and denominator
 */
function parseFraction(fraction: string): { numerator: number; denominator: number } | null {
  const match = fraction.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  return {
    numerator: parseInt(match[1]),
    denominator: parseInt(match[2])
  };
}

/**
 * Calculate GCD for simplification
 */
function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/**
 * Simplify a fraction
 */
function simplifyFraction(numerator: number, denominator: number): { numerator: number; denominator: number } {
  if (denominator === 0) return { numerator, denominator };
  const divisor = gcd(numerator, denominator);
  let num = numerator / divisor;
  let den = denominator / divisor;
  if (den < 0) {
    num = -num;
    den = -den;
  }
  return { numerator: num, denominator: den };
}

/**
 * Convert number to Unicode superscript
 */
function toSuperscript(num: string): string {
  const map: { [key: string]: string } = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻'
  };
  return num.split('').map(c => map[c] || c).join('');
}

/**
 * Convert number to Unicode subscript
 */
function toSubscript(num: string): string {
  const map: { [key: string]: string } = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '-': '₋'
  };
  return num.split('').map(c => map[c] || c).join('');
}

/**
 * Get Unicode fraction representation
 */
function getUnicodeFraction(numerator: number, denominator: number): string {
  // Common Unicode fractions
  const unicodeFractions: { [key: string]: string } = {
    '1/2': '½',
    '1/3': '⅓',
    '2/3': '⅔',
    '1/4': '¼',
    '3/4': '¾',
    '1/5': '⅕',
    '2/5': '⅖',
    '3/5': '⅗',
    '4/5': '⅘',
    '1/6': '⅙',
    '5/6': '⅚',
    '1/8': '⅛',
    '3/8': '⅜',
    '5/8': '⅝',
    '7/8': '⅞',
  };

  const key = `${numerator}/${denominator}`;
  return unicodeFractions[key] || null;
}

/**
 * Format a fraction string to various representations
 */
export function formatFraction(fractionString: string): FractionFormat | null {
  const parsed = parseFraction(fractionString.trim());
  if (!parsed) return null;

  const { numerator: origNum, denominator: origDen } = parsed;
  if (origDen === 0) return null;

  const { numerator: simNum, denominator: simDen } = simplifyFraction(origNum, origDen);
  const decimal = simNum / simDen;
  const unicode = getUnicodeFraction(simNum, simDen);

  return {
    original: fractionString,
    simplified: `${simNum}/${simDen}`,
    decimal,
    latex: `\\frac{${simNum}}{${simDen}}`,
    unicode: unicode || `${simNum}/${simDen}`,
    html: `<sup>${simNum}</sup>/<sub>${simDen}</sub>`,
    display: unicode || `${simNum}/${simDen}`
  };
}

/**
 * Format multiple fractions in text
 */
export function formatFractionsInText(text: string): string {
  // Find all fractions in format n/d
  return text.replace(/(\d+)\s*\/\s*(\d+)/g, (match, num, den) => {
    const formatted = formatFraction(`${num}/${den}`);
    return formatted ? formatted.display : match;
  });
}

/**
 * Convert expression to LaTeX with formatted fractions
 */
export function expressionToLatex(expression: string): string {
  // Replace fractions with LaTeX equivalents
  let result = expression.replace(/(\d+)\s*\/\s*(\d+)/g, (match, num, den) => {
    const formatted = formatFraction(`${num}/${den}`);
    return formatted ? formatted.latex : match;
  });

  // Replace operators
  result = result.replace(/\*/g, '\\times');
  result = result.replace(/÷/g, '\\div');
  result = result.replace(/\^(\d+)/g, '^{$1}');

  return result;
}

/**
 * Get fraction display for UI
 */
export function getFractionDisplay(fractionString: string): {
  display: string;
  tooltip: string;
  latex: string;
} {
  const formatted = formatFraction(fractionString);
  if (!formatted) {
    return {
      display: fractionString,
      tooltip: fractionString,
      latex: fractionString
    };
  }

  return {
    display: formatted.display,
    tooltip: `${formatted.simplified} = ${formatted.decimal.toFixed(4)}`,
    latex: formatted.latex
  };
}

/**
 * Check if string contains fractions
 */
export function containsFractions(text: string): boolean {
  return /\d+\s*\/\s*\d+/.test(text);
}

/**
 * Get all fractions from text
 */
export function extractFractions(text: string): string[] {
  const fractions: string[] = [];
  const regex = /(\d+)\s*\/\s*(\d+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    fractions.push(match[0]);
  }

  return fractions;
}

/**
 * Verify fraction is valid
 */
export function isValidFraction(text: string): boolean {
  const parsed = parseFraction(text.trim());
  return parsed !== null && parsed.denominator !== 0;
}
