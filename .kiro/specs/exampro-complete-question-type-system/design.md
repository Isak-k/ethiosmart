# Design Document: ExamPro Complete Question Type System

## Overview

The ExamPro Complete Question Type System extends the examination platform to support four question types (MCQ, True/False, Short Answer, and Essay) with optional image support throughout the entire question lifecycle. The system maintains full backward compatibility with existing MCQ-based exams while providing unified workflows for question creation, editing, bulk import, and grading.

### Key Design Principles

- **Single Unified Model**: All question types use a discriminated union type (`Question`) with common base fields and type-specific extensions
- **Type Safety**: Type guard functions and discriminators ensure compile-time and runtime type safety
- **Backward Compatibility**: Existing MCQ questions and exams continue functioning without data modification
- **Optional Images**: Images are optional at all stages; missing images never cause validation failures
- **Independent State Management**: Image upload state is managed separately from form validation state
- **Resilient Operations**: Image failures don't block question or answer operations
- **Type-Specific Logic**: Validation, rendering, and grading behaviors are dispatched by question type

---

## Architecture

### Data Model & Type System

#### Discriminated Union Type

```typescript
type QuestionType = 'mcq' | 'true-false' | 'short-answer' | 'essay';

interface BaseQuestion {
  // Common fields for all question types
  questionId: string;
  examId: string;
  questionText: string;
  marks: number;
  orderIndex: number;
  feedbackType: 'instant' | 'hidden';
  explanation?: string;
  imageUrl?: string;
  imageDisplayMode?: 'inline' | 'background' | 'main'; // Default: inline
  createdAt: Timestamp;
  questionType: QuestionType;
}

// Type-specific extensions
interface MCQQuestion extends BaseQuestion {
  questionType: 'mcq';
  options: string[];
  correctOptionIndex: number;
}

interface TrueFalseQuestion extends BaseQuestion {
  questionType: 'true-false';
  correctAnswer: boolean;
}

interface ShortAnswerQuestion extends BaseQuestion {
  questionType: 'short-answer';
  correctAnswers: string[];
  caseSensitive?: boolean; // Default: false
  requireExactMatch?: boolean; // Default: false
}

interface EssayQuestion extends BaseQuestion {
  questionType: 'essay';
  minWords?: number;
  maxWords?: number;
  rubricPoints?: { criteria: string; points: number }[];
}

type Question = MCQQuestion | TrueFalseQuestion | ShortAnswerQuestion | EssayQuestion;
```

#### Type Guard Functions

```typescript
function isMCQQuestion(q: Question): q is MCQQuestion {
  return q.questionType === 'mcq';
}

function isTrueFalseQuestion(q: Question): q is TrueFalseQuestion {
  return q.questionType === 'true-false';
}

function isShortAnswerQuestion(q: Question): q is ShortAnswerQuestion {
  return q.questionType === 'short-answer';
}

function isEssayQuestion(q: Question): q is EssayQuestion {
  return q.questionType === 'essay';
}
```

#### Answer Interface

```typescript
interface Answer {
  questionId: string;
  attemptId: string;
  selectedOptionIndex?: number | null; // MCQ only
  selectedBoolean?: boolean | null; // True/False only
  textAnswer?: string | null; // Short Answer / Essay only
  isCorrect: boolean | null; // null for pending essays
  timeSpentSeconds: number | null;
  answeredAt: Timestamp | null;
  rubricScore?: number; // Essay only - manual grading
}
```

#### Image Handling

**Firebase Storage Path Structure**:
```
question-images/{examId}/{questionId}/{timestamp}
```

**Image Validation**:
- File types: JPEG, PNG, WebP, GIF
- Max size: 5MB
- Validation performed before upload, separate from form validation state

**Image Display Modes**:
- **inline**: Image next to question text with max-width constraint (default)
- **background**: Image as subtle background with reduced opacity
- **main**: Image as primary content with question text below

---

## Components and Interfaces

### Component Architecture

```
Application
├── Admin Module
│   ├── QuestionTypeForm (creates/edits questions)
│   │   ├── QuestionTypeSelector
│   │   ├── CommonFieldsSection (text, marks, feedback type, explanation)
│   │   ├── TypeSpecificFieldsSection
│   │   │   ├── MCQFields (options, correct answer selector)
│   │   │   ├── TrueFalseFields (correct answer selector)
│   │   │   ├── ShortAnswerFields (answers, case/match toggles)
│   │   │   └── EssayFields (word constraints, rubric config)
│   │   ├── ImageUploadSection (independent state)
│   │   └── FormActions
│   ├── BulkImportInterface
│   │   ├── FileFormatSelector (CSV/JSON)
│   │   ├── FileUpload
│   │   ├── PreviewTable
│   │   └── ConfirmImport
│   └── EssayGradingInterface
│       ├── EssayAnswerDisplay
│       ├── RubricDisplay
│       ├── RubricScoreInput
│       └── GradeSubmitButton
├── Exam Module
│   ├── QuestionRenderer
│   │   ├── QuestionHeader (number, marks, type badge)
│   │   ├── ImageDisplay (with mode-specific styling)
│   │   ├── MCQRenderer (radio buttons)
│   │   ├── TrueFalseRenderer (buttons)
│   │   ├── ShortAnswerRenderer (text input)
│   │   ├── EssayRenderer (textarea with word count)
│   │   └── ExplanationToggle
│   └── ExamResults
│       ├── ResultsTable (all types with appropriate status)
│       ├── PendingEssaysNotice
│       ├── ScoreSummary
│       └── FilterByType
└── Utilities
    ├── question-evaluation.ts (dispatch to type-specific evaluators)
    ├── answer-handlers.ts (answer format conversion)
    ├── validations.ts (Zod schemas for all types)
    ├── image-handler.ts (upload, download, delete)
    ├── bulk-import.ts (CSV/JSON parsing)
    └── question-migration.ts (legacy MCQ migration)
```

### QuestionTypeForm Component

**Responsibilities**:
- Display question type selector dropdown
- Render type-specific form fields dynamically
- Handle type changes with safe field reset
- Manage image upload/removal with separate state
- Support add/remove for options and answers
- Validate and submit question data

**Type Change Safety**:
- MCQ → True/False: SAFE if exactly 2 options
- True/False → MCQ: SAFE (convert boolean to option index)
- Any → Essay: SAFE (existing answer becomes text)
- Other changes: Require confirmation dialog

**Image State Management**:
```typescript
const [imageUrl, setImageUrl] = useState<string | undefined>(question?.imageUrl);
const [uploadingImage, setUploadingImage] = useState(false);
// Separate from form.watch() to avoid triggering validation
```

### QuestionRenderer Component

**Responsibilities**:
- Display question with appropriate UI for its type
- Render images according to display mode
- Show feedback/explanations based on mode and feedbackType
- Capture student answers
- Display grading results

**Rendering Logic Flow**:
```
isMCQQuestion(q) → renderMCQ() with radio buttons
isTrueFalseQuestion(q) → renderTrueFalse() with two buttons
isShortAnswerQuestion(q) → renderShortAnswer() with textarea
isEssayQuestion(q) → renderEssay() with textarea + word count
```

**Image Display Classes**:
```typescript
function getImageDisplayClasses(mode: 'inline' | 'background' | 'main'): string {
  switch (mode) {
    case 'inline': return 'max-w-md';
    case 'background': return 'w-full opacity-20';
    case 'main': return 'w-full h-80';
  }
}
```

### BulkImportInterface Component

**Responsibilities**:
- Accept CSV/JSON files with multiple questions
- Parse and identify question types
- Download and upload images non-blocking
- Validate all questions before preview
- Display preview with detected errors
- Execute import and return summary

**Import Format Support**:

CSV columns:
```
questionType,questionText,marks,feedbackType,explanation,imageUrl,options,correctOptionIndex,correctAnswer,correctAnswers,caseSensitive,requireExactMatch,minWords,maxWords
```

JSON structure:
```json
[
  {
    "questionType": "mcq",
    "questionText": "...",
    "marks": 1,
    "feedbackType": "instant",
    "options": ["...", "..."],
    "correctOptionIndex": 0,
    "imageUrl": "https://..."
  }
]
```

---

## Data Models

### Firestore Schema

#### Questions Collection

```
exams/{examId}/questions/{questionId}
├── questionType: 'mcq' | 'true-false' | 'short-answer' | 'essay'
├── questionText: string
├── marks: number
├── orderIndex: number
├── feedbackType: 'instant' | 'hidden'
├── explanation?: string
├── imageUrl?: string
├── imageDisplayMode?: 'inline' | 'background' | 'main'
├── createdAt: Timestamp
├── (MCQ specific)
│   ├── options: string[]
│   └── correctOptionIndex: number
├── (True/False specific)
│   └── correctAnswer: boolean
├── (Short Answer specific)
│   ├── correctAnswers: string[]
│   ├── caseSensitive: boolean
│   └── requireExactMatch: boolean
└── (Essay specific)
    ├── minWords?: number
    ├── maxWords?: number
    └── rubricPoints?: { criteria: string; points: number }[]
```

#### Answers Collection

```
attempts/{attemptId}/answers/{questionId}
├── questionId: string
├── attemptId: string
├── selectedOptionIndex?: number | null
├── selectedBoolean?: boolean | null
├── textAnswer?: string | null
├── isCorrect: boolean | null
├── timeSpentSeconds: number | null
├── answeredAt: Timestamp | null
└── rubricScore?: number
```

#### Indexing Strategy

Recommended composite indexes:
- `questions`: examId, questionType
- `questions`: examId, orderIndex
- `answers`: attemptId, questionId
- `answers`: attemptId, isCorrect (for results calculation)

---

## Validation

### Type-Safe Discriminated Union Validation with Zod

```typescript
const baseSchema = z.object({
  questionText: z.string().trim().min(1).max(2000),
  marks: z.number().int().min(1).max(100),
  feedbackType: z.enum(['instant', 'hidden']),
  explanation: z.string().trim().max(2000).optional(),
});

const questionSchema = z.discriminatedUnion('questionType', [
  baseSchema.extend({
    questionType: z.literal('mcq'),
    options: z.array(z.string().trim().min(1)).min(2).max(6),
    correctOptionIndex: z.number().int().min(0),
  }).refine(q => q.correctOptionIndex < q.options.length, {
    message: "Correct option index must be within options range"
  }),
  
  baseSchema.extend({
    questionType: z.literal('true-false'),
    correctAnswer: z.boolean(),
  }),
  
  baseSchema.extend({
    questionType: z.literal('short-answer'),
    correctAnswers: z.array(z.string().trim().min(1)).min(1),
    caseSensitive: z.boolean().optional(),
    requireExactMatch: z.boolean().optional(),
  }),
  
  baseSchema.extend({
    questionType: z.literal('essay'),
    minWords: z.number().int().positive().optional(),
    maxWords: z.number().int().positive().optional(),
  }).refine(q => !q.minWords || !q.maxWords || q.minWords <= q.maxWords, {
    message: "Minimum words cannot exceed maximum words"
  }),
]);
```

### Image Validation

```typescript
interface ImageValidation {
  valid: boolean;
  error?: string;
}

function validateImageFile(file: File): ImageValidation {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'File type must be JPEG, PNG, WebP, or GIF' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must not exceed 5MB' };
  }

  return { valid: true };
}
```

### Answer Format Validation

```typescript
function validateAnswerFormat(
  question: Question,
  answer: string | number | boolean | null
): { valid: boolean; error?: string } {
  switch (question.questionType) {
    case 'mcq':
      if (typeof answer !== 'number' && answer !== null) {
        return { valid: false, error: 'MCQ answer must be an option index' };
      }
      if (answer !== null && (answer < 0 || answer >= question.options.length)) {
        return { valid: false, error: 'Option index out of bounds' };
      }
      return { valid: true };

    case 'true-false':
      if (typeof answer !== 'boolean' && answer !== null) {
        return { valid: false, error: 'True/False answer must be boolean' };
      }
      return { valid: true };

    case 'short-answer':
    case 'essay':
      if (typeof answer !== 'string' && answer !== null) {
        return { valid: false, error: 'Text answer must be string' };
      }
      return { valid: true };

    default:
      return { valid: false, error: 'Unknown question type' };
  }
}
```

---

## Grading Engine

### Auto-Grading for MCQ, True/False, Short Answer

```typescript
interface EvaluationResult {
  isCorrect: boolean;
  earnedMarks: number;
  totalMarks: number;
  feedback?: string;
  explanation?: string;
}

function evaluateMCQ(
  question: Question,
  selectedOptionIndex: number | null
): EvaluationResult {
  if (!isMCQQuestion(question)) throw new Error('Not MCQ');
  
  const isCorrect = selectedOptionIndex === question.correctOptionIndex;
  return {
    isCorrect,
    earnedMarks: isCorrect ? question.marks : 0,
    totalMarks: question.marks,
    feedback: isCorrect 
      ? `Correct! You earned ${question.marks} marks`
      : `Incorrect. Correct answer: ${question.options[question.correctOptionIndex]}`,
    explanation: question.explanation,
  };
}

function evaluateTrueFalse(
  question: Question,
  selectedBoolean: boolean | null
): EvaluationResult {
  if (!isTrueFalseQuestion(question)) throw new Error('Not True/False');
  
  const isCorrect = selectedBoolean === question.correctAnswer;
  return {
    isCorrect,
    earnedMarks: isCorrect ? question.marks : 0,
    totalMarks: question.marks,
    feedback: isCorrect
      ? `Correct! You earned ${question.marks} marks`
      : `Incorrect. Correct answer: ${question.correctAnswer ? 'True' : 'False'}`,
    explanation: question.explanation,
  };
}

function evaluateShortAnswer(
  question: Question,
  textAnswer: string | null
): EvaluationResult {
  if (!isShortAnswerQuestion(question)) throw new Error('Not Short Answer');
  
  if (!textAnswer || textAnswer.trim() === '') {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: question.marks,
      feedback: 'You skipped this question',
    };
  }

  const isCorrect = evaluateTextAnswer({
    studentAnswer: textAnswer,
    correctAnswers: question.correctAnswers,
    caseSensitive: question.caseSensitive || false,
    requireExactMatch: question.requireExactMatch || false,
  });

  return {
    isCorrect,
    earnedMarks: isCorrect ? question.marks : 0,
    totalMarks: question.marks,
    feedback: isCorrect
      ? `Correct! You earned ${question.marks} marks`
      : `Incorrect. Expected: ${question.correctAnswers.join(', ')}`,
    explanation: question.explanation,
  };
}

function evaluateTextAnswer(evaluation: {
  studentAnswer: string;
  correctAnswers: string[];
  caseSensitive: boolean;
  requireExactMatch: boolean;
}): boolean {
  const normalize = (text: string): string => {
    let normalized = text.trim();
    if (!evaluation.caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    return normalized;
  };

  const normalized = normalize(evaluation.studentAnswer);
  const normalizedCorrect = evaluation.correctAnswers.map(normalize);

  if (evaluation.requireExactMatch) {
    return normalizedCorrect.includes(normalized);
  }

  // Partial match: either student contains correct or vice versa
  return normalizedCorrect.some(correct =>
    correct.includes(normalized) || normalized.includes(correct)
  );
}
```

### Essay Evaluation & Manual Grading

```typescript
function evaluateEssay(
  question: Question,
  textAnswer: string | null
): EvaluationResult {
  if (!isEssayQuestion(question)) throw new Error('Not Essay');

  const wordCount = textAnswer ? textAnswer.trim().split(/\s+/).length : 0;

  // Word count validation
  if (question.minWords && wordCount < question.minWords) {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: question.marks,
      feedback: `Essay too short. Min: ${question.minWords}, Your: ${wordCount}`,
    };
  }

  if (question.maxWords && wordCount > question.maxWords) {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: question.marks,
      feedback: `Essay too long. Max: ${question.maxWords}, Your: ${wordCount}`,
    };
  }

  // Essays always return pending - manual grading required
  return {
    isCorrect: false, // Will be determined by educator
    earnedMarks: 0,
    totalMarks: question.marks,
    feedback: 'Your essay has been submitted and is pending review',
    explanation: question.explanation,
  };
}

interface EssayGrade {
  rubricScore: number;
  feedback?: string;
}

async function submitEssayGrade(
  attemptId: string,
  questionId: string,
  grade: EssayGrade
): Promise<void> {
  const answerRef = doc(db, `attempts/${attemptId}/answers/${questionId}`);
  await updateDoc(answerRef, {
    rubricScore: grade.rubricScore,
    isCorrect: grade.rubricScore > 0, // Simple true/false based on score
    answeredAt: Timestamp.now(),
  });
}
```

### Unified Evaluation Function

```typescript
function evaluateQuestion(
  question: Question,
  answer: string | number | boolean | null
): EvaluationResult {
  if (isMCQQuestion(question)) {
    return evaluateMCQ(question, answer as number | null);
  } else if (isTrueFalseQuestion(question)) {
    return evaluateTrueFalse(question, answer as boolean | null);
  } else if (isShortAnswerQuestion(question)) {
    return evaluateShortAnswer(question, answer as string | null);
  } else if (isEssayQuestion(question)) {
    return evaluateEssay(question, answer as string | null);
  }
  throw new Error('Unknown question type');
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Discriminated Union Type Safety

*For any* question loaded from Firestore, the discriminated union type should correctly identify the question type using type guards, and accessing type-specific fields should only be possible after successful type narrowing.

**Validates: Requirements 1.1, 1.2, 1.4, 1.5**

### Property 2: MCQ Correct Answer Matching

*For any* MCQ question and selected option index, the evaluator should mark the answer correct if and only if the selected index matches the question's correctOptionIndex.

**Validates: Requirements 2.6, 14.1, 14.2**

### Property 3: True/False Boolean Matching

*For any* True/False question and selected boolean, the evaluator should mark the answer correct if and only if the selected boolean matches the question's correctAnswer.

**Validates: Requirements 3.4, 14.3, 14.4**

### Property 4: Short Answer Text Matching

*For any* Short Answer question with configured matching rules, a student's text answer should be marked correct if and only if it matches one of the correctAnswers according to the case sensitivity and exact/partial match rules.

**Validates: Requirements 4.6, 4.7, 14.5, 14.6**

### Property 5: Essay Word Count Validation

*For any* Essay question with word count constraints, an essay answer should be marked incorrect if word count is below minWords or above maxWords, and pending_review otherwise.

**Validates: Requirements 5.5, 15.1**

### Property 6: Optional Image Support for All Types

*For any* question type (MCQ, True/False, Short Answer, Essay), the question should be saveable and renderable without an image, and adding an image should not require modification of other question fields.

**Validates: Requirements 6.1, 6.3, 6.5**

### Property 7: Image Display Mode Consistency

*For any* question with an imageUrl and imageDisplayMode, the renderer should apply CSS styling consistent with the mode (inline, background, or main), and questions without imageDisplayMode should default to inline.

**Validates: Requirements 8.3, 8.4, 8.5**

### Property 8: Image Upload and Storage

*For any* image file that passes validation, uploading to Firebase Storage should result in a valid download URL that can be stored in the question's imageUrl field.

**Validates: Requirements 7.1, 7.3, 7.4, 21.1**

### Property 9: Image Lifecycle on Replacement

*For any* existing question with an image, replacing it with a new image should result in the old image being deleted from Firebase Storage and the new URL being stored.

**Validates: Requirements 7.5, 21.2**

### Property 10: Form Type-Specific Fields

*For any* question form with a selected question type, only the type-specific fields relevant to that type should be displayed and validated, and changing the type should reset type-specific fields to defaults while preserving common fields.

**Validates: Requirements 9.2, 9.3**

### Property 11: Question Save and Deserialize Round Trip

*For any* question of any type that is saved to Firestore, loading it back should result in an object with identical values for all fields including the questionType discriminator.

**Validates: Requirements 1.5, 26.1, 26.2**

### Property 12: Mixed Question Type Exam Marks Calculation

*For any* exam containing questions of different types, the total marks should equal the sum of individual question marks regardless of question type.

**Validates: Requirements 18.3, 22.6**

### Property 13: Auto-Graded Answer Marks

*For any* auto-graded answer (MCQ, True/False, Short Answer), the earnedMarks should equal the question's marks if correct and 0 if incorrect.

**Validates: Requirements 14.7, 14.8**

### Property 14: Pending Essay Status

*For any* essay answer submitted within word count constraints (or with no constraints), the answer status should be pending_review and isCorrect should be null until an educator assigns a rubricScore.

**Validates: Requirements 5.4, 15.1, 15.2**

### Property 15: Backward Compatibility Default Type

*For any* question loaded from Firestore without a questionType field, the system should treat it as 'mcq' type without modifying the stored data.

**Validates: Requirements 20.2, 20.3**

### Property 16: Bulk Import Question Creation

*For any* valid question data in a bulk import file, importing should result in a question created in Firestore with all provided fields, and questions without required type-specific fields should not be created.

**Validates: Requirements 11.2, 11.8, 11.9**

### Property 17: Bulk Import Image Resilience

*For any* bulk import containing image references, questions should be created successfully regardless of whether images are successfully downloaded or not—missing images should not cause question creation to fail.

**Validates: Requirements 11.5, 12.6**

### Property 18: Type Change Safety Assessment

*For any* question with a type change request, the system should allow MCQ↔True/False changes if they are safe (e.g., MCQ→True/False only if exactly 2 options), and require confirmation for other type changes that might lose data.

**Validates: Requirements 24.1, 24.2, 24.3**

### Property 19: Practice Mode Feedback Display

*For any* question answered in practice mode with feedbackType='instant' and showFeedback=true, the renderer should display whether the answer was correct and (if showExplanations=true) the explanation.

**Validates: Requirements 17.2, 17.3, 17.6**

### Property 20: Question Rendering Per Type

*For any* question of a specific type displayed in exam mode, the renderer should display the appropriate input interface (radio buttons for MCQ, buttons for True/False, textarea for Short Answer/Essay) with correct styling.

**Validates: Requirements 16.2, 16.3, 16.4, 16.5**

### Property 21: Answer Format Storage Consistency

*For any* answer submitted for a question type, the system should store the answer in the correct field for that type (selectedOptionIndex for MCQ, selectedBoolean for True/False, textAnswer for Short Answer/Essay).

**Validates: Requirements 13.2, 13.3, 13.4**

### Property 22: Essay Manual Grading Storage

*For any* essay answer receiving an educator grade with rubricScore assigned, the system should store the score, mark the answer as no longer pending_review, and update the total exam score accordingly.

**Validates: Requirements 15.5, 15.6**

### Property 23: Results Display for Mixed Types

*For any* exam submission with mixed question types, exam results should display correct/incorrect status for auto-graded questions and pending_review/graded status for essays, with notes indicating if grading is incomplete.

**Validates: Requirements 25.1, 25.2, 25.3, 25.4, 25.6**

### Property 24: Type-Specific Validation

*For any* question of a specific type being saved, validation should check type-appropriate requirements (e.g., MCQ validates minimum 2 options, Essay validates min/max word constraints) and prevent saving if validation fails.

**Validates: Requirements 23.1, 23.2, 23.3, 23.4**

### Property 25: Image File Validation

*For any* image file selected for upload, files with incorrect type or size >5MB should be rejected with a specific error message, and valid files should proceed to upload.

**Validates: Requirements 7.1, 7.2**

---

## Error Handling

### Image Upload Errors

- **Invalid File Type**: Display "File type must be JPEG, PNG, WebP, or GIF"
- **File Too Large**: Display "File size must not exceed 5MB"
- **Upload Failed**: Display specific error message; allow retry without clearing form
- **Image Inaccessible at Render**: Log warning, display question without image

### Question Form Errors

- **Type-Specific Validation**: Display errors next to relevant fields (e.g., "Minimum 2 options", "Correct answer index out of bounds")
- **Common Field Errors**: Display "Question text required", "Marks must be 1-100"
- **Safe Type Change Blocked**: Display dialog "Cannot change from MCQ to Short Answer because options would be lost. Confirm to proceed?"

### Bulk Import Errors

- **File Parse Error**: Display "Unable to parse file. Check format and encoding"
- **Missing Required Fields**: Display "Row X: Missing required field 'correctOptionIndex'"
- **Invalid Type Value**: Display "Row X: Question type 'invalid' not recognized"
- **Image Download Failed**: Log warning, continue import; note in preview as "Image failed to download"

### Answer Evaluation Errors

- **Type Mismatch**: Log error "Answer format does not match question type"; reject operation
- **Index Out of Bounds**: Log error "MCQ option index beyond available options"

### Essay Grading Errors

- **Missing Rubric Score**: Display "Please enter a rubric score before submitting grade"
- **Invalid Score Value**: Display "Score must be a positive number"

---

## Testing Strategy

### Unit Tests

Unit tests verify specific examples, edge cases, and error conditions:

1. **Question Creation & Validation**
   - Create MCQ with minimum options (2)
   - Create MCQ with maximum options (6)
   - Reject MCQ with 1 option
   - Create True/False with both correctAnswer values (true, false)
   - Create Short Answer with multiple acceptable answers
   - Create Essay with and without word constraints
   - Reject question with empty text
   - Reject question with invalid marks

2. **Answer Submission & Storage**
   - Store MCQ answer as selectedOptionIndex
   - Store True/False answer as selectedBoolean
   - Store Short Answer answer as textAnswer with empty string
   - Store Essay answer as textAnswer
   - Verify timestamp stored in answeredAt

3. **Answer Evaluation**
   - MCQ correct answer evaluation
   - MCQ incorrect answer evaluation
   - True/False correct evaluation
   - True/False incorrect evaluation
   - Short Answer exact match evaluation (case sensitive)
   - Short Answer partial match evaluation
   - Essay word count validation (too short)
   - Essay word count validation (too long)
   - Essay pending_review status on valid submission

4. **Image Operations**
   - Reject image >5MB
   - Reject image with invalid type
   - Accept valid image and verify upload
   - Replace image on question edit
   - Delete image on question deletion
   - Handle upload failure gracefully

5. **Form & UI**
   - Change question type and verify fields reset
   - Add/remove MCQ options
   - Add/remove Short Answer answers
   - Toggle case sensitivity and exact match
   - Set essay word constraints
   - Validate form before submission

6. **Backward Compatibility**
   - Load legacy MCQ question without questionType field
   - Render legacy question identically
   - Grade legacy answer using same logic
   - Auto-add questionType field on save

7. **Bulk Import**
   - Parse CSV with mixed question types
   - Parse JSON with image references
   - Handle missing optional fields
   - Handle image download failures
   - Create questions from valid import data
   - Display validation errors for invalid rows

8. **Essay Grading**
   - Submit grade for pending essay
   - Update rubricScore in answer
   - Mark essay as graded (not pending_review)
   - Include graded essay in results calculation

9. **Results Calculation**
   - Calculate total marks for auto-graded questions
   - Calculate total marks including graded essays
   - Display pending_review status for ungraded essays
   - Display incomplete grading notice when essays pending

### Property-Based Tests

Property-based tests verify universal properties across generated inputs using Hypothesis (Python) or fast-check (JavaScript). Each property should run minimum 100 iterations with random generated data:

#### Property 1: MCQ Round Trip
```typescript
// Feature: exampro-complete-question-type-system, Property 1: MCQ Correct Answer Matching
test.prop([fc.integer({ min: 0, max: 5 })], (correctIndex) => {
  const question: MCQQuestion = generateMCQQuestion({ 
    options: ["A", "B", "C"],
    correctOptionIndex: correctIndex 
  });
  for (let i = 0; i <= 2; i++) {
    const result = evaluateMCQ(question, i);
    expect(result.isCorrect).toBe(i === correctIndex);
    expect(result.earnedMarks).toBe(i === correctIndex ? question.marks : 0);
  }
});
```

#### Property 2: True/False Completeness
```typescript
// Feature: exampro-complete-question-type-system, Property 3: True/False Boolean Matching
test.prop([fc.boolean()], (correctAnswer) => {
  const question: TrueFalseQuestion = generateTrueFalseQuestion({ correctAnswer });
  
  const resultTrue = evaluateTrueFalse(question, true);
  const resultFalse = evaluateTrueFalse(question, false);
  
  expect(resultTrue.isCorrect).toBe(correctAnswer === true);
  expect(resultFalse.isCorrect).toBe(correctAnswer === false);
  expect(resultTrue.isCorrect && resultFalse.isCorrect).toBe(false); // Exactly one should be correct
});
```

#### Property 3: Short Answer Matching Idempotence
```typescript
// Feature: exampro-complete-question-type-system, Property 4: Short Answer Text Matching
test.prop([fc.string(), fc.boolean(), fc.boolean()], 
  (studentAnswer, caseSensitive, exactMatch) => {
    const question: ShortAnswerQuestion = generateShortAnswerQuestion({
      correctAnswers: ["hello", "hi"],
      caseSensitive,
      requireExactMatch: exactMatch
    });
    
    const result1 = evaluateShortAnswer(question, studentAnswer);
    const result2 = evaluateShortAnswer(question, studentAnswer);
    
    expect(result1.isCorrect).toBe(result2.isCorrect);
});
```

#### Property 4: Essay Word Count Validation
```typescript
// Feature: exampro-complete-question-type-system, Property 5: Essay Word Count Validation
test.prop([fc.integer({ min: 10, max: 50 }), fc.string()], 
  (maxWords, essayText) => {
    const question: EssayQuestion = generateEssayQuestion({ maxWords });
    const result = evaluateEssay(question, essayText);
    
    const wordCount = essayText.trim().split(/\s+/).filter(w => w).length;
    if (wordCount > maxWords) {
      expect(result.isCorrect).toBe(false);
      expect(result.feedback).toContain("too long");
    }
});
```

#### Property 5: All Question Types Saveable Without Image
```typescript
// Feature: exampro-complete-question-type-system, Property 6: Optional Image Support for All Types
test.prop([fc.oneof(
  generateMCQQuestionArbitrary(),
  generateTrueFalseQuestionArbitrary(),
  generateShortAnswerQuestionArbitrary(),
  generateEssayQuestionArbitrary()
)], (question) => {
  const questionWithoutImage = { ...question, imageUrl: undefined };
  
  // Should pass validation
  const validation = questionSchema.parse(questionWithoutImage);
  expect(validation.imageUrl).toBeUndefined();
  
  // Should save successfully
  const saved = await saveQuestion(questionWithoutImage);
  expect(saved.questionId).toBeDefined();
});
```

#### Property 6: Image Display Mode Default
```typescript
// Feature: exampro-complete-question-type-system, Property 7: Image Display Mode Consistency
test.prop([generateQuestionArbitrary()], (question) => {
  const questionWithoutMode = { ...question, imageDisplayMode: undefined };
  const defaultMode = questionWithoutMode.imageDisplayMode || 'inline';
  
  expect(defaultMode).toBe('inline');
});
```

#### Property 7: Question Type Discriminator Consistency
```typescript
// Feature: exampro-complete-question-type-system, Property 1: Discriminated Union Type Safety
test.prop([fc.oneof(
  generateMCQQuestionArbitrary(),
  generateTrueFalseQuestionArbitrary(),
  generateShortAnswerQuestionArbitrary(),
  generateEssayQuestionArbitrary()
)], (question) => {
  // Should have correct type guard match
  switch (question.questionType) {
    case 'mcq':
      expect(isMCQQuestion(question)).toBe(true);
      expect('options' in question).toBe(true);
      break;
    case 'true-false':
      expect(isTrueFalseQuestion(question)).toBe(true);
      expect('correctAnswer' in question).toBe(true);
      break;
    case 'short-answer':
      expect(isShortAnswerQuestion(question)).toBe(true);
      expect('correctAnswers' in question).toBe(true);
      break;
    case 'essay':
      expect(isEssayQuestion(question)).toBe(true);
      break;
  }
});
```

#### Property 8: Marks Calculation Across Types
```typescript
// Feature: exampro-complete-question-type-system, Property 12: Mixed Question Type Exam Marks Calculation
test.prop([generateExamWithMixedTypesArbitrary()], (exam) => {
  const questions = exam.questions;
  const expectedTotal = questions.reduce((sum, q) => sum + q.marks, 0);
  
  expect(exam.totalMarks).toBe(expectedTotal);
});
```

#### Property 9: Auto-Graded Answer Marks Consistency
```typescript
// Feature: exampro-complete-question-type-system, Property 13: Auto-Graded Answer Marks
test.prop([
  generateMCQQuestionArbitrary(),
  fc.integer({ min: 0, max: 3 })
], (question, selectedIndex) => {
  const result = evaluateMCQ(question, selectedIndex);
  
  if (result.isCorrect) {
    expect(result.earnedMarks).toBe(question.marks);
  } else {
    expect(result.earnedMarks).toBe(0);
  }
});
```

#### Property 10: Round Trip Serialization
```typescript
// Feature: exampro-complete-question-type-system, Property 11: Question Save and Deserialize Round Trip
test.prop([generateQuestionArbitrary()], async (question) => {
  const saved = await saveQuestion(question);
  const loaded = await loadQuestion(question.examId, saved.questionId);
  
  expect(loaded.questionType).toBe(question.questionType);
  expect(loaded.questionText).toBe(question.questionText);
  expect(loaded.marks).toBe(question.marks);
});
```

---

## Integration Points & API Contracts

### Question CRUD Operations

```typescript
// Create question
async function createQuestion(
  examId: string,
  questionData: NewQuestionInput
): Promise<Question>

// Read question
async function getQuestion(
  examId: string,
  questionId: string
): Promise<Question>

// Read all questions for exam
async function getExamQuestions(examId: string): Promise<Question[]>

// Update question
async function updateQuestion(
  examId: string,
  questionId: string,
  updates: Partial<Question>
): Promise<void>

// Delete question
async function deleteQuestion(
  examId: string,
  questionId: string
): Promise<void>

// Duplicate question
async function duplicateQuestion(
  examId: string,
  questionId: string
): Promise<Question>
```

### Answer Management

```typescript
// Save answer
async function saveAnswer(
  attemptId: string,
  questionId: string,
  answer: Partial<Answer>
): Promise<void>

// Get answer for question
async function getAnswer(
  attemptId: string,
  questionId: string
): Promise<Answer | null>

// Get all answers for attempt
async function getAttemptAnswers(attemptId: string): Promise<Answer[]>

// Grade answer (auto-grading)
async function gradeAnswer(
  question: Question,
  answer: Partial<Answer>
): Promise<EvaluationResult>

// Submit essay grade (manual)
async function submitEssayGrade(
  attemptId: string,
  questionId: string,
  rubricScore: number,
  feedback?: string
): Promise<void>
```

### Image Operations

```typescript
// Upload question image
async function uploadQuestionImage(
  file: File,
  examId: string,
  questionId: string
): Promise<string> // Returns download URL

// Delete question image
async function deleteQuestionImage(
  examId: string,
  questionId: string,
  imageUrl: string
): Promise<void>

// Copy image reference (for bulk import)
async function copyImageReference(
  sourceUrl: string,
  examId: string,
  questionId: string
): Promise<string>
```

### Bulk Import

```typescript
interface BulkImportPreview {
  questions: Array<{ data: any; errors?: string[] }>;
  successCount: number;
  errorCount: number;
}

interface BulkImportResult {
  createdCount: number;
  failedCount: number;
  imageFailureCount: number;
  questions: Question[];
}

async function previewBulkImport(
  file: File
): Promise<BulkImportPreview>

async function executeBulkImport(
  examId: string,
  file: File
): Promise<BulkImportResult>
```

### Results Calculation

```typescript
interface ExamResults {
  attemptId: string;
  questions: Question[];
  answers: Map<string, Answer>;
  evaluations: Map<string, EvaluationResult>;
  totalScore: number;
  maxScore: number;
  percentage: number;
  pendingEssayCount: number;
  canPublishResults: boolean; // false if essays pending
}

async function calculateExamResults(
  examId: string,
  attemptId: string
): Promise<ExamResults>
```

---

## Backward Compatibility Strategy

### Legacy MCQ Detection & Migration

```typescript
/**
 * Load question with automatic type detection
 * Legacy MCQ questions without questionType field are treated as 'mcq'
 * Data is never modified on load
 */
async function loadQuestionWithMigration(
  examId: string,
  questionId: string
): Promise<Question> {
  const data = await getDoc(doc(db, `exams/${examId}/questions/${questionId}`));
  
  if (!data.exists()) {
    throw new Error('Question not found');
  }

  const questionData = data.data();
  
  // Auto-detect MCQ type for legacy questions
  if (!questionData.questionType) {
    return {
      ...questionData,
      questionType: 'mcq',
      questionId,
      examId,
    } as MCQQuestion;
  }

  return questionData as Question;
}

/**
 * Save question and auto-add questionType field if missing
 * Only adds field on first save, never overwrites existing
 */
async function saveQuestionWithMigration(
  examId: string,
  questionData: Partial<Question>
): Promise<void> {
  const questionRef = doc(db, `exams/${examId}/questions/${questionData.questionId!}`);
  const existing = await getDoc(questionRef);
  
  if (!existing.exists() && !questionData.questionType) {
    // New question without type - default to mcq
    questionData.questionType = 'mcq';
  }
  
  await setDoc(questionRef, questionData, { merge: true });
}
```

### Legacy Rendering Support

```typescript
// QuestionRenderer already handles all types identically to legacy MCQ
// No changes needed to existing rendering logic
const isMCQ = isMCQQuestion(question);
const isTF = isTrueFalseQuestion(question);
// etc.
```

---

## Performance Considerations

### Firestore Indexes

Required composite indexes for efficient querying:

1. `Collection: questions`
   - `examId` (Ascending)
   - `questionType` (Ascending)
   - `createdAt` (Descending)

2. `Collection: questions`
   - `examId` (Ascending)
   - `orderIndex` (Ascending)

3. `Collection: answers`
   - `attemptId` (Ascending)
   - `isCorrect` (Ascending)

### Query Optimization

- Filter questions by type using index: `examId + questionType`
- Sort questions by orderIndex: `examId + orderIndex`
- Calculate results using indexed queries on `isCorrect` status

### Image Optimization

- Store Firebase Storage URL directly; no database lookups for image access
- Lazy-load images in results view
- Cache image URLs in component state with proper invalidation

---

## Data Integrity & Consistency

### Transaction Safety

```typescript
// Update question and image atomically
async function updateQuestionWithImage(
  examId: string,
  questionId: string,
  questionData: Partial<Question>,
  newImageFile?: File
): Promise<void> {
  let imageUrl = questionData.imageUrl;

  try {
    if (newImageFile) {
      // Upload new image
      imageUrl = await uploadQuestionImage(newImageFile, examId, questionId);
      
      // Delete old image if exists
      if (questionData.imageUrl) {
        await deleteQuestionImage(examId, questionId, questionData.imageUrl).catch(
          err => console.warn('Failed to delete old image:', err)
        );
      }
      
      questionData.imageUrl = imageUrl;
    }
    
    // Save question with new image URL
    await updateQuestion(examId, questionId, questionData);
  } catch (error) {
    // If question save fails, clean up uploaded image
    if (newImageFile && imageUrl) {
      await deleteQuestionImage(examId, questionId, imageUrl).catch(
        err => console.error('Failed to cleanup image:', err)
      );
    }
    throw error;
  }
}
```

### Answer Format Validation on Save

```typescript
// Validate answer format matches question type before saving
async function saveAnswerWithValidation(
  examId: string,
  attemptId: string,
  questionId: string,
  answer: Partial<Answer>
): Promise<void> {
  const question = await getQuestion(examId, questionId);
  
  // Extract answer value
  let answerValue: string | number | boolean | null = null;
  if (answer.selectedOptionIndex !== undefined) answerValue = answer.selectedOptionIndex;
  if (answer.selectedBoolean !== undefined) answerValue = answer.selectedBoolean;
  if (answer.textAnswer !== undefined) answerValue = answer.textAnswer;
  
  // Validate format
  const validation = validateAnswerFormat(question, answerValue);
  if (!validation.valid) {
    throw new Error(`Invalid answer format: ${validation.error}`);
  }
  
  // Save answer
  await saveAnswer(attemptId, questionId, answer);
}
```

### Orphaned Question Handling

```typescript
// Handle missing questions gracefully in results
function getQuestionSafe(
  questions: Map<string, Question>,
  questionId: string
): Question | null {
  const question = questions.get(questionId);
  
  if (!question) {
    console.warn(`Question ${questionId} not found in exam`);
    return null;
  }
  
  return question;
}

// When rendering results, skip missing questions
results.forEach((result) => {
  const question = getQuestionSafe(questionsMap, result.questionId);
  if (question) {
    renderResult(result, question);
  }
});
```

---

## Configuration & Deployment

### Environment Variables

```env
FIREBASE_IMAGE_STORAGE_BUCKET=project.appspot.com
QUESTION_IMAGE_MAX_SIZE=5242880  # 5MB in bytes
QUESTION_IMAGE_TYPES=image/jpeg,image/png,image/webp,image/gif
PBT_MIN_ITERATIONS=100
PBT_TIMEOUT_MS=5000
```

### Firebase Security Rules

```
match /databases/{database}/documents {
  match /exams/{examId}/questions/{questionId} {
    allow read: if request.auth.uid != null;
    allow create: if request.auth.token.admin == true;
    allow update: if request.auth.token.admin == true;
    allow delete: if request.auth.token.admin == true;
  }
  
  match /attempts/{attemptId}/answers/{questionId} {
    allow read: if request.auth.uid == request.auth.token.uid;
    allow write: if request.auth.uid == request.auth.token.uid;
  }
}
```

### Storage Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /question-images/{allPaths=**} {
      allow read: if request.auth != null;
      allow create: if request.auth.token.admin == true;
      allow update: if request.auth.token.admin == true;
      allow delete: if request.auth.token.admin == true;
    }
  }
}
```

---

## Summary

This comprehensive design establishes a unified, type-safe question system supporting MCQ, True/False, Short Answer, and Essay questions with optional images. Key achievements:

1. **Single Unified Model**: Discriminated union with common base fields and type-specific extensions
2. **Type Safety**: Type guards and validators ensure compile-time and runtime correctness
3. **Backward Compatibility**: Legacy MCQ questions continue functioning without data modification
4. **Optional Images**: Images are optional everywhere; failures don't block operations
5. **Type-Specific Logic**: Validation, rendering, and grading behaviors are properly dispatched
6. **Comprehensive Testing**: Both unit tests and property-based tests ensure correctness across all types
7. **Resilient Operations**: Image failures, missing questions, and edge cases handled gracefully
8. **Clear Error Handling**: Type-specific validation errors guide educators to correct issues
