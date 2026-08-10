import { useState, useMemo } from "react";
import { cn, shuffleArray } from "@/lib/utils";
import { Check, X, Lightbulb, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Question,
  isMCQQuestion,
  isTrueFalseQuestion,
  isShortAnswerQuestion,
  isEssayQuestion,
  evaluateTextAnswer,
} from "@/integrations/firebase/types";
import { getImageDisplayClasses, optimizeImageUrl } from "@/lib/image-handler";

interface QuestionRendererProps {
  questionNumber: number;
  question: Question;
  selectedAnswer: string | number | boolean | null; // Question type specific
  correctAnswer?: string | number | boolean | null; // For display after submission
  isSubmitted: boolean;
  onAnswerChange: (answer: string | number | boolean | null) => void;
  marks: number;
  mode?: "practice" | "exam";
  shuffleOptions?: boolean;
}

export function QuestionRenderer({
  questionNumber,
  question,
  selectedAnswer,
  correctAnswer,
  isSubmitted,
  onAnswerChange,
  marks,
  mode = "exam",
  shuffleOptions = false,
}: QuestionRendererProps) {
  const { t } = useTranslation();
  const [showExplanation, setShowExplanation] = useState(false);
  const shouldShowFeedback = mode === "practice" && selectedAnswer !== null;
  const shouldShowResults = isSubmitted;

  // Stable per-question option shuffle mapping for MCQ (only applies when shuffleOptions=true AND question is MCQ)
  // displayToOriginal[displayIndex] = originalOptionIndex
  const displayToOriginal = useMemo(() => {
    if (!shuffleOptions || !isMCQQuestion(question) || question.options.length <= 1) {
      return undefined;
    }
    const indices = question.options.map((_, i) => i);
    return shuffleArray(indices);
  }, [question.questionId, shuffleOptions, shuffleOptions && isMCQQuestion(question) && question.options.length]);

  const renderMCQ = () => {
    if (!isMCQQuestion(question)) return null;

    const shouldShuffle = !!displayToOriginal;

    return (
      <div className="space-y-3">
        {question.options.map((_option, displayIndex) => {
          const originalIndex = shouldShuffle ? displayToOriginal![displayIndex] : displayIndex;
          const option = question.options[originalIndex];
          const isSelected = selectedAnswer === originalIndex;
          const isCorrectOption = originalIndex === question.correctOptionIndex;
          const isWrongSelected = isSelected && !isCorrectOption;

          return (
          <button
            key={displayIndex}
            onClick={() => onAnswerChange(originalIndex)}
            className={cn(
              "w-full p-4 text-left border-2 rounded-lg transition-all",
              "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-offset-2",
              isSelected
                ? "border-primary bg-primary/10"
                : "border-border",
              shouldShowResults && isCorrectOption
                ? "bg-green-500/10 border-green-500 text-green-700"
                : shouldShowResults && isWrongSelected
                ? "bg-red-500/10 border-red-500 text-red-700"
                : shouldShowFeedback && isCorrectOption
                ? "bg-green-500/10 border-green-500 text-green-700"
                : shouldShowFeedback && isWrongSelected
                ? "bg-red-500/10 border-red-500 text-red-700"
                : ""
            )}
            disabled={shouldShowResults || shouldShowFeedback}
          >
            <div className="flex items-center justify-between">
              <span>{option}</span>
              {shouldShowResults && isCorrectOption && (
                <Check className="w-5 h-5 text-green-600" />
              )}
              {shouldShowResults && isWrongSelected && (
                <X className="w-5 h-5 text-red-600" />
              )}
              {shouldShowFeedback && isCorrectOption && (
                <Check className="w-5 h-5 text-green-600" />
              )}
              {shouldShowFeedback && isWrongSelected && (
                <X className="w-5 h-5 text-red-600" />
              )}
            </div>
          </button>
          );
        })}
      </div>
    );
  };

  const renderTrueFalse = () => {
    if (!isTrueFalseQuestion(question)) return null;

    return (
      <div className="space-y-3">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            onClick={() => onAnswerChange(value)}
            className={cn(
              "w-full p-4 text-left border-2 rounded-lg transition-all",
              "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-offset-2",
              selectedAnswer === value
                ? "border-primary bg-primary/10"
                : "border-border",
              shouldShowResults && value === question.correctAnswer
                ? "bg-green-500/10 border-green-500 text-green-700"
                : shouldShowResults &&
                  selectedAnswer === value &&
                  value !== question.correctAnswer
                ? "bg-red-500/10 border-red-500 text-red-700"
                : shouldShowFeedback && value === question.correctAnswer
                ? "bg-green-500/10 border-green-500 text-green-700"
                : shouldShowFeedback &&
                  selectedAnswer === value &&
                  value !== question.correctAnswer
                ? "bg-red-500/10 border-red-500 text-red-700"
                : ""
            )}
            disabled={shouldShowResults || shouldShowFeedback}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {value ? t("common.true") : t("common.false")}
              </span>
              {shouldShowResults && value === question.correctAnswer && (
                <Check className="w-5 h-5 text-green-600" />
              )}
              {shouldShowResults &&
                selectedAnswer === value &&
                value !== question.correctAnswer && (
                  <X className="w-5 h-5 text-red-600" />
                )}
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderShortAnswer = () => {
    if (!isShortAnswerQuestion(question)) return null;

    const textAnswer = (selectedAnswer as string) || "";
    const isCorrect =
      selectedAnswer &&
      evaluateTextAnswer({
        studentAnswer: textAnswer,
        correctAnswers: question.correctAnswers,
        caseSensitive: question.caseSensitive || false,
        requireExactMatch: question.requireExactMatch || false,
      });

    return (
      <div className="space-y-2">
        <textarea
          value={textAnswer}
          onChange={(e) => onAnswerChange(e.target.value)}
          disabled={shouldShowResults}
          placeholder={t("exam.enterAnswer")}
          className={cn(
            "w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2",
            shouldShowResults && isCorrect
              ? "border-green-500 bg-green-50"
              : shouldShowResults && selectedAnswer && !isCorrect
              ? "border-red-500 bg-red-50"
              : "border-border"
          )}
          rows={4}
        />
        {shouldShowResults && (
          <div
            className={cn(
              "p-3 rounded-lg text-sm",
              isCorrect
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            )}
          >
            {isCorrect ? (
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{t("exam.correct")}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4" />
                  <span>{t("exam.incorrect")}</span>
                </div>
                <div className="mt-2 text-xs">
                  <strong>{t("exam.acceptedAnswers")}:</strong>
                  <div className="mt-1">
                    {question.correctAnswers.map((answer, idx) => (
                      <div key={idx}>• {answer}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderEssay = () => {
    if (!isEssayQuestion(question)) return null;

    const textAnswer = (selectedAnswer as string) || "";
    const wordCount = textAnswer.trim().split(/\s+/).length;

    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          {question.minWords || question.maxWords ? (
            <>
              {question.minWords && <span>Min: {question.minWords} words</span>}
              {question.minWords && question.maxWords && <span> • </span>}
              {question.maxWords && <span>Max: {question.maxWords} words</span>}
              <span className="ml-2">({wordCount} words)</span>
            </>
          ) : null}
        </div>
        <textarea
          value={textAnswer}
          onChange={(e) => onAnswerChange(e.target.value)}
          disabled={shouldShowResults}
          placeholder={t("exam.enterEssayAnswer")}
          className="w-full p-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2"
          rows={6}
        />
        {shouldShowResults && (
          <div className="p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{t("exam.essayPendingReview")}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getImageContainerClasses = (mode?: 'inline' | 'background' | 'main'): string => {
    switch (mode) {
      case 'inline':
        return 'flex justify-start my-4';
      case 'background':
        return 'relative my-4';
      case 'main':
        return 'flex justify-center my-4';
      default:
        return 'flex justify-start my-4';
    }
  };

  const renderQuestionImage = () => {
    if (!question.imageUrl) return null;

    const displayMode = question.imageDisplayMode || 'inline';
    const optimizedUrl = optimizeImageUrl(question.imageUrl, {
      maxWidth: displayMode === 'main' ? 1200 : 800,
      quality: 'auto',
      format: 'auto',
    });

    // Background mode: render as background with the question content overlaid
    if (displayMode === 'background') {
      return (
        <div
          className="relative rounded-lg overflow-hidden mb-4"
          style={{
            backgroundImage: `url(${optimizedUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.2,
            pointerEvents: 'none',
          }}
        >
          <div className={cn(getImageDisplayClasses('background'))} />
        </div>
      );
    }

    // Inline or main mode: render as regular image
    return (
      <div className={getImageContainerClasses(displayMode)}>
        <img
          src={optimizedUrl}
          alt="Question"
          className={cn(getImageDisplayClasses(displayMode), 'rounded-lg')}
          loading="lazy"
          onError={(e) => {
            console.error('Error loading image:', e);
          }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg border border-border relative overflow-hidden">
      {/* Question Image (if background display mode - renders behind) */}
      {question.imageUrl && question.imageDisplayMode === 'background' && (
        <div
          className="absolute inset-0 rounded-lg opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url(${optimizeImageUrl(question.imageUrl, { maxWidth: 1600, quality: 'auto', format: 'auto' })})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Question Header */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              Question {questionNumber}
              <span className="text-sm text-muted-foreground ml-2">({marks} marks)</span>
            </h3>
          </div>
          {/* Question Type Badge - More Visible */}
          <div className={cn(
            "px-3 py-1.5 rounded-full font-semibold text-sm whitespace-nowrap flex items-center gap-2",
            question.questionType === 'mcq' && "bg-blue-100 text-blue-700 border border-blue-200",
            question.questionType === 'true-false' && "bg-purple-100 text-purple-700 border border-purple-200",
            question.questionType === 'short-answer' && "bg-amber-100 text-amber-700 border border-amber-200",
            question.questionType === 'essay' && "bg-green-100 text-green-700 border border-green-200"
          )}>
            {question.questionType === 'mcq' && '📋 MCQ'}
            {question.questionType === 'true-false' && '✓/✗ True/False'}
            {question.questionType === 'short-answer' && '📝 Short Answer'}
            {question.questionType === 'essay' && '📄 Essay'}
          </div>
        </div>
        <p className="text-base text-foreground">{question.questionText}</p>
      </div>

      {/* Question Image (if inline or main display mode) */}
      {question.imageUrl && (question.imageDisplayMode === 'inline' || question.imageDisplayMode === 'main') && (
        renderQuestionImage()
      )}

      {/* Question Content */}
      <div className="relative z-10">
        {isMCQQuestion(question) && renderMCQ()}
        {isTrueFalseQuestion(question) && renderTrueFalse()}
        {isShortAnswerQuestion(question) && renderShortAnswer()}
        {isEssayQuestion(question) && renderEssay()}
      </div>

      {/* Explanation */}
      {question.explanation && (shouldShowResults || shouldShowFeedback) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg relative z-10">
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-2 text-amber-900 font-medium text-sm"
          >
            <Lightbulb className="w-4 h-4" />
            {showExplanation ? t("exam.hideExplanation") : t("exam.showExplanation")}
          </button>
          {showExplanation && (
            <p className="mt-2 text-sm text-amber-800">{question.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
