import {
  collection, doc, getDoc, getDocs, updateDoc, setDoc, query, where, Timestamp, serverTimestamp, getDocFromCache, getDocsFromCache, deleteDoc, writeBatch
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { callBackend } from '@/lib/api/backend';
import { ExamAttempt, Answer, Question } from '@/integrations/firebase/types';
import { getQuestions } from '@/lib/firebase-exams';

export async function createAttempt(
  examId: string,
  _studentId: string,
  _examTitle: string,
  _studentName: string,
  _studentEmail: string
): Promise<string> {
  const res = await callBackend<{ attemptId: string; freeAttemptsRemaining: number | null }>('/api/content-access/createStudentExamAttempt', { examId });
  return res.attemptId;
}

export async function getAttempt(attemptId: string): Promise<ExamAttempt | null> {
  const docRef = doc(db, 'examAttempts', attemptId);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return { attemptId: docSnap.id, ...docSnap.data() } as ExamAttempt;
  } catch (error) {
    console.warn('Error fetching attempt, trying cache:', error);
    try { const cachedSnap = await getDocFromCache(docRef); if (cachedSnap.exists()) return { attemptId: cachedSnap.id, ...cachedSnap.data() } as ExamAttempt; } catch {}
  }
  return null;
}

export async function getStudentAttempts(studentId: string, examId?: string): Promise<ExamAttempt[]> {
  let q = query(collection(db, 'examAttempts'), where('studentId', '==', studentId));
  if (examId) q = query(q, where('examId', '==', examId));
  try {
    const querySnapshot = await getDocs(q);
    const attempts = querySnapshot.docs.map(doc => ({ attemptId: doc.id, ...doc.data() })) as ExamAttempt[];
    return attempts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (error) {
    console.warn('Error fetching attempts, trying cache:', error);
    try {
      const cachedSnapshot = await getDocsFromCache(q);
      const attempts = cachedSnapshot.docs.map(doc => ({ attemptId: doc.id, ...doc.data() })) as ExamAttempt[];
      return attempts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch { return []; }
  }
}

export async function getExamAttempts(examId: string): Promise<ExamAttempt[]> {
  const q = query(collection(db, 'examAttempts'), where('examId', '==', examId));
  try {
    const querySnapshot = await getDocs(q);
    const attempts = querySnapshot.docs.map(doc => ({ attemptId: doc.id, ...doc.data() })) as ExamAttempt[];
    return attempts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (error) {
    console.warn('Error fetching exam attempts, trying cache:', error);
    try {
      const cachedSnapshot = await getDocsFromCache(q);
      const attempts = cachedSnapshot.docs.map(doc => ({ attemptId: doc.id, ...doc.data() })) as ExamAttempt[];
      return attempts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch { return []; }
  }
}

export async function getAttemptCount(studentId: string, examId: string): Promise<number> {
  const q = query(collection(db, 'examAttempts'), where('studentId', '==', studentId), where('examId', '==', examId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.size;
}

export async function saveAnswer(attemptId: string, questionId: string, answerData: Omit<Answer, 'attemptId' | 'questionId'>) {
  const answer = {
    questionId, attemptId,
    selectedOptionIndex: answerData.selectedOptionIndex ?? null,
    studentAnswer: answerData.studentAnswer ?? null,
    timeSpentSeconds: answerData.timeSpentSeconds ?? null,
    answeredAt: Timestamp.now()
  };
  const docRef = doc(db, 'examAttempts', attemptId, 'answers', questionId);
  await setDoc(docRef, answer, { merge: true });
}

export async function getAnswers(attemptId: string): Promise<Answer[]> {
  const querySnapshot = await getDocs(collection(db, 'examAttempts', attemptId, 'answers'));
  return querySnapshot.docs.map(doc => doc.data()) as Answer[];
}

export async function submitAttempt(attemptId: string, _totalScore: number, _maxScore: number, timeSpentSeconds: number) {
  const res = await callBackend<{ totalScore: number; maxScore: number }>('/api/content-access/submitStudentExamAttempt', { attemptId, timeSpentSeconds });
  return res;
}

export function calculateScoreFromAnswers(questions: Question[], answers: Answer[]): { totalScore: number; maxScore: number } {
  let totalScore = 0; let maxScore = 0;
  for (const question of questions) {
    maxScore += question.marks || 0;
    const answer = answers.find(a => a.questionId === question.questionId);
    if (typeof answer?.manualGrade === 'number') totalScore += answer.manualGrade;
    else if (answer?.isCorrect) totalScore += question.marks || 0;
  }
  return { totalScore, maxScore };
}

export async function calculateScore(attemptId: string, questions: Question[]): Promise<{ totalScore: number; maxScore: number }> {
  const answers = await getAnswers(attemptId);
  return calculateScoreFromAnswers(questions, answers);
}

export async function deleteAttempt(attemptId: string) { await deleteDoc(doc(db, 'examAttempts', attemptId)); }

export async function saveAnswerGrade(attemptId: string, questionId: string, manualGrade: number, isCorrect: boolean, gradedBy?: string): Promise<{ totalScore: number; maxScore: number }> {
  const attemptRef = doc(db, 'examAttempts', attemptId);
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new Error('Exam attempt not found');
  const [questions, existingAnswers] = await Promise.all([getQuestions(attempt.examId), getAnswers(attemptId)]);
  const answers = existingAnswers.filter(answer => answer.questionId !== questionId);
  answers.push({ questionId, attemptId, manualGrade, isCorrect } as Answer);
  const score = calculateScoreFromAnswers(questions, answers);
  const batch = writeBatch(db);
  const answerRef = doc(db, 'examAttempts', attemptId, 'answers', questionId);
  batch.set(answerRef, { questionId, attemptId, manualGrade, isCorrect, gradedAt: serverTimestamp(), gradedBy: gradedBy || 'admin' }, { merge: true });
  batch.update(attemptRef, score);
  await batch.commit();
  return score;
}
