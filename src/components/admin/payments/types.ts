/**
 * Shared types for the Admin Payment Settings UI.
 *
 * These shapes mirror the `paymentSettings/config` document that the existing
 * Cloud Functions already read and write. No new backend fields are introduced
 * here — every key below is either consumed by `savePaymentSettings` in
 * `functions/src/payments.ts` or by the content-access callables.
 */

export type PaymentMode = "production" | "sandbox";

export interface PaymentMethodConfig {
  id: string;
  name: string;
  type: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  enabled: boolean;
}

export interface FreeAccessConfig {
  enabled: boolean;
  freeChaptersPerSubject: number;
  freeExamAttempts: number;
  freeNotesCount: number;
  freeChapterIds: string[];
  freeExamIds: string[];
  freeNoteIds: string[];
}

export type DiscountKind = "percentage" | "fixed";

export interface DiscountCodeConfig {
  code: string;
  kind: DiscountKind;
  value: number;
  enabled: boolean;
}

export interface DiscountPromotionConfig {
  label: string;
  kind: DiscountKind;
  value: number;
  active: boolean;
}

export interface DiscountUserConfig {
  identifier: string;
  kind: DiscountKind;
  value: number;
}

export interface DiscountsConfig {
  codes: DiscountCodeConfig[];
  promotions: DiscountPromotionConfig[];
  selectedUsers: DiscountUserConfig[];
}

export interface PaymentSettingsConfig {
  enabled: boolean;
  mode: PaymentMode;
  currency: string;
  priceEtb: number;
  paymentMethods: PaymentMethodConfig[];
  freeAccess: FreeAccessConfig;
  discounts: DiscountsConfig;
  instructions: string;
}

/** Payment method "type" values accepted by the backend (free-form string). */
export const PAYMENT_METHOD_TYPES: { value: string; label: string }[] = [
  { value: "mobile_money", label: "Mobile money" },
  { value: "bank", label: "Bank account" },
  { value: "other", label: "Other" },
];

export function defaultPaymentMethods(): PaymentMethodConfig[] {
  return [
    { id: "cbe-birr", name: "CBE Birr", type: "mobile_money", accountName: "", accountNumber: "", instructions: "", enabled: true },
    { id: "telebirr", name: "Telebirr", type: "mobile_money", accountName: "", accountNumber: "", instructions: "", enabled: true },
    { id: "bank", name: "Bank Transfer", type: "bank", accountName: "", accountNumber: "", instructions: "", enabled: false },
  ];
}

export function defaultFreeAccess(): FreeAccessConfig {
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

export function defaultDiscounts(): DiscountsConfig {
  return { codes: [], promotions: [], selectedUsers: [] };
}

export function defaultPaymentSettings(): PaymentSettingsConfig {
  return {
    enabled: true,
    mode: "production",
    currency: "ETB",
    priceEtb: 0,
    paymentMethods: defaultPaymentMethods(),
    freeAccess: defaultFreeAccess(),
    discounts: defaultDiscounts(),
    instructions: "Choose a payment method, transfer the displayed amount, and upload a clear receipt.",
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampCount(value: unknown): number {
  return Math.max(0, Math.min(100, Math.floor(toNumber(value, 0))));
}

function toStringArray(value: unknown, max = 500): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, max);
}

function normalizeMethod(raw: any, index: number): PaymentMethodConfig {
  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : `method-${index}`,
    name: typeof raw?.name === "string" ? raw.name : "",
    type: typeof raw?.type === "string" && raw.type ? raw.type : "other",
    accountName: typeof raw?.accountName === "string" ? raw.accountName : "",
    accountNumber: typeof raw?.accountNumber === "string" ? raw.accountNumber : "",
    instructions: typeof raw?.instructions === "string" ? raw.instructions : "",
    enabled: raw?.enabled === true,
  };
}

function normalizeKind(value: unknown): DiscountKind {
  return value === "fixed" ? "fixed" : "percentage";
}

/** Convert a raw Firestore settings object into a fully-populated config. */
export function normalizePaymentSettings(raw: any): PaymentSettingsConfig {
  const source = raw || {};
  const methods = Array.isArray(source.paymentMethods) && source.paymentMethods.length > 0
    ? source.paymentMethods.map(normalizeMethod)
    : defaultPaymentMethods();
  const free = source.freeAccess || {};
  const discounts = source.discounts || {};
  const codes = Array.isArray(discounts.codes) ? discounts.codes : [];
  const promotions = Array.isArray(discounts.promotions) ? discounts.promotions : [];
  const selectedUsers = Array.isArray(discounts.selectedUsers) ? discounts.selectedUsers : [];

  return {
    enabled: source.enabled !== false,
    mode: source.mode === "sandbox" ? "sandbox" : "production",
    currency: "ETB",
    priceEtb: Math.max(0, toNumber(source.priceEtb, 0)),
    paymentMethods: methods,
    freeAccess: {
      enabled: free.enabled !== false,
      freeChaptersPerSubject: clampCount(free.freeChaptersPerSubject),
      freeExamAttempts: clampCount(free.freeExamAttempts),
      freeNotesCount: clampCount(free.freeNotesCount),
      freeChapterIds: toStringArray(free.freeChapterIds),
      freeExamIds: toStringArray(free.freeExamIds),
      freeNoteIds: toStringArray(free.freeNoteIds),
    },
    discounts: {
      codes: codes.map((item: any) => ({
        code: typeof item?.code === "string" ? item.code : "",
        kind: normalizeKind(item?.kind),
        value: Math.max(0, toNumber(item?.value, 0)),
        enabled: item?.enabled !== false,
      })),
      promotions: promotions.map((item: any) => ({
        label: typeof item?.label === "string" ? item.label : "",
        kind: normalizeKind(item?.kind),
        value: Math.max(0, toNumber(item?.value, 0)),
        active: item?.active !== false,
      })),
      selectedUsers: selectedUsers.map((item: any) => ({
        identifier: typeof item?.identifier === "string" ? item.identifier : "",
        kind: normalizeKind(item?.kind),
        value: Math.max(0, toNumber(item?.value, 0)),
      })),
    },
    instructions: typeof source.instructions === "string" ? source.instructions : "",
  };
}
