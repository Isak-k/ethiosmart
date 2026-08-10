/**
 * Question Validator
 * Validates questions before saving to Firestore
 * Ensures type-specific requirements are met
 */

import { NewQuestionInput, getNewQuestionSchema } from "./validations";
import { ZodError } from "zod";

export interface ValidationError {
  field: string;
  message: string;
  path?: (string | number)[];
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

/**
 * Validate question data before saving
 * Uses the schema from validations.ts
 */
export function validateQuestionBeforeSave(
  questionData: NewQuestionInput,
  t?: any
): ValidationResult {
  try {
    // Get schema with translations if provided
    const schema = t ? getNewQuestionSchema(t) : getNewQuestionSchema(() => "");
    
    // Validate using the schema
    schema.parse(questionData);
    
    return { valid: true };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        path: err.path,
      }));
      
      return {
        valid: false,
        errors,
      };
    }
    
    // Unknown error
    return {
      valid: false,
      errors: [
        {
          field: "unknown",
          message: "An unknown validation error occurred",
        },
      ],
    };
  }
}

/**
 * Validate specific question fields based on type
 * Useful for detailed field-level validation feedback
 */
export function validateQuestionField(
  questionType: string,
  fieldName: string,
  value: any
): { valid: boolean; error?: string } {
  // Type-specific field validation
  switch (questionType) {
    case "mcq":
      if (fieldName === "options") {
        if (!Array.isArray(value) || value.length < 2) {
          return { valid: false, error: "At least 2 options are required" };
        }
        if (value.some((opt) => !opt || opt.trim() === "")) {
          return { valid: false, error: "All options must be non-empty" };
        }
        if (value.length > 6) {
          return { valid: false, error: "Maximum 6 options allowed" };
        }
      }
      if (fieldName === "correctOptionIndex") {
        if (typeof value !== "number" || value < 0) {
          return { valid: false, error: "Invalid option index" };
        }
      }
      break;

    case "true-false":
      if (fieldName === "correctAnswer") {
        if (typeof value !== "boolean") {
          return { valid: false, error: "Correct answer must be true or false" };
        }
      }
      break;

    case "short-answer":
      if (fieldName === "correctAnswers") {
        if (!Array.isArray(value) || value.length < 1) {
          return { valid: false, error: "At least one acceptable answer is required" };
        }
        if (value.some((ans) => !ans || ans.trim() === "")) {
          return { valid: false, error: "All answers must be non-empty" };
        }
      }
      break;

    case "essay":
      if (fieldName === "minWords" || fieldName === "maxWords") {
        if (value !== undefined && (typeof value !== "number" || value < 0)) {
          return { valid: false, error: "Word count must be a positive number" };
        }
      }
      break;
  }

  return { valid: true };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors?: ValidationError[]): string[] {
  if (!errors || errors.length === 0) return [];
  
  return errors.map((err) => {
    // Format field name for display (convert camelCase to Title Case)
    const fieldName = err.field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
    
    return `${fieldName}: ${err.message}`;
  });
}

/**
 * Check if question has required fields for its type
 */
export function hasRequiredFields(questionData: NewQuestionInput): boolean {
  // Common required fields for all types
  if (!questionData.questionText || !questionData.questionText.trim()) {
    return false;
  }
  
  if (!questionData.marks || questionData.marks < 1) {
    return false;
  }

  // Type-specific required fields
  switch (questionData.questionType) {
    case "mcq":
      if (
        !("options" in questionData) ||
        !questionData.options ||
        questionData.options.length < 2 ||
        typeof questionData.correctOptionIndex !== "number"
      ) {
        return false;
      }
      break;

    case "true-false":
      if (!("correctAnswer" in questionData) || typeof questionData.correctAnswer !== "boolean") {
        return false;
      }
      break;

    case "short-answer":
      if (!("correctAnswers" in questionData) || !questionData.correctAnswers || questionData.correctAnswers.length < 1) {
        return false;
      }
      break;

    case "essay":
      // Essays only require question text and marks
      break;

    default:
      return false;
  }

  return true;
}
