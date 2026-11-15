/**
 * Firestore-backed rate limiting for the homepage chatbot.
 *
 * Uses a single transaction across three counters so concurrent homepage
 * traffic cannot race past the limits (atomic + concurrency-safe).
 *
 * Fail-closed policy: if the counter transaction fails for any reason, the
 * caller converts it into a friendly "temporarily unavailable" response.
 *
 * Privacy: the client IP is never stored — only a SHA-256 hash.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
// Use the firestore subpath for FieldValue instead of the namespace static.
// The firebase functions emulator proxies the 'firebase-admin' module and
// re-binds namespace functions (dropping static props like FieldValue), so
// `admin.firestore.FieldValue` is undefined there and the limiter crashes.
// This import is the supported API and behaves identically in production.
import { FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { rateLimitVerdict, resolveClientIpKey, type RateLimitCounts } from './core';

const MINUTE_CAP = 5;
const DAY_CAP = 30;
const GLOBAL_DAY_CAP = 2000;

/**
 * Resolve the client IP using the verified Google-appended position of the
 * X-Forwarded-For chain (see core.ts resolveClientIpKey). The immediate
 * socket peer is Google's frontend and is never used as a client identity.
 */
export function resolveClientIp(context: functions.https.CallableContext): string {
  const forwarded = context.rawRequest?.headers?.['x-forwarded-for'];
  return resolveClientIpKey(
    typeof forwarded === 'string' || Array.isArray(forwarded) ? forwarded : undefined,
    context.auth?.uid ?? null,
  );
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function minuteKey(now: Date): string {
  return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM (UTC)
}

/**
 * Throws HttpsError('resource-exhausted') when a limit is exceeded.
 * Any infrastructure failure also throws (fail-closed at the function layer).
 */
export async function enforceRateLimit(ip: string): Promise<void> {
  const db = admin.firestore();
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
  const now = new Date();
  const day = dayKey(now);
  const minute = minuteKey(now);

  const minRef = db.collection('chatbotRateLimits').doc(`min_${ipHash}_${minute}`);
  const ipDayRef = db.collection('chatbotRateLimits').doc(`ip_${ipHash}_${day}`);
  const globalRef = db.collection('chatbotRateLimits').doc(`global_${day}`);

  await db.runTransaction(async (tx) => {
    const [minSnap, daySnap, globalSnap] = await Promise.all([
      tx.get(minRef),
      tx.get(ipDayRef),
      tx.get(globalRef),
    ]);

    const counts: RateLimitCounts = {
      ipMinute: (minSnap.exists && typeof minSnap.data()?.count === 'number' ? minSnap.data()!.count : 0) || 0,
      ipDay: (daySnap.exists && typeof daySnap.data()?.count === 'number' ? daySnap.data()!.count : 0) || 0,
      globalDay:
        (globalSnap.exists && typeof globalSnap.data()?.count === 'number' ? globalSnap.data()!.count : 0) || 0,
    };

    const verdict = rateLimitVerdict(counts);
    if (!verdict.allowed) {
      throw new functions.https.HttpsError('resource-exhausted', verdict.message);
    }

    const serverTimestamp = FieldValue.serverTimestamp();
    tx.set(minRef, { count: FieldValue.increment(1), updatedAt: serverTimestamp }, { merge: true });
    tx.set(ipDayRef, { count: FieldValue.increment(1), updatedAt: serverTimestamp }, { merge: true });
    tx.set(globalRef, { count: FieldValue.increment(1), updatedAt: serverTimestamp }, { merge: true });
  });
}

// Expose constants for tests without importing firebase-functions at test time.
export const LIMITS = { minute: MINUTE_CAP, day: DAY_CAP, globalDay: GLOBAL_DAY_CAP };
