# Image Upload & Display Debugging Trace

## Added Logging Points

I've added comprehensive logging throughout the entire image upload and display chain to trace where images are lost.

### 1. **Cloudinary Upload Response** (`src/lib/cloudinary.ts`)
```javascript
[CLOUDINARY] Upload response body: {...}
[CLOUDINARY] secure_url: <URL>
[CLOUDINARY] url: <URL>
[CLOUDINARY] public_id: <ID>
[CLOUDINARY] Final URL being returned: <URL>
[CLOUDINARY] returnUrl type: <type>
[CLOUDINARY] returnUrl is truthy: <boolean>
[CLOUDINARY] returnUrl length: <number>
[CLOUDINARY] Returning result object: {...}
```

### 2. **QuestionTypeForm Image Upload Handler** (already had logging)
```javascript
[TRACE-1] Starting upload: {...}
[TRACE-2] Upload returned result: {...}
[TRACE-2] result.url value: <URL>
[TRACE-2] result.url is truthy: <boolean>
[TRACE-2] result.url type: <type>
[TRACE-2] result.url length: <length>
[TRACE-3] Setting imageUrl state to: <URL>
[TRACE-4] Form submission started
[TRACE-4] Current imageUrl state: <URL>
[TRACE-5] Complete submissionData object: {...}
[TRACE-6] Calling onSubmit with validated data
```

### 3. **Firestore Question Creation** (`src/lib/firebase-questions.ts`)
```javascript
[IMAGE FLOW] createQuestion called with: {...}
[IMAGE FLOW] baseQuestion prepared: {...}
[IMAGE FLOW] Question saved to Firestore: {...}
```

### 4. **Firestore Question Retrieval** (`src/lib/firebase-questions.ts`)
```javascript
[FIREBASE-QUESTIONS] getQuestions called for examId: <ID>
[FIREBASE-QUESTIONS] Retrieved docs count: <number>
[FIREBASE-QUESTIONS] Document data: {...}  // Per document
[FIREBASE-QUESTIONS] Final questions array count: <number>
[FIREBASE-QUESTIONS] Question <idx>: {...}  // Per question
```

### 5. **Question Renderer** (`src/components/exam/QuestionRenderer.tsx`)
```javascript
[RENDERER] renderQuestionImage called
[RENDERER] question.imageUrl: <URL or null>
[RENDERER] question.imageUrl is truthy: <boolean>
[RENDERER] displayMode: <mode>
[RENDERER] Original URL: <URL>
[RENDERER] Optimized URL: <URL>
[RENDERER] URL matches: <boolean>
[RENDERER] Rendering background mode | Rendering inline/main mode
[IMG-TAG] Image loaded successfully: <URL>
[IMG-TAG] Image failed to load: <URL>
[IMG-TAG] Error event: {...}
[IMG-TAG] Error type: <type>
```

## Complete Test Flow

### Step 1: Upload Image
1. Open browser DevTools → Console
2. Go to admin → Create/Edit Question
3. Select an image file
4. Watch console for `[CLOUDINARY]` logs
5. Look for: **"[CLOUDINARY] Final URL being returned: https://res.cloudinary.com/..."**

### Step 2: Save Question
1. Fill in question text and other fields
2. Click Save
3. Watch console for `[TRACE-X]` and `[IMAGE FLOW]` logs
4. Verify: **"[IMAGE FLOW] Question saved to Firestore: { hasImageUrl: true, imageUrl: '...' }"**

### Step 3: Open Firestore Console
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Firestore Database
4. Navigate to: `exams → [examId] → questions → [questionId]`
5. Verify the document has these fields:
   - `imageUrl` (should contain Cloudinary URL)
   - `imageDisplayMode` (should be "inline", "background", or "main")

### Step 4: View Question in Exam
1. Go to Take Exam → Select the exam with the question
2. Open DevTools → Console
3. Watch for `[FIREBASE-QUESTIONS]` logs
4. Look for: **"[FIREBASE-QUESTIONS] Question [idx]: { hasImageUrl: true, imageUrl: '...' }"**

### Step 5: Check Image Rendering
1. Continue in the exam to the question with the image
2. Watch console for `[RENDERER]` logs
3. Check: **"[RENDERER] Original URL: https://res.cloudinary.com/..."**
4. Check: **"[IMG-TAG] Image loaded successfully: ..."** (SUCCESS) or **"[IMG-TAG] Image failed to load: ..."** (FAILURE)

## Network Tab Check

1. Open DevTools → Network tab
2. Filter for: `res.cloudinary.com`
3. Click on the image request
4. Check:
   - **Status**: Should be 200 OK
   - **Headers**: Check `Content-Type: image/jpeg` (or other format)
   - **Preview**: Image should display
5. If 401/403: Asset might be restricted. May need signed delivery URL or public upload.

## Quick Checklist

- [ ] Cloudinary returns `secure_url` with full HTTPS URL
- [ ] `result.url` is not empty
- [ ] Form submission includes `imageUrl` in submission data
- [ ] Firestore document has `imageUrl` field populated
- [ ] Question retrieval logs show `imageUrl` from Firestore
- [ ] Renderer receives `question.imageUrl` as truthy value
- [ ] Optimized URL is correct (same or transformation applied)
- [ ] Network request to Cloudinary returns 200 OK
- [ ] Image `onLoad` fires (not `onError`)
