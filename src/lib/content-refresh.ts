/**
 * Content Freshness / Versioning
 * --------------------------------
 * The app renders fast from on-device content snapshots (see device-storage.ts).
 * That is great for speed, but it means users could briefly see *outdated*
 * content right after a new release. This module runs once on every launch,
 * compares the running build version with the last one this device saw, and —
 * when they differ — invalidates the stale content caches so only the most
 * recently updated data is shown.
 */

import { clearAllAppCache, triggerManualAppRefresh } from '@/lib/app-cache';
import { clearDeviceContentCaches } from '@/lib/device-storage';

/** Version of the currently running build, injected by Vite at build time. */
export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

/** Where we remember which build version last populated this device's caches. */
const CONTENT_VERSION_KEY = 'exampro_content_version';

function safeGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // ignore (private mode / quota)
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Compare the current build version with the one cached on this device and
 * invalidate stale content caches when they differ (i.e. on a first launch or
 * right after an update).
 *
 * @returns `true` when a cache reset happened (fresh data should be fetched).
 */
export async function ensureFreshContent(): Promise<boolean> {
  const storedVersion = safeGet(CONTENT_VERSION_KEY);

  // Same build — device caches are from this exact version, keep them for speed.
  if (storedVersion === APP_VERSION) {
    return false;
  }

  // New/updated build (or first ever launch): drop anything that could be stale.
  clearAllAppCache();
  try {
    // Never block the app if IndexedDB is slow/unavailable.
    await withTimeout(clearDeviceContentCaches(), 2000);
  } catch {
    // ignore
  }

  safeSet(CONTENT_VERSION_KEY, APP_VERSION);
  return true;
}

export { triggerManualAppRefresh };
