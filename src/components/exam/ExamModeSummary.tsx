/**
 * Exam Mode Summary Component
 * Displays only Correct/Wrong/Skipped after exam submission
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  SkipForward, 
  BarChart3,
  Home,
  RotateCcw
} from 'lucide-react';
import { ExamModeSummary } from '@/lib/exam-mode-engine';

export interface ExamModeSummaryProps {
  summary: ExamModeSummary;
  examTitle?: string;
  studentName?: string;
  onHome?: () => void;
  onRetry?: () => void;
  onReview?: () => void;
  showRetry?: boolean;
  showReview?: boolean;
}

export function ExamModeSummaryDisplay({
  summary,
  examTitle = 'Exam',
  studentName,
  onHome,
  onRetry,
  onReview,
  showRetry = true,
  showReview = false,
}: ExamModeSummaryProps) {
  const passed = summary.passStatus === 'pass';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Exam Complete!</h1>
          {studentName && (
            <p className="text-gray-600">Well done, {studentName}</p>
          )}
          {examTitle && (
            <p className="text-sm text-gray-500">{examTitle}</p>
          )}
        </div>

        {/* Result Status */}
        <Card className={`border-2 ${passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              {passed ? (
                <CheckCircle2 className="h-20 w-20 text-green-600" />
              ) : (
                <XCircle className="h-20 w-20 text-red-600" />
              )}
            </div>

            <div>
              <p className={`text-3xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                {passed ? 'PASSED' : 'FAILED'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Score: {summary.totalScore}/{summary.maxScore} ({summary.percentage}%)
              </p>
            </div>

            {summary.percentage < 50 && (
              <p className="text-sm text-amber-700 bg-amber-100 px-3 py-2 rounded">
                You need {Math.ceil(50 - summary.percentage)}% more to pass
              </p>
            )}
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {/* Correct */}
              <div className="text-center space-y-2 p-3 bg-green-50 rounded-lg">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {summary.correctCount}
                </div>
                <div className="text-xs text-gray-600">Correct</div>
              </div>

              {/* Wrong */}
              <div className="text-center space-y-2 p-3 bg-red-50 rounded-lg">
                <div className="flex justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {summary.incorrectCount}
                </div>
                <div className="text-xs text-gray-600">Wrong</div>
              </div>

              {/* Skipped */}
              <div className="text-center space-y-2 p-3 bg-gray-100 rounded-lg">
                <div className="flex justify-center">
                  <SkipForward className="h-6 w-6 text-gray-600" />
                </div>
                <div className="text-2xl font-bold text-gray-600">
                  {summary.skippedCount}
                </div>
                <div className="text-xs text-gray-600">Skipped</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total Questions</span>
              <Badge variant="outline">{summary.totalQuestions}</Badge>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Time Spent</span>
              <Badge variant="outline">
                {Math.floor(summary.timeSpentSeconds / 60)}m {summary.timeSpentSeconds % 60}s
              </Badge>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Score</span>
              <Badge variant="outline">
                {summary.totalScore}/{summary.maxScore}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Percentage</span>
              <Badge 
                className={passed ? 'bg-green-600' : 'bg-red-600'}
              >
                {summary.percentage}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {showRetry && onRetry && (
            <Button
              onClick={onRetry}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry Exam
            </Button>
          )}

          {showReview && onReview && (
            <Button
              onClick={onReview}
              variant="outline"
              className="w-full"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Review Answers
            </Button>
          )}

          <Button
            onClick={onHome}
            variant="outline"
            className="w-full"
          >
            <Home className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact summary card (for dashboard/results page)
 */
export interface ExamModeSummaryCardProps {
  summary: ExamModeSummary;
  examTitle?: string;
  compact?: boolean;
}

export function ExamModeSummaryCard({
  summary,
  examTitle,
  compact = false,
}: ExamModeSummaryCardProps) {
  const passed = summary.passStatus === 'pass';

  if (compact) {
    return (
      <Card className={`${passed ? 'border-green-200' : 'border-red-200'}`}>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{summary.correctCount}</p>
              <p className="text-xs text-gray-600">Correct</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{summary.incorrectCount}</p>
              <p className="text-xs text-gray-600">Wrong</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{summary.skippedCount}</p>
              <p className="text-xs text-gray-600">Skipped</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                {summary.percentage}%
              </p>
              <p className="text-xs text-gray-600">Score</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{examTitle || 'Exam Result'}</CardTitle>
          </div>
          <Badge variant={passed ? 'default' : 'destructive'}>
            {passed ? 'Passed' : 'Failed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-green-50 rounded">
            <p className="text-2xl font-bold text-green-600">{summary.correctCount}</p>
            <p className="text-xs text-gray-600 mt-1">Correct</p>
          </div>
          <div className="p-3 bg-red-50 rounded">
            <p className="text-2xl font-bold text-red-600">{summary.incorrectCount}</p>
            <p className="text-xs text-gray-600 mt-1">Wrong</p>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-2xl font-bold text-gray-600">{summary.skippedCount}</p>
            <p className="text-xs text-gray-600 mt-1">Skipped</p>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Score</span>
            <span className="font-semibold">{summary.totalScore}/{summary.maxScore}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                passed ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ width: `${summary.percentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {summary.percentage}% - {passed ? 'Passed' : 'Failed'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
