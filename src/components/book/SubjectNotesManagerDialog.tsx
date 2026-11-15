import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Subject, Chapter } from '@/types/subject';
import { Book } from '@/types/book';
import {
  getChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  updateSubject,
} from '@/lib/subjects';
import { updateBook, deleteBook, createBook } from '@/lib/books';
import { extractDriveFileId } from '@/lib/google-drive';
import { getSubjectCover } from '@/lib/subject-covers';
import { uploadSubjectCoverImage, validateCoverImage } from '@/lib/image-upload';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Globe,
  GlobeLock,
  Upload,
  Link2,
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
  const { user } = useAuth();

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

  // Note Publish/Draft toggle & Delete state
  const [togglingNoteId, setTogglingNoteId] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState<Book | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState<boolean>(false);

  // Add / Edit chapter note (Google Drive link) form state
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [noteFormMode, setNoteFormMode] = useState<'create' | 'edit'>('create');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteFormChapterId, setNoteFormChapterId] = useState<string>('');
  const [noteFormTitle, setNoteFormTitle] = useState('');
  const [noteFormDriveUrl, setNoteFormDriveUrl] = useState('');
  const [noteFormStatus, setNoteFormStatus] = useState<'published' | 'draft'>('published');
  const [savingNoteForm, setSavingNoteForm] = useState(false);
  const [noteFormError, setNoteFormError] = useState<string | null>(null);

  // Notes Cover Image state & upload
  const [localCoverUrl, setLocalCoverUrl] = useState<string>('');
  const [uploadingCover, setUploadingCover] = useState<boolean>(false);
  const coverFileRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (subject) {
      setLocalCoverUrl(subject.notesCoverImageUrl || subject.coverImageUrl || '');
    }
  }, [subject]);

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !subject) return;

    const validation = validateCoverImage(file);
    if (!validation.isValid) {
      toast({
        title: 'Invalid Image',
        description: validation.error || 'Please choose a valid JPG, PNG, or WebP image.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingCover(true);
    try {
      const res = await uploadSubjectCoverImage(file, { subjectId: subject.id });
      await updateSubject(subject.id, { notesCoverImageUrl: res.url });
      setLocalCoverUrl(res.url);
      toast({
        title: 'Notes Coverpage Uploaded',
        description: 'Study notes cover image updated successfully without modifying textbook covers.',
      });
      if (onNotesChanged) onNotesChanged();
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err.message || 'Could not upload cover image.',
        variant: 'destructive',
      });
    } finally {
      setUploadingCover(false);
      if (e.target) e.target.value = '';
    }
  };

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
        description: `Chapter ${newNumber}: "${newTitle.trim()}" has been added.`,
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

  const handleToggleNoteStatus = async (note: Book) => {
    const nextStatus: 'published' | 'draft' = note.status === 'published' ? 'draft' : 'published';
    setTogglingNoteId(note.id);
    try {
      await updateBook(note.id, { status: nextStatus });
      toast({
        title: nextStatus === 'published' ? 'Note Published Live!' : 'Note Unpublished (Saved as Draft)',
        description:
          nextStatus === 'published'
            ? `"${note.title}" is now published and visible to students.`
            : `"${note.title}" is saved as draft and hidden from students.`,
      });
      onNotesChanged?.();
    } catch (err: any) {
      toast({
        title: 'Failed to update status',
        description: err.message || 'Database error occurred.',
        variant: 'destructive',
      });
    } finally {
      setTogglingNoteId(null);
    }
  };

  const handleConfirmDeleteNote = async () => {
    if (!deletingNote) return;
    setIsDeletingNote(true);
    try {
      await deleteBook(deletingNote.id);
      toast({
        title: 'Study Note Deleted',
        description: `"${deletingNote.title}" has been permanently removed.`,
      });
      setDeletingNote(null);
      onNotesChanged?.();
    } catch (err: any) {
      toast({
        title: 'Failed to delete note',
        description: err.message || 'Permission denied or network error.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingNote(false);
    }
  };

  const openCreateNoteForm = (chapterId?: string) => {
    setNoteFormMode('create');
    setEditingNoteId(null);
    setNoteFormChapterId(chapterId || chapters[0]?.id || '');
    setNoteFormTitle('');
    setNoteFormDriveUrl('');
    setNoteFormStatus('published');
    setNoteFormError(null);
    setNoteFormOpen(true);
  };

  const openEditNoteForm = (note: Book) => {
    setNoteFormMode('edit');
    setEditingNoteId(note.id);
    setNoteFormChapterId(note.chapterId || chapters[0]?.id || '');
    setNoteFormTitle(note.title || '');
    setNoteFormDriveUrl(note.driveUrl || '');
    setNoteFormStatus(note.status === 'draft' ? 'draft' : 'published');
    setNoteFormError(null);
    setNoteFormOpen(true);
  };

  const handleSaveNoteForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject?.id) return;

    const driveId = extractDriveFileId(noteFormDriveUrl);
    if (!noteFormTitle.trim()) {
      setNoteFormError('Please enter a note title.');
      return;
    }
    if (!driveId) {
      setNoteFormError('Please paste a valid Google Drive sharing link.');
      return;
    }

    const chapter = chapters.find((c) => c.id === noteFormChapterId);
    const departmentId = subject.departmentIds?.[0] || 'all';

    setSavingNoteForm(true);
    setNoteFormError(null);
    try {
      if (noteFormMode === 'create') {
        await createBook(
          {
            title: noteFormTitle.trim(),
            resourceType: 'short_note',
            departmentId,
            departmentIds: subject.departmentIds || [],
            subjectId: subject.id,
            subjectName: subject.name,
            chapterId: chapter?.id || '',
            chapterTitle: chapter?.title || '',
            chapterNumber: chapter?.chapterNumber,
            driveUrl: noteFormDriveUrl.trim(),
            driveFileId: driveId,
            status: noteFormStatus,
            language: 'English',
          },
          user?.uid || ''
        );
        toast({
          title: 'Chapter Note Added',
          description: `"${noteFormTitle.trim()}" was linked${
            chapter ? ` to Chapter ${chapter.chapterNumber ?? ''}: ${chapter.title}` : ''
          }.`,
        });
      } else if (editingNoteId) {
        await updateBook(editingNoteId, {
          title: noteFormTitle.trim(),
          driveUrl: noteFormDriveUrl.trim(),
          driveFileId: driveId,
          status: noteFormStatus,
          chapterId: chapter?.id || '',
          chapterTitle: chapter?.title || '',
          chapterNumber: chapter?.chapterNumber,
        } as Partial<Book>);
        toast({
          title: 'Chapter Note Updated',
          description: `Changes to "${noteFormTitle.trim()}" saved successfully.`,
        });
      }
      setNoteFormOpen(false);
      await loadChapters();
      onNotesChanged?.();
    } catch (err: any) {
      setNoteFormError(err.message || 'Could not save the note. Please try again.');
    } finally {
      setSavingNoteForm(false);
    }
  };

  if (!subject) return null;

  const coverUrl =
    localCoverUrl ||
    subject.notesCoverImageUrl ||
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
                  {notesCount} of {totalUnits} chapters uploaded
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

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
            {/* Hidden cover file picker */}
            <input
              type="file"
              ref={coverFileRef}
              accept="image/*"
              className="hidden"
              onChange={handleCoverFileChange}
            />

            <Button
              variant="outline"
              size="sm"
              disabled={uploadingCover}
              onClick={() => coverFileRef.current?.click()}
              className="rounded-xl text-xs font-semibold gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            >
              {uploadingCover ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Upload Notes Cover</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="rounded-xl text-xs font-semibold gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Chapter
            </Button>

            <Button
              size="sm"
              disabled={chapters.length === 0}
              onClick={() => openCreateNoteForm()}
              title={chapters.length === 0 ? 'Add a chapter first' : 'Add a chapter note by pasting a Google Drive link'}
              className="rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 gap-1.5 shadow-xs"
            >
              <Link2 className="h-3.5 w-3.5" />
              Add Note
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
                  Add New Chapter
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
                  <Label className="text-xs font-semibold">Chapter Number</Label>
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
                  const hasRichContent = Boolean(
                    note && ((note.sections && note.sections.length > 0) || note.content)
                  );

                  return (
                    <div
                      key={ch.id}
                      className={`relative overflow-hidden p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-card ${
                        note
                          ? 'border-purple-500/30 hover:border-purple-500/60 shadow-xs'
                          : 'border-border/70 hover:border-border'
                      }`}
                    >
                      {/* Left Curved Purple Accent Ribbon (matches student chapter list) */}
                      <div className="absolute left-0 top-3 bottom-3 w-1.5 bg-[#7c3aed] rounded-r-full" />
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="sm:col-span-1">
                              <Label className="text-xs font-semibold">Chapter Number</Label>
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
                                  Chapter {unitNum}: {ch.title}
                                </h4>

                                {note ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {note.status === 'published' ? (
                                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold rounded-full px-2 py-0.5">
                                        <Check className="h-3 w-3 mr-1 stroke-[3]" />
                                        Published Live
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px] font-semibold rounded-full px-2 py-0.5">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Draft (Hidden)
                                      </Badge>
                                    )}
                                  </div>
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
                                {/* 1. Publish / Unpublish Toggle */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={togglingNoteId === note.id}
                                  onClick={() => handleToggleNoteStatus(note)}
                                  className={`rounded-xl text-xs h-8 px-2.5 font-semibold gap-1.5 transition-all ${
                                    note.status === 'published'
                                      ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-amber-500/30'
                                      : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-500/30'
                                  }`}
                                  title={note.status === 'published' ? 'Unpublish note (hide from students)' : 'Publish note live to students'}
                                >
                                  {togglingNoteId === note.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : note.status === 'published' ? (
                                    <>
                                      <GlobeLock className="h-3.5 w-3.5" />
                                      <span className="hidden md:inline">Unpublish</span>
                                    </>
                                  ) : (
                                    <>
                                      <Globe className="h-3.5 w-3.5" />
                                      <span className="hidden md:inline">Publish</span>
                                    </>
                                  )}
                                </Button>

                                {/* 2. Read Note (R in CRUD) */}
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

                                {/* 3. Edit Note (U in CRUD) — rich notes open the Studio, link-only notes open the link editor */}
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (hasRichContent) {
                                      onOpenChange(false);
                                      navigate(`/dashboard/admin/shortnotes/create?editBookId=${note.id}`);
                                    } else {
                                      openEditNoteForm(note);
                                    }
                                  }}
                                  className="rounded-xl text-xs h-8 px-3 font-semibold bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-xs"
                                  title={hasRichContent ? 'Edit sections, definitions, MCQs & cover' : 'Edit title, Google Drive link & status'}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </Button>

                                {/* 4. Delete Note (D in CRUD) */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingNote(note)}
                                  className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Delete Note"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <>
                                {/* Generate with AI (C in CRUD) */}
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
                                  <span>Generate AI</span>
                                </Button>

                                {/* Add Note via Google Drive link (C in CRUD) */}
                                <Button
                                  size="sm"
                                  onClick={() => openCreateNoteForm(ch.id)}
                                  className="rounded-xl text-xs h-8 px-3 font-semibold bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-xs"
                                  title="Paste a Google Drive link to add a chapter note"
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  <span>Add Note</span>
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

        {/* Delete Note Confirmation Dialog */}
        <AlertDialog open={Boolean(deletingNote)} onOpenChange={(open) => !open && setDeletingNote(null)}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Study Note?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete &quot;{deletingNote?.title}&quot;?
                All sections, definitions, worked examples, and interactive MCQs in this note will be removed.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteNote}
                disabled={isDeletingNote}
                className="rounded-xl bg-destructive hover:bg-destructive/90 text-white font-semibold"
              >
                {isDeletingNote && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete Note
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add / Edit Chapter Note (Google Drive link) Dialog */}
        <Dialog open={noteFormOpen} onOpenChange={setNoteFormOpen}>
          <DialogContent className="max-w-lg rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Link2 className="h-5 w-5 text-purple-600" />
                {noteFormMode === 'create' ? 'Add Chapter Note' : 'Edit Chapter Note'}
              </DialogTitle>
              <DialogDescription>
                Paste a Google Drive link to attach a study note to a chapter of {subject?.name}.
                Students will open it in the offline reader.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveNoteForm} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Chapter</Label>
                <Select value={noteFormChapterId} onValueChange={setNoteFormChapterId}>
                  <SelectTrigger className="rounded-xl h-10 text-sm">
                    <SelectValue placeholder="Select a chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...chapters]
                      .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))
                      .map((ch, i) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          Chapter {ch.chapterNumber ?? i + 1}: {ch.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Note Title</Label>
                <Input
                  value={noteFormTitle}
                  onChange={(e) => setNoteFormTitle(e.target.value)}
                  placeholder="e.g. Chapter 1 — Further on Sets"
                  className="rounded-xl h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Google Drive Link</Label>
                <Input
                  value={noteFormDriveUrl}
                  onChange={(e) => setNoteFormDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="rounded-xl h-10 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Make sure the file is shared as &quot;Anyone with the link&quot;.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Visibility</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteFormStatus('published')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                      noteFormStatus === 'published'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteFormStatus('draft')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                      noteFormStatus === 'draft'
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <GlobeLock className="h-3.5 w-3.5" />
                    Draft
                  </button>
                </div>
              </div>

              {noteFormError && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  {noteFormError}
                </p>
              )}

              <DialogFooter className="gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNoteFormOpen(false)}
                  disabled={savingNoteForm}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingNoteForm}
                  className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                >
                  {savingNoteForm && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {noteFormMode === 'create' ? 'Add Note' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
