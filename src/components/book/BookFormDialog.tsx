import React, { useState, useEffect } from 'react';
import { Book, BookInput, BookResourceType, BookStatus, GoogleDriveFileInfo } from '@/types/book';
import { extractDriveFileId, validateDriveLink, buildDrivePreviewUrl } from '@/lib/google-drive';
import { Department } from '@/integrations/firebase/types';
import { Subject } from '@/types/subject';
import { getDepartments } from '@/lib/departments';
import { getSubjects } from '@/lib/subjects';
import { getSubjectCover } from '@/lib/subject-covers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  FileText,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Layers,
  Building,
  Tag,
} from 'lucide-react';

interface BookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book?: Book | null;
  onSave: (data: BookInput) => Promise<void>;
  defaultDepartmentId?: string;
  defaultSubjectId?: string;
}

export function BookFormDialog({
  open,
  onOpenChange,
  book,
  onSave,
  defaultDepartmentId,
  defaultSubjectId,
}: BookFormDialogProps) {
  const isEditing = Boolean(book?.id);

  // Departments and subjects
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  // Form Fields
  const [title, setTitle] = useState('');
  const [resourceType, setResourceType] = useState<BookResourceType>('textbook');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [driveUrl, setDriveUrl] = useState('');
  const [driveFileId, setDriveFileId] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [edition, setEdition] = useState('');
  const [publicationYear, setPublicationYear] = useState('');
  const [language, setLanguage] = useState('English');
  const [chapterLabelsInput, setChapterLabelsInput] = useState('');
  const [status, setStatus] = useState<BookStatus>('published');
  const [allowDownload, setAllowDownload] = useState<boolean>(true);
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [showCustomCoverInput, setShowCustomCoverInput] = useState<boolean>(false);

  // Drive Validation State
  const [validatingDrive, setValidatingDrive] = useState(false);
  const [driveValidation, setDriveValidation] = useState<GoogleDriveFileInfo | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form Submission State
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load departments and subjects on mount
  useEffect(() => {
    Promise.all([getDepartments(), getSubjects()])
      .then(([depts, subs]) => {
        setDepartments(depts);
        setAllSubjects(subs);
      })
      .catch(console.error);
  }, []);

  // Filter subjects based on selected department
  const filteredSubjects = React.useMemo(() => {
    if (!departmentId || departmentId === 'all') return allSubjects;
    return allSubjects.filter((sub) => {
      if (!sub.departmentIds || sub.departmentIds.length === 0) return true;
      return sub.departmentIds.includes(departmentId);
    });
  }, [allSubjects, departmentId]);

  // Populate data when dialog opens
  useEffect(() => {
    if (open) {
      setFormError(null);
      setValidationError(null);
      setDriveValidation(null);

      if (book) {
        setTitle(book.title || '');
        setResourceType(book.resourceType || 'textbook');
        setDepartmentId(book.departmentId || '');
        setSubjectId(book.subjectId || '');
        setCoverImageUrl(book.coverImageUrl || '');
        setShowCustomCoverInput(Boolean(book.coverImageUrl));
        setDriveUrl(book.driveUrl || '');
        setDriveFileId(book.driveFileId || '');
        setDescription(book.description || '');
        setAuthor(book.author || '');
        setEdition(book.edition || '');
        setPublicationYear(String(book.publicationYear || ''));
        setLanguage(book.language || 'English');
        setChapterLabelsInput(Array.isArray(book.chapterLabels) ? book.chapterLabels.join(', ') : '');
        setStatus(book.status || 'published');
        setAllowDownload(book.allowDownload ?? true);
        if (book.driveFileId) {
          setDriveValidation({
            fileId: book.driveFileId,
            fileName: book.title,
            mimeType: book.mimeType || 'application/pdf',
            previewUrl: buildDrivePreviewUrl(book.driveFileId),
            canDownload: book.allowDownload,
            accessible: true,
            fileSizeBytes: book.fileSizeBytes ?? 0,
            pageCount: book.pageCount ?? 0,
          });
        }
      } else {
        // Reset form for creation
        setTitle('');
        setResourceType('textbook');
        setDepartmentId(defaultDepartmentId && defaultDepartmentId !== 'all' ? defaultDepartmentId : '');
        setSubjectId(defaultSubjectId && defaultSubjectId !== 'all' ? defaultSubjectId : '');
        setCoverImageUrl('');
        setShowCustomCoverInput(false);
        setDriveUrl('');
        setDriveFileId('');
        setDescription('');
        setAuthor('');
        setEdition('');
        setPublicationYear('');
        setLanguage('English');
        setChapterLabelsInput('');
        setStatus('published');
        setAllowDownload(true);
      }
    }
  }, [open, book, defaultDepartmentId, defaultSubjectId]);

  // Find currently selected subject
  const selectedSubject = React.useMemo(() => {
    return allSubjects.find((s) => s.id === subjectId) || null;
  }, [allSubjects, subjectId]);

  // Derived cover URL from subject
  const selectedSubjectCover = React.useMemo(() => {
    if (!selectedSubject) return null;
    return getSubjectCover(selectedSubject.name, selectedSubject.coverImageUrl);
  }, [selectedSubject]);

  // If coverImageUrl is empty but a subject is selected, automatically apply subject cover
  useEffect(() => {
    if (selectedSubjectCover?.url && !coverImageUrl) {
      setCoverImageUrl(selectedSubjectCover.url);
    }
  }, [selectedSubjectCover, coverImageUrl]);

  // When subject changes, automatically update cover image to that subject's cover
  const handleSubjectChange = (newSubId: string) => {
    setSubjectId(newSubId);
    const sub = allSubjects.find((s) => s.id === newSubId);
    if (sub) {
      const cover = sub.coverImageUrl || getSubjectCover(sub.name).url;
      setCoverImageUrl(cover);
    }
  };

  // Auto-extract File ID when Drive URL changes
  const handleDriveUrlChange = (value: string) => {
    setDriveUrl(value);
    setValidationError(null);
    setDriveValidation(null);

    const extracted = extractDriveFileId(value);
    if (extracted) {
      setDriveFileId(extracted);
    }
  };

  // Live Validate Google Drive Link
  const handleValidateDriveLink = async () => {
    const extracted = extractDriveFileId(driveUrl);
    if (!extracted) {
      setValidationError('Please enter a valid Google Drive sharing link (e.g. https://drive.google.com/file/d/...)');
      return;
    }

    setValidatingDrive(true);
    setValidationError(null);

    try {
      const result = await validateDriveLink(driveUrl);
      if (result.accessible) {
        setDriveValidation(result);
        setDriveFileId(result.fileId);
        // Pre-fill title if empty
        if (!title.trim() && result.fileName && !result.fileName.startsWith('Drive Document')) {
          setTitle(result.fileName);
        }
      } else {
        setValidationError(result.error || 'The Google Drive file is not accessible. Make sure sharing is enabled.');
      }
    } catch (err: any) {
      setValidationError(err.message || 'Validation request failed');
    } finally {
      setValidatingDrive(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!title.trim()) {
      setFormError('Please enter a resource title.');
      return;
    }

    if (!departmentId) {
      setFormError('Please select a department.');
      return;
    }

    if (!subjectId) {
      setFormError('Please select a subject.');
      return;
    }

    const finalFileId = driveFileId || extractDriveFileId(driveUrl);
    if (!finalFileId) {
      setFormError('Please enter a valid Google Drive sharing URL.');
      return;
    }

    // Split chapter labels
    const chapterLabels = chapterLabelsInput
      .split(/[,;\n]/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const finalCover = coverImageUrl || selectedSubjectCover?.url || book?.coverImageUrl || '';

    const payload: BookInput = {
      title: title.trim(),
      resourceType,
      departmentId,
      departmentIds: [departmentId],
      subjectId,
      driveUrl: driveUrl.trim(),
      driveFileId: finalFileId,
      description: description.trim() || '',
      author: author.trim() || '',
      edition: edition.trim() || '',
      publicationYear: publicationYear.trim() || '',
      language: language.trim() || 'English',
      chapterLabels,
      status,
      allowDownload,
      mimeType: driveValidation?.mimeType || book?.mimeType || 'application/pdf',
      fileSizeBytes: driveValidation?.fileSizeBytes ?? book?.fileSizeBytes ?? 0,
      pageCount: driveValidation?.pageCount ?? book?.pageCount ?? 0,
      coverImageUrl: finalCover,
    };

    setIsSaving(true);
    try {
      await onSave(payload);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Save resource error:', err);
      const rawMsg = err?.message || '';
      if (rawMsg.toLowerCase().includes('permission') || err?.code === 'permission-denied') {
        setFormError(
          'Missing Firestore permissions: Your Firebase project needs the updated Firestore rules published for the "books" collection. Please update rules in Firebase Console.'
        );
      } else {
        setFormError(rawMsg || 'Failed to save resource. Please check your network and permissions.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2 text-foreground">
            {resourceType === 'short_note' ? (
              <FileText className="h-6 w-6 text-amber-500" />
            ) : (
              <BookOpen className="h-6 w-6 text-primary" />
            )}
            {isEditing ? 'Edit Library Resource' : 'Add New Library Resource'}
          </DialogTitle>
          <DialogDescription>
            Add textbooks and short notes to the ExamPro Digital Library using Google Drive documents.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {formError && (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {formError.toLowerCase().includes('permission') ? 'Permission Error' : 'Save Error'}
              </AlertTitle>
              <AlertDescription className="text-sm leading-relaxed">{formError}</AlertDescription>
            </Alert>
          )}

          {/* Resource Type & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">
                Resource Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={resourceType}
                onValueChange={(val: BookResourceType) => setResourceType(val)}
                disabled={isSaving}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="textbook">📖 Book (Full Curriculum Book)</SelectItem>
                  <SelectItem value="short_note">📝 Note (Summary / Handout)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">
                Publication Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={status}
                onValueChange={(val: BookStatus) => setStatus(val)}
                disabled={isSaving}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">🟢 Published (Visible to students)</SelectItem>
                  <SelectItem value="draft">🟡 Draft (Admin preview only)</SelectItem>
                  <SelectItem value="archived">⚪ Archived (Hidden from regular browsing)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Department & Subject Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/30 border border-border/60">
            <div className="space-y-2">
              <Label className="font-semibold flex items-center gap-1.5">
                <Building className="h-4 w-4 text-primary" />
                Department <span className="text-destructive">*</span>
              </Label>
              <Select
                value={departmentId}
                onValueChange={(val) => {
                  setDepartmentId(val);
                  setSubjectId(''); // reset subject when department changes
                  setCoverImageUrl('');
                  setShowCustomCoverInput(false);
                }}
                disabled={isSaving}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                Subject <span className="text-destructive">*</span>
              </Label>
              <Select
                value={subjectId}
                onValueChange={handleSubjectChange}
                disabled={isSaving || !departmentId}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={departmentId ? 'Select subject' : 'Select department first'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubjects.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject Cover Page Integration Preview */}
            {selectedSubject && selectedSubjectCover && (
              <div className="col-span-1 sm:col-span-2 mt-1 space-y-2">
                <div className="p-3.5 rounded-2xl bg-card border border-primary/20 shadow-xs flex items-center gap-3.5 animate-fade-in">
                  <div className="h-16 w-24 shrink-0 rounded-xl overflow-hidden bg-muted border border-border/80 shadow-xs">
                    <img
                      src={coverImageUrl || selectedSubjectCover.url}
                      alt={selectedSubject.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                        Subject Cover Applied
                      </Badge>
                      {selectedSubject.coverImageUrl ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Custom Subject Cover
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Curriculum Subject Cover
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate">
                      {selectedSubject.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      This resource is linked to &quot;{selectedSubject.name}&quot; and automatically inherits its cover page across all library views.
                    </p>
                  </div>
                </div>

                {/* Optional Custom Cover Override */}
                {showCustomCoverInput ? (
                  <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border border-border/60 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="custom-cover-input" className="text-xs font-medium">
                        Custom Cover Image URL (Optional Override)
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCoverImageUrl(selectedSubjectCover.url);
                          setShowCustomCoverInput(false);
                        }}
                        className="h-5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Reset to Subject Cover
                      </Button>
                    </div>
                    <Input
                      id="custom-cover-input"
                      placeholder="https://example.com/cover.jpg"
                      value={coverImageUrl}
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      className="rounded-lg text-xs h-8"
                    />
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCustomCoverInput(true)}
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-1"
                    >
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span>Use a custom cover image URL instead?</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Google Drive Integration */}
          <div className="space-y-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <Label htmlFor="drive-url" className="font-semibold flex items-center gap-1.5 text-foreground">
                <LinkIcon className="h-4 w-4 text-primary" />
                Google Drive Sharing Link <span className="text-destructive">*</span>
              </Label>
              {driveFileId && (
                <span className="text-xs font-mono text-muted-foreground">
                  ID: {driveFileId.slice(0, 10)}...
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                id="drive-url"
                placeholder="https://drive.google.com/file/d/1A2B3C4D5E.../view?usp=sharing"
                value={driveUrl}
                onChange={(e) => handleDriveUrlChange(e.target.value)}
                disabled={isSaving}
                className="rounded-xl font-mono text-xs sm:text-sm"
                required
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleValidateDriveLink}
                disabled={validatingDrive || !driveUrl.trim()}
                className="rounded-xl shrink-0 font-medium"
              >
                {validatingDrive ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1 text-primary" />
                )}
                Validate
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Paste the public or shared Google Drive document link. Make sure link sharing is set to{' '}
              <strong className="text-foreground">&quot;Anyone with the link can view&quot;</strong>.
            </p>

            {validationError && (
              <Alert variant="destructive" className="rounded-xl py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{validationError}</AlertDescription>
              </Alert>
            )}

            {driveValidation && (
              <div className="p-3 rounded-xl bg-card border border-green-500/40 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground line-clamp-1">
                      {driveValidation.fileName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Verified Document ({driveValidation.mimeType})
                    </p>
                  </div>
                </div>

                <a
                  href={driveValidation.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0 font-medium"
                >
                  Preview <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Title & Author */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="book-title" className="font-semibold">
                Resource Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="book-title"
                placeholder="e.g. General Psychology & Human Behavior (Grade 12 / University)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSaving}
                className="rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="book-author" className="text-xs font-semibold">
                  Author / Source
                </Label>
                <Input
                  id="book-author"
                  placeholder="e.g. Dr. John Doe, Ministry of Education"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  disabled={isSaving}
                  className="rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="book-edition" className="text-xs font-semibold">
                  Edition / Year
                </Label>
                <Input
                  id="book-edition"
                  placeholder="e.g. 3rd Edition, 2024"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  disabled={isSaving}
                  className="rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="book-language" className="text-xs font-semibold">
                  Language
                </Label>
                <Select value={language} onValueChange={setLanguage} disabled={isSaving}>
                  <SelectTrigger className="rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Afaan Oromoo">Afaan Oromoo</SelectItem>
                    <SelectItem value="Amharic">Amharic</SelectItem>
                    <SelectItem value="Tigrinya">Tigrinya</SelectItem>
                    <SelectItem value="Somali">Somali</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="book-description" className="font-semibold">
                Description / Summary
              </Label>
              <Textarea
                id="book-description"
                placeholder="Comprehensive summary of covered topics, units, or target curriculum..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSaving}
                rows={2}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="book-chapters" className="font-semibold flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" />
                Chapter / Topic Labels (Optional)
              </Label>
              <Input
                id="book-chapters"
                placeholder="e.g. Chapter 1: Introduction, Chapter 2: Memory, Chapter 3: Cognition (comma-separated)"
                value={chapterLabelsInput}
                onChange={(e) => setChapterLabelsInput(e.target.value)}
                disabled={isSaving}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Separated by commas. These enable students to browse specific topics and allow granular AI exam generation.
              </p>
            </div>
          </div>

          {/* Student Download Permissions */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/50">
            <div className="space-y-0.5">
              <Label htmlFor="allow-download" className="font-semibold cursor-pointer">
                Allow Student File Downloads
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, authorized students can download a local copy of this resource
              </p>
            </div>
            <Switch
              id="allow-download"
              checked={allowDownload}
              onCheckedChange={setAllowDownload}
              disabled={isSaving}
            />
          </div>

          {/* Footer Actions */}
          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-gradient-to-r from-primary to-primary/80 font-semibold"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Saving Resource...' : isEditing ? 'Save Changes' : 'Add to Library'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
