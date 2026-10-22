import { GenerateBatchRequest, NormalizedQuestion } from '../types';
import { buildSystemPrompt, buildUserPrompt, extractJsonFromText, normalizeQuestions } from '../normalizer';

export async function callHuggingFace(
  req: GenerateBatchRequest,
  apiKey: string,
  timeoutMs: number = 40000
): Promise<NormalizedQuestion[]> {
  if (!apiKey) {
    throw new Error('HUGGING_FACE_API_KEY is not configured');
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(req);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const modelsToTry = [
    'Qwen/Qwen2.5-72B-Instruct',
    'meta-llama/Llama-3.1-8B-Instruct',
    'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B'
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      // Hugging Face unified inference router
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

      const responseBody = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = responseBody?.error?.message || responseBody?.error || `HTTP ${res.status} ${res.statusText}`;
        const err: any = new Error(`Hugging Face (${model}) failed: ${errorMsg}`);
        err.status = res.status;
        err.retryAfter = res.headers.get('Retry-After');

        if (res.status === 402) {
          // No credits / payment required
          err.code = 'quota_exceeded';
          throw err;
        }

        if (res.status === 404 || (res.status === 400 && String(errorMsg).includes('Model not supported'))) {
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
      if (err.status === 404 || (err.status === 400 && String(err.message).includes('Model not supported'))) {
        continue;
      }
      throw err;
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('All Hugging Face models failed');
}
