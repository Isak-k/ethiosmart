import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Subject, Chapter } from '@/types/subject';
import { Exam } from '@/integrations/firebase/types';
import {
  getChapters,
  createChapter,
  updateChapter,
  deleteChapter,
} from '@/lib/subjects';
import { getSubjectCover } from '@/lib/subject-covers';
import {
  getExamsBySubject,
  getAllExams,
  assignExamToChapter,
  updateExam,
} from '@/lib/firebase-exams';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  BookOpen,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
  Layers,
  FileQuestion,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Link2,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface SubjectChaptersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: Subject | null;
  onChaptersChange?: () => void;
}

export function SubjectChaptersDialog({
  open,
  onOpenChange,
  subject,
  onChaptersChange,
}: SubjectChaptersDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectExams, setSubjectExams] = useState<Exam[]>([]);
  const [allOtherExams, setAllOtherExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [assigningExamId, setAssigningExamId] = useState<string | null>(null);

  // Expanded chapter IDs to show assigned exams list
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(new Set());

  // Quick assign selector state per chapter: { [chapterId]: selectedExamId }
  const [chapterAssignSelection, setChapterAssignSelection] = useState<Record<string, string>>({});

  // New chapter form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNumber, setNewNumber] = useState<number>(1);
  const [newDescription, setNewDescription] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  // Edit chapter state
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNumber, setEditNumber] = useState<number>(1);
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && subject?.id) {
      loadChapters();
      loadExams();
      setShowAddForm(false);
      setEditingChapterId(null);
    } else {
      setChapters([]);
      setSubjectExams([]);
      setAllOtherExams([]);
      setExpandedChapterIds(new Set());
    }
  }, [open, subject?.id]);

  const loadChapters = async () => {
    if (!subject?.id) return;
    try {
      setLoading(true);
      const list = await getChapters(subject.id);
      setChapters(list);
      setNewNumber(list.length + 1);
      // Expand all chapters by default so user sees assigned exams right away
      setExpandedChapterIds(new Set(list.map((c) => c.id)));
    } catch (err) {
      console.error('Failed to load chapters:', err);
      toast({
        title: 'Error loading chapters',
        description: 'Could not fetch chapters from database.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExams = async () => {
    if (!subject?.id) return;
    try {
      setLoadingExams(true);
      const [bySubject, all] = await Promise.all([
        getExamsBySubject(subject.id),
        getAllExams().catch(() => []),
      ]);
      setSubjectExams(bySubject);
      const others = all.filter((e) => e.subjectId !== subject.id);
      setAllOtherExams(others);
    } catch (err) {
      console.warn('Could not load exams for subject chapters dialog:', err);
    } finally {
      setLoadingExams(false);
    }
  };

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject?.id) return;

    if (!newTitle.trim()) {
      toast({
        title: 'Missing title',
        description: 'Please provide a title for the chapter.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSavingNew(true);
      const newId = await createChapter(
        subject.id,
        newTitle.trim(),
        Number(newNumber) || chapters.length + 1,
        newDescription.trim() || undefined
      );

      toast({
        title: 'Chapter added',
        description: `Chapter "${newTitle}" added to ${subject.name}. You can now assign exams to it!`,
      });

      // Expand the new chapter automatically
      setExpandedChapterIds((prev) => new Set([...prev, newId]));
      setNewTitle('');
      setNewDescription('');
      setShowAddForm(false);
      await loadChapters();
      if (onChaptersChange) onChaptersChange();
    } catch (err: any) {
      toast({
        title: 'Error creating chapter',
        description: err.message || 'Failed to save chapter.',
        variant: 'destructive',
      });
    } finally {
      setSavingNew(false);
    }
  };

  const handleStartEdit = (ch: Chapter) => {
    setEditingChapterId(ch.id);
    setEditTitle(ch.title);
    setEditNumber(ch.chapterNumber ?? 1);
    setEditDescription(ch.description || '');
  };

  const handleCancelEdit = () => {
    setEditingChapterId(null);
    setEditTitle('');
    setEditDescription('');
  };

  const handleSaveEdit = async (chapterId: string) => {
    if (!subject?.id) return;
    if (!editTitle.trim()) {
      toast({
        title: 'Title required',
        description: 'Chapter title cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSavingEdit(true);
      await updateChapter(subject.id, chapterId, {
        title: editTitle.trim(),
        chapterNumber: Number(editNumber) || 1,
        description: editDescription.trim() || undefined,
      });

      // If chapter title changed, update existing exams that reference this chapter
      const examsToUpdate = subjectExams.filter((e) => e.chapterId === chapterId);
      for (const ex of examsToUpdate) {
        await assignExamToChapter(ex.examId, chapterId, editTitle.trim()).catch(() => 0);
      }

      toast({
        title: 'Chapter updated',
        description: `"${editTitle}" was updated successfully.`,
      });

      setEditingChapterId(null);
      await Promise.all([loadChapters(), loadExams()]);
      if (onChaptersChange) onChaptersChange();
    } catch (err: any) {
      toast({
        title: 'Update error',
        description: err.message || 'Failed to update chapter.',
        variant: 'destructive',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteChapter = async (ch: Chapter) => {
    if (!subject?.id) return;
    try {
      setDeletingId(ch.id);
      // Unassign exams attached to this chapter first
      const attachedExams = subjectExams.filter(
        (e) => e.chapterId === ch.id || e.chapterTitle?.trim().toLowerCase() === ch.title.trim().toLowerCase()
      );
      for (const ex of attachedExams) {
        await assignExamToChapter(ex.examId, null, null).catch(() => 0);
      }

      await deleteChapter(subject.id, ch.id);
      toast({
        title: 'Chapter removed',
        description: `Chapter "${ch.title}" was deleted. Attached exams have been unassigned.`,
      });
      await Promise.all([loadChapters(), loadExams()]);
      if (onChaptersChange) onChaptersChange();
    } catch (err: any) {
      toast({
        title: 'Delete error',
        description: err.message || 'Could not delete chapter.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpandChapter = (chapterId: string) => {
    setExpandedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  /**
   * Assign an exam to a specific chapter
   */
  const handleAssignExamToChapter = async (examId: string, chapter: Chapter) => {
    if (!subject?.id || !examId) return;
    try {
      setAssigningExamId(examId);

      const allPool = [...subjectExams, ...allOtherExams];
      const targetExam = allPool.find((e) => e.examId === examId);

      // Check if exam needs subjectId updated as well
      if (targetExam && targetExam.subjectId !== subject.id) {
        await updateExam(examId, {
          subjectId: subject.id,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
        });
      } else {
        await assignExamToChapter(examId, chapter.id, chapter.title);
      }

      // Update state locally
      setSubjectExams((prev) => {
        const found = prev.find((e) => e.examId === examId);
        if (found) {
          return prev.map((e) =>
            e.examId === examId ? { ...e, chapterId: chapter.id, chapterTitle: chapter.title } : e
          );
        } else if (targetExam) {
          return [
            { ...targetExam, subjectId: subject.id, chapterId: chapter.id, chapterTitle: chapter.title },
            ...prev,
          ];
        }
        return prev;
      });

      setAllOtherExams((prev) => prev.filter((e) => e.examId !== examId));
      setChapterAssignSelection((prev) => ({ ...prev, [chapter.id]: '' }));

      // Ensure chapter is expanded
      setExpandedChapterIds((prev) => new Set([...prev, chapter.id]));

      toast({
        title: 'Exam Assigned Successfully!',
        description: `"${targetExam?.title || 'Exam'}" is now assigned to Chapter ${chapter.chapterNumber ?? ''}: ${chapter.title}.`,
      });

      if (onChaptersChange) onChaptersChange();
    } catch (err: any) {
      console.error('Error assigning exam to chapter:', err);
      toast({
        title: 'Assignment Failed',
        description: err.message || 'Could not assign exam to chapter.',
        variant: 'destructive',
      });
    } finally {
      setAssigningExamId(null);
    }
  };

  /**
   * Unassign an exam from a chapter
   */
  const handleUnassignExam = async (exam: Exam, chapterTitle: string) => {
    try {
      setAssigningExamId(exam.examId);
      await assignExamToChapter(exam.examId, null, null);

      setSubjectExams((prev) =>
        prev.map((e) =>
          e.examId === exam.examId ? { ...e, chapterId: undefined, chapterTitle: undefined } : e
        )
      );

      toast({
        title: 'Exam Unassigned',
        description: `"${exam.title}" removed from "${chapterTitle}".`,
      });

      if (onChaptersChange) onChaptersChange();
    } catch (err: any) {
      console.error('Error unassigning exam:', err);
      toast({
        title: 'Failed to unassign',
        description: err.message || 'Could not remove exam from chapter.',
        variant: 'destructive',
      });
    } finally {
      setAssigningExamId(null);
    }
  };

  if (!subject) return null;

  const coverInfo = getSubjectCover(subject.name, subject.coverImageUrl);

  // Unassigned exams within this subject
  const unassignedExams = subjectExams.filter((e) => !e.chapterId && !e.chapterTitle);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-12 w-16 rounded-xl overflow-hidden bg-muted border shrink-0">
              <img
                src={coverInfo.url}
                alt={subject.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl sm:text-2xl font-display font-bold flex items-center gap-2 flex-wrap">
                <span className="truncate">{subject.name}</span>
                <Badge variant="secondary" className="text-xs font-semibold">
                  {chapters.length} {chapters.length === 1 ? 'Chapter' : 'Chapters'}
                </Badge>
                <Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
                  {subjectExams.length} {subjectExams.length === 1 ? 'Exam' : 'Exams'} in Subject
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Organize curriculum units and attach exams to chapters so students track their unit progress.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Total Units: <b>{subject.totalUnits ?? chapters.length}</b>
            </span>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1">
              <FileCheck2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Assigned Exams: <b>{subjectExams.length - unassignedExams.length}</b> / {subjectExams.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!showAddForm && (
              <Button
                size="sm"
                onClick={() => {
                  setShowAddForm(true);
                  setNewNumber(chapters.length + 1);
                }}
                className="rounded-xl font-semibold h-8 text-xs bg-primary hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Chapter
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                navigate(`/dashboard/exams/new?subjectId=${subject.id}`);
              }}
              className="rounded-xl font-medium h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Exam
            </Button>
          </div>
        </div>

        {/* Add Chapter Inline Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreateChapter}
            className="p-4 rounded-2xl bg-muted/40 border border-primary/20 space-y-3 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                New Chapter / Unit
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
                className="h-6 w-6 p-0 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1 space-y-1">
                <Label htmlFor="new-ch-num" className="text-[11px] font-semibold">
                  Chapter #
                </Label>
                <Input
                  id="new-ch-num"
                  type="number"
                  min="1"
                  value={newNumber}
                  onChange={(e) => setNewNumber(Number(e.target.value))}
                  required
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <Label htmlFor="new-ch-title" className="text-[11px] font-semibold">
                  Chapter Title *
                </Label>
                <Input
                  id="new-ch-title"
                  placeholder="e.g. Number Systems, Kinematics, Grammar..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-4 space-y-1">
                <Label htmlFor="new-ch-desc" className="text-[11px] font-semibold">
                  Description / Topic Scope (Optional)
                </Label>
                <Textarea
                  id="new-ch-desc"
                  placeholder="Summary of subtopics covered..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(false)}
                disabled={savingNew}
                className="rounded-xl text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingNew}
                className="rounded-xl text-xs h-8 bg-primary font-semibold"
              >
                {savingNew && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Save Chapter
              </Button>
            </div>
          </form>
        )}

        {/* Chapters Listing */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Loading curriculum chapters & exams...</p>
          </div>
        ) : chapters.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl border border-dashed text-muted-foreground space-y-3">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-sm font-semibold text-foreground">No chapters added yet</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md mx-auto">
                Create chapters for this subject first (e.g. Chapter 1, Chapter 2). Then you can assign your exams directly to each chapter!
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setShowAddForm(true);
                setNewNumber(1);
              }}
              className="rounded-xl text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create First Chapter
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {chapters.map((ch, idx) => {
              const isEditing = editingChapterId === ch.id;

              // Filter exams assigned to this chapter
              const chExams = subjectExams.filter((e) => {
                if (e.chapterId === ch.id) return true;
                if (
                  e.chapterTitle &&
                  e.chapterTitle.trim().toLowerCase() === ch.title.trim().toLowerCase()
                ) {
                  return true;
                }
                return false;
              });

              // Available exams that can be assigned to this chapter (not already assigned to it)
              const assignableExams = [
                ...subjectExams.filter((e) => !chExams.some((ce) => ce.examId === e.examId)),
                ...allOtherExams,
              ];

              const isExpanded = expandedChapterIds.has(ch.id);

              if (isEditing) {
                return (
                  <div
                    key={ch.id}
                    className="p-3.5 rounded-2xl border border-primary/40 bg-accent/30 space-y-3 animate-fade-in"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="sm:col-span-1 space-y-1">
                        <Label className="text-[11px] font-semibold">Ch #</Label>
                        <Input
                          type="number"
                          min="1"
                          value={editNumber}
                          onChange={(e) => setEditNumber(Number(e.target.value))}
                          className="rounded-xl h-8 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-[11px] font-semibold">Title</Label>
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="rounded-xl h-8 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-4 space-y-1">
                        <Label className="text-[11px] font-semibold">Description</Label>
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="rounded-xl h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        disabled={savingEdit}
                        className="rounded-xl h-7 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSaveEdit(ch.id)}
                        disabled={savingEdit}
                        className="rounded-xl h-7 text-xs"
                      >
                        {savingEdit && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={ch.id}
                  className="rounded-2xl border bg-card hover:border-primary/30 transition-all overflow-hidden shadow-xs"
                >
                  {/* Chapter Header Card */}
                  <div className="flex items-center justify-between p-3.5 bg-muted/20 gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {ch.chapterNumber ?? idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-foreground truncate">
                            {ch.title}
                          </h4>
                          <Badge
                            variant={chExams.length > 0 ? 'default' : 'outline'}
                            className={`text-[10px] font-medium h-5 ${
                              chExams.length > 0
                                ? 'bg-primary/90 text-primary-foreground'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {chExams.length} {chExams.length === 1 ? 'Exam' : 'Exams'}
                          </Badge>
                        </div>
                        {ch.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {ch.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onOpenChange(false);
                          const deptId = subject.departmentIds?.[0] || '';
                          navigate(
                            `/dashboard/admin/shortnotes/create?subjectId=${subject.id}&chapterId=${ch.id}&chapterTitle=${encodeURIComponent(ch.title)}&departmentId=${deptId}`
                          );
                        }}
                        className="h-8 px-2 text-xs rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                        title="Create or Manage Chapter Shortnotes"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        <span className="hidden sm:inline">Shortnotes</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpandChapter(ch.id)}
                        className="h-8 px-2 text-xs rounded-lg text-muted-foreground hover:text-foreground"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(ch)}
                        className="h-8 w-8 p-0 rounded-lg text-primary hover:bg-primary/10"
                        title="Edit Chapter"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteChapter(ch)}
                        disabled={deletingId === ch.id}
                        className="h-8 w-8 p-0 rounded-lg text-destructive hover:bg-destructive/10"
                        title="Delete Chapter"
                      >
                        {deletingId === ch.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Collapsible Chapter Body: Assigned Exams & Quick Assign */}
                  {isExpanded && (
                    <div className="p-3.5 space-y-3 border-t bg-card animate-fade-in">
                      {/* Assigned Exams List */}
                      {chExams.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            Assigned Exams ({chExams.length})
                          </p>
                          <div className="space-y-1.5">
                            {chExams.map((exam) => (
                              <div
                                key={exam.examId}
                                className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors gap-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-foreground truncate">
                                      {exam.title}
                                    </span>
                                    <Badge
                                      className={`text-[9px] px-1.5 py-0 h-4 ${
                                        exam.isPublished
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-0'
                                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-0'
                                      }`}
                                    >
                                      {exam.isPublished ? 'Published' : 'Draft'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {exam.durationMinutes}m
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <FileQuestion className="h-3 w-3" />
                                      {exam.questionCount ?? 0} Questions
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    className="h-7 px-2 text-[11px] rounded-lg text-primary hover:bg-primary/10"
                                  >
                                    <Link
                                      to={`/dashboard/exams/${exam.examId}/edit`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Pencil className="h-3 w-3 mr-1" />
                                      Edit
                                    </Link>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleUnassignExam(exam, ch.title)}
                                    disabled={assigningExamId === exam.examId}
                                    className="h-7 w-7 p-0 rounded-lg text-destructive hover:bg-destructive/10"
                                    title="Unassign from this chapter"
                                  >
                                    {assigningExamId === exam.examId ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <X className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-muted/20 border border-dashed text-center">
                          <p className="text-xs text-muted-foreground">
                            No exams currently assigned to Chapter {ch.chapterNumber ?? (idx + 1)}.
                          </p>
                        </div>
                      )}

                      {/* Quick Assign Dropdown Row */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-border/50">
                        <div className="flex-1 min-w-0">
                          <Select
                            value={chapterAssignSelection[ch.id] || ''}
                            onValueChange={(examId) => {
                              if (examId) {
                                handleAssignExamToChapter(examId, ch);
                              }
                            }}
                            disabled={assigningExamId !== null}
                          >
                            <SelectTrigger className="h-8 text-xs rounded-xl bg-background border-primary/20">
                              <SelectValue placeholder="+ Assign an existing exam to this chapter..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {assignableExams.length === 0 ? (
                                <div className="p-2 text-xs text-muted-foreground text-center">
                                  All exams in this subject are already assigned
                                </div>
                              ) : (
                                <>
                                  {assignableExams
                                    .filter((e) => e.subjectId === subject.id)
                                    .map((e) => (
                                      <SelectItem key={e.examId} value={e.examId} className="text-xs">
                                        <span className="font-medium">{e.title}</span>
                                        {e.chapterTitle ? (
                                          <span className="text-[10px] text-muted-foreground ml-1.5">
                                            (currently in: {e.chapterTitle})
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-emerald-600 font-semibold ml-1.5">
                                            (unassigned)
                                          </span>
                                        )}
                                      </SelectItem>
                                    ))}

                                  {assignableExams.filter((e) => e.subjectId !== subject.id).length > 0 && (
                                    <>
                                      <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t mt-1">
                                        Other Exams (Will link to this subject)
                                      </div>
                                      {assignableExams
                                        .filter((e) => e.subjectId !== subject.id)
                                        .slice(0, 15)
                                        .map((e) => (
                                          <SelectItem key={e.examId} value={e.examId} className="text-xs">
                                            <span>{e.title}</span>
                                          </SelectItem>
                                        ))}
                                    </>
                                  )}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onOpenChange(false);
                            navigate(
                              `/dashboard/exams/new?subjectId=${subject.id}&chapterId=${ch.id}&chapterTitle=${encodeURIComponent(
                                ch.title
                              )}`
                            );
                          }}
                          className="h-8 text-xs font-semibold text-primary hover:bg-primary/10 rounded-xl whitespace-nowrap"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Create New Exam for this Chapter
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unassigned Subject Exams Section (if any exist) */}
        {!loading && unassignedExams.length > 0 && chapters.length > 0 && (
          <div className="mt-4 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <h4 className="text-xs font-bold text-foreground">
                  Unassigned Subject Exams ({unassignedExams.length})
                </h4>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Assign them to a chapter below
              </span>
            </div>

            <div className="space-y-2">
              {unassignedExams.map((exam) => (
                <div
                  key={exam.examId}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 rounded-xl border bg-card gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{exam.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {exam.durationMinutes} mins • {exam.questionCount ?? 0} questions
                    </p>
                  </div>

                  <div className="w-full sm:w-56 shrink-0">
                    <Select
                      onValueChange={(chId) => {
                        const targetCh = chapters.find((c) => c.id === chId);
                        if (targetCh) {
                          handleAssignExamToChapter(exam.examId, targetCh);
                        }
                      }}
                      disabled={assigningExamId === exam.examId}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-xl bg-background border-primary/20">
                        <SelectValue placeholder="Assign to Chapter..." />
                      </SelectTrigger>
                      <SelectContent>
                        {chapters.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id} className="text-xs">
                            Unit {ch.chapterNumber ?? ''}: {ch.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
