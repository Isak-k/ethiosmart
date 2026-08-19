/**
 * GradeEssays Page — educator view for essay grading workflow.
 *
 * Flow:
 *   1. Admin/teacher selects exam + student attempt
 *   2. Page lists all essay questions with student answers
 *   3. For each essay, educator uses EssayGradingPanel to assign marks
 *   4. After grading each essay, attempt score is recomputed and persisted
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeft, Award, FileSearch, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getExam } from '@/lib/firebase-exams';
import { getExamAttempts, getAnswers } from '@/lib/firebase-attempts';
import { Answer, EssayQuestion, Question, isEssayQuestion, isShortAnswerQuestion } from '@/integrations/firebase/types';
import { EssayGradingPanel } from '@/components/admin/EssayGradingPanel';
import {
  GradedEssayPayload,
  gradeEssayAnswerOnline,
  recomputeAndUpdateAttemptScore,
  computeEssayGradingStatus,
} from '@/lib/essay-grading';

interface AttemptOption {
  value: string;
  label: string;
  studentName: string;
  studentEmail: string;
  pendingEssayCount: number;
}

const GradeEssays = () => {
  const { examId: paramExamId, attemptId: paramAttemptId } = useParams<{
    examId?: string;
    attemptId?: string;
  }>();
  const navigate = useNavigate();
  const { user, role, profile } = useAuth();

  const [examTitle, setExamTitle] = useState<string>('');
  const [examId, setExamId] = useState<string>(paramExamId ?? '');
  const [attemptId, setAttemptId] = useState<string>(paramAttemptId ?? '');
  const [attemptOptions, setAttemptOptions] = useState<AttemptOption[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingTotals, setRefreshingTotals] = useState(false);
  const [gradingQuestionId, setGradingQuestionId] = useState<string | null>(null);

  // Load exam title when examId changes
  useEffect(() => {
    if (!examId) return;
    const load = async () => {
      try {
        const exam = await getExam(examId);
        setExamTitle(exam?.title ?? 'Unknown exam');
        setQuestions(exam?.questions ?? []);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load exam');
      }
    };
    load();
  }, [examId]);

  // When examId changes, load submitted attempts for that exam
  useEffect(() => {
    if (!examId) return;
    const loadAttempts = async () => {
      try {
        setLoading(true);
        const attempts = await getExamAttempts(examId);
        const submitted = attempts.filter((a) => a.isSubmitted);
        const opts: AttemptOption[] = await Promise.all(
          submitted.map(async (a) => {
            try {
              const ans = await getAnswers(a.attemptId);
              const status = computeEssayGradingStatus(ans);
              return {
                value: a.attemptId,
                label: `${a.studentName} (${a.studentEmail}) — ${status.pendingEssays} pending`,
                studentName: a.studentName,
                studentEmail: a.studentEmail,
                pendingEssayCount: status.pendingEssays,
              };
            } catch {
              return {
                value: a.attemptId,
                label: `${a.studentName} (${a.studentEmail})`,
                studentName: a.studentName,
                studentEmail: a.studentEmail,
                pendingEssayCount: 0,
              };
            }
          })
        );
        // Prioritize attempts that still have pending essays
        opts.sort((a, b) => b.pendingEssayCount - a.pendingEssayCount);
        setAttemptOptions(opts);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load attempts');
      } finally {
        setLoading(false);
      }
    };
    loadAttempts();
  }, [examId]);

  // When attemptId changes, load answers
  useEffect(() => {
    if (!attemptId) {
      setAnswers([]);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const ans = await getAnswers(attemptId);
        setAnswers(ans);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load answers');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [attemptId]);

  const essayQuestions = useMemo(
    () =>
      questions
        .filter(q => {
          // Include all essay questions
          if (isEssayQuestion(q)) return true;
          // Include short answer questions that need manual grading
          if (isShortAnswerQuestion(q) && q.requiresManualGrading) return true;
          // Also include short answers with no correct answers defined (can't auto-grade)
          if (isShortAnswerQuestion(q) && (!q.correctAnswers || q.correctAnswers.length === 0)) return true;
          return false;
        })
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    [questions]
  );

  const essayStatus = useMemo(() => computeEssayGradingStatus(answers), [answers]);

  const currentStudent = attemptOptions.find((o) => o.value === attemptId);

  // Permission guard: only admin/superadmin or the exam creator can grade essays
  const forbidden = role !== 'admin' && role !== 'superadmin';

  if (forbidden) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl py-20 text-center">
          <Badge variant="outline" className="badge-danger mb-4">
            Forbidden
          </Badge>
          <h1 className="text-2xl font-bold mb-2">Administrator access required</h1>
          <p className="text-muted-foreground mb-6">
            Only educators can grade essays.
          </p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleSubmitGrade = async (
    questionId: string,
    payload: Omit<GradedEssayPayload, 'gradedBy' | 'graderName'>
  ) => {
    if (!attemptId || !user?.uid) return;
    setGradingQuestionId(questionId);
    try {
      await gradeEssayAnswerOnline(attemptId, questionId, {
        ...payload,
        gradedBy: user.uid,
        graderName: profile?.full_name ?? profile?.fullName ?? undefined,
      });

      // reload answers locally so the UI transitions to graded status
      setAnswers((prev) =>
        prev.map((a) =>
          a.questionId === questionId
            ? ({
                ...a,
                rubricScore: payload.rubricScore,
                rubricBreakdown: payload.rubricBreakdown ?? null,
                graderComment: payload.graderComment ?? null,
                answerStatus: 'graded',
                isCorrect: true,
              } as Answer)
            : a
        )
      );
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save grade');
    } finally {
      setGradingQuestionId(null);
    }
  };

  const handleRecomputeTotals = async () => {
    if (!attemptId || questions.length === 0) return;
    setRefreshingTotals(true);
    try {
      const r = await recomputeAndUpdateAttemptScore(attemptId, questions);
      toast.success(
        `Attempt totals updated: ${r.totalScore}/${r.maxScore} (${r.pendingEssayCount} pending essays, ${r.gradedEssayCount} graded)`
      );
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to recompute totals');
    } finally {
      setRefreshingTotals(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to={examId ? `/dashboard/admin/results/${examId}` : '/dashboard/admin/all-results'}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Award className="h-6 w-6 text-amber-600" /> Essay Grading
              </h1>
              <p className="text-muted-foreground text-sm">
                {examTitle || 'Select an exam to begin grading essays.'}
              </p>
            </div>
          </div>

          {attemptId && (
            <Button variant="outline" onClick={handleRecomputeTotals} disabled={refreshingTotals}>
              {refreshingTotals && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <RefreshCw className="h-4 w-4 mr-2" /> Recalculate Total Score
            </Button>
          )}
        </div>

        {/* Selection cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. Exam</CardTitle>
              <CardDescription>Choose exam to list submitted attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={examId}
                onValueChange={(v) => {
                  setExamId(v);
                  setAttemptId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={paramExamId || 'Select exam…'} />
                </SelectTrigger>
                <SelectContent>
                  {/* Use the current param and fallback to exam list via dashboard back navigation */}
                  <SelectItem value={examId || 'current'}>
                    {examTitle || 'Current exam'}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                Tip: Navigate from the{' '}
                <Link className="underline" to="/dashboard/admin/all-results">
                  All Results
                </Link>{' '}
                page and click "Grade Essays" on any exam row.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Student Attempt</CardTitle>
              <CardDescription>
                {essayStatus.anyPending
                  ? `${essayStatus.pendingEssays} essay(s) still need grading`
                  : essayStatus.totalEssays > 0
                  ? `All ${essayStatus.totalEssays} essays graded ✓`
                  : 'No essays in this exam'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={attemptId}
                onValueChange={setAttemptId}
                disabled={!examId || loading || attemptOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !examId
                        ? 'Select an exam first'
                        : attemptOptions.length === 0
                        ? 'No submitted attempts yet'
                        : 'Select a student…'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {attemptOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentStudent && (
                <div className="mt-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Student:</span>{' '}
                    <span className="font-medium">{currentStudent.studentName}</span>
                  </div>
                  <div className="text-muted-foreground">{currentStudent.studentEmail}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Essay list */}
        {attemptId && !loading && (
          <div className="space-y-6">
            {essayQuestions.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <FileSearch className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold">No essay or short answer questions to grade</h3>
                  <p className="text-muted-foreground text-sm">
                    There is nothing to grade here. Add essay or short answer questions to this exam.<br/>
                    <span className="text-xs">Short answers require either: (1) manual grading enabled, or (2) no correct answers defined</span>
                  </p>
                </CardContent>
              </Card>
            ) : (
              essayQuestions.map((eq, idx) => {
                const answer = answers.find((a) => a.questionId === eq.questionId);
                const studentText = (answer as any)?.textAnswer ?? '';
                const isPending = answer?.answerStatus !== 'graded';
                return (
                  <div key={eq.questionId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="badge-primary">
                        {isEssayQuestion(eq) ? 'Essay' : 'Short Answer'} Q{idx + 1} · order {eq.orderIndex ?? idx + 1} · {eq.marks} marks
                      </Badge>
                      <Badge
                        variant="outline"
                        className={isPending ? 'badge-warning' : 'badge-success'}
                      >
                        {isPending ? 'Pending' : 'Graded'}
                      </Badge>
                    </div>
                    <EssayGradingPanel
                      question={{ ...eq, studentName: currentStudent?.studentName }}
                      studentAnswer={studentText}
                      existingRubricScore={answer?.rubricScore}
                      existingBreakdown={(answer as any)?.rubricBreakdown}
                      existingGraderComment={(answer as any)?.graderComment}
                      isPending={isPending}
                      graderId={user?.uid ?? ''}
                      graderName={profile?.full_name ?? profile?.fullName}
                      submitting={gradingQuestionId === eq.questionId}
                      onSubmitGrade={(payload) => handleSubmitGrade(eq.questionId, payload)}
                    />
                  </div>
                );
              })
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GradeEssays;
