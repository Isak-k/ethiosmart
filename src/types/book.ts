import { Timestamp } from 'firebase/firestore';

export type BookResourceType = 'textbook' | 'short_note';

export type BookStatus = 'draft' | 'published' | 'archived';

export interface ShortNoteSection {
  id: string;
  title: string;
  content: string;
  keyPoints?: string[];
  isImportant?: boolean;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface Book {
  id: string;
  title: string;
  resourceType: BookResourceType;
  departmentId: string;
  departmentName?: string;
  departmentIds?: string[]; // Optional additional departments
  subjectId: string;
  subjectName?: string;
  chapterId?: string; // Chapter ID in subjects/{subjectId}/chapters
  chapterTitle?: string;
  driveUrl: string;
  driveFileId: string;
  description?: string;
  author?: string;
  edition?: string;
  publicationYear?: string | number;
  language: string;
  chapterLabels?: string[];
  status: BookStatus;
  allowDownload: boolean;
  mimeType?: string;
  fileSizeBytes?: number;
  pageCount?: number;
  coverImageUrl?: string;
  // Interactive Shortnotes fields
  content?: string;
  summary?: string;
  keyTakeaways?: string[];
  keyTerms?: KeyTerm[];
  sections?: ShortNoteSection[];
  readingTimeMinutes?: number;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  viewCount?: number;
  downloadCount?: number;
}

export interface BookInput {
  title: string;
  resourceType: BookResourceType;
  departmentId: string;
  departmentIds?: string[];
  subjectId: string;
  chapterId?: string;
  chapterTitle?: string;
  driveUrl?: string;
  driveFileId?: string;
  description?: string;
  author?: string;
  edition?: string;
  publicationYear?: string | number;
  language?: string;
  chapterLabels?: string[];
  status?: BookStatus;
  allowDownload?: boolean;
  mimeType?: string;
  fileSizeBytes?: number;
  pageCount?: number;
  coverImageUrl?: string;
  // Interactive Shortnotes fields
  content?: string;
  summary?: string;
  keyTakeaways?: string[];
  keyTerms?: KeyTerm[];
  sections?: ShortNoteSection[];
  readingTimeMinutes?: number;
}

export interface BookBookmark {
  id: string;
  userId: string;
  bookId: string;
  createdAt: any;
}

export interface BookFilterOptions {
  resourceType?: BookResourceType | 'all';
  departmentId?: string;
  subjectId?: string;
  status?: BookStatus | 'all';
  searchQuery?: string;
  bookmarkedOnly?: boolean;
}

export interface GoogleDriveFileInfo {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  webViewLink?: string;
  previewUrl: string;
  downloadUrl?: string;
  canDownload: boolean;
  accessible: boolean;
  pageCount?: number;
  error?: string;
}

export interface ExtractedResourceContent {
  bookId?: string;
  driveFileId: string;
  title: string;
  totalPages?: number;
  textChunks: Array<{
    pageNumber?: number;
    chapter?: string;
    text: string;
  }>;
  fullTextLength: number;
}
