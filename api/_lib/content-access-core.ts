import type { admin as AdminNS } from '';
import { err, cleanString, SETTINGS_PATH } from '';

type BookData = FirebaseFirestore.DocumentData & { id: string };

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

async function getPublishedBooksForDepartment(db: FirebaseFirestore.Firestore): Promise<BookData[]> {
  const snapshot = await db.collection('books').where('status', '==', 'published').get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as BookData))
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

export async function getStudentBookCatalog(db: FirebaseFirestore.Firestore, uid: string) {
  const [profileSnap, settingsSnap, accountSnap, books] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.doc(SETTINGS_PATH).get(),
    db.collection('paymentAccounts').doc(uid).get(),
    getPublishedBooksForDepartment(db),
  ]);
  if (!profileSnap.exists) throw err('permission-denied', 'Student profile not found.', 403);
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
}

export async function getStudentBook(db: FirebaseFirestore.Firestore, admin: typeof AdminNS, uid: string, data: any) {
  const bookId = typeof data?.bookId === 'string' ? data.bookId.trim() : '';
  if (!bookId || bookId.length > 150) {
    throw err('invalid-argument', 'A valid book ID is required.');
  }

  const [profileSnap, settingsSnap, accountSnap, bookSnap, allBooks] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.doc(SETTINGS_PATH).get(),
    db.collection('paymentAccounts').doc(uid).get(),
    db.collection('books').doc(bookId).get(),
    getPublishedBooksForDepartment(db),
  ]);
  if (!profileSnap.exists) throw err('permission-denied', 'Student profile not found.', 403);
  if (!bookSnap.exists) throw err('not-found', 'This learning resource was not found.', 404);

  const profile = profileSnap.data() || {};
  const book = { id: bookSnap.id, ...bookSnap.data() } as BookData;
  if (book.status && book.status !== 'published' && !isAdminProfile(profile)) {
    throw err('not-found', 'This learning resource is not available.', 404);
  }
  const departmentId = String(profile.departmentId || profile.department || '');
  if (!isAdminProfile(profile) && !matchesDepartment(book, departmentId)) {
    throw err('permission-denied', 'This resource is not available for your department.', 403);
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
    throw err('permission-denied', 'Payment approval is required to access this resource.', 403);
  }
  if (!isAdmin && !lifetime && !freeById && !freeByNoteCount && !freeByChapterCount) {
    throw err('permission-denied', 'This resource requires approved lifetime access.', 403);
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

  let protectedDownloadUrl: string | null = null;
  if (typeof book.storagePath === 'string' &&
      book.storagePath.startsWith('protected-books/')) {
    try {
      const [signedUrl] = await admin.storage().bucket().file(book.storagePath).getSignedUrl({
        action: 'read',
        expires: Date.now() + 2 * 60 * 1000,
      });
      protectedDownloadUrl = signedUrl;
    } catch (error) {
      console.error('Unable to create protected book download URL:', error);
      throw err('unavailable', 'The protected learning file is temporarily unavailable.', 503);
    }
  }

  return {
    book: {
      ...book,
      id: book.id,
      protectedDownloadUrl,
    },
    entitlement: isAdmin ? 'admin' : lifetime ? 'lifetime' : 'free',
  };
}

export async function createStudentExamAttempt(db: FirebaseFirestore.Firestore, admin: typeof AdminNS, uid: string, data: any, authToken: any) {
  const examId = typeof data?.examId === 'string' ? data.examId.trim() : '';
  if (!examId || examId.length > 150) {
    throw err('invalid-argument', 'A valid exam ID is required.');
  }

  const [profileSnap, settingsSnap, accountSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.doc(SETTINGS_PATH).get(),
    db.collection('paymentAccounts').doc(uid).get(),
  ]);
  if (!profileSnap.exists) {
    throw err('permission-denied', 'Student profile not found.', 403);
  }

  let examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) {
    const alternate = await db.collection('exams').where('examId', '==', examId).limit(1).get();
    if (!alternate.empty) examSnap = alternate.docs[0];
  }
  if (!examSnap.exists) throw err('not-found', 'This exam was not found.', 404);

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
    throw err('permission-denied', 'This exam is not available for your department.', 403);
  }
  if (!adminAccess && !ownerAccess && exam.status &&
      !['published', 'active'].includes(String(exam.status).toLowerCase()) &&
      exam.isPublished !== true) {
    throw err('not-found', 'This exam is not currently published.', 404);
  }

  const lifetime = profile.paymentAccess?.lifetime === true ||
    accountSnap.data()?.paymentAccess?.lifetime === true;
  const settings = settingsSnap.data() || {};
  const free = settings.freeAccess || {};
  const configuredFreeExamIds: string[] = Array.isArray(free.freeExamIds) ? free.freeExamIds : [];
  const selectedAsFree = configuredFreeExamIds.includes(examSnap.id) ||
    configuredFreeExamIds.includes(String(exam.examId || ''));
  let isChapterOne = Number(exam.unitNumber) === 1 ||
    Number(exam.chapterNumber) === 1 ||
    /(?:chapter|unit|ch)\s*1\b/i.test(String(exam.title || exam.chapterTitle || ''));
  if (!isChapterOne && exam.chapterId && exam.subjectId && db) {
    try {
      const chSnap = await db.collection('subjects').doc(exam.subjectId).collection('chapters').doc(exam.chapterId).get();
      if (chSnap.exists && (Number(chSnap.data()?.chapterNumber) === 1 || Number(chSnap.data()?.unitNumber) === 1)) {
        isChapterOne = true;
      }
    } catch {}
  }
  const isTrialAllowed = free.enabled !== false && (selectedAsFree || (Number(free.freeChaptersPerSubject) >= 1 && isChapterOne));
  const isFreeStudent = !adminAccess && !ownerAccess && !lifetime;
  if (isFreeStudent && !isTrialAllowed) {
    throw err('permission-denied', 'Approved lifetime access is required for this exam.', 403);
  }

  const attemptRef = db.collection('examAttempts').doc();
  const usageRef = db.collection('freeExamUsage').doc(uid);
  const maxFreeAttempts = Math.max(0, Math.floor(Number(free.freeExamAttempts) || 0));
  const result = await db.runTransaction(async (tx) => {
    let usageCount = 0;
    if (isFreeStudent) {
      if (maxFreeAttempts <= 0) {
        throw err('permission-denied', 'Free exam attempts are not currently available.', 403);
      }
      const usageSnap = await tx.get(usageRef);
      usageCount = Math.max(0, Math.floor(Number(usageSnap.data()?.attemptCount) || 0));
      if (usageCount >= maxFreeAttempts) {
        throw err('permission-denied', 'Your free exam attempt allowance has been used.', 403);
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
      studentName: String(profile.full_name || profile.fullName || authToken?.name || 'Student'),
      studentEmail: String(profile.email || authToken?.email || ''),
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
}

export async function submitStudentExamAttempt(db: FirebaseFirestore.Firestore, admin: typeof AdminNS, uid: string, data: any) {
  const attemptId = typeof data?.attemptId === 'string' ? data.attemptId.trim() : '';
  const timeSpentSeconds = Math.max(0, Math.min(24 * 60 * 60,
    Math.floor(Number(data?.timeSpentSeconds) || 0)));
  if (!attemptId || attemptId.length > 150) {
    throw err('invalid-argument', 'A valid attempt ID is required.');
  }

  const attemptRef = db.collection('examAttempts').doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw err('not-found', 'Exam attempt not found.', 404);
  const attempt = attemptSnap.data() || {};
  if (attempt.studentId !== uid) {
    throw err('permission-denied', "You cannot submit another student's attempt.", 403);
  }
  if (attempt.isSubmitted === true) {
    throw err('failed-precondition', 'This attempt has already been submitted.', 412);
  }

  const examId = String(attempt.examId || '');
  let examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) {
    const alternate = await db.collection('exams').where('examId', '==', examId).limit(1).get();
    if (!alternate.empty) examSnap = alternate.docs[0];
  }
  if (!examSnap.exists) throw err('not-found', 'Exam not found.', 404);

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
      return;
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
      throw err('permission-denied', 'Attempt ownership could not be verified.', 403);
    }
    if (fresh.data()?.isSubmitted === true) {
      throw err('failed-precondition', 'This attempt has already been submitted.', 412);
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
}

export async function getStudentExamQuestions(db: FirebaseFirestore.Firestore, uid: string, data: any) {
  const examId = typeof data?.examId === 'string' ? data.examId.trim() : '';
  if (!examId || examId.length > 150) {
    throw err('invalid-argument', 'A valid exam ID is required.');
  }

  const [profileSnap, settingsSnap, accountSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.doc(SETTINGS_PATH).get(),
    db.collection('paymentAccounts').doc(uid).get(),
  ]);
  if (!profileSnap.exists) {
    throw err('permission-denied', 'Student profile not found.', 403);
  }

  let examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) {
    const alternate = await db.collection('exams').where('examId', '==', examId).limit(1).get();
    if (!alternate.empty) examSnap = alternate.docs[0];
  }
  if (!examSnap.exists) {
    throw err('not-found', 'This exam was not found.', 404);
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
    throw err('permission-denied', 'This exam is not available for your department.', 403);
  }

  if (!canManageExam && exam.status && !['published', 'active'].includes(String(exam.status).toLowerCase()) &&
      exam.isPublished !== true) {
    throw err('not-found', 'This exam is not currently published.', 404);
  }

  const lifetime = profile.paymentAccess?.lifetime === true ||
    accountSnap.data()?.paymentAccess?.lifetime === true;
  const settings = settingsSnap.data() || {};
  const free = settings.freeAccess || {};
  const configuredFreeExamIds: string[] = Array.isArray(free.freeExamIds) ? free.freeExamIds : [];
  const selectedAsFree = configuredFreeExamIds.includes(examSnap.id) ||
    configuredFreeExamIds.includes(String(exam.examId || ''));
  let isChapterOne = Number(exam.unitNumber) === 1 ||
    Number(exam.chapterNumber) === 1 ||
    /(?:chapter|unit|ch)\s*1\b/i.test(String(exam.title || exam.chapterTitle || ''));
  if (!isChapterOne && exam.chapterId && exam.subjectId && db) {
    try {
      const chSnap = await db.collection('subjects').doc(exam.subjectId).collection('chapters').doc(exam.chapterId).get();
      if (chSnap.exists && (Number(chSnap.data()?.chapterNumber) === 1 || Number(chSnap.data()?.unitNumber) === 1)) {
        isChapterOne = true;
      }
    } catch {}
  }
  const isTrialAllowed = free.enabled !== false && (selectedAsFree || (Number(free.freeChaptersPerSubject) >= 1 && isChapterOne));
  let freeAttemptsRemaining = 0;

  if (!canManageExam && !lifetime) {
    if (!isTrialAllowed) {
      throw err('permission-denied', 'Approved lifetime access is required for this exam.', 403);
    }
    const maxFreeAttempts = Math.max(0, Math.floor(Number(free.freeExamAttempts) || 0));
    if (maxFreeAttempts <= 0) {
      throw err('permission-denied', 'Free exam attempts are not currently available.', 403);
    }

    const attemptsSnap = await db.collection('examAttempts')
      .where('studentId', '==', uid)
      .get();
    const freeExamIdSet = new Set(configuredFreeExamIds);
    const usedAttempts = attemptsSnap.docs.filter((attemptDoc) => {
      const attempt = attemptDoc.data();
      const attemptExamId = String(attempt.examId || '');
      const isFreeExamAttempt = selectedAsFree || isChapterOne || freeExamIdSet.has(attemptExamId);
      return isFreeExamAttempt &&
        (attempt.isSubmitted === true || attempt.startedAt || attempt.createdAt);
    }).length;

    freeAttemptsRemaining = Math.max(0, maxFreeAttempts - usedAttempts);
    if (freeAttemptsRemaining <= 0) {
      throw err('permission-denied', 'Your free exam attempt allowance has been used.', 403);
    }
  }

  const questionsSnap = await examSnap.ref.collection('questions').get();
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
}
