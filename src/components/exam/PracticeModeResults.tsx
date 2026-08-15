/**
 * Practice Mode Results Component
 * Shows detailed results with instant feedback, explanations, and answer review
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Home,
  RotateCcw,
  Download,
} from 'lucide-react';
import { PracticeModeResult } from '@/lib/practice-mode-engine';
import { Question } from '@/integrations/firebase/types';

export interface PracticeModeResultsProps {
  result: PracticeModeResult;
  questions: Question[];
  examTitle?: string;
  studentName?: string;
  onHome?: () => void;
  onRetry?: () => void;
  onExportPDF?: () => void;
  showExport?: boolean;
}

export function PracticeModeResults({
  result,
  questions,
  examTitle = 'Practice Exam',
  studentName,
  onHome,
  onRetry,
  onExportPDF,
  showExport = true,
}: PracticeModeResultsProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const toggleQuestionExpanded = (questionId: string) => {
    const newSet = new Set(expandedQuestions);
    if (newSet.has(questionId)) {
      newSet.delete(questionId);
    } else {
      newSet.add(questionId);
    }
    setExpandedQuestions(newSet);
  };

  const passed = result.passStatus === 'pass';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <h1 className="text-3xl font-bold mb-2">Practice Results</h1>
        <p className="text-gray-600">{examTitle}</p>
        {studentName && <p className="text-sm text-gray-500">{studentName}</p>}
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Score */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {result.totalScore}/{result.maxScore}
            </div>
            <p className="text-xs text-gray-500 mt-1">{result.percentage}%</p>
          </CardContent>
        </Card>

        {/* Correct */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-600">Correct</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {result.correctCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">Out of {result.answers.length}</p>
          </CardContent>
        </Card>

        {/* Incorrect */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-600">Incorrect</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {result.incorrectCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">Review these</p>
          </CardContent>
        </Card>

        {/* Status */}
        <Card className={passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={passed ? 'bg-green-600' : 'bg-red-600'}>
              {passed ? 'PASSED' : 'FAILED'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Review */}
      <Card>
        <CardHeader>
          <CardTitle>Review Your Answers</CardTitle>
          <CardDescription>
            Click on questions to see what you chose, correct answer, and explanation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.answers.map((answer, idx) => {
            const question = questions.find((q) => q.questionId === answer.questionId);
            if (!question) return null;

            const isExpanded = expandedQuestions.has(answer.questionId);
            const isCorrect = answer.isCorrect;
            const isSkipped = answer.answer === null || answer.answer === undefined;

            return (
              <div
                key={answer.questionId}
                className={`border rounded-lg overflow-hidden transition-all ${
                  isCorrect ? 'border-green-200' : isSkipped ? 'border-gray-200' : 'border-red-200'
                }`}
              >
                {/* Question Header */}
                <button
                  onClick={() => toggleQuestionExpanded(answer.questionId)}
                  className={`w-full p-4 flex items-start justify-between text-left ${
                    isCorrect
                      ? 'bg-green-50 hover:bg-green-100'
                      : isSkipped
                      ? 'bg-gray-50 hover:bg-gray-100'
                      : 'bg-red-50 hover:bg-red-100'
                  } transition-colors`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex-shrink-0 pt-1">
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : isSkipped ? (
                        <SkipForward className="h-5 w-5 text-gray-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Question {idx + 1}</p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {question.questionText}
                      </p>
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 flex-shrink-0 ml-2" />
                  ) : (
                    <ChevronDown className="h-5 w-5 flex-shrink-0 ml-2" />
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className={`border-t p-4 space-y-3 ${
                    isCorrect 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' 
                      : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20'
                  }`}>
                    {/* Question */}
                    <div className="flex flex-wrap gap-2 items-start">
                      <span className={`text-sm font-bold ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        Question:
                      </span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">{question.questionText}</span>
                    </div>

                    {/* You chose */}
                    <div className="flex flex-wrap gap-2 items-start">
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-300">You chose:</span>
                      {question.questionType === 'mcq' && (
                        <span className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                          {answer.answer !== null && answer.answer !== undefined
                            ? question.options[(answer.answer as number)]
                            : 'Skipped'}
                        </span>
                      )}
                      {question.questionType === 'true-false' && (
                        <span className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                          {answer.answer !== null && answer.answer !== undefined
                            ? (answer.answer as boolean)
                              ? 'True'
                              : 'False'
                            : 'Skipped'}
                        </span>
                      )}
                      {(question.questionType === 'short-answer' || question.questionType === 'essay') && (
                        <span className="text-sm text-blue-900 dark:text-blue-100 font-medium truncate">
                          {answer.answer || 'Skipped'}
                        </span>
                      )}
                    </div>

                    {/* Correct answer */}
                    {!isSkipped && (
                      <div className="flex flex-wrap gap-2 items-start">
                        <span className="text-sm font-bold text-green-700 dark:text-green-300">✓ Correct answer:</span>
                        {question.questionType === 'mcq' && (
                          <span className="text-sm text-green-900 dark:text-green-100 font-medium">
                            {question.options[question.correctOptionIndex]}
                          </span>
                        )}
                        {question.questionType === 'true-false' && (
                          <span className="text-sm text-green-900 dark:text-green-100 font-medium">
                            {question.correctAnswer ? 'True' : 'False'}
                          </span>
                        )}
                        {question.questionType === 'short-answer' && (
                          <span className="text-sm text-green-900 dark:text-green-100 font-medium">
                            {question.correctAnswers.join(' / ')}
                          </span>
                        )}
                        {question.questionType === 'essay' && (
                          <span className="text-sm text-green-700 dark:text-green-300 italic font-medium">
                            Awaiting manual grading
                          </span>
                        )}
                      </div>
                    )}

                    {/* Explanation */}
                    {answer.explanation && !isSkipped && (
                      <div className="flex flex-wrap gap-2 items-start">
                        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">💡 Explanation:</span>
                        <span className="text-sm text-indigo-900 dark:text-indigo-100">{answer.explanation}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        {onExportPDF && showExport && (
          <Button variant="outline" onClick={onExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        )}

        {onRetry && (
          <Button onClick={onRetry} className="bg-blue-600 hover:bg-blue-700">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retake Practice
          </Button>
        )}

        <Button onClick={onHome} variant="outline" className="ml-auto">
          <Home className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
