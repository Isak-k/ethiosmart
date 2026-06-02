/**
 * Offline State Service
 * Manages offline mode state, online/offline status, session, and cached data
 */

import { UserProfile, Exam } from '@/integrations/firebase/types';

const OFFLINE_STATE_KEY = 'exampro_offline_state';
const ONLINE_STATUS_KEY = 'exampro_online_status';
const DOWNLOADED_EXAMS_KEY = 'exampro_downloaded_exams';

export interface OfflineState {
  isOnline: boolean;
  isOfflineMode: boolean;           // User explicitly using offline features
  hasValidSession: boolean;
  sessionUser?: UserProfile;
  lastSyncTime: number;
  lastOnlineTime: number;
  availableExams: Exam[];           // Cached exams from Firebase
  downloadedExamIds: string[];
  downloadedAt: number;
}

export interface OnlineStatus {
  lastChecked: number;
  isOnline: boolean;
  failedAttempts: number;
}

/**
 * Initialize offline state (called on app startup)
 */
export function initOfflineState(): OfflineState {
  const defaultState: OfflineState = {
    isOnline: navigator.onLine,
    isOfflineMode: false,
    hasValidSession: false,
    lastSyncTime: Date.now(),
    lastOnlineTime: navigator.onLine ? Date.now() : 0,
    availableExams: [],
    downloadedExamIds: [],
    downloadedAt: 0,
  };

  try {
    const stored = localStorage.getItem(OFFLINE_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...defaultState,
        ...parsed,
        isOnline: navigator.onLine, // Always refresh current online status
      };
    }
  } catch (error) {
    console.warn('Failed to restore offline state:', error);
  }

  return defaultState;
}

/**
 * Update offline state in localStorage
 */
export function updateOfflineState(updates: Partial<OfflineState>): OfflineState {
  const current = getOfflineState();
  const updated = { ...current, ...updates };

  try {
    localStorage.setItem(OFFLINE_STATE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save offline state:', error);
  }

  return updated;
}

/**
 * Get current offline state
 */
export function getOfflineState(): OfflineState {
  try {
    const stored = localStorage.getItem(OFFLINE_STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to get offline state:', error);
  }

  return initOfflineState();
}

/**
 * Check if user has valid session for offline mode
 */
export function hasValidOfflineSession(): boolean {
  const state = getOfflineState();
  return state.hasValidSession && !!state.sessionUser;
}

/**
 * Get offline user session
 */
export function getOfflineSession(): UserProfile | undefined {
  const state = getOfflineState();
  return state.sessionUser;
}

/**
 * Set online/offline status
 */
export function setOnlineStatus(isOnline: boolean): void {
  const state = getOfflineState();
  const updated: OfflineState = {
    ...state,
    isOnline,
    lastOnlineTime: isOnline ? Date.now() : state.lastOnlineTime,
  };

  // If going online, enable offline mode if needed
  if (isOnline && !state.isOnline) {
    console.log('✓ Back online');
  } else if (!isOnline && state.isOnline) {
    console.log('⚠ Going offline');
    updated.isOfflineMode = true; // Auto-enable offline mode
  }

  updateOfflineState(updated);
}

/**
 * Explicitly enable offline mode
 */
export function enableOfflineMode(): void {
  updateOfflineState({
    isOfflineMode: true,
  });
}

/**
 * Disable offline mode
 */
export function disableOfflineMode(): void {
  updateOfflineState({
    isOfflineMode: false,
  });
}

/**
 * Update available exams cache
 */
export function cacheAvailableExams(exams: Exam[]): void {
  updateOfflineState({
    availableExams: exams,
    lastSyncTime: Date.now(),
  });
}

/**
 * Get cached available exams
 */
export function getCachedAvailableExams(): Exam[] {
  const state = getOfflineState();
  return state.availableExams || [];
}

/**
 * Track downloaded exam
 */
export function trackDownloadedExam(examId: string): void {
  const state = getOfflineState();
  const ids = new Set(state.downloadedExamIds || []);
  ids.add(examId);

  updateOfflineState({
    downloadedExamIds: Array.from(ids),
    downloadedAt: Date.now(),
  });
}

/**
 * Untrack downloaded exam (when deleted)
 */
export function untrackDownloadedExam(examId: string): void {
  const state = getOfflineState();
  const ids = new Set(state.downloadedExamIds || []);
  ids.delete(examId);

  updateOfflineState({
    downloadedExamIds: Array.from(ids),
  });
}

/**
 * Get downloaded exam IDs
 */
export function getDownloadedExamIds(): string[] {
  const state = getOfflineState();
  return state.downloadedExamIds || [];
}

/**
 * Check if exam is downloaded
 */
export function isExamDownloaded(examId: string): boolean {
  return getDownloadedExamIds().includes(examId);
}

/**
 * Update user session for offline access
 */
export function setOfflineSession(user: UserProfile): void {
  updateOfflineState({
    sessionUser: user,
    hasValidSession: true,
    lastSyncTime: Date.now(),
  });
}

/**
 * Clear offline session
 */
export function clearOfflineSession(): void {
  updateOfflineState({
    sessionUser: undefined,
    hasValidSession: false,
  });
}

/**
 * Get offline mode status info
 */
export function getOfflineModeInfo() {
  const state = getOfflineState();
  return {
    isOnline: state.isOnline,
    isOfflineMode: state.isOfflineMode,
    hasSession: state.hasValidSession,
    downloadedCount: state.downloadedExamIds?.length || 0,
    lastSyncTime: state.lastSyncTime,
  };
}

/**
 * Setup online/offline listeners
 */
export function setupOnlineOfflineListeners(
  onOnline?: () => void,
  onOffline?: () => void
): () => void {
  const handleOnline = () => {
    setOnlineStatus(true);
    onOnline?.();
  };

  const handleOffline = () => {
    setOnlineStatus(false);
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Clear all offline state (for logout)
 */
export function clearAllOfflineState(): void {
  localStorage.removeItem(OFFLINE_STATE_KEY);
}
