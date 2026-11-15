# EthioSmart Homepage Chatbot

A public, pre-login promotional and informational assistant embedded on the homepage.

## What it is

- Answers questions about EthioSmart: what it is, who it serves, how it works,
  how to register, what features exist, how to install the app, and how to navigate it.
- **EthioSmart-only.** It refuses unrelated topics and never does homework, exam solving or general tutoring.
- Answers come from a curated, verified knowledge base (see
  [knowledge-base.md](knowledge-base.md)) enforced by a strict system prompt.

## What it is not

- Not a general-purpose AI assistant.
- Not an academic tutor or homework/exam solver.
- Not an "AI Study Assistant" (that feature does not exist in the app and is not advertised).

## Architecture

| Piece                       | Location                                  |
| --------------------------- | ----------------------------------------- |
| Widget UI                   | `src/components/chatbot/ChatbotWidget.tsx` |
| Client hook                 | `src/components/chatbot/useChatbot.ts`      |
| Serverless endpoint         | `api/chatbot/ask.ts` (Vercel)              |
| Dev endpoint (same handler) | `src/server/ai-bridge.ts` (Vite middleware) |
| Shared handler              | `src/server/chatbot.ts`                    |
| Knowledge base + rules      | `functions/src/chatbot/core.ts`            |
| Local env loader            | `src/server/env.ts`                        |

The production endpoint and the local dev endpoint call the **same** handler
(`handleChatbotAsk`), so behavior is identical in both environments.

## Quick reference

- Endpoint: `POST /api/chatbot/ask`
- Request: `{ "message": string, "history"?: [{ role, text }], "locale"?: "en" | "am" }`
- Response: `{ "answer": string, "links"?: [{ route, label }] }`
- Errors: 400 (invalid input), 429 (rate-limited), 503 (unavailable)
- Auth: none required; rate-limited per IP
- Key: server-side `GEMINI_API_KEY` (see [configuration.md](configuration.md))

## Documentation

- [api.md](api.md) — request/response contract and errors
- [configuration.md](configuration.md) — keys, kill switch, model
- [knowledge-base.md](knowledge-base.md) — what the assistant may claim
- [troubleshooting.md](troubleshooting.md) — diagnosing failures
