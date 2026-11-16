import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction,
  writeBatch,
  deleteField,
  getDocFromCache,
  getDocsFromCache,
  limit
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { callBackend, isBackendPermissionDenied } from '@/lib/api/backend';
import { Exam, Question } from '@/integrations/firebase/types';
import { saveDeviceExams, getDeviceExams, getDeviceExam } from '@/lib/device-storage';
import { getOfflineQuestions, getDownloadedExams } from '@/lib/offline-storage';
import { getCachedData, setCachedData, invalidateCacheKey } from '@/lib/app-cache';

export async function createExam(examData: Omit<Exam, 'examId' | 'createdAt' | 'updatedAt'>, idempotencyId?: string) {
  const base = { ...examData };
  const sanitized: Record<string, any> = {};
  Object.entries(base).forEach(([k, v]) => { if (v !== undefined) sanitized[k] = v; });
  const exam = { ...sanitized, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };

  if (idempotencyId) {
    const docRef = doc(db, 'exams', idempotencyId);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(docRef);
      if (!existing.exists()) transaction.set(docRef, { ...exam, examId: idempotencyId });
    });
    invalidateCacheKey('published_exams_');
    return idempotencyId;
  }
  const docRef = await addDoc(collection(db, 'exams'), exam);
  await updateDoc(docRef, { examId: docRef.id });
  invalidateCacheKey('published_exams_');
  return docRef.id;
}

export async function getExam(examId: string): Promise<Exam | null> {
  const docRef = doc(db, 'exams', examId);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { examId: data.examId || docSnap.id, ...data } as Exam;
    }
  } catch (error) {
    console.warn(`Error fetching exam ${examId}, trying cache:`, error);
    try {
      const cachedSnap = await getDocFromCache(docRef);
      if (cachedSnap.exists()) {
        const data = cachedSnap.data();
        return { examId: data.examId || cachedSnap.id, ...data } as Exam;
      }
    } catch {}
  }
  try {
    const q = query(collection(db, 'exams'), where('examId', '==', examId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const foundDoc = snap.docs[0];
      const data = foundDoc.data();
      return { examId: data.examId || foundDoc.id, ...data } as Exam;
    }
  } catch {}
  try {
    const deviceExam = await getDeviceExam(examId);
    if (deviceExam) return deviceExam;
  } catch {}
  return null;
}

export async function updateExam(examId: string, updates: Partial<Exam>) {
  const docRef = doc(db, 'exams', examId);
  const payload: Record<string, any> = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) payload[key] = value;
    else if (key === 'departmentId' || key === 'departmentIds' || key === 'subjectId' || key === 'chapterTitle' || key === 'chapterId') payload[key] = deleteField();
  });
  payload.updatedAt = Timestamp.now();
  await updateDoc(docRef, payload);
}

export async function deleteExam(examId: string) {
  const batchDeleteDocs = async (snapshots: Array<{ ref: any }>) => {
    const CHUNK = 450;
    for (let i = 0; i < snapshots.length; i += CHUNK) {
      const slice = snapshots.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach((s) => batch.delete(s.ref));
      await batch.commit();
    }
  };
  const questionsSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
  if (!questionsSnap.empty) await batchDeleteDocs(questionsSnap.docs as any);
  const blockedSnap = await getDocs(collection(db, 'exams', examId, 'blockedStudents'));
  if (!blockedSnap.empty) await batchDeleteDocs(blockedSnap.docs as any);
  const attemptsSnap = await getDocs(query(collection(db, 'examAttempts'), where('examId', '==', examId)));
  if (!attemptsSnap.empty) {
    for (const attempt of attemptsSnap.docs) {
      const aData: any = attempt.data();
      if (aData.isSubmitted) {
        await addDoc(collection(db, 'archivedResults'), {
          attemptId: attempt.id, examId, examTitle: aData.examTitle || null,
          studentId: aData.studentId, studentName: aData.studentName || null, studentEmail: aData.studentEmail || null,
          totalScore: aData.totalScore ?? null, maxScore: aData.maxScore ?? null, timeSpentSeconds: aData.timeSpentSeconds ?? null,
          submittedAt: aData.submittedAt || Timestamp.now(), deletedAt: Timestamp.now()
        });
      }
      const answersSnap = await getDocs(collection(db, 'examAttempts', attempt.id, 'answers'));
      if (!answersSnap.empty) await batchDeleteDocs(answersSnap.docs as any);
    }
    await batchDeleteDocs(attemptsSnap.docs as any);
  }
  await deleteDoc(doc(db, 'exams', examId));
}

export async function getExamsByCreator(userId: string): Promise<Exam[]> {
  const q = query(collection(db, 'exams'), where('createdBy', '==', userId));
  const querySnapshot = await getDocs(q);
  const exams = querySnapshot.docs.map(doc => ({ examId: doc.data().examId || doc.id, ...doc.data() } as Exam));
  return exams.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getAllExams(): Promise<Exam[]> {
  const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
  try {
    const querySnapshot = await getDocs(q);
    const exams = querySnapshot.docs.map(doc => ({ examId: doc.data().examId || doc.id, ...doc.data() } as Exam));
    saveDeviceExams(exams).catch(() => {});
    return exams;
  } catch (error) {
    console.warn('Error fetching all exams, trying cache:', error);
    try {
      const cachedSnapshot = await getDocsFromCache(q);
      const exams = cachedSnapshot.docs.map(doc => ({ examId: doc.data().examId || doc.id, ...doc.data() } as Exam));
      if (exams.length > 0) { saveDeviceExams(exams).catch(() => {}); return exams; }
    } catch {}
    try { const deviceExams = await getDeviceExams(); if (deviceExams?.length) return deviceExams; } catch {}
    return [];
  }
}

export async function getPublishedExams(studentDepartmentId?: string): Promise<Exam[]> {
  const cacheKey = `published_exams_${studentDepartmentId || 'all'}`;
  const cachedExams = getCachedData<Exam[]>(cacheKey);
  if (cachedExams) return cachedExams;
  const q = query(collection(db, 'exams'), where('isPublished', '==', true));
  try {
    const querySnapshot = await getDocs(q);
    let exams = querySnapshot.docs.map(doc => ({ examId: doc.data().examId || doc.id, ...doc.data() } as Exam));
    saveDeviceExams(exams).catch(() => {});
    exams = exams.filter(exam => {
      if (!exam.departmentId && (!exam.departmentIds || exam.departmentIds.length === 0)) return true;
      if (exam.departmentId && studentDepartmentId && exam.departmentId === studentDepartmentId) return true;
      if (exam.departmentIds?.length && studentDepartmentId) return exam.departmentIds.includes(studentDepartmentId);
      return false;
    });
    const sorted = exams.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    setCachedData(cacheKey, sorted, 3 * 60 * 1000);
    return sorted;
  } catch (error) {
    console.warn('Error fetching published exams, trying cache:', error);
    try {
      const cachedSnapshot = await getDocsFromCache(q);
      let exams = cachedSnapshot.docs.map(doc => ({ examId: doc.data().examId || doc.id, ...doc.data() } as Exam));
      if (exams.length > 0) saveDeviceExams(exams).catch(() => {});
      exams = exams.filter(exam => {
        if (!exam.departmentId && (!exam.departmentIds || exam.departmentIds.length === 0)) return true;
        if (exam.departmentId && studentDepartmentId && exam.departmentId === studentDepartmentId) return true;
        if (exam.departmentIds?.length && studentDepartmentId) return exam.departmentIds.includes(studentDepartmentId);
        return false;
      });
      if (exams.length > 0) return exams.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch {}
    try {
      const [deviceExams, downloadedExams] = await Promise.all([getDeviceExams(studentDepartmentId).catch(() => []), getDownloadedExams(studentDepartmentId).catch(() => [])]);
      const mergedMap = new Map<string, Exam>();
      deviceExams.forEach((e) => mergedMap.set(e.examId, e));
      downloadedExams.forEach((e) => { if (!mergedMap.has(e.examId)) mergedMap.set(e.examId, e as unknown as Exam); });
      if (mergedMap.size > 0) return Array.from(mergedMap.values());
    } catch {}
    return [];
  }
}

export async function getExamsBySubject(subjectId: string): Promise<Exam[]> {
  const q = query(collection(db, 'exams'), where('subjectId', '==', subjectId));
  try {
    const querySnapshot = await getDocs(q);
    const exams = querySnapshot.docs.map(doc => ({ examId: doc.data().examId || doc.id, ...doc.data() } as Exam));
    return exams.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch {
    try { const cached = await getDocsFromCache(q); if (!cached.empty) return cached.docs.map(doc => ({ examId: doc.data().examId || doc.id, ...doc.data() } as Exam)); } catch {}
    try { const all = await getAllExams(); return all.filter(e => e.subjectId === subjectId); } catch { return []; }
  }
}

export async function assignExamToChapter(examId: string, chapterId?: string | null, chapterTitle?: string | null): Promise<void> {
  await updateExam(examId, { chapterId: chapterId || undefined, chapterTitle: chapterTitle || undefined });
}

export async function addQuestion(examId: string, questionData: Omit<Question, 'questionId' | 'createdAt'>) {
  const question = { ...Object.fromEntries(Object.entries(questionData).filter(([, value]) => value !== undefined)), createdAt: Timestamp.now() };
  const docRef = await addDoc(collection(db, 'exams', examId, 'questions'), question);
  await updateExamStats(examId);
  return docRef.id;
}

export async function getQuestions(examId: string): Promise<Question[]> {
  if (!examId) return [];
  try {
    const payload = await callBackend<{ questions?: Question[] }>('/api/content-access/getStudentExamQuestions', { examId });
    const questions = payload.questions || [];
    if (questions.length > 0) {
      return questions.sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
    }
  } catch (error: any) {
    if (isBackendPermissionDenied(error)) throw error;
    console.warn(`Secure question delivery unavailable for ${examId}; trying Firestore direct query / offline:`, error);
  }

  // Fallback 1: Direct Firestore client query (when questions exist in exams/{examId}/questions)
  try {
    const questionsRef = collection(db, 'exams', examId, 'questions');
    const snapshot = await getDocs(query(questionsRef, orderBy('orderIndex', 'asc')));
    if (!snapshot.empty) {
      return snapshot.docs.map((item) => ({ ...item.data(), questionId: item.id, examId } as Question));
    }
  } catch (fsErr) {
    console.warn(`Direct Firestore query for questions failed:`, fsErr);
  }

  // Fallback 2: Offline questions & device exam
  try { const offlineQuestions = await getOfflineQuestions(examId); if (offlineQuestions?.length) return offlineQuestions; } catch {}
  try { const deviceExam = await getDeviceExam(examId); if (deviceExam && Array.isArray((deviceExam as any).questions) && (deviceExam as any).questions.length > 0) return (deviceExam as any).questions; } catch {}
  return [];
}

export async function getAdminExamQuestions(examId: string): Promise<Question[]> {
  if (!examId) return [];
  const questionsRef = collection(db, 'exams', examId, 'questions');
  const snapshot = await getDocs(query(questionsRef, orderBy('orderIndex', 'asc')));
  return snapshot.docs.map((item) => ({ ...item.data(), questionId: item.id, examId } as Question));
}

export async function updateQuestion(examId: string, questionId: string, updates: Partial<Question>) {
  const docRef = doc(db, 'exams', examId, 'questions', questionId);
  const payload: Record<string, any> = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) payload[key] = value;
    else if (['correctAnswer', 'explanation', 'options', 'correctOptionIndex', 'imageUrl'].includes(key)) payload[key] = deleteField();
  });
  await updateDoc(docRef, payload);
  if (updates.marks !== undefined) await updateExamStats(examId);
}

export async function deleteQuestion(examId: string, questionId: string) {
  await deleteDoc(doc(db, 'exams', examId, 'questions', questionId));
  await updateExamStats(examId);
}

function questionImportFingerprint(question: Pick<Question, 'questionText' | 'questionType' | 'options' | 'correctOptionIndex' | 'correctAnswer' | 'explanation'>): string {
  const normalize = (value: string | undefined) => (value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  return JSON.stringify([normalize(question.questionText), question.questionType, (question.options || []).map(normalize), question.correctOptionIndex ?? null, normalize(question.correctAnswer), normalize(question.explanation)]);
}

export async function saveQuestionsBatch(examId: string, questions: Omit<Question, 'questionId' | 'createdAt'>[]): Promise<{ addedCount: number; skippedCount: number }> {
  const existingQuestions = await getQuestions(examId);
  const fingerprints = new Set(existingQuestions.map(questionImportFingerprint));
  const uniqueQuestions = questions.filter((question) => { const fp = questionImportFingerprint(question); if (fingerprints.has(fp)) return false; fingerprints.add(fp); return true; });
  if (uniqueQuestions.length === 0) return { addedCount: 0, skippedCount: questions.length };
  const nextOrderIndex = existingQuestions.reduce((max, question) => Math.max(max, Number(question.orderIndex) || 0), 0) + 1;
  const batchSize = 450;
  for (let offset = 0; offset < uniqueQuestions.length; offset += batchSize) {
    const batch = writeBatch(db);
    const chunk = uniqueQuestions.slice(offset, offset + batchSize);
    chunk.forEach((questionData, index) => {
      const newDocRef = doc(collection(db, 'exams', examId, 'questions'));
      const sanitizedQuestion = Object.fromEntries(Object.entries(questionData).filter(([, value]) => value !== undefined));
      batch.set(newDocRef, { ...sanitizedQuestion, orderIndex: nextOrderIndex + offset + index, createdAt: Timestamp.now() });
    });
    await batch.commit();
  }
  await updateExamStats(examId);
  return { addedCount: uniqueQuestions.length, skippedCount: questions.length - uniqueQuestions.length };
}

async function updateExamStats(examId: string) {
  const questions = await getQuestions(examId);
  const questionCount = questions.length;
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  await updateExam(examId, { questionCount, totalMarks });
}

export async function blockStudent(examId: string, studentId: string, reason?: string) {
  const docRef = doc(db, 'exams', examId, 'blockedStudents', studentId);
  await updateDoc(docRef, { studentId, examId, reason: reason || null, blockedAt: Timestamp.now() });
}
export async function unblockStudent(examId: string, studentId: string) { await deleteDoc(doc(db, 'exams', examId, 'blockedStudents', studentId)); }
export async function isStudentBlocked(examId: string, studentId: string): Promise<boolean> { const docSnap = await getDoc(doc(db, 'exams', examId, 'blockedStudents', studentId)); return docSnap.exists(); }
