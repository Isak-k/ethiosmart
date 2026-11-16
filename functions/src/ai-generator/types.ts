export type AIProviderId = 'gemini' | 'groq' | 'openrouter' | 'huggingface';

export type QuestionType = 'mcq' | 'truefalse' | 'shortanswer';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';
export type Language = 'English' | 'Afaan Oromoo' | 'Amharic';

export interface QuestionSourceReference {
  bookId?: string;
  bookTitle?: string;
  pageRange?: string;
  chapter?: string;
  driveFileId?: string;
}

export interface NormalizedQuestion {
  id: string;
  questionText: string;
  questionType: QuestionType;
  options: string[];
  correctOptionIndex: number;
  correctAnswer?: string;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  marks: number;
  providerUsed: AIProviderId;
  batchIndex: number;
  sourceReference?: QuestionSourceReference;
}

export interface QuestionTypeCounts {
  mcq?: number;
  truefalse?: number;
  shortanswer?: number;
}

export interface GenerateBatchRequest {
  sourceMaterial?: string;
  topic?: string;
  prompt: string;
  pageRange?: string;
  chapter?: string;
  count: number;
  questionTypes: QuestionType[];
  questionTypeCounts?: QuestionTypeCounts;
  difficulty?: Difficulty;
  language?: Language;
  providerPriority?: AIProviderId[];
  providerModels?: Partial<Record<AIProviderId, string>>;
  batchIndex?: number;
  totalBatches?: number;
}

export interface ProviderAttemptLog {
  provider: AIProviderId;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  latencyMs: number;
}

export interface GenerateBatchResponse {
  success: boolean;
  questions: NormalizedQuestion[];
  providerUsed?: AIProviderId;
  fallbackOccurred: boolean;
  attempts: ProviderAttemptLog[];
  error?: string;
}

export interface ProviderStatusInfo {
  id: AIProviderId;
  name: string;
  configured: boolean;
  inCooldown: boolean;
  cooldownRemainingSeconds: number;
  lastLatencyMs?: number;
  lastError?: string;
}
