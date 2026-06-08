# Exam Type Implementation Guide

## Overview

This guide explains how to properly implement and test the exam type system (normal vs practice exams with practice/exam modes).

---

## What Was Refactored

### Old TakeExam.tsx Issues
- Mixed practice exam logic with normal exam logic
- No clear separation of concerns
- Mode selector not shown for practice exams
- Results routing not based on exam type
- Inconsistent feedback handling

### New TakeExam-refactored.tsx Improvements
✓ Clean state management with `ViewMode` types
✓ Intelligent exam loading using `loadExamData`
✓ Practice mode selector dialog (only for practice exams)
✓ Separate feedback engines (practice vs exam mode)
✓ Result routing based on exam type and mode
✓ Better offline-first handling
✓ Clear code organization

---

## Implementation Steps

### Step 1: Backup Original File
```bash
# Keep the old file for reference
mv src/pages/TakeExam.tsx src/pages/TakeExam-old.tsx
```

### Step 2: Deploy Refactored File
```bash
# Use the refactored version
mv src/pages/TakeExam-refactored.tsx src/pages/TakeExam.tsx
```

### Step 3: Verify Build
```bash
# Check for TypeScript errors
npm run type-check

# Or run the dev server
npm run dev
```

---

## Testing the System

### Test Case 1: Normal Exam (examType = 'normal')

**Setup:**
```typescript
// In Firebase Firestore - exams collection
{
  examId: 'exam-1',
  title: 'Math Quiz',
  durationMinutes: 30,
  maxAttempts: 3,
  examType: 'normal',  // ← Key field
  accessPassword: 'secret123',  // Optional
  shuffleQuestions: true,
  shuffleOptions: true,
}
```

**Expected Flow:**
1. Student visits exam
2. See start dialog with exam info
3. If password required → ask for password
4. Timer starts (30 min countdown)
5. Take exam normally
6. Submit exam
7. Score calculated by Firebase
8. Redirect to results page

**Verify:**
- [ ] Start dialog shows correctly
- [ ] Timer counts down
- [ ] No mode selector shown
- [ ] Questions have no instant feedback
- [ ] Submit → redirects to `/dashboard/results`

---

### Test Case 2: Practice Exam - Practice Mode

**Setup:**
```typescript
// In Firebase Firestore - exams collection
{
  examId: 'exam-2',
  title: 'English Practice',
  durationMinutes: 0,  // No timer in practice mode
  maxAttempts: 999,
  examType: 'practice',  // ← Key field
  practiceMode: 'practice',  // Default mode
  practiceConfig: {
    mode: 'practice',
    showFeedback: true,
    showExplanations: true,
    timerEnabled: false,
    passingScore: 50,
  },
  shuffleQuestions: false,
  shuffleOptions: false,
}

// Questions should have explanations
{
  questionId: 'q-1',
  questionText: 'What is 2+2?',
  options: ['3', '4', '5', '6'],
  correctOptionIndex: 1,
  explanation: 'Basic arithmetic: 2+2=4',  // ← Important
  marks: 5,
  feedbackType: 'instant',
}
```

**Expected Flow:**
1. Student visits practice exam
2. See mode selector dialog
   - Option 1: Practice Mode (instant feedback)
   - Option 2: Exam Mode (timed, no feedback)
3. Student selects "Practice Mode"
4. Answer a question
5. See feedback: "✓ Correct! You earned 5 marks"
6. See explanation: "Basic arithmetic: 2+2=4"
7. Continue to next question
8. Submit exam
9. See detailed results with all answers

**Verify:**
- [ ] Mode selector shown
- [ ] No timer displayed
- [ ] Instant feedback shows after selecting answer
- [ ] Explanation shown below feedback
- [ ] Results show detailed answer review
- [ ] Can retry exam
- [ ] Score not counted in leaderboard (offline only)

---

### Test Case 3: Practice Exam - Exam Mode

**Setup:**
Same as Test Case 2, but user selects "Exam Mode"

**Expected Flow:**
1. Student selects "Exam Mode"
2. Timer appears (if configured with timeLimit)
3. Answer questions
4. NO feedback shown during exam
5. NO explanations shown
6. Submit or timer runs out
7. See summary-only results:
   - Correct: 8
   - Wrong: 1
   - Skipped: 1
   - Pass/Fail status
8. NO individual question details shown

**Verify:**
- [ ] Timer displays and counts down
- [ ] No feedback shown while answering
- [ ] No explanations visible
- [ ] Results show only summary counts
- [ ] No answer review section
- [ ] Cannot see which questions were correct/wrong

---

### Test Case 4: Offline Exam

**Setup:**
1. Download a practice exam for offline use
2. Go offline (disable internet)

**Expected Flow:**
1. Student can still open the exam
2. Mode selector shows (if practice exam)
3. Can answer all questions
4. Submit exam
5. Results calculated locally
6. Saved to IndexedDB
7. When online again → synced to Firebase (optional)

**Verify:**
- [ ] Exam loads from IndexedDB
- [ ] No Firebase calls made
- [ ] Results saved locally
- [ ] Offline badge shown
- [ ] Works after connectivity restored

---

## Code Architecture

### ViewMode States

```typescript
type ViewMode = 'loading' | 'start' | 'password' | 'mode-select' | 'exam' | 'results';

// loading: Initial state, loading exam data
// start: Show start dialog (normal exams)
// password: Show password entry dialog
// mode-select: Show practice/exam mode selector (practice exams only)
// exam: Taking the exam
// results: Showing results
```

### State Flow Diagram

```
┌─────────────┐
│   loading   │
└──────┬──────┘
       │
    Exam loaded?
    │
    ├─ YES ─→ Has max attempts?
    │          ├─ NO ─→ Check password?
    │          │         ├─ YES ─→ password
    │          │         └─ NO ─→ Check examType?
    │          │                   ├─ practice ─→ mode-select
    │          │                   └─ normal ─→ start
    │          │
    │          └─ YES ─→ Redirect to results
    │
    └─ NO ─→ Error, redirect to dashboard

During Exam:
    mode-select/start ─→ [User starts] ─→ exam ─→ [User submits] ─→ results
```

### Decision Tree: Which Engine to Use

```typescript
if (examType === 'practice') {
  // Practice exam
  if (practiceMode === 'practice') {
    // Use practice-mode-engine
    // - Show instant feedback
    // - Show explanations
    // - No timer
    // - Detailed results
  } else {
    // Use exam-mode-engine (practiceMode === 'exam')
    // - No feedback during exam
    // - No explanations
    // - Timer active
    // - Summary-only results
  }
} else {
  // Normal exam (examType === 'normal')
  // - Standard exam behavior
  // - Timer active
  // - Results after submission
}
```

---

## Key Components Integration

### 1. Exam Loader (`useExamData`)

```typescript
const { exam, questions, practiceConfig, source, isOfflineMode } = await loadExamData(examId);

// This intelligently:
// - Checks if exam is downloaded locally
// - Uses offline for practice exams
// - Falls back to Firebase if needed
// - Returns where data came from
```

### 2. Practice Mode Selector

```tsx
<PracticeModeDialog
  open={viewMode === 'mode-select'}
  examTitle={exam?.title}
  durationMinutes={exam?.durationMinutes}
  onSelect={(mode) => startExam(mode)}  // 'practice' or 'exam'
  onCancel={() => navigate("/dashboard")}
/>
```

### 3. Practice Mode Feedback

```typescript
// When user selects answer in practice mode
if (examType === 'practice' && practiceMode === 'practice') {
  const feedback = getPracticeModeFeedback(question, selectedIndex);
  setPracticeModeFeedback(prev => new Map(prev).set(questionId, feedback));
  // Show feedback in UI
}
```

### 4. Result Routing

```typescript
if (examType === 'practice') {
  // Practice exam: show results inline
  setExamResult(result);
  setViewMode('results');
} else {
  // Normal exam: redirect to dashboard
  navigate("/dashboard/results");
}
```

---

## Common Issues & Solutions

### Issue 1: Mode selector not showing for practice exams

**Solution:**
Check that:
1. `examType` is set to `'practice'` in Firestore
2. View mode transitions to `'mode-select'` after password/start
3. `<PracticeModeDialog>` component is imported and rendered

```typescript
// In loadExam effect:
if (examData.examType === 'practice') {
  setViewMode('mode-select');  // ← Should show dialog
}
```

### Issue 2: Instant feedback not showing

**Solution:**
Check that:
1. `practiceMode === 'practice'`
2. Question has `feedbackType: 'instant'`
3. `getPracticeModeFeedback()` is called after answer
4. Feedback state is updated: `setPracticeModeFeedback(...)`
5. Feedback is rendered in JSX

```typescript
// In QuestionCard render:
{examType === 'practice' && practiceMode === 'practice' && 
  practiceModeFeedback.has(questionId) && (
    <div className="feedback">
      {practiceModeFeedback.get(questionId)?.feedback}
    </div>
  )
}
```

### Issue 3: Timer not showing for exam mode

**Solution:**
Check that:
1. `practiceMode === 'exam'`
2. `<ExamTimer>` component is rendered
3. Duration is set: `durationMinutes` on exam
4. Timer is conditional: `{examType === 'normal' && <ExamTimer ... />}`

```typescript
// In header:
{examType === 'normal' && (
  <ExamTimer
    durationMinutes={exam?.durationMinutes || 60}
    startedAt={startedAt}
    onTimeUp={() => submitExam()}
  />
)}
```

### Issue 4: Results showing detail when should be summary-only

**Solution:**
Check that:
1. `viewMode === 'results'`
2. Correct result type being displayed
3. Practice mode results vs exam mode results separated

```typescript
if (practiceMode === 'practice') {
  // Show detailed results
} else {
  // Show summary-only
}
```

---

## Database Setup

### Required Firestore Schema

```typescript
// exams collection
{
  examId: string;
  examType: 'normal' | 'practice';  // ← REQUIRED
  practiceMode?: 'practice' | 'exam';  // ← For practice exams
  practiceConfig?: {
    mode: 'practice' | 'exam';
    showFeedback: boolean;
    showExplanations: boolean;
    timerEnabled: boolean;
    timeLimit?: number;
    passingScore: number;
  };
  durationMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  accessPassword?: string;
  // ... other fields
}

// exams/{examId}/questions subcollection
{
  questionId: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  marks: number;
  feedbackType: 'instant' | 'hidden';
  explanation?: string;  // ← For practice exams
  // ... other fields
}
```

---

## Testing Checklist

### Before Deployment

- [ ] Normal exams work without mode selector
- [ ] Practice exams show mode selector
- [ ] Practice mode shows instant feedback
- [ ] Exam mode hides feedback
- [ ] Practice mode shows detailed results
- [ ] Exam mode shows summary-only results
- [ ] Timer works for exam mode
- [ ] No timer for practice mode
- [ ] Offline functionality works
- [ ] Password protection works
- [ ] Question shuffling works
- [ ] Answer saving works
- [ ] Submission calculates scores correctly
- [ ] Results display correct data

### After Deployment

- [ ] Monitor error logs
- [ ] Check user feedback
- [ ] Verify performance (no slow loads)
- [ ] Check offline sync functionality
- [ ] Monitor database costs
- [ ] Check mobile responsiveness

---

## Migration Path

### Phase 1: Backup
```bash
cp src/pages/TakeExam.tsx src/pages/TakeExam-backup.tsx
```

### Phase 2: Deploy Refactored Version
```bash
cp src/pages/TakeExam-refactored.tsx src/pages/TakeExam.tsx
```

### Phase 3: Beta Testing
- Invite subset of users
- Test both exam types
- Collect feedback

### Phase 4: Full Rollout
- Deploy to all users
- Monitor closely
- Keep backup ready

### Phase 5: Cleanup
- Remove old files after stable
- Update documentation
- Archive old code

---

## Performance Optimization

### Optimization 1: Memoize Question Data
```typescript
const processedQuestions = useMemo(() => {
  if (!questions.length) return [];
  // Shuffle and process...
}, [questions, exam?.shuffleQuestions]);
```

### Optimization 2: Lazy Load Results
```typescript
const [examResult, setExamResult] = useState<any>(null);
// Load results only when transitioning to results view
useEffect(() => {
  if (viewMode === 'results' && !examResult) {
    // Load result data
  }
}, [viewMode]);
```

### Optimization 3: Batch Save Answers
```typescript
// Instead of saving each answer immediately,
// batch them every 5 seconds
useEffect(() => {
  const timer = setInterval(() => {
    // Save all unsaved answers at once
  }, 5000);
  return () => clearInterval(timer);
}, []);
```

---

## Debugging

### Enable Debug Logging

```typescript
// In TakeExam.tsx
const DEBUG = true;

const log = (message: string, data?: any) => {
  if (DEBUG) {
    console.log(`[TakeExam] ${message}`, data);
  }
};

// Usage:
log('Loaded exam', { examType, practiceMode });
log('Answer selected', { questionId, optionIndex, isCorrect });
log('Transitioning to view', { from: viewMode, to: 'results' });
```

### Check Redux DevTools

If using Redux, track state changes:
```
viewMode: loading → start → exam → results
examType: null → 'practice'
practiceMode: null → 'practice'
answers: Map(0) → Map(5) → Map(10)
```

### Verify LocalStorage/IndexedDB

```javascript
// In browser console:
// Check IndexedDB
indexedDB.databases().then(dbs => console.log(dbs));

// Check specific exam data
const db = await openDB('exam-db');
const exam = await db.get('exams', 'exam-123');
console.log(exam);
```

---

## Next Steps

1. **Deploy refactored TakeExam.tsx**
2. **Create test suite** for exam types
3. **Monitor production** for errors
4. **Gather user feedback**
5. **Optimize performance** based on metrics
6. **Add analytics tracking** for usage
7. **Update admin dashboard** to show exam type
8. **Document API** for question developers

---

## Questions & Support

For issues:
1. Check Common Issues section above
2. Review code architecture
3. Check browser console for errors
4. Verify Firebase/IndexedDB data
5. Test with debug mode enabled
