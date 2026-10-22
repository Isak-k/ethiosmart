import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createExam, getExam } from "@/lib/firebase-exams";
import { getDepartments } from "@/lib/departments";
import { getSubjects, createSubject, addDepartmentToSubject, getChapters } from "@/lib/subjects";
import { Department } from "@/integrations/firebase/types";
import { Subject, Chapter } from "@/types/subject";
import { Timestamp } from "firebase/firestore";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save, Plus, BookOpen, Sparkles, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SubjectFormDialog } from "@/components/subject/SubjectFormDialog";
import { SubjectChaptersDialog } from "@/components/subject/SubjectChaptersDialog";

const CreateExam = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [createSubjectModalOpen, setCreateSubjectModalOpen] = useState(false);

  // Chapters for selected subject
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [chaptersDialogOpen, setChaptersDialogOpen] = useState(false);

  const initialSubjectId = searchParams.get("subjectId") || "none";
  const initialChapterId = searchParams.get("chapterId") || "none";
  const initialChapterTitle = searchParams.get("chapterTitle") || "";

  const [form, setForm] = useState({
    title: "",
    description: "",
    duration_minutes: 60,
    max_attempts: 1,
    shuffle_questions: false,
    shuffle_options: false,
    allow_offline_download: false,
    exam_type: "normal",
    default_question_type: "mcq",
    start_time: "",
    end_time: "",
    department_id: "all",
    subject_id: initialSubjectId,
    chapter_id: initialChapterId,
    chapter_title: initialChapterTitle,
    access_password: "",
  });

  useEffect(() => {
    getDepartments().then(setDepartments).catch(console.error);
    getSubjects().then(setSubjects).catch(console.error);
  }, []);

  // Fetch chapters whenever selected subject changes
  useEffect(() => {
    if (form.subject_id && form.subject_id !== "none") {
      setLoadingChapters(true);
      getChapters(form.subject_id)
        .then((chaps) => {
          setAvailableChapters(chaps);
          // If query param or form matches a chapter, sync it
          if (form.chapter_id && form.chapter_id !== "none" && form.chapter_id !== "__custom__") {
            const match = chaps.find((c) => c.id === form.chapter_id);
            if (match) {
              setForm((prev) => ({ ...prev, chapter_title: match.title }));
            }
          }
        })
        .catch((err) => {
          console.warn("Could not load chapters for subject:", err);
          setAvailableChapters([]);
        })
        .finally(() => setLoadingChapters(false));
    } else {
      setAvailableChapters([]);
      setForm((prev) => ({ ...prev, chapter_id: "none", chapter_title: "" }));
    }
  }, [form.subject_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) {
        throw new Error("You must be logged in to create an exam");
      }

      const selectedSubjectId = form.subject_id !== "none" ? form.subject_id : undefined;
      const selectedChapter = availableChapters.find((c) => c.id === form.chapter_id);
      const chapterId =
        form.chapter_id !== "none" && form.chapter_id !== "__custom__"
          ? form.chapter_id
          : undefined;
      const chapterTitle = selectedChapter
        ? selectedChapter.title
        : form.chapter_title?.trim() || undefined;

      const examData = {
        title: form.title,
        description: form.description || null,
        subjectId: selectedSubjectId,
        chapterId,
        chapterTitle,
        departmentId: form.department_id === "all" ? undefined : form.department_id,
        createdBy: user.uid,
        durationMinutes: Number(form.duration_minutes),
        maxAttempts: Number(form.max_attempts),
        isPublished: false,
        resultsPublished: false,
        shuffleQuestions: form.shuffle_questions,
        shuffleOptions: form.shuffle_options,
        allowOfflineDownload: form.allow_offline_download,
        examType: form.exam_type as any,
        defaultQuestionType: form.default_question_type,
        startTime: form.start_time ? Timestamp.fromDate(new Date(form.start_time)) : null,
        endTime: form.end_time ? Timestamp.fromDate(new Date(form.end_time)) : null,
        questionCount: 0,
        totalMarks: 0,
        accessPassword: form.access_password.trim() || null,
      };

      const examId = await createExam(examData);

      // If associated with a subject and department, link them
      if (selectedSubjectId && form.department_id !== "all") {
        await addDepartmentToSubject(selectedSubjectId, form.department_id);
      }

      // Verify exam was created before redirecting
      let retries = 3;
      while (retries > 0) {
        const exam = await getExam(examId);
        if (exam) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
        retries--;
      }

      toast({
        title: "Exam created!",
        description: "Now add questions to your exam.",
      });

      navigate(`/dashboard/exams/${examId}/edit`);
    } catch (error: any) {
      console.error("Error creating exam:", error);
      toast({
        title: "Failed to create exam",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/exams">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">{t("admin.exams.form.createTitle")}</h1>
            <p className="text-muted-foreground">{t("admin.exams.form.subtitle")}</p>
          </div>
        </div>

        {/* AI Exam Generation from Resource Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-amber-500/10 to-primary/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-0.5">
            <p className="text-sm font-bold flex items-center gap-1.5 text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Generate questions from a resource
            </p>
            <p className="text-xs text-muted-foreground">
              Auto-generate questions from textbooks or short notes in your Google Drive library.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              navigate(
                `/dashboard/admin/ai-generator?source=book&deptId=${form.department_id !== 'all' ? form.department_id : ''}&subjectId=${form.subject_id !== 'none' ? form.subject_id : ''}`
              )
            }
            className="rounded-xl shrink-0 font-semibold text-xs text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
            AI Generator
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("admin.exams.form.basicInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t("admin.exams.form.title")} *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t("admin.exams.form.titlePlaceholder")}
                  className="input-focus"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("admin.exams.form.description")}</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t("admin.exams.form.descriptionPlaceholder")}
                  rows={3}
                  className="input-focus"
                />
              </div>

              {/* Subject Selection (Step 2) */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-muted/30 border">
                <div className="flex items-center justify-between">
                  <Label htmlFor="subject" className="font-semibold flex items-center gap-1.5 text-foreground">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Subject (Academic Curriculum)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreateSubjectModalOpen(true)}
                    className="h-7 text-xs text-primary font-semibold hover:bg-primary/10 rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create New Subject
                  </Button>
                </div>
                <Select
                  value={form.subject_id}
                  onValueChange={(val) => {
                    if (val === "__new__") {
                      setCreateSubjectModalOpen(true);
                    } else {
                      setForm({ ...form, subject_id: val });
                    }
                  }}
                >
                  <SelectTrigger id="subject" className="bg-card">
                    <SelectValue placeholder="Select a subject..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__" className="text-primary font-semibold cursor-pointer">
                      + Create New Subject
                    </SelectItem>
                    <SelectItem value="none">None (General Exam)</SelectItem>
                    {subjects.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Associates this exam with a subject card and student unit progress tracking.
                </p>
              </div>

              {/* Subject Chapter Assignment */}
              {form.subject_id !== "none" && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-muted/20 border border-primary/20 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="chapter-select" className="font-semibold flex items-center gap-1.5 text-foreground text-xs sm:text-sm">
                      <Layers className="h-4 w-4 text-primary" />
                      Subject Chapter / Unit Assignment
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setChaptersDialogOpen(true)}
                      className="h-7 text-xs text-primary font-semibold hover:bg-primary/10 rounded-lg"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Manage Chapters
                    </Button>
                  </div>

                  {loadingChapters ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      Loading chapters for this subject...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Select
                        value={
                          availableChapters.some((c) => c.id === form.chapter_id)
                            ? form.chapter_id
                            : form.chapter_id === "__custom__" ||
                              (form.chapter_title &&
                                !availableChapters.some(
                                  (c) => c.title.toLowerCase() === form.chapter_title.toLowerCase()
                                ))
                            ? "__custom__"
                            : form.chapter_id === "none" || !form.chapter_id
                            ? "none"
                            : availableChapters.find(
                                (c) => c.title.toLowerCase() === form.chapter_title.toLowerCase()
                              )?.id || "none"
                        }
                        onValueChange={(val) => {
                          if (val === "none") {
                            setForm((prev) => ({ ...prev, chapter_id: "none", chapter_title: "" }));
                          } else if (val === "__custom__") {
                            setForm((prev) => ({ ...prev, chapter_id: "__custom__" }));
                          } else {
                            const found = availableChapters.find((c) => c.id === val);
                            setForm((prev) => ({
                              ...prev,
                              chapter_id: val,
                              chapter_title: found ? found.title : "",
                            }));
                          }
                        }}
                      >
                        <SelectTrigger id="chapter-select" className="bg-card text-xs">
                          <SelectValue placeholder="Choose a chapter for this exam..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            No specific chapter (Entire Subject / General Exam)
                          </SelectItem>
                          {availableChapters.map((ch) => (
                            <SelectItem key={ch.id} value={ch.id} className="text-xs">
                              Unit {ch.chapterNumber ?? ""}: {ch.title}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__" className="text-muted-foreground italic text-xs">
                            + Custom Chapter Title...
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {(form.chapter_id === "__custom__" ||
                        (!availableChapters.some((c) => c.id === form.chapter_id) && form.chapter_title)) && (
                        <Input
                          id="chapter_title"
                          value={form.chapter_title}
                          onChange={(e) => setForm({ ...form, chapter_title: e.target.value })}
                          placeholder="Type custom chapter title..."
                          className="input-focus text-xs h-9 mt-1"
                        />
                      )}

                      {availableChapters.length === 0 && (
                        <p className="text-[11px] text-muted-foreground flex items-center justify-between">
                          <span>No chapters created yet for this subject.</span>
                          <button
                            type="button"
                            onClick={() => setChaptersDialogOpen(true)}
                            className="text-primary hover:underline font-semibold"
                          >
                            Create first chapter
                          </button>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="access_password">
                  {t("admin.exams.form.accessPassword")} ({t("admin.exams.form.optional")})
                </Label>
                <Input
                  id="access_password"
                  type="text"
                  value={form.access_password}
                  onChange={(e) => setForm({ ...form, access_password: e.target.value })}
                  placeholder={t("admin.exams.form.accessPasswordPlaceholder")}
                  className="input-focus"
                />
                <p className="text-sm text-muted-foreground">
                  {t("admin.exams.form.accessPasswordHelp")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("admin.exams.form.settings")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exam_type">Exam Type *</Label>
                <Select 
                  value={form.exam_type} 
                  onValueChange={(v) => setForm({ ...form, exam_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select exam type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal Exam (Fetches from Firebase)</SelectItem>
                    <SelectItem value="practice">Practice Exam (100% Offline with Explanations)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Normal exams require internet. Practice exams work completely offline after download.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_question_type">Default Question Type</Label>
                <Select 
                  value={form.default_question_type} 
                  onValueChange={(v) => setForm({ ...form, default_question_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select default question type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                    <SelectItem value="truefalse">True/False</SelectItem>
                    <SelectItem value="shortanswer">Short Answer</SelectItem>
                    <SelectItem value="essay">Essay</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This will be the pre-selected type when adding questions. You can attach diagrams or images (upload directly or paste Cloudinary link) to any question.
                </p>
              </div>

              {/* Department Publication (Step 4 - Unchanged Existing Workflow) */}
              <div className="space-y-2">
                <Label htmlFor="department">{t("admin.exams.form.department")}</Label>
                <Select 
                  value={form.department_id} 
                  onValueChange={(v) => setForm({ ...form, department_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.exams.form.selectDepartment")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.exams.form.allDepartments")}</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {t("admin.exams.form.departmentHelp")}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="duration">{t("admin.exams.form.duration")} *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    value={form.duration_minutes}
                    onChange={(e) =>
                      setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })
                    }
                    className="input-focus"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attempts">{t("admin.exams.form.maxAttempts")}</Label>
                  <Input
                    id="attempts"
                    type="number"
                    min={1}
                    value={form.max_attempts}
                    onChange={(e) =>
                      setForm({ ...form, max_attempts: parseInt(e.target.value) || 1 })
                    }
                    className="input-focus"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">{t("admin.exams.form.startTime")}</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="input-focus"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_time">{t("admin.exams.form.endTime")}</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="input-focus"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="shuffle_questions">{t("admin.exams.form.shuffleQuestions")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("admin.exams.form.shuffleQuestionsDesc")}
                    </p>
                  </div>
                  <Switch
                    id="shuffle_questions"
                    checked={form.shuffle_questions}
                    onCheckedChange={(checked) => setForm({ ...form, shuffle_questions: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="shuffle_options">{t("admin.exams.form.shuffleOptions")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("admin.exams.form.shuffleOptionsDesc")}
                    </p>
                  </div>
                  <Switch
                    id="shuffle_options"
                    checked={form.shuffle_options}
                    onCheckedChange={(checked) => setForm({ ...form, shuffle_options: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="allow_offline_download">Allow Offline Download</Label>
                    <p className="text-sm text-muted-foreground">
                      Students can download this exam and take it completely offline.
                    </p>
                  </div>
                  <Switch
                    id="allow_offline_download"
                    checked={form.allow_offline_download}
                    onCheckedChange={(checked) => setForm({ ...form, allow_offline_download: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/dashboard/exams")}
              disabled={loading}
              className="rounded-xl"
            >
              {t("admin.exams.form.cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {loading ? t("admin.exams.form.creating") : t("admin.exams.form.create")}
            </Button>
          </div>
        </form>

        {/* Inline Create Subject Modal */}
        <SubjectFormDialog
          open={createSubjectModalOpen}
          onOpenChange={setCreateSubjectModalOpen}
          defaultDepartmentId={form.department_id !== "all" ? form.department_id : undefined}
          onSave={async (subData) => {
            const newId = await createSubject(subData, user?.uid);
            const freshSubs = await getSubjects();
            setSubjects(freshSubs);
            setForm((prev) => ({ ...prev, subject_id: newId }));
            toast({
              title: "Subject created!",
              description: `"${subData.name}" has been selected for this exam.`,
            });
          }}
        />

        {/* Chapters Dialog */}
        <SubjectChaptersDialog
          open={chaptersDialogOpen}
          onOpenChange={setChaptersDialogOpen}
          subject={subjects.find((s) => s.id === form.subject_id) || null}
          onChaptersChange={() => {
            if (form.subject_id && form.subject_id !== "none") {
              getChapters(form.subject_id).then(setAvailableChapters).catch(() => 0);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default CreateExam;
