import https from 'https';
import http from 'http';
import { URL } from 'url';

/**
 * Fetch a URL following HTTP redirects up to maxRedirects
 */
function fetchWithRedirects(
  targetUrl: string,
  options: { method?: string; headers?: Record<string, string>; maxRedirects?: number } = {}
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const maxRedirects = options.maxRedirects ?? 5;
  const method = options.method || 'GET';
  const customHeaders = options.headers || {};

  return new Promise((resolve, reject) => {
    function doRequest(currentUrl: string, redirectsRemaining: number) {
      if (redirectsRemaining < 0) {
        return reject(new Error('Too many redirects'));
      }

      const parsed = new URL(currentUrl);
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;

      const req = transport.request(
        parsed,
        {
          method,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: '*/*',
            ...customHeaders,
          },
        },
        (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
            const nextUrl = new URL(res.headers.location, currentUrl).toString();
            res.resume();
            return doRequest(nextUrl, redirectsRemaining - 1);
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 200,
              headers: res.headers,
              body: Buffer.concat(chunks),
            });
          });
        }
      );

      req.on('error', reject);
      req.end();
    }

    doRequest(targetUrl, maxRedirects);
  });
}

/**
 * Download raw binary buffer of a Google Drive file
 */
async function downloadGoogleDriveBuffer(
  fileId: string
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  // 1. Try Google Docs export first if it's a doc
  try {
    const docsExportUrl = `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/export?format=pdf`;
    const docsRes = await fetchWithRedirects(docsExportUrl);
    if (
      docsRes.statusCode === 200 &&
      docsRes.body.length > 50 &&
      docsRes.body.slice(0, 5).toString('ascii').startsWith('%PDF')
    ) {
      return {
        buffer: docsRes.body,
        contentType: 'application/pdf',
        fileName: `${fileId}.pdf`,
      };
    }
  } catch (e) {
    // Continue to standard export
  }

  // 2. Direct Google Drive uc download link
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  let res = await fetchWithRedirects(downloadUrl);

  // If Google Drive shows the "virus scan warning" confirmation page:
  if (res.statusCode === 200) {
    const textSample = res.body.slice(0, 2000).toString('utf8');
    if (textSample.includes('uc-download-link') || textSample.includes('export=download')) {
      const confirmMatch =
        textSample.match(/href="(\/uc\?export=download[^"]+)"/i) ||
        textSample.match(/action="([^"]+)"/i);
      if (confirmMatch && confirmMatch[1]) {
        const confirmUrl = confirmMatch[1].startsWith('http')
          ? confirmMatch[1]
          : `https://drive.google.com${confirmMatch[1].replace(/&amp;/g, '&')}`;
        res = await fetchWithRedirects(confirmUrl);
      }
    }
  }

  if (res.statusCode !== 200 || res.body.length === 0) {
    throw new Error('Failed to download document from Google Drive. Please verify the file is shared publicly.');
  }

  let fileName = `${fileId}.pdf`;
  const disposition = res.headers['content-disposition'] as string;
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (match && match[1]) {
      fileName = decodeURIComponent(match[1]);
    }
  }

  let contentType = (res.headers['content-type'] as string) || 'application/pdf';
  const isPdf = res.body.slice(0, 5).toString('ascii').startsWith('%PDF') || fileName.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    contentType = 'application/pdf';
  }

  return {
    buffer: res.body,
    contentType,
    fileName,
  };
}

export default async function handler(req: any, res: any) {
  // CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

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
    const parsedUrl = new URL(req.url || '', `http://${req.headers?.host || 'localhost'}`);
    const fileId = req.query?.fileId || parsedUrl.searchParams.get('fileId');

    if (!fileId || typeof fileId !== 'string') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'fileId query parameter is required' }));
      return;
    }

    const downloaded = await downloadGoogleDriveBuffer(fileId.trim());

    res.statusCode = 200;
    res.setHeader('Content-Type', downloaded.contentType);
    res.setHeader('Content-Length', downloaded.buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloaded.fileName)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.end(downloaded.buffer);
  } catch (err: any) {
    console.error('Vercel API Drive Download error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Failed to download document' }));
  }
}
