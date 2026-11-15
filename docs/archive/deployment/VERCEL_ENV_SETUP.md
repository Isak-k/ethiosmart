# Vercel Environment Variables Setup

## Important: Add Environment Variables to Vercel

Your app needs environment variables to work in production. Follow these steps:

### Step 1: Go to Vercel Project Settings
1. Go to https://vercel.com/dashboard
2. Click on your project (exam_pro)
3. Click "Settings" tab
4. Click "Environment Variables" in the left sidebar

### Step 2: Add All Environment Variables

Add each of these variables:

#### AI Provider Keys (server-side only)
```
GEMINI_API_KEY=your_server_side_gemini_key
GROQ_API_KEY=your_server_side_groq_key
OPENROUTER_API_KEY=your_server_side_openrouter_key
HUGGINGFACE_API_KEY=your_server_side_huggingface_key
```
These are read ONLY by the serverless functions in `api/` (e.g. `/api/chatbot/ask`,
`/api/ai/*`). Never prefix private AI provider keys with `VITE_` — Vite embeds
`VITE_*` variables into the public client bundle.

#### Firebase Configuration
```
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Step 3: Set Environment for Each Variable
For each variable, select:
- ✅ Production
- ✅ Preview
- ✅ Development

### Step 4: Redeploy
After adding all variables:
1. Go to "Deployments" tab
2. Click the three dots (...) on the latest deployment
3. Click "Redeploy"

## Why This Is Needed

Your `.env` file is not pushed to GitHub (protected by .gitignore), so Vercel doesn't have access to these values. You must add them manually in Vercel's dashboard.

## Security Note

- `VITE_FIREBASE_*` values are safe to expose in the browser: Firebase web API
  keys are designed to be public and are protected by Firebase Security Rules
  and App Check — not by secrecy.
- `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` /
  `HUGGINGFACE_API_KEY` are PRIVATE. Set them WITHOUT the `VITE_` prefix so
  they stay on the server (Vercel serverless functions). They are never sent
  to the browser.
- Never commit real AI provider keys to the repository, and never ship them in
  the client bundle. AI providers can also be configured by an admin at
  runtime via Admin → AI Provider Settings (stored in Firestore).
- The previously committed AI keys in this repository have been removed and
  must be considered compromised — rotate them in each provider's console.
