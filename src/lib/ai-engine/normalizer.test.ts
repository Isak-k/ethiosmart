import { describe, expect, it } from 'vitest';
import type { GenerateBatchRequest } from './types';
import {
  extractJsonFromText,
  normalizeQuestions,
  validateGeneratedQuestionBatch,
} from './normalizer';

const mcq = {
  questionText: 'Which planet is closest to the Sun?',
  questionType: 'mcq',
  options: ['Mercury', 'Venus', 'Earth', 'Mars'],
  correctOptionIndex: 0,
  explanation: 'Mercury orbits closest to the Sun.',
};

describe('AI response normalization', () => {
  it('parses JSON fences and normalizes MCQ, True/False, and short-answer schemas', () => {
    const raw = JSON.stringify([
      mcq,
      {
        questionText: 'Is water composed of hydrogen and oxygen?',
        questionType: 'truefalse',
        correctAnswer: 'True',
        explanation: 'Water contains hydrogen and oxygen.',
      },
      {
        questionText: 'What is the chemical symbol for water?',
        questionType: 'shortanswer',
        correctAnswer: 'H2O',
        explanation: 'H2O is the chemical formula for water.',
      },
    ]);
    const parsed = extractJsonFromText(`\`\`\`json\n${raw}\n\`\`\``);
    const questions = normalizeQuestions(parsed, 'gemini', 1);
    const request: GenerateBatchRequest = {
      prompt: 'Water chemistry',
      count: 3,
      questionTypes: ['mcq', 'truefalse', 'shortanswer'],
      questionTypeCounts: { mcq: 1, truefalse: 1, shortanswer: 1 },
    };

    expect(validateGeneratedQuestionBatch(questions, request)).toHaveLength(3);
    expect(questions[1].options).toEqual(['True', 'False']);
    expect(questions[2].correctOptionIndex).toBe(-1);
  });

  it('rejects malformed option lists, missing answers, and invalid JSON', () => {
    expect(() => normalizeQuestions([{
      ...mcq,
      options: ['Mercury', 'Venus'],
    }], 'groq')).toThrow(/four distinct, nonempty options/);
    expect(() => normalizeQuestions([{
      questionText: 'What is water?',
      questionType: 'shortanswer',
      explanation: 'Water is a compound.',
    }], 'groq')).toThrow(/no reference answer/);
    expect(() => extractJsonFromText('{bad json}')).toThrow(/Failed to parse AI output as JSON/);
  });

  it('rejects incorrect counts, requested types, and duplicate questions', () => {
    const questions = normalizeQuestions([mcq], 'openrouter');
    const request: GenerateBatchRequest = {
      prompt: 'Astronomy',
      count: 2,
      questionTypes: ['mcq'],
    };
    expect(() => validateGeneratedQuestionBatch(questions, request)).toThrow(/Expected 2 questions/);
    expect(() => validateGeneratedQuestionBatch(
      [questions[0], { ...questions[0], id: 'duplicate' }],
      { ...request, count: 2 },
    )).toThrow(/duplicate questions/);
    expect(() => validateGeneratedQuestionBatch(
      [{ ...questions[0], questionType: 'truefalse' }],
      { ...request, count: 1 },
    )).toThrow(/valid True\/False question/);
  });
});
