import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerateQuestionsDialog } from "./GenerateQuestionsDialog";
import { getExam, saveQuestionsBatch } from "@/lib/firebase-exams";
import { generateExamQuestions } from "@/lib/gemini-questions";

const { canEditMock } = vi.hoisted(() => ({
  canEditMock: vi.fn(() => true),
}));

vi.mock("@/hooks/useSectionPermissions", () => ({
  useSectionPermissions: () => ({ canEdit: canEditMock }),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/lib/firebase-exams", () => ({
  getExam: vi.fn(),
  saveQuestionsBatch: vi.fn(),
}));
vi.mock("@/lib/gemini-questions", () => ({
  generateExamQuestions: vi.fn(),
  GeminiQuestionError: class GeminiQuestionError extends Error {},
  MAX_GENERATED_QUESTIONS: 20,
}));

const generatedQuestion = {
  questionText: "Which planet is closest to the Sun?",
  questionType: "mcq" as const,
  options: ["Mercury", "Venus", "Earth", "Mars"],
  correctOptionIndex: 0,
  correctAnswer: "",
  explanation: "Mercury is closest to the Sun.",
};

describe("GenerateQuestionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canEditMock.mockReturnValue(true);
  });

  it("keeps generated questions in preview until the administrator approves saving", async () => {
    vi.mocked(generateExamQuestions).mockResolvedValue([generatedQuestion]);
    const onImportSuccess = vi.fn();
    render(
      <GenerateQuestionsDialog
        examId="exam-1"
        examTitle="Science"
        isPublished={false}
        currentQuestionCount={0}
        onImportSuccess={onImportSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate with Gemini" }));
    fireEvent.change(screen.getByLabelText("Topic or chapter"), {
      target: { value: "The Solar System" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate questions" }));

    await screen.findByRole("region", { name: "Generated question preview" });
    expect(saveQuestionsBatch).not.toHaveBeenCalled();
    expect(getExam).not.toHaveBeenCalled();
    expect(onImportSuccess).not.toHaveBeenCalled();

    vi.mocked(getExam).mockResolvedValue({ isPublished: false } as never);
    vi.mocked(saveQuestionsBatch).mockResolvedValue({ addedCount: 1, skippedCount: 0 });
    fireEvent.click(
      screen.getByRole("button", { name: "Approve and save 1 remaining" }),
    );

    await waitFor(() => expect(saveQuestionsBatch).toHaveBeenCalledTimes(1));
    expect(onImportSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not expose generation to an administrator without exam edit permission", () => {
    canEditMock.mockReturnValue(false);
    render(
      <GenerateQuestionsDialog
        examId="exam-1"
        examTitle="Science"
        isPublished={false}
        currentQuestionCount={0}
        onImportSuccess={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Generate with Gemini" })).toBeNull();
  });

  it("discards a response when generation is cancelled", async () => {
    let resolveGeneration!: (questions: typeof generatedQuestion[]) => void;
    vi.mocked(generateExamQuestions).mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      }),
    );
    render(
      <GenerateQuestionsDialog
        examId="exam-1"
        examTitle="Science"
        isPublished={false}
        currentQuestionCount={0}
        onImportSuccess={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate with Gemini" }));
    fireEvent.change(screen.getByLabelText("Topic or chapter"), {
      target: { value: "The Solar System" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate questions" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel without saving" }));

    await act(async () => {
      resolveGeneration([generatedQuestion]);
    });

    expect(screen.queryByRole("region", { name: "Generated question preview" })).toBeNull();
    expect(saveQuestionsBatch).not.toHaveBeenCalled();
  });

  it("rejects saving if the exam was published after the preview opened", async () => {
    vi.mocked(generateExamQuestions).mockResolvedValue([generatedQuestion]);
    vi.mocked(getExam).mockResolvedValue({ isPublished: true } as never);
    render(
      <GenerateQuestionsDialog
        examId="exam-1"
        examTitle="Science"
        isPublished={false}
        currentQuestionCount={0}
        onImportSuccess={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate with Gemini" }));
    fireEvent.change(screen.getByLabelText("Topic or chapter"), {
      target: { value: "The Solar System" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate questions" }));
    await screen.findByRole("region", { name: "Generated question preview" });
    fireEvent.click(
      screen.getByRole("button", { name: "Approve and save 1 remaining" }),
    );

    expect(
      await screen.findByText(/unpublish it before saving AI-generated questions/i),
    ).toBeInTheDocument();
    expect(saveQuestionsBatch).not.toHaveBeenCalled();
  });
});
