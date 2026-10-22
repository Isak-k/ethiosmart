import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionCard } from './QuestionCard';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'student.exam.card.explanation') return 'Explanation';
      return key;
    },
  }),
}));

describe('QuestionCard Practice Mode Explanation Toggle', () => {
  const defaultProps = {
    questionNumber: 1,
    questionText: 'What is the primary function of database normalization?',
    options: ['Reduce redundancy', 'Increase complexity', 'Slow queries', 'Delete data'],
    selectedOption: 0,
    correctOption: 0,
    feedbackType: 'instant' as const,
    isSubmitted: false,
    onSelectOption: vi.fn(),
    marks: 1,
    explanation: 'Normalization organizes data to reduce redundancy and improve data integrity.',
    mode: 'practice' as const,
    isPracticeExam: true,
  };

  it('renders "Unhide explanation" button by default when answer is selected in practice mode, and explanation is hidden until clicked', () => {
    render(<QuestionCard {...defaultProps} />);

    // Explanation should be hidden by default
    expect(screen.queryByText('Normalization organizes data to reduce redundancy and improve data integrity.')).not.toBeInTheDocument();

    // Toggle button should say "Unhide explanation" by default
    const unhideBtn = screen.getByRole('button', { name: /unhide explanation/i });
    expect(unhideBtn).toBeInTheDocument();

    // Clicking "Unhide explanation" reveals the explanation
    fireEvent.click(unhideBtn);
    expect(screen.getByText('Normalization organizes data to reduce redundancy and improve data integrity.')).toBeInTheDocument();

    // Button should now say "Hide explanation"
    const hideBtn = screen.getByRole('button', { name: /hide explanation/i });
    expect(hideBtn).toBeInTheDocument();

    // Clicking "Hide explanation" hides it again
    fireEvent.click(hideBtn);
    expect(screen.queryByText('Normalization organizes data to reduce redundancy and improve data integrity.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unhide explanation/i })).toBeInTheDocument();
  });

  it('does NOT show hide/unhide button or explanation before the user selects an answer', () => {
    render(<QuestionCard {...defaultProps} selectedOption={null} />);

    // Initially unanswered: explanation must not be visible
    expect(screen.queryByText('Normalization organizes data to reduce redundancy and improve data integrity.')).not.toBeInTheDocument();

    // Hide/unhide button must NOT be present before an answer is selected
    expect(screen.queryByRole('button', { name: /hide explanation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unhide explanation/i })).not.toBeInTheDocument();
  });

  it('shows "Unhide explanation" button immediately after user selects an answer', () => {
    const { rerender } = render(<QuestionCard {...defaultProps} selectedOption={null} />);

    // Before selection: no button
    expect(screen.queryByRole('button', { name: /unhide explanation/i })).not.toBeInTheDocument();

    // User selects an option (e.g. option 0)
    rerender(<QuestionCard {...defaultProps} selectedOption={0} />);

    // "Unhide explanation" button appears after selecting an answer
    expect(screen.getByRole('button', { name: /unhide explanation/i })).toBeInTheDocument();
    // Explanation is still collapsed until clicked
    expect(screen.queryByText('Normalization organizes data to reduce redundancy and improve data integrity.')).not.toBeInTheDocument();
  });
});
