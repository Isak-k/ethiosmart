# How to Verify The Fix Is Working

## Current Status

✓ You manually added `imageUrl` to Firestore  
✓ Images now display in the exam  
✗ But the code still isn't automatically saving `imageUrl`

## Root Cause

The imageUrl field is not being saved when you create/edit questions through the form. 

## How to Test the Fix

### Test 1: Create New Question with Image

1. Go to Admin → Manage Exams → Edit Exam
2. Click "Add Question"
3. Fill in question details
4. **Upload an image** (IMPORTANT)
5. Click "Save Question"
6. **Don't close the dialog yet**
7. Open **DevTools Console** (`F12`)
8. Look for logs showing:
   - `[SAVE-DEBUG] Question 0 baseQuestionData: { hasImageUrl: true, imageUrl: "https://...", allFields: [..., "imageUrl", ...] }`
   - `[TRACE-8] Final questionToSave object: { hasImageUrl: true, imageUrl: "...", ... }`

### Test 2: Save Exam

1. After adding question, scroll to top
2. Click **"Save Exam"** button
3. **Watch console for:**
   - `[SAVE-DEBUG] Question 0 baseQuestionData: { hasImageUrl: true, imageUrl: "...", allFields: [..., "imageUrl", ...] }`
   - `[SAVE-DEBUG] Creating new question with imageUrl: "https://..."`
   - `[FIREBASE-EXAMS] addQuestion called with imageUrl: "https://..."`
   - `[FIREBASE-EXAMS] About to save question to Firestore with fields: { hasImageUrl: true, imageUrl: "...", allFields: [...] }`

### Test 3: Check Firestore

1. Open **Firebase Console** → **Firestore**
2. Navigate to: `exams` → [exam-id] → `questions` → [NEW question-id]
3. **Check:** Does it have an `imageUrl` field?
4. **Value:** Is it the Cloudinary URL?

### Test 4: View in Exam

1. Go to **Take Exam** → Select the exam
2. Look at the question with the image
3. **Does image display?** ✓ YES (then it's working)

---

## What Each Log Means

**If you see `hasImageUrl: true` in all logs:**
- ✓ Code is working correctly
- ✓ Go check Firestore - should have imageUrl field

**If you see `hasImageUrl: false`:**
- ✗ imageUrl is being lost somewhere
- Find the FIRST log where it becomes false
- That's where the bug is

**If you don't see `[SAVE-DEBUG]` logs:**
- ✗ Different code path being used
- Or exam save isn't being called
- Check that you clicked "Save Exam" button

---

## Rebuild If Needed

I added new logging. If you need fresh build:

```bash
npm run build
```

Then reload your app.

---

## Report Back With

- ✓ or ✗ - Did you see `[SAVE-DEBUG]` logs in console?
- ✓ or ✗ - Did they show `hasImageUrl: true`?
- ✓ or ✗ - Does Firestore have `imageUrl` field in new question?
- ✓ or ✗ - Does image display when viewing exam?

Then I know exactly what's still broken.
