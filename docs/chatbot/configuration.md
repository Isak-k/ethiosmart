# Chatbot configuration

## Required variables

Set these on the server that runs the API function — **never** in client code and never
with a `VITE_` prefix:

| Variable          | Required | Default               | Purpose                                   |
| ----------------- | -------- | --------------------- | ----------------------------------------- |
| `GEMINI_API_KEY`  | yes      | (none)                | Google AI Studio key used to call Gemini. |
| `CHATBOT_ENABLED` | no       | `true`                | Set to `false` to disable the assistant (kill switch). |
| `CHATBOT_MODEL`   | no       | `gemini-3.5-flash-lite` | Override the Gemini model id.           |

If `GEMINI_API_KEY` is missing, empty or invalid, the endpoint answers with a friendly
HTTP 503 and the assistant tells the visitor it is temporarily unavailable — the page
itself is unaffected.

## Where to get a key

Create a Google AI Studio API key at https://aistudio.google.com/apikey, then store it
server-side only (see below). Rotate any key that may have been committed to source
control — see [../reports/chatbot-verification.md](../reports/chatbot-verification.md).

## Local development

1. Copy `.env.example` to `.env.local` (git-ignored).
2. Set `GEMINI_API_KEY=<your key>` (other variables optional).
3. Restart `npm run dev`. The dev server loads `.env.local` into the server process via
   `src/server/env.ts` (shell environment wins, then `.env.local`, then `.env`).

Never print, paste or commit the key.

## Production (Vercel)

1. Vercel Dashboard → your project → **Settings → Environment Variables**.
2. Add `GEMINI_API_KEY` (and optionally `CHATBOT_ENABLED`, `CHATBOT_MODEL`) scoped to
   Production/Preview as desired.
3. Redeploy. No source changes are required.

## Behavior notes

- The client bundle never contains the key; all calls go through the same-origin API route.
- `CHATBOT_ENABLED=false` returns a 503-style friendly response for every question.
- The model id is validated with a strict allow-list pattern; unexpected values fall back
  to `gemini-3.5-flash-lite`.
- The endpoint does not accept client-supplied keys; any keys present in local storage are
  used only for the admin AI-generation UI, never for the homepage chatbot.
