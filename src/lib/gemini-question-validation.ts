import { z } from "zod";

export const GENERATED_QUESTION_TYPES = [
  "mcq",
  "truefalse",
  "shortanswer",
  "essay",
] as const;

export type GeneratedQuestionType = (typeof GENERATED_QUESTION_TYPES)[number];
export type GenerationQuestionType = GeneratedQuestionType | "mixed";
export type QuestionDifficulty = "Easy" | "Medium" | "Hard";
export type QuestionLanguage = "English" | "Afaan Oromoo" | "Amharic";

const questionSchema = z
  .object({
    questionText: z.string(),
    questionType: z.enum(GENERATED_QUESTION_TYPES),
    options: z.array(z.string()),
    correctOptionIndex: z.number().int(),
    correctAnswer: z.string(),
    explanation: z.string(),
  })
  .strict();

export type GeneratedQuestion = z.infer<typeof questionSchema>;

export class GeneratedQuestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeneratedQuestionValidationError";
  }
}

function normalize(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function validateQuestion(question: GeneratedQuestion, index: number): void {
  const number = index + 1;
  if (!question.questionText.trim()) {
    throw new GeneratedQuestionValidationError(`Question ${number} has no question text.`);
  }
  if (!question.explanation.trim()) {
    throw new GeneratedQuestionValidationError(`Question ${number} has no explanation.`);
  }

  if (question.questionType === "mcq") {
    if (question.options.length !== 4 || question.options.some((option) => !option.trim())) {
      throw new GeneratedQuestionValidationError(
        `Question ${number} must have exactly four nonempty options.`,
      );
    }
    if (new Set(question.options.map(normalize)).size !== 4) {
      throw new GeneratedQuestionValidationError(`Question ${number} contains duplicate options.`);
    }
    if (question.correctOptionIndex < 0 || question.correctOptionIndex >= 4) {
      throw new GeneratedQuestionValidationError(
        `Question ${number} must identify exactly one correct option.`,
      );
    }
    return;
  }

  if (question.questionType === "truefalse") {
    if (
      question.options.length !== 2 ||
      normalize(question.options[0]) !== "true" ||
      normalize(question.options[1]) !== "false" ||
      ![0, 1].includes(question.correctOptionIndex)
    ) {
      throw new GeneratedQuestionValidationError(
        `Question ${number} must have True and False options and one correct answer.`,
      );
    }
    return;
  }

  if (question.options.length !== 0 || question.correctOptionIndex !== -1) {
    throw new GeneratedQuestionValidationError(
      `Question ${number} must not contain choice options or a choice-answer index.`,
    );
  }

  if (question.questionType === "shortanswer" && !question.correctAnswer.trim()) {
    throw new GeneratedQuestionValidationError(
      `Question ${number} must include a reference answer.`,
    );
  }
}

export function parseGeneratedQuestionResponse(
  responseText: string,
  expectedCount: number,
  requestedType: GenerationQuestionType,
): GeneratedQuestion[] {
  let value: unknown;
  try {
    value = JSON.parse(responseText);
  } catch {
    throw new GeneratedQuestionValidationError(
      "The AI response was not valid JSON. Please generate the questions again.",
    );
  }

  const parsed = z.array(questionSchema).safeParse(value);
  if (!parsed.success) {
    throw new GeneratedQuestionValidationError(
      "The AI response did not match the required question format. Please try again.",
    );
  }
  if (parsed.data.length !== expectedCount) {
    throw new GeneratedQuestionValidationError(
      `The AI returned ${parsed.data.length} questions instead of ${expectedCount}. Please try again.`,
    );
  }

  const questionTexts = new Set<string>();
  parsed.data.forEach((question, index) => {
    validateQuestion(question, index);
    if (requestedType !== "mixed" && question.questionType !== requestedType) {
      throw new GeneratedQuestionValidationError(
        `Question ${index + 1} has the wrong question type. Please try again.`,
      );
    }

    const normalizedText = normalize(question.questionText);
    if (questionTexts.has(normalizedText)) {
      throw new GeneratedQuestionValidationError(
        "The AI returned duplicate questions. Please generate them again.",
      );
    }
    questionTexts.add(normalizedText);
  });

  return parsed.data;
}
