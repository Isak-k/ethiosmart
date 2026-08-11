# Where Image URL Is Stored - Complete Trace

## 1. After Cloudinary Upload

**Location in Memory:** React Component State  
**File:** `src/components/admin/QuestionTypeForm.tsx`  
**Variable:** `imageUrl` state variable

```typescript
const [imageUrl, setImageUrl] = useState<string | null>(question?.imageUrl || null);

// After upload, set to:
setImageUrl("https://res.cloudinary.com/your-cloud/image/upload/v123/exams/exam1/questions/q1/1234567890.jpg");
```

**Storage Type:** React state (RAM memory)  
**Persistence:** Lost on page refresh unless saved to database

---

## 2. When Form Is Submitted

**Location in Memory:** Form submission data object  
**File:** `src/components/admin/QuestionTypeForm.tsx`  
**Variable:** `submissionData`

```typescript
const submissionData = {
  ...data,
  imageUrl: "https://res.cloudinary.com/...",  // ← HERE
  imageDisplayMode: "inline",
} as NewQuestionInput;
```

**What happens next:**
- Passed to `onSubmit` callback
- Sent to EditExam page handler: `handleQuestionFormSubmit`

---

## 3. In EditExam Page (Before Firestore Save)

**Location in Memory:** Local questions array  
**File:** `src/pages/EditExam.tsx`  
**Variable:** `questions` state → specific question object

```typescript
// In handleQuestionFormSubmit:
const baseQuestion: LocalQuestion = {
  questionText: data.questionText,
  marks: data.marks,
  imageUrl: data.imageUrl,                    // ← STORED HERE
  imageDisplayMode: data.imageDisplayMode,    // ← AND HERE
  ...
};

// Stored in local state:
newQuestions[index] = questionToSave;  // Contains imageUrl
setQuestions(newQuestions);
```

**Storage Type:** React state (RAM memory)  
**Persistence:** Lost on page refresh unless saved to database

---

## 4. When Exam Is Saved to Firestore

**Location:** Firestore document field  
**Database Path:** `exams/{examId}/questions/{questionId}`  
**Field Name:** `imageUrl`

```typescript
// In src/pages/EditExam.tsx, saveExam function:
const baseQuestionData: Record<string, any> = {
  examId: id,
  questionText: q.questionText,
  marks: q.marks,
  imageUrl: q.imageUrl,                    // ← STORED HERE in database payload
  imageDisplayMode: q.imageDisplayMode,
  ...
};

// Sent to Firebase:
if (q.questionId) {
  await updateQuestionDb(id, q.questionId, questionData);
} else {
  const newId = await addQuestion(id, questionData);
}
```

**Storage Type:** Firestore Database (Cloud)  
**Collection:** `exams`  
**Document:** `{examId}`  
**Subcollection:** `questions`  
**Document:** `{questionId}`  
**Field:** `imageUrl` (string type)  
**Persistence:** Permanent (until deleted)

### Firestore Console Path:
```
Firestore Database
  └─ exams (collection)
      └─ {examId} (document)
          └─ questions (subcollection)
              └─ {questionId} (document)
                  ├─ imageUrl: "https://res.cloudinary.com/..."  ← HERE
                  ├─ imageDisplayMode: "inline"
                  ├─ questionText: "..."
                  └─ ...other fields
```

---

## 5. When Question Is Retrieved for Exam

**Location in Memory:** Questions array  
**File:** `src/pages/TakeExam.tsx`  
**Function:** `loadExamData()`

```typescript
// Step 1: Query Firestore
const firebaseQuestions = await getQuestions(id);

// Step 2: Each question object contains:
{
  questionId: "q1234",
  imageUrl: "https://res.cloudinary.com/...",     // ← STORED HERE
  imageDisplayMode: "inline",
  questionText: "...",
  ...
}

// Step 3: Store in state
setQuestions(loadedQuestions);
```

**Storage Type:** React state (RAM memory)  
**Stored in:** `questions` state array  
**Access path:** `questions[currentIndex].imageUrl`

---

## 6. When Question Is Displayed in Exam

**Location in Component Props:** `Question` object prop  
**File:** `src/components/exam/QuestionRenderer.tsx`  
**Component:** `QuestionRenderer`

```typescript
interface QuestionRendererProps {
  question: Question;  // This is the object containing imageUrl
}

// Inside component:
export function QuestionRenderer({
  questionNumber,
  question,  // ← Contains imageUrl and imageDisplayMode
  ...
}) {
  // Access the URL:
  if (!question.imageUrl) return null;
  
  const url = question.imageUrl;  // ← IMAGE URL IS HERE
}
```

**Storage Type:** Component prop (React)  
**Accessed as:** `question.imageUrl` (string)

---

## 7. When Image Is Rendered in HTML

**Location in DOM:** `<img>` tag src attribute  
**File:** `src/components/exam/QuestionRenderer.tsx`  
**Function:** `renderQuestionImage()`

```typescript
return (
  <div className={getImageContainerClasses(displayMode)}>
    <img
      src={optimizedUrl}  // ← IMAGE URL IS HERE in DOM
      alt="Question"
      className={cn(getImageDisplayClasses(displayMode), 'rounded-lg')}
      loading="lazy"
      onLoad={() => console.log("Image loaded!")}
      onError={(e) => console.error("Image failed!")}
    />
  </div>
);
```

**Storage Type:** HTML DOM attribute  
**HTML:** `<img src="https://res.cloudinary.com/..." />`

---

## 8. Browser Network Request

**Location:** HTTP request to Cloudinary CDN  
**URL:** `https://res.cloudinary.com/{cloud}/image/upload/...`

**DevTools Path:**
```
DevTools → Network Tab
  └─ Filter: "res.cloudinary.com"
      └─ Image request
          ├─ URL: https://res.cloudinary.com/...
          ├─ Method: GET
          ├─ Status: 200 OK (or error)
          ├─ Headers: Content-Type: image/jpeg
          └─ Preview: [image preview]
```

**Storage Type:** HTTP GET request parameter  
**Response:** Binary image data (if successful)

---

## Summary Table

| Step | Location | Storage Type | Where to Find |
|------|----------|--------------|---------------|
| 1 | Cloudinary Upload | React State | `imageUrl` variable in QuestionTypeForm |
| 2 | Form Submit | JS Object | `submissionData.imageUrl` |
| 3 | EditExam Page | React State | `questions[index].imageUrl` in EditExam state |
| 4 | **Firestore Database** | **Cloud Database** | **Firestore → exams → {id} → questions → {qid} → imageUrl field** |
| 5 | Question Load | React State | `questions[i].imageUrl` in TakeExam state |
| 6 | Render Component | Component Prop | `question.imageUrl` in QuestionRenderer |
| 7 | HTML DOM | HTML Attribute | `<img src={imageUrl} />` |
| 8 | Browser | HTTP Request | DevTools Network tab |

---

## Quick Check: Where Is My Image URL Right Now?

### If Question Just Uploaded (Not Yet Saved):
**Check React DevTools or Console:**
```javascript
// In browser console:
localStorage.getItem('imageUrl')  // If stored locally
// OR watch for [TRACE-3] log in console
```

### If Question Was Saved:
**Check Firestore Console:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Open Firestore Database
3. Navigate: `exams` → [your exam ID] → `questions` → [question ID]
4. Look for the `imageUrl` field

**Or in browser console when loading exam:**
```javascript
// Open DevTools Console
// Look for [FIREBASE-QUESTIONS] logs
// They show: Question 0: { imageUrl: "https://..." }
```

### If Question Is Currently Displayed:
**Check in React DevTools or Console:**
```javascript
// In browser console:
// Look for [RENDERER] logs showing question.imageUrl value
// OR inspect <img> element and check src attribute
```

---

## Image URL Lost = Which Step Failed?

If image doesn't appear, find where it's missing:

```
Upload Complete? → Check [TRACE-3] log for imageUrl ✓
  ↓
Form Submitted? → Check [TRACE-5] log for submissionData.imageUrl ✓
  ↓
Firestore Saved? → Check Firestore console for imageUrl field ✓
  ↓
Question Loaded? → Check [FIREBASE-QUESTIONS] log for imageUrl ✓
  ↓
Rendered Component? → Check [RENDERER] log for question.imageUrl ✓
  ↓
HTML Has URL? → Inspect <img src="..."> in DevTools ✓
  ↓
Browser Fetches? → Check Network tab for HTTP 200 ✓
  ↓
✓ IMAGE DISPLAYS
```

If any ✓ has missing URL, that's the failure point.
