import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();
const SETTINGS_PATH = 'paymentSettings/config';

type BookData = FirebaseFirestore.DocumentData & { id: string };

function requireAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Please sign in first.');
  }
  return context.auth.uid;
}

function timestampValue(value: any): number {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAdminProfile(profile: FirebaseFirestore.DocumentData): boolean {
  return profile.role === 'admin' || profile.role === 'superadmin';
}

function matchesDepartment(book: BookData, departmentId: string): boolean {
  if (!departmentId || departmentId === 'all') return true;
  if (!book.departmentId || book.departmentId === 'all' || book.departmentId === departmentId) return true;
  return Array.isArray(book.departmentIds) &&
    (book.departmentIds.includes('all') || book.departmentIds.includes(departmentId));
}

function publicBookMetadata(book: BookData) {
  return {
    id: book.id,
    title: book.title || '',
    resourceType: book.resourceType || 'textbook',
    departmentId: book.departmentId || '',
    departmentIds: Array.isArray(book.departmentIds) ? book.departmentIds : [],
    departmentName: book.departmentName || '',
    subjectId: book.subjectId || '',
    subjectName: book.subjectName || '',
    chapterId: book.chapterId || '',
    chapterTitle: book.chapterTitle || '',
    chapterNumber: book.chapterNumber ?? null,
    description: book.description || '',
    author: book.author || '',
    edition: book.edition || '',
    publicationYear: book.publicationYear || '',
    language: book.language || 'English',
    chapterLabels: Array.isArray(book.chapterLabels) ? book.chapterLabels : [],
    status: book.status || 'published',
    mimeType: book.mimeType || '',
    fileSizeBytes: Number(book.fileSizeBytes || 0),
    pageCount: Number(book.pageCount || 0),
    coverImageUrl: book.coverImageUrl || '',
    readingTimeMinutes: Number(book.readingTimeMinutes || 0),
    createdAt: book.createdAt || null,
    updatedAt: book.updatedAt || null,
  };
}

async function getPublishedBooksForDepartment(departmentId: string): Promise<BookData[]> {
  const snapshot = await db.collection('books').where('status', '==', 'published').get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as BookData))
    .filter((book) => matchesDepartment(book, departmentId))
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt) || a.id.localeCompare(b.id));
}

function getFreeAccess(settings: FirebaseFirestore.DocumentData) {
  return settings.freeAccess || {};
}

function hasExplicitFreeAccess(book: BookData, free: FirebaseFirestore.DocumentData): boolean {
  const freeNoteIds = Array.isArray(free.freeNoteIds) ? free.freeNoteIds : [];
  const freeChapterIds = Array.isArray(free.freeChapterIds) ? free.freeChapterIds : [];
  return freeNoteIds.includes(book.id) ||
    (!!book.chapterId && freeChapterIds.includes(book.chapterId)) ||
    (!!book.id && freeChapterIds.includes(book.id));
}

function isWithinFreeNoteAllowance(book: BookData, books: BookData[], free: FirebaseFirestore.DocumentData): boolean {
  const count = Math.max(0, Math.floor(Number(free.freeNotesCount) || 0));
  if (count === 0 || book.resourceType !== 'short_note') return false;
  const notes = books.filter((item) => item.resourceType === 'short_note');
  return notes.slice(0, count).some((item) => item.id === book.id);
}

function isWithinFreeChapterAllowance(book: BookData, books: BookData[], free: FirebaseFirestore.DocumentData): boolean {
  const count = Math.max(0, Math.floor(Number(free.freeChaptersPerSubject) || 0));
  if (count === 0 || !book.subjectId || !book.chapterId) return false;
  const chapters = Array.from(new Set(
    books.filter((item) => item.subjectId === book.subjectId && item.chapterId)
      .sort((a, b) => (Number(a.chapterNumber) || 0) - (Number(b.chapterNumber) || 0) || a.id.localeCompare(b.id))
      .map((item) => item.chapterId as string)
  ));
  return chapters.slice(0, count).includes(book.chapterId);
}

/**
 * Returns safe book listing metadata only. Protected content and Drive identifiers
 * are deliberately omitted. This callable is an additive migration endpoint;
 * existing student clients are not switched until their UI is migrated.
 */
export const getStudentBookCatalog = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);
  const [profileSnap, settingsSnap, accountSnap, books] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.doc(SETTINGS_PATH).get(),
    db.collection('paymentAccounts').doc(uid).get(),
    getPublishedBooksForDepartment('all'),
  ]);
  if (!profileSnap.exists) throw new functions.https.HttpsError('permission-denied', 'Student profile not found.');
  const profile = profileSnap.data() || {};
  const lifetime = profileSnap.data()?.paymentAccess?.lifetime === true ||
    accountSnap.data()?.paymentAccess?.lifetime === true;
  const free = getFreeAccess(settingsSnap.data() || {});
  const isAdmin = isAdminProfile(profile);
  const departmentId = String(profile.departmentId || profile.department || '');
  const filtered = books.filter((book) => matchesDepartment(book, departmentId));
  return {
    books: filtered.map((book) => {
      const freeAccess = free.enabled !== false && (
        hasExplicitFreeAccess(book, free) ||
        isWithinFreeNoteAllowance(book, filtered, free) ||
        isWithinFreeChapterAllowance(book, filtered, free)
      );
      return {
        ...publicBookMetadata(book),
        access: isAdmin || lifetime || freeAccess ? 'available' : 'restricted',
      };
    }),
    access: { lifetime, isAdmin },
  };
});

/**
 * Returns a complete book only after server-side entitlement validation.
 * Free usage is tracked separately for notes and chapters, per student.
 */
export const getStudentBook = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const bookId = typeof data?.bookId === 'string' ? data.bookId.trim() : '';
  if (!bookId || bookId.length > 150) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid book ID is required.');
  }

  const [profileSnap, settingsSnap, accountSnap, bookSnap, allBooks] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.doc(SETTINGS_PATH).get(),
    db.collection('paymentAccounts').doc(uid).get(),
    db.collection('books').doc(bookId).get(),
    getPublishedBooksForDepartment('all'),
  ]);
  if (!profileSnap.exists) throw new functions.https.HttpsError('permission-denied', 'Student profile not found.');
  if (!bookSnap.exists) throw new functions.https.HttpsError('not-found', 'This learning resource was not found.');

  const profile = profileSnap.data() || {};
  const book = { id: bookSnap.id, ...bookSnap.data() } as BookData;
  if (book.status && book.status !== 'published' && !isAdminProfile(profile)) {
    throw new functions.https.HttpsError('not-found', 'This learning resource is not available.');
  }
  const departmentId = String(profile.departmentId || profile.department || '');
  if (!isAdminProfile(profile) && !matchesDepartment(book, departmentId)) {
    throw new functions.https.HttpsError('permission-denied', 'This resource is not available for your department.');
  }

  const settings = settingsSnap.data() || {};
  const free = getFreeAccess(settings);
  const lifetime = profile.paymentAccess?.lifetime === true ||
    accountSnap.data()?.paymentAccess?.lifetime === true;
  const isAdmin = isAdminProfile(profile);
  const catalogBooks = allBooks.filter((item) => matchesDepartment(item, departmentId));
  const freeById = hasExplicitFreeAccess(book, free);
  const freeByNoteCount = free.enabled !== false &&
    isWithinFreeNoteAllowance(book, catalogBooks, free);
  const freeByChapterCount = free.enabled !== false &&
    isWithinFreeChapterAllowance(book, catalogBooks, free);

  if (!isAdmin && !lifetime && free.enabled === false) {
    throw new functions.https.HttpsError('permission-denied', 'Payment approval is required to access this resource.');
  }
  if (!isAdmin && !lifetime && !freeById && !freeByNoteCount && !freeByChapterCount) {
    throw new functions.https.HttpsError('permission-denied', 'This resource requires approved lifetime access.');
  }

  if (!isAdmin && !lifetime && (freeById || freeByNoteCount || freeByChapterCount)) {
    const usageRef = db.collection('freeAccessUsage').doc(uid);
    await db.runTransaction(async (tx) => {
      const usageSnap = await tx.get(usageRef);
      const usage = usageSnap.data() || {};
      const grantedNotes: string[] = Array.isArray(usage.grantedNoteIds) ? usage.grantedNoteIds : [];
      const grantedChapters: string[] = Array.isArray(usage.grantedChapterIds) ? usage.grantedChapterIds : [];
      const nextNotes = new Set(grantedNotes);
      const nextChapters = new Set(grantedChapters);
      if (book.resourceType === 'short_note' && freeByNoteCount) nextNotes.add(book.id);
      if (book.chapterId && freeByChapterCount) nextChapters.add(book.subjectId + ':' + book.chapterId);
      if (freeById && book.resourceType === 'short_note') nextNotes.add(book.id);
      if (freeById && book.chapterId) nextChapters.add(book.subjectId + ':' + book.chapterId);
      tx.set(usageRef, {
        grantedNoteIds: Array.from(nextNotes),
        grantedChapterIds: Array.from(nextChapters),
        noteUsageCount: nextNotes.size,
        chapterUsageCount: nextChapters.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  }

  return {
    book: {
      ...book,
      id: book.id,
    },
    entitlement: isAdmin ? 'admin' : lifetime ? 'lifetime' : 'free',
  };
});

/**
 * Atomically reserves and creates a normal exam attempt.
 * Free-attempt allowance is held in one per-student counter document so
 * concurrent starts cannot exceed the configured limit.
 */
export const createStudentExamAttempt = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const examId = typeof data?.examId === 'string' ? data.examId.trim() : '';
  if (!examId || examId.length > 150) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid exam ID is required.');
  }

  const [profileSnap, settingsSnap, accountSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.doc(SETTINGS_PATH).get(),
    db.collection('paymentAccounts').doc(uid).get(),
  ]);
  if (!profileSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Student profile not found.');
  }

  let examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) {
    const alternate = await db.collection('exams').where('examId', '==', examId).limit(1).get();
    if (!alternate.empty) examSnap = alternate.docs[0];
  }
  if (!examSnap.exists) throw new functions.https.HttpsError('not-found', 'This exam was not found.');

  const profile = profileSnap.data() || {};
  const exam = examSnap.data() || {};
  const adminAccess = isAdminProfile(profile);
  const ownerAccess = exam.createdBy === uid;
  const departmentId = String(profile.departmentId || profile.department || '');
  const examDepartment = String(exam.departmentId || '');
  const examDepartments = Array.isArray(exam.departmentIds) ? exam.departmentIds : [];
  if (!adminAccess && !ownerAccess && departmentId && examDepartment &&
      examDepartment !== 'all' && examDepartment !== departmentId &&
      !examDepartments.includes(departmentId) && !examDepartments.includes('all')) {
    throw new functions.https.HttpsError('permission-denied', 'This exam is not available for your department.');
  }
  if (!adminAccess && !ownerAccess && exam.status &&
      !['published', 'active'].includes(String(exam.status).toLowerCase()) &&
      exam.isPublished !== true) {
    throw new functions.https.HttpsError('not-found', 'This exam is not currently published.');
  }

  const lifetime = profile.paymentAccess?.lifetime === true ||
    accountSnap.data()?.paymentAccess?.lifetime === true;
  const settings = settingsSnap.data() || {};
  const free = settings.freeAccess || {};
  const configuredFreeExamIds: string[] = Array.isArray(free.freeExamIds) ? free.freeExamIds : [];
  const selectedAsFree = configuredFreeExamIds.includes(examSnap.id) ||
    configuredFreeExamIds.includes(String(exam.examId || ''));
  const isFreeStudent = !adminAccess && !ownerAccess && !lifetime;
  if (isFreeStudent && (free.enabled === false || !selectedAsFree)) {
    throw new functions.https.HttpsError('permission-denied', 'Approved lifetime access is required for this exam.');
  }

  const attemptRef = db.collection('examAttempts').doc();
  const usageRef = db.collection('freeExamUsage').doc(uid);
  const maxFreeAttempts = Math.max(0, Math.floor(Number(free.freeExamAttempts) || 0));
  const result = await db.runTransaction(async (tx) => {
    let usageCount = 0;
    if (isFreeStudent) {
      if (maxFreeAttempts <= 0) {
        throw new functions.https.HttpsError('permission-denied', 'Free exam attempts are not currently available.');
      }
      const usageSnap = await tx.get(usageRef);
      usageCount = Math.max(0, Math.floor(Number(usageSnap.data()?.attemptCount) || 0));
      if (usageCount >= maxFreeAttempts) {
        throw new functions.https.HttpsError('permission-denied', 'Your free exam attempt allowance has been used.');
      }
      tx.set(usageRef, {
        attemptCount: usageCount + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    tx.create(attemptRef, {
      examId: examSnap.id,
      studentId: uid,
      examTitle: String(exam.title || exam.examTitle || ''),
      studentName: String(profile.full_name || profile.fullName || context.auth?.token.name || 'Student'),
      studentEmail: String(profile.email || context.auth?.token.email || ''),
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      submittedAt: null,
      isSubmitted: false,
      timeSpentSeconds: null,
      totalScore: null,
      maxScore: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      accessType: adminAccess ? 'admin' : ownerAccess ? 'owner' : lifetime ? 'lifetime' : 'free',
      freeAttemptReservation: isFreeStudent,
    });
    return { attemptId: attemptRef.id, freeAttemptsRemaining: isFreeStudent ? maxFreeAttempts - usageCount - 1 : null };
  });

  return result;
});

/**
 * Finalizes a student's attempt and computes objective marks on the server.
 * Client-supplied scores are deliberately ignored.
 */
export const submitStudentExamAttempt = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const attemptId = typeof data?.attemptId === 'string' ? data.attemptId.trim() : '';
  const timeSpentSeconds = Math.max(0, Math.min(24 * 60 * 60,
    Math.floor(Number(data?.timeSpentSeconds) || 0)));
  if (!attemptId || attemptId.length > 150) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid attempt ID is required.');
  }

  const attemptRef = db.collection('examAttempts').doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw new functions.https.HttpsError('not-found', 'Exam attempt not found.');
  const attempt = attemptSnap.data() || {};
  if (attempt.studentId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'You cannot submit another student’s attempt.');
  }
  if (attempt.isSubmitted === true) {
    throw new functions.https.HttpsError('failed-precondition', 'This attempt has already been submitted.');
  }

  const examId = String(attempt.examId || '');
  let examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) {
    const alternate = await db.collection('exams').where('examId', '==', examId).limit(1).get();
    if (!alternate.empty) examSnap = alternate.docs[0];
  }
  if (!examSnap.exists) throw new functions.https.HttpsError('not-found', 'Exam not found.');

  const [questionsSnap, answersSnap] = await Promise.all([
    examSnap.ref.collection('questions').get(),
    attemptRef.collection('answers').get(),
  ]);
  const answerById = new Map(answersSnap.docs.map((doc) => [doc.id, doc.data()]));
  let totalScore = 0;
  let maxScore = 0;
  questionsSnap.docs.forEach((questionDoc) => {
    const question = questionDoc.data();
    const marks = Math.max(0, Number(question.marks) || 0);
    maxScore += marks;
    const answer = answerById.get(questionDoc.id) || {};
    const type = String(question.questionType || question.type || '').toLowerCase();
    if (type === 'shortanswer' || type === 'essay' || type === 'short_answer' || type === 'essay_question') {
      return; // Requires teacher grading; client cannot award itself marks.
    }
    let correct = false;
    if (typeof question.correctOptionIndex === 'number') {
      correct = answer.selectedOptionIndex === question.correctOptionIndex;
    } else if (typeof question.correctAnswer === 'boolean') {
      correct = answer.studentAnswer === question.correctAnswer ||
        String(answer.studentAnswer).toLowerCase() === String(question.correctAnswer).toLowerCase();
    } else if (typeof question.correctAnswer === 'string') {
      correct = String(answer.studentAnswer ?? '').trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    }
    if (correct) totalScore += marks;
  });

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(attemptRef);
    if (!fresh.exists || fresh.data()?.studentId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Attempt ownership could not be verified.');
    }
    if (fresh.data()?.isSubmitted === true) {
      throw new functions.https.HttpsError('failed-precondition', 'This attempt has already been submitted.');
    }
    tx.update(attemptRef, {
      isSubmitted: true,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      timeSpentSeconds,
      totalScore,
      maxScore,
    });
  });

  return { totalScore, maxScore };
});

/**
 * Server-gated exam question delivery. Free attempts are limited across the
 * student's selected free exams; existing attempt documents are used as the
 * source of truth. Client migration and Firestore rule tightening are separate
 * steps, so this endpoint is additive for now.
 */
export const getStudentExamQuestions = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const examId = typeof data?.examId === 'string' ? data.examId.trim() : '';
  if (!examId || examId.length > 150) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid exam ID is required.');
  }

  const [profileSnap, settingsSnap, accountSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.doc(SETTINGS_PATH).get(),
    db.collection('paymentAccounts').doc(uid).get(),
  ]);
  if (!profileSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Student profile not found.');
  }

  let examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) {
    const alternate = await db.collection('exams').where('examId', '==', examId).limit(1).get();
    if (!alternate.empty) examSnap = alternate.docs[0];
  }
  if (!examSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'This exam was not found.');
  }

  const profile = profileSnap.data() || {};
  const exam = examSnap.data() || {};
  const isAdmin = isAdminProfile(profile);
  const isExamOwner = exam.createdBy === uid;
  const canManageExam = isAdmin || isExamOwner;
  const departmentId = String(profile.departmentId || profile.department || '');
  const examDepartment = String(exam.departmentId || '');
  const examDepartments = Array.isArray(exam.departmentIds) ? exam.departmentIds : [];
  if (!canManageExam && departmentId && examDepartment && examDepartment !== 'all' &&
      examDepartment !== departmentId && !examDepartments.includes(departmentId) &&
      !examDepartments.includes('all')) {
    throw new functions.https.HttpsError('permission-denied', 'This exam is not available for your department.');
  }

  if (!canManageExam && exam.status && !['published', 'active'].includes(String(exam.status).toLowerCase()) &&
      exam.isPublished !== true) {
    throw new functions.https.HttpsError('not-found', 'This exam is not currently published.');
  }

  const lifetime = profile.paymentAccess?.lifetime === true ||
    accountSnap.data()?.paymentAccess?.lifetime === true;
  const settings = settingsSnap.data() || {};
  const free = settings.freeAccess || {};
  const configuredFreeExamIds: string[] = Array.isArray(free.freeExamIds) ? free.freeExamIds : [];
  const selectedAsFree = configuredFreeExamIds.includes(examSnap.id) ||
    configuredFreeExamIds.includes(String(exam.examId || ''));
  let freeAttemptsRemaining = 0;

  if (!canManageExam && !lifetime) {
    if (free.enabled === false || !selectedAsFree) {
      throw new functions.https.HttpsError('permission-denied', 'Approved lifetime access is required for this exam.');
    }
    const maxFreeAttempts = Math.max(0, Math.floor(Number(free.freeExamAttempts) || 0));
    if (maxFreeAttempts <= 0) {
      throw new functions.https.HttpsError('permission-denied', 'Free exam attempts are not currently available.');
    }

    const attemptsSnap = await db.collection('examAttempts')
      .where('studentId', '==', uid)
      .get();
    const freeExamIdSet = new Set(configuredFreeExamIds);
    const usedAttempts = attemptsSnap.docs.filter((attemptDoc) => {
      const attempt = attemptDoc.data();
      return freeExamIdSet.has(String(attempt.examId || '')) &&
        (attempt.isSubmitted === true || attempt.startedAt || attempt.createdAt);
    }).length;

    freeAttemptsRemaining = Math.max(0, maxFreeAttempts - usedAttempts);
    if (freeAttemptsRemaining <= 0) {
      throw new functions.https.HttpsError('permission-denied', 'Your free exam attempt allowance has been used.');
    }
  }

  const questionsSnap = await examSnap.ref.collection('questions').get();
  // Never send answer keys or explanations to the student during an active
  // exam. Scoring is performed by submitStudentExamAttempt on the server.
  const questions = questionsSnap.docs
    .map((questionDoc) => {
      const studentSafeQuestion: Record<string, any> = { ...questionDoc.data() };
      delete studentSafeQuestion.correctOptionIndex;
      delete studentSafeQuestion.correctAnswer;
      delete studentSafeQuestion.answer;
      delete studentSafeQuestion.answerKey;
      delete studentSafeQuestion.explanation;
      delete studentSafeQuestion.isCorrect;
      return { questionId: questionDoc.id, ...studentSafeQuestion };
    })
    .sort((a: any, b: any) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));

  return {
    exam: {
      examId: exam.examId || examSnap.id,
      title: exam.title || exam.examTitle || '',
      subjectId: exam.subjectId || '',
      departmentId: exam.departmentId || '',
      duration: exam.duration ?? null,
      totalMarks: exam.totalMarks ?? null,
      questionCount: questions.length,
    },
    questions,
    entitlement: lifetime ? 'lifetime' : isAdmin ? 'admin' : 'free',
    freeAttemptsRemaining,
  };
});
