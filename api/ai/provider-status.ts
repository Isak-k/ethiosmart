import { getProviderStatus } from '../../src/lib/ai-engine/orchestrator.js';
import type { ProviderKeys } from '../../src/lib/ai-engine/types.js';

function loadEnvKeys(): ProviderKeys {
  // Server-side environment configuration only — no hardcoded or committed
  // fallback keys. Private keys must be set in the host's env (Vercel env vars).
  return {
    gemini: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',
    groq: process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '',
    huggingface: process.env.HUGGINGFACE_API_KEY || '',
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
