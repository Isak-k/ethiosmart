# Quick Image Debug Reference

## TL;DR - What Changed

Added detailed console logging to track images through 5 stages:
1. Cloudinary upload
2. Form submission  
3. Firestore save
4. Firestore retrieval
5. Browser rendering

## Test in 90 Seconds

1. Open DevTools Console (`F12`)
2. Go admin → Create question with image
3. Upload image → **Check for `[TRACE-3] Setting imageUrl state to: ...`**
4. Save question → **Check for `[IMAGE FLOW] Question saved to Firestore: { hasImageUrl: true }`**
5. Copy that URL and open in new tab → **Image must display**
6. Refresh page, view exam → **Check for `[RENDERER] question.imageUrl: ...`** and **`[IMG-TAG] Image loaded successfully`**

## Log Prefixes (What to Search For)

| When | What to Look For | Location |
|------|------------------|----------|
| Uploading | `[CLOUDINARY]` | In console during upload |
| Saving form | `[TRACE-3]` then `[IMAGE FLOW]` | In console when clicking Save |
| Loading exam | `[FIREBASE-QUESTIONS]` | In console when exam page loads |
| Rendering question | `[RENDERER]` then `[IMG-TAG]` | In console when viewing question |

## If Image Doesn't Appear

Copy & paste the exact first error:
1. Can't find `[TRACE-3]`? → Cloudinary didn't return URL
2. Can't find `[IMAGE FLOW] hasImageUrl: true`? → Form didn't save URL
3. Can't find `[RENDERER] question.imageUrl`? → Firestore didn't retrieve URL
4. Can't find `[IMG-TAG] Image loaded`? → Browser can't fetch image (check Network tab for HTTP status)

## Firestore Check

1. Firebase Console → Firestore
2. `exams` → [your exam] → `questions` → [question id]
3. Look for `imageUrl` field → **must exist and contain full https:// URL**

## Network Tab Check

1. DevTools → Network
2. Filter for `res.cloudinary.com`
3. Click on image request
4. Check **Status**: should be `200 OK` (not 403/404)

## Files Modified

- `src/lib/cloudinary.ts` - Logs Cloudinary response
- `src/lib/firebase-questions.ts` - Logs Firestore save/retrieve
- `src/components/exam/QuestionRenderer.tsx` - Logs rendering & img tag events
- `src/components/admin/QuestionTypeForm.tsx` - Already had good logging

## No Code Logic Changes

Only added `console.log()` statements. No upload flow changed.

## Build Status

✓ Build passes, all diagnostics clean, ready to test.
