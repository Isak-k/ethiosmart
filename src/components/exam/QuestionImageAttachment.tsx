import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  X,
  ZoomIn,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadQuestionImage, getOptimizedImageUrl } from "@/lib/image-upload";

export interface QuestionImageAttachmentProps {
  imageUrl?: string;
  onChange: (url: string | undefined) => void;
  examId?: string;
  disabled?: boolean;
}

export function QuestionImageAttachment({
  imageUrl,
  onChange,
  examId,
  disabled = false,
}: QuestionImageAttachmentProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"upload" | "link">("upload");
  const [isExpanded, setIsExpanded] = useState<boolean>(Boolean(imageUrl));
  const [linkInput, setLinkInput] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [zoomOpen, setZoomOpen] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const isCloudinaryUrl = imageUrl?.includes("cloudinary.com");

  // Handle direct file upload (Option 1)
  const handleFileSelect = async (file: File) => {
    if (disabled || uploading) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file format",
        description: "Please select an image file (JPG, PNG, or WebP).",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);

      const result = await uploadQuestionImage(file, {
        examId,
        onProgress: (pct) => setUploadProgress(pct),
      });

      onChange(result.url);
      setIsExpanded(true);

      toast({
        title: "Question image uploaded",
        description:
          result.provider === "cloudinary"
            ? "Uploaded and optimized via Cloudinary CDN."
            : "Uploaded and attached to question.",
      });
    } catch (err: any) {
      console.error("Question image upload error:", err);
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload image. Please try again or paste a link.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle direct Cloudinary / Image URL input (Option 2)
  const handleApplyLink = () => {
    if (disabled) return;
    const trimmed = linkInput.trim();
    if (!trimmed) {
      toast({
        title: "Missing URL",
        description: "Please paste a Cloudinary or image link.",
        variant: "destructive",
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(trimmed);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid web URL (e.g. https://res.cloudinary.com/...)",
        variant: "destructive",
      });
      return;
    }

    onChange(trimmed);
    setLinkInput("");
    setIsExpanded(true);

    toast({
      title: "Image link attached",
      description: trimmed.includes("cloudinary.com")
        ? "Cloudinary link attached and optimized for fast student loading."
        : "Image link attached to question.",
    });
  };

  const handleRemoveImage = () => {
    if (disabled) return;
    onChange(undefined);
  };

  return (
    <div className="space-y-3 pt-2">
      {/* 1. When an image is attached: Preview & Controls */}
      {imageUrl ? (
        <div className="relative rounded-lg border border-border/80 bg-muted/20 p-3 transition-all hover:border-primary/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="relative h-20 w-24 sm:h-24 sm:w-32 shrink-0 rounded-md overflow-hidden border bg-background/80 cursor-pointer group shadow-sm"
                onClick={() => setZoomOpen(true)}
                title="Click to zoom image"
              >
                <img
                  src={getOptimizedImageUrl(imageUrl, { width: 300, quality: "auto" })}
                  alt="Question Diagram"
                  className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to raw URL if transformation fails
                    (e.target as HTMLImageElement).src = imageUrl;
                  }}
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium">
                  <ZoomIn className="h-4 w-4 mr-1" />
                  Zoom
                </div>
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {isCloudinaryUrl ? "Cloudinary CDN" : "Question Image"}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    Attached to Question
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-md">
                  {imageUrl.startsWith("data:")
                    ? "Locally stored optimized image"
                    : imageUrl}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Visible to students during the exam across all question modes.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 self-end sm:self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setZoomOpen(true)}
                className="h-8 text-xs"
              >
                <ZoomIn className="h-3.5 w-3.5 mr-1" />
                Preview
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs"
                title="Replace with another file"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Replace
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={handleRemoveImage}
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Remove image from question"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : isExpanded ? (
        /* 2. When expanded with no image: Option 1 (Upload directly) vs Option 2 (Cloudinary link) */
        <div className="rounded-lg border border-border/80 bg-card p-4 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Attach Question Image (Optional)
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(val: any) => setActiveTab(val)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="upload" className="text-xs flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                1. Upload Image Directly
              </TabsTrigger>
              <TabsTrigger value="link" className="text-xs flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" />
                2. Cloudinary / Image Link
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Direct File Upload */}
            <TabsContent value="upload" className="pt-2">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-lg transition-colors cursor-pointer text-center ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                {uploading ? (
                  <div className="space-y-3 w-full max-w-xs py-2">
                    <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading & optimizing question image...
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
                  </div>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium">
                      Click to browse or drag & drop image here
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports JPG, PNG, WebP (up to 10MB) • Formulas, diagrams, charts, photos
                    </p>
                  </>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: Cloudinary / Image Link */}
            <TabsContent value="link" className="pt-2 space-y-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="image-link-input" className="text-xs">
                  Paste Cloudinary URL or direct web image link:
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="image-link-input"
                    type="url"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyLink();
                      }
                    }}
                    placeholder="https://res.cloudinary.com/... or https://..."
                    className="text-xs h-9"
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyLink}
                    disabled={disabled || !linkInput.trim()}
                    className="h-9 px-3 text-xs shrink-0"
                  >
                    Apply Link
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tip: Cloudinary links (<code className="text-primary font-mono text-[10px]">res.cloudinary.com</code>) will automatically receive responsive WebP transformations.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        /* 3. When collapsed: Quick "+ Add Image" trigger button */
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setIsExpanded(true)}
            className="h-8 text-xs text-muted-foreground hover:text-foreground border-dashed hover:border-primary/60"
          >
            <ImageIcon className="h-3.5 w-3.5 mr-1.5 text-primary" />
            + Add Image to Question (Optional)
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Supports diagrams, circuits, maps, formulas, or photos (Upload or Cloudinary link)
          </span>
        </div>
      )}

      {/* Hidden file input for native file browsing */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
        disabled={disabled || uploading}
      />

      {/* Zoom / Full Preview Lightbox Modal */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-4xl p-4 sm:p-6 bg-card">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-base font-semibold flex items-center justify-between">
              <span>Question Image Preview</span>
              {isCloudinaryUrl && (
                <Badge variant="outline" className="text-xs font-normal">
                  Cloudinary Delivery
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-3 flex items-center justify-center rounded-lg bg-black/5 dark:bg-black/30 p-2 overflow-auto max-h-[75vh]">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Enlarged Question Diagram"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
