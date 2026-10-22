import React, { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, X, Lightbulb, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { QuestionImageDisplay } from "@/components/exam/QuestionImageDisplay";

interface QuestionCardProps {
  questionNumber: number;
  questionText: string;
  imageUrl?: string;
  options?: string[];
  selectedOption: number | null;
  correctOption?: number;
  feedbackType: "instant" | "hidden";
  isSubmitted: boolean;
  onSelectOption: (index: number) => void;
  marks: number;
  explanation?: string;
  isPracticeExam?: boolean;
  mode?: 'practice' | 'exam';
  questionType?: string;
  studentAnswer?: string | null;
  correctAnswerText?: string | null;
  manualGrade?: number | null;
  isCorrect?: boolean | null;
}

export function QuestionCard({
  questionNumber,
  questionText,
  imageUrl,
  options = [],
  selectedOption,
  correctOption,
  feedbackType,
  isSubmitted,
  onSelectOption,
  marks,
  explanation,
  isPracticeExam,
  mode = 'exam',
  questionType = 'mcq',
  studentAnswer,
  correctAnswerText,
  manualGrade,
  isCorrect,
}: QuestionCardProps) {
  const { t } = useTranslation();
  
  // Manual user toggle override for explanation: null follows default, true/false overrides
  const [manualExplanationVisible, setManualExplanationVisible] = useState<boolean | null>(null);

  // Reset override whenever switching question
  useEffect(() => {
    setManualExplanationVisible(null);
  }, [questionNumber, questionText]);

  const hasExplanation = Boolean(explanation && explanation.trim().length > 0);
  const isPractice = mode === 'practice' || Boolean(isPracticeExam);

  // User has selected an answer or exam is submitted (review mode)
  const isAnswered = (selectedOption !== null && selectedOption !== undefined) || Boolean(studentAnswer && studentAnswer.trim().length > 0) || isSubmitted;

  // In practice mode, explanation is collapsed by default so user sees "Unhide explanation" first
  // In submitted review mode, explanations default to visible
  const defaultVisible = isSubmitted;
  const isExplanationShown = manualExplanationVisible !== null ? manualExplanationVisible : defaultVisible;

  // Hide and unhide button only appears after the user selects an answer (or after exam submission)
  const canToggleExplanation = (isPractice || isSubmitted) && hasExplanation && isAnswered;
  const showExplanation = canToggleExplanation && isExplanationShown;
  const showResults = isSubmitted;
  const showFeedback = isPractice && selectedOption !== null;

  const hasOptions = options && options.length > 0;
  const isTextQuestion = questionType === 'shortanswer' || questionType === 'essay' || !hasOptions;

  // Determine correct answer text for review
  const displayCorrectAnswer = useMemo(() => {
    if (correctOption !== undefined && correctOption !== null && correctOption >= 0 && options && options[correctOption]) {
      return options[correctOption];
    }
    if (correctAnswerText && String(correctAnswerText).trim().length > 0) {
      return String(correctAnswerText).trim();
    }
    if (correctOption !== undefined && correctOption !== null && correctOption >= 0) {
      return `Option ${String.fromCharCode(65 + correctOption)}`;
    }
    return "Not available";
  }, [correctOption, options, correctAnswerText]);

  // Determine user's selected/typed answer for review
  const displayUserAnswer = useMemo(() => {
    if (studentAnswer && String(studentAnswer).trim().length > 0) {
      return String(studentAnswer).trim();
    }
    if (selectedOption !== null && selectedOption !== undefined && selectedOption >= 0 && options && options[selectedOption]) {
      return options[selectedOption];
    }
    return "No answer provided / Skipped";
  }, [selectedOption, options, studentAnswer]);

  // Determine if the user's answer was correct
  const isUserCorrect = useMemo(() => {
    // 1. If an admin manually graded this question (points given: manualGrade > 0 counts as correct)
    if (typeof manualGrade === 'number') {
      return manualGrade > 0;
    }
    // 2. If isCorrect was explicitly set
    if (typeof isCorrect === 'boolean') {
      return isCorrect;
    }
    // 3. For options-based questions (MCQ / True-False)
    if (selectedOption !== null && selectedOption !== undefined && correctOption !== undefined && correctOption !== null) {
      return selectedOption === correctOption;
    }
    // 4. For text-based questions without manualGrade or isCorrect, fallback to text comparison
    if (isTextQuestion) {
      if (studentAnswer && displayCorrectAnswer && displayCorrectAnswer !== 'Not available') {
        return studentAnswer.trim().toLowerCase() === displayCorrectAnswer.trim().toLowerCase();
      }
      return false;
    }
    return false;
  }, [manualGrade, isCorrect, selectedOption, correctOption, isTextQuestion, studentAnswer, displayCorrectAnswer]);

  const getOptionClass = (index: number) => {
    // If exam is submitted, highlight both user's choice and the correct answer
    if (showResults) {
      const isSelected = selectedOption === index;
      const isCorrect = index === correctOption;

      if (isCorrect && isSelected) {
        return "bg-green-500/15 border-green-600 text-green-800 dark:text-green-300 font-medium";
      }
      if (isCorrect && !isSelected) {
        return "bg-green-500/10 border-green-500 text-green-700 dark:text-green-300 font-medium";
      }
      if (isSelected && !isCorrect) {
        return "bg-destructive/15 border-destructive text-destructive font-medium";
      }
      return "opacity-50 border-border";
    }

    // Instant feedback in practice mode
    if (showFeedback) {
      if (index === correctOption) return "bg-green-500/10 border-green-500 text-green-700";
      if (index === selectedOption && index !== correctOption) return "bg-destructive/10 border-destructive text-destructive";
    }

    // Default state during active exam
    if (index === selectedOption) return "bg-primary/10 border-primary text-primary font-medium";
    
    return "hover:bg-accent hover:border-accent-foreground/20 border-border";
  };

  return (
    <div className="animate-fade-in space-y-5 border-y bg-card px-3 py-5 sm:space-y-6 sm:rounded-xl sm:border sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="flex gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-display font-semibold">
            {questionNumber}
          </div>
          <div className="space-y-1">
            <p className="text-base font-medium leading-relaxed sm:text-lg">{questionText}</p>
            <p className="text-sm text-muted-foreground">{t("student.exam.card.marks", { count: marks })}</p>
          </div>
        </div>

        {showResults && (
          <div className="shrink-0 flex items-center gap-2">
            {typeof manualGrade === 'number' && (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
                {manualGrade}/{marks} marks
              </span>
            )}
            {isUserCorrect ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Correct
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 flex items-center gap-1">
                <X className="h-3.5 w-3.5" /> Incorrect
              </span>
            )}
          </div>
        )}
      </div>

      {/* Image if available */}
      {imageUrl && (
        <QuestionImageDisplay
          imageUrl={imageUrl}
          alt={`Question ${questionNumber} illustration`}
          className="sm:pl-14"
        />
      )}

      {/* Question Options or Short Answer Content */}
      {isTextQuestion ? (
        <div className="space-y-3 sm:pl-14">
          <div className="p-3.5 rounded-lg border bg-muted/40">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Your Answer
              </span>
              {showResults && (
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded",
                    isUserCorrect
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                  )}
                >
                  {isUserCorrect ? "✓ Correct" : "✗ Incorrect"}
                  {typeof manualGrade === 'number' ? ` (${manualGrade}/${marks} pts)` : ""}
                </span>
              )}
            </div>
            <p className="text-sm font-medium whitespace-pre-wrap">
              {studentAnswer && studentAnswer.trim().length > 0 ? (
                studentAnswer
              ) : (
                <span className="italic text-muted-foreground">No answer provided / Skipped</span>
              )}
            </p>
          </div>

          {showResults && (
            <div className="p-3.5 rounded-lg border border-green-200 bg-green-50/70 dark:bg-green-950/20">
              <span className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-wider block mb-1">
                Correct Answer
              </span>
              <p className="text-sm font-medium text-green-900 dark:text-green-200 whitespace-pre-wrap">
                {displayCorrectAnswer && displayCorrectAnswer !== 'Not available'
                  ? displayCorrectAnswer
                  : explanation || "Refer to teacher grading"}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:pl-14">
          {options.map((option, index) => {
            const isSelected = selectedOption === index;
            const isCorrect = index === correctOption;
            const showCorrectIcon = showFeedback && isCorrect;
            const showIncorrectIcon = showFeedback && isSelected && !isCorrect;

            return (
              <button
                key={index}
                type="button"
                onClick={() => !isSubmitted && !showFeedback && onSelectOption(index)}
                disabled={isSubmitted || showFeedback || (isPracticeExam && selectedOption !== null)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-all sm:gap-4",
                  getOptionClass(index),
                  (isSubmitted || showFeedback || (isPracticeExam && selectedOption !== null)) && "cursor-default"
                )}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    showResults
                      ? (isCorrect && isSelected)
                        ? "border-green-600 bg-green-600 text-white"
                        : (isSelected && !isCorrect)
                        ? "border-destructive bg-destructive text-white"
                        : isCorrect
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-border"
                      : isSelected
                      ? showIncorrectIcon
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : (showCorrectIcon || (showResults && isCorrect))
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  )}
                >
                  {showResults ? (
                    isCorrect ? <Check className="h-4 w-4" /> : isSelected ? <X className="h-4 w-4" /> : null
                  ) : (
                    <>
                      {(showCorrectIcon || (showResults && isCorrect)) && (
                        <Check className="h-4 w-4" />
                      )}
                      {showIncorrectIcon && <X className="h-4 w-4" />}
                    </>
                  )}
                </div>

                <span className="flex-1">{option}</span>

                {/* Badges on right during review */}
                {showResults && (
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    {isSelected && isCorrect && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                        Your Choice (Correct)
                      </span>
                    )}
                    {isSelected && !isCorrect && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">
                        Your Choice
                      </span>
                    )}
                    {!isSelected && isCorrect && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold border border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200">
                        Correct Answer
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Button under the question that says "Hide explanation" or "Unhide explanation" */}
      {canToggleExplanation && (
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManualExplanationVisible(!isExplanationShown)}
            className="rounded-xl font-semibold text-xs sm:text-sm border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-amber-900 dark:text-amber-200 hover:text-amber-950 dark:hover:text-amber-100 gap-2 transition-all shadow-xs"
          >
            {isExplanationShown ? (
              <>
                <EyeOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Hide explanation</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Unhide explanation</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Explanation callout */}
      {showExplanation && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-amber-500/20 dark:border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-muted/30 to-background shadow-sm animate-fade-in">
          <div className="flex items-center justify-between gap-2.5 px-4 sm:px-5 py-2.5 sm:py-3 border-b border-border/60 bg-muted/50 dark:bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Lightbulb className="h-4 w-4" />
              </div>
              <p className="text-sm sm:text-base font-semibold text-foreground">
                {t("student.exam.card.explanation")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setManualExplanationVisible(false)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-lg"
              title="Hide explanation"
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span>Hide</span>
            </Button>
          </div>
          <div className="p-4 sm:p-5 md:p-6">
            <p className="text-base sm:text-lg leading-relaxed sm:leading-8 text-foreground font-normal whitespace-pre-wrap">
              {explanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
