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
export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => {
        if (Array.isArray(item)) {
          // Firestore does not support nested arrays (multidimensional arrays).
          // Wrap inner array into an object { cells: [...] } to prevent Firestore rejection.
          return { cells: removeUndefinedFields(item) };
        }
        return removeUndefinedFields(item);
      }) as unknown as T;
  }

  if (typeof obj === 'object') {
    // Preserve Firestore Timestamps, Dates, FieldValue sentinels (serverTimestamp, increment, deleteField)
    if (
      obj instanceof Date ||
      obj instanceof FieldValue ||
      typeof (obj as any).toDate === 'function' ||
      (obj as any)._methodName
    ) {
      return obj;
    }

    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = removeUndefinedFields(value);
      }
    }
    return clean as T;
  }

  return obj;
}

/**
 * Restores Firestore-sanitized structures back to their original form in memory.
 * Specifically converts `{ cells: [...] }` inside arrays back to `[...]` for 2D table rows.
 */
export function restoreFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
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
        return restoreFirestoreData((item as any).cells);
      }
      return restoreFirestoreData(item);
    }) as unknown as T;
  }

  if (typeof obj === 'object') {
    if (
      obj instanceof Date ||
      obj instanceof FieldValue ||
      typeof (obj as any).toDate === 'function'
    ) {
      return obj;
    }

    const restored: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      restored[key] = restoreFirestoreData(value);
    }
    return restored as T;
  }

  return obj;
}
