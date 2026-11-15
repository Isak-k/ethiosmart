import { calculatePaymentDiscount } from './payment-discounts';

describe('calculatePaymentDiscount', () => {
  const user = { uid: 'user-123', email: 'student@example.com' };

  it('applies a valid percentage code', () => {
    const quote = calculatePaymentDiscount(1000, { codes: [{ code: 'SAVE20', kind: 'percentage', value: 20, enabled: true }] }, user, ' save20 ');
    expect(quote).toMatchObject({ originalPriceEtb: 1000, discountEtb: 200, finalAmountEtb: 800, discount: { source: 'code', code: 'SAVE20' } });
  });

  it('applies a fixed ETB code', () => {
    const quote = calculatePaymentDiscount(1000, { codes: [{ code: 'LESS75', kind: 'fixed', value: 75, enabled: true }] }, user, 'LESS75');
    expect(quote.finalAmountEtb).toBe(925);
  });

  it('rejects expired/disabled style code entries when disabled', () => {
    expect(() => calculatePaymentDiscount(100, { codes: [{ code: 'OLD', kind: 'fixed', value: 10, enabled: false }] }, user, 'OLD')).toThrow(/invalid or unavailable/i);
  });

  it('rejects unknown codes', () => {
    expect(() => calculatePaymentDiscount(100, { codes: [] }, user, 'NOPE')).toThrow(/invalid or unavailable/i);
  });

  it('applies a discount assigned by uid or email', () => {
    const quote = calculatePaymentDiscount(500, { selectedUsers: [{ identifier: 'STUDENT@example.com', kind: 'percentage', value: 10 }] }, user);
    expect(quote).toMatchObject({ discountEtb: 50, finalAmountEtb: 450, discount: { source: 'selected_user' } });
  });

  it('applies active automatic promotions', () => {
    const quote = calculatePaymentDiscount(500, { promotions: [{ label: 'Launch offer', kind: 'fixed', value: 100, active: true }] }, user);
    expect(quote).toMatchObject({ discountEtb: 100, finalAmountEtb: 400, discount: { source: 'promotion' } });
  });

  it('ignores inactive promotions', () => {
    const quote = calculatePaymentDiscount(500, { promotions: [{ label: 'Old offer', kind: 'fixed', value: 100, active: false }] }, user);
    expect(quote.finalAmountEtb).toBe(500);
  });

  it('caps a discount at the original price and never returns a negative total', () => {
    const quote = calculatePaymentDiscount(50, { codes: [{ code: 'FREE', kind: 'fixed', value: 1000, enabled: true }] }, user, 'FREE');
    expect(quote).toMatchObject({ discountEtb: 50, finalAmountEtb: 0 });
  });

  it('chooses the best eligible discount instead of stacking', () => {
    const quote = calculatePaymentDiscount(1000, {
      codes: [{ code: 'CODE', kind: 'percentage', value: 10, enabled: true }],
      selectedUsers: [{ identifier: user.uid, kind: 'fixed', value: 150 }],
      promotions: [{ label: 'Promo', kind: 'percentage', value: 5, active: true }],
    }, user, 'CODE');
    expect(quote).toMatchObject({ discountEtb: 150, finalAmountEtb: 850, discount: { source: 'selected_user' } });
  });

  it('rejects invalid prices and percentage values', () => {
    expect(() => calculatePaymentDiscount(0, {}, user)).toThrow(/price/i);
    expect(() => calculatePaymentDiscount(100, { codes: [{ code: 'BAD', kind: 'percentage', value: 101, enabled: true }] }, user, 'BAD')).toThrow(/invalid or unavailable/i);
  });

  it('rounds amounts to cents', () => {
    const quote = calculatePaymentDiscount(99.99, { codes: [{ code: 'THIRD', kind: 'percentage', value: 33.333, enabled: true }] }, user, 'THIRD');
    expect(quote.discountEtb).toBe(33.33);
    expect(quote.finalAmountEtb).toBe(66.66);
  });
});
