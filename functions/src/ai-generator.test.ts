import {
  buildUserPrompt,
  extractJsonFromText,
  normalizeQuestions,
  validateGeneratedQuestionBatch
} from './ai-generator/normalizer';
import {
  orchestrateGenerationBatch,
  setProviderCooldown,
  getProviderCooldown
} from './ai-generator/orchestrator';
import { callGroq } from './ai-generator/adapters/groq';
import { GenerateBatchRequest } from './ai-generator/types';

describe('AI Generator - Normalizer & Prompts', () => {
  it('buildUserPrompt builds prompt with required language and question count', () => {
    const req: GenerateBatchRequest = {
      prompt: 'Focus on cell biology',
      count: 5,
      questionTypes: ['mcq', 'truefalse'],
      difficulty: 'Hard',
      language: 'English',
      topic: 'Cell Division'
    };

    const prompt = buildUserPrompt(req);
    expect(prompt).toContain('Generate exactly 5 exam question(s)');
    expect(prompt).toContain('Focus Topic/Chapter: "Cell Division"');
    expect(prompt).toContain('Difficulty level: Hard');
    expect(prompt).toContain('Allowed Question Types: mcq, truefalse');
  });

  it('buildUserPrompt correctly formats non-English language request', () => {
    const req: GenerateBatchRequest = {
      prompt: 'Afaan Oromoo questions',
      count: 3,
      questionTypes: ['mcq'],
      language: 'Afaan Oromoo'
    };

    const prompt = buildUserPrompt(req);
    expect(prompt).toContain('Afaan Oromoo');
  });

  it('extractJsonFromText strips markdown code fences and returns parsed object', () => {
    const raw = '```json\n{\n  "questions": [\n    {"questionText": "What is 2+2?", "questionType": "mcq"}\n  ]\n}\n```';
    const parsed = extractJsonFromText(raw);
    expect(parsed).toBeDefined();
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].questionText).toBe('What is 2+2?');
  });

  it('normalizes valid MCQs without inventing answer options', () => {
    const rawData = {
      questions: [
        {
          questionText: 'What is the capital of France?',
          questionType: 'mcq',
          options: ['Paris', 'London', 'Rome', 'Berlin'],
          correctOptionIndex: 0,
          explanation: 'Paris is the capital of France.',
          difficulty: 'Easy'
        }
      ]
    };

    const normalized = normalizeQuestions(rawData, 'gemini', 0);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].questionText).toBe('What is the capital of France?');
    expect(normalized[0].questionType).toBe('mcq');
    expect(normalized[0].options).toHaveLength(4); // padded to 4
    expect(normalized[0].correctOptionIndex).toBe(0);
    expect(normalized[0].difficulty).toBe('Easy');
    expect(normalized[0].providerUsed).toBe('gemini');
  });

  it('rejects malformed or incomplete questions instead of silently normalizing them', () => {
    expect(() => normalizeQuestions({
      questions: [{
        questionText: 'What is the capital of France?',
        questionType: 'mcq',
        options: ['Paris', 'London'],
        correctOptionIndex: 0,
        explanation: 'Paris is the capital of France.'
      }]
    }, 'gemini')).toThrow(/four distinct, nonempty options/);

    expect(() => normalizeQuestions({
      questions: [{
        questionText: 'Define photosynthesis.',
        questionType: 'shortanswer',
        options: [],
        explanation: 'A biological process.'
      }]
    }, 'gemini')).toThrow(/no reference answer/);
  });

  it('normalizeQuestions properly normalizes True/False questions', () => {
    const rawData = {
      questions: [
        {
          questionText: 'Water freezes at 0 degrees Celsius.',
          questionType: 'truefalse',
          correctAnswer: 'True',
          explanation: 'Freezing point of water at 1 atm is 0 C.'
        }
      ]
    };

    const normalized = normalizeQuestions(rawData, 'groq', 1);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].questionType).toBe('truefalse');
    expect(normalized[0].options).toEqual(['True', 'False']);
    expect(normalized[0].correctOptionIndex).toBe(0);
    expect(normalized[0].batchIndex).toBe(1);
  });

  it('normalizeQuestions properly normalizes Short Answer questions', () => {
    const rawData = {
      questions: [
        {
          questionText: 'Define photosynthesis in one sentence.',
          questionType: 'shortanswer',
          correctAnswer: 'The process by which plants use sunlight to synthesize nutrients.',
          explanation: 'Standard botanical definition.'
        }
      ]
    };

    const normalized = normalizeQuestions(rawData, 'openrouter', 0);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].questionType).toBe('shortanswer');
    expect(normalized[0].options).toEqual([]);
    expect(normalized[0].correctOptionIndex).toBe(-1);
    expect(normalized[0].correctAnswer).toBeDefined();
  });

  it('validates exact batch count and requested question-type counts', () => {
    const request: GenerateBatchRequest = {
      prompt: 'Generate science questions',
      count: 1,
      questionTypes: ['mcq'],
      questionTypeCounts: { mcq: 1, truefalse: 0, shortanswer: 0 }
    };
    const questions = normalizeQuestions({
      questions: [{
        questionText: 'Which planet is closest to the Sun?',
        questionType: 'mcq',
        options: ['Mercury', 'Venus', 'Earth', 'Mars'],
        correctOptionIndex: 0,
        explanation: 'Mercury orbits closest to the Sun.'
      }]
    }, 'gemini');

    expect(validateGeneratedQuestionBatch(questions, request)).toHaveLength(1);
    expect(() => validateGeneratedQuestionBatch([], request)).toThrow(/Expected 1 questions/);
  });
});

describe('AI Generator - Orchestrator and Cooldowns', () => {
  it('correctly tracks and checks provider cooldown', () => {
    setProviderCooldown('groq', 10, 'Rate limit');
    const cooldown = getProviderCooldown('groq');
    expect(cooldown.inCooldown).toBe(true);
    expect(cooldown.remainingSeconds).toBeGreaterThan(0);
    expect(cooldown.reason).toBe('Rate limit');
  });

  describe('Groq model fallback', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('tries another model when Groq rejects the selected model with HTTP 403', async () => {
      const calls: string[] = [];
      global.fetch = jest.fn(async (_input: any, init?: any) => {
        const request = JSON.parse(init.body);
        calls.push(request.model);
        if (calls.length === 1) {
          return new Response(JSON.stringify({
              error: { message: "The model 'openai/gpt-oss-20b' does not exist or you do not have access to it." }
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
                    explanation: 'Mercury is closest to the Sun.'
                  }]
                })
              }
            }]
          }), { status: 200 });
      }) as typeof fetch;

      const result = await callGroq({
        prompt: 'Generate a science question',
        count: 1,
        questionTypes: ['mcq']
      }, 'valid-test-key');

      expect(calls).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
      expect(result).toHaveLength(1);
    });

    it('does not retry model fallbacks when Groq rejects the API key', async () => {
      const fetchMock = jest.fn(async () => new Response(
        JSON.stringify({ error: { message: 'Invalid API key' } }),
        { status: 403, statusText: 'Forbidden' }
      ));
      global.fetch = fetchMock as typeof fetch;

      await expect(callGroq({
        prompt: 'Generate a science question',
        count: 1,
        questionTypes: ['mcq']
      }, 'invalid-test-key')).rejects.toThrow('Invalid API key');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not mark Groq credentials invalid when every fallback model is unavailable', async () => {
      const fetchMock = jest.fn(async () => new Response(
        JSON.stringify({
          error: { message: 'The model does not exist or you do not have access to it.' }
        }),
        { status: 403, statusText: 'Forbidden' }
      ));
      global.fetch = fetchMock as typeof fetch;
      setProviderCooldown('groq', 0, 'expired');
      getProviderCooldown('groq');

      const result = await orchestrateGenerationBatch({
        prompt: 'Generate a science question',
        count: 1,
        questionTypes: ['mcq'],
        providerPriority: ['groq']
      }, { groq: 'valid-test-key' });

      expect(result.success).toBe(false);
      expect(result.attempts[0].error).toContain('does not exist');
      expect(getProviderCooldown('groq').inCooldown).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });
  });

  it('orchestrator skips unconfigured providers and handles fallback', async () => {
    const req: GenerateBatchRequest = {
      prompt: 'Sample biology questions',
      count: 2,
      questionTypes: ['mcq'],
      providerPriority: ['gemini', 'groq']
    };

    // Both keys empty
    const res = await orchestrateGenerationBatch(req, {});
    expect(res.success).toBe(false);
    expect(res.questions).toHaveLength(0);
    expect(res.attempts).toHaveLength(2);
    expect(res.attempts[0].status).toBe('skipped');
    expect(res.attempts[1].status).toBe('skipped');
  });
});
