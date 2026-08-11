# Complete Image Upload & Display Trace Test Guide

## Prerequisites

- Cloudinary is configured and working (you confirmed images appear in Cloudinary Media Library)
- Firefox or Chrome browser with DevTools
- A test exam ready
- A test image file (any JPG/PNG under 5MB)

## Test Procedure

### Phase 1: Upload and Save Question

#### Step 1A: Open Browser DevTools Console
1. Open Firefox or Chrome
2. Press `F12` or `Ctrl+Shift+I` to open DevTools
3. Go to **Console** tab
4. Clear console with `console.clear()`

#### Step 1B: Create/Edit Question with Image
1. Go to Dashboard → Admin → Manage Exams → [Select Exam] → Edit
2. Click "Add Question" or "Edit Question"
3. Fill in:
   - Question Type: MCQ (or any type)
   - Question Text: "Test question with image"
   - Marks: 1
   - Feedback Type: Instant
   - MCQ Options: "Option A", "Option B"
   - Correct Option: Option A
4. **DO NOT SAVE YET**

#### Step 1C: Upload Image
1. Scroll to "Question Image (Optional)" section
2. Click the upload box or drag image file
3. **Watch Console** for these logs in order:

```
[TRACE-1] Starting upload: { file: ..., examId: "...", questionId: ... }
[CLOUDINARY] Upload response body: { secure_url: "https://res.cloudinary.com/...", ... }
[CLOUDINARY] secure_url: https://res.cloudinary.com/...
[CLOUDINARY] Final URL being returned: https://res.cloudinary.com/...
[CLOUDINARY] returnUrl type: string
[CLOUDINARY] returnUrl is truthy: true
[CLOUDINARY] returnUrl length: 120+ (should be significant length)
[TRACE-2] Upload returned result: { url: "https://res.cloudinary.com/...", ... }
[TRACE-2] result.url value: https://res.cloudinary.com/...
[TRACE-2] result.url is truthy: true
[TRACE-3] Setting imageUrl state to: https://res.cloudinary.com/...
```

**CRITICAL CHECK:** Copy the URL from `[TRACE-3]`. Open it directly in a new browser tab. **The image must display.**

#### Step 1D: Verify Image Display in Form
- The image should appear in the form with options to replace or remove it
- If image shows: ✓ Upload to React state is working
- If no image shows: ✗ **TRACE-3 URL is wrong**

#### Step 1E: Save Question
1. Select display mode: "Inline with question text" (or test each mode)
2. Click "Save" button
3. **Watch Console** for:

```
[TRACE-4] Form submission started
[TRACE-4] Current imageUrl state: https://res.cloudinary.com/...
[TRACE-4] Is imageUrl truthy? true
[TRACE-5] Complete submissionData object: { imageUrl: "https://res.cloudinary.com/...", imageDisplayMode: "inline", ... }
[IMAGE FLOW] createQuestion called with: { hasImageUrl: true, imageUrl: "https://res.cloudinary.com/...", ... }
[IMAGE FLOW] baseQuestion prepared: { hasImageUrl: true, imageUrl: "https://res.cloudinary.com/...", ... }
[IMAGE FLOW] Question saved to Firestore: { questionId: "xyz", hasImageUrl: true, imageUrl: "https://res.cloudinary.com/..." }
```

**CRITICAL:** If you see `hasImageUrl: false` anywhere, URL was lost. Stop and report where.

---

### Phase 2: Verify Firestore Document

#### Step 2A: Open Firestore Console
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Firestore Database**
4. Navigate: `exams` → [Your Exam ID] → `questions` → [Question Document ID]
5. **Look for these fields in the document:**
   ```
   imageUrl: "https://res.cloudinary.com/..."   ← MUST EXIST
   imageDisplayMode: "inline"                    ← MUST EXIST
   questionText: "Test question with image"
   ... other fields
   ```

**CRITICAL:** 
- ✓ If both `imageUrl` and `imageDisplayMode` exist: Save succeeded
- ✗ If `imageUrl` is missing: Data didn't reach Firestore
- ✗ If `imageUrl` is null/empty: URL was lost during save

#### Step 2B: Copy Exact URL from Firestore
1. Click on the `imageUrl` field
2. Copy the full URL
3. Open new browser tab
4. Paste URL in address bar and press Enter
5. **Image must display**

**If URL shows 403/401/404:** Asset has restricted access. Mark this for later investigation.

---

### Phase 3: Retrieve Question and Check if URL Persists

#### Step 3A: Refresh Exam Edit Page
1. Press `F5` to refresh the edit exam page
2. **Watch Console** for:

```
[FIREBASE-QUESTIONS] getQuestions called for examId: "..."
[FIREBASE-QUESTIONS] Retrieved docs count: X
[FIREBASE-QUESTIONS] Document data: { id: "...", hasImageUrl: true, imageUrl: "https://res.cloudinary.com/...", ... }
[FIREBASE-QUESTIONS] Final questions array count: X
[FIREBASE-QUESTIONS] Question 0: { questionId: "...", hasImageUrl: true, imageUrl: "https://res.cloudinary.com/..." }
```

**CRITICAL CHECK:**
- ✓ If `hasImageUrl: true`: URL was retrieved from Firestore
- ✗ If `hasImageUrl: false`: URL not in Firestore or not mapped correctly

---

### Phase 4: View Question in Exam and Check Display

#### Step 4A: Open Exam as Student
1. Go to Dashboard → Take Exam → [Select Exam]
2. Click "Start Exam"
3. Navigate to the question with image
4. **Watch Console** for:

```
[FIREBASE-QUESTIONS] getQuestions called for examId: "..."
[FIREBASE-QUESTIONS] Question X: { hasImageUrl: true, imageUrl: "https://res.cloudinary.com/..." }
[RENDERER] renderQuestionImage called
[RENDERER] question.imageUrl: https://res.cloudinary.com/...
[RENDERER] question.imageUrl is truthy: true
[RENDERER] displayMode: inline
[RENDERER] Original URL: https://res.cloudinary.com/...
[RENDERER] Optimized URL: https://res.cloudinary.com/...  ← May have transformations
[RENDERER] Rendering inline/main mode
```

#### Step 4B: Check Image Load in Browser
1. Look at the Question card
2. **If image appears:** Go to Network check (Step 4C)
3. **If image does NOT appear:** Check console for:

```
[IMG-TAG] Image failed to load: https://res.cloudinary.com/...
```

This indicates the URL exists but image failed to load.

#### Step 4C: Open DevTools Network Tab
1. Still viewing the exam question
2. Open DevTools → **Network** tab
3. Scroll to find request to `res.cloudinary.com`
4. Click on it
5. **Check:**
   - **Status**: Should be `200 OK`
   - **Content-Type**: Should be `image/jpeg` (or `image/png`, etc.)
   - **Preview**: Image should display in preview

**If Status is 403/401:**
- Asset is restricted/authenticated
- May need signed delivery URL or public upload

**If Status is 404:**
- URL is incorrect or Cloudinary asset was deleted

---

## Troubleshooting Decision Tree

### Image appears in Cloudinary Media Library but NOT in exam:

**Q1: Does console show `[TRACE-3] Setting imageUrl state to: ...`?**
- **NO** → Cloudinary upload failed. Check `[CLOUDINARY]` logs for errors
- **YES** → Go to Q2

**Q2: Does console show `[IMAGE FLOW] Question saved to Firestore: { hasImageUrl: true }`?**
- **NO** → Data lost between form submission and Firestore. Check `[TRACE-5]` logs
- **YES** → Go to Q3

**Q3: Does Firestore document have `imageUrl` field with value?**
- **NO** → Database save failed. Check Firebase permissions
- **YES** → Go to Q4

**Q4: When viewing exam, does console show `[RENDERER] question.imageUrl: https://...`?**
- **NO** → Question retrieval lost the URL. Check `[FIREBASE-QUESTIONS]` logs
- **YES** → Go to Q5

**Q5: Does console show `[IMG-TAG] Image loaded successfully`?**
- **YES** → Image is loading! Check if display is just hidden by CSS
- **NO** → Check `[IMG-TAG] Image failed to load` and check Network tab for HTTP status

---

## Console Log Locations & Meaning

| Log Prefix | File | Meaning |
|-----------|------|---------|
| `[CLOUDINARY]` | src/lib/cloudinary.ts | Cloudinary API response |
| `[TRACE-X]` | src/components/admin/QuestionTypeForm.tsx | Form upload/submit lifecycle |
| `[IMAGE FLOW]` | src/lib/firebase-questions.ts | Firestore save/load |
| `[FIREBASE-QUESTIONS]` | src/lib/firebase-questions.ts | Question retrieval from Firestore |
| `[RENDERER]` | src/components/exam/QuestionRenderer.tsx | Image rendering attempt |
| `[IMG-TAG]` | src/components/exam/QuestionRenderer.tsx | HTML `<img>` tag load/error events |

---

## What Was Added

- Enhanced logging at every step
- Image URL tracking from upload through to browser render
- Type and truthiness checking
- Network request monitoring
- Clear success/failure signals

**The goal:** Identify exactly which step loses the image URL.
