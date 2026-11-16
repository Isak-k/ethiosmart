import type {
  AIProviderId,
  GenerateBatchRequest,
  GenerateBatchResponse,
  NormalizedQuestion,
  ProviderAttemptLog,
  ProviderStatusInfo,
  ProviderKeys
} from './types.ts';
import { callGemini, callGroq, callOpenRouter, callHuggingFace } from './adapters.ts';
import { validateGeneratedQuestionBatch, validateNormalizedQuestion } from './normalizer.ts';

export type { ProviderKeys };

interface CooldownEntry {
  until: number;
  reason: string;
}

const providerCooldowns: Map<AIProviderId, CooldownEntry> = new Map();
const lastLatencies: Map<AIProviderId, number> = new Map();
const lastErrors: Map<AIProviderId, string> = new Map();

export function setProviderCooldown(provider: AIProviderId, seconds: number, reason: string) {
  providerCooldowns.set(provider, {
    until: Date.now() + seconds * 1000,
    reason
  });
}

export function clearProviderCooldown(provider: AIProviderId): void {
  providerCooldowns.delete(provider);
}

export function clearAllProviderCooldowns(): void {
  providerCooldowns.clear();
}

export function getProviderCooldown(provider: AIProviderId): { inCooldown: boolean; remainingSeconds: number; reason?: string } {
  const entry = providerCooldowns.get(provider);
  if (!entry) return { inCooldown: false, remainingSeconds: 0 };
  const diff = entry.until - Date.now();
  if (diff <= 0) {
    providerCooldowns.delete(provider);
    return { inCooldown: false, remainingSeconds: 0 };
  }
  return {
    inCooldown: true,
    remainingSeconds: Math.ceil(diff / 1000),
    reason: entry.reason
  };
}

export function getProviderStatus(keys: ProviderKeys): ProviderStatusInfo[] {
  const providers: { id: AIProviderId; name: string; key?: string }[] = [
    { id: 'gemini', name: 'Google Gemini', key: keys.gemini },
    { id: 'groq', name: 'Groq', key: keys.groq },
    { id: 'openrouter', name: 'OpenRouter', key: keys.openrouter },
    { id: 'huggingface', name: 'Hugging Face', key: keys.huggingface },
  ];

  return providers.map(p => {
    const cooldown = getProviderCooldown(p.id);
    return {
      id: p.id,
      name: p.name,
      configured: Boolean(p.key && p.key.trim().length > 0),
      inCooldown: cooldown.inCooldown,
      cooldownRemainingSeconds: cooldown.remainingSeconds,
      lastLatencyMs: lastLatencies.get(p.id),
      lastError: lastErrors.get(p.id)
    };
  });
}

function isContentSafetyError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('safety') ||
    msg.includes('harmful') ||
    msg.includes('blocked') ||
    msg.includes('content policy') ||
    msg.includes('violat')
  );
}

function isRetryableServerError(status?: number): boolean {
  if (!status) return true;
  return [500, 502, 503, 504].includes(status);
}

function isModelAccessError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('not found') ||
    msg.includes('no access') ||
    msg.includes('do not have access') ||
    msg.includes('model_not_found') ||
    msg.includes('deprecated') ||
    msg.includes('not supported')
  );
}

function isAuthError(err: any): boolean {
  if (err?.status === 401) return true;
  if (err?.status === 403 && !isModelAccessError(err)) {
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('key') || msg.includes('unauthorized') || msg.includes('invalid') || msg.includes('forbidden');
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function orchestrateGenerationBatch(
  req: GenerateBatchRequest,
  keys: ProviderKeys
): Promise<GenerateBatchResponse> {
  const priorityOrder: AIProviderId[] = req.providerPriority && req.providerPriority.length > 0
    ? req.providerPriority
    : ['gemini', 'groq', 'openrouter', 'huggingface'];

  const attempts: ProviderAttemptLog[] = [];
  let fallbackOccurred = false;
  let questions: NormalizedQuestion[] | null = null;
  let providerUsed: AIProviderId | undefined = undefined;

  for (let i = 0; i < priorityOrder.length; i++) {
    const provider = priorityOrder[i];
    const apiKey = keys[provider];

    if (i > 0 && attempts.some(a => a.status === 'failed')) {
      fallbackOccurred = true;
    }

    // 1. Check if configured
    if (!apiKey || apiKey.trim().length === 0) {
      attempts.push({
        provider,
        status: 'skipped',
        error: 'Provider API key is not configured',
        latencyMs: 0
      });
      continue;
    }

    // 2. Check if in cooldown
    const cooldown = getProviderCooldown(provider);
    if (cooldown.inCooldown) {
      attempts.push({
        provider,
        status: 'skipped',
        error: `In cooldown (${cooldown.remainingSeconds}s remaining): ${cooldown.reason || 'rate limited'}`,
        latencyMs: 0
      });
      continue;
    }

    // 3. Attempt execution with bounded exponential backoff & jitter
    const maxRetries = 2;
    let attemptError: any = null;

    for (let retry = 0; retry <= maxRetries; retry++) {
      if (retry > 0) {
        const baseDelay = 800 * Math.pow(2, retry - 1);
        const jitter = Math.floor(Math.random() * 400);
        await sleep(baseDelay + jitter);
      }

      const startTime = Date.now();
      try {
        let result: NormalizedQuestion[];

        switch (provider) {
          case 'gemini':
            result = await callGemini(req, apiKey);
            break;
          case 'groq':
            result = await callGroq(req, apiKey);
            break;
          case 'openrouter':
            result = await callOpenRouter(req, apiKey);
            break;
          case 'huggingface':
            result = await callHuggingFace(req, apiKey);
            break;
          default:
            throw new Error(`Unsupported provider: ${provider}`);
        }
        try {
          validateGeneratedQuestionBatch(result, req);
        } catch (valErr: any) {
          // If the batch failed strict batch-level count/type requirements, but returned valid questions,
          // verify that each individual question is well-formed. If at least 1 question is valid,
          // accept the valid questions rather than discarding them all!
          if (result && Array.isArray(result) && result.length > 0) {
            for (let qIdx = 0; qIdx < result.length; qIdx++) {
              validateNormalizedQuestion(result[qIdx], qIdx);
            }
          } else {
            throw valErr;
          }
        }

        const latency = Date.now() - startTime;
        lastLatencies.set(provider, latency);
        lastErrors.delete(provider);

        attempts.push({
          provider,
          status: 'success',
          latencyMs: latency
        });

        questions = result;
        providerUsed = provider;
        break;
      } catch (err: any) {
        const latency = Date.now() - startTime;
        const displayError = err?.name === 'AbortError'
          ? new Error(`${provider} request timed out. The next provider will be tried.`)
          : err;
        attemptError = displayError;
        lastErrors.set(provider, displayError.message || 'Unknown error');

        // Check if content safety violation
        if (isContentSafetyError(err)) {
          attempts.push({
            provider,
            status: 'failed',
            error: `Content safety violation: ${err.message}`,
            latencyMs: latency
          });
          return {
            success: false,
            questions: [],
            fallbackOccurred,
            attempts,
            error: `Content Safety Violation: The requested prompt was flagged by content safety filters (${err.message}). Provider switching is disallowed for safety violations.`
          };
        }

        // Check 429 Rate Limit
        if (err.status === 429) {
          const retryAfterSec = err.retryAfter ? parseInt(err.retryAfter, 10) : 30;
          setProviderCooldown(provider, Math.min(Math.max(retryAfterSec, 10), 60), 'Rate limit (429)');
          break;
        }

        // Check 402 Quota
        if (err.status === 402 || err.code === 'quota_exceeded') {
          setProviderCooldown(provider, 45, 'Quota / Payment Required (402)');
          break;
        }

        // Check 401 / 403 Unauthorized (but not model-access errors)
        if (isAuthError(err)) {
          setProviderCooldown(provider, 30, 'Invalid Credentials / Unauthorized');
          break;
        }

        // Check 403 model-access errors (model not available for this key)
        if (err.status === 403 && isModelAccessError(err)) {
          break;
        }

        // Check 400 Bad Request
        if (err.status === 400) {
          break;
        }

        if (err?.name === 'AbortError') {
          break;
        }

        // Check transient server error
        if (!isRetryableServerError(err.status)) {
          break;
        }
      }
    }

    if (questions && questions.length > 0) {
      return {
        success: true,
        questions,
        providerUsed,
        fallbackOccurred,
        attempts
      };
    } else {
      attempts.push({
        provider,
        status: 'failed',
        error: attemptError?.message || 'Provider failed without questions',
        latencyMs: 0
      });
    }
  }

  // All providers failed or were not configured
  const configuredAttempts = attempts.filter(a => a.status === 'failed');
  const skippedAttempts = attempts.filter(a => a.status === 'skipped');

  if (configuredAttempts.length === 0 && skippedAttempts.length > 0) {
    return {
      success: false,
      questions: [],
      fallbackOccurred: false,
      attempts,
      error: 'No AI provider API key is configured. Please navigate to AI Provider Settings to configure an active API key (Gemini, Groq, OpenRouter, or Hugging Face).'
    };
  }

  const failedSummaries = attempts
    .map(a => `${a.provider}: ${a.error}`)
    .join(' | ');

  return {
    success: false,
    questions: [],
    fallbackOccurred: true,
    attempts,
    error: `All configured AI providers failed. Summary: [${failedSummaries}] Check API keys and model access in AI Provider Settings, then use Test All to verify them.`
  };
}
