import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getPublishedExams, getAllExams } from "@/lib/firebase-exams";
import { getStudentAttempts } from "@/lib/firebase-attempts";
import { getSubjects, getChapters } from "@/lib/subjects";
import { getBooks } from "@/lib/books";
import { calculateAllSubjectsProgress } from "@/lib/subject-progress";
import { getSubjectCover } from "@/lib/subject-covers";
import { getCachedDefaultDepartmentId } from "@/lib/system-settings";
import { usePaymentAccess } from "@/lib/payment-access";
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
  ChevronRight,
  WifiOff,
  HardDrive,
  Play
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
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

interface UnitDisplayItem {
  id: string;
  unitNumber: number;
  title: string;
  description?: string;
  exams: ExamData[];
  hasExam: boolean;
  hasAttempted: boolean;
  isDownloaded?: boolean;
}

const StudentExams = () => {
  const { user, profile } = useAuth();
  const paymentAccess = usePaymentAccess();
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
  const [selectedMultiExamUnit, setSelectedMultiExamUnit] = useState<UnitDisplayItem | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (user && profile) {
      loadAllData();
    }
  }, [user, profile]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleManualRefresh = () => {
      loadAllData();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("exampro-manual-refresh", handleManualRefresh);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("exampro-manual-refresh", handleManualRefresh);
    };
  }, []);

  const loadAllData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const defaultDeptId = getCachedDefaultDepartmentId();
      const effectiveDeptId = defaultDeptId || profile?.departmentId;

      // 1. Fetch exams visible to user (admins/examiners see all including drafts; students see published)
      const isAdminUser = profile?.role === "admin" || (profile as any)?.isSuperAdmin || (profile as any)?.role === "examiner";
      const examsData = isAdminUser
        ? await getAllExams().catch(() => getPublishedExams(effectiveDeptId))
        : await getPublishedExams(effectiveDeptId);
      const attempts = await getStudentAttempts(user.uid).catch(() => []);

      // Count attempts per exam
      const attemptsByExam = new Map<string, number>();
      attempts.forEach((attempt) => {
        const count = attemptsByExam.get(attempt.examId) || 0;
        attemptsByExam.set(attempt.examId, count + 1);
      });

      // Helper for safe timestamp conversion from both Firestore and local cache
      const toIsoString = (val: any) => {
        if (!val) return null;
        if (typeof val.toDate === "function") return val.toDate().toISOString();
        if (val instanceof Date) return val.toISOString();
        if (typeof val === "string") return val;
        if (typeof val.seconds === "number") return new Date(val.seconds * 1000).toISOString();
        return null;
      };

      const mappedExams: ExamData[] = examsData.map((exam) => ({
        id: exam.examId,
        title: exam.title,
        description: exam.description,
        duration_minutes: exam.durationMinutes,
        start_time: toIsoString(exam.startTime),
        end_time: toIsoString(exam.endTime),
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

      // 2. Fetch subjects available to student's department and curriculum textbooks
      const [subjectsList, textbooks] = await Promise.all([
        getSubjects(effectiveDeptId).catch(() => []),
        getBooks({ resourceType: 'textbook' }, 'student').catch(() => []),
      ]);

      let activeSubjects = subjectsList.filter((s) => s.isActive !== false);

      // Strict department assignment rule: students only see subjects explicitly assigned to their department
      if (effectiveDeptId && effectiveDeptId !== 'all') {
        activeSubjects = activeSubjects.filter((s) => {
          if (s.departmentIds && s.departmentIds.length > 0) {
            return s.departmentIds.includes(effectiveDeptId) || s.departmentIds.includes('all');
          }
          return (s as any).departmentId === effectiveDeptId;
        });
      }

      // Inherit coverpage of curriculum BOOK (textbook), NOT study notes
      const enrichedSubjects = activeSubjects.map((sub) => {
        const matchingBook = textbooks.find(
          (b) => b.resourceType === 'textbook' && b.subjectId === sub.id && b.coverImageUrl
        );
        const effectiveBookCover =
          matchingBook?.coverImageUrl ||
          sub.bookCoverImageUrl ||
          (sub.coverImageUrl && sub.coverImageUrl !== sub.notesCoverImageUrl ? sub.coverImageUrl : '') ||
          getSubjectCover(sub.name).url;

        return {
          ...sub,
          coverImageUrl: effectiveBookCover,
        };
      });

      setSubjects(enrichedSubjects);

      // 3. Calculate unit progress & curriculum coverage for each subject
      if (enrichedSubjects.length > 0) {
        const prog = await calculateAllSubjectsProgress(
          enrichedSubjects,
          user.uid,
          effectiveDeptId,
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

  // Map curriculum units & exams matching the horizontal cards UI
  const displayUnits = useMemo(() => {
    if (!activeSubject) return [];

    const units: UnitDisplayItem[] = [];
    const assignedExamIds = new Set<string>();

    // 1. If explicit chapters exist in Firestore subcollection
    if (subjectChapters.length > 0) {
      const sortedChapters = [...subjectChapters].sort(
        (a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0)
      );

      sortedChapters.forEach((ch, idx) => {
        const unitNum = ch.chapterNumber ?? idx + 1;
        const chapterExams = currentSubjectExams.filter((e) => {
          if (e.chapterId === ch.id) return true;
          if (e.chapterTitle && ch.title && e.chapterTitle.toLowerCase().trim() === ch.title.toLowerCase().trim()) return true;
          if (e.title && ch.title && e.title.toLowerCase().includes(ch.title.toLowerCase())) return true;
          return false;
        });

        chapterExams.forEach((e) => assignedExamIds.add(e.id));
        const completed = chapterExams.some((e) => attemptedExamIds.has(e.id));

        units.push({
          id: ch.id,
          unitNumber: unitNum,
          title: ch.title,
          description: ch.description,
          exams: chapterExams,
          hasExam: chapterExams.length > 0,
          hasAttempted: completed,
        });
      });

      // Include remaining exams with explicit chapter title
      const remainingExamsWithTitle = currentSubjectExams.filter(
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
        const matchNum = title.match(/unit\s*(\d+)|chapter\s*(\d+)/i);
        const unitNum = matchNum ? parseInt(matchNum[1] || matchNum[2], 10) : units.length + idx + 1;
        units.push({
          id: `derived_${idx}_${title}`,
          unitNumber: unitNum,
          title,
          exams: chapterExams,
          hasExam: chapterExams.length > 0,
          hasAttempted: chapterExams.some((e) => attemptedExamIds.has(e.id)),
        });
      });

      // Ensure totalUnits from subject (e.g. Grade 9 9 units) are represented
      const targetCount = Math.max(activeSubject.totalUnits || 0, units.length);
      for (let i = 1; i <= targetCount; i++) {
        if (!units.some((u) => u.unitNumber === i)) {
          units.push({
            id: `placeholder_unit_${i}`,
            unitNumber: i,
            title: `Chapter ${i}`,
            exams: [],
            hasExam: false,
            hasAttempted: false,
          });
        }
      }

      // Remaining unassigned exams
      const unassignedExams = currentSubjectExams.filter((e) => !assignedExamIds.has(e.id));
      if (unassignedExams.length > 0) {
        units.push({
          id: "general_subject_assessments",
          unitNumber: units.length + 1,
          title: "Comprehensive Curriculum Assessment",
          description: "Curriculum assessment examination",
          exams: unassignedExams,
          hasExam: true,
          hasAttempted: unassignedExams.some((e) => attemptedExamIds.has(e.id)),
        });
      }

      return units.sort((a, b) => a.unitNumber - b.unitNumber);
    }

    // 2. If no Firestore subcollection chapters exist, derive from exam titles and totalUnits
    const remainingExamsWithTitle = currentSubjectExams.filter((e) => Boolean(e.chapterTitle));
    const derivedTitles = Array.from(
      new Set(remainingExamsWithTitle.map((e) => e.chapterTitle!.trim()))
    );

    derivedTitles.forEach((title, idx) => {
      const chapterExams = remainingExamsWithTitle.filter(
        (e) => e.chapterTitle?.trim() === title
      );
      chapterExams.forEach((e) => assignedExamIds.add(e.id));
      const matchNum = title.match(/unit\s*(\d+)|chapter\s*(\d+)/i);
      const unitNum = matchNum ? parseInt(matchNum[1] || matchNum[2], 10) : idx + 1;
      units.push({
        id: `derived_${idx}_${title}`,
        unitNumber: unitNum,
        title,
        exams: chapterExams,
        hasExam: chapterExams.length > 0,
        hasAttempted: chapterExams.some((e) => attemptedExamIds.has(e.id)),
      });
    });

    const targetCount = Math.max(activeSubject.totalUnits || 0, units.length > 0 ? units.length : 8);
    for (let i = 1; i <= targetCount; i++) {
      if (!units.some((u) => u.unitNumber === i)) {
        units.push({
          id: `placeholder_unit_${i}`,
          unitNumber: i,
          title: `Chapter ${i}`,
          exams: [],
          hasExam: false,
          hasAttempted: false,
        });
      }
    }

    const unassignedExams = currentSubjectExams.filter((e) => !assignedExamIds.has(e.id));
    if (unassignedExams.length > 0) {
      if (units.length > 0 && units[0].exams.length === 0) {
        units[0].exams = unassignedExams;
        units[0].hasExam = true;
        units[0].hasAttempted = unassignedExams.some((e) => attemptedExamIds.has(e.id));
      } else {
        units.push({
          id: "general_subject_assessments",
          unitNumber: units.length + 1,
          title: "Comprehensive Curriculum Assessment",
          description: "Curriculum assessment examination",
          exams: unassignedExams,
          hasExam: true,
          hasAttempted: unassignedExams.some((e) => attemptedExamIds.has(e.id)),
        });
      }
    }

    return units.sort((a, b) => a.unitNumber - b.unitNumber);
  }, [activeSubject, subjectChapters, currentSubjectExams, attemptedExamIds]);

  // Filter units inside the selected subject by searchQuery
  const filteredUnits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return displayUnits;
    return displayUnits.filter(
      (u) =>
        u.title.toLowerCase().includes(q) ||
        `unit ${u.unitNumber}`.includes(q) ||
        u.description?.toLowerCase().includes(q) ||
        u.exams.some(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.description?.toLowerCase().includes(q)
        )
    );
  }, [displayUnits, searchQuery]);

  const readyUnitsCount = useMemo(() => {
    return displayUnits.filter((u) => u.hasExam).length;
  }, [displayUnits]);

  const totalUnitsCount = useMemo(() => {
    return Math.max(displayUnits.length, activeSubject?.totalUnits || 0, 1);
  }, [displayUnits, activeSubject]);

  const gradeText = useMemo(() => {
    return activeSubject?.description?.match(/Grade\s*\d+/i)?.[0] || 'Grade 9';
  }, [activeSubject]);

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
    <DashboardLayout contentClassName={activeSubject ? "p-2.5 sm:p-4 lg:p-8" : "px-2 pt-3 pb-6 lg:p-8"}>
      <div className={cn("animate-fade-in mx-auto", activeSubject ? "max-w-3xl pb-6" : "space-y-8 pb-16 max-w-7xl")}>
        {/* Offline Banner notice */}
        {!isOnline && (
          <div className={cn("flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm font-medium", activeSubject && "mb-3")}>
            <WifiOff className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <span>You are currently offline. Showing exams and subject chapters stored on your device.</span>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
              Offline Mode
            </Badge>
          </div>
        )}
        {/* ==================================================================== */}
        {/* VIEW A: SPECIFIC SUBJECT SELECTED (Horizontal Chapters Cards View)   */}
        {/* ==================================================================== */}
        {activeSubject ? (
          <div className="space-y-4">
            {/* Slim full-screen app bar — only a back icon, chapters start right below */}
            <div className="sticky top-16 z-20 -mx-2.5 sm:-mx-4 lg:-mx-8 -mt-2.5 sm:-mt-4 lg:-mt-8 px-2.5 sm:px-4 lg:px-8 py-2.5 sm:py-3 bg-background/90 backdrop-blur-md border-b border-border/60 flex items-center gap-3 animate-fade-in">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToAllSubjects}
                aria-label="Back to all subjects"
                className="h-9 w-9 rounded-full shrink-0 hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg font-bold text-foreground truncate leading-tight font-display">
                  {activeSubject.name}
                </h1>
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                  {gradeText} · {readyUnitsCount} of {totalUnitsCount} chapters
                </p>
              </div>
            </div>

            {/* Search Bar for chapters inside this subject */}
            {displayUnits.length > 5 && (
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={`Search chapters or exams in ${activeSubject.name}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-9 rounded-2xl bg-card border-border/80 h-11 text-sm shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Chapters Loading state */}
            {chaptersLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed] mb-2" />
                <p className="text-sm text-muted-foreground">Loading curriculum chapters...</p>
              </div>
            ) : filteredUnits.length > 0 ? (
              /* Vertical stack of horizontal cards matching screenshot */
              <div className="space-y-3.5">
                {filteredUnits.map((unit) => {
                  const hasExam = unit.hasExam;
                  const primaryExam = unit.exams[0];

                  return (
                    <div
                      key={unit.id}
                      onClick={() => {
                        if (hasExam) {
                          if (unit.exams.length === 1) {
                            navigate(`/exam/${primaryExam.id}`);
                          } else {
                            setSelectedMultiExamUnit(unit);
                          }
                        } else {
                          toast({
                            title: "Exam gonna upload soon",
                            description: `The assessment for Chapter ${unit.unitNumber}: "${unit.title}" will be uploaded soon.`,
                          });
                        }
                      }}
                      className={`group relative overflow-hidden rounded-[24px] sm:rounded-3xl border border-slate-200/90 dark:border-border/70 bg-white dark:bg-card p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:border-purple-400 ${
                        !hasExam ? "opacity-80 bg-muted/20" : "hover:scale-[1.008]"
                      }`}
                    >
                      {/* Left Curved Purple Accent Ribbon */}
                      <div className="absolute left-0 top-3 bottom-3 w-1.5 sm:w-2 bg-[#7c3aed] rounded-r-full" />

                      {/* Squircle Icon Badge + Title & Status */}
                      <div className="flex items-center gap-3.5 sm:gap-4 pl-2 min-w-0 flex-1">
                        {/* Purple Squircle Icon Badge */}
                        <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#7c3aed] text-white flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105">
                          <GraduationCap className="w-6 h-6 sm:w-6.5 sm:h-6.5 text-white stroke-[2]" />
                        </div>

                        {/* Title & Metadata */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base sm:text-lg font-bold text-[#1e293b] dark:text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors leading-snug">
                              Chapter {unit.unitNumber}: {unit.title}
                            </h4>

                            {unit.hasAttempted && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/80 shrink-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                Completed
                              </span>
                            )}

                            {paymentAccess.chapterOneTrial && unit.unitNumber === 1 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/80 shrink-0">
                                <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                Free trial
                              </span>
                            )}
                          </div>

                          {/* Status Line */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
                            {hasExam ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>
                                  {unit.exams.length > 1
                                    ? `${unit.exams.length} Practice Exams Ready`
                                    : "Practice Exam Ready"}
                                </span>
                                {primaryExam?.question_count && (
                                  <span className="text-slate-500 dark:text-slate-400 font-normal">
                                    · {primaryExam.question_count} Questions
                                  </span>
                                )}
                                {primaryExam?.duration_minutes && (
                                  <span className="text-slate-500 dark:text-slate-400 font-normal">
                                    · {primaryExam.duration_minutes} min
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium italic">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Exam gonna upload soon</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Round Action Button / Chevron */}
                      <div className="shrink-0 flex items-center gap-2">
                        {hasExam ? (
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-purple-50 dark:bg-purple-950/50 text-[#7c3aed] flex items-center justify-center group-hover:bg-[#7c3aed] group-hover:text-white transition-colors shadow-2xs">
                            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-muted text-slate-400 flex items-center justify-center">
                            <ChevronRight className="w-5 h-5 stroke-[2]" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Search query matched no units */
              <div className="flex flex-col items-center justify-center py-16 text-center bg-card rounded-3xl border border-dashed p-8 max-w-md mx-auto">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <Search className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-foreground">No matching chapters</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  No chapters in {activeSubject.name} matched &ldquo;{searchQuery}&rdquo;.
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

            {/* Multiple Exams Dialog */}
            <Dialog open={Boolean(selectedMultiExamUnit)} onOpenChange={() => setSelectedMultiExamUnit(null)}>
              <DialogContent className="max-w-md rounded-3xl p-6">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold font-display">
                    Chapter {selectedMultiExamUnit?.unitNumber}: {selectedMultiExamUnit?.title}
                  </DialogTitle>
                  <DialogDescription>
                    Choose an assessment below to take:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  {selectedMultiExamUnit?.exams.map((exam) => (
                    <div
                      key={exam.id}
                      onClick={() => {
                        setSelectedMultiExamUnit(null);
                        navigate(`/exam/${exam.id}`);
                      }}
                      className="p-4 rounded-2xl border bg-card hover:border-[#7c3aed] hover:shadow-md cursor-pointer transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-foreground text-sm sm:text-base truncate">{exam.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {exam.question_count || 10} Questions · {exam.duration_minutes} mins
                        </p>
                      </div>
                      <Button size="sm" className="rounded-xl bg-[#7c3aed] text-white hover:bg-[#6d28d9] gap-1 shrink-0">
                        <Play className="h-3.5 w-3.5" /> Start
                      </Button>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          /* ==================================================================== */
          /* VIEW B: ALL SUBJECTS VIEW (Curriculum Subject Cards Grid)             */
          /* Clicking any subject opens its dedicated chapter contents view       */
          /* ==================================================================== */
          <div className="lg:space-y-8">
            {/* Page Header — desktop only (mobile shows just the search bar) */}
            <div className="hidden lg:flex lg:items-center lg:justify-between gap-4">
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

            {/* Search Bar — Android-style sticky app-bar search on mobile, inline on desktop */}
            <div className="sticky top-16 z-20 lg:static -mx-2 lg:mx-0 px-2 lg:px-0 py-2.5 lg:py-0 bg-background/90 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none border-b border-border/60 lg:border-0 mb-3 lg:mb-0">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  type="text"
                  placeholder="Search subjects by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-9 rounded-full lg:rounded-2xl bg-card border-border/80 h-11 text-sm shadow-xs"
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
            </div>

            {/* Grid of Subject Cards — single column edge-to-edge on mobile */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-64 sm:h-80 rounded-2xl sm:rounded-3xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredSubjectsForOverview.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
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
