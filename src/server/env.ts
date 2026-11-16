/**
 * Server-only loader for LOCAL development environment variables.
 *
 * Reads the root `.env.local` (highest priority) and root `.env`, and loads an
 * explicit ALLOWLIST of variables into `process.env` — nothing else. This
 * module is imported ONLY by the Vite dev middleware (src/server/ai-bridge.ts)
 * which runs inside the Node server process; it is never imported by client
 * code and never shipped to the browser.
 *
 * Safety properties:
 *  - Allowlist only: no arbitrary repo files are read into the process env.
 *  - Shell environment ALWAYS wins: variables already set in process.env are
 *    never overridden (precedence: shell > .env.local > .env).
 *  - Idempotent: subsequent calls do nothing.
 *  - Values are never logged or serialized.
 *
 * NOTE (production): on Vercel there is NO file loading — serverless
 * functions read process.env provided by Project Settings → Environment
 * Variables. This module exists purely for local development.
 */

import fs from 'fs';
import path from 'path';

const ALLOWED_KEYS = new Set([
  // AI provider keys (both server and Vite-prefixed variants from .env)
  'GEMINI_API_KEY',
  'VITE_GEMINI_API_KEY',
  'GROQ_API_KEY',
  'VITE_GROQ_API_KEY',
  'OPENROUTER_API_KEY',
  'VITE_OPENROUTER_API_KEY',
  'HUGGINGFACE_API_KEY',
  'HUGGING_FACE_API_KEY',
  'VITE_HUGGINGFACE_API_KEY',
  'VITE_HUGGING_FACE_API_KEY',
  // Server-side integrations used by the dev bridge
  'GOOGLE_DRIVE_API_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  // Chatbot deployment knobs (non-secret)
  'CHATBOT_ENABLED',
  'CHATBOT_MODEL',
  // Firebase Admin (Vercel payment/content-access API, dev middleware only)
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_STORAGE_BUCKET',
  // Cloudinary receipt signing/verification (server-side only)
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  // API CORS allowlist (dev/prod behavior handled in http.ts)
  'CORS_ALLOWED_ORIGINS',
]);

function parseEnvFile(file: string): Map<string, string> {
  const result = new Map<string, string>();
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    return result;
  }

  const rawLines = content.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!ALLOWED_KEYS.has(key)) continue;

    let value = line.slice(idx + 1).trim();

    // Support multiline quoted values (e.g. JSON service accounts or private keys)
    if (
      (value.startsWith('"') && !value.endsWith('"')) ||
      (value.startsWith("'") && !value.endsWith("'"))
    ) {
      const quote = value[0];
      const collected = [value.slice(1)];
      i++;
      while (i < rawLines.length) {
        const nextLine = rawLines[i];
        if (nextLine.trim().endsWith(quote)) {
          collected.push(nextLine.trim().slice(0, -1));
          break;
        } else {
          collected.push(nextLine);
          i++;
        }
      }
      value = collected.join('\n');
    } else if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    if (value) result.set(key, value);
  }
  return result;
}

let loaded = false;

export function loadServerEnv(cwd: string = process.cwd()): void {
  if (loaded) return;
  loaded = true;

  // Lowest priority first so .env.local overwrites it. A shell-provided
  // process.env value beats both files.
  const merged = new Map<string, string>();
  for (const file of ['.env', '.env.local']) {
    for (const [key, value] of parseEnvFile(path.resolve(cwd, file))) {
      merged.set(key, value);
    }
  }

  for (const [key, value] of merged) {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}
