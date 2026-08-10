# ExamPro Multi-Question Type Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ADMIN PANEL                          STUDENT EXAM INTERFACE     │
│  ┌──────────────────┐                 ┌──────────────────┐      │
│  │ QuestionTypeForm │                 │ TakeExam.tsx     │      │
│  │ (Question CRUD)  │                 │ ├─ Practice      │      │
│  │ ├─ MCQ           │                 │ └─ Exam Mode     │      │
│  │ ├─ True/False    │                 └──────────────────┘      │
│  │ ├─ Short Answer  │                          ↓                 │
│  │ └─ Essay         │                 ┌──────────────────┐      │
│  └──────────────────┘                 │ QuestionRenderer │      │
│         ↓                             │ (Universal UI)   │      │
│  (submits)                            │ ├─ MCQ           │      │
│                                       │ ├─ True/False    │      │
└─────────────────────────────────────────────────────────────────┘
         ↓                                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                      VALIDATION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Zod Schema Validation                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ newQuestionSchema (Discriminated Union)                    │ │
│  │ ├─ MCQ Schema                                              │ │
│  │ ├─ True/False Schema                                       │ │
│  │ ├─ Short Answer Schema                                     │ │
│  │ └─ Essay Schema                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  validateAnswerFormat()                                          │
│  getAnswerPlaceholder()                                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         ↓                                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Question Evaluation Engine                  Answer Management   │
│  ┌─────────────────────────────┐            ┌────────────────┐  │
│  │ evaluateQuestion()          │            │ convertAnswerTo│  │
│  │ ├─ evaluateMCQ()            │            │   Storage()    │  │
│  │ ├─ evaluateTrueFalse()      │            │                │  │
│  │ ├─ evaluateShortAnswer()    │            │ getAnswerDisplay│ │
│  │ └─ evaluateEssay()          │            │   Text()       │  │
│  │                              │            │                │  │
│  │ calculateExamScore()        │            │ isAnswerEmpty()│  │
│  │ batchEvaluateAnswers()      │            │                │  │
│  └─────────────────────────────┘            └────────────────┘  │
│                                                                   │
│  Mode Engines                                                    │
│  ┌──────────────────────────┐  ┌──────────────────────────┐     │
│  │ practice-mode-engine.ts  │  │ exam-mode-engine.ts      │     │
│  │ ├─ calculatePracticeMode │  │ ├─ calculateExamModeSummary│   │
│  │ │   Result()             │  │ │ ()                      │     │
│  │ ├─ getPracticeModeFeedback│ │ ├─ calculateExamModeResult│    │
│  │ │ ()                      │  │ │ ()                      │     │
│  │ └─ savePracticeModeAnswer│  │ └─ formatExamModeSummary │     │
│  │   ()                     │  │                           │     │
│  └──────────────────────────┘  └──────────────────────────┘     │
│                                                                   │
│  Question Migration (Backward Compat)                            │
│  ┌─────────────────────────────────────────┐                    │
│  │ isLegacyQuestion()                      │                    │
│  │ migrateLegacyQuestion()                 │                    │
│  │ ensureQuestionType()                    │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         ↓                                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                     DATA ACCESS LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Firebase Operations (firebase-questions.ts)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ createQuestion(examId, questionData)                       │ │
│  │ getQuestions(examId) [+ auto-migration]                    │ │
│  │ getQuestion(examId, questionId)                            │ │
│  │ updateQuestion(examId, questionId, data)                   │ │
│  │ deleteQuestion(examId, questionId)                         │ │
│  │ reorderQuestions(examId, questionIds[])                    │ │
│  │ bulkCreateQuestions(examId, questions[])                   │ │
│  │ getTotalMarks(examId)                                      │ │
│  │ getQuestionCount(examId)                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      FIRESTORE DATABASE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Collection: exams/{examId}/questions/{questionId}               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Common Fields:                                             │ │
│  │ • questionId: string                                       │ │
│  │ • questionText: string                                     │ │
│  │ • marks: number                                            │ │
│  │ • feedbackType: 'instant' | 'hidden'                       │ │
│  │ • explanation?: string                                     │ │
│  │ • questionType: 'mcq' | 'true-false' | ...                │ │
│  │ • orderIndex: number                                       │ │
│  │                                                             │ │
│  │ Type-Specific Fields:                                      │ │
│  │ ├─ MCQ:          options[], correctOptionIndex             │ │
│  │ ├─ True/False:   correctAnswer                             │ │
│  │ ├─ Short Answer: correctAnswers[], caseSensitive, ...      │ │
│  │ └─ Essay:        minWords?, maxWords?                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Collection: exams/{examId}/answers (or examAttempts/...)        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Common Fields:                                             │ │
│  │ • questionId: string                                       │ │
│  │ • attemptId: string                                        │ │
│  │ • isCorrect: boolean | null                                │ │
│  │ • timeSpentSeconds?: number                                │ │
│  │ • answeredAt: Timestamp                                    │ │
│  │                                                             │ │
│  │ Answer Data (one populated per type):                      │ │
│  │ • selectedOptionIndex?: number  [MCQ]                      │ │
│  │ • selectedBoolean?: boolean     [True/False]               │ │
│  │ • textAnswer?: string           [Short Answer / Essay]     │ │
│  │ • rubricScore?: number          [Essay manual grade]       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Creating a Question

```
Admin Interface
    ↓
QuestionTypeForm
    ├─ Select Type (MCQ/T-F/Short-Ans/Essay)
    ├─ Fill form fields (dynamic per type)
    └─ Submit
    ↓
Client-side Validation
    ├─ Zod Schema validation
    ├─ Field-level checks
    └─ Error display if invalid
    ↓
createQuestion() [firebase-questions.ts]
    ├─ Get orderIndex
    ├─ Build document (base + type-specific fields)
    ├─ Add to Firestore
    └─ Return created question
    ↓
Firestore: exams/{id}/questions/{qid}
    └─ Document stored with type info
```

### Taking an Exam

```
Student selects exam
    ↓
TakeExam.tsx loads exam + questions
    ├─ getExam()
    ├─ getQuestions() [auto-migrates legacy]
    └─ State: Map<questionId, answer>
    ↓
For each question:
    QuestionRenderer displays UI
    ├─ Detects question type
    ├─ Renders type-specific UI
    │  ├─ MCQ: radio buttons
    │  ├─ T/F: toggle buttons
    │  ├─ Short-Ans: textarea
    │  └─ Essay: large textarea
    └─ Listener on student input
    ↓
Student provides answer
    ├─ Updated in state Map
    └─ If Practice Mode:
       └─ Show instant feedback (via evaluateQuestion)
    ↓
Student submits exam
    └─ Calculate results
       ├─ batchEvaluateAnswers()
       ├─ calculateExamScore()
       └─ Display results
```

### Evaluating Answers

```
evaluateQuestion(question, answer)
    ↓
Determine question type
    ├─ Is MCQ?           → evaluateMCQ()
    ├─ Is True/False?    → evaluateTrueFalse()
    ├─ Is Short Answer?  → evaluateShortAnswer()
    └─ Is Essay?         → evaluateEssay()
    ↓
Type-specific evaluation
    ├─ MCQ: Compare selectedOptionIndex === correctOptionIndex
    ├─ T/F: Compare selectedBoolean === correctAnswer
    ├─ SA:  evaluateTextAnswer() with smart matching
    └─ Essay: Validate word count, mark pending
    ↓
Return EvaluationResult
    ├─ isCorrect: boolean
    ├─ earnedMarks: number
    ├─ totalMarks: number
    ├─ feedback: string
    └─ explanation?: string
```

### Backward Compatibility Flow

```
Load Question from Firestore
    ↓
Check: Does it have questionType field?
    ├─ YES → Use as-is (new format)
    ├─ NO  → is Legacy MCQ detected?
    │   ├─ Has options[]?
    │   ├─ Has correctOptionIndex?
    │   └─ (No questionType field)
    │   ↓
    │   migrateLegacyQuestion()
    │   ├─ Copy all fields
    │   ├─ Add questionType: 'mcq'
    │   └─ Return migrated
    ↓
Return Question with questionType
```

## Type System Hierarchy

```
Question (Union Type)
├─ MCQQuestion
│  ├─ Extends: BaseQuestion
│  ├─ questionType: 'mcq'
│  ├─ options: string[]
│  └─ correctOptionIndex: number
├─ TrueFalseQuestion
│  ├─ Extends: BaseQuestion
│  ├─ questionType: 'true-false'
│  └─ correctAnswer: boolean
├─ ShortAnswerQuestion
│  ├─ Extends: BaseQuestion
│  ├─ questionType: 'short-answer'
│  ├─ correctAnswers: string[]
│  ├─ caseSensitive?: boolean
│  └─ requireExactMatch?: boolean
└─ EssayQuestion
   ├─ Extends: BaseQuestion
   ├─ questionType: 'essay'
   ├─ minWords?: number
   └─ maxWords?: number

BaseQuestion
├─ questionId: string
├─ examId: string
├─ questionText: string
├─ marks: number
├─ orderIndex: number
├─ feedbackType: 'instant' | 'hidden'
├─ explanation?: string
├─ createdAt: Timestamp
└─ questionType: QuestionType
```

## Component Interaction Map

```
QuestionTypeForm ──creates──→ Question
         ↓
   (submit)
         ↓
firebase-questions.ts
   ├─ createQuestion()
   └─ Validates with Zod
         ↓
      Firestore
         ↓
   TakeExam.tsx
      ↓
   Gets Questions
      ├─ getQuestions()
      └─ Auto-migration
      ↓
   Maps to QuestionRenderer ──for each──→ Question
      ↓
   Student interacts
      ├─ Changes answer in state
      └─ Practice mode:
         ├─ evaluateQuestion()
         └─ Show feedback
      ↓
   Exam mode: No feedback until submit
      ↓
   Student submits
      ├─ batchEvaluateAnswers()
      ├─ calculateExamScore()
      └─ Display results
```

## Integration Points

```
Existing System (Preserved)
├─ TakeExam.tsx        [no changes required]
├─ Offline mode        [fully compatible]
├─ Firestore rules     [unchanged]
├─ LeaderBoard         [unaffected]
├─ Session persistence [unchanged]
└─ Offline storage     [enhanced]

New Components (Phase 2)
├─ QuestionRenderer.tsx
├─ QuestionTypeForm.tsx
├─ question-evaluation.ts
├─ answer-handlers.ts
└─ question-migration.ts

Enhanced Components (Phase 2)
├─ types.ts
├─ validations.ts
├─ practice-mode-engine.ts
└─ exam-mode-engine.ts

Future Integration Points (Phase 3+)
├─ Admin UI for question creation
├─ Essay grading interface
├─ Analytics dashboard
└─ Results review system
```

## Performance Characteristics

```
Operation              Time      Notes
──────────────────────────────────────────
Create Question       ~100ms    Write to Firestore
Load Questions        ~200ms    Read + auto-migrate
Evaluate Answer       ~1ms      Client-side computation
Batch Evaluate        ~10ms     For ~10 questions
Calculate Score       ~5ms      Aggregate results
Display Question      ~50ms     React render

Firestore Impact
├─ Read:  Questions indexed by orderIndex (fast)
├─ Write: Single document per question
└─ Query: No new indexes required

Memory Impact
├─ New code:    ~15KB (gzip)
├─ Compiled:    ~40KB (gzip)
└─ No runtime:  Lazy loaded with components
```

## Security Model

```
User ─────→ TakeExam.tsx
   ↓
   ├─ Fetch Question
   │  └─ Firestore: `isAuthenticated()`
   │     └─ Only published exams visible
   │
   ├─ Submit Answer
   │  └─ Firestore: `isStudent() && isParticipant()`
   │     └─ Can only submit to owned attempts
   │
   └─ Update Question (Admin)
      └─ Firestore: `isAdmin() || isExamCreator()`
         └─ Only exam creator can modify

Type System
├─ Client: Full discriminated union
├─ Firestore: Schema validation via rules
└─ Answer: Format validated per type
```

## Testing Strategy

```
Unit Tests
├─ evaluateQuestion() for each type
├─ Answer validation
├─ Migration logic
└─ Schema validation

Integration Tests
├─ Create + Fetch + Update + Delete
├─ Type mixing in single exam
├─ Legacy migration
└─ Offline sync

Component Tests
├─ QuestionRenderer rendering
├─ QuestionTypeForm submission
└─ Answer state management

E2E Tests
├─ Create exam with all types
├─ Take practice exam
├─ Take timed exam
├─ Submit and see results
└─ Verify essay pending status
```

---

This architecture ensures:
✅ Backward compatibility
✅ Type safety
✅ Performance
✅ Scalability
✅ Security
✅ Maintainability
