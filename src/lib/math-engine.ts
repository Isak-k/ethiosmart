/**
 * Mathematical Expression Engine
 * Handles parsing, normalization, evaluation, and equivalence checking
 * for mathematical expressions including fractions, decimals, powers, and operations.
 */

/**
 * Represents a mathematical expression as a rational number or evaluated result
 */
export interface MathValue {
  type: 'rational' | 'decimal' | 'number';
  numerator?: bigint; // For rational numbers
  denominator?: bigint;
  decimal?: number;
  displayText: string; // Original or simplified form
  latex?: string; // LaTeX representation
}

/**
 * Token types for mathematical expression parsing
 */
type TokenType = 'NUMBER' | 'FRACTION' | 'OPERATOR' | 'POWER' | 'LPAREN' | 'RPAREN' | 'EOF' | 'UNICODE_FRAC' | 'DECIMAL';

interface Token {
  type: TokenType;
  value: string | number;
  precedence?: number;
}

/**
 * Abstract Syntax Tree node for mathematical expressions
 */
interface ASTNode {
  type: 'number' | 'fraction' | 'operation' | 'power' | 'sqrt' | 'unary';
  value?: number | bigint;
  numerator?: bigint;
  denominator?: bigint;
  left?: ASTNode;
  right?: ASTNode;
  operator?: '+' | '-' | '*' | '÷' | '/' | '^';
  base?: ASTNode;
  exponent?: ASTNode;
  operand?: ASTNode;
}

/**
 * Normalize a fraction to lowest terms
 */
function gcd(a: bigint, b: bigint): bigint {
  return b === 0n ? a : gcd(b, a % b);
}

function normalizeFraction(numerator: bigint, denominator: bigint): [bigint, bigint] {
  if (denominator === 0n) {
    throw new Error('Division by zero');
  }
  
  const divisor = gcd(numerator < 0n ? -numerator : numerator, denominator < 0n ? -denominator : denominator);
  let num = numerator / divisor;
  let den = denominator / divisor;
  
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  
  return [num, den];
}

/**
 * Tokenize a mathematical expression
 * Supports: fractions (1/2, ⁴⁄₃), decimals (0.5), powers (2^3, x²), operators, parentheses
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const text = input.trim();

  while (i < text.length) {
    const char = text[i];

    // Whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Parentheses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Operators
    if (['+', '-', '×', '*', '÷', '/', '^'].includes(char)) {
      tokens.push({
        type: 'OPERATOR',
        value: char,
        precedence: char === '^' ? 4 : ['+', '-'].includes(char) ? 1 : 2,
      });
      i++;
      continue;
    }

    // Unicode superscript digits (for exponents like x²)
    if (/[\u00B2\u00B3\u00B9\u2070-\u2079]/.test(char)) {
      const superscriptMap: { [key: string]: string } = {
        '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
        '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
      };
      tokens.push({ type: 'POWER', value: superscriptMap[char] || char });
      i++;
      continue;
    }

    // Unicode fractions (⁴⁄₃)
    if (char === '⁄' || text.substring(i, i + 1) === '⁄') {
      tokens.push({ type: 'UNICODE_FRAC', value: '/' });
      i++;
      continue;
    }

    // Numbers (including decimals)
    if (/\d/.test(char)) {
      let numStr = '';
      while (i < text.length && (/\d/.test(text[i]) || text[i] === '.')) {
        numStr += text[i];
        i++;
      }

      if (numStr.includes('.')) {
        tokens.push({ type: 'DECIMAL', value: parseFloat(numStr) });
      } else {
        // Check if next char is / for fraction
        if (i < text.length && text[i] === '/') {
          tokens.push({ type: 'FRACTION', value: numStr });
          i++; // consume /
          let denomStr = '';
          while (i < text.length && /\d/.test(text[i])) {
            denomStr += text[i];
            i++;
          }
          if (denomStr) {
            tokens.push({ type: 'FRACTION', value: denomStr });
          }
        } else {
          tokens.push({ type: 'NUMBER', value: parseInt(numStr) });
        }
      }
      continue;
    }

    i++;
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

/**
 * Parse tokens into an AST using recursive descent parser
 */
class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  parse(): ASTNode {
    return this.parseAddition();
  }

  private parseAddition(): ASTNode {
    let left = this.parseMultiplication();

    while (this.peek().type === 'OPERATOR' && ['+', '-'].includes(this.peek().value as string)) {
      const op = this.consume().value as string;
      const right = this.parseMultiplication();
      left = { type: 'operation', operator: op as '+' | '-', left, right };
    }

    return left;
  }

  private parseMultiplication(): ASTNode {
    let left = this.parsePower();

    while (
      this.peek().type === 'OPERATOR' &&
      ['*', '×', '/', '÷'].includes(this.peek().value as string)
    ) {
      const op = this.consume().value as string;
      const right = this.parsePower();
      left = {
        type: 'operation',
        operator: (op === '×' ? '*' : op === '÷' ? '/' : op) as '/' | '*',
        left,
        right,
      };
    }

    return left;
  }

  private parsePower(): ASTNode {
    let left = this.parsePrimary();

    if (this.peek().type === 'OPERATOR' && this.peek().value === '^') {
      this.consume();
      const right = this.parsePrimary();
      left = { type: 'power', base: left, exponent: right };
    }

    return left;
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();

    if (token.type === 'LPAREN') {
      this.consume();
      const expr = this.parseAddition();
      if (this.peek().type === 'RPAREN') {
        this.consume();
      }
      return expr;
    }

    if (token.type === 'NUMBER') {
      this.consume();
      return { type: 'number', value: BigInt(token.value as number) };
    }

    if (token.type === 'DECIMAL') {
      this.consume();
      return { type: 'number', value: token.value as number };
    }

    if (token.type === 'FRACTION') {
      const numerStr = String(this.consume().value);
      const denomStr = String(this.consume().value);
      return {
        type: 'fraction',
        numerator: BigInt(numerStr),
        denominator: BigInt(denomStr),
      };
    }

    if (token.type === 'UNICODE_FRAC') {
      this.consume();
      // This should be handled by tokenizer
      throw new Error('Unexpected unicode fraction');
    }

    return { type: 'number', value: 0n };
  }
}

/**
 * Evaluate an AST node to get its mathematical value
 */
function evaluateAST(node: ASTNode): MathValue {
  if (node.type === 'number') {
    if (typeof node.value === 'bigint') {
      const [num, den] = normalizeFraction(node.value, 1n);
      return {
        type: 'rational',
        numerator: num,
        denominator: den,
        decimal: Number(num) / Number(den),
        displayText: num.toString(),
      };
    } else {
      return {
        type: 'decimal',
        decimal: node.value as number,
        displayText: node.value.toString(),
      };
    }
  }

  if (node.type === 'fraction') {
    const [num, den] = normalizeFraction(node.numerator || 0n, node.denominator || 1n);
    return {
      type: 'rational',
      numerator: num,
      denominator: den,
      decimal: Number(num) / Number(den),
      displayText: `${num}/${den}`,
      latex: `\\frac{${num}}{${den}}`,
    };
  }

  if (node.type === 'operation') {
    const left = evaluateAST(node.left!);
    const right = evaluateAST(node.right!);

    // Convert to common denominator for fractions
    let resultNum: bigint;
    let resultDen: bigint = 1n;

    const leftNum = left.numerator || BigInt(Math.floor(left.decimal || 0));
    const leftDen = left.denominator || 1n;
    const rightNum = right.numerator || BigInt(Math.floor(right.decimal || 0));
    const rightDen = right.denominator || 1n;

    const op = node.operator;
    if (op === '+') {
      resultNum = leftNum * rightDen + rightNum * leftDen;
      resultDen = leftDen * rightDen;
    } else if (op === '-') {
      resultNum = leftNum * rightDen - rightNum * leftDen;
      resultDen = leftDen * rightDen;
    } else if (op === '*') {
      resultNum = leftNum * rightNum;
      resultDen = leftDen * rightDen;
    } else if (op === '/') {
      if (rightNum === 0n) throw new Error('Division by zero');
      resultNum = leftNum * rightDen;
      resultDen = leftDen * rightNum;
    } else {
      throw new Error(`Unknown operator: ${op}`);
    }

    const [num, den] = normalizeFraction(resultNum, resultDen);
    return {
      type: 'rational',
      numerator: num,
      denominator: den,
      decimal: Number(num) / Number(den),
      displayText: den === 1n ? num.toString() : `${num}/${den}`,
      latex: den === 1n ? num.toString() : `\\frac{${num}}{${den}}`,
    };
  }

  if (node.type === 'power') {
    const base = evaluateAST(node.base!);
    const exp = evaluateAST(node.exponent!);

    const baseNum = base.numerator || BigInt(Math.floor(base.decimal || 0));
    const baseDen = base.denominator || 1n;
    const expVal = exp.numerator || BigInt(Math.floor(exp.decimal || 0));

    if (expVal < 0n) {
      // Negative power: swap numerator and denominator
      const absExp = -expVal;
      return {
        type: 'rational',
        numerator: baseDen ** absExp,
        denominator: baseNum ** absExp,
        decimal: 1 / (Number(baseNum) / Number(baseDen)) ** Number(absExp),
        displayText: `(${baseNum}/${baseDen})^${expVal}`,
      };
    }

    const resultNum = baseNum ** expVal;
    const resultDen = baseDen ** expVal;
    const [num, den] = normalizeFraction(resultNum, resultDen);

    return {
      type: 'rational',
      numerator: num,
      denominator: den,
      decimal: Number(num) / Number(den),
      displayText: `(${baseNum}/${baseDen})^${expVal}`,
      latex: `\\left(\\frac{${baseNum}}{${baseDen}}\\right)^{${expVal}}`,
    };
  }

  throw new Error('Unsupported AST node type');
}

/**
 * Parse and evaluate a mathematical expression
 */
export function evaluateMathExpression(input: string): MathValue {
  try {
    const tokens = tokenize(input);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    return evaluateAST(ast);
  } catch (error) {
    throw new Error(`Failed to evaluate math expression "${input}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if two mathematical expressions are equivalent
 */
export function areMathExpressionsEquivalent(
  expr1: string,
  expr2: string,
  tolerance: number = 0.00001
): boolean {
  try {
    const val1 = evaluateMathExpression(expr1);
    const val2 = evaluateMathExpression(expr2);

    // Compare decimal values
    const dec1 = val1.decimal ?? 0;
    const dec2 = val2.decimal ?? 0;

    return Math.abs(dec1 - dec2) < tolerance;
  } catch {
    return false;
  }
}

/**
 * Parse multiple mathematical answers and check if a student answer matches any
 */
export function isStudentMathAnswerCorrect(
  studentAnswer: string,
  correctAnswers: string[]
): boolean {
  if (!studentAnswer.trim() || correctAnswers.length === 0) {
    return false;
  }

  return correctAnswers.some(correctAnswer =>
    areMathExpressionsEquivalent(studentAnswer.trim(), correctAnswer.trim())
  );
}

/**
 * Convert a mathematical expression to LaTeX
 */
export function toLatex(expression: string): string {
  try {
    const result = evaluateMathExpression(expression);
    return result.latex || expression;
  } catch {
    return expression;
  }
}

/**
 * Detect if text contains mathematical expressions
 */
export function containsMathematicalExpression(text: string): boolean {
  return /[\d\+\-\*×÷\/\^()⁄⁰-⁹\²\³\u00B2\u00B3\u00B9\u2070-\u2079]/.test(text);
}
