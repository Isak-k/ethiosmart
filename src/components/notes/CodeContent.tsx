import React, { useState } from 'react';
import { Check, Copy, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface CodeContentProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}

export function CodeContent({
  code,
  language = 'python',
  title,
  className = '',
}: CodeContentProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = (code || '').split('\n');

  return (
    <div className={`my-4 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950 text-slate-100 shadow-md ${className}`}>
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-mono uppercase bg-slate-800/80 text-cyan-400 border-slate-700 ml-1.5"
          >
            {language}
          </Badge>
          {title && (
            <span className="text-xs text-slate-400 font-mono truncate">
              {title}
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg gap-1.5"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-[11px]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </Button>
      </div>

      {/* Code Lines with line numbers */}
      <div className="overflow-x-auto p-4 font-mono text-xs sm:text-sm leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-slate-900/50">
                <td className="w-8 pr-4 text-right text-slate-600 select-none text-[11px] align-top font-mono">
                  {idx + 1}
                </td>
                <td className="whitespace-pre text-slate-200">
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
