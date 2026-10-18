import { describe, it, expect } from 'vitest';
import { getFirebaseConfig } from './client';

describe('Firebase configuration', () => {
  it('uses the supplied project config when environment variables are missing', () => {
    expect(getFirebaseConfig({})).toEqual({
      apiKey: 'AIzaSyA5UNpm_8VghlXdPuvo0UhETORUKitJmo4',
      authDomain: 'online-exam-f443c.firebaseapp.com',
      projectId: 'online-exam-f443c',
      storageBucket: 'online-exam-f443c.firebasestorage.app',
      messagingSenderId: '644701231968',
      appId: '1:644701231968:web:b0fda80164111cbd11dc05',
    });
  });

  it('prefers Firebase environment values when provided', () => {
    expect(getFirebaseConfig({ VITE_FIREBASE_PROJECT_ID: 'override-project' }).projectId)
      .toBe('override-project');
  });
});
