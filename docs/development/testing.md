# Testing

## What the repo provides

| Suite                  | Runner   | Command                 | Scope                                       |
| ---------------------- | -------- | ----------------------- | ------------------------------------------- |
| Frontend unit tests    | vitest   | `npm test`              | Components, lib logic, hooks, widget        |
| Functions tests        | jest     | `cd functions && npx jest chatbot` | Chatbot knowledge-base rules (38 assertions) |

## Chatbot verification status (this package)

- `npm test` → see [../reports/chatbot-verification.md](../reports/chatbot-verification.md)
- `cd functions && npx jest chatbot` → 38 passed (sanitize/parse/prompt/rate-limit rules)
- `npm run build` → expected to pass

## Known unrelated failures

A handful of suites fail for reasons unrelated to the chatbot and were left untouched:

- `gemini-question-validation.test.ts` and `GenerateQuestionsDialog.test.tsx` — zod ESM
  interop under the current Node/vitest combination (`z.object` resolves undefined).
- `use-leaderboard.test.ts` — leaderboard fetch mocking, unrelated to chatbot.
- `interactive-notes.test.ts`, `GradingErrorBoundary.test.tsx` — pre-existing, unrelated.

These are out of scope for the chatbot and are intentionally not modified.

## Production build check

```bash
npm ci
npm run build
# inspect dist/assets/ for any secret-shaped strings (see security checklist in the report)
```

## Manual UI checks (when a browser is available)

1. Homepage loads offline-capable PWA shell.
2. Floating chatbot button visible before login; open/close; submit a question.
3. Answer renders with `/auth` link chip; follow-up question works; typing indicator shows.
4. Reset conversation restores the welcome message.

## Clean-room install

`npm ci` was validated against a fresh checkout of this project (see the report); a clean
`node_modules` is deleted and reinstalled every time.
