/**
 * Session Persistence Module
 * Handles persistent login across browser refreshes and app restarts
 */

import { User } from 'firebase/auth';
import { UserProfile } from '@/integrations/firebase/types';

const SESSION_STORAGE_KEY = 'exampro_session';
const SESSION_EXPIRY_KEY = 'exampro_session_expiry';
const SESSION_EXPIRY_DAYS = 30; // Session valid for 30 days

interface StoredSession {
  userId: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  profile: UserProfile | null;
  role: 'admin' | 'student' | 'superadmin' | null;
  storedAt: number;
}

/**
 * Save user session to persistent storage
 */
export function saveSession(
  user: User,
  profile: UserProfile | null,
  role: 'admin' | 'student' | 'superadmin' | null
): void {
  try {
    const session: StoredSession = {
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName,
      photoURL: user.photoURL,
      profile,
      role,
      storedAt: Date.now(),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    
    // Set expiry time (30 days from now)
    const expiryTime = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(SESSION_EXPIRY_KEY, expiryTime.toString());

    console.log('✓ Session saved to persistent storage');
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

/**
 * Retrieve stored session from persistent storage
 */
export function getStoredSession(): StoredSession | null {
  try {
    const sessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
    const expiryStr = localStorage.getItem(SESSION_EXPIRY_KEY);

    if (!sessionStr || !expiryStr) {
      return null;
    }

    // Check if session has expired
    const expiryTime = parseInt(expiryStr, 10);
    if (Date.now() > expiryTime) {
      console.log('⚠ Session expired, clearing stored session');
      clearSession();
      return null;
    }

    const session: StoredSession = JSON.parse(sessionStr);
    console.log('✓ Retrieved stored session for user:', session.email);
    return session;
  } catch (error) {
    console.error('Error retrieving session:', error);
    return null;
  }
}

/**
 * Clear stored session
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    console.log('✓ Session cleared from persistent storage');
  } catch (error) {
    console.error('Error clearing session:', error);
  }
}

/**
 * Check if a valid session exists
 */
export function hasValidSession(): boolean {
  const session = getStoredSession();
  return session !== null;
}

/**
 * Refresh session expiry time (extend session)
 */
export function refreshSessionExpiry(): void {
  try {
    const expiryTime = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(SESSION_EXPIRY_KEY, expiryTime.toString());
    console.log('✓ Session expiry refreshed');
  } catch (error) {
    console.error('Error refreshing session expiry:', error);
  }
}

/**
 * Get session expiry time in milliseconds
 */
export function getSessionExpiryTime(): number | null {
  try {
    const expiryStr = localStorage.getItem(SESSION_EXPIRY_KEY);
    return expiryStr ? parseInt(expiryStr, 10) : null;
  } catch (error) {
    console.error('Error getting session expiry time:', error);
    return null;
  }
}

/**
 * Get remaining session time in milliseconds
 */
export function getRemainingSessionTime(): number {
  const expiryTime = getSessionExpiryTime();
  if (!expiryTime) return 0;
  
  const remaining = expiryTime - Date.now();
  return remaining > 0 ? remaining : 0;
}
