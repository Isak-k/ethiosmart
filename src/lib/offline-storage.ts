import { Exam, Question } from '@/integrations/firebase/types';

const DB_NAME = 'exam_pro_offline';
const DB_VERSION = 1;
const EXAMS_STORE = 'exams';
const QUESTIONS_STORE = 'questions';
const METADATA_STORE = 'metadata';

interface OfflineExam extends Exam {
  downloadedAt: number;
  departmentId?: string;
}

interface DownloadMetadata {
  examId: string;
  downloadedAt: number;
  questionCount: number;
  departmentId?: string;
  status: 'completed' | 'partial' | 'failed';
}

let db: IDBDatabase | null = null;

export async function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!database.objectStoreNames.contains(EXAMS_STORE)) {
        database.createObjectStore(EXAMS_STORE, { keyPath: 'examId' });
      }
      if (!database.objectStoreNames.contains(QUESTIONS_STORE)) {
        const questionStore = database.createObjectStore(QUESTIONS_STORE, { keyPath: 'questionId' });
        questionStore.createIndex('examId', 'examId', { unique: false });
      }
      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: 'examId' });
      }
    };
  });
}

export async function saveExamOffline(exam: Exam, departmentId?: string): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([EXAMS_STORE, METADATA_STORE], 'readwrite');

  const offlineExam: OfflineExam = {
    ...exam,
    downloadedAt: Date.now(),
    departmentId,
  };

  const metadata: DownloadMetadata = {
    examId: exam.examId,
    downloadedAt: Date.now(),
    questionCount: exam.questionCount,
    departmentId,
    status: 'partial',
  };

  return new Promise((resolve, reject) => {
    const examStore = transaction.objectStore(EXAMS_STORE);
    const metadataStore = transaction.objectStore(METADATA_STORE);

    const examRequest = examStore.put(offlineExam);
    const metadataRequest = metadataStore.put(metadata);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveQuestionsOffline(examId: string, questions: Question[]): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([QUESTIONS_STORE, METADATA_STORE], 'readwrite');

  return new Promise((resolve, reject) => {
    const questionStore = transaction.objectStore(QUESTIONS_STORE);
    const metadataStore = transaction.objectStore(METADATA_STORE);

    // Clear existing questions for this exam
    const index = questionStore.index('examId');
    const range = IDBKeyRange.only(examId);
    const deleteRequest = index.openCursor(range);

    deleteRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // Add new questions
    questions.forEach((question) => {
      questionStore.put(question);
    });

    // Update metadata to mark as completed
    const metadataRequest = metadataStore.get(examId);
    metadataRequest.onsuccess = () => {
      const metadata = metadataRequest.result as DownloadMetadata;
      if (metadata) {
        metadata.status = 'completed';
        metadataStore.put(metadata);
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getOfflineExam(examId: string): Promise<OfflineExam | null> {
  const database = await initOfflineDB();
  const transaction = database.transaction([EXAMS_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(EXAMS_STORE);
    const request = store.get(examId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineQuestions(examId: string): Promise<Question[]> {
  const database = await initOfflineDB();
  const transaction = database.transaction([QUESTIONS_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(QUESTIONS_STORE);
    const index = store.index('examId');
    const range = IDBKeyRange.only(examId);
    const request = index.getAll(range);

    request.onsuccess = () => {
      const questions = request.result as Question[];
      resolve(questions.sort((a, b) => a.orderIndex - b.orderIndex));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getDownloadedExams(departmentId?: string): Promise<OfflineExam[]> {
  const database = await initOfflineDB();
  const transaction = database.transaction([EXAMS_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(EXAMS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      let exams = request.result as OfflineExam[];
      if (departmentId) {
        exams = exams.filter((e) => e.departmentId === departmentId);
      }
      resolve(exams);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getDownloadMetadata(examId: string): Promise<DownloadMetadata | null> {
  const database = await initOfflineDB();
  const transaction = database.transaction([METADATA_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.get(examId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineExam(examId: string): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([EXAMS_STORE, QUESTIONS_STORE, METADATA_STORE], 'readwrite');

  return new Promise((resolve, reject) => {
    const examStore = transaction.objectStore(EXAMS_STORE);
    const questionStore = transaction.objectStore(QUESTIONS_STORE);
    const metadataStore = transaction.objectStore(METADATA_STORE);

    examStore.delete(examId);
    metadataStore.delete(examId);

    // Delete all questions for this exam
    const index = questionStore.index('examId');
    const range = IDBKeyRange.only(examId);
    const deleteRequest = index.openCursor(range);

    deleteRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getOfflineStorageSize(): Promise<number> {
  const database = await initOfflineDB();
  const transaction = database.transaction([EXAMS_STORE, QUESTIONS_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const examStore = transaction.objectStore(EXAMS_STORE);
    const questionStore = transaction.objectStore(QUESTIONS_STORE);

    const examRequest = examStore.getAll();
    const questionRequest = questionStore.getAll();

    let exams: any[] = [];
    let questions: any[] = [];

    examRequest.onsuccess = () => {
      exams = examRequest.result;
    };

    questionRequest.onsuccess = () => {
      questions = questionRequest.result;
    };

    transaction.oncomplete = () => {
      const size = JSON.stringify({ exams, questions }).length;
      resolve(size);
    };

    transaction.onerror = () => reject(transaction.error);
  });
}
