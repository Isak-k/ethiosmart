import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  getDocFromCache,
  getDocsFromCache,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import app, { db } from '@/integrations/firebase/client';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ExamAttempt, Answer, Question } from '@/integrations/firebase/types';
import { getQuestions } from '@/lib/firebase-exams';

export async function createAttempt(
  examId: string,
  _studentId: string,
  _examTitle: string,
  _studentName: string,
  _studentEmail: string
): Promise<string> {
  // Normal exam attempts are created by a trusted callable. The server
  // derives the student identity from Firebase Auth and atomically reserves
  // any configured free-attempt allowance.
  const functions = getFunctions(app);
  const createSecureAttempt = httpsCallable<
    { examId: string },
    { attemptId: string; freeAttemptsRemaining: number | null }
  >(functions, 'createStudentExamAttempt');
  const response = await createSecureAttempt({ examId });
  return response.data.attemptId;
}

export async function getAttempt(attemptId: string): Promise<ExamAttempt | null> {
  const docRef = doc(db, 'examAttempts', attemptId);
  
  try {
    // Try cache first for offline support
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        attemptId: docSnap.id,
        ...docSnap.data()
      } as ExamAttempt;
    }
  } catch (error) {
    console.warn('Error fetching attempt, trying cache:', error);
    try {
      const cachedSnap = await getDocFromCache(docRef);
      if (cachedSnap.exists()) {
        return {
          attemptId: cachedSnap.id,
          ...cachedSnap.data()
        } as ExamAttempt;
      }
    } catch (cacheError) {
      console.error('Cache fetch failed:', cacheError);
    }
  }
  
  return null;
}

export async function getStudentAttempts(studentId: string, examId?: string): Promise<ExamAttempt[]> {
  let q = query(
    collection(db, 'examAttempts'),
    where('studentId', '==', studentId)
    // orderBy('createdAt', 'desc') // Removed to avoid composite index requirement
  );
  
  if (examId) {
    q = query(q, where('examId', '==', examId));
  }
  
  try {
    // Try regular fetch (uses cache automatically with offline persistence)
    const querySnapshot = await getDocs(q);
    const attempts = querySnapshot.docs.map(doc => ({
      attemptId: doc.id,
      ...doc.data()
    })) as ExamAttempt[];

    // Client-side sort
    return attempts.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.warn('Error fetching attempts, trying cache:', error);
    try {
      // Fallback to cache-only
      const cachedSnapshot = await getDocsFromCache(q);
      const attempts = cachedSnapshot.docs.map(doc => ({
        attemptId: doc.id,
        ...doc.data()
      })) as ExamAttempt[];

      return attempts.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
    } catch (cacheError) {
      console.error('Cache fetch failed:', cacheError);
      return [];
    }
  }
}

export async function getExamAttempts(examId: string): Promise<ExamAttempt[]> {
  const q = query(
    collection(db, 'examAttempts'),
    where('examId', '==', examId)
    // orderBy('createdAt', 'desc') // Removed to avoid composite index requirement
  );
  
  try {
    // Try regular fetch (uses cache automatically)
    const querySnapshot = await getDocs(q);
    const attempts = querySnapshot.docs.map(doc => ({
      attemptId: doc.id,
      ...doc.data()
    })) as ExamAttempt[];

    // Client-side sort
    return attempts.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    console.warn('Error fetching exam attempts, trying cache:', error);
    try {
      // Fallback to cache-only
      const cachedSnapshot = await getDocsFromCache(q);
      const attempts = cachedSnapshot.docs.map(doc => ({
        attemptId: doc.id,
        ...doc.data()
      })) as ExamAttempt[];

      return attempts.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
    } catch (cacheError) {
      console.error('Cache fetch failed:', cacheError);
      return [];
    }
  }
}

export async function getAttemptCount(studentId: string, examId: string): Promise<number> {
  const q = query(
    collection(db, 'examAttempts'),
    where('studentId', '==', studentId),
    where('examId', '==', examId)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.size;
}

// Answer management with upsert pattern
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  answerData: Omit<Answer, 'attemptId' | 'questionId'>
) {
  const answer: Answer = {
    questionId,
    attemptId,
    ...answerData,
    answeredAt: Timestamp.now()
  };
  
  // Use setDoc with merge to enable upsert behavior
  const docRef = doc(db, 'examAttempts', attemptId, 'answers', questionId);
  await setDoc(docRef, answer, { merge: true });
}

export async function getAnswers(attemptId: string): Promise<Answer[]> {
  const querySnapshot = await getDocs(collection(db, 'examAttempts', attemptId, 'answers'));
  return querySnapshot.docs.map(doc => doc.data()) as Answer[];
}

export async function submitAttempt(
  attemptId: string,
  totalScore: number,
  maxScore: number,
  timeSpentSeconds: number
) {
  const docRef = doc(db, 'examAttempts', attemptId);
  await updateDoc(docRef, {
    isSubmitted: true,
    submittedAt: serverTimestamp(),
    totalScore,
    maxScore,
    timeSpentSeconds
  });
}

export function calculateScoreFromAnswers(questions: Question[], answers: Answer[]): { totalScore: number; maxScore: number } {
  let totalScore = 0;
  let maxScore = 0;
  
  for (const question of questions) {
    maxScore += question.marks || 0;
    const answer = answers.find(a => a.questionId === question.questionId);
    if (typeof answer?.manualGrade === 'number') {
      totalScore += answer.manualGrade;
    } else if (answer?.isCorrect) {
      totalScore += question.marks || 0;
    }
  }
  
  return { totalScore, maxScore };
}

export async function calculateScore(attemptId: string, questions: Question[]): Promise<{ totalScore: number; maxScore: number }> {
  const answers = await getAnswers(attemptId);
  return calculateScoreFromAnswers(questions, answers);
}

export async function deleteAttempt(attemptId: string) {
  const docRef = doc(db, 'examAttempts', attemptId);
  await deleteDoc(docRef);
}


export async function saveAnswerGrade(
  attemptId: string,
  questionId: string,
  manualGrade: number,
  isCorrect: boolean,
  gradedBy?: string
) : Promise<{ totalScore: number; maxScore: number }> {
  const attemptRef = doc(db, 'examAttempts', attemptId);
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new Error('Exam attempt not found');

  const [questions, existingAnswers] = await Promise.all([
    getQuestions(attempt.examId),
    getAnswers(attemptId),
  ]);
  const answers = existingAnswers.filter(answer => answer.questionId !== questionId);
  answers.push({ questionId, attemptId, manualGrade, isCorrect } as Answer);
  const score = calculateScoreFromAnswers(questions, answers);

  const batch = writeBatch(db);
  const answerRef = doc(db, 'examAttempts', attemptId, 'answers', questionId);
  batch.set(answerRef, {
    questionId,
    attemptId,
    manualGrade,
    isCorrect,
    gradedAt: serverTimestamp(),
    gradedBy: gradedBy || 'admin'
  }, { merge: true });
  batch.update(attemptRef, score);
  await batch.commit();

  return score;
}
