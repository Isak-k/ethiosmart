import { describe, it, expect } from 'vitest';
import { getFirebaseConfig } from './client';

describe('Firebase configuration guard', () => {
  it('returns null when Firebase environment variables are missing', () => {
    const originalEnv = { ...import.meta.env };

    try {
      // @ts-expect-error override for test
      import.meta.env.VITE_FIREBASE_API_KEY = 'undefined';
      // @ts-expect-error override for test
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = 'undefined';
      // @ts-expect-error override for test
      import.meta.env.VITE_FIREBASE_PROJECT_ID = 'undefined';
      // @ts-expect-error override for test
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = 'undefined';
      // @ts-expect-error override for test
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = 'undefined';
      // @ts-expect-error override for test
      import.meta.env.VITE_FIREBASE_APP_ID = 'undefined';

      expect(getFirebaseConfig()).toBeNull();
      expect(Boolean(getFirebaseConfig())).toBe(false);
    } finally {
      Object.assign(import.meta.env, originalEnv);
    }
  });
});
