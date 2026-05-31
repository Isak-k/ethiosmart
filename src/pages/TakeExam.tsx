import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getExam, getQuestions } from "@/lib/firebase-exams";
import { createAttempt, saveAnswer, submitAttempt, getAttempt, getAnswers, getStudentAttempts } from "@/lib/firebase-attempts";
import { getOfflineExam, getOfflineQuestions, getOfflineAttemptsByExam, getOfflineAttempt, getOfflineAnswers, saveOfflineAttempt, saveOfflineAnswer } from "@/lib/offline-storage";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { ExamTimer } from "@/components/exam/ExamTimer";
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
import { Loader2, ChevronLeft, ChevronRight, Send, AlertTriangle, CheckCircle, AlertCircle, Flag, Check, Wifi, WifiOff } from "lucide-react";

interface Question {
  questionId: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  feedbackType: "instant" | "hidden";
  explanation?: string;
  marks: number;
  orderIndex: number;
}

interface Exam {
  examId: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  accessPassword?: string | null;
}

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

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  useEffect(() => {
    const checkExistingAttempt = async () => {
      if (!user || !id) return;
  
      try {
        let examData: Exam | null = null;
        let questionsData: Question[] = [];
        let isOffline = false;

        // Try to fetch from Firebase first
        try {
          examData = await getExam(id);
          questionsData = await getQuestions(id);
        } catch (error) {
          console.warn("Firebase fetch failed, trying offline storage:", error);
          // Fall back to offline storage
          const offlineExam = await getOfflineExam(id);
          const offlineQuestions = await getOfflineQuestions(id);
          
          if (offlineExam && offlineQuestions.length > 0) {
            examData = offlineExam as any;
            questionsData = offlineQuestions;
            isOffline = true;
            setIsOfflineMode(true);
          }
        }
  
        if (!examData) {
          toast({
            title: "Exam not found",
            description: "This exam is not available. Make sure you downloaded it for offline use.",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }
  
        setExam(examData);
  
        // Check for existing attempts
        let attempts: any[] = [];
        try {
          attempts = await getStudentAttempts(user.uid, id);
        } catch (error) {
          console.warn("Could not fetch attempts from Firebase, trying offline:", error);
          // Try offline attempts
          attempts = await getOfflineAttemptsByExam(id, user.uid);
          isOffline = true;
          setIsOfflineMode(true);
        }

        const incompleteAttempt = attempts.find(a => !a.isSubmitted);
        const submittedCount = attempts.filter(a => a.isSubmitted).length;
  
        // Check max attempts
        if (!incompleteAttempt && submittedCount >= examData.maxAttempts) {
          toast({
            title: "Maximum attempts reached",
            description: `You have already taken this exam ${submittedCount} times.`,
            variant: "destructive",
          });
          navigate("/dashboard/results");
          return;
        }
  
        if (incompleteAttempt) {
          setAttemptId(incompleteAttempt.attemptId);
          setStartedAt(incompleteAttempt.startedAt?.toDate?.() || new Date(incompleteAttempt.startedAt));
          setShowStartDialog(false);
          await loadQuestions(examData, incompleteAttempt.attemptId, questionsData, isOffline);
        } else {
          await loadQuestions(examData, undefined, questionsData, isOffline);
        }
  
        setLoading(false);
      } catch (error) {
        console.error("Error checking attempt:", error);
        toast({
          title: "Error loading exam",
          variant: "destructive",
        });
        setLoading(false);
      }
    };

    if (id && user) {
      checkExistingAttempt();
    }
  }, [id, user]);

  // Seeded random number generator
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const shuffleArray = <T,>(array: T[], seedStr: string): T[] => {
    const shuffled = [...array];
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed += seedStr.charCodeAt(i);
    }

    for (let i = shuffled.length - 1; i > 0; i--) {
      // Use seeded random
      const r = seededRandom(seed + i); 
      const j = Math.floor(r * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const shuffleWithCorrectIndex = (options: string[], correctIndex: number, seedStr: string) => {
    const indexed = options.map((opt, idx) => ({ opt, isCorrect: idx === correctIndex }));
    const shuffled = shuffleArray(indexed, seedStr);
    return {
      options: shuffled.map((item) => item.opt),
      newCorrectIndex: shuffled.findIndex((item) => item.isCorrect),
    };
  };

  const loadQuestions = async (examData: Exam, attemptIdParam?: string, preloadedQuestions?: Question[], isOffline?: boolean) => {
    let questionsData: Question[] = preloadedQuestions || [];
    
    if (!preloadedQuestions) {
      try {
        questionsData = await getQuestions(examData.examId);
      } catch (e: any) {
        console.warn("Failed to load questions from Firebase, trying offline:", e);
        try {
          questionsData = await getOfflineQuestions(examData.examId);
          setIsOfflineMode(true);
        } catch (offlineError) {
          console.error("Failed to load questions:", offlineError);
          toast({
            title: t("student.exam.loadingFailed"),
            description: "Could not load questions",
            variant: "destructive",
          });
          return;
        }
      }
    }

    if (questionsData) {
      let processedQuestions = questionsData;
      const seed = attemptIdParam || "preview";

      if (examData.shuffleQuestions) {
        processedQuestions = shuffleArray(processedQuestions, seed);
      }

      if (examData.shuffleOptions) {
        processedQuestions = processedQuestions.map((q) => {
          const questionSeed = `${seed}-${q.questionId}`;
          const shuffled = shuffleWithCorrectIndex(q.options, q.correctOptionIndex, questionSeed);
          return {
            ...q,
            options: shuffled.options,
            correctOptionIndex: shuffled.newCorrectIndex,
          };
        });
      }

      setQuestions(processedQuestions);

      // Load existing answers if resuming
      if (attemptIdParam) {
        let existingAnswers: any[] = [];
        try {
          existingAnswers = await getAnswers(attemptIdParam);
        } catch (error) {
          console.warn("Failed to load answers from Firebase, trying offline:", error);
          try {
            existingAnswers = await getOfflineAnswers(attemptIdParam);
            setIsOfflineMode(true);
          } catch (offlineError) {
            console.error("Failed to load answers:", offlineError);
          }
        }

        if (existingAnswers) {
          const answersMap = new Map<string, number>();
          existingAnswers.forEach((a) => {
            if (a.selectedOptionIndex !== null) {
              answersMap.set(a.questionId, a.selectedOptionIndex);
            }
          });
          setAnswers(answersMap);
        }
      }
    }
  };

  const startExam = async () => {
    if (!user || !exam || !user.uid) return;

    // Check password if required
    if (exam.accessPassword && exam.accessPassword.trim()) {
      if (!enteredPassword) {
        setShowStartDialog(false);
        setShowPasswordDialog(true);
        return;
      }
      
      if (enteredPassword !== exam.accessPassword) {
        setPasswordError(t("student.exam.passwordDialog.incorrect"));
        return;
      }
    }

    try {
      let attemptId: string;
      
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
        console.warn("Failed to create attempt on Firebase, creating offline attempt:", error);
        // Create offline attempt
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

      setAttemptId(attemptId);
      setStartedAt(new Date());
      setShowStartDialog(false);
      setShowPasswordDialog(false);
      setEnteredPassword("");
      setPasswordError("");
      await loadQuestions(exam, attemptId);
    } catch (error: any) {
      console.error("Error starting exam:", error);
      toast({
        title: t("student.exam.startFailed"),
        description: error?.message || "Could not create attempt",
        variant: "destructive",
      });
    }
  };

  const handleSelectOption = useCallback(async (questionId: string, optionIndex: number) => {
    if (!attemptId) return;

    const newAnswers = new Map(answers);
    newAnswers.set(questionId, optionIndex);
    setAnswers(newAnswers);

    // Save answer to database
    const question = questions.find((q) => q.questionId === questionId);
    const isCorrect = question ? optionIndex === question.correctOptionIndex : false;

    try {
      await saveAnswer(attemptId, questionId, {
        selectedOptionIndex: optionIndex,
        isCorrect,
        timeSpentSeconds: null,
        answeredAt: null
      });
    } catch (error) {
      console.warn("Failed to save answer to Firebase, saving offline:", error);
      try {
        await saveOfflineAnswer(attemptId, questionId, {
          selectedOptionIndex: optionIndex,
          isCorrect,
          timeSpentSeconds: null,
          answeredAt: null
        });
        setIsOfflineMode(true);
      } catch (offlineError) {
        console.error("Error saving answer:", offlineError);
      }
    }
  }, [attemptId, answers, questions]);

  const submitExam = async () => {
    if (!attemptId || !startedAt) return;

    setSubmitting(true);

    try {
      // Calculate score
      let totalScore = 0;
      let maxScore = 0;

      questions.forEach((q) => {
        maxScore += q.marks;
        const selectedOption = answers.get(q.questionId);
        if (selectedOption === q.correctOptionIndex) {
          totalScore += q.marks;
        }
      });

      const timeSpent = Math.floor((new Date().getTime() - startedAt.getTime()) / 1000);

      await submitAttempt(attemptId, totalScore, maxScore, timeSpent);

      toast({
        title: t("student.exam.submitted"),
        description: t("student.exam.submittedDesc"),
      });

      navigate("/dashboard/results");
    } catch (error) {
      console.error("Error submitting exam:", error);
      toast({
        title: t("student.exam.submitFailed"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      setShowSubmitDialog(false);
    }
  };

  const handleTimeUp = useCallback(() => {
    toast({
      title: t("student.exam.timeUp.title"),
      description: t("student.exam.timeUp.description"),
      variant: "destructive",
    });
    submitExam();
  }, [submitExam, t]);

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
    onSubmit: () => setShowSubmitDialog(true),
    onNumber: handleSelectOptionByNumber,
    enabled: !!startedAt && !showSubmitDialog && !showStartDialog,
  });

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
  const answeredCount = answers.size;
  const progress = (answeredCount / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Start Dialog */}
      <AlertDialog open={showStartDialog && !attemptId}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">
              {exam.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>{exam.description}</p>
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <p>• {tr("student.exam.startDialog.duration", `Duration: ${exam.durationMinutes} minutes`, { minutes: exam.durationMinutes })}</p>
                <p>• {tr("student.exam.startDialog.questions", `Questions: ${questions.length}`, { count: questions.length })}</p>
                <p>• {tr("student.exam.startDialog.timer", "The timer will start as soon as you begin")}</p>
                {exam.accessPassword && (
                  <p className="text-warning font-medium">• {tr("student.exam.startDialog.passwordRequired", "Password required to start")}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{tr("student.exam.startDialog.warning", "Do not refresh or leave this page")}</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => navigate("/dashboard")}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300 transition-all duration-200 hover:shadow-md"
            >
              {tr("student.exam.startDialog.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={startExam} 
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              {tr("student.exam.startDialog.start", "Start Exam")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Dialog */}
      <AlertDialog open={showPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">
              {t("student.exam.passwordDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>{tr("student.exam.passwordDialog.description", "Enter the exam password to begin")}</p>
              <div className="space-y-2">
                <Label htmlFor="exam-password">{tr("student.exam.passwordDialog.label", "Exam Password")}</Label>
                <Input
                  id="exam-password"
                  type="password"
                  value={enteredPassword}
                  onChange={(e) => {
                    setEnteredPassword(e.target.value);
                    setPasswordError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      startExam();
                    }
                  }}
                  placeholder={tr("student.exam.passwordDialog.placeholder", "Enter exam password")}
                  className={`transition-all duration-200 border-2 rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 hover:border-gray-400 ${passwordError ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-300"}`}
                  autoFocus
                />
                {passwordError && (
                  <p className="text-sm text-red-500">{passwordError}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowPasswordDialog(false);
                setShowStartDialog(true);
                setEnteredPassword("");
                setPasswordError("");
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300 transition-all duration-200 hover:shadow-md"
            >
              {tr("student.exam.passwordDialog.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={startExam} 
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              {tr("student.exam.passwordDialog.submit", "Start Exam")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog}>
        <AlertDialogContent className="sm:max-w-[440px]">
          <AlertDialogHeader className="space-y-4">
            <AlertDialogTitle className="text-2xl font-bold text-center">
              Submit Exam?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {answeredCount} of {questions.length} answered
                </span>
              </div>
              {answeredCount < questions.length && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-400 rounded-r-lg">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-800 dark:text-amber-300 text-sm text-left">
                    {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} unanswered
                  </span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-3 sm:gap-3">
            <AlertDialogCancel 
              onClick={() => setShowSubmitDialog(false)}
              className="w-full sm:flex-1 h-11 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 hover:border-gray-400 transition-all duration-200 font-medium rounded-lg"
            >
              Continue Exam
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={submitExam}
              disabled={submitting}
              className="w-full sm:flex-1 h-11 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold rounded-lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Exam
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exam Header */}
      {startedAt && (
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
                    {t("student.exam.question", { current: currentIndex + 1, total: questions.length })}
                  </span>
                  <Progress value={progress} className="w-24 h-2" />
                </div>
              </div>
              <ExamTimer
                durationMinutes={exam.durationMinutes}
                startedAt={startedAt}
                onTimeUp={handleTimeUp}
              />
            </div>
          </div>
        </header>
      )}

      {/* Question Content */}
      {currentQuestion && startedAt && (
        <main className="w-full px-0 py-4 sm:container sm:mx-auto sm:px-4 sm:py-8">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Left: Question Area */}
            <div className="flex-1 min-w-0">
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
              />

              {/* Flag Button for Current Question */}
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
                  onClick={() => setCurrentIndex((i) => i - 1)}
                  disabled={currentIndex === 0}
                  className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                {currentIndex === questions.length - 1 ? (
                  <Button
                    onClick={() => setShowSubmitDialog(true)}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit Exam
                  </Button>
                ) : (
                  <Button
                    onClick={() => setCurrentIndex((i) => i + 1)}
                    className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>

              {/* Mobile Question Navigator (only visible on small screens) */}
              <div className="mt-6 lg:hidden mx-3 rounded-xl border bg-card p-4 sm:mx-0">
                <p className="text-sm font-medium mb-3">{t("student.exam.questionNavigator")}</p>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => {
                    const isAnswered = answers.has(q.questionId);
                    const isCurrent = idx === currentIndex;
                    const isFlagged = flaggedQuestions.has(q.questionId);

                    return (
                      <div
                        key={q.questionId}
                        className="flex items-center justify-center"
                      >
                        <button
                          onClick={() => setCurrentIndex(idx)}
                          className={`h-10 w-10 rounded-full text-xs font-medium transition-all duration-200 transform hover:scale-110 relative flex items-center justify-center ${
                            isCurrent
                              ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg"
                              : isAnswered
                              ? "bg-gradient-to-r from-green-400 to-emerald-400 text-white shadow-md hover:shadow-lg"
                              : "bg-gray-100 hover:bg-gray-200 text-gray-700 shadow-sm hover:shadow-md"
                          }`}
                        >
                          {isAnswered ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            idx + 1
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFlag(q.questionId);
                            }}
                            className={`absolute -top-1 -right-1 p-0.5 transition-all duration-200 ${
                              isFlagged
                                ? "bg-red-500 rounded-full"
                                : "text-gray-400 hover:text-gray-600"
                            }`}
                            title={isFlagged ? "Remove flag" : "Flag for review"}
                          >
                            <Flag className={`w-2.5 h-2.5 ${isFlagged ? "text-white fill-white" : "text-gray-600 fill-gray-600"}`} />
                          </button>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Question Navigator (desktop only) */}
            <div className="hidden lg:block w-48 flex-shrink-0">
              <div className="sticky top-24 rounded-xl border bg-card shadow-sm p-3">
                <p className="text-xs font-medium mb-2">{t("student.exam.questionNavigator")}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {questions.map((q, idx) => {
                    const isAnswered = answers.has(q.questionId);
                    const isCurrent = idx === currentIndex;
                    const isFlagged = flaggedQuestions.has(q.questionId);

                    return (
                      <div
                        key={q.questionId}
                        className="flex items-center justify-center"
                      >
                        <button
                          onClick={() => setCurrentIndex(idx)}
                          className={`h-8 w-8 rounded-full text-xs font-medium transition-all duration-200 transform hover:scale-110 relative flex items-center justify-center ${
                            isCurrent
                              ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md"
                              : isAnswered
                              ? "bg-gradient-to-r from-green-400 to-emerald-400 text-white shadow-sm hover:shadow-md"
                              : "bg-gray-100 hover:bg-gray-200 text-gray-700 shadow-sm hover:shadow-md"
                          }`}
                        >
                          {isAnswered ? (
                            <Check className="w-2.5 h-2.5" />
                          ) : (
                            idx + 1
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFlag(q.questionId);
                            }}
                            className={`absolute -top-0.5 -right-0.5 p-0.5 transition-all duration-200 ${
                              isFlagged
                                ? "bg-red-500 rounded-full"
                                : "text-gray-400 hover:text-gray-600"
                            }`}
                            title={isFlagged ? "Remove flag" : "Flag for review"}
                          >
                            <Flag className={`w-2 h-2 ${isFlagged ? "text-white fill-white" : "text-gray-600 fill-gray-600"}`} />
                          </button>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 space-y-1.5 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-400"></div>
                    <span className="text-gray-600">Answered</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-100 border border-gray-200"></div>
                    <span className="text-gray-600">Unanswered</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500"></div>
                    <span className="text-gray-600">Current</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <span className="text-gray-600">Flagged</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
};

export default TakeExam;
