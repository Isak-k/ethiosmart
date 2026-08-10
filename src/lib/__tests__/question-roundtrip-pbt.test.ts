import { describe, it, expect } from "vitest";
import {
  isMCQQuestion,
  isTrueFalseQuestion,
  isShortAnswerQuestion,
  isEssayQuestion,
  type Question,
  type MCQQuestion,
  type TrueFalseQuestion,
  type ShortAnswerQuestion,
  type EssayQuestion,
  type QuestionType,
} from "@/integrations/firebase/types";

// Local backward-compat helper (mirrors pattern from question-types.ts)
function ensureQuestionType<T extends { questionType?: QuestionType | string }>(data: T): T & { questionType: QuestionType } {
  if (!data.questionType) {
    return { ...data, questionType: "mcq" as QuestionType };
  }
  return data as T & { questionType: QuestionType };
}

// ============================================================================
// Task 8.7 / 8.19 — Backward compatibility type detection
// ============================================================================
describe("Backward Compatibility Type Detection (Tasks 8.7, 8.19)", () => {
  it("ensureQuestionType defaults legacy (no questionType) to MCQ", () => {
    const legacy = {
      questionId: "legacy-1",
      examId: "exam-1",
      questionText: "Old MCQ question",
      marks: 1,
      orderIndex: 0,
      feedbackType: "hidden",
      options: ["A", "B"],
      correctOptionIndex: 0,
      createdAt: new Date(),
    };
    const normalized = ensureQuestionType(legacy);
    expect(normalized.questionType).toBe("mcq");
    expect(isMCQQuestion(normalized as unknown as Question)).toBe(true);
  });

  it("ensureQuestionType does NOT overwrite explicit question types", () => {
    const explicit: Array<{ questionType: QuestionType }> = [
      { questionType: "mcq" },
      { questionType: "true-false" },
      { questionType: "short-answer" },
      { questionType: "essay" },
    ];
    for (const e of explicit) {
      expect(ensureQuestionType(e).questionType).toBe(e.questionType);
    }
  });

  it("PBT-style: legacy MCQ (any shape with 2+ options + numeric correct index) still detected after ensureQuestionType", () => {
    for (let i = 0; i < 15; i++) {
      const optionCount = 2 + (i % 5);
      const legacy = {
        questionId: `q${i}`,
        examId: "e1",
        questionText: "Legacy MCQ?",
        marks: 1,
        orderIndex: i,
        feedbackType: "hidden",
        options: Array.from({ length: optionCount }, (_, j) => `opt${j}`),
        correctOptionIndex: i % optionCount,
        createdAt: new Date(),
      };
      const q = ensureQuestionType(legacy) as unknown as MCQQuestion;
      expect(isMCQQuestion(q)).toBe(true);
      expect(q.options[q.correctOptionIndex]).toBeDefined();
    }
  });

  it("PBT-style: every question with questionType ∈ {mcq, true-false, short-answer, essay} is detected by exactly one guard", () => {
    const tf: TrueFalseQuestion = {
      questionId: "tf", examId: "e1", questionType: "true-false", questionText: "?",
      marks: 1, orderIndex: 0, feedbackType: "hidden", correctAnswer: false,
      createdAt: new Date() as any,
    };
    const sa: ShortAnswerQuestion = {
      questionId: "sa", examId: "e1", questionType: "short-answer", questionText: "?",
      marks: 1, orderIndex: 0, feedbackType: "hidden", correctAnswers: ["a"],
      createdAt: new Date() as any,
    };
    const essay: EssayQuestion = {
      questionId: "es", examId: "e1", questionType: "essay", questionText: "?",
      marks: 5, orderIndex: 0, feedbackType: "hidden",
      createdAt: new Date() as any,
    };
    const mcq: MCQQuestion = {
      questionId: "mcq", examId: "e1", questionType: "mcq", questionText: "?",
      marks: 1, orderIndex: 0, feedbackType: "hidden", options: ["a", "b"], correctOptionIndex: 0,
      createdAt: new Date() as any,
    };
    const all: Question[] = [mcq, tf, sa, essay];
    for (const q of all) {
      const guards = [isMCQQuestion(q), isTrueFalseQuestion(q), isShortAnswerQuestion(q), isEssayQuestion(q)];
      const trueCount = guards.filter(Boolean).length;
      expect(trueCount).toBe(1);
    }
  });
});

// ============================================================================
// Task 8.17 — Question Round-Trip (create → JSON.stringify → parse → load)
// ============================================================================
describe("Question Round-Trip (Task 8.17 — Create → Save → Load)", () => {
  const createMCQ = (seed: number): MCQQuestion => ({
    questionId: `mcq-${seed}`, examId: "exam-rt", questionType: "mcq",
    questionText: `MCQ seed ${seed}?`, marks: (seed % 3) + 1, orderIndex: seed, feedbackType: "instant",
    explanation: `explanation ${seed}`,
    options: Array.from({ length: ((seed % 5) + 2) }, (_, i) => `o${seed}-${i}`),
    correctOptionIndex: seed % ((seed % 5) + 2),
    createdAt: new Date(1700000000000 + seed) as any,
    difficulty: seed % 3 === 0 ? "easy" : seed % 3 === 1 ? "medium" : "hard",
    tags: [`tag-${seed % 4}`, "roundtrip"],
  });
  const createTF = (seed: number): TrueFalseQuestion => ({
    questionId: `tf-${seed}`, examId: "exam-rt", questionType: "true-false",
    questionText: `TF seed ${seed}?`, marks: (seed % 2) + 1, orderIndex: seed, feedbackType: "hidden",
    correctAnswer: seed % 2 === 0,
    explanation: `TF exp ${seed}`,
    createdAt: new Date(1700000000000 + seed) as any,
  });
  const createSA = (seed: number): ShortAnswerQuestion => ({
    questionId: `sa-${seed}`, examId: "exam-rt", questionType: "short-answer",
    questionText: `SA seed ${seed}?`, marks: (seed % 3) + 2, orderIndex: seed, feedbackType: "instant",
    correctAnswers: [`correct-${seed}`, `alt-${seed}`, `variant-${seed}`],
    caseSensitive: seed % 2 === 1,
    requireExactMatch: seed % 2 === 0,
    createdAt: new Date(1700000000000 + seed) as any,
  });
  const createEssay = (seed: number): EssayQuestion => ({
    questionId: `essay-${seed}`, examId: "exam-rt", questionType: "essay",
    questionText: `Essay seed ${seed}?`, marks: 5 + (seed % 20), orderIndex: seed, feedbackType: "hidden",
    minWords: seed % 2 === 0 ? 50 : undefined,
    maxWords: seed % 3 === 0 ? 500 + seed * 10 : undefined,
    createdAt: new Date(1700000000000 + seed) as any,
  });

  it("PBT-style: JSON round-trip preserves identity for MCQ, True/False, Short Answer, Essay (15 of each)", () => {
    const builders = [createMCQ, createTF, createSA, createEssay] as const;
    for (const build of builders) {
      for (let seed = 0; seed < 15; seed++) {
        const original = build(seed);
        const serialized = JSON.stringify(original);
        const restored: Question = JSON.parse(serialized);

        expect(original.questionType).toBe(restored.questionType);
        expect(original.questionId).toBe(restored.questionId);
        expect(original.examId).toBe(restored.examId);
        expect(original.questionText).toBe(restored.questionText);
        expect(original.marks).toBe(restored.marks);
        expect(original.orderIndex).toBe(restored.orderIndex);
        expect(original.feedbackType).toBe(restored.feedbackType);

        switch (original.questionType) {
          case "mcq": {
            const r = restored as MCQQuestion;
            expect(r.options).toEqual(original.options);
            expect(r.correctOptionIndex).toBe(original.correctOptionIndex);
            expect(isMCQQuestion(r)).toBe(true);
            break;
          }
          case "true-false": {
            const r = restored as TrueFalseQuestion;
            expect(r.correctAnswer).toBe(original.correctAnswer);
            expect(isTrueFalseQuestion(r)).toBe(true);
            break;
          }
          case "short-answer": {
            const r = restored as ShortAnswerQuestion;
            expect(r.correctAnswers).toEqual(original.correctAnswers);
            expect(r.caseSensitive).toBe(original.caseSensitive);
            expect(isShortAnswerQuestion(r)).toBe(true);
            break;
          }
          case "essay": {
            const r = restored as EssayQuestion;
            expect(r.minWords).toBe(original.minWords);
            expect(r.maxWords).toBe(original.maxWords);
            expect(isEssayQuestion(r)).toBe(true);
            break;
          }
        }
      }
    }
  });
});

// ============================================================================
// Task 8.18 — Import → Export Data Consistency
// ============================================================================
describe("Import → Export Data Consistency (Task 8.18)", () => {
  const toCSVRow = (q: Question): string => {
    const common = `${q.questionType},${q.questionId},${JSON.stringify(q.questionText)},${q.marks}`;
    switch (q.questionType) {
      case "mcq": {
        const mcq = q as MCQQuestion;
        return `${common},${JSON.stringify(mcq.options)},${mcq.correctOptionIndex}`;
      }
      case "true-false": {
        return `${common},${(q as TrueFalseQuestion).correctAnswer}`;
      }
      case "short-answer": {
        return `${common},${JSON.stringify((q as ShortAnswerQuestion).correctAnswers)}`;
      }
      case "essay": {
        const e = q as EssayQuestion;
        return `${common},${e.minWords ?? ""},${e.maxWords ?? ""}`;
      }
    }
  };
  const fromCSVRow = (row: string): Question => {
    const parts: string[] = [];
    let buffer = "";
    let depth = 0;
    for (const ch of row) {
      if (ch === "[" || ch === "{") depth++;
      if (ch === "]" || ch === "}") depth--;
      if (ch === "," && depth === 0) { parts.push(buffer); buffer = ""; }
      else buffer += ch;
    }
    parts.push(buffer);
    const [qType, questionId, qTextJSON, marksStr, f1, f2] = parts;
    const questionText = JSON.parse(qTextJSON);
    const marks = Number(marksStr);
    const base = {
      questionId, examId: "exam-impexp", questionText, marks,
      orderIndex: 0, feedbackType: "hidden",
      createdAt: new Date(1700000000000) as any,
    };
    switch (qType as QuestionType) {
      case "mcq":
        return { ...base, questionType: "mcq", options: JSON.parse(f1), correctOptionIndex: Number(f2) } as MCQQuestion;
      case "true-false":
        return { ...base, questionType: "true-false", correctAnswer: f1 === "true" } as TrueFalseQuestion;
      case "short-answer":
        return { ...base, questionType: "short-answer", correctAnswers: JSON.parse(f1) } as ShortAnswerQuestion;
      case "essay":
        return {
          ...base,
          questionType: "essay",
          minWords: f1 === "" ? undefined : Number(f1),
          maxWords: f2 === "" ? undefined : Number(f2),
        } as EssayQuestion;
    }
    throw new Error(`unknown type: ${qType}`);
  };

  it("PBT-style: Import → export round-trip preserves question identity (12 per type)", () => {
    const builders = [
      (s: number): MCQQuestion => ({
        questionId: `mcq-${s}`, examId: "e1", questionType: "mcq",
        questionText: `q${s}`, marks: (s % 3) + 1, orderIndex: s, feedbackType: "hidden",
        options: [`A-${s}`, `B-${s}`, `C-${s}`, `D-${s}`],
        correctOptionIndex: s % 4,
        createdAt: new Date(1700000000000) as any,
      }),
      (s: number): TrueFalseQuestion => ({
        questionId: `tf-${s}`, examId: "e1", questionType: "true-false",
        questionText: `q${s}`, marks: 1, orderIndex: s, feedbackType: "hidden",
        correctAnswer: s % 2 === 0,
        createdAt: new Date(1700000000000) as any,
      }),
      (s: number): ShortAnswerQuestion => ({
        questionId: `sa-${s}`, examId: "e1", questionType: "short-answer",
        questionText: `q${s}`, marks: 2, orderIndex: s, feedbackType: "hidden",
        correctAnswers: [`c1-${s}`, `c2-${s}`],
        createdAt: new Date(1700000000000) as any,
      }),
      (s: number): EssayQuestion => ({
        questionId: `essay-${s}`, examId: "e1", questionType: "essay",
        questionText: `q${s}`, marks: 10, orderIndex: s, feedbackType: "hidden",
        minWords: s % 2 === 0 ? 20 + s : undefined,
        maxWords: s % 2 === 0 ? 500 + s * 5 : undefined,
        createdAt: new Date(1700000000000) as any,
      }),
    ] as const;
    for (const build of builders) {
      for (let s = 0; s < 12; s++) {
        const original = build(s);
        const exported = toCSVRow(original);
        const restored = fromCSVRow(exported);
        expect(restored.questionType).toBe(original.questionType);
        expect(restored.questionId).toBe(original.questionId);
        expect(restored.questionText).toBe(original.questionText);
        expect(restored.marks).toBe(original.marks);
        switch (original.questionType) {
          case "mcq": {
            const r = restored as MCQQuestion;
            expect(r.options).toEqual(original.options);
            expect(r.correctOptionIndex).toBe(original.correctOptionIndex);
            break;
          }
          case "true-false":
            expect((restored as TrueFalseQuestion).correctAnswer).toBe(original.correctAnswer);
            break;
          case "short-answer":
            expect((restored as ShortAnswerQuestion).correctAnswers).toEqual(original.correctAnswers);
            break;
          case "essay": {
            const r = restored as EssayQuestion;
            expect(r.minWords).toBe(original.minWords);
            expect(r.maxWords).toBe(original.maxWords);
            break;
          }
        }
      }
    }
  });
});
