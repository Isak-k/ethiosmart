import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { QuestionRenderer } from '../QuestionRenderer';
import * as i18n from 'react-i18next';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('QuestionRenderer', () => {
  const mockOnAnswerChange = vi.fn();

  const baseProps = {
    questionNumber: 1,
    selectedAnswer: null,
    isSubmitted: false,
    onAnswerChange: mockOnAnswerChange,
    marks: 5,
    mode: 'exam' as const,
  };

  beforeEach(() => {
    mockOnAnswerChange.mockClear();
  });

  describe('MCQ Questions (Task 5.2)', () => {
    const mcqQuestion = {
      questionId: 'mcq-1',
      examId: 'exam1',
      questionText: 'What is 2+2?',
      questionType: 'mcq' as const,
      marks: 5,
      orderIndex: 1,
      feedbackType: 'instant' as const,
      options: ['3', '4', '5', '6'],
      correctOptionIndex: 1,
      createdAt: Timestamp.now(),
    };

    it('should render MCQ with all options as clickable buttons', () => {
      render(<QuestionRenderer {...baseProps} question={mcqQuestion} />);

      expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      expect(screen.getByText('📋 MCQ')).toBeInTheDocument();

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(4);

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('should call onAnswerChange with option index when MCQ option clicked', () => {
      render(<QuestionRenderer {...baseProps} question={mcqQuestion} />);

      const optionButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.textContent === '3' ||
            b.textContent === '4' ||
            b.textContent === '5' ||
            b.textContent === '6'
        );

      fireEvent.click(optionButtons[0]);
      expect(mockOnAnswerChange).toHaveBeenCalledWith(0);

      fireEvent.click(optionButtons[1]);
      expect(mockOnAnswerChange).toHaveBeenCalledWith(1);
    });

    it('should show correct answer in green when submitted', () => {
      render(
        <QuestionRenderer
          {...baseProps}
          question={mcqQuestion}
          selectedAnswer={1}
          isSubmitted={true}
        />
      );

      const buttons = screen.getAllByRole('button');
      const correctButton = buttons.find((b) => b.textContent?.includes('4'));
      expect(correctButton).toBeDefined();
      expect(correctButton?.className).toContain('green');
    });

    it('should show wrong answer in red when submitted', () => {
      render(
        <QuestionRenderer
          {...baseProps}
          question={mcqQuestion}
          selectedAnswer={0}
          isSubmitted={true}
        />
      );

      const buttons = screen.getAllByRole('button');
      const wrongButton = buttons.find((b) => b.textContent?.includes('3'));
      expect(wrongButton).toBeDefined();
      expect(wrongButton?.className).toContain('red');
    });
  });

  describe('True/False Questions (Task 5.3)', () => {
    const tfQuestion = {
      questionId: 'tf-1',
      examId: 'exam1',
      questionText: 'The sky is blue.',
      questionType: 'true-false' as const,
      marks: 3,
      orderIndex: 2,
      feedbackType: 'instant' as const,
      correctAnswer: true,
      createdAt: Timestamp.now(),
    };

    it('should render True/False with two buttons', () => {
      render(<QuestionRenderer {...baseProps} question={tfQuestion} />);

      expect(screen.getByText('The sky is blue.')).toBeInTheDocument();
      expect(screen.getByText('✓/✗ True/False')).toBeInTheDocument();

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('should call onAnswerChange with boolean when True/False clicked', () => {
      render(<QuestionRenderer {...baseProps} question={tfQuestion} />);

      const allButtons = screen.getAllByRole('button');
      const trueButton = allButtons.find((b) => b.textContent?.includes('common.true'));
      const falseButton = allButtons.find((b) => b.textContent?.includes('common.false'));

      expect(trueButton).toBeDefined();
      expect(falseButton).toBeDefined();

      fireEvent.click(trueButton!);
      expect(mockOnAnswerChange).toHaveBeenCalledWith(true);

      fireEvent.click(falseButton!);
      expect(mockOnAnswerChange).toHaveBeenCalledWith(false);
    });

    it('should show correct True in green when submitted with correct answer', () => {
      render(
        <QuestionRenderer
          {...baseProps}
          question={tfQuestion}
          selectedAnswer={true}
          isSubmitted={true}
        />
      );

      const allButtons = screen.getAllByRole('button');
      const trueButton = allButtons.find((b) => b.textContent?.includes('common.true'));
      expect(trueButton?.className).toContain('green');
    });

    it('should show wrong False in red when submitted with incorrect answer', () => {
      render(
        <QuestionRenderer
          {...baseProps}
          question={tfQuestion}
          selectedAnswer={false}
          isSubmitted={true}
        />
      );

      const allButtons = screen.getAllByRole('button');
      const falseButton = allButtons.find((b) => b.textContent?.includes('common.false'));
      expect(falseButton?.className).toContain('red');
    });
  });

  describe('Short Answer Questions (Task 5.4)', () => {
    const saQuestion = {
      questionId: 'sa-1',
      examId: 'exam1',
      questionText: 'Name the capital of France.',
      questionType: 'short-answer' as const,
      marks: 4,
      orderIndex: 3,
      feedbackType: 'instant' as const,
      correctAnswers: ['Paris', 'paris'],
      caseSensitive: false,
      requireExactMatch: true,
      createdAt: Timestamp.now(),
    };

    it('should render Short Answer with a textarea input', () => {
      render(<QuestionRenderer {...baseProps} question={saQuestion} />);

      expect(screen.getByText('Name the capital of France.')).toBeInTheDocument();
      expect(screen.getByText('📝 Short Answer')).toBeInTheDocument();

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should call onAnswerChange with text when user types', () => {
      render(<QuestionRenderer {...baseProps} question={saQuestion} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Paris' } });

      expect(mockOnAnswerChange).toHaveBeenCalledWith('Paris');
    });

    it('should show correct feedback green when submitted correctly', () => {
      render(
        <QuestionRenderer
          {...baseProps}
          question={saQuestion}
          selectedAnswer="Paris"
          isSubmitted={true}
        />
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea.className).toContain('green');
      expect(screen.getByText('exam.correct')).toBeInTheDocument();
    });

    it('should show wrong feedback red with accepted answers when submitted wrong', () => {
      render(
        <QuestionRenderer
          {...baseProps}
          question={saQuestion}
          selectedAnswer="London"
          isSubmitted={true}
        />
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea.className).toContain('red');
      expect(screen.getByText('exam.incorrect')).toBeInTheDocument();
      expect(screen.getByText('exam.acceptedAnswers')).toBeInTheDocument();
    });
  });

  describe('Essay Questions (Task 5.5)', () => {
    const essayQuestion = {
      questionId: 'essay-1',
      examId: 'exam1',
      questionText: 'Explain the process of photosynthesis.',
      questionType: 'essay' as const,
      marks: 20,
      orderIndex: 4,
      feedbackType: 'instant' as const,
      minWords: 50,
      maxWords: 500,
      rubricPoints: [
        { criteria: 'Accuracy', points: 10 },
        { criteria: 'Clarity', points: 10 },
      ],
      requiresManualGrading: true,
      createdAt: Timestamp.now(),
    };

    it('should render Essay with a textarea and word count info', () => {
      render(<QuestionRenderer {...baseProps} question={essayQuestion} />);

      expect(screen.getByText('Explain the process of photosynthesis.')).toBeInTheDocument();
      expect(screen.getByText('📄 Essay')).toBeInTheDocument();

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();

      expect(screen.getByText(/Min: 50 words/)).toBeInTheDocument();
      expect(screen.getByText(/Max: 500 words/)).toBeInTheDocument();
    });

    it('should update word count as user types', () => {
      const { rerender } = render(
        <QuestionRenderer {...baseProps} question={essayQuestion} selectedAnswer="" />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'hello world' } });
      expect(mockOnAnswerChange).toHaveBeenCalledWith('hello world');

      rerender(
        <QuestionRenderer
          {...baseProps}
          question={essayQuestion}
          selectedAnswer="hello world"
        />
      );

      expect(screen.getByText(/\(2 words\)/)).toBeInTheDocument();
    });

    it('should show pending review message when essay submitted', () => {
      render(
        <QuestionRenderer
          {...baseProps}
          question={essayQuestion}
          selectedAnswer="Photosynthesis is the process by which plants use sunlight to make food."
          isSubmitted={true}
        />
      );

      expect(screen.getByText('exam.essayPendingReview')).toBeInTheDocument();
    });

    it('should display only minWords when maxWords is not set', () => {
      const essayMinOnly = {
        ...essayQuestion,
        questionId: 'essay-min',
        maxWords: undefined,
      };
      render(<QuestionRenderer {...baseProps} question={essayMinOnly} />);
      expect(screen.getByText(/Min: 50 words/)).toBeInTheDocument();
      expect(screen.queryByText(/Max:/)).not.toBeInTheDocument();
    });

    it('should display only maxWords when minWords is not set', () => {
      const essayMaxOnly = {
        ...essayQuestion,
        questionId: 'essay-max',
        minWords: undefined,
      };
      render(<QuestionRenderer {...baseProps} question={essayMaxOnly} />);
      expect(screen.getByText(/Max: 500 words/)).toBeInTheDocument();
      expect(screen.queryByText(/Min:/)).not.toBeInTheDocument();
    });
  });

  describe('Image Display Modes (Task 5.6)', () => {
    const baseImageQuestion = {
      questionId: 'img-1',
      examId: 'exam1',
      questionText: 'Identify the object in the image.',
      questionType: 'mcq' as const,
      marks: 5,
      orderIndex: 5,
      feedbackType: 'instant' as const,
      options: ['Cat', 'Dog', 'Bird', 'Fish'],
      correctOptionIndex: 0,
      imageUrl: 'https://example.com/test-image.jpg',
      createdAt: Timestamp.now(),
    };

    it('should render image in inline mode by default', () => {
      render(<QuestionRenderer {...baseProps} question={baseImageQuestion} />);

      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0);
    });

    it('should render image in main mode when imageDisplayMode is main', () => {
      const mainImgQuestion = {
        ...baseImageQuestion,
        imageDisplayMode: 'main' as const,
      };
      render(<QuestionRenderer {...baseProps} question={mainImgQuestion} />);

      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0);
    });

    it('should render image in background mode when imageDisplayMode is background', () => {
      const bgImgQuestion = {
        ...baseImageQuestion,
        imageDisplayMode: 'background' as const,
      };
      const { container } = render(
        <QuestionRenderer {...baseProps} question={bgImgQuestion} />
      );

      const bgElements = container.querySelectorAll('[style*="backgroundImage"]');
      expect(bgElements.length).toBeGreaterThan(0);
    });
  });

  describe('Practice Mode Feedback (Tasks 5.11-5.13)', () => {
    const mcqQuestion = {
      questionId: 'pmcq-1',
      examId: 'exam1',
      questionText: 'Practice question?',
      questionType: 'mcq' as const,
      marks: 5,
      orderIndex: 1,
      feedbackType: 'instant' as const,
      options: ['Wrong', 'Right'],
      correctOptionIndex: 1,
      explanation: 'This is the explanation.',
      createdAt: Timestamp.now(),
    };

    it('should show practice mode feedback (correct) when answer is selected', () => {
      render(
        <QuestionRenderer
          questionNumber={1}
          question={mcqQuestion}
          selectedAnswer={1}
          isSubmitted={false}
          onAnswerChange={mockOnAnswerChange}
          marks={5}
          mode="practice"
        />
      );

      const buttons = screen.getAllByRole('button');
      const correctBtn = buttons.find((b) => b.textContent?.includes('Right'));
      expect(correctBtn?.className).toContain('green');
    });

    it('should show practice mode feedback (incorrect) when wrong answer selected', () => {
      render(
        <QuestionRenderer
          questionNumber={1}
          question={mcqQuestion}
          selectedAnswer={0}
          isSubmitted={false}
          onAnswerChange={mockOnAnswerChange}
          marks={5}
          mode="practice"
        />
      );

      const buttons = screen.getAllByRole('button');
      const wrongBtn = buttons.find((b) => b.textContent?.includes('Wrong'));
      expect(wrongBtn?.className).toContain('red');
    });

    it('should render explanation toggle button when question has explanation', () => {
      render(
        <QuestionRenderer
          questionNumber={1}
          question={mcqQuestion}
          selectedAnswer={1}
          isSubmitted={true}
          onAnswerChange={mockOnAnswerChange}
          marks={5}
          mode="exam"
        />
      );

      expect(screen.getByText('exam.showExplanation')).toBeInTheDocument();
    });
  });

  describe('Question Type Badges (Task 5.1)', () => {
    it('should show MCQ badge for mcq type', () => {
      const q = {
        questionId: 'b1',
        examId: 'e1',
        questionText: 'Q',
        questionType: 'mcq' as const,
        marks: 1,
        orderIndex: 1,
        feedbackType: 'instant' as const,
        options: ['A'],
        correctOptionIndex: 0,
        createdAt: Timestamp.now(),
      };
      render(<QuestionRenderer {...baseProps} question={q} />);
      expect(screen.getByText('📋 MCQ')).toBeInTheDocument();
    });

    it('should show True/False badge for true-false type', () => {
      const q = {
        questionId: 'b2',
        examId: 'e1',
        questionText: 'Q',
        questionType: 'true-false' as const,
        marks: 1,
        orderIndex: 1,
        feedbackType: 'instant' as const,
        correctAnswer: true,
        createdAt: Timestamp.now(),
      };
      render(<QuestionRenderer {...baseProps} question={q} />);
      expect(screen.getByText('✓/✗ True/False')).toBeInTheDocument();
    });

    it('should show Short Answer badge for short-answer type', () => {
      const q = {
        questionId: 'b3',
        examId: 'e1',
        questionText: 'Q',
        questionType: 'short-answer' as const,
        marks: 1,
        orderIndex: 1,
        feedbackType: 'instant' as const,
        correctAnswers: ['A'],
        createdAt: Timestamp.now(),
      };
      render(<QuestionRenderer {...baseProps} question={q} />);
      expect(screen.getByText('📝 Short Answer')).toBeInTheDocument();
    });

    it('should show Essay badge for essay type', () => {
      const q = {
        questionId: 'b4',
        examId: 'e1',
        questionText: 'Q',
        questionType: 'essay' as const,
        marks: 1,
        orderIndex: 1,
        feedbackType: 'instant' as const,
        requiresManualGrading: true,
        createdAt: Timestamp.now(),
      };
      render(<QuestionRenderer {...baseProps} question={q} />);
      expect(screen.getByText('📄 Essay')).toBeInTheDocument();
    });
  });
});
