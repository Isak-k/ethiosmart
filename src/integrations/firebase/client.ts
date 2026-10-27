
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAI, GoogleAIBackend } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const fallbackFirebaseConfig = {
  apiKey: 'AIzaSyA5UNpm_8VghlXdPuvo0UhETORUKitJmo4',
  authDomain: 'online-exam-f443c.firebaseapp.com',
  projectId: 'online-exam-f443c',
  storageBucket: 'online-exam-f443c.firebasestorage.app',
  messagingSenderId: '644701231968',
  appId: '1:644701231968:web:b0fda80164111cbd11dc05',
};

type FirebaseConfigKey = keyof typeof fallbackFirebaseConfig;

export const getFirebaseConfig = (
  environment: Record<string, string | undefined> = (import.meta as any)?.env || (typeof process !== 'undefined' ? process.env : {}) || {}
) => {
  const getValue = (key: FirebaseConfigKey) => {
    const envKey = `VITE_FIREBASE_${key
      .replace(/[A-Z]/g, (letter) => `_${letter}`)
      .toUpperCase()}`;

    const value = environment[envKey];

    return value &&
      value !== 'undefined' &&
      value !== 'null' &&
      value.trim()
      ? value
      : fallbackFirebaseConfig[key];
  };

  return {
    apiKey: getValue('apiKey'),
    authDomain: getValue('authDomain'),
    projectId: getValue('projectId'),
    storageBucket: getValue('storageBucket'),
    messagingSenderId: getValue('messagingSenderId'),
    appId: getValue('appId'),
  };
};

export const firebaseConfig = getFirebaseConfig();
export const isFirebaseConfigured = Boolean(firebaseConfig);

console.log('Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? 'Loaded' : 'Missing',
  authDomain: firebaseConfig.authDomain ? 'Loaded' : 'Missing',
  projectId: firebaseConfig.projectId ? 'Loaded' : 'Missing',
  storageBucket: firebaseConfig.storageBucket ? 'Loaded' : 'Missing',
  messagingSenderId: firebaseConfig.messagingSenderId ? 'Loaded' : 'Missing',
  appId: firebaseConfig.appId ? 'Loaded' : 'Missing',
});

// Initialize the existing Firebase app.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const appCheckSiteKey = (import.meta as any)?.env?.VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY;
if (appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

// Existing Firebase services.
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Gemini through Firebase AI Logic.
export const ai = getAI(app, {
  backend: new GoogleAIBackend(),
});

// Enable Firestore offline persistence.
{
  enableMultiTabIndexedDbPersistence(db)
    .then(() => {
      console.log('Firestore multi-tab persistence enabled');
    })
    .catch((err) => {
      if (err.code === 'unimplemented') {
        enableIndexedDbPersistence(db)
          .then(() => {
            console.log('Firestore persistence enabled');
          })
          .catch((singleTabErr) => {
            if (singleTabErr.code === 'failed-precondition') {
              console.warn(
                'Firestore persistence unavailable: multiple tabs are open.'
              );
            } else if (singleTabErr.code === 'unimplemented') {
              console.warn(
                'Firestore persistence is not supported in this browser.'
              );
            } else {
              console.error(
                'Error enabling Firestore persistence:',
                singleTabErr
              );
            }
          });
      } else if (err.code === 'failed-precondition') {
        console.warn(
          'Firestore persistence unavailable: multiple tabs are open.'
        );
      } else {
        console.error('Error enabling Firestore persistence:', err);
      }
    });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network online - Firebase can sync pending changes');
  });

  window.addEventListener('offline', () => {
    console.warn('Network offline - Firebase is using cached data');
  });
}

export default app;
