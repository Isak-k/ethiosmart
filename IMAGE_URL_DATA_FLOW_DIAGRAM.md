# Image URL Data Flow - Visual Diagram

## Complete Data Flow from Upload to Display

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER UPLOADS IMAGE                                   │
│                    (Click upload in QuestionTypeForm)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: CLOUDINARY UPLOAD                                                   │
│ ─────────────────────────────────────────────────────────────────────────   │
│ File: src/lib/cloudinary.ts                                                 │
│ Function: uploadImageToCloudinary()                                         │
│                                                                              │
│ REQUEST: POST to https://api.cloudinary.com/v1_1/{cloud}/auto/upload       │
│ RESPONSE: {                                                                  │
│   secure_url: "https://res.cloudinary.com/your-cloud/image/upload/v123...", │
│   url: "http://res.cloudinary.com/...",                                     │
│   public_id: "exams/exam1/questions/q1/1234567890"                          │
│ }                                                                            │
│                                                                              │
│ ✓ IMAGE STORED: Cloudinary CDN                                              │
│ ✓ URL RETURNED: secure_url field                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
                          [CLOUDINARY] logs appear
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: URL STORED IN REACT STATE                                           │
│ ─────────────────────────────────────────────────────────────────────────   │
│ File: src/components/admin/QuestionTypeForm.tsx                             │
│ Function: handleImageUpload()                                               │
│                                                                              │
│ State Variable: imageUrl                                                    │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ const [imageUrl, setImageUrl] =                                        │  │
│ │   useState<string | null>(question?.imageUrl || null);                │  │
│ │                                                                        │  │
│ │ // After upload:                                                       │  │
│ │ setImageUrl("https://res.cloudinary.com/your-cloud/image/upload/...");│  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ✓ URL STORED: React component memory (RAM)                                  │
│ ✓ IMAGE PREVIEW: Displays in form if src={imageUrl}                         │
│ ✗ IF PAGE REFRESHED: URL lost (not persisted yet)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
                          [TRACE-3] log appears
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: USER FILLS FORM & SUBMITS                                           │
│ ─────────────────────────────────────────────────────────────────────────   │
│ File: src/components/admin/QuestionTypeForm.tsx                             │
│ Function: handleFormSubmit()                                                │
│                                                                              │
│ Form Data Object:                                                           │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ const submissionData = {                                              │  │
│ │   questionType: "mcq",                                                │  │
│ │   questionText: "What is 2+2?",                                       │  │
│ │   marks: 1,                                                           │  │
│ │   feedbackType: "instant",                                            │  │
│ │   options: ["4", "5", "6"],                                           │  │
│ │   correctOptionIndex: 0,                                              │  │
│ │   imageUrl: "https://res.cloudinary.com/...", ← ← ← URL INCLUDED     │  │
│ │   imageDisplayMode: "inline"                   ← ← ← MODE INCLUDED   │  │
│ │ };                                                                    │  │
│ │                                                                        │  │
│ │ // Pass to onSubmit callback:                                         │  │
│ │ onSubmit(submissionData);                                             │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ✓ URL IN MEMORY: As part of submissionData object                           │
│ ✓ PASSED TO: EditExam page via onSubmit prop                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
                          [TRACE-5] log appears
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: EDIT EXAM PAGE RECEIVES FORM DATA                                   │
│ ─────────────────────────────────────────────────────────────────────────   │
│ File: src/pages/EditExam.tsx                                                │
│ Function: handleQuestionFormSubmit()                                        │
│                                                                              │
│ Question Object Built:                                                      │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ const baseQuestion: LocalQuestion = {                                 │  │
│ │   questionType: "mcq",                                                │  │
│ │   questionText: "What is 2+2?",                                       │  │
│ │   marks: 1,                                                           │  │
│ │   imageUrl: data.imageUrl,        ← ← ← URL FROM FORM                │  │
│ │   imageDisplayMode: data.imageDisplayMode,  ← ← ← MODE FROM FORM     │  │
│ │   orderIndex: 0,                                                      │  │
│ │   ...other fields                                                     │  │
│ │ };                                                                    │  │
│ │                                                                        │  │
│ │ // Store in local questions state:                                    │  │
│ │ const newQuestions = [...questions];                                  │  │
│ │ newQuestions[0] = baseQuestion;                                       │  │
│ │ setQuestions(newQuestions);                                           │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ✓ URL IN STATE: questions[0].imageUrl                                       │
│ ✓ STORED IN: React state (not yet saved to database)                        │
│ ✗ IF PAGE REFRESHED: Lost (not persisted yet)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
                          [TRACE-8] log appears
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: SAVE EXAM TO FIRESTORE                                              │
│ ─────────────────────────────────────────────────────────────────────────   │
│ File: src/pages/EditExam.tsx                                                │
│ Function: saveExam() → Firebase functions (addQuestion/updateQuestion)     │
│                                                                              │
│ Build Question Payload:                                                     │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ const baseQuestionData = {                                            │  │
│ │   examId: "exam123",                                                  │  │
│ │   questionText: "What is 2+2?",                                       │  │
│ │   marks: 1,                                                           │  │
│ │   imageUrl: q.imageUrl,              ← ← ← URL FROM STATE            │  │
│ │   imageDisplayMode: q.imageDisplayMode,  ← ← ← MODE FROM STATE       │  │
│ │   options: ["4", "5", "6"],                                           │  │
│ │   correctOptionIndex: 0,                                              │  │
│ │   orderIndex: 0                                                       │  │
│ │ };                                                                    │  │
│ │                                                                        │  │
│ │ if (q.questionId) {                                                   │  │
│ │   await updateQuestionDb(examId, questionId, baseQuestionData);       │  │
│ │ } else {                                                               │  │
│ │   const newId = await addQuestion(examId, baseQuestionData);          │  │
│ │ }                                                                     │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ Firestore Document Written:                                                 │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ collections: exams → {examId} → questions → {questionId}             │  │
│ │ {                                                                      │  │
│ │   imageUrl: "https://res.cloudinary.com/...",  ← ← ← STORED          │  │
│ │   imageDisplayMode: "inline",                  ← ← ← STORED          │  │
│ │   questionText: "What is 2+2?",                                       │  │
│ │   marks: 1,                                                           │  │
│ │   options: ["4", "5", "6"],                                           │  │
│ │   correctOptionIndex: 0,                                              │  │
│ │   ...                                                                 │  │
│ │ }                                                                     │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ✓ URL PERSISTED: Firestore Cloud Database                                   │
│ ✓ SURVIVES: Page refresh, browser close, server restart                    │
│ ✓ ACCESSIBLE: Any client that queries this collection                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
                          [IMAGE FLOW] logs appear
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: LOAD EXAM FOR STUDENT                                               │
│ ─────────────────────────────────────────────────────────────────────────   │
│ File: src/pages/TakeExam.tsx                                                │
│ Function: loadExamData()                                                    │
│                                                                              │
│ Query Firestore:                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ const firebaseQuestions = await getQuestions(examId);                 │  │
│ │                                                                        │  │
│ │ // Returns array:                                                      │  │
│ │ [                                                                      │  │
│ │   {                                                                    │  │
│ │     questionId: "q123",                                               │  │
│ │     imageUrl: "https://res.cloudinary.com/...", ← ← ← RETRIEVED      │  │
│ │     imageDisplayMode: "inline",                 ← ← ← RETRIEVED      │  │
│ │     questionText: "What is 2+2?",                                     │  │
│ │     ...                                                               │  │
│ │   }                                                                    │  │
│ │ ]                                                                      │  │
│ │                                                                        │  │
│ │ setQuestions(loadedQuestions);  // Store in state                     │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ✓ URL RETRIEVED: From Firestore                                             │
│ ✓ IN STATE: questions[0].imageUrl                                           │
│ ✓ READY TO: Pass to QuestionRenderer component                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
                          [FIREBASE-QUESTIONS] logs appear
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 7: DISPLAY QUESTION IN EXAM                                            │
│ ─────────────────────────────────────────────────────────────────────────   │
│ File: src/components/exam/QuestionRenderer.tsx                              │
│ Component: QuestionRenderer                                                 │
│                                                                              │
│ Component Receives Props:                                                   │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ <QuestionRenderer                                                     │  │
│ │   question={{                                                         │  │
│ │     questionId: "q123",                                               │  │
│ │     imageUrl: "https://res.cloudinary.com/...", ← ← ← PROP           │  │
│ │     imageDisplayMode: "inline",                 ← ← ← PROP           │  │
│ │     questionText: "What is 2+2?",                                     │  │
│ │     ...                                                               │  │
│ │   }}                                                                  │  │
│ │ />                                                                    │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ Render Function:                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ const renderQuestionImage = () => {                                   │  │
│ │   if (!question.imageUrl) return null;  // URL missing = nothing      │  │
│ │                                                                        │  │
│ │   const optimizedUrl = optimizeImageUrl(question.imageUrl, {...});    │  │
│ │                                                                        │  │
│ │   return (                                                            │  │
│ │     <img                                                              │  │
│ │       src={optimizedUrl}  ← ← ← URL SET HERE                          │  │
│ │       alt="Question"                                                  │  │
│ │       onLoad={() => console.log("Loaded!")}                           │  │
│ │       onError={(e) => console.error("Failed!")}                       │  │
│ │     />                                                                │  │
│ │   );                                                                  │  │
│ │ };                                                                    │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ✓ URL IN COMPONENT: question.imageUrl                                       │
│ ✓ OPTIMIZATION: Applied Cloudinary transformations if enabled               │
│ ✓ READY TO: Render in HTML                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
                          [RENDERER] logs appear
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 8: RENDER HTML & LOAD IMAGE                                            │
│ ─────────────────────────────────────────────────────────────────────────   │
│ HTML Generated:                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ <img                                                                   │  │
│ │   src="https://res.cloudinary.com/your-cloud/image/upload/v123...",  │  │
│ │   alt="Question"                                                      │  │
│ │   onLoad=...                                                          │  │
│ │   onError=...                                                         │  │
│ │ />                                                                    │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ Browser Processes:                                                          │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ 1. Parse HTML img tag                                                │  │
│ │ 2. Read src attribute: "https://res.cloudinary.com/..."              │  │
│ │ 3. Send HTTP GET request to Cloudinary                               │  │
│ │ 4. Receive image data (if successful)                                │  │
│ │ 5. Decode image (JPEG/PNG/etc)                                       │  │
│ │ 6. Render in browser                                                 │  │
│ │ 7. Fire onLoad event ✓ OR onError event ✗                            │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ✓ URL IN DOM: src attribute                                                 │
│ ✓ NETWORK REQUEST: GET https://res.cloudinary.com/...                       │
│ ✓ IF SUCCESS (200 OK): onLoad fires, image displays                         │
│ ✗ IF FAILURE (404/403): onError fires, no image                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
                          [IMG-TAG] logs appear
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ✓✓✓ IMAGE DISPLAYS IN BROWSER ✓✓✓                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Where to Check Each Step

| Step | What to Check | How to Check |
|------|--------------|--------------|
| 1 | Cloudinary returned URL | Browser DevTools Console → `[CLOUDINARY]` logs |
| 2 | React state has URL | Browser DevTools Console → `[TRACE-3]` logs |
| 3 | Form data includes URL | Browser DevTools Console → `[TRACE-5]` logs |
| 4 | EditExam state has URL | Browser DevTools Console → `[TRACE-8]` logs |
| 5 | Firestore document has URL | Firebase Console → Firestore Database → exams → {id} → questions → {qid} |
| 6 | Question retrieved with URL | Browser DevTools Console → `[FIREBASE-QUESTIONS]` logs |
| 7 | Component received URL | Browser DevTools Console → `[RENDERER]` logs |
| 8 | Image loaded successfully | Browser DevTools Console → `[IMG-TAG]` logs + Network tab |

---

## Where Is The Image URL Stored? (Quick Answer)

**By Stage:**
- **Stage 1-3:** React component state (lost on refresh)
- **Stage 4-5:** Firestore cloud database `exams/{id}/questions/{qid}/imageUrl` (permanent)
- **Stage 6-7:** React component state & props (temporary during exam)
- **Stage 8:** HTML `<img src="URL">` tag (displayed in browser)

**Most Important Storage:** Firestore Database - this is the permanent storage
