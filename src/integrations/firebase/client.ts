import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const fallbackFirebaseConfig = {
  apiKey: 'AIzaSyA5UNpm_8VghlXdPuvo0UhETORUKitJmo4',
  authDomain: 'online-exam-f443c.firebaseapp.com',
  projectId: 'online-exam-f443c',
  storageBucket: 'online-exam-f443c.firebasestorage.app',
  messagingSenderId: '644701231968',
  appId: '1:644701231968:web:b0fda80164111cbd11dc05',
};

type FirebaseConfigKey = keyof typeof fallbackFirebaseConfig;

export const getFirebaseConfig = (environment: Record<string, string | undefined> = import.meta.env) => {
  const getValue = (key: FirebaseConfigKey) => {
    const envKey = `VITE_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
    const value = environment[envKey];
    return value && value !== 'undefined' && value !== 'null' && value.trim()
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

// Debug: Log config to verify environment variables are loaded
console.log('Firebase Config:', {
  apiKey: firebaseConfig?.apiKey ? '✓ Loaded' : '✗ Missing',
  authDomain: firebaseConfig?.authDomain ? '✓ Loaded' : '✗ Missing',
  projectId: firebaseConfig?.projectId ? '✓ Loaded' : '✗ Missing',
  storageBucket: firebaseConfig?.storageBucket ? '✓ Loaded' : '✗ Missing',
  messagingSenderId: firebaseConfig?.messagingSenderId ? '✓ Loaded' : '✗ Missing',
  appId: firebaseConfig?.appId ? '✓ Loaded' : '✗ Missing'
});

// Environment values override the public project defaults when provided.
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

{
  // Enable offline persistence for Firestore with multi-tab support
  // Try multi-tab first, fallback to single-tab if needed
  enableMultiTabIndexedDbPersistence(db)
    .then(() => {
      console.log('✓ Firebase offline persistence enabled (multi-tab)');
    })
    .catch((err) => {
      if (err.code === 'unimplemented') {
        // Multi-tab not supported, try single-tab
        console.log('Multi-tab persistence not supported, trying single-tab...');
        return enableIndexedDbPersistence(db)
          .then(() => {
            console.log('✓ Firebase offline persistence enabled (single-tab)');
          })
          .catch((singleTabErr) => {
            if (singleTabErr.code === 'failed-precondition') {
              console.warn('⚠ Offline persistence failed: Multiple tabs open. Close other tabs and refresh.');
            } else if (singleTabErr.code === 'unimplemented') {
              console.warn('⚠ Offline persistence not supported by this browser');
            } else {
              console.error('✗ Error enabling offline persistence:', singleTabErr);
            }
          });
      } else {
        console.error('✗ Error enabling multi-tab persistence:', err);
      }
    });
}

// Monitor online/offline status for Firebase
window.addEventListener('online', () => {
  console.log('✓ Network online - Firebase will sync pending changes');
});

window.addEventListener('offline', () => {
  console.log('⚠ Network offline - Firebase using cached data');
});

export default app;