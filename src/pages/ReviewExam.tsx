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
  options: string[];
  correctOptionIndex: number;
  marks: number;
  orderIndex: number;
  feedbackType: "instant" | "hidden";
  explanation?: string;
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
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
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
        console.error("Attempt not found:", attemptId);
        return;
      }

      // Security Check: Only the student or admin can view
      // (Admin check would require role from context, assuming student for now based on route)
      if (attempt.studentId !== user.uid) {
         // TODO: Add admin bypass if needed, but for now strict
         setError("You are not authorized to view this review.");
         console.error("Unauthorized access attempt by:", user.uid);
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
        console.error("Exam not found:", attempt.examId);
        return;
      }

      if (!exam.resultsPublished) {
        setError("Results for this exam have not been published yet.");
        console.warn("Results not published for exam:", attempt.examId);
        return;
      }

      setExamTitle(exam.title);

      // 3. Fetch Questions
      const questionsData = await getQuestions(attempt.examId);
      console.log("Fetched questions:", questionsData.length);
      // Sort by orderIndex
      questionsData.sort((a, b) => a.orderIndex - b.orderIndex);
      setQuestions(questionsData as Question[]);

      // 4. Fetch Answers
      const answersData = await getAnswers(attemptId);
      console.log("Fetched answers:", answersData.length);
      const answersMap: Record<string, number> = {};
      answersData.forEach(ans => {
        // Handle MCQ answers (selectedOptionIndex)
        if (ans.selectedOptionIndex !== undefined && ans.selectedOptionIndex !== null) {
          answersMap[ans.questionId] = ans.selectedOptionIndex;
        }
      });
      setUserAnswers(answersMap);

    } catch (err) {
      console.error("Error loading review:", err);
      setError("Failed to load exam review. " + (err instanceof Error ? err.message : ""));
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
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/results")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{examTitle} - Review</h1>
            <p className="text-muted-foreground">
              Score: {attemptData?.totalScore} / {attemptData?.maxScore}
            </p>
          </div>
        </div>

        {questions.length > 0 ? (
          <div className="space-y-6">
            {questions.map((q, index) => (
              <div key={q.questionId} className="max-w-4xl mx-auto w-full">
                <QuestionCard
                  questionNumber={index + 1}
                  questionText={q.questionText}
                  options={q.options}
                  selectedOption={userAnswers[q.questionId] ?? null}
                  correctOption={q.correctOptionIndex}
                  feedbackType="hidden" // We force "hidden" so QuestionCard doesn't do its own interactive feedback logic, but uses isSubmitted + correctOption
                  isSubmitted={true}
                  onSelectOption={() => {}} // Read-only
                  marks={q.marks}
                  explanation={q.explanation}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 max-w-4xl mx-auto">
            <p className="text-muted-foreground">No questions found for this exam.</p>
          </div>
        )}
        
        <div className="flex justify-center pt-8">
            <Button onClick={() => navigate("/dashboard/results")} size="lg">
                Back to Results
            </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReviewExam;
