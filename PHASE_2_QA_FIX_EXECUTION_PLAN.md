# Phase 2: QA Fix Execution Plan

**Status:** Phase 2 Implementation Complete → QA Issues Discovered → Fix Required

**Timeline:** 3-4 days (P0+P1 fixes: 6-8 hours, full fixes: 2 days)

---

## Executive Summary

Phase 2 code is well-structured but has **20 QA issues** blocking release:
- **3 CRITICAL (P0):** Data corruption, wrong scoring
- **5 HIGH (P1):** Functional bugs preventing testing
- **12 MEDIUM/LOW (P2-P3):** Code quality, edge cases

**Decision:** Fix P0+P1 immediately (6 hours), full fixes before release (2 days).

---

## Critical Issues (P0) - Fix NOW

### Issue #1: savePracticeAnswer() Storing Invalid -1
**Impact:** Data corruption, incorrect results
**Lines:** TakeExam.tsx:635, offline-practice-exam.ts:90

```typescript
// WRONG (Current):
function handleClearAnswer() {
  setSelectedAnswer(-1);  // ❌ Invalid value
  savePracticeAnswer(attemptId, questionId, -1);
}

// RIGHT (Fixed):
function handleClearAnswer() {
  setSelectedAnswer(null);  // ✅ Proper null value
  deletePracticeAnswer(attemptId, questionId);  // Delete, don't save
}
```

**Fix:** 2 files, ~15 lines

---

### Issue #2: Skipped Count Calculation Bug
**Impact:** Wrong results, wrong percentages
**Line:** offline-practice-exam.ts:165

```typescript
// WRONG (Current):
const skippedAnswers = attempt.maxScore - answers.length;
// Example: maxScore=100, answers=3 → skipped=97 ❌

// RIGHT (Fixed):
const skippedAnswers = questionCount - answers.length;
// Example: questionCount=5, answers=3 → skipped=2 ✅
```

**Fix:** 1 file, ~5 lines

---

### Issue #3: Answer Correctness Marked on Save (Should Be Submit Only)
**Impact:** Inconsistent scoring
**Lines:** TakeExam.tsx:535-560, offline-practice-exam.ts:165-180

```typescript
// WRONG (Current):
const handleAnswerChange = (answer) => {
  savePracticeAnswer(attemptId, questionId, answer);  // ← Calculates correctness here
  // Later: submitPracticeExam() recalculates differently
  // Result: Scores might not match
};

// RIGHT (Fixed):
const handleAnswerChange = (answer) => {
  savePracticeAnswer(attemptId, questionId, answer);  // ← Just save, no marking
};

const handleSubmit = async () => {
  const result = submitPracticeExam(attemptId, questions);  // ← Mark correct here only
  // Result: Single source of truth for scoring
};
```

**Fix:** 2 files, ~20 lines

---

## High Priority Issues (P1) - Fix Before Testing

### Issue #4: Answer Clearing Not Deleting Data
**Impact:** Can't skip questions, skipped count wrong
**Line:** TakeExam.tsx:625

```typescript
// WRONG: Saves with -1 marker
// RIGHT: Delete the answer record
```

**Fix:** 1 file, ~8 lines

---

### Issue #5: Timer Missing in Exam Mode (No Config)
**Impact:** Exam has no time limit when it should
**Line:** TakeExam.tsx:480-500

```typescript
// Validate that timer should show when:
// - practiceMode === 'exam'
// - practiceConfig?.timerEnabled === true
// - practiceConfig?.timeLimit > 0
```

**Fix:** 1 file, ~10 lines

---

### Issue #6: Practice Config Validation Missing
**Impact:** Could crash if config missing
**Line:** TakeExam.tsx:466

```typescript
// Before showing mode selection, validate:
// - practiceConfig exists
// - Has required fields
// - Values are sensible
```

**Fix:** 1 file, ~15 lines

---

## Execution Plan

### Day 1: P0 Fixes (2-3 hours)

**Step 1: Issue #1 - Fix -1 Value** (30 min)
```
□ Read: TakeExam.tsx:625-640 (answer clearing)
□ Read: offline-practice-exam.ts:85-100 (save function)
□ Modify: Change -1 to null
□ Add: Delete function in offline-practice-exam
□ Test: Clear answer → null in DB, not -1
```

**Step 2: Issue #2 - Fix Skipped Count** (20 min)
```
□ Read: offline-practice-exam.ts:160-170 (calc)
□ Track: Where questionCount comes from
□ Modify: Fix formula
□ Test: Verify calculation with examples
```

**Step 3: Issue #3 - Fix Marking Logic** (20 min)
```
□ Read: Where isCorrect is calculated
□ Remove: Marking on save
□ Add: Mark only on submit
□ Test: Save doesn't calculate, submit does
```

### Day 1: P1 Fixes (3-4 hours)

**Step 4: Issue #4 - Fix Answer Deletion** (20 min)
```
□ Implement delete function
□ Call on clear answer
□ Verify skipped count now correct
```

**Step 5: Issue #5 - Validate Timer** (30 min)
```
□ Add timer validation
□ Show/hide based on config
□ Test: Timer shows in exam mode
```

**Step 6: Issue #6 - Validate Config** (30 min)
```
□ Add config validation before mode selection
□ Show error if missing required fields
□ Test: Can't proceed without config
```

### After P0+P1: Run Regression Tests

**Critical Test Scenarios:**
```
1. Practice mode: Select mode → answer questions → feedback → submit → correct score
2. Exam mode: Select mode → answer questions → NO feedback → timer → submit → results
3. Clear answer: Answer Q → clear Q → submit → shows skipped
4. Resume: Start → save → close → reopen → resume with answers preserved
5. Timer: Exam mode → timer visible → counts down → auto-submit at zero
```

---

## Files to Modify (P0+P1)

| File | Issues | Lines | Est. Time |
|------|--------|-------|-----------|
| `src/pages/TakeExam.tsx` | #1, #4, #5, #6, #9, #10 | ~80 | 2 hrs |
| `src/lib/offline-practice-exam.ts` | #1, #2, #3 | ~35 | 1 hr |
| `src/components/exam/QuestionCard.tsx` | #12 | ~10 | 20 min |
| `src/components/exam/ExamTimer.tsx` | #11 | ~15 | 20 min |
| `firestore.rules` | #13 | ~10 | 20 min |

**Total P0+P1: ~150 lines, 6-8 hours**

---

## Verification Checklist

After each fix, verify:

- [ ] Issue #1: No more -1 values in IndexedDB
- [ ] Issue #2: Skipped count = questionCount - answered count
- [ ] Issue #3: Correctness only calculated on submit
- [ ] Issue #4: Clearing answer removes it from DB
- [ ] Issue #5: Timer shows in exam mode with config
- [ ] Issue #6: Config validation prevents incomplete setup
- [ ] No console errors
- [ ] All types correct
- [ ] Tests still pass

---

## Phase 2 Completion Criteria

**Before marking Phase 2 complete:**

- [x] Code implemented ✅
- [ ] P0 issues fixed (3/3)
- [ ] P1 issues fixed (5/5)
- [ ] P2 cleanup done (recommended)
- [ ] Regression tests pass (5/5)
- [ ] No console errors
- [ ] Code review passed
- [ ] QA sign-off obtained

**Current Status:** Code ✅ → Issues Found → Fixing...

---

## Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| P0 Fixes | #1, #2, #3 | 2-3 hrs | 🔮 Next |
| P1 Fixes | #4, #5, #6 | 2-3 hrs | 🔮 After P0 |
| P2 Cleanup | #7-13 | 2-3 hrs | 🔮 Optional |
| Regression Testing | Run all tests | 2 hrs | 🔮 After fixes |
| **TOTAL** | **Phase 2 Complete** | **~8-10 hrs** | 🔮 By day 2 |

---

## Success Metrics

**Phase 2 considered complete when:**

✅ All P0 issues fixed and tested
✅ All P1 issues fixed and tested
✅ 5 critical test scenarios pass
✅ No data corruption possible
✅ Scoring is accurate
✅ QA sign-off obtained

**Current:** In progress → Targeting completion by EOD tomorrow

---

## What's Next

1. **Immediately:** Start with Issue #1 (savePracticeAnswer -1 value)
2. **Then:** Fix Issues #2, #3 (scoring logic)
3. **Then:** Fix Issues #4, #5, #6 (timer/config)
4. **Then:** Run regression tests
5. **Then:** QA sign-off
6. **Then:** Phase 3 (UI Components)

**Expected:** Phase 2 fully fixed within 24 hours
