import type { GenerateBatchRequest, NormalizedQuestion } from './types.ts';
import { buildSystemPrompt, buildUserPrompt, extractJsonFromText, normalizeQuestions } from './normalizer.ts';

// -------------------------------------------------------------
// Google Gemini Adapter
// -------------------------------------------------------------
export async function callGemini(
  req: GenerateBatchRequest,
  apiKey: string,
  timeoutMs: number = 35000
): Promise<NormalizedQuestion[]> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(req);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestedModel = req.providerModels?.gemini;
  const modelsToTry = [
    ...(requestedModel ? [requestedModel] : []),
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-2.5-flash',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: fullPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      });

      const responseBody: any = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = responseBody?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        const err: any = new Error(`Gemini (${model}) failed: ${errorMsg}`);
        err.status = res.status;
        err.retryAfter = res.headers.get('Retry-After');

        const isModelOrQuotaError =
          res.status === 404 ||
          res.status === 429 ||
          res.status === 503 ||
          res.status === 500 ||
          (res.status === 400 && (errorMsg.includes('not found') || errorMsg.includes('deprecated') || errorMsg.includes('not supported'))) ||
          (res.status === 403 && (errorMsg.includes('access') || errorMsg.includes('permission') || errorMsg.includes('model') || errorMsg.includes('quota')));

        if (isModelOrQuotaError) {
          console.warn(`[Gemini Adapter] Model '${model}' failed (HTTP ${res.status}: ${errorMsg}). Trying fallback model...`);
          lastError = err;
          continue;
        }

        throw err;
      }

      const text = responseBody?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Gemini (${model}) returned an empty completion`);
      }

      const parsed = extractJsonFromText(text);
      const normalized = normalizeQuestions(parsed, 'gemini', req.batchIndex || 0);

      clearTimeout(timeoutId);
      return normalized;
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        throw err;
      }
      if (err.status === 401 || (err.status === 403 && String(err.message).toLowerCase().includes('key'))) {
        throw err;
      }
      continue;
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('All Gemini models failed');
}

// -------------------------------------------------------------
// Groq Adapter
// -------------------------------------------------------------
export async function callGroq(
  req: GenerateBatchRequest,
  apiKey: string,
  timeoutMs: number = 35000
): Promise<NormalizedQuestion[]> {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(req);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestedModel = req.providerModels?.groq;
  const modelsToTry = [
    ...(requestedModel ? [requestedModel] : []),
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b'
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      const responseBody: any = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = responseBody?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        const err: any = new Error(`Groq (${model}) failed: ${errorMsg}`);
        err.status = res.status;
        err.retryAfter = res.headers.get('Retry-After');

        const isModelOrQuotaError =
          res.status === 404 ||
          res.status === 429 ||
          res.status === 503 ||
          (res.status === 400 && (responseBody?.error?.code === 'model_not_found' || errorMsg.includes('model') || errorMsg.includes('deprecated'))) ||
          (res.status === 403 && (errorMsg.includes('access') || errorMsg.includes('permission') || errorMsg.includes('model')));

        if (isModelOrQuotaError) {
          console.warn(`[Groq Adapter] Model '${model}' failed (HTTP ${res.status}: ${errorMsg}). Trying fallback model...`);
          lastError = err;
          continue;
        }

        throw err;
      }

      const text = responseBody?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error(`Groq (${model}) returned an empty completion`);
      }

      const parsed = extractJsonFromText(text);
      const normalized = normalizeQuestions(parsed, 'groq', req.batchIndex || 0);

      clearTimeout(timeoutId);
      return normalized;
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        throw err;
      }
      if (err.status === 401 || (err.status === 403 && String(err.message).toLowerCase().includes('key'))) {
        throw err;
      }
      continue;
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('All Groq models failed');
}

// -------------------------------------------------------------
// OpenRouter Adapter
// -------------------------------------------------------------
export async function callOpenRouter(
  req: GenerateBatchRequest,
  apiKey: string,
  timeoutMs: number = 40000
): Promise<NormalizedQuestion[]> {
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(req);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestedModel = req.providerModels?.openrouter;
  const modelsToTry = [
    ...(requestedModel ? [requestedModel] : []),
    'meta-llama/llama-3.3-70b-instruct',
    'google/gemini-2.0-flash-exp:free',
    'mistralai/mistral-small-24b-instruct-2501',
    'deepseek/deepseek-chat'
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ethiosmart.app',
          'X-Title': 'EthioSmart AI Generator'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      const responseBody: any = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = responseBody?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        const err: any = new Error(`OpenRouter (${model}) failed: ${errorMsg}`);
        err.status = res.status;
        err.retryAfter = res.headers.get('Retry-After');

        const isModelOrQuotaError =
          res.status === 404 ||
          res.status === 429 ||
          res.status === 503 ||
          (res.status === 400 && (errorMsg.includes('model') || errorMsg.includes('not supported') || errorMsg.includes('deprecated'))) ||
          (res.status === 403 && (errorMsg.includes('access') || errorMsg.includes('permission') || errorMsg.includes('model') || errorMsg.includes('quota')));

        if (isModelOrQuotaError) {
          console.warn(`[OpenRouter Adapter] Model '${model}' failed (HTTP ${res.status}: ${errorMsg}). Trying fallback model...`);
          lastError = err;
          continue;
        }

        throw err;
      }

      const text = responseBody?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error(`OpenRouter (${model}) returned an empty completion`);
      }

      const parsed = extractJsonFromText(text);
      const normalized = normalizeQuestions(parsed, 'openrouter', req.batchIndex || 0);

      clearTimeout(timeoutId);
      return normalized;
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        throw err;
      }
      if (err.status === 401 || (err.status === 403 && String(err.message).toLowerCase().includes('key'))) {
        throw err;
      }
      continue;
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('All OpenRouter models failed');
}

// -------------------------------------------------------------
// Hugging Face Adapter
// -------------------------------------------------------------
export async function callHuggingFace(
  req: GenerateBatchRequest,
  apiKey: string,
  timeoutMs: number = 40000
): Promise<NormalizedQuestion[]> {
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is not configured');
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(req);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestedModel = req.providerModels?.huggingface;
  const modelsToTry = [
    ...(requestedModel ? [requestedModel] : []),
    'Qwen/Qwen2.5-72B-Instruct',
    'meta-llama/Llama-3.1-8B-Instruct',
    'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B'
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 4096
        }),
        signal: controller.signal
      });

      const responseBody: any = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = responseBody?.error?.message || responseBody?.error || `HTTP ${res.status} ${res.statusText}`;
        const err: any = new Error(`Hugging Face (${model}) failed: ${errorMsg}`);
        err.status = res.status;
        err.retryAfter = res.headers.get('Retry-After');

        if (res.status === 402) {
          err.code = 'quota_exceeded';
          throw err;
        }

        const isModelOrQuotaError =
          res.status === 404 ||
          res.status === 429 ||
          res.status === 503 ||
          (res.status === 400 && String(errorMsg).includes('Model not supported')) ||
          (res.status === 403 && (String(errorMsg).includes('access') || String(errorMsg).includes('permission') || String(errorMsg).includes('model') || String(errorMsg).includes('quota')));

        if (isModelOrQuotaError) {
          console.warn(`[Hugging Face Adapter] Model '${model}' failed (HTTP ${res.status}: ${errorMsg}). Trying fallback model...`);
          lastError = err;
          continue;
        }

        throw err;
      }

      const text = responseBody?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error(`Hugging Face (${model}) returned an empty completion`);
      }

      const parsed = extractJsonFromText(text);
      const normalized = normalizeQuestions(parsed, 'huggingface', req.batchIndex || 0);

      clearTimeout(timeoutId);
      return normalized;
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        throw err;
      }
      if (err.status === 402 || err.code === 'quota_exceeded') {
        throw err;
      }
      if (err.status === 401 || (err.status === 403 && String(err.message).toLowerCase().includes('key'))) {
        throw err;
      }
      continue;
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('All Hugging Face models failed');
}
