import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Subject, Chapter } from '@/types/subject';
import { Book } from '@/types/book';
import {
  getChapters,
  createChapter,
  updateChapter,
  deleteChapter,
} from '@/lib/subjects';
import { getSubjectCover } from '@/lib/subject-covers';
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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Check,
  X,
  Loader2,
  Layers,
  ChevronRight,
  BookMarked,
  Eye,
  Edit,
} from 'lucide-react';

export interface SubjectNotesManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: Subject | null;
  books: Book[];
  onNotesChanged?: () => void;
  onEditSubjectCover?: (subject: Subject) => void;
}

export function SubjectNotesManagerDialog({
  open,
  onOpenChange,
  subject,
  books,
  onNotesChanged,
  onEditSubjectCover,
}: SubjectNotesManagerDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);

  // New Chapter Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNumber, setNewNumber] = useState<number>(1);
  const [savingNew, setSavingNew] = useState(false);

  // Edit Chapter state
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNumber, setEditNumber] = useState<number>(1);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Chapter state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && subject?.id) {
      loadChapters();
      setShowAddForm(false);
      setEditingChapterId(null);
    } else {
      setChapters([]);
    }
  }, [open, subject?.id]);

  const loadChapters = async () => {
    if (!subject?.id) return;
    setLoading(true);
    try {
      const list = await getChapters(subject.id);
      setChapters(list);
      setNewNumber(list.length + 1);
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

  // Find note for a chapter
  const getNoteForChapter = (ch: Chapter): Book | undefined => {
    if (!subject?.id) return undefined;
    return books.find(
      (b) =>
        b.resourceType === 'short_note' &&
        b.subjectId === subject.id &&
        (b.chapterId === ch.id ||
          (typeof b.chapterNumber === 'number' && b.chapterNumber === ch.chapterNumber) ||
          (b.chapterTitle && ch.title && b.chapterTitle.toLowerCase().trim() === ch.title.toLowerCase().trim()))
    );
  };

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject?.id || !newTitle.trim()) return;

    setSavingNew(true);
    try {
      await createChapter(subject.id, {
        subjectId: subject.id,
        title: newTitle.trim(),
        chapterNumber: Number(newNumber) || chapters.length + 1,
      });

      toast({
        title: 'Chapter Created',
        description: `Unit ${newNumber}: "${newTitle.trim()}" has been added.`,
      });

      setNewTitle('');
      setShowAddForm(false);
      await loadChapters();
      onNotesChanged?.();
    } catch (err: any) {
      toast({
        title: 'Failed to create chapter',
        description: err.message || 'Database error occurred.',
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
  };

  const handleSaveEdit = async (chapterId: string) => {
    if (!subject?.id || !editTitle.trim()) return;

    setSavingEdit(true);
    try {
      await updateChapter(subject.id, chapterId, {
        title: editTitle.trim(),
        chapterNumber: Number(editNumber) || 1,
      });

      toast({
        title: 'Chapter Updated',
        description: `Changes to unit saved successfully.`,
      });

      setEditingChapterId(null);
      await loadChapters();
      onNotesChanged?.();
    } catch (err: any) {
      toast({
        title: 'Failed to update chapter',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!subject?.id) return;
    setDeletingId(chapterId);
    try {
      await deleteChapter(subject.id, chapterId);
      toast({
        title: 'Chapter Removed',
        description: 'The chapter has been removed from this subject.',
      });
      await loadChapters();
      onNotesChanged?.();
    } catch (err: any) {
      toast({
        title: 'Failed to delete chapter',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (!subject) return null;

  const coverUrl =
    subject.coverImageUrl ||
    (subject.name ? getSubjectCover(subject.name).url : '/placeholder.svg');

  const notesCount = chapters.filter((c) => Boolean(getNoteForChapter(c))).length;
  const totalUnits = Math.max(chapters.length, subject.totalUnits || 0, 1);
  const progressPercent = Math.min(100, Math.round((notesCount / totalUnits) * 100));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border shadow-2xl">
        {/* Header with Subject Book Cover Preview */}
        <div className="p-6 sm:p-7 bg-gradient-to-r from-purple-900/10 via-card to-primary/5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {/* Book Cover Preview */}
            <div className="relative group shrink-0">
              <div className="w-16 h-22 sm:w-20 sm:h-28 rounded-xl overflow-hidden shadow-md border-2 border-white/50 dark:border-white/10 bg-slate-900 flex items-center justify-center relative">
                <img
                  src={coverUrl}
                  alt={subject.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-y-0 left-0 w-1.5 bg-black/30 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-purple-600 text-white font-bold text-xs rounded-lg px-2.5">
                  Study Notes Book
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  {notesCount} of {totalUnits} units uploaded
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground mt-1">
                {subject.name}
              </h2>

              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-lg">
                Assign, generate with AI, and manage chapter-by-chapter pedagogical study notes for this subject.
              </p>

              {/* Progress bar */}
              <div className="mt-2.5 flex items-center gap-2 max-w-xs">
                <Progress value={progressPercent} className="h-2 rounded-full" />
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                  {progressPercent}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {onEditSubjectCover && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEditSubjectCover(subject);
                  onOpenChange(false);
                }}
                className="rounded-xl text-xs font-semibold gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Edit Coverpage
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Unit / Chapter
            </Button>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 sm:p-7 space-y-6">
          {/* Add Chapter Form */}
          {showAddForm && (
            <form
              onSubmit={handleCreateChapter}
              className="p-4 sm:p-5 rounded-2xl border-2 border-purple-500/30 bg-purple-500/5 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-purple-600" />
                  Add New Chapter / Unit
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="h-7 w-7 p-0 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <Label className="text-xs font-semibold">Unit Number</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newNumber}
                    onChange={(e) => setNewNumber(parseInt(e.target.value, 10) || 1)}
                    className="rounded-xl text-xs h-9 mt-1"
                    required
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs font-semibold">Chapter Title</Label>
                  <Input
                    placeholder="e.g. Further on Sets, The Number System, etc."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="rounded-xl text-xs h-9 mt-1"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-xl text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingNew || !newTitle.trim()}
                  className="rounded-xl text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                >
                  {savingNew ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Add Chapter'
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Chapters List */}
          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 text-purple-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Loading curriculum chapters...</p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-3xl border border-dashed bg-card/40 space-y-3">
              <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <h4 className="text-base font-bold font-display">No chapters added yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  Add the units or chapters of {subject.name} so you can assign or generate study notes for each.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddForm(true)}
                className="rounded-xl text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Chapter
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {chapters
                .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))
                .map((ch, idx) => {
                  const unitNum = ch.chapterNumber ?? idx + 1;
                  const isEditing = editingChapterId === ch.id;
                  const note = getNoteForChapter(ch);
                  const isDeleting = deletingId === ch.id;

                  return (
                    <div
                      key={ch.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-card ${
                        note
                          ? 'border-purple-500/30 hover:border-purple-500/60 shadow-xs'
                          : 'border-border/70 hover:border-border'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="sm:col-span-1">
                              <Label className="text-xs font-semibold">Unit Number</Label>
                              <Input
                                type="number"
                                min={1}
                                value={editNumber}
                                onChange={(e) => setEditNumber(parseInt(e.target.value, 10) || 1)}
                                className="rounded-xl text-xs h-9 mt-1"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <Label className="text-xs font-semibold">Chapter Title</Label>
                              <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="rounded-xl text-xs h-9 mt-1"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingChapterId(null)}
                              className="rounded-xl text-xs h-8"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(ch.id)}
                              disabled={savingEdit || !editTitle.trim()}
                              className="rounded-xl text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                            >
                              {savingEdit ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : 'Save Changes'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Unit Title & Status */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {/* Purple Squircle with Number */}
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 font-bold text-sm shadow-xs">
                              {unitNum}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm sm:text-base font-bold text-foreground truncate">
                                  Unit {unitNum}: {ch.title}
                                </h4>

                                {note ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold rounded-full px-2 py-0.5">
                                    <Check className="h-3 w-3 mr-1 stroke-[3]" />
                                    Study Notes Ready
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-semibold rounded-full px-2 py-0.5">
                                    Pending Notes
                                  </Badge>
                                )}
                              </div>

                              {note ? (
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                                  <span className="font-medium text-foreground/80 truncate">
                                    "{note.title}"
                                  </span>
                                  {note.sections && (
                                    <span>· {note.sections.length} topics</span>
                                  )}
                                  {note.readingTimeMinutes && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {note.readingTimeMinutes} min
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1">
                                  No study notes assigned to this chapter yet.
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                            {note ? (
                              <>
                                {/* 1. Read Note */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    onOpenChange(false);
                                    navigate(`/dashboard/books/${note.id}/read`);
                                  }}
                                  className="rounded-xl text-xs h-8 px-2.5 font-semibold gap-1 text-primary hover:bg-primary/5"
                                  title="Read Note Directly"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Read</span>
                                </Button>

                                {/* 2. Edit Note in Studio */}
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    onOpenChange(false);
                                    navigate(`/dashboard/admin/shortnotes/create?editBookId=${note.id}`);
                                  }}
                                  className="rounded-xl text-xs h-8 px-3 font-semibold bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-xs"
                                  title="Edit Sections, Definitions, MCQs & Cover"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span>Edit Note</span>
                                </Button>
                              </>
                            ) : (
                              <>
                                {/* Generate with AI */}
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    onOpenChange(false);
                                    const deptId = subject.departmentIds?.[0] || '';
                                    navigate(
                                      `/dashboard/admin/shortnotes/create?subjectId=${subject.id}&chapterId=${ch.id}&chapterTitle=${encodeURIComponent(ch.title)}&departmentId=${deptId}`
                                    );
                                  }}
                                  className="rounded-xl text-xs h-8 px-3 font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-1.5 shadow-xs"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>Generate with AI</span>
                                </Button>
                              </>
                            )}

                            {/* Edit Chapter Title */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartEdit(ch)}
                              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
                              title="Rename Chapter"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            {/* Delete Chapter */}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => handleDeleteChapter(ch.id)}
                              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-destructive"
                              title="Delete Chapter"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
