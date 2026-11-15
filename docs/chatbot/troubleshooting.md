# Chatbot troubleshooting

## The chatbot button does not appear / the panel is empty

- Hard refresh the page (the widget is lazy-loaded; a stale cache can serve an old chunk).
- Check the browser console for errors on the homepage.
- Confirm the widget is mounted in `src/pages/Index.tsx` (`<ChatbotWidget />`).

## Every question returns the "temporarily unavailable" message

Check, in order:

1. **Missing or invalid `GEMINI_API_KEY`** — the endpoint answers 503. Set/rotate the key
   (local: `.env.local`; Vercel: Project Settings → Environment Variables) and redeploy
   or restart the dev server.
2. **Kill switch active** — `CHATBOT_ENABLED=false` disables the assistant.
3. **Provider error** — Gemini may be unreachable (network/quota). The server logs the
   status code only; check your Google AI Studio quota and billing.

## "You're sending messages too fast" / "today's message limit"

Rate limiting (5/minute, 30/day per IP). Wait a minute / come back tomorrow. Note that
limits are **per server instance** on serverless; they are a fair-use damping mechanism,
not a hard global quota.

## "Please ask a shorter question"

Messages are limited to 1,000 characters (UI enforces the same limit).

## I changed `core.ts` but the answers did not change

- Local dev: Vite restarts on `functions/src/chatbot/core.ts` changes — check the dev
  server log.
- Production (Vercel): redeploy; the function route bundles the file at build time.
- Firebase callable path (`functions/src/chatbot/index.ts`): redeploy the callable
  (`cd functions && npm run build && firebase deploy --only functions`).

## The dev server shows HTTP 403 for app files

The dev middleware blocks dotfiles and `*.log` from being served (they are not part of the
app). If `/node_modules/.vite/deps/*` is 403, the dev middleware is out of date — restart
the dev server; `/node_modules/` is allowed.

## How to verify after deployment

```bash
curl -X POST https://YOUR-DOMAIN/api/chatbot/ask \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is EthioSmart?","history":[]}'
```

Expected: HTTP 200 with `{"answer": "…", "links": […]}`. A 503 means the environment
variables are not set for the deployment.

## Collect evidence

- Browser network tab → request to `/api/chatbot/ask` → status + response body.
- Dev server terminal or Vercel function logs (status codes only, never the key).
- `npm test` (frontend) and `cd functions && npx jest chatbot` (knowledge-base rules).
