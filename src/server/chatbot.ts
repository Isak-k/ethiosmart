/**
 * Server-side handler for the EthioSmart homepage promotional assistant.
 *
 * This is the SAME logic the Firebase callable `askEthioSmartAssistant` runs,
 * exposed through the app's standard `/api/*` architecture instead:
 *   - local dev (vite): served by the aiDevPlugin middleware (see server/ai-bridge.ts)
 *   - production (Vercel): served by the serverless function in api/chatbot/ask.ts
 *
 * Key design points:
 *  - The Gemini key is read ONLY from the server-side environment variable
 *    GEMINI_API_KEY (trimmed; empty is treated as missing). There is no
 *    hardcoded or committed fallback and no implicit secret-file reading.
 *    Without it the handler fails closed with HTTP 503.
 *  - Pure request building/parsing is shared with the Firebase function via
 *    functions/src/chatbot/core.ts (no Firebase imports — safe to reuse).
 *  - Best-effort in-memory rate limiting per instance (5/min, 30/day per IP,
 *    2000/day global). On serverless this is per-instance; the Firebase
 *    callable remains the path with strict Firestore-backed enforcement.
 *  - Fail-closed: any provider/limiter failure returns a friendly message.
 *  - No message content is logged or persisted.
 */

import {
  sanitizeChatRequest,
  buildGeminiBody,
  parseGeminiResponse,
  extractLinks,
  resolveClientIpKey,
  isIpLiteral,
  rateLimitVerdict,
  type ChatHistoryTurn,
} from '../../functions/src/chatbot/core.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 15_000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const UNAVAILABLE_MESSAGE =
  'The EthioSmart AI Assistant is temporarily unavailable. Please try again in a moment — or sign up and explore the app!';

/* -------------------------------------------------------------------------- */
/* Best-effort in-memory rate limiting (per server instance)                 */
/* -------------------------------------------------------------------------- */

const minuteBuckets = new Map<string, { minute: string; count: number }>();
const dayBuckets = new Map<string, { day: string; count: number }>();
const globalCounter = { day: '', count: 0 };

function pruneMaps(now: Date) {
  if (minuteBuckets.size > 5000) {
    const minute = now.toISOString().slice(0, 16);
    for (const [k, v] of minuteBuckets) if (v.minute !== minute) minuteBuckets.delete(k);
  }
  if (dayBuckets.size > 5000) {
    const day = now.toISOString().slice(0, 10);
    for (const [k, v] of dayBuckets) if (v.day !== day) dayBuckets.delete(k);
  }
}

export function checkRateLimit(ipKey: string): { allowed: true } | { allowed: false; message: string } {
  const now = new Date();
  const minute = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM (UTC)
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  pruneMaps(now);

  if (globalCounter.day !== day) {
    globalCounter.day = day;
    globalCounter.count = 0;
  }
  const ipDay = dayBuckets.get(ipKey);
  const ipMinute = minuteBuckets.get(ipKey);
  const counts = {
    ipMinute: ipMinute && ipMinute.minute === minute ? ipMinute.count : 0,
    ipDay: ipDay && ipDay.day === day ? ipDay.count : 0,
    globalDay: globalCounter.count,
  };

  const verdict = rateLimitVerdict(counts);
  if (verdict.allowed === false) {
    return { allowed: false, message: verdict.message };
  }

  minuteBuckets.set(ipKey, { minute, count: counts.ipMinute + 1 });
  dayBuckets.set(ipKey, { day, count: counts.ipDay + 1 });
  globalCounter.count += 1;
  return { allowed: true };
}

/* -------------------------------------------------------------------------- */
/* Server-side key resolution (environment variable ONLY)                     */
/* -------------------------------------------------------------------------- */

export function resolveGeminiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : undefined;
}

function resolveModel(): string {
  const raw = (process.env.CHATBOT_MODEL || '').trim();
  return /^[A-Za-z0-9.-]{1,64}$/.test(raw) ? raw : 'gemini-2.5-flash';
}

function isEnabled(): boolean {
  return String(process.env.CHATBOT_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
}

/* -------------------------------------------------------------------------- */
/* Ask handler                                                               */
/* -------------------------------------------------------------------------- */

export interface ChatbotAskInput {
  message?: unknown;
  history?: unknown;
  /** Sanitized client IP key (see resolveClientIpKey). */
  ipKey?: string | null;
}

export type ChatbotAskResult =
  | { ok: true; answer: string; links?: { route: string; label: string }[] }
  | { ok: false; status: number; error: string };

/**
 * Resolve the client IP key appropriate for the actual hosting environment.
 *
 * Priority:
 *  1. `x-vercel-forwarded-for` — set by Vercel's edge; the single value is
 *     the real client IP as seen by Vercel and cannot be spoofed by the
 *     caller (Vercel overwrites it). Used in production on Vercel.
 *  2. `x-real-ip` — a single IP set by many reverse proxies/Vercel; taken
 *     as-is when it parses as an IP literal.
 *  3. `x-forwarded-for` — Google-Cloud-LB-style chain heuristic
 *     (second-to-last entry; see core.ts). Used only as a fallback; on
 *     arbitrary proxies this header can be client-controlled and is NOT
 *     a trusted client identity.
 *  Anything unparseable collapses into the shared 'unknown-anonymous'
 *  bucket rather than guessing.
 */
export function resolveIpKey(
  forwardedFor: string | string[] | null | undefined,
  vercelForwardedFor?: string | null,
  realIp?: string | null,
): string {
  const vercel = (vercelForwardedFor || '').trim();
  if (vercel && isIpLiteral(vercel)) return vercel;

  const real = (realIp || '').trim();
  if (real && isIpLiteral(real)) return real;

  return resolveClientIpKey(forwardedFor, null);
}

export async function handleChatbotAsk(input: ChatbotAskInput): Promise<ChatbotAskResult> {
  // Kill switch
  if (!isEnabled()) {
    return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE };
  }

  // Validate and normalize the request (shared with the Firebase function)
  const parsed = sanitizeChatRequest({ message: input.message, history: input.history });
  if (parsed.ok === false) {
    return { ok: false, status: 400, error: parsed.error };
  }
  const request: { message: string; history: ChatHistoryTurn[]; locale?: 'en' | 'am' } = parsed.value;

  // Best-effort rate limiting (per instance) — friendly messages either way
  const rl = checkRateLimit(input.ipKey || 'unknown-anonymous');
  if (rl.allowed === false) {
    return { ok: false, status: 429, error: rl.message };
  }

  const apiKey = resolveGeminiKey();
  if (!apiKey) {
    console.error('[chatbot] GEMINI_API_KEY is not configured');
    return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE };
  }

  const model = resolveModel();
  const url = `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent`;
  const body = JSON.stringify(buildGeminiBody(request));
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body,
        signal: controller.signal,
      });

      if (!resp.ok) {
        if (RETRYABLE_STATUSES.has(resp.status) && attempt < 2) {
          await sleep(700);
          continue;
        }
        console.error('[chatbot] Gemini request failed with status', resp.status);
        return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE };
      }

      const json = await resp.json();
      const answer = parseGeminiResponse(json);
      if (!answer) {
        console.error('[chatbot] empty or malformed Gemini response');
        return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE };
      }

      return { ok: true, answer, links: extractLinks(answer) };
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      if (name === 'AbortError') {
        console.error('[chatbot] Gemini request timed out');
      } else {
        console.error('[chatbot] Gemini fetch exception:', (err as Error)?.message || err);
      }
      return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE };
}
