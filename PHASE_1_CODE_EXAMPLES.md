# Phase 1: Code Examples & Patterns

This file shows practical examples of using the new question model types and utilities.

---

## Import Statement

```typescript
import {
  // Types
  Question, Answer, QuestionType,
  MCQQuestion, TrueFalseQuestion, ShortAnswerQuestion, EssayQuestion,
  MCQAnswer, TrueFalseAnswer, ShortAnswerAnswer, EssayAnswer,
  Essay, Rubric, GradingRubric,
  
  // Type Guards
  isMCQQuestion, isTrueFalseQuestion, isShortAnswerQuestion, isEssayQuestion,
  isMCQAnswer, isTrueFalseAnswer, isShortAnswerAnswer, isEssayAnswer,
  isAutoGradable, requiresManualGrading,
  
  // Utilities
  validateAnswer, getCorrectAnswer, isAnswerComplete,
  validateEssayWordCount, countWords,
  ensureQuestionType, ensureAnswerType
} from '@/integrations/firebase/question-types';
```

---

## Creating Questions

### MCQ Question
```typescript
const mcqQuestion: MCQQuestion = {
  questionId: 'q_mcq_001',
  examId: 'exam_001',
  questionType: 'mcq',
  questionText: 'What is the capital of France?',
  options: ['London', 'Paris', 'Berlin', 'Madrid'],
  correctOptionIndex: 1,
  marks: 1,
  orderIndex: 0,
  feedbackType: 'hidden',
  explanation: 'Paris is the capital and largest city of France.',
  difficulty: 'easy',
  tags: ['geography', 'capitals'],
  imageUrl: 'https://example.com/france.jpg',
  imageAltText: 'Map of France',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
};
```

### True/False Question
```typescript
const tfQuestion: TrueFalseQuestion = {
  questionId: 'q_tf_001',
  examId: 'exam_001',
  questionType: 'true_false',
  questionText: 'The Earth is flat.',
  correctAnswer: false,
  marks: 1,
  orderIndex: 1,
  feedbackType: 'instant',
  explanation: 'The Earth is an oblate spheroid.',
  difficulty: 'easy',
  imageUrl: 'https://example.com/earth.jpg',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
};
```

### Short Answer Question
```typescript
const saQuestion: ShortAnswerQuestion = {
  questionId: 'q_sa_001',
  examId: 'exam_001',
  questionType: 'short_answer',
  questionText: 'What is the largest planet in our solar system?',
  acceptedAnswers: ['Jupiter', 'jupiter', 'JUPITER'],
  caseSensitive: false,
  charLimit: 50,
  marks: 2,
  orderIndex: 2,
  feedbackType: 'hidden',
  explanation: 'Jupiter is the largest planet in the solar system.',
  difficulty: 'easy',
  tags: ['astronomy', 'planets'],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
};
```

### Essay Question with Rubric
```typescript
const essayRubric: GradingRubric = {
  criteria: [
    {
      id: 'thesis',
      name: 'Clear Thesis',
      description: 'Has a clear, arguable thesis statement',
      maxPoints: 2
    },
    {
      id: 'evidence',
      name: 'Supporting Evidence',
      description: 'Uses relevant examples and quotes',
      maxPoints: 3
    },
    {
      id: 'organization',
      name: 'Organization',
      description: 'Logical flow and structure',
      maxPoints: 2
    },
    {
      id: 'writing',
      name: 'Writing Quality',
      description: 'Grammar, spelling, clarity',
      maxPoints: 3
    }
  ],
  totalPoints: 10
};

const essayQuestion: EssayQuestion = {
  questionId: 'q_essay_001',
  examId: 'exam_001',
  questionType: 'essay',
  questionText: 'Analyze the causes of World War II and their lasting impact on modern geopolitics.',
  imageUrl: 'https://example.com/wwii-historical-photo.jpg',
  imageAltText: 'Historical photograph from World War II era',
  minWords: 500,
  maxWords: 1500,
  rubric: essayRubric,
  requiresManualGrading: true,
  marks: 10,
  orderIndex: 3,
  feedbackType: 'hidden',
  difficulty: 'hard',
  tags: ['history', 'world-war-ii', 'analysis'],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
};
```

---

## Student Answering Questions

### Submit MCQ Answer
```typescript
const mcqAnswer: MCQAnswer = {
  questionId: 'q_mcq_001',
  attemptId: 'attempt_student_001',
  questionType: 'mcq',
  selectedOptionIndex: 1,  // Student selected "Paris"
  isCorrect: null,          // Will be calculated on submission
  answeredAt: Timestamp.now(),
  timeSpentSeconds: 30
};

// Save to Firestore
await setDoc(
  doc(db, 'examAttempts', 'attempt_001', 'answers', 'q_mcq_001'),
  mcqAnswer
);
```

### Submit True/False Answer
```typescript
const tfAnswer: TrueFalseAnswer = {
  questionId: 'q_tf_001',
  attemptId: 'attempt_001',
  questionType: 'true_false',
  selectedAnswer: false,    // Student selected "False"
  isCorrect: null,
  answeredAt: Timestamp.now(),
  timeSpentSeconds: 15
};

await setDoc(
  doc(db, 'examAttempts', 'attempt_001', 'answers', 'q_tf_001'),
  tfAnswer
);
```

### Submit Short Answer
```typescript
const saAnswer: ShortAnswerAnswer = {
  questionId: 'q_sa_001',
  attemptId: 'attempt_001',
  questionType: 'short_answer',
  studentResponse: 'Jupiter',    // Student's text input
  isCorrect: null,
  answeredAt: Timestamp.now(),
  timeSpentSeconds: 45
};

await setDoc(
  doc(db, 'examAttempts', 'attempt_001', 'answers', 'q_sa_001'),
  saAnswer
);
```

### Submit Essay Answer
```typescript
const studentEssay = `World War II emerged from the ashes of World War I...
[500-1500 words of student response]`;

const essayAnswer: EssayAnswer = {
  questionId: 'q_essay_001',
  attemptId: 'attempt_001',
  questionType: 'essay',
  studentResponse: studentEssay,
  wordCount: countWords(studentEssay),  // Utility function
  isCorrect: null,                       // Not applicable for essays
  answeredAt: Timestamp.now(),
  timeSpentSeconds: 1200                 // 20 minutes
};

// Save essay answer
await setDoc(
  doc(db, 'examAttempts', 'attempt_001', 'answers', 'q_essay_001'),
  essayAnswer
);

// Also create essay document for grading workflow
const essay: Essay = {
  essayId: `essay_${attemptId}_${questionId}`,
  attemptId: 'attempt_001',
  examId: 'exam_001',
  questionId: 'q_essay_001',
  studentId: 'student_001',
  studentResponse: studentEssay,
  wordCount: countWords(studentEssay),
  marks: 10,
  status: 'pending',                    // Awaiting grading
  createdAt: Timestamp.now()
};

await setDoc(doc(db, 'essays', essay.essayId), essay);
```

---

## Loading & Processing Answers

### Defensive Reading (Backward Compatibility)
```typescript
// Loading mixed question types (old and new)
async function loadQuestions(examId: string): Promise<Question[]> {
  const snapshot = await getDocs(
    collection(db, 'exams', examId, 'questions')
  );
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    
    // Backward compat: ensure old MCQ questions get type field
    if (!data.questionType) {
      data.questionType = 'mcq';
    }
    
    return ensureQuestionType({
      questionId: doc.id,
      ...data
    });
  });
}

// Now all questions can be safely processed
const questions = await loadQuestions('exam_001');
questions.forEach(q => {
  // Safe to access questionType without errors
  console.log(`Question ${q.questionId}: type=${q.questionType}`);
});
```

### Conditional Processing with Type Guards
```typescript
async function processAllAnswers(
  attemptId: string,
  questions: Question[]
): Promise<void> {
  const answers = await getAnswers(attemptId);
  
  for (const question of questions) {
    const answer = answers.find(a => a.questionId === question.questionId);
    if (!answer) continue;
    
    // Process based on question type
    if (isMCQQuestion(question)) {
      await handleMCQAnswer(question, answer as MCQAnswer);
    } else if (isTrueFalseQuestion(question)) {
      await handleTrueFalseAnswer(question, answer as TrueFalseAnswer);
    } else if (isShortAnswerQuestion(question)) {
      await handleShortAnswerAnswer(question, answer as ShortAnswerAnswer);
    } else if (isEssayQuestion(question)) {
      await handleEssayAnswer(question, answer as EssayAnswer);
    }
  }
}

// Type guards ensure compiler knows the type in each branch
function handleMCQAnswer(q: MCQQuestion, a: MCQAnswer) {
  console.log(`Correct option: ${q.correctOptionIndex}`);  // ✅ Safe
  console.log(`Student selected: ${a.selectedOptionIndex}`);  // ✅ Safe
}

function handleEssayAnswer(q: EssayQuestion, a: EssayAnswer) {
  console.log(`Min words: ${q.minWords}`);                 // ✅ Safe
  console.log(`Student word count: ${a.wordCount}`);       // ✅ Safe
  console.log(`Score: ${a.manualScore || 'Pending'}`);     // ✅ Safe
}
```

---

## Auto-Grading Workflow

### Grade Multiple Choice Answer
```typescript
async function gradeAnswer(
  question: Question,
  answer: Answer
): Promise<boolean> {
  // Check if auto-gradable
  if (!isAutoGradable(question)) {
    throw new Error('Cannot auto-grade this question type');
  }
  
  // Validate and get result
  const result = validateAnswer(question, answer);
  
  // Update answer with grade
  await updateDoc(
    doc(db, 'examAttempts', answer.attemptId, 'answers', answer.questionId),
    { isCorrect: result.isCorrect }
  );
  
  return result.isCorrect;
}

// Usage
const isCorrect = await gradeAnswer(mcqQuestion, mcqAnswer);
console.log(isCorrect ? 'Correct!' : 'Incorrect');
```

### Grade All Answers in an Attempt
```typescript
async function gradeAttempt(
  attemptId: string,
  questions: Question[]
): Promise<{
  totalScore: number;
  maxScore: number;
  breakdown: Record<string, number>;
}> {
  const answers = await getAnswers(attemptId);
  
  let totalScore = 0;
  let maxScore = 0;
  const breakdown: Record<string, number> = {};
  
  for (const question of questions) {
    maxScore += question.marks;
    
    const answer = answers.find(a => a.questionId === question.questionId);
    if (!answer) continue;
    
    // Skip essays - they need manual grading
    if (isEssayQuestion(question)) {
      const essayAnswer = answer as EssayAnswer;
      if (essayAnswer.manualScore !== undefined) {
        totalScore += essayAnswer.manualScore;
        breakdown['essay'] = (breakdown['essay'] || 0) + essayAnswer.manualScore;
      }
      continue;
    }
    
    // Auto-grade
    const { isCorrect } = validateAnswer(question, answer);
    if (isCorrect) {
      totalScore += question.marks;
    }
    
    const type = question.questionType;
    breakdown[type] = (breakdown[type] || 0) + (isCorrect ? question.marks : 0);
  }
  
  return { totalScore, maxScore, breakdown };
}

// Usage
const result = await gradeAttempt('attempt_001', questions);
console.log(`Score: ${result.totalScore}/${result.maxScore}`);
console.log('Breakdown:', result.breakdown);
// Output:
// Score: 8/12
// Breakdown: {
//   mcq: 1,
//   true_false: 2,
//   short_answer: 2,
//   essay: 3  (manual score)
// }
```

---

## Essay Grading Workflow

### Teacher Grades an Essay
```typescript
async function gradeEssay(
  essayId: string,
  rubricScores: Record<string, number>,
  feedback: string,
  gradedBy: string
): Promise<void> {
  // Calculate total score from rubric
  const totalScore = Object.values(rubricScores).reduce((sum, score) => sum + score, 0);
  
  // Update essay document
  await updateDoc(doc(db, 'essays', essayId), {
    manualScore: totalScore,
    manualFeedback: feedback,
    gradedBy,
    gradedAt: Timestamp.now(),
    status: 'graded'
  });
  
  // Update the answer document
  const essay = await getDoc(doc(db, 'essays', essayId));
  const essayData = essay.data() as Essay;
  
  await updateDoc(
    doc(db, 'examAttempts', essayData.attemptId, 'answers', essayData.questionId),
    {
      manualScore: totalScore,
      manualFeedback: feedback,
      gradedBy,
      gradedAt: Timestamp.now()
    }
  );
}

// Usage
await gradeEssay(
  'essay_attempt_001_q_essay_001',
  {
    thesis: 2,      // Full marks
    evidence: 2,    // 2 of 3
    organization: 2, // Full marks
    writing: 2      // 2 of 3
  },
  'Excellent analysis! Consider expanding on the geopolitical implications.',
  'teacher_001'
);
```

### Get All Pending Essays
```typescript
async function getPendingEssays(examId: string): Promise<Essay[]> {
  const snapshot = await getDocs(
    query(
      collection(db, 'essays'),
      where('examId', '==', examId),
      where('status', '==', 'pending')
    )
  );
  
  return snapshot.docs.map(doc => ({
    essayId: doc.id,
    ...doc.data()
  })) as Essay[];
}

// Usage
const pending = await getPendingEssays('exam_001');
console.log(`${pending.length} essays awaiting grading`);
```

---

## Validation Examples

### Validate Essay Word Count
```typescript
const essayQuestion: EssayQuestion = {
  // ... fields ...
  minWords: 500,
  maxWords: 1500
};

const studentEssay = "Short essay that is only 50 words...";

const validation = validateEssayWordCount(essayQuestion, studentEssay);

if (!validation.valid) {
  console.error(validation.message);
  // Output: "Essay must have at least 500 words (current: 50)"
}
```

### Check if Answer is Complete
```typescript
const questions: Question[] = [mcqQuestion, essayQuestion];
const answers: Answer[] = [mcqAnswer, essayAnswer];

for (let i = 0; i < questions.length; i++) {
  if (isAnswerComplete(questions[i], answers[i])) {
    console.log(`Question ${i}: Answered`);
  } else {
    console.log(`Question ${i}: Skipped`);
  }
}
```

### Validate Short Answer (Case Insensitive)
```typescript
const question: ShortAnswerQuestion = {
  // ... fields ...
  acceptedAnswers: ['Paris', 'paris'],
  caseSensitive: false
};

const answer1: ShortAnswerAnswer = {
  // ... fields ...
  studentResponse: 'PARIS'
};

const answer2: ShortAnswerAnswer = {
  // ... fields ...
  studentResponse: 'london'
};

console.log(validateAnswer(question, answer1));  // { isCorrect: true }
console.log(validateAnswer(question, answer2));  // { isCorrect: false }
```

---

## Rendering Questions (Preview)

**Note:** Actual component implementation is Phase 3. These are conceptual examples.

```typescript
// Generic question renderer
function renderQuestion(question: Question) {
  switch (question.questionType) {
    case 'mcq':
      return <MCQRenderer question={question as MCQQuestion} />;
    case 'true_false':
      return <TrueFalseRenderer question={question as TrueFalseQuestion} />;
    case 'short_answer':
      return <ShortAnswerRenderer question={question as ShortAnswerQuestion} />;
    case 'essay':
      return <EssayRenderer question={question as EssayQuestion} />;
  }
}

// Type-specific renderer
function MCQRenderer({ question }: { question: MCQQuestion }) {
  // Compiler knows all MCQ-specific fields exist:
  return (
    <div>
      <h2>{question.questionText}</h2>
      {question.imageUrl && <img src={question.imageUrl} alt={question.imageAltText} />}
      <div>
        {question.options.map((opt, idx) => (
          <button key={idx}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// Essay renderer with word limit
function EssayRenderer({ question }: { question: EssayQuestion }) {
  const [text, setText] = useState('');
  const wordCount = countWords(text);
  const validation = validateEssayWordCount(question, text);
  
  return (
    <div>
      <h2>{question.questionText}</h2>
      {question.imageUrl && <img src={question.imageUrl} alt={question.imageAltText} />}
      <textarea 
        value={text} 
        onChange={e => setText(e.target.value)}
        placeholder="Enter your essay here..."
      />
      <div>
        Word count: {wordCount} 
        {question.minWords && ` / Min: ${question.minWords}`}
        {question.maxWords && ` / Max: ${question.maxWords}`}
      </div>
      {!validation.valid && <p className="error">{validation.message}</p>}
    </div>
  );
}
```

---

## Migration from Legacy MCQ

```typescript
// Old code (still works):
function handleOldQuestion(q: any) {
  if (q.options && q.correctOptionIndex !== undefined) {
    // Assume MCQ
    return renderMCQOptions(q);
  }
}

// New code (better):
function handleNewQuestion(q: Question) {
  if (q.questionType === 'mcq') {  // Explicit and clear
    return renderMCQOptions(q as MCQQuestion);
  }
  // ... handle other types
}

// Mixed (during transition):
function handleMixedQuestion(q: any) {
  const question = ensureQuestionType(q);  // Add type if missing
  
  if (isMCQQuestion(question)) {
    return renderMCQOptions(question);
  }
  // ... handle other types
}
```

---

## Complete Example: Load, Grade, Save

```typescript
async function completeExamFlow(
  attemptId: string,
  examId: string,
  userId: string
) {
  try {
    // 1. Load exam questions
    const questions = await loadQuestions(examId);
    console.log(`Loaded ${questions.length} questions`);
    
    // 2. Load student answers
    const answers = await getAnswers(attemptId);
    console.log(`Loaded ${answers.length} answers`);
    
    // 3. Grade all auto-gradable questions
    const essayIds: string[] = [];
    for (const question of questions) {
      const answer = answers.find(a => a.questionId === question.questionId);
      if (!answer) continue;
      
      if (requiresManualGrading(question)) {
        essayIds.push(question.questionId);
        continue;
      }
      
      const { isCorrect } = validateAnswer(question, answer);
      await updateDoc(
        doc(db, 'examAttempts', attemptId, 'answers', question.questionId),
        { isCorrect }
      );
    }
    
    // 4. Calculate score (only for auto-graded parts)
    const { totalScore, maxScore } = await calculateScore(attemptId, questions);
    
    // 5. Mark attempt as submitted
    await updateDoc(
      doc(db, 'examAttempts', attemptId),
      {
        isSubmitted: true,
        submittedAt: Timestamp.now(),
        totalScore,
        maxScore
      }
    );
    
    // 6. Alert if essays need grading
    if (essayIds.length > 0) {
      console.log(`${essayIds.length} essays awaiting manual grading`);
    }
    
    return { totalScore, maxScore, essaysAwaitingGrading: essayIds.length };
  } catch (error) {
    console.error('Exam completion failed:', error);
    throw error;
  }
}

// Usage
const result = await completeExamFlow('attempt_001', 'exam_001', 'student_001');
console.log(`Final score: ${result.totalScore}/${result.maxScore}`);
if (result.essaysAwaitingGrading > 0) {
  console.log(`${result.essaysAwaitingGrading} essay(s) pending teacher review`);
}
```

---

## Key Patterns

✅ **Always use type guards** before accessing type-specific fields
✅ **Use validateAnswer()** for grading instead of custom logic
✅ **Use ensureQuestionType()** when loading legacy data
✅ **Use discriminated unions** for type safety
✅ **Check isAutoGradable()** before auto-grading
✅ **Check requiresManualGrading()** to identify essays

These patterns ensure consistent, safe, and maintainable code across the application.
