/**
 * System Settings Management
 * Handles system-wide configuration for practice exams and student access control
 */

import { doc, getDoc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';

export interface SystemSettings {
  settingKey: string;
  settings: {
    // Student Access Mode: true = Require Login (enforced), false = Open Access / Hide Login (students can use without login)
    requireStudentLogin: boolean;
    // Default Department: when set, all students and guests directly open this department
    defaultDepartmentId?: string | null;
    defaultDepartmentName?: string | null;
    practiceExamsEnabled: boolean;
    defaultPassingScore: number;
    sessionDurationDays: number;
    storageQuotaMB: number;
    maxDownloads: number;
    offlineFeatureEnabled: boolean;
    analyticsTrackingEnabled: boolean;
    updatedAt: Timestamp;
    updatedBy: string;
  };
}

const SETTINGS_DOC = 'system_settings';
const DEPARTMENTS_FALLBACK_DOC = '_app_config';
const LOCAL_SETTINGS_CACHE_KEY = 'exampro_system_settings_cache';
const LOCAL_REQUIRE_LOGIN_KEY = 'exampro_system_require_login';
const LOCAL_DEFAULT_DEPT_ID_KEY = 'exampro_system_default_dept_id';
const LOCAL_DEFAULT_DEPT_NAME_KEY = 'exampro_system_default_dept_name';

export const SYSTEM_SETTINGS_CHANGED_EVENT = 'exampro_system_settings_changed';

/**
 * Get cached default department ID synchronously for cold-start
 */
export function getCachedDefaultDepartmentId(): string | null {
  try {
    if (typeof localStorage === 'undefined') return 'qzw7P8fCSFpnRGqdAgxW';
    const val = localStorage.getItem(LOCAL_DEFAULT_DEPT_ID_KEY);
    if (val === null) return 'qzw7P8fCSFpnRGqdAgxW'; // Default to Freshman
    if (val === '' || val === 'none' || val === 'null') return null;
    return val;
  } catch {
    return 'qzw7P8fCSFpnRGqdAgxW';
  }
}

/**
 * Get cached default department name synchronously for cold-start
 */
export function getCachedDefaultDepartmentName(): string | null {
  try {
    if (typeof localStorage === 'undefined') return 'Freshman';
    const val = localStorage.getItem(LOCAL_DEFAULT_DEPT_NAME_KEY);
    if (val === null) return 'Freshman';
    if (val === '' || val === 'none' || val === 'null') return null;
    return val;
  } catch {
    return 'Freshman';
  }
}

/**
 * Get cached requireStudentLogin flag synchronously for instant cold-start
 */
export function getCachedRequireStudentLogin(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    const val = localStorage.getItem(LOCAL_REQUIRE_LOGIN_KEY);
    if (val === null) return true; // Default to true (safe)
    return val === 'true';
  } catch {
    return true;
  }
}

/**
 * Save settings to localStorage cache
 */
function cacheSettingsLocally(settings: SystemSettings['settings']) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LOCAL_REQUIRE_LOGIN_KEY, String(settings.requireStudentLogin));
    if (settings.defaultDepartmentId !== undefined) {
      localStorage.setItem(LOCAL_DEFAULT_DEPT_ID_KEY, settings.defaultDepartmentId || '');
    }
    if (settings.defaultDepartmentName !== undefined) {
      localStorage.setItem(LOCAL_DEFAULT_DEPT_NAME_KEY, settings.defaultDepartmentName || '');
    }
    localStorage.setItem(
      LOCAL_SETTINGS_CACHE_KEY,
      JSON.stringify({
        ...settings,
        updatedAt: settings.updatedAt?.toMillis ? settings.updatedAt.toMillis() : Date.now(),
      })
    );
  } catch (err) {
    console.warn('Could not cache system settings to localStorage:', err);
  }
}

/**
 * Get system settings with dual Firestore document & local cache fallback
 */
export async function getSystemSettings(): Promise<SystemSettings['settings']> {
  // 1. Try settings/system_settings
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data()?.settings || docSnap.data() || {};
      const settings: SystemSettings['settings'] = {
        ...getDefaultSettings(),
        ...data,
        requireStudentLogin: data.requireStudentLogin ?? true,
      };
      cacheSettingsLocally(settings);
      return settings;
    }
  } catch (error) {
    // Expected if rules for 'settings' collection are restricted in Firebase Console
  }

  // 2. Try departments/_app_config fallback (accessible to all students & admins)
  try {
    const fallbackRef = doc(db, 'departments', DEPARTMENTS_FALLBACK_DOC);
    const fallbackSnap = await getDoc(fallbackRef);
    if (fallbackSnap.exists()) {
      const data = fallbackSnap.data()?.settings || fallbackSnap.data() || {};
      const settings: SystemSettings['settings'] = {
        ...getDefaultSettings(),
        ...data,
        requireStudentLogin: data.requireStudentLogin ?? true,
      };
      cacheSettingsLocally(settings);
      return settings;
    }
  } catch (fbError) {
    // ignore
  }

  // 3. Fallback to localStorage cache
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(LOCAL_SETTINGS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...getDefaultSettings(),
          ...parsed,
          requireStudentLogin: getCachedRequireStudentLogin(),
          defaultDepartmentId: parsed.defaultDepartmentId !== undefined ? parsed.defaultDepartmentId : getCachedDefaultDepartmentId(),
          defaultDepartmentName: parsed.defaultDepartmentName !== undefined ? parsed.defaultDepartmentName : getCachedDefaultDepartmentName(),
        };
      }
    }
  } catch {
    // ignore
  }

  return getDefaultSettings();
}

/**
 * Subscribe in real-time to system settings updates from Firestore
 */
export function subscribeToSystemSettings(
  callback: (settings: SystemSettings['settings']) => void
): () => void {
  let unsubscribed = false;
  let activeUnsub: (() => void) | null = null;

  const handleUpdate = (data: any) => {
    const fullSettings: SystemSettings['settings'] = {
      ...getDefaultSettings(),
      ...data,
      requireStudentLogin: data.requireStudentLogin ?? true,
    };
    cacheSettingsLocally(fullSettings);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(SYSTEM_SETTINGS_CHANGED_EVENT, { detail: fullSettings })
      );
    }
    callback(fullSettings);
  };

  // Try subscribing to departments/_app_config first (has public read permission)
  try {
    const fallbackRef = doc(db, 'departments', DEPARTMENTS_FALLBACK_DOC);
    activeUnsub = onSnapshot(
      fallbackRef,
      (docSnap) => {
        if (docSnap.exists()) {
          handleUpdate(docSnap.data()?.settings || docSnap.data());
        }
      },
      () => {
        // Fallback to cache without throwing permission errors
        callback(getDefaultSettings());
      }
    );
  } catch {
    callback(getDefaultSettings());
  }

  return () => {
    unsubscribed = true;
    if (activeUnsub) {
      activeUnsub();
    }
  };
}

/**
 * Update system settings in Firestore and local cache
 */
export async function updateSystemSettings(
  settings: Partial<SystemSettings['settings']>,
  userId: string
): Promise<void> {
  const current = await getSystemSettings();

  const updated: SystemSettings['settings'] = {
    requireStudentLogin:
      settings.requireStudentLogin !== undefined
        ? settings.requireStudentLogin
        : current.requireStudentLogin ?? true,
    defaultDepartmentId:
      settings.defaultDepartmentId !== undefined
        ? settings.defaultDepartmentId
        : current.defaultDepartmentId ?? 'qzw7P8fCSFpnRGqdAgxW',
    defaultDepartmentName:
      settings.defaultDepartmentName !== undefined
        ? settings.defaultDepartmentName
        : current.defaultDepartmentName ?? 'Freshman',
    practiceExamsEnabled: settings.practiceExamsEnabled ?? current.practiceExamsEnabled ?? true,
    defaultPassingScore: settings.defaultPassingScore ?? current.defaultPassingScore ?? 50,
    sessionDurationDays: settings.sessionDurationDays ?? current.sessionDurationDays ?? 30,
    storageQuotaMB: settings.storageQuotaMB ?? current.storageQuotaMB ?? 500,
    maxDownloads: settings.maxDownloads ?? current.maxDownloads ?? 10,
    offlineFeatureEnabled: settings.offlineFeatureEnabled ?? current.offlineFeatureEnabled ?? true,
    analyticsTrackingEnabled:
      settings.analyticsTrackingEnabled ?? current.analyticsTrackingEnabled ?? true,
    updatedAt: Timestamp.now(),
    updatedBy: userId || 'admin',
  };

  // 1. Immediately cache locally and dispatch event so UI never waits or fails
  cacheSettingsLocally(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(SYSTEM_SETTINGS_CHANGED_EVENT, { detail: updated })
    );
  }

  // 2. Persist to departments/_app_config (permitted in Firestore rules for admins)
  try {
    const fallbackRef = doc(db, 'departments', DEPARTMENTS_FALLBACK_DOC);
    await setDoc(fallbackRef, { settings: updated }, { merge: true });
  } catch (err: any) {
    console.warn('Could not save settings to departments fallback:', err.message);
  }

  // 3. Also try settings/system_settings
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC);
    await setDoc(docRef, { settings: updated }, { merge: true });
  } catch (err: any) {
    console.warn('Could not save settings to settings collection:', err.message);
  }
}

/**
 * Convenience method to toggle Student Login requirement directly
 */
export async function setRequireStudentLogin(
  requireLogin: boolean,
  userId: string
): Promise<void> {
  return updateSystemSettings({ requireStudentLogin: requireLogin }, userId);
}

/**
 * Convenience method to set or clear the default department globally
 */
export async function setDefaultDepartment(
  departmentId: string | null,
  departmentName: string | null,
  userId: string
): Promise<void> {
  return updateSystemSettings(
    {
      defaultDepartmentId: departmentId,
      defaultDepartmentName: departmentName,
    },
    userId
  );
}

/**
 * Get default settings
 */
export function getDefaultSettings(): SystemSettings['settings'] {
  return {
    requireStudentLogin: true, // Default: students must login unless admin explicitly disables it
    defaultDepartmentId: 'qzw7P8fCSFpnRGqdAgxW', // Freshman department by default
    defaultDepartmentName: 'Freshman',
    practiceExamsEnabled: true,
    defaultPassingScore: 50,
    sessionDurationDays: 30,
    storageQuotaMB: 500,
    maxDownloads: 10,
    offlineFeatureEnabled: true,
    analyticsTrackingEnabled: true,
    updatedAt: Timestamp.now(),
    updatedBy: 'system',
  };
}

/**
 * Check if practice exams are enabled globally
 */
export async function arePracticeExamsEnabled(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings.practiceExamsEnabled ?? true;
}

/**
 * Check if offline features are enabled
 */
export async function areOfflineFeaturesEnabled(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings.offlineFeatureEnabled ?? true;
}

/**
 * Check if student login is required
 */
export async function isStudentLoginRequired(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings.requireStudentLogin ?? true;
}
