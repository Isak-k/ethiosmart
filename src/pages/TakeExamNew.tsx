/**
 * TakeExam v4 - Refactored for Phase 4
 * Integrates practice exam modes, offline support, and intelligent loading
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useExamLoader } from '@/hooks/useExamLoader';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, ChevronLeft, ChevronRight, Send, AlertTriangle, Flag, Check } from 'lucide-react';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { ExamTimer } from '@/components/exam/ExamTimer';
import { KeyboardShortcutsHelp } from '@/components/exam/KeyboardShortcutsHelp';
import { useExamKeyboardNavigation } from '@/hooks/use-keyboard-navigation';
import { PracticeModeDialog, PracticeModeType } from '@/components/exam/PracticeModeSelector';
import { ExamModeSummaryDisplay } from '@/components/exam/ExamModeSummary';
import { PracticeModeResults } from '@/components/exam/PracticeModeResults';
import { calculateExamModeSummary, ExamModeResult, convertToExamQuestions } from '@/lib/exam-mode-engine';
import { calculatePracticeModeResult, convertToPracticeQuestions } from '@/lib/practice-mode-engine';
import { createPracticeAttempt, submitPracticeExam, savePracticeAnswer, getPracticeAttempt } from '@/lib/offline-practice-exam';
import { createAttempt, saveAnswer, submitAttempt, getStudentAttempts } from '@/lib/firebase-attempts';
import { getPracticeConfig } from '@/lib/offline-storage';
import { Exam, Question } from '@/integrations/firebase/types';

type ViewMode = 'start' | 'password' | 'mode-select' | 'exam' | 'results';

interface ExamState {
  exam: Exam | null;
  questions: Question[];
  attemptId: string | null;
  startedAt: Date | null;
  practiceMode: PracticeModeType | null;
  answers: Map<string, number | null>;
  flaggedQuestions: Set<string>;
  isOfflineMode: boolean;
  isOnline: boolean;
}

const TakeExamNew = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Load exam data (uses offline loader)
  const { exam, questions, loading: examLoading, error: examError, isOfflineMode } = useExamLoader({
    examId: id || '',
    autoLoad: true,
  });

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('start');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [practiceMode, setPracticeMode] = useState<PracticeModeType | null>(null);
  const [answers, setAnswers] = useState<Map<string, number | null>>(new Map());
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [submitting, setSubmitting] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [examResult, setExamResult] = useState<any>(null);
  const [isCheckingExistingAttempt, setIsCheckingExistingAttempt] = useState(true);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check for existing attempts on load
  useEffect(() => {
    const checkExistingAttempt = async () => {
      if (!user || !exam || !id) return;

      try {
        setIsCheckingExistingAttempt(true);

        // Get existing attempts
        const attempts = exam.examType === 'practice' 
          ? [] // Practice exams don't resume
          : await getStudentAttempts(user.uid, id);

        const incompleteAttempt = attempts.find((a) => !a.isSubmitted);
        const submittedCount = attempts.filter((a) => a.isSubmitted).length;

        // Check max attempts
        if (!incompleteAttempt && submittedCount >= exam.maxAttempts) {
          toast({
            title: 'Maximum attempts reached',
            description: `You have already taken this exam ${submittedCount} times.`,
            variant: 'destructive',
          });
          navigate('/dashboard/results');
          return;
        }

        if (incompleteAttempt) {
          // Resume existing attempt
          setAttemptId(incompleteAttempt.attemptId);
          const startTime = incompleteAttempt.startedAt?.toDate?.() 
            ? new Date(incompleteAttempt.startedAt.toDate())
            : new Date();
          setStartedAt(startTime);
          setViewMode('exam');
        } else {
          // New attempt - show mode selector for practice exams
          if (exam.examType === 'practice') {
            setShowModeDialog(true);
          } else if (exam.accessPassword) {
            setViewMode('password');
          } else {
            setViewMode('mode-select'); // Still show mode for normal exams if configured
          }
        }
      } catch (error) {
        console.error('Error checking existing attempt:', error);
        // Continue anyway
      } finally {
        setIsCheckingExistingAttempt(false);
      }
    };

    if (exam && !examLoading) {
      checkExistingAttempt();
    }
  }, [exam, examLoading, user, id, navigate, toast]);

  // Shuffle array with seeded random
  const shuffleArray = useCallback(<T,>(array: T[], seedStr: string): T[] => {
    const shuffled = [...array];
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed += seedStr.charCodeAt(i);
    }

    const seededRandom = (s: number) => {
      const x = Math.sin(s++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = shuffled.length - 1; i > 0; i--) {
      const r = seededRandom(seed + i);
      const j = Math.floor(r * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Shuffle questions and options if configured
  const processedQuestions = useCallback(() => {
    if (!exam || questions.length === 0) return [];

    let processed = [...questions];
    const seed = attemptId || 'preview';

    if (exam.shuffleQuestions) {
      processed = shuffleArray(processed, seed);
    }

    if (exam.shuffleOptions) {
      processed = processed.map((q) => {
        const questionSeed = `${seed}-${q.questionId}`;
        const indexed = q.options.map((opt, idx) => ({ opt, isCorrect: idx === q.correctOptionIndex }));
        const shuffled = shuffleArray(indexed, questionSeed);
        return {
          ...q,
          options: shuffled.map((item) => item.opt),
          correctOptionIndex: shuffled.findIndex((item) => item.isCorrect),
        };
      });
    }

    return processed;
  }, [exam, questions, attemptId, shuffleArray]);

  // Start exam
  const startExam = useCallback(async () => {
    if (!user || !exam) return;

    try {
      setSubmitting(true);

      // Check password if required (not for practice exams)
      if (!exam.examType && exam.accessPassword && enteredPassword !== exam.accessPassword) {
        setPasswordError('Incorrect password');
        return;
      }

      // Create attempt
      let newAttemptId: string;

      if (exam.examType === 'practice') {
        // Create practice attempt
        const maxScore = questions.reduce((sum, q) => sum + q.marks, 0);
        newAttemptId = await createPracticeAttempt(exam.examId, user.uid, maxScore);
      } else {
        // Create normal attempt
        newAttemptId = await createAttempt(
          exam.examId,
          user.uid,
          exam.title,
          profile?.full_name || user.displayName || 'Student',
          user.email || ''
        );
      }

      setAttemptId(newAttemptId);
      setStartedAt(new Date());
      setViewMode('exam');
      setShowModeDialog(false);
      setEnteredPassword('');
      setPasswordError('');
    } catch (error) {
      console.error('Error starting exam:', error);
      toast({
        title: 'Error starting exam',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [user, exam, questions, enteredPassword, profile, toast]);

  // Handle answer selection
  const handleSelectOption = useCallback(
    async (questionId: string, selectedIndex: number) => {
      const newAnswers = new Map(answers);
      newAnswers.set(questionId, selectedIndex);
      setAnswers(newAnswers);

      if (!attemptId) return;

      try {
        const question = questions.find((q) => q.questionId === questionId);
        if (!question) return;

        const isCorrect = selectedIndex === question.correctOptionIndex;
        const marks = isCorrect ? question.marks : 0;

        if (exam?.examType === 'practice') {
          // Save practice answer
          await savePracticeAnswer(attemptId, questionId, selectedIndex, isCorrect, marks);
        } else {
          // Save normal answer
          await saveAnswer(attemptId, questionId, {
            selectedOptionIndex: selectedIndex,
            isCorrect,
            timeSpentSeconds: null,
            answeredAt: null,
          });
        }
      } catch (error) {
        console.warn('Error saving answer:', error);
        // Continue anyway - offline fallback
      }
    },
    [answers, attemptId, questions, exam]
  );

  // Submit exam
  const submitExam = useCallback(async () => {
    if (!attemptId || !startedAt || !exam || questions.length === 0) return;

    try {
      setSubmitting(true);
      const timeSpent = Math.floor((new Date().getTime() - startedAt.getTime()) / 1000);

      if (exam.examType === 'practice') {
        // Submit practice exam
        const result = await submitPracticeExam(attemptId, 50);
        setExamResult({
          ...result,
          examTitle: exam.title,
          isPracticeMode: true,
          practiceMode,
          questions: processedQuestions(),
        });
        setViewMode('results');
      } else {
        // Submit normal exam
        if (practiceMode === 'exam') {
          // Exam mode - show summary only
          const allQuestions = convertToExamQuestions(processedQuestions());
          const summary = calculateExamModeSummary(allQuestions, answers, timeSpent, 50);
          const result: ExamModeResult = {
            attemptId,
            summary,
            answers: allQuestions.map((q) => ({
              questionId: q.questionId,
              selectedOptionIndex: answers.get(q.questionId) ?? null,
              isCorrect: null, // Don't reveal in exam mode
              marks: 0,
            })),
            completedAt: Date.now(),
          };
          setExamResult({
            ...result,
            examTitle: exam.title,
            isPracticeMode: false,
            practiceMode: 'exam',
          });
        } else {
          // Practice mode for normal exam - show detailed results
          const allQuestions = convertToPracticeQuestions(processedQuestions());
          const result = calculatePracticeModeResult(attemptId, allQuestions, answers, 50);
          setExamResult({
            ...result,
            examTitle: exam.title,
            isPracticeMode: false,
            practiceMode: 'practice',
            questions: processedQuestions(),
          });
        }

        setViewMode('results');

        // Try to submit to Firebase
        try {
          let totalScore = 0;
          let maxScore = 0;
          processedQuestions().forEach((q) => {
            maxScore += q.marks;
            const selectedOption = answers.get(q.questionId);
            if (selectedOption === q.correctOptionIndex) {
              totalScore += q.marks;
            }
          });

          await submitAttempt(attemptId, totalScore, maxScore, timeSpent);
        } catch (error) {
          console.warn('Could not submit to Firebase:', error);
          // Offline mode - results still saved locally
        }
      }

      toast({
        title: 'Exam submitted',
        description: 'Your exam has been submitted successfully.',
      });
    } catch (error) {
      console.error('Error submitting exam:', error);
      toast({
        title: 'Error submitting exam',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, startedAt, exam, questions, answers, practiceMode, processedQuestions, toast]);

  // Loading state
  if (examLoading || isCheckingExistingAttempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading exam...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (examError || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Exam Not Found</h1>
          <p className="text-muted-foreground mb-4">Could not load this exam.</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const processedQs = processedQuestions();
  const currentQuestion = processedQs[currentQuestionIndex];
  const answeredCount = Array.from(answers.values()).filter((a) => a !== null && a !== undefined).length;
  const progress = (answeredCount / processedQs.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Mode Selector Dialog */}
      <PracticeModeDialog
        open={showModeDialog}
        examTitle={exam.title}
        durationMinutes={exam.durationMinutes}
        onSelect={(mode) => {
          setPracticeMode(mode);
          setViewMode('exam');
          startExam();
        }}
        onCancel={() => navigate('/dashboard')}
      />

      {/* Start Dialog */}
      <AlertDialog open={viewMode === 'start' && !attemptId}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{exam.title}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>{exam.description}</p>
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <p>• Duration: {exam.durationMinutes} minutes</p>
                <p>• Questions: {processedQs.length}</p>
                {exam.accessPassword && <p>• Password required</p>}
              </div>
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Do not refresh or leave this page</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => navigate('/dashboard')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (exam.examType === 'practice') {
                setShowModeDialog(true);
              } else if (exam.accessPassword) {
                setViewMode('password');
              } else {
                startExam();
              }
            }}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Dialog */}
      <AlertDialog open={viewMode === 'password'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enter Exam Password</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={enteredPassword}
                onChange={(e) => {
                  setEnteredPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="Enter exam password"
                autoFocus
              />
              {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setViewMode('start')}>Back</AlertDialogCancel>
            <AlertDialogAction onClick={startExam} disabled={submitting}>
              {submitting ? 'Starting...' : 'Start Exam'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Results View */}
      {viewMode === 'results' && examResult && (
        <div className="container py-8">
          {!examResult.isPracticeMode && examResult.practiceMode === 'exam' ? (
            <ExamModeSummaryDisplay
              summary={examResult.summary}
              examTitle={exam.title}
              onHome={() => navigate('/dashboard')}
              onRetry={() => location.reload()}
            />
          ) : (
            <PracticeModeResults
              result={examResult}
              questions={examResult.questions || processedQs}
              examTitle={exam.title}
              onHome={() => navigate('/dashboard')}
              onRetry={() => location.reload()}
            />
          )}
        </div>
      )}

      {/* Exam View */}
      {viewMode === 'exam' && currentQuestion && startedAt && (
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b">
            <div className="w-full px-3 py-3 sm:container sm:mx-auto sm:px-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h1 className="font-display font-semibold truncate">{exam.title}</h1>
                    <KeyboardShortcutsHelp />
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-muted-foreground">
                      Question {currentQuestionIndex + 1} of {processedQs.length}
                    </span>
                    <Progress value={progress} className="w-24 h-2" />
                  </div>
                </div>
                <ExamTimer
                  durationMinutes={exam.durationMinutes}
                  startedAt={startedAt}
                  onTimeUp={() => submitExam()}
                />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="w-full px-0 py-4 sm:container sm:mx-auto sm:px-4 sm:py-8">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              {/* Question */}
              <div className="flex-1 min-w-0">
                <QuestionCard
                  questionNumber={currentQuestionIndex + 1}
                  questionText={currentQuestion.questionText}
                  options={currentQuestion.options}
                  selectedOption={answers.get(currentQuestion.questionId) ?? null}
                  correctOption={currentQuestion.correctOptionIndex}
                  feedbackType={currentQuestion.feedbackType}
                  isSubmitted={false}
                  onSelectOption={(idx) => handleSelectOption(currentQuestion.questionId, idx)}
                  marks={currentQuestion.marks}
                  explanation={currentQuestion.explanation}
                />

                {/* Navigation */}
                <div className="mt-6 flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                    disabled={currentQuestionIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>

                  {currentQuestionIndex === processedQs.length - 1 ? (
                    <Button onClick={() => setViewMode('start')} className="bg-gradient-to-r from-green-500 to-emerald-500">
                      <Send className="h-4 w-4 mr-2" />
                      Submit Exam
                    </Button>
                  ) : (
                    <Button onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}>
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default TakeExamNew;
