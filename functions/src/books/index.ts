import * as functions from 'firebase-functions';
import https from 'https';
import http from 'http';
import { URL } from 'url';

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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
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
 * Cloud Function to validate a Google Drive resource and extract metadata
 */
export const validateGoogleDriveResource = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const fileId = req.body?.fileId || req.query?.fileId;
    if (!fileId || typeof fileId !== 'string') {
      res.status(400).json({ success: false, error: 'Google Drive file ID is required' });
      return;
    }

    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const previewUrl = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
    const webViewLink = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;

    if (apiKey) {
      const apiUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,capabilities,webViewLink&key=${apiKey.trim()}`;
      const { statusCode, body } = await fetchWithRedirects(apiUrl);
      if (statusCode === 200) {
        const json = JSON.parse(body.toString('utf8'));
        res.status(200).json({
          success: true,
          info: {
            accessible: true,
            fileId: json.id || fileId,
            fileName: json.name || 'Google Drive Document',
            mimeType: json.mimeType || 'application/pdf',
            fileSizeBytes: json.size ? Number(json.size) : undefined,
            webViewLink: json.webViewLink || webViewLink,
            previewUrl,
            downloadUrl,
            canDownload: json.capabilities?.canDownload ?? true,
          },
        });
        return;
      }
    }

    const viewUrl = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
    const checkRes = await fetchWithRedirects(viewUrl);
    const bodyStr = checkRes.body.toString('utf8');

    if (bodyStr.includes('ServiceLogin') || checkRes.statusCode === 403) {
      res.status(200).json({
        success: false,
        error: 'The Google Drive document is private or requires sign-in. Please update sharing settings to "Anyone with the link can view".',
      });
      return;
    }

    let fileName = `Drive Document (${fileId.slice(0, 8)}...)`;
    const titleMatch = bodyStr.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
    if (titleMatch && titleMatch[1]) {
      fileName = titleMatch[1].replace(/ - Google Drive$/, '').trim();
    }

    res.status(200).json({
      success: true,
      info: {
        accessible: true,
        fileId,
        fileName,
        mimeType: 'application/pdf',
        previewUrl,
        downloadUrl,
        webViewLink,
        canDownload: true,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Validation error' });
  }
});
