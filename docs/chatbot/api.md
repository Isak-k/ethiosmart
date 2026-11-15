# Chatbot API

## `POST /api/chatbot/ask`

Public, unauthenticated endpoint. Both environments use the same handler
(`src/server/chatbot.ts`).

### Request

```json
{
  "message": "What is EthioSmart?",
  "history": [
    { "role": "user", "text": "Hello" },
    { "role": "assistant", "text": "Hi! Ask me anything about EthioSmart." }
  ],
  "locale": "en"
}
```

| Field     | Type    | Required | Rules                                             |
| --------- | ------- | -------- | ------------------------------------------------- |
| `message` | string  | yes      | Non-empty after cleaning; max 1,000 characters.   |
| `history` | array   | no       | Max 6 turns; roles `user`/`assistant`; each ≤ 1,000 chars. |
| `locale`  | `"en"` \| `"am"` | no | Optional; defaults to the language of the message. |

### Response `200`

```json
{
  "answer": "EthioSmart is Ethiopia's comprehensive smart educational platform …",
  "links": [{ "route": "/auth", "label": "Sign up / Sign in" }]
}
```

`links` is optional and contains at most 3 internal routes, drawn only from the
allowlist: `/auth`, `/about`, `/dashboard`, `/dashboard/books`, `/dashboard/exams`,
`/dashboard/results`.

### Errors

| Status | Body                                | Meaning                                    |
| ------ | ----------------------------------- | ------------------------------------------ |
| 400    | `{ "error": "…" }`                  | Invalid input (missing/empty/too long message, malformed body) |
| 405    | `{ "error": "Method not allowed" }` | Only POST is accepted                      |
| 429    | `{ "error": "…" }`                  | Rate-limited (5/minute, 30/day per IP)     |
| 503    | `{ "error": "…" }`                  | Unavailable (kill switch, missing/invalid key, provider error, timeout) |

All error bodies use the same friendly message where the cause is internal;
users never see API keys or stack traces.

### Rate limiting

Per-IP, in-memory, best-effort: 5 messages per minute and 30 per day per client IP,
plus a fair-use global daily cap. On serverless this is per instance and **not a hard
global limit** (see `docs/chatbot/troubleshooting.md`).

### Example

```bash
curl -X POST http://localhost:8080/api/chatbot/ask \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is EthioSmart?","history":[]}'
```
