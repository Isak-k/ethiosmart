import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GradingErrorBoundary } from './GradingErrorBoundary';

function BrokenGradingView(): never {
  throw new Error('grading view failed');
}

describe('GradingErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows recovery instructions instead of a blank page after a render error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <GradingErrorBoundary>
        <BrokenGradingView />
      </GradingErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: 'The grading page could not be displayed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload grading page' })).toBeInTheDocument();
  });
});