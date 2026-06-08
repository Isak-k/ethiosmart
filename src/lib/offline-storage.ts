import { Exam, Question, PracticeExamConfig } from '@/integrations/firebase/types';

const DB_NAME = 'exam_pro_offline';
const DB_VERSION = 4;  // Increment version to force schema upgrade with practice stores
const EXAMS_STORE = 'exams';
const QUESTIONS_STORE = 'questions';
const METADATA_STORE = 'metadata';
const ATTEMPTS_STORE = 'attempts';
const ANSWERS_STORE = 'answers';
const PRACTICE_CONFIGS_STORE = 'practice_configs';
const EXAM_ATTEMPTS_SUBMITTED_STORE = 'exam_attempts_submitted';
const APP_STATE_STORE = 'app_state';
const PRACTICE_ATTEMPTS_STORE = 'practice_attempts';
const PRACTICE_ANSWERS_STORE = 'practice_answers';

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

    request.onerror = () => {
      console.error("IndexedDB open error:", request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      try {
        const database = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        console.log(`Upgrading database from version ${oldVersion} to ${DB_VERSION}`);

        // Create object stores if they don't exist
        if (!database.objectStoreNames.contains(EXAMS_STORE)) {
          console.log(`Creating object store: ${EXAMS_STORE}`);
          database.createObjectStore(EXAMS_STORE, { keyPath: 'examId' });
        }
        if (!database.objectStoreNames.contains(QUESTIONS_STORE)) {
          console.log(`Creating object store: ${QUESTIONS_STORE}`);
          const questionStore = database.createObjectStore(QUESTIONS_STORE, { keyPath: 'questionId' });
          questionStore.createIndex('examId', 'examId', { unique: false });
        }
        if (!database.objectStoreNames.contains(METADATA_STORE)) {
          console.log(`Creating object store: ${METADATA_STORE}`);
          database.createObjectStore(METADATA_STORE, { keyPath: 'examId' });
        }
        if (!database.objectStoreNames.contains(ATTEMPTS_STORE)) {
          console.log(`Creating object store: ${ATTEMPTS_STORE}`);
          const attemptStore = database.createObjectStore(ATTEMPTS_STORE, { keyPath: 'attemptId' });
          attemptStore.createIndex('examId', 'examId', { unique: false });
          attemptStore.createIndex('studentId', 'studentId', { unique: false });
        }
        if (!database.objectStoreNames.contains(ANSWERS_STORE)) {
          console.log(`Creating object store: ${ANSWERS_STORE}`);
          const answerStore = database.createObjectStore(ANSWERS_STORE, { keyPath: ['attemptId', 'questionId'] });
          answerStore.createIndex('attemptId', 'attemptId', { unique: false });
        }
        
        // New stores for v3
        if (!database.objectStoreNames.contains(PRACTICE_CONFIGS_STORE)) {
          console.log(`Creating object store: ${PRACTICE_CONFIGS_STORE}`);
          const configStore = database.createObjectStore(PRACTICE_CONFIGS_STORE, { keyPath: 'examId' });
          configStore.createIndex('examType', 'examType', { unique: false });
        }
        if (!database.objectStoreNames.contains(EXAM_ATTEMPTS_SUBMITTED_STORE)) {
          console.log(`Creating object store: ${EXAM_ATTEMPTS_SUBMITTED_STORE}`);
          const submittedStore = database.createObjectStore(EXAM_ATTEMPTS_SUBMITTED_STORE, { keyPath: 'attemptId' });
          submittedStore.createIndex('examId', 'examId', { unique: false });
          submittedStore.createIndex('studentId', 'studentId', { unique: false });
          submittedStore.createIndex('completedAt', 'completedAt', { unique: false });
        }
        if (!database.objectStoreNames.contains(APP_STATE_STORE)) {
          console.log(`Creating object store: ${APP_STATE_STORE}`);
          database.createObjectStore(APP_STATE_STORE, { keyPath: 'key' });
        }
        
        // Practice exam stores
        if (!database.objectStoreNames.contains(PRACTICE_ATTEMPTS_STORE)) {
          console.log(`Creating object store: ${PRACTICE_ATTEMPTS_STORE}`);
          const practiceAttemptStore = database.createObjectStore(PRACTICE_ATTEMPTS_STORE, { keyPath: 'attemptId' });
          practiceAttemptStore.createIndex('examId', 'examId', { unique: false });
          practiceAttemptStore.createIndex('studentId', 'studentId', { unique: false });
        }
        if (!database.objectStoreNames.contains(PRACTICE_ANSWERS_STORE)) {
          console.log(`Creating object store: ${PRACTICE_ANSWERS_STORE}`);
          const practiceAnswerStore = database.createObjectStore(PRACTICE_ANSWERS_STORE, { keyPath: ['attemptId', 'questionId'] });
          practiceAnswerStore.createIndex('attemptId', 'attemptId', { unique: false });
        }
        
        console.log("Database schema upgrade completed successfully");
      } catch (error) {
        console.error("Error in onupgradeneeded:", error);
        reject(error);
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

// Attempt and Answer Management
export async function saveOfflineAttempt(attempt: any): Promise<void> {
  try {
    const database = await initOfflineDB();
    
    // Verify the store exists
    if (!database.objectStoreNames.contains(ATTEMPTS_STORE)) {
      throw new Error(`Object store '${ATTEMPTS_STORE}' not found in database`);
    }
    
    const transaction = database.transaction([ATTEMPTS_STORE], 'readwrite');

    return new Promise((resolve, reject) => {
      const store = transaction.objectStore(ATTEMPTS_STORE);
      const request = store.put(attempt);

      request.onerror = () => {
        console.error("Put request error:", request.error);
        reject(request.error);
      };

      transaction.oncomplete = () => {
        console.log("Attempt saved successfully");
        resolve();
      };
      
      transaction.onerror = () => {
        console.error("Transaction error:", transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("Error in saveOfflineAttempt:", error);
    throw error;
  }
}

export async function getOfflineAttempt(attemptId: string): Promise<any | null> {
  const database = await initOfflineDB();
  const transaction = database.transaction([ATTEMPTS_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(ATTEMPTS_STORE);
    const request = store.get(attemptId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineAttemptsByExam(examId: string, studentId: string): Promise<any[]> {
  const database = await initOfflineDB();
  const transaction = database.transaction([ATTEMPTS_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(ATTEMPTS_STORE);
    const index = store.index('examId');
    const range = IDBKeyRange.only(examId);
    const request = index.getAll(range);

    request.onsuccess = () => {
      const attempts = request.result.filter((a: any) => a.studentId === studentId);
      resolve(attempts);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineAnswer(attemptId: string, questionId: string, answer: any): Promise<void> {
  try {
    const database = await initOfflineDB();
    
    // Verify the store exists
    if (!database.objectStoreNames.contains(ANSWERS_STORE)) {
      throw new Error(`Object store '${ANSWERS_STORE}' not found in database`);
    }
    
    const transaction = database.transaction([ANSWERS_STORE], 'readwrite');

    return new Promise((resolve, reject) => {
      const store = transaction.objectStore(ANSWERS_STORE);
      const request = store.put({ ...answer, attemptId, questionId });

      request.onerror = () => {
        console.error("Put request error:", request.error);
        reject(request.error);
      };

      transaction.oncomplete = () => {
        console.log("Answer saved successfully");
        resolve();
      };
      
      transaction.onerror = () => {
        console.error("Transaction error:", transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("Error in saveOfflineAnswer:", error);
    throw error;
  }
}

export async function getOfflineAnswers(attemptId: string): Promise<any[]> {
  const database = await initOfflineDB();
  const transaction = database.transaction([ANSWERS_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(ANSWERS_STORE);
    const index = store.index('attemptId');
    const range = IDBKeyRange.only(attemptId);
    const request = index.getAll(range);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


// Practice Config Management
export async function savePracticeConfig(examId: string, config: PracticeExamConfig): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([PRACTICE_CONFIGS_STORE], 'readwrite');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(PRACTICE_CONFIGS_STORE);
    const request = store.put({ examId, ...config });

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getPracticeConfig(examId: string): Promise<PracticeExamConfig | null> {
  const database = await initOfflineDB();
  const transaction = database.transaction([PRACTICE_CONFIGS_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(PRACTICE_CONFIGS_STORE);
    const request = store.get(examId);

    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        // Remove examId from config object
        const { examId: _, ...config } = result;
        resolve(config as PracticeExamConfig);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllPracticeConfigs(): Promise<Array<{ examId: string; config: PracticeExamConfig }>> {
  const database = await initOfflineDB();
  const transaction = database.transaction([PRACTICE_CONFIGS_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(PRACTICE_CONFIGS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result.map((item: any) => {
        const { examId, ...config } = item;
        return { examId, config: config as PracticeExamConfig };
      });
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deletePracticeConfig(examId: string): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([PRACTICE_CONFIGS_STORE], 'readwrite');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(PRACTICE_CONFIGS_STORE);
    const request = store.delete(examId);

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Submitted Exam Attempts Management
export interface SubmittedExamAttempt {
  attemptId: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  examTitle: string;
  completedAt: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  timeSpentSeconds: number;
  practiceMode?: boolean; // true if this is a practice exam
  results?: {
    correct: number;
    wrong: number;
    skipped: number;
  };
}

export async function saveSubmittedExamAttempt(attempt: SubmittedExamAttempt): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([EXAM_ATTEMPTS_SUBMITTED_STORE], 'readwrite');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(EXAM_ATTEMPTS_SUBMITTED_STORE);
    const request = store.put(attempt);

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getSubmittedExamAttempt(attemptId: string): Promise<SubmittedExamAttempt | null> {
  const database = await initOfflineDB();
  const transaction = database.transaction([EXAM_ATTEMPTS_SUBMITTED_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(EXAM_ATTEMPTS_SUBMITTED_STORE);
    const request = store.get(attemptId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getStudentSubmittedAttempts(studentId: string): Promise<SubmittedExamAttempt[]> {
  const database = await initOfflineDB();
  const transaction = database.transaction([EXAM_ATTEMPTS_SUBMITTED_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(EXAM_ATTEMPTS_SUBMITTED_STORE);
    const index = store.index('studentId');
    const range = IDBKeyRange.only(studentId);
    const request = index.getAll(range);

    request.onsuccess = () => {
      const attempts = request.result.sort(
        (a, b) => b.completedAt - a.completedAt
      );
      resolve(attempts);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getExamSubmittedAttempts(examId: string): Promise<SubmittedExamAttempt[]> {
  const database = await initOfflineDB();
  const transaction = database.transaction([EXAM_ATTEMPTS_SUBMITTED_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(EXAM_ATTEMPTS_SUBMITTED_STORE);
    const index = store.index('examId');
    const range = IDBKeyRange.only(examId);
    const request = index.getAll(range);

    request.onsuccess = () => {
      const attempts = request.result.sort(
        (a, b) => b.completedAt - a.completedAt
      );
      resolve(attempts);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSubmittedExamAttempt(attemptId: string): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([EXAM_ATTEMPTS_SUBMITTED_STORE], 'readwrite');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(EXAM_ATTEMPTS_SUBMITTED_STORE);
    const request = store.delete(attemptId);

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// App State Management
export interface AppStateValue {
  key: string;
  value: any;
  lastUpdated: number;
}

export async function setAppState(key: string, value: any): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([APP_STATE_STORE], 'readwrite');

  const stateValue: AppStateValue = {
    key,
    value,
    lastUpdated: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(APP_STATE_STORE);
    const request = store.put(stateValue);

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAppState(key: string): Promise<any> {
  const database = await initOfflineDB();
  const transaction = database.transaction([APP_STATE_STORE], 'readonly');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(APP_STATE_STORE);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.value || null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAppState(key: string): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([APP_STATE_STORE], 'readwrite');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(APP_STATE_STORE);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearAppState(): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction([APP_STATE_STORE], 'readwrite');

  return new Promise((resolve, reject) => {
    const store = transaction.objectStore(APP_STATE_STORE);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Export store names for use in other modules
export {
  PRACTICE_ATTEMPTS_STORE,
  PRACTICE_ANSWERS_STORE,
};
