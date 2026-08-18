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
import { Question, Answer } from "@/integrations/firebase/types";
import { Card, CardContent } from "@/components/ui/card";

interface AttemptData {
  attemptId: string;
  examId: string;
  studentId: string;
  totalScore: number;
  maxScore: number;
}

interface QuestionReviewData {
  question: Question;
  answer: Answer | null;
}

const ReviewExam = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [examTitle, setExamTitle] = useState("");
  const [questionsReview, setQuestionsReview] = useState<QuestionReviewData[]>([]);
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
      if (attempt.studentId !== user.uid) {
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
      
      // 4. Fetch Answers
      const answersData = await getAnswers(attemptId);
      console.log("Fetched answers:", answersData.length);
      
      // Create a map of answers by questionId for quick lookup
      const answersMap = new Map<string, Answer>();
      answersData.forEach(ans => {
        answersMap.set(ans.questionId, ans);
      });

      // Sort questions by orderIndex and pair with answers
      questionsData.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      
      const reviewData: QuestionReviewData[] = questionsData.map(q => ({
        question: q,
        answer: answersMap.get(q.questionId) || null
      }));

      setQuestionsReview(reviewData);

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
        <div className="flex items-center gap-4 max-w-4xl mx-auto w-full">
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

        {questionsReview.length > 0 ? (
          <div className="space-y-6">
            {questionsReview.map((qr, index) => {
              const q = qr.question;
              const answer = qr.answer;
              
              // Handle MCQ questions
              if (q.questionType === 'mcq' && 'options' in q) {
                return (
                  <div key={q.questionId} className="max-w-4xl mx-auto w-full">
                    <QuestionCard
                      questionNumber={index + 1}
                      questionText={q.questionText}
                      options={q.options}
                      selectedOption={answer?.selectedOptionIndex ?? null}
                      correctOption={q.correctOptionIndex}
                      feedbackType="hidden"
                      isSubmitted={true}
                      onSelectOption={() => {}}
                      marks={q.marks}
                      explanation={q.explanation}
                    />
                  </div>
                );
              }
              
              // Handle True/False questions
              if (q.questionType === 'true-false') {
                const options = ['True', 'False'];
                const correctIdx = q.correctAnswer ? 0 : 1;
                const selectedIdx = answer?.selectedBoolean !== undefined ? (answer.selectedBoolean ? 0 : 1) : null;
                
                return (
                  <div key={q.questionId} className="max-w-4xl mx-auto w-full">
                    <QuestionCard
                      questionNumber={index + 1}
                      questionText={q.questionText}
                      options={options}
                      selectedOption={selectedIdx}
                      correctOption={correctIdx}
                      feedbackType="hidden"
                      isSubmitted={true}
                      onSelectOption={() => {}}
                      marks={q.marks}
                      explanation={q.explanation}
                    />
                  </div>
                );
              }
              
              // Handle Short Answer & Essay questions - display as read-only cards
              if (q.questionType === 'short-answer' || q.questionType === 'essay') {
                return (
                  <Card key={q.questionId} className="max-w-4xl mx-auto w-full">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-start justify-between gap-3 sm:gap-4">
                        <div className="flex gap-3 sm:gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-display font-semibold">
                            {index + 1}
                          </div>
                          <div className="space-y-1">
                            <p className="text-base font-medium leading-relaxed sm:text-lg">{q.questionText}</p>
                            <p className="text-sm text-muted-foreground">Marks: {q.marks}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-muted/50 p-4 rounded-lg border">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Your Answer:</p>
                        <p className="text-base whitespace-pre-wrap">{answer?.textAnswer || "No answer provided"}</p>
                      </div>
                      
                      {q.questionType === 'essay' && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            {answer?.answerStatus === 'graded' 
                              ? `Graded: ${answer.rubricScore} points awarded`
                              : 'Awaiting manual grading'}
                          </p>
                        </div>
                      )}
                      
                      {q.explanation && (
                        <div className="bg-gradient-to-br from-muted/60 to-background p-4 rounded-lg border">
                          <p className="text-sm font-medium mb-2">Explanation:</p>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{q.explanation}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }
              
              return null;
            })}
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
