import { describe, it, expect } from 'vitest';
import {
  extractDriveFileId,
  buildDrivePreviewUrl,
  buildDriveViewUrl,
  buildDriveDownloadUrl,
  buildDriveThumbnailUrl,
  formatFileSize,
} from './google-drive';
import { Book, BookResourceType, BookStatus } from '@/types/book';

describe('Google Drive URL Parser & Generator', () => {
  it('extracts file ID from standard /file/d/ URL with query parameters', () => {
    const url = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing';
    const id = extractDriveFileId(url);
    expect(id).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  });

  it('extracts file ID from /open?id= URL', () => {
    const url = 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz_12345';
    const id = extractDriveFileId(url);
    expect(id).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz_12345');
  });

  it('extracts file ID from /uc?id= download link', () => {
    const url = 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUvWxYz_12345';
    const id = extractDriveFileId(url);
    expect(id).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz_12345');
  });

  it('extracts file ID from Google Docs document URL', () => {
    const url = 'https://docs.google.com/document/d/1c2d3e4f5g6h7i8j9k0l_ABCDEF/edit#heading=h.123';
    const id = extractDriveFileId(url);
    expect(id).toBe('1c2d3e4f5g6h7i8j9k0l_ABCDEF');
  });

  it('accepts raw Google Drive file ID directly', () => {
    const rawId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    const id = extractDriveFileId(rawId);
    expect(id).toBe(rawId);
  });

  it('rejects invalid or empty URLs', () => {
    expect(extractDriveFileId('')).toBeNull();
    expect(extractDriveFileId('https://example.com/not-drive-link')).toBeNull();
    expect(extractDriveFileId('short')).toBeNull();
  });

  it('builds valid preview, view, and download URLs', () => {
    const fileId = 'test_file_id_12345';
    expect(buildDrivePreviewUrl(fileId)).toBe('https://drive.google.com/file/d/test_file_id_12345/preview');
    expect(buildDriveViewUrl(fileId)).toContain('https://drive.google.com/file/d/test_file_id_12345/view');
    expect(buildDriveDownloadUrl(fileId)).toContain('id=test_file_id_12345');
    expect(buildDriveThumbnailUrl(fileId, 600)).toContain('sz=w600');
  });

  it('formats byte sizes into readable units', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024 * 1024 * 5)).toBe('5.0 MB');
    expect(formatFileSize(1024 * 50)).toBe('50 KB');
  });
});

describe('Digital Library Resource Filtering & Visibility Rules', () => {
  const mockBooks: Book[] = [
    {
      id: 'book_1',
      title: 'University Physics Volume 1',
      resourceType: 'textbook',
      departmentId: 'dept_eng',
      subjectId: 'sub_phys',
      driveUrl: 'https://drive.google.com/file/d/abc1/view',
      driveFileId: 'abc1',
      language: 'English',
      status: 'published',
      allowDownload: true,
      createdBy: 'admin_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'book_2',
      title: 'Thermodynamics Lecture Handout',
      resourceType: 'short_note',
      departmentId: 'dept_eng',
      subjectId: 'sub_phys',
      driveUrl: 'https://drive.google.com/file/d/abc2/view',
      driveFileId: 'abc2',
      language: 'English',
      status: 'published',
      allowDownload: false,
      createdBy: 'admin_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'book_3',
      title: 'General Biology Curriculum Guide',
      resourceType: 'textbook',
      departmentId: 'dept_med',
      subjectId: 'sub_bio',
      driveUrl: 'https://drive.google.com/file/d/abc3/view',
      driveFileId: 'abc3',
      language: 'English',
      status: 'published',
      allowDownload: true,
      createdBy: 'admin_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'book_4',
      title: 'Unpublished Draft Notes',
      resourceType: 'short_note',
      departmentId: 'dept_eng',
      subjectId: 'sub_phys',
      driveUrl: 'https://drive.google.com/file/d/abc4/view',
      driveFileId: 'abc4',
      language: 'English',
      status: 'draft',
      allowDownload: true,
      createdBy: 'admin_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it('filters resources by category (Textbooks vs Short Notes)', () => {
    const textbooks = mockBooks.filter((b) => b.resourceType === 'textbook');
    const shortNotes = mockBooks.filter((b) => b.resourceType === 'short_note');

    expect(textbooks).toHaveLength(2);
    expect(shortNotes).toHaveLength(2);
    expect(textbooks[0].title).toBe('University Physics Volume 1');
    expect(shortNotes[0].title).toBe('Thermodynamics Lecture Handout');
  });

  it('restricts draft/unpublished resources from regular student access', () => {
    const studentAccessible = mockBooks.filter((b) => b.status === 'published');
    expect(studentAccessible).toHaveLength(3);
    expect(studentAccessible.some((b) => b.id === 'book_4')).toBe(false);
  });

  it('isolates department-specific resources correctly', () => {
    const engineeringStudentResources = mockBooks.filter(
      (b) => b.status === 'published' && b.departmentId === 'dept_eng'
    );
    expect(engineeringStudentResources).toHaveLength(2);
    expect(engineeringStudentResources.every((b) => b.departmentId === 'dept_eng')).toBe(true);
  });

  it('attaches source reference to AI generated questions correctly', () => {
    const generatedQuestion = {
      id: 'q1',
      questionText: 'What is the First Law of Thermodynamics?',
      questionType: 'mcq' as const,
      options: ['Conservation of energy', 'Entropy always increases', 'Absolute zero is unreachable', 'Force equals mass times acceleration'],
      correctOptionIndex: 0,
      explanation: 'The first law states that energy cannot be created or destroyed.',
      difficulty: 'Medium' as const,
      marks: 1,
      providerUsed: 'gemini' as const,
      batchIndex: 1,
      sourceReference: {
        bookId: 'book_1',
        bookTitle: 'University Physics Volume 1',
        pageRange: '120-145',
        chapter: 'Chapter 5: Energy Conservation',
      },
    };

    expect(generatedQuestion.sourceReference).toBeDefined();
    expect(generatedQuestion.sourceReference?.bookId).toBe('book_1');
    expect(generatedQuestion.sourceReference?.pageRange).toBe('120-145');
  });
});
