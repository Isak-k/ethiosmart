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
            Click on questions to expand and see explanations
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
                  <div className="border-t p-4 space-y-4 bg-white">
                    {/* Full Question Text */}
                    <div className="pb-3 border-b">
                      <p className="text-sm font-semibold mb-2">Question:</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{question.questionText}</p>
                    </div>

                    {/* Status Badge & Score */}
                    <div className="flex items-center gap-3 justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            isCorrect
                              ? 'bg-green-600'
                              : isSkipped
                              ? 'bg-gray-500'
                              : 'bg-red-600'
                          }
                        >
                          {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-gray-700">
                        {answer.marks}/{question.marks} marks
                      </p>
                    </div>

                    {/* Answer Details - Dynamic based on question type */}
                    <div>
                      <p className="text-sm font-semibold mb-2">
                        {question.questionType === 'mcq' && 'Your Answer'}
                        {question.questionType === 'true-false' && 'Your Answer'}
                        {question.questionType === 'short-answer' && 'Your Answer'}
                        {question.questionType === 'essay' && 'Your Essay'}
                      </p>
                      
                      {/* MCQ */}
                      {question.questionType === 'mcq' && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold mb-3">Options:</p>
                          {question.options.map((option, optIdx) => {
                            const isSelected = answer.answer === optIdx;
                            const isCorrectOption = optIdx === question.correctOptionIndex;

                            let bgColor = 'bg-slate-50 dark:bg-slate-800';
                            let borderColor = 'border-slate-300 dark:border-slate-600';
                            let textStyle = 'text-slate-700 dark:text-slate-300';

                            if (isCorrectOption) {
                              bgColor = 'bg-green-50 dark:bg-green-900/30';
                              borderColor = 'border-green-500 dark:border-green-600';
                              textStyle = 'text-green-900 dark:text-green-100';
                            } else if (isSelected && !isCorrect) {
                              bgColor = 'bg-red-50 dark:bg-red-900/30';
                              borderColor = 'border-red-500 dark:border-red-600';
                              textStyle = 'text-red-900 dark:text-red-100';
                            } else if (isSelected && isCorrect) {
                              bgColor = 'bg-green-50 dark:bg-green-900/30';
                              borderColor = 'border-green-500 dark:border-green-600';
                              textStyle = 'text-green-900 dark:text-green-100';
                            }

                            return (
                              <div
                                key={optIdx}
                                className={`border-2 rounded-lg p-3 ${bgColor} ${borderColor} transition-all`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 font-semibold text-sm w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-600">
                                    {String.fromCharCode(65 + optIdx)}
                                  </div>
                                  <span className={`flex-1 text-sm font-medium ${textStyle}`}>
                                    {option}
                                  </span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {isSelected && (
                                      <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border-blue-300">
                                        You chose
                                      </Badge>
                                    )}
                                    {isCorrectOption && (
                                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                    )}
                                    {isSelected && !isCorrect && (
                                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* True/False */}
                      {question.questionType === 'true-false' && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold mb-3">Options:</p>
                          {[true, false].map((value) => {
                            const isSelected = answer.answer === value;
                            const isCorrectOption = value === question.correctAnswer;

                            let bgColor = 'bg-slate-50 dark:bg-slate-800';
                            let borderColor = 'border-slate-300 dark:border-slate-600';
                            let textStyle = 'text-slate-700 dark:text-slate-300';

                            if (isCorrectOption) {
                              bgColor = 'bg-green-50 dark:bg-green-900/30';
                              borderColor = 'border-green-500 dark:border-green-600';
                              textStyle = 'text-green-900 dark:text-green-100';
                            } else if (isSelected && !isCorrect) {
                              bgColor = 'bg-red-50 dark:bg-red-900/30';
                              borderColor = 'border-red-500 dark:border-red-600';
                              textStyle = 'text-red-900 dark:text-red-100';
                            } else if (isSelected && isCorrect) {
                              bgColor = 'bg-green-50 dark:bg-green-900/30';
                              borderColor = 'border-green-500 dark:border-green-600';
                              textStyle = 'text-green-900 dark:text-green-100';
                            }

                            return (
                              <div
                                key={String(value)}
                                className={`border-2 rounded-lg p-3 ${bgColor} ${borderColor} transition-all`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`text-sm font-semibold ${textStyle}`}>
                                    {value ? 'True' : 'False'}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {isSelected && (
                                      <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border-blue-300">
                                        You chose
                                      </Badge>
                                    )}
                                    {isCorrectOption && (
                                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    )}
                                    {isSelected && !isCorrect && (
                                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Short Answer */}
                      {question.questionType === 'short-answer' && (
                        <div className="space-y-3">
                          <div className={`border-2 rounded-lg p-3 ${isCorrect ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-600' : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-600'}`}>
                            <p className={`font-semibold text-sm mb-2 ${isCorrect ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                              Your Answer:
                            </p>
                            <p className={`text-sm ${isCorrect ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'} whitespace-pre-wrap`}>
                              {answer.answer || '(No answer provided)'}
                            </p>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-600 rounded-lg p-3">
                            <p className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">
                              Accepted Answers:
                            </p>
                            <ul className="text-sm space-y-1">
                              {question.correctAnswers.map((correctAns, idx) => (
                                <li key={idx} className="text-blue-900 dark:text-blue-200 flex items-start gap-2">
                                  <span className="text-green-600 dark:text-green-400 font-bold">✓</span> {correctAns}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      
                      {/* Essay */}
                      {question.questionType === 'essay' && (
                        <div className="space-y-3">
                          <div className="border-2 border-blue-300 dark:border-blue-600 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/30">
                            <p className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">Your Essay:</p>
                            <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">
                              {answer.answer || '(No essay submitted)'}
                            </p>
                          </div>
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600 rounded-lg">
                            <p className="text-sm text-amber-900 dark:text-amber-100">
                              <span className="font-semibold">Note:</span> Essays require manual grading by your instructor
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Feedback */}
                    {answer.feedback && !isSkipped && (
                      <div className={`p-3 rounded-lg border-l-4 ${
                        isCorrect
                          ? 'bg-green-50 dark:bg-green-900/30 border-l-green-500 dark:border-l-green-400'
                          : 'bg-red-50 dark:bg-red-900/30 border-l-red-500 dark:border-l-red-400'
                      }`}>
                        <p className={`text-sm font-semibold mb-1 ${isCorrect ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                          Feedback:
                        </p>
                        <p className={`text-sm ${isCorrect ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                          {answer.feedback}
                        </p>
                      </div>
                    )}

                    {/* Explanation */}
                    {answer.explanation && !isSkipped && (
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500 dark:border-l-blue-400">
                        <p className="text-sm font-semibold mb-1 text-blue-900 dark:text-blue-100">
                          Explanation:
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">
                          {answer.explanation}
                        </p>
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
