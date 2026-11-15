import { describe, it, expect } from "vitest";
import {
  defaultFreeAccessConfig,
  derivePaymentAccess,
  isChapterOneNoteFree,
  isChapterOneTrialEnabled,
  isContentLocked,
  normalizeFreeAccess,
} from "./payment-access";
import type { FreeAccessConfig } from "@/components/admin/payments/types";

function free(overrides: Partial<FreeAccessConfig> = {}): FreeAccessConfig {
  return { ...defaultFreeAccessConfig(), ...overrides };
}

describe("normalizeFreeAccess", () => {
  it("returns safe defaults for missing data", () => {
    const result = normalizeFreeAccess(undefined);
    expect(result).toEqual(defaultFreeAccessConfig());
  });

  it("clamps counts and filters invalid ids", () => {
    const result = normalizeFreeAccess({
      enabled: false,
      freeChaptersPerSubject: 400,
      freeExamAttempts: -5,
      freeNoteIds: ["n1", "", "n2", 42],
    });
    expect(result.enabled).toBe(false);
    expect(result.freeChaptersPerSubject).toBe(100);
    expect(result.freeExamAttempts).toBe(0);
    expect(result.freeNoteIds).toEqual(["n1", "n2"]);
  });
});

describe("isChapterOneTrialEnabled", () => {
  it("is off when free access is disabled", () => {
    expect(isChapterOneTrialEnabled(free({ enabled: false, freeChaptersPerSubject: 1 }))).toBe(false);
  });

  it("is off when no chapters are free", () => {
    expect(isChapterOneTrialEnabled(free({ freeChaptersPerSubject: 0 }))).toBe(false);
  });

  it("is on when at least one chapter per subject is free", () => {
    expect(isChapterOneTrialEnabled(free({ freeChaptersPerSubject: 1 }))).toBe(true);
  });

  it("handles null/undefined", () => {
    expect(isChapterOneTrialEnabled(null)).toBe(false);
    expect(isChapterOneTrialEnabled(undefined)).toBe(false);
  });
});

describe("derivePaymentAccess", () => {
  it("derives chapterOneTrial from the persisted free access config", () => {
    const state = derivePaymentAccess({ enabled: true, freeAccess: { enabled: true, freeChaptersPerSubject: 1 } });
    expect(state.chapterOneTrial).toBe(true);
    expect(state.paymentsEnabled).toBe(true);
  });

  it("treats a missing document as default (no trial)", () => {
    const state = derivePaymentAccess({});
    expect(state.chapterOneTrial).toBe(false);
    expect(state.paymentsEnabled).toBe(true);
  });

  it("respects a disabled payment system", () => {
    const state = derivePaymentAccess({ enabled: false, freeAccess: { freeChaptersPerSubject: 5 } });
    expect(state.paymentsEnabled).toBe(false);
  });
});

describe("isContentLocked", () => {
  const base = { paymentsEnabled: true, freeAccess: free({ freeChaptersPerSubject: 1 }) };

  it("never locks staff or lifetime buyers", () => {
    expect(isContentLocked({ ...base, isStaff: true, isPremium: true })).toBe(false);
    expect(isContentLocked({ ...base, hasLifetime: true, isPremium: true })).toBe(false);
  });

  it("does not lock content when the paywall is off", () => {
    expect(isContentLocked({ ...base, paymentsEnabled: false, isPremium: true })).toBe(false);
  });

  it("keeps unlocked (non-premium) content open", () => {
    expect(isContentLocked({ ...base, hasLifetime: false, isStaff: false, isPremium: false })).toBe(false);
  });

  it("locks premium content that is not covered by free access", () => {
    expect(isContentLocked({ ...base, isPremium: true, isChapterOne: false })).toBe(true);
  });

  it("unlocks premium Chapter 1 content while the trial is on", () => {
    expect(isContentLocked({ ...base, isPremium: true, isChapterOne: true })).toBe(false);
  });

  it("locks premium Chapter 1 content when the trial is off", () => {
    const off = { paymentsEnabled: true, freeAccess: free({ freeChaptersPerSubject: 0 }) };
    expect(isContentLocked({ ...off, isPremium: true, isChapterOne: true })).toBe(true);
  });

  it("unlocks explicitly free items", () => {
    const off = { paymentsEnabled: true, freeAccess: free({ freeChaptersPerSubject: 0, freeNoteIds: ["n1"] }) };
    expect(isContentLocked({ ...off, isPremium: true, isExplicitlyFree: true })).toBe(false);
  });

  it("ignores free allowances when free access is disabled", () => {
    const disabled = {
      paymentsEnabled: true,
      freeAccess: free({ enabled: false, freeChaptersPerSubject: 5, freeNoteIds: ["n1"] }),
    };
    expect(isContentLocked({ ...disabled, isPremium: true, isChapterOne: true })).toBe(true);
    expect(isContentLocked({ ...disabled, isPremium: true, isExplicitlyFree: true })).toBe(true);
  });
});

describe("isChapterOneNoteFree", () => {
  it("requires the trial to be enabled and the note to be Chapter 1", () => {
    expect(isChapterOneNoteFree(free({ freeChaptersPerSubject: 1 }), true)).toBe(true);
    expect(isChapterOneNoteFree(free({ freeChaptersPerSubject: 1 }), false)).toBe(false);
    expect(isChapterOneNoteFree(free({ freeChaptersPerSubject: 0 }), true)).toBe(false);
  });
});
