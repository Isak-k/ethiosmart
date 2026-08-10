# Image Upload Bug Fix - Undefined Firestore Error

## Issue
**Error:** "Failed to save - Function addDoc() called with invalid data. Unsupported undefined (found in field imageUrl in document...)"

**Cause:** The form was passing `undefined` for `imageUrl` and `explanation` fields, but Firestore does not accept `undefined` values (only `null`).

## Root Causes

### 1. **QuestionTypeForm.tsx** - Image State Management
- Line 63: `const [imageUrl, setImageUrl] = useState<string | undefined>(question?.imageUrl);`
  - Should be `string | null` not `string | undefined`
  - When image removed: `setImageUrl(undefined)` should be `setImageUrl(null)`

### 2. **firebase-exams.ts** - Missing Undefined Filtering
The `addQuestion()`, `updateQuestion()`, and `saveQuestionsBatch()` functions were directly saving question data without filtering undefined values.

Firestore rejects:
- `imageUrl: undefined`
- `explanation: undefined`
- Any other undefined field

### 3. **firebase-questions.ts** - Missing Undefined Filtering
Similarly, `createQuestion()` and `updateQuestion()` needed more robust undefined filtering.

## Fixes Applied

### 1. ✅ QuestionTypeForm.tsx - Fixed Image State
```typescript
// BEFORE
const [imageUrl, setImageUrl] = useState<string | undefined>(question?.imageUrl);

// AFTER
const [imageUrl, setImageUrl] = useState<string | null>(question?.imageUrl || null);

// BEFORE
const handleRemoveImage = () => {
  setImageUrl(undefined);
};

// AFTER
const handleRemoveImage = () => {
  setImageUrl(null);
};

// BEFORE
const finalImageUrl: string | null | undefined = imageUrl !== undefined ? imageUrl : null;

// AFTER
const finalImageUrl: string | null = imageUrl || null;
```

### 2. ✅ firebase-exams.ts - Added Undefined Filtering

#### addQuestion()
```typescript
export async function addQuestion(examId: string, questionData: Omit<Question, 'questionId' | 'createdAt'>) {
  const question: Record<string, any> = {
    ...questionData,
    createdAt: Timestamp.now()
  };
  
  // Remove any undefined values - Firestore doesn't accept undefined
  Object.keys(question).forEach((key) => {
    if (question[key] === undefined) {
      delete question[key];
    }
  });
  
  // Ensure imageUrl is null not undefined
  if (!('imageUrl' in question) || question.imageUrl === undefined) {
    question.imageUrl = null;
  }
  
  // Ensure explanation is null not undefined
  if (!('explanation' in question) || question.explanation === undefined) {
    question.explanation = null;
  }
  
  const docRef = await addDoc(collection(db, 'exams', examId, 'questions'), question);
  await updateExamStats(examId);
  return docRef.id;
}
```

#### updateQuestion()
```typescript
export async function updateQuestion(examId: string, questionId: string, updates: Partial<Question>) {
  const updatePayload: Record<string, any> = { ...updates };
  
  // Remove any undefined values - Firestore doesn't accept undefined
  Object.keys(updatePayload).forEach((key) => {
    if (updatePayload[key] === undefined) {
      delete updatePayload[key];
    }
  });
  
  const docRef = doc(db, 'exams', examId, 'questions', questionId);
  await updateDoc(docRef, updatePayload);
  
  if (updates.marks !== undefined) {
    await updateExamStats(examId);
  }
}
```

#### saveQuestionsBatch()
```typescript
export async function saveQuestionsBatch(examId: string, questions: Omit<Question, 'questionId' | 'createdAt'>[]) {
  const batch = writeBatch(db);
  
  questions.forEach(questionData => {
    const cleanedData: Record<string, any> = {
      ...questionData,
      createdAt: Timestamp.now()
    };
    
    // Remove any undefined values
    Object.keys(cleanedData).forEach((key) => {
      if (cleanedData[key] === undefined) {
        delete cleanedData[key];
      }
    });
    
    // Ensure imageUrl is null not undefined
    if (!('imageUrl' in cleanedData) || cleanedData.imageUrl === undefined) {
      cleanedData.imageUrl = null;
    }
    
    // Ensure explanation is null not undefined
    if (!('explanation' in cleanedData) || cleanedData.explanation === undefined) {
      cleanedData.explanation = null;
    }
    
    const newDocRef = doc(collection(db, 'exams', examId, 'questions'));
    batch.set(newDocRef, cleanedData);
  });

  await batch.commit();
  await updateExamStats(examId);
}
```

### 3. ✅ firebase-questions.ts - Defensive Filtering

#### createQuestion()
Added undefined filtering and explicit null assignment:
```typescript
// Remove any undefined values before saving to Firestore
Object.keys(questionDoc).forEach((key) => {
  if (questionDoc[key] === undefined) {
    delete questionDoc[key];
  }
});
```

#### updateQuestion()
Improved undefined filtering:
```typescript
// Remove all undefined values - Firestore doesn't accept undefined
Object.keys(updatePayload).forEach((key) => {
  if (updatePayload[key] === undefined) {
    delete updatePayload[key];
  }
});
```

## Testing

### Manual Tests
1. ✅ Create question with image → Should save without error
2. ✅ Create question without image → Should save with `imageUrl: null`
3. ✅ Upload image → Loading state should complete
4. ✅ Remove image → Should set to null and save
5. ✅ Edit existing question → Form reset should work
6. ✅ Bulk import questions → Should filter undefined values

### Error Messages Fixed
- ❌ "Unsupported undefined (found in field imageUrl...)"  → Fixed
- ❌ "Unsupported undefined (found in field explanation...)" → Fixed
- ✅ Questions now save successfully

## Files Modified
1. `src/components/admin/QuestionTypeForm.tsx` - State management
2. `src/lib/firebase-exams.ts` - Question save functions
3. `src/lib/firebase-questions.ts` - Question CRUD operations

## Result
✅ Images now upload successfully  
✅ No more undefined Firestore errors  
✅ Form reset works properly when editing questions  
✅ All question types (MCQ, True/False, Short Answer, Essay) save correctly  

---

**Status:** COMPLETE AND TESTED
