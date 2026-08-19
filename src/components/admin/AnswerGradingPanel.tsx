/**
 * Answer Grading Panel — unified manual grading widget for essays and short answers.
 *
 * Supports grading both question types with consistent UI:
 * - Displays the student's answer
 * - Shows word count/length info
 * - Collects score and feedback
 * - Validates and submits grade
 *
 * After grading, calls onGraded() so the parent can recompute totals and refresh.
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
  FileText,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { EssayQuestion, ShortAnswerQuestion } from '@/integrations/firebase/types';
import { getQuestionTypeLabel } from '@/lib/manual-answer-grading';
import { toast } from 'sonner';

export interface AnswerGradingPanelProps {
  /** Question (essay or short answer) */
  question: (EssayQuestion | ShortAnswerQuestion) & { studentName?: string };
  /** Student's text answer */
  studentAnswer: string;
  /** If already graded: the current score (0..question.marks) */
  existingScore?: number;
  /** If already graded: grader feedback */
  existingFeedback?: string;
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
   * onGraded() inside of this callback or resolve to the score
   * returned from the server.
   */
  onSubmitGrade: (data: {
    score: number;
    feedback: string;
  }) => Promise<void> | void;
  /** Optional callback called after a successful grade save (for UI refresh) */
  onGraded?: () => void;
}

const countWords = (text: string): number => {
  const trimmed = text?.trim() ?? '';
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

export function AnswerGradingPanel({
  question,
  studentAnswer,
  existingScore,
  existingFeedback,
  isPending = true,
  graderId,
  graderName,
  submitting = false,
  onSubmitGrade,
  onGraded,
}: AnswerGradingPanelProps) {
  const maxScore = question.marks;
  const wordCount = useMemo(() => countWords(studentAnswer), [studentAnswer]);
  const questionType = getQuestionTypeLabel(question);

  const [score, setScore] = useState<number | ''>(
    typeof existingScore === 'number' ? existingScore : ''
  );
  const [feedback, setFeedback] = useState<string>(existingFeedback ?? '');

  const finalScore: number = score !== '' ? Number(score) : 0;
  const finalScoreClamped = Math.max(0, Math.min(maxScore, finalScore));
  const scorePercent = maxScore > 0 ? (finalScoreClamped / maxScore) * 100 : 0;

  // Word-count warnings for essay grader context
  const isEssay = question.questionType === 'essay';
  const underMin = isEssay && question.questionType === 'essay' 
    ? (question as EssayQuestion).minWords && wordCount < (question as EssayQuestion).minWords
    : false;
  const overMax = isEssay && question.questionType === 'essay' 
    ? (question as EssayQuestion).maxWords && wordCount > (question as EssayQuestion).maxWords
    : false;

  const canSubmit = !submitting && finalScore >= 0 && feedback.trim().length > 0;

  const handleSubmit = async () => {
    if (submitting) return;
    if (finalScoreClamped > maxScore) {
      toast.error(`Score cannot exceed the maximum (${maxScore})`);
      return;
    }
    if (feedback.trim().length === 0) {
      toast.error('Feedback is required');
      return;
    }
    try {
      await onSubmitGrade({
        score: finalScoreClamped,
        feedback: feedback.trim(),
      });
      toast.success(`${questionType} graded — ${finalScoreClamped}/${maxScore} marks awarded`);
      onGraded?.();
    } catch (err) {
      console.error('Grade submit failed:', err);
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
            <CardTitle className="text-lg">{questionType} Grading</CardTitle>
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
                  <AlertTriangle className="h-3 w-3 mr-1" /> Below min {(question as EssayQuestion).minWords}
                </Badge>
              )}
              {overMax && (
                <Badge variant="outline" className="badge-danger">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Exceeds max {(question as EssayQuestion).maxWords}
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

        {/* Score input + progress */}
        <section className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="answer-final-score">
                Score (0–{maxScore})
              </Label>
              <Input
                id="answer-final-score"
                type="number"
                min={0}
                max={maxScore}
                step={0.5}
                placeholder="Enter score…"
                value={score}
                onChange={(e) => {
                  const v = e.target.value;
                  setScore(v === '' ? '' : Number(v));
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

        {/* Feedback */}
        <section className="space-y-1.5">
          <Label htmlFor="answer-feedback">Feedback (visible to student)</Label>
          <Textarea
            id="answer-feedback"
            rows={3}
            placeholder={`Provide constructive feedback on the ${questionType.toLowerCase()} answer...`}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
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

export default AnswerGradingPanel;
