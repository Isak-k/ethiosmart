# Phase 3 QA Review Report - ExamPro System

**Review Date:** August 8, 2026  
**Reviewer Role:** Senior QA Engineer  
**Review Scope:** Bugs, type errors, Firestore issues, offline behavior, timer logic, navigation flows

---

## Critical Issues Found

### 1. **CRITICAL: savePracticeAnswer() Called with Invalid selectedOptionIndex**

**Location:** `src/pages/TakeExam.tsx` - `handleClearCurrentAnswer()`

**Issue:**
```javascript
await savePracticeAnswer(attemptId, questionId, -1, false, 0);
```

When clearing an answer, the code passes `-1` as selectedOptionIndex. However, `savePracticeAnswer()` stores this value directly without validation.

**Impact:**
- Cleared answers show as "answered with option -1" in offline storage
- Results calculation fails because `-1` is not a valid option index
- Data corruption in practice exam attempts

**Fix:**
Pass `null` instead of `-1`:
```javascript
await savePracticeAnswer(attemptId, questionId, null, false, 0);
```

Update `savePracticeAnswer()` in `offline-practice-exam.ts` to handle null values:
```javascript
export async function savePracticeAnswer(
  attemptId: string,
  questionId: string,
  selectedOptionIndex: number | null,  // Accept null
  isCorrect: boolean,
  marks: number
): Promise<void> {
  const db = await initPracticeStores();

  const answer: PracticeAnswer = {
    attemptId,
    questionId,
    selectedOptionIndex: selectedOptionIndex ?? -1,  // Only convert null to -1 for storage
    isCorrect,
    marks,
  };
  // ... rest of function
}
```

---

### 2. **CRITICAL: Practice Mode Result Calculation Bug**

**Location:** `src/lib/offline-practice-exam.ts` - `submitPracticeExam()`

**Issue:**
```javascript
const skippedAnswers = attempt.maxScore - answers.length;
```

This calculates skipped count as `maxScore - answers.length`, but `maxScore` is a number (points), not question count.

**Impact:**
- Skipped question count is wildly incorrect
- Example: maxScore=100, answered=5 → skipped = 95 (wrong!)
- Results page shows incorrect statistics
- Incorrect pass/fail determination if based on skipped count

**Fix:**
```javascript
// Store question count during attempt creation
const skippedAnswers = attempt.totalQuestions - answers.length;
```

Or calculate from questions:
```javascript
const totalQuestions = questions.length; // Pass from caller
const skippedAnswers = totalQuestions - answers.length;
```

---

### 3. **HIGH: Practice Mode Answer Validation Missing**

**Location:** `src/pages/TakeExam.tsx` - `handleSelectOption()` 

**Issue:**
Practice mode incorrectly marks answers as correct/incorrect during selection:
```javascript
const isCorrect = question && optionIndex !== null && optionIndex === question.correctOptionIndex;
const marks = question?.marks || 0;

await savePracticeAnswer(
  attemptId,
  questionId,
  optionIndex ?? -1,
  isCorrect || false,  // <-- Marked immediately
  marks
);
```

But when submitted via `submitPracticeExam()`, it recalculates:
```javascript
answers.forEach((answer) => {
  if (answer.isCorrect) {  // <-- Using pre-stored value
    totalScore += answer.marks;
    correctAnswers++;
  }
});
```

**Problem:** If the logic differs between save and submit, scores will be wrong.

**Fix:** Don't mark answers as correct/incorrect during save. Only calculate on submission:
```javascript
await savePracticeAnswer(
  attemptId,
  questionId,
  optionIndex ?? -1,
  false,  // Don't determine correctness yet
  0       // Don't assign marks yet
);
```

Update `submitPracticeExam()` to calculate correctness:
```javascript
answers.forEach((answer) => {
  const question = questions.find(q => q.questionId === answer.questionId);
  if (question && answer.selectedOptionIndex === question.correctOptionIndex) {
    totalScore += question.marks;
    correctAnswers++;
  }
});
```

---

### 4. **HIGH: Offline Answer Clearing Doesn't Handle Practice Answers**

**Location:** `src/pages/TakeExam.tsx` - `handleClearCurrentAnswer()`

**Issue:**
```javascript
if (examType === 'practice') {
  await savePracticeAnswer(attemptId, questionId, -1, false, 0);
}
```

For practice exams, there's no way to actually **delete** the answer from IndexedDB. It just overwrites with -1.

**In `submitPracticeExam()`:**
```javascript
answers.forEach((answer) => {
  if (answer.isCorrect) {  // <-- -1 will never equal correctOptionIndex, so always marked wrong
    totalScore += answer.marks;
    correctAnswers++;
  }
});
```

**Impact:**
- Clearing an answer in practice mode still counts as "answered (wrong)"
- Student can't truly skip a question in practice mode
- Skipped count will be 0 even if student clears all answers

**Fix:**
1. Actually delete the answer from IndexedDB:
```javascript
if (examType === 'practice') {
  const db = await initOfflineDB();
  const transaction = db.transaction(PRACTICE_ANSWERS_STORE, 'readwrite');
  const store = transaction.objectStore(PRACTICE_ANSWERS_STORE);
  store.delete([attemptId, questionId]);
}
```

2. Update `submitPracticeExam()` to handle missing answers as skipped:
```javascript
if (selectedOptionIndex === null || selectedOptionIndex === undefined || selectedOptionIndex === -1) {
  skippedCount++;
} else if (...) {
  // Check correctness
}
```

---

### 5. **HIGH: Timer Shows in Practice Mode When Not Configured**

**Location:** `src/pages/TakeExam.tsx` - Timer rendering logic

**Issue:**
```javascript
{(practiceMode === 'exam' || (practiceMode === 'practice' && practiceConfig?.timerEnabled)) && (
  <ExamTimer ... />
)}
```

If `practiceConfig` is `null` or undefined, the timer won't show in exam mode.

**Scenario:**
- Practice exam created without configuration
- User selects exam mode
- `practiceConfig` is `null`
- Timer doesn't appear
- User has unlimited time in "timed exam"

**Fix:**
```javascript
const shouldShowTimer = practiceMode === 'exam' || 
  (practiceMode === 'practice' && practiceConfig?.timerEnabled === true);

{shouldShowTimer && (
  <ExamTimer
    durationMinutes={
      practiceMode === 'exam' 
        ? (exam?.durationMinutes || 60)
        : (practiceConfig?.timeLimit ? Math.ceil(practiceConfig.timeLimit / 60) : exam?.durationMinutes || 60)
    }
    startedAt={startedAt}
    onTimeUp={submitExam}
  />
)}
```

---

### 6. **HIGH: Mode Selection Doesn't Validate Practice Config**

**Location:** `src/pages/TakeExam.tsx` - `handleModeSelected()`

**Issue:**
```javascript
const handleModeSelected = (mode: 'practice' | 'exam', customTimeLimit?: number) => {
  setPracticeMode(mode);
  if (customTimeLimit && mode === 'exam' && exam) {
    sessionStorage.setItem(`exam-custom-time-${exam.examId}`, customTimeLimit.toString());
  }
  startExam(mode);
};
```

If `practiceConfig` is missing or invalid, the dialog still appears but may not work correctly.

**Fix:**
```javascript
const handleModeSelected = (mode: 'practice' | 'exam', customTimeLimit?: number) => {
  // Validate that practice config exists if needed
  if (mode === 'exam' && !practiceConfig?.timeLimit) {
    toast({
      title: "Error",
      description: "Exam mode requires a configured time limit",
      variant: "destructive",
    });
    return;
  }
  
  setPracticeMode(mode);
  if (customTimeLimit && mode === 'exam') {
    sessionStorage.setItem(`exam-custom-time-${exam.examId}`, customTimeLimit.toString());
  }
  startExam(mode);
};
```

---

### 7. **MEDIUM: Unused Imports Clutter Code**

**Location:** `src/pages/TakeExam.tsx`

**Issue:**
```javascript
import {
  AlertTriangle,  // <-- Not used
  CheckCircle,    // <-- Not used
  AlertCircle,    // <-- Not used
  Check,          // <-- Not used
  // ... more unused
} from "lucide-react";

import { Label } from "@/components/ui/label";  // <-- Not used
```

**Fix:** Remove unused imports to improve bundle size and readability.

---

### 8. **MEDIUM: Unused State Variables**

**Location:** `src/pages/TakeExam.tsx`

**Issue:**
```javascript
const [isOnline, setIsOnline] = useState(navigator.onLine);      // <-- Never used after setup
const [isOfflineMode, setIsOfflineMode] = useState(false);       // <-- Set but never checked
const [isModePractice, setIsModePractice] = useState(null);      // <-- Set but never used (undefined variable)
const [tr] = useState(t => t);                                   // <-- Defined but not used
```

**Impact:**
- Dead code increases bundle size
- Makes code harder to maintain
- Developers confused about what state is actually used

**Fix:** Remove unused state or implement the feature if intended.

---

### 9. **MEDIUM: Password Verification Doesn't Trim Input**

**Location:** `src/pages/TakeExam.tsx` - `verifyPassword()`

**Issue:**
```javascript
const verifyPassword = () => {
  if (!exam) return false;
  
  if (!exam.accessPassword?.trim()) {
    return true; // No password required
  }

  if (!enteredPassword) {  // <-- Not trimmed
    setPasswordError("Password is required");
    return false;
  }

  if (enteredPassword !== exam.accessPassword) {  // <-- Comparing untrimmed to trimmed
    setPasswordError("Incorrect password");
    return false;
  }
```

**Impact:**
- User enters password with trailing space, gets rejected
- User frustration with "incorrect password"

**Fix:**
```javascript
const trimmedPassword = enteredPassword.trim();

if (!trimmedPassword) {
  setPasswordError("Password is required");
  return false;
}

if (trimmedPassword !== exam.accessPassword?.trim()) {
  setPasswordError("Incorrect password");
  return false;
}
```

---

### 10. **MEDIUM: Offline Attempt ID Generation Not Unique Enough**

**Location:** `src/pages/TakeExam.tsx` - `startExam()`

**Issue:**
```javascript
attemptId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

Using `Date.now()` + weak random means if two users create attempts in the same millisecond on the same device, collision possible.

**Fix:**
```javascript
attemptId = `offline_${user.uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

Or use crypto:
```javascript
const randomId = crypto.randomUUID();
attemptId = `offline_${Date.now()}_${randomId}`;
```

---

### 11. **MEDIUM: ExamTimer Not Handling Edge Cases**

**Location:** `src/components/exam/ExamTimer.tsx`

**Issue:**
```javascript
const calculateTimeLeft = () => {
  const now = new Date();
  const endTime = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
  const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
  return remaining;
};
```

**Problems:**
1. If `durationMinutes` is 0, timer shows infinite or NaN
2. If `startedAt` is in the future, timer could show negative before adjustment
3. No handling for system clock changes

**Fix:**
```javascript
const calculateTimeLeft = () => {
  if (durationMinutes <= 0) return 0;
  
  const now = new Date();
  const endTime = new Date(startedAt.getTime() + Math.max(0, durationMinutes) * 60 * 1000);
  const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
  
  // Add grace period for rounding
  if (remaining === 0 && (endTime.getTime() - now.getTime()) > 0) {
    return 1;
  }
  
  return remaining;
};
```

---

### 12. **MEDIUM: QuestionCard Feedback Logic Confusing**

**Location:** `src/components/exam/QuestionCard.tsx`

**Issue:**
```javascript
const shouldShowFeedback = mode === 'practice' && selectedOption !== null;

// Show feedback ONLY in practice mode (not for normal exams or exam mode)
const showFeedback = shouldShowFeedback;
const showResults = isSubmitted; // Only show results after submission
```

**Problem:**
- `showFeedback` only used in practice mode
- In exam mode with `isSubmitted=false`, shows selected state but not feedback (correct)
- But if button disabled with `showFeedback || (isPracticeExam && selectedOption !== null)`, logic becomes unclear

**Issue in rendering:**
```javascript
disabled={isSubmitted || showFeedback || (isPracticeExam && selectedOption !== null)}
```

This disables the button when:
1. Exam submitted (correct)
2. Feedback showing (correct)
3. Practice exam with answer (redundant with showFeedback)

**Fix:** Simplify:
```javascript
const shouldDisableButton = isSubmitted || (mode === 'practice' && selectedOption !== null);
```

---

### 13. **MEDIUM: Firestore Rules Allow Excessive Read Access**

**Location:** `firestore.rules`

**Issue:**
```javascript
// --- Exams Collection ---
match /exams/{examId} {
  allow read: if isAuthenticated();  // <-- Any auth user can read ANY exam
}
```

**Risk:**
- Students could see all exams, including hidden/future exams
- Students could see other departments' exams
- Sensitive exam metadata exposed

**Fix:**
```javascript
match /exams/{examId} {
  allow read: if isAuthenticated() && (
    isAdmin() ||
    resource.data.departmentId == getUserDepartment(request.auth.uid) ||
    resource.data.isPublished == true
  );
}
```

---

### 14. **MEDIUM: Missing Validation for Question Count**

**Location:** `src/pages/TakeExam.tsx` & `src/lib/offline-practice-exam.ts`

**Issue:**
```javascript
const maxScore = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
attemptId = await createPracticeAttempt(exam.examId, user.uid, maxScore);
```

If `questions` is empty, `maxScore` is 0. Attempt created successfully with 0 points.

**Fix:**
```javascript
if (!questions || questions.length === 0) {
  toast({
    title: "Error",
    description: "This exam has no questions",
    variant: "destructive",
  });
  return;
}

const maxScore = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
```

---

### 15. **MEDIUM: Navigation Flow Doesn't Handle Resume State**

**Location:** `src/pages/TakeExam.tsx` - `loadExamAndCheckAttempts()`

**Issue:**
```javascript
// Find incomplete attempt to resume
const incompleteAttempt = attempts.find(a => !a.isSubmitted);
if (incompleteAttempt) {
  // Resume existing attempt
  setAttemptId(incompleteAttempt.attemptId);
  setStartedAt(incompleteAttempt.startedAt?.toDate?.() || new Date(incompleteAttempt.startedAt));
  
  // If practice exam, load the mode from config
  if (loadedExam.examType === 'practice') {
    setPracticeMode(loadedExam.practiceMode || 'practice');
  }

  // Load previous answers
  await loadPreviousAnswers(incompleteAttempt.attemptId);
  setViewMode('exam');
```

**Problems:**
1. No check if attempt is too old (stale resume)
2. Doesn't validate if student still has access to exam
3. No confirmation dialog before resuming (silent resume might surprise user)
4. Password check skipped for resumed attempts

**Fix:**
```javascript
const incompleteAttempt = attempts.find(a => !a.isSubmitted);
if (incompleteAttempt) {
  // Check if attempt is stale (> 24 hours old)
  const attemptAge = Date.now() - (incompleteAttempt.startedAt?.seconds ? incompleteAttempt.startedAt.seconds * 1000 : Date.now());
  if (attemptAge > 24 * 60 * 60 * 1000) {
    // Attempt expired, start fresh
    setAnswers(new Map());
  } else {
    // Resume
    setAttemptId(incompleteAttempt.attemptId);
    // ... rest of resume
    
    // Show confirmation if desired
    toast({
      title: "Resume Exam",
      description: "Your previous attempt has been resumed",
    });
  }
}
```

---

## Type Safety Issues

### 16. **Type Error: PracticeModeType Not Used**

**Location:** Import statement - `src/pages/TakeExam.tsx`

```javascript
import type { ..., PracticeModeType } from "@/integrations/firebase/types";
```

`PracticeModeType` is imported but never used. Should either be used or removed.

---

## Firestore Data Persistence Issues

### 17. **Offline Storage Not Handling Timestamps Correctly**

**Location:** `src/lib/offline-storage.ts` vs `src/lib/offline-practice-exam.ts`

**Issue:**
```javascript
// offline-practice-exam.ts
export interface PracticeAttempt {
  startedAt: number;
  submittedAt: number | null;
  // ...
}

// But in offline-storage.ts for normal attempts
interface OfflineAttempt {
  startedAt: Date;
  submittedAt: Date | null;
}
```

**Impact:**
- Inconsistent timestamp types across offline modules
- Calculations might use wrong types
- Results page could display incorrectly

**Fix:** Standardize on either `number` (milliseconds) or `Date` objects:
```javascript
// Standardize to number (milliseconds since epoch)
export interface PracticeAttempt {
  startedAt: number;
  submittedAt: number | null;
  createdAt: number;
}
```

---

## Navigation Flow Issues

### 18. **No Navigation Guard on Results Pages**

**Location:** Navigation from exam to results

**Issue:**
```javascript
navigate(`/dashboard/exam-results/${attemptId}`, {
  state: {
    result,
    examTitle: exam.title,
    mode: 'exam',
    isPracticeExam: true,
  },
});
```

Navigation happens but there's no validation of the state on results page. If user directly navigates to `/dashboard/exam-results/123`, it might fail or show blank page.

**Current Results Page Fallback:**
```javascript
const result = location.state?.result || {
  attemptId: attempt.attemptId,
  // ... constructs from attempt
};
```

This is good, but could have null reference errors.

**Fix:**
```javascript
if (!result) {
  return (
    <DashboardLayout>
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Results Not Found</h1>
        <p className="text-muted-foreground">
          The results for this attempt could not be loaded.
        </p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    </DashboardLayout>
  );
}
```

---

## Best Practice Violations

### 19. **Missing Error Boundaries**

Exams have many potential failure points but no error boundaries to gracefully handle crashes.

**Recommendation:**
Wrap exam content in error boundary:
```javascript
<ErrorBoundary fallback={<ExamErrorFallback />}>
  <TakeExam />
</ErrorBoundary>
```

---

### 20. **No Exam Attempt Timeout Validation**

**Issue:** Student could leave exam open for days, then submit. No validation of maximum duration.

**Fix in submitExam():**
```javascript
const maxAllowedTime = exam.durationMinutes * 2 * 60 * 1000; // 2x duration
const actualTime = Date.now() - startedAt.getTime();

if (actualTime > maxAllowedTime) {
  toast({
    title: "Exam Expired",
    description: "This attempt took too long and has been invalidated",
    variant: "destructive",
  });
  return;
}
```

---

## Summary

| Severity | Count | Categories |
|----------|-------|-----------|
| **CRITICAL** | 3 | Data corruption, incorrect calculations |
| **HIGH** | 5 | Validation, timer, clearing answers |
| **MEDIUM** | 10+ | Code quality, UX, security |

### Immediate Actions Required

1. ✅ Fix `savePracticeAnswer()` to accept `null` for cleared answers
2. ✅ Fix skipped answer calculation in `submitPracticeExam()`
3. ✅ Fix answer validation logic (don't mark correct/wrong on save)
4. ✅ Implement proper answer deletion for practice mode
5. ✅ Validate practice config before showing exam mode timer
6. ✅ Remove unused imports and state variables
7. ✅ Implement Firestore read security rules
8. ✅ Add validation for empty question sets

---

## Test Scenarios to Verify

- [ ] Clear answer in practice mode → skipped count correct in results
- [ ] Create practice exam without config → timer doesn't show in practice mode
- [ ] Resume incomplete exam → state restored correctly
- [ ] Submit exam after 2x duration → submission rejected
- [ ] Practice exam mode → instant feedback shows
- [ ] Exam mode → no feedback until submission
- [ ] Normal exam → timer shows only if configured
- [ ] Offline only → all data persists locally
- [ ] Old incomplete attempt (>24h) → shows as expired
- [ ] Empty exam (0 questions) → shows error message

