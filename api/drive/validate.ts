import { validateGoogleDriveFile } from '../../src/server/drive-bridge.ts';

function parseRequestBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string' && req.body.length > 0) {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch (e: any) {
      return Promise.reject(new Error(`Invalid JSON body: ${e.message}`));
    }
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e: any) {
        reject(new Error(`Invalid JSON body: ${e.message}`));
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await parseRequestBody(req);
    const fileId = body.fileId || body.url;
    if (!fileId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'File ID or URL is required' }));
      return;
    }

    const apiKey = process.env.GOOGLE_DRIVE_API_KEY || process.env.VITE_GOOGLE_DRIVE_API_KEY;
    const info = await validateGoogleDriveFile(fileId, apiKey);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    if (info.accessible) {
      res.end(JSON.stringify({ success: true, info }));
    } else {
      res.end(JSON.stringify({ success: false, error: info.error, info }));
    }
  } catch (err: any) {
    console.error('Vercel API drive validate error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: err.message || 'Validation failed' }));
  }
}
