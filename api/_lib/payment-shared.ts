import * as crypto from 'crypto';

export const SETTINGS_PATH = 'paymentSettings/config';
export const MAIN_ADMIN_EMAIL = 'isak@gmail.com';
export const RECEIPT_FOLDER = 'ethiosmart/payment-receipts';

export type PaymentStatus = 'Pending' | 'Approved' | 'Rejected';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function err(code: string, message: string, status?: number) {
  const map: Record<string, number> = {
    unauthenticated: 401,
    'permission-denied': 403,
    'not-found': 404,
    'already-exists': 409,
    'failed-precondition': 412,
    'invalid-argument': 400,
    unavailable: 503,
    internal: 500,
  };
  return new ApiError(code, message, status ?? map[code] ?? 400);
}

export function cleanString(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function defaultSettings() {
  return {
    enabled: true,
    mode: 'production',
    currency: 'ETB',
    priceEtb: 0,
    paymentMethods: [
      { id: 'cbe-birr', name: 'CBE Birr', type: 'mobile_money', accountName: '', accountNumber: '', instructions: '', enabled: true },
      { id: 'telebirr', name: 'Telebirr', type: 'mobile_money', accountName: '', accountNumber: '', instructions: '', enabled: true },
      { id: 'bank', name: 'Bank Transfer', type: 'bank', accountName: '', accountNumber: '', instructions: '', enabled: false },
    ],
    freeAccess: {
      enabled: true,
      freeChaptersPerSubject: 0,
      freeExamAttempts: 0,
      freeNotesCount: 0,
      freeChapterIds: [],
      freeExamIds: [],
      freeNoteIds: [],
    },
    discounts: { codes: [], selectedUsers: [], promotions: [] },
    support: { inApp: true, telegram: '', whatsapp: '', phone: '', email: '' },
    instructions: 'Choose a payment method, transfer the displayed amount, and upload a clear receipt.',
    updatedAt: null,
  };
}

export async function verifyCloudinaryReceipt(url: string, expectedPublicId: string): Promise<{ fingerprint: string; contentType: string }> {
  let parsed: URL;
  try {
    if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/'))) {
      throw err('invalid-argument', 'Invalid receipt image URL.');
    }
    parsed = new URL(url, 'http://localhost:8081');
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    throw err('invalid-argument', 'Invalid receipt image URL.');
  }

  const isLocalDev = process.env.NODE_ENV !== 'production';
  const isLocalUrl = parsed.pathname.includes('/receiptDev') || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

  if (!isLocalDev || !isLocalUrl) {
    const pathDecoded = decodeURIComponent(parsed.pathname);
    const barePublicId = expectedPublicId.split('/').pop() || expectedPublicId;
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' ||
        !parsed.pathname.includes('/image/upload/') ||
        (!pathDecoded.includes(expectedPublicId) && !pathDecoded.includes(barePublicId))) {
      throw err('invalid-argument', 'Receipt must be the image uploaded for this payment request.');
    }
  }

  const fetchUrl = url.startsWith('/') ? `http://localhost:8081${url}` : url;
  const response = await fetch(fetchUrl);
  if (!response.ok) throw err('invalid-argument', 'Receipt image could not be verified.');
  const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (contentType !== 'image/jpeg' && contentType !== 'image/png' && contentType !== 'image/webp') {
    throw err('invalid-argument', 'Only JPG and PNG receipts are accepted.');
  }
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > 5 * 1024 * 1024) {
    throw err('invalid-argument', 'Receipt image must be 5 MB or smaller.');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
    throw err('invalid-argument', 'Receipt image must be 5 MB or smaller.');
  }
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) {
    throw err('invalid-argument', 'Receipt image format could not be verified.');
  }
  return { fingerprint: crypto.createHash('sha256').update(bytes).digest('hex'), contentType };
}
