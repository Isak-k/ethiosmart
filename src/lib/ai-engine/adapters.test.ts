import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerateBatchRequest } from './types';
import { callGroq } from './adapters';

describe('Groq model fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to secondary model when the requested model is unavailable', async () => {
    const models: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      models.push(body.model);
      if (models.length === 1) {
        return new Response(JSON.stringify({
            error: { message: `The model '${body.model}' does not exist or you do not have access to it.` },
          }), { status: 403, statusText: 'Forbidden' });
      }
      return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                questions: [{
                  questionText: 'Which planet is closest to the Sun?',
                  questionType: 'mcq',
                  options: ['Mercury', 'Venus', 'Earth', 'Mars'],
                  correctOptionIndex: 0,
                  explanation: 'Mercury orbits closest to the Sun.',
                }],
              }),
            },
          }],
        }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const request: GenerateBatchRequest = {
      prompt: 'Generate one astronomy question',
      count: 1,
      questionTypes: ['mcq'],
      providerModels: { groq: 'nonexistent-model' },
    };

    const questions = await callGroq(request, 'test-key');

    expect(models).toEqual(['nonexistent-model', 'openai/gpt-oss-120b']);
    expect(questions).toHaveLength(1);
  });
});
