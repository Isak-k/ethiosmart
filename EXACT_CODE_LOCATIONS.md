# Exact Code Locations - Where Image URL Is Stored

## File-by-File Breakdown

### 1. Image Upload & State Storage

**File:** `src/components/admin/QuestionTypeForm.tsx`

```typescript
// LINE ~60: State variable declaration
const [imageUrl, setImageUrl] = useState<string | null>(question?.imageUrl || null);
//  ^^^^^^^^
//  URL STORED HERE (first place in React)

// LINE ~220: Upload handler
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  // ... validation ...
  
  const result = await uploadQuestionImage(file, examId, tempQId);
  
  // LINE ~245: URL stored in state
  setImageUrl(result.url);
  //          ^^^^^^^^^^^
  //          URL SET HERE from Cloudinary response
  
  // Check console logs around LINE ~240:
  console.log("[TRACE-2] result.url value:", result.url);
  console.log("[TRACE-3] Setting imageUrl state to:", result.url);
};

// LINE ~835: Display uploaded image preview
{imageUrl ? (
  <div className="space-y-4">
    <ImagePreview
      imageUrl={imageUrl}  // ← URL used from state here
      displayMode={imageDisplayMode}
      onRemove={handleRemoveImage}
    />
  </div>
) : null}
```

---

### 2. Form Submission with URL

**File:** `src/components/admin/QuestionTypeForm.tsx`

```typescript
// LINE ~310: Form submit handler
const handleFormSubmit = async (data: NewQuestionInput) => {
  // LINE ~330: Read current state
  const finalImageUrl: string | null = imageUrl || null;
  //                                     ^^^^^^^
  //                                     URL READ FROM STATE HERE
  
  console.log("[TRACE-4] Current imageUrl state:", imageUrl);
  
  // LINE ~335: Build submission data
  const submissionData = {
    ...data,
    imageUrl: finalImageUrl,    // ← URL INCLUDED HERE
    imageDisplayMode,
  } as NewQuestionInput;
  
  console.log("[TRACE-5] Complete submissionData object:", {
    imageUrl: submissionData.imageUrl,  // ← Logged here
    imageDisplayMode: submissionData.imageDisplayMode,
  });
  
  // LINE ~345: Send to parent component
  await onSubmit(submissionData);
  //             ^^^^^^^^^^^^^^^^
  //             URL PASSED HERE to EditExam
};
```

---

### 3. EditExam Page - Local State Storage

**File:** `src/pages/EditExam.tsx`

```typescript
// LINE ~107: Questions state
const [questions, setQuestions] = useState<LocalQuestion[]>([]);
//                 ^^^^^^^^^
//                 URL STORED IN questions[index].imageUrl

// LINE ~490: Receive form data
const handleQuestionFormSubmit = async (data: NewQuestionInput) => {
  
  // LINE ~510: Read from form
  const baseQuestion: LocalQuestion = {
    questionText: data.questionText,
    marks: data.marks,
    imageUrl: data.imageUrl,           // ← URL FROM FORM HERE
    //        ^^^^^^^^^^^^^
    imageDisplayMode: data.imageDisplayMode,
    questionType: data.questionType,
  };
  
  console.log("[TRACE-8] baseQuestion.imageUrl:", baseQuestion.imageUrl);
  
  // LINE ~565: Store in state
  newQuestions[index] = questionToSave;
  setQuestions(newQuestions);
  //           ^^^^^^^^^^^^
  //           URL NOW IN STATE: questions[index].imageUrl
};
```

---

### 4. Firestore Save - Database Write

**File:** `src/pages/EditExam.tsx`

```typescript
// LINE ~300: Build database payload
const saveExam = async () => {
  // ...
  
  const baseQuestionData: Record<string, any> = {
    examId: id,
    questionText: q.questionText,
    marks: q.marks,
    imageUrl: q.imageUrl,                  // ← URL FROM STATE HERE
    //        ^^^^^^^^^^
    imageDisplayMode: q.imageDisplayMode,
    orderIndex: i,
    questionType: q.questionType,
  };
  
  // LINE ~340: Send to Firebase
  if (q.questionId) {
    await updateQuestionDb(id, q.questionId, baseQuestionData);
    //                                      ^^^^^^^^^^^^^^^^
    //                                      URL SENT TO DATABASE HERE
  } else {
    const newId = await addQuestion(id, baseQuestionData);
    //                               ^^^^^^^^^^^^^^^^
    //                               URL SENT TO DATABASE HERE
  }
};
```

---

### 5. Firebase Functions - Database Write

**File:** `src/lib/firebase-exams.ts`

```typescript
// LINE ~292: Add question function
export async function addQuestion(
  examId: string,
  questionData: Omit<Question, 'questionId' | 'createdAt'>
) {
  const question: Record<string, any> = {
    ...questionData,  // ← imageUrl included here from parameter
    //  ^^^^^^^^^^^^
    createdAt: Timestamp.now()
  };
  
  // LINE ~309: Ensure imageUrl exists
  if (!('imageUrl' in question) || question.imageUrl === undefined) {
    question.imageUrl = null;
  }
  
  // LINE ~314: Write to Firestore
  const docRef = await addDoc(
    collection(db, 'exams', examId, 'questions'),
    question  // ← Contains imageUrl field
    //^^^^^^^
    //URL WRITTEN TO FIRESTORE HERE
  );
  
  return docRef.id;
}

// LINE ~336: Update question function
export async function updateQuestion(
  examId: string,
  questionId: string,
  updates: Partial<Question>
) {
  const updatePayload: Record<string, any> = { ...updates };
  //                                           ^^^^^^^^
  //                                           imageUrl in updates
  
  // LINE ~348: Write to Firestore
  const docRef = doc(db, 'exams', examId, 'questions', questionId);
  await updateDoc(docRef, updatePayload);
  //              ^^^^^^^ ^^^^^^^^^^^^^^
  //              URL WRITTEN TO FIRESTORE HERE
}
```

**Firestore Database Structure:**
```
collections:
  exams (collection)
    ├─ {examId} (document)
    │   ├─ title: "..."
    │   └─ questions (subcollection)
    │       └─ {questionId} (document)
    │           ├─ imageUrl: "https://res.cloudinary.com/..."  ← ← ← HERE
    │           ├─ imageDisplayMode: "inline"
    │           ├─ questionText: "..."
    │           └─ ...other fields
```

---

### 6. Firebase Functions - Database Retrieve

**File:** `src/lib/firebase-questions.ts`

```typescript
// LINE ~133: Get questions function
export async function getQuestions(examId: string): Promise<Question[]> {
  
  const questionsSnap = await getDocs(
    query(
      collection(db, 'exams', examId, 'questions'),
      orderBy('orderIndex', 'asc')
    )
  );
  
  // LINE ~140: Map documents to questions
  const questions = questionsSnap.docs.map((doc) => {
    const data = doc.data();
    //          ^^^^^^^^^^^
    //          Contains imageUrl field from Firestore
    
    console.log("[FIREBASE-QUESTIONS] Document data:", {
      imageUrl: data.imageUrl,  // ← Logged here
    });
    
    return {
      questionId: doc.id,
      ...data,  // ← imageUrl included here
      //^^^^^
      //URL RETRIEVED FROM DATABASE HERE
    } as Question;
  });
  
  return questions;
}
```

---

### 7. Question Type Definition

**File:** `src/integrations/firebase/types.ts`

```typescript
// LINE ~67: Base question interface
export interface BaseQuestion {
  questionId: string;
  examId: string;
  questionText: string;
  marks: number;
  orderIndex: number;
  feedbackType: 'instant' | 'hidden';
  explanation?: string;
  imageUrl?: string;            // ← IMAGE URL FIELD DEFINED HERE
  //^^^^^^
  imageDisplayMode?: 'inline' | 'background' | 'main';
  //^^^^^^^^^^^^^^^
  createdAt: Timestamp;
  questionType: QuestionType;
}

// LINE ~112: All question types extend BaseQuestion
export type Question = 
  | MCQQuestion 
  | TrueFalseQuestion 
  | ShortAnswerQuestion 
  | EssayQuestion;
  // All include imageUrl field from BaseQuestion
```

---

### 8. Component Receive & Render

**File:** `src/components/exam/QuestionRenderer.tsx`

```typescript
// LINE ~15: Component props interface
interface QuestionRendererProps {
  question: Question;  // ← Contains imageUrl
  //       ^^^^^^^^
}

// LINE ~27: Component receives props
export function QuestionRenderer({
  question,  // ← question.imageUrl accessible here
  //^^^^^^^^
  ...
}) {
  
  // LINE ~205: Render image function
  const renderQuestionImage = () => {
    console.log("[RENDERER] question.imageUrl:", question.imageUrl);
    //                                           ^^^^^^^^^^^^^^^^^^
    //                                           URL ACCESSED HERE
    
    if (!question.imageUrl) return null;
    
    const optimizedUrl = optimizeImageUrl(question.imageUrl);
    //                                     ^^^^^^^^^^^^^^^^^
    //                                     URL USED HERE
    
    return (
      <div className={getImageContainerClasses(displayMode)}>
        <img
          src={optimizedUrl}  // ← URL SET IN HTML HERE
          //  ^^^^^^^^^^^^^
          alt="Question"
          onLoad={() => {
            console.log("[IMG-TAG] Image loaded successfully:", optimizedUrl);
            //                                               ^^^^^^^^^^^^^
            //                                               SUCCESS: URL worked
          }}
          onError={(e) => {
            console.error('[IMG-TAG] Image failed to load:', optimizedUrl);
            //                                              ^^^^^^^^^^^^^
            //                                              FAILURE: URL problem
          }}
        />
      </div>
    );
  };
}
```

---

### 9. TakeExam Page - Load Questions

**File:** `src/pages/TakeExam.tsx`

```typescript
// LINE ~110: Questions state
const [questions, setQuestions] = useState<Question[]>([]);
//                 ^^^^^^^^^
//                 questions[i].imageUrl available here

// LINE ~200: Load exam data
const loadExamData = async (): Promise<LoadedExamData | null> => {
  // ...
  
  const firebaseQuestions = await getQuestions(id);
  //                         ^^^^^^^^^^^^^^^^^^^
  //                         URL RETRIEVED FROM DATABASE HERE
  //                         Each question has imageUrl field
  
  return {
    exam: firebaseExam,
    questions: firebaseQuestions,  // ← imageUrl in each question
    //        ^^^^^^^^^^^^^^^^^
  };
};

// LINE ~130: Store in state
const { exam: loadedExam, questions: loadedQuestions } = examData;
setQuestions(loadedQuestions);
//           ^^^^^^^^^^^^^^^^
//           URL NOW IN STATE: questions[index].imageUrl
```

---

## Quick Reference: Line Numbers

| What | File | Approximate Line |
|------|------|-----------------|
| Upload to state | `QuestionTypeForm.tsx` | 245 |
| Form submission | `QuestionTypeForm.tsx` | 335 |
| EditExam receives | `EditExam.tsx` | 515 |
| EditExam state | `EditExam.tsx` | 575 |
| Save to Firestore | `EditExam.tsx` | 308 |
| Database write | `firebase-exams.ts` | 314 |
| Database read | `firebase-questions.ts` | 140 |
| Type definition | `types.ts` | 75 |
| Component receive | `QuestionRenderer.tsx` | 27 |
| Component render | `QuestionRenderer.tsx` | 205 |
| HTML img tag | `QuestionRenderer.tsx` | 215 |

---

## Trace Through Code

Follow the imageUrl variable through the code:

```
1. User uploads image
   ↓
2. src/lib/cloudinary.ts: uploadImageToCloudinary()
   Returns: { url: "https://res.cloudinary.com/...", ... }
   ↓
3. src/components/admin/QuestionTypeForm.tsx: line 245
   setImageUrl(result.url)
   ↓
4. src/components/admin/QuestionTypeForm.tsx: line 335
   submissionData = { imageUrl: imageUrl, ... }
   ↓
5. src/pages/EditExam.tsx: line 515
   baseQuestion = { imageUrl: data.imageUrl, ... }
   ↓
6. src/pages/EditExam.tsx: line 575
   setQuestions([...questions]) where questions[i].imageUrl = imageUrl
   ↓
7. src/pages/EditExam.tsx: line 308
   baseQuestionData = { imageUrl: q.imageUrl, ... }
   ↓
8. src/lib/firebase-exams.ts: line 314
   addDoc(collection(...), { imageUrl: "...", ... })
   ↓
🔴 FIRESTORE DATABASE: exams/{id}/questions/{qid}/imageUrl = "https://..."
   ↓
9. src/lib/firebase-questions.ts: line 140
   data.imageUrl retrieved from Firestore
   ↓
10. src/pages/TakeExam.tsx: line 110
    questions[i].imageUrl available in state
    ↓
11. src/components/exam/QuestionRenderer.tsx: line 205
    question.imageUrl passed as prop
    ↓
12. src/components/exam/QuestionRenderer.tsx: line 215
    <img src={optimizedUrl} /> where optimizedUrl = question.imageUrl
    ↓
13. Browser renders <img> and fetches from Cloudinary CDN
    ↓
✓ IMAGE DISPLAYS IN BROWSER
```

Each step either preserves or loses the URL. The logs tell you which step failed.
