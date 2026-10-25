import { Timestamp } from 'firebase/firestore';

export type BookResourceType = 'textbook' | 'short_note';

export type BookStatus = 'draft' | 'published' | 'archived';

export type ShortNoteSourceType = 'resource' | 'upload' | 'pasted_text';

export interface ShortNoteGenerationSettings {
  depth: 'detailed' | 'balanced' | 'concise';
  targetAudience: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  customInstructions?: string;
}

export type NoteBlockType =
  | 'paragraph'
  | 'heading'
  | 'subheading'
  | 'learning_outcomes'
  | 'definition'
  | 'important_fact'
  | 'tip'
  | 'warning'
  | 'example'
  | 'formula'
  | 'code'
  | 'table'
  | 'list'
  | 'quote'
  | 'image'
  | 'callout';

export interface NoteContentBlock {
  id: string;
  type: NoteBlockType;
  title?: string;
  content: string;
  subtitle?: string;
  codeLanguage?: string;
  mathFormula?: string;
  variables?: { symbol: string; explanation: string }[];
  steps?: { stepNumber: number; title?: string; text: string; calculation?: string }[];
  tableData?: { headers: string[]; rows: string[][] };
  listItems?: string[];
  imageUrl?: string;
  imageCaption?: string;
  isImportant?: boolean;
}

export interface NoteSolution {
  answer: string;
  explanation?: string;
  steps?: string[];
  formulas?: string[];
}

export interface NoteExercise {
  id: string;
  exerciseNumber?: number | string;
  question: string;
  questionType?: 'problem' | 'mcq' | 'conceptual';
  options?: string[];
  correctAnswer?: string;
  hints?: string[];
  solution: NoteSolution;
  initialExpanded?: boolean;
}

export interface ShortNoteSection {
  id: string;
  title: string;
  content: string;
  sectionNumber?: string;
  keyPoints?: string[];
  isImportant?: boolean;
  learningOutcomes?: string[];
  contentBlocks?: NoteContentBlock[];
  exercises?: NoteExercise[];
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
  subjectCategory?: string; // e.g. 'Mathematics', 'Natural Science', 'Humanities', 'Engineering'
  gradeLevel?: string; // e.g. 'Grade 12', 'Grade 11', 'Freshman', 'University'
  courseName?: string; // e.g. 'College Algebra', 'AP Physics', 'World History'
  chapterId?: string; // Chapter ID in subjects/{subjectId}/chapters
  chapterTitle?: string;
  chapterNumber?: number;
  examId?: string; // Direct link to Chapter Practice Exam
  sourceType?: ShortNoteSourceType;
  sourceResourceId?: string;
  generationSettings?: ShortNoteGenerationSettings;
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
  learningOutcomes?: string[];
  keyTakeaways?: string[];
  keyTerms?: KeyTerm[];
  sections?: ShortNoteSection[];
  exercises?: NoteExercise[];
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
  subjectCategory?: string;
  gradeLevel?: string;
  courseName?: string;
  chapterId?: string;
  chapterTitle?: string;
  chapterNumber?: number;
  examId?: string;
  sourceType?: ShortNoteSourceType;
  sourceResourceId?: string;
  generationSettings?: ShortNoteGenerationSettings;
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
  learningOutcomes?: string[];
  keyTakeaways?: string[];
  keyTerms?: KeyTerm[];
  sections?: ShortNoteSection[];
  exercises?: NoteExercise[];
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
