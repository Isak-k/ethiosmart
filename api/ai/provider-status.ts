import { getProviderStatus } from '../../src/lib/ai-engine/orchestrator.ts';
import type { ProviderKeys } from '../../src/lib/ai-engine/types.ts';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
    const envKeys = loadEnvKeys();
    let clientKeys: any = {};
    if (req.query?.keys) {
      try {
        clientKeys = JSON.parse(req.query.keys);
      } catch {}
    }
    const keys: ProviderKeys = {
      gemini: clientKeys.gemini || envKeys.gemini,
      groq: clientKeys.groq || envKeys.groq,
      openrouter: clientKeys.openrouter || envKeys.openrouter,
      huggingface: clientKeys.huggingface || envKeys.huggingface,
    };
    const statuses = getProviderStatus(keys);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, statuses }));
  } catch (err: any) {
    console.error('Vercel API provider-status error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}
