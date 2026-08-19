# Manual Grading Feature: Short Answers & Essays

## Overview

This feature allows teachers/admins to choose between automatic grading and manual grading for **Short Answer** and **Essay** questions. Admins can configure each question independently, and the system will display pending answers for teacher review.

## Key Features

### 1. **Question Type Configuration**

#### Essays (Already Supported)
- Essays have always supported manual grading via `requiresManualGrading` flag
- Defaults to `true` (requires manual grading)
- Can be changed in question editor

#### Short Answers (New)
- Short answers now support optional manual grading
- New checkbox: "Require Manual Grading by Teacher"
- When enabled:
  - Answers bypass automatic evaluation
  - Answers marked as "pending" for teacher review
  - Teacher assigns score and feedback
- When disabled (default):
  - Answers auto-graded against correct answers
  - Instant feedback to student

### 2. **Admin Configuration Flow**

In the Question Editor:

1. Create a **Short Answer** question
2. Add correct answers (optional when manual grading is on)
3. Choose matching options:
   - Case sensitive / Case insensitive
   - Require exact match / Allow partial matches
4. **NEW**: Check "Require Manual Grading by Teacher" if you want human review instead of auto-grading

### 3. **Grading Workflow**

#### For Students
1. Take exam, answer short answer/essay questions
2. Submit exam
3. See status: "Pending Review" for manually-graded answers
4. After teacher grades: See score & feedback

#### For Teachers/Admins
1. Navigate to: Admin → All Results
2. Find exam, click "Grade Answers" button
3. Select student attempt
4. Review all pending short answers & essays
5. For each:
   - Read the student's answer
   - Assign score (0 to max marks)
   - Provide feedback
   - Click "Submit Grade"
6. Optional: Recalculate total score

### 4. **Data Model Updates**

#### ShortAnswerQuestion (new fields)
```typescript
interface ShortAnswerQuestion {
  // ... existing fields
  requiresManualGrading?: boolean;  // NEW: true = manual grading
}
```

#### ShortAnswerAnswer (new fields)
```typescript
interface ShortAnswerAnswer {
  // ... existing fields
  manualScore?: number;             // NEW: score assigned by teacher
  manualFeedback?: string;          // NEW: teacher's feedback
  graderUserId?: string;            // NEW: who graded it
  gradedAt?: Timestamp;             // NEW: when it was graded
}
```

### 5. **Question Evaluation Logic**

**evaluateShortAnswer()** function now checks for manual grading:

```
if requiresManualGrading is true:
  → Return: isCorrect=false, earnedMarks=0, feedback="Pending review"
else if no correct answers provided:
  → Auto-accept answer (full marks)
else:
  → Auto-grade against correct answers (using math-aware evaluation)
```

**evaluateEssay()** logic unchanged:
```
if requiresManualGrading is true:
  → Return: isCorrect=false, earnedMarks=0, feedback="Pending review"
else:
  → Accept answer (full marks)
```

### 6. **UI Components**

#### New: `AnswerGradingPanel`
- Unified component for grading short answers & essays
- Shows student answer in read-only view
- Input for teacher's score (with validation)
- Input for teacher's feedback
- Word count info (for essays)
- Word limit warnings (min/max word violations)
- Submit/Update buttons

#### Updated: `QuestionTypeForm`
- Added checkbox for short answer manual grading toggle
- Shows matching options alongside

#### Updated: `GradeEssays`
- Now called "Grade Answers" (supports both types)
- Filters questions that need grading (essays + manually-graded short answers)
- Works with both types seamlessly

### 7. **Admin Decision Points**

| Scenario | Config | Behavior |
|----------|--------|----------|
| Short Answer - Auto-grade | `requiresManualGrading: false` + correct answers | Instant auto-evaluation |
| Short Answer - Manual grade | `requiresManualGrading: true` | Teacher assigns score |
| Essay - Always manual | `requiresManualGrading: true` (default) | Teacher assigns score |
| Essay - Auto-accept | `requiresManualGrading: false` | Full marks if submitted |

### 8. **Results Display**

**Practice Mode Results:**
```
Question 5: Essay
Score: Pending (0/10)
Status: Your essay is pending review
(Shows submitted text)
```

After grading:
```
Question 5: Essay  
Score: 8/10
Status: Graded by [Teacher Name]
Feedback: [Teacher's comment]
```

### 9. **API Changes Required**

#### Firebase (Firestore)
Update answer documents:
- `manualScore: number` (when graded)
- `manualFeedback: string` (teacher's comment)
- `graderUserId: string` (admin ID)
- `gradedAt: Timestamp` (grading time)

#### Backend Route
POST `/api/grade-answer`
```json
{
  "attemptId": "...",
  "questionId": "...",
  "score": 8,
  "feedback": "Good effort...",
  "graderId": "user-id"
}
```

### 10. **Permissions**

- Only `admin` or `superadmin` can grade answers
- Teachers cannot grade (only admins)
- Can be extended to teacher role if needed

### 11. **Feature Flags / Migration**

All existing short answer questions default to:
```typescript
requiresManualGrading: false  // Auto-grade (backward compatible)
```

Admins can opt-in to manual grading per question.

---

## Implementation Files

**New/Modified:**
- `src/lib/manual-answer-grading.ts` - Core grading utilities
- `src/components/admin/AnswerGradingPanel.tsx` - New unified grading UI
- `src/integrations/firebase/question-types.ts` - Type updates
- `src/lib/question-evaluation.ts` - Evaluation logic
- `src/lib/validations.ts` - Schema updates
- `src/components/admin/QuestionTypeForm.tsx` - Admin form updates
- `src/pages/GradeEssays.tsx` - Updated to support short answers

**Unchanged but used:**
- `src/lib/essay-grading.ts` - Reused for backend operations

---

## Testing Checklist

- [ ] Create short answer question with manual grading disabled → auto-grades
- [ ] Create short answer question with manual grading enabled → shows pending
- [ ] Essay question defaults to manual grading required
- [ ] Teacher can grade short answer → sees "Graded" badge
- [ ] Teacher can update grade (change score/feedback)
- [ ] Student sees pending status in results
- [ ] Student sees graded score + feedback after teacher grades
- [ ] Recalculate totals button works
- [ ] Permissions: non-admin cannot access Grade Answers page

---

## Future Enhancements

1. **Rubric Scoring for Short Answers** - Add rubric criteria for short answers
2. **Batch Grading** - Grade multiple answers per question
3. **AI-Assisted Grading** - AI suggestions for short answers
4. **Grading Comments Templates** - Predefined feedback snippets
5. **Partial Credit Marks** - Allow half/decimal marks per question
6. **Teacher Role** - Let teachers (not just admins) grade
7. **Mobile Grading** - Responsive grading interface for tablets

