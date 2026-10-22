import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateExam, assignExamToChapter } from '@/lib/firebase-exams';
import { Exam } from '@/integrations/firebase/types';
import { Timestamp, updateDoc, deleteField } from 'firebase/firestore';

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<any>('firebase/firestore');
  return {
    ...actual,
    updateDoc: vi.fn().mockResolvedValue(undefined),
    deleteField: vi.fn(() => ({ __deleteField: true })),
  };
});

describe('Exam Subject Assignment & Editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates an existing exam to be assigned to a subject', async () => {
    const examId = 'exam_physics_midterm';
    const updates = {
      subjectId: 'subject_physics_001',
      chapterTitle: 'Unit 2: Newton Laws',
      chapterId: 'chap_newton_01',
    };

    await updateExam(examId, updates);

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const passedPayload = vi.mocked(updateDoc).mock.calls[0][1] as Record<string, any>;

    expect(passedPayload.subjectId).toBe('subject_physics_001');
    expect(passedPayload.chapterTitle).toBe('Unit 2: Newton Laws');
    expect(passedPayload.chapterId).toBe('chap_newton_01');
    expect(passedPayload.updatedAt).toBeDefined();
  });

  it('re-assigns an existing exam to a different subject and chapter', async () => {
    const examId = 'exam_math_final';
    const updates = {
      subjectId: 'subject_advanced_math_002',
      chapterTitle: 'Unit 4: Calculus & Limits',
      chapterId: 'chap_calc_04',
    };

    await updateExam(examId, updates);

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const passedPayload = vi.mocked(updateDoc).mock.calls[0][1] as Record<string, any>;

    expect(passedPayload.subjectId).toBe('subject_advanced_math_002');
    expect(passedPayload.chapterTitle).toBe('Unit 4: Calculus & Limits');
  });

  it('assigns an exam to a chapter via assignExamToChapter helper', async () => {
    const examId = 'exam_biology_101';
    await assignExamToChapter(examId, 'chap_cell_bio', 'Chapter 1: Cell Biology');

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const passedPayload = vi.mocked(updateDoc).mock.calls[0][1] as Record<string, any>;
    expect(passedPayload.chapterId).toBe('chap_cell_bio');
    expect(passedPayload.chapterTitle).toBe('Chapter 1: Cell Biology');
  });

  it('unassigns an exam from a chapter via assignExamToChapter helper with nulls', async () => {
    const examId = 'exam_biology_101';
    await assignExamToChapter(examId, null, null);

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const passedPayload = vi.mocked(updateDoc).mock.calls[0][1] as Record<string, any>;
    expect(passedPayload.chapterId).toEqual({ __deleteField: true });
    expect(passedPayload.chapterTitle).toEqual({ __deleteField: true });
  });

  it('deletes subject and chapter fields when an exam is unassigned (None / General Exam)', async () => {
    const examId = 'exam_general_test';
    const updates = {
      subjectId: undefined,
      chapterTitle: undefined,
      chapterId: undefined,
    };

    await updateExam(examId, updates);

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const passedPayload = vi.mocked(updateDoc).mock.calls[0][1] as Record<string, any>;

    expect(deleteField).toHaveBeenCalled();
    expect(passedPayload.subjectId).toEqual({ __deleteField: true });
    expect(passedPayload.chapterTitle).toEqual({ __deleteField: true });
    expect(passedPayload.chapterId).toEqual({ __deleteField: true });
  });

  it('correctly associates assigned exams with active subjects in student view', () => {
    const activeSubject = {
      id: 'sub_chemistry',
      name: 'Chemistry',
      departmentIds: ['dept_science'],
      isActive: true,
      displayOrder: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const examList = [
      { id: 'e1', title: 'Organic Chemistry Test 1', subjectId: 'sub_chemistry', chapterId: 'ch_org', chapterTitle: 'Hydrocarbons' },
      { id: 'e2', title: 'Calculus Quiz', subjectId: 'sub_math', chapterId: 'ch_calc', chapterTitle: 'Derivatives' },
      { id: 'e3', title: 'General Entrance Exam', subjectId: undefined },
    ];

    const chemistryExams = examList.filter((e) => e.subjectId === activeSubject.id);

    expect(chemistryExams).toHaveLength(1);
    expect(chemistryExams[0].id).toBe('e1');
    expect(chemistryExams[0].chapterId).toBe('ch_org');
    expect(chemistryExams[0].chapterTitle).toBe('Hydrocarbons');
  });
});
