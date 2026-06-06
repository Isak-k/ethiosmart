import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getExam, getQuestions } from "@/lib/firebase-exams";
import { 
  createAttempt, 
  saveAnswer, 
  submitAttempt, 
  getAttempt, 
  getAnswers, 
  getStudentAttempts as getStudentAttemptsFromFirebase
} from "@/lib/firebase-attempts";
import { 
  getOfflineExam, 
  getOfflineQuestions, 
  getOfflineAttemptsByExam, 
  getOfflineAttempt, 
  getOfflineAnswers, 
  saveOfflineAttempt, 
  saveOfflineAnswer, 
  initOfflineDB 
} from "@/lib/offline-storage";
import { submitPracticeExam, savePracticeAnswer, createPracticeAttempt } from "@/lib/offline-practice-exam";
import { 
  calculatePracticeModeResult, 
  convertToPracticeQuestions 
} from "@/lib/practice-mode-engine";
import { 
  calculateExamModeSummary, 
  convertToExamQuestions 
} from "@/lib/exam-mode-engine";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { PracticeModeDialog } from "@/components/exam/PracticeModeSelector";
import { KeyboardShortcutsHelp } from "@/components/exam/KeyboardShortcutsHelp";
import { useExamKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle, 
  Flag, 
  Check
} from "lucide-react";
import type { Exam, Question, PracticeExamConfig, ExamType, PracticeModeType } from "@/integrations/firebase/types";

type ViewMode = 'start' | 'password' | 'mode-select' | 'exam' | 'results';

interface LoadedExamData {
  exam: Exam;
  questions: Question[];
  practiceConfig: PracticeExamConfig | null;
  isOfflineMode: boolean;
}

/**
 * TakeExam Component - Refactored for Exam Type System
 * 
 * Handles two main exam types:
 * 1. Normal Exams: Traditional Firebase exams
 * 2. Practice Exams: Offline-first with mode selection (practice/exam)
 * 
 * For practice exams, supports two modes:
 * - Practice Mode: Instant feedback, explanations, no time limit
 * - Exam Mode: Timed, no feedback, summary-only results
 */
const TakeExam = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const tr = (key: string, fallback: string, options?: Record<string, any>) => {
    const val = t(key, options as any);
    return val === key ? fallback : val;
  };

  // ============== State ==============
  
  // Exam data
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [practiceConfig, setPracticeConfig] = useState<PracticeExamConfig | null>(null);
  
  // Exam progression
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, number | null>>(new Map());
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  
  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('start');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  // Exam type info
  const [examType, setExamType] = useState<ExamType>('normal');
  const [practiceMode, setPracticeMode] = useState<'practice' | 'exam' | null>(null);
  
  // Password
  const [enteredPassword, setEnteredPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // ============== Effects ==============

  // Monitor online/offline status
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

  // Load exam on mount
  useEffect(() => {
    if (id && user) {
      loadExamAndCheckAttempts();
    }
  }, [id, user]);

  // ============== Load & Initialize ==============

  /**
   * Load exam and check for existing attempts
   */
  const loadExamAndCheckAttempts = async () => {
    if (!user || !id) return;

    try {
      await initOfflineDB();
      
      const examData = await loadExamData();
      if (!examData) {
        navigate("/dashboard");
        return;
      }

      const { exam: loadedExam, questions: loadedQuestions, practiceConfig: loadedConfig, isOfflineMode: isOffline } = examData;
      setExam(loadedExam);
      setQuestions(loadedQuestions);
      setPracticeConfig(loadedConfig);
      setExamType(loadedExam.examType || 'normal');
      setIsOfflineMode(isOffline);

      // Check for existing attempts
      const attempts = await getStudentAttempts(user.uid, id, loadedExam.examType === 'practice');

      // Find incomplete attempt to resume
      const incompleteAttempt = attempts.find(a => !a.isSubmitted);
      if (incompleteAttempt) {
        // Resume existing attempt
        setAttemptId(incompleteAttempt.attemptId);
        setStartedAt(incompleteAttempt.startedAt?.toDate?.() || new Date(incompleteAttempt.startedAt));
        
        // If practice exam, load the mode from config
        if (loadedExam.examType === 'practice') {
          setPracticeMode(loadedExam.practiceMode || 'practice');
        }

        // Load previous answers
        await loadPreviousAnswers(incompleteAttempt.attemptId);
        setViewMode('exam');
      } else {
        // Check max attempts
        const submittedCount = attempts.filter(a => a.isSubmitted).length;
        if (submittedCount >= loadedExam.maxAttempts) {
          toast({
            title: "Maximum attempts reached",
            description: `You have already taken this exam ${submittedCount} times.`,
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        // Show appropriate first dialog
        if (loadedExam.examType === 'practice') {
          // For practice exams, show mode selector (unless has password)
          if (loadedExam.accessPassword?.trim()) {
            setViewMode('password');
          } else {
            setViewMode('mode-select');
          }
        } else {
          // For normal exams, show start dialog (unless has password)
          if (loadedExam.accessPassword?.trim()) {
            setViewMode('password');
          } else {
            setViewMode('start');
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading exam:", error);
      toast({
        title: "Error loading exam",
        description: "Please try again",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  /**
   * Load exam data (offline-first for practice, Firebase-first for normal)
   */
  const loadExamData = async (): Promise<LoadedExamData | null> => {
    if (!id) return null;

    try {
      // Try offline first (for practice exams downloaded locally)
      const offlineExam = await getOfflineExam(id);
      if (offlineExam?.examType === 'practice') {
        const questions = await getOfflineQuestions(id);
        return {
          exam: offlineExam,
          questions,
          practiceConfig: offlineExam.practiceConfig || null,
          isOfflineMode: true,
        };
      }

      // Try Firebase for normal exams
      try {
        const firebaseExam = await getExam(id);
        const firebaseQuestions = await getQuestions(id);
        
        return {
          exam: firebaseExam,
          questions: firebaseQuestions,
          practiceConfig: firebaseExam.practiceConfig || null,
          isOfflineMode: false,
        };
      } catch (firebaseError) {
        // Fall back to offline if available
        if (offlineExam) {
          const questions = await getOfflineQuestions(id);
          return {
            exam: offlineExam,
            questions,
            practiceConfig: offlineExam.practiceConfig || null,
            isOfflineMode: true,
          };
        }
        throw firebaseError;
      }
    } catch (error) {
      console.error("Failed to load exam from any source:", error);
      return null;
    }
  };

  /**
   * Get student attempts (handle both practice and normal exams)
   */
  const getStudentAttempts = async (studentId: string, examId: string, isPractice: boolean) => {
    try {
      if (isPractice) {
        // Practice exams only in offline storage
        return await getOfflineAttemptsByExam(examId, studentId);
      } else {
        // Normal exams try Firebase first
        try {
          return await getStudentAttemptsFromFirebase(studentId, examId);
        } catch {
          // Fall back to offline
          return await getOfflineAttemptsByExam(examId, studentId);
        }
      }
    } catch (error) {
      console.warn("Error getting attempts:", error);
      return [];
    }
  };

  /**
   * Load previous answers for resumed attempt
   */
  const loadPreviousAnswers = async (attemptIdParam: string) => {
    try {
      const existingAnswers = await getAnswers(attemptIdParam);
      const answersMap = new Map<string, number | null>();
      
      existingAnswers?.forEach((a: any) => {
        answersMap.set(a.questionId, a.selectedOptionIndex ?? null);
      });
      
      setAnswers(answersMap);
    } catch (error) {
      console.warn("Failed to load previous answers:", error);
      try {
        const offlineAnswers = await getOfflineAnswers(attemptIdParam);
        const answersMap = new Map<string, number | null>();
        
        offlineAnswers?.forEach((a: any) => {
          answersMap.set(a.questionId, a.selectedOptionIndex ?? null);
        });
        
        setAnswers(answersMap);
      } catch {
        console.error("Could not load any previous answers");
      }
    }
  };

  // ============== Password ==============

  const verifyPassword = () => {
    if (!exam) return false;
    
    if (!exam.accessPassword?.trim()) {
      return true; // No password required
    }

    if (!enteredPassword) {
      setPasswordError("Password is required");
      return false;
    }

    if (enteredPassword !== exam.accessPassword) {
      setPasswordError("Incorrect password");
      return false;
    }

    return true;
  };

  const handlePasswordSubmit = () => {
    if (!verifyPassword()) return;

    setEnteredPassword("");
    setPasswordError("");

    // After password verification, show mode selector or start
    if (examType === 'practice') {
      setViewMode('mode-select');
    } else {
      startExam(null);
    }
  };

  // ============== Mode Selection ==============

  const handleModeSelected = (mode: 'practice' | 'exam') => {
    setPracticeMode(mode);
    startExam(mode);
  };

  // ============== Start Exam ==============

  const startExam = async (mode: 'practice' | 'exam' | null) => {
    if (!user || !exam || !user.uid) return;

    try {
      let attemptId: string;
      const isModePractice = mode === 'practice' || (examType === 'practice' && !mode);

      if (examType === 'practice') {
        // Create practice attempt
        await initOfflineDB();
        
        const maxScore = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
        attemptId = await createPracticeAttempt(exam.examId, user.uid, maxScore);
        setIsOfflineMode(true);
      } else {
        // Create normal attempt
        try {
          const profile = await import("@/lib/auth").then(m => m.getUserProfile(user.uid));
          
          attemptId = await createAttempt(
            exam.examId,
            user.uid,
            exam.title,
            profile?.full_name || user.email || 'Student',
            user.email || ''
          );
        } catch (error) {
          console.warn("Firebase attempt creation failed, using offline:", error);
          
          await initOfflineDB();
          attemptId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const offlineAttempt = {
            attemptId,
            examId: exam.examId,
            studentId: user.uid,
            examTitle: exam.title,
            studentName: user.displayName || user.email || 'Student',
            studentEmail: user.email || '',
            startedAt: new Date(),
            submittedAt: null,
            isSubmitted: false,
            timeSpentSeconds: null,
            totalScore: null,
            maxScore: null,
            createdAt: new Date()
          };
          await saveOfflineAttempt(offlineAttempt);
          setIsOfflineMode(true);
        }
      }

      setAttemptId(attemptId);
      setStartedAt(new Date());
      
      if (examType === 'practice' && mode) {
        setPracticeMode(mode);
      }

      setViewMode('exam');
    } catch (error: any) {
      console.error("Error starting exam:", error);
      toast({
        title: "Error starting exam",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  // ============== Answer Selection ==============

  const handleSelectOption = useCallback(async (questionId: string, optionIndex: number | null) => {
    if (!attemptId) return;

    const newAnswers = new Map(answers);
    newAnswers.set(questionId, optionIndex);
    setAnswers(newAnswers);

    // Save answer
    const question = questions.find((q) => q.questionId === questionId);
    const isCorrect = question && optionIndex !== null && optionIndex === question.correctOptionIndex;
    const marks = question?.marks || 0;

    try {
      if (examType === 'practice') {
        // Save to offline practice exam
        await savePracticeAnswer(
          attemptId,
          questionId,
          optionIndex ?? -1,
          isCorrect || false,
          marks
        );
      } else {
        // Save to normal exam (Firebase or offline)
        try {
          await saveAnswer(attemptId, questionId, {
            selectedOptionIndex: optionIndex,
            isCorrect: isCorrect || false,
            timeSpentSeconds: null,
            answeredAt: null
          });
        } catch (error) {
          console.warn("Firebase save failed, saving offline:", error);
          await saveOfflineAnswer(attemptId, questionId, {
            selectedOptionIndex: optionIndex,
            isCorrect: isCorrect || false,
            timeSpentSeconds: null,
            answeredAt: null
          });
        }
      }
    } catch (error) {
      console.error("Error saving answer:", error);
    }
  }, [attemptId, answers, questions, examType]);

  // ============== Submit Exam ==============

  const submitExam = async () => {
    if (!attemptId || !startedAt || !exam) return;

    setSubmitting(true);

    try {
      const timeSpent = Math.floor((new Date().getTime() - startedAt.getTime()) / 1000);

      if (examType === 'practice') {
        // Submit practice exam - always use offline
        const result = await submitPracticeExam(attemptId, practiceConfig?.passingScore || 50);

        toast({
          title: "Exam submitted",
          description: "Your results are ready",
        });

        // Navigate based on mode
        if (practiceMode === 'exam') {
          // Show summary-only results for exam mode
          navigate(`/dashboard/exam-results/${attemptId}`, {
            state: {
              result,
              examTitle: exam.title,
              mode: 'exam',
              isPracticeExam: true,
            },
          });
        } else {
          // Show detailed results for practice mode
          navigate(`/dashboard/practice-results/${attemptId}`, {
            state: {
              result,
              examTitle: exam.title,
              mode: 'practice',
              isPracticeExam: true,
            },
          });
        }
      } else {
        // Submit normal exam
        let totalScore = 0;
        let maxScore = 0;

        questions.forEach((q) => {
          maxScore += q.marks || 0;
          const selectedOption = answers.get(q.questionId);
          if (selectedOption !== null && selectedOption !== undefined && selectedOption === q.correctOptionIndex) {
            totalScore += q.marks || 0;
          }
        });

        try {
          await submitAttempt(attemptId, totalScore, maxScore, timeSpent);
        } catch (error) {
          console.warn("Firebase submit failed, saving offline:", error);
          const offlineAttempt = await getOfflineAttempt(attemptId);
          if (offlineAttempt) {
            offlineAttempt.submittedAt = new Date();
            offlineAttempt.isSubmitted = true;
            offlineAttempt.totalScore = totalScore;
            offlineAttempt.maxScore = maxScore;
            offlineAttempt.timeSpentSeconds = timeSpent;
            await saveOfflineAttempt(offlineAttempt);
          }
        }

        toast({
          title: "Exam submitted",
          description: "Your results are ready",
        });

        navigate("/dashboard/results");
      }
    } catch (error) {
      console.error("Error submitting exam:", error);
      toast({
        title: "Error submitting exam",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ============== Navigation ==============

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, questions.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const handleSelectOptionByNumber = useCallback((optionIndex: number) => {
    const currentQuestion = questions[currentIndex];
    if (currentQuestion && optionIndex < currentQuestion.options.length) {
      handleSelectOption(currentQuestion.questionId, optionIndex);
    }
  }, [questions, currentIndex, handleSelectOption]);

  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedQuestions(prev => {
      const newFlags = new Set(prev);
      if (newFlags.has(questionId)) {
        newFlags.delete(questionId);
      } else {
        newFlags.add(questionId);
      }
      return newFlags;
    });
  }, []);

  // Enable keyboard navigation
  useExamKeyboardNavigation({
    onNext: handleNext,
    onPrevious: handlePrevious,
    onSubmit: () => {
      if (viewMode === 'exam') {
        submitExam();
      }
    },
    onNumber: handleSelectOptionByNumber,
    enabled: viewMode === 'exam' && !!startedAt,
  });

  // ============== Render ==============

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("student.exam.loading")}</p>
        </div>
      </div>
    );
  }

  if (!exam) return null;

  const currentQuestion = questions[currentIndex];
  const answeredCount = Array.from(answers.values()).filter(v => v !== null).length;
  const progress = (answeredCount / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Start Dialog */}
      {viewMode === 'start' && (
        <AlertDialog open={true}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-xl">
                {exam.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>{exam.description}</p>
                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <p>• Duration: {exam.durationMinutes} minutes</p>
                  <p>• Questions: {questions.length}</p>
                  <p>• Max Attempts: {exam.maxAttempts}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => navigate("/dashboard")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => startExam(null)}>
                Start Exam
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Password Dialog */}
      {viewMode === 'password' && (
        <AlertDialog open={true}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Enter Exam Password</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4">
              <Input
                type="password"
                value={enteredPassword}
                onChange={(e) => {
                  setEnteredPassword(e.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePasswordSubmit();
                }}
                placeholder="Enter password"
                autoFocus
              />
              {passwordError && (
                <p className="text-sm text-red-500">{passwordError}</p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => navigate("/dashboard")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handlePasswordSubmit}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Mode Selector Dialog (only for practice exams) */}
      {viewMode === 'mode-select' && (
        <PracticeModeDialog
          open={true}
          examTitle={exam.title}
          durationMinutes={practiceConfig?.timeLimit ? Math.ceil(practiceConfig.timeLimit / 60) : undefined}
          onSelect={handleModeSelected}
          onCancel={() => navigate("/dashboard")}
        />
      )}

      {/* Exam Content */}
      {viewMode === 'exam' && startedAt && currentQuestion && (
        <>
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
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    <Progress value={progress} className="w-24 h-2" />
                  </div>
                </div>
                
                {/* Timer - Show for exam mode or if timer enabled in practice mode */}
                {(practiceMode === 'exam' || (practiceMode === 'practice' && practiceConfig?.timerEnabled)) && (
                  <ExamTimer
                    durationMinutes={
                      practiceMode === 'exam' 
                        ? exam.durationMinutes 
                        : (practiceConfig?.timeLimit ? Math.ceil(practiceConfig.timeLimit / 60) : exam.durationMinutes)
                    }
                    startedAt={startedAt}
                    onTimeUp={submitExam}
                  />
                )}
              </div>
            </div>
          </header>

          {/* Question */}
          <main className="w-full px-0 py-4 sm:container sm:mx-auto sm:px-4 sm:py-8">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              <div className="flex-1 min-w-0">
                {/* Question Card */}
                <QuestionCard
                  questionNumber={currentIndex + 1}
                  questionText={currentQuestion.questionText}
                  options={currentQuestion.options}
                  selectedOption={answers.get(currentQuestion.questionId) ?? null}
                  correctOption={currentQuestion.correctOptionIndex}
                  feedbackType={currentQuestion.feedbackType}
                  isSubmitted={false}
                  onSelectOption={(index) => handleSelectOption(currentQuestion.questionId, index)}
                  marks={currentQuestion.marks}
                  explanation={currentQuestion.explanation}
                  mode={practiceMode || 'practice'}
                />

                {/* Flag Button */}
                <div className="mt-4 px-3 sm:px-0">
                  <Button
                    variant="outline"
                    onClick={() => toggleFlag(currentQuestion.questionId)}
                    className={`flex items-center gap-2 transition-all duration-200 ${
                      flaggedQuestions.has(currentQuestion.questionId)
                        ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                        : "bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                    }`}
                  >
                    <Flag className={`h-4 w-4 ${flaggedQuestions.has(currentQuestion.questionId) ? "fill-red-500 text-red-500" : ""}`} />
                    {flaggedQuestions.has(currentQuestion.questionId) ? "Remove Flag" : "Flag for Review"}
                  </Button>
                </div>

                {/* Navigation */}
                <div className="mt-6 flex items-center justify-between px-3 sm:mt-8 sm:px-0">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>

                  {currentIndex === questions.length - 1 ? (
                    <Button
                      onClick={submitExam}
                      disabled={submitting}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Submit
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNext}
                      className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Question Navigator - Desktop */}
              <div className="hidden lg:block w-64 flex-shrink-0">
                <div className="sticky top-24 rounded-xl border bg-card shadow-sm p-4">
                  <p className="text-sm font-medium mb-3">Questions</p>
                  <div className="grid grid-cols-4 gap-2">
                    {questions.map((q, idx) => {
                      const isAnswered = answers.get(q.questionId) !== null;
                      const isCurrent = idx === currentIndex;
                      const isFlagged = flaggedQuestions.has(q.questionId);

                      return (
                        <div key={q.questionId} className="flex items-center justify-center">
                          <button
                            onClick={() => setCurrentIndex(idx)}
                            className={`h-12 w-12 rounded-md text-sm font-bold transition-all duration-200 transform hover:scale-105 relative flex items-center justify-center overflow-hidden ${
                              isCurrent
                                ? "bg-cyan-500 text-white shadow-lg ring-2 ring-cyan-300"
                                : isAnswered
                                ? "bg-green-500 text-white shadow-md hover:shadow-lg"
                                : "bg-white text-gray-800 border-2 border-gray-300 hover:border-gray-400 shadow-sm hover:shadow-md"
                            }`}
                          >
                            {/* Lower Diagonal Red Triangle for Flagged State */}
                            {isFlagged && (
                              <div
                                className="absolute inset-0 bg-red-500"
                                style={{
                                  clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                                  zIndex: 1,
                                }}
                              />
                            )}
                            
                            {/* Question Number - Always Visible */}
                            <span className="relative z-10 font-bold">
                              {idx + 1}
                            </span>
                            
                            {/* Flag Icon on Flagged Questions */}
                            {isFlagged && (
                              <Flag className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 text-white fill-white z-20" />
                            )}
                            
                            {/* Click to Toggle Flag */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFlag(q.questionId);
                              }}
                              className="absolute inset-0 z-30 cursor-pointer"
                              title={isFlagged ? "Remove flag" : "Flag for review"}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </>
      )}
    </div>
  );
};

export default TakeExam;
