/**
 * Practice Exam Results Page
 * Displays results for offline practice exams
 */

import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PracticeExamResults } from '@/components/exam/PracticeExamResults';
import { getPracticeAttempt } from '@/lib/offline-practice-exam';
import { Loader2 } from 'lucide-react';

export function PracticeExamResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAttempt = async () => {
      if (!attemptId) {
        setError('Attempt ID not found');
        setLoading(false);
        return;
      }

      try {
        const practiceAttempt = await getPracticeAttempt(attemptId);
        
        if (!practiceAttempt) {
          setError('Practice attempt not found');
          setLoading(false);
          return;
        }

        setAttempt(practiceAttempt);
        setLoading(false);
      } catch (err) {
        console.error('Error loading practice attempt:', err);
        setError('Failed to load practice attempt');
        setLoading(false);
      }
    };

    loadAttempt();
  }, [attemptId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading results...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !attempt) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Error</h1>
            <p className="text-muted-foreground">{error || 'Failed to load results'}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Use result from location state if available, otherwise construct from attempt
  const result = location.state?.result || {
    attemptId: attempt.attemptId,
    examId: attempt.examId,
    totalScore: attempt.totalScore || 0,
    maxScore: attempt.maxScore || 0,
    correctAnswers: attempt.correctAnswers || 0,
    incorrectAnswers: attempt.incorrectAnswers || 0,
    percentage: attempt.percentage || 0,
    passStatus: attempt.passStatus || 'fail',
    timeSpentSeconds: attempt.timeSpentSeconds || 0,
    submittedAt: attempt.submittedAt || Date.now(),
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <PracticeExamResults
          result={result}
          examTitle={location.state?.examTitle || attempt.examTitle || 'Practice Exam'}
          attemptId={attemptId || ''}
        />
      </div>
    </DashboardLayout>
  );
}
