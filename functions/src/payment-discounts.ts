export type DiscountKind = 'percentage' | 'fixed';

export interface DiscountCandidate {
  source: 'code' | 'selected_user' | 'promotion';
  label: string;
  kind: DiscountKind;
  value: number;
  code?: string;
}

export interface PaymentDiscountQuote {
  originalPriceEtb: number;
  discountEtb: number;
  finalAmountEtb: number;
  discount: {
    source: DiscountCandidate['source'] | null;
    label: string | null;
    code: string | null;
    kind: DiscountKind | null;
    value: number;
  } | null;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validDiscount(raw: any, requireEnabled: boolean): raw is Record<string, any> & { kind: DiscountKind; value: number } {
  if (!raw || (raw.kind !== 'percentage' && raw.kind !== 'fixed')) return false;
  if (requireEnabled && raw.enabled !== true && raw.active !== true) return false;
  const value = Number(raw.value);
  if (!Number.isFinite(value) || value < 0) return false;
  if (raw.kind === 'percentage' && value > 100) return false;
  return true;
}

function savings(price: number, kind: DiscountKind, value: number): number {
  return money(Math.min(price, kind === 'percentage' ? price * value / 100 : value));
}

/**
 * Resolves exactly one best eligible discount. Discounts are not stacked:
 * the highest valid saving wins among an entered code, the user's assignment,
 * and active automatic promotions.
 */
export function calculatePaymentDiscount(
  originalPriceInput: unknown,
  discounts: any,
  user: { uid: string; email?: string | null },
  enteredCode?: unknown,
): PaymentDiscountQuote {
  const originalPriceEtb = money(Number(originalPriceInput));
  if (!Number.isFinite(originalPriceEtb) || originalPriceEtb <= 0 || originalPriceEtb > 10_000_000) {
    throw new Error('The payment price is not configured correctly.');
  }

  const code = typeof enteredCode === 'string' ? enteredCode.trim().toUpperCase() : '';
  const candidates: DiscountCandidate[] = [];
  const config = discounts && typeof discounts === 'object' ? discounts : {};
  const codes = Array.isArray(config.codes) ? config.codes : [];
  const selectedUsers = Array.isArray(config.selectedUsers) ? config.selectedUsers : [];
  const promotions = Array.isArray(config.promotions) ? config.promotions : [];

  if (code) {
    const match = codes.find((item: any) =>
      typeof item?.code === 'string' && item.code.trim().toUpperCase() === code
    );
    if (!match || !validDiscount(match, true)) {
      throw new Error('This discount code is invalid or unavailable.');
    }
    candidates.push({ source: 'code', label: code, code, kind: match.kind, value: Number(match.value) });
  }

  const identifiers = [user.uid, user.email || ''].map((item) => item.trim().toLowerCase()).filter(Boolean);
  const assigned = selectedUsers.find((item: any) =>
    typeof item?.identifier === 'string' &&
    identifiers.includes(item.identifier.trim().toLowerCase()) &&
    validDiscount(item, false)
  );
  if (assigned) candidates.push({
    source: 'selected_user', label: 'Selected-user discount',
    kind: assigned.kind, value: Number(assigned.value),
  });

  promotions.forEach((item: any) => {
    if (item?.active === true && validDiscount(item, true)) {
      candidates.push({
        source: 'promotion',
        label: typeof item.label === 'string' && item.label.trim() ? item.label.trim().slice(0, 100) : 'Automatic promotion',
        kind: item.kind,
        value: Number(item.value),
      });
    }
  });

  const evaluated = candidates.map((candidate) => ({
    candidate,
    discountEtb: savings(originalPriceEtb, candidate.kind, candidate.value),
  })).filter((item) => item.discountEtb > 0)
    .sort((a, b) => b.discountEtb - a.discountEtb);

  const winner = evaluated[0];
  if (!winner) {
    return {
      originalPriceEtb, discountEtb: 0, finalAmountEtb: originalPriceEtb,
      discount: null,
    };
  }

  return {
    originalPriceEtb,
    discountEtb: winner.discountEtb,
    finalAmountEtb: money(Math.max(0, originalPriceEtb - winner.discountEtb)),
    discount: {
      source: winner.candidate.source,
      label: winner.candidate.label,
      code: winner.candidate.code || null,
      kind: winner.candidate.kind,
      value: winner.candidate.value,
    },
  };
}
