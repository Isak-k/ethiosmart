import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionTypeForm } from "./QuestionTypeForm";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Timestamp } from "firebase/firestore";

// Mock dependencies
vi.mock("@/lib/image-handler", () => ({
  uploadQuestionImage: vi.fn(),
  validateImageFile: vi.fn(),
  formatFileSize: vi.fn(() => "1 MB"),
  deleteQuestionImage: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("react-i18next", () => {
  const t = (key: string, options?: any) => {
    if (options?.field) return `${options.field} is required`;
    if (key.includes("optionEmpty")) return "Option cannot be empty";
    if (key.includes("optionsMin")) return "Minimum 2 options required";
    if (key.includes("optionsMax")) return "Maximum 6 options allowed";
    if (key.includes("correctOption")) return "Valid correct option index required";
    if (key.includes("marksMin")) return "Marks must be at least 1";
    if (key.includes("marksMax")) return "Marks cannot exceed 100";
    if (key.includes("textMax")) return "Text cannot exceed 2000 characters";
    if (key.includes("question.")) return key;
    return key;
  };
  return {
    useTranslation: () => ({
      t,
    }),
  };
});

const mockEssayQuestion = {
  questionId: "q4",
  examId: "exam1",
  questionType: "essay" as const,
  questionText: "Discuss climate change",
  marks: 5,
  orderIndex: 3,
  feedbackType: "instant" as const,
  minWords: 100,
  maxWords: 500,
  requiresManualGrading: true,
  createdAt: Timestamp.now(),
};

describe("QuestionTypeForm - Essay Type", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Essay Type Fields", () => {
    it("should display min/max word constraints when Essay type is selected", async () => {
      const user = userEvent.setup();
      render(
        <QuestionTypeForm
          examId="exam1"
          onSubmit={mockOnSubmit}
        />
      );
      
      // Switch to Essay
      const typeSelect = screen.getByRole("combobox");
      await user.click(typeSelect);
      
      const essayOption = screen.getByRole("option", { name: /Essay/i });
      await user.click(essayOption);
      
      // Should show min/max word input fields
      await waitFor(() => {
        const inputs = screen.getAllByPlaceholderText(/No (minimum|maximum)/i);
        expect(inputs.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("should populate essay question data correctly", () => {
      render(
        <QuestionTypeForm
          examId="exam1"
          question={mockEssayQuestion}
          onSubmit={mockOnSubmit}
        />
      );
      
      // Check that essay data is populated
      expect(screen.getByDisplayValue("100")).toBeInTheDocument();
      expect(screen.getByDisplayValue("500")).toBeInTheDocument();
    });

    it("should display word count guidance when constraints are set", () => {
      render(
        <QuestionTypeForm
          examId="exam1"
          question={mockEssayQuestion}
          onSubmit={mockOnSubmit}
        />
      );
      
      // Look for guidance text about word constraints
      const guidance = screen.queryByText(/between 100 and 500 words/i);
      expect(guidance).toBeInTheDocument();
    });

    it("should allow adding rubric criteria", async () => {
      const user = userEvent.setup();
      render(
        <QuestionTypeForm
          examId="exam1"
          question={mockEssayQuestion}
          onSubmit={mockOnSubmit}
        />
      );
      
      const addButton = screen.getByRole("button", { name: /Add Rubric Criterion/i });
      await user.click(addButton);
      
      // Should show new rubric input fields
      await waitFor(() => {
        const criterionInputs = screen.getAllByPlaceholderText(/Criterion/i);
        expect(criterionInputs.length).toBeGreaterThan(0);
      });
    });

    it("should validate that min word count <= max word count", async () => {
      const user = userEvent.setup();
      render(
        <QuestionTypeForm
          examId="exam1"
          onSubmit={mockOnSubmit}
        />
      );
      
      // Switch to Essay
      const typeSelect = screen.getByRole("combobox");
      await user.click(typeSelect);
      
      const essayOption = screen.getByRole("option", { name: /Essay/i });
      await user.click(essayOption);
      
      // Fill min and max word counts
      await waitFor(() => {
        const inputs = screen.getAllByPlaceholderText(/No (minimum|maximum)/i);
        expect(inputs.length).toBeGreaterThanOrEqual(2);
      });
      
      const minInput = screen.getByPlaceholderText("No minimum");
      const maxInput = screen.getByPlaceholderText("No maximum");
      
      // Set min > max should trigger validation error on submit
      await user.clear(minInput);
      await user.type(minInput, "500");
      await user.clear(maxInput);
      await user.type(maxInput, "100");
      
      // Try to submit
      const submitButton = screen.getByRole("button", { name: /Save Question/i });
      await user.click(submitButton);
      
      // Should not call onSubmit with invalid data
      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it("should display optional rubric editor for essays", () => {
      render(
        <QuestionTypeForm
          examId="exam1"
          question={mockEssayQuestion}
          onSubmit={mockOnSubmit}
        />
      );
      
      // Check for rubric section
      expect(screen.getByText(/Grading Rubric/i)).toBeInTheDocument();
    });

    it("should calculate and display total rubric points", async () => {
      const user = userEvent.setup();
      
      const questionWithRubric = {
        ...mockEssayQuestion,
        rubricPoints: [
          { criteria: "Clarity", points: 5 },
          { criteria: "Organization", points: 3 },
        ],
      };
      
      render(
        <QuestionTypeForm
          examId="exam1"
          question={questionWithRubric as any}
          onSubmit={mockOnSubmit}
        />
      );
      
      // Should show total points (5 + 3 = 8)
      const totalDisplay = screen.queryByText(/Total Points: 8/i);
      expect(totalDisplay).toBeInTheDocument();
    });
  });

  describe("Essay Validation", () => {
    it("should accept valid essay with word constraints", async () => {
      const user = userEvent.setup();
      render(
        <QuestionTypeForm
          examId="exam1"
          onSubmit={mockOnSubmit}
        />
      );
      
      // Switch to Essay
      const typeSelect = screen.getByRole("combobox");
      await user.click(typeSelect);
      
      const essayOption = screen.getByRole("option", { name: /Essay/i });
      await user.click(essayOption);
      
      // Fill form
      const questionInput = screen.getByPlaceholderText("Enter the question text");
      await user.type(questionInput, "Test essay question");
      
      // Submit with optional fields (no word constraints)
      const submitButton = screen.getByRole("button", { name: /Save Question/i });
      await user.click(submitButton);
      
      // Form should be valid and submit
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it("should handle optional rubric points correctly", async () => {
      const user = userEvent.setup();
      render(
        <QuestionTypeForm
          examId="exam1"
          onSubmit={mockOnSubmit}
        />
      );
      
      // Switch to Essay
      const typeSelect = screen.getByRole("combobox");
      await user.click(typeSelect);
      
      const essayOption = screen.getByRole("option", { name: /Essay/i });
      await user.click(essayOption);
      
      // Fill basic fields
      const questionInput = screen.getByPlaceholderText("Enter the question text");
      await user.type(questionInput, "Test question");
      
      // Add rubric criterion
      const addRubricBtn = screen.getByRole("button", { name: /Add Rubric Criterion/i });
      await user.click(addRubricBtn);
      
      // Fill rubric fields
      await waitFor(() => {
        const criterionInput = screen.getByPlaceholderText(/Criterion/i);
        expect(criterionInput).toBeInTheDocument();
      });
      
      // Submit with rubric
      const submitButton = screen.getByRole("button", { name: /Save Question/i });
      await user.click(submitButton);
      
      // Should submit successfully
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe("Essay Type Switching", () => {
    it("should reset essay fields when switching away from essay type", () => {
      const { rerender } = render(
        <QuestionTypeForm
          examId="exam1"
          question={mockEssayQuestion}
          onSubmit={mockOnSubmit}
        />
      );
      
      // Start with essay
      expect(screen.getByDisplayValue("100")).toBeInTheDocument();
      
      // Rerender with MCQ question
      const mcqQuestion = {
        questionId: "q1",
        examId: "exam1",
        questionType: "mcq" as const,
        questionText: "What is 2+2?",
        marks: 1,
        orderIndex: 0,
        feedbackType: "instant" as const,
        options: ["3", "4", "5"],
        correctOptionIndex: 1,
        createdAt: Timestamp.now(),
      };
      
      rerender(
        <QuestionTypeForm
          examId="exam1"
          question={mcqQuestion}
          onSubmit={mockOnSubmit}
        />
      );
      
      // Essay fields should be gone
      expect(screen.queryByDisplayValue("100")).not.toBeInTheDocument();
    });

    it("should preserve essay data when editing existing essay", () => {
      const { rerender } = render(
        <QuestionTypeForm
          examId="exam1"
          question={mockEssayQuestion}
          onSubmit={mockOnSubmit}
        />
      );
      
      // Data should persist
      expect(screen.getByDisplayValue("100")).toBeInTheDocument();
      expect(screen.getByDisplayValue("500")).toBeInTheDocument();
      
      // Rerender with same question
      rerender(
        <QuestionTypeForm
          examId="exam1"
          question={mockEssayQuestion}
          onSubmit={mockOnSubmit}
        />
      );
      
      // Data should still be there
      expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    });
  });
});
