# Find Root Cause - Final Test

## Problem Confirmed
✗ **imageUrl field DOES NOT EXIST** in your Firestore questions

Your Firestore document has these fields:
- correctOptionIndex
- createdAt
- examId
- explanation
- feedbackType
- marks
- options

**MISSING:** imageUrl and imageDisplayMode

---

## Root Cause Analysis - Do This Now

### Step 1: Upload New Question with Image

1. Go to Admin → Manage Exams → Edit Exam → Add Question
2. Fill in all fields
3. **Upload an image** (IMPORTANT - must upload)
4. Click **Save**
5. Open **DevTools Console** (`F12`)

### Step 2: Watch Console Logs

Look for these specific logs (they appear when you save):

```
[SAVE-DEBUG] Question 0 baseQuestionData: { 
  hasImageUrl: true/false,
  imageUrl: "https://...",
  imageDisplayMode: "inline"
}

[SAVE-DEBUG] Creating new question with imageUrl: "https://res.cloudinary..."

[FIREBASE-EXAMS] addQuestion called with imageUrl: "https://res.cloudinary..."

[FIREBASE-EXAMS] About to save question to Firestore with fields: {
  hasImageUrl: true/false,
  imageUrl: "https://...",
  allFields: ["questionId", "examId", "questionText", "imageUrl", ...]
}
```

### Step 3: Report What You See

**Tell me:**

1. ✓ or ✗ - Do you see `[SAVE-DEBUG]` logs?
2. ✓ or ✗ - Do they show `hasImageUrl: true`?
3. ✓ or ✗ - Do they show the Cloudinary URL?
4. ✓ or ✗ - Does `[FIREBASE-EXAMS]` log appear?
5. ✓ or ✗ - Is `imageUrl` in the `allFields` array?

---

## What These Logs Tell Us

**If logs show `hasImageUrl: true` but field still doesn't appear in Firestore:**
- → Firestore is stripping the field (permissions/security rules issue)
- → Fix: Check firestore.rules

**If logs show `hasImageUrl: false`:**
- → URL is lost before reaching Firestore
- → Find which log is the FIRST to show `false`
- → That's where it's lost

**If no `[SAVE-DEBUG]` logs appear:**
- → Different code path is being used
- → Might be using different save function

---

## Quick Copy-Paste Console Test

While viewing the exam edit page, paste this in console:

```javascript
// Check what's in the questions state
console.log("Current questions in state:", window.__questions);

// This will help us see what's being stored locally before save
```

---

## Once You Report

Based on your logs, I can fix it in one of these ways:

1. **If URL is lost in EditExam** → Fix handleQuestionFormSubmit
2. **If URL is lost in firebase-exams** → Fix addQuestion function  
3. **If Firestore strips it** → Fix security rules
4. **If different code path used** → Find & fix that path

**Just run the test and tell me exactly what logs you see.**
