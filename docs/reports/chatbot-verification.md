# Chatbot verification report

Environment: local Linux, Node.js (npm 10+), Vite 5, the project at
`/home/usama/Downloads/ethiosmart-main`. Date: 2026-11-15.

## Result summary

| Check                                             | Result                        |
| ------------------------------------------------- | ----------------------------- |
| `npm ci` (deterministic clean install)            | PASS (exit 0)                 |
| `npm run build` (production build)                | PASS (exit 0, ~15 s)          |
| Chatbot frontend tests (`ChatbotWidget.test.tsx`) | 5 passed                      |
| Chatbot knowledge-base tests (`functions`, jest)  | 38 passed                     |
| Full frontend suite (`npm test`)                  | 209 passed / 8 pre-existing unrelated failures (documented; unchanged) |
| Live homepage chatbot via real browser            | PASS (mount, open/close, send, answer, follow-up, zero console errors) |
| Endpoint behavior matrix                          | PASS (200/400/405/429/503 verified over HTTP) |
| Key never leaves the server                       | PASS (no client bundle key; browser never calls Gemini; verified by CDP network audit) |

## What was actually verified (not claimed)

1. **Dev server on http://localhost:8080** started with the standard `npm run dev`; the
   homepage mounts (React renders ≈28 KB of DOM) and the chatbot FAB is visible.
2. **Browser conversation (headless Chrome via DevTools Protocol):** opened the panel,
   asked "What is EthioSmart?", received a correct Gemini answer with an `/auth` link
   chip, asked "How do I register?" as a follow-up — conversation and rendering OK, zero
   console errors or exceptions.
3. **Network audit (browser):** no requests from the browser to
   `generativelanguage.googleapis.com`; only same-origin `/api/chatbot/ask` requests with
   `{message, history}` payloads; no key material in any request or response.
4. **Error matrix (live HTTP):** non-POST → 405; empty/whitespace message → 400;
   >1000-character message → 400; malformed JSON → 400; invalid Gemini key → 503 with the
   friendly message; missing key → 503 with the friendly message; 6 rapid consecutive
   calls → first 5 succeed, 6th returns the friendly rate-limit message (per-instance).
5. **Bundle scan:** production `dist/` contains no private provider keys (only the
   public-by-design Firebase web SDK key; prefix-validation strings in the admin UI are
   literals, not secrets).
6. **Knowledge base:** the assistant correctly says there is **no** AI tutor, does not
   advertise payment/free-forever claims, and stays within the EthioSmart feature set
   (verified by live questioning and by the 38 knowledge-base assertions).

## Explicitly NOT verified

- A live Vercel production deployment (the project owner will deploy this handoff).
- Real shareable end-user impact metrics (latency/error rate) in production.
- On-device mobile rendering on physical handsets (checked responsively by CSS and by
  headless Chromium, not on hardware).
- Firebase Functions deployment (not required; requires the owner's Blaze plan).

## Security notes

- The `functions/.secret.local` Gemini key was copied into the local `.env.local` per the
  project owner's instruction; both files are git-ignored and excluded from any archive.
- Rate limiting is in-memory per instance; treat it as abuse damping, not a hard global
  quota. A shared store (e.g. Upstash) would be needed for a global cap.
