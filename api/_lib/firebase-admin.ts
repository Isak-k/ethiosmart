import adminModule from 'firebase-admin';

const admin: typeof adminModule = (adminModule as any).default || adminModule;

const DEFAULT_PROJECT_ID = 'online-exam-f443c';
const DEFAULT_STORAGE_BUCKET = 'online-exam-f443c.firebasestorage.app';

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      const trimmed = raw.trim();
      const jsonStr = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonStr);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      if (parsed.privateKey) {
        parsed.privateKey = parsed.privateKey.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (e: any) {
      console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_JSON:', e?.message || e);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    privateKey = privateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  return null;
}

export function getAdminApp() {
  if (admin.apps && admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    DEFAULT_STORAGE_BUCKET;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      return admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
        storageBucket,
      });
    } catch (e: any) {
      console.warn('applicationDefault initialization failed, checking service account config:', e?.message || e);
    }
  }

  const sa = getServiceAccount();
  if (sa) {
    const effectiveProjectId = sa.projectId || sa.project_id || projectId;
    const effectiveBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.VITE_FIREBASE_STORAGE_BUCKET ||
      (effectiveProjectId ? `${effectiveProjectId}.firebasestorage.app` : DEFAULT_STORAGE_BUCKET);

    return admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: effectiveProjectId,
      storageBucket: effectiveBucket,
    });
  }

  // When no service account is configured (e.g. initial dev setup or Spark plan client-side app),
  // initialize with projectId. In this mode, Firebase Auth token verification works cryptographically
  // via Google's public certificates without requiring a service account private key.
  return admin.initializeApp({
    projectId,
    storageBucket,
  });
}

export function hasServiceAccount(): boolean {
  if (process.env.FIRESTORE_EMULATOR_HOST) return true;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return true;
  return !!getServiceAccount();
}

export function getDb(): any {
  if (!hasServiceAccount()) {
    return null;
  }
  getAdminApp();
  return admin.firestore();
}

export function getAuth() {
  getAdminApp();
  return admin.auth();
}

export function getBucket() {
  getAdminApp();
  return admin.storage().bucket();
}

export { admin };
