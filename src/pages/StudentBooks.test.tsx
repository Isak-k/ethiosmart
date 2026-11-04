import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
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
  clearAllOfflineBooks: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/firebase-exams', () => ({
  getPublishedExams: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

describe('StudentBooks component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders choice screen without crashing', async () => {
    render(
      <BrowserRouter>
        <StudentBooks />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/What would you like to study\?/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Chapter Study Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Books & Textbooks/i)).toBeInTheDocument();
  });

  it('navigates to confirmed view when Next is clicked', async () => {
    render(
      <BrowserRouter>
        <StudentBooks />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => {
      expect(screen.getByText(/Change: Notes \/ Books/i)).toBeInTheDocument();
    });
  });
});
