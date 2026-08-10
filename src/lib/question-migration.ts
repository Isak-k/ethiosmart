/**
 * Question Migration Utility
 * Ensures backward compatibility with existing MCQ questions
 * Automatically converts legacy question format to new typed format
 */

import { Question, MCQQuestion } from "@/integrations/firebase/types";
import { Timestamp } from "firebase/firestore";

export interface LegacyQuestion {
  questionId: string;
  examId: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  marks: number;
  orderIndex: number;
  feedbackType: "instant" | "hidden";
  explanation?: string;
  createdAt: Timestamp;
  questionType?: never; // Not present in legacy questions
}

/**
 * Check if a question is in legacy format (MCQ without questionType field)
 */
export function isLegacyQuestion(
  question: any
): question is LegacyQuestion {
  return (
    question &&
    typeof question === "object" &&
    "options" in question &&
    Array.isArray(question.options) &&
    "correctOptionIndex" in question &&
    !("questionType" in question)
  );
}

/**
 * Migrate legacy MCQ question to new format
 * Preserves all existing data and adds questionType field
 */
export function migrateLegacyQuestion(
  legacyQuestion: LegacyQuestion | any
): Question {
  if (!isLegacyQuestion(legacyQuestion)) {
    // Already in new format or has questionType field
    return legacyQuestion;
  }

  const migratedQuestion: MCQQuestion = {
    ...legacyQuestion,
    questionType: "mcq",
  };

  return migratedQuestion;
}

/**
 * Batch migrate legacy questions
 */
export function migrateLegacyQuestions(questions: any[]): Question[] {
  return questions.map(migrateLegacyQuestion);
}

/**
 * Ensure question has questionType field, add if missing
 */
export function ensureQuestionType(question: any): Question {
  if (question.questionType) {
    return question;
  }

  // If it has options and correctOptionIndex, it's an MCQ
  if (Array.isArray(question.options) && typeof question.correctOptionIndex === "number") {
    return {
      ...question,
      questionType: "mcq",
    };
  }

  // Fallback - shouldn't reach here in normal operation
  console.warn("Question missing questionType and cannot be auto-detected:", question);
  return {
    ...question,
    questionType: "mcq", // Assume MCQ as fallback
  };
}

/**
 * Safe question type accessor with fallback
 */
export function getQuestionType(question: any): string {
  return question.questionType || (Array.isArray(question.options) ? "mcq" : "unknown");
}

/**
 * Validate that migrated question maintains data integrity
 */
export function validateMigration(
  original: LegacyQuestion | any,
  migrated: Question
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all original fields are preserved
  if (migrated.questionId !== original.questionId) {
    errors.push("questionId was not preserved");
  }
  if (migrated.questionText !== original.questionText) {
    errors.push("questionText was not preserved");
  }
  if (migrated.marks !== original.marks) {
    errors.push("marks was not preserved");
  }

  // Check MCQ-specific fields if applicable
  if (
    original.options &&
    (!Array.isArray(migrated.options) ||
      JSON.stringify(migrated.options) !== JSON.stringify(original.options))
  ) {
    errors.push("options array was not preserved");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
