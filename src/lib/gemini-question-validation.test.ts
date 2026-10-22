import { describe, expect, it } from "vitest";
import {
  GeneratedQuestionValidationError,
  parseGeneratedQuestionResponse,
} from "./gemini-question-validation";
import { GeminiQuestionError, mapGeminiServiceError } from "./gemini-questions";

const mcq = {
  questionText: "Which planet is closest to the Sun?",
  questionType: "mcq",
  options: ["Mercury", "Venus", "Earth", "Mars"],
  correctOptionIndex: 0,
  correctAnswer: "",
  explanation: "Mercury is the closest planet to the Sun.",
};

describe("parseGeneratedQuestionResponse", () => {
  it("accepts a valid response with the requested number and type", () => {
    expect(
      parseGeneratedQuestionResponse(JSON.stringify([mcq]), 1, "mcq"),
    ).toEqual([mcq]);
  });

  it("rejects invalid JSON and the wrong number of questions", () => {
    expect(() => parseGeneratedQuestionResponse("{", 1, "mcq")).toThrow(
      GeneratedQuestionValidationError,
    );
    expect(() => parseGeneratedQuestionResponse("[]", 1, "mcq")).toThrow(
      /instead of 1/,
    );
  });

  it("rejects missing, empty, or duplicate MCQ options", () => {
    for (const options of [
      ["Mercury", "Venus", "Earth"],
      ["Mercury", "", "Earth", "Mars"],
      ["Mercury", "Venus", "Venus", "Mars"],
    ]) {
      expect(() =>
        parseGeneratedQuestionResponse(JSON.stringify([{ ...mcq, options }]), 1, "mcq"),
      ).toThrow(GeneratedQuestionValidationError);
    }
  });

  it("rejects invalid answer indexes, unsupported types, and duplicate questions", () => {
    expect(() =>
      parseGeneratedQuestionResponse(
        JSON.stringify([{ ...mcq, correctOptionIndex: 4 }]),
        1,
        "mcq",
      ),
    ).toThrow(/one correct option/);
    expect(() =>
      parseGeneratedQuestionResponse(JSON.stringify([mcq]), 1, "essay"),
    ).toThrow(/wrong question type/);
    expect(() =>
      parseGeneratedQuestionResponse(
        JSON.stringify([mcq, { ...mcq, questionText: "  WHICH PLANET IS CLOSEST TO THE SUN? " }]),
        2,
        "mcq",
      ),
    ).toThrow(/duplicate questions/);
  });

  it("validates every ExamPro question type", () => {
    const questions = [
      mcq,
      {
        ...mcq,
        questionText: "Is water composed of hydrogen and oxygen?",
        questionType: "truefalse",
        options: ["True", "False"],
        correctOptionIndex: 0,
      },
      {
        ...mcq,
        questionText: "What is the chemical symbol for water?",
        questionType: "shortanswer",
        options: [],
        correctOptionIndex: -1,
        correctAnswer: "H2O",
      },
      {
        ...mcq,
        questionText: "Explain the water cycle.",
        questionType: "essay",
        options: [],
        correctOptionIndex: -1,
      },
    ];

    expect(
      parseGeneratedQuestionResponse(JSON.stringify(questions), 4, "mixed"),
    ).toHaveLength(4);
  });
});

describe("mapGeminiServiceError", () => {
  it("classifies only model-specific availability errors as model errors", () => {
    expect(
      mapGeminiServiceError(new Error("Model gemini-test not found (404)")).code,
    ).toBe("model-unavailable");
    expect(
      mapGeminiServiceError(new Error("404 endpoint not found")).code,
    ).toBe("service");
    expect(
      mapGeminiServiceError(new Error("Firebase AI Logic API not enabled")).code,
    ).toBe("not-configured");
    expect(
      mapGeminiServiceError(new Error("Firebase API key is invalid")).message,
    ).toContain("web API key was rejected");
    expect(
      mapGeminiServiceError(new Error("Internal model service failure")).code,
    ).toBe("service");
  });

  it("provides distinct quota and network messages", () => {
    const quota = mapGeminiServiceError(new Error("429 RESOURCE_EXHAUSTED"));
    const network = mapGeminiServiceError(new Error("Failed to fetch"));
    expect(quota.code).toBe("quota");
    expect(network.code).toBe("network");
    expect(mapGeminiServiceError(quota)).toBeInstanceOf(GeminiQuestionError);
  });

  it("does not treat Firebase AI HTTP responses as internet failures", () => {
    const responseError = (status: number) =>
      Object.assign(new Error(`Firebase request failed with status ${status}`), {
        code: "fetch-error",
        customErrorData: { status },
      });

    expect(mapGeminiServiceError(responseError(401)).code).toBe("not-configured");
    expect(mapGeminiServiceError(responseError(401)).message).toContain(
      "VITE_FIREBASE_*",
    );
    expect(mapGeminiServiceError(responseError(403)).message).toContain("HTTP 403");
    expect(mapGeminiServiceError(responseError(429)).code).toBe("quota");
    expect(mapGeminiServiceError(responseError(404)).code).toBe("model-unavailable");
    expect(
      mapGeminiServiceError(Object.assign(new Error("Failed to fetch"), { code: "fetch-error" })).code,
    ).toBe("network");
  });
});
