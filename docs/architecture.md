# Architecture

## High-level overview

```
┌───────────────────────────────────────────────────────────────┐
│  React 18 + TypeScript SPA (Vite 5, Tailwind, shadcn-ui)      │
│  PWA: service worker (public/sw.js), IndexedDB, manifest      │
└───────┬───────────────────────────────┬───────────────────────┘
        │ Firebase SDK (client)         │ same-origin HTTP
        ▼                               ▼
┌─────────────────────┐        ┌────────────────────────────────┐
│ Firebase            │        │ Serverless functions in api/   │
│  - Auth             │        │  (Vercel; local dev: Vite      │
│  - Cloud Firestore  │        │   middleware aiDevPlugin)      │
│  - Storage          │        │  - POST /api/chatbot/ask       │
│  - Cloud Functions  │        │  - POST /api/ai/generate-batch │
│    (functions/)     │        │  - GET  /api/ai/provider-status│
└─────────────────────┘        │  - POST /api/drive/*           │
                               └────────────────────────────────┘
```

Two server-side paths exist for the AI workloads; **the chatbot uses the `/api` path**:

1. **Vercel serverless (`api/`)** — the code used in production. The local Vite dev server
   also serves these handlers through a dev middleware (`src/server/ai-bridge.ts`) so the
   app works end-to-end without any deployment.
2. **Firebase Cloud Functions (`functions/`)** — retains the Firebase-callable version of the
   homepage assistant (`askEthioSmartAssistant`, with Firestore-backed rate limiting). It is
   kept for reference and is not required for the web app to run.

## Frontend structure

- `src/pages/` — routed pages (public homepage, Auth, About, Dashboard and its sections).
- `src/components/` — UI components, including `components/chatbot/` (ChatbotWidget).
- `src/lib/` — client SDK helpers (books, exams, offline storage, permissions, …).
- `src/integrations/firebase/client.ts` — Firebase web SDK init (public config).
- `src/hooks/` — reusable hooks.
- `src/server/` — **server-only** shared code (chatbot handler, dev-environment loader,
  AI-dev middleware). Nothing here is ever bundled into the client.

## Data flow for the homepage chatbot

```
Visitor ──► ChatbotWidget (lazy-loaded, public homepage)
        ──► useChatbot()
        ──► POST /api/chatbot/ask   { message, history }
        ──► handleChatbotAsk()      (sanitize → rate-limit → Gemini)
        ──► Gemini API (key never leaves the server)
        ──► { answer, links[] }
```

## Offline support

- App shell and static assets are cached by `public/sw.js` (cache-first with network fallback).
- Downloaded books/exams and practice-exam attempts are stored in IndexedDB.
- Firestore uses IndexedDB persistence (`enableMultiTabIndexedDbPersistence`).
- `public/offline.html` is the offline fallback.

## Project structure

```
.
├── api/                      Vercel serverless functions (chatbot, AI, Drive)
├── functions/                Firebase Cloud Functions (optional callable chatbot)
├── public/                   Static assets (PWA icons, sw.js, offline.html)
├── src/
│   ├── components/           UI components
│   ├── integrations/firebase Firebase web SDK wiring
│   ├── lib/                  App logic (client-side)
│   ├── pages/                Routes
│   └── server/               Server-only code (never shipped to browser)
├── docs/                     Documentation
├── scripts/                  Maintainer one-off scripts
├── firebase.json             Firestore/Storage/Functions config
├── firestore.rules|indexes   Firestore security rules and indexes
├── storage.rules             Storage security rules
├── vercel.json               Vercel rewrites (SPA + /api/*)
├── vite.config.ts            Vite config (uses aiDevPlugin in dev)
└── package.json              Root package manifest (lockfile committed)
```

See [development/getting-started.md](development/getting-started.md) to run the project and
[deployment/handoff.md](deployment/handoff.md) to deploy it.
