/**
 * Practice Exam Results Component
 * Displays results for offline practice exams with instant calculation
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PracticeExamResult, getPracticeAnswers } from '@/lib/offline-practice-exam';
import { getOfflineQuestions } from '@/lib/offline-storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
  CheckCircle,
  XCircle,
  Clock,
  Award,
  ArrowLeft,
  Download,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PracticeExamResultsProps {
  result: PracticeExamResult;
  examTitle: string;
  attemptId: string;
  onReview?: () => void;
}

export function PracticeExamResults({
  result,
  examTitle,
  attemptId,
  onReview,
}: PracticeExamResultsProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReviewData = async () => {
      try {
        const practiceAnswers = await getPracticeAnswers(attemptId);
        setAnswers(practiceAnswers);

        const offlineQuestions = await getOfflineQuestions(result.examId);
        setQuestions(offlineQuestions);

        setLoading(false);
      } catch (error) {
        console.error('Error loading review data:', error);
        setLoading(false);
      }
    };

    loadReviewData();
  }, [attemptId, result.examId]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const handleDownloadResults = () => {
    try {
      const resultsData = {
        examTitle,
        attemptId,
        submittedAt: new Date(result.submittedAt).toLocaleString(),
        totalScore: result.totalScore,
        maxScore: result.maxScore,
        percentage: result.percentage.toFixed(2),
        passStatus: result.passStatus,
        correctAnswers: result.correctAnswers,
        incorrectAnswers: result.incorrectAnswers,
        timeSpent: formatTime(result.timeSpentSeconds),
      };

      const csvContent = [
        ['Exam Results'],
        ['Exam Title', examTitle],
        ['Attempt ID', attemptId],
        ['Submitted At', new Date(result.submittedAt).toLocaleString()],
        [''],
        ['Score', `${result.totalScore}/${result.maxScore}`],
        ['Percentage', `${result.percentage.toFixed(2)}%`],
        ['Status', result.passStatus.toUpperCase()],
        [''],
        ['Correct Answers', result.correctAnswers],
        ['Incorrect Answers', result.incorrectAnswers],
        ['Time Spent', formatTime(result.timeSpentSeconds)],
      ]
        .map((row) => row.join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-results-${attemptId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Downloaded',
        description: 'Results downloaded successfully',
      });
    } catch (error) {
      console.error('Error downloading results:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download results',
        variant: 'destructive',
      });
    }
  };

  const passPercentage = 50; // Default passing percentage
  const isPassed = result.percentage >= passPercentage;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">{examTitle}</h1>
        <div className="w-20" /> {/* Spacer for alignment */}
      </div>

      {/* Result Summary Card */}
      <Card className={isPassed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isPassed ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-600" />
                <span className="text-green-600">Passed</span>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-600" />
                <span className="text-red-600">Failed</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score Display */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Score</p>
              <p className="text-3xl font-bold">
                {result.totalScore}/{result.maxScore}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Percentage</p>
              <p className="text-3xl font-bold">{result.percentage.toFixed(1)}%</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <Progress value={result.percentage} className="h-2" />
          </div>

          {/* Passing Threshold */}
          <p className="text-sm text-muted-foreground">
            Passing threshold: {passPercentage}%
          </p>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Correct Answers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Correct Answers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{result.correctAnswers}</p>
          </CardContent>
        </Card>

        {/* Incorrect Answers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              Incorrect Answers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{result.incorrectAnswers}</p>
          </CardContent>
        </Card>

        {/* Time Spent */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Time Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {formatTime(result.timeSpentSeconds)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Answer Review Section */}
      {!loading && answers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Answer Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {answers.map((answer, index) => {
                const question = questions.find((q) => q.questionId === answer.questionId);
                return (
                  <div
                    key={`${answer.attemptId}-${answer.questionId}`}
                    className={`p-3 border rounded-lg ${
                      answer.isCorrect
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {answer.isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">Question {index + 1}</p>
                        {question && (
                          <>
                            <p className="text-sm text-muted-foreground mt-1">
                              {question.questionText}
                            </p>
                            <p className="text-sm mt-2">
                              <span className="font-medium">Your answer:</span>{' '}
                              {question.options[answer.selectedOptionIndex]}
                            </p>
                            {!answer.isCorrect && (
                              <p className="text-sm mt-1">
                                <span className="font-medium">Correct answer:</span>{' '}
                                {question.options[question.correctOptionIndex]}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleDownloadResults}
          variant="outline"
          className="flex-1"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Results
        </Button>
        <Button
          onClick={() => navigate('/dashboard/exams')}
          className="flex-1"
        >
          Back to Exams
        </Button>
      </div>
    </div>
  );
}
