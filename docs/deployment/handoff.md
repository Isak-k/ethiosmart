# Handoff & deployment guide (project owner)

This guide deploys the packaged EthioSmart project from scratch on your own GitHub and
Vercel accounts. The archive already contains everything you need; you do **not** need to
change any application code to go live.

## 0. Prerequisites

- A **GitHub** account (push this project to a repository you own)
- A **Vercel** account (Hobby plan is fine) connected to GitHub
- A **Google AI Studio** API key for the chatbot (https://aistudio.google.com/apikey)
- A **Firebase project** (Auth, Firestore, Storage, Cloud Functions) for the app itself;
  Firestore rules and indexes are included in this archive.
- Node.js 20+ and npm 10+ on your machine (only for local development/testing).

## 1. Unpack and install

```bash
unzip ethiosmart-handoff.zip
cd ethiosmart
npm ci                # uses the committed package-lock.json
npm run build         # confirms the production build passes
```

## 2. Run locally (optional)

```bash
cp .env.example .env.local
# edit .env.local — set VITE_FIREBASE_* and GEMINI_API_KEY (server-only)
npm run dev           # http://localhost:8080
```

The homepage chatbot works locally only if `GEMINI_API_KEY` is set in `.env.local`.

## 3. Push to your GitHub

```bash
git init          # or: create an empty repo on GitHub and push to it
git add .
git commit -m "Initial EthioSmart handoff"
git remote add origin https://github.com/<your-account>/<your-repo>.git
git push -u origin main
```

`.gitignore` excludes `.env*`, `node_modules/`, `dist/`, `dev-dist/`, logs and `.secret.local`.
**Double-check that `.env.local` is not committed.**

## 4. Create the Vercel project

1. Vercel Dashboard → **Add New… → Project** → import your GitHub repository.
2. Vercel auto-detects **Vite**. Confirm:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
   - **Root Directory:** repository root (leave blank)
3. **Do not deploy yet** — add environment variables first.

## 5. Configure environment variables

Vercel → Project → **Settings → Environment Variables**. Add (server-only, no `VITE_`
prefix for the AI keys):

| Name                | Required | Notes                                |
| ------------------- | -------- | ------------------------------------ |
| `GEMINI_API_KEY`    | yes      | Google AI Studio key (server-only)   |
| `GROQ_API_KEY`      | optional | Admin AI-generation tools            |
| `OPENROUTER_API_KEY`| optional | Admin AI-generation tools            |
| `HUGGINGFACE_API_KEY` | optional | Admin AI-generation tools          |
| `CHATBOT_ENABLED`   | optional | `false` disables the chatbot         |

Client-side configuration (also as env vars so both forks/deployments stay consistent):
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
optional `VITE_CLOUDINARY_CLOUD_NAME` / `VITE_CLOUDINARY_UPLOAD_PRESET`.

**Never commit real values.** The client-side `VITE_*` values are public by design
(protected by Firebase rules + App Check); the server-side keys are not.

## 6. Deploy and verify

1. Click **Deploy**.
2. Verify the app: open the deployment URL, sign in (or use a guest, if enabled by an
   admin).
3. Verify the chatbot endpoint:

```bash
curl -X POST https://<your-deployment>/api/chatbot/ask \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is EthioSmart?","history":[]}'
```

Expected: HTTP 200 with `{"answer": "…", "links": [{ "route": "/auth", "label": "Sign up / Sign in" }]}`.
A 503 means `GEMINI_API_KEY` is not set for the deployment — the site itself stays usable.

4. Firestore: deploy the rules and indexes shipped in this archive:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 7. Firebase Cloud Functions (optional)

`functions/` contains an optional Firebase-callable version of the chatbot and the
department-leaderboard calculators. Deploying it requires the **Blaze** (pay-as-you-go)
plan — it is **not required** to run the web app or the Vercel chatbot. To deploy:

```bash
cd functions
npm ci
npm run build
firebase deploy --only functions
```

## 8. Chatbot content/limits

The assistant answers only EthioSmart questions from a verified knowledge base
(`functions/src/chatbot/core.ts`, `SYSTEM_PROMPT`). It refuses homework and unrelated
questions. To adjust its wording or facts, edit `SYSTEM_PROMPT`, rebuild, and redeploy
(you do not need Blaze for the Vercel path).

Rate limits: 5 messages/minute and 30/day per IP (in-memory, per instance; see
`docs/chatbot/api.md`).

## 9. What this archive deliberately excludes

- `.env*` files and all secrets (set them yourself, above)
- `node_modules/`, `dist/`, `dev-dist/` (rebuilt on install/build)
- `.git/` and any local tooling state

Nothing else is required to run or deploy the project.
