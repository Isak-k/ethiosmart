import { getAuth } from 'firebase/auth';
import app from '@/integrations/firebase/client';

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class BackendApiError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'BackendApiError';
    this.status = status;
    this.code = code;
  }
}

function isAuthError(status?: number, code?: string, message?: string) {
  if (status === 401) return true;
  const c = (code || '').toLowerCase();
  const m = (message || '').toLowerCase();
  return c.includes('unauthenticated') || m.includes('sign in') || m.includes('token');
}

async function getIdToken(forceRefresh = false): Promise<string> {
  const auth = getAuth(app);
  if (!auth.currentUser && typeof (auth as any).authStateReady === 'function') {
    await (auth as any).authStateReady();
  }
  const user = auth.currentUser;
  if (!user) throw new BackendApiError('Please sign in first.', 401, 'unauthenticated');
  return user.getIdToken(forceRefresh);
}

export interface BackendCallOptions {
  optionalAuth?: boolean;
}

export async function callBackend<T = any>(
  path: string,
  body?: any,
  opts: BackendCallOptions = {}
): Promise<T> {
  const doFetch = async (token?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || 'Request failed.' };
    }

    if (!res.ok) {
      throw new BackendApiError(
        data?.error || data?.message || 'Request failed.',
        res.status,
        data?.code
      );
    }
    return data as T;
  };

  let token: string | undefined;
  try {
    token = await getIdToken(false);
  } catch (err) {
    if (opts.optionalAuth && err instanceof BackendApiError && isAuthError(err.status, err.code, err.message)) {
      token = undefined;
    } else {
      throw err;
    }
  }

  try {
    return await doFetch(token);
  } catch (e: any) {
    if (e instanceof BackendApiError && isAuthError(e.status, e.code, e.message)) {
      try {
        token = await getIdToken(true);
        return await doFetch(token);
      } catch (tokenErr) {
        if (!opts.optionalAuth) throw tokenErr;
      }
    }
    throw e;
  }
}

export function isBackendPermissionDenied(error: any): boolean {
  const status = error?.status;
  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();
  return (
    status === 403 ||
    status === 404 ||
    code.includes('permission-denied') ||
    code.includes('not-found') ||
    msg.includes('not available') ||
    msg.includes('requires approved') ||
    msg.includes('lifetime access') ||
    msg.includes('allowance')
  );
}
