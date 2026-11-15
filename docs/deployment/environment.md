# Environment variables

Copy `.env.example` to `.env.local` for local development (git-ignored). In production,
set the same names in your Vercel project's **Settings → Environment Variables**.

**Never commit real values. Never use a `VITE_` prefix for private keys.**

## Client-side (public; inlined into the browser bundle)

| Name                              | Purpose                                        |
| --------------------------------- | ---------------------------------------------- |
| `VITE_FIREBASE_API_KEY`           | Firebase web SDK key (public by design)        |
| `VITE_FIREBASE_AUTH_DOMAIN`       | Firebase Auth domain                           |
| `VITE_FIREBASE_PROJECT_ID`        | Firebase project id                            |
| `VITE_FIREBASE_STORAGE_BUCKET`    | Firebase Storage bucket                        |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender id                                |
| `VITE_FIREBASE_APP_ID`            | Firebase app id                                |
| `VITE_CLOUDINARY_CLOUD_NAME`      | Cloudinary cloud name (subject covers; optional) |
| `VITE_CLOUDINARY_UPLOAD_PRESET`   | Cloudinary unsigned preset (optional)          |

## Server-side (private; never shipped to the browser)

| Name                  | Used by                                     | Required for        |
| --------------------- | ------------------------------------------- | ------------------- |
| `GEMINI_API_KEY`      | `api/chatbot/ask.ts`, `api/ai/*`            | Homepage chatbot    |
| `GROQ_API_KEY`        | `api/ai/generate-batch.ts`                  | Admin AI generation |
| `OPENROUTER_API_KEY`  | `api/ai/generate-batch.ts`                  | Admin AI generation |
| `HUGGINGFACE_API_KEY` | `api/ai/generate-batch.ts`                  | Admin AI generation |
| `CHATBOT_ENABLED`     | chatbot                                     | Kill switch (default `true`) |
| `CHATBOT_MODEL`       | chatbot                                     | Model override (default `gemini-3.5-flash-lite`) |
| `GOOGLE_DRIVE_API_KEY`| `api/drive/*`                               | Google Drive import tooling (admin) |

Notes on visibility: the client bundle never contains server-side keys; Vite inlines only
`VITE_*` variables. Server-side keys are read exclusively from `process.env` by the
serverless functions, both in production and in the local dev middleware.

Firebase Functions (optional path) use their own secrets — see
[../deployment/handoff.md](../deployment/handoff.md#7-firebase-cloud-functions-optional).
