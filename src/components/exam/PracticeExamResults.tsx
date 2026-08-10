/**
 * Practice Exam Results Component
 * Displays results for offline practice exams with instant calculation
 * and per-question review for MCQ, True/False, Short Answer, and Essay types.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PracticeExamResult, getPracticeAnswers } from '@/lib/offline-practice-exam';
import { getOfflineQuestions } from '@/lib/offline-storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  CheckCircle,
  XCircle,
  Clock,
  Award,
  ArrowLeft,
  Download,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PracticeExamResultsProps {
  result: PracticeExamResult;
  examTitle: string;
  attemptId: string;
  onReview?: () => void;
}

function describeAnswer(question: any, answer: any): string {
  if (!question) return '—';
  const type: string = question.questionType ?? 'mcq';
  const selIdx = answer?.selectedOptionIndex;
  const selBool = answer?.selectedBoolean;
  const txt = answer?.textAnswer;

  if (type === 'mcq') {
    if (selIdx === null || selIdx === undefined || selIdx === -1) return 'Skipped';
    const opt = question?.options?.[selIdx];
    return opt ?? `Option ${Number(selIdx) + 1}`;
  }
  if (type === 'true-false') {
    if (selBool === null || selBool === undefined) return 'Skipped';
    return selBool ? 'True' : 'False';
  }
  if (type === 'short-answer' || type === 'essay') {
    if (!txt || String(txt).trim() === '') return 'Skipped';
    return String(txt);
  }
  // fallback
  if (typeof selIdx === 'number' && selIdx >= 0 && question?.options?.[selIdx]) {
    return question.options[selIdx];
  }
  if (typeof selBool === 'boolean') return selBool ? 'True' : 'False';
  if (typeof txt === 'string' && txt.trim() !== '') return txt;
  return 'Skipped';
}

function describeCorrect(question: any): string | null {
  if (!question) return null;
  switch (question.questionType) {
    case 'mcq':
      return question?.options?.[question.correctOptionIndex] ?? null;
    case 'true-false':
      return question.correctAnswer === true ? 'True' : 'False';
    case 'short-answer':
      return (question.correctAnswers ?? []).join('  ·  ') || null;
    case 'essay':
      return null;
    default:
      return null;
  }
}

function questionTypeChip(question: any): { label: string; variant: string } {
  const t = question?.questionType ?? 'mcq';
  if (t === 'mcq') return { label: '📋 MCQ', variant: 'badge-primary' };
  if (t === 'true-false') return { label: '✓/✗ True/False', variant: 'badge-info' };
  if (t === 'short-answer') return { label: '📝 Short Answer', variant: 'badge-secondary' };
  if (t === 'essay') return { label: '📄 Essay', variant: 'badge-warning' };
  return { label: '📋 MCQ', variant: 'badge-primary' };
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

  const essayStatus = useMemo(() => {
    let pending = 0;
    let graded = 0;
    let total = 0;
    for (const q of questions) {
      if (q?.questionType === 'essay') {
        total++;
        const ans = answers.find((a) => a.questionId === q.questionId);
        if (ans?.answerStatus === 'graded') graded++;
        else pending++;
      }
    }
    return { total, pending, graded, anyPending: pending > 0, allGraded: total > 0 && graded === total };
  }, [answers, questions]);

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
    <div className="md:container md:mx-auto w-screen md:w-auto mx-[calc(-50vw+50%)] md:mx-auto space-y-6 px-4">
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
      <Card className={isPassed ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isPassed ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-600" />
                <span className="text-green-600">Excellent! You Passed!</span>
              </>
            ) : (
              <>
                <Award className="w-6 h-6 text-amber-600" />
                <span className="text-amber-600">Keep Practicing!</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Motivational Message */}
          {!isPassed && (
            <p className="text-sm text-amber-700 font-medium">
              Great effort! You're on the right track. Review your answers and practice again to improve your score.
            </p>
          )}

          {/* Essay pending notice */}
          {essayStatus.anyPending && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold">
                  {essayStatus.pending} essay answer{essayStatus.pending === 1 ? '' : 's'} pending manual grading
                </div>
                <div className="text-xs mt-0.5">
                  Your total score will increase after your educator reviews and grades your essay work.
                </div>
              </div>
            </div>
          )}

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

        {/* Skipped Answers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              Skipped Answers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-600">{result.skippedAnswers}</p>
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

        {/* Essay pending */}
        {essayStatus.total > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                Essays
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-700">
                {essayStatus.graded} / {essayStatus.total} graded
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {essayStatus.anyPending ? `${essayStatus.pending} awaiting review` : 'All essays graded'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Answer Review Section */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Answer Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            {answers.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No recorded answers.
              </div>
            ) : (
              <div className="space-y-3">
                {answers.map((answer, index) => {
                  const question = questions.find((q) => q.questionId === answer.questionId);
                  const chip = questionTypeChip(question);
                  const userAns = describeAnswer(question, answer);
                  const correctAnswerText = describeCorrect(question);
                  const isEssay = question?.questionType === 'essay';
                  const isEssayPending = isEssay && answer.answerStatus !== 'graded';
                  const isEssayGraded = isEssay && answer.answerStatus === 'graded';

                  let tint = 'border-slate-200 bg-slate-50';
                  let Icon: any = Clock;
                  let iconTone = 'text-slate-500';

                  if (isEssayPending) {
                    tint = 'border-amber-200 bg-amber-50';
                    Icon = AlertCircle;
                    iconTone = 'text-amber-600';
                  } else if (isEssayGraded) {
                    tint = 'border-indigo-200 bg-indigo-50';
                    Icon = Award;
                    iconTone = 'text-indigo-600';
                  } else if (answer.isCorrect) {
                    tint = 'border-green-200 bg-green-50';
                    Icon = CheckCircle;
                    iconTone = 'text-green-600';
                  } else if (userAns === 'Skipped') {
                    tint = 'border-slate-200 bg-slate-50';
                    Icon = Clock;
                    iconTone = 'text-slate-500';
                  } else {
                    tint = 'border-red-200 bg-red-50';
                    Icon = XCircle;
                    iconTone = 'text-red-600';
                  }

                  return (
                    <div
                      key={`${answer.attemptId}-${answer.questionId}`}
                      className={`p-3 border rounded-lg ${tint}`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconTone}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">Question {index + 1}</p>
                            <Badge variant="outline" className={chip.variant}>
                              {chip.label}
                            </Badge>
                            {question?.marks !== undefined && (
                              <Badge variant="outline" className="badge-secondary">
                                {question.marks} marks
                              </Badge>
                            )}
                            {isEssayPending && (
                              <Badge variant="outline" className="badge-warning">
                                Pending Review
                              </Badge>
                            )}
                            {isEssayGraded && (
                              <Badge variant="outline" className="badge-success">
                                Graded · {answer.rubricScore ?? 0}
                                {question?.marks ? `/${question.marks}` : ''}
                              </Badge>
                            )}
                          </div>
                          {question && (
                            <>
                              <p className="text-sm text-muted-foreground mt-1">
                                {question.questionText}
                              </p>
                              <p className="text-sm mt-2">
                                <span className="font-medium">Your answer:</span>{' '}
                                <span className={isEssay ? 'block rounded border bg-white dark:bg-slate-900 whitespace-pre-wrap p-2 mt-1 text-sm' : ''}>
                                  {userAns}
                                </span>
                              </p>
                              {!isEssay && correctAnswerText !== null && (
                                <p className="text-sm mt-1">
                                  <span className="font-medium">Correct answer:</span>{' '}
                                  {correctAnswerText}
                                </p>
                              )}
                              {isEssayGraded && (
                                <p className="text-sm mt-1 text-indigo-900 dark:text-indigo-200">
                                  <span className="font-medium">Grader comment:</span>{' '}
                                  {answer.graderComment ?? 'No comment provided.'}
                                </p>
                              )}
                              {isEssayPending && (
                                <p className="text-xs mt-2 text-amber-800 dark:text-amber-200">
                                  This essay has been submitted and is awaiting manual grading by your educator.
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
            )}
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
        <Button variant="outline" onClick={handleDownloadResults} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>
    </div>
  );
}
