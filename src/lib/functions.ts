/**
 * Shared Cloud Functions instance for the web app.
 *
 * Local development (vite dev server, import.meta.env.DEV): the callable
 * functions talk to the local Firebase Emulator Suite (Functions on
 * 127.0.0.1:5001) by default, so the app can be tested end-to-end without
 * deploying. Set `VITE_USE_FUNCTIONS_EMULATOR=false` in a local env file to
 * opt back into the production endpoint.
 *
 * Production build (import.meta.env.PROD): always the production endpoint.
 */

import { getApp } from 'firebase/app';
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from 'firebase/functions';

let functionsInstance: Functions | null = null;

export function getFunctionsInstance(): Functions {
  if (functionsInstance) return functionsInstance;

  // NOTE: reference members statically (import.meta.env.DEV / VITE_*) so
  // Vite can statically replace them. Reading the whole `import.meta.env`
  // object does NOT work — it is left to runtime and is undefined there.
  const flag = String(import.meta.env.VITE_USE_FUNCTIONS_EMULATOR ?? '').trim().toLowerCase();
  const useEmulator = flag === 'true' || (import.meta.env.DEV && flag !== 'false');

  const instance = getFunctions(getApp());
  if (useEmulator) {
    connectFunctionsEmulator(instance, '127.0.0.1', 5001);
    if (typeof console !== 'undefined') {
      console.info('[functions] Using local Functions emulator (127.0.0.1:5001)');
    }
  }
  functionsInstance = instance;
  return instance;
}
