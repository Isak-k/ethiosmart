import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StudentBooks from './StudentBooks';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'student-123', email: 'student@example.com' },
    profile: { full_name: 'Test Student', departmentId: 'dept-1' },
    role: 'student',
    loading: false,
    isGuest: false,
    requireStudentLogin: false,
  }),
}));

vi.mock('@/lib/books', () => ({
  getBooks: vi.fn().mockResolvedValue([
    {
      id: 'book-1',
      title: 'Physics Grade 9 Textbook',
      author: 'Ministry of Education',
      resourceType: 'textbook',
      departmentId: 'dept-1',
      subjectId: 'sub-physics',
      status: 'published',
      fileUrl: 'https://example.com/physics.pdf',
    },
    {
      id: 'note-1',
      title: 'Unit 1: Vectors & Mechanics',
      chapterTitle: 'Unit 1: Vectors & Mechanics',
      chapterNumber: 1,
      resourceType: 'short_note',
      departmentId: 'dept-1',
      subjectId: 'sub-physics',
      status: 'published',
      fileUrl: 'https://example.com/note1.pdf',
    },
  ]),
  getUserBookBookmarks: vi.fn().mockResolvedValue([]),
  toggleBookBookmark: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/departments', () => ({
  getDepartments: vi.fn().mockResolvedValue([
    { id: 'dept-1', name: 'Natural Science' },
  ]),
}));

vi.mock('@/lib/subjects', () => ({
  getSubjects: vi.fn().mockResolvedValue([
    { id: 'sub-physics', name: 'Physics', departmentId: 'dept-1', departmentIds: ['dept-1'] },
  ]),
  getChapters: vi.fn().mockResolvedValue([
    { id: 'ch-1', title: 'Unit 1: Vectors & Mechanics', chapterNumber: 1, subjectId: 'sub-physics' },
  ]),
}));

vi.mock('@/lib/offline-books', () => ({
  getAllOfflineBooks: vi.fn().mockResolvedValue([]),
  getOfflineBooksStorageStats: vi.fn().mockResolvedValue({ totalBytes: 0, formattedSize: '0 B', count: 0 }),
  downloadAndSaveBookOffline: vi.fn().mockResolvedValue({}),
  exportOfflineBookToDisk: vi.fn().mockResolvedValue(undefined),
  clearAllOfflineBooks: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/firebase-exams', () => ({
  getPublishedExams: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/system-settings', () => ({
  getCachedDefaultDepartmentId: vi.fn().mockReturnValue('dept-1'),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

describe('StudentBooks component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens directly in the notes (shortnotes) view by default', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/books']}>
        <StudentBooks />
      </MemoryRouter>
    );

    // The "choose notes or books" screen is skipped entirely.
    expect(
      screen.queryByRole('heading', { name: /What would you like to study\?/i })
    ).not.toBeInTheDocument();

    // The Notes / Books switch stays clearly visible at the top.
    expect(await screen.findByRole('button', { name: /^Notes \(\d+\)$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Books \(\d+\)$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Chapter Study Notes/i })).toBeInTheDocument();
  });

  it('switches to the Books view when the Books button is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/books']}>
        <StudentBooks />
      </MemoryRouter>
    );

    const booksButton = await screen.findByRole('button', { name: /^Books \(\d+\)$/ });
    fireEvent.click(booksButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search books by title/i)).toBeInTheDocument();
    });
  });

  it('renders Level 2 chapter view directly if subjectId is in URL', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/books?tab=notes&subjectId=sub-physics']}>
        <StudentBooks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Back to All Subjects/i)).toBeInTheDocument();
    });
  });
});
