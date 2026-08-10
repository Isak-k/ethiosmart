# Phase 1: Extensible Question Model Architecture & Data Modeling

## Executive Summary

This document proposes an extensible, backward-compatible question model for ExamPro that supports MCQ, short answer, true-false, essay, and optional images. The design leverages TypeScript discriminated unions and Firestore's flexible schema to enable gradual migration from the current MCQ-only model while maintaining complete backward compatibility.

---

## 1. Current State Analysis

### Existing Model (MCQ-Only)

**Firestore Structure:**
```
exams/{examId}/questions/{questionId}
├── questionText: string
├── options: string[] (4-6 options)
├── correctOptionIndex: number
├── marks: number
├── orderIndex: number
├── feedbackType: 'instant' | 'hidden'
├── explanation?: string
└── createdAt: Timestamp
```

**Key Constraints:**
- All questions assumed to be MCQ format
- Options always stored as array of strings
- Answer validation always checks `selectedOptionIndex`
- No image support (description references only)
- No support for open-ended responses

### Current Answer Model

```
examAttempts/{attemptId}/answers/{questionId}
├── selectedOptionIndex: number | null
├── isCorrect: boolean | null
├── timeSpentSeconds: number | null
└── answeredAt: Timestamp | null
```

**Limitations:**
- `selectedOptionIndex` meaningless for non-MCQ
- No support for text responses
- No partial credit tracking
- No manual grading field

---

## 2. Proposed Extensible Question Model

### 2.1 Core Question Types

```typescript
// Base question interface (shared by all types)
export interface BaseQuestion {
  questionId: string;
  examId: string;
  questionText: string;
  marks: number;
  orderIndex: number;
  feedbackType: 'instant' | 'hidden';
  explanation?: string;
  imageUrl?: string;           // NEW: Optional image for any question type
  imageAltText?: string;       // NEW: Accessibility
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Metadata for filtering/analytics
  questionType: QuestionType;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

// Discriminated union type
export type QuestionType = 'mcq' | 'short_answer' | 'true_false' | 'essay';

// MCQ Question (backward compatible)
export interface MCQQuestion extends BaseQuestion {
  questionType: 'mcq';
  options: string[];                    // 2-6 options
  correctOptionIndex: number;
  optionImages?: string[];              // NEW: Optional per-option images
  multiSelect?: boolean;                // NEW: Future support for multiple correct answers
}

// True/False Question
export interface TrueFalseQuestion extends BaseQuestion {
  questionType: 'true_false';
  correctAnswer: boolean;              // true or false
}

// Short Answer Question
export interface ShortAnswerQuestion extends BaseQuestion {
  questionType: 'short_answer';
  acceptedAnswers: string[];           // Multiple valid answers (case-insensitive)
  caseSensitive?: boolean;             // Default: false
  charLimit?: number;                  // Character limit for response (e.g., 100)
}

// Essay Question
export interface EssayQuestion extends BaseQuestion {
  questionType: 'essay';
  minWords?: number;
  maxWords?: number;
  rubric?: GradingRubric;               // NEW: Optional rubric for scoring
  requiresManualGrading: boolean;
}

// Grading rubric for essay questions (NEW)
export interface GradingRubric {
  criteria: GradingCriterion[];
  totalPoints: number;
}

export interface GradingCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
}

// Union type for all question types
export type Question = MCQQuestion | TrueFalseQuestion | ShortAnswerQuestion | EssayQuestion;
```

### 2.2 Extended Answer Model

```typescript
// Base answer interface
export interface BaseAnswer {
  questionId: string;
  attemptId: string;
  answeredAt: Timestamp | null;
  timeSpentSeconds: number | null;
}

// Answer types (discriminated by question type)
export interface MCQAnswer extends BaseAnswer {
  questionType: 'mcq';
  selectedOptionIndex: number | null;
  isCorrect: boolean | null;
}

export interface TrueFalseAnswer extends BaseAnswer {
  questionType: 'true_false';
  selectedAnswer: boolean | null;
  isCorrect: boolean | null;
}

export interface ShortAnswerAnswer extends BaseAnswer {
  questionType: 'short_answer';
  studentResponse: string | null;
  isCorrect: boolean | null;
  matchedAnswer?: string;               // Which accepted answer matched
}

export interface EssayAnswer extends BaseAnswer {
  questionType: 'essay';
  studentResponse: string | null;
  wordCount?: number;
  manualScore?: number;                 // Score given by teacher
  manualFeedback?: string;              // Teacher feedback
  graderUserId?: string;                // Who graded this
  gradedAt?: Timestamp;
  autoScore?: number;                   // AUTO: Preliminary score from rubric
}

export type Answer = MCQAnswer | TrueFalseAnswer | ShortAnswerAnswer | EssayAnswer;
```

### 2.3 Type Guards & Utilities

```typescript
// Type guards
export function isMCQQuestion(q: Question): q is MCQQuestion {
  return q.questionType === 'mcq';
}

export function isTrueFalseQuestion(q: Question): q is TrueFalseQuestion {
  return q.questionType === 'true_false';
}

export function isShortAnswerQuestion(q: Question): q is ShortAnswerQuestion {
  return q.questionType === 'short_answer';
}

export function isEssayQuestion(q: Question): q is EssayQuestion {
  return q.questionType === 'essay';
}

export function isMCQAnswer(a: Answer): a is MCQAnswer {
  return a.questionType === 'mcq';
}

// Utility: Get correct answer (works for all types)
export function getCorrectAnswer(question: Question): any {
  switch (question.questionType) {
    case 'mcq':
      return (question as MCQQuestion).correctOptionIndex;
    case 'true_false':
      return (question as TrueFalseQuestion).correctAnswer;
    case 'short_answer':
      return (question as ShortAnswerQuestion).acceptedAnswers;
    case 'essay':
      return null; // Requires manual grading
  }
}

// Utility: Validate student answer
export function validateAnswer(
  question: Question,
  answer: Answer
): { isCorrect: boolean; feedback?: string } {
  if (question.questionType === 'mcq' && isMCQAnswer(answer)) {
    const mcqQ = question as MCQQuestion;
    return {
      isCorrect: answer.selectedOptionIndex === mcqQ.correctOptionIndex
    };
  }
  
  if (question.questionType === 'true_false' && answer.questionType === 'true_false') {
    const tfQ = question as TrueFalseQuestion;
    const tfA = answer as TrueFalseAnswer;
    return {
      isCorrect: tfA.selectedAnswer === tfQ.correctAnswer
    };
  }
  
  if (question.questionType === 'short_answer' && answer.questionType === 'short_answer') {
    const saQ = question as ShortAnswerQuestion;
    const saA = answer as ShortAnswerAnswer;
    
    if (!saA.studentResponse) return { isCorrect: false };
    
    const normalize = (s: string) => 
      saQ.caseSensitive ? s : s.toLowerCase().trim();
    
    const matched = saQ.acceptedAnswers.find(
      a => normalize(a) === normalize(saA.studentResponse!)
    );
    
    return {
      isCorrect: !!matched,
      feedback: matched ? 'Correct' : 'Incorrect'
    };
  }
  
  if (question.questionType === 'essay' && answer.questionType === 'essay') {
    // Essays require manual grading
    return { isCorrect: false, feedback: 'Awaiting manual grading' };
  }
  
  return { isCorrect: false };
}
```

---

## 3. Firestore Collections & Schema

### 3.1 Updated Firestore Structure

```
Database: exam_pro (existing)

Collections:
├── exams/
│   └── {examId}/
│       ├── (Exam document - unchanged)
│       └── questions/
│           └── {questionId} (NEW: multitype support)
│
├── examAttempts/
│   └── {attemptId}/
│       └── answers/
│           └── {questionId} (NEW: multitype support)
│
├── essays/ (NEW - for manual grading workflow)
│   └── {essayId}
│       ├── attemptId: string
│       ├── questionId: string
│       ├── studentResponse: string
│       ├── marks: number
│       ├── status: 'pending' | 'graded'
│       ├── gradedBy?: string
│       └── gradedAt?: Timestamp
│
├── rubrics/ (NEW - reusable essay grading rubrics)
│   └── {rubricId}
│       ├── name: string
│       ├── criteria: GradingCriterion[]
│       ├── totalPoints: number
│       └── createdAt: Timestamp
```

### 3.2 Document Schema Examples

**MCQ Question (Backward Compatible)**
```json
{
  "questionId": "q_abc123",
  "examId": "exam_001",
  "questionType": "mcq",
  "questionText": "What is 2 + 2?",
  "options": ["3", "4", "5", "6"],
  "correctOptionIndex": 1,
  "marks": 1,
  "orderIndex": 0,
  "feedbackType": "hidden",
  "explanation": "2 + 2 = 4",
  "createdAt": "2024-08-08T10:00:00Z"
}
```

**True/False Question**
```json
{
  "questionId": "q_def456",
  "examId": "exam_001",
  "questionType": "true_false",
  "questionText": "The Earth is flat.",
  "correctAnswer": false,
  "marks": 1,
  "orderIndex": 1,
  "feedbackType": "instant",
  "createdAt": "2024-08-08T10:00:00Z"
}
```

**Short Answer Question**
```json
{
  "questionId": "q_ghi789",
  "examId": "exam_001",
  "questionType": "short_answer",
  "questionText": "What is the capital of France?",
  "acceptedAnswers": ["Paris", "paris"],
  "caseSensitive": false,
  "charLimit": 50,
  "marks": 2,
  "orderIndex": 2,
  "feedbackType": "hidden",
  "createdAt": "2024-08-08T10:00:00Z"
}
```

**Essay Question with Image and Rubric**
```json
{
  "questionId": "q_jkl012",
  "examId": "exam_001",
  "questionType": "essay",
  "questionText": "Analyze the following image and discuss...",
  "imageUrl": "https://storage.googleapis.com/...",
  "imageAltText": "Historical photograph from 1920",
  "minWords": 200,
  "maxWords": 500,
  "requiresManualGrading": true,
  "rubric": {
    "criteria": [
      {
        "id": "analysis",
        "name": "Analysis Depth",
        "description": "Depth of analysis and critical thinking",
        "maxPoints": 3
      },
      {
        "id": "evidence",
        "name": "Use of Evidence",
        "description": "Support with examples from image",
        "maxPoints": 2
      }
    ],
    "totalPoints": 5
  },
  "marks": 5,
  "orderIndex": 3,
  "feedbackType": "hidden",
  "createdAt": "2024-08-08T10:00:00Z"
}
```

---

## 4. Backward Compatibility Strategy

### 4.1 Migration Approach

**Phase 1: Coexistence**
- Legacy MCQ questions work as-is (no database migration required)
- Add `questionType: 'mcq'` field to all questions in code (defensive reading)
- New questions include `questionType` field explicitly

**Phase 2: Runtime Compatibility**
- Question loading functions detect missing `questionType` and default to `'mcq'`
- Answer validation works with both legacy and new formats
- UI components gracefully handle all question types

**Phase 3: Gradual Migration (Optional)**
- Batch migration script adds `questionType` field to existing questions
- Can run on-demand without affecting functionality

### 4.2 Defensive Reading Pattern

```typescript
// When loading questions from Firestore
export async function getQuestions(examId: string): Promise<Question[]> {
  const q = query(
    collection(db, 'exams', examId, 'questions'),
    orderBy('orderIndex', 'asc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    
    // Backward compatibility: default to MCQ if type not specified
    if (!data.questionType) {
      data.questionType = 'mcq';
    }
    
    return {
      questionId: doc.id,
      ...data
    } as Question;
  });
}
```

---

## 5. Implementation Steps

### Phase 1: Types & Interfaces (✓ This Document)
1. Define `Question` union type with all subtypes
2. Define `Answer` union type with all subtypes
3. Create type guards and validation utilities
4. Update `firestore.rules` for new collections

### Phase 2: Firestore Layer (Next)
1. Update question creation functions for each type
2. Update answer saving/loading for each type
3. Add essay grading collection operations
4. Add rubric management functions

### Phase 3: UI Components (Next)
1. Create generic `QuestionRenderer` component
2. Build type-specific question components
3. Extend `QuestionCard` for new types
4. Add essay submission UI

### Phase 4: Validation & Scoring (Next)
1. Implement answer validation for all types
2. Update scoring algorithm
3. Add essay grading workflow
4. Update leaderboard calculation

### Phase 5: Testing & Migration (Next)
1. Unit tests for each question type
2. Integration tests for end-to-end flow
3. Migration script for legacy data (optional)
4. Performance testing with mixed question types

---

## 6. Required Firestore Rule Updates

```firestore
// Allow read/write for authenticated users on new essay collection
match /essays/{document=**} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && 
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superadmin'];
  allow update: if request.auth.uid == resource.data.gradedBy || 
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superadmin'];
}

// Allow read/write for rubrics
match /rubrics/{document=**} {
  allow read: if request.auth != null;
  allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superadmin'];
}
```

---

## 7. Database Versioning for Offline Support

```typescript
// Update IndexedDB version strategy
const DB_VERSION = 5;  // Increment from current v4

// New object stores for offline
const ESSAYS_STORE = 'essays';
const ESSAY_ANSWERS_STORE = 'essay_answers';
const RUBRICS_STORE = 'rubrics';
```

---

## 8. Scoring & Validation Logic

```typescript
// Calculate score considering all question types
export async function calculateScore(
  attemptId: string,
  questions: Question[]
): Promise<{ totalScore: number; maxScore: number; breakdown?: Record<string, number> }> {
  const answers = await getAnswers(attemptId);
  
  let totalScore = 0;
  let maxScore = 0;
  const breakdown: Record<string, number> = {};
  
  for (const question of questions) {
    maxScore += question.marks;
    const answer = answers.find(a => a.questionId === question.questionId);
    
    if (!answer) continue;
    
    if (question.questionType === 'essay' && answer.questionType === 'essay') {
      // Essays: use manual score if available, otherwise 0
      if ((answer as EssayAnswer).manualScore !== undefined) {
        totalScore += (answer as EssayAnswer).manualScore!;
      }
      breakdown['essay'] = (breakdown['essay'] || 0) + ((answer as EssayAnswer).manualScore || 0);
    } else {
      // Auto-gradable questions
      if (answer.isCorrect) {
        totalScore += question.marks;
      }
      breakdown[question.questionType] = (breakdown[question.questionType] || 0) + (answer.isCorrect ? question.marks : 0);
    }
  }
  
  return { totalScore, maxScore, breakdown };
}
```

---

## 9. Summary of Changes

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Question Types** | MCQ only | MCQ, TF, Short Answer, Essay |
| **Type Safety** | Weak (options array for all) | Strong (discriminated unions) |
| **Images** | Not supported | Supported (all types + per-option) |
| **Grading** | Auto-only | Auto + Manual (essay) |
| **Backward Compat** | N/A | 100% maintained |
| **New Collections** | - | `essays`, `rubrics` |
| **Answer Model** | Single format | Type-specific formats |
| **Validation** | Index comparison | Type-aware validation |

---

## 10. Next Steps

1. **Get approval** on this model architecture
2. **Implement Phase 2**: Firestore layer functions
3. **Build Phase 3**: UI components for all question types
4. **Create Phase 4**: Validation & scoring engine
5. **Execute Phase 5**: Testing & migration
