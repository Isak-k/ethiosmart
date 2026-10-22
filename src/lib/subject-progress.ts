import { getStudentAttempts } from '@/lib/firebase-attempts';
import { getPublishedExams, getAllExams } from '@/lib/firebase-exams';
import { Subject, StudentSubjectProgress } from '@/types/subject';
import { Exam, ExamAttempt } from '@/integrations/firebase/types';

const PROGRESS_CACHE_PREFIX = 'exampro_subject_progress_v1_';

/**
 * Calculate actual unit progress for a student in a specific subject
 */
export async function calculateStudentSubjectProgress(
  subject: Subject,
  studentId?: string | null,
  cachedExams?: Exam[],
  cachedAttempts?: ExamAttempt[],
  studentDepartmentId?: string | null
): Promise<StudentSubjectProgress> {
  const totalConfiguredUnits = subject.totalUnits ?? 0;

  // If student is not logged in, return neutral state
  if (!studentId) {
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      totalUnits: totalConfiguredUnits,
      unitsWithExams: 0,
      completedUnits: 0,
      percentage: 0,
      completedExamIds: [],
      totalExams: 0,
      hasData: false,
      hasStudentAttempts: false,
      lastActivityDate: null,
    };
  }

  try {
    // 1. Get exams accessible to this student
    let exams = cachedExams;
    if (!exams) {
      try {
        exams = await getPublishedExams(studentDepartmentId || undefined);
      } catch {
        exams = [];
      }
    }

    // Filter exams that specifically belong to this subject
    const subjectExams = exams.filter((e) => {
      // Direct subjectId match
      if ((e as any).subjectId && (e as any).subjectId === subject.id) return true;
      // Name match fallback
      if ((e as any).subject && typeof (e as any).subject === "string" && (e as any).subject.toLowerCase() === subject.name.toLowerCase()) return true;
      // Legacy compatibility: departmentId mapped to subject id
      if (e.departmentId === subject.id) return true;
      if (e.departmentIds && e.departmentIds.includes(subject.id)) return true;
      return false;
    });

    // Count distinct chapters/units that have at least one exam
    const chaptersWithExams = new Set<string>();
    subjectExams.forEach((e) => {
      const chId = (e as any).chapterId;
      const chTitle = (e as any).chapterTitle;
      if (chId && String(chId).trim() && String(chId) !== 'none') {
        chaptersWithExams.add(`id_${chId}`);
      } else if (chTitle && String(chTitle).trim() && String(chTitle).toLowerCase() !== 'general') {
        chaptersWithExams.add(`title_${String(chTitle).trim().toLowerCase()}`);
      } else {
        // Individual exam without specific chapter tag counts as an assessment unit
        chaptersWithExams.add(`exam_${e.examId || (e as any).id}`);
      }
    });

    const unitsWithExamsCount = chaptersWithExams.size;

    // Determine final totalUnits: configured totalUnits takes precedence,
    // but expands if more units with exams exist
    let effectiveTotalUnits = totalConfiguredUnits;
    if (effectiveTotalUnits <= 0) {
      effectiveTotalUnits = Math.max(unitsWithExamsCount, subjectExams.length);
    } else if (unitsWithExamsCount > effectiveTotalUnits) {
      effectiveTotalUnits = unitsWithExamsCount;
    }

    // 2. Get student attempts
    let attempts = cachedAttempts;
    if (!attempts) {
      try {
        attempts = await getStudentAttempts(studentId);
      } catch {
        attempts = [];
      }
    }

    // Filter attempts for this subject's exams that were submitted
    const subjectExamIdSet = new Set(subjectExams.map((e) => e.examId));
    const submittedAttemptsInSubject = attempts.filter(
      (a) => a.isSubmitted && subjectExamIdSet.has(a.examId)
    );

    // Find distinct completed exams
    const completedExamIds = Array.from(
      new Set(submittedAttemptsInSubject.map((a) => a.examId))
    );

    // Distinct units completed: based on distinct exams submitted
    let completedUnitsCount = completedExamIds.length;

    // Cap completed units at total units if total units > 0
    if (effectiveTotalUnits > 0) {
      completedUnitsCount = Math.min(completedUnitsCount, effectiveTotalUnits);
    }

    // Calculate student attempt percentage safely
    const percentage =
      effectiveTotalUnits > 0
        ? Math.round((completedUnitsCount / effectiveTotalUnits) * 100)
        : 0;

    const hasStudentAttempts = completedExamIds.length > 0;

    // Find latest activity date
    let lastActivityDate: Date | null = null;
    if (submittedAttemptsInSubject.length > 0) {
      const dates = submittedAttemptsInSubject
        .map((a) => a.submittedAt?.toDate?.() || a.startedAt?.toDate?.() || null)
        .filter((d): d is Date => d !== null);

      if (dates.length > 0) {
        lastActivityDate = new Date(Math.max(...dates.map((d) => d.getTime())));
      }
    }

    const progressResult: StudentSubjectProgress = {
      subjectId: subject.id,
      subjectName: subject.name,
      totalUnits: effectiveTotalUnits,
      unitsWithExams: unitsWithExamsCount,
      completedUnits: completedUnitsCount,
      percentage,
      completedExamIds,
      totalExams: subjectExams.length,
      hasData: hasStudentAttempts || unitsWithExamsCount > 0 || subjectExams.length > 0,
      hasStudentAttempts,
      lastActivityDate,
    };

    // Cache to localStorage for offline access
    try {
      localStorage.setItem(
        `${PROGRESS_CACHE_PREFIX}${studentId}_${subject.id}`,
        JSON.stringify(progressResult)
      );
    } catch {
      // Ignore storage errors in private browsing
    }

    return progressResult;
  } catch (error) {
    console.warn(`Failed to calculate progress for subject ${subject.id}, trying cache:`, error);

    // Fallback to offline cached progress
    try {
      const cached = localStorage.getItem(`${PROGRESS_CACHE_PREFIX}${studentId}_${subject.id}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignore
    }

    // Return safe neutral state on failure
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      totalUnits: totalConfiguredUnits,
      unitsWithExams: 0,
      completedUnits: 0,
      percentage: 0,
      completedExamIds: [],
      totalExams: 0,
      hasData: false,
      hasStudentAttempts: false,
      lastActivityDate: null,
    };
  }
}

/**
 * Batch calculate progress for multiple subjects at once to minimize database queries
 */
export async function calculateAllSubjectsProgress(
  subjects: Subject[],
  studentId?: string | null,
  studentDepartmentId?: string | null,
  cachedExams?: Exam[],
  cachedAttempts?: ExamAttempt[]
): Promise<Record<string, StudentSubjectProgress>> {
  if (!studentId || subjects.length === 0) {
    const result: Record<string, StudentSubjectProgress> = {};
    for (const sub of subjects) {
      result[sub.id] = {
        subjectId: sub.id,
        subjectName: sub.name,
        totalUnits: sub.totalUnits ?? 0,
        unitsWithExams: 0,
        completedUnits: 0,
        percentage: 0,
        completedExamIds: [],
        totalExams: 0,
        hasData: false,
        hasStudentAttempts: false,
        lastActivityDate: null,
      };
    }
    return result;
  }

  try {
    // Fetch published exams relevant to this department and student attempts once (use cached if provided)
    const [allExams, attempts] = await Promise.all([
      cachedExams
        ? Promise.resolve(cachedExams)
        : studentDepartmentId
        ? getPublishedExams(studentDepartmentId).catch(() => getAllExams().catch(() => []))
        : getAllExams().catch(() => []),
      cachedAttempts
        ? Promise.resolve(cachedAttempts)
        : getStudentAttempts(studentId).catch(() => []),
    ]);

    const results: Record<string, StudentSubjectProgress> = {};

    for (const sub of subjects) {
      results[sub.id] = await calculateStudentSubjectProgress(
        sub,
        studentId,
        allExams,
        attempts,
        studentDepartmentId
      );
    }

    return results;
  } catch (err) {
    console.error('Error batch calculating subjects progress:', err);
    const fallback: Record<string, StudentSubjectProgress> = {};
    for (const sub of subjects) {
      fallback[sub.id] = {
        subjectId: sub.id,
        subjectName: sub.name,
        totalUnits: sub.totalUnits ?? 0,
        unitsWithExams: 0,
        completedUnits: 0,
        percentage: 0,
        completedExamIds: [],
        totalExams: 0,
        hasData: false,
        hasStudentAttempts: false,
        lastActivityDate: null,
      };
    }
    return fallback;
  }
}
