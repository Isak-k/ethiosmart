import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, X, Lightbulb, AlertCircle, Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Question,
  isMCQQuestion,
  isTrueFalseQuestion,
  isShortAnswerQuestion,
  isEssayQuestion,
  evaluateTextAnswer,
} from "@/integrations/firebase/types";
import { getImageDisplayClasses } from "@/lib/image-handler";

interface QuestionRendererProps {
  questionNumber: number;
  question: Question;
  selectedAnswer: string | number | boolean | null; // Question type specific
  correctAnswer?: string | number | boolean | null; // For display after submission
  isSubmitted: boolean;
  onAnswerChange: (answer: string | number | boolean | null) => void;
  marks: number;
  mode?: "practice" | "exam";
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
}: QuestionRendererProps) {
  const { t } = useTranslation();
  const [showExplanation, setShowExplanation] = useState(false);
  const shouldShowFeedback = mode === "practice" && selectedAnswer !== null;
  const shouldShowResults = isSubmitted;

  const renderMCQ = () => {
    if (!isMCQQuestion(question)) return null;

    return (
      <div className="space-y-3">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => onAnswerChange(index)}
            className={cn(
              "w-full p-4 text-left border-2 rounded-lg transition-all",
              "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-offset-2",
              selectedAnswer === index
                ? "border-primary bg-primary/10"
                : "border-border",
              shouldShowResults && index === question.correctOptionIndex
                ? "bg-green-500/10 border-green-500 text-green-700"
                : shouldShowResults &&
                  selectedAnswer === index &&
                  index !== question.correctOptionIndex
                ? "bg-red-500/10 border-red-500 text-red-700"
                : shouldShowFeedback && index === question.correctOptionIndex
                ? "bg-green-500/10 border-green-500 text-green-700"
                : shouldShowFeedback &&
                  selectedAnswer === index &&
                  index !== question.correctOptionIndex
                ? "bg-red-500/10 border-red-500 text-red-700"
                : ""
            )}
            disabled={shouldShowResults || shouldShowFeedback}
          >
            <div className="flex items-center justify-between">
              <span>{option}</span>
              {shouldShowResults && index === question.correctOptionIndex && (
                <Check className="w-5 h-5 text-green-600" />
              )}
              {shouldShowResults &&
                selectedAnswer === index &&
                index !== question.correctOptionIndex && (
                  <X className="w-5 h-5 text-red-600" />
                )}
            </div>
          </button>
        ))}
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

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg border border-border">
      {/* Question Header */}
      <div className="space-y-2">
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

      {/* Question Image (if main display mode) */}
      {question.imageUrl && question.imageDisplayMode === "main" && (
        <div className="flex justify-center my-4">
          <img
            src={question.imageUrl}
            alt="Question"
            className={cn(getImageDisplayClasses("main"), "rounded-lg")}
            onError={(e) => {
              console.error("Error loading image:", e);
            }}
          />
        </div>
      )}

      {/* Question Content */}
      <div>
        {isMCQQuestion(question) && renderMCQ()}
        {isTrueFalseQuestion(question) && renderTrueFalse()}
        {isShortAnswerQuestion(question) && renderShortAnswer()}
        {isEssayQuestion(question) && renderEssay()}
      </div>

      {/* Explanation */}
      {question.explanation && (shouldShowResults || shouldShowFeedback) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
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
