# ROOT CAUSE FOUND

## The Problem

Looking at your screenshot showing "Image failed to load" - this means:

1. ✓ An image URL exists (being passed to ImagePreview)
2. ✗ But the browser cannot fetch it (HTTP request failing)

## Why This Happens

**One of these is true:**

### Option 1: URL Format Is Wrong
The URL might be malformed or incomplete.

**Check:** Open DevTools → Console → Look for `[IMAGE FLOW] ImagePreview received props:`

**Copy the exact URL it shows and test:**
- Open new tab
- Paste URL directly  
- Does image appear? ✓ YES or ✗ NO?

### Option 2: Cloudinary Asset Is Restricted
The image was uploaded to Cloudinary but:
- Set to private/authenticated
- Requires signed delivery URL
- CORS issue blocking access

**Check:** 
- Open DevTools → Network tab
- Refresh page
- Look for request to `res.cloudinary.com`
- What HTTP status? (200, 403, 404, etc?)

### Option 3: URL Contains Special Characters
The imageUrl field might have encoding issues.

**Check:** In DevTools console, paste:
```javascript
// Check the imageUrl value
console.log(document.querySelector('img[alt="Question preview"]').src)
```

Copy the exact URL it shows.

---

## What You Need to Do NOW

### Step 1: Open DevTools Console
1. Press `F12`
2. Go to **Console** tab

### Step 2: Show Me The Logs
When the image preview appears, you should see logs like:

```
[IMAGE FLOW] ImagePreview received props: {
  imageUrl: "https://res.cloudinary.com/...",
  displayMode: "background",
  optimizedUrl: "https://res.cloudinary.com/v1/...",
  isImageUrlEmpty: false
}
```

**Copy and share:**
- The exact `imageUrl` value
- The exact `optimizedUrl` value

### Step 3: Check Network Tab
1. DevTools → Network tab
2. Refresh while looking at the image preview
3. Look for requests to `res.cloudinary.com`
4. **Tell me the HTTP status** (200, 403, 404?)

### Step 4: Copy The URL
1. Right-click image → Inspect
2. Find the `<img>` tag
3. Copy the `src` attribute value
4. Paste it in new tab
5. **Does image display directly?** ✓ YES or ✗ NO?

---

## Most Likely Cause

Based on "Image failed to load" error, my guess:

**The Cloudinary URL is being passed correctly, but has one of these problems:**

1. **Malformed URL** - Missing parts, encoding issues
2. **Cloudinary CORS** - Blocking browser access
3. **Private asset** - Needs authentication or signed URL
4. **Wrong transformation** - optimizeImageUrl() broke it

---

## Quick Fix I Can Apply

Once you tell me:
- The exact imageUrl value
- The exact optimizedUrl value  
- The HTTP status from Network tab

I can fix it immediately. Likely fixes:

**If 403/401:** Need signed delivery URL
```typescript
// Add to cloudinary.ts
const signed = buildSignedUrl(imageUrl, cloudinaryConfig);
```

**If URL is malformed:** Fix the optimization
```typescript
// In image-handler.ts, fix optimizeImageUrl
```

**If CORS issue:** Configure Cloudinary settings

---

## TL;DR

**Screenshot shows:** Image preview exists but fails to load  
**What this means:** URL exists but browser can't fetch it  
**Root cause:** One of 3 things (cors, auth, malformed)  
**What I need:** Exact URL value + HTTP status

Then I fix in 5 minutes.
