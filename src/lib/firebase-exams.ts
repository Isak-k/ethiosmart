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
  writeBatch,
  deleteField,
  getDocFromCache,
  getDocsFromCache,
  limit
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { Exam, Question } from '@/integrations/firebase/types';
import {
  saveDeviceExams,
  getDeviceExams,
  getDeviceExam,
} from '@/lib/device-storage';
import { getOfflineQuestions } from '@/lib/offline-storage';

export async function createExam(examData: Omit<Exam, 'examId' | 'createdAt' | 'updatedAt'>) {
  const base = { ...examData };
  const sanitized: Record<string, any> = {};
  Object.entries(base).forEach(([k, v]) => {
    if (v !== undefined) sanitized[k] = v;
  });
  const exam = { ...sanitized, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  
  const docRef = await addDoc(collection(db, 'exams'), exam);
  
  // Update the document with its own ID as examId
  await updateDoc(docRef, {
    examId: docRef.id
  });
  
  return docRef.id;
}

export async function getExam(examId: string): Promise<Exam | null> {
  const docRef = doc(db, 'exams', examId);
  
  try {
    // Try regular fetch (uses cache automatically with offline persistence)
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const exam = {
        examId: data.examId || docSnap.id,
        ...data
      } as Exam;
      return exam;
    }
  } catch (error) {
    console.warn(`Error fetching exam ${examId}, trying cache:`, error);
    try {
      // Fallback to cache-only
      const cachedSnap = await getDocFromCache(docRef);
      if (cachedSnap.exists()) {
        const data = cachedSnap.data();
        return {
          examId: data.examId || cachedSnap.id,
          ...data
        } as Exam;
      }
    } catch (cacheError) {
      console.error('Cache fetch failed:', cacheError);
    }
  }

  // Fallback: Query by examId field in case doc.id differs from examId
  try {
    const q = query(collection(db, 'exams'), where('examId', '==', examId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const foundDoc = snap.docs[0];
      const data = foundDoc.data();
      return {
        examId: data.examId || foundDoc.id,
        ...data
      } as Exam;
    }
  } catch {}
  
  // Final offline fallback to device storage
  try {
    const deviceExam = await getDeviceExam(examId);
    if (deviceExam) return deviceExam;
  } catch {
    // ignore
  }

  return null;
}

export async function updateExam(examId: string, updates: Partial<Exam>) {
  const docRef = doc(db, 'exams', examId);
  const payload: Record<string, any> = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      payload[key] = value;
    } else {
      if (key === 'departmentId' || key === 'departmentIds' || key === 'subjectId' || key === 'chapterTitle' || key === 'chapterId') {
        payload[key] = deleteField();
      }
    }
  });
  payload.updatedAt = Timestamp.now();
  await updateDoc(docRef, payload);
}

/**
 * Delete an exam and ALL of its related data:
 * - questions subcollection
 * - blockedStudents subcollection
 * - examAttempts where examId == examId
 *   - answers subcollection under each attempt
 * - finally, the exam document itself
 *
 * Uses batched deletes in chunks to respect Firestore limits.
 */
export async function deleteExam(examId: string) {
  // Helper to batch delete document snapshots in chunks of 500
  const batchDeleteDocs = async (snapshots: Array<{ ref: any }>) => {
    const CHUNK = 450; // keep headroom
    for (let i = 0; i < snapshots.length; i += CHUNK) {
      const slice = snapshots.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach((s) => batch.delete(s.ref));
      await batch.commit();
    }
  };

  // 1) Delete questions
  const questionsSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
  if (!questionsSnap.empty) {
    await batchDeleteDocs(questionsSnap.docs as any);
  }

  // 2) Delete blocked students
  const blockedSnap = await getDocs(collection(db, 'exams', examId, 'blockedStudents'));
  if (!blockedSnap.empty) {
    await batchDeleteDocs(blockedSnap.docs as any);
  }

  // 3) Archive submitted attempts, then delete attempts and their answers
  const attemptsSnap = await getDocs(query(collection(db, 'examAttempts'), where('examId', '==', examId)));
  if (!attemptsSnap.empty) {
    for (const attempt of attemptsSnap.docs) {
      const aData: any = attempt.data();
      // Archive submitted attempts for All Results/My Results history
      if (aData.isSubmitted) {
        await addDoc(collection(db, 'archivedResults'), {
          attemptId: attempt.id,
          examId,
          examTitle: aData.examTitle || null,
          studentId: aData.studentId,
          studentName: aData.studentName || null,
          studentEmail: aData.studentEmail || null,
          totalScore: aData.totalScore ?? null,
          maxScore: aData.maxScore ?? null,
          timeSpentSeconds: aData.timeSpentSeconds ?? null,
          submittedAt: aData.submittedAt || Timestamp.now(),
          deletedAt: Timestamp.now()
        });
      }
      const answersSnap = await getDocs(collection(db, 'examAttempts', attempt.id, 'answers'));
      if (!answersSnap.empty) {
        await batchDeleteDocs(answersSnap.docs as any);
      }
    }
    await batchDeleteDocs(attemptsSnap.docs as any);
  }

  // 4) Delete the exam document itself
  const examRef = doc(db, 'exams', examId);
  await deleteDoc(examRef);
}

export async function getExamsByCreator(userId: string): Promise<Exam[]> {
  const q = query(
    collection(db, 'exams'),
    where('createdBy', '==', userId)
    // orderBy('createdAt', 'desc') // Removed to avoid composite index requirement
  );
  
  const querySnapshot = await getDocs(q);
  const exams = querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      examId: data.examId || doc.id, // Use examId from data, fallback to doc.id
      ...data
    } as Exam;
  });

  // Client-side sort
  return exams.sort((a, b) => {
    const timeA = a.createdAt?.seconds || 0;
    const timeB = b.createdAt?.seconds || 0;
    return timeB - timeA;
  });
}

export async function getAllExams(): Promise<Exam[]> {
  const q = query(
    collection(db, 'exams'),
    orderBy('createdAt', 'desc')
  );
  
  try {
    // Try regular fetch (uses cache automatically)
    const querySnapshot = await getDocs(q);
    const exams = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        examId: data.examId || doc.id,
        ...data
      } as Exam;
    });

    // Auto-save to device storage
    saveDeviceExams(exams).catch(() => {});
    return exams;
  } catch (error) {
    console.warn('Error fetching all exams, trying cache:', error);
    try {
      // Fallback to cache-only
      const cachedSnapshot = await getDocsFromCache(q);
      const exams = cachedSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          examId: data.examId || doc.id,
          ...data
        } as Exam;
      });
      if (exams.length > 0) {
        saveDeviceExams(exams).catch(() => {});
        return exams;
      }
    } catch (cacheError) {
      console.error('Cache fetch failed:', cacheError);
    }

    // Offline device storage fallback
    try {
      const deviceExams = await getDeviceExams();
      if (deviceExams && deviceExams.length > 0) return deviceExams;
    } catch {
      // ignore
    }
    return [];
  }
}

export async function getPublishedExams(studentDepartmentId?: string): Promise<Exam[]> {
  const q = query(
    collection(db, 'exams'),
    where('isPublished', '==', true)
  );
  
  try {
    // Try regular fetch (uses cache automatically)
    const querySnapshot = await getDocs(q);
    let exams = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        examId: data.examId || doc.id,
        ...data
      } as Exam;
    });

    // Auto-save published exams to device storage
    saveDeviceExams(exams).catch(() => {});

    // Filter by department
    exams = exams.filter(exam => {
      if (!exam.departmentId && (!exam.departmentIds || exam.departmentIds.length === 0)) {
        return true;
      }
      if (exam.departmentId && studentDepartmentId && exam.departmentId === studentDepartmentId) {
        return true;
      }
      if (exam.departmentIds && exam.departmentIds.length > 0 && studentDepartmentId) {
        return exam.departmentIds.includes(studentDepartmentId);
      }
      return false;
    });

    // Client-side sort
    return exams.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.warn('Error fetching published exams, trying cache:', error);
    try {
      // Fallback to cache-only
      const cachedSnapshot = await getDocsFromCache(q);
      let exams = cachedSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          examId: data.examId || doc.id,
          ...data
        } as Exam;
      });

      if (exams.length > 0) {
        saveDeviceExams(exams).catch(() => {});
      }

      exams = exams.filter(exam => {
        if (!exam.departmentId && (!exam.departmentIds || exam.departmentIds.length === 0)) {
          return true;
        }
        if (exam.departmentId && studentDepartmentId && exam.departmentId === studentDepartmentId) {
          return true;
        }
        if (exam.departmentIds && exam.departmentIds.length > 0 && studentDepartmentId) {
          return exam.departmentIds.includes(studentDepartmentId);
        }
        return false;
      });

      if (exams.length > 0) {
        return exams.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      }
    } catch (cacheError) {
      console.error('Cache fetch failed:', cacheError);
    }

    // Offline device storage fallback
    try {
      const deviceExams = await getDeviceExams(studentDepartmentId);
      if (deviceExams && deviceExams.length > 0) {
        return deviceExams;
      }
    } catch (deviceErr) {
      console.warn('Error reading device exams:', deviceErr);
    }

    return [];
  }
}

/**
 * Fetch all exams associated with a given academic subject
 */
export async function getExamsBySubject(subjectId: string): Promise<Exam[]> {
  const q = query(
    collection(db, 'exams'),
    where('subjectId', '==', subjectId)
  );
  try {
    const querySnapshot = await getDocs(q);
    const exams = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        examId: data.examId || doc.id,
        ...data
      } as Exam;
    });

    return exams.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.warn('Error fetching exams by subject, trying cache/scan fallback:', error);
    try {
      const cached = await getDocsFromCache(q);
      if (!cached.empty) {
        return cached.docs.map(doc => ({
          examId: doc.data().examId || doc.id,
          ...doc.data()
        } as Exam));
      }
    } catch {
      // ignore cache error
    }

    try {
      const all = await getAllExams();
      return all.filter(e => e.subjectId === subjectId);
    } catch {
      return [];
    }
  }
}

/**
 * Assign or unassign an exam to a subject chapter
 */
export async function assignExamToChapter(
  examId: string,
  chapterId?: string | null,
  chapterTitle?: string | null
): Promise<void> {
  await updateExam(examId, {
    chapterId: chapterId || undefined,
    chapterTitle: chapterTitle || undefined,
  });
}

// Question management
export async function addQuestion(examId: string, questionData: Omit<Question, 'questionId' | 'createdAt'>) {
  const question = {
    ...Object.fromEntries(Object.entries(questionData).filter(([, value]) => value !== undefined)),
    createdAt: Timestamp.now()
  };
  
  const docRef = await addDoc(collection(db, 'exams', examId, 'questions'), question);
  
  // Update exam's question count and total marks
  await updateExamStats(examId);
  
  return docRef.id;
}

export async function getQuestions(examId: string): Promise<Question[]> {
  if (!examId) return [];

  // 1. Fetch from Firestore subcollection (simple query, client-side sorted)
  try {
    const colRef = collection(db, 'exams', examId, 'questions');
    const snap = await getDocs(colRef);
    
    if (!snap.empty) {
      const list = snap.docs.map(doc => ({
        questionId: doc.id,
        ...doc.data()
      })) as Question[];

      return list.sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
    }
  } catch (error) {
    console.warn(`Direct fetch for questions in exam ${examId} failed, trying cache:`, error);
    try {
      const colRef = collection(db, 'exams', examId, 'questions');
      const cached = await getDocsFromCache(colRef);
      if (!cached.empty) {
        const list = cached.docs.map(doc => ({
          questionId: doc.id,
          ...doc.data()
        })) as Question[];
        return list.sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
      }
    } catch (cacheErr) {
      console.warn(`Cache questions fetch failed for ${examId}:`, cacheErr);
    }
  }

  // 1b. Fallback: If no questions found and examId was a custom field rather than doc.id
  try {
    const q = query(collection(db, 'exams'), where('examId', '==', examId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty && snap.docs[0].id !== examId) {
      const altDocId = snap.docs[0].id;
      const altColRef = collection(db, 'exams', altDocId, 'questions');
      const altSnap = await getDocs(altColRef);
      if (!altSnap.empty) {
        const list = altSnap.docs.map(doc => ({
          questionId: doc.id,
          ...doc.data()
        })) as Question[];
        return list.sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
      }
    }
  } catch {}

  // 2. Fallback to offline IndexedDB questions
  try {
    const offlineQuestions = await getOfflineQuestions(examId);
    if (offlineQuestions && offlineQuestions.length > 0) {
      return offlineQuestions;
    }
  } catch {}

  // 3. Fallback to questions embedded directly on device exam
  try {
    const deviceExam = await getDeviceExam(examId);
    if (deviceExam && Array.isArray((deviceExam as any).questions) && (deviceExam as any).questions.length > 0) {
      return (deviceExam as any).questions;
    }
  } catch {}

  return [];
}

export async function updateQuestion(examId: string, questionId: string, updates: Partial<Question>) {
  const docRef = doc(db, 'exams', examId, 'questions', questionId);
  const payload: Record<string, any> = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      payload[key] = value;
    } else if (['correctAnswer', 'explanation', 'options', 'correctOptionIndex', 'imageUrl'].includes(key)) {
      payload[key] = deleteField();
    }
  });
  await updateDoc(docRef, payload);
  
  // Update exam stats if marks changed
  if (updates.marks !== undefined) {
    await updateExamStats(examId);
  }
}

export async function deleteQuestion(examId: string, questionId: string) {
  const docRef = doc(db, 'exams', examId, 'questions', questionId);
  await deleteDoc(docRef);
  
  // Update exam's question count and total marks
  await updateExamStats(examId);
}

function questionImportFingerprint(question: Pick<Question, 'questionText' | 'questionType' | 'options' | 'correctOptionIndex' | 'correctAnswer' | 'explanation'>): string {
  const normalize = (value: string | undefined) =>
    (value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  return JSON.stringify([
    normalize(question.questionText),
    question.questionType,
    (question.options || []).map(normalize),
    question.correctOptionIndex ?? null,
    normalize(question.correctAnswer),
    normalize(question.explanation),
  ]);
}

export async function saveQuestionsBatch(
  examId: string,
  questions: Omit<Question, 'questionId' | 'createdAt'>[]
): Promise<{ addedCount: number; skippedCount: number }> {
  const existingQuestions = await getQuestions(examId);
  const fingerprints = new Set(existingQuestions.map(questionImportFingerprint));
  const uniqueQuestions = questions.filter((question) => {
    const fingerprint = questionImportFingerprint(question);
    if (fingerprints.has(fingerprint)) return false;
    fingerprints.add(fingerprint);
    return true;
  });

  if (uniqueQuestions.length === 0) {
    return { addedCount: 0, skippedCount: questions.length };
  }

  const nextOrderIndex = existingQuestions.reduce(
    (max, question) => Math.max(max, Number(question.orderIndex) || 0),
    0
  ) + 1;
  const batchSize = 450;
  for (let offset = 0; offset < uniqueQuestions.length; offset += batchSize) {
    const batch = writeBatch(db);
    const chunk = uniqueQuestions.slice(offset, offset + batchSize);

    chunk.forEach((questionData, index) => {
      const newDocRef = doc(collection(db, 'exams', examId, 'questions'));
      const sanitizedQuestion = Object.fromEntries(
        Object.entries(questionData).filter(([, value]) => value !== undefined)
      );
      batch.set(newDocRef, {
        ...sanitizedQuestion,
        orderIndex: nextOrderIndex + offset + index,
        createdAt: Timestamp.now()
      });
    });

    await batch.commit();
  }
  
  // Update exam stats
  await updateExamStats(examId);
  return { addedCount: uniqueQuestions.length, skippedCount: questions.length - uniqueQuestions.length };
}

// Helper function to update exam statistics
async function updateExamStats(examId: string) {
  const questions = await getQuestions(examId);
  const questionCount = questions.length;
  // Handle cases where marks might be undefined or invalid
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  
  await updateExam(examId, { questionCount, totalMarks });
}

// Student blocking
export async function blockStudent(examId: string, studentId: string, reason?: string) {
  const docRef = doc(db, 'exams', examId, 'blockedStudents', studentId);
  await updateDoc(docRef, {
    studentId,
    examId,
    reason: reason || null,
    blockedAt: Timestamp.now()
  });
}

export async function unblockStudent(examId: string, studentId: string) {
  const docRef = doc(db, 'exams', examId, 'blockedStudents', studentId);
  await deleteDoc(docRef);
}

export async function isStudentBlocked(examId: string, studentId: string): Promise<boolean> {
  const docRef = doc(db, 'exams', examId, 'blockedStudents', studentId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
}
