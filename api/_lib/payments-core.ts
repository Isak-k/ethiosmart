import * as crypto from 'crypto';
import type { admin as AdminNS } from './firebase-admin.js';
import {
  ApiError,
  err,
  cleanString,
  defaultSettings,
  verifyCloudinaryReceipt,
  SETTINGS_PATH,
  RECEIPT_FOLDER,
  MAIN_ADMIN_EMAIL,
  PaymentStatus,
} from './payment-shared.js';
import { calculatePaymentDiscount, getPaymentStorageCollections } from './payment-discounts.js';
import {
  getLocalPaymentSettings,
  saveLocalPaymentSettings,
  getLocalPayments,
  saveLocalPayments,
  getLocalAccounts,
  saveLocalAccounts,
} from './local-store.js';

export async function getProfile(db: FirebaseFirestore.Firestore, uid: string): Promise<FirebaseFirestore.DocumentData> {
  try {
    if (db) {
      const snap = await db.collection('users').doc(uid).get();
      if (snap.exists) return snap.data() || {};
    }
  } catch {}
  return { uid, role: 'student' };
}

export function requireAdminProfile(
  profile: FirebaseFirestore.DocumentData,
  canReview = false,
  manageSettings = false
): FirebaseFirestore.DocumentData {
  const isMainAdmin = String(profile.email || '').toLowerCase() === MAIN_ADMIN_EMAIL;
  const isSuperAdmin = profile.role === 'superadmin' || profile.isSuperAdmin === true;

  if (profile.role !== 'admin' && profile.role !== 'superadmin' && !isMainAdmin && !isSuperAdmin) {
    throw err('permission-denied', 'Administrator access is required.', 403);
  }

  if (canReview && !isMainAdmin && !isSuperAdmin && profile.permissions?.managePayments !== true) {
    throw err('permission-denied', 'You are not assigned to review payments.', 403);
  }

  if (manageSettings && !isMainAdmin && !isSuperAdmin) {
    throw err('permission-denied', 'Only the main administrator can change payment settings or grant lifetime access.', 403);
  }
  return profile;
}

function validateDiscountSettings(raw: any): any {
  const source = raw && typeof raw === 'object' ? raw : {};
  const codes = Array.isArray(source.codes) ? source.codes : [];
  const promotions = Array.isArray(source.promotions) ? source.promotions : [];
  const selectedUsers = Array.isArray(source.selectedUsers) ? source.selectedUsers : [];
  if (codes.length > 200 || promotions.length > 200 || selectedUsers.length > 500) {
    throw err('invalid-argument', 'Too many discount entries.');
  }
  const validateValue = (kind: unknown, value: unknown) => {
    const amount = Number(value);
    if (
      (kind !== 'percentage' && kind !== 'fixed') ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      (kind === 'percentage' && amount > 100) ||
      amount > 10000000
    ) {
      throw err('invalid-argument', 'Discount type or value is invalid.');
    }
    return amount;
  };
  const seenCodes = new Set<string>();
  const cleanCodes = codes.map((item: any) => {
    const code = cleanString(item?.code, 40).toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code) || seenCodes.has(code)) {
      throw err('invalid-argument', 'Discount codes must be unique and contain 3–40 letters, numbers, underscores or hyphens.');
    }
    seenCodes.add(code);
    return { code, kind: item.kind, value: validateValue(item.kind, item.value), enabled: item.enabled === true };
  });
  const cleanPromotions = promotions.map((item: any) => ({
    label: cleanString(item?.label, 100),
    kind: item?.kind,
    value: validateValue(item?.kind, item?.value),
    active: item?.active === true,
  }));
  const cleanUsers = selectedUsers.map((item: any) => {
    const identifier = cleanString(item?.identifier, 254);
    if (!identifier) throw err('invalid-argument', 'Every selected-user discount needs a user ID or email.');
    return { identifier, kind: item.kind, value: validateValue(item.kind, item.value) };
  });
  return { codes: cleanCodes, promotions: cleanPromotions, selectedUsers: cleanUsers };
}

export async function getPaymentSettings(db: FirebaseFirestore.Firestore) {
  let settings: any = null;
  try {
    if (db) {
      const snap = await db.doc(SETTINGS_PATH).get();
      if (snap.exists) settings = snap.data();
    }
  } catch (err: any) {
    console.warn('Could not read payment settings from Firestore, checking local store:', err?.message || err);
  }

  if (!settings) {
    settings = getLocalPaymentSettings();
  }

  return {
    enabled: settings.enabled !== false,
    mode: settings.mode === 'sandbox' ? 'sandbox' : 'production',
    currency: 'ETB',
    priceEtb: Number(settings.priceEtb || 0),
    paymentMethods: (settings.paymentMethods || []).map((method: any) => ({
      id: method.id,
      name: method.name,
      type: method.type,
      accountName: method.accountName,
      accountNumber: method.accountNumber,
      instructions: method.instructions,
      enabled: method.enabled === true,
    })),
    instructions: settings.instructions || '',
    support: settings.support || { inApp: true },
    freeAccess: settings.freeAccess || defaultSettings().freeAccess,
  };
}

export async function quotePaymentDiscount(
  db: FirebaseFirestore.Firestore,
  uid: string,
  profile: FirebaseFirestore.DocumentData,
  data: any
) {
  let settings: any = null;
  try {
    if (db) {
      const settingsSnap = await db.doc(SETTINGS_PATH).get();
      if (settingsSnap.exists) settings = settingsSnap.data();
    }
  } catch {}

  if (!settings) settings = getLocalPaymentSettings();

  if (settings.enabled === false || Number(settings.priceEtb) <= 0) {
    throw err('failed-precondition', 'Payments are not configured yet.', 412);
  }
  try {
    return calculatePaymentDiscount(
      settings.priceEtb,
      settings.discounts,
      { uid, email: cleanString(profile.email, 254) },
      data?.discountCode
    );
  } catch (error: any) {
    throw err('invalid-argument', error?.message || 'Discount could not be applied.');
  }
}

export async function createReceiptUploadSignature(uid: string, data: any) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const paymentId = cleanString(data?.paymentId, 80);
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(paymentId)) {
    throw err('invalid-argument', 'Invalid payment request.');
  }

  if (!cloudName || !apiKey || !apiSecret) {
    if (process.env.NODE_ENV !== 'production') {
      const publicId = RECEIPT_FOLDER + '/' + paymentId + '_' + uid;
      return {
        isLocal: true,
        cloudName: 'local-dev',
        apiKey: 'local-dev',
        timestamp: Math.floor(Date.now() / 1000),
        folder: RECEIPT_FOLDER,
        publicId,
        signature: 'local-dev-signature',
        uploadUrl: '/api/payments/uploadReceiptDev',
      };
    }
    throw err('failed-precondition', 'Receipt uploads are not configured yet. Please configure Cloudinary.', 412);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = paymentId + '_' + uid;
  const params = { folder: RECEIPT_FOLDER, public_id: publicId, timestamp };
  const toSign = Object.keys(params)
    .sort()
    .map((key) => key + '=' + (params as any)[key])
    .join('&');
  const signature = crypto
    .createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');
  return { cloudName, apiKey, timestamp, folder: RECEIPT_FOLDER, publicId, signature };
}

export async function submitPayment(
  db: FirebaseFirestore.Firestore,
  admin: typeof AdminNS,
  uid: string,
  profile: FirebaseFirestore.DocumentData,
  data: any
) {
  const paymentId = cleanString(data?.paymentId, 80);
  const methodId = cleanString(data?.methodId, 80);
  const receiptUrl = cleanString(data?.receiptUrl, 1500);
  const receiptPublicId = cleanString(data?.receiptPublicId, 200);
  const expectedPublicId = RECEIPT_FOLDER + '/' + paymentId + '_' + uid;
  const shortPublicId = paymentId + '_' + uid;
  if (receiptPublicId !== expectedPublicId && receiptPublicId !== shortPublicId) {
    throw err('invalid-argument', 'Receipt upload does not match this payment request.');
  }
  const verifiedReceipt = await verifyCloudinaryReceipt(receiptUrl, expectedPublicId);
  const fingerprint = verifiedReceipt.fingerprint;
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(paymentId) || !methodId) {
    throw err('invalid-argument', 'A valid payment method and uploaded JPG/PNG receipt are required.');
  }

  let settings: any = null;
  try {
    if (db) {
      const snap = await db.doc(SETTINGS_PATH).get();
      if (snap.exists) settings = snap.data();
    }
  } catch {}
  if (!settings) settings = getLocalPaymentSettings();

  if (settings.enabled === false || Number(settings.priceEtb) <= 0) {
    throw err('failed-precondition', 'Payments are not configured yet. Please contact the administrator.', 412);
  }
  const method = (settings.paymentMethods || []).find((item: any) => item.id === methodId && item.enabled);
  if (!method) throw err('invalid-argument', 'This payment method is not available.');
  let discountQuote;
  try {
    discountQuote = calculatePaymentDiscount(
      settings.priceEtb,
      settings.discounts,
      { uid, email: cleanString(profile.email, 254) },
      data?.discountCode
    );
  } catch (error: any) {
    throw err('invalid-argument', error?.message || 'Discount could not be applied.');
  }

  const rawAmountPaid = Number(data?.amountPaid);
  const amountPaid = Number.isFinite(rawAmountPaid) && rawAmountPaid > 0 ? rawAmountPaid : discountQuote.finalAmountEtb;
  if (!Number.isFinite(amountPaid) || amountPaid <= 0 || amountPaid > 10000000) {
    throw err('invalid-argument', 'Invalid payable amount.');
  }

  const mode = settings.mode === 'sandbox' ? 'sandbox' : 'production';
  const userName = cleanString(profile.fullName || profile.full_name || profile.displayName || profile.name || 'Student', 160);

  const paymentRecord = {
    paymentId,
    userId: uid,
    userName,
    email: cleanString(profile.email, 254),
    phone: cleanString(profile.phoneNumber || profile.phone, 40),
    status: 'Pending' as PaymentStatus,
    methodId,
    methodName: method.name,
    methodSnapshot: { name: method.name, accountName: method.accountName || '', accountNumber: method.accountNumber || '' },
    originalPriceEtb: discountQuote.originalPriceEtb,
    discountEtb: discountQuote.discountEtb,
    discountSnapshot: discountQuote.discount,
    expectedAmountEtb: discountQuote.finalAmountEtb,
    amountPaidEtb: amountPaid,
    currency: 'ETB',
    receiptUrl,
    receiptPublicId,
    receiptFingerprint: fingerprint || null,
    mode,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
  };

  try {
    if (db) {
      const storage = getPaymentStorageCollections(mode);
      const paymentRef = db.collection(storage.payments).doc(paymentId);
      const accountRef = db.collection(storage.accounts).doc(uid);
      const productionAccountRef = db.collection('paymentAccounts').doc(uid);
      const sandboxAccountRef = db.collection('sandboxPaymentAccounts').doc(uid);
      const duplicateRef = fingerprint ? db.collection(storage.fingerprints).doc(fingerprint) : null;
      const userRef = db.collection('users').doc(uid);

      await db.runTransaction(async (tx) => {
        const [productionAccountSnap, sandboxAccountSnap, paymentSnap, duplicateSnap, userSnap] = await Promise.all([
          tx.get(productionAccountRef),
          tx.get(sandboxAccountRef),
          tx.get(paymentRef),
          duplicateRef ? tx.get(duplicateRef) : Promise.resolve(null),
          tx.get(userRef),
        ]);
        const productionAccount = productionAccountSnap.data() || {};
        const sandboxAccount = sandboxAccountSnap.data() || {};
        if (productionAccount.paymentAccess?.lifetime === true || userSnap.data()?.paymentAccess?.lifetime === true) {
          throw err('already-exists', 'Your account already has lifetime access.', 409);
        }
        if (productionAccount.pendingPaymentId || sandboxAccount.pendingPaymentId) {
          throw err('already-exists', 'You already have a pending payment. Please wait for its review.', 409);
        }
        if (paymentSnap.exists) throw err('already-exists', 'This payment request already exists.', 409);
        if (duplicateSnap?.exists) throw err('already-exists', 'This receipt appears to have been submitted before.', 409);

        tx.set(paymentRef, {
          ...paymentRecord,
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(
          accountRef,
          { pendingPaymentId: paymentId, paymentStatus: 'Pending', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
        if (duplicateRef && fingerprint) {
          tx.create(duplicateRef, { paymentId, userId: uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        }
      });
      return { paymentId, status: 'Pending' };
    }
  } catch (dbErr: any) {
    if (dbErr instanceof ApiError) throw dbErr;
    console.warn('Firestore transaction failed, saving to local store:', dbErr?.message || dbErr);
  }

  // Local store fallback
  const localPayments = getLocalPayments();
  saveLocalPayments([paymentRecord, ...localPayments.filter((p: any) => p.paymentId !== paymentId)]);
  const accounts = getLocalAccounts();
  accounts[uid] = { ...(accounts[uid] || {}), pendingPaymentId: paymentId, paymentStatus: 'Pending', updatedAt: new Date().toISOString() };
  saveLocalAccounts(accounts);

  return { paymentId, status: 'Pending' };
}

export async function getMyPayment(db: FirebaseFirestore.Firestore, uid: string) {
  let settings: FirebaseFirestore.DocumentData = defaultSettings();
  try {
    if (db) {
      const settingsSnap = await db.doc(SETTINGS_PATH).get();
      if (settingsSnap.exists) settings = settingsSnap.data() || defaultSettings();
    }
  } catch {}
  const mode = settings.mode === 'sandbox' ? 'sandbox' : 'production';

  try {
    if (db) {
      const [productionAccountSnap, sandboxAccountSnap, userSnap] = await Promise.all([
        db.collection('paymentAccounts').doc(uid).get(),
        db.collection('sandboxPaymentAccounts').doc(uid).get(),
        db.collection('users').doc(uid).get(),
      ]);
      const productionAccount = productionAccountSnap.data() || {};
      const sandboxAccount = sandboxAccountSnap.data() || {};
      const activeAccount = mode === 'sandbox' ? sandboxAccount : productionAccount;
      const fallbackAccount = mode === 'sandbox' ? productionAccount : sandboxAccount;
      const userPaymentAccess = userSnap.data()?.paymentAccess;
      const permanentAccess =
        userPaymentAccess?.lifetime === true
          ? userPaymentAccess
          : productionAccount.paymentAccess?.lifetime === true
          ? productionAccount.paymentAccess
          : { lifetime: false };
      const activeCollection = mode === 'sandbox' ? 'sandboxPayments' : 'payments';
      const fallbackCollection = mode === 'sandbox' ? 'payments' : 'sandboxPayments';
      const selectedAccount = activeAccount.pendingPaymentId || activeAccount.lastPaymentId ? activeAccount : fallbackAccount;
      const selectedCollection = selectedAccount === activeAccount ? activeCollection : fallbackCollection;

      let payment: FirebaseFirestore.DocumentData | null = null;
      if (selectedAccount.pendingPaymentId || selectedAccount.lastPaymentId) {
        const id = selectedAccount.pendingPaymentId || selectedAccount.lastPaymentId;
        const snap = await db.collection(selectedCollection).doc(id).get();
        if (snap.exists) {
          const data = snap.data()!;
          payment = {
            paymentId: data.paymentId,
            status: data.status,
            expectedAmountEtb: data.expectedAmountEtb,
            amountPaidEtb: data.amountPaidEtb,
            methodName: data.methodName,
            submittedAt: data.submittedAt,
            rejectionReason: data.rejectionReason,
          };
        }
      }
      return { paymentAccess: permanentAccess, paymentStatus: selectedAccount.paymentStatus || null, payment };
    }
  } catch (err: any) {
    console.warn('Firestore getMyPayment failed, reading local store:', err?.message || err);
  }

  // Local store fallback
  const accounts = getLocalAccounts();
  const userAccount = accounts[uid] || {};
  const localPayments = getLocalPayments();
  const payment = localPayments.find((p: any) => p.userId === uid) || null;
  return {
    paymentAccess: userAccount.paymentAccess || { lifetime: false },
    paymentStatus: userAccount.paymentStatus || payment?.status || null,
    payment,
  };
}

export async function getPaymentAdminData(
  db: FirebaseFirestore.Firestore,
  profile: FirebaseFirestore.DocumentData,
  data: any
) {
  requireAdminProfile(profile);
  const limit = Math.min(Math.max(Number(data?.limit) || 100, 1), 300);
  const status = cleanString(data?.status, 20);

  let liveSettings: FirebaseFirestore.DocumentData = getLocalPaymentSettings();
  try {
    if (db) {
      const settingsSnap = await db.doc(SETTINGS_PATH).get();
      if (settingsSnap.exists) liveSettings = settingsSnap.data() || liveSettings;
    }
  } catch {}

  const mode = liveSettings?.mode === 'sandbox' ? 'sandbox' : 'production';
  const paymentCollection = mode === 'sandbox' ? 'sandboxPayments' : 'payments';

  try {
    if (db) {
      let query: FirebaseFirestore.Query = db.collection(paymentCollection).orderBy('submittedAt', 'desc').limit(limit);
      if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
        query = db.collection(paymentCollection).where('status', '==', status).orderBy('submittedAt', 'desc').limit(limit);
      }

      let paymentsSnap;
      let allPaymentsSnap;
      try {
        [paymentsSnap, allPaymentsSnap] = await Promise.all([
          query.get(),
          db.collection(paymentCollection).orderBy('submittedAt', 'desc').limit(2000).get(),
        ]);
      } catch (err: any) {
        console.warn('Index query failed, falling back to ordered collection scan with in-memory filtering:', err?.message || err);
        allPaymentsSnap = await db.collection(paymentCollection).orderBy('submittedAt', 'desc').limit(2000).get();
        const all = allPaymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const filtered = status && ['Pending', 'Approved', 'Rejected'].includes(status)
          ? all.filter((p: any) => p.status === status)
          : all;
        const payments = filtered.slice(0, limit);
        const totals = { total: all.length, pending: 0, approved: 0, rejected: 0, revenueEtb: 0 };
        all.forEach((p: any) => {
          if (p.status === 'Pending') totals.pending++;
          if (p.status === 'Approved') {
            totals.approved++;
            totals.revenueEtb += Number(p.amountPaidEtb || 0);
          }
          if (p.status === 'Rejected') totals.rejected++;
        });
        return { payments, totals, settings: liveSettings };
      }

      const payments = paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const allPayments = allPaymentsSnap.docs.map((doc) => doc.data());
      const totals = { total: allPayments.length, pending: 0, approved: 0, rejected: 0, revenueEtb: 0 };
      allPayments.forEach((p: any) => {
        if (p.status === 'Pending') totals.pending++;
        if (p.status === 'Approved') {
          totals.approved++;
          totals.revenueEtb += Number(p.amountPaidEtb || 0);
        }
        if (p.status === 'Rejected') totals.rejected++;
      });
      return { payments, totals, settings: liveSettings };
    }
  } catch (err: any) {
    console.warn('Firestore read failed in getPaymentAdminData, reading local store:', err?.message || err);
  }

  // Local store fallback
  const local = getLocalPayments();
  const filtered = status && ['Pending', 'Approved', 'Rejected'].includes(status)
    ? local.filter((p: any) => p.status === status)
    : local;
  const payments = filtered.slice(0, limit);
  const totals = { total: local.length, pending: 0, approved: 0, rejected: 0, revenueEtb: 0 };
  local.forEach((p: any) => {
    if (p.status === 'Pending') totals.pending++;
    if (p.status === 'Approved') {
      totals.approved++;
      totals.revenueEtb += Number(p.amountPaidEtb || 0);
    }
    if (p.status === 'Rejected') totals.rejected++;
  });
  return { payments, totals, settings: liveSettings };
}

export async function reviewPayment(
  db: FirebaseFirestore.Firestore,
  admin: typeof AdminNS,
  uid: string,
  profile: FirebaseFirestore.DocumentData,
  data: any
) {
  const reviewer = requireAdminProfile(profile, true);
  const paymentId = cleanString(data?.paymentId, 80);
  const decision = cleanString(data?.decision, 20) as PaymentStatus;
  const reason = cleanString(data?.reason, 500);
  if (!paymentId || !['Approved', 'Rejected'].includes(decision)) {
    throw err('invalid-argument', 'Choose approve or reject.');
  }
  if (decision === 'Rejected' && !reason) {
    throw err('invalid-argument', 'A rejection reason is required.');
  }

  try {
    if (db) {
      const productionRef = db.collection('payments').doc(paymentId);
      const sandboxRef = db.collection('sandboxPayments').doc(paymentId);

      await db.runTransaction(async (tx) => {
        const [productionSnap, sandboxSnap] = await Promise.all([tx.get(productionRef), tx.get(sandboxRef)]);
        const isSandbox = !productionSnap.exists && sandboxSnap.exists;
        const paymentRef = isSandbox ? sandboxRef : productionRef;
        const snap = isSandbox ? sandboxSnap : productionSnap;
        if (!snap.exists) throw err('not-found', 'Payment not found.', 404);
        const payment = snap.data()!;
        if (payment.status !== 'Pending') throw err('failed-precondition', 'This payment has already been reviewed.', 412);
        const accountRef = db.collection(isSandbox ? 'sandboxPaymentAccounts' : 'paymentAccounts').doc(payment.userId);
        const decisionData = {
          status: decision,
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedBy: uid,
          reviewerName: cleanString(reviewer.fullName || reviewer.full_name || 'Admin', 120),
          rejectionReason: decision === 'Rejected' ? reason : null,
        };
        tx.update(paymentRef, decisionData);
        tx.set(
          accountRef,
          {
            pendingPaymentId: admin.firestore.FieldValue.delete(),
            lastPaymentId: paymentId,
            paymentStatus: decision,
            ...(decision === 'Approved' && !isSandbox
              ? { paymentAccess: { lifetime: true, source: 'payment', grantedAt: admin.firestore.FieldValue.serverTimestamp(), paymentId } }
              : {}),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        if (decision === 'Approved' && !isSandbox) {
          tx.set(
            db.collection('users').doc(payment.userId),
            { paymentAccess: { lifetime: true, source: 'payment', grantedAt: admin.firestore.FieldValue.serverTimestamp(), paymentId } },
            { merge: true }
          );
        }
      });
      return { success: true, status: decision };
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    console.warn('Firestore reviewPayment failed, saving to local store:', err?.message || err);
  }

  // Local store fallback
  const localPayments = getLocalPayments();
  const paymentIndex = localPayments.findIndex((p: any) => p.paymentId === paymentId);
  if (paymentIndex >= 0) {
    const payment = localPayments[paymentIndex];
    payment.status = decision;
    payment.reviewedAt = new Date().toISOString();
    payment.reviewedBy = uid;
    payment.rejectionReason = decision === 'Rejected' ? reason : null;
    saveLocalPayments(localPayments);

    const accounts = getLocalAccounts();
    const userAccount = accounts[payment.userId] || {};
    userAccount.pendingPaymentId = null;
    userAccount.lastPaymentId = paymentId;
    userAccount.paymentStatus = decision;
    if (decision === 'Approved') {
      userAccount.paymentAccess = { lifetime: true, source: 'payment', grantedAt: new Date().toISOString(), paymentId };
    }
    accounts[payment.userId] = userAccount;
    saveLocalAccounts(accounts);
  }

  return { success: true, status: decision };
}

export async function savePaymentSettings(
  db: FirebaseFirestore.Firestore,
  admin: typeof AdminNS,
  uid: string,
  profile: FirebaseFirestore.DocumentData,
  data: any
) {
  requireAdminProfile(profile, false, true);
  const priceEtb = Number(data?.priceEtb);
  if (!Number.isFinite(priceEtb) || priceEtb < 0 || priceEtb > 10000000) {
    throw err('invalid-argument', 'Enter a valid ETB price.');
  }

  let existing: FirebaseFirestore.DocumentData = getLocalPaymentSettings();
  try {
    if (db) {
      const existingSnap = await db.doc(SETTINGS_PATH).get();
      if (existingSnap.exists) existing = existingSnap.data() || existing;
    }
  } catch {}

  const methods = Array.isArray(data?.paymentMethods)
    ? data.paymentMethods
        .slice(0, 20)
        .map((m: any, i: number) => ({
          id: cleanString(m.id, 80) || 'method-' + i,
          name: cleanString(m.name, 80),
          type: cleanString(m.type, 30),
          accountName: cleanString(m.accountName, 120),
          accountNumber: cleanString(m.accountNumber, 100),
          instructions: cleanString(m.instructions, 1000),
          enabled: m.enabled === true,
        }))
        .filter((m: any) => m.name)
    : existing.paymentMethods;
  const free = { ...(existing.freeAccess || {}), ...(data?.freeAccess || {}) };
  const settings = {
    enabled: data?.enabled === undefined ? existing.enabled : data.enabled === true,
    mode: data?.mode === undefined ? existing.mode : data.mode === 'sandbox' ? 'sandbox' : 'production',
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
    discounts: validateDiscountSettings(data?.discounts === undefined ? existing.discounts : data.discounts),
    support: data?.support || existing.support || { inApp: true, telegram: '', whatsapp: '', phone: '', email: '' },
    instructions: data?.instructions === undefined ? existing.instructions : cleanString(data.instructions, 3000),
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  };

  try {
    if (db) {
      await db.doc(SETTINGS_PATH).set(
        {
          ...settings,
          updatedAt: admin?.firestore?.FieldValue ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (err: any) {
    console.warn('Firestore set doc failed, updating local store:', err?.message || err);
  }

  saveLocalPaymentSettings(settings);
  return { success: true };
}

export async function grantLifetimePaymentAccess(
  db: FirebaseFirestore.Firestore,
  admin: typeof AdminNS,
  uid: string,
  profile: FirebaseFirestore.DocumentData,
  data: any
) {
  requireAdminProfile(profile, false, true);
  const targetUid = cleanString(data?.userId, 128);
  const reason = cleanString(data?.reason, 300);
  if (!targetUid) throw err('invalid-argument', 'Select a user.');
  const access = { lifetime: true, source: 'admin_grant', grantedAt: new Date().toISOString(), grantedBy: uid, reason };

  try {
    if (db) {
      await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(targetUid);
        const accountRef = db.collection('paymentAccounts').doc(targetUid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) throw err('not-found', 'User not found.', 404);
        const user = userSnap.data() || {};
        if (user.paymentAccess?.lifetime === true) return;
        tx.set(userRef, { paymentAccess: access }, { merge: true });
        tx.set(
          accountRef,
          { paymentAccess: access, paymentStatus: 'Approved', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      });
      return { success: true };
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    console.warn('Firestore grantLifetimePaymentAccess failed, updating local store:', err?.message || err);
  }

  const accounts = getLocalAccounts();
  accounts[targetUid] = {
    ...(accounts[targetUid] || {}),
    paymentAccess: access,
    paymentStatus: 'Approved',
    updatedAt: new Date().toISOString(),
  };
  saveLocalAccounts(accounts);
  return { success: true };
}
