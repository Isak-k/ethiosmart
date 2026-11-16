/**
 * Vercel serverless function: EthioSmart homepage promotional assistant.
 *
 * Same handler as the local dev bridge (src/server/chatbot.ts), reusing the
 * pure request/response logic from functions/src/chatbot/core.ts.
 *
 * Env vars (set in the Vercel project):
 *   GEMINI_API_KEY   - Google AI Studio key (optional; committed fallback key is used if unset)
 *   CHATBOT_MODEL    - defaults to gemini-3.5-flash-lite
 *   CHATBOT_ENABLED  - set to "false" to disable the assistant (kill switch)
 */

import { handleChatbotAsk, resolveIpKey } from '../../src/server/chatbot';

const UNAVAILABLE_MESSAGE =
  'The EthioSmart AI Assistant is temporarily unavailable. Please try again in a moment — or sign up and explore the app!';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    let body = req.body;
    if (body === undefined) {
      // Fallback manual parse (e.g. no bodyParser)
      const raw = await new Promise<string>((resolve) => {
        let data = '';
        req.on('data', (chunk: any) => {
          data += chunk;
          if (data.length > 1024 * 1024) data = data.slice(0, 1024 * 1024);
        });
        req.on('end', () => resolve(data));
        req.on('error', () => resolve(''));
      });
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }
    } else if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const forwarded = req.headers?.['x-forwarded-for'];
    const vercelForwarded = req.headers?.['x-vercel-forwarded-for'];
    const realIp = req.headers?.['x-real-ip'];
    const result = await handleChatbotAsk({
      message: body?.message,
      history: body?.history,
      ipKey: resolveIpKey(
        typeof forwarded === 'string' || Array.isArray(forwarded) ? forwarded : undefined,
        typeof vercelForwarded === 'string' ? vercelForwarded : undefined,
        typeof realIp === 'string' ? realIp : undefined,
      ),
    });

    if (result.ok === true) {
      res.statusCode = 200;
      res.end(JSON.stringify({ answer: result.answer, links: result.links }));
    } else {
      res.statusCode = result.status;
      res.end(JSON.stringify({ error: result.error }));
    }
  } catch (err: any) {
    console.error('chatbot:ask error:', err?.message || err);
    res.statusCode = 503;
    res.end(JSON.stringify({ error: UNAVAILABLE_MESSAGE }));
  }
}
