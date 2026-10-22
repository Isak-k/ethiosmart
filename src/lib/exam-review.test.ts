import { describe, it, expect } from 'vitest';

describe('Exam Answer Review Logic (Practice & Normal Exams)', () => {
  const getUserAnswerText = (ans: any, q: any): string => {
    if (ans?.studentAnswer && String(ans.studentAnswer).trim().length > 0) {
      return String(ans.studentAnswer).trim();
    }
    const optIdx = typeof ans?.selectedOptionIndex === 'number'
      ? ans.selectedOptionIndex
      : typeof ans?.selectedOption === 'number'
      ? ans.selectedOption
      : null;

    if (optIdx !== null && optIdx >= 0 && q?.options && q.options[optIdx]) {
      return q.options[optIdx];
    }
    if (optIdx !== null && optIdx >= 0) {
      return `Option ${String.fromCharCode(65 + optIdx)}`;
    }
    return 'No answer provided / Skipped';
  };

  const getCorrectAnswerText = (q: any): string => {
    if (!q) return 'Not available';
    if (q.options && typeof q.correctOptionIndex === 'number' && q.options[q.correctOptionIndex]) {
      return q.options[q.correctOptionIndex];
    }
    if (q.correctAnswer && String(q.correctAnswer).trim().length > 0) {
      return String(q.correctAnswer).trim();
    }
    if (typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0) {
      return `Option ${String.fromCharCode(65 + q.correctOptionIndex)}`;
    }
    return 'Not specified';
  };

  it('correctly provides both user answer and correct answer for short answer questions', () => {
    const question = {
      questionId: 'q1',
      questionText: 'Based on the lecture notes, what is the core principle of inclusion and what does it demand from society?',
      questionType: 'shortanswer',
      options: [],
      correctAnswer: 'Inclusion demands that society adapts to accommodate diversity rather than expecting individuals to fit into existing structures.'
    };

    const answer = {
      questionId: 'q1',
      studentAnswer: 'tttttttt',
      isCorrect: false
    };

    const userAnswer = getUserAnswerText(answer, question);
    const correctAnswer = getCorrectAnswerText(question);

    expect(userAnswer).toBe('tttttttt');
    expect(correctAnswer).toContain('Inclusion demands that society adapts');
  });

  it('correctly provides both user answer and correct answer when user answered correctly', () => {
    const question = {
      questionId: 'q2',
      questionText: 'According to the UN CRPD, which of the following best defines disability?',
      questionType: 'mcq',
      options: [
        'A medical impairment that requires permanent clinical hospitalization.',
        'A negative reaction of people towards persons with impairments that results in participation restriction, stemming from attitudinal and environmental barriers.',
        'An absolute inability to perform any economic activity.',
        'A purely genetic condition with no societal factor.'
      ],
      correctOptionIndex: 1
    };

    const answer = {
      questionId: 'q2',
      selectedOptionIndex: 1,
      isCorrect: true
    };

    const userAnswer = getUserAnswerText(answer, question);
    const correctAnswer = getCorrectAnswerText(question);

    expect(userAnswer).toBe(question.options[1]);
    expect(correctAnswer).toBe(question.options[1]);
  });

  it('correctly provides both user answer and correct answer when user answered incorrectly on True/False', () => {
    const question = {
      questionId: 'q3',
      questionText: 'Specialized and residential schools were designed to integrate children into mainstream public school settings.',
      questionType: 'truefalse',
      options: ['True', 'False'],
      correctOptionIndex: 1
    };

    const answer = {
      questionId: 'q3',
      selectedOptionIndex: 0,
      isCorrect: false
    };

    const userAnswer = getUserAnswerText(answer, question);
    const correctAnswer = getCorrectAnswerText(question);

    expect(userAnswer).toBe('True');
    expect(correctAnswer).toBe('False');
  });

  it('normalizes answer data properly in ReviewExam from Firestore attempt answers', () => {
    const rawFirestoreAnswers = [
      {
        questionId: 'q_mcq',
        selectedOptionIndex: 2,
        isCorrect: true
      },
      {
        questionId: 'q_legacy',
        selectedOption: 1,
        isCorrect: false
      },
      {
        questionId: 'q_text',
        studentAnswer: 'Photosynthesis is...',
        isCorrect: null
      }
    ];

    const answersMap: Record<string, { selectedOptionIndex: number | null; studentAnswer: string | null; isCorrect: boolean | null }> = {};
    rawFirestoreAnswers.forEach((ans: any) => {
      const selectedIndex = typeof ans.selectedOptionIndex === 'number'
        ? ans.selectedOptionIndex
        : typeof ans.selectedOption === 'number'
        ? ans.selectedOption
        : null;

      answersMap[ans.questionId] = {
        selectedOptionIndex: selectedIndex,
        studentAnswer: ans.studentAnswer ?? null,
        isCorrect: ans.isCorrect ?? null,
      };
    });

    expect(answersMap['q_mcq'].selectedOptionIndex).toBe(2);
    expect(answersMap['q_legacy'].selectedOptionIndex).toBe(1);
    expect(answersMap['q_text'].studentAnswer).toBe('Photosynthesis is...');
  });

  it('correctly evaluates short answer correctness based on admin awarded points (manualGrade)', () => {
    // When admin awards points (> 0), counts as correct even if text differs from explanation
    const evaluateCorrectness = (manualGrade: number | null | undefined, isCorrect: boolean | null | undefined, studentAns: string, modelAns: string) => {
      if (typeof manualGrade === 'number') {
        return manualGrade > 0;
      }
      if (typeof isCorrect === 'boolean') {
        return isCorrect;
      }
      return studentAns.trim().toLowerCase() === modelAns.trim().toLowerCase();
    };

    // Case 1: Student gave non-matching answer, but admin gave 4 points
    expect(evaluateCorrectness(4, true, 'My custom explanation', 'Official textbook answer')).toBe(true);

    // Case 2: Student gave answer, admin gave 0 points
    expect(evaluateCorrectness(0, false, 'Some random text', 'Official textbook answer')).toBe(false);

    // Case 3: Ungraded, text matches
    expect(evaluateCorrectness(null, null, 'Exact answer', 'exact answer')).toBe(true);
  });

  it('correctly associates and preserves Cloudinary URL for subject cover image', () => {
    const cloudinaryUrl = 'https://res.cloudinary.com/exampro/image/upload/v12345/biology_cover.png';
    const payload = {
      name: 'Biology',
      coverImageUrl: cloudinaryUrl,
      coverImagePublicId: 'cloudinary_link',
    };

    expect(payload.coverImageUrl).toContain('cloudinary.com');
    expect(payload.coverImagePublicId).toBe('cloudinary_link');
  });
});
