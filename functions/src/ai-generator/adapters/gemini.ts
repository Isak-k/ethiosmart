import { GenerateBatchRequest, NormalizedQuestion } from '../types';
import { buildSystemPrompt, buildUserPrompt, extractJsonFromText, normalizeQuestions } from '../normalizer';

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
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
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

      const responseBody = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = responseBody?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        const err: any = new Error(`Gemini (${model}) failed: ${errorMsg}`);
        err.status = res.status;
        err.retryAfter = res.headers.get('Retry-After');
        throw err;
      }

      const text = responseBody?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Gemini (${model}) returned an empty candidate content`);
      }

      const parsed = extractJsonFromText(text);
      const normalized = normalizeQuestions(parsed, 'gemini', req.batchIndex || 0);

      clearTimeout(timeoutId);
      return normalized;
    } catch (err: any) {
      lastError = err;
      // If error is 404 (model not found), continue loop to fallback model
      if (err.status === 404) {
        continue;
      }
      // If error is client cancellation/timeout, rate limit 429, or auth 401/403, throw immediately
      throw err;
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('All Gemini models failed');
}
