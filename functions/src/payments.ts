import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as crypto from 'crypto';

const db = admin.firestore();
const SETTINGS_PATH = 'paymentSettings/config';
const MAIN_ADMIN_EMAIL = 'isak@gmail.com';
const RECEIPT_FOLDER = 'ethiosmart/payment-receipts';

type PaymentStatus = 'Pending' | 'Approved' | 'Rejected';

function requireAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Please sign in first.');
  }
  return context.auth.uid;
}

async function getProfile(uid: string): Promise<FirebaseFirestore.DocumentData> {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User profile not found.');
  }
  return snap.data() || {};
}

async function requireAdmin(uid: string, canReview = false, manageSettings = false): Promise<FirebaseFirestore.DocumentData> {
  const profile = await getProfile(uid);
  if (profile.role !== 'admin' && profile.role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Administrator access is required.');
  }
  const isMainAdmin = profile.email?.toLowerCase() === MAIN_ADMIN_EMAIL;
  const isSuperAdmin = profile.role === 'superadmin';
  if (canReview && !isMainAdmin && !isSuperAdmin && profile.permissions?.managePayments !== true) {
    throw new functions.https.HttpsError('permission-denied', 'You are not assigned to review payments.');
  }
  if (manageSettings && !isMainAdmin && !isSuperAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only the main administrator can change payment settings or grant lifetime access.');
  }
  return profile;
}

function defaultSettings() {
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

function cleanString(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function verifyCloudinaryReceipt(url: string, expectedPublicId: string): Promise<{ fingerprint: string; contentType: string }> {
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid receipt image URL.');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' ||
      !parsed.pathname.includes('/image/upload/') ||
      !decodeURIComponent(parsed.pathname).includes(expectedPublicId)) {
    throw new functions.https.HttpsError('invalid-argument', 'Receipt must be the image uploaded for this payment request.');
  }
  const response = await fetch(url);
  if (!response.ok) throw new functions.https.HttpsError('invalid-argument', 'Receipt image could not be verified.');
  const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (contentType !== 'image/jpeg' && contentType !== 'image/png') {
    throw new functions.https.HttpsError('invalid-argument', 'Only JPG and PNG receipts are accepted.');
  }
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > 5 * 1024 * 1024) {
    throw new functions.https.HttpsError('invalid-argument', 'Receipt image must be 5 MB or smaller.');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
    throw new functions.https.HttpsError('invalid-argument', 'Receipt image must be 5 MB or smaller.');
  }
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if ((contentType === 'image/jpeg' && !isJpeg) || (contentType === 'image/png' && !isPng)) {
    throw new functions.https.HttpsError('invalid-argument', 'Receipt image format could not be verified.');
  }
  return { fingerprint: crypto.createHash('sha256').update(bytes).digest('hex'), contentType };
}

export const getPaymentSettings = functions.https.onCall(async (_data, context) => {
  requireAuth(context);
  const snap = await db.doc(SETTINGS_PATH).get();
  const settings = snap.exists ? snap.data()! : defaultSettings();
  return {
    enabled: settings.enabled !== false,
    mode: settings.mode === 'sandbox' ? 'sandbox' : 'production',
    currency: 'ETB',
    priceEtb: Number(settings.priceEtb || 0),
    paymentMethods: (settings.paymentMethods || []).map((method: any) => ({
      id: method.id, name: method.name, type: method.type,
      accountName: method.accountName, accountNumber: method.accountNumber,
      instructions: method.instructions, enabled: method.enabled === true,
    })),
    instructions: settings.instructions || '',
    support: settings.support || { inApp: true },
    freeAccess: settings.freeAccess || defaultSettings().freeAccess,
  };
});

export const createReceiptUploadSignature = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new functions.https.HttpsError('failed-precondition', 'Receipt uploads are not configured yet. Please contact the administrator.');
  }

  const paymentId = cleanString(data?.paymentId, 80);
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(paymentId)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid payment request.');
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = paymentId + '_' + uid;
  const params = { folder: RECEIPT_FOLDER, public_id: publicId, timestamp };
  const toSign = Object.keys(params).sort().map((key) => key + '=' + (params as any)[key]).join('&');
  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
  return { cloudName, apiKey, timestamp, folder: RECEIPT_FOLDER, publicId, signature };
});

export const submitPayment = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const profile = await getProfile(uid);
  const paymentId = cleanString(data?.paymentId, 80);
  const methodId = cleanString(data?.methodId, 80);
  const receiptUrl = cleanString(data?.receiptUrl, 1500);
  const receiptPublicId = cleanString(data?.receiptPublicId, 200);
  const expectedPublicId = RECEIPT_FOLDER + '/' + paymentId + '_' + uid;
  if (receiptPublicId !== expectedPublicId) {
    throw new functions.https.HttpsError('invalid-argument', 'Receipt upload does not match this payment request.');
  }
  const verifiedReceipt = await verifyCloudinaryReceipt(receiptUrl, expectedPublicId);
  const fingerprint = verifiedReceipt.fingerprint;
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(paymentId) || !methodId ||
      !receiptPublicId.startsWith(RECEIPT_FOLDER + '/')) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid payment method and uploaded JPG/PNG receipt are required.');
  }
  const settingsSnap = await db.doc(SETTINGS_PATH).get();
  const settings = settingsSnap.exists ? settingsSnap.data()! : defaultSettings();
  if (settings.enabled !== true || settings.priceEtb <= 0) {
    throw new functions.https.HttpsError('failed-precondition', 'Payments are not configured yet. Please contact the administrator.');
  }
  const method = (settings.paymentMethods || []).find((item: any) => item.id === methodId && item.enabled);
  if (!method) throw new functions.https.HttpsError('invalid-argument', 'This payment method is not available.');
  const amountPaid = Number(data?.amountPaid);
  if (!Number.isFinite(amountPaid) || amountPaid <= 0 || amountPaid > 10000000) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter the amount you transferred.');
  }

  const mode = settings.mode === 'sandbox' ? 'sandbox' : 'production';
  const paymentCollection = mode === 'sandbox' ? 'sandboxPayments' : 'payments';
  const accountCollection = mode === 'sandbox' ? 'sandboxPaymentAccounts' : 'paymentAccounts';
  const fingerprintCollection = mode === 'sandbox' ? 'sandboxReceiptFingerprints' : 'receiptFingerprints';
  const paymentRef = db.collection(paymentCollection).doc(paymentId);
  const accountRef = db.collection(accountCollection).doc(uid);
  const duplicateRef = fingerprint ? db.collection(fingerprintCollection).doc(fingerprint) : null;
  await db.runTransaction(async (tx) => {
    const userRef = db.collection('users').doc(uid);
    const [accountSnap, paymentSnap, duplicateSnap, userSnap] = await Promise.all([
      tx.get(accountRef),
      tx.get(paymentRef),
      duplicateRef ? tx.get(duplicateRef) : Promise.resolve(null),
      tx.get(userRef),
    ]);
    const account = accountSnap.data() || {};
    if (account.paymentAccess?.lifetime === true || userSnap.data()?.paymentAccess?.lifetime === true) {
      throw new functions.https.HttpsError('already-exists', 'Your account already has lifetime access.');
    }
    if (account.pendingPaymentId) {
      throw new functions.https.HttpsError('already-exists', 'You already have a pending payment. Please wait for its review.');
    }
    if (paymentSnap.exists) throw new functions.https.HttpsError('already-exists', 'This payment request already exists.');
    if (duplicateSnap?.exists) throw new functions.https.HttpsError('already-exists', 'This receipt appears to have been submitted before. Please contact support if this is an error.');
    const userName = cleanString(profile.fullName || profile.full_name, 160);
    tx.set(paymentRef, {
      paymentId, userId: uid, userName,
      email: cleanString(profile.email, 254),
      phone: cleanString(profile.phoneNumber || profile.phone, 40),
      status: 'Pending' as PaymentStatus,
      methodId, methodName: method.name,
      methodSnapshot: { name: method.name, accountName: method.accountName || '', accountNumber: method.accountNumber || '' },
      expectedAmountEtb: Number(settings.priceEtb),
      amountPaidEtb: amountPaid,
      currency: 'ETB',
      receiptUrl, receiptPublicId, receiptFingerprint: fingerprint || null,
      mode,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedAt: null, reviewedBy: null, rejectionReason: null,
    });
    tx.set(accountRef, { pendingPaymentId: paymentId, paymentStatus: 'Pending', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    if (duplicateRef && fingerprint) tx.create(duplicateRef, { paymentId, userId: uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  return { paymentId, status: 'Pending' };
});

export const getMyPayment = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  const settingsSnap = await db.doc(SETTINGS_PATH).get();
  const mode = settingsSnap.data()?.mode === 'sandbox' ? 'sandbox' : 'production';
  const accountCollection = mode === 'sandbox' ? 'sandboxPaymentAccounts' : 'paymentAccounts';
  const paymentCollection = mode === 'sandbox' ? 'sandboxPayments' : 'payments';
  const [accountSnap, userSnap] = await Promise.all([
    db.collection(accountCollection).doc(uid).get(), db.collection('users').doc(uid).get(),
  ]);
  const account = accountSnap.data() || {};
  const permanentAccess = userSnap.data()?.paymentAccess?.lifetime === true
    ? userSnap.data()?.paymentAccess : account.paymentAccess || { lifetime: false };
  let payment: FirebaseFirestore.DocumentData | null = null;
  if (account.pendingPaymentId || account.lastPaymentId) {
    const id = account.pendingPaymentId || account.lastPaymentId;
    const snap = await db.collection(paymentCollection).doc(id).get();
    if (snap.exists) {
      const data = snap.data()!;
      payment = {
        paymentId: data.paymentId, status: data.status,
        expectedAmountEtb: data.expectedAmountEtb, amountPaidEtb: data.amountPaidEtb,
        methodName: data.methodName, submittedAt: data.submittedAt,
        rejectionReason: data.rejectionReason,
      };
    }
  }
  return { paymentAccess: permanentAccess, paymentStatus: account.paymentStatus || null, payment };
});

export const getPaymentAdminData = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  await requireAdmin(uid);
  const limit = Math.min(Math.max(Number(data?.limit) || 100, 1), 300);
  const settingsSnap = await db.doc(SETTINGS_PATH).get();
  const mode = settingsSnap.data()?.mode === 'sandbox' ? 'sandbox' : 'production';
  const paymentCollection = mode === 'sandbox' ? 'sandboxPayments' : 'payments';
  const status = cleanString(data?.status, 20);
  let query: FirebaseFirestore.Query = db.collection(paymentCollection).orderBy('submittedAt', 'desc').limit(limit);
  if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
    query = db.collection(paymentCollection).where('status', '==', status).orderBy('submittedAt', 'desc').limit(limit);
  }
  const [paymentsSnap, allPaymentsSnap] = await Promise.all([
    query.get(), db.collection(paymentCollection).orderBy('submittedAt', 'desc').limit(2000).get(),
  ]);
  const payments = paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const allPayments = allPaymentsSnap.docs.map((doc) => doc.data());
  const totals = { total: allPayments.length, pending: 0, approved: 0, rejected: 0, revenueEtb: 0 };
  allPayments.forEach((p: any) => {
    if (p.status === 'Pending') totals.pending++;
    if (p.status === 'Approved') { totals.approved++; totals.revenueEtb += Number(p.amountPaidEtb || 0); }
    if (p.status === 'Rejected') totals.rejected++;
  });
  return { payments, totals, settings: settingsSnap.exists ? settingsSnap.data() : defaultSettings() };
});

export const reviewPayment = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const reviewer = await requireAdmin(uid, true);
  const paymentId = cleanString(data?.paymentId, 80);
  const decision = cleanString(data?.decision, 20) as PaymentStatus;
  const reason = cleanString(data?.reason, 500);
  if (!paymentId || !['Approved', 'Rejected'].includes(decision)) {
    throw new functions.https.HttpsError('invalid-argument', 'Choose approve or reject.');
  }
  if (decision === 'Rejected' && !reason) {
    throw new functions.https.HttpsError('invalid-argument', 'A rejection reason is required.');
  }
  const productionRef = db.collection('payments').doc(paymentId);
  const sandboxRef = db.collection('sandboxPayments').doc(paymentId);
  await db.runTransaction(async (tx) => {
    const [productionSnap, sandboxSnap] = await Promise.all([tx.get(productionRef), tx.get(sandboxRef)]);
    const isSandbox = !productionSnap.exists && sandboxSnap.exists;
    const paymentRef = isSandbox ? sandboxRef : productionRef;
    const snap = isSandbox ? sandboxSnap : productionSnap;
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Payment not found.');
    const payment = snap.data()!;
    if (payment.status !== 'Pending') throw new functions.https.HttpsError('failed-precondition', 'This payment has already been reviewed.');
    const accountRef = db.collection(isSandbox ? 'sandboxPaymentAccounts' : 'paymentAccounts').doc(payment.userId);
    const decisionData = {
      status: decision, reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: uid, reviewerName: cleanString(reviewer.fullName, 120),
      rejectionReason: decision === 'Rejected' ? reason : null,
    };
    tx.update(paymentRef, decisionData);
    const notificationRef = db.collection('userNotifications').doc(payment.userId).collection('items').doc('payment_' + paymentId);
    tx.set(notificationRef, {
      type: 'payment',
      title: decision === 'Approved' ? 'Payment approved' : 'Payment receipt rejected',
      description: decision === 'Approved'
        ? 'Your payment was approved. Lifetime access is now active.'
        : 'Your receipt was rejected: ' + reason,
      link: '/dashboard/payment',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isRead: false,
    });
    tx.set(accountRef, {
      pendingPaymentId: admin.firestore.FieldValue.delete(),
      lastPaymentId: paymentId,
      paymentStatus: decision,
      ...(decision === 'Approved' ? {
        paymentAccess: { lifetime: true, source: 'payment', grantedAt: admin.firestore.FieldValue.serverTimestamp(), paymentId },
      } : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    if (decision === 'Approved' && !isSandbox) {
      tx.set(db.collection('users').doc(payment.userId), {
        paymentAccess: { lifetime: true, source: 'payment', grantedAt: admin.firestore.FieldValue.serverTimestamp(), paymentId },
      }, { merge: true });
    }
  });
  return { success: true, status: decision };
});

export const savePaymentSettings = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  await requireAdmin(uid, false, true);
  const priceEtb = Number(data?.priceEtb);
  if (!Number.isFinite(priceEtb) || priceEtb < 0 || priceEtb > 10000000) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter a valid ETB price.');
  }
  const existingSnap = await db.doc(SETTINGS_PATH).get();
  const existing = existingSnap.data() || defaultSettings();
  const methods = Array.isArray(data?.paymentMethods) ? data.paymentMethods.slice(0, 20).map((m: any, i: number) => ({
    id: cleanString(m.id, 80) || 'method-' + i,
    name: cleanString(m.name, 80),
    type: cleanString(m.type, 30),
    accountName: cleanString(m.accountName, 120),
    accountNumber: cleanString(m.accountNumber, 100),
    instructions: cleanString(m.instructions, 1000),
    enabled: m.enabled === true,
  })).filter((m: any) => m.name) : existing.paymentMethods;
  const free = { ...(existing.freeAccess || {}), ...(data?.freeAccess || {}) };
  const settings = {
    enabled: data?.enabled === undefined ? existing.enabled : data.enabled === true,
    mode: data?.mode === undefined ? existing.mode : (data.mode === 'sandbox' ? 'sandbox' : 'production'),
    currency: 'ETB',
    priceEtb,
    paymentMethods: methods,
    freeAccess: {
      enabled: free.enabled === true,
      freeChaptersPerSubject: Math.max(0, Math.min(100, Number(free.freeChaptersPerSubject) || 0)),
      freeExamAttempts: Math.max(0, Math.min(100, Number(free.freeExamAttempts) || 0)),
      freeNotesCount: Math.max(0, Math.min(100, Number(free.freeNotesCount) || 0)),
      freeChapterIds: Array.isArray(free.freeChapterIds) ? free.freeChapterIds.slice(0, 500) : [],
      freeExamIds: Array.isArray(free.freeExamIds) ? free.freeExamIds.slice(0, 500) : [],
      freeNoteIds: Array.isArray(free.freeNoteIds) ? free.freeNoteIds.slice(0, 500) : [],
    },
    discounts: data?.discounts || existing.discounts || { codes: [], selectedUsers: [], promotions: [] },
    support: data?.support || existing.support || { inApp: true, telegram: '', whatsapp: '', phone: '', email: '' },
    instructions: data?.instructions === undefined ? existing.instructions : cleanString(data.instructions, 3000),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid,
  };
  await db.doc(SETTINGS_PATH).set(settings, { merge: true });
  return { success: true };
});

export const grantLifetimePaymentAccess = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  await requireAdmin(uid, false, true);
  const targetUid = cleanString(data?.userId, 128);
  const reason = cleanString(data?.reason, 300);
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'Select a user.');
  const access = { lifetime: true, source: 'admin_grant', grantedAt: admin.firestore.FieldValue.serverTimestamp(), grantedBy: uid, reason };
  await db.runTransaction(async (tx) => {
    const userRef = db.collection('users').doc(targetUid);
    const accountRef = db.collection('paymentAccounts').doc(targetUid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
    const user = userSnap.data() || {};
    if (user.paymentAccess?.lifetime === true) return;
    tx.set(userRef, { paymentAccess: access }, { merge: true });
    tx.set(accountRef, { paymentAccess: access, paymentStatus: 'Approved', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  return { success: true };
});
