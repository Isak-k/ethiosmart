import React, { useState } from 'react';
import { NoteExercise } from '@/types/book';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  ListOrdered,
  Sparkles,
  RotateCcw,
  Check,
} from 'lucide-react';
import { FormattedProseWithMath, MathContent } from './MathContent';

export interface InteractiveExerciseCardProps {
  exercise: NoteExercise;
  index: number;
  className?: string;
  theme?: 'day' | 'sepia' | 'slate' | 'night';
}

/**
 * Robustly resolves the 0-indexed correct option for an MCQ from any field
 * (correctAnswer, solution.answer, letter "B", index, or full text).
 */
function findCorrectOptionIndex(exercise: NoteExercise, options: string[]): number {
  if (!options || options.length === 0) return -1;

  const rawTarget = String(exercise?.correctAnswer || exercise?.solution?.answer || '').trim();
  if (!rawTarget) return 0;

  // 1. Check letter like A, B, C, D (e.g. "B", "Option B", "B)", "(B)", "b")
  const letterMatch = rawTarget.match(/(?:^|\b)(?:Option\s*)?([A-D])(?:\)|\.|\:|\b)/i);
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase();
    const idx = letter.charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return idx;
  }

  // 2. Pure digit: 0, 1, 2, 3
  if (/^[0-3]$/.test(rawTarget)) {
    const num = parseInt(rawTarget, 10);
    if (num >= 0 && num < options.length) return num;
  }

  // 3. 1-indexed digit: 1, 2, 3, 4
  if (/^[1-4]$/.test(rawTarget)) {
    const num = parseInt(rawTarget, 10) - 1;
    if (num >= 0 && num < options.length) return num;
  }

  // 4. Substring or exact match with option text
  const cleanTarget = rawTarget
    .toLowerCase()
    .replace(/^(?:option\s*[a-d][:.)\s]*|[a-d][:.)\s]+)/i, '')
    .trim();
  for (let i = 0; i < options.length; i++) {
    const cleanOpt = options[i]
      .toLowerCase()
      .replace(/^[a-d][:.)\s]+/i, '')
      .trim();
    if (cleanOpt === cleanTarget || cleanTarget.includes(cleanOpt) || cleanOpt.includes(cleanTarget)) {
      return i;
    }
  }

  return 0; // Fallback to option A
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
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState<boolean>(false);

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
  const isMCQ = options.length > 0 || exercise?.questionType === 'mcq';
  const correctOptionIndex = isMCQ ? findCorrectOptionIndex(exercise, options) : -1;
  const isSelectedCorrect = selectedOptionIndex !== null && selectedOptionIndex === correctOptionIndex;

  const handleSelectOption = (optIdx: number) => {
    if (hasAnswered) return; // already answered; use "Try Again" to re-answer
    setSelectedOptionIndex(optIdx);
    setHasAnswered(true);
  };

  const handleReset = () => {
    setSelectedOptionIndex(null);
    setHasAnswered(false);
  };

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
            {isMCQ ? (
              <Badge variant="outline" className="text-xs uppercase font-mono py-0.5 px-2 h-6 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10">
                Interactive MCQ
              </Badge>
            ) : exercise?.questionType ? (
              <Badge variant="outline" className="text-xs uppercase font-mono py-0.5 px-2 h-6">
                {exercise.questionType}
              </Badge>
            ) : null}
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

        {/* INTERACTIVE MULTIPLE-CHOICE OPTIONS */}
        {options.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-1 w-full" role="radiogroup" aria-label={`Exercise ${displayNum} Choices`}>
            {options.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              const isSelected = selectedOptionIndex === optIdx;
              const isThisCorrect = optIdx === correctOptionIndex;

              // Compute interactive visual styles based on answering state
              let interactiveBorder = optionThemeClass;
              if (hasAnswered) {
                if (isSelected && isThisCorrect) {
                  interactiveBorder = 'border-emerald-500 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/40 shadow-sm';
                } else if (isSelected && !isThisCorrect) {
                  interactiveBorder = 'border-rose-500 bg-rose-500/15 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/40 shadow-sm';
                } else if (!isSelected && isThisCorrect) {
                  interactiveBorder = 'border-emerald-500/80 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 border-dashed';
                } else {
                  interactiveBorder = `${optionThemeClass} opacity-40`;
                }
              } else {
                interactiveBorder = `${optionThemeClass} hover:border-primary hover:bg-primary/5 cursor-pointer hover:shadow-xs transition-all`;
              }

              return (
                <div
                  key={optIdx}
                  role="button"
                  tabIndex={hasAnswered ? -1 : 0}
                  onClick={() => handleSelectOption(optIdx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectOption(optIdx);
                    }
                  }}
                  className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border text-base sm:text-lg w-full transition-all select-none ${interactiveBorder}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`h-7 w-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 transition-colors ${
                        hasAnswered && isSelected && isThisCorrect
                          ? 'bg-emerald-500 text-white'
                          : hasAnswered && isSelected && !isThisCorrect
                          ? 'bg-rose-500 text-white'
                          : hasAnswered && isThisCorrect
                          ? 'bg-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : badgeThemeClass
                      }`}
                    >
                      {hasAnswered && isSelected && isThisCorrect ? (
                        <Check className="h-4 w-4 stroke-[3]" />
                      ) : hasAnswered && isSelected && !isThisCorrect ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        letter
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <FormattedProseWithMath text={opt} />
                    </div>
                  </div>

                  {/* Feedback Badge on the Right */}
                  {hasAnswered && (
                    <div className="shrink-0 pl-2">
                      {isSelected && isThisCorrect && (
                        <Badge className="bg-emerald-500 text-white border-none text-[11px] font-bold">
                          ✓ Correct
                        </Badge>
                      )}
                      {isSelected && !isThisCorrect && (
                        <Badge className="bg-rose-500 text-white border-none text-[11px] font-bold">
                          ✕ Incorrect
                        </Badge>
                      )}
                      {!isSelected && isThisCorrect && (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[11px] font-bold">
                          Correct Answer
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* INTERACTIVE MCQ FEEDBACK BOX */}
        {hasAnswered && isMCQ && (
          <div
            className={`p-4 rounded-xl border animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isSelectedCorrect
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {isSelectedCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="text-sm sm:text-base font-bold">
                  {isSelectedCorrect
                    ? '🎉 Correct! Outstanding mastery.'
                    : `Not quite. The correct choice is Option ${String.fromCharCode(65 + Math.max(0, correctOptionIndex))}.`}
                </p>
                {solution?.explanation && (
                  <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
                    <FormattedProseWithMath text={solution.explanation} />
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-8 text-xs font-semibold rounded-lg shrink-0 gap-1.5 self-end sm:self-center"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Try Again</span>
            </Button>
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
