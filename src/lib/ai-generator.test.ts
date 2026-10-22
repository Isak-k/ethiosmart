import { describe, it, expect } from 'vitest';
import { detectDuplicateQuestions, removeUndefinedFields } from './ai-generator-service';
import { NormalizedQuestion } from '@/types/ai-generator';

describe('AI Generator Frontend Service & Utilities', () => {
  it('detectDuplicateQuestions detects duplicate question stems accurately', () => {
    const questions: NormalizedQuestion[] = [
      {
        id: 'q1',
        questionText: 'What is the primary function of mitochondria in human cells?',
        questionType: 'mcq',
        options: ['Energy production', 'Protein synthesis', 'Cell division', 'Lipid breakdown'],
        correctOptionIndex: 0,
        explanation: 'Mitochondria generate ATP.',
        difficulty: 'Medium',
        marks: 1,
        providerUsed: 'gemini',
        batchIndex: 1
      },
      {
        id: 'q2',
        questionText: 'Which organelle is responsible for cellular respiration?',
        questionType: 'mcq',
        options: ['Mitochondria', 'Ribosome', 'Golgi apparatus', 'Lysosome'],
        correctOptionIndex: 0,
        explanation: 'Mitochondria conduct cellular respiration.',
        difficulty: 'Easy',
        marks: 1,
        providerUsed: 'groq',
        batchIndex: 1
      },
      {
        id: 'q3',
        questionText: 'What is the primary function of mitochondria in human cells?!',
        questionType: 'mcq',
        options: ['Energy production', 'Protein synthesis', 'Cell division', 'Lipid breakdown'],
        correctOptionIndex: 0,
        explanation: 'Duplicate test.',
        difficulty: 'Medium',
        marks: 1,
        providerUsed: 'openrouter',
        batchIndex: 2
      }
    ];

    const duplicates = detectDuplicateQuestions(questions);
    // q1 (index 0) and q3 (index 2) have matching normalized stems
    expect(duplicates.has(0)).toBe(true);
    expect(duplicates.has(2)).toBe(true);
    expect(duplicates.has(1)).toBe(false);
  });

  it('calculates correct batch counts for large question requests', () => {
    const BATCH_SIZE = 10;
    const testCases = [
      { total: 5, expectedBatches: 1 },
      { total: 10, expectedBatches: 1 },
      { total: 15, expectedBatches: 2 },
      { total: 20, expectedBatches: 2 },
      { total: 50, expectedBatches: 5 },
      { total: 100, expectedBatches: 10 },
      { total: 200, expectedBatches: 20 },
    ];

    testCases.forEach(({ total, expectedBatches }) => {
      const numBatches = Math.ceil(total / BATCH_SIZE);
      expect(numBatches).toBe(expectedBatches);
    });
  });

  it('correctly maps normalized questions for Firestore saving', () => {
    const normalized: NormalizedQuestion = {
      id: 'ai_123',
      questionText: 'Is the earth round?',
      questionType: 'truefalse',
      options: ['True', 'False'],
      correctOptionIndex: 0,
      correctAnswer: 'True',
      explanation: 'The earth is an oblate spheroid.',
      difficulty: 'Easy',
      marks: 2,
      providerUsed: 'groq',
      batchIndex: 1
    };

    const mapped = {
      examId: 'test_exam',
      questionText: normalized.questionText,
      questionType: normalized.questionType,
      options: normalized.options || [],
      correctOptionIndex: normalized.correctOptionIndex,
      correctAnswer: normalized.correctAnswer,
      explanation: normalized.explanation,
      difficulty: normalized.difficulty,
      marks: normalized.marks,
      feedbackType: 'instant' as const,
      generatedByAI: true,
      orderIndex: 1
    };

    expect(mapped.examId).toBe('test_exam');
    expect(mapped.questionText).toBe('Is the earth round?');
    expect(mapped.questionType).toBe('truefalse');
    expect(mapped.generatedByAI).toBe(true);
    expect(mapped.marks).toBe(2);
  });

  it('correctly splits specific question type counts (e.g. 8 T/F + 7 MCQs) into batches', () => {
    const totalCount = 15;
    const tfCount = 8;
    const mcqCount = 7;
    const shortCount = 0;
    const BATCH_SIZE = 10;
    const numBatches = Math.ceil(totalCount / BATCH_SIZE);

    expect(numBatches).toBe(2);

    let remainingMcqs = mcqCount;
    let remainingTfs = tfCount;
    let remainingShorts = shortCount;

    const batches: Array<{ tf: number; mcq: number; short: number }> = [];

    for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
      const remainingTotal = totalCount - batches.reduce((sum, b) => sum + b.tf + b.mcq + b.short, 0);
      const countForThisBatch = Math.min(BATCH_SIZE, remainingTotal);

      let batchTf = 0;
      let batchMcq = 0;
      let batchShort = 0;
      let needed = countForThisBatch;

      if (remainingTfs > 0 && needed > 0) {
        const take = Math.min(remainingTfs, needed);
        batchTf = take;
        remainingTfs -= take;
        needed -= take;
      }
      if (remainingMcqs > 0 && needed > 0) {
        const take = Math.min(remainingMcqs, needed);
        batchMcq = take;
        remainingMcqs -= take;
        needed -= take;
      }
      if (remainingShorts > 0 && needed > 0) {
        const take = Math.min(remainingShorts, needed);
        batchShort = take;
        remainingShorts -= take;
        needed -= take;
      }

      batches.push({ tf: batchTf, mcq: batchMcq, short: batchShort });
    }

    expect(batches.length).toBe(2);
    // Batch 1 takes 8 T/F + 2 MCQs (10 total)
    expect(batches[0]).toEqual({ tf: 8, mcq: 2, short: 0 });
    // Batch 2 takes remaining 5 MCQs (5 total)
    expect(batches[1]).toEqual({ tf: 0, mcq: 5, short: 0 });

    // Total across all batches matches exactly
    const sumTf = batches.reduce((acc, b) => acc + b.tf, 0);
    const sumMcq = batches.reduce((acc, b) => acc + b.mcq, 0);
    expect(sumTf).toBe(8);
    expect(sumMcq).toBe(7);
    expect(sumTf + sumMcq).toBe(15);
  });

  it('removeUndefinedFields cleanly strips undefined fields deeply without touching valid values', () => {
    const rawJobData = {
      jobId: 'job_123',
      createdBy: 'admin_1',
      adminEmail: undefined,
      departmentId: undefined,
      chapterId: undefined,
      chapterTitle: undefined,
      totalRequested: 30,
      totalGenerated: 10,
      questions: [
        {
          id: 'q1',
          questionText: 'What is photosynthesis?',
          questionType: 'mcq' as const,
          options: ['Process A', 'Process B'],
          correctOptionIndex: 0,
          correctAnswer: undefined,
          explanation: 'It converts light to chemical energy.',
          difficulty: 'Easy' as const,
          marks: 1,
          providerUsed: 'gemini' as const,
          batchIndex: 1,
          sourceReference: {
            bookId: 'book_1',
            chapter: undefined,
            pageRange: undefined,
          }
        }
      ]
    };

    const cleaned = removeUndefinedFields(rawJobData);

    // Top-level undefined keys must not exist
    expect('chapterId' in cleaned).toBe(false);
    expect('chapterTitle' in cleaned).toBe(false);
    expect('adminEmail' in cleaned).toBe(false);
    expect('departmentId' in cleaned).toBe(false);

    // Defined values are preserved
    expect(cleaned.jobId).toBe('job_123');
    expect(cleaned.totalRequested).toBe(30);
    expect(cleaned.totalGenerated).toBe(10);

    // Nested array object undefined keys must not exist
    expect('correctAnswer' in cleaned.questions[0]).toBe(false);
    expect('chapter' in cleaned.questions[0].sourceReference!).toBe(false);
    expect('pageRange' in cleaned.questions[0].sourceReference!).toBe(false);
    expect(cleaned.questions[0].sourceReference?.bookId).toBe('book_1');
  });

  it('calculates correct batch resumption index and remaining question type allocation', () => {
    const totalCount = 30;
    const tfCount = 8;
    const mcqCount = 22;
    const shortCount = 0;
    const BATCH_SIZE = 10;

    // Simulate 10 questions already generated (8 T/F and 2 MCQs)
    const existingQuestions = [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `tf_${i}`, questionType: 'truefalse' as const })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `mcq_${i}`, questionType: 'mcq' as const })),
    ];

    const alreadyMcqs = existingQuestions.filter(q => q.questionType === 'mcq').length;
    const alreadyTfs = existingQuestions.filter(q => q.questionType === 'truefalse').length;
    const alreadyShorts = existingQuestions.filter(q => q.questionType === 'shortanswer').length;

    const remainingMcqs = Math.max(0, mcqCount - alreadyMcqs);
    const remainingTfs = Math.max(0, tfCount - alreadyTfs);
    const remainingShorts = Math.max(0, shortCount - alreadyShorts);

    expect(remainingTfs).toBe(0); // All 8 T/Fs already done
    expect(remainingMcqs).toBe(20); // 20 MCQs remaining out of 22
    expect(remainingShorts).toBe(0);

    const startBatchIdx = Math.floor(existingQuestions.length / BATCH_SIZE);
    expect(startBatchIdx).toBe(1); // Resume at Batch 2 (index 1)
  });
});
