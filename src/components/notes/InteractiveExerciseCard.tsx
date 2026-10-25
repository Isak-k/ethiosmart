import React, { useState } from 'react';
import { NoteExercise } from '@/types/book';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  ListOrdered,
  Sparkles,
} from 'lucide-react';
import { FormattedProseWithMath, MathContent } from './MathContent';

export interface InteractiveExerciseCardProps {
  exercise: NoteExercise;
  index: number;
  className?: string;
  theme?: 'day' | 'sepia' | 'slate' | 'night';
}

export function InteractiveExerciseCard({
  exercise,
  index,
  className = '',
  theme = 'day',
}: InteractiveExerciseCardProps) {
  // Independent state per exercise - initialized from author's initialExpanded or default false
  const [isSolutionVisible, setIsSolutionVisible] = useState<boolean>(() => {
    return Boolean(exercise?.initialExpanded);
  });

  const [isHintVisible, setIsHintVisible] = useState<boolean>(false);

  const solution = exercise?.solution;
  const hasSolution = Boolean(
    solution &&
      (Boolean(solution.answer) ||
        Boolean(solution.explanation) ||
        (Array.isArray(solution.steps) && solution.steps.length > 0) ||
        (Array.isArray(solution.formulas) && solution.formulas.length > 0))
  );

  const displayNum = exercise?.exerciseNumber ?? index + 1;
  const hints = Array.isArray(exercise?.hints) ? exercise.hints : [];
  const options = Array.isArray(exercise?.options) ? exercise.options : [];

  // Theme-isolated classes (immune to device dark/light mode)
  const cardThemeClass =
    theme === 'sepia'
      ? 'border-[#E8DFC8] bg-[#FFFDF7] text-[#2C2416]'
      : theme === 'slate'
      ? 'border-[#334155] bg-[#1E293B] text-[#F1F5F9]'
      : theme === 'night'
      ? 'border-zinc-800 bg-zinc-950 text-[#F4F4F5]'
      : 'border-slate-200 bg-white text-slate-900';

  const optionThemeClass =
    theme === 'sepia'
      ? 'border-[#EADFC7] bg-[#F5EFE3] text-[#2C2416]'
      : theme === 'slate'
      ? 'border-[#334155] bg-[#0F172A] text-[#F1F5F9]'
      : theme === 'night'
      ? 'border-zinc-800 bg-black text-[#F4F4F5]'
      : 'border-slate-200 bg-slate-50 text-slate-900';

  const badgeThemeClass =
    theme === 'sepia'
      ? 'bg-[#EADFC7] text-[#2C2416]'
      : theme === 'slate'
      ? 'bg-[#334155] text-[#F1F5F9]'
      : theme === 'night'
      ? 'bg-zinc-800 text-[#F4F4F5]'
      : 'bg-slate-200 text-slate-800';

  return (
    <div
      className={`rounded-2xl sm:rounded-3xl border-2 overflow-hidden shadow-xs transition-all hover:border-amber-500/40 w-full ${cardThemeClass} ${className}`}
    >
      {/* Exercise Question Header */}
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-7 px-3 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-bold font-mono flex items-center justify-center">
              Exercise {displayNum}
            </span>
            {exercise?.questionType && (
              <Badge variant="outline" className="text-xs uppercase font-mono py-0.5 px-2 h-6">
                {exercise.questionType}
              </Badge>
            )}
          </div>

          {hints.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsHintVisible((prev) => !prev)}
              className="h-7 text-xs px-2.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg gap-1.5 font-semibold"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              <span>{isHintVisible ? 'Hide Hint' : 'Hint'}</span>
            </Button>
          )}
        </div>

        {/* Question Text with Math rendering - Enlarged text */}
        <div className="text-base sm:text-lg font-semibold leading-relaxed pt-0.5">
          <FormattedProseWithMath text={exercise.question} />
        </div>

        {/* Optional Multiple-Choice Choices (Single column, full width, large text) */}
        {options.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-1 w-full">
            {options.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              return (
                <div
                  key={optIdx}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-base sm:text-lg w-full ${optionThemeClass}`}
                >
                  <span className={`h-6 w-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${badgeThemeClass}`}>
                    {letter}
                  </span>
                  <div className="min-w-0 flex-1">
                    <FormattedProseWithMath text={opt} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Collapsible Hint Drawer */}
        {isHintVisible && hints.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/25 text-base sm:text-lg text-amber-950 dark:text-amber-100 space-y-2 animate-fade-in w-full">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-sm uppercase tracking-wider">
              <Lightbulb className="h-4 w-4" />
              <span>Helpful Hint:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1.5">
              {hints.map((h, i) => (
                <li key={i}>
                  <FormattedProseWithMath text={h} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Toolbar: Independent Show / Hide Solution Button */}
        {hasSolution ? (
          <div className="pt-2 flex items-center justify-between border-t border-border/60">
            <Button
              type="button"
              variant={isSolutionVisible ? 'outline' : 'default'}
              size="sm"
              onClick={() => setIsSolutionVisible((prev) => !prev)}
              className={`h-9 px-4 rounded-xl text-xs sm:text-sm font-bold gap-2 transition-all shadow-none ${
                isSolutionVisible
                  ? 'border-amber-500/40 text-amber-800 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              aria-expanded={isSolutionVisible}
            >
              {isSolutionVisible ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span>Hide Solution −</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span>Show Solution +</span>
                </>
              )}
            </Button>

            <span className="text-xs font-mono text-muted-foreground">
              {isSolutionVisible ? 'Solution revealed' : 'Self-test mode'}
            </span>
          </div>
        ) : (
          <div className="pt-2 text-xs text-muted-foreground italic border-t border-border/50">
            Self-assessment exercise (try solving before checking notes)
          </div>
        )}
      </div>

      {/* EXPANDED SOLUTION CONTAINER (Dark high-contrast card matching Screenshot 5) */}
      {isSolutionVisible && hasSolution && (
        <div className="border-t-2 border-slate-700 bg-slate-900 text-slate-100 dark:bg-zinc-950 p-5 sm:p-6 space-y-4 animate-fade-in w-full">
          {/* Solution Header */}
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm uppercase tracking-wider">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Step-by-Step Solution & Working</span>
          </div>

          {/* Direct Answer Pill */}
          {solution?.answer && (
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-amber-500/30 space-y-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Final Result
              </span>
              <div className="text-base sm:text-lg font-bold text-white">
                <FormattedProseWithMath text={solution.answer} />
              </div>
            </div>
          )}

          {/* Step-by-Step Explanations (Yellow step title, light text like Screenshot 5) */}
          {Array.isArray(solution?.steps) && solution.steps.length > 0 && (
            <div className="space-y-3 pt-1 w-full">
              <ol className="space-y-3.5 w-full">
                {solution.steps.map((step, sIdx) => {
                  // Check if step text already has "Step X:"
                  const hasStepPrefix = /^Step\s*\d+[:.]/i.test(step);
                  return (
                    <li
                      key={sIdx}
                      className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-base sm:text-lg text-slate-100 leading-relaxed"
                    >
                      {!hasStepPrefix && (
                        <span className="text-amber-400 font-bold text-base sm:text-lg block mb-1">
                          Step {sIdx + 1}:
                        </span>
                      )}
                      <div className="min-w-0 flex-1 text-slate-200">
                        <FormattedProseWithMath text={step} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Solution Formulas if provided */}
          {Array.isArray(solution?.formulas) && solution.formulas.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Formulas Used:
              </span>
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                {solution.formulas.map((form, fIdx) => (
                  <MathContent key={fIdx} math={form} display={true} />
                ))}
              </div>
            </div>
          )}

          {/* Detailed Conceptual Explanation */}
          {solution?.explanation && (
            <div className="pt-2 border-t border-slate-700/60 text-sm sm:text-base text-slate-300 leading-relaxed">
              <FormattedProseWithMath text={solution.explanation} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
