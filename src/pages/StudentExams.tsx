import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getPublishedExams } from "@/lib/firebase-exams";
import { getStudentAttempts } from "@/lib/firebase-attempts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ExamCard } from "@/components/exam/ExamCard";
import { OfflineExamsSection } from "@/components/exam/OfflineExamsSection";
import { DepartmentDownloads } from "@/components/department/DepartmentDownloads";
import { Loader2, ClipboardList, Send, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

interface ExamData {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  start_time: string | null;
  end_time: string | null;
  is_published: boolean;
  question_count?: number;
  allow_offline_download?: boolean;
  max_attempts?: number;
  attempt_count?: number;
}

const StudentExams = () => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [exams, setExams] = useState<ExamData[]>([]);
  const [attemptedExamIds, setAttemptedExamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();

  useEffect(() => {
    if (user && profile) {
      fetchExams();
    }
  }, [user, profile]);

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

  const fetchExams = async () => {
    if (!user) {
      console.log("⏳ Waiting for user...");
      return;
    }

    try {
      console.log("📚 Fetching exams for student:", user.uid);
      console.log("Department ID:", profile?.departmentId);
      
      // Pass the student's department ID to filter exams
      const examsData = await getPublishedExams(profile?.departmentId);
      console.log(`✓ Found ${examsData.length} published exams`);
      
      const attempts = await getStudentAttempts(user.uid);
      console.log(`✓ Found ${attempts.length} attempts`);

      // Count attempts per exam
      const attemptsByExam = new Map<string, number>();
      attempts.forEach(attempt => {
        const count = attemptsByExam.get(attempt.examId) || 0;
        attemptsByExam.set(attempt.examId, count + 1);
      });

      const mappedExams = examsData.map(exam => ({
        id: exam.examId,
        title: exam.title,
        description: exam.description,
        duration_minutes: exam.durationMinutes,
        start_time: exam.startTime?.toDate().toISOString() || null,
        end_time: exam.endTime?.toDate().toISOString() || null,
        is_published: exam.isPublished,
        question_count: exam.questionCount,
        allow_offline_download: exam.allowOfflineDownload || false,
        max_attempts: exam.maxAttempts || 1,
        attempt_count: attemptsByExam.get(exam.examId) || 0
      }));

      setAttemptedExamIds(new Set(attempts.map((a) => a.examId)));
      setExams(mappedExams);
      console.log("✓ Exams loaded successfully");
    } catch (error: any) {
      console.error("❌ Error fetching exams:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      toast({
        title: "Error loading exams",
        description: error.message || "Please refresh the page",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!user || !profile) return;
    if (!message.trim()) {
      toast({ title: "Write a message", description: "Please enter your comment.", variant: "destructive" });
      return;
    }
    try {
      setSending(true);
      await addDoc(collection(db, "studentFeedback"), {
        userId: user.uid,
        email: profile.email,
        fullName: profile.full_name,
        departmentId: profile.departmentId || null,
        message: message.trim(),
        status: "open",
        createdAt: Timestamp.now(),
      });
      setMessage("");
      toast({ title: "Sent", description: "Your comment has been sent to the admins." });
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Filter exams by search query
  const filteredExams = exams.filter((exam) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      exam.title.toLowerCase().includes(query) ||
      exam.description?.toLowerCase().includes(query)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold">
            {t("student.exams.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("student.exams.subtitle")}
          </p>
        </div>

        {/* Search Bar */}
        {!loading && exams.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search exams by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredExams.length > 0 ? (
          <>
            {/* Offline Exams Section - Mobile Only */}
            <div className="sm:hidden">
              <OfflineExamsSection departmentId={profile?.departmentId} isOnline={isOnline} />
            </div>

            {/* Department Downloads Section - Desktop Only */}
            <div className="hidden sm:block">
              {profile?.departmentId && (
                <DepartmentDownloads 
                  departmentId={profile.departmentId}
                  exams={exams.map(e => ({
                    examId: e.id,
                    title: e.title,
                    description: e.description,
                    durationMinutes: e.duration_minutes,
                    questionCount: e.question_count || 0,
                    allowOfflineDownload: e.allow_offline_download || false,
                    examType: 'normal' as const,
                    maxAttempts: e.max_attempts || 1,
                    isPublished: e.is_published,
                    createdBy: '',
                    totalMarks: 0,
                    shuffleQuestions: false,
                    shuffleOptions: false,
                    startTime: e.start_time ? new Date(e.start_time) : null,
                    endTime: e.end_time ? new Date(e.end_time) : null,
                    resultsPublished: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  } as any))}
                />
              )}
            </div>

            {/* Available Exams */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t("student.exams.available") || "Available Exams"}</h2>
                <p className="text-sm text-muted-foreground">
                  {isOnline ? '🟢 Online' : '🔴 Offline'}
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    hasAttempted={attemptedExamIds.has(exam.id)}
                    showOfflineDownload={true}
                    departmentId={profile?.departmentId}
                  />
                ))}
              </div>
            </div>
          </>
        ) : exams.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium">No exams found</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">
              No exams match your search. Try a different search term.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium">{t("student.exams.empty.title")}</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">
              {t("student.exams.empty.description")}
            </p>
          </div>
        )}

        {/* Feedback to Admins */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Contact Admins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your comment or question to the admins..."
              rows={4}
            />
            <div className="flex justify-end">
              <Button onClick={submitFeedback} disabled={sending}>
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentExams;
