import { GenerateBatchRequest, NormalizedQuestion } from '../types';
import { buildSystemPrompt, buildUserPrompt, extractJsonFromText, normalizeQuestions } from '../normalizer';

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
  const decommissionedGroqModels = new Set([
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
    'gemma-7b-it',
    'llama2-70b-4096',
  ]);
  const modelsToTry = [
    ...(requestedModel && !decommissionedGroqModels.has(requestedModel) ? [requestedModel] : []),
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
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

      const responseBody = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = responseBody?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        const err: any = new Error(`Groq (${model}) failed: ${errorMsg}`);
        err.status = res.status;
        err.retryAfter = res.headers.get('Retry-After');
        
        const normalizedError = errorMsg.toLowerCase();
        const modelUnavailable =
          res.status === 404 ||
          (res.status === 400 &&
            (responseBody?.error?.code === 'model_not_found' ||
              normalizedError.includes('model') ||
              normalizedError.includes('deprecated') ||
              normalizedError.includes('decommissioned'))) ||
          (res.status === 403 &&
            normalizedError.includes('model') &&
            (normalizedError.includes('does not exist') ||
              normalizedError.includes('not found') ||
              normalizedError.includes('not available') ||
              normalizedError.includes('no access') ||
              normalizedError.includes('do not have access')));
        if (modelUnavailable) {
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
      if (err.status === 404 || (err.status === 400 && err.message?.includes('model'))) {
        continue;
      }
      clearTimeout(timeoutId);
      throw err;
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('All Groq models failed');
}
