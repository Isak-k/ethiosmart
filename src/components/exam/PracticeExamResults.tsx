/**
 * Practice Exam Results Component
 * Displays results for offline practice exams with instant calculation
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PracticeExamResult, getPracticeAnswers } from '@/lib/offline-practice-exam';
import { getOfflineQuestions } from '@/lib/offline-storage';
import { getQuestions } from '@/lib/firebase-exams';
import { getAnswers } from '@/lib/firebase-attempts';
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
  Lightbulb,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QuestionImageDisplay } from "@/components/exam/QuestionImageDisplay";

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
        let practiceAnswers = await getPracticeAnswers(attemptId);
        if (!practiceAnswers || practiceAnswers.length === 0) {
          try {
            const fbAnswers = await getAnswers(attemptId);
            practiceAnswers = fbAnswers as any[];
          } catch (e) {
            console.warn('Could not fetch practice answers from Firebase:', e);
          }
        }
        setAnswers(practiceAnswers || []);

        let loadedQuestions = await getOfflineQuestions(result.examId);
        if (!loadedQuestions || loadedQuestions.length === 0) {
          try {
            loadedQuestions = await getQuestions(result.examId);
          } catch (e) {
            console.warn('Could not fetch questions from Firebase:', e);
          }
        }
        setQuestions(loadedQuestions || []);

        setLoading(false);
      } catch (error) {
        console.error('Error loading review data:', error);
        setLoading(false);
      }
    };

    loadReviewData();
  }, [attemptId, result.examId]);

  const getUserAnswerText = (ans: any, q: any): string => {
    if (ans?.studentAnswer && String(ans.studentAnswer).trim().length > 0) {
      return String(ans.studentAnswer).trim();
    }
    const optIdx = typeof ans?.selectedOptionIndex === 'number'
      ? ans.selectedOptionIndex
      : typeof ans?.selectedOption === 'number'
      ? ans.selectedOption
      : null;

    if (optIdx !== null && optIdx >= 0 && q?.options && q.options[optIdx]) {
      return q.options[optIdx];
    }
    if (optIdx !== null && optIdx >= 0) {
      return `Option ${String.fromCharCode(65 + optIdx)}`;
    }
    return 'No answer provided / Skipped';
  };

  const getCorrectAnswerText = (q: any): string => {
    if (!q) return 'Not available';
    if (q.options && typeof q.correctOptionIndex === 'number' && q.options[q.correctOptionIndex]) {
      return q.options[q.correctOptionIndex];
    }
    if (q.correctAnswer && String(q.correctAnswer).trim().length > 0) {
      return String(q.correctAnswer).trim();
    }
    if (typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0) {
      return `Option ${String.fromCharCode(65 + q.correctOptionIndex)}`;
    }
    return 'Not specified';
  };

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
        ['Skipped Answers', result.skippedAnswers],
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
    <div className="w-full space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 sm:px-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-center truncate max-w-[70%] text-foreground">{examTitle}</h1>
        <div className="w-16" /> {/* Spacer for alignment */}
      </div>

      {/* Result Summary Card (Edge-to-edge on mobile for clean reading) */}
      <Card className={`rounded-none sm:rounded-2xl border-x-0 sm:border shadow-none sm:shadow-sm ${
        isPassed
          ? 'border-emerald-500/30 bg-emerald-500/10 text-foreground dark:bg-emerald-950/20'
          : 'border-amber-500/30 bg-amber-500/10 text-foreground dark:bg-amber-950/20'
      }`}>
        <CardHeader className="px-3.5 sm:px-6 pt-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-display font-bold">
            {isPassed ? (
              <>
                <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-emerald-700 dark:text-emerald-400">Excellent! You Passed!</span>
              </>
            ) : (
              <>
                <Award className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-amber-700 dark:text-amber-400">Keep Practicing!</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-3.5 sm:px-6 pb-5">
          {/* Motivational Message */}
          {!isPassed && (
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400/90 font-medium">
              Great effort! You're on the right track. Review your answers and practice again to improve your score.
            </p>
          )}
          
          {/* Score Display */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Score</p>
              <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                {result.totalScore}/{result.maxScore}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Percentage</p>
              <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">{result.percentage.toFixed(1)}%</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <Progress value={result.percentage} className="h-2 rounded-full" />
          </div>

          {/* Passing Threshold */}
          <p className="text-xs sm:text-sm text-muted-foreground">
            Passing threshold: <span className="font-semibold text-foreground">{passPercentage}%</span>
          </p>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="px-3.5 sm:px-0 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Correct Answers */}
        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              Correct
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-xl sm:text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">{result.correctAnswers}</p>
          </CardContent>
        </Card>

        {/* Incorrect Answers */}
        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              Incorrect
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-xl sm:text-2xl font-bold font-display text-rose-600 dark:text-rose-400">{result.incorrectAnswers}</p>
          </CardContent>
        </Card>

        {/* Skipped Answers */}
        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              Skipped
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-xl sm:text-2xl font-bold font-display text-slate-600 dark:text-slate-400">{result.skippedAnswers}</p>
          </CardContent>
        </Card>

        {/* Time Spent */}
        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              Time Spent
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-xl sm:text-2xl font-bold font-display text-primary">
              {formatTime(result.timeSpentSeconds)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Answer Review Section (Reaches edge of screen on mobile for optimal reading) */}
      {!loading && (questions.length > 0 || answers.length > 0) && (
        <Card className="rounded-none sm:rounded-2xl border-x-0 sm:border shadow-none sm:shadow-sm bg-card">
          <CardHeader className="px-3.5 sm:px-6 pt-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-display font-bold">
              <Award className="w-5 h-5 text-primary" />
              Answer Review
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6 pb-6">
            <div className="space-y-3 sm:space-y-4">
              {(questions.length > 0
                ? questions.map((q, idx) => ({
                    question: q,
                    answer: answers.find((a) => a.questionId === q.questionId),
                    index: idx,
                  }))
                : answers.map((a, idx) => ({
                    question: questions.find((q) => q.questionId === a.questionId),
                    answer: a,
                    index: idx,
                  }))
              ).map(({ question, answer, index }) => {
                const isCorrect = Boolean(answer?.isCorrect);
                const userAnswer = getUserAnswerText(answer, question);
                const correctAnswer = getCorrectAnswerText(question);

                return (
                  <div
                    key={`${answer?.attemptId || attemptId}-${question?.questionId || index}`}
                    className={`border-y sm:border sm:rounded-2xl p-3.5 sm:p-5 transition-all ${
                      isCorrect
                        ? 'border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-950/20'
                        : 'border-rose-500/25 bg-rose-500/5 dark:bg-rose-950/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-xs sm:text-sm uppercase tracking-wide text-foreground">
                            Question {index + 1}
                          </p>
                          {isCorrect ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              ✓ Correct
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              ✗ Incorrect
                            </span>
                          )}
                        </div>

                        {question && (
                          <>
                            <p className="text-sm sm:text-base font-medium leading-relaxed text-foreground">
                              {question.questionText}
                            </p>
                            {question.imageUrl && (
                              <QuestionImageDisplay
                                imageUrl={question.imageUrl}
                                alt={`Question ${index + 1} illustration`}
                                maxHeightClass="max-h-56"
                              />
                            )}
                            <div className="mt-3 pt-2.5 border-t border-border/60 space-y-2 text-xs sm:text-sm">
                              <p className="flex flex-wrap items-baseline gap-1.5">
                                <span className="font-semibold text-muted-foreground">Your answer:</span>{' '}
                                <span className={isCorrect ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                                  {userAnswer}
                                </span>
                              </p>
                              <p className="flex flex-wrap items-baseline gap-1.5">
                                <span className="font-semibold text-muted-foreground">Correct answer:</span>{' '}
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                  {correctAnswer}
                                </span>
                              </p>
                              {question.explanation && (
                                <div className="mt-3.5 p-4 sm:p-5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/30 text-base sm:text-lg text-foreground leading-relaxed sm:leading-8 shadow-sm">
                                  <div className="flex items-center gap-2 mb-2 font-semibold text-amber-900 dark:text-amber-200 text-sm sm:text-base">
                                    <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    <span>Explanation</span>
                                  </div>
                                  <div className="whitespace-pre-wrap font-normal">
                                    {question.explanation}
                                  </div>
                                </div>
                              )}
                            </div>
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
          onClick={() => navigate('/dashboard/exams')}
          className="flex-1"
        >
          Back to Exams
        </Button>
      </div>
    </div>
  );
}
