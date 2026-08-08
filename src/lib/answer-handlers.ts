/**
 * Answer Handlers for Different Question Types
 * Handles saving and retrieving answers in both Practice and Exam modes
 */

import { Question } from "@/integrations/firebase/types";

export interface QuestionAnswer {
  questionId: string;
  questionType: string;
  // One of these will be populated depending on question type
  selectedOptionIndex?: number | null; // MCQ
  selectedBoolean?: boolean | null; // True/False
  textAnswer?: string | null; // Short Answer / Essay
}

export interface SaveAnswerParams {
  attemptId: string;
  question: Question;
  answer: string | number | boolean | null;
  timeSpentSeconds?: number;
}

/**
 * Convert answer to storage format based on question type
 */
export function convertAnswerToStorage(
  question: Question,
  answer: string | number | boolean | null
): Partial<QuestionAnswer> {
  switch (question.questionType) {
    case "mcq":
      return {
        selectedOptionIndex: typeof answer === "number" ? answer : null,
      };
    case "true-false":
      return {
        selectedBoolean: typeof answer === "boolean" ? answer : null,
      };
    case "short-answer":
    case "essay":
      return {
        textAnswer: typeof answer === "string" ? answer : null,
      };
    default:
      return {};
  }
}

/**
 * Convert stored answer back to UI format
 */
export function convertStorageToAnswer(
  stored: Partial<QuestionAnswer>
): string | number | boolean | null {
  if (stored.selectedOptionIndex !== undefined) {
    return stored.selectedOptionIndex;
  }
  if (stored.selectedBoolean !== undefined) {
    return stored.selectedBoolean;
  }
  if (stored.textAnswer !== undefined) {
    return stored.textAnswer;
  }
  return null;
}

/**
 * Get answer display text for different question types
 */
export function getAnswerDisplayText(
  question: Question,
  answer: string | number | boolean | null
): string {
  if (answer === null || answer === undefined) {
    return "Not answered";
  }

  switch (question.questionType) {
    case "mcq":
      if (typeof answer === "number") {
        if (question.questionType === "mcq" && "options" in question) {
          return question.options[answer] || "Invalid option";
        }
      }
      return "Not answered";
    case "true-false":
      if (typeof answer === "boolean") {
        return answer ? "True" : "False";
      }
      return "Not answered";
    case "short-answer":
    case "essay":
      return (answer as string) || "No text provided";
    default:
      return "Unknown";
  }
}

/**
 * Validate answer format for submission
 */
export function validateAnswerFormat(
  question: Question,
  answer: string | number | boolean | null
): { valid: boolean; error?: string } {
  switch (question.questionType) {
    case "mcq":
      if (question.questionType === "mcq" && "options" in question) {
        if (typeof answer === "number") {
          if (answer < 0 || answer >= question.options.length) {
            return { valid: false, error: "Invalid option index" };
          }
        }
      }
      return { valid: true };

    case "true-false":
      if (typeof answer !== "boolean" && answer !== null) {
        return { valid: false, error: "Must be true or false" };
      }
      return { valid: true };

    case "short-answer":
    case "essay":
      if (answer !== null && typeof answer !== "string") {
        return { valid: false, error: "Answer must be text" };
      }
      return { valid: true };

    default:
      return { valid: false, error: "Unknown question type" };
  }
}

/**
 * Get placeholder text for input fields
 */
export function getAnswerPlaceholder(questionType: string): string {
  switch (questionType) {
    case "mcq":
      return "Select an option";
    case "true-false":
      return "Select True or False";
    case "short-answer":
      return "Type your answer (supports multiple valid answers)";
    case "essay":
      return "Type your essay response...";
    default:
      return "Answer this question";
  }
}

/**
 * Determine if answer is empty
 */
export function isAnswerEmpty(answer: string | number | boolean | null): boolean {
  if (answer === null || answer === undefined) {
    return true;
  }
  if (typeof answer === "string") {
    return answer.trim() === "";
  }
  return false;
}

/**
 * Get answer summary for results display
 */
export interface AnswerSummary {
  answered: boolean;
  answerText: string;
  marksEarned?: number;
  maxMarks: number;
  isCorrect?: boolean;
  timeSpent?: number;
}

export function getAnswerSummary(
  question: Question,
  answer: string | number | boolean | null,
  isCorrect?: boolean,
  marksEarned?: number,
  timeSpent?: number
): AnswerSummary {
  return {
    answered: !isAnswerEmpty(answer),
    answerText: getAnswerDisplayText(question, answer),
    marksEarned,
    maxMarks: question.marks,
    isCorrect,
    timeSpent,
  };
}
