# ExamPro Mathematics Support System

Complete guide to the mathematics support layer for ExamPro Bulk Import system.

## Overview

The mathematics support system provides comprehensive handling of mathematical expressions in ExamPro, including:

- **Fraction support** (standard, Unicode, vertical formats)
- **Four basic operations** (+, -, *, ÷)
- **Decimal numbers** and mixed arithmetic
- **Powers and exponents** (including negative powers)
- **Parentheses** (simple and nested)
- **Order of operations** (PEMDAS/BODMAS compliance)
- **Mathematical symbol recognition** (Unicode and ASCII)
- **Equivalence checking** for mathematical answers
- **LaTeX rendering** support

## Architecture

### Core Components

#### 1. **Math Engine** (`src/lib/math-engine.ts`)
The mathematical evaluation engine that:
- Tokenizes mathematical expressions
- Builds abstract syntax trees (AST)
- Evaluates expressions to rational or decimal values
- Normalizes fractions to lowest terms
- Checks mathematical equivalence with tolerance

Key functions:
```typescript
evaluateMathExpression(input: string): MathValue
areMathExpressionsEquivalent(expr1: string, expr2: string, tolerance?: number): boolean
isStudentMathAnswerCorrect(studentAnswer: string, correctAnswers: string[]): boolean
containsMathematicalExpression(text: string): boolean
toLatex(expression: string): string
```

#### 2. **Math Parser** (`src/lib/math-parser.ts`)
Handles parsing and normalization of mathematical input:
- Detects vertical fractions (from Word/Docs/PDFs)
- Normalizes Unicode mathematical symbols to ASCII
- Prepares questions for mathematical processing
- Tags questions as mathematical for special handling

Key functions:
```typescript
extractVerticalFractions(text: string): string
normalizeUnicodeSymbols(text: string): string
prepareMathText(text: string, config?: MathParserConfig): string
isMathematicalAnswer(text: string): boolean
containsMathematicalContent(question: Partial<NewQuestionInput>): boolean
tagQuestionAsMathematical(question: Partial<NewQuestionInput>): Partial<NewQuestionInput>
prepareMathematicalQuestion(question: Partial<NewQuestionInput>): Partial<NewQuestionInput>
```

#### 3. **Math Answer Evaluator** (`src/lib/math-answer-evaluator.ts`)
Extends standard answer evaluation with mathematical awareness:
- Evaluates text answers as mathematical expressions first
- Falls back to text comparison if needed
- Provides detailed feedback on mathematical answers
- Integrates with existing question evaluation system

Key functions:
```typescript
evaluateTextAnswerWithMath(evaluation: MathTextAnswerEvaluation): boolean
questionContainsMath(question: Question | Partial<Question>): boolean
evaluateShortAnswerWithMath(question: ShortAnswerQuestion, studentAnswer: string | null): boolean
getDetailedMathFeedback(studentAnswer: string, correctAnswers: string[], explanation?: string): AnswerFeedback
```

## Usage Examples

### 1. Parsing Mathematical Input

```typescript
import { prepareMathText, normalizeUnicodeSymbols } from '@/lib/math-parser';

// Normalize Unicode from Word/Docs
const wordText = 'Calculate: (3⁄4)² × 2';
const normalized = prepareMathText(wordText);
// Result: "Calculate: (3/4)^2 * 2"

// Extract vertical fractions
const verticalText = `4
─
3`;
const extracted = prepareMathText(verticalText);
// Result: "4/3"
```

### 2. Evaluating Mathematical Expressions

```typescript
import { evaluateMathExpression, areMathExpressionsEquivalent } from '@/lib/math-engine';

// Evaluate an expression
const result = evaluateMathExpression('4/3 + 3/2 * 4/9');
console.log(result.decimal); // 2
console.log(result.displayText); // "2/1"

// Check equivalence
const equivalent = areMathExpressionsEquivalent('1/2', '0.5');
console.log(equivalent); // true

// Check student answer
const correct = areMathExpressionsEquivalent('2/4', '1/2');
console.log(correct); // true
```

### 3. Evaluating Student Answers

```typescript
import { evaluateTextAnswerWithMath } from '@/lib/math-answer-evaluator';

// Evaluate a mathematical short answer
const isCorrect = evaluateTextAnswerWithMath({
  studentAnswer: '2/4',
  correctAnswers: ['1/2', '0.5'],
  caseSensitive: false,
  requireExactMatch: false,
});
console.log(isCorrect); // true - 2/4 is equivalent to 1/2

// Get detailed feedback
import { getDetailedMathFeedback } from '@/lib/math-answer-evaluator';

const feedback = getDetailedMathFeedback(
  '0.5',
  ['1/2'],
  'Correct! 1/2 = 0.5'
);
console.log(feedback.isCorrect); // true
console.log(feedback.wasEvaluatedAsMath); // true
```

### 4. Preparing Questions for Import

```typescript
import { prepareMathematicalQuestions } from '@/lib/math-parser';

const questions = [
  {
    questionText: 'What is (3⁄4)²?',
    options: ['9/16', '6/8', '3/8'],
    correctOptionIndex: 0,
    questionType: 'mcq',
  },
];

const prepared = prepareMathematicalQuestions(questions);
// Questions are normalized and tagged as mathematical
```

## Supported Formats

### Fractions

| Format | Example | Interpretation |
|--------|---------|-----------------|
| Standard | `3/4` | Three fourths |
| Unicode | `³⁄₄` | Three fourths |
| Common | `¾` | Three fourths |
| Vertical | `3`<br>`─`<br>`4` | Three fourths |
| Improper | `7/4` | Seven fourths |
| Negative | `-3/5` | Negative three fifths |

### Operations

| Symbol | ASCII | Unicode | Example |
|--------|-------|---------|---------|
| Addition | `+` | `+` | `1/2 + 1/4` |
| Subtraction | `-` | `−` | `3/4 - 1/4` |
| Multiplication | `*` | `×` | `2/3 * 3/5` |
| Division | `/` | `÷` | `4/5 / 2/3` |
| Power | `^` | `²³⁴` | `2^3` or `2³` |

### Decimals

```
0.5
1.25
3.75
0.125
```

### Powers/Exponents

| Format | Example |
|--------|---------|
| Caret | `2^3` |
| Unicode | `2³` |
| Negative | `2^-3` |
| Fraction base | `(3/4)^2` |
| Parentheses | `(3+4)^2` |

### Parentheses

```
Simple:    (2 + 3) * 4
Nested:    2 * ((3 + 4) / 7)
Fractions: (3/4 + 1/2) * 2
Powers:    (3/4)^2
```

## Integration Points

### 1. Bulk Import Parser
The math parser automatically:
- Detects mathematical content in imported questions
- Normalizes Unicode symbols
- Extracts vertical fractions
- Tags questions as mathematical

### 2. Question Validation
Mathematical validation integrates with existing Zod schemas:
- Validates mathematical expressions in answers
- Ensures proper parentheses matching
- Checks for division by zero

### 3. Answer Evaluation
The math evaluator is used in:
- `evaluateShortAnswer()` - Returns correct/incorrect based on mathematical equivalence
- `evaluateTextAnswer()` - Enhanced with mathematical awareness
- `QuestionRenderer.tsx` - Displays feedback with mathematical context

### 4. Data Storage
Mathematical expressions are stored as:
- Plain text strings in Firestore (ASCII normalized)
- Tagged with 'mathematical' tag for special handling
- Preserved exactly as entered for teacher reference
- Convertible to LaTeX for rendering

## Testing

### Running Tests

```bash
# Math engine tests
npm test src/lib/__tests__/math-engine.test.ts

# Math parser tests
npm test src/lib/__tests__/math-parser.test.ts

# Math answer evaluator tests
npm test src/lib/__tests__/math-answer-evaluator.test.ts

# All tests
npm test
```

### Test Coverage

- **Math Engine**: 40+ tests covering:
  - Basic arithmetic (whole numbers, decimals, fractions)
  - All four operations
  - Order of operations (PEMDAS)
  - Powers and exponents
  - Parentheses (simple and nested)
  - Equivalence checking
  - Error handling

- **Math Parser**: 25+ tests covering:
  - Vertical fraction extraction
  - Unicode normalization
  - Text preparation
  - Mathematical content detection
  - Question preparation

- **Math Answer Evaluator**: 30+ tests covering:
  - Text answer evaluation
  - Question math detection
  - Short answer evaluation
  - Detailed feedback generation
  - Edge cases

## Limitations and Considerations

### Current Limitations

1. **Mixed Numbers**: Not explicitly parsed (e.g., "2 1/3")
   - Workaround: Use improper fractions (7/3) or decimals (2.33)

2. **Square Roots**: Basic detection only
   - Format: `√16` or `√(25)` recognized but not fully evaluated
   - Recommendation: Use decimal or power notation

3. **Variable Expressions**: Not supported
   - Cannot evaluate x² or algebraic expressions with variables
   - Use only for numeric expressions

4. **Precision**: Limited to floating-point precision
   - Very large numbers may lose precision
   - Use tolerance parameter in equivalence checks

### Performance Considerations

- Mathematical evaluation is fast for simple expressions
- Complex nested expressions with many operations are slower
- Bulk import of 100+ mathematical questions: ~100-200ms total parsing

### Floating-Point Precision

When checking equivalence, a default tolerance of 0.00001 is used:
```typescript
// These are considered equivalent
0.3333333 ≈ 1/3 (within tolerance)
```

Adjust tolerance if needed:
```typescript
areMathExpressionsEquivalent('expr1', 'expr2', 0.001) // Less strict
areMathExpressionsEquivalent('expr1', 'expr2', 0.0001) // More strict
```

## Rendering

### LaTeX Integration

Mathematical expressions can be converted to LaTeX for professional rendering:

```typescript
import { toLatex } from '@/lib/math-engine';

const latex = toLatex('1/2');
// Result: "\frac{1}{2}"
```

To display with LaTeX rendering (requires KaTeX or MathJax):

```tsx
import { toLatex } from '@/lib/math-engine';

function MathDisplay({ expression }: { expression: string }) {
  return (
    <span className="math">
      {toLatex(expression)}
    </span>
  );
}
```

### Display Text

Each evaluated expression includes:
- `displayText`: Human-readable form (e.g., "1/2")
- `latex`: LaTeX form (e.g., "\frac{1}{2}")
- `decimal`: Numeric value (e.g., 0.5)

## Best Practices

### For Teachers Creating Exams

1. **Use standard formats**: Prefer `1/2` over `½` (both work, but standard is clearer)
2. **Be explicit with operations**: Use parentheses when in doubt: `(1/2) + (1/3)`
3. **Provide multiple answer formats**: For short answers, include equivalent forms:
   - Correct answers: `["1/2", "2/4", "0.5"]`
4. **Add explanations**: Help students understand:
   ```
   Question: What is 1/2 + 1/4?
   Answer: 3/4
   Explanation: Find common denominator: 2/4 + 1/4 = 3/4
   ```

### For Developers

1. **Always normalize input**: Use `prepareMathText()` on user input
2. **Tag questions**: Use `tagQuestionAsMathematical()` for special rendering
3. **Handle errors gracefully**: Math evaluation can throw errors; wrap in try-catch
4. **Test edge cases**: Powers, negative numbers, fractions in parentheses
5. **Consider storage**: Store normalized ASCII format, preserve original for display

## Troubleshooting

### Expression Not Recognized

**Problem**: Math expression treated as plain text.

**Solution**: 
```typescript
// Ensure normalization
const normalized = prepareMathText(expression);
// Verify detection
const isMath = isMathematicalAnswer(normalized);
```

### Incorrect Equivalence Result

**Problem**: Two expressions that should be equivalent are marked as different.

**Solution**:
```typescript
// Check tolerance (default is 0.00001)
const equivalent = areMathExpressionsEquivalent(
  '0.33333',
  '1/3',
  0.001 // Increase tolerance
);
```

### Unicode Symbols Not Converted

**Problem**: ⁴⁄₃ not converted to 4/3.

**Solution**:
```typescript
// Ensure normalizeUnicode is enabled
const config = {
  normalizeUnicode: true,
};
const normalized = prepareMathText(text, config);
```

### Vertical Fractions Not Extracted

**Problem**: Vertical fractions from Word not converted.

**Solution**:
```typescript
// Ensure allowVerticalFractions is enabled
const config = {
  allowVerticalFractions: true,
};
const extracted = prepareMathText(text, config);
```

## File Structure

```
src/lib/
├── math-engine.ts                  # Core math evaluation
├── math-parser.ts                  # Input normalization
├── math-answer-evaluator.ts        # Answer evaluation integration
└── __tests__/
    ├── math-engine.test.ts         # Math engine tests
    ├── math-parser.test.ts         # Parser tests
    └── math-answer-evaluator.test.ts # Evaluator tests
```

## Future Enhancements

1. **Variable Support**: Algebra equation solving
2. **Matrix Operations**: Linear algebra
3. **Symbolic Math**: SymPy-like capabilities
4. **Graph Rendering**: Plotting capabilities
5. **OCR Integration**: Direct image-to-expression conversion
6. **Accessibility**: MathML for screen readers
7. **Step-by-Step Solutions**: Show work for partial credit

## References

- PEMDAS/BODMAS: https://www.khanacademy.org/math
- Fraction arithmetic: https://www.mathsisfun.com/fractions.html
- Unicode math: https://en.wikipedia.org/wiki/Unicode_and_HTML_for_the_mathematical_sciences
- LaTeX math: https://www.latex-project.org/

## Support

For issues or questions about mathematics support:
1. Check test cases in `__tests__` directories
2. Review this guide for best practices
3. Check error messages for specific parsing failures
4. Report issues with example expressions
