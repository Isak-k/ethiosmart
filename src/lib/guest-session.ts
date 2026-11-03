/**
 * Guest Student Session Management
 * Stores and retrieves guest student name, department, and device identity
 */
import { getCachedDefaultDepartmentId, getCachedDefaultDepartmentName } from '@/lib/system-settings';

export interface GuestProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: 'student';
  departmentId: string;
  departmentName?: string;
  avatar_url: string | null;
  isGuest: true;
  createdAt: number;
}

export const GUEST_PROFILE_STORAGE_KEY = 'exampro_guest_profile';
export const GUEST_PROFILE_CHANGED_EVENT = 'exampro_guest_profile_changed';
export const GUEST_AUTH_EMAIL = 'guest.exampro@gmail.com';
export const GUEST_AUTH_PASSWORD = 'GuestStudent2026!';

/**
 * Generate a consistent, random device ID for guests
 */
function generateGuestDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `guest_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Retrieve stored guest profile from localStorage
 */
export function getStoredGuestProfile(): GuestProfile | null {
  try {
    const defaultDeptId = getCachedDefaultDepartmentId() || 'qzw7P8fCSFpnRGqdAgxW';
    const defaultDeptName = getCachedDefaultDepartmentName() || 'Freshman';

    if (typeof localStorage === 'undefined') {
      const guestId = generateGuestDeviceId();
      return {
        id: guestId,
        user_id: guestId,
        full_name: 'Guest Student',
        email: 'guest@exampro.local',
        role: 'student',
        departmentId: defaultDeptId,
        departmentName: defaultDeptName,
        avatar_url: null,
        isGuest: true,
        createdAt: Date.now(),
      };
    }

    const raw = localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
    if (!raw) {
      // Auto-initialize default guest profile so guest never has to input name or department
      const guestId = generateGuestDeviceId();
      const initialProfile: GuestProfile = {
        id: guestId,
        user_id: guestId,
        full_name: 'Guest Student',
        email: 'guest@exampro.local',
        role: 'student',
        departmentId: defaultDeptId,
        departmentName: defaultDeptName,
        avatar_url: null,
        isGuest: true,
        createdAt: Date.now(),
      };
      try {
        localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(initialProfile));
      } catch {}
      return initialProfile;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      id: parsed.id || generateGuestDeviceId(),
      user_id: parsed.id || generateGuestDeviceId(),
      full_name: parsed.full_name?.trim() || 'Guest Student',
      email: parsed.email || 'guest@exampro.local',
      role: 'student',
      departmentId: parsed.departmentId || defaultDeptId,
      departmentName: parsed.departmentName || defaultDeptName,
      avatar_url: null,
      isGuest: true,
      createdAt: parsed.createdAt || Date.now(),
    };
  } catch (e) {
    console.warn('Error reading stored guest profile:', e);
    return null;
  }
}

/**
 * Save or update guest profile in localStorage
 */
export function saveGuestProfile(
  data: { full_name?: string; departmentId: string; departmentName?: string; id?: string }
): GuestProfile {
  const existing = getStoredGuestProfile();
  const guestId = data.id || existing?.id || generateGuestDeviceId();
  const defaultDeptId = getCachedDefaultDepartmentId() || 'qzw7P8fCSFpnRGqdAgxW';
  const defaultDeptName = getCachedDefaultDepartmentName() || 'Freshman';

  const profile: GuestProfile = {
    id: guestId,
    user_id: guestId,
    full_name: data.full_name?.trim() || existing?.full_name?.trim() || 'Guest Student',
    email: 'guest@exampro.local',
    role: 'student',
    departmentId: data.departmentId || defaultDeptId,
    departmentName: data.departmentName || defaultDeptName,
    avatar_url: null,
    isGuest: true,
    createdAt: existing?.createdAt || Date.now(),
  };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    }
  } catch (err) {
    console.warn('Error saving guest profile:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(GUEST_PROFILE_CHANGED_EVENT, { detail: profile })
    );
  }

  return profile;
}

/**
 * Check if the guest student profile is complete
 * With default department active or set, guests NEVER need to input their name.
 */
export function isGuestProfileComplete(profile: GuestProfile | null): boolean {
  const defaultDept = getCachedDefaultDepartmentId();
  if (defaultDept) return true;
  if (!profile) return false;
  return Boolean(profile.departmentId && profile.departmentId.trim().length > 0);
}

/**
 * Clear guest profile from device
 */
export function clearGuestProfile(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(GUEST_PROFILE_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Error clearing guest profile:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(GUEST_PROFILE_CHANGED_EVENT, { detail: null })
    );
  }
}
