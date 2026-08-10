# QA Review - Priority Fix List

## P0: CRITICAL - Do Not Release (Data Corruption)

### Issue #1: savePracticeAnswer() Invalid -1 Value
**File:** `src/pages/TakeExam.tsx` + `src/lib/offline-practice-exam.ts`
**Lines:** TakeExam.tsx:635, offline-practice-exam.ts:90

**What's broken:**
- When student clears answer, code saves `-1` as selectedOptionIndex
- Invalid data stored in IndexedDB
- Results calculation fails

**Test to fail:**
1. Create practice exam
2. Select answer to question 1
3. Click "Clear Answer"
4. Submit exam
5. **Expected:** Skipped count = 1. **Actual:** Might crash or count incorrectly

**Files to modify:**
- `src/pages/TakeExam.tsx` - Change `-1` to `null`
- `src/lib/offline-practice-exam.ts` - Handle `null` in savePracticeAnswer

---

### Issue #2: Skipped Answer Calculation Bug
**File:** `src/lib/offline-practice-exam.ts:165`

**What's broken:**
```javascript
const skippedAnswers = attempt.maxScore - answers.length;
```
Should be question count, not points.

**Test to fail:**
1. Create practice exam with 5 questions, 20 marks each (maxScore=100)
2. Answer 2 questions
3. Submit
4. **Expected:** Skipped = 3. **Actual:** Skipped = 95

**Files to modify:**
- `src/lib/offline-practice-exam.ts` - Fix calculation
- `src/lib/offline-practice-exam.ts` - Store question count in attempt

---

### Issue #3: Answer Correctness Marked on Save, Not Submit
**File:** `src/pages/TakeExam.tsx:535-560` + `src/lib/offline-practice-exam.ts:165-180`

**What's broken:**
- Correctness calculated when answer is saved
- But `submitPracticeExam()` recalculates from wrong stored values
- Inconsistent scoring possible

**Test to fail:**
1. Create practice exam
2. Answer multiple questions
3. View results
4. **Expected:** All scores match calculation. **Actual:** Might be wrong if logic differs

**Files to modify:**
- `src/pages/TakeExam.tsx` - Don't calculate correctness on save
- `src/lib/offline-practice-exam.ts` - Calculate correctness only on submit

---

## P1: HIGH - Fix Before Testing (Functional Bugs)

### Issue #4: Offline Answer Clearing Not Deleting Data
**File:** `src/pages/TakeExam.tsx:625`

**What's broken:**
- Clear answer saves with `-1` marker instead of deleting
- Can't truly skip questions in practice mode
- `skippedCount` calculation wrong

**Test to fail:**
1. Practice exam, answer Q1
2. Clear answer for Q1
3. Submit
4. **Expected:** Q1 shows as skipped. **Actual:** Shows as answered

**Files to modify:**
- `src/pages/TakeExam.tsx` - Actually delete the answer record

---

### Issue #5: Timer Missing in Exam Mode (No Config)
**File:** `src/pages/TakeExam.tsx:480-500`

**What's broken:**
- If `practiceConfig` is null, timer won't show in exam mode
- User takes "timed" exam with no time limit

**Test to fail:**
1. Create practice exam WITHOUT configuring time limit
2. User selects exam mode
3. **Expected:** Timer visible. **Actual:** No timer

**Files to modify:**
- `src/pages/TakeExam.tsx` - Validate timer should show

---

### Issue #6: Practice Config Validation Missing
**File:** `src/pages/TakeExam.tsx:466`

**What's broken:**
- Mode selection dialog appears even without proper config
- Could crash if config required for calculations

**Test to fail:**
1. Create practice exam
2. Don't set time limit
3. User selects exam mode
4. **Expected:** Error or default. **Actual:** Might fail

**Files to modify:**
- `src/pages/TakeExam.tsx` - Validate before mode selection

---

## P2: MEDIUM - Fix Before Full Testing (Data Quality)

### Issue #7: Unused Imports Clutter
**File:** `src/pages/TakeExam.tsx:45-62`

**What's broken:**
- Bundle includes unused code
- Harder to maintain

**Files to modify:**
- Remove unused: AlertTriangle, CheckCircle, AlertCircle, Check, Label

---

### Issue #8: Dead State Variables
**File:** `src/pages/TakeExam.tsx:128-138`

**What's broken:**
- `isOnline`, `isOfflineMode`, `isModePractice`, `tr` not used
- Dead code

**Files to modify:**
- Remove or implement: isOnline, isOfflineMode
- Remove unused: tr function

---

### Issue #9: Password Not Trimmed
**File:** `src/pages/TakeExam.tsx:341`

**What's broken:**
- User enters "password " (trailing space) → rejected
- Poor UX

**Test to fail:**
1. Set exam password: "test"
2. Enter password: "test " (with space)
3. **Expected:** Accepted. **Actual:** Rejected

**Files to modify:**
- `src/pages/TakeExam.tsx` - Trim password input

---

### Issue #10: Offline Attempt ID Not Unique Enough
**File:** `src/pages/TakeExam.tsx:382`

**What's broken:**
- Two simultaneous attempts could collide
- Uses Date.now() + weak random

**Files to modify:**
- `src/pages/TakeExam.tsx` - Include userId in ID

---

### Issue #11: Timer Edge Cases Not Handled
**File:** `src/components/exam/ExamTimer.tsx:16-25`

**What's broken:**
- Duration of 0 → undefined behavior
- System clock changes → incorrect time

**Files to modify:**
- `src/components/exam/ExamTimer.tsx` - Validate duration > 0

---

### Issue #12: QuestionCard Button Logic Unclear
**File:** `src/components/exam/QuestionCard.tsx:58`

**What's broken:**
- Multiple conditions for disabling button (redundant)
- Hard to read

**Files to modify:**
- Simplify button disable logic

---

### Issue #13: Firestore Rules Too Permissive
**File:** `firestore.rules:16`

**What's broken:**
- Any authenticated user can read any exam
- Security risk

**Files to modify:**
- `firestore.rules` - Add department/visibility checks

---

### Issue #14: No Validation for Empty Questions
**File:** `src/pages/TakeExam.tsx:206`

**What's broken:**
- Exam with 0 questions allowed
- `maxScore` = 0
- Attempt creation succeeds

**Test to fail:**
1. Create exam with 0 questions
2. Start exam
3. **Expected:** Error. **Actual:** Exam starts

**Files to modify:**
- `src/pages/TakeExam.tsx` - Validate question count

---

### Issue #15: No Resumed Attempt Validation
**File:** `src/pages/TakeExam.tsx:225-245`

**What's broken:**
- Resumed attempts not validated
- Old attempts (days old) resumed silently
- Password check skipped for resume

**Test to fail:**
1. Start exam, save answer
2. Don't submit for 25 hours
3. Refresh page
4. **Expected:** Expired or warning. **Actual:** Resumed silently

**Files to modify:**
- `src/pages/TakeExam.tsx` - Add age check, password re-verification

---

## P3: LOW - Code Quality (Nice to Have)

### Issue #16: PracticeModeType Unused Import
Remove from type imports.

### Issue #17: Timestamp Inconsistency
Standardize to `number` (milliseconds) across modules.

### Issue #18: No Navigation Guard on Results
Add null checks and fallback UI.

### Issue #19: No Error Boundaries
Wrap exam in error boundary.

### Issue #20: No Attempt Timeout
Add maximum duration validation on submit.

---

## Fix Order (Recommended)

1. **Issue #1** (P0) - Fix savePracticeAnswer -1 value
2. **Issue #2** (P0) - Fix skipped calculation
3. **Issue #3** (P0) - Fix answer marking logic
4. **Issue #4** (P1) - Fix answer deletion
5. **Issue #5** (P1) - Fix timer validation
6. **Issue #6** (P1) - Fix config validation
7. **Issue #14** (P2) - Add empty question check
8. **Issue #15** (P2) - Add resumed attempt validation
9. **Issue #7-13, #16-20** (P2-P3) - Other fixes

---

## Testing Checklist After Fixes

- [ ] **Practice Mode:** Select answer → shows feedback → scores correct
- [ ] **Exam Mode:** Select answer → NO feedback → score shows on submit
- [ ] **Clear Answer:** Removes answer completely → shows as skipped in results
- [ ] **Resume Exam:** Old attempt rejected, new attempt offered
- [ ] **Timer:** Shows in exam mode, respects configuration
- [ ] **Config Validation:** Can't select mode without proper config
- [ ] **Password:** "test " (with space) accepted as "test"
- [ ] **Offline:** All data persists in IndexedDB
- [ ] **Empty Exam:** Shows error, doesn't create attempt
- [ ] **Normal vs Practice Exams:** Both work correctly end-to-end

