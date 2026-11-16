/**
 * Unit tests for the chatbot pure helpers.
 * No network, no Firebase Admin — everything under test is deterministic.
 */

import {
  sanitizeChatRequest,
  buildSystemPrompt,
  buildGeminiBody,
  parseGeminiResponse,
  extractLinks,
  rateLimitVerdict,
  cleanText,
  resolveClientIpKey,
  isIpLiteral,
  MAX_MESSAGE_CHARS,
  MAX_HISTORY_TURNS,
  IP_MINUTE_LIMIT,
  IP_DAY_LIMIT,
  GLOBAL_DAY_LIMIT,
  REFUSAL_MESSAGE,
} from './core';

describe('cleanText', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanText('  hello   world  ')).toBe('hello world');
  });

  it('strips control characters', () => {
    expect(cleanText('hello\x00\x07world')).toBe('helloworld');
  });
});

describe('sanitizeChatRequest', () => {
  it('accepts a valid minimal request', () => {
    const result = sanitizeChatRequest({ message: 'What is EthioSmart?' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.message).toBe('What is EthioSmart?');
      expect(result.value.history).toEqual([]);
    }
  });

  it('rejects non-object bodies', () => {
    expect(sanitizeChatRequest('hi' as unknown).ok).toBe(false);
    expect(sanitizeChatRequest(null).ok).toBe(false);
  });

  it('rejects missing message', () => {
    expect(sanitizeChatRequest({}).ok).toBe(false);
  });

  it('rejects empty message', () => {
    expect(sanitizeChatRequest({ message: '   ' }).ok).toBe(false);
  });

  it('rejects overlong message', () => {
    const long = 'a'.repeat(MAX_MESSAGE_CHARS + 1);
    expect(sanitizeChatRequest({ message: long }).ok).toBe(false);
  });

  it('accepts a message exactly at the limit', () => {
    const exact = 'a'.repeat(MAX_MESSAGE_CHARS);
    expect(sanitizeChatRequest({ message: exact }).ok).toBe(true);
  });

  it('accepts valid history and normalizes roles', () => {
    const result = sanitizeChatRequest({
      message: 'Tell me more',
      history: [
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Hi there!' },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.history).toHaveLength(2);
  });

  it('rejects too many history turns', () => {
    const history = Array.from({ length: MAX_HISTORY_TURNS + 1 }, () => ({
      role: 'user' as const,
      text: 'q',
    }));
    expect(sanitizeChatRequest({ message: 'hi', history }).ok).toBe(false);
  });

  it('rejects invalid history roles', () => {
    expect(
      sanitizeChatRequest({ message: 'hi', history: [{ role: 'system', text: 'x' }] }).ok,
    ).toBe(false);
  });

  it('rejects empty history text', () => {
    expect(
      sanitizeChatRequest({ message: 'hi', history: [{ role: 'user', text: '   ' }] }).ok,
    ).toBe(false);
  });

  it('rejects overlong history text', () => {
    expect(
      sanitizeChatRequest({ message: 'hi', history: [{ role: 'user', text: 'a'.repeat(1001) }] }).ok,
    ).toBe(false);
  });

  it('rejects invalid locale', () => {
    expect(sanitizeChatRequest({ message: 'hi', locale: 'fr' }).ok).toBe(false);
    expect(sanitizeChatRequest({ message: 'hi', locale: 'am' }).ok).toBe(true);
  });
});

describe('rateLimitVerdict', () => {
  it('allows under all limits', () => {
    expect(rateLimitVerdict({ ipMinute: 0, ipDay: 0, globalDay: 0 })).toEqual({ allowed: true });
    expect(
      rateLimitVerdict({ ipMinute: IP_MINUTE_LIMIT - 1, ipDay: IP_DAY_LIMIT - 1, globalDay: GLOBAL_DAY_LIMIT - 1 }),
    ).toEqual({ allowed: true });
  });

  it('blocks at per-minute limit', () => {
    const verdict = rateLimitVerdict({ ipMinute: IP_MINUTE_LIMIT, ipDay: 0, globalDay: 0 });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.limit).toBe('ip_minute');
  });

  it('blocks at per-day limit', () => {
    const verdict = rateLimitVerdict({ ipMinute: 0, ipDay: IP_DAY_LIMIT, globalDay: 0 });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.limit).toBe('ip_day');
  });

  it('blocks at global daily limit', () => {
    const verdict = rateLimitVerdict({ ipMinute: 0, ipDay: 0, globalDay: GLOBAL_DAY_LIMIT });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.limit).toBe('global_day');
  });
});

describe('parseGeminiResponse', () => {
  it('parses a valid response', () => {
    const json = {
      candidates: [
        { content: { parts: [{ text: 'EthioSmart helps you prepare!' }] } },
      ],
    };
    expect(parseGeminiResponse(json)).toBe('EthioSmart helps you prepare!');
  });

  it('returns null for malformed payloads', () => {
    expect(parseGeminiResponse(null)).toBeNull();
    expect(parseGeminiResponse({})).toBeNull();
    expect(parseGeminiResponse({ candidates: [] })).toBeNull();
    expect(parseGeminiResponse({ candidates: [{ content: { parts: [] } }] })).toBeNull();
    expect(parseGeminiResponse({ candidates: [{ content: { parts: [{}] } }] })).toBeNull();
  });

  it('joins multiple text parts', () => {
    const json = {
      candidates: [{ content: { parts: [{ text: 'One.' }, { text: 'Two.' }] } }],
    };
    expect(parseGeminiResponse(json)).toBe('One.\nTwo.');
  });
});

describe('extractLinks', () => {
  it('extracts allowlisted routes from the answer', () => {
    const links = extractLinks('Sign up at /auth to get started, then visit /dashboard/books for study notes.');
    expect(links).toEqual([
      { route: '/auth', label: 'Sign up / Sign in' },
      { route: '/dashboard/books', label: 'Study library (after signing in)' },
    ]);
  });

  it('ignores routes outside the allowlist', () => {
    const links = extractLinks('See https://evil.example.com and /admin/secrets');
    expect(links).toEqual([]);
  });

  it('caps the number of links', () => {
    const links = extractLinks('/auth /about /dashboard/books /dashboard/exams /dashboard/results /dashboard');
    expect(links.length).toBeLessThanOrEqual(3);
  });
});

describe('isIpLiteral', () => {
  it('accepts valid IPv4 literals', () => {
    expect(isIpLiteral('203.0.113.10')).toBe(true);
    expect(isIpLiteral('192.168.1.1')).toBe(true);
    expect(isIpLiteral('10.0.0.1')).toBe(true);
  });

  it('rejects invalid IPv4', () => {
    expect(isIpLiteral('256.0.0.1')).toBe(false);
    expect(isIpLiteral('1.2.3')).toBe(false);
    expect(isIpLiteral('1.2.3.4.5')).toBe(false);
  });

  it('accepts IPv6 literals', () => {
    expect(isIpLiteral('2001:4860:4860::8888')).toBe(true);
    expect(isIpLiteral('::1')).toBe(true);
  });

  it('rejects junk', () => {
    expect(isIpLiteral('not-an-ip')).toBe(false);
    expect(isIpLiteral('1.2.3.4\r\nspoof')).toBe(false);
    expect(isIpLiteral('')).toBe(false);
    expect(isIpLiteral('hello world')).toBe(false);
  });
});

describe('resolveClientIpKey (Google-appended trust boundary)', () => {
  it('uses the second-to-last XFF entry (Google-appended CLIENT_IP), ignoring client-supplied prefix entries', () => {
    // Client tried to spoof the first entry — irrelevant, Google appended the real one.
    expect(resolveClientIpKey('1.1.1.1, 2.2.2.2, 203.0.113.7, 34.36.10.10')).toBe('203.0.113.7');
  });

  it('works when no client-supplied XFF exists (plain CLIENT_IP,LB_IP chain)', () => {
    expect(resolveClientIpKey('203.0.113.7, 34.36.10.10')).toBe('203.0.113.7');
  });

  it('ignores single-entry XFF (untrustworthy — cannot verify who appended it)', () => {
    expect(resolveClientIpKey('203.0.113.7')).toBe('unknown-anonymous');
  });

  it('falls back to the shared anonymous bucket for missing header', () => {
    expect(resolveClientIpKey(undefined)).toBe('unknown-anonymous');
    expect(resolveClientIpKey('')).toBe('unknown-anonymous');
    expect(resolveClientIpKey('   ')).toBe('unknown-anonymous');
  });

  it('falls back when the trusted position holds non-IP junk', () => {
    expect(resolveClientIpKey('203.0.113.7, not-an-ip, 34.36.10.10')).toBe('unknown-anonymous');
    expect(resolveClientIpKey('not-an-ip, 34.36.10.10')).toBe('unknown-anonymous');
  });

  it('handles array-form x-forwarded-for headers', () => {
    expect(resolveClientIpKey(['1.1.1.1, 2.2.2.2, 203.0.113.7, 34.36.10.10'])).toBe('203.0.113.7');
  });

  it('uses signed-in uid bucket when IP cannot be established and user is authenticated', () => {
    expect(resolveClientIpKey(undefined, 'abc123')).toBe('uid_abc123');
  });

  it('never lets a client pick its own rate-limit bucket via header junk', () => {
    const spoofed = resolveClientIpKey('6.6.6.6, 7.7.7.7, 203.0.113.7, 34.36.10.10');
    expect(spoofed).toBe('203.0.113.7');
  });
});

describe('prompt + gemini body', () => {
  it('system prompt contains the refusal line and EthioSmart identity', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain(REFUSAL_MESSAGE);
    expect(prompt).toContain('EthioSmart');
    expect(prompt).toContain('product guide');
    expect(prompt).toContain('ONLY');
  });

  it('gemini body carries history and generation config', () => {
    const body = buildGeminiBody({
      message: 'What is EthioSmart?',
      history: [
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: 'hello' },
      ],
    }) as any;
    expect(body.systemInstruction.parts[0].text).toContain('EthioSmart');
    expect(body.contents).toHaveLength(3);
    expect(body.contents[0].role).toBe('user');
    expect(body.contents[1].role).toBe('model');
    expect(body.contents[2].parts[0].text).toBe('What is EthioSmart?');
    expect(body.generationConfig.maxOutputTokens).toBe(800);
  });
});
