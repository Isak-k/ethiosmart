import { useEffect, useState } from "react";
import { EthioSmartLogo } from "@/components/ui/EthioSmartLogo";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SubjectGrid } from "@/components/subject/SubjectGrid";
import { getSubjects, seedDefaultSubjects } from "@/lib/subjects";
import { getBooks } from "@/lib/books";
import { calculateAllSubjectsProgress } from "@/lib/subject-progress";
import { getSubjectCover } from "@/lib/subject-covers";
import { getCachedDefaultDepartmentId } from "@/lib/system-settings";
import { Subject, StudentSubjectProgress } from "@/types/subject";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { 
  GraduationCap, 
  BookOpen, 
  Loader2, 
  Sparkles, 
  ArrowRight,
  Layers,
  CheckCircle2,
  Trophy,
  LogIn
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function StudentSubjects() {
  const { user, profile, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, StudentSubjectProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleOnline = () => fetchSubjectsAndProgress();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // Guest subject preview dialog
  const [selectedSubjectForModal, setSelectedSubjectForModal] = useState<Subject | null>(null);

  // Automatically redirect admins to the Admin Subjects CRUD management page
  useEffect(() => {
    if (!authLoading && role === "admin") {
      navigate("/dashboard/admin/subjects", { replace: true });
    }
  }, [authLoading, role, navigate]);

  useEffect(() => {
    fetchSubjectsAndProgress();
  }, [user, profile?.departmentId]);

  const fetchSubjectsAndProgress = async () => {
    try {
      setLoading(true);

      const defaultDeptId = getCachedDefaultDepartmentId();
      const effectiveDeptId = defaultDeptId || profile?.departmentId;

      const [listRaw, textbooks] = await Promise.all([
        getSubjects(effectiveDeptId),
        getBooks({ resourceType: 'textbook' }, 'student').catch(() => []),
      ]);
      let list = listRaw;

      // If database has no subjects yet and no department filter, seed the default curriculum
      if (list.length === 0 && !effectiveDeptId) {
        await seedDefaultSubjects().catch(() => 0);
        list = await getSubjects(effectiveDeptId);
      }

      // Filter only active subjects for students
      let activeSubjects = list.filter((s) => s.isActive !== false);

      // Strict department assignment rule: students only see subjects explicitly assigned to their department
      if (effectiveDeptId && effectiveDeptId !== 'all') {
        activeSubjects = activeSubjects.filter((s) => {
          if (s.departmentIds && s.departmentIds.length > 0) {
            return s.departmentIds.includes(effectiveDeptId) || s.departmentIds.includes('all');
          }
          return (s as any).departmentId === effectiveDeptId;
        });
      }

      // Inherit coverpage of the curriculum BOOK (textbook), NOT study notes
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

      // Calculate progress if student is logged in, scoped to their department
      if (user?.uid) {
        const progress = await calculateAllSubjectsProgress(
          enrichedSubjects,
          user.uid,
          effectiveDeptId
        ).catch(() => ({}));
        setProgressMap(progress);
      }
    } catch (err) {
      console.error("Failed to load subjects:", err);
      toast({
        title: "Error loading subjects",
        description: "Please check your network connection and reload.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubject = (subject: Subject) => {
    if (user) {
      // If student is logged in, navigate to exams filtered by this subject
      navigate(`/dashboard/exams?subjectId=${subject.id}`);
    } else {
      // If guest browsing publicly, show modal with subject info and sign-in CTA
      setSelectedSubjectForModal(subject);
    }
  };

  // Compute aggregate stats for student header
  const totalSubjectsCount = subjects.length;
  const completedSubjectsCount = Object.values(progressMap).filter(
    (p) => p.totalUnits > 0 && p.completedUnits >= p.totalUnits
  ).length;

  const content = (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Academic Subjects
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Explore structured learning chapters, interactive assessments, and track your completion progress.
          </p>
        </div>

        {/* Student Progress Badge */}
        {user && totalSubjectsCount > 0 && (
          <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white shadow-sm">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Curriculum Progress</div>
              <div className="text-sm font-bold text-foreground">
                {completedSubjectsCount} of {totalSubjectsCount} subjects completed
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid of Subject Cards */}
      <SubjectGrid
        subjects={subjects}
        progressMap={progressMap}
        loading={loading}
        isAdmin={false}
        onSelectSubject={handleSelectSubject}
        showSearch={true}
      />

      {/* Guest Subject Overview Modal */}
      <Dialog
        open={Boolean(selectedSubjectForModal)}
        onOpenChange={(open) => !open && setSelectedSubjectForModal(null)}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          {selectedSubjectForModal && (
            <div className="space-y-4">
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
                <img
                  src={
                    selectedSubjectForModal.coverImageUrl ||
                    getSubjectCover(selectedSubjectForModal.name).url
                  }
                  alt={selectedSubjectForModal.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <h3 className="text-2xl font-display font-bold text-foreground">
                  {selectedSubjectForModal.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedSubjectForModal.description ||
                    "Comprehensive curriculum chapters and examination preparation."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/50 border flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Curriculum Structure</span>
                </div>
                <Badge variant="secondary">
                  {selectedSubjectForModal.totalUnits ?? 8} chapters total
                </Badge>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedSubjectForModal(null)}
                  className="rounded-xl w-full sm:w-auto"
                >
                  Close
                </Button>
                <Button
                  onClick={() => navigate("/auth")}
                  className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 w-full sm:w-auto font-semibold"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In to Start Exam
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // If user is authenticated, wrap inside the app's DashboardLayout
  if (user) {
    return <DashboardLayout>{content}</DashboardLayout>;
  }

  // If unauthenticated / public browsing, render standalone modern responsive page
  return (
    <div className="min-h-screen bg-background">
      {/* Public Header */}
      <header className="sticky top-0 z-40 h-16 border-b bg-card/95 backdrop-blur-sm px-4 sm:px-8 flex items-center justify-between shadow-xs">
        <Link to="/" className="flex items-center">
          <EthioSmartLogo variant="compact" size="sm" />
        </Link>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
          <Button
            onClick={() => navigate("/auth")}
            className="rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 max-w-7xl">
        {content}
      </main>
    </div>
  );
}
