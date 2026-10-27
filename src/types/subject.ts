import { Timestamp } from 'firebase/firestore';

export interface Subject {
  id: string;
  name: string;
  code?: string;
  description?: string;
  coverImageUrl?: string;
  coverImagePublicId?: string;
  bookCoverImageUrl?: string; // Curriculum book cover URL
  notesCoverImageUrl?: string; // Study notes cover URL
  departmentIds?: string[]; // Departments where this subject is published/available
  totalUnits?: number;
  displayOrder?: number;
  isActive?: boolean;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Chapter {
  id: string;
  subjectId: string;
  title: string;
  chapterNumber?: number;
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StudentSubjectProgress {
  subjectId: string;
  subjectName: string;
  totalUnits: number;
  unitsWithExams?: number;
  completedUnits: number;
  percentage: number;
  completedExamIds: string[];
  totalExams: number;
  hasData: boolean;
  hasStudentAttempts?: boolean;
  lastActivityDate?: Date | null;
}
