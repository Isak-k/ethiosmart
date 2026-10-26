import React from 'react';
import { NoteContentBlock } from '@/types/book';
import { FormattedProseWithMath, MathContent } from './MathContent';
import { CodeContent } from './CodeContent';
import {
  Lightbulb,
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  BookOpen,
  Info,
  Layers,
  Sparkles,
  HelpCircle,
  Quote,
  Table as TableIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ContentBlockRendererProps {
  block: NoteContentBlock;
  className?: string;
  theme?: 'day' | 'sepia' | 'slate' | 'night';
}

export function ContentBlockRenderer({
  block,
  className = '',
  theme = 'day',
}: ContentBlockRendererProps) {
  if (!block) return null;

  switch (block.type) {
    case 'heading':
      return (
        <h3 className={`text-lg sm:text-xl font-display font-bold pt-3 pb-1 border-b border-border/60 ${className}`}>
          <FormattedProseWithMath text={block.title || block.content} />
        </h3>
      );

    case 'subheading':
      return (
        <h4 className={`text-base sm:text-lg font-bold pt-2 ${className}`}>
          <FormattedProseWithMath text={block.title || block.content} />
        </h4>
      );

    case 'learning_outcomes':
      const outcomes = block.listItems || (block.content ? block.content.split('\n').filter(Boolean) : []);
      return (
        <div className={`my-5 overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 sm:p-6 shadow-xs w-full ${className}`}>
          <div className="flex items-center gap-2 mb-3 text-primary font-bold text-sm sm:text-base uppercase tracking-wider">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{block.title || 'Learning Outcomes & Key Objectives'}</span>
          </div>
          <ul className="space-y-3 w-full">
            {outcomes.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-base sm:text-lg leading-relaxed">
                <span className="h-5 w-5 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  ✓
                </span>
                <div className="flex-1">
                  <FormattedProseWithMath text={item.replace(/^[-*•\d\.]+\s*/, '')} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      );

    case 'definition':
      return (
        <div className={`my-5 rounded-2xl sm:rounded-3xl border-l-4 border-l-sky-500 border-2 border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent p-4 sm:p-6 shadow-xs space-y-2.5 w-full ${className}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                Definition
              </span>
            </div>
            {block.subtitle && (
              <Badge variant="outline" className="text-xs font-mono py-0.5 px-2 border-sky-500/30 text-sky-700 dark:text-sky-300">
                {block.subtitle}
              </Badge>
            )}
          </div>
          {block.title && (
            <h4 className="text-lg sm:text-xl font-bold">
              <FormattedProseWithMath text={block.title} />
            </h4>
          )}
          <div className="text-base sm:text-lg leading-relaxed font-normal">
            <FormattedProseWithMath text={block.content} />
          </div>
        </div>
      );

    case 'important_fact':
      return (
        <div className={`my-5 rounded-2xl sm:rounded-3xl border-2 border-rose-500/35 bg-gradient-to-br from-rose-500/15 via-rose-500/10 to-rose-500/5 p-4 sm:p-6 shadow-xs space-y-2.5 w-full ${className}`}>
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-sm sm:text-base uppercase tracking-wider">
            <Sparkles className="h-5 w-5 shrink-0" />
            <span>{block.title || 'Fact to Remember: Key Concept'}</span>
          </div>
          <div className="text-base sm:text-lg text-foreground leading-relaxed font-medium">
            <FormattedProseWithMath text={block.content} />
          </div>
        </div>
      );

    case 'tip':
      return (
        <div className={`my-5 rounded-2xl sm:rounded-3xl border-2 border-teal-500/35 bg-gradient-to-br from-teal-500/15 via-teal-500/10 to-teal-500/5 p-4 sm:p-6 shadow-xs space-y-2.5 w-full ${className}`}>
          <div className="flex items-center gap-2 text-teal-800 dark:text-teal-200 font-bold text-sm sm:text-base uppercase tracking-wider">
            <Lightbulb className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
            <span>{block.title || 'Exam Tip & Strategy'}</span>
          </div>
          <div className="text-base sm:text-lg text-foreground/95 leading-relaxed">
            <FormattedProseWithMath text={block.content} />
          </div>
        </div>
      );

    case 'warning':
      return (
        <div className={`my-5 rounded-2xl sm:rounded-3xl border-2 border-amber-500/45 bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-amber-500/5 p-4 sm:p-6 shadow-xs space-y-2.5 w-full ${className}`}>
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm sm:text-base uppercase tracking-wider">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{block.title || 'Common Misconception / Warning'}</span>
          </div>
          <div className="text-base sm:text-lg text-foreground leading-relaxed font-medium">
            <FormattedProseWithMath text={block.content} />
          </div>
        </div>
      );

    case 'example':
      return (
        <div className={`my-6 rounded-2xl sm:rounded-3xl border-2 border-indigo-500/35 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent overflow-hidden shadow-xs w-full ${className}`}>
          <div className="flex items-center justify-between px-5 py-3 bg-indigo-500/15 dark:bg-indigo-500/25 border-b border-indigo-500/20">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-200">
                {block.title || 'Worked Example'}
              </span>
            </div>
            {block.subtitle && (
              <span className="text-xs text-muted-foreground font-mono">
                {block.subtitle}
              </span>
            )}
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {/* Example Statement */}
            <div className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
              <FormattedProseWithMath text={block.content} />
            </div>

            {/* Step-by-step resolution */}
            {Array.isArray(block.steps) && block.steps.length > 0 && (
              <div className="pt-3 border-t border-indigo-500/20 space-y-3">
                <span className="text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
                  Solution Steps:
                </span>
                <ol className="space-y-3 w-full">
                  {block.steps.map((st) => (
                    <li key={st.stepNumber} className="flex items-start gap-3 text-base sm:text-lg text-foreground leading-relaxed">
                      <span className="h-6 w-6 rounded-lg bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {st.stepNumber}
                      </span>
                      <div className="min-w-0 flex-1">
                        {st.title && <span className="font-bold block text-foreground mb-0.5">{st.title}</span>}
                        <FormattedProseWithMath text={st.text} />
                        {st.calculation && (
                          <div className="my-2 font-mono text-sm sm:text-base text-indigo-950 dark:text-indigo-100 bg-background/90 p-3 rounded-xl border border-indigo-500/30">
                            <FormattedProseWithMath text={st.calculation} />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      );

    case 'formula':
      return (
        <div className={`my-4 rounded-2xl border border-primary/30 bg-muted/30 p-4 sm:p-5 shadow-2xs space-y-3 ${className}`}>
          {block.title && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {block.title}
              </span>
            </div>
          )}
          <div className="text-center py-2">
            <MathContent math={block.mathFormula || block.content} display={true} />
          </div>
          {Array.isArray(block.variables) && block.variables.length > 0 && (
            <div className="pt-3 border-t border-border/50 text-base sm:text-lg text-muted-foreground space-y-2">
              <span className="font-semibold text-foreground block">Where:</span>
              <ul className="flex flex-col gap-2 pl-2 w-full">
                {block.variables.map((v, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-base sm:text-lg text-foreground">
                    <span className="font-mono font-bold text-primary">{v.symbol}</span>
                    <span>=</span>
                    <span>{v.explanation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case 'code':
      return (
        <CodeContent
          code={block.content}
          language={block.codeLanguage || 'python'}
          title={block.title}
          className={className}
        />
      );

    case 'table':
      if (!block.tableData || !block.tableData.headers) {
        return (
          <div className="overflow-x-auto my-4 text-base sm:text-lg">
            <FormattedProseWithMath text={block.content} />
          </div>
        );
      }
      return (
        <div className={`my-5 overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-card shadow-xs w-full ${className}`}>
          {block.title && (
            <div className="px-5 py-3 bg-muted/40 border-b border-border/70 flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-primary" />
              <span className="text-sm sm:text-base font-bold text-foreground">{block.title}</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm sm:text-base">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  {block.tableData.headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 font-bold text-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {block.tableData.rows.map((rowItem, rIdx) => {
                  const rowCells: string[] = Array.isArray(rowItem)
                    ? rowItem
                    : Array.isArray((rowItem as any)?.cells)
                    ? (rowItem as any).cells
                    : Object.values(rowItem || {});

                  return (
                    <tr key={rIdx} className="hover:bg-muted/30">
                      {rowCells.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-3 text-foreground/90 align-top">
                          <FormattedProseWithMath text={cell} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'quote':
      return (
        <blockquote className={`my-5 p-5 rounded-2xl sm:rounded-3xl border-l-4 border-primary bg-primary/5 italic text-base sm:text-lg text-foreground/90 space-y-2 w-full ${className}`}>
          <div className="flex items-start gap-3">
            <Quote className="h-5 w-5 text-primary shrink-0 mt-1 opacity-70" />
            <div className="flex-1">
              <FormattedProseWithMath text={block.content} />
            </div>
          </div>
          {block.title && (
            <div className="text-right text-xs sm:text-sm font-semibold text-muted-foreground not-italic pt-1">
              — {block.title}
            </div>
          )}
        </blockquote>
      );

    case 'list':
      const items = block.listItems || block.content.split('\n').filter(Boolean);
      return (
        <ul className={`my-4 space-y-2.5 pl-2 w-full ${className}`}>
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3 text-base sm:text-lg text-foreground leading-relaxed">
              <span className="h-2 w-2 rounded-full bg-primary mt-2.5 shrink-0" />
              <div className="flex-1">
                <FormattedProseWithMath text={item.replace(/^[-*•]\s*/, '')} />
              </div>
            </li>
          ))}
        </ul>
      );

    case 'paragraph':
    default:
      return (
        <div className={`my-2.5 text-foreground leading-relaxed ${className}`}>
          <FormattedProseWithMath text={block.content} />
        </div>
      );
  }
}
