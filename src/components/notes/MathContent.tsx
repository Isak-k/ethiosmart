import React, { useMemo } from 'react';

export interface MathContentProps {
  math?: string;
  children?: string;
  display?: boolean; // block/display mode vs inline
  className?: string;
}

/**
 * Clean and format mathematical notation using HTML/Unicode or KaTeX if present.
 * Supports fractions, exponents, subscripts, roots, Greek letters, and common symbols.
 */
export function MathContent({
  math,
  children,
  display = false,
  className = '',
}: MathContentProps) {
  const rawEquation = (math ?? children ?? '').trim();

  // Try to use window.katex if available
  const katexHtml = useMemo(() => {
    if (typeof window !== 'undefined' && (window as any).katex) {
      try {
        return (window as any).katex.renderToString(rawEquation, {
          displayMode: display,
          throwOnError: false,
        });
      } catch {
        return null;
      }
    }
    return null;
  }, [rawEquation, display]);

  if (katexHtml) {
    return (
      <span
        className={`inline-math font-serif ${display ? 'block my-3 text-center overflow-x-auto py-1' : 'inline'} ${className}`}
        dangerouslySetInnerHTML={{ __html: katexHtml }}
      />
    );
  }

  // Graceful, responsive pure CSS/HTML fallback
  const formattedHtml = useMemo(() => {
    return formatMathToHtml(rawEquation);
  }, [rawEquation]);

  if (display) {
    return (
      <div
        className={`my-3 px-4 py-2.5 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/60 overflow-x-auto text-center font-serif text-base sm:text-lg tracking-wide text-foreground shadow-2xs ${className}`}
      >
        <span
          className="inline-block select-text"
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
      </div>
    );
  }

  return (
    <span
      className={`font-serif px-1 text-[1.05em] text-foreground font-medium select-text ${className}`}
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  );
}

/**
 * Formats LaTeX-like math strings into readable, styled HTML
 */
export function formatMathToHtml(input: string): string {
  if (!input) return '';

  let res = input;

  // Strip leading/trailing delimiters $$ or $
  res = res.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim();

  // Replace common Greek letters
  const greekMap: Record<string, string> = {
    '\\alpha': '&alpha;',
    '\\beta': '&beta;',
    '\\gamma': '&gamma;',
    '\\delta': '&delta;',
    '\\Delta': '&Delta;',
    '\\epsilon': '&epsilon;',
    '\\theta': '&theta;',
    '\\lambda': '&lambda;',
    '\\mu': '&mu;',
    '\\pi': '&pi;',
    '\\sigma': '&sigma;',
    '\\Sigma': '&Sigma;',
    '\\omega': '&omega;',
    '\\Omega': '&Omega;',
    '\\phi': '&phi;',
    '\\rho': '&rho;',
  };

  for (const [tex, html] of Object.entries(greekMap)) {
    res = res.replaceAll(tex, html);
  }

  // Math operators
  res = res.replaceAll('\\pm', '&plusmn;');
  res = res.replaceAll('\\times', '&times;');
  res = res.replaceAll('\\cdot', '&middot;');
  res = res.replaceAll('\\div', '&divide;');
  res = res.replaceAll('\\le', '&le;');
  res = res.replaceAll('\\ge', '&ge;');
  res = res.replaceAll('\\neq', '&ne;');
  res = res.replaceAll('\\approx', '&asymp;');
  res = res.replaceAll('\\infty', '&infin;');
  res = res.replaceAll('\\rightarrow', '&rarr;');
  res = res.replaceAll('\\leftarrow', '&larr;');
  res = res.replaceAll('\\Rightarrow', '&rArr;');
  res = res.replaceAll('\\sum', '<span class="text-xl leading-none">&sum;</span>');
  res = res.replaceAll('\\int', '<span class="text-xl leading-none">&int;</span>');

  // Fractions: \frac{numerator}{denominator}
  res = res.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, num, den) => {
    return `<span class="inline-flex flex-col items-center align-middle mx-1 text-center leading-none text-[0.9em]">
      <span class="border-b border-current pb-0.5 px-1">${num}</span>
      <span class="pt-0.5 px-1">${den}</span>
    </span>`;
  });

  // Square roots: \sqrt{x} or \sqrt[n]{x}
  res = res.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, (_m, n, content) => {
    return `<span class="inline-flex items-center align-middle mx-0.5"><sup>${n}</sup>&radic;<span class="border-t border-current px-0.5">${content}</span></span>`;
  });
  res = res.replace(/\\sqrt\{([^{}]+)\}/g, (_m, content) => {
    return `<span class="inline-flex items-center align-middle mx-0.5">&radic;<span class="border-t border-current px-0.5">${content}</span></span>`;
  });

  // Powers and exponents: x^{2} or x^2
  res = res.replace(/\^{([^{}]+)}/g, '<sup>$1</sup>');
  res = res.replace(/\^([0-9a-zA-Z\+\-]+)/g, '<sup>$1</sup>');

  // Subscripts: x_{1} or x_1
  res = res.replace(/_{([^{}]+)}/g, '<sub>$1</sub>');
  res = res.replace(/_([0-9a-zA-Z\+\-]+)/g, '<sub>$1</sub>');

  // Text inside math: \text{...}
  res = res.replace(/\\text\{([^{}]+)\}/g, '<span class="font-sans text-[0.95em]">$1</span>');

  return res;
}

/**
 * Pedagogical highlight colors for main points and key concepts in sentences.
 * Ensures vibrant, high-contrast, beautiful colored emphasis instead of plain asterisks.
 */
export const PEDAGOGICAL_MAIN_POINT_COLORS = [
  {
    text: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-500/10 dark:bg-blue-400/15 border-blue-500/30',
  },
  {
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-500/10 dark:bg-amber-400/15 border-amber-500/30',
  },
  {
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/15 border-emerald-500/30',
  },
  {
    text: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-500/10 dark:bg-purple-400/15 border-purple-500/30',
  },
  {
    text: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-500/10 dark:bg-rose-400/15 border-rose-500/30',
  },
  {
    text: 'text-cyan-700 dark:text-cyan-300',
    bg: 'bg-cyan-500/10 dark:bg-cyan-400/15 border-cyan-500/30',
  },
  {
    text: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-500/10 dark:bg-indigo-400/15 border-indigo-500/30',
  },
];

/**
 * Parses markdown inline styles in a plain prose segment:
 * - **main point** or __main point__ -> rendered as colored, highlighted main point (no asterisks)
 * - `code` -> inline code pill
 * - *italic* -> emphasized italic
 * - ==highlight== -> marked text
 */
function renderColoredProseSegment(segment: string, baseKey: number | string) {
  if (!segment) return null;

  // Split by markdown formatting tokens
  const tokens = segment.split(/(\*\*[^\*]+?\*\*|__[^_]+?__|`[^`]+?`|==[^=]+?==|\*[^\*\n]+?\*)/g);

  let highlightIndex = 0;

  return tokens.map((token, subIdx) => {
    const key = `${baseKey}-${subIdx}`;

    // Bold / Main point: **text** or __text__
    if ((token.startsWith('**') && token.endsWith('**') && token.length >= 4) ||
        (token.startsWith('__') && token.endsWith('__') && token.length >= 4)) {
      const clean = token.slice(2, -2).trim();
      const style = PEDAGOGICAL_MAIN_POINT_COLORS[highlightIndex % PEDAGOGICAL_MAIN_POINT_COLORS.length];
      highlightIndex++;

      return (
        <strong
          key={key}
          className={`font-bold inline-block px-1.5 py-0.5 rounded-md border text-[1.02em] shadow-2xs mx-0.5 transition-colors ${style.text} ${style.bg}`}
        >
          {clean}
        </strong>
      );
    }

    // Inline code: `code`
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      const clean = token.slice(1, -1);
      return (
        <code
          key={key}
          className="font-mono text-[0.9em] px-1.5 py-0.5 rounded bg-muted/80 border border-border/70 text-primary font-semibold mx-0.5"
        >
          {clean}
        </code>
      );
    }

    // Highlight: ==text==
    if (token.startsWith('==') && token.endsWith('==') && token.length >= 4) {
      const clean = token.slice(2, -2);
      return (
        <mark
          key={key}
          className="bg-amber-400/25 dark:bg-amber-400/35 text-foreground px-1 py-0.5 rounded font-medium mx-0.5"
        >
          {clean}
        </mark>
      );
    }

    // Italic: *text*
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2 && !token.startsWith('**')) {
      const clean = token.slice(1, -1);
      return (
        <em key={key} className="italic text-foreground/90 font-medium">
          {clean}
        </em>
      );
    }

    // Plain prose: clean out any accidental loose double asterisks
    const sanitized = token.replaceAll('**', '');
    return <span key={key}>{sanitized}</span>;
  });
}

/**
 * Helper component that renders text containing both regular prose and inline/block math.
 * Recognizes $$...$$ as display math and $...$ as inline math.
 * In prose sentences, colors every main point (**...**) using vibrant pedagogical colors
 * without showing literal asterisks.
 */
export function FormattedProseWithMath({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;

  // Split on block math $$...$$ first, then inline math $...$
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2);
          return <MathContent key={idx} math={math} display={true} />;
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          return <MathContent key={idx} math={math} display={false} />;
        }
        return <React.Fragment key={idx}>{renderColoredProseSegment(part, idx)}</React.Fragment>;
      })}
    </span>
  );
}
