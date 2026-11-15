import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, BookInput, BookResourceType, BookStatus, GoogleDriveFileInfo } from '@/types/book';
import { extractDriveFileId, validateDriveLink, buildDrivePreviewUrl } from '@/lib/google-drive';
import { Department } from '@/integrations/firebase/types';
import { Subject, Chapter } from '@/types/subject';
import { getDepartments } from '@/lib/departments';
import { getSubjects, getChapters } from '@/lib/subjects';
import { getSubjectCover } from '@/lib/subject-covers';
import { uploadSubjectCoverImage } from '@/lib/image-upload';
import { auth, storage } from '@/integrations/firebase/client';
import { ref, uploadBytes } from 'firebase/storage';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
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
  Upload,
  Image as ImageIcon,
  Bookmark,
  Check,
  Plus,
  Info,
} from 'lucide-react';

interface BookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book?: Book | null;
  onSave: (data: BookInput) => Promise<void>;
  defaultDepartmentId?: string;
  defaultSubjectId?: string;
  defaultResourceType?: BookResourceType;
}

export function BookFormDialog({
  open,
  onOpenChange,
  book,
  onSave,
  defaultDepartmentId,
  defaultSubjectId,
  defaultResourceType,
}: BookFormDialogProps) {
  const isEditing = Boolean(book?.id);
  const navigate = useNavigate();

  // Departments and subjects
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  // Form Fields
  const [title, setTitle] = useState('');
  const [resourceType, setResourceType] = useState<BookResourceType>(defaultResourceType || 'short_note');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [driveUrl, setDriveUrl] = useState('');
  const [driveFileId, setDriveFileId] = useState('');
  const [protectedFile, setProtectedFile] = useState<File | null>(null);
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
  const [uploadingCover, setUploadingCover] = useState<boolean>(false);
  const [uploadCoverProgress, setUploadCoverProgress] = useState<number>(0);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Chapter selection state for Google Drive Links
  const [subjectChapters, setSubjectChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all');
  const [selectedChapterTitle, setSelectedChapterTitle] = useState<string>('');
  const [selectedChapterNumber, setSelectedChapterNumber] = useState<number | undefined>(undefined);
  const [customChapterTitle, setCustomChapterTitle] = useState<string>('');

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
        setResourceType(book.resourceType || defaultResourceType || 'short_note');
        setDepartmentId(book.departmentId || '');
        setSubjectId(book.subjectId || '');
        setCoverImageUrl(book.coverImageUrl || '');
        setShowCustomCoverInput(Boolean(book.coverImageUrl));
        setDriveUrl(book.driveUrl || '');
        setDriveFileId(book.driveFileId || '');
        setProtectedFile(null);
        setDescription(book.description || '');
        setAuthor(book.author || '');
        setEdition(book.edition || '');
        setPublicationYear(String(book.publicationYear || ''));
        setLanguage(book.language || 'English');
        setChapterLabelsInput(Array.isArray(book.chapterLabels) ? book.chapterLabels.join(', ') : '');
        setStatus(book.status || 'published');
        setAllowDownload(book.allowDownload ?? true);
        setSelectedChapterId(book.chapterId || (book.chapterTitle ? 'custom' : 'all'));
        setSelectedChapterTitle(book.chapterTitle || '');
        setSelectedChapterNumber(book.chapterNumber);
        setCustomChapterTitle(book.chapterTitle || '');
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
        setResourceType(defaultResourceType || 'short_note');
        setDepartmentId(defaultDepartmentId && defaultDepartmentId !== 'all' ? defaultDepartmentId : '');
        setSubjectId(defaultSubjectId && defaultSubjectId !== 'all' ? defaultSubjectId : '');
        setCoverImageUrl('');
        setShowCustomCoverInput(false);
        setDriveUrl('');
        setDriveFileId('');
        setProtectedFile(null);
        setDescription('');
        setAuthor('');
        setEdition('');
        setPublicationYear('');
        setLanguage('English');
        setChapterLabelsInput('');
        setStatus('published');
        setAllowDownload(true);
        setSelectedChapterId('all');
        setSelectedChapterTitle('');
        setSelectedChapterNumber(undefined);
        setCustomChapterTitle('');
      }
    }
  }, [open, book, defaultDepartmentId, defaultSubjectId, defaultResourceType]);

  // Fetch chapters whenever subjectId changes
  useEffect(() => {
    if (subjectId) {
      setLoadingChapters(true);
      getChapters(subjectId)
        .then((chs) => {
          setSubjectChapters(chs);
        })
        .catch((err) => {
          console.warn('Could not load chapters for subject:', err);
          setSubjectChapters([]);
        })
        .finally(() => {
          setLoadingChapters(false);
        });
    } else {
      setSubjectChapters([]);
    }
  }, [subjectId]);

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
    setSelectedChapterId('all');
    setSelectedChapterTitle('');
    setSelectedChapterNumber(undefined);
    setCustomChapterTitle('');
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
    const hasExistingProtectedFile = Boolean(book?.storagePath);
    if (!protectedFile && !hasExistingProtectedFile && !finalFileId) {
      setFormError('Upload a private PDF or enter a valid Google Drive sharing URL.');
      return;
    }
    if (protectedFile && (protectedFile.type !== 'application/pdf' || protectedFile.size > 25 * 1024 * 1024)) {
      setFormError('Upload a PDF file no larger than 25 MB.');
      return;
    }

    // Split chapter labels
    const chapterLabels = chapterLabelsInput
      .split(/[,;\n]/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const finalCover = coverImageUrl || selectedSubjectCover?.url || book?.coverImageUrl || '';

    // Determine final chapterId, chapterTitle, chapterNumber
    let finalChapterId: string | undefined = undefined;
    let finalChapterTitle: string | undefined = undefined;
    let finalChapterNumber: number | undefined = undefined;

    if (selectedChapterId === 'custom') {
      finalChapterTitle = customChapterTitle.trim() || undefined;
    } else if (selectedChapterId && selectedChapterId !== 'all') {
      finalChapterId = selectedChapterId;
      const matchedCh = subjectChapters.find((c) => c.id === selectedChapterId);
      if (matchedCh) {
        finalChapterTitle = matchedCh.title;
        finalChapterNumber = matchedCh.chapterNumber;
      }
    }

    const finalDepartmentIds =
      departmentId === 'all'
        ? ['all', ...departments.map((d) => d.id)]
        : Array.from(
            new Set([
              departmentId,
              ...(selectedSubject?.departmentIds || []),
            ])
          );

    const payload: BookInput = {
      title: title.trim(),
      resourceType,
      departmentId,
      departmentIds: finalDepartmentIds,
      subjectId,
      chapterId: finalChapterId,
      chapterTitle: finalChapterTitle,
      chapterNumber: finalChapterNumber,
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
    let uploadedStoragePath = book?.storagePath || '';
    try {
      if (protectedFile) {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('Please sign in again before uploading a learning resource.');
        const safeName = protectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'resource.pdf';
        uploadedStoragePath = `protected-books/${currentUser.uid}/${crypto.randomUUID()}/${safeName}`;
        await uploadBytes(ref(storage, uploadedStoragePath), protectedFile, {
          contentType: 'application/pdf',
          customMetadata: { uploadedBy: currentUser.uid },
        });
        payload.storagePath = uploadedStoragePath;
        payload.driveUrl = '';
        payload.driveFileId = '';
        payload.mimeType = 'application/pdf';
        payload.fileSizeBytes = protectedFile.size;
      }
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
            Add textbooks and short notes to the EthioSmart Digital Library using Google Drive documents.
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
          <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/60">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm flex items-center justify-between">
                <span>Resource Category <span className="text-destructive">*</span></span>
                <span className="text-xs font-normal text-muted-foreground">
                  Controls which section students find this material under
                </span>
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Short Note Option */}
                <div
                  onClick={() => !isSaving && setResourceType('short_note')}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 select-none ${
                    resourceType === 'short_note'
                      ? 'border-purple-600 bg-purple-500/10 shadow-xs ring-1 ring-purple-500/30'
                      : 'border-border/70 hover:border-purple-500/40 bg-card'
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      resourceType === 'short_note'
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-500/15 text-purple-600'
                    }`}
                  >
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs sm:text-sm font-bold text-foreground">
                        📝 Study Note / Handout
                      </p>
                      {resourceType === 'short_note' && (
                        <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Displayed in <strong>Chapter Study Notes</strong> view. Grouped by subject and chapters.
                    </p>
                  </div>
                </div>

                {/* Full Textbook Option */}
                <div
                  onClick={() => !isSaving && setResourceType('textbook')}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 select-none ${
                    resourceType === 'textbook'
                      ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                      : 'border-border/70 hover:border-primary/40 bg-card'
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      resourceType === 'textbook'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-primary/15 text-primary'
                    }`}
                  >
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs sm:text-sm font-bold text-foreground">
                        📖 Curriculum Textbook
                      </p>
                      {resourceType === 'textbook' && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Displayed in <strong>Curriculum Books</strong> library grid. For complete book volumes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="space-y-1">
                <Label className="font-semibold text-xs">
                  Publication Status <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={status}
                  onValueChange={(val: BookStatus) => setStatus(val)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="rounded-xl h-9 text-xs">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">🟢 Published (Visible to all students)</SelectItem>
                    <SelectItem value="draft">🟡 Draft (Admin preview only)</SelectItem>
                    <SelectItem value="archived">⚪ Archived (Hidden from students)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-4 sm:pt-0">
                <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>
                  {status === 'published'
                    ? 'Students can browse, open and read this resource immediately.'
                    : 'Saved in draft mode. Only admins can see it until published.'}
                </span>
              </div>
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
                  <SelectValue placeholder="Select department (or All Departments)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    🌐 All Departments (Universal — Visible to All Students)
                  </SelectItem>
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

            {/* Study Note Shortcut to Full Studio Editor */}
            {book?.resourceType === 'short_note' && (
              <div className="col-span-1 sm:col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-primary/10 to-indigo-500/10 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Interactive Study Note Detected</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Edit sections, conceptual explanations, flashcards & interactive MCQs directly in the Studio.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/dashboard/admin/shortnotes/edit/${book.id}`);
                  }}
                  className="rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shrink-0 shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Open in Chapter Studio &rarr;
                </Button>
              </div>
            )}

            {/* Book / Study Note Cover Page Art & Upload */}
            <div className="col-span-1 sm:col-span-2 mt-1 space-y-3 p-4 rounded-2xl border border-primary/20 bg-card/60 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                  <Label className="text-xs font-bold text-foreground">
                    Book & Study Note Cover Page Image
                  </Label>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${
                    coverImageUrl && (!selectedSubjectCover || coverImageUrl !== selectedSubjectCover.url)
                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {coverImageUrl && (!selectedSubjectCover || coverImageUrl !== selectedSubjectCover.url)
                    ? 'Custom Uploaded Cover'
                    : 'Auto Subject Curriculum Cover'}
                </Badge>
              </div>

              {/* Cover Preview & Upload Controls */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative aspect-[4/3] w-28 sm:w-36 rounded-xl overflow-hidden bg-muted border border-border/80 shadow-md shrink-0">
                  <img
                    src={coverImageUrl || selectedSubjectCover?.url || '/placeholder.svg'}
                    alt={title || 'Book Cover'}
                    className="h-full w-full object-cover"
                  />
                  {uploadingCover && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center">
                      <Loader2 className="h-5 w-5 text-primary animate-spin mb-1" />
                      <span className="text-[10px] font-bold text-foreground">Uploading...</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1 min-w-0 w-full">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload an authentic cover page image like a textbook. Supports JPG, PNG, WebP (4:3 ratio recommended).
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="file"
                      ref={coverFileInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingCover(true);
                        setUploadCoverProgress(20);
                        try {
                          const result = await uploadSubjectCoverImage(file, {
                            subjectId: subjectId || undefined,
                            onProgress: (pct) => setUploadCoverProgress(pct),
                          });
                          setCoverImageUrl(result.url);
                          setShowCustomCoverInput(false);
                        } catch (err: any) {
                          setFormError(err.message || 'Failed to upload cover image.');
                        } finally {
                          setUploadingCover(false);
                          if (coverFileInputRef.current) coverFileInputRef.current.value = '';
                        }
                      }}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => coverFileInputRef.current?.click()}
                      disabled={uploadingCover}
                      className="rounded-xl h-8 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {uploadingCover ? 'Uploading...' : 'Upload Cover Image'}
                    </Button>

                    {coverImageUrl && selectedSubjectCover && coverImageUrl !== selectedSubjectCover.url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCoverImageUrl(selectedSubjectCover.url);
                          setShowCustomCoverInput(false);
                        }}
                        className="rounded-xl h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Reset to Subject Cover
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCustomCoverInput((prev) => !prev)}
                      className="rounded-xl h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showCustomCoverInput ? 'Hide URL Input' : 'Use Image URL'}
                    </Button>
                  </div>

                  {uploadingCover && (
                    <div className="space-y-1 pt-1">
                      <Progress value={uploadCoverProgress} className="h-1.5 w-full" />
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Processing & optimizing cover image ({uploadCoverProgress}%)...
                      </span>
                    </div>
                  )}

                  {showCustomCoverInput && (
                    <div className="pt-2 animate-fade-in">
                      <Input
                        id="custom-cover-input"
                        placeholder="https://example.com/cover-image.jpg"
                        value={coverImageUrl}
                        onChange={(e) => setCoverImageUrl(e.target.value)}
                        className="rounded-xl text-xs h-8"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Private Firebase Storage upload */}
          <div className="space-y-3 p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-600" />
              <Label htmlFor="protected-book-file" className="font-semibold">Private PDF Upload (Recommended)</Label>
              <Badge variant="secondary">Protected</Badge>
            </div>
            <Input
              id="protected-book-file"
              type="file"
              accept="application/pdf,.pdf"
              disabled={isSaving}
              className="rounded-xl"
              onChange={(event) => setProtectedFile(event.target.files?.[0] || null)}
            />
            {protectedFile ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Selected: {protectedFile.name} ({(protectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            ) : book?.storagePath ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">A private Firebase file is already attached. Upload a new PDF to replace it.</p>
            ) : (
              <p className="text-xs text-muted-foreground">PDF only, maximum 25 MB. Students receive access only after server-side entitlement checks.</p>
            )}
          </div>

          {/* Legacy Google Drive option for existing resources during migration */}
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
              Legacy Google Drive links are supported for existing resources. New resources should use the private PDF upload above.
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

            {/* Choose Chapter for this Link — only relevant for study notes scoped to a chapter */}
            {resourceType !== 'textbook' && (
            <div className="pt-3 border-t border-primary/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <Bookmark className="h-3.5 w-3.5 text-primary" />
                  Target Chapter / Scope for this Link (Optional)
                </Label>
                <div className="flex items-center gap-1.5">
                  {loadingChapters && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  <Badge variant="outline" className="text-[10px] font-medium border-primary/30 text-primary">
                    {selectedChapterId === 'all'
                      ? 'Entire Course / All Chapters'
                      : selectedChapterId === 'custom'
                      ? 'Custom Chapter'
                      : 'Specific Chapter'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Select
                    value={selectedChapterId}
                    onValueChange={(val) => {
                      setSelectedChapterId(val);
                      if (val === 'all') {
                        setSelectedChapterTitle('');
                        setSelectedChapterNumber(undefined);
                      } else if (val === 'custom') {
                        // Keep custom title
                      } else {
                        const ch = subjectChapters.find((c) => c.id === val);
                        if (ch) {
                          setSelectedChapterTitle(ch.title);
                          setSelectedChapterNumber(ch.chapterNumber);
                          const labelText = `Chapter ${ch.chapterNumber ?? ''}: ${ch.title}`.trim();
                          if (!chapterLabelsInput.toLowerCase().includes(ch.title.toLowerCase())) {
                            setChapterLabelsInput((prev) => (prev ? `${prev}, ${labelText}` : labelText));
                          }
                        }
                      }
                    }}
                    disabled={isSaving || !subjectId}
                  >
                    <SelectTrigger className="rounded-xl text-xs sm:text-sm bg-card h-9">
                      <SelectValue placeholder={subjectId ? 'Choose a chapter...' : 'Select a subject first'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">📖 Entire Course / All Chapters</SelectItem>
                      {subjectChapters.map((ch, idx) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          Chapter {ch.chapterNumber ?? idx + 1}: {ch.title}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">✍️ Custom Chapter Title...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedChapterId === 'custom' && (
                  <div className="space-y-1">
                    <Input
                      placeholder="e.g. Chapter 2: Cell Division & Mitosis"
                      value={customChapterTitle}
                      onChange={(e) => {
                        setCustomChapterTitle(e.target.value);
                        setSelectedChapterTitle(e.target.value);
                      }}
                      disabled={isSaving}
                      className="rounded-xl text-xs sm:text-sm bg-card h-9"
                    />
                  </div>
                )}
              </div>

              {/* Quick-add Chapter Chips */}
              {subjectChapters.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Click chapters to tag into this link:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allLabels = subjectChapters
                          .map((c) => `Chapter ${c.chapterNumber ?? ''}: ${c.title}`.trim())
                          .join(', ');
                        setChapterLabelsInput(allLabels);
                      }}
                      className="text-primary hover:underline font-medium text-[11px]"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {subjectChapters.map((ch, idx) => {
                      const num = ch.chapterNumber ?? idx + 1;
                      const label = `Chapter ${num}: ${ch.title}`.trim();
                      const isSelected =
                        chapterLabelsInput.toLowerCase().includes(ch.title.toLowerCase()) ||
                        selectedChapterId === ch.id;
                      return (
                        <Badge
                          key={ch.id}
                          variant={isSelected ? 'default' : 'outline'}
                          className={cn(
                            'text-[10px] cursor-pointer transition-all hover:scale-105 select-none py-0.5 px-2 font-medium',
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                              : 'bg-card hover:bg-muted text-muted-foreground border-border/80'
                          )}
                          onClick={() => {
                            if (isSelected) {
                              const updated = chapterLabelsInput
                                .split(/[,;\n]/)
                                .map((s) => s.trim())
                                .filter((s) => !s.toLowerCase().includes(ch.title.toLowerCase()))
                                .join(', ');
                              setChapterLabelsInput(updated);
                              if (selectedChapterId === ch.id) {
                                setSelectedChapterId('all');
                                setSelectedChapterTitle('');
                                setSelectedChapterNumber(undefined);
                              }
                            } else {
                              setChapterLabelsInput((prev) => (prev ? `${prev}, ${label}` : label));
                              setSelectedChapterId(ch.id);
                              setSelectedChapterTitle(ch.title);
                              setSelectedChapterNumber(ch.chapterNumber);
                            }
                          }}
                        >
                          {isSelected ? <Check className="h-2.5 w-2.5 mr-1" /> : <Plus className="h-2.5 w-2.5 mr-1" />}
                          Ch. {num}: {ch.title}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
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
