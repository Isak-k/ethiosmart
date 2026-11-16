import {
  AIProviderId,
  GenerateBatchRequest,
  GenerateBatchResponse,
  NormalizedQuestion,
  ProviderAttemptLog,
  ProviderStatusInfo
} from './types';
import { callGemini } from './adapters/gemini';
import { callGroq } from './adapters/groq';
import { callOpenRouter } from './adapters/openrouter';
import { callHuggingFace } from './adapters/huggingface';
import { validateGeneratedQuestionBatch, validateNormalizedQuestion } from './normalizer';

export interface ProviderKeys {
  gemini?: string;
  groq?: string;
  openrouter?: string;
  huggingface?: string;
}

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
  if (!status) return true; // network timeouts are potentially recoverable
  return [500, 502, 503, 504].includes(status);
}

function isModelAccessError(err: any): boolean {
  const message = String(err?.message || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('not found') ||
    message.includes('no access') ||
    message.includes('do not have access') ||
    message.includes('model_not_found') ||
    message.includes('deprecated') ||
    message.includes('not supported')
  );
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
        // Exponential backoff with jitter: 800ms, 1600ms + [0, 400ms]
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
        break; // Success! Break retry loop
      } catch (err: any) {
        const latency = Date.now() - startTime;
        const displayError = err?.name === 'AbortError'
          ? new Error(`${provider} request timed out. The next provider will be tried.`)
          : err;
        attemptError = displayError;
        lastErrors.set(provider, displayError.message || 'Unknown error');

        // Check if content safety violation: Do NOT bypass safety policies by switching providers!
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

        // Check 429 Rate Limit / Quota Exceeded
        if (err.status === 429) {
          const retryAfterSec = err.retryAfter ? parseInt(err.retryAfter, 10) : 30;
          setProviderCooldown(provider, Math.min(Math.max(retryAfterSec, 10), 60), 'Rate limit (429)');
          break; // Do not retry unchanged immediately; fall back to next provider
        }

        // Check 402 Quota / Payment Required
        if (err.status === 402 || err.code === 'quota_exceeded') {
          setProviderCooldown(provider, 45, 'Quota / Payment Required (402)');
          break; // Fall back to next provider
        }

        // Check 401 / 403 Unauthorized (but not model-access errors)
        if (err.status === 401 || (err.status === 403 && !isModelAccessError(err))) {
          setProviderCooldown(provider, 30, 'Invalid Credentials / Unauthorized');
          break; // Fall back to next provider
        }

        if (err.status === 403 && isModelAccessError(err)) {
          break; // Model is unavailable; fall back without marking credentials invalid
        }

        // Check 400 Bad Request
        if (err.status === 400) {
          // Do not retry unchanged invalid request
          break;
        }

        if (err?.name === 'AbortError') {
          break;
        }

        // Check if transient server error (5xx or timeout)
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

  // All providers failed
  const failedSummaries = attempts
    .filter(a => a.status === 'failed' || a.status === 'skipped')
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
