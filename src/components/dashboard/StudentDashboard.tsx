import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getPublishedExams } from "@/lib/firebase-exams";
import { getStudentAttempts } from "@/lib/firebase-attempts";
import { getCachedDefaultDepartmentId } from "@/lib/system-settings";
import { SimpleLeaderboard } from "@/components/SimpleLeaderboard";
import { StatCard } from "./StatCard";
import { ExamCard } from "@/components/exam/ExamCard";
import { ClipboardList, Trophy, Clock, CheckCircle, Sparkles, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { EthioAccentBar } from "@/components/ui/EthioAccentBar";
import { LiquidTiltCard } from "@/components/ui/LiquidTiltCard";

interface ExamData {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  start_time: string | null;
  end_time: string | null;
  is_published: boolean;
}

interface StudentStats {
  availableExams: number;
  completedExams: number;
  averageScore: number;
  upcomingExams: number;
}

export function StudentDashboard() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState<StudentStats>({
    availableExams: 0,
    completedExams: 0,
    averageScore: 0,
    upcomingExams: 0,
  });
  const [upcomingExams, setUpcomingExams] = useState<ExamData[]>([]);
  const [attemptedExamIds, setAttemptedExamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        const defaultDeptId = getCachedDefaultDepartmentId();
        const effectiveDeptId = defaultDeptId || profile?.departmentId;

        // Fetch published exams with department filter
        const examsData = await getPublishedExams(effectiveDeptId);
        
        // Fetch user's attempts
        const attempts = await getStudentAttempts(user.uid);

        const mappedExams = examsData.map(exam => ({
          id: exam.examId,
          title: exam.title,
          description: exam.description,
          duration_minutes: exam.durationMinutes,
          start_time: exam.startTime?.toDate().toISOString() || null,
          end_time: exam.endTime?.toDate().toISOString() || null,
          is_published: exam.isPublished
        }));

        const attemptedIds = new Set(attempts.map((a) => a.examId));
        setAttemptedExamIds(attemptedIds);

        const now = new Date();
        const active = mappedExams.filter(
          (e) =>
            (!e.start_time || new Date(e.start_time) <= now) &&
            (!e.end_time || new Date(e.end_time) >= now) &&
            !attemptedIds.has(e.id)
        );

        const upcoming = mappedExams.filter(
          (e) => e.start_time && new Date(e.start_time) > now
        );

        const completed = attempts.filter((a) => a.isSubmitted);
        const totalScore = completed.reduce((sum, a) => sum + (a.totalScore || 0), 0);
        const maxScore = completed.reduce((sum, a) => sum + (a.maxScore || 0), 0);
        const avgScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

        setStats({
          availableExams: active.length,
          completedExams: completed.length,
          averageScore: avgScore,
          upcomingExams: upcoming.length,
        });

        setUpcomingExams(upcoming.slice(0, 4));
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user && profile) {
      fetchDashboardData();
    }
  }, [user, profile]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Welcome & Identity Card - Liquid Glass Hero with Fluid Caustics & 3D Tilt */}
      <LiquidTiltCard maxTilt={3} glareOpacity={0.2} className="liquid-glass-hero relative overflow-hidden rounded-3xl p-5 sm:p-7 shadow-xl shadow-sky-500/10">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/40 dark:bg-white/10 backdrop-blur-md text-sky-800 dark:text-sky-200 border border-white/60 dark:border-white/20 shadow-xs">
              <Sparkles className="h-3 w-3 text-sky-600 dark:text-sky-300" />
              <span>EthioSmart • Learn • Practice • Grow</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground dark:text-white">
              {t("dashboard.welcome", { name: profile?.full_name?.split(" ")[0] || "Student" })}
            </h1>
            <p className="text-muted-foreground dark:text-slate-300 text-xs sm:text-sm max-w-md leading-relaxed font-normal">
              Your smart educational hub for textbooks, practice exams, and AI-powered learning.
            </p>
          </div>
        </div>
        <EthioAccentBar className="absolute bottom-0 left-0 right-0" size="sm" />
      </LiquidTiltCard>

      {/* Academic Stats */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Academic Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <StatCard
            title={t("dashboard.stats.availableExams")}
            value={stats.availableExams}
            icon={<ClipboardList className="h-6 w-6" />}
            className="bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/30 dark:to-background border-blue-100 dark:border-blue-900/50 shadow-xs"
          />
          <StatCard
            title={t("dashboard.stats.completedExams")}
            value={stats.completedExams}
            icon={<CheckCircle className="h-6 w-6" />}
            className="bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-background border-emerald-100 dark:border-emerald-900/50 shadow-xs"
          />
          <StatCard
            title={t("dashboard.stats.averageScore")}
            value={`${stats.averageScore}%`}
            icon={<Trophy className="h-6 w-6" />}
            className="bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/30 dark:to-background border-amber-100 dark:border-amber-900/50 shadow-xs"
          />
          <StatCard
            title={t("dashboard.stats.upcomingExams")}
            value={stats.upcomingExams}
            icon={<Clock className="h-6 w-6" />}
            className="bg-gradient-to-br from-purple-50/80 to-white dark:from-purple-950/30 dark:to-background border-purple-100 dark:border-purple-900/50 shadow-xs"
          />
        </div>
      </div>

      {/* Leaderboard Section */}
      {(getCachedDefaultDepartmentId() || profile?.departmentId) && (
        <div className="w-full">
          <SimpleLeaderboard departmentId={(getCachedDefaultDepartmentId() || profile?.departmentId)!} />
        </div>
      )}

      {/* Community Study Lounge Quick Jump Banner */}
      <Link
        to="/dashboard/community"
        className="block group rounded-3xl p-5 border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-sky-500/10 hover:border-indigo-500/60 hover:shadow-lg transition-all"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Join the Student Community Lounge
                </h3>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground">
                Discuss questions, share exam tips, and study with classmates across all departments.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold self-start sm:self-center h-9 px-4 pointer-events-none"
          >
            Open Community Chat →
          </Button>
        </div>
      </Link>

      {/* Upcoming Scheduled Exams (only if any are scheduled for future dates) */}
      {!loading && upcomingExams.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold flex items-center gap-2 text-foreground">
              <Clock className="h-5 w-5 text-primary" />
              {t("dashboard.upcomingExams")}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {upcomingExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                hasAttempted={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
