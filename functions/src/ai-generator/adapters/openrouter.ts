import { GenerateBatchRequest, NormalizedQuestion } from '../types';
import { buildSystemPrompt, buildUserPrompt, extractJsonFromText, normalizeQuestions } from '../normalizer';

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
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'google/gemini-2.0-flash-exp:free',
    'mistralai/mistral-small-24b-instruct-2501'
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://exampro.app',
          'X-Title': 'ExamPro AI Generator'
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
        const err: any = new Error(`OpenRouter (${model}) failed: ${errorMsg}`);
        err.status = res.status;
        err.retryAfter = res.headers.get('Retry-After');

        if (res.status === 404 || (res.status === 400 && errorMsg.includes('model'))) {
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
      if (err.status === 404 || (err.status === 400 && err.message?.includes('model'))) {
        continue;
      }
      throw err;
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('All OpenRouter models failed');
}
