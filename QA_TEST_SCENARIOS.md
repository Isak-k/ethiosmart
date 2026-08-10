# QA Test Scenarios - ExamPro System

## Test Environment Setup

**Browser:** Chrome/Firefox (latest)  
**Network:** Test both online and offline modes  
**Exam Types:** Normal exams, Practice exams  
**Practice Modes:** Practice mode, Exam mode

---

## Test Case 1: Practice Mode - Instant Feedback

**Setup:**
- Create practice exam: 3 questions (5 marks each, 15 max)
- Questions: Q1 (answer: B), Q2 (answer: A), Q3 (answer: C)
- Set passing score: 50%
- Configure: Practice mode enabled, timer disabled

**Steps:**
1. Navigate to exam
2. Mode selector appears
3. Click "Practice Mode"
4. Question 1 loads

**Expected Behavior:**
- QuestionCard renders with 4 options
- No feedback visible yet
- "Clear Answer" button hidden (not in practice mode)

**Step 5:** Select Option A (wrong)

**Expected:**
- Red background on Option A (incorrect indicator)
- Explanation box appears below
- Submit button still disabled (practice mode feedback)
- Next button stays enabled

**Step 6:** Select Option B (correct)

**Expected:**
- Option A clears (previous selection removed)
- Option B shows green (correct)
- Explanation updates
- Can proceed

**Step 7:** Click Next

**Expected:**
- Q2 loads
- Progress: 1/3 answered
- Navigation remembers Q1 answer

**Step 8:** Click Next (skip Q2)

**Expected:**
- Q3 loads
- Q2 shows as unanswered in navigator
- Step 9: Select Option C (correct), Submit

**Expected:**
- Results page appears
- Shows: 2 correct, 0 wrong, 1 skipped
- Passing score: 10/15 = 67% → PASS
- Detailed breakdown with explanations

**Fail Criteria:**
- ❌ Feedback shows before selection
- ❌ Skipped count = 0 (should be 1)
- ❌ Score = 10 but shows wrong percentage
- ❌ "Clear Answer" button visible

---

## Test Case 2: Exam Mode - Hidden Feedback Until Submission

**Setup:**
- Same exam as Test Case 1
- Select "Exam Mode" when prompted
- Set time limit: 5 minutes

**Steps:**
1. Mode selector shows two options
2. Select "Exam Mode"
3. Timer appears (5:00)
4. Q1 loads

**Expected:**
- No feedback visible
- All options appear neutral
- Timer counting down

**Step 5:** Select Option A (wrong answer)

**Expected:**
- Option A background: primary/10 (selected state, not red)
- NO feedback or explanation
- No indication it's wrong

**Step 6:** Select Option B (correct answer)

**Expected:**
- Option A clears
- Option B selected (primary color)
- Still NO feedback or green checkmark
- Behaves exactly like exam mode

**Step 7:** Submit exam immediately (all questions answered)

**Expected:**
- Results page appears
- ONLY shows: 2 correct, 0 wrong, 1 skipped
- NO detailed explanations
- NO answer details
- Summary-only results (as per exam mode spec)

**Fail Criteria:**
- ❌ Feedback visible during exam
- ❌ Correct answer highlighted green before submit
- ❌ Explanations shown on results
- ❌ Timer doesn't count down
- ❌ Detailed answers shown (only count-based summary expected)

---

## Test Case 3: Clear Answer Functionality

**Setup:**
- Create normal exam: 2 questions
- Not in practice mode (should show "Clear Answer")

**Steps:**
1. Start exam
2. Select answer to Q1: Option B
3. See "Clear Answer" button enabled

**Expected:**
- Button is visible and enabled
- Small size (30% smaller than navigation)
- Gray background

**Step 4:** Click "Clear Answer"

**Expected:**
- Option B selection clears
- Answer count decreases
- Progress bar updates
- "Clear Answer" button disabled (no answer to clear)
- Question card shows all options neutral again

**Step 5:** Re-select Option A

**Step 6:** Click Previous to Q1 (if on Q2)

**Expected:**
- Returning to Q1 shows it's empty
- "Clear Answer" button disabled

**Step 7:** Select Option C

**Step 8:** Click "Clear Answer"

**Step 9:** Move to Q2, answer, submit

**Expected:**
- Results show Q1 as skipped (not answered)
- Q2 shows as answered
- Skipped count = 1

**Fail Criteria:**
- ❌ "Clear Answer" shown in practice mode
- ❌ Clear doesn't actually remove answer
- ❌ Skipped count incorrect
- ❌ Cleared question shows as answered in results

---

## Test Case 4: Timer Logic - Exam Mode Timeout

**Setup:**
- Practice exam, 1 minute time limit
- 5 questions, set up for fast exam

**Steps:**
1. Select exam mode
2. Timer shows 1:00
3. Let timer run for 45 seconds (monitor console)

**Expected:**
- Timer counts: 0:59, 0:58, ... 0:15
- Colors: Green → Yellow (25% remaining = 15 sec)
- Colors: Yellow → Red (10% remaining = 6 sec)
- Display format correct (MM:SS)

**Step 4:** Let timer reach 0:00

**Expected:**
- Timer displays 0:00
- Auto-submit triggers immediately
- No manual submit button click needed
- Redirects to results

**Verify:**
- Time spent in results = ~60 seconds
- Answers captured before timeout

**Fail Criteria:**
- ❌ Timer shows negative numbers
- ❌ Color changes at wrong thresholds
- ❌ Doesn't auto-submit at 0:00
- ❌ Time calculation wrong

---

## Test Case 5: Offline Mode - Answer Persistence

**Setup:**
- Download practice exam for offline
- Disable network (or use offline mode)
- Start exam

**Steps:**
1. Offline indicator shows
2. Start practice exam
3. Answer Q1: Option B
4. Answer Q2: Option A

**Expected:**
- Answers saved to IndexedDB
- No network calls logged

**Step 5:** Refresh page (simulate crash)

**Expected:**
- Page reloads
- Exam resumes automatically
- Q3 selected (would be next)
- Previous answers loaded: Q1=B, Q2=A
- Progress bar shows 2/5 answered

**Step 6:** Continue, answer Q3, Q4, Q5

**Step 7:** Submit exam

**Expected:**
- Results calculated offline
- Shows: 3 correct, 2 wrong, 0 skipped
- Score displayed

**Fail Criteria:**
- ❌ Answers lost on refresh
- ❌ Resume doesn't work
- ❌ Offline storage full error
- ❌ Results wrong

---

## Test Case 6: Password Protected Exam

**Setup:**
- Create normal exam with password: "test123"

**Steps:**
1. Navigate to exam
2. Password dialog appears
3. Leave blank, click Continue

**Expected:**
- Error: "Password is required"
- Dialog stays open

**Step 4:** Enter wrong password: "wrong"

**Expected:**
- Error: "Incorrect password"
- Dialog stays open

**Step 5:** Enter correct password: "test123"

**Expected:**
- Dialog closes
- Exam starts

**Step 6:** Try password with spaces: " test123 "

**Expected:**
- Accepted and trimmed
- Exam starts

**Fail Criteria:**
- ❌ Empty password accepted
- ❌ Wrong password accepted
- ❌ Spaces not handled
- ❌ Password skipped on resume

---

## Test Case 7: Flagged Questions - Review Later

**Setup:**
- Create exam: 3 questions

**Steps:**
1. Navigate to exam
2. Answer Q1
3. Click "Flag for Review" (small flag button top-right)

**Expected:**
- Flag button turns red: "Flagged"
- Question navigator shows red triangle on Q1
- Flag persists if navigate away

**Step 4:** Go to Q2, flag it too

**Expected:**
- Both Q1 and Q2 show flags in navigator
- Red triangles visible

**Step 5:** Navigate back to Q1 using question navigator

**Expected:**
- Click Q1 in grid
- Q1 loads with flag still active
- Flag state persists across navigation

**Step 6:** Un-flag Q1

**Expected:**
- Red triangle gone
- Button shows "Flag for Review" again
- Gray flag icon

**Step 7:** Submit, view results

**Expected:**
- Flagged status in results (if implemented)

**Fail Criteria:**
- ❌ Flag state lost on navigation
- ❌ Flag button not clickable
- ❌ Visual indicator unclear
- ❌ Navigator not showing flags

---

## Test Case 8: Resume Incomplete Attempt

**Setup:**
- Create normal exam: 3 questions
- Start exam, answer Q1, Q2
- Close browser/tab without submitting

**Steps:**
1. Come back to dashboard
2. Click same exam again
3. Resume dialog appears

**Expected:**
- Shows: "Resume your previous attempt?"
- Progress: 2/3 answered
- Time elapsed shows

**Step 4:** Click "Resume"

**Expected:**
- Q3 loads (next unanswered question)
- Previous answers loaded: Q1 and Q2 still selected
- Navigator shows Q1, Q2 answered (green)
- Timer resumes from where it left off

**Step 5:** Answer Q3, submit

**Expected:**
- Results show attempt includes all 3 answers
- Time spent = original time + additional time
- All answers preserved

**Fail Criteria:**
- ❌ Answers lost on resume
- ❌ Timer resets to full duration
- ❌ Resume shows old password dialog
- ❌ Resume very old attempt (>24h) without warning

---

## Test Case 9: Question Navigator - Mobile View

**Setup:**
- Mobile device or responsive mode
- Exam with 5 questions

**Steps:**
1. Start exam on mobile
2. Hamburger button visible (right side)
3. Click hamburger

**Expected:**
- Full-screen navigator overlay appears
- Question grid visible (5 cells)
- Current question: cyan/blue
- Answered: green
- Unanswered: blue
- Flags: red triangle

**Step 4:** Click Q3

**Expected:**
- Navigator closes
- Q3 loads
- Q3 now highlighted in cyan

**Step 5:** Click hamburger again

**Expected:**
- Navigator shows Q3 as current (cyan)
- Q1, Q2 answered (green if answered)
- Updated state

**Fail Criteria:**
- ❌ Navigator button not visible
- ❌ Full screen doesn't work
- ❌ Questions not clickable
- ❌ State not updating

---

## Test Case 10: Normal Exam vs Practice Exam - Feature Differences

**Create two exams:**
- Exam A: Normal exam type
- Exam B: Practice exam type (with config)

**Compare:**
| Feature | Normal | Practice |
|---------|--------|----------|
| Mode selector | ❌ | ✅ |
| Timer required | ✅ | ❌ (optional) |
| Instant feedback | ❌ | ✅ (practice mode) |
| Explanations | ❌ until submit | ✅ (practice mode) |
| Results detail | Summary only | Full (practice mode) |
| Clear answer | ✅ | ❌ (hidden) |
| Offline available | ❌ | ✅ |

**Test:**
1. Start Normal exam → no mode selector
2. Start Practice exam → mode selector appears
3. Choose Practice mode → instant feedback
4. Choose Exam mode → no feedback

**Fail Criteria:**
- ❌ Normal exam shows mode selector
- ❌ Practice exam doesn't show selector
- ❌ Wrong feedback behavior for mode
- ❌ Results wrong format for mode

---

## Test Case 11: Firestore Rules - Data Access Control

**Setup:**
- Admin user
- Student user
- Create exam with Department A visibility

**Test:**

**Admin Views:**
1. Admin logs in
2. Can view exam? ✅ Expected
3. Can view student answers? ✅ Expected
4. Can edit exam? ✅ Expected

**Student Views:**
1. Student logs in (Department A)
2. Can view own exam attempts? ✅ Expected
3. Can view other students' attempts? ❌ Expected
4. Can view all exams? ❌ Should not (without permission)
5. Can edit attempt? ❌ Expected

**Different Department Student:**
1. Student from Department B logs in
2. Can view Department A exam? ❌ Expected (if visibility restricted)
3. Can view Department A results? ❌ Expected

**Fail Criteria:**
- ❌ Students see each other's attempts
- ❌ Students see hidden exams
- ❌ Non-admin can edit exams
- ❌ Rules don't match security model

---

## Test Case 12: Error Handling - Edge Cases

**Test 1: Empty Exam**
- Create exam with 0 questions
- Start exam → ❌ Should show error "No questions in exam"

**Test 2: Duplicate Submit**
- Answer exam, submit
- Rapidly click submit again
- ❌ Should prevent duplicate submission

**Test 3: Network Disconnected During Submission**
- Online exam, answer questions
- Disconnect network
- Click submit
- Expected: Offline storage fallback, show message

**Test 4: System Clock Changed**
- Start exam with 5 min timer
- System clock moved forward 1 hour
- Expected: Timer handles gracefully (no negative times)

**Test 5: No Authentication**
- Try to access exam without login
- Expected: Redirect to login, not 500 error

**Fail Criteria:**
- ❌ Empty exam starts
- ❌ Multiple submissions processed
- ❌ Offline submit fails without message
- ❌ Timer shows negative
- ❌ Auth failure crashes app

---

## Regression Testing - Old MCQ Compatibility

**Test:** Old multiple-choice questions work in new system

**Setup:**
- Create exam with 10 standard MCQs
- Mix of A, B, C, D answers
- Marks: 1, 2, 3 points mix

**Steps:**
1. Start exam
2. Answer all questions correctly
3. Submit

**Expected:**
- Score correct: sum of all marks
- Results show all correct
- No data loss
- Backward compatible

**Fail Criteria:**
- ❌ Old questions not loading
- ❌ Score calculation wrong
- ❌ Rendering broken
- ❌ Data migration needed

---

## New Question Types Testing

**Test:** New question types render and score correctly

**Setup:**
- Multiple choice: ✅ (existing)
- [Any new types implemented]

**Steps:**
1. Create exam with new types
2. Answer each type
3. Submit

**Expected:**
- All types render correctly
- Scoring works
- Results accurate

**Fail Criteria:**
- ❌ New types crash
- ❌ Rendering broken
- ❌ Scoring wrong

---

## Performance Testing

**Test 1: Large Exam**
- Create exam with 100 questions
- Load exam
- Expected: Loads in < 3 seconds
- Navigation smooth

**Test 2: Offline Storage Size**
- Download 10 large exams
- Expected: Storage < 50MB IndexedDB limit
- No quota exceeded errors

**Test 3: Long Session**
- Take 30+ minute exam
- No memory leaks
- Timer still accurate
- No slowdown

---

## Accessibility Testing

**Test:** Keyboard navigation works

- ❌ Arrow keys navigate questions
- ❌ Numbers 1-4 select answers
- ❌ S submits exam
- ❌ Tab navigates buttons
- ❌ Enter selects option

**Screen Reader:**
- Question text readable
- Options labeled
- Feedback announced
- Results accessible

