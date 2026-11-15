import { useEffect, useRef, useState } from 'react';
import { GraduationCap, MessageCircle, Send, Sparkles, X, Loader2 } from 'lucide-react';
import { useChatbot } from './useChatbot';

const SUGGESTED_QUESTIONS = [
  'What is EthioSmart?',
  'How do I register?',
  'Can I study offline?',
];

/**
 * Public, pre-login promotional assistant for the EthioSmart homepage.
 * Visitor can use it without authentication. It only answers questions
 * about the EthioSmart platform.
 */
export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, busy, ask, reset } = useChatbot();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Autofocus the input when the panel opens
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Escape closes the panel
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Keep the latest message in view
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy, open]);

  const submit = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || busy) return;
    ask(value);
    setInput('');
  };

  const showSuggestions = messages.length <= 1 && !busy;

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask about EthioSmart"
          title="Ask about EthioSmart"
          className="fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6 h-14 w-14 sm:h-16 sm:w-16 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/40 bg-gradient-to-br from-blue-600 via-sky-600 to-indigo-600 text-white border border-white/25 transition-transform hover:scale-105 active:scale-95 animate-fade-in"
        >
          <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" />
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-extrabold text-slate-900 border border-white/60">
            AI
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="EthioSmart AI Assistant"
          className="fixed z-40 inset-x-0 bottom-0 sm:inset-auto sm:bottom-6 sm:right-6 h-[82dvh] sm:h-[560px] sm:max-h-[80dvh] w-full sm:w-[380px] rounded-t-3xl sm:rounded-3xl border border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
        >
          {/* Header */}
          <div className="relative shrink-0 px-4 sm:px-5 py-3.5 bg-gradient-to-r from-blue-700 via-sky-600 to-indigo-700 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold leading-tight">EthioSmart AI Assistant</p>
                <p className="text-[11px] text-sky-100/90 leading-tight">Ask me about EthioSmart</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="ml-auto h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-3 overscroll-contain"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-md border border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.links && msg.links.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.links.map((link) => (
                        <a
                          key={link.route}
                          href={link.route}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[11px] font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                        >
                          {link.label} →
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 px-4 py-3 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Suggested starter questions */}
          {showSuggestions && (
            <div className="shrink-0 px-3.5 sm:px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => submit(question)}
                  className="rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-sky-300 px-2.5 py-1 text-[11px] font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <form
            className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 bg-white/80 dark:bg-slate-900/80"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                maxLength={1000}
                disabled={busy}
                placeholder="Ask about EthioSmart…"
                aria-label="Ask about EthioSmart"
                className="flex-1 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-[13px] leading-snug focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-400 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send question"
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                reset();
                inputRef.current?.focus();
              }}
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors px-1"
            >
              <Sparkles className="h-3 w-3" />
              Reset conversation
            </button>
          </form>
        </div>
      )}
    </>
  );
}
