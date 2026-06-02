/**
 * Session Persistence v2
 * Robust 30-day session management with auto-refresh
 */

import { User } from 'firebase/auth';
import { UserProfile } from '@/integrations/firebase/types';

const SESSION_KEY = 'exampro_session_v2';
const SESSION_EXPIRY_DAYS = 30;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export interface StoredSession {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
  };
  profile: UserProfile;
  role: string;
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
}

/**
 * Get expiry timestamp (30 days from now)
 */
function getExpiryTime(): number {
  return Date.now() + SESSION_EXPIRY_MS;
}

/**
 * Check if session is still valid
 */
function isSessionValid(session: StoredSession): boolean {
  return session.expiresAt > Date.now();
}

/**
 * Save session to localStorage (30-day expiry)
 */
export function saveSession(
  user: User,
  profile: UserProfile,
  role: string
): StoredSession {
  const session: StoredSession = {
    user: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    },
    profile,
    role,
    createdAt: Date.now(),
    expiresAt: getExpiryTime(),
    lastActivityAt: Date.now(),
  };

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    console.log(`✓ Session saved, expires in ${SESSION_EXPIRY_DAYS} days`);
  } catch (error) {
    console.error('Failed to save session:', error);
  }

  return session;
}

/**
 * Get stored session from localStorage
 */
export function getStoredSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const session: StoredSession = JSON.parse(stored);

    // Check if session is still valid
    if (!isSessionValid(session)) {
      console.log('⚠ Session expired, clearing');
      clearSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to get stored session:', error);
    return null;
  }
}

/**
 * Refresh session expiry (extend session on activity)
 */
export function refreshSessionExpiry(): StoredSession | null {
  try {
    const session = getStoredSession();
    if (!session) return null;

    // Update expiry and activity time
    session.expiresAt = getExpiryTime();
    session.lastActivityAt = Date.now();

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch (error) {
    console.error('Failed to refresh session:', error);
    return null;
  }
}

/**
 * Check if session exists and is valid
 */
export function hasValidSession(): boolean {
  const session = getStoredSession();
  return session !== null && isSessionValid(session);
}

/**
 * Get session user data (if valid)
 */
export function getSessionUser(): StoredSession['user'] | null {
  const session = getStoredSession();
  return session?.user || null;
}

/**
 * Get session profile (if valid)
 */
export function getSessionProfile(): UserProfile | null {
  const session = getStoredSession();
  return session?.profile || null;
}

/**
 * Get session role (if valid)
 */
export function getSessionRole(): string | null {
  const session = getStoredSession();
  return session?.role || null;
}

/**
 * Get remaining session time (in milliseconds)
 */
export function getRemainingSessionTime(): number {
  const session = getStoredSession();
  if (!session) return 0;

  const remaining = session.expiresAt - Date.now();
  return Math.max(0, remaining);
}

/**
 * Get remaining session time (in days)
 */
export function getRemainingSessionDays(): number {
  const ms = getRemainingSessionTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Check if session is expiring soon (within 24 hours)
 */
export function isSessionExpiringsoon(): boolean {
  const remaining = getRemainingSessionTime();
  const oneDay = 24 * 60 * 60 * 1000;
  return remaining > 0 && remaining < oneDay;
}

/**
 * Clear session from localStorage
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    console.log('✓ Session cleared');
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

/**
 * Get full session info (for debugging)
 */
export function getSessionInfo(): {
  exists: boolean;
  isValid: boolean;
  user: StoredSession['user'] | null;
  role: string | null;
  expiresAt: number | null;
  remainingDays: number;
  lastActivity: number | null;
} {
  const session = getStoredSession();

  return {
    exists: !!session,
    isValid: session ? isSessionValid(session) : false,
    user: session?.user || null,
    role: session?.role || null,
    expiresAt: session?.expiresAt || null,
    remainingDays: getRemainingSessionDays(),
    lastActivity: session?.lastActivityAt || null,
  };
}

/**
 * Session listener hook - call periodically to refresh session
 * Returns true if session is still valid, false if expired or cleared
 */
export function checkAndRefreshSession(): boolean {
  if (!hasValidSession()) {
    clearSession();
    return false;
  }

  // Refresh session on activity (every 5 minutes of activity)
  const session = getStoredSession();
  if (session) {
    const timeSinceLastActivity = Date.now() - session.lastActivityAt;
    if (timeSinceLastActivity > 5 * 60 * 1000) {
      refreshSessionExpiry();
    }
  }

  return true;
}

/**
 * Get all required data to restore session
 */
export function getSessionRestoreData(): {
  user: StoredSession['user'];
  profile: UserProfile;
  role: string;
} | null {
  const session = getStoredSession();
  if (!session) return null;

  return {
    user: session.user,
    profile: session.profile,
    role: session.role,
  };
}

/**
 * Session status for UI display
 */
export function getSessionStatus(): {
  status: 'valid' | 'expiring-soon' | 'expired' | 'no-session';
  remainingDays: number;
  message: string;
} {
  if (!hasValidSession()) {
    return {
      status: 'expired',
      remainingDays: 0,
      message: 'Session expired, please login again',
    };
  }

  const remainingDays = getRemainingSessionDays();

  if (isSessionExpiringsoon()) {
    return {
      status: 'expiring-soon',
      remainingDays,
      message: `Session expiring in ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`,
    };
  }

  return {
    status: 'valid',
    remainingDays,
    message: `Session valid for ${remainingDays} more day${remainingDays !== 1 ? 's' : ''}`,
  };
}
