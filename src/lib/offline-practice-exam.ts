/**
 * Offline Practice Exam Module
 * Handles offline practice exam execution and result calculation
 */

import { initOfflineDB, PRACTICE_ATTEMPTS_STORE, PRACTICE_ANSWERS_STORE } from './offline-storage';

export interface PracticeAttempt {
  attemptId: string;
  examId: string;
  studentId: string;
  startedAt: number;
  submittedAt: number | null;
  isSubmitted: boolean;
  timeSpentSeconds: number | null;
  totalScore: number | null;
  maxScore: number | null;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedAnswers: number;
  percentage: number | null;
  passStatus: 'pass' | 'fail' | null;
  createdAt: number;
  totalQuestions?: number; // Track total question count for skipped calculation
}

export interface PracticeAnswer {
  attemptId: string;
  questionId: string;
  selectedOptionIndex?: number | null;
  selectedBoolean?: boolean | null;
  textAnswer?: string | null;
  isCorrect: boolean;
  marks: number;
}

export interface PracticeExamResult {
  attemptId: string;
  examId: string;
  totalScore: number;
  maxScore: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedAnswers: number;
  percentage: number;
  passStatus: 'pass' | 'fail';
  timeSpentSeconds: number;
  submittedAt: number;
}

/**
 * Initialize practice exam stores
 */
async function initPracticeStores(): Promise<IDBDatabase> {
  const db = await initOfflineDB();

  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(PRACTICE_ATTEMPTS_STORE)) {
        const attemptStore = db.createObjectStore(PRACTICE_ATTEMPTS_STORE, { keyPath: 'attemptId' });
        attemptStore.createIndex('examId', 'examId', { unique: false });
        attemptStore.createIndex('studentId', 'studentId', { unique: false });
      }
      if (!db.objectStoreNames.contains(PRACTICE_ANSWERS_STORE)) {
        const answerStore = db.createObjectStore(PRACTICE_ANSWERS_STORE, { keyPath: ['attemptId', 'questionId'] });
        answerStore.createIndex('attemptId', 'attemptId', { unique: false });
      }
      resolve(db);
    } catch (error) {
      // Stores might already exist
      resolve(db);
    }
  });
}

/**
 * Create a new practice exam attempt
 */
export async function createPracticeAttempt(
  examId: string,
  studentId: string,
  maxScore: number,
  totalQuestions?: number
): Promise<string> {
  const db = await initPracticeStores();
  const attemptId = `practice_${examId}_${studentId}_${Date.now()}`;

  const attempt: PracticeAttempt = {
    attemptId,
    examId,
    studentId,
    startedAt: Date.now(),
    submittedAt: null,
    isSubmitted: false,
    timeSpentSeconds: null,
    totalScore: null,
    maxScore,
    correctAnswers: 0,
    incorrectAnswers: 0,
    skippedAnswers: 0,
    percentage: null,
    passStatus: null,
    createdAt: Date.now(),
    totalQuestions: totalQuestions || 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRACTICE_ATTEMPTS_STORE, 'readwrite');
    const store = transaction.objectStore(PRACTICE_ATTEMPTS_STORE);
    const request = store.add(attempt);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log(`✓ Practice attempt created: ${attemptId}`);
      resolve(attemptId);
    };
  });
}

/**
 * Save a practice exam answer
 * Note: Do NOT mark answers as correct/incorrect here.
 * Correctness is calculated only during submission.
 */
export async function savePracticeAnswer(
  attemptId: string,
  questionId: string,
  answer: number | string | boolean | null,
  isCorrect: boolean,
  marks: number
): Promise<void> {
  const db = await initPracticeStores();

  const practiceAnswer: PracticeAnswer = {
    attemptId,
    questionId,
    selectedOptionIndex: typeof answer === 'number' ? answer : undefined,
    selectedBoolean: typeof answer === 'boolean' ? answer : undefined,
    textAnswer: typeof answer === 'string' ? answer : undefined,
    isCorrect: false, // Always store false; correctness calculated on submit
    marks: 0, // Always store 0; marks calculated on submit
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRACTICE_ANSWERS_STORE, 'readwrite');
    const store = transaction.objectStore(PRACTICE_ANSWERS_STORE);
    const request = store.put(practiceAnswer);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get all answers for a practice attempt
 */
export async function getPracticeAnswers(attemptId: string): Promise<PracticeAnswer[]> {
  const db = await initPracticeStores();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRACTICE_ANSWERS_STORE, 'readonly');
    const store = transaction.objectStore(PRACTICE_ANSWERS_STORE);
    const index = store.index('attemptId');
    const request = index.getAll(attemptId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Delete a practice exam answer (for clearing)
 */
export async function deletePracticeAnswer(
  attemptId: string,
  questionId: string
): Promise<void> {
  const db = await initPracticeStores();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRACTICE_ANSWERS_STORE, 'readwrite');
    const store = transaction.objectStore(PRACTICE_ANSWERS_STORE);
    const request = store.delete([attemptId, questionId]);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log(`✓ Practice answer deleted: ${attemptId}/${questionId}`);
      resolve();
    };
  });
}

/**
 * Submit a practice exam and calculate results
 */
export async function submitPracticeExam(
  attemptId: string,
  questions: Array<{ questionId: string; correctOptionIndex: number; marks: number }>,
  passingPercentage: number = 50
): Promise<PracticeExamResult> {
  const db = await initPracticeStores();

  // Get the attempt
  const attempt = await getPracticeAttempt(attemptId);
  if (!attempt) {
    throw new Error(`Practice attempt not found: ${attemptId}`);
  }

  // Get all answers
  const answers = await getPracticeAnswers(attemptId);

  // Calculate results by checking correctness here (not from stored value)
  let totalScore = 0;
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let skippedAnswers = 0;

  // First, calculate actual question count from questions array
  const totalQuestions = questions.length;

  answers.forEach((answer) => {
    // Skip invalid stored values (like -1 from clearing)
    if (answer.selectedOptionIndex === null || answer.selectedOptionIndex === undefined || answer.selectedOptionIndex === -1) {
      return; // This will be counted as skipped below
    }

    // Find the question to check correctness
    const question = questions.find(q => q.questionId === answer.questionId);
    if (!question) return;

    // Determine correctness by comparing to correct answer
    const isCorrect = answer.selectedOptionIndex === question.correctOptionIndex;
    
    if (isCorrect) {
      totalScore += question.marks;
      correctAnswers++;
    } else {
      incorrectAnswers++;
    }
  });

  // Calculate skipped: questions not answered
  skippedAnswers = totalQuestions - answers.length;

  const percentage = totalQuestions > 0 ? (totalScore / attempt.maxScore) * 100 : 0;
  const passStatus = percentage >= passingPercentage ? 'pass' : 'fail';
  const timeSpentSeconds = Math.floor((Date.now() - attempt.startedAt) / 1000);

  // Update attempt with results
  const updatedAttempt: PracticeAttempt = {
    ...attempt,
    submittedAt: Date.now(),
    isSubmitted: true,
    totalScore,
    correctAnswers,
    incorrectAnswers,
    skippedAnswers,
    percentage,
    passStatus,
    timeSpentSeconds,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRACTICE_ATTEMPTS_STORE, 'readwrite');
    const store = transaction.objectStore(PRACTICE_ATTEMPTS_STORE);
    const request = store.put(updatedAttempt);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result: PracticeExamResult = {
        attemptId,
        examId: attempt.examId,
        totalScore,
        maxScore: attempt.maxScore,
        correctAnswers,
        incorrectAnswers,
        skippedAnswers,
        percentage,
        passStatus,
        timeSpentSeconds,
        submittedAt: Date.now(),
      };
      console.log(`✓ Practice exam submitted with results:`, result);
      resolve(result);
    };
  });
}

/**
 * Get a practice attempt
 */
export async function getPracticeAttempt(attemptId: string): Promise<PracticeAttempt | null> {
  const db = await initPracticeStores();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRACTICE_ATTEMPTS_STORE, 'readonly');
    const store = transaction.objectStore(PRACTICE_ATTEMPTS_STORE);
    const request = store.get(attemptId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Get all practice attempts for a student
 */
export async function getStudentPracticeAttempts(studentId: string): Promise<PracticeAttempt[]> {
  const db = await initPracticeStores();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRACTICE_ATTEMPTS_STORE, 'readonly');
    const store = transaction.objectStore(PRACTICE_ATTEMPTS_STORE);
    const index = store.index('studentId');
    const request = index.getAll(studentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get all practice attempts for an exam
 */
export async function getExamPracticeAttempts(examId: string): Promise<PracticeAttempt[]> {
  const db = await initPracticeStores();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRACTICE_ATTEMPTS_STORE, 'readonly');
    const store = transaction.objectStore(PRACTICE_ATTEMPTS_STORE);
    const index = store.index('examId');
    const request = index.getAll(examId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Delete a practice attempt (local only)
 */
export async function deletePracticeAttempt(attemptId: string): Promise<void> {
  const db = await initPracticeStores();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PRACTICE_ATTEMPTS_STORE, PRACTICE_ANSWERS_STORE], 'readwrite');
    
    const attemptStore = transaction.objectStore(PRACTICE_ATTEMPTS_STORE);
    const answerStore = transaction.objectStore(PRACTICE_ANSWERS_STORE);
    
    attemptStore.delete(attemptId);
    
    // Delete all answers for this attempt
    const answerIndex = answerStore.index('attemptId');
    const answerRequest = answerIndex.openCursor(attemptId);
    
    answerRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      console.log(`✓ Practice attempt deleted: ${attemptId}`);
      resolve();
    };
  });
}
