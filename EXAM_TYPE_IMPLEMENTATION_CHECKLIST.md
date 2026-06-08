# Exam Type System - Implementation Checklist

## Phase 1: Component Replacement

- [ ] **Backup current TakeExam.tsx**
  ```bash
  cp src/pages/TakeExam.tsx src/pages/TakeExam.backup.tsx
  ```

- [ ] **Replace with refactored version**
  ```bash
  cp src/pages/TakeExam-refactored.tsx src/pages/TakeExam.tsx
  ```

- [ ] **Fix imports** - Verify all imports work
  - [ ] `PracticeModeType` - Check if correct import path
  - [ ] `ExamType` - Check if correct import path
  - May need to adjust icon imports from lucide-react

## Phase 2: QuestionCard Updates

### Update QuestionCard component to support modes

File: `src/components/exam/QuestionCard.tsx`

**Changes needed:**
- [ ] Add `mode` prop: `mode?: 'practice' | 'exam'`
- [ ] Hide feedback when `mode === 'exam'`
- [ ] Show explanation only when `mode === 'practice'`
- [ ] Show correct answer highlight only in practice mode
- [ ] Example:

```typescript
interface QuestionCardProps {
  // ... existing props
  mode?: 'practice' | 'exam';  // NEW
}

export function QuestionCard({
  mode = 'practice',
  // ... other props
}: QuestionCardProps) {
  const shouldShowFeedback = mode === 'practice';
  
  return (
    <div>
      {/* Question text */}
      
      {/* Options */}
      {options.map((option, idx) => (
        <div key={idx}>
          {/* Option button */}
          
          {/* Show feedback only in practice mode */}
          {shouldShowFeedback && selectedOption === idx && (
            <div className="mt-2 p-2 rounded bg-green-50 text-green-700">
              {idx === correctOption ? '✓ Correct!' : '✗ Incorrect'}
            </div>
          )}
        </div>
      ))}
      
      {/* Show explanation only in practice mode */}
      {shouldShowFeedback && explanation && (
        <div className="mt-4 p-3 rounded bg-blue-50 border border-blue-200">
          <p className="font-semibold text-blue-900">Explanation:</p>
          <p className="text-blue-800">{explanation}</p>
        </div>
      )}
    </div>
  );
}
```

## Phase 3: Result Components

### Verify PracticeModeResults exists and works

File: `src/components/exam/PracticeModeResults.tsx`

**Requirements:**
- [ ] Displays all question details
- [ ] Shows explanation for each question
- [ ] Shows user's answer vs correct answer
- [ ] Shows marks/score for each question
- [ ] Shows total score and percentage
- [ ] Shows pass/fail status
- [ ] Has [Retry] and [Back to Dashboard] buttons

### Verify ExamModeSummary exists and works

File: `src/components/exam/ExamModeSummary.tsx`

**Requirements:**
- [ ] Shows ONLY summary counts:
  - [ ] Correct count
  - [ ] Wrong count
  - [ ] Skipped count
- [ ] Shows total score and percentage
- [ ] Shows pass/fail status
- [ ] Shows time spent
- [ ] Does NOT show individual question details
- [ ] Has [Retry] and [Back to Dashboard] buttons

### Create result pages if needed

If pages don't exist, create:

- [ ] `src/pages/PracticeExamResults.tsx` or update existing
- [ ] `src/pages/ExamResults.tsx` or update existing

Routes should be:
```typescript
// In router config
<Route path="/dashboard/practice-results/:attemptId" element={<PracticeExamResults />} />
<Route path="/dashboard/exam-results/:attemptId" element={<ExamResults />} />
<Route path="/dashboard/results/:attemptId" element={<GeneralResults />} /> // fallback
```

## Phase 4: Testing

### Test Normal Exams

- [ ] Load normal exam from Firebase
- [ ] No mode selector appears
- [ ] Start dialog appears
- [ ] Password protection works (if set)
- [ ] Exam takes normally with feedback
- [ ] Timer works
- [ ] Submit navigates to `/dashboard/results`

### Test Practice Exams

#### Practice Mode
- [ ] Load practice exam from offline storage
- [ ] Mode selector dialog appears
- [ ] User selects "Practice Mode"
- [ ] Instant feedback appears after selecting answer
- [ ] Explanation text shows
- [ ] Correct answer highlighted
- [ ] No timer (or optional timer shows)
- [ ] Submit navigates to practice results page
- [ ] Practice results show all details

#### Exam Mode
- [ ] Load practice exam from offline storage
- [ ] Mode selector dialog appears
- [ ] User selects "Exam Mode"
- [ ] Timer starts and counts down
- [ ] NO feedback shown during exam
- [ ] NO explanation shown
- [ ] Answer selected but no visual confirmation
- [ ] Submit navigates to exam summary page
- [ ] Summary page shows only: Correct/Wrong/Skipped counts
- [ ] No individual question details shown

### Test Edge Cases

- [ ] Resume incomplete practice exam
  - [ ] Previous mode preserved
  - [ ] Previous answers loaded
  - [ ] Can continue from where left off

- [ ] Max attempts reached
  - [ ] User redirected with message
  - [ ] Counts both practice and exam modes

- [ ] Offline mode
  - [ ] Practice exams load from IndexedDB
  - [ ] Normal exams fall back to IndexedDB if Firebase fails
  - [ ] Answers save to IndexedDB
  - [ ] Submit works offline

- [ ] Password protection
  - [ ] Mode selector shows after password verified
  - [ ] Password required for both exam types

## Phase 5: Diagnostics

### Check browser console

- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Load times acceptable
- [ ] LocalStorage/IndexedDB operations logged

### Check Component Tree

- [ ] PracticeModeDialog component renders correctly
- [ ] QuestionCard receives `mode` prop correctly
- [ ] Timer component shows when expected
- [ ] Result navigation paths correct

## Phase 6: Performance Check

- [ ] Exam loading < 2 seconds
- [ ] Mode selector appears immediately after loading
- [ ] Feedback appears instantly after answer (practice mode)
- [ ] Submit completes < 5 seconds
- [ ] Navigation smooth with no lag

## Rollback Plan

If issues occur:

```bash
# Restore backup
cp src/pages/TakeExam.backup.tsx src/pages/TakeExam.tsx

# Hard reset changes
git checkout src/pages/TakeExam.tsx
```

## Deployment Steps

1. **Test locally**
   - [ ] All test cases pass
   - [ ] No console errors
   - [ ] Performance acceptable

2. **Create feature branch**
   ```bash
   git checkout -b feat/exam-type-system
   ```

3. **Commit changes**
   ```bash
   git add src/pages/TakeExam.tsx
   git add src/components/exam/QuestionCard.tsx  (if updated)
   git commit -m "Implement exam type system with practice/exam modes"
   ```

4. **Create Pull Request**
   - [ ] Add description with before/after behavior
   - [ ] Link to implementation guide
   - [ ] Request review

5. **Deploy to production**
   - [ ] All tests pass
   - [ ] Code review approved
   - [ ] Merge to main
   - [ ] Monitor for errors

## Common Issues & Solutions

### Issue: Mode selector not showing for practice exams

**Cause:** `exam.examType` not set to 'practice'

**Solution:**
1. Verify exam has `examType: 'practice'` in Firebase
2. Check that exam is downloaded locally
3. Verify `examType` loads correctly in `loadExamData()`

### Issue: Feedback showing in exam mode

**Cause:** `mode` prop not passed to QuestionCard

**Solution:**
1. Ensure TakeExam passes `mode={practiceMode}` to QuestionCard
2. Verify QuestionCard checks `mode` prop correctly
3. Check QuestionCard's condition for showing feedback

### Issue: Timer not showing

**Cause:** ExamTimer component not rendered

**Solution:**
1. Check conditional rendering: `{practiceMode === 'exam' || ...}`
2. Verify ExamTimer component exists and works
3. Check `durationMinutes` prop is passed correctly

### Issue: Results page blank

**Cause:** Route not configured or component missing

**Solution:**
1. Check route configuration in router
2. Verify result component exists
3. Check component receives state correctly via `useLocation()`

## Success Metrics

- [  ] 100% of practice exams show mode selector
- [  ] 0% of normal exams show mode selector
- [  ] 100% of exam mode submissions show summary-only results
- [  ] 100% of practice mode submissions show detailed results
- [  ] Feedback system: 0% feedback in exam mode, 100% in practice mode
- [  ] All attempts (both modes) counted toward max attempts
- [  ] Offline functionality: 100% of practice exams work offline
- [  ] User satisfaction: Practice mode + Exam mode users report accurate results

