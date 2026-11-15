# Getting started

## Requirements

- Node.js 20+ (22/24 LTS recommended)
- npm 10+

## Install and run

```bash
npm ci          # deterministic install (lockfile is committed)
npm run dev     # dev server → http://localhost:8080
```

If port 8080 is already in use, the next instance automatically binds the next free port
(Vite default behavior).

## Useful scripts

| Command             | Action                                   |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Vite dev server with `/api/*` middleware |
| `npm run build`     | Production build → `dist/`                |
| `npm run build:dev` | Development build                        |
| `npm test`          | Frontend vitest suite                    |
| `npm run test:watch`| Vitest in watch mode                     |
| `npm run preview`   | Serve the production build locally       |
| `npm run lint`      | ESLint                                   |

Firebase Functions:

```bash
cd functions
npm ci
npm test          # 38 chatbot/core assertions (jest)
npm run build     # TypeScript compile → functions/lib (git-ignored)
```

## Local environment

Copy `.env.example` to `.env.local` and fill in your own values:

- `VITE_FIREBASE_*` — your Firebase web config
- `GEMINI_API_KEY` — server-side key for the chatbot (never commit)

`.env.local` is git-ignored and excluded from deployment artifacts. The dev server loads
it into the server process via `src/server/env.ts` (shell wins, then `.env.local`, then
`.env`). The client bundle never sees it.

To verify the local chatbot, ask a question in the widget on the homepage or:

```bash
curl -X POST http://localhost:8080/api/chatbot/ask \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is EthioSmart?","history":[]}'
```

## Optional: Firebase emulator

`firebase emulators:start` enables the Firestore emulator (host `127.0.0.1:8091`). Cloud
Functions are **not required** for local web development. The optional callable chatbot
route can be exercised against the emulator — see `docs/chatbot/`.

## Troubleshooting

See [../chatbot/troubleshooting.md](../chatbot/troubleshooting.md) for chatbot-specific
issues and the archive for historical notes (`docs/archive/`).
