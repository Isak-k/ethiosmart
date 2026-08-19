import { z } from "zod";

// Auth validations
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be less than 72 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  role: z.enum(["admin", "student"]),
});

export const passwordResetSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

export const newPasswordSchema = z.object({
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be less than 72 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Exam validations
export const examSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be less than 1000 characters")
    .optional(),
  duration_minutes: z
    .number()
    .min(1, "Duration must be at least 1 minute")
    .max(480, "Duration cannot exceed 8 hours"),
  max_attempts: z
    .number()
    .min(1, "Must allow at least 1 attempt")
    .max(10, "Cannot exceed 10 attempts"),
});

export const questionSchema = z.object({
  question_text: z
    .string()
    .trim()
    .min(1, "Question text is required")
    .max(2000, "Question must be less than 2000 characters"),
  options: z
    .array(z.string().trim().min(1, "Option cannot be empty"))
    .min(2, "At least 2 options are required")
    .max(6, "Maximum 6 options allowed"),
  correct_option_index: z
    .number()
    .min(0, "Please select a correct answer"),
  marks: z
    .number()
    .min(1, "Marks must be at least 1")
    .max(100, "Marks cannot exceed 100"),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
export type ExamInput = z.infer<typeof examSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;

// Localized Schema Factories
export const getLoginSchema = (t: any) => z.object({
  email: z
    .string()
    .trim()
    .min(1, t("validations.required", { field: t("common.email") }))
    .email(t("validations.email.invalid"))
    .max(255, t("validations.email.max")),
  password: z
    .string()
    .min(1, t("validations.required", { field: t("common.password") }))
    .min(6, t("validations.password.min")),
});

export const getSignupSchema = (t: any) => z.object({
  name: z
    .string()
    .trim()
    .min(1, t("validations.required", { field: t("common.fullName") }))
    .max(100, t("validations.name.max"))
    .regex(/^[a-zA-Z\s'-]+$/, t("validations.name.pattern")),
  email: z
    .string()
    .trim()
    .min(1, t("validations.required", { field: t("common.email") }))
    .email(t("validations.email.invalid"))
    .max(255, t("validations.email.max")),
  password: z
    .string()
    .min(6, t("validations.password.min"))
    .max(72, t("validations.password.max"))
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      t("validations.password.complexity")
    ),
  role: z.enum(["admin", "student"]),
});

export const getPasswordResetSchema = (t: any) => z.object({
  email: z
    .string()
    .trim()
    .min(1, t("validations.required", { field: t("common.email") }))
    .email(t("validations.email.invalid")),
});

export const getNewPasswordSchema = (t: any) => z.object({
  password: z
    .string()
    .min(6, t("validations.password.min"))
    .max(72, t("validations.password.max"))
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      t("validations.password.complexity")
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: t("validations.password.match"),
  path: ["confirmPassword"],
});

export const getExamSchema = (t: any) => z.object({
  title: z
    .string()
    .trim()
    .min(1, t("validations.required", { field: t("admin.exams.form.title") }))
    .max(200, t("validations.exam.titleMax")),
  description: z
    .string()
    .trim()
    .max(1000, t("validations.exam.descMax"))
    .optional(),
  duration_minutes: z
    .number()
    .min(1, t("validations.exam.durationMin"))
    .max(480, t("validations.exam.durationMax")),
  max_attempts: z
    .number()
    .min(1, t("validations.exam.attemptsMin"))
    .max(10, t("validations.exam.attemptsMax")),
});

export const getQuestionSchema = (t: any) => z.object({
  question_text: z
    .string()
    .trim()
    .min(1, t("validations.required", { field: t("admin.exams.questions.questionText") }))
    .max(2000, t("validations.question.textMax")),
  options: z
    .array(z.string().trim().min(1, t("validations.question.optionEmpty")))
    .min(2, t("validations.question.optionsMin"))
    .max(6, t("validations.question.optionsMax")),
  correct_option_index: z
    .number()
    .min(0, t("validations.question.correctOption")),
  marks: z
    .number()
    .min(1, t("validations.question.marksMin"))
    .max(100, t("validations.question.marksMax")),
});


// New Question Type Schemas

// Base schema for all questions
export const baseQuestionSchema = z.object({
  questionText: z
    .string()
    .trim()
    .min(1, "Question text is required")
    .max(2000, "Question text must be less than 2000 characters"),
  marks: z
    .number()
    .min(1, "Marks must be at least 1")
    .max(100, "Marks cannot exceed 100"),
  feedbackType: z.enum(["instant", "hidden"]),
  explanation: z.union([z.string().trim().max(2000, "Explanation must be less than 2000 characters"), z.literal(null)]).nullable().optional(),
  imageUrl: z.union([z.string().url("Image URL must be valid"), z.literal(null)]).nullable().optional(),
  imageDisplayMode: z.enum(["inline", "background", "main"]).optional(),
});

// MCQ Schema
const mcqBaseSchema = baseQuestionSchema.extend({
  questionType: z.literal("mcq"),
  options: z
    .array(z.string().trim().min(1, "Option cannot be empty"))
    .min(2, "At least 2 options are required")
    .max(6, "Maximum 6 options allowed"),
  correctOptionIndex: z
    .number()
    .int("Must be a whole number")
    .min(0, "Invalid option index"),
});

export const mcqQuestionSchema = mcqBaseSchema.superRefine((data, ctx) => {
  if (data.correctOptionIndex >= data.options.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Correct option index must be within options range",
      path: ["correctOptionIndex"],
    });
  }
});

// True/False Schema
export const trueFalseQuestionSchema = baseQuestionSchema.extend({
  questionType: z.literal("true-false"),
  correctAnswer: z.boolean(),
});

// Short Answer Schema with validation
const shortAnswerBaseSchema = baseQuestionSchema.extend({
  questionType: z.literal("short-answer"),
  correctAnswers: z
    .array(z.string().trim().min(1, "Answer cannot be empty"))
    .min(1, "At least one correct answer is required"),
  caseSensitive: z.boolean().optional(),
  requireExactMatch: z.boolean().optional(),
  requiresManualGrading: z.boolean().optional(),
});

export const shortAnswerQuestionSchema = shortAnswerBaseSchema.superRefine((data, ctx) => {
  // Additional validation: ensure at least one non-empty answer
  if (!data.correctAnswers || data.correctAnswers.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one correct answer is required",
      path: ["correctAnswers"],
    });
  }
  
  // Validate each answer is non-empty
  data.correctAnswers?.forEach((answer, index) => {
    if (!answer || answer.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Answer cannot be empty",
        path: ["correctAnswers", index],
      });
    }
  });
});

// Essay Schema
const essayBaseSchema = baseQuestionSchema.extend({
  questionType: z.literal("essay"),
  minWords: z.number().int().positive("Min words must be positive").optional(),
  maxWords: z.number().int().positive("Max words must be positive").optional(),
  rubricPoints: z
    .array(
      z.object({
        criteria: z.string().trim().min(1, "Criterion cannot be empty"),
        points: z.number().int().min(0, "Points must be zero or positive"),
      })
    )
    .optional(),
});

// Discriminated union for all question types (base validation only)
const baseQuestionUnion = z.discriminatedUnion("questionType", [
  mcqBaseSchema,
  trueFalseQuestionSchema,
  shortAnswerBaseSchema,
  essayBaseSchema,
]);

// Apply additional validations with superRefine
export const newQuestionSchema = baseQuestionUnion.superRefine((data, ctx) => {
  // MCQ validation
  if (data.questionType === "mcq") {
    if (data.correctOptionIndex >= data.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Correct option index must be within options range",
        path: ["correctOptionIndex"],
      });
    }
  }
  
  // Short Answer validation
  if (data.questionType === "short-answer") {
    if (!data.correctAnswers || data.correctAnswers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one correct answer is required",
        path: ["correctAnswers"],
      });
    }
    
    data.correctAnswers?.forEach((answer, index) => {
      if (!answer || answer.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Answer cannot be empty",
          path: ["correctAnswers", index],
        });
      }
    });
  }
  
  // Essay validation
  if (data.questionType === "essay") {
    if (data.minWords && data.maxWords && data.minWords > data.maxWords) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum words cannot exceed maximum words",
        path: ["minWords"],
      });
    }
    
    if (data.rubricPoints && data.rubricPoints.length > 0) {
      data.rubricPoints.forEach((rubric: any, index: number) => {
        if (!rubric.criteria || !rubric.criteria.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Rubric criterion ${index + 1} is required`,
            path: ["rubricPoints", index, "criteria"],
          });
        }
      });
    }
  }
});

// Type exports
export type MCQQuestionInput = z.infer<typeof mcqBaseSchema>;
export type TrueFalseQuestionInput = z.infer<typeof trueFalseQuestionSchema>;
export type ShortAnswerQuestionInput = z.infer<typeof shortAnswerQuestionSchema>;
export type EssayQuestionInput = z.infer<typeof essayBaseSchema>;
export type NewQuestionInput = z.infer<typeof newQuestionSchema>;

// Localized schema factories for new question types
export const getNewQuestionSchema = (t: any) => {
  const baseSchema = z.object({
    questionText: z
      .string()
      .trim()
      .min(1, t("validations.required", { field: "Question text" }))
      .max(2000, t("validations.question.textMax")),
    marks: z
      .number()
      .int()
      .min(0, t("validations.question.marksMin"))
      .max(100, t("validations.question.marksMax"))
      .optional(), // Optional - can be 0 or omitted
    feedbackType: z.enum(["instant", "hidden"]),
    explanation: z.union([z.string().trim().max(2000, "Explanation must be less than 2000 characters"), z.literal(null)]).nullable().optional(),
    imageUrl: z.union([z.string().url("Image URL must be valid"), z.literal(null)]).nullable().optional(),
    imageDisplayMode: z.enum(["inline", "background", "main"]).optional(),
  });

  const mcqSchema = baseSchema.extend({
    questionType: z.literal("mcq"),
    options: z
      .array(z.string().trim().min(1, t("validations.question.optionEmpty")))
      .min(2, t("validations.question.optionsMin"))
      .max(6, t("validations.question.optionsMax")),
    correctOptionIndex: z
      .number()
      .int()
      .min(0, t("validations.question.correctOption")),
  });

  const trueFalseSchema = baseSchema.extend({
    questionType: z.literal("true-false"),
    correctAnswer: z.boolean(),
  });

  const shortAnswerSchema = baseSchema.extend({
    questionType: z.literal("short-answer"),
    correctAnswers: z
      .array(z.string().trim().min(1, "Answer cannot be empty"))
      .min(0) // Optional - can have 0 answers
      .optional(), // Optional field
    caseSensitive: z.boolean().optional(),
    requireExactMatch: z.boolean().optional(),
    requiresManualGrading: z.boolean().optional(),
  });

  const essaySchema = baseSchema.extend({
    questionType: z.literal("essay"),
    minWords: z.number().int().positive().optional(),
    maxWords: z.number().int().positive().optional(),
    rubricPoints: z
      .array(
        z.object({
          criteria: z.string().trim().min(1, "Criterion cannot be empty"),
          points: z.number().int().min(0, "Points must be zero or positive"),
        })
      )
      .optional(),
    requiresManualGrading: z.boolean().optional(),
  });

  return z.discriminatedUnion("questionType", [
    mcqSchema,
    trueFalseSchema,
    shortAnswerSchema,
    essaySchema,
  ]).refine((data) => {
    // Custom validation for essay min/max
    if (data.questionType === "essay" && data.minWords && data.maxWords && data.minWords > data.maxWords) {
      return false;
    }
    return true;
  }, {
    message: "Minimum words cannot exceed maximum words",
    path: ["minWords"],
  });
}
