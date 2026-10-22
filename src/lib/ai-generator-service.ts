import {
  AIProviderId,
  GenerateBatchRequest,
  GenerateBatchResponse,
  NormalizedQuestion,
  ProviderStatusInfo,
  AIGenerationJob,
  QuestionType,
  Difficulty,
  Language
} from '@/types/ai-generator';
import { db, auth } from '@/integrations/firebase/client';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
  query,
  where,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { saveQuestionsBatch } from '@/lib/firebase-exams';

/**
 * Fetch health & configuration status for all 4 AI providers
 */
export async function getAIProviderStatuses(): Promise<ProviderStatusInfo[]> {
  try {
    const res = await fetch('/api/ai/provider-status', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch provider status: ${res.statusText}`);
    }

    const data = await res.json();
    return data.statuses || [];
  } catch (err: any) {
    console.warn('Error checking AI provider status:', err.message);
    return [
      { id: 'gemini', name: 'Google Gemini', configured: false, inCooldown: false, cooldownRemainingSeconds: 0 },
      { id: 'groq', name: 'Groq', configured: false, inCooldown: false, cooldownRemainingSeconds: 0 },
      { id: 'openrouter', name: 'OpenRouter', configured: false, inCooldown: false, cooldownRemainingSeconds: 0 },
      { id: 'huggingface', name: 'Hugging Face', configured: false, inCooldown: false, cooldownRemainingSeconds: 0 },
    ];
  }
}

/**
 * Call server endpoint to generate a single batch of questions
 */
export async function generateBatchCall(
  request: GenerateBatchRequest
): Promise<GenerateBatchResponse> {
  const token = await auth.currentUser?.getIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/ai/generate-batch', {
    method: 'POST',
    headers,
    body: JSON.stringify(request)
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error || `HTTP ${res.status} ${res.statusText}`;
    return {
      success: false,
      questions: [],
      fallbackOccurred: data?.fallbackOccurred || false,
      attempts: data?.attempts || [],
      error: errorMsg
    };
  }

  return data as GenerateBatchResponse;
}

import { ExtractedPageItem } from './prompt-scope-extractor';

export interface ExtractedDocument {
  fullText: string;
  pages: ExtractedPageItem[];
  totalPages: number;
  fileName?: string;
}

/**
 * Extract structured, page-by-page document content from uploaded PDF, text, or markdown file
 */
export async function extractDocumentFromFile(file: File): Promise<ExtractedDocument> {
  const maxSize = 20 * 1024 * 1024; // 20 MB max
  if (file.size > maxSize) {
    throw new Error('File exceeds maximum size limit of 20MB');
  }

  const name = file.name.toLowerCase();

  // PDF
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    if ((pdfjsLib as any).GlobalWorkerOptions && !(pdfjsLib as any).GlobalWorkerOptions.workerSrc) {
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pages: ExtractedPageItem[] = [];
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 150);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push({ pageNumber: i, text: pageText });
      fullText += `--- [Page ${i}] ---\n${pageText}\n\n`;
    }

    const cleaned = fullText.trim();
    if (cleaned.length < 30) {
      throw new Error('Extracted text is too short. The PDF may be scanned or image-only.');
    }

    return {
      fullText: cleaned,
      pages,
      totalPages: pdf.numPages,
      fileName: file.name
    };
  }

  // Text, Markdown, JSON, CSV
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text || text.trim().length === 0) {
        reject(new Error('Uploaded text file is empty.'));
      } else {
        resolve(text.trim());
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });

  return {
    fullText: content,
    pages: [{ pageNumber: 1, text: content }],
    totalPages: 1,
    fileName: file.name
  };
}

/**
 * Extract plain text from uploaded PDF, text, or markdown file (backward-compatible)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const doc = await extractDocumentFromFile(file);
  return doc.fullText;
}

/**
 * Recursively removes all `undefined` values from an object or array.
 * Firestore strictly rejects documents containing `undefined` properties.
 */
export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefinedFields(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    // Preserve Firestore Timestamps, Dates, or special sentinel objects
    if (
      obj instanceof Date ||
      typeof (obj as any).toDate === 'function' ||
      (obj as any)._methodName
    ) {
      return obj;
    }
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = removeUndefinedFields(value);
      }
    }
    return clean as T;
  }
  return obj;
}

/**
 * Create or save an AI generation job record in Firestore
 */
export async function saveJobToFirestore(job: AIGenerationJob): Promise<void> {
  try {
    const jobRef = doc(db, 'aiGenerationJobs', job.jobId);
    const data: Record<string, any> = {
      ...job,
      updatedAt: Timestamp.now()
    };
    if (!job.createdAt) {
      data.createdAt = Timestamp.now();
    }
    const cleanData = removeUndefinedFields(data);
    await setDoc(jobRef, cleanData, { merge: true });
  } catch (err: any) {
    console.warn(`[saveJobToFirestore] Failed to persist job ${job.jobId} to Firestore:`, err);
    // Never rethrow: audit log failure should never abort the active generation loop
  }
}

/**
 * Fetch an AI generation job by ID
 */
export async function getJobFromFirestore(jobId: string): Promise<AIGenerationJob | null> {
  const jobRef = doc(db, 'aiGenerationJobs', jobId);
  const snap = await getDoc(jobRef);
  if (!snap.exists()) return null;
  return snap.data() as AIGenerationJob;
}

/**
 * Get recent AI generation jobs created by the current admin
 */
export async function getRecentJobs(adminId: string): Promise<AIGenerationJob[]> {
  try {
    const q = query(
      collection(db, 'aiGenerationJobs'),
      where('createdBy', '==', adminId),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AIGenerationJob);
  } catch (err) {
    console.warn('Failed to load recent AI jobs:', err);
    return [];
  }
}

/**
 * Save accepted/reviewed questions directly to an exam document in Firestore
 */
export async function saveQuestionsToExam(
  examId: string,
  questions: NormalizedQuestion[]
): Promise<{ addedCount: number; skippedCount: number }> {
  const mappedQuestions = questions.map((q, idx) => ({
    examId,
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options || [],
    correctOptionIndex: q.correctOptionIndex,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    marks: q.marks || 1,
    feedbackType: 'instant' as const,
    generatedByAI: true,
    orderIndex: idx + 1
  }));

  return await saveQuestionsBatch(examId, mappedQuestions);
}

/**
 * Duplicate detection helper: returns groups or flags of question indices that are near-duplicates
 */
export function detectDuplicateQuestions(questions: NormalizedQuestion[]): Set<number> {
  const duplicates = new Set<number>();
  const seenTexts = new Map<string, number>();

  const normalizeStem = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  questions.forEach((q, idx) => {
    const stem = normalizeStem(q.questionText);
    if (!stem || stem.length < 10) return;

    if (seenTexts.has(stem)) {
      duplicates.add(idx);
      duplicates.add(seenTexts.get(stem)!);
    } else {
      seenTexts.set(stem, idx);
    }
  });

  return duplicates;
}
