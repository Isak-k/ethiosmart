import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import StudentExams from './StudentExams';
import { getPublishedExams } from '@/lib/firebase-exams';
import { getChapters, getSubjects } from '@/lib/subjects';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'student-123' },
    profile: { departmentId: 'dept-1', role: 'student' },
  }),
}));

vi.mock('@/lib/firebase-exams', () => ({
  getPublishedExams: vi.fn(),
  getAllExams: vi.fn(),
}));

vi.mock('@/lib/firebase-attempts', () => ({
  getStudentAttempts: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/subjects', () => ({
  getSubjects: vi.fn(),
  getChapters: vi.fn(),
}));

vi.mock('@/lib/books', () => ({
  getBooks: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/subject-progress', () => ({
  calculateAllSubjectsProgress: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/system-settings', () => ({
  getCachedDefaultDepartmentId: vi.fn().mockReturnValue('dept-1'),
}));

vi.mock('@/lib/payment-access', () => ({
  usePaymentAccess: () => ({ chapterOneTrial: false }),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('StudentExams chapter display', () => {
  it('uses admin-defined chapters and keeps unmatched exams outside the chapter list', async () => {
    const now = Timestamp.now();
    vi.mocked(getPublishedExams).mockResolvedValue([
      {
        examId: 'assigned-exam',
        title: 'Assigned exam',
        description: null,
        subjectId: 'psychology',
        chapterId: 'psychology-chapter-1',
        departmentId: 'dept-1',
        departmentIds: ['dept-1'],
        createdBy: 'admin',
        durationMinutes: 60,
        maxAttempts: 1,
        isPublished: true,
        resultsPublished: false,
        shuffleQuestions: false,
        shuffleOptions: false,
        startTime: null,
        endTime: null,
        questionCount: 18,
        totalMarks: 18,
        createdAt: now,
        updatedAt: now,
      },
      {
        examId: 'unassigned-exam',
        title: 'Unassigned assessment',
        description: null,
        subjectId: 'psychology',
        chapterTitle: 'Chapter 11',
        departmentId: 'dept-1',
        departmentIds: ['dept-1'],
        createdBy: 'admin',
        durationMinutes: 60,
        maxAttempts: 1,
        isPublished: true,
        resultsPublished: false,
        shuffleQuestions: false,
        shuffleOptions: false,
        startTime: null,
        endTime: null,
        questionCount: 18,
        totalMarks: 18,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    vi.mocked(getSubjects).mockResolvedValue([
      {
        id: 'psychology',
        name: 'Psychology',
        departmentIds: ['dept-1'],
        totalUnits: 11,
      },
    ]);
    vi.mocked(getChapters).mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `psychology-chapter-${index + 1}`,
        subjectId: 'psychology',
        title: `Chapter ${index + 1}`,
        chapterNumber: index + 1,
      }))
    );

    render(
      <MemoryRouter initialEntries={['/dashboard/exams?subjectId=psychology']}>
        <StudentExams />
      </MemoryRouter>
    );

    await waitFor(() => expect(getPublishedExams).toHaveBeenCalled());
    await waitFor(() => expect(getSubjects).toHaveBeenCalled());
    expect(await screen.findByRole('heading', { name: 'Chapter 8: Chapter 8' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Chapter 9: Chapter 9' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Chapter 11: Chapter 11' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Comprehensive Curriculum Assessment' })).toBeInTheDocument();
    expect(screen.getByText(/1 of 8 chapters/)).toBeInTheDocument();
    expect(screen.getAllByText('Practice Exam Ready')).toHaveLength(2);
  });
});
