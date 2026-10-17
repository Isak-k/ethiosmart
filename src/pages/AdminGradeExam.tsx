import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getExam } from "@/lib/firebase-exams";
import { getAttempt, getAnswers, saveAnswerGrade } from "@/lib/firebase-attempts";
import { deleteAttemptProtected } from "@/lib/firebase-admin-protected";
import { getQuestions } from "@/lib/firebase-exams";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, AlertCircle, CheckCircle, XCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";

interface QuestionData {
  questionId: string;
  questionText: string;
  questionType: 'mcq' | 'truefalse' | 'shortanswer' | 'essay';
  options?: string[];
  correctOptionIndex?: number;
  correctAnswer?: string;
  marks: number;
  orderIndex: number;
  explanation?: string;
}

interface AnswerData {
  questionId: string;
  selectedOptionIndex?: number | null;
  studentAnswer?: string;
  isCorrect?: boolean | null;
  manualGrade?: number | null;
}

interface AttemptData {
  attemptId: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  totalScore: number;
  maxScore: number;
  submittedAt: any;
}

const AdminGradeExam = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { canGradeExams } = useGranularPermissions();
  
  // Any admin can delete results
  const canDeleteResults = profile?.role === 'admin' || profile?.role === 'superadmin' || user?.email === 'isak@gmail.com';

  const [loading, setLoading] = useState(true);
  const [examTitle, setExamTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerData>>({});
  const [attemptData, setAttemptData] = useState<AttemptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gradingInProgress, setGradingInProgress] = useState(false);
  const [editingGrades, setEditingGrades] = useState<Record<string, number>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (attemptId && user) {
      loadGradingData();
    }
  }, [attemptId, user]);

  const loadGradingData = async () => {
    try {
      if (!attemptId || !user) return;

      // Check permission first
      if (!canGradeExams()) {
        setError("You do not have permission to grade exams.");
        setLoading(false);
        return;
      }

      // 1. Fetch Attempt
      const attempt = await getAttempt(attemptId);
      if (!attempt) {
        setError("Attempt not found");
        setLoading(false);
        return;
      }

      setAttemptData({
        attemptId: attempt.attemptId,
        examId: attempt.examId,
        studentId: attempt.studentId,
        studentName: attempt.studentName || "Unknown",
        studentEmail: attempt.studentEmail || "N/A",
        totalScore: attempt.totalScore || 0,
        maxScore: attempt.maxScore || 0,
        submittedAt: attempt.submittedAt,
      });

      // 2. Fetch Exam
      const exam = await getExam(attempt.examId);
      if (!exam) {
        setError("Exam not found");
        setLoading(false);
        return;
      }

      setExamTitle(exam.title);

      // 3. Fetch Questions (ALL types)
      const questionsData = await getQuestions(attempt.examId);
      questionsData.sort((a, b) => a.orderIndex - b.orderIndex);
      setQuestions(questionsData as QuestionData[]);

      // 4. Fetch Answers
      const answersData = await getAnswers(attemptId);
      const answersMap: Record<string, AnswerData> = {};
      answersData.forEach(ans => {
        answersMap[ans.questionId] = {
          questionId: ans.questionId,
          selectedOptionIndex: ans.selectedOptionIndex,
          studentAnswer: ans.studentAnswer,
          isCorrect: ans.isCorrect,
          manualGrade: ans.manualGrade,
        };
      });
      setAnswers(answersMap);

    } catch (err) {
      console.error("Error loading grading data:", err);
      setError("Failed to load exam for grading.");
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (questionId: string, grade: string) => {
    const marks = parseInt(grade) || 0;
    const question = questions.find(q => q.questionId === questionId);
    if (marks <= (question?.marks || 0)) {
      setEditingGrades({
        ...editingGrades,
        [questionId]: marks,
      });
    }
  };

  const handleSaveGrade = async (questionId: string) => {
    const grade = editingGrades[questionId];
    if (grade === undefined) return;

    const question = questions.find(q => q.questionId === questionId);
    if (!question || !attemptId) return;

    setGradingInProgress(true);
    try {
      const isCorrect = grade === question.marks;
      await saveAnswerGrade(attemptId, questionId, grade, isCorrect, user?.uid);

      setAnswers({
        ...answers,
        [questionId]: {
          ...answers[questionId],
          manualGrade: grade,
          isCorrect: isCorrect,
        },
      });

      setEditingGrades({
        ...editingGrades,
        [questionId]: undefined,
      });

      toast({
        title: "Grade saved",
        description: `Question graded with ${grade}/${question.marks} marks`,
      });
    } catch (err) {
      console.error("Error saving grade:", err);
      toast({
        title: "Error",
        description: "Failed to save grade",
        variant: "destructive",
      });
    } finally {
      setGradingInProgress(false);
    }
  };

  const handleDeleteAttempt = async () => {
    if (!attemptId || !user || !canDeleteResults) return;

    setDeleting(true);
    try {
      // Convert profile to UserProfile format for the protected function
      const userProfile = profile ? {
        userId: profile.id || user.uid,
        email: user.email || profile.email || '',
        fullName: profile.full_name || '',
        avatarUrl: profile.avatar_url || null,
        role: profile.role as any,
        permissions: (profile as any).permissions,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      } : null;

      await deleteAttemptProtected(userProfile, attemptId);
      toast({
        title: "Result deleted",
        description: `${attemptData?.studentName}'s exam result has been permanently deleted.`,
      });
      
      // Redirect back after successful deletion
      setTimeout(() => {
        navigate(-1);
      }, 1000);
    } catch (err: any) {
      console.error("Error deleting attempt:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to delete exam result",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const renderQuestionAnswer = (question: QuestionData, answer?: AnswerData) => {
    const isAutoGraded = question.questionType === 'mcq' || question.questionType === 'truefalse';
    
    return (
      <Card key={question.questionId} className="border border-border">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Question Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{question.questionType.toUpperCase()}</Badge>
                  <Badge variant="secondary">{question.marks} marks</Badge>
                </div>
                <p className="text-lg font-semibold mt-2">{question.questionText}</p>
              </div>
            </div>

            {/* Question Type Specific Display */}
            {question.questionType === 'mcq' || question.questionType === 'truefalse' ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">Options:</p>
                <div className="space-y-2">
                  {question.options?.map((option, index) => {
                    const isSelected = answer?.selectedOptionIndex === index;
                    const isCorrect = index === question.correctOptionIndex;
                    const isWrong = isSelected && !isCorrect;

                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          isCorrect
                            ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                            : isWrong
                            ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                            : isSelected
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{option}</span>
                          <div className="flex items-center gap-2">
                            {isCorrect && <CheckCircle className="w-4 h-4 text-green-600" />}
                            {isWrong && <XCircle className="w-4 h-4 text-red-600" />}
                            {isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-600" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {answer?.isCorrect !== null && (
                  <div className="mt-2 p-3 rounded-lg bg-muted">
                    <Badge variant={answer.isCorrect ? "default" : "destructive"}>
                      {answer.isCorrect ? "Correct" : "Incorrect"}
                    </Badge>
                  </div>
                )}
                {question.explanation && (
                  <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Explanation:</p>
                    <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">{question.explanation}</p>
                  </div>
                )}
              </div>
            ) : question.questionType === 'shortanswer' ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Student Answer:</p>
                  <p className="p-3 rounded-lg bg-muted border border-border mt-1">
                    {answer?.studentAnswer || "No answer provided"}
                  </p>
                </div>
                {question.correctAnswer && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Expected Answer:</p>
                    <p className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 mt-1">
                      {question.correctAnswer}
                    </p>
                  </div>
                )}
                <div className="pt-2">
                  <p className="text-sm font-semibold mb-2">Grade:</p>
                  <div className="flex items-center gap-2">
                    {editingGrades[question.questionId] === undefined ? (
                      <>
                        {answer?.manualGrade !== undefined ? (
                          <>
                            <Badge variant="secondary">
                              {answer.manualGrade}/{question.marks}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEditingGrades({
                                  ...editingGrades,
                                  [question.questionId]: answer.manualGrade || 0,
                                })
                              }
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditingGrades({
                                ...editingGrades,
                                [question.questionId]: 0,
                              })
                            }
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Grade
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Input
                          type="number"
                          min="0"
                          max={question.marks}
                          value={editingGrades[question.questionId] ?? ""}
                          onChange={(e) => handleGradeChange(question.questionId, e.target.value)}
                          placeholder="Enter marks"
                          className="max-w-[100px]"
                          autoFocus
                        />
                        <span className="text-sm text-muted-foreground">/ {question.marks}</span>
                        <Button
                          size="sm"
                          onClick={() => handleSaveGrade(question.questionId)}
                          disabled={gradingInProgress}
                        >
                          {gradingInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditingGrades({
                              ...editingGrades,
                              [question.questionId]: undefined,
                            })
                          }
                          disabled={gradingInProgress}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : question.questionType === 'essay' ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Student Answer:</p>
                  <div className="p-3 rounded-lg bg-muted border border-border mt-1 max-h-48 overflow-y-auto">
                    {answer?.studentAnswer || "No answer provided"}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">Grade:</p>
                  {editingGrades[question.questionId] === undefined ? (
                    <div className="flex items-center gap-2">
                      {answer?.manualGrade !== undefined ? (
                        <>
                          <Badge variant="secondary">
                            {answer.manualGrade}/{question.marks}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditingGrades({
                                ...editingGrades,
                                [question.questionId]: answer.manualGrade || 0,
                              })
                            }
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditingGrades({
                              ...editingGrades,
                              [question.questionId]: 0,
                            })
                          }
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Grade
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max={question.marks}
                          value={editingGrades[question.questionId] ?? ""}
                          onChange={(e) => handleGradeChange(question.questionId, e.target.value)}
                          placeholder="Enter marks"
                          className="max-w-[100px]"
                          autoFocus
                        />
                        <span className="text-sm text-muted-foreground">/ {question.marks}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveGrade(question.questionId)}
                          disabled={gradingInProgress}
                        >
                          {gradingInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Grade"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditingGrades({
                              ...editingGrades,
                              [question.questionId]: undefined,
                            })
                          }
                          disabled={gradingInProgress}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
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
          <Button onClick={() => navigate(-1)}>
            Back to Results
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <Alert variant="destructive" className="border-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Delete Student Result?</AlertTitle>
            <AlertDescription>
              <p className="mb-4">
                Are you sure you want to permanently delete <strong>{attemptData?.studentName}</strong>'s exam result? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteAttempt}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete Result
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{examTitle} - Grade</h1>
              <p className="text-muted-foreground">
                Student: {attemptData?.studentName} ({attemptData?.studentEmail})
              </p>
            </div>
          </div>
          {canDeleteResults && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Result
            </Button>
          )}
        </div>

        {/* Questions and Answers */}
        <div className="space-y-4">
          {questions.map((question) => {
            const answer = answers[question.questionId];
            return renderQuestionAnswer(question, answer);
          })}
        </div>

        <div className="flex justify-center pt-8">
          <Button onClick={() => navigate(-1)} size="lg">
            Back to Results
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminGradeExam;
