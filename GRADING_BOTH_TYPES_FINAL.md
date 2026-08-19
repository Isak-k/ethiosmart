# Grade Both Short Answers & Essays - Final Guide

## The Problem (Fixed)
- Essay questions had no manual grading checkbox
- Mixing essays and short answers didn't work
- ❌ Now fixed!

## The Solution
**Both essay and short answer questions NOW have the manual grading checkbox**

---

## How to Enable Manual Grading

### For SHORT ANSWER Questions:
1. **Create/Edit Exam** → Click short answer question
2. Scroll to bottom
3. ✓ Check: **"Require Manual Grading by Teacher"**
4. Save

### For ESSAY Questions:
1. **Create/Edit Exam** → Click essay question  
2. Scroll to bottom (below rubric section)
3. ✓ Check: **"Require Manual Grading by Teacher"**
4. Save

---

## Complete Workflow

### 1️⃣ Create Exam with Both Types
```
Exam: "Math Final"
├─ Q1: Multiple Choice (auto-graded)
├─ Q2: Short Answer "Show your work" 
│       ✓ Require Manual Grading by Teacher
├─ Q3: Essay "Explain the concept"
│       ✓ Require Manual Grading by Teacher
```

### 2️⃣ Student Takes & Submits Exam
- Student sees "Pending Review" for Q2 and Q3

### 3️⃣ Admin Grades Answers
1. **Admin Dashboard** → **All Results**
2. Find exam → Click **Gold Cap 👨‍🎓** button
3. Select student
4. **Grade each question:**

```
Q2: Short Answer (10 marks)
Student: "2x² + 3x = 15"
Score: [8] / 10
Feedback: [Good work, minor error in final step]
[Submit Grade]

Q3: Essay (20 marks)
Student: "The concept works because..."
Score: [18] / 20
Feedback: [Excellent explanation, could add more examples]
[Submit Grade]
```

### 4️⃣ Student Sees Results
```
Q2: Score 8/10 - Graded
    Feedback: "Good work, minor error in final step"

Q3: Score 18/20 - Graded
    Feedback: "Excellent explanation, could add more examples"
```

---

## Key Points

✅ **Both types work the same way now**
- Same checkbox location (bottom of form)
- Same grading UI
- Same workflow

✅ **Can mix freely**
- One exam can have short answers, essays, MCQs
- Each handles independently

✅ **Auto-grading still works**
- Uncheck the manual grading box for auto-evaluation
- Or short answers: leave empty for teacher review OR fill correct answers for auto-grade

---

## Checklist

Before grading:
- [ ] Question has ✓ "Require Manual Grading by Teacher" checked
- [ ] Student submitted the exam (not draft)
- [ ] You are admin or superadmin

When grading:
- [ ] Enter score (0 to max marks)
- [ ] Enter feedback (visible to student)
- [ ] Click "Submit Grade"

After grading:
- [ ] Student sees grade in results
- [ ] Student sees your feedback

---

## Troubleshooting

**"Still no grading button"**
→ Make sure AT LEAST ONE question has ✓ manual grading enabled

**"No questions to grade"**
→ Go back to edit exam, check the manual grading checkbox on your questions

**"Score and feedback seem to disappear"**
→ Make sure you click "Submit Grade" button (not just filling fields)

**"Can't find the checkbox"**
→ For essays: scroll down past the rubric section
→ For short answers: scroll past the correct answers section

---

## New Checkbox Locations

### Short Answer Question Editor
```
Question Type: Short Answer

Question Text: [...]

Correct Answers: [...]
☐ Case Sensitive
☐ Require Exact Match

☑️ Require Manual Grading by Teacher  ← HERE
```

### Essay Question Editor
```
Question Type: Essay

Question Text: [...]

Min/Max Words: [...]
Rubric: [...]

☑️ Require Manual Grading by Teacher  ← HERE
```

---

## That's It!

Now you can:
✅ Create exams with short answers + essays
✅ Grade them manually in one place
✅ Give feedback to students
✅ Mix with auto-graded questions

**Commit**: c7fd4cf - Essays now have manual grading checkbox

