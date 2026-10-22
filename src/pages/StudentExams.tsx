import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getPublishedExams, getAllExams } from "@/lib/firebase-exams";
import { getStudentAttempts } from "@/lib/firebase-attempts";
import { getSubjects, getChapters } from "@/lib/subjects";
import { calculateAllSubjectsProgress } from "@/lib/subject-progress";
import { getSubjectCover } from "@/lib/subject-covers";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ExamCard } from "@/components/exam/ExamCard";
import { SubjectCard } from "@/components/subject/SubjectCard";
import {
  Loader2,
  ClipboardList,
  Search,
  BookOpen,
  X,
  ArrowLeft,
  Layers,
  CheckCircle2,
  Trophy,
  Sparkles,
  GraduationCap,
  FileText,
  Clock,
  ChevronRight
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Subject, Chapter, StudentSubjectProgress } from "@/types/subject";

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
  departmentId?: string;
  departmentIds?: string[];
  subjectId?: string;
  chapterId?: string;
  chapterTitle?: string;
}

interface ChapterGroup {
  id: string;
  title: string;
  chapterNumber?: number;
  description?: string;
  exams: ExamData[];
  completedCount: number;
}

const StudentExams = () => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSubjectId = searchParams.get("subjectId") || searchParams.get("departmentId");

  const [exams, setExams] = useState<ExamData[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, StudentSubjectProgress>>({});
  const [attemptedExamIds, setAttemptedExamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Subject-specific chapters state
  const [subjectChapters, setSubjectChapters] = useState<Chapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (user && profile) {
      loadAllData();
    }
  }, [user, profile]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadAllData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch exams visible to user (admins/examiners see all including drafts; students see published)
      const isAdminUser = profile?.role === "admin" || (profile as any)?.isSuperAdmin || (profile as any)?.role === "examiner";
      const examsData = isAdminUser
        ? await getAllExams().catch(() => getPublishedExams(profile?.departmentId))
        : await getPublishedExams(profile?.departmentId);
      const attempts = await getStudentAttempts(user.uid);

      // Count attempts per exam
      const attemptsByExam = new Map<string, number>();
      attempts.forEach((attempt) => {
        const count = attemptsByExam.get(attempt.examId) || 0;
        attemptsByExam.set(attempt.examId, count + 1);
      });

      const mappedExams: ExamData[] = examsData.map((exam) => ({
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
        attempt_count: attemptsByExam.get(exam.examId) || 0,
        departmentId: exam.departmentId,
        departmentIds: exam.departmentIds || [],
        subjectId: (exam as any).subjectId,
        chapterId: (exam as any).chapterId,
        chapterTitle: (exam as any).chapterTitle,
      }));

      setAttemptedExamIds(new Set(attempts.map((a) => a.examId)));
      setExams(mappedExams);

      // 2. Fetch subjects available to student's department
      const subjectsList = await getSubjects(profile?.departmentId).catch(() => []);
      const activeSubjects = subjectsList.filter((s) => s.isActive !== false);
      setSubjects(activeSubjects);

      // 3. Calculate unit progress & curriculum coverage for each subject
      if (activeSubjects.length > 0) {
        const prog = await calculateAllSubjectsProgress(
          activeSubjects,
          user.uid,
          profile?.departmentId,
          examsData,
          attempts
        ).catch(() => ({}));
        setProgressMap(prog);
      }
    } catch (error: any) {
      console.error("Error loading exams and subjects:", error);
      toast({
        title: "Error loading exams",
        description: error.message || "Please refresh the page",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Find active subject details if a single subject is selected
  const activeSubject = useMemo(() => {
    if (!selectedSubjectId) return null;
    return subjects.find(
      (s) =>
        s.id === selectedSubjectId ||
        s.name.toLowerCase() === selectedSubjectId.toLowerCase()
    ) || null;
  }, [selectedSubjectId, subjects]);

  // Load chapters when a specific subject is selected
  useEffect(() => {
    if (activeSubject?.id) {
      setChaptersLoading(true);
      getChapters(activeSubject.id)
        .then(setSubjectChapters)
        .catch((err) => {
          console.warn("Could not load chapters for subject:", err);
          setSubjectChapters([]);
        })
        .finally(() => setChaptersLoading(false));
    } else {
      setSubjectChapters([]);
    }
  }, [activeSubject?.id]);

  // Filter exams strictly belonging to activeSubject (no other exams allowed)
  const currentSubjectExams = useMemo(() => {
    if (!activeSubject) return [];
    return exams.filter((exam) => {
      // 1. Direct subjectId link
      if (exam.subjectId && exam.subjectId === activeSubject.id) return true;
      // 2. Legacy / title match
      if (exam.title && exam.title.toLowerCase().includes(activeSubject.name.toLowerCase())) return true;
      // 3. Department ID match if mapped
      if (exam.departmentId === activeSubject.id || exam.departmentIds?.includes(activeSubject.id)) return true;
      return false;
    });
  }, [exams, activeSubject]);

  // Filtered current subject exams by search query
  const searchedCurrentSubjectExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentSubjectExams;
    return currentSubjectExams.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.chapterTitle?.toLowerCase().includes(q)
    );
  }, [currentSubjectExams, searchQuery]);

  // Organize the active subject's exams into chapters & units
  const organizedChapterGroups = useMemo(() => {
    if (!activeSubject) return [];

    const groups: ChapterGroup[] = [];
    const assignedExamIds = new Set<string>();

    // 1. If explicit chapters exist in Firestore subcollection
    subjectChapters.forEach((ch, idx) => {
      const chapterExams = searchedCurrentSubjectExams.filter((e) => {
        if (e.chapterId === ch.id) return true;
        if (e.chapterTitle && e.chapterTitle.toLowerCase().trim() === ch.title.toLowerCase().trim()) return true;
        return false;
      });

      chapterExams.forEach((e) => assignedExamIds.add(e.id));
      const completed = chapterExams.filter((e) => attemptedExamIds.has(e.id)).length;

      groups.push({
        id: ch.id,
        title: ch.title,
        chapterNumber: ch.chapterNumber ?? (idx + 1),
        description: ch.description,
        exams: chapterExams,
        completedCount: completed,
      });
    });

    // 2. Derive chapters from exam.chapterTitle if not in subcollection
    const remainingExamsWithTitle = searchedCurrentSubjectExams.filter(
      (e) => !assignedExamIds.has(e.id) && Boolean(e.chapterTitle)
    );

    const derivedTitles = Array.from(
      new Set(remainingExamsWithTitle.map((e) => e.chapterTitle!.trim()))
    );

    derivedTitles.forEach((title, idx) => {
      const chapterExams = remainingExamsWithTitle.filter(
        (e) => e.chapterTitle?.trim() === title
      );
      chapterExams.forEach((e) => assignedExamIds.add(e.id));
      const completed = chapterExams.filter((e) => attemptedExamIds.has(e.id)).length;

      groups.push({
        id: `derived_${idx}_${title}`,
        title,
        chapterNumber: groups.length + 1,
        exams: chapterExams,
        completedCount: completed,
      });
    });

    // 3. Any remaining exams in this subject without a chapter title
    const unassignedExams = searchedCurrentSubjectExams.filter(
      (e) => !assignedExamIds.has(e.id)
    );

    if (unassignedExams.length > 0) {
      const completed = unassignedExams.filter((e) => attemptedExamIds.has(e.id)).length;
      groups.push({
        id: "general_subject_assessments",
        title: groups.length > 0 ? "General Unit Assessments" : "Coursework Examinations",
        chapterNumber: groups.length > 0 ? undefined : 1,
        description: "Comprehensive assessments and module review examinations",
        exams: unassignedExams,
        completedCount: completed,
      });
    }

    return groups;
  }, [activeSubject, subjectChapters, searchedCurrentSubjectExams, attemptedExamIds]);

  // Navigate to specific subject
  const handleSelectSubject = (subjectId: string) => {
    setSearchParams({ subjectId });
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Back button: returns to all subjects view
  const handleBackToAllSubjects = () => {
    searchParams.delete("subjectId");
    searchParams.delete("departmentId");
    setSearchParams(searchParams);
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Filter subjects for the main overview by search query
  const filteredSubjectsForOverview = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
    );
  }, [subjects, searchQuery]);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in pb-16 max-w-7xl mx-auto">
        {/* ==================================================================== */}
        {/* VIEW A: SPECIFIC SUBJECT SELECTED (Chapters & Contents Only)         */}
        {/* Shows ONLY its content (chapters & exams); no subject card inside   */}
        {/* ==================================================================== */}
        {activeSubject ? (
          <div className="space-y-6">
            {/* Top Navigation Bar with Back Icon & Subject Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
              <div className="flex items-center gap-3.5">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleBackToAllSubjects}
                  className="h-11 w-11 rounded-2xl bg-card border-border/80 hover:bg-muted text-foreground shadow-xs transition-all hover:scale-105 shrink-0 cursor-pointer"
                  title="Back to all subjects"
                  aria-label="Back to all subjects"
                >
                  <ArrowLeft className="h-5 w-5 text-primary" />
                </Button>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">
                      {activeSubject.name}
                    </h1>
                    <Badge variant="secondary" className="font-semibold text-xs px-2.5 py-0.5 rounded-lg">
                      {currentSubjectExams.length} {currentSubjectExams.length === 1 ? "Assessment" : "Assessments"}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Chapters and topic assessments. Click the back arrow to view other subjects.
                  </p>
                </div>
              </div>

              {/* Search Bar for exams inside this subject */}
              {currentSubjectExams.length > 0 && (
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={`Search in ${activeSubject.name}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-9 rounded-2xl bg-card border-border/80 h-10 text-sm shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Chapters & Contents Sections */}
            {chaptersLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Loading chapters & contents...</p>
              </div>
            ) : organizedChapterGroups.length > 0 ? (
              <div className="space-y-8">
                {organizedChapterGroups.map((chGroup) => (
                  <div
                    key={chGroup.id}
                    className="rounded-3xl bg-card border border-border/70 p-5 sm:p-7 space-y-5 shadow-xs"
                  >
                    {/* Chapter Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/50">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 text-sm">
                          {chGroup.chapterNumber ? `Ch ${chGroup.chapterNumber}` : <BookOpen className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg sm:text-xl font-display font-bold text-foreground">
                              {chGroup.title}
                            </h3>
                            {chGroup.exams.length > 0 && chGroup.completedCount === chGroup.exams.length && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Completed
                              </Badge>
                            )}
                          </div>
                          {chGroup.description && (
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                              {chGroup.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <Badge variant="secondary" className="self-start sm:self-auto text-xs font-bold px-3 py-1 rounded-xl">
                        {chGroup.exams.length} {chGroup.exams.length === 1 ? "Assessment" : "Assessments"}
                      </Badge>
                    </div>

                    {/* Exams inside this Chapter (1 column on mobile screen, 2 on tablet, 3 on desktop) */}
                    {chGroup.exams.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                        {chGroup.exams.map((exam) => (
                          <ExamCard
                            key={exam.id}
                            exam={exam}
                            hasAttempted={attemptedExamIds.has(exam.id)}
                            showOfflineDownload={true}
                            departmentId={profile?.departmentId}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
                        No examinations attached to this chapter yet.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : currentSubjectExams.length === 0 ? (
              /* No exams in this subject */
              <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-3xl border border-dashed p-8 max-w-md mx-auto">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <ClipboardList className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground">No examinations yet</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Examiners have not published any assessments under {activeSubject.name} yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToAllSubjects}
                  className="mt-5 rounded-xl font-semibold gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  View All Subjects
                </Button>
              </div>
            ) : (
              /* Search query matched no exams in this subject */
              <div className="flex flex-col items-center justify-center py-16 text-center bg-card rounded-3xl border border-dashed p-8 max-w-md mx-auto">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <Search className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-foreground">No matching assessments</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  No examinations in {activeSubject.name} matched &ldquo;{searchQuery}&rdquo;.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 rounded-xl"
                >
                  Clear Search
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* ==================================================================== */
          /* VIEW B: ALL SUBJECTS VIEW (Curriculum Subject Cards Grid)             */
          /* Clicking any subject opens its dedicated chapter contents view       */
          /* ==================================================================== */
          <div className="space-y-8">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">
                    Exams
                  </h1>
                  <Badge variant="secondary" className="font-semibold text-xs rounded-lg px-2.5 py-0.5">
                    {subjects.length} Subjects
                  </Badge>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">
                  Select a curriculum subject below to explore its chapters and take assessments.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Badge
                  variant="outline"
                  className="text-xs font-medium py-1 px-3 rounded-full bg-card shadow-xs"
                >
                  {isOnline ? "🟢 Online" : "🔴 Offline Mode"}
                </Badge>
                {attemptedExamIds.size > 0 && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs py-1 px-3 rounded-full font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {attemptedExamIds.size} Completed
                  </Badge>
                )}
              </div>
            </div>

            {/* Search Subjects Bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search subjects by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 rounded-2xl bg-card border-border/80 h-11 text-sm shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Grid of Subject Cards */}
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-64 sm:h-80 rounded-2xl sm:rounded-3xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredSubjectsForOverview.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {filteredSubjectsForOverview.map((sub) => {
                  const prog = progressMap[sub.id];

                  return (
                    <SubjectCard
                      key={sub.id}
                      subject={sub}
                      progress={prog}
                      isAdmin={false}
                      onClick={() => handleSelectSubject(sub.id)}
                    />
                  );
                })}
              </div>
            ) : subjects.length > 0 ? (
              /* Search has no matching subjects */
              <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-3xl border border-dashed p-8 max-w-md mx-auto">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <Search className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground">No subjects found</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  No subjects matched &ldquo;{searchQuery}&rdquo;.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 rounded-xl"
                >
                  Clear Search
                </Button>
              </div>
            ) : (
              /* No subjects in department */
              <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-3xl border border-dashed p-8 max-w-md mx-auto">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <BookOpen className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground">No subjects available yet</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  No academic curriculum subjects have been published for your department yet. Please check back soon!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentExams;
