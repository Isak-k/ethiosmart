import {
  buildUserPrompt,
  extractJsonFromText,
  normalizeQuestions
} from './ai-generator/normalizer';
import {
  orchestrateGenerationBatch,
  setProviderCooldown,
  getProviderCooldown
} from './ai-generator/orchestrator';
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

  it('normalizeQuestions properly normalizes MCQ with 4 options', () => {
    const rawData = {
      questions: [
        {
          questionText: 'What is the capital of France?',
          questionType: 'mcq',
          options: ['Paris', 'London'],
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
});

describe('AI Generator - Orchestrator and Cooldowns', () => {
  it('correctly tracks and checks provider cooldown', () => {
    setProviderCooldown('groq', 10, 'Rate limit');
    const cooldown = getProviderCooldown('groq');
    expect(cooldown.inCooldown).toBe(true);
    expect(cooldown.remainingSeconds).toBeGreaterThan(0);
    expect(cooldown.reason).toBe('Rate limit');
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
