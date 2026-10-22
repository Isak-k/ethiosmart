import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectSubjectCategory,
  getSubjectCover,
  SUBJECT_COVER_PRESETS,
} from '@/lib/subject-covers';
import {
  validateCoverImage,
  checkImageAspectRatio,
  getOptimizedImageUrl,
  getCloudinaryConfig,
  fileToOptimizedDataUri,
  uploadSubjectCoverImage,
} from '@/lib/image-upload';
import { calculateStudentSubjectProgress } from '@/lib/subject-progress';
import { Subject } from '@/types/subject';
import { Exam, ExamAttempt } from '@/integrations/firebase/types';
import { Timestamp } from 'firebase/firestore';

describe('Subject Cover Management & Detection', () => {
  it('correctly detects categories for all specified curriculum subjects', () => {
    expect(detectSubjectCategory('History')).toBe('history');
    expect(detectSubjectCategory('World History Grade 10')).toBe('history');
    expect(detectSubjectCategory('Geography')).toBe('geography');
    expect(detectSubjectCategory('Economics')).toBe('economics');
    expect(detectSubjectCategory('Civics & Ethical Education')).toBe('civics');
    expect(detectSubjectCategory('Mathematics')).toBe('mathematics');
    expect(detectSubjectCategory('Advanced Mathematics')).toBe('mathematics');
    expect(detectSubjectCategory('English Language')).toBe('english');
    expect(detectSubjectCategory('General Physics')).toBe('physics');
    expect(detectSubjectCategory('Organic Chemistry')).toBe('chemistry');
    expect(detectSubjectCategory('General Biology')).toBe('biology');
    expect(detectSubjectCategory('Introduction to Computer Science')).toBe('computer');
    expect(detectSubjectCategory('Unknown General Topic')).toBe('general');
  });

  it('guarantees a non-empty, high-quality illustrated cover for every subject', () => {
    const subjects = [
      'History',
      'Geography',
      'Economics',
      'Civics',
      'Mathematics',
      'English',
      'Physics',
      'Chemistry',
      'Biology',
    ];

    subjects.forEach((name) => {
      const cover = getSubjectCover(name);
      expect(cover.url).toBeDefined();
      expect(cover.url.startsWith('data:image/svg+xml')).toBe(true);
      expect(cover.isCustom).toBe(false);
      expect(cover.preset.name).toBeDefined();
    });
  });

  it('optimizes Cloudinary custom cover URLs with 4:3 crop and auto-format', () => {
    const rawCloudinaryUrl = 'https://res.cloudinary.com/exampro/image/upload/v1234/math_custom.webp';
    const cover = getSubjectCover('Mathematics', rawCloudinaryUrl);
    expect(cover.isCustom).toBe(true);
    expect(cover.url).toContain('/upload/c_fill,ar_4:3,w_800,g_auto,q_auto,f_auto/v1234/math_custom.webp');
  });

  it('preserves non-Cloudinary custom cover URLs (Firebase Storage, direct URLs)', () => {
    const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/exampro.appspot.com/o/subject-covers%2Fcustom.png?alt=media';
    const cover = getSubjectCover('Physics', firebaseUrl);
    expect(cover.isCustom).toBe(true);
    expect(cover.url).toBe(firebaseUrl);
  });

  it('has presets for all 9 required subjects plus computer and general', () => {
    const presetIds = SUBJECT_COVER_PRESETS.map((p) => p.id);
    expect(presetIds).toContain('history');
    expect(presetIds).toContain('geography');
    expect(presetIds).toContain('economics');
    expect(presetIds).toContain('civics');
    expect(presetIds).toContain('mathematics');
    expect(presetIds).toContain('english');
    expect(presetIds).toContain('physics');
    expect(presetIds).toContain('chemistry');
    expect(presetIds).toContain('biology');
  });
});

describe('Cloudinary Dynamic Optimization & Configuration', () => {
  it('correctly constructs Cloudinary transformation URLs', () => {
    const raw = 'https://res.cloudinary.com/test-cloud/image/upload/v1700000000/exampro/subjects/bio.jpg';
    const optimized = getOptimizedImageUrl(raw);
    expect(optimized).toBe(
      'https://res.cloudinary.com/test-cloud/image/upload/c_fill,ar_4:3,w_800,g_auto,q_auto,f_auto/v1700000000/exampro/subjects/bio.jpg'
    );
  });

  it('supports custom dimensions and aspect ratios', () => {
    const raw = 'https://res.cloudinary.com/test-cloud/image/upload/v1700000000/exampro/subjects/bio.jpg';
    const custom = getOptimizedImageUrl(raw, {
      width: 400,
      aspectRatio: '16:9',
      crop: 'thumb',
    });
    expect(custom).toContain('c_thumb,ar_16:9,w_400');
  });

  it('replaces existing transformations without duplicating parameters', () => {
    const alreadyTransformed =
      'https://res.cloudinary.com/test-cloud/image/upload/c_fill,w_300/v1700000000/bio.jpg';
    const updated = getOptimizedImageUrl(alreadyTransformed, { width: 800 });
    expect(updated).not.toContain('w_300');
    expect(updated).toContain('w_800');
  });

  it('returns non-Cloudinary URLs and data URIs untouched', () => {
    const storageUrl = 'https://firebasestorage.googleapis.com/v0/b/app.appspot.com/o/file.png';
    const dataUri = 'data:image/svg+xml;utf8,<svg></svg>';

    expect(getOptimizedImageUrl(storageUrl)).toBe(storageUrl);
    expect(getOptimizedImageUrl(dataUri)).toBe(dataUri);
    expect(getOptimizedImageUrl('')).toBe('');
    expect(getOptimizedImageUrl(null)).toBe('');
  });

  it('returns valid Cloudinary configuration shape', () => {
    const config = getCloudinaryConfig();
    expect(typeof config.isConfigured).toBe('boolean');
  });

  it('generates a valid client-side data URI via fileToOptimizedDataUri', async () => {
    const file = new File(['mock image content'], 'sample.png', { type: 'image/png' });
    const dataUri = await fileToOptimizedDataUri(file);
    expect(dataUri).toBeDefined();
    expect(typeof dataUri).toBe('string');
    expect(dataUri.startsWith('data:')).toBe(true);
  });

  it('guarantees uploadSubjectCoverImage resolves without hanging (using fallback cascade)', async () => {
    const file = new File(['sample test image'], 'biology_cover.png', { type: 'image/png' });
    const progressUpdates: number[] = [];
    const result = await uploadSubjectCoverImage(file, {
      onProgress: (p) => progressUpdates.push(p),
    });

    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
    expect(result.url.length).toBeGreaterThan(0);
    expect(result.publicId).toBeDefined();
    expect(['cloudinary', 'firebase', 'local']).toContain(result.provider);
    expect(progressUpdates.length).toBeGreaterThan(0);
  });
});

describe('Cover Image Validation', () => {
  it('accepts valid JPG, JPEG, PNG, and WebP images within 5MB limit', () => {
    const validPng = new File(['dummy content'], 'cover.png', { type: 'image/png' });
    const validJpg = new File(['dummy content'], 'cover.jpg', { type: 'image/jpeg' });
    const validWebp = new File(['dummy content'], 'cover.webp', { type: 'image/webp' });

    expect(validateCoverImage(validPng).isValid).toBe(true);
    expect(validateCoverImage(validJpg).isValid).toBe(true);
    expect(validateCoverImage(validWebp).isValid).toBe(true);
  });

  it('rejects unsupported file formats like GIF, PDF, or SVG upload', () => {
    const pdfFile = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
    const gifFile = new File(['dummy content'], 'animation.gif', { type: 'image/gif' });

    const pdfValidation = validateCoverImage(pdfFile);
    expect(pdfValidation.isValid).toBe(false);
    expect(pdfValidation.error).toContain('Unsupported format');

    const gifValidation = validateCoverImage(gifFile);
    expect(gifValidation.isValid).toBe(false);
  });

  it('rejects files larger than 5MB', () => {
    // Create dummy 6MB array buffer
    const largeBuffer = new Uint8Array(6 * 1024 * 1024);
    const largeFile = new File([largeBuffer], 'giant.png', { type: 'image/png' });

    const validation = validateCoverImage(largeFile);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('too large');
  });
});

describe('Student Subject Progress Calculation', () => {
  const dummySubject: Subject = {
    id: 'sub-math-1',
    name: 'Mathematics',
    totalUnits: 10,
    isActive: true,
  };

  const dummyExams: Exam[] = [
    {
      examId: 'exam-1',
      title: 'Math Unit 1 Quiz',
      departmentId: 'sub-math-1',
      isPublished: true,
      durationMinutes: 45,
      createdBy: 'admin-1',
      maxAttempts: 3,
      resultsPublished: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      startTime: null,
      endTime: null,
      questionCount: 10,
      totalMarks: 100,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      examId: 'exam-2',
      title: 'Math Unit 2 Quiz',
      departmentId: 'sub-math-1',
      isPublished: true,
      durationMinutes: 45,
      createdBy: 'admin-1',
      maxAttempts: 3,
      resultsPublished: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      startTime: null,
      endTime: null,
      questionCount: 10,
      totalMarks: 100,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      examId: 'exam-3',
      title: 'Physics Exam (Other Subject)',
      departmentId: 'sub-physics-2',
      isPublished: true,
      durationMinutes: 45,
      createdBy: 'admin-1',
      maxAttempts: 3,
      resultsPublished: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      startTime: null,
      endTime: null,
      questionCount: 10,
      totalMarks: 100,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
  ];

  it('calculates accurate completed units and percentage based on actual submitted attempts', async () => {
    const attempts: ExamAttempt[] = [
      {
        attemptId: 'att-1',
        examId: 'exam-1',
        studentId: 'student-123',
        isSubmitted: true,
        startedAt: Timestamp.now(),
        submittedAt: Timestamp.now(),
        timeSpentSeconds: 600,
        totalScore: 85,
        maxScore: 100,
        examTitle: 'Math Unit 1 Quiz',
        studentName: 'Test Student',
        studentEmail: 'student@example.com',
        createdAt: Timestamp.now(),
      },
    ];

    const progress = await calculateStudentSubjectProgress(
      dummySubject,
      'student-123',
      dummyExams,
      attempts
    );

    expect(progress.totalUnits).toBe(10);
    expect(progress.completedUnits).toBe(1);
    expect(progress.percentage).toBe(10); // 1 / 10 = 10%
    expect(progress.completedExamIds).toContain('exam-1');
    expect(progress.hasData).toBe(true);
  });

  it('safely handles subjects with 0 configured units', async () => {
    const zeroUnitSubject: Subject = {
      id: 'sub-zero',
      name: 'Empty Subject',
      totalUnits: 0,
      isActive: true,
    };

    const progress = await calculateStudentSubjectProgress(
      zeroUnitSubject,
      'student-123',
      [],
      []
    );

    expect(progress.totalUnits).toBe(0);
    expect(progress.completedUnits).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('calculates progress accurately when exams are linked by subjectId', async () => {
    const modernSubject: Subject = {
      id: 'subj-cs-101',
      name: 'Computer Science',
      totalUnits: 4,
      departmentIds: ['dept-it-1'],
      isActive: true,
    };

    const modernExams: Exam[] = [
      {
        examId: 'cs-exam-1',
        title: 'Algorithms Midterm',
        subjectId: 'subj-cs-101',
        departmentId: 'dept-it-1',
        isPublished: true,
        durationMinutes: 60,
        createdBy: 'admin-1',
        maxAttempts: 1,
        resultsPublished: true,
        shuffleQuestions: false,
        shuffleOptions: false,
        startTime: null,
        endTime: null,
        questionCount: 20,
        totalMarks: 100,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as any,
      {
        examId: 'cs-exam-2',
        title: 'Data Structures Final',
        subjectId: 'subj-cs-101',
        departmentId: 'dept-it-1',
        isPublished: true,
        durationMinutes: 90,
        createdBy: 'admin-1',
        maxAttempts: 1,
        resultsPublished: true,
        shuffleQuestions: false,
        shuffleOptions: false,
        startTime: null,
        endTime: null,
        questionCount: 30,
        totalMarks: 100,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as any,
    ];

    const attempts: ExamAttempt[] = [
      {
        attemptId: 'att-cs-1',
        examId: 'cs-exam-1',
        studentId: 'student-cs-99',
        isSubmitted: true,
        startedAt: Timestamp.now(),
        submittedAt: Timestamp.now(),
        timeSpentSeconds: 1200,
        totalScore: 95,
        maxScore: 100,
        examTitle: 'Algorithms Midterm',
        studentName: 'CS Student',
        studentEmail: 'cs@example.com',
        createdAt: Timestamp.now(),
      },
    ];

    const progress = await calculateStudentSubjectProgress(
      modernSubject,
      'student-cs-99',
      modernExams,
      attempts,
      'dept-it-1'
    );

    expect(progress.totalUnits).toBe(4);
    expect(progress.completedUnits).toBe(1);
    expect(progress.percentage).toBe(25);
    expect(progress.completedExamIds).toEqual(['cs-exam-1']);
  });

  it('returns neutral state when student is unauthenticated', async () => {
    const progress = await calculateStudentSubjectProgress(
      dummySubject,
      null,
      dummyExams,
      []
    );

    expect(progress.hasData).toBe(false);
    expect(progress.completedUnits).toBe(0);
    expect(progress.percentage).toBe(0);
    expect(progress.totalUnits).toBe(10);
  });

  it('correctly calculates unitsWithExams when teacher creates exams for chapters with 0 student attempts', async () => {
    const psychologySubject: Subject = {
      id: 'subj-psych-101',
      name: 'Psychology',
      totalUnits: 11,
      isActive: true,
    };

    const chapterExams: Exam[] = [
      {
        examId: 'exam-ch-1',
        title: 'Unit 1: Introduction to Psychology Exam',
        subjectId: 'subj-psych-101',
        chapterId: 'chap-1',
        chapterTitle: 'Introduction to Psychology',
        isPublished: true,
        createdBy: 'admin-1',
      } as any,
      {
        examId: 'exam-ch-2',
        title: 'Unit 2: Biological Foundations Exam',
        subjectId: 'subj-psych-101',
        chapterId: 'chap-2',
        chapterTitle: 'Biological Foundations',
        isPublished: true,
        createdBy: 'admin-1',
      } as any,
      {
        examId: 'exam-ch-3',
        title: 'Unit 3: Sensation and Perception Exam',
        subjectId: 'subj-psych-101',
        chapterId: 'chap-3',
        chapterTitle: 'Sensation and Perception',
        isPublished: true,
        createdBy: 'admin-1',
      } as any,
    ];

    // No student attempts submitted yet
    const progress = await calculateStudentSubjectProgress(
      psychologySubject,
      'admin-creator-1',
      chapterExams,
      []
    );

    expect(progress.totalUnits).toBe(11);
    expect(progress.unitsWithExams).toBe(3);
    expect(progress.totalExams).toBe(3);
    expect(progress.completedUnits).toBe(0);
    expect(progress.hasStudentAttempts).toBe(false);
    expect(progress.hasData).toBe(true);
  });
});
