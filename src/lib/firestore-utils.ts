import { FieldValue } from 'firebase/firestore';

/**
 * Recursively removes all `undefined` values from an object or array,
 * and flattens nested arrays (arrays containing arrays directly) into `{ cells: [...] }`
 * objects because Firestore strictly rejects both:
 * 1. `undefined` fields at any depth
 * 2. Nested arrays: "Function addDoc() called with invalid data. Nested arrays are not supported"
 *
 * Preserves Dates, Firestore FieldValues (serverTimestamp, increment, deleteField),
 * and Firestore Timestamps.
 */
export function removeUndefinedFields<T>(
  obj: T,
  seen: WeakSet<object> = new WeakSet<object>(),
  depth = 0
): T {
  // Max recursion depth guard to protect call stack against circular or extremely deep structures
  if (depth > 25) {
    return undefined as unknown as T;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Check for DOM nodes, browser Events, or Window objects that can cause infinite loops
  if (
    (obj as any).nodeType !== undefined ||
    typeof (obj as any).stopPropagation === 'function' ||
    (typeof window !== 'undefined' && obj === window) ||
    (typeof globalThis !== 'undefined' && obj === (globalThis as any).window)
  ) {
    return undefined as unknown as T;
  }

  // Circular reference detection
  if (seen.has(obj as object)) {
    return undefined as unknown as T;
  }
  seen.add(obj as object);

  // Preserve Firestore Timestamps, Dates, FieldValue sentinels (serverTimestamp, increment, deleteField)
  if (
    obj instanceof Date ||
    obj instanceof FieldValue ||
    typeof (obj as any).toDate === 'function' ||
    Boolean((obj as any)._methodName)
  ) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => {
        if (Array.isArray(item)) {
          // Firestore does not support nested arrays (multidimensional arrays).
          // Wrap inner array into an object { cells: [...] } to prevent Firestore rejection.
          return { cells: removeUndefinedFields(item, seen, depth + 1) };
        }
        return removeUndefinedFields(item, seen, depth + 1);
      })
      .filter((item) => item !== undefined) as unknown as T;
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip React internal properties / circular synthetic properties
    if (key.startsWith('_react') || key.startsWith('__react')) {
      continue;
    }
    if (value !== undefined) {
      const sanitized = removeUndefinedFields(value, seen, depth + 1);
      if (sanitized !== undefined) {
        clean[key] = sanitized;
      }
    }
  }
  return clean as T;
}

/**
 * Restores Firestore-sanitized structures back to their original form in memory.
 * Specifically converts `{ cells: [...] }` inside arrays back to `[...]` for 2D table rows.
 */
export function restoreFirestoreData<T>(
  obj: T,
  seen: WeakSet<object> = new WeakSet<object>(),
  depth = 0
): T {
  if (depth > 25) {
    return obj;
  }

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (seen.has(obj as object)) {
    return obj;
  }
  seen.add(obj as object);

  if (
    obj instanceof Date ||
    obj instanceof FieldValue ||
    typeof (obj as any).toDate === 'function'
  ) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => {
      if (
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        'cells' in item &&
        Array.isArray((item as any).cells) &&
        Object.keys(item).length === 1
      ) {
        return restoreFirestoreData((item as any).cells, seen, depth + 1);
      }
      return restoreFirestoreData(item, seen, depth + 1);
    }) as unknown as T;
  }

  const restored: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    restored[key] = restoreFirestoreData(value, seen, depth + 1);
  }
  return restored as T;
}
