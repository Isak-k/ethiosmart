import { useCallback, useState } from 'react';

export interface ChatbotLink {
  route: string;
  label: string;
}

export interface ChatbotMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  links?: ChatbotLink[];
}

const WELCOME_MESSAGE: ChatbotMessage = {
  id: 0,
  role: 'assistant',
  text:
    "Hi! I'm the EthioSmart AI Assistant. Ask me anything about EthioSmart — what it is, who it's for, how to register, what features you'll get, or how to install the app!",
};

const GENERIC_ERROR =
  "The EthioSmart AI Assistant is temporarily unavailable. Please try again in a moment — or sign up and explore the app!";

function isChatbotLink(value: unknown): value is ChatbotLink {
  if (!value || typeof value !== 'object') return false;
  const v = value as { route?: unknown; label?: unknown };
  return typeof v.route === 'string' && v.route.startsWith('/') && typeof v.label === 'string';
}

/**
 * Talks to the same-origin `/api/chatbot/ask` endpoint:
 *  - dev:  handled by the Vite aiDevPlugin middleware (src/server/ai-bridge.ts)
 *  - prod: handled by the Vercel serverless function (api/chatbot/ask.ts)
 * The Gemini key never reaches the browser.
 */
async function requestAnswer(
  message: string,
  history: ChatbotMessage[]
): Promise<{ answer: string; links?: ChatbotLink[] }> {
  let res: Response;
  try {
    res = await fetch('/api/chatbot/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: history.slice(-6).map((m) => ({ role: m.role, text: m.text })),
      }),
    });
  } catch {
    throw Object.assign(new Error('network'), { code: 'network' });
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON body handled below */
  }
  const body = (payload && typeof payload === 'object' ? payload : {}) as {
    answer?: unknown;
    links?: unknown;
    error?: unknown;
  };

  if (!res.ok) {
    throw Object.assign(
      new Error(typeof body.error === 'string' ? body.error : GENERIC_ERROR),
      { status: res.status, serverMessage: typeof body.error === 'string' ? body.error : undefined }
    );
  }

  const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
  if (!answer) {
    throw Object.assign(new Error(GENERIC_ERROR), { status: 503, serverMessage: GENERIC_ERROR });
  }
  const links = Array.isArray(body.links)
    ? body.links.filter(isChatbotLink).slice(0, 3)
    : undefined;
  return { answer, links };
}

export function useChatbot() {
  const [messages, setMessages] = useState<ChatbotMessage[]>([WELCOME_MESSAGE]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(
    async (rawMessage: string) => {
      const message = rawMessage.trim();
      if (!message || busy) return;

      setError(null);
      const userMessage: ChatbotMessage = { id: Date.now(), role: 'user', text: message };
      setMessages((prev) => [...prev, userMessage]);
      setBusy(true);

      try {
        const history = messages
          .filter((m) => m.id !== 0) // never send the static welcome bubble to the model
          .slice(-6);

        const { answer, links } = await requestAnswer(message, history);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: 'assistant', text: answer, links },
        ]);
      } catch (err: unknown) {
        const status = (err as { status?: number } | null)?.status;
        const serverMessage = (err as { serverMessage?: string } | null)?.serverMessage;
        let reply = GENERIC_ERROR;
        if (status === 429 && serverMessage) {
          reply = serverMessage;
        } else if (status === 400) {
          reply = 'Please ask a shorter question about EthioSmart!';
        }
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: 'assistant', text: reply },
        ]);
        setError(reply);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages]
  );

  const reset = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setError(null);
  }, []);

  return { messages, busy, error, ask, reset };
}
