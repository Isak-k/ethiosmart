import { orchestrateGenerationBatch } from '../../src/lib/ai-engine/orchestrator.ts';
import type { GenerateBatchRequest, ProviderKeys } from '../../src/lib/ai-engine/types.ts';

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
      if (data.length > 2 * 1024 * 1024) {
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

const BUILTIN_KEYS: ProviderKeys = {
  gemini: 'AIzaSyBDNhU8bdkqYdPidT6TnxjInTxg7HuiB-k',
  groq: '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',
  openrouter: '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',
  huggingface: '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',
};

function loadEnvKeys(): ProviderKeys {
  return {
    gemini: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || BUILTIN_KEYS.gemini,
    groq: process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || BUILTIN_KEYS.groq,
    openrouter: process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || BUILTIN_KEYS.openrouter,
    huggingface: process.env.HUGGING_FACE_API_KEY || process.env.VITE_HUGGING_FACE_API_KEY || BUILTIN_KEYS.huggingface,
  };
}

export default async function handler(req: any, res: any) {
  // CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
    const body: GenerateBatchRequest = await parseRequestBody(req);

    if (!body || typeof body !== 'object') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Request body must be an object' }));
      return;
    }

    const count = Number(body.count);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: 'Batch count must be an integer between 1 and 50'
      }));
      return;
    }

    if (!body.prompt && !body.topic && !body.sourceMaterial) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: 'At least one of prompt, topic, or source material must be provided'
      }));
      return;
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

    res.statusCode = result.success ? 200 : 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (err: any) {
    console.error('Vercel API generate-batch error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      questions: [],
      fallbackOccurred: false,
      attempts: [],
      error: err.message || 'Internal server error in AI bridge'
    }));
  }
}
