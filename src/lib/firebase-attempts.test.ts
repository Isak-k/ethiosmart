import { describe, expect, it } from 'vitest';
import type { Answer, Question } from '@/integrations/firebase/types';
import { calculateScoreFromAnswers } from './firebase-attempts';

describe('calculateScoreFromAnswers', () => {
  it('combines partial manual marks with correct auto-graded answers', () => {
    const questions = [
      { questionId: 'essay', marks: 5 },
      { questionId: 'mcq', marks: 2 },
      { questionId: 'unanswered', marks: 3 },
    ] as Question[];
    const answers = [
      { questionId: 'essay', manualGrade: 3, isCorrect: false },
      { questionId: 'mcq', isCorrect: true },
    ] as Answer[];

    expect(calculateScoreFromAnswers(questions, answers)).toEqual({
      totalScore: 5,
      maxScore: 10,
    });
  });
});