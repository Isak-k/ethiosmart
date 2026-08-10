import { describe, it, expect } from "vitest";
import {
  evaluateMCQ,
  evaluateTrueFalse,
  evaluateShortAnswer,
  evaluateEssay,
  evaluateQuestion,
  batchEvaluateAnswers,
  calculateExamScore,
  type EvaluationResult,
} from "@/lib/question-evaluation";
import type { Question, MCQQuestion, TrueFalseQuestion, ShortAnswerQuestion, EssayQuestion } from "@/integrations/firebase/types";

// ---- Question builders ----

const baseMCQ: MCQQuestion = {
  questionId: "mcq-1",
  examId: "exam-1",
  questionType: "mcq",
  questionText: "Capital of France?",
  marks: 2,
  orderIndex: 0,
  feedbackType: "instant",
  explanation: "Paris is the capital.",
  options: ["Paris", "Lyon", "Marseille", "Bordeaux"],
  correctOptionIndex: 0,
  createdAt: new Date() as any,
  updatedAt: new Date() as any,
};

const baseTF: TrueFalseQuestion = {
  questionId: "tf-1",
  examId: "exam-1",
  questionType: "true-false",
  questionText: "2 + 2 equals 4.",
  marks: 1,
  orderIndex: 1,
  feedbackType: "instant",
  explanation: "Basic arithmetic.",
  correctAnswer: true,
  createdAt: new Date() as any,
  updatedAt: new Date() as any,
};

const baseSA: ShortAnswerQuestion = {
  questionId: "sa-1",
  examId: "exam-1",
  questionType: "short-answer",
  questionText: "Name the largest planet.",
  marks: 2,
  orderIndex: 2,
  feedbackType: "instant",
  explanation: "Jupiter is largest.",
  correctAnswers: ["Jupiter"],
  caseSensitive: false,
  requireExactMatch: true,
  createdAt: new Date() as any,
  updatedAt: new Date() as any,
};

const baseEssay: EssayQuestion = {
  questionId: "essay-1",
  examId: "exam-1",
  questionType: "essay",
  questionText: "Discuss photosynthesis.",
  marks: 10,
  orderIndex: 3,
  feedbackType: "hidden",
  explanation: "N/A",
  minWords: 5,
  maxWords: 50,
  createdAt: new Date() as any,
  updatedAt: new Date() as any,
};

const allTypes: Question[] = [baseMCQ, baseTF, baseSA, baseEssay];

describe("Question Evaluation Engine - MCQ (Task 8.1)", () => {
  it("awards full marks for correct MCQ selection", () => {
    const r = evaluateMCQ(baseMCQ, 0);
    expect(r.isCorrect).toBe(true);
    expect(r.earnedMarks).toBe(2);
    expect(r.totalMarks).toBe(2);
    expect(r.feedback).toContain("Correct");
    expect(r.explanation).toBe(baseMCQ.explanation);
  });

  it("awards 0 marks for incorrect MCQ selection", () => {
    const r = evaluateMCQ(baseMCQ, 1);
    expect(r.isCorrect).toBe(false);
    expect(r.earnedMarks).toBe(0);
    expect(r.totalMarks).toBe(2);
    expect(r.feedback).toContain(baseMCQ.options[0]);
  });

  it("treats null/undefined selection as skipped (0, feedback includes skipped)", () => {
    for (const nullish of [null, undefined] as const) {
      const r = evaluateMCQ(baseMCQ, nullish);
      expect(r.isCorrect).toBe(false);
      expect(r.earnedMarks).toBe(0);
      expect(r.feedback?.toLowerCase()).toContain("skipped");
    }
  });

  it("throws when evaluating wrong question type", () => {
    expect(() => evaluateMCQ(baseTF as any, 0)).toThrow(/not MCQ/i);
  });
});

describe("Question Evaluation Engine - True/False (Task 8.2)", () => {
  it("awards full marks for correct True answer", () => {
    const r = evaluateTrueFalse(baseTF, true);
    expect(r.isCorrect).toBe(true);
    expect(r.earnedMarks).toBe(1);
    expect(r.totalMarks).toBe(1);
  });

  it("awards 0 marks for wrong False answer when True is correct", () => {
    const r = evaluateTrueFalse(baseTF, false);
    expect(r.isCorrect).toBe(false);
    expect(r.earnedMarks).toBe(0);
    expect(r.feedback).toContain("True");
  });

  it("supports questions where False is the correct answer", () => {
    const q: TrueFalseQuestion = { ...baseTF, correctAnswer: false, questionId: "tf-2" };
    const rTrue = evaluateTrueFalse(q, true);
    const rFalse = evaluateTrueFalse(q, false);
    expect(rTrue.isCorrect).toBe(false);
    expect(rFalse.isCorrect).toBe(true);
    expect(rFalse.earnedMarks).toBe(1);
    expect(rTrue.feedback).toContain("False");
  });

  it("treats null/undefined selection as skipped", () => {
    const r = evaluateTrueFalse(baseTF, null);
    expect(r.earnedMarks).toBe(0);
    expect(r.feedback?.toLowerCase()).toContain("skipped");
  });

  it("throws when evaluating wrong question type", () => {
    expect(() => evaluateTrueFalse(baseMCQ as any, true)).toThrow(/True\/False/i);
  });
});

describe("Question Evaluation Engine - Short Answer (Tasks 8.3, 8.14)", () => {
  it("matches single accepted answer (case-insensitive by default)", () => {
    const r = evaluateShortAnswer(baseSA, "jupiter");
    expect(r.isCorrect).toBe(true);
    expect(r.earnedMarks).toBe(2);
  });

  it("matches any of multiple accepted answers", () => {
    const multiSA: ShortAnswerQuestion = {
      ...baseSA,
      questionId: "sa-multi",
      correctAnswers: ["NYC", "New York City", "New York"],
      caseSensitive: false,
      requireExactMatch: false,
    };
    for (const ans of ["nyc", "  New York City  ", "new york"]) {
      const r = evaluateShortAnswer(multiSA, ans);
      expect(r.isCorrect).toBe(true);
      expect(r.earnedMarks).toBe(baseSA.marks);
    }
  });

  it("caseSensitive=true rejects case-mismatched exact-match answers", () => {
    const strict: ShortAnswerQuestion = {
      ...baseSA,
      questionId: "sa-strict",
      correctAnswers: ["NaCl"],
      caseSensitive: true,
      requireExactMatch: true,
    };
    expect(evaluateShortAnswer(strict, "nacl").isCorrect).toBe(false);
    expect(evaluateShortAnswer(strict, "NaCl").isCorrect).toBe(true);
  });

  it("empty/whitespace-only answer is skipped", () => {
    for (const ans of ["", "   ", null, undefined] as any) {
      const r = evaluateShortAnswer(baseSA, ans);
      expect(r.isCorrect).toBe(false);
      expect(r.earnedMarks).toBe(0);
      expect(r.feedback?.toLowerCase()).toContain("skipped");
    }
  });

  it("incorrect answer lists expected correct answers in feedback", () => {
    const r = evaluateShortAnswer(baseSA, "Saturn");
    expect(r.isCorrect).toBe(false);
    expect(r.feedback).toContain(baseSA.correctAnswers.join(", "));
  });

  it("throws when evaluating wrong question type", () => {
    expect(() => evaluateShortAnswer(baseEssay as any, "text")).toThrow(/Short Answer/i);
  });

  // ---- PBT-style: Text Matching Properties (Task 8.14) ----
  it("PBT-style: exact-match correctness is idempotent (same input → same result)", () => {
    for (let i = 0; i < 20; i++) {
      const answer = ["jupiter", "Jupiter", "saturn", "mars"][i % 4];
      const r1 = evaluateShortAnswer(baseSA, answer);
      const r2 = evaluateShortAnswer(baseSA, answer);
      expect(r1.isCorrect).toBe(r2.isCorrect);
      expect(r1.earnedMarks).toBe(r2.earnedMarks);
    }
  });

  it("PBT-style: if caseSensitive=false, lowercased student answer matches same as original", () => {
    const sa = { ...baseSA, caseSensitive: false, correctAnswers: ["Earth", "Mars"] } as ShortAnswerQuestion;
    const inputs = ["earth", "EARTH", "  Earth  ", "MARS", "jupiter"];
    for (const input of inputs) {
      const lower = input.toLowerCase().trim();
      const hasMatch = sa.correctAnswers.some(c => c.toLowerCase().trim() === lower);
      const r = evaluateShortAnswer(sa, input);
      expect(r.isCorrect).toBe(hasMatch);
    }
  });
});

describe("Question Evaluation Engine - Essay (Task 8.4)", () => {
  const essayResponseOk = "Photosynthesis converts light energy into chemical energy.";

  it("returns pending state with zero earned marks for in-range essay", () => {
    const r = evaluateEssay(baseEssay, essayResponseOk);
    expect(r.isCorrect).toBe(false); // pending manual grading
    expect(r.earnedMarks).toBe(0);
    expect(r.totalMarks).toBe(10);
    expect(r.feedback?.toLowerCase()).toContain("pending");
  });

  it("rejects essay shorter than minWords", () => {
    const r = evaluateEssay(baseEssay, "short");
    expect(r.earnedMarks).toBe(0);
    expect(r.feedback?.toLowerCase()).toContain("too short");
  });

  it("rejects essay longer than maxWords", () => {
    const long = Array.from({ length: 60 }, (_, i) => `w${i}`).join(" ");
    const r = evaluateEssay(baseEssay, long);
    expect(r.earnedMarks).toBe(0);
    expect(r.feedback?.toLowerCase()).toContain("too long");
  });

  it("when no word limits, any response is accepted as pending", () => {
    const openEssay: EssayQuestion = {
      ...baseEssay,
      questionId: "essay-open",
      minWords: undefined,
      maxWords: undefined,
    };
    const r = evaluateEssay(openEssay, "Any text.");
    expect(r.feedback?.toLowerCase()).toContain("pending");
  });

  it("throws when evaluating wrong question type", () => {
    expect(() => evaluateEssay(baseMCQ as any, "text")).toThrow(/Essay/i);
  });
});

describe("Question Evaluation Engine - Unified + Batch + Score (Tasks 8.6, 8.15)", () => {
  it("evaluateQuestion routes correctly for every question type", () => {
    const cases: Array<[Question, any, boolean, number]> = [
      [baseMCQ, 0, true, 2],
      [baseMCQ, 9, false, 0], // wrong index → 0
      [baseTF, true, true, 1],
      [baseTF, false, false, 0],
      [baseSA, "Jupiter", true, 2],
      [baseSA, "Saturn", false, 0],
    ];
    for (const [q, ans, expectedCorrect, expectedEarned] of cases) {
      const r = evaluateQuestion(q, ans);
      expect(r.isCorrect).toBe(expectedCorrect);
      expect(r.earnedMarks).toBe(expectedEarned);
    }
    // Essay: use a response definitely >= minWords=5 → pending
    const essayR = evaluateQuestion(baseEssay, "Photosynthesis is a complex process used by green plants algae and bacteria.");
    expect(essayR.earnedMarks).toBe(0);
    expect(essayR.feedback?.toLowerCase()).toContain("pending");
  });

  it("batchEvaluateAnswers evaluates per question answer map correctly", () => {
    const answers = new Map<string, any>();
    answers.set(baseMCQ.questionId, 0); // correct MCQ
    answers.set(baseTF.questionId, false); // wrong TF
    answers.set(baseSA.questionId, "Jupiter"); // correct SA
    answers.set(baseEssay.questionId, "Photosynthesis converts light energy into chemical energy in plants cells."); // pending essay, word count OK
    // Question with no answer (skipped)
    const skippedMCQ: MCQQuestion = { ...baseMCQ, questionId: "skipped-mcq" };
    const results = batchEvaluateAnswers([baseMCQ, baseTF, baseSA, baseEssay, skippedMCQ], answers);

    expect(results).toHaveLength(5);
    const [mcqR, tfR, saR, essayR, skippedR] = results;
    expect(mcqR.earnedMarks).toBe(2);
    expect(tfR.earnedMarks).toBe(0);
    expect(saR.earnedMarks).toBe(2);
    expect(essayR.feedback?.toLowerCase()).toContain("pending");
    expect(skippedR.feedback?.toLowerCase()).toContain("skipped");
  });

  it("calculateExamScore aggregates mixed results correctly (all 4 types)", () => {
    const results: EvaluationResult[] = [
      // correct MCQ 2/2
      { isCorrect: true, earnedMarks: 2, totalMarks: 2, feedback: "Correct" },
      // wrong TF 0/1
      { isCorrect: false, earnedMarks: 0, totalMarks: 1, feedback: "Incorrect" },
      // correct SA 2/2
      { isCorrect: true, earnedMarks: 2, totalMarks: 2, feedback: "Correct" },
      // Essay pending 0/10
      { isCorrect: false, earnedMarks: 0, totalMarks: 10, feedback: "pending review" },
      // skipped MCQ 0/1
      { isCorrect: false, earnedMarks: 0, totalMarks: 1, feedback: "You skipped this question" },
    ];
    const score = calculateExamScore(results, 50);

    expect(score.maxMarks).toBe(16);
    expect(score.totalMarks).toBe(4);
    expect(score.percentage).toBeCloseTo((4 / 16) * 100);
    expect(score.passStatus).toBe("fail");
    expect(score.correctCount).toBe(2);
    expect(score.incorrectCount).toBe(1);
    expect(score.pendingCount).toBe(1);
    expect(score.skippedCount).toBe(1);
  });

  it("calculateExamScore pass/fail threshold correctly", () => {
    const pass: EvaluationResult[] = [
      { isCorrect: true, earnedMarks: 6, totalMarks: 10, feedback: "Correct" },
    ];
    const score1 = calculateExamScore(pass, 50);
    expect(score1.passStatus).toBe("pass");

    const fail: EvaluationResult[] = [
      { isCorrect: false, earnedMarks: 4, totalMarks: 10, feedback: "Incorrect" },
    ];
    const score2 = calculateExamScore(fail, 50);
    expect(score2.percentage).toBe(40);
    expect(score2.passStatus).toBe("fail");
  });

  // ---- PBT-style: Grade Determinism (Task 8.15) ----
  it("PBT-style: evaluateQuestion is deterministic (same inputs → same earnedMarks 50x)", () => {
    // Essay example: 10 words (baseEssay minWords=5)
    const essayOK = "Photosynthesis is the process used by plants algae and bacteria.";
    const questionsAndAnswers: Array<[Question, any]> = [
      [baseMCQ, 0], [baseMCQ, 1],
      [baseTF, true], [baseTF, false],
      [baseSA, "Jupiter"], [baseSA, "Pluto"],
      [baseEssay, essayOK],
    ];
    for (const [q, a] of questionsAndAnswers) {
      const baseline = evaluateQuestion(q, a);
      for (let i = 0; i < 50; i++) {
        const r = evaluateQuestion(q, a);
        expect(r.isCorrect).toBe(baseline.isCorrect);
        expect(r.earnedMarks).toBe(baseline.earnedMarks);
        expect(r.totalMarks).toBe(baseline.totalMarks);
      }
    }
  });

  it("PBT-style: batchEvaluateAnswers sum of earnedMarks == score.totalMarks exactly", () => {
    for (let run = 0; run < 25; run++) {
      const answers = new Map<string, any>();
      const qSet: Question[] = allTypes.map((q, idx) => ({ ...q, questionId: `${q.questionId}-run${run}-${idx}` }));
      const pickAns = (q: Question): any => {
        switch (q.questionType) {
          case "mcq": return Math.random() < 0.5 ? (q as MCQQuestion).correctOptionIndex : 999;
          case "true-false": return Math.random() < 0.5 ? (q as TrueFalseQuestion).correctAnswer : !(q as TrueFalseQuestion).correctAnswer;
          case "short-answer": return Math.random() < 0.5 ? (q as ShortAnswerQuestion).correctAnswers[0] : "WRONG";
          case "essay": return "This is a reasonable essay with multiple words inside.";
        }
      };
      qSet.forEach(q => answers.set(q.questionId, pickAns(q)));
      const results = batchEvaluateAnswers(qSet, answers);
      const sum = results.reduce((s, r) => s + r.earnedMarks, 0);
      const score = calculateExamScore(results, 50);
      expect(score.totalMarks).toBe(sum);
    }
  });
});
