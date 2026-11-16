import { getAuth, getDb, admin } from './firebase-admin.js';
import { ApiError, err, MAIN_ADMIN_EMAIL } from './payment-shared.js';

type Handler = (
  req: any,
  res: any,
  ctx: { uid: string; profile: FirebaseFirestore.DocumentData; db: FirebaseFirestore.Firestore; token: any }
) => Promise<any>;

function isOriginAllowed(origin: string, req?: any): boolean {
  if (!origin) return true;
  const allowed = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) return true;

  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();

    // Localhost / loopback in dev and testing
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
      return true;
    }

    // Official production & preview deployments on Vercel
    if (host.endsWith('.vercel.app')) {
      return true;
    }

    // Same-origin check: compare origin with incoming Host or X-Forwarded-Host header
    const reqHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
    if (reqHost) {
      const incomingHost = String(reqHost).split(':')[0].toLowerCase();
      if (host === incomingHost) return true;
    }
  } catch {}

  return false;
}

function setCors(req: any, res: any): boolean {
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : '';
  let allowed = false;
  if (origin) {
    allowed = isOriginAllowed(origin, req);
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  } else {
    // Non-browser/same-origin requests may omit Origin.
    allowed = true;
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  return allowed;
}

function serializeTimestamps(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeTimestamps);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // Firestore Timestamp (admin/client shapes)
    const seconds =
      typeof value.seconds === 'number'
        ? value.seconds
        : typeof value._seconds === 'number'
        ? value._seconds
        : undefined;
    const nanoseconds =
      typeof value.nanoseconds === 'number'
        ? value.nanoseconds
        : typeof value._nanoseconds === 'number'
        ? value._nanoseconds
        : 0;
    if (seconds !== undefined && typeof value.toMillis === 'function') {
      return { seconds, nanoseconds };
    }
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeTimestamps(v);
    return out;
  }
  return value;
}

async function parseBody(req: any) {
  let body = req.body;
  if (body === undefined) {
    const raw = await new Promise<string>((resolve) => {
      let data = '';
      req.on('data', (c: any) => {
        data += c;
        if (data.length > 10 * 1024 * 1024) data = data.slice(0, 10 * 1024 * 1024);
      });
      req.on('end', () => resolve(data));
      req.on('error', () => resolve(''));
    });
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }
  } else if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === 'object' ? body : {};
}

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    }
  } catch {}
  return null;
}

async function requireAuth(req: any) {
  const authz = req.headers?.authorization || req.headers?.Authorization;
  const token = typeof authz === 'string' && authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!token) throw err('unauthenticated', 'Please sign in first.', 401);

  try {
    // verifyIdToken(token, false) checks signature, audience, and expiration via Google public certs
    return await getAuth().verifyIdToken(token, false);
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    console.warn('verifyIdToken via Google certs failed:', e?.code || '', e?.message || e);

    // Fallback: decode JWT for local development / offline resilience
    const payload = decodeJwtPayload(token);
    const now = Math.floor(Date.now() / 1000);
    const isLocal = process.env.NODE_ENV !== 'production';

    if (
      isLocal &&
      payload &&
      (payload.sub || payload.user_id || payload.uid) &&
      (!payload.aud || payload.aud === 'online-exam-f443c') &&
      (!payload.exp || payload.exp > now - 86400)
    ) {
      return {
        uid: payload.sub || payload.user_id || payload.uid,
        email: payload.email || '',
        name: payload.name || '',
        ...payload,
      };
    }

    throw err('unauthenticated', 'Invalid or expired authentication token.', 401);
  }
}

export function createHandler(handler: Handler, opts: { method?: string | string[]; auth?: boolean } = {}) {
  return async (req: any, res: any) => {
    const originAllowed = setCors(req, res);
    if (req.method === 'OPTIONS') {
      res.status(originAllowed ? 204 : 403).end();
      return;
    }
    if (!originAllowed) {
      res.status(403).json({ error: 'Origin not allowed.', code: 'forbidden' });
      return;
    }
    const allowedMethods = Array.isArray(opts.method)
      ? opts.method
      : [opts.method || 'POST'];
    if (!allowedMethods.includes(req.method)) {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const authRequired = opts.auth !== false;
      let decoded: any = null;
      let profile: FirebaseFirestore.DocumentData = {};

      if (authRequired) {
        decoded = await requireAuth(req);
      } else {
        // Optional auth: try decoding token if present, but never fail unauthenticated requests
        const authz = req.headers?.authorization || req.headers?.Authorization;
        if (typeof authz === 'string' && authz.startsWith('Bearer ')) {
          try {
            decoded = await requireAuth(req);
          } catch {
            // Optional auth token was invalid; continue without user context
          }
        }
      }

      let db: any = null;
      try {
        db = getDb();
      } catch (dbErr: any) {
        console.warn('getDb initialization warning:', dbErr?.message || dbErr);
      }

      if (decoded) {
        let snap: any = null;
        try {
          if (db) snap = await db.collection('users').doc(decoded.uid).get();
        } catch (dbErr: any) {
          console.warn('Firestore user fetch failed, using fallback profile:', dbErr?.message || dbErr);
        }

        if (snap && snap.exists) {
          profile = snap.data() || {};
        } else {
          const email = String(decoded.email || '').toLowerCase();
          const isMainAdmin = email === MAIN_ADMIN_EMAIL;
          profile = {
            id: decoded.uid,
            uid: decoded.uid,
            email: decoded.email || '',
            full_name: decoded.name || decoded.email?.split('@')[0] || 'User',
            fullName: decoded.name || decoded.email?.split('@')[0] || 'User',
            role: isMainAdmin ? 'admin' : (decoded.role || 'student'),
            isSuperAdmin: isMainAdmin,
            permissions: isMainAdmin ? { managePayments: true, manageSettings: true } : {},
          };
        }
      }

      req.body = await parseBody(req);
      const result = await handler(req, res, {
        uid: decoded?.uid || '',
        profile,
        db,
        token: decoded,
      });
      if (!res.headersSent) res.status(200).json(serializeTimestamps(result ?? {}));
    } catch (e: any) {
      if (e instanceof ApiError) {
        if (!res.headersSent) res.status(e.status).json({ error: e.message, code: e.code });
        return;
      }
      console.error('api handler error:', e?.message || e);
      if (!res.headersSent) {
        res.status(500).json({
          error: e?.message && process.env.NODE_ENV !== 'production' ? e.message : 'Internal server error.',
          code: 'internal',
        });
      }
    }
  };
}
