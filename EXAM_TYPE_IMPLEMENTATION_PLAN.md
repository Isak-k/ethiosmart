# Exam Type System - Implementation Plan

## Overview

We need to refactor the TakeExam.tsx component to correctly handle two exam types with distinct behaviors.

## Current State Issues

1. **Mixing of concerns**: Practice exam logic and normal exam logic are intertwined
2. **Mode selection missing**: No mode selector for practice exams
3. **Result handling**: No differentiation between exam mode and practice mode results
4. **Feedback timing**: Unclear when feedback should be shown

## Implementation Steps

### Step 1: Enhance TakeExam.tsx

#### Add new state for mode selection
```typescript
const [practiceMode, setPracticeMode] = useState<PracticeModeType | null>(null);
const [showModeSelector, setShowModeSelector] = useState(false);
```

#### Update exam loading logic
- Check `exam.examType` to determine behavior
- For practice exams: ALWAYS load from offline
- For normal exams: Load from Firebase, fall back to offline

#### Add mode selector flow
- After exam loads, if `examType === 'practice'` and user hasn't selected mode
- Show PracticeModeDialog
- User selects 'practice' or 'exam' mode
- Set `practiceMode` state

### Step 2: Implement Exam Duration Handling

#### Practice Mode
- Duration: User-configurable, optional
- Timer: Show countdown (optional based on config)
- Default: No time limit, but show timer if configured

#### Exam Mode
- Duration: Enforced from exam.durationMinutes
- Timer: ALWAYS show countdown (required)
- No feedback until submission

### Step 3: Implement Answer Feedback

#### Practice Mode (`practiceMode === 'practice'`)
- Show instant feedback when answer selected
- Show explanation text
- Show correct answer highlight
- Save answer for review later

#### Exam Mode (`practiceMode === 'exam'`)
- NO feedback while exam is in progress
- NO explanation shown
- NO correct answer highlight
- Only save answer, show nothing

### Step 4: Implement Result Handling

#### Practice Mode Results
- Navigate to detailed results page
- Show all question details
- Show explanation for each question
- Allow review of answers

#### Exam Mode Results
- Navigate to summary-only results
- Show only: Correct/Wrong/Skipped counts
- NO individual question details
- Show pass/fail status
- Show score and percentage

### Step 5: Update Supporting Components

#### QuestionCard Component
- Add `mode` prop ('practice' | 'exam')
- Show feedback only in practice mode
- Hide explanations in exam mode

#### Result Components
- Create/update PracticeModeResults (detailed)
- Create/update ExamModeSummary (summary-only)

### Step 6: Refactor Result Navigation

Current:
```typescript
navigate("/dashboard/results");
```

New:
```typescript
// Practice exam in practice mode
navigate(`/practice-results/${attemptId}`, { 
  state: { isPracticeMode: true, isPracticeExam: true }
});

// Practice exam in exam mode
navigate(`/exam-results/${attemptId}`, { 
  state: { isPracticeMode: false, isPracticeExam: true }
});

// Normal exam
navigate(`/exam-results/${attemptId}`, { 
  state: { isPracticeMode: false, isPracticeExam: false }
});
```

## File Changes Required

### Primary
- `src/pages/TakeExam.tsx` - Complete refactoring

### Secondary
- `src/components/exam/QuestionCard.tsx` - Add mode awareness
- `src/components/exam/PracticeModeResults.tsx` - Detailed results
- `src/components/exam/ExamModeSummary.tsx` - Summary results

### Existing (no changes needed)
- `src/lib/exam-loader.ts` ✓
- `src/lib/practice-mode-engine.ts` ✓
- `src/lib/exam-mode-engine.ts` ✓
- `src/components/exam/PracticeModeSelector.tsx` ✓
- `src/lib/offline-practice-exam.ts` ✓

## Implementation Order

1. **Enhance state management in TakeExam.tsx**
   - Add practiceMode state
   - Add showModeSelector state
   - Update view modes

2. **Update exam loading logic**
   - Correct exam type detection
   - Proper offline/online handling

3. **Implement mode selector**
   - Show only for practice exams
   - Modal dialog selection

4. **Implement feedback display logic**
   - Based on practiceMode
   - Show/hide feedback conditionally

5. **Update result submission**
   - Call correct engine based on mode
   - Navigate to correct results page

6. **Update QuestionCard**
   - Add mode awareness
   - Conditional feedback display

7. **Verify result components**
   - Ensure they exist and work
   - Update if needed

## Key Decision Points

### Q: When to show mode selector?
**A:** After exam loads, if `examType === 'practice'` and no incomplete attempt exists

### Q: Can user switch modes mid-exam?
**A:** NO - once started, mode is locked. User can restart to choose different mode.

### Q: How to handle max attempts?
**A:** Count both practice and exam modes together (both are attempts)

### Q: How to handle offline?
**A:** 
- Practice exams: Always offline (predownloaded)
- Normal exams: Try Firebase, fall back to offline
- Mode selector: Show for both online and offline

### Q: How to handle timer?
**A:**
- Practice mode: Optional timer (based on config)
- Exam mode: Always required timer

## Data Flow Diagram

```
User opens exam
    ↓
Load exam metadata
    ├─ Check examType
    └─ Load questions
    ↓
Check for incomplete attempt
    ├─ YES: Resume with savedMode
    └─ NO: Show mode selector (if practice)
    ↓
Mode Selection (for practice exams)
    ├─ Practice: Instant feedback mode
    └─ Exam: Summary-only mode
    ↓
User takes exam
    ├─ Practice mode: Show feedback after each answer
    └─ Exam mode: Hide feedback, show timer
    ↓
User submits
    ├─ Practice mode → calculatePracticeModeResult
    └─ Exam mode → calculateExamModeSummary
    ↓
Show results
    ├─ Practice mode → Detailed results page
    └─ Exam mode → Summary results page
```

## Success Criteria

- [  ] Practice exams show mode selector
- [  ] Exam mode hides all feedback
- [  ] Practice mode shows instant feedback
- [  ] Results are correct type (detailed vs summary)
- [  ] Timer works correctly in both modes
- [  ] Offline exams work without Firebase
- [  ] Mode selection is persisted for incomplete attempts
- [  ] Max attempts counts all attempts (both modes)
