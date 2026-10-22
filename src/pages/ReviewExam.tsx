import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getExam } from "@/lib/firebase-exams";
import { getAttempt, getAnswers } from "@/lib/firebase-attempts";
import { getQuestions } from "@/lib/firebase-exams";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Question {
  questionId: string;
  questionText: string;
  imageUrl?: string;
  options?: string[];
  correctOptionIndex?: number;
  correctAnswer?: string;
  questionType?: 'mcq' | 'truefalse' | 'shortanswer' | 'essay';
  marks: number;
  orderIndex: number;
  feedbackType: "instant" | "hidden";
  explanation?: string;
}

interface ReviewAnswer {
  selectedOptionIndex: number | null;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  manualGrade?: number | null;
}

interface AttemptData {
  attemptId: string;
  examId: string;
  studentId: string;
  totalScore: number;
  maxScore: number;
}

const ReviewExam = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [examTitle, setExamTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, ReviewAnswer>>({});
  const [attemptData, setAttemptData] = useState<AttemptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attemptId && user) {
      loadReviewData();
    }
  }, [attemptId, user]);

  const loadReviewData = async () => {
    try {
      if (!attemptId || !user) return;

      // 1. Fetch Attempt
      const attempt = await getAttempt(attemptId);
      if (!attempt) {
        setError("Attempt not found");
        return;
      }

      // Security Check: Only the student or admin can view
      if (attempt.studentId !== user.uid) {
         setError("You are not authorized to view this review.");
         return;
      }

      setAttemptData({
        attemptId: attempt.attemptId,
        examId: attempt.examId,
        studentId: attempt.studentId,
        totalScore: attempt.totalScore || 0,
        maxScore: attempt.maxScore || 0
      });

      // 2. Fetch Exam (to check if results are published)
      const exam = await getExam(attempt.examId);
      if (!exam) {
        setError("Exam not found");
        return;
      }

      if (!exam.resultsPublished) {
        setError("Results for this exam have not been published yet.");
        return;
      }

      setExamTitle(exam.title);

      // 3. Fetch Questions
      const questionsData = await getQuestions(attempt.examId);
      questionsData.sort((a, b) => a.orderIndex - b.orderIndex);
      setQuestions(questionsData as Question[]);

      // 4. Fetch Answers and normalize selectedOptionIndex / studentAnswer
      const answersData = await getAnswers(attemptId);
      const answersMap: Record<string, ReviewAnswer> = {};
      answersData.forEach((ans: any) => {
        const selectedIndex = typeof ans.selectedOptionIndex === 'number'
          ? ans.selectedOptionIndex
          : typeof ans.selectedOption === 'number'
          ? ans.selectedOption
          : null;

        answersMap[ans.questionId] = {
          selectedOptionIndex: selectedIndex,
          studentAnswer: ans.studentAnswer ?? null,
          isCorrect: typeof ans.isCorrect === 'boolean' ? ans.isCorrect : null,
          manualGrade: typeof ans.manualGrade === 'number' ? ans.manualGrade : null,
        };
      });
      setUserAnswers(answersMap);

    } catch (err) {
      console.error("Error loading review:", err);
      setError("Failed to load exam review.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => navigate("/dashboard/results")}>
            Back to Results
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout contentClassName="px-0 sm:px-6 lg:p-8 pt-3 sm:pt-6 pb-20">
      <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-4xl mx-auto w-full">
        {/* Header (compact padding on mobile) */}
        <div className="px-3.5 sm:px-0 flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/results")} className="rounded-xl shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-display leading-tight">{examTitle} - Review</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Score: <span className="font-semibold text-foreground">{attemptData?.totalScore}</span> / {attemptData?.maxScore}
            </p>
          </div>
        </div>

        {/* Questions List (Edge-to-edge on mobile for optimal reading) */}
        <div className="space-y-3 sm:space-y-6">
          {questions.map((q, index) => {
            const userAns = userAnswers[q.questionId];
            return (
              <QuestionCard
                key={q.questionId}
                questionNumber={index + 1}
                questionText={q.questionText}
                imageUrl={q.imageUrl}
                options={q.options || []}
                selectedOption={userAns?.selectedOptionIndex ?? null}
                studentAnswer={userAns?.studentAnswer ?? null}
                correctOption={q.correctOptionIndex}
                correctAnswerText={q.correctAnswer}
                manualGrade={userAns?.manualGrade}
                isCorrect={userAns?.isCorrect}
                questionType={q.questionType || (q.options && q.options.length > 0 ? 'mcq' : 'shortanswer')}
                feedbackType="hidden"
                isSubmitted={true}
                onSelectOption={() => {}}
                marks={q.marks}
                explanation={q.explanation}
              />
            );
          })}
        </div>
        
        <div className="flex justify-center pt-4 sm:pt-8 px-4">
            <Button onClick={() => navigate("/dashboard/results")} size="lg" className="rounded-xl shadow-sm">
                Back to Results
            </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReviewExam;
