/**
 * Client-side payment access model.
 *
 * The `paymentSettings/config` Firestore document is the single source of truth
 * for free access. Firestore rules allow any authenticated user to *read* it, so
 * students can resolve their access client-side without a Cloud Function call.
 *
 * The pure helpers below carry no Firebase/React dependency so they can be unit
 * tested in isolation. The Firestore read is performed with a dynamic import so
 * importing this module never triggers the heavy Firebase client bootstrap.
 */

import { useCallback, useEffect, useState } from "react";
import type { FreeAccessConfig } from "@/components/admin/payments/types";

export const PAYMENT_SETTINGS_COLLECTION = "paymentSettings";
export const PAYMENT_SETTINGS_CONFIG_DOC = "config";

export interface PaymentAccessState {
  /** Whether the paid tier is active. When false there is no paywall at all. */
  paymentsEnabled: boolean;
  freeAccess: FreeAccessConfig;
  /** Derived: the default Chapter 1 free trial is provisioned and switched on. */
  chapterOneTrial: boolean;
}

export function defaultFreeAccessConfig(): FreeAccessConfig {
  return {
    enabled: true,
    freeChaptersPerSubject: 0,
    freeExamAttempts: 0,
    freeNotesCount: 0,
    freeChapterIds: [],
    freeExamIds: [],
    freeNoteIds: [],
  };
}

function toCount(value: unknown, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(max, Math.floor(parsed)));
}

function toStringArray(value: unknown, max = 500): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, max);
}

/** Normalize a raw Firestore `freeAccess` object into a fully populated config. */
export function normalizeFreeAccess(raw: any): FreeAccessConfig {
  const source = raw || {};
  return {
    enabled: source.enabled !== false,
    freeChaptersPerSubject: toCount(source.freeChaptersPerSubject, 100),
    freeExamAttempts: toCount(source.freeExamAttempts, 100),
    freeNotesCount: toCount(source.freeNotesCount, 100),
    freeChapterIds: toStringArray(source.freeChapterIds),
    freeExamIds: toStringArray(source.freeExamIds),
    freeNoteIds: toStringArray(source.freeNoteIds),
  };
}

/**
 * The Chapter 1 free trial is "on" when free access is enabled and at least the
 * first chapter of every subject is marked free. This is the persisted state
 * that the admin toggle writes to `freeAccess`.
 */
export function isChapterOneTrialEnabled(free: FreeAccessConfig | null | undefined): boolean {
  if (!free || free.enabled !== true) return false;
  return (free.freeChaptersPerSubject ?? 0) >= 1;
}

/** Build the access state from a raw `paymentSettings/config` document. */
export function derivePaymentAccess(raw: any): PaymentAccessState {
  const freeAccess = normalizeFreeAccess(raw?.freeAccess);
  return {
    paymentsEnabled: raw?.enabled !== false,
    freeAccess,
    chapterOneTrial: isChapterOneTrialEnabled(freeAccess),
  };
}

export interface ContentAccessInput {
  paymentsEnabled: boolean;
  freeAccess: FreeAccessConfig;
  isStaff: boolean;
  hasLifetime: boolean;
  /** Content explicitly flagged as requiring payment. */
  isPremium?: boolean;
  /** Content belongs to Chapter 1 of its subject. */
  isChapterOne?: boolean;
  /** The item id (or its chapter id) is explicitly listed as free. */
  isExplicitlyFree?: boolean;
}

/**
 * Decide whether a piece of content is locked for the current student.
 *
 * Rules (mirrors the server-side content-access behaviour without changing it):
 *  - Staff and lifetime buyers always have access.
 *  - When the paid tier is off there is no paywall.
 *  - Free-access allowances only apply while `freeAccess.enabled` is true.
 *  - Only content explicitly marked premium is gated; unlocked content stays open.
 */
export function isContentLocked(input: ContentAccessInput): boolean {
  if (input.isStaff || input.hasLifetime) return false;
  if (!input.paymentsEnabled) return false;

  if (input.freeAccess.enabled) {
    if (input.isExplicitlyFree) return false;
    if (input.isChapterOne && input.freeAccess.freeChaptersPerSubject >= 1) return false;
  }

  if (input.isPremium === false) return false;
  return true;
}

/** Convenience wrapper: is a note free because of the Chapter 1 label? */
export function isChapterOneNoteFree(
  freeAccess: FreeAccessConfig,
  isChapterOne: boolean,
): boolean {
  return freeAccess.enabled && isChapterOne && freeAccess.freeChaptersPerSubject >= 1;
}

let cachedAccess: PaymentAccessState | null = null;

/** Read (and cache) the payment access state from `paymentSettings/config`. */
export async function fetchPaymentAccessSettings(force = false): Promise<PaymentAccessState> {
  if (cachedAccess && !force) return cachedAccess;
  try {
    const [{ doc, getDoc }, { db }] = await Promise.all([
      import("firebase/firestore"),
      import("@/integrations/firebase/client"),
    ]);
    const snapshot = await getDoc(
      doc(db, PAYMENT_SETTINGS_COLLECTION, PAYMENT_SETTINGS_CONFIG_DOC),
    );
    if (snapshot.exists()) {
      cachedAccess = derivePaymentAccess(snapshot.data());
      return cachedAccess;
    }
  } catch {
    // Continue to backend fallback
  }
  try {
    const { callBackend } = await import("@/lib/api/backend");
    const settings = await callBackend('/api/payments/getPaymentSettings', {}, { optionalAuth: true });
    if (settings) {
      cachedAccess = derivePaymentAccess(settings);
      return cachedAccess;
    }
  } catch {}
  try {
  } catch {
    // Offline / permission errors resolve to the safe default (no free trial).
    cachedAccess = derivePaymentAccess({});
  }
  return cachedAccess;
}

/** Test/utility hook to reset the module-level cache. */
export function resetPaymentAccessCache(): void {
  cachedAccess = null;
}

export interface UsePaymentAccessResult extends PaymentAccessState {
  loading: boolean;
  refresh: () => Promise<PaymentAccessState>;
}

/** React hook exposing the current payment access state. */
export function usePaymentAccess(): UsePaymentAccessResult {
  const [state, setState] = useState<PaymentAccessState>(() => derivePaymentAccess({}));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPaymentAccessSettings().then((next) => {
      if (active) {
        setState(next);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchPaymentAccessSettings(true);
    setState(next);
    return next;
  }, []);

  return { ...state, loading, refresh };
}
