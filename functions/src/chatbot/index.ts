/**
 * EthioSmart Homepage Promotional Assistant.
 *
 * Public, pre-login, unauthenticated callable function. Answers ONLY
 * questions about the EthioSmart platform and promotes its real features.
 *
 * Security posture:
 *  - Provider key lives exclusively in a Functions secret (GEMINI_API_KEY).
 *  - No client-supplied secrets are ever accepted or forwarded.
 *  - Rate limited atomically via Firestore (see ratelimit.ts).
 *  - Fail-closed: any limiter or provider failure returns a friendly
 *    "temporarily unavailable" error; nothing is ever unlimited.
 *  - No message content is logged or persisted.
 */

import * as functions from 'firebase-functions';
import { defineBoolean, defineString } from 'firebase-functions/params';
import {
  sanitizeChatRequest,
  buildGeminiBody,
  parseGeminiResponse,
  extractLinks,
} from './core';
import { enforceRateLimit, resolveClientIp } from './ratelimit';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Deployment-time configuration parameters (firebase-functions/params).
 * Resolved at deployment from .env files / CLI bindings, with safe defaults.
 * Unlike process.env reads in 1st-gen functions, these are actually
 * guaranteed to carry values and are bound at deploy time.
 * GEMINI_API_KEY remains a secret (declared in runWith below) and is NOT here.
 */
const CHATBOT_ENABLED = defineBoolean('CHATBOT_ENABLED', { default: true });
const CHATBOT_MODEL = defineString('CHATBOT_MODEL', { default: 'gemini-3.5-flash-lite' });

/** Conservative model id check — letters, digits, dots and hyphens only. */
function resolveModel(): string {
  const raw = (CHATBOT_MODEL.value() || '').trim();
  return /^[A-Za-z0-9.-]{1,64}$/.test(raw) ? raw : 'gemini-3.5-flash-lite';
}

const UNAVAILABLE_MESSAGE =
  'The EthioSmart AI Assistant is temporarily unavailable. Please try again in a moment — or sign up and explore the app!';

export const askEthioSmartAssistant = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
    secrets: ['GEMINI_API_KEY'],
  })
  .https.onCall(async (data, context) => {
    const startedAt = Date.now();

    // Kill switch (bound at deploy time via firebase-functions/params)
    if (!CHATBOT_ENABLED.value()) {
      throw new functions.https.HttpsError('unavailable', UNAVAILABLE_MESSAGE);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      functions.logger.error('chatbot: GEMINI_API_KEY is not configured');
      throw new functions.https.HttpsError('unavailable', UNAVAILABLE_MESSAGE);
    }

    // Validate and normalize the request
    const parsed = sanitizeChatRequest(data);
    if (!parsed.ok) {
      throw new functions.https.HttpsError('invalid-argument', parsed.error);
    }
    const request = parsed.value;

    // Atomic rate limiting — fail closed on infra errors.
    const ip = resolveClientIp(context);
    try {
      await enforceRateLimit(ip);
    } catch (err) {
      if (err instanceof functions.https.HttpsError) {
        functions.logger.warn('chatbot: rate limit hit', { latencyMs: Date.now() - startedAt });
        throw err; // resource-exhausted with a friendly message
      }
      functions.logger.error('chatbot: rate-limit infrastructure failure (fail-closed)', err);
      throw new functions.https.HttpsError('unavailable', UNAVAILABLE_MESSAGE);
    }

    const model = resolveModel();
    const url = `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent`;
    const requestBody = JSON.stringify(buildGeminiBody(request));
    // One bounded retry for transient provider failures (429/5xx) — the
    // provider occasionally returns 503 "model overloaded" under load.
    const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
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
          body: requestBody,
          signal: controller.signal,
        });

        if (!resp.ok) {
          if (RETRYABLE_STATUSES.has(resp.status) && attempt < 2) {
            functions.logger.warn('chatbot: transient Gemini status, retrying once', {
              status: resp.status,
              latencyMs: Date.now() - startedAt,
            });
            await sleep(700);
            continue;
          }
          functions.logger.error('chatbot: Gemini request failed', { status: resp.status });
          throw new functions.https.HttpsError('unavailable', UNAVAILABLE_MESSAGE);
        }

        const json = await resp.json();
        const answer = parseGeminiResponse(json);
        if (!answer) {
          functions.logger.error('chatbot: empty or malformed Gemini response');
          throw new functions.https.HttpsError('unavailable', UNAVAILABLE_MESSAGE);
        }

        functions.logger.info('chatbot: answered', {
          latencyMs: Date.now() - startedAt,
          promptChars: request.message.length,
        });

        return {
          answer,
          links: extractLinks(answer),
        };
      } catch (err) {
        if (err instanceof functions.https.HttpsError) {
          throw err;
        }
        const isAbort =
          (err as { name?: string } | null)?.name === 'AbortError' ||
          String((err as Error)?.message || '').toLowerCase().includes('abort');
        if (isAbort) {
          functions.logger.warn('chatbot: Gemini request timed out', { latencyMs: Date.now() - startedAt });
        } else {
          functions.logger.error('chatbot: Gemini fetch exception', err);
        }
        throw new functions.https.HttpsError('unavailable', UNAVAILABLE_MESSAGE);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new functions.https.HttpsError('unavailable', UNAVAILABLE_MESSAGE);
  });
