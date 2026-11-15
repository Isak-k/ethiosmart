import https from 'https';
import http from 'http';
import { URL } from 'url';

function fetchWithRedirects(
  targetUrl: string,
  options: { method?: string; headers?: Record<string, string>; maxRedirects?: number; timeoutMs?: number; maxBytes?: number } = {}
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const maxRedirects = options.maxRedirects ?? 5;
  const timeoutMs = options.timeoutMs ?? 20000;
  const maxBytes = options.maxBytes ?? 25 * 1024 * 1024;
  const method = options.method || 'GET';
  const customHeaders = options.headers || {};

  return new Promise((resolve, reject) => {
    function doRequest(currentUrl: string, redirectsRemaining: number) {
      if (redirectsRemaining < 0) return reject(new Error('Too many redirects'));
      const parsed = new URL(currentUrl);
      const host = parsed.hostname.toLowerCase();
      const allowedHost = host === 'drive.google.com' ||
        host === 'docs.google.com' ||
        host === 'drive.usercontent.google.com' ||
        host.endsWith('.googleusercontent.com') ||
        host.endsWith('.googleapis.com');
      if (parsed.protocol !== 'https:' || !allowedHost) {
        return reject(new Error('Download redirected to an untrusted host.'));
      }
      const req = https.request(parsed, {
        method,
        headers: {
          'User-Agent': 'EthioSmart secure document proxy',
          Accept: '*/*',
          ...customHeaders,
        },
      }, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && response.headers.location) {
          const nextUrl = new URL(response.headers.location, currentUrl).toString();
          response.resume();
          return doRequest(nextUrl, redirectsRemaining - 1);
        }
        const declaredLength = Number(response.headers['content-length'] || 0);
        if (declaredLength > maxBytes) {
          response.destroy();
          return reject(Object.assign(new Error('Document exceeds the 25 MB download limit.'), { statusCode: 413 }));
        }
        const chunks: Buffer[] = [];
        let receivedBytes = 0;
        response.on('data', (chunk) => {
          const buffer = Buffer.from(chunk);
          receivedBytes += buffer.length;
          if (receivedBytes > maxBytes) {
            response.destroy(Object.assign(new Error('Document exceeds the 25 MB download limit.'), { statusCode: 413 }));
            return;
          }
          chunks.push(buffer);
        });
        response.on('end', () => resolve({
          statusCode: response.statusCode || 200,
          headers: response.headers,
          body: Buffer.concat(chunks),
        }));
        response.on('error', reject);
      });
      req.setTimeout(timeoutMs, () => {
        req.destroy(Object.assign(new Error('Document download timed out.'), { statusCode: 504 }));
      });
      req.on('error', reject);
      req.end();
    }
    doRequest(targetUrl, maxRedirects);
  });
}

async function resolveAuthorizedDriveFile(bookId: string, idToken: string): Promise<string> {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'online-exam-f443c';
  const region = process.env.FIREBASE_FUNCTIONS_REGION || 'us-central1';
  const callableUrl = process.env.GET_STUDENT_BOOK_CALLABLE_URL ||
    `https://${region}-${projectId}.cloudfunctions.net/getStudentBook`;

  const response = await fetch(callableUrl, {
    signal: AbortSignal.timeout(15000),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { bookId } }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    const status = response.status === 401 || response.status === 403 ? 403 : 502;
    throw Object.assign(new Error(status === 403
      ? 'You are not authorized to access this learning resource.'
      : 'Unable to verify learning resource access.'), { statusCode: status, details });
  }

  const payload = await response.json() as any;
  const book = payload?.result?.book || payload?.data?.book;
  const fileId = typeof book?.driveFileId === 'string'
    ? book.driveFileId
    : typeof book?.driveUrl === 'string'
      ? extractDriveFileId(book.driveUrl)
      : '';

  if (!fileId || !/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) {
    throw Object.assign(new Error('This resource does not have a valid downloadable file.'), { statusCode: 404 });
  }
  return fileId;
}

function extractDriveFileId(url: string): string {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
    return pathMatch?.[1] || parsed.searchParams.get('id') || '';
  } catch {
    return '';
  }
}

async function downloadGoogleDriveBuffer(fileId: string): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  const downloadOptions = { timeoutMs: 20000, maxBytes: 25 * 1024 * 1024 };
  const docsExportUrl = `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/export?format=pdf`;
  try {
    const docsRes = await fetchWithRedirects(docsExportUrl, downloadOptions);
    if (docsRes.statusCode === 200 && docsRes.body.length > 50 &&
      docsRes.body.slice(0, 5).toString('ascii').startsWith('%PDF')) {
      return { buffer: docsRes.body, contentType: 'application/pdf', fileName: `${fileId}.pdf` };
    }
  } catch (error: any) {
    // A size-limit or timeout failure is intentional; do not retry the same
    // oversized/stalled document through the alternate Drive endpoint.
    if (Number(error?.statusCode) === 413 || Number(error?.statusCode) === 504) throw error;
    // Try the regular Drive download route below for unsupported Docs exports.
  }

  const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  let result = await fetchWithRedirects(downloadUrl, downloadOptions);
  if (result.statusCode === 200) {
    const sample = result.body.slice(0, 2000).toString('utf8');
    if (sample.includes('uc-download-link') || sample.includes('export=download')) {
      const match = sample.match(/href="(\/uc\?export=download[^"]+)"/i) ||
        sample.match(/action="([^"]+)"/i);
      if (match?.[1]) {
        const confirmUrl = match[1].startsWith('http')
          ? match[1]
          : `https://drive.google.com${match[1].replace(/&amp;/g, '&')}`;
        result = await fetchWithRedirects(confirmUrl, downloadOptions);
      }
    }
  }
  if (result.statusCode !== 200 || !result.body.length) {
    throw new Error('Unable to download the authorized document from Google Drive.');
  }
  const isPdf = result.body.slice(0, 5).toString('ascii') === '%PDF';
  if (!isPdf) throw new Error('The selected resource is not a valid PDF document.');
  return { buffer: result.body, contentType: 'application/pdf', fileName: `${fileId}.pdf` };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const parsedUrl = new URL(req.url || '', `https://${req.headers?.host || 'localhost'}`);
    const bookId = String(req.query?.bookId || parsedUrl.searchParams.get('bookId') || '').trim();
    const authorization = String(req.headers?.authorization || '');
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

    if (!bookId || bookId.length > 150) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'A valid bookId is required.' }));
      return;
    }
    if (!tokenMatch) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Authentication is required.' }));
      return;
    }

    const fileId = await resolveAuthorizedDriveFile(bookId, tokenMatch[1]);
    const downloaded = await downloadGoogleDriveBuffer(fileId);
    res.statusCode = 200;
    res.setHeader('Content-Type', downloaded.contentType);
    res.setHeader('Content-Length', downloaded.buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloaded.fileName)}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(downloaded.buffer);
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || 502;
    console.error('Secure document proxy error:', error?.message || error);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: statusCode === 403 ? error.message : 'Unable to retrieve this document.' }));
  }
}
