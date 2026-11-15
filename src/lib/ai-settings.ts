import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import type { AIProviderId, ProviderKeys } from './ai-engine/types.ts';

export interface AIProviderConfig {
  id: AIProviderId;
  name: string;
  apiKey: string;
  enabled: boolean;
  model: string;
  priority: number;
  description: string;
  consoleUrl: string;
  recommendedModels: string[];
}

export interface AISystemSettings {
  providers: {
    gemini: AIProviderConfig;
    groq: AIProviderConfig;
    openrouter: AIProviderConfig;
    huggingface: AIProviderConfig;
  };
  defaultProvider: AIProviderId;
  providerPriority: AIProviderId[];
  autoFallback: boolean;
  temperature: number;
  maxBatchSize: number;
  updatedAt?: any;
  updatedBy?: string;
}

const SETTINGS_DOC_ID = 'ai_providers';
const LOCAL_STORAGE_KEY = 'exampro_ai_system_settings';

/**
 * Built-in provider keys have been removed on purpose (security): shipping
 * shared keys in the client bundle exposed them to every visitor. AI
 * generation now requires either:
 *   - an admin-configured key (Admin → AI Provider Settings; stored in
 *     Firestore/local storage, user-configured), or
 *   - build-time/runtime env vars for the admin's own convenience.
 * There is intentionally NO default key.
 */

export const DEFAULT_AI_SETTINGS: AISystemSettings = {
  providers: {
    gemini: {
      id: 'gemini',
      name: 'Google Gemini',
      apiKey: '',
      enabled: true,
      model: 'gemini-flash-lite-latest',
      priority: 1,
      description: 'Ultra-fast, high-accuracy model with huge context window and native JSON formatting.',
      consoleUrl: 'https://aistudio.google.com/app/apikey',
      recommendedModels: [
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
        'gemini-3-flash-preview',
        'gemini-flash-latest',
        'gemini-2.5-flash',
      ],
    },
    groq: {
      id: 'groq',
      name: 'Groq (LPU Inference)',
      apiKey: '',
      enabled: true,
      model: 'openai/gpt-oss-20b',
      priority: 2,
      description: 'Extremely fast inference on custom LPU chips, ideal for high-throughput batch generation.',
      consoleUrl: 'https://console.groq.com/keys',
      recommendedModels: [
        'openai/gpt-oss-20b',
        'openai/gpt-oss-120b',
        'qwen/qwen3.8-27b',
      ],
    },
    openrouter: {
      id: 'openrouter',
      name: 'OpenRouter Gateway',
      apiKey: '',
      enabled: true,
      model: 'meta-llama/llama-3.3-70b-instruct',
      priority: 3,
      description: 'Unified multi-provider API providing access to hundreds of open-source and proprietary models.',
      consoleUrl: 'https://openrouter.ai/keys',
      recommendedModels: [
        'meta-llama/llama-3.3-70b-instruct',
        'google/gemini-2.0-flash-exp:free',
        'deepseek/deepseek-chat',
        'mistralai/mistral-small-24b-instruct-2501',
      ],
    },
    huggingface: {
      id: 'huggingface',
      name: 'Hugging Face Inference',
      apiKey: '',
      enabled: true,
      model: 'Qwen/Qwen2.5-72B-Instruct',
      priority: 4,
      description: 'Direct serverless access to open-weights models hosted on the Hugging Face hub.',
      consoleUrl: 'https://huggingface.co/settings/tokens',
      recommendedModels: [
        'Qwen/Qwen2.5-72B-Instruct',
        'meta-llama/Llama-3.1-8B-Instruct',
        'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
      ],
    },
  },
  defaultProvider: 'gemini',
  providerPriority: ['gemini', 'groq', 'openrouter', 'huggingface'],
  autoFallback: true,
  temperature: 0.3,
  maxBatchSize: 10,
  updatedBy: 'system',
};

/**
 * Load initial keys from environment variables and local storage
 * (built-in default keys were removed — see DEFAULT_AI_SETTINGS note)
 */
function getPreconfiguredEnvKeys(): ProviderKeys {
  const meta: Record<string, string | undefined> = (import.meta as any).env || {};
  const getStorage = (key: string): string | undefined => {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        return val && val.trim() ? val.trim() : undefined;
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  return {
    gemini:
      meta.VITE_GEMINI_API_KEY ||
      meta.GEMINI_API_KEY ||
      getStorage('gemini_api_key') ||
      getStorage('GEMINI_API_KEY') ||
      getStorage('google_ai_api_key'),
    groq:
      meta.VITE_GROQ_API_KEY ||
      meta.GROQ_API_KEY ||
      getStorage('groq_api_key') ||
      getStorage('GROQ_API_KEY'),
    openrouter:
      meta.VITE_OPENROUTER_API_KEY ||
      meta.OPENROUTER_API_KEY ||
      getStorage('openrouter_api_key') ||
      getStorage('OPENROUTER_API_KEY'),
    huggingface:
      meta.VITE_HUGGINGFACE_API_KEY ||
      meta.VITE_HUGGING_FACE_API_KEY ||
      meta.HUGGING_FACE_API_KEY ||
      getStorage('huggingface_api_key') ||
      getStorage('HUGGING_FACE_API_KEY'),
  };
}

let inMemorySettings: AISystemSettings | null = null;

/**
 * Retrieve the current AI settings from Firestore or LocalStorage cache
 */
export async function getAISettings(): Promise<AISystemSettings> {
  if (inMemorySettings) {
    return inMemorySettings;
  }

  // 1. Check local storage cache for instant UI rendering
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.providers) {
          inMemorySettings = mergeWithDefaults(parsed);
        }
      }
    }
  } catch {
    // Ignore local storage error
  }

  // 2. Fetch authoritative configuration from Firestore
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<AISystemSettings>;
      inMemorySettings = mergeWithDefaults(data);
      syncToLocalStorage(inMemorySettings);
      return inMemorySettings;
    }
  } catch (err: any) {
    console.warn('Could not read AI settings from Firestore (using local/env fallback):', err.message);
  }

  // 3. Fallback to default settings populated with any env keys
  if (!inMemorySettings) {
    const envKeys = getPreconfiguredEnvKeys();
    const defaults = JSON.parse(JSON.stringify(DEFAULT_AI_SETTINGS)) as AISystemSettings;
    if (envKeys.gemini) defaults.providers.gemini.apiKey = envKeys.gemini;
    if (envKeys.groq) defaults.providers.groq.apiKey = envKeys.groq;
    if (envKeys.openrouter) defaults.providers.openrouter.apiKey = envKeys.openrouter;
    if (envKeys.huggingface) defaults.providers.huggingface.apiKey = envKeys.huggingface;

    inMemorySettings = defaults;
    syncToLocalStorage(inMemorySettings);
  }

  return inMemorySettings;
}

/**
 * Merge partial or legacy settings with complete default structure
 */
function mergeWithDefaults(data: Partial<AISystemSettings>): AISystemSettings {
  const base = JSON.parse(JSON.stringify(DEFAULT_AI_SETTINGS)) as AISystemSettings;
  const envKeys = getPreconfiguredEnvKeys();

  const getEffectiveKey = (userKey: string | undefined, provider: AIProviderId): string => {
    if (userKey && userKey.trim().length > 0) return userKey.trim();
    return envKeys[provider] || '';
  };

  const merged: AISystemSettings = {
    ...base,
    ...data,
    providers: {
      gemini: {
        ...base.providers.gemini,
        ...(data.providers?.gemini || {}),
        apiKey: getEffectiveKey(data.providers?.gemini?.apiKey, 'gemini'),
      },
      groq: {
        ...base.providers.groq,
        ...(data.providers?.groq || {}),
        apiKey: getEffectiveKey(data.providers?.groq?.apiKey, 'groq'),
      },
      openrouter: {
        ...base.providers.openrouter,
        ...(data.providers?.openrouter || {}),
        apiKey: getEffectiveKey(data.providers?.openrouter?.apiKey, 'openrouter'),
      },
      huggingface: {
        ...base.providers.huggingface,
        ...(data.providers?.huggingface || {}),
        apiKey: getEffectiveKey(data.providers?.huggingface?.apiKey, 'huggingface'),
      },
    },
    providerPriority: data.providerPriority || base.providerPriority,
    defaultProvider: data.defaultProvider || base.defaultProvider,
    autoFallback: data.autoFallback ?? base.autoFallback,
    temperature: data.temperature ?? base.temperature,
    maxBatchSize: data.maxBatchSize ?? base.maxBatchSize,
  };

  // Auto-migrate legacy or deprecated models from older saved configs
  if (
    merged.providers.groq.model === 'llama-3.3-70b-versatile' ||
    merged.providers.groq.model === 'llama-3.1-8b-instant' ||
    !merged.providers.groq.model
  ) {
    merged.providers.groq.model = 'openai/gpt-oss-20b';
  }
  if (
    merged.providers.gemini.model === 'gemini-1.5-flash' ||
    merged.providers.gemini.model === 'gemini-2.5-flash' ||
    !merged.providers.gemini.model
  ) {
    merged.providers.gemini.model = 'gemini-flash-lite-latest';
  }
  if (merged.providers.openrouter.model === 'google/gemini-flash-1.5' || !merged.providers.openrouter.model) {
    merged.providers.openrouter.model = 'meta-llama/llama-3.3-70b-instruct';
  }

  return merged;
}

/**
 * Sync active settings to local storage and individual provider keys
 */
function syncToLocalStorage(settings: AISystemSettings) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));

      // Also set the individual keys for legacy compatibility
      if (settings.providers.gemini.apiKey) {
        localStorage.setItem('gemini_api_key', settings.providers.gemini.apiKey);
      }
      if (settings.providers.groq.apiKey) {
        localStorage.setItem('groq_api_key', settings.providers.groq.apiKey);
      }
      if (settings.providers.openrouter.apiKey) {
        localStorage.setItem('openrouter_api_key', settings.providers.openrouter.apiKey);
      }
      if (settings.providers.huggingface.apiKey) {
        localStorage.setItem('huggingface_api_key', settings.providers.huggingface.apiKey);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Save updated AI settings to Firestore and local storage
 */
export async function saveAISettings(
  settings: AISystemSettings,
  userId: string = 'admin'
): Promise<void> {
  const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
  const toSave: AISystemSettings = {
    ...settings,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  try {
    await setDoc(docRef, toSave, { merge: true });
  } catch (err: any) {
    console.warn('Failed to save AI settings to Firestore, persisting locally:', err.message);
  }

  inMemorySettings = toSave;
  syncToLocalStorage(toSave);

  // Dispatch a custom event so open components (like AdminAIGenerator) refresh instantly
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('exampro_ai_settings_updated', { detail: toSave }));
  }
}

/**
 * Get effective provider keys dictionary for generation calls
 */
export async function getEffectiveProviderKeys(): Promise<ProviderKeys> {
  const settings = await getAISettings();
  return {
    gemini: settings.providers.gemini.enabled && settings.providers.gemini.apiKey
      ? settings.providers.gemini.apiKey
      : undefined,
    groq: settings.providers.groq.enabled && settings.providers.groq.apiKey
      ? settings.providers.groq.apiKey
      : undefined,
    openrouter: settings.providers.openrouter.enabled && settings.providers.openrouter.apiKey
      ? settings.providers.openrouter.apiKey
      : undefined,
    huggingface: settings.providers.huggingface.enabled && settings.providers.huggingface.apiKey
      ? settings.providers.huggingface.apiKey
      : undefined,
  };
}

/**
 * Test a provider API key by making a lightweight health/ping request
 */
export async function testAIProviderConnection(
  provider: AIProviderId,
  apiKey: string,
  model?: string
): Promise<{ success: boolean; latencyMs: number; message: string; details?: any }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      success: false,
      latencyMs: 0,
      message: 'API Key is empty. Please enter a valid key to test.',
    };
  }

  const startTime = Date.now();

  try {
    switch (provider) {
      case 'gemini': {
        const targetModel = model || 'gemini-flash-lite-latest';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Ping' }] }],
            generationConfig: { maxOutputTokens: 5, temperature: 0.1 },
          }),
        });

        const latencyMs = Date.now() - startTime;
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const errMsg = data?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
          if ((res.status === 404 || res.status === 429) && targetModel !== 'gemini-3.5-flash-lite') {
            const retryUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(cleanKey)}`;
            const retryRes = await fetch(retryUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Ping' }] }],
                generationConfig: { maxOutputTokens: 5, temperature: 0.1 },
              }),
            });
            if (retryRes.ok) {
              return {
                success: true,
                latencyMs: Date.now() - startTime,
                message: `Connected successfully to Google Gemini (verified via gemini-3.5-flash-lite) in ${Date.now() - startTime}ms!`,
              };
            }
          }
          return {
            success: false,
            latencyMs,
            message: `Gemini test failed: ${errMsg}`,
            details: data,
          };
        }

        return {
          success: true,
          latencyMs,
          message: `Connected successfully to Google Gemini (${targetModel}) in ${latencyMs}ms!`,
        };
      }

      case 'groq': {
        const targetModel = model || 'openai/gpt-oss-20b';
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
            temperature: 0.1,
          }),
        });

        const latencyMs = Date.now() - startTime;
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const errMsg = data?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
          if ((res.status === 404 || res.status === 400) && targetModel !== 'openai/gpt-oss-120b') {
            const retryRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${cleanKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                messages: [{ role: 'user', content: 'Ping' }],
                max_tokens: 5,
                temperature: 0.1,
              }),
            });
            if (retryRes.ok) {
              return {
                success: true,
                latencyMs: Date.now() - startTime,
                message: `Connected successfully to Groq (verified via openai/gpt-oss-120b) in ${Date.now() - startTime}ms!`,
              };
            }
          }
          return {
            success: false,
            latencyMs,
            message: `Groq test failed: ${errMsg}`,
            details: data,
          };
        }

        return {
          success: true,
          latencyMs,
          message: `Connected successfully to Groq (${targetModel}) in ${latencyMs}ms!`,
        };
      }

      case 'openrouter': {
        // OpenRouter has an official auth check endpoint that uses 0 tokens
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
          },
        });

        const latencyMs = Date.now() - startTime;
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const errMsg = data?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
          return {
            success: false,
            latencyMs,
            message: `OpenRouter test failed: ${errMsg}`,
            details: data,
          };
        }

        const label = data?.data?.label || 'Key verified';
        const limit = data?.data?.limit != null ? ` (Limit: $${data.data.limit})` : '';
        return {
          success: true,
          latencyMs,
          message: `Connected successfully to OpenRouter: ${label}${limit} in ${latencyMs}ms!`,
        };
      }

      case 'huggingface': {
        // Hugging Face has an official auth identity endpoint
        const res = await fetch('https://huggingface.co/api/whoami-v2', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
          },
        });

        const latencyMs = Date.now() - startTime;
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const errMsg = data?.error || `HTTP ${res.status}: ${res.statusText}`;
          return {
            success: false,
            latencyMs,
            message: `Hugging Face test failed: ${errMsg}`,
            details: data,
          };
        }

        const username = data?.name || data?.email || 'User verified';
        return {
          success: true,
          latencyMs,
          message: `Connected successfully to Hugging Face (${username}) in ${latencyMs}ms!`,
        };
      }

      default:
        return {
          success: false,
          latencyMs: 0,
          message: `Unknown provider: ${provider}`,
        };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      message: `Network error connecting to ${provider}: ${err.message}`,
    };
  }
}
