import type { Plugin, ViteDevServer } from 'vite';
import { IncomingMessage, ServerResponse } from 'http';
import { orchestrateGenerationBatch, getProviderStatus } from '../lib/ai-engine/orchestrator.ts';
import type { GenerateBatchRequest, ProviderKeys } from '../lib/ai-engine/types.ts';
import { validateGoogleDriveFile, extractGoogleDriveContent, downloadGoogleDriveBuffer } from './drive-bridge';
import { handleChatbotAsk, resolveIpKey } from './chatbot';
import { loadServerEnv } from './env';

loadServerEnv();

function loadEnvKeys(): ProviderKeys {
  // Shell env wins, then .env.local, then .env (via loadServerEnv()).
  return {
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    huggingface: process.env.HUGGINGFACE_API_KEY,
  };
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      // Protect against oversized requests (limit 1MB)
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

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function createAiBridgeMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url?.split('?')[0];

    // Dev-server hardening: never serve dotfiles (e.g. .env, .secret.local)
    // or plain-text logs over HTTP — EXCEPT Vite's own internals under
    // /node_modules/ (its optimized dependency cache lives under
    // /node_modules/.vite/deps and the app cannot start without those
    // files). Vite's internal file serving is required for the app to run;
    // repo secrets never live inside /node_modules/ in a committed checkout.
    const pathname = url || '';
    const isViteInternal = pathname.startsWith('/node_modules/');
    if (
      !isViteInternal &&
      (/(?:^|\/)\.[^/]+(?:\/|$)/.test(pathname) || /\.log$/i.test(pathname))
    ) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      res.end('403 Restricted');
      return;
    }

    // Homepage promotional chatbot (same logic as the Firebase callable)
    if (url === '/api/chatbot/ask') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
      let body: any;
      try {
        body = await parseJsonBody(req);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
      try {
        const forwarded = req.headers['x-forwarded-for'];
        const result = await handleChatbotAsk({
          message: body?.message,
          history: body?.history,
          ipKey: resolveIpKey(
            typeof forwarded === 'string' || Array.isArray(forwarded) ? forwarded : undefined,
            typeof req.headers['x-vercel-forwarded-for'] === 'string'
              ? req.headers['x-vercel-forwarded-for']
              : undefined,
            typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : undefined,
          ),
        });
        if (result.ok === true) {
          sendJson(res, 200, { answer: result.answer, links: result.links });
        } else {
          sendJson(res, result.status, { error: result.error });
        }
      } catch (err: any) {
        console.error('[AI Dev Bridge] Chatbot error:', err);
        sendJson(res, 503, {
          error:
            'The EthioSmart AI Assistant is temporarily unavailable. Please try again in a moment — or sign up and explore the app!',
        });
      }
      return;
    }

    // Status endpoint
    if (url === '/api/ai/provider-status' && req.method === 'GET') {
      try {
        const envKeys = loadEnvKeys();
        let clientKeys: any = {};
        const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const queryKeys = parsedUrl.searchParams.get('keys');
        if (queryKeys) {
          try { clientKeys = JSON.parse(queryKeys); } catch {}
        }
        const keys: ProviderKeys = {
          gemini: clientKeys.gemini || envKeys.gemini,
          groq: clientKeys.groq || envKeys.groq,
          openrouter: clientKeys.openrouter || envKeys.openrouter,
          huggingface: clientKeys.huggingface || envKeys.huggingface,
        };
        const statuses = getProviderStatus(keys);
        sendJson(res, 200, { success: true, statuses });
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // Generate batch endpoint
    if (url === '/api/ai/generate-batch' && req.method === 'POST') {
      try {
        const body: GenerateBatchRequest = await parseJsonBody(req);

        // Validation
        if (!body || typeof body !== 'object') {
          return sendJson(res, 400, { success: false, error: 'Request body must be an object' });
        }

        const count = Number(body.count);
        if (!Number.isInteger(count) || count < 1 || count > 50) {
          return sendJson(res, 400, {
            success: false,
            error: 'Batch count must be an integer between 1 and 50'
          });
        }

        if (!body.prompt && !body.topic && !body.sourceMaterial) {
          return sendJson(res, 400, {
            success: false,
            error: 'At least one of prompt, topic, or source material must be provided'
          });
        }

        const envKeys = loadEnvKeys();
        const clientKeys = (body as any).providerKeys || {};
        const keys: ProviderKeys = {
          gemini: clientKeys.gemini || envKeys.gemini,
          groq: clientKeys.groq || envKeys.groq,
          openrouter: clientKeys.openrouter || envKeys.openrouter,
          huggingface: clientKeys.huggingface || envKeys.huggingface,
        };
        const result = await orchestrateGenerationBatch(body, keys);

        if (result.success) {
          sendJson(res, 200, result);
        } else {
          sendJson(res, 502, result);
        }
      } catch (err: any) {
        console.error('[AI Dev Bridge] Error handling batch generation:', err);
        sendJson(res, 500, {
          success: false,
          questions: [],
          fallbackOccurred: false,
          attempts: [],
          error: err.message || 'Internal server error in AI bridge'
        });
      }
      return;
    }

    // Google Drive validation endpoint
    if (url === '/api/drive/validate' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const fileId = body.fileId || body.url;
        if (!fileId) {
          return sendJson(res, 400, { success: false, error: 'File ID or URL is required' });
        }

        const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
        const info = await validateGoogleDriveFile(fileId, apiKey);

        if (info.accessible) {
          sendJson(res, 200, { success: true, info });
        } else {
          sendJson(res, 200, { success: false, error: info.error, info });
        }
      } catch (err: any) {
        console.error('[Drive Bridge] Validation error:', err);
        sendJson(res, 500, { success: false, error: err.message || 'Validation failed' });
      }
      return;
    }

    // Google Drive content extraction endpoint for AI generation
    if (url === '/api/drive/extract-content' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const fileId = body.fileId;
        if (!fileId) {
          return sendJson(res, 400, { success: false, error: 'Google Drive file ID is required' });
        }

        const extracted = await extractGoogleDriveContent(fileId, {
          pageRange: body.pageRange,
          chapter: body.chapter,
        });

        sendJson(res, 200, { success: true, ...extracted });
      } catch (err: any) {
        console.error('[Drive Bridge] Content extraction error:', err);
        sendJson(res, 500, { success: false, error: err.message || 'Failed to extract document content' });
      }
      return;
    }

    // Google Drive file binary download endpoint for in-app offline caching
    if (url?.startsWith('/api/drive/download') && req.method === 'GET') {
      try {
        const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const fileId = parsedUrl.searchParams.get('fileId');
        if (!fileId) {
          return sendJson(res, 400, { success: false, error: 'File ID is required' });
        }

        const downloaded = await downloadGoogleDriveBuffer(fileId);
        res.writeHead(200, {
          'Content-Type': downloaded.contentType,
          'Content-Length': downloaded.buffer.length,
          'Content-Disposition': `inline; filename="${encodeURIComponent(downloaded.fileName)}"`,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400',
        });
        res.end(downloaded.buffer);
      } catch (err: any) {
        console.error('[Drive Bridge] Download proxy error:', err);
        sendJson(res, 500, { success: false, error: err.message || 'Failed to download document' });
      }
      return;
    }

    next();
  };
}

export function aiDevPlugin(): Plugin {
  const middleware = createAiBridgeMiddleware();
  return {
    name: 'exampro-ai-dev-bridge',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(middleware);
    }
  };
}
