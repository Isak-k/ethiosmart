# Quick Mathematics Integration Guide

Fast reference for integrating mathematics support into ExamPro components.

## 1. Bulk Import Parser Integration

**File**: `src/lib/question-parser.ts`

```typescript
// Add import at top
import { prepareMathematicalQuestions } from '@/lib/math-parser';

// In parseImportData() or similar function, after parsing questions:
function parseImportData(data: string, format: 'json' | 'csv' | 'text'): ImportParseResult {
  // ... existing parsing logic ...
  let questions = [/* parsed questions */];
  
  // NEW: Prepare mathematical content
  questions = prepareMathematicalQuestions(questions);
  
  return {
    questions,
    errors,
    successCount: questions.length,
    errorCount: errors.length,
  };
}
```

## 2. Answer Evaluation Integration

**File**: `src/lib/question-evaluation.ts`

```typescript
// Add import at top
import { evaluateShortAnswerWithMath } from '@/lib/math-answer-evaluator';

// In evaluateShortAnswer() function:
export function evaluateShortAnswer(
  question: Question,
  textAnswer: string | null
): EvaluationResult {
  if (!isShortAnswerQuestion(question)) {
    throw new Error("Question is not Short Answer type");
  }

  const marks = question.marks ?? 0;

  if (!textAnswer || textAnswer.trim() === "") {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: marks,
      feedback: "You skipped this question",
    };
  }

  // CHANGE: Use math-aware evaluation instead of evaluateTextAnswer()
  const isCorrect = evaluateShortAnswerWithMath(question, textAnswer);

  const earnedMarks = isCorrect ? marks : 0;

  return {
    isCorrect,
    earnedMarks,
    totalMarks: marks,
    feedback: isCorrect
      ? (marks > 0 ? `Correct! You earned ${marks} marks` : "Correct!")
      : `Incorrect. Expected answers: ${question.correctAnswers?.join(", ") || 'N/A'}`,
    explanation: question.explanation,
  };
}
```

## 3. Optional: Question Validation

**File**: `src/lib/validations.ts`

```typescript
// Add imports at top
import { isMathematicalAnswer } from '@/lib/math-parser';
import { evaluateMathExpression } from '@/lib/math-engine';

// In getNewQuestionSchema() or similar, enhance correctAnswers schema:
const shortAnswerSchema = baseSchema.extend({
  questionType: z.literal("short-answer"),
  correctAnswers: z
    .array(z.string().trim().min(1, "Answer cannot be empty"))
    .min(0)
    .optional()
    .refine(
      (answers) => {
        // Validate mathematical expressions if present
        if (!answers) return true;
        return answers.every(answer => {
          if (!isMathematicalAnswer(answer)) return true;
          try {
            evaluateMathExpression(answer);
            return true;
          } catch {
            return false;
          }
        });
      },
      "Invalid mathematical expression in answer"
    ),
  caseSensitive: z.boolean().optional(),
  requireExactMatch: z.boolean().optional(),
});
```

## 4. Optional: Bulk Import UI Enhancement

**File**: `src/components/exam/BulkImportQuestions.tsx`

```typescript
// Add import
import { containsMathematicalContent } from '@/lib/math-parser';

// In preview rendering, add math detection:
{questions.map((q, idx) => (
  <div key={idx} className={containsMathematicalContent(q) ? 'border-blue-500' : ''}>
    {/* Existing preview content */}
    {containsMathematicalContent(q) && (
      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
        Mathematical
      </span>
    )}
  </div>
))}
```

## 5. Optional: Detailed Feedback

**File**: `src/lib/question-evaluation.ts`

For more detailed feedback, use the detailed feedback function:

```typescript
import { getDetailedMathFeedback } from '@/lib/math-answer-evaluator';

// Get detailed feedback for a mathematical answer
const feedback = getDetailedMathFeedback(
  studentAnswer,
  question.correctAnswers || [],
  question.explanation
);

// In results or explanation display:
if (feedback.wasEvaluatedAsMath) {
  console.log('Evaluated as mathematical expression');
  console.log('Matched answer:', feedback.matchedCorrectAnswer);
}
```

## Testing Integration

After integrating, run tests:

```bash
# Test core functionality
npm test src/lib/__tests__/math-engine.test.ts --run
npm test src/lib/__tests__/math-parser.test.ts --run
npm test src/lib/__tests__/math-answer-evaluator.test.ts --run

# Test that existing functionality still works
npm test src/lib/question-evaluation.test.ts --run
npm test src/lib/validations.test.ts --run
```

## Example Question Flow

### 1. Teacher Creates Question (Bulk Import)

**Raw Input:**
```
Question: What is 1/2 + 1/4?
A. 1/2
B. 3/4
C. 1/4
D. 1
Answer: B
```

### 2. Parser Processes It

```typescript
// Input is normalized:
{
  questionText: 'What is 1/2 + 1/4?',
  options: ['1/2', '3/4', '1/4', '1'],
  correctOptionIndex: 1,
  questionType: 'mcq'
}
// Note: Mathematical tags added at Firebase level
```

### 3. Question Saved to Firestore

Question is stored as-is (mathematical expressions as text strings)

### 4. Student Takes Exam

### 5. Student Enters Answer

For short answer, student types: `0.75` or `3/4` or `2/4`

### 6. Evaluation Happens

```typescript
evaluateShortAnswerWithMath(question, "2/4")
// Returns: true (because 2/4 ≡ 3/4)
```

### 7. Student Gets Feedback

"Correct! You earned X marks"

## Supported Formats - Quick Reference

### Student Can Enter:
```
1/2          → 0.5
2/4          → 0.5 (normalized)
0.5          → 0.5
0.50000      → 0.5 (normalized)
3/4 + 1/4    → 1
2^3          → 8
(3/4)^2      → 0.5625
(1/2 + 1/4)  → 0.75
```

All are evaluated mathematically and matched against teacher's answer.

## Common Integration Issues

### Issue: "Module not found"
**Solution**: Ensure import paths are correct:
```typescript
import { evaluateShortAnswerWithMath } from '@/lib/math-answer-evaluator';
// Not: from '@/math-answer-evaluator'
// Not: from './math-answer-evaluator'
```

### Issue: Type errors
**Solution**: Make sure you're using the correct types:
```typescript
// Correct: For questions from Firestore
const question: ShortAnswerQuestion = {...};
evaluateShortAnswerWithMath(question, answer);

// For validator input (different type):
const question: Partial<NewQuestionInput> = {...};
containsMathematicalContent(question);
```

### Issue: Math expressions not recognized
**Solution**: Ensure parser is called during import:
```typescript
// Make sure this line exists:
questions = prepareMathematicalQuestions(questions);
```

## Disabling Mathematics Support

If you need to disable (not recommended):

```typescript
// Just don't call prepareMathematicalQuestions()
// And use regular evaluateTextAnswer()
```

The system is designed to be enabled by default but gracefully falls back if math parsing fails.

## Performance Tips

1. **Bulk evaluation**: Call `prepareMathematicalQuestions()` once during import, not repeatedly
2. **Answer evaluation**: Happens at submission time (acceptable delay < 10ms)
3. **No caching needed**: Expressions are small and fast to evaluate

## Debug Tips

If something isn't working:

```typescript
// Check if text is detected as mathematical
import { isMathematicalAnswer } from '@/lib/math-parser';
console.log(isMathematicalAnswer('1/2 + 1/4')); // true

// Check if expression evaluates correctly
import { evaluateMathExpression } from '@/lib/math-engine';
const result = evaluateMathExpression('1/2 + 1/4');
console.log(result.decimal); // 0.75

// Check if two expressions are equivalent
import { areMathExpressionsEquivalent } from '@/lib/math-engine';
console.log(areMathExpressionsEquivalent('0.5', '1/2')); // true

// Check detailed feedback
import { getDetailedMathFeedback } from '@/lib/math-answer-evaluator';
const feedback = getDetailedMathFeedback('2/4', ['1/2']);
console.log(feedback); // { isCorrect: true, wasEvaluatedAsMath: true, ... }
```

## That's It!

Core integration is just:
1. Call `prepareMathematicalQuestions()` after parsing
2. Use `evaluateShortAnswerWithMath()` instead of `evaluateTextAnswer()`
3. Optional: Add validation and UI enhancements

Everything else handles itself! 🎉

## Next: Full Documentation

For complete details, see:
- `MATHEMATICS_SUPPORT_GUIDE.md` - Full documentation
- `MATHEMATICS_IMPLEMENTATION_CHECKLIST.md` - Detailed steps
- Test files for usage examples
