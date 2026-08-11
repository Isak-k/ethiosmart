# Testing Guide: Answer Review for All Question Types

## Complete Testing Checklist

### Test 1: MCQ Questions
**Setup:**
- Create a practice exam with 3 MCQ questions
- Correct answer index: 1
- Set marks: 5 marks per question
- Add explanations to each

**Test Scenarios:**

#### Scenario 1a: Correct MCQ Answer
1. Select option at index 1 (the correct answer)
2. Submit exam
3. Verify in results:
   - ✅ Green background
   - ✅ ✓ Correct badge
   - ✅ Shows: "Question 1" | "📋 MCQ" | "✓ Correct" | "5/5 marks"
   - ✅ Shows question text
   - ✅ Shows: "Your answer: [selected option]"
   - ✅ Shows: "Correct answer: [same option]"
   - ✅ Feedback: "Correct! You earned 5 marks"
   - ✅ Explanation displayed in collapsible section

#### Scenario 1b: Incorrect MCQ Answer
1. Select option at index 0 (wrong answer)
2. Submit exam
3. Verify in results:
   - ✅ Red background
   - ✅ ✗ Incorrect badge
   - ✅ Shows: "Question 1" | "📋 MCQ" | "✗ Incorrect" | "0/5 marks"
   - ✅ Shows question text
   - ✅ Shows: "Your answer: [selected option]"
   - ✅ Shows: "Correct answer: [correct option]"
   - ✅ Feedback: "Incorrect. The correct answer is: [option]"
   - ✅ Explanation displayed

#### Scenario 1c: Skipped MCQ
1. Do not select any option
2. Submit exam
3. Verify in results:
   - ✅ Gray background
   - ✅ ⏱ Skipped badge
   - ✅ Shows: "Question 1" | "📋 MCQ" | "Skipped"
   - ✅ NO marks display (skipped answers don't show marks)
   - ✅ Shows: "Your answer: Skipped"
   - ✅ NO "Correct answer" section
   - ✅ NO feedback or explanation

---

### Test 2: True/False Questions
**Setup:**
- Create a practice exam with 3 True/False questions
- Mix of True and False correct answers
- Set marks: 3 marks per question
- Add explanations

**Test Scenarios:**

#### Scenario 2a: Correct True/False
1. Select correct boolean value
2. Submit exam
3. Verify in results:
   - ✅ Green background
   - ✅ ✓ Correct badge
   - ✅ Shows: "Question 1" | "✓/✗ True/False" | "✓ Correct" | "3/3 marks"
   - ✅ Shows question text
   - ✅ Shows: "Your answer: [True or False]"
   - ✅ Shows: "Correct answer: [True or False]"
   - ✅ Feedback: "Correct! You earned 3 marks"
   - ✅ Explanation displayed

#### Scenario 2b: Incorrect True/False
1. Select wrong boolean value
2. Submit exam
3. Verify in results:
   - ✅ Red background
   - ✅ ✗ Incorrect badge
   - ✅ Shows: "Question 1" | "✓/✗ True/False" | "✗ Incorrect" | "0/3 marks"
   - ✅ Shows question text
   - ✅ Shows: "Your answer: [wrong value]"
   - ✅ Shows: "Correct answer: [correct value]"
   - ✅ Feedback: "Incorrect. The correct answer is: [correct value]"
   - ✅ Explanation displayed

#### Scenario 2c: Skipped True/False
1. Do not select any value
2. Submit exam
3. Verify in results:
   - ✅ Gray background
   - ✅ ⏱ Skipped badge
   - ✅ Shows: "Your answer: Skipped"
   - ✅ NO marks display

---

### Test 3: Short Answer Questions
**Setup:**
- Create practice exam with 3 short answer questions
- Set multiple acceptable answers: ["Paris", "paris", "City of Paris"]
- Case sensitivity: OFF (default)
- Exact match: OFF (default)
- Set marks: 4 marks per question
- Add explanations

**Test Scenarios:**

#### Scenario 3a: Correct Short Answer
1. Type an acceptable answer (e.g., "paris" matching "Paris")
2. Submit exam
3. Verify in results:
   - ✅ Green background
   - ✅ ✓ Correct badge
   - ✅ Shows: "Question 1" | "📝 Short Answer" | "✓ Correct" | "4/4 marks"
   - ✅ Shows question text
   - ✅ Shows: "Your answer: [typed text]"
   - ✅ Shows: "Expected answers: Paris  ·  paris  ·  City of Paris"
   - ✅ Feedback: "Correct! You earned 4 marks"
   - ✅ Explanation displayed

#### Scenario 3b: Incorrect Short Answer (Case Sensitive Test)
1. For case-sensitive question, type wrong case
2. Submit exam
3. Verify in results:
   - ✅ Red background
   - ✅ ✗ Incorrect badge
   - ✅ Shows: "Question 1" | "📝 Short Answer" | "✗ Incorrect" | "0/4 marks"
   - ✅ Shows: "Your answer: [typed text]"
   - ✅ Shows: "Expected answers: [list of accepted answers]"
   - ✅ Feedback: "Incorrect. Expected answers: [options]"

#### Scenario 3c: Partially Correct Short Answer
1. Type close but not exact answer
2. Submit exam
3. Verify in results:
   - ✅ Red background
   - ✅ Shows expected answers for learning

#### Scenario 3d: Skipped Short Answer
1. Leave text field empty
2. Submit exam
3. Verify in results:
   - ✅ Gray background
   - ✅ ⏱ Skipped badge
   - ✅ Shows: "Your answer: Skipped"
   - ✅ NO expected answers shown
   - ✅ NO marks display

---

### Test 4: Essay Questions
**Setup:**
- Create practice exam with 2 essay questions
- Question 1: No word limits
- Question 2: Min 100 words, Max 500 words
- Set marks: 10 marks per essay
- Add explanation

**Test Scenarios:**

#### Scenario 4a: Essay Within Word Limits
1. Type a valid essay (e.g., 250 words for question with 100-500 limits)
2. Submit exam
3. Verify in results:
   - ✅ Amber background
   - ✅ ⚠ Pending Review badge
   - ✅ Shows: "Question 1" | "📄 Essay" | "⚠ Pending Review"
   - ✅ NO marks display (not yet graded)
   - ✅ Shows full essay text in formatted box
   - ✅ Shows message: "This essay has been submitted and is awaiting manual grading by your educator. Your score will be updated once grading is complete."
   - ✅ Shows word count indicator during answering

#### Scenario 4b: Essay Below Minimum Word Count
1. Type essay with only 50 words (for question requiring min 100)
2. Submit exam
3. Verify in results:
   - ✅ Red background (insufficient)
   - ✅ Shows: "Question 1" | "📄 Essay" | "✗ Incorrect"
   - ✅ Feedback: "Your essay is too short. Minimum: 100 words, Your: 50 words"
   - ✅ Shows full essay text
   - ✅ Shows explanation

#### Scenario 4c: Essay Above Maximum Word Count
1. Type essay with 600 words (for question with max 500)
2. Submit exam
3. Verify in results:
   - ✅ Red background
   - ✅ Shows: "Question 1" | "📄 Essay" | "✗ Incorrect"
   - ✅ Feedback: "Your essay is too long. Maximum: 500 words, Your: 600 words"
   - ✅ Shows full essay text

#### Scenario 4d: Skipped Essay
1. Leave essay field empty
2. Submit exam
3. Verify in results:
   - ✅ Gray background
   - ✅ ⏱ Skipped badge
   - ✅ Shows: "Your answer: Skipped"
   - ✅ NO pending message

---

### Test 5: Mixed Question Types (Comprehensive)
**Setup:**
- Create exam with: 2 MCQ + 1 True/False + 1 Short Answer + 1 Essay = 5 total

**Answer Pattern:**
- MCQ 1: Correct ✓
- MCQ 2: Incorrect ✗
- True/False: Correct ✓
- Short Answer: Incorrect ✗
- Essay: Valid submission (pending)

**Expected Results:**
- Total Score: 5 + 3 + 0 = 8 marks (essays don't count until graded)
- Correct Answers: 2
- Incorrect Answers: 2
- Skipped Answers: 0
- Essays Pending: 1
- Percentage: 40% (8/20 marks)
- Pass Status: Fail (below 50%)

**Verify:**
1. ✅ Summary card shows "Keep Practicing!" (failed)
2. ✅ Shows "1 essay answer pending manual grading" notice
3. ✅ Stats show: Correct: 2, Incorrect: 2, Skipped: 0
4. ✅ Time spent displays correctly
5. ✅ Each question review shows:
   - MCQ 1: Green, Correct, explanation
   - MCQ 2: Red, Incorrect, correct answer shown
   - True/False: Green, Correct, explanation
   - Short Answer: Red, Incorrect, expected answers shown
   - Essay: Amber, Pending, full text shown

---

### Test 6: Edge Cases

#### 6a: All Questions Skipped
1. Skip every question
2. Submit exam
3. Verify in results:
   - ✅ Shows 0 correct, 0 incorrect, 5 skipped
   - ✅ All questions show gray backgrounds
   - ✅ Percentage: 0%
   - ✅ Pass Status: Fail

#### 6b: All Questions Correct
1. Answer all correctly
2. Submit exam
3. Verify in results:
   - ✅ Shows "Excellent! You Passed!"
   - ✅ All questions show green backgrounds
   - ✅ Percentage: 100%
   - ✅ Pass Status: Pass

#### 6c: Special Characters in Answers
- MCQ: Special chars in options
- Short Answer: Test with unicode, emojis
- Essay: Test with special formatting, line breaks
- Verify: ✅ All display correctly without corruption

#### 6d: Very Long Answers
- Short Answer: Enter 1000 characters
- Essay: Enter 5000+ characters
- Verify: ✅ Display properly with scrolling
           ✅ Text wraps correctly
           ✅ No truncation

#### 6e: HTML/Script Injection Prevention
- Short Answer: Try entering: `<script>alert('xss')</script>`
- Essay: Try entering: `<img src=x onerror="alert('xss')">`
- Verify: ✅ Displayed as plain text (escaped)
           ✅ No script execution

---

### Test 7: Data Persistence

#### 7a: Session Persistence
1. Complete exam
2. View results
3. Navigate away from results
4. Navigate back to results
5. Verify: ✅ Results still display with all feedback

#### 7b: Page Refresh
1. Complete exam and view results
2. Refresh the page (F5)
3. Verify: ✅ Data is cleared (as expected for local storage)
           ✅ User can't access old results after refresh

#### 7c: Multiple Exams
1. Complete Exam A, view results
2. Take Exam B, view results
3. Go back to Exam A results
4. Verify: ✅ Correct results for each exam shown
           ✅ No data mixing between attempts

---

### Test 8: Export CSV

1. Complete mixed exam
2. Click "Export CSV" button
3. Verify CSV contains:
   - ✅ Exam title
   - ✅ Attempt ID
   - ✅ Submission time
   - ✅ Total score and marks
   - ✅ Percentage
   - ✅ Pass status
   - ✅ Counts: correct, incorrect, skipped
   - ✅ Time spent

---

### Test 9: Responsive Design

#### 9a: Desktop (1920x1080)
- ✅ All elements visible
- ✅ Proper spacing
- ✅ Cards aligned in grid

#### 9b: Tablet (768x1024)
- ✅ Responsive layout
- ✅ Badges wrap appropriately
- ✅ Scrolling smooth

#### 9c: Mobile (375x667)
- ✅ Single column layout
- ✅ Touch-friendly sizes
- ✅ Text readable
- ✅ No horizontal scroll

---

### Test 10: Accessibility

1. ✅ Color not only means of identification (icons + color)
2. ✅ Text contrast meets WCAG AA
3. ✅ Badges use semantic HTML
4. ✅ Icons have text alternatives
5. ✅ Keyboard navigation works
6. ✅ Screen reader friendly

---

## Quick Regression Tests

Run these quick checks after any code changes:

```
1. MCQ correct answer → Green, shows correct answer, shows explanation ✓
2. T/F incorrect answer → Red, shows correct answer ✓
3. Short answer → Shows expected answers ✓
4. Essay pending → Amber, shows full text, shows pending message ✓
5. Skipped question → Gray, no marks shown ✓
6. Mixed exam → All types show correctly ✓
7. Results persist during session ✓
8. Export CSV works ✓
```

## Performance Checks

- Page loads within 2 seconds
- Answer review renders within 1 second
- Scrolling is smooth
- No console errors
- Memory usage stable
