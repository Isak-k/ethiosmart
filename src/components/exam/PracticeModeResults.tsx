/**
 * Practice Mode Results Component
 * Shows detailed results with instant feedback, explanations, and answer review
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Home,
  RotateCcw,
  Download,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import { PracticeModeResult, PracticeModeAnswer } from '@/lib/practice-mode-engine';
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
            Click on questions to expand and see explanations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.answers.map((answer, idx) => {
            const question = questions.find((q) => q.questionId === answer.questionId);
            if (!question) return null;

            const isExpanded = expandedQuestions.has(answer.questionId);
            const isCorrect = answer.isCorrect;
            const isSkipped = answer.selectedOptionIndex === null || answer.selectedOptionIndex === undefined;

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
                  <div className="border-t p-4 space-y-3 bg-white">
                    {/* Status Message */}
                    <div>
                      <p className="text-sm font-semibold">
                        {isCorrect
                          ? '✓ Correct'
                          : isSkipped
                          ? '- Skipped'
                          : '✗ Incorrect'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {answer.feedback}
                      </p>
                    </div>

                    {/* Score */}
                    <div>
                      <p className="text-sm font-semibold">Score</p>
                      <p className="text-sm text-gray-600">
                        {answer.marks}/{question.marks} marks
                      </p>
                    </div>

                    {/* Options / Answer */}
                    {question.options && question.options.length > 0 ? (
                      <div>
                        <p className="text-sm font-semibold mb-2">Options</p>
                        <div className="space-y-2">
                          {question.options.map((option, optIdx) => {
                            const isSelected = answer.selectedOptionIndex === optIdx;
                            const isCorrectOption = optIdx === question.correctOptionIndex;

                            let bgColor = 'bg-gray-50';
                            let borderColor = 'border-gray-200';

                            if (isCorrectOption) {
                              bgColor = 'bg-green-50';
                              borderColor = 'border-green-200';
                            } else if (isSelected && !isCorrect) {
                              bgColor = 'bg-red-50';
                              borderColor = 'border-red-200';
                            }

                            return (
                              <div
                                key={optIdx}
                                className={`border-2 rounded p-2 text-sm ${bgColor} ${borderColor}`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-shrink-0 pt-0.5">
                                    {isCorrectOption && (
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    )}
                                    {isSelected && !isCorrect && (
                                      <XCircle className="h-4 w-4 text-red-600" />
                                    )}
                                    {!isCorrectOption && !isSelected && (
                                      <div className="h-4 w-4 rounded-full border border-gray-300" />
                                    )}
                                  </div>
                                  <span className="flex-1">{option}</span>
                                  {isSelected && isCorrectOption && (
                                    <Badge className="text-xs bg-green-600">
                                      Your Answer (Correct)
                                    </Badge>
                                  )}
                                  {!isSelected && isCorrectOption && (
                                    <Badge className="text-xs bg-green-600">
                                      Correct Answer
                                    </Badge>
                                  )}
                                  {isSelected && !isCorrectOption && (
                                    <Badge variant="destructive" className="text-xs">
                                      Your Answer
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 p-3 bg-gray-50 rounded border">
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Your Answer:</p>
                          <p className="text-sm font-medium">{answer.studentAnswer || 'No answer provided / Skipped'}</p>
                        </div>
                        {question.correctAnswer && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-semibold text-green-700">Correct Answer:</p>
                            <p className="text-sm font-medium text-green-800">{question.correctAnswer}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Explanation */}
                    {answer.explanation && (
                      <div className="mt-3.5 p-4 sm:p-5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/30 text-base sm:text-lg text-foreground leading-relaxed sm:leading-8 shadow-sm">
                        <div className="flex items-center gap-2 mb-2 font-semibold text-amber-900 dark:text-amber-200 text-sm sm:text-base">
                          <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <span>Explanation</span>
                        </div>
                        <p className="whitespace-pre-wrap font-normal">{answer.explanation}</p>
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
