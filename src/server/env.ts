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
  // Private AI provider key (server-side only; NEVER with a VITE_ prefix)
  'GEMINI_API_KEY',
  // Chatbot deployment knobs (non-secret)
  'CHATBOT_ENABLED',
  'CHATBOT_MODEL',
]);

function parseEnvFile(file: string): Map<string, string> {
  const result = new Map<string, string>();
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    return result;
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!ALLOWED_KEYS.has(key)) continue;

    let value = line.slice(idx + 1).trim();
    if (
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
