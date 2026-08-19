/**
 * Question Evaluation Engine
 * Evaluates answers for all question types in both Practice and Exam modes
 */

import {
  Question,
  isMCQQuestion,
  isTrueFalseQuestion,
  isShortAnswerQuestion,
  isEssayQuestion,
  evaluateTextAnswer,
} from "@/integrations/firebase/types";
import { evaluateShortAnswerWithMath } from "@/lib/math-answer-evaluator";

export interface EvaluationResult {
  isCorrect: boolean;
  earnedMarks: number;
  totalMarks: number;
  feedback?: string;
  explanation?: string;
}

/**
 * Evaluate an MCQ answer
 */
export function evaluateMCQ(
  question: Question,
  selectedOptionIndex: number | null
): EvaluationResult {
  if (!isMCQQuestion(question)) {
    throw new Error("Question is not MCQ type");
  }

  const marks = question.marks ?? 0;

  if (selectedOptionIndex === null || selectedOptionIndex === undefined) {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: marks,
      feedback: "You skipped this question",
    };
  }

  const isCorrect = selectedOptionIndex === question.correctOptionIndex;
  const earnedMarks = isCorrect ? marks : 0;

  return {
    isCorrect,
    earnedMarks,
    totalMarks: marks,
    feedback: isCorrect
      ? (marks > 0 ? `Correct! You earned ${earnedMarks} marks` : "Correct!")
      : `Incorrect. The correct answer is: ${question.options[question.correctOptionIndex]}`,
    explanation: question.explanation,
  };
}

/**
 * Evaluate a True/False answer
 */
export function evaluateTrueFalse(
  question: Question,
  selectedBoolean: boolean | null
): EvaluationResult {
  if (!isTrueFalseQuestion(question)) {
    throw new Error("Question is not True/False type");
  }

  const marks = question.marks ?? 0;

  if (selectedBoolean === null || selectedBoolean === undefined) {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: marks,
      feedback: "You skipped this question",
    };
  }

  const isCorrect = selectedBoolean === question.correctAnswer;
  const earnedMarks = isCorrect ? marks : 0;

  return {
    isCorrect,
    earnedMarks,
    totalMarks: marks,
    feedback: isCorrect
      ? (marks > 0 ? `Correct! You earned ${earnedMarks} marks` : "Correct!")
      : `Incorrect. The correct answer is: ${question.correctAnswer ? "True" : "False"}`,
    explanation: question.explanation,
  };
}

/**
 * Evaluate a Short Answer
 * If manual grading is enabled, returns pending status
 * If no correct answers provided, any non-empty answer is accepted
 * If no marks set, returns 0 marks
 * Uses math-aware evaluation for mathematical answers
 */
export function evaluateShortAnswer(
  question: Question,
  textAnswer: string | null
): EvaluationResult {
  if (!isShortAnswerQuestion(question)) {
    throw new Error("Question is not Short Answer type");
  }

  const marks = question.marks ?? 0;
  const requiresManualGrading = question.requiresManualGrading === true;

  if (!textAnswer || textAnswer.trim() === "") {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: marks,
      feedback: "You skipped this question",
    };
  }

  // If manual grading is required, return pending
  if (requiresManualGrading) {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: marks,
      feedback: "Your answer has been submitted and is pending review",
      explanation: question.explanation,
    };
  }

  // If no correct answers provided, accept any non-empty answer
  if (!question.correctAnswers || question.correctAnswers.length === 0) {
    return {
      isCorrect: true,
      earnedMarks: marks,
      totalMarks: marks,
      feedback: marks > 0 ? `Correct! You earned ${marks} marks` : "Submitted",
      explanation: question.explanation,
    };
  }

  // Use math-aware evaluation for short answers
  // This automatically detects mathematical content and evaluates accordingly
  const isCorrect = evaluateShortAnswerWithMath(question, textAnswer);

  const earnedMarks = isCorrect ? marks : 0;

  return {
    isCorrect,
    earnedMarks,
    totalMarks: marks,
    feedback: isCorrect
      ? (marks > 0 ? `Correct! You earned ${marks} marks` : "Correct!")
      : `Incorrect. Expected answers: ${question.correctAnswers.join(", ")}`,
    explanation: question.explanation,
  };
}

/**
 * Evaluate an Essay (always returns pending - requires manual grading)
 * If requiresManualGrading not set, defaults to true
 */
export function evaluateEssay(
  question: Question,
  textAnswer: string | null
): EvaluationResult {
  if (!isEssayQuestion(question)) {
    throw new Error("Question is not Essay type");
  }

  const marks = question.marks ?? 0;
  const requiresManualGrading = question.requiresManualGrading !== false; // Defaults to true

  const wordCount = textAnswer ? textAnswer.trim().split(/\s+/).length : 0;

  // Check word count limits
  if (question.minWords && wordCount < question.minWords) {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: marks,
      feedback: `Your essay is too short. Minimum: ${question.minWords} words, Your: ${wordCount} words`,
    };
  }

  if (question.maxWords && wordCount > question.maxWords) {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: marks,
      feedback: `Your essay is too long. Maximum: ${question.maxWords} words, Your: ${wordCount} words`,
    };
  }

  // Essays return pending if manual grading required, otherwise just submitted
  if (requiresManualGrading) {
    return {
      isCorrect: false,
      earnedMarks: 0,
      totalMarks: marks,
      feedback: "Your essay has been submitted and is pending review",
      explanation: question.explanation,
    };
  }

  // If manual grading not required, treat as accepted
  return {
    isCorrect: true,
    earnedMarks: marks,
    totalMarks: marks,
    feedback: marks > 0 ? `Submitted! You earned ${marks} marks` : "Submitted",
    explanation: question.explanation,
  };
}

/**
 * Unified evaluation function - automatically routes to correct evaluator
 */
export function evaluateQuestion(
  question: Question,
  answer: string | number | boolean | null
): EvaluationResult {
  if (isMCQQuestion(question)) {
    return evaluateMCQ(question, answer as number | null);
  } else if (isTrueFalseQuestion(question)) {
    return evaluateTrueFalse(question, answer as boolean | null);
  } else if (isShortAnswerQuestion(question)) {
    return evaluateShortAnswer(question, answer as string | null);
  } else if (isEssayQuestion(question)) {
    return evaluateEssay(question, answer as string | null);
  } else {
    throw new Error("Unknown question type");
  }
}

/**
 * Batch evaluate all answers
 */
export function batchEvaluateAnswers(
  questions: Question[],
  answers: Map<string, string | number | boolean | null>
): EvaluationResult[] {
  return questions.map((question) => {
    const answer = answers.get(question.questionId) ?? null;
    return evaluateQuestion(question, answer);
  });
}

/**
 * Calculate overall exam score
 */
export interface ExamScore {
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  passStatus: "pass" | "fail";
  correctCount: number;
  incorrectCount: number;
  pendingCount: number; // Essays and other manual grading
  skippedCount: number;
}

export function calculateExamScore(
  evaluationResults: EvaluationResult[],
  passingPercentage: number = 50
): ExamScore {
  let totalMarks = 0;
  let maxMarks = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let pendingCount = 0;
  let skippedCount = 0;

  evaluationResults.forEach((result) => {
    maxMarks += result.totalMarks;
    totalMarks += result.earnedMarks;

    if (result.feedback?.includes("skipped")) {
      skippedCount++;
    } else if (result.feedback?.includes("pending")) {
      pendingCount++;
    } else if (result.isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  const percentage =
    maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
  const passStatus =
    percentage >= passingPercentage ? "pass" : "fail";

  return {
    totalMarks,
    maxMarks,
    percentage,
    passStatus,
    correctCount,
    incorrectCount,
    pendingCount,
    skippedCount,
  };
}
