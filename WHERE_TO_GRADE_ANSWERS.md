# Where to Grade Short Answers & Essays

## Step-by-Step Navigation

### 1. Go to Admin Dashboard
```
http://yourapp/dashboard
```
(You need admin or superadmin role)

### 2. Click "All Results" or "Exams"
From the admin menu, find and click:
- **Admin → All Results** (to see all exams)
- OR **Admin → Exams** (if viewing single exam)

### 3. Find Your Exam
Look for the exam in the table that has:
- Short answer questions with "Manual Grading" enabled
- OR Essay questions

### 4. Click the "Grade Essays" Button
In the results table, for each student attempt, there's a **golden/amber button** with a cap icon (👨‍🎓):

```
Student Name    Score    Submitted     Grade Essays ← CLICK HERE
John Doe        45/50    Nov 19 2pm     [👨‍🎓]
Jane Smith      52/50    Nov 19 2:15pm  [👨‍🎓]
```

### 5. Grading Page Opens
You'll see:
- **Step 1**: Select Exam (already filled)
- **Step 2**: Select Student Attempt (dropdown)
- All pending short answers & essays listed below

### 6. Grade Each Answer
For each answer:
- Read the student's response
- Enter a score (0 to max marks)
- Write feedback for the student
- Click "Submit Grade"

### 7. Done!
Student sees:
- Status changes from "Pending Review" to "Graded"
- Your score and feedback appear

---

## UI Location in Code

### Button Location
**File**: `src/pages/ExamResults.tsx` (line ~455)
```tsx
<Link to={`/dashboard/exams/${examId}/grade-essays/${attempt.id}`}>
  <GraduationCap className="h-4 w-4" />
</Link>
```

### Grading Page
**File**: `src/pages/GradeEssays.tsx`
**Route**: `/dashboard/exams/:examId/grade-essays/:attemptId`

### Components Used
- `GradeEssays.tsx` - Main page
- `AnswerGradingPanel.tsx` - Grading interface (NEW)
- `EssayGradingPanel.tsx` - Used for backend

---

## Quick Visual Map

```
ADMIN DASHBOARD
│
├─ All Results
│  │
│  └─ [Exam Table]
│     │
│     ├─ Student Name | Score | Date | [👨‍🎓] ← CLICK
│     │
│     └─ Goes to...
│
└─ /dashboard/exams/{examId}/grade-essays/{attemptId}
   │
   ├─ Select Exam (Step 1)
   ├─ Select Student (Step 2)
   │
   └─ Grade Answers
      ├─ Q1: Short Answer (Pending)
      ├─ Q2: Essay (Pending)
      └─ [Submit Grade] button
```

---

## Requirements to Grade

✅ **Must be admin or superadmin**
- Non-admin users see: "Administrator access required"

✅ **Exam must have questions requiring manual grading**
- Short answers with `requiresManualGrading: true`
- OR Essays (default `requiresManualGrading: true`)

✅ **Student must have submitted the exam**
- Only shows submitted attempts
- Drafts don't appear in the list

---

## What You'll See on Grading Page

### Selection Cards
```
┌─ Step 1: Exam ─────────────────┐
│ [Dropdown: Select Exam]        │
└────────────────────────────────┘

┌─ Step 2: Student Attempt ──────┐
│ [Dropdown: Select Student]     │
│ 3 essays pending ↓             │
└────────────────────────────────┘
```

### Answer Cards
```
┌─ Q1: Short Answer (5 marks) ──────┐
│ Status: Pending Review             │
│                                    │
│ Student Answer:                    │
│ ┌──────────────────────────────┐  │
│ │ The capital of France is     │  │
│ │ Paris                        │  │
│ └──────────────────────────────┘  │
│                                    │
│ Score: [___] / 5                   │
│ Feedback: [________________]       │
│                                    │
│ [Submit Grade] Button              │
└────────────────────────────────────┘
```

---

## Tips

💡 **Bulk Grading**: Use the "Recalculate Total Score" button after grading multiple answers to update the attempt total

💡 **Word Count**: Essays show word count and any min/max violations

💡 **Feedback**: Your feedback is visible to the student, so write constructively

💡 **Permissions**: Only admins can grade - students cannot access this page

---

## Related Routes

| Page | Route | Purpose |
|------|-------|---------|
| All Results | `/dashboard/admin/all-results` | View all exams & attempts |
| Exam Results | `/dashboard/exams/{examId}` | View exam details & attempts |
| Grade Answers | `/dashboard/exams/{examId}/grade-essays/{attemptId}` | Grade pending answers |

---

## Troubleshooting

❌ **"Administrator access required"**
- You need admin or superadmin role
- Contact your superadmin to assign role

❌ **Button doesn't appear**
- Exam has no questions requiring manual grading
- Check question settings: toggle "Require Manual Grading"

❌ **No pending answers**
- All answers already graded ✓
- Or all questions are auto-graded

