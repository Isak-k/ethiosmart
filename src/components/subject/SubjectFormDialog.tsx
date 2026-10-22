import React, { useState, useEffect, useRef } from 'react';
import { Subject } from '@/types/subject';
import { SubjectInput, getSubjects } from '@/lib/subjects';
import { getDepartments } from '@/lib/departments';
import { Department } from '@/integrations/firebase/types';
import {
  validateCoverImage,
  checkImageAspectRatio,
  uploadSubjectCoverImage,
  deleteSubjectCoverImage,
} from '@/lib/image-upload';
import {
  SUBJECT_COVER_PRESETS,
  getSubjectCover,
  SubjectCategory,
} from '@/lib/subject-covers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Upload,
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Info,
  Building,
  Check,
} from 'lucide-react';

export interface SubjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: Subject | null;
  onSave: (data: SubjectInput) => Promise<void>;
  defaultDepartmentId?: string;
}

export function SubjectFormDialog({
  open,
  onOpenChange,
  subject,
  onSave,
  defaultDepartmentId,
}: SubjectFormDialogProps) {
  const isEditing = Boolean(subject?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Departments list for visibility publishing
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [publishToAllDepts, setPublishToAllDepts] = useState<boolean>(true);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [totalUnits, setTotalUnits] = useState<number>(8);
  const [displayOrder, setDisplayOrder] = useState<number | string>(1);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Image upload and preview states
  const [coverTab, setCoverTab] = useState<'upload' | 'link' | 'preset'>('upload');
  const [cloudinaryUrl, setCloudinaryUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentCoverUrl, setCurrentCoverUrl] = useState<string | null>(null);
  const [currentCoverPublicId, setCurrentCoverPublicId] = useState<string | null>(null);
  const [aspectWarning, setAspectWarning] = useState<string | null>(null);

  // Progress, loading, and error states
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Confirmation dialog for removing existing cover
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  // Load existing departments
  useEffect(() => {
    getDepartments().then(setDepartments).catch(console.error);
  }, []);

  // Populate data when editing
  useEffect(() => {
    if (open) {
      if (subject) {
        setName(subject.name || '');
        setDescription(subject.description || '');
        setTotalUnits(subject.totalUnits ?? 8);
        const initialOrder =
          subject.displayOrder !== undefined && subject.displayOrder !== null && !isNaN(Number(subject.displayOrder))
            ? Number(subject.displayOrder)
            : 1;
        setDisplayOrder(initialOrder);
        setIsActive(subject.isActive ?? true);
        const existingCover = subject.coverImageUrl || null;
        setCurrentCoverUrl(existingCover);
        setCurrentCoverPublicId(subject.coverImagePublicId || null);
        setPreviewUrl(existingCover);

        const isLink = Boolean(existingCover && (existingCover.startsWith('http://') || existingCover.startsWith('https://')) && !existingCover.startsWith('data:'));
        setCloudinaryUrl(isLink ? existingCover! : '');
        if (isLink) {
          setCoverTab('link');
        } else if (existingCover?.startsWith('data:') || subject.coverImagePublicId?.startsWith('preset_')) {
          setCoverTab('preset');
        } else {
          setCoverTab('upload');
        }

        if (subject.departmentIds && subject.departmentIds.length > 0) {
          setSelectedDeptIds(subject.departmentIds);
          setPublishToAllDepts(false);
        } else {
          setSelectedDeptIds([]);
          setPublishToAllDepts(true);
        }
      } else {
        // Reset form for creation - default displayOrder to next available order
        setName('');
        setDescription('');
        setTotalUnits(8);
        setIsActive(true);
        setCurrentCoverUrl(null);
        setCurrentCoverPublicId(null);
        setPreviewUrl(null);
        setCloudinaryUrl('');
        setCoverTab('upload');

        getSubjects()
          .then((subs) => {
            const maxOrder = subs.reduce((max, s) => {
              const o = Number(s.displayOrder);
              return !isNaN(o) ? Math.max(max, o) : max;
            }, 0);
            setDisplayOrder(maxOrder + 1);
          })
          .catch(() => setDisplayOrder(1));

        if (defaultDepartmentId && defaultDepartmentId !== 'all') {
          setSelectedDeptIds([defaultDepartmentId]);
          setPublishToAllDepts(false);
        } else {
          setSelectedDeptIds([]);
          setPublishToAllDepts(true);
        }
      }
      setSelectedFile(null);
      setUploadProgress(0);
      setIsUploading(false);
      setIsSaving(false);
      setErrorMessage(null);
      setAspectWarning(null);
    }
  }, [open, subject, defaultDepartmentId]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // File selection handler with validation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setAspectWarning(null);

    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validate file format and size
    const validation = validateCoverImage(file);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Invalid image file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Check 4:3 aspect ratio recommendation
    const aspectResult = await checkImageAspectRatio(file);
    if (!aspectResult.isRecommendedRatio && aspectResult.message) {
      setAspectWarning(aspectResult.message);
    }

    // 3. Set preview
    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  };

  const handleChooseImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemoveCover = () => {
    if (currentCoverUrl) {
      setConfirmRemoveOpen(true);
    } else {
      clearLocalFile();
    }
  };

  const confirmRemoveExistingCover = () => {
    clearLocalFile();
    setCurrentCoverUrl(null);
    setCurrentCoverPublicId(null);
    setCloudinaryUrl('');
    setConfirmRemoveOpen(false);
  };

  const handleApplyCloudinaryUrl = (overrideUrl?: string) => {
    setErrorMessage(null);
    setAspectWarning(null);
    const targetUrl = (overrideUrl !== undefined ? overrideUrl : cloudinaryUrl).trim();

    if (!targetUrl) {
      setErrorMessage('Please enter an image or Cloudinary URL.');
      return;
    }

    try {
      new URL(targetUrl);
    } catch {
      setErrorMessage('Please enter a valid web URL (e.g. https://res.cloudinary.com/...)');
      return;
    }

    clearLocalFile();
    setCurrentCoverUrl(targetUrl);
    setCurrentCoverPublicId('cloudinary_link');
    setPreviewUrl(targetUrl);
  };

  const clearLocalFile = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setAspectWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (category: SubjectCategory) => {
    const preset = SUBJECT_COVER_PRESETS.find((p) => p.id === category);
    if (!preset) return;

    clearLocalFile();
    setPreviewUrl(preset.svgDataUri);
    setCurrentCoverUrl(preset.svgDataUri);
    setCurrentCoverPublicId(`preset_${category}`);
  };

  const toggleDepartmentSelection = (deptId: string) => {
    if (selectedDeptIds.includes(deptId)) {
      setSelectedDeptIds(selectedDeptIds.filter((id) => id !== deptId));
    } else {
      setSelectedDeptIds([...selectedDeptIds, deptId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter a subject name.');
      return;
    }

    setIsSaving(true);

    try {
      let finalCoverUrl = currentCoverUrl;
      let finalPublicId = currentCoverPublicId;

      // 1. If a new file was selected, upload it first
      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(10);

        const uploadResult = await uploadSubjectCoverImage(selectedFile, {
          subjectId: subject?.id,
          onProgress: (p) => setUploadProgress(p),
        });

        finalCoverUrl = uploadResult.url;
        finalPublicId = uploadResult.publicId;
        setIsUploading(false);
      } else if (coverTab === 'link' && cloudinaryUrl.trim()) {
        finalCoverUrl = cloudinaryUrl.trim();
        finalPublicId = finalPublicId || 'cloudinary_link';
      }

      // 2. Save subject document with department visibility association
      const parsedOrder = typeof displayOrder === 'number' ? displayOrder : parseInt(String(displayOrder), 10);
      const finalOrder = !isNaN(parsedOrder) && parsedOrder >= 1 ? parsedOrder : 1;

      const payload: SubjectInput = {
        name: name.trim(),
        description: description.trim(),
        totalUnits: Number(totalUnits) || 0,
        displayOrder: finalOrder,
        isActive: Boolean(isActive),
        coverImageUrl: finalCoverUrl || undefined,
        coverImagePublicId: finalPublicId || undefined,
        departmentIds: publishToAllDepts ? [] : selectedDeptIds,
      };

      await onSave(payload);

      // 3. Clean up replaced old asset if needed
      if (
        selectedFile &&
        currentCoverPublicId &&
        currentCoverPublicId !== finalPublicId &&
        !currentCoverPublicId.startsWith('preset_')
      ) {
        deleteSubjectCoverImage(currentCoverPublicId);
      }

      onOpenChange(false);
    } catch (err: any) {
      console.error('Subject save error:', err);
      const isPerm =
        err?.code === 'permission-denied' ||
        err?.message?.includes('insufficient permissions') ||
        err?.message?.includes('Missing or insufficient permissions');
      if (isPerm) {
        setErrorMessage(
          "Permission denied by Firestore rules. Update rules in Firebase Console to allow writing to the 'subjects' collection."
        );
      } else {
        setErrorMessage(err.message || 'Failed to save subject. Please try again.');
      }
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  const effectiveCover = getSubjectCover(name, previewUrl || currentCoverUrl);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2 text-foreground">
              <Sparkles className="h-6 w-6 text-primary" />
              {isEditing ? 'Edit Subject' : 'Create New Subject'}
            </DialogTitle>
            <DialogDescription>
              Configure subject metadata, department visibility, unit count, and illustrated cover.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {errorMessage && (
              <Alert variant="destructive" className="rounded-2xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="subject-name" className="font-semibold">
                  Subject Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="subject-name"
                  placeholder="e.g. Mathematics, History, Physics..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSaving}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="subject-description" className="font-semibold">
                  Description (Optional)
                </Label>
                <Textarea
                  id="subject-description"
                  placeholder="Brief summary of units, topics, or curriculum scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSaving}
                  rows={2}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total-units" className="font-semibold">
                  Total Units / Chapters
                </Label>
                <Input
                  id="total-units"
                  type="number"
                  min="0"
                  max="100"
                  value={totalUnits}
                  onChange={(e) => setTotalUnits(Number(e.target.value))}
                  disabled={isSaving}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Used for student progress (e.g. &quot;8 of 10 units&quot;)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display-order" className="font-semibold">
                  Display Order
                </Label>
                <Input
                  id="display-order"
                  type="number"
                  min="1"
                  value={displayOrder}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setDisplayOrder('');
                    } else {
                      const num = parseInt(val, 10);
                      setDisplayOrder(isNaN(num) ? '' : Math.max(1, num));
                    }
                  }}
                  disabled={isSaving}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Order in the subject cards grid
                </p>
              </div>
            </div>

            {/* Department Availability / Visibility Section */}
            <div className="space-y-3 p-4 rounded-2xl bg-muted/40 border border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold flex items-center gap-1.5 text-foreground">
                    <Building className="h-4 w-4 text-primary" />
                    Department Availability
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Controls which student departments can view this subject and its exams
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">All Departments</span>
                  <Switch
                    checked={publishToAllDepts}
                    onCheckedChange={(checked) => {
                      setPublishToAllDepts(checked);
                      if (checked) setSelectedDeptIds([]);
                    }}
                    disabled={isSaving}
                  />
                </div>
              </div>

              {!publishToAllDepts && (
                <div className="space-y-2 pt-2 animate-fade-in border-t border-border/40">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Select specific authorized departments:
                  </Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                    {departments.map((dept) => {
                      const isSelected = selectedDeptIds.includes(dept.id);
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => toggleDepartmentSelection(dept.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {dept.name}
                        </button>
                      );
                    })}
                  </div>
                  {selectedDeptIds.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Please select at least one department, or enable &quot;All Departments&quot;.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Active Status Switch */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/50">
              <div className="space-y-0.5">
                <Label htmlFor="is-active" className="font-semibold cursor-pointer">
                  Subject Active & Published
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow students in authorized departments to browse this subject
                </p>
              </div>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={isSaving}
              />
            </div>

            {/* Cover Image Section */}
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-bold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Subject Cover Image
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Recommended ratio 4:3 (e.g. 800×600 px). Supports JPG, PNG, and WebP up to 5MB.
                  </p>
                </div>

                {(previewUrl || currentCoverUrl) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveCover}
                    disabled={isSaving}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs rounded-xl"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove Cover
                  </Button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
                disabled={isSaving}
              />

              {aspectWarning && (
                <Alert className="rounded-2xl border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-xs font-semibold">Aspect Ratio Notice</AlertTitle>
                  <AlertDescription className="text-xs">{aspectWarning}</AlertDescription>
                </Alert>
              )}

              {/* Live Preview Card */}
              <div className="relative rounded-2xl overflow-hidden border border-border/70 bg-muted aspect-[4/3] max-w-sm mx-auto shadow-md group">
                <img
                  src={previewUrl || currentCoverUrl || effectiveCover.url}
                  alt="Subject cover preview"
                  className="w-full h-full object-cover transition-transform duration-300"
                />

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleChooseImage}
                    disabled={isSaving}
                    className="rounded-xl shadow-lg font-semibold"
                  >
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    Replace Image
                  </Button>
                </div>

                <div className="absolute bottom-2.5 left-2.5">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-black/60 text-white backdrop-blur-md">
                    {selectedFile
                      ? 'New File Selected'
                      : (previewUrl?.includes('cloudinary.com') || currentCoverUrl?.includes('cloudinary.com'))
                      ? 'Cloudinary Image Link'
                      : (currentCoverUrl?.startsWith('http://') || currentCoverUrl?.startsWith('https://'))
                      ? 'Custom Image Link'
                      : currentCoverUrl?.startsWith('data:') || currentCoverPublicId?.startsWith('preset_')
                      ? `Preset: ${effectiveCover.preset.name}`
                      : `Default ${effectiveCover.preset.name} Cover`}
                  </span>
                </div>
              </div>

              {/* Source Tabs: Upload File, Cloudinary Link, or Preset */}
              <Tabs value={coverTab} onValueChange={(val: any) => setCoverTab(val)} className="w-full">
                <TabsList className="grid grid-cols-3 w-full rounded-xl">
                  <TabsTrigger value="upload" className="rounded-lg text-xs flex items-center justify-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    Upload File
                  </TabsTrigger>
                  <TabsTrigger value="link" className="rounded-lg text-xs flex items-center justify-center gap-1.5">
                    <LinkIcon className="h-3.5 w-3.5" />
                    Cloudinary Link
                  </TabsTrigger>
                  <TabsTrigger value="preset" className="rounded-lg text-xs flex items-center justify-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Presets
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Upload File from Device */}
                <TabsContent value="upload" className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleChooseImage}
                      disabled={isSaving}
                      className="w-full sm:w-auto rounded-xl border-dashed border-primary/50 hover:border-primary hover:bg-primary/5"
                    >
                      <Upload className="h-4 w-4 mr-2 text-primary" />
                      Upload from Device (JPG, PNG, WebP)
                    </Button>
                  </div>
                  {selectedFile && (
                    <p className="text-xs text-center text-muted-foreground">
                      Selected: <span className="font-medium text-foreground">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </TabsContent>

                {/* Tab 2: Cloudinary / Image Link Input */}
                <TabsContent value="link" className="space-y-2 pt-2">
                  <Label htmlFor="cloudinary-cover-link" className="text-xs font-semibold text-muted-foreground">
                    Paste Cloudinary or direct image link:
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="cloudinary-cover-link"
                      type="url"
                      placeholder="https://res.cloudinary.com/your-cloud/image/upload/..."
                      value={cloudinaryUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCloudinaryUrl(val);
                        const trimmed = val.trim();
                        if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
                          clearLocalFile();
                          setCurrentCoverUrl(trimmed);
                          setCurrentCoverPublicId('cloudinary_link');
                          setPreviewUrl(trimmed);
                        }
                      }}
                      disabled={isSaving}
                      className="rounded-xl text-sm"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleApplyCloudinaryUrl()}
                      disabled={isSaving || !cloudinaryUrl.trim()}
                      className="rounded-xl shrink-0 font-medium"
                    >
                      Apply
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Supports Cloudinary CDN URLs (`res.cloudinary.com`) or any public HTTPS image URL. Automatically optimized for student browsing.
                  </p>
                </TabsContent>

                {/* Tab 3: Built-in Illustrated Cover Presets Picker */}
                <TabsContent value="preset" className="space-y-2 pt-2">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Choose a built-in educational illustration preset:
                  </Label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 border rounded-xl">
                    {SUBJECT_COVER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.id)}
                        className="group relative flex flex-col items-center p-2 rounded-lg border hover:border-primary hover:bg-accent transition-all text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <div className="w-full aspect-[4/3] rounded-md overflow-hidden bg-muted mb-1 shadow-xs">
                          <img
                            src={preset.svgDataUri}
                            alt={preset.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <span className="text-[11px] font-medium leading-tight truncate w-full">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              {isUploading && (
                <div className="space-y-2 p-3 rounded-xl bg-primary/5 border border-primary/20 animate-fade-in">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-primary">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading cover image...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2 rounded-full" />
                </div>
              )}
            </div>

            {/* Dialog Footer Actions */}
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
                className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 font-semibold"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? 'Saving Subject...' : isEditing ? 'Save Changes' : 'Create Subject'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog before removing existing cover */}
      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Subject Cover?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the cover image for &quot;{name || 'this subject'}&quot;?
              The subject will automatically revert to its default illustrated educational cover.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveExistingCover}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
            >
              Remove Cover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
