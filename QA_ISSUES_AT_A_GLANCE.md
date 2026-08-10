# QA Issues - Visual Summary

## 🔴 CRITICAL (3 Issues - FIX NOW)

```
┌─────────────────────────────────────────────────────────────┐
│ #1: INVALID ANSWER INDEX (-1)                               │
├─────────────────────────────────────────────────────────────┤
│ When: Student clears answer in practice exam               │
│ What: Saves -1 instead of null/deleting                    │
│ Where: TakeExam.tsx:635 → offline-practice-exam.ts         │
│ Impact: 🔴 Data corruption, wrong results                   │
│ Fix: Change -1 to null, handle in submitPracticeExam()     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ #2: SKIPPED COUNT CALCULATION BUG                           │
├─────────────────────────────────────────────────────────────┤
│ Formula: skipped = maxScore - answersLength                 │
│ Should Be: skipped = questionCount - answersLength          │
│ Example: 5 questions, 3 answered                            │
│   Current: skipped = 100 - 3 = 97 ❌                        │
│   Correct: skipped = 5 - 3 = 2 ✅                           │
│ Where: offline-practice-exam.ts:165                         │
│ Impact: 🔴 Incorrect results, wrong percentage              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ #3: ANSWER MARKING LOGIC INCONSISTENT                       │
├─────────────────────────────────────────────────────────────┤
│ Save Time:     Mark answer correct/wrong                    │
│ Submit Time:   Recalculate correctness                      │
│ Problem: Logic might differ → wrong score                   │
│ Where: TakeExam.tsx:535 & offline-practice-exam.ts:165      │
│ Impact: 🔴 Inconsistent scoring                             │
│ Fix: Only mark correct on submit, not on save               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🟠 HIGH (5 Issues - FIX BEFORE TESTING)

```
#4: Answer Clearing Doesn't Delete Data
    ├─ Problem: Saves -1 marker instead of deleting
    ├─ Result: Can't truly skip questions
    ├─ Where: TakeExam.tsx:625
    └─ Fix: Delete answer record from IndexedDB

#5: Timer Missing When No Config
    ├─ Problem: Timer doesn't show if practiceConfig is null
    ├─ Result: Unlimited time in "timed exam" mode
    ├─ Where: TakeExam.tsx:480-500
    └─ Fix: Validate and default timer settings

#6: No Mode Selection Validation
    ├─ Problem: Mode dialog appears without validation
    ├─ Result: Might crash if config missing
    ├─ Where: TakeExam.tsx:466
    └─ Fix: Validate config before showing dialog

#7: Password Not Trimmed
    ├─ Input: "test123 " (with space)
    ├─ Expected: Accepted
    ├─ Actual: Rejected
    ├─ Where: TakeExam.tsx:341
    └─ Fix: .trim() input before compare

#8: Offline ID Not Unique
    ├─ Pattern: `offline_${Date.now()}_${random}`
    ├─ Risk: Collision if simultaneous attempts
    ├─ Where: TakeExam.tsx:382
    └─ Fix: Include userId in ID
```

---

## 🟡 MEDIUM (10 Issues - FIX BEFORE RELEASE)

```
DEAD CODE (Bundle bloat, maintenance issues)
├─ #9: Unused imports (AlertTriangle, Check, Label, etc)
├─ #10: Unused state (isOnline, isOfflineMode, tr)
└─ Fix: Remove unused code

VALIDATION MISSING
├─ #11: No check for empty exams (0 questions)
│        └─ Problem: maxScore=0, results wrong
├─ #12: No validation for timer = 0
│        └─ Problem: Edge case not handled
└─ Fix: Add guards in startExam() and timer

NAVIGATION & STATE
├─ #13: Resume attempt not validated
│        ├─ Old attempts (>24h) resumed silently
│        ├─ No password re-check
│        └─ Fix: Add age check, re-verify password
└─ #14: Navigation guard missing on results page
         └─ Fix: Handle null state gracefully

SECURITY
├─ #15: Firestore rules too permissive
│        ├─ Any user can read any exam
│        └─ Need department/visibility checks
└─ Fix: Update firestore.rules

UI/UX CLARITY
├─ #16: QuestionCard button logic unclear
│        └─ Multiple redundant conditions
├─ #17: Timer edge cases (0 duration, clock changes)
│        └─ Fix: Validate inputs
└─ #18: Timestamp inconsistency
         ├─ Practice: number
         ├─ Normal: Date
         └─ Fix: Standardize on number (ms)
```

---

## 🔵 LOW (2 Issues - NICE TO HAVE)

```
#19: No Error Boundaries
     ├─ Risk: One component error crashes app
     └─ Fix: Wrap in error boundary

#20: No Attempt Timeout
     ├─ Risk: Student takes exam for 10 hours, submits
     └─ Fix: Reject attempts > 2x duration
```

---

## Impact Matrix

```
                LIKELIHOOD (how often occurs)
                Low      Medium    High
SEVERITY       ┌──────┬────────┬────────┐
High           │      │ #5,#6  │ #1,#2  │
(Data Loss)    │      │        │ #3,#4  │
               ├──────┼────────┼────────┤
Medium         │ #19  │ #7-18  │        │
(UX Issue)     │      │        │        │
               ├──────┼────────┼────────┤
Low            │ #20  │        │        │
(Minor Bug)    │      │        │        │
               └──────┴────────┴────────┘

Priority Zones:
🔴 FIX NOW (Top-right) → #1, #2, #3, #4, #5, #6
🟠 FIX SOON (Middle) → #7-18
🟡 FIX LATER (Bottom-left) → #19, #20
```

---

## Fix Dependency Graph

```
#1 (invalid -1)
    ↓
#2 (skipped calc)
    ↓
#3 (answer marking)
    ↓
#4 (answer deletion)
    ↓
Submit logic stable
    ↓
#5 (timer) + #6 (config validation)
    ↓
Navigation safe
    ↓
Other validations (#11, #13-18)
    ↓
Security rules (#15)
    ↓
Ready for testing
```

**Optimal Fix Order:**
1. #1 → #2 → #3 (Core scoring logic)
2. #4 (Answer management)
3. #5 → #6 (Timer/config)
4. #11 → #13 (Validation)
5. All others

---

## Test Failure Scenarios

```
Current State:
┌─────────────────────────────────────────────┐
│ Test Case: Practice Mode Scoring             │
├─────────────────────────────────────────────┤
│ Setup: 3 questions × 5 marks = 15 max       │
│ Action: Answer 2 correctly, skip 1          │
│ Expected: 10/15 = 67% ✅                     │
│ Actual:                                      │
│   ❌ skipped = 13 (bug #2)                   │
│   ❌ score calculation wrong (bug #3)        │
│   ❌ cleared answers show as -1 (bug #1)     │
│ Result: FAILS                                │
└─────────────────────────────────────────────┘

After Fixes:
┌─────────────────────────────────────────────┐
│ Test Case: Practice Mode Scoring             │
├─────────────────────────────────────────────┤
│ Setup: 3 questions × 5 marks = 15 max       │
│ Action: Answer 2 correctly, skip 1          │
│ Expected: 10/15 = 67% ✅                     │
│ Actual:                                      │
│   ✅ skipped = 1 (fixed #2)                  │
│   ✅ score = 10 (fixed #3)                   │
│   ✅ cleared answers deleted (fixed #1)      │
│ Result: PASSES ✅                            │
└─────────────────────────────────────────────┘
```

---

## Code Changes Required

```
Files to Modify (8 files):
├─ src/pages/TakeExam.tsx (5 issues)
│  ├─ Issue #1: Change -1 to null
│  ├─ Issue #5: Validate timer
│  ├─ Issue #6: Validate config
│  ├─ Issue #7: Trim password
│  └─ Issue #8: Improve ID uniqueness
│
├─ src/lib/offline-practice-exam.ts (2 issues)
│  ├─ Issue #1: Handle null in savePracticeAnswer
│  └─ Issue #2: Fix skipped calculation
│
├─ src/components/exam/QuestionCard.tsx (1 issue)
│  └─ Issue #12: Simplify button logic
│
├─ src/components/exam/ExamTimer.tsx (1 issue)
│  └─ Issue #11: Handle edge cases
│
├─ firestore.rules (1 issue)
│  └─ Issue #15: Add visibility checks
│
├─ src/lib/session-persistence.ts (1 issue - new)
│  └─ Issue #13: Validate attempt age
│
├─ Remove unused imports (multiple files)
│  └─ Issue #9: Clean up
│
└─ Add validation checks (throughout)
   └─ Issue #11, #14: New validations

Total Changed Lines: ~150-200
Estimated Time: 6-8 hours (with testing)
```

---

## Release Readiness Checklist

- [ ] Issue #1 fixed and tested
- [ ] Issue #2 fixed and tested
- [ ] Issue #3 fixed and tested
- [ ] Issue #4 fixed and tested
- [ ] Issue #5 fixed and tested
- [ ] Issue #6 fixed and tested
- [ ] Regression tests pass (12 scenarios)
- [ ] Security rules updated
- [ ] Dead code removed
- [ ] No console errors or warnings
- [ ] All tests green
- [ ] QA sign-off obtained

**Current:** 0/11 ✅  
**Status:** 🔴 NOT READY

---

## Quick Reference

**What's Broken?**
- Practice exam results calculation (wrong scores/counts)
- Offline answer clearing (data not deleted)
- Timer missing in some cases
- Input validation missing
- Firestore security too permissive

**Why Can't We Release?**
- 🔴 Data corruption risk (answers stored as -1)
- 🔴 Scoring wrong (skipped count bug)
- 🔴 Clearing doesn't work (offline data problem)
- 🟠 Security rules too open

**What's the Fix Timeline?**
- P0 fixes: 6 hours
- P1 fixes: 7.5 hours
- Regression test: 4 hours
- Buffer: 2 hours
- **Total: 3-4 days**



---

## Post-Fix Verification Checklist

**Before signing off, verify each fix:**

### Critical Fix Verification

- [ ] **Issue #1 Fixed:** savePracticeAnswer accepts null
  - Test: Clear answer → null stored → no -1 values in DB
  - Verify: Query IndexedDB, see null instead of -1

- [ ] **Issue #2 Fixed:** Skipped count correct
  - Test: Answer 3/5 questions → skipped = 2
  - Verify: Results page shows correct skipped count
  - Math: skipped ≠ maxScore value

- [ ] **Issue #3 Fixed:** Marking only on submit
  - Test: Save answers → don't mark yet → submit → calculate
  - Verify: Results match manual calculation
  - Check: savePracticeAnswer called with isCorrect=false

### High Priority Fix Verification

- [ ] **Issue #4 Fixed:** Answer deletion works
  - Test: Clear answer → deleted from DB → skipped count = 1
  - Verify: Submit shows as skipped, not answered

- [ ] **Issue #5 Fixed:** Timer shows in exam mode
  - Test: Exam mode → timer visible
  - Verify: Timer counts down, shows on all views

- [ ] **Issue #6 Fixed:** Config validation
  - Test: No config → mode selection prevented or warns
  - Verify: Can't start exam without proper setup

### Functional Tests

- [ ] **Practice Mode End-to-End**
  - Start exam → select mode → answer questions → see feedback → submit → results correct

- [ ] **Exam Mode End-to-End**
  - Start exam → select mode → answer questions → NO feedback → timer runs → auto-submit at timeout → summary-only results

- [ ] **Normal Exam End-to-End**
  - Start exam → answer questions → timer if configured → submit → see results

- [ ] **Offline Resume**
  - Start exam → close browser → reopen → resume with all answers preserved

- [ ] **Mobile Navigation**
  - Question navigator on mobile → hamburger menu works → click questions → navigates correctly

### Regression Tests

- [ ] All 12 QA test scenarios pass
- [ ] Old MCQs still work (backward compatible)
- [ ] No console errors or warnings
- [ ] Network offline mode works
- [ ] Performance acceptable (exams load < 3 sec)

### Security Verification

- [ ] Firestore rules updated
- [ ] Students can't see other students' attempts
- [ ] Students can't see unpublished exams
- [ ] Admins can see everything
- [ ] No unauthorized data access

### Code Quality Checks

- [ ] No unused imports (Issue #9)
- [ ] No dead state variables (Issue #10)
- [ ] All type errors resolved
- [ ] Console clean (no warnings)
- [ ] Linter passes

---

## Sign-Off Authority

**QA Engineer:** _________________________  Date: ___________

**Development Lead:** _____________________  Date: ___________

**Product Manager:** ____________________  Date: ___________

