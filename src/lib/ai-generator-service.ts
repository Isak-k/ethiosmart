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
import {
  orchestrateGenerationBatch,
  getProviderStatus,
} from './ai-engine/orchestrator.ts';
import type { ProviderKeys } from './ai-engine/types.ts';
import { getEffectiveProviderKeys, getAISettings, BUILTIN_DEFAULT_KEYS } from './ai-settings';

/**
 * Retrieve AI provider API keys available to client environment or local storage
 */
export function getClientProviderKeys(): ProviderKeys {
  const meta: Record<string, string | undefined> = (import.meta as any).env || {};
  const getStorage = (key: string): string | undefined => {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        return val && val.trim() ? val.trim() : undefined;
      }
    } catch {
      // Ignore storage access errors
    }
    return undefined;
  };

  let settingsKeys: Partial<ProviderKeys> = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('exampro_ai_system_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.providers) {
          settingsKeys = {
            gemini: parsed.providers.gemini?.enabled ? parsed.providers.gemini?.apiKey : undefined,
            groq: parsed.providers.groq?.enabled ? parsed.providers.groq?.apiKey : undefined,
            openrouter: parsed.providers.openrouter?.enabled ? parsed.providers.openrouter?.apiKey : undefined,
            huggingface: parsed.providers.huggingface?.enabled ? parsed.providers.huggingface?.apiKey : undefined,
          };
        }
      }
    }
  } catch {}

  return {
    gemini:
      settingsKeys.gemini ||
      meta.VITE_GEMINI_API_KEY ||
      meta.GEMINI_API_KEY ||
      getStorage('gemini_api_key') ||
      getStorage('GEMINI_API_KEY') ||
      getStorage('google_ai_api_key') ||
      BUILTIN_DEFAULT_KEYS.gemini,
    groq:
      settingsKeys.groq ||
      meta.VITE_GROQ_API_KEY ||
      meta.GROQ_API_KEY ||
      getStorage('groq_api_key') ||
      getStorage('GROQ_API_KEY') ||
      BUILTIN_DEFAULT_KEYS.groq,
    openrouter:
      settingsKeys.openrouter ||
      meta.VITE_OPENROUTER_API_KEY ||
      meta.OPENROUTER_API_KEY ||
      getStorage('openrouter_api_key') ||
      getStorage('OPENROUTER_API_KEY') ||
      BUILTIN_DEFAULT_KEYS.openrouter,
    huggingface:
      settingsKeys.huggingface ||
      meta.VITE_HUGGING_FACE_API_KEY ||
      meta.HUGGING_FACE_API_KEY ||
      getStorage('huggingface_api_key') ||
      getStorage('HUGGING_FACE_API_KEY') ||
      BUILTIN_DEFAULT_KEYS.huggingface,
  };
}

/**
 * Fetch health & configuration status for all 4 AI providers
 */
export async function getAIProviderStatuses(): Promise<ProviderStatusInfo[]> {
  const effectiveKeys = await getEffectiveProviderKeys();
  try {
    const keysParam = encodeURIComponent(JSON.stringify(effectiveKeys));
    const res = await fetch(`/api/ai/provider-status?keys=${keysParam}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.statuses && Array.isArray(data.statuses) && data.statuses.length > 0) {
        return data.statuses;
      }
    }
  } catch (err: any) {
    console.warn('Error checking server AI provider status, using client environment check:', err.message);
  }

  // Seamless client environment fallback
  const clientKeys = {
    ...getClientProviderKeys(),
    ...effectiveKeys,
  };
  return getProviderStatus(clientKeys);
}

/**
 * Call server endpoint to generate a single batch of questions, with resilient
 * client-side fallback if the server route returns HTTP 405/404 or fails.
 */
export async function generateBatchCall(
  request: GenerateBatchRequest
): Promise<GenerateBatchResponse> {
  const token = await auth.currentUser?.getIdToken();
  const effectiveKeys = await getEffectiveProviderKeys();
  const settings = await getAISettings();

  const requestWithSettings: any = {
    ...request,
    providerPriority: request.providerPriority || settings.providerPriority,
    providerModels: {
      gemini: settings.providers.gemini.model,
      groq: settings.providers.groq.model,
      openrouter: settings.providers.openrouter.model,
      huggingface: settings.providers.huggingface.model,
      ...(request.providerModels || {})
    },
    providerKeys: effectiveKeys,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let serverRes: Response | null = null;
  let serverData: any = null;
  let serverFetchFailed = false;

  try {
    serverRes = await fetch('/api/ai/generate-batch', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestWithSettings)
    });
    serverData = await serverRes.json().catch(() => null);
  } catch (err: any) {
    console.warn('Failed to reach /api/ai/generate-batch server endpoint:', err.message);
    serverFetchFailed = true;
  }

  // 1. If server call was completely successful, return it
  if (serverRes && serverRes.ok && serverData && serverData.success) {
    return serverData as GenerateBatchResponse;
  }

  // 2. If server failed (e.g. HTTP 405 Method Not Allowed, 404 Not Found, 502, or network failure),
  // attempt immediate client-side orchestration using available provider keys
  const clientKeys = {
    ...getClientProviderKeys(),
    ...effectiveKeys,
  };
  const hasClientKeys = Boolean(
    (clientKeys.gemini && clientKeys.gemini.trim().length > 5) ||
    (clientKeys.groq && clientKeys.groq.trim().length > 5) ||
    (clientKeys.openrouter && clientKeys.openrouter.trim().length > 5) ||
    (clientKeys.huggingface && clientKeys.huggingface.trim().length > 5)
  );

  if (hasClientKeys) {
    console.info('[AI Generator] Server API unavailable or returned error. Running client-side AI fallback...');
    try {
      const clientResult = await orchestrateGenerationBatch(requestWithSettings, clientKeys);
      if (clientResult.success) {
        return clientResult;
      }
      // If client also recorded attempts and error, return that informative result
      if (clientResult.attempts && clientResult.attempts.length > 0) {
        return clientResult;
      }
    } catch (clientErr: any) {
      console.error('[AI Generator] Client-side fallback encountered exception:', clientErr);
    }
  }

  // 3. If neither server nor client fallback could succeed, format a descriptive error
  const rawStatus = serverRes ? `HTTP ${serverRes.status} ${serverRes.statusText || ''}`.trim() : '';
  let errorMsg = serverData?.error;
  if (!errorMsg) {
    if (serverRes?.status === 405) {
      errorMsg = 'HTTP 405: Backend generation route not allowed. Please verify API keys in .env or provider settings.';
    } else if (serverRes?.status === 500) {
      errorMsg = !hasClientKeys
        ? 'No AI provider API key is configured. Please open AI Provider Settings and add your API key for Google Gemini, Groq, OpenRouter, or Hugging Face.'
        : 'Internal Server Error (HTTP 500) on generation endpoint. Running with your configured provider settings.';
    } else if (!hasClientKeys) {
      errorMsg = 'No AI provider API key is configured. Please open AI Provider Settings to configure Gemini, Groq, OpenRouter, or Hugging Face.';
    } else {
      errorMsg = rawStatus || 'Unable to connect to AI generation service.';
    }
  }

  return {
    success: false,
    questions: [],
    fallbackOccurred: serverData?.fallbackOccurred || false,
    attempts: serverData?.attempts || [],
    error: errorMsg
  };
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

export { removeUndefinedFields } from './firestore-utils';

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
