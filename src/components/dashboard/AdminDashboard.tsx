import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminDashboardData } from "@/lib/firebase-admin";
import { StatCard } from "./StatCard";
import { ExamCard } from "@/components/exam/ExamCard";
import { FileText, Users, ClipboardCheck, TrendingUp, Plus, AlertCircle, Lock, Globe, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSectionPermissions } from "@/hooks/useSectionPermissions";
import { useToast } from "@/hooks/use-toast";
import { setRequireStudentLogin } from "@/lib/system-settings";

interface ExamWithStats {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  start_time: string | null;
  end_time: string | null;
  is_published: boolean;
  question_count: number;
  attempt_count: number;
}

interface DashboardStats {
  totalExams: number;
  totalStudents: number;
  activeExams: number;
  completedAttempts: number;
}

export function AdminDashboard() {
  const { profile, user, requireStudentLogin } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { canEdit } = useSectionPermissions();
  const [stats, setStats] = useState<DashboardStats>({
    totalExams: 0,
    totalStudents: 0,
    activeExams: 0,
    completedAttempts: 0,
  });
  const [recentExams, setRecentExams] = useState<ExamWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTogglingLogin, setIsTogglingLogin] = useState(false);

  const handleToggleStudentLogin = async () => {
    setIsTogglingLogin(true);
    const newRequirement = !requireStudentLogin;
    try {
      await setRequireStudentLogin(newRequirement, user?.uid || 'admin');
      toast({
        title: newRequirement ? "🔒 Login Enforced" : "🌐 Open Access Enabled",
        description: newRequirement
          ? "Students must now log in or sign up before accessing the app."
          : "Students can now use the app directly without logging in (Guest Mode active).",
      });
    } catch (err: any) {
      toast({
        title: "Failed to update access mode",
        description: err.message || "An error occurred while updating settings.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingLogin(false);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const data = await getAdminDashboardData();
        
        setStats(data.stats);
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors({});
        }
  
        const mappedExams = data.recentExams.map(exam => {
          let startTime = null;
          let endTime = null;
  
          try {
            if (exam.startTime && typeof (exam.startTime as any).toDate === 'function') {
              startTime = (exam.startTime as any).toDate().toISOString();
            } else if (exam.startTime) {
               // Fallback if it's already a date string or object
               startTime = new Date(exam.startTime as any).toISOString();
            }
          } catch (e) {
            console.warn("Invalid start time for exam:", exam.examId);
          }
  
          try {
            if (exam.endTime && typeof (exam.endTime as any).toDate === 'function') {
              endTime = (exam.endTime as any).toDate().toISOString();
            } else if (exam.endTime) {
               endTime = new Date(exam.endTime as any).toISOString();
            }
          } catch (e) {
            console.warn("Invalid end time for exam:", exam.examId);
          }
  
          return {
            id: exam.examId,
            title: exam.title,
            description: exam.description,
            duration_minutes: exam.durationMinutes,
            start_time: startTime,
            end_time: endTime,
            is_published: exam.isPublished,
            question_count: exam.questionCount,
            attempt_count: exam.attemptCount
          };
        });
  
        setRecentExams(mappedExams);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold">
            {t("dashboard.welcome", { name: profile?.full_name?.split(" ")[0] })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("dashboard.adminSubtitle")}
          </p>
        </div>
      </div>

      {/* Student Access Mode Control Card */}
      <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all ${
        requireStudentLogin 
          ? "bg-card border-border/80 shadow-xs" 
          : "bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/20 shadow-sm"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
              requireStudentLogin 
                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" 
                : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            }`}>
              {requireStudentLogin ? <Lock className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-bold text-base text-foreground">
                  Student Access Control
                </h3>
                <Badge
                  variant="outline"
                  className={
                    requireStudentLogin
                      ? "border-purple-500/40 text-purple-700 dark:text-purple-300 bg-purple-500/10 font-bold text-[11px]"
                      : "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 font-bold text-[11px]"
                  }
                >
                  {requireStudentLogin ? "🔒 Login Required (Enforced)" : "🌐 Open Access (Login Hidden)"}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {requireStudentLogin
                  ? "Students must log in or register before accessing exams and study notes."
                  : "Students can freely access exams and study notes without logging in. First-time students simply enter their name and department."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-semibold text-foreground block">
                {requireStudentLogin ? "Enforce Login" : "Guest Mode"}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                {requireStudentLogin ? "Click to open for all" : "Click to require login"}
              </span>
            </div>
            <Button
              variant={requireStudentLogin ? "outline" : "default"}
              size="sm"
              disabled={isTogglingLogin}
              onClick={handleToggleStudentLogin}
              className={`rounded-xl font-bold text-xs h-9 px-4 ${
                !requireStudentLogin
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
              }`}
            >
              {isTogglingLogin ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Updating...
                </>
              ) : requireStudentLogin ? (
                <>
                  <Globe className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  Make Open (Hide Login)
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  Require Student Login
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="space-y-2">
          {errors.exams && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error fetching exams</AlertTitle>
              <AlertDescription>{errors.exams}</AlertDescription>
            </Alert>
          )}
          {errors.students && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error fetching students</AlertTitle>
              <AlertDescription>{errors.students}</AlertDescription>
            </Alert>
          )}
          {errors.attempts && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error fetching attempts</AlertTitle>
              <AlertDescription>{errors.attempts}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <StatCard
            title={t("dashboard.stats.totalExams")}
            value={stats.totalExams}
            icon={<FileText className="h-6 w-6" />}
            className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-100 dark:border-blue-900/50"
          />
          <StatCard
            title={t("dashboard.stats.activeExams")}
            value={stats.activeExams}
            icon={<TrendingUp className="h-6 w-6" />}
            className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background border-green-100 dark:border-green-900/50"
          />
          <StatCard
            title={t("dashboard.stats.totalStudents")}
            value={stats.totalStudents}
            icon={<Users className="h-6 w-6" />}
            className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background border-amber-100 dark:border-amber-900/50"
          />
          <StatCard
            title={t("dashboard.stats.completedAttempts")}
            value={stats.completedAttempts}
            icon={<ClipboardCheck className="h-6 w-6" />}
            className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background border-purple-100 dark:border-purple-900/50"
          />
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t("dashboard.recentActivity")}
          </h2>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : recentExams.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                isAdmin={true}
                hideActions={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-muted-foreground/20">
            <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">{t("dashboard.noExamsYet")}</h3>
            <p className="text-muted-foreground text-sm max-w-[250px] mx-auto mb-4">
              {t("dashboard.createFirstExam")}
            </p>
            {canEdit('manageExams') && (
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/exams/new">
                  <Plus className="h-3 w-3 mr-2" />
                  {t("dashboard.createExam")}
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
