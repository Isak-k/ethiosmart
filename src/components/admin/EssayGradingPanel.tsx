/**
 * EssayGradingPanel — manual essay grading widget for educators.
 *
 * Shows the student's essay answer, displays the rubric (if any) with per-criteria
 * score inputs, records grader comment, and submits the final grade via
 * `gradeEssayAnswerOnline` or `gradeOfflinePracticeEssay`.
 *
 * After grading, call `onGraded` so the parent can recompute totals and refresh.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap,
  CheckCircle2,
  Loader2,
  Award,
  FileText,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { EssayQuestion } from '@/integrations/firebase/types';
import { RubricGrading } from '@/lib/essay-grading';
import { toast } from 'sonner';

export interface EssayGradingPanelProps {
  /** Essay question with rubric, min/max words */
  question: EssayQuestion & { studentName?: string };
  /** Student's text answer */
  studentAnswer: string;
  /** If already graded: the current rubric score awarded for this answer (0..question.marks) */
  existingRubricScore?: number;
  /** If already graded: per-criteria breakdown */
  existingBreakdown?: RubricGrading[];
  /** If already graded: grader comment */
  existingGraderComment?: string;
  /** True if answer is awaiting manual grading (default: true) */
  isPending?: boolean;
  /** Identity of the grader (user id) */
  graderId: string;
  /** Display name of the grader (optional) */
  graderName?: string;
  /** Set true when the parent's loading state indicates saving */
  submitting?: boolean;
  /**
   * Called when the grader clicks "Submit Grade".
   * Parent should write to backend (Firebase / IndexedDB) and then call
   * either onGraded() inside of this callback or resolve to the score
   * returned from the server.
   */
  onSubmitGrade: (data: {
    rubricScore: number;
    rubricBreakdown: RubricGrading[];
    graderComment: string;
  }) => Promise<void> | void;
  /** Optional callback called after a successful grade save (for UI refresh) */
  onGraded?: () => void;
}

const countWords = (text: string): number => {
  const trimmed = text?.trim() ?? '';
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

export function EssayGradingPanel({
  question,
  studentAnswer,
  existingRubricScore,
  existingBreakdown,
  existingGraderComment,
  isPending = true,
  graderId,
  graderName,
  submitting = false,
  onSubmitGrade,
  onGraded,
}: EssayGradingPanelProps) {
  const maxScore = question.marks;
  const wordCount = useMemo(() => countWords(studentAnswer), [studentAnswer]);

  const initialBreakdown: RubricGrading[] =
    existingBreakdown && existingBreakdown.length > 0
      ? existingBreakdown
      : (question.rubricPoints ?? []).map((rp) => ({
          criteria: rp.criteria,
          maxPoints: rp.points,
          awardedPoints: 0,
        }));

  const [breakdown, setBreakdown] = useState<RubricGrading[]>(initialBreakdown);
  const [overrideScore, setOverrideScore] = useState<number | ''>(
    typeof existingRubricScore === 'number' ? existingRubricScore : ''
  );
  const [comment, setComment] = useState<string>(existingGraderComment ?? '');

  // Computed total when rubric exists, otherwise fall back to override
  const rubricTotal = breakdown.reduce((sum, b) => sum + (Number(b.awardedPoints) || 0), 0);
  const rubricMax = breakdown.reduce((sum, b) => sum + (Number(b.maxPoints) || 0), 0);

  const finalScore: number =
    overrideScore !== '' ? Number(overrideScore) : breakdown.length > 0 ? rubricTotal : 0;

  const finalScoreClamped = Math.max(0, Math.min(maxScore, finalScore));
  const scorePercent = maxScore > 0 ? (finalScoreClamped / maxScore) * 100 : 0;

  // Word-count warnings for grader context
  const underMin = question.minWords ? wordCount < question.minWords : false;
  const overMax = question.maxWords ? wordCount > question.maxWords : false;

  const canSubmit =
    !submitting && (finalScoreClamped > 0 || comment.trim().length > 0 || breakdown.length > 0);

  const updateCriterion = (idx: number, field: 'awardedPoints' | 'comment', value: string) => {
    setBreakdown((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        if (field === 'awardedPoints') {
          const parsed = Number(value);
          return {
            ...row,
            awardedPoints: Number.isFinite(parsed)
              ? Math.max(0, Math.min(row.maxPoints, parsed))
              : 0,
          };
        }
        return { ...row, comment: value };
      })
    );
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (finalScoreClamped > maxScore) {
      toast.error(`Score cannot exceed the maximum (${maxScore})`);
      return;
    }
    try {
      await onSubmitGrade({
        rubricScore: finalScoreClamped,
        rubricBreakdown: breakdown,
        graderComment: comment.trim(),
      });
      toast.success(`Essay graded — ${finalScoreClamped}/${maxScore} marks awarded`);
      onGraded?.();
    } catch (err) {
      console.error('Essay grade submit failed:', err);
      toast.error('Failed to submit grade. Please try again.');
    }
  };

  const badgeVariant = isPending
    ? 'outline badge-warning'
    : 'outline badge-success';

  return (
    <Card className="border-amber-200 dark:border-amber-800/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-lg">Essay Grading</CardTitle>
            <Badge variant="outline" className={badgeVariant}>
              {isPending ? (
                <>
                  <Clock className="h-3 w-3 mr-1" /> Pending Review
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Graded
                </>
              )}
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Max score</div>
            <div className="text-2xl font-bold">
              <span className={finalScoreClamped >= maxScore * 0.5 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                {finalScoreClamped}
              </span>
              <span className="text-muted-foreground text-lg">/{maxScore}</span>
            </div>
          </div>
        </div>
        <CardDescription>
          <strong>Q:</strong> {question.questionText}
          {question.studentName && (
            <span className="ml-3 text-xs">
              by <span className="font-medium">{question.studentName}</span>
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Student answer card */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <FileText className="h-4 w-4" /> Student Answer
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {wordCount} word{wordCount === 1 ? '' : 's'}
              </span>
              {underMin && (
                <Badge variant="outline" className="badge-warning">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Below min {question.minWords}
                </Badge>
              )}
              {overMax && (
                <Badge variant="outline" className="badge-danger">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Exceeds max {question.maxWords}
                </Badge>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {studentAnswer?.trim() ? (
              studentAnswer
            ) : (
              <p className="text-muted-foreground italic">Student did not provide an answer.</p>
            )}
          </div>
        </section>

        {/* Rubric scoring table */}
        {breakdown.length > 0 && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Award className="h-4 w-4" /> Rubric
            </h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Criteria</th>
                    <th className="px-3 py-2 text-right font-medium max-w-[180px]">
                      Awarded
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row, idx) => (
                    <tr key={`${row.criteria}-${idx}`} className="border-t">
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium">{row.criteria}</div>
                        {row.comment !== undefined && (
                          <Input
                            type="text"
                            className="mt-1 h-8 text-xs"
                            placeholder="Comment (optional)"
                            value={row.comment ?? ''}
                            onChange={(e) => updateCriterion(idx, 'comment', e.target.value)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={row.maxPoints}
                            step={0.5}
                            className="w-24 text-right"
                            value={row.awardedPoints}
                            onChange={(e) => updateCriterion(idx, 'awardedPoints', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right text-muted-foreground">
                        {row.maxPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/40 font-medium">
                  <tr>
                    <td className="px-3 py-2 text-right">Rubric Total</td>
                    <td className="px-3 py-2 text-right">{rubricTotal}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{rubricMax || maxScore}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* Total / override + progress */}
        <section className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="essay-final-score">
                Final Score (0–{maxScore})
                {breakdown.length > 0 && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (auto: {rubricTotal} — override below)
                  </span>
                )}
              </Label>
              <Input
                id="essay-final-score"
                type="number"
                min={0}
                max={maxScore}
                step={0.5}
                placeholder={breakdown.length > 0 ? String(rubricTotal) : 'Enter score…'}
                value={overrideScore}
                onChange={(e) => {
                  const v = e.target.value;
                  setOverrideScore(v === '' ? '' : Number(v));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">
                Score: {finalScoreClamped}/{maxScore} ({Math.round(scorePercent)}%)
              </Label>
              <Progress value={scorePercent} className="h-2 mt-2" />
            </div>
          </div>
        </section>

        {/* Grader comment */}
        <section className="space-y-1.5">
          <Label htmlFor="grader-comment">Grader Comment (visible to student)</Label>
          <Textarea
            id="grader-comment"
            rows={3}
            placeholder="Provide feedback on content, structure, clarity, etc."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </section>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="default"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="min-w-[160px]"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isPending ? 'Submit Grade' : 'Update Grade'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default EssayGradingPanel;
