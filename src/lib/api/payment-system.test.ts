import { describe, it, expect, vi } from 'vitest';
import { calculatePaymentDiscount, getPaymentStorageCollections } from '../../../api/_lib/payment-discounts';
import { defaultSettings, ApiError, cleanString, verifyCloudinaryReceipt } from '../../../api/_lib/payment-shared';
import { createHandler } from '../../../api/_lib/http';

describe('Payment Discounts Core Logic', () => {
  it('correctly returns sandbox and production collection names', () => {
    const prod = getPaymentStorageCollections('production');
    expect(prod.payments).toBe('payments');
    expect(prod.accounts).toBe('paymentAccounts');
    expect(prod.fingerprints).toBe('receiptFingerprints');

    const sandbox = getPaymentStorageCollections('sandbox');
    expect(sandbox.payments).toBe('sandboxPayments');
    expect(sandbox.accounts).toBe('sandboxPaymentAccounts');
    expect(sandbox.fingerprints).toBe('sandboxReceiptFingerprints');
  });

  it('calculates full price when no discount applies', () => {
    const quote = calculatePaymentDiscount(
      500,
      { codes: [], selectedUsers: [], promotions: [] },
      { uid: 'u1', email: 'student@example.com' }
    );
    expect(quote.originalPriceEtb).toBe(500);
    expect(quote.discountEtb).toBe(0);
    expect(quote.finalAmountEtb).toBe(500);
    expect(quote.discount).toBeNull();
  });

  it('applies a valid percentage discount code', () => {
    const quote = calculatePaymentDiscount(
      1000,
      {
        codes: [{ code: 'HALF', kind: 'percentage', value: 50, enabled: true }],
        selectedUsers: [],
        promotions: [],
      },
      { uid: 'u1', email: 'student@example.com' },
      'half'
    );
    expect(quote.originalPriceEtb).toBe(1000);
    expect(quote.discountEtb).toBe(500);
    expect(quote.finalAmountEtb).toBe(500);
    expect(quote.discount?.code).toBe('HALF');
  });

  it('applies a valid fixed discount code', () => {
    const quote = calculatePaymentDiscount(
      1000,
      {
        codes: [{ code: 'SAVE200', kind: 'fixed', value: 200, enabled: true }],
        selectedUsers: [],
        promotions: [],
      },
      { uid: 'u1', email: 'student@example.com' },
      'SAVE200'
    );
    expect(quote.originalPriceEtb).toBe(1000);
    expect(quote.discountEtb).toBe(200);
    expect(quote.finalAmountEtb).toBe(800);
  });

  it('rejects disabled or nonexistent discount codes', () => {
    expect(() =>
      calculatePaymentDiscount(
        1000,
        {
          codes: [{ code: 'OFF', kind: 'percentage', value: 20, enabled: false }],
          selectedUsers: [],
          promotions: [],
        },
        { uid: 'u1' },
        'OFF'
      )
    ).toThrow('This discount code is invalid or unavailable.');

    expect(() =>
      calculatePaymentDiscount(
        1000,
        { codes: [], selectedUsers: [], promotions: [] },
        { uid: 'u1' },
        'NONEXISTENT'
      )
    ).toThrow('This discount code is invalid or unavailable.');
  });

  it('picks the highest saving between promo, user discount and code', () => {
    const quote = calculatePaymentDiscount(
      1000,
      {
        codes: [{ code: 'CODE10', kind: 'percentage', value: 10, enabled: true }],
        selectedUsers: [{ identifier: 'vip@example.com', kind: 'fixed', value: 300 }],
        promotions: [{ label: 'Holiday 20%', kind: 'percentage', value: 20, active: true }],
      },
      { uid: 'u1', email: 'vip@example.com' },
      'CODE10'
    );
    // CODE10 = 100, Holiday 20% = 200, Selected user = 300 -> Winner is 300
    expect(quote.discountEtb).toBe(300);
    expect(quote.finalAmountEtb).toBe(700);
    expect(quote.discount?.source).toBe('selected_user');
  });
});

describe('Payment Shared Utilities', () => {
  it('defaultSettings provides standard Ethiopia mobile payment methods', () => {
    const s = defaultSettings();
    expect(s.currency).toBe('ETB');
    expect(s.enabled).toBe(true);
    expect(s.paymentMethods.length).toBeGreaterThanOrEqual(2);
    expect(s.paymentMethods.some((m) => m.name === 'CBE Birr')).toBe(true);
    expect(s.paymentMethods.some((m) => m.name === 'Telebirr')).toBe(true);
  });

  it('cleanString trims and truncates safely', () => {
    expect(cleanString('  hello world  ', 5)).toBe('hello');
    expect(cleanString(null)).toBe('');
    expect(cleanString(12345)).toBe('');
  });

  it('ApiError preserves status and code', () => {
    const e = new ApiError('failed-precondition', 'Missing config', 412);
    expect(e.code).toBe('failed-precondition');
    expect(e.status).toBe(412);
    expect(e.message).toBe('Missing config');
  });

  it('verifyCloudinaryReceipt rejects invalid domains and URLs', async () => {
    await expect(
      verifyCloudinaryReceipt('not a valid url', 'ethiosmart/payment-receipts/pay_123_u1')
    ).rejects.toThrow('Invalid receipt image URL.');

    await expect(
      verifyCloudinaryReceipt('https://other-cdn.com/image/upload/pay_123_u1.jpg', 'ethiosmart/payment-receipts/pay_123_u1')
    ).rejects.toThrow('Receipt must be the image uploaded for this payment request.');
  });
});

describe('HTTP Routing and CORS Handler', () => {
  function createMockRes() {
    return {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(k: string, v: string) {
        this.headers[k.toLowerCase()] = v;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.data = data;
        return this;
      },
      end() {
        return this;
      },
      data: null as any,
    };
  }

  it('permits CORS for localhost, Vercel deployments, and same-origin', async () => {
    const handler = createHandler(async () => ({ ok: true }), { auth: false });

    // 1. Localhost
    const res1 = createMockRes();
    await handler({ method: 'OPTIONS', headers: { origin: 'http://localhost:8080' } }, res1);
    expect(res1.statusCode).toBe(204);
    expect(res1.headers['access-control-allow-origin']).toBe('http://localhost:8080');

    // 2. Vercel deployment
    const res2 = createMockRes();
    await handler({ method: 'OPTIONS', headers: { origin: 'https://ethiosmart.vercel.app' } }, res2);
    expect(res2.statusCode).toBe(204);
    expect(res2.headers['access-control-allow-origin']).toBe('https://ethiosmart.vercel.app');

    // 3. Same-origin (Host match)
    const res3 = createMockRes();
    await handler(
      { method: 'OPTIONS', headers: { origin: 'https://custom-domain.edu', host: 'custom-domain.edu' } },
      res3
    );
    expect(res3.statusCode).toBe(204);
    expect(res3.headers['access-control-allow-origin']).toBe('https://custom-domain.edu');

    // 4. Untrusted foreign origin rejected
    const res4 = createMockRes();
    await handler({ method: 'OPTIONS', headers: { origin: 'https://attacker.evil.com' } }, res4);
    expect(res4.statusCode).toBe(403);
  });

  it('allows unauthenticated requests when auth: false is set', async () => {
    const handler = createHandler(async (_req, _res, ctx) => ({ uid: ctx.uid, mode: 'public' }), { auth: false });
    const res = createMockRes();
    await handler({ method: 'POST', headers: { origin: 'http://localhost:8080' }, body: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual({ uid: '', mode: 'public' });
  });

  it('enforces authentication on endpoints requiring auth by default', async () => {
    const handler = createHandler(async () => ({ secure: true }));
    const res = createMockRes();
    await handler({ method: 'POST', headers: { origin: 'http://localhost:8080' }, body: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(res.data?.code).toBe('unauthenticated');
  });
});
