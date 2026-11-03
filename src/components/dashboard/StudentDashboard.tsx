import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getPublishedExams } from "@/lib/firebase-exams";
import { getStudentAttempts } from "@/lib/firebase-attempts";
import { getCachedDefaultDepartmentId } from "@/lib/system-settings";
import { SimpleLeaderboard } from "@/components/SimpleLeaderboard";
import { StatCard } from "./StatCard";
import { ExamCard } from "@/components/exam/ExamCard";
import { ClipboardList, Trophy, Clock, CheckCircle, ArrowRight, BookOpen, Brain, Sparkles, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
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

          <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
            <Link
              to="/dashboard/books"
              className="liquid-glass-button inline-flex items-center justify-center text-xs sm:text-sm h-10 px-4 active:scale-95 transition-all shadow-md"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Study Library
            </Link>
            <Link
              to="/dashboard/exams"
              className="liquid-glass-button-secondary inline-flex items-center justify-center text-xs sm:text-sm h-10 px-3.5 active:scale-95 transition-all"
            >
              <ClipboardList className="h-4 w-4 mr-1.5 text-sky-500 dark:text-sky-300" />
              Exams
            </Link>
          </div>
        </div>
        <EthioAccentBar className="absolute bottom-0 left-0 right-0" size="sm" />
      </LiquidTiltCard>

      {/* Educational Quick Launch Hub - Mobile First 3 Actions in Interactive Liquid Glass Tilt Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Action 1: Digital Library */}
        <LiquidTiltCard maxTilt={6}>
          <Link
            to="/dashboard/books"
            className="liquid-glass-card group relative p-4 sm:p-5 rounded-3xl hover:border-sky-400/60 shadow-xs hover:shadow-xl transition-all duration-300 flex items-center sm:flex-col sm:items-start gap-3.5 active:scale-[0.98] h-full"
          >
            <div className="h-12 w-12 rounded-2xl liquid-glass-squircle bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm sm:text-base text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                  Digital Library
                </h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all sm:hidden" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-2">
                Curriculum textbooks & high-yield chapter notes
              </p>
            </div>
          </Link>
        </LiquidTiltCard>

        {/* Action 2: Practice & Exams */}
        <LiquidTiltCard maxTilt={6}>
          <Link
            to="/dashboard/exams"
            className="liquid-glass-card group relative p-4 sm:p-5 rounded-3xl hover:border-sky-400/60 shadow-xs hover:shadow-xl transition-all duration-300 flex items-center sm:flex-col sm:items-start gap-3.5 active:scale-[0.98] h-full"
          >
            <div className="h-12 w-12 rounded-2xl liquid-glass-squircle bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm sm:text-base text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Practice & Exams
                </h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all sm:hidden" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-2">
                Practice tests, model questions & official examinations
              </p>
            </div>
          </Link>
        </LiquidTiltCard>

        {/* Action 3: AI Study Assistant */}
        <LiquidTiltCard maxTilt={6}>
          <Link
            to="/dashboard/ai-assistant"
            className="liquid-glass-card group relative p-4 sm:p-5 rounded-3xl hover:border-sky-400/60 shadow-xs hover:shadow-xl transition-all duration-300 flex items-center sm:flex-col sm:items-start gap-3.5 active:scale-[0.98] h-full"
          >
            <div className="h-12 w-12 rounded-2xl liquid-glass-squircle bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Brain className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm sm:text-base text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  AI Study Assistant
                </h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all sm:hidden" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-2">
                Ask doubts, explain concepts & test understanding
              </p>
            </div>
          </Link>
        </LiquidTiltCard>
      </div>

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
