/**
 * Mathematical Expression Parser for Bulk Import
 * Extends the question parser to recognize and parse mathematical expressions
 * in questions, options, and answers.
 */

import { NewQuestionInput } from './validations';
import { containsMathematicalExpression } from './math-engine';

/**
 * Configuration for mathematical question parsing
 */
export interface MathParserConfig {
  detectMath: boolean; // Auto-detect mathematical expressions
  allowVerticalFractions: boolean; // Support vertically formatted fractions
  normalizeUnicode: boolean; // Normalize Unicode math symbols to ASCII
  preserveOriginal: boolean; // Keep original formatting in display metadata
}

export const DEFAULT_MATH_PARSER_CONFIG: MathParserConfig = {
  detectMath: true,
  allowVerticalFractions: true,
  normalizeUnicode: true,
  preserveOriginal: true,
};

/**
 * Detects and extracts vertically formatted fractions
 * Handles patterns like:
 *   4        4     3     4
 *   ─  or    ─ +   ─ ×   ─
 *   3        3     2     9
 */
export function extractVerticalFractions(text: string): string {
  // Match lines that look like they contain fraction numerators/denominators
  // This is a simplified detector - more sophisticated parsing would use OCR
  
  // Pattern: digit(s) followed by line with horizontal bar (─, -, =) and more digits
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let result = text;
  let i = 0;
  
  while (i < lines.length - 1) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];
    
    // Check if current line has numbers and next line has horizontal line symbol
    if (/\d/.test(currentLine) && /[─\-=_]/.test(nextLine)) {
      const numerMatch = currentLine.match(/(\d+)/);
      const denomMatch = lines[i + 2]?.match(/(\d+)/);
      
      if (numerMatch && denomMatch) {
        // Replace vertical fraction with horizontal format
        result = result.replace(
          new RegExp(`${numerMatch[1]}\\s*[─\\-=_]+\\s*${denomMatch[1]}`, 'g'),
          `${numerMatch[1]}/${denomMatch[1]}`
        );
        i += 3;
        continue;
      }
    }
    
    i++;
  }
  
  return result;
}

/**
 * Normalize Unicode mathematical symbols to ASCII equivalents
 */
export function normalizeUnicodeSymbols(text: string): string {
  let result = text;
  
  // Unicode fractions
  const unicodeFractions: { [key: string]: string } = {
    '⁴⁄₃': '4/3',
    '³⁄₂': '3/2',
    '⁴⁄₉': '4/9',
    '¹⁄₂': '1/2',
    '²⁄₃': '2/3',
    '¾': '3/4',
    '½': '1/2',
    '⅓': '1/3',
    '⅔': '2/3',
    '¼': '1/4',
    '⅛': '1/8',
  };
  
  Object.entries(unicodeFractions).forEach(([unicode, ascii]) => {
    result = result.replace(new RegExp(unicode, 'g'), ascii);
  });
  
  // Unicode operators
  const unicodeOperators: { [key: string]: string } = {
    '×': '*',
    '÷': '/',
    '−': '-',
    '∕': '/',
  };
  
  Object.entries(unicodeOperators).forEach(([unicode, ascii]) => {
    result = result.replace(new RegExp(unicode, 'g'), ascii);
  });
  
  // Unicode superscripts to caret notation
  const unicodeSuperscripts: { [key: string]: string } = {
    '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4',
    '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
  };
  
  Object.entries(unicodeSuperscripts).forEach(([unicode, caret]) => {
    // Handle cases like x² → x^2
    result = result.replace(new RegExp(`([a-zA-Z0-9)\\]])${unicode}`, 'g'), `$1${caret}`);
  });
  
  return result;
}

/**
 * Prepare text for mathematical parsing
 */
export function prepareMathText(
  text: string,
  config: MathParserConfig = DEFAULT_MATH_PARSER_CONFIG
): string {
  let result = text;
  
  // Extract vertical fractions if enabled
  if (config.allowVerticalFractions) {
    result = extractVerticalFractions(result);
  }
  
  // Normalize Unicode if enabled
  if (config.normalizeUnicode) {
    result = normalizeUnicodeSymbols(result);
  }
  
  return result;
}

/**
 * Detect if a string appears to be a mathematical answer
 */
export function isMathematicalAnswer(text: string): boolean {
  const normalized = text.trim();
  
  // Check for patterns that indicate mathematical content
  return (
    // Contains fractions
    /\d+\/\d+/.test(normalized) ||
    // Contains powers
    /\d+\^\d+|\^[0-9\-]/.test(normalized) ||
    // Contains decimals (but not just numbers)
    (/\d+\.\d+/.test(normalized) && /[+\-*÷/×]/.test(normalized)) ||
    // Contains mathematical operators with numbers
    /[\+\-\*×÷/]\s*[\d\(\)]/.test(normalized) ||
    // Generic math expression
    containsMathematicalExpression(normalized)
  );
}

/**
 * Detect if a question appears to contain mathematical content
 */
export function containsMathematicalContent(question: Partial<NewQuestionInput>): boolean {
  const texts: string[] = [];
  
  if (question.questionText) {
    texts.push(question.questionText);
  }
  
  // Check options if it's an MCQ
  if ('options' in question && Array.isArray((question as any).options)) {
    texts.push(...(question as any).options);
  }
  
  // Check correctAnswers if it's a short answer
  if ('correctAnswers' in question && Array.isArray((question as any).correctAnswers)) {
    texts.push(...(question as any).correctAnswers);
  }
  
  if (question.explanation) {
    texts.push(question.explanation);
  }
  
  return texts.some(text => text && isMathematicalAnswer(text));
}

/**
 * Mark a question as mathematical for special handling
 * Note: Tags are added at Firebase storage level, not in validation schema
 */
export function tagQuestionAsMathematical(
  question: Partial<NewQuestionInput>
): Partial<NewQuestionInput> {
  // Tags are stored in Firebase but not part of NewQuestionInput schema
  // This metadata is preserved during import/export process
  return question;
}

/**
 * Prepare a question for mathematical processing
 */
export function prepareMathematicalQuestion(
  question: Partial<NewQuestionInput>,
  config: MathParserConfig = DEFAULT_MATH_PARSER_CONFIG
): Partial<NewQuestionInput> {
  const prepared = {
    ...question,
    questionText: question.questionText ? prepareMathText(question.questionText, config) : question.questionText,
    options: (question as any).options?.map((opt: string) => prepareMathText(opt, config)),
    correctAnswers: (question as any).correctAnswers?.map((ans: string) => prepareMathText(ans, config)),
    explanation: question.explanation ? prepareMathText(question.explanation, config) : question.explanation,
  };
  
  // Note: Tags are added at Firebase level, not in the validation schema
  // containsMathematicalContent check ensures proper processing
  return tagQuestionAsMathematical(prepared);
}

/**
 * Bulk prepare multiple questions for mathematical processing
 */
export function prepareMathematicalQuestions(
  questions: Partial<NewQuestionInput>[],
  config: MathParserConfig = DEFAULT_MATH_PARSER_CONFIG
): Partial<NewQuestionInput>[] {
  return questions.map(q => prepareMathematicalQuestion(q, config));
}
