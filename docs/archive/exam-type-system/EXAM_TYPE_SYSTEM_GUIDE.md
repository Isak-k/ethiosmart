# Exam Type System Guide

## Overview

The exam system uses two main concepts to determine behavior:

1. **Exam Type** (`examType`): Determines where exam data is stored
   - `'normal'` - Traditional exam, fetched from Firebase
   - `'practice'` - Practice exam, downloaded for 100% offline use

2. **Practice Mode** (`practiceMode`): Determines how the exam behaves during taking
   - `'practice'` - Instant feedback, show explanations, no time limit
   - `'exam'` - Timed, no feedback, summary-only results

---

## Type Definitions

### In `src/integrations/firebase/types.ts`

```typescript
export type ExamType = 'normal' | 'practice';
export type PracticeModeType = 'practice' | 'exam';

export interface PracticeExamConfig {
  mode: PracticeModeType;
  showFeedback: boolean;           // Practice mode: show if answer is correct
  showExplanations: boolean;       // Practice mode: show explanations
  timerEnabled: boolean;           // Exam mode: enable countdown timer
  timeLimit?: number;              // Exam mode: time in seconds
  passingScore: number;            // Percentage to pass (default 50)
}

export interface Exam {
  examId: string;
  title: string;
  // ... other fields
  examType?: ExamType;             // normal or practice
  practiceMode?: PracticeModeType; // practice or exam
  practiceConfig?: PracticeExamConfig;
  // ... other fields
}
```

---

## How Exam Type Flows Through the System

### 1. EXAM LOADING - `src/lib/exam-loader.ts`

The loader intelligently determines where to fetch from:

```
User Opens Exam (examId)
    ↓
loadExamData(examId)
    ├─ Check: Is exam downloaded locally? (isExamDownloaded)
    │   ├─ YES: Load from IndexedDB
    │   │   └─ Check exam.examType === 'practice'?
    │   │       ├─ YES: Use offline ✓
    │   │       └─ NO: Fall through to Firebase
    │   │
    │   └─ NO: Try Firebase
    │       ├─ Success: Load from Firebase
    │       └─ Failed: Fall back to offline if available
```

**Key Logic:**

```typescript
// Practice exams are ALWAYS preferred offline
if (!forceOnline && isExamDownloaded(examId)) {
  const offlineExam = await getOfflineExam(examId);
  if (offlineExam && offlineExam.examType === 'practice') {
    // ✓ Use offline
    return loadOfflineData();
  }
}

// Normal exams try Firebase first
const exam = await getExam(examId);
if (exam.examType === 'normal') {
  // Fetch from Firebase only
  return loadFirebaseData();
}
```

**Returns:**

```typescript
interface LoadedExamData {
  exam: Exam;                    // Exam metadata
  questions: Question[];         // Question data
  practiceConfig: PracticeExamConfig | null;
  source: 'offline' | 'firebase';
  isOfflineMode: boolean;
}
```

---

### 2. MODE SELECTION - `src/components/exam/PracticeModeSelector.tsx`

Only shows for **practice exams** (`examType === 'practice'`):

```
User Opens Practice Exam
    ↓
Show Practice Mode Dialog
    ├─ Option 1: Practice Mode
    │   ├─ Instant feedback ✓
    │   ├─ Show explanations ✓
    │   ├─ No time limit ✓
    │   └─ User learns at own pace
    │
    └─ Option 2: Exam Mode
        ├─ Countdown timer ⏱
        ├─ No instant feedback ✗
        ├─ No explanations ✗
        └─ Summary-only results

User Selects Mode → practiceMode = 'practice' or 'exam'
```

**Component:**

```tsx
<PracticeModeDialog
  open={showModeDialog}
  examTitle={exam.title}
  durationMinutes={exam.durationMinutes}
  onSelect={(mode) => startExam(mode)}  // 'practice' or 'exam'
/>
```

---

### 3. DURING EXAM - Based on Practice Mode

#### Practice Mode (`practiceMode === 'practice'`)

Uses **Practice Mode Engine** (`src/lib/practice-mode-engine.ts`):

```typescript
function getPracticeModeFeedback(question, selectedOptionIndex) {
  const isCorrect = selectedOptionIndex === question.correctOptionIndex;
  
  return {
    isCorrect,           // ✓ Always show
    feedback: "✓ Correct! You earned 5 marks",  // ✓ Always show
    explanation: question.explanation,          // ✓ Always show
    earnedMarks: isCorrect ? question.marks : 0,
    correctOption: question.correctOptionIndex,
  };
}

// Show feedback IMMEDIATELY after user selects an answer
```

**Result Display:** Detailed answer review with all details visible

```
Question 1: What is 2+2?
Your Answer: 4
✓ CORRECT! You earned 5 marks

Explanation: Basic arithmetic...

[Next Question] [Review Answer]
```

---

#### Exam Mode (`practiceMode === 'exam'`)

Uses **Exam Mode Engine** (`src/lib/exam-mode-engine.ts`):

```typescript
function calculateExamModeSummary(questions, answers, timeSpent) {
  // DO NOT show individual question feedback
  // Only count: Correct / Incorrect / Skipped
  
  return {
    totalQuestions: 10,
    correctCount: 8,      // ← Only these counts
    incorrectCount: 1,    // ← shown
    skippedCount: 1,      // ← 
    totalScore: 80,
    maxScore: 100,
    percentage: 80,
    passStatus: 'pass',
    timeSpentSeconds: 1200,
  };
}

// NO feedback during exam
```

**Result Display:** Summary only - no individual answer details

```
Exam Completed! ✓

Correct: 8
Wrong: 1
Skipped: 1

Score: 80/100 (80%)
Status: PASSED
```

---

## Decision Tree

```
Is it a Practice Exam?
│
├─ NO (examType === 'normal')
│   └─ Normal exam behavior
│       ├─ Fetch from Firebase
│       ├─ Standard timed exam
│       └─ Show results (may have feedback)
│
└─ YES (examType === 'practice')
    └─ Ask user to choose mode
        │
        ├─ PRACTICE MODE (practiceMode === 'practice')
        │   ├─ Load from offline storage
        │   ├─ Show instant feedback
        │   ├─ Show explanations
        │   ├─ No time limit (optional)
        │   └─ Detailed results with all info
        │
        └─ EXAM MODE (practiceMode === 'exam')
            ├─ Load from offline storage
            ├─ Enforce countdown timer
            ├─ Show no feedback during exam
            ├─ Show no explanations
            └─ Summary-only results (Correct/Wrong/Skipped)
```

---

## Data Flow Example

### Scenario: User Takes a Practice Exam

```
User navigates to exam list
    ↓
See exam with badge "Practice Exam"
    ↓
Click to open
    ↓
loadExamData('exam-123')
    ├─ Check: isExamDownloaded('exam-123') → true
    ├─ Load from IndexedDB
    └─ exam.examType = 'practice' ✓
    ↓
Show PracticeModeDialog
    ├─ Option: Practice Mode (Recommended)
    └─ Option: Exam Mode (Test Your Knowledge)
    ↓
User selects "Practice Mode"
    ↓
Start TakeExam component with:
  - exam (from offline)
  - questions (from offline)
  - practiceMode = 'practice'
  - practiceConfig from offline
    ↓
During exam:
  - User answers question 1
    ↓
    ├─ getPracticeModeFeedback()
    ├─ Show: ✓ CORRECT! You earned 5 marks
    ├─ Show: Explanation text
    └─ Save answer to offline storage
    ↓
  - User answers question 2 (maybe incorrect)
    ↓
    ├─ getPracticeModeFeedback()
    ├─ Show: ✗ INCORRECT. Answer: Option B
    ├─ Show: Explanation text
    └─ Save answer to offline storage
    ↓
User clicks "Submit"
    ↓
calculatePracticeModeResult()
    ├─ Total Score: 15/20
    ├─ Percentage: 75%
    ├─ Status: PASS
    └─ All answers with details
    ↓
Show PracticeModeResults component
    ├─ Question 1: ✓ CORRECT
    ├─ Question 2: ✗ INCORRECT
    ├─ ... all details visible
    └─ [Retry] [Back to Dashboard]
```

### Same Exam, Exam Mode

```
... (same as above until mode selection)
    ↓
User selects "Exam Mode"
    ↓
Show ExamTimer component (countdown active)
    ↓
During exam:
  - User answers question 1
    ├─ NO feedback shown ✗
    ├─ NO explanation shown ✗
    └─ Answer saved to offline
    ↓
  - User answers question 2
    ├─ NO feedback shown ✗
    ├─ NO explanation shown ✗
    └─ Answer saved to offline
    ↓
Timer runs out OR user clicks "Submit"
    ↓
calculateExamModeSummary()
    ├─ Correct: 8
    ├─ Wrong: 1
    ├─ Skipped: 1
    ├─ Total Score: 80/100
    └─ Status: PASS
    ↓
Show ExamModeSummary component
    ├─ Display ONLY summary counts
    ├─ NO individual question details
    └─ [Retry] [Back to Dashboard]
```

---

## Key Files & Their Roles

| File | Purpose | When Used |
|------|---------|-----------|
| `exam-loader.ts` | Determines exam source | When loading exam data |
| `PracticeModeSelector.tsx` | UI to choose mode | Only for practice exams |
| `practice-mode-engine.ts` | Instant feedback logic | When `practiceMode === 'practice'` |
| `exam-mode-engine.ts` | Summary-only logic | When `practiceMode === 'exam'` |
| `PracticeModeResults.tsx` | Detailed results UI | For practice mode results |
| `ExamModeSummary.tsx` | Summary results UI | For exam mode results |

---

## Configuration Storage

### In IndexedDB (`offline-storage.ts`)

```typescript
// Practice exam metadata stored with exam
{
  examId: 'exam-123',
  examType: 'practice',        // ← Identifies as practice
  practiceMode: 'practice',    // ← Default mode
  practiceConfig: {
    mode: 'practice',
    showFeedback: true,
    showExplanations: true,
    timerEnabled: false,
    passingScore: 50,
  }
}

// Questions also stored with feedback config
{
  questionId: 'q-1',
  feedbackType: 'instant',     // ← Shows during practice mode
  explanation: 'This is why...' // ← Shown in practice mode
}
```

---

## Summary

**Exam Type** (`examType`) controls:
- Where exam data comes from (offline vs Firebase)
- Whether mode selection is offered

**Practice Mode** (`practiceMode`) controls:
- User experience during the exam
- What feedback is shown
- Result display style

Together they enable:
- **Normal exams**: Traditional, Firebase-based
- **Practice exams in Practice Mode**: Learning-focused with feedback
- **Practice exams in Exam Mode**: Assessment-focused without feedback
