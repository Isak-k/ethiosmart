/**
 * In-memory Cache & Performance Accelerator for ExamPro
 * Prevents redundant database requests, improves navigation speed,
 * and supports instant manual refresh.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

// Default TTL: 3 minutes for general queries
const DEFAULT_TTL_MS = 3 * 60 * 1000;

export function getCachedData<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttlMs) {
    memoryCache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setCachedData<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttlMs,
  });
}

export function invalidateCacheKey(keyPrefix: string): void {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key);
    }
  }
}

export function clearAllAppCache(): void {
  memoryCache.clear();
}

/**
 * Global manual refresh trigger.
 * Dispatches an event that all mounted dashboards, lists, and pages listen to,
 * causing them to invalidate memory caches and re-fetch fresh data from the server.
 */
export function triggerManualAppRefresh(): void {
  clearAllAppCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('exampro-manual-refresh', { detail: { timestamp: Date.now() } }));
  }
}
