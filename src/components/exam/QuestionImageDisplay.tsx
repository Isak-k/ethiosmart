import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, Image as ImageIcon } from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/image-upload";
import { Badge } from "@/components/ui/badge";

export interface QuestionImageDisplayProps {
  imageUrl?: string;
  alt?: string;
  className?: string;
  maxHeightClass?: string;
}

export function QuestionImageDisplay({
  imageUrl,
  alt = "Question Diagram",
  className = "",
  maxHeightClass = "max-h-72 sm:max-h-80",
}: QuestionImageDisplayProps) {
  const [zoomOpen, setZoomOpen] = useState(false);

  if (!imageUrl) return null;

  const isCloudinary = imageUrl.includes("cloudinary.com");
  const displayUrl = getOptimizedImageUrl(imageUrl, {
    width: 1000,
    quality: "auto",
    crop: "limit",
  });

  return (
    <div className={`my-3 ${className}`}>
      <div className="relative group max-w-2xl rounded-xl overflow-hidden border border-border/80 bg-muted/20 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
        <div
          className="cursor-zoom-in flex items-center justify-center p-2 bg-background/50"
          onClick={() => setZoomOpen(true)}
          title="Click to view full image"
        >
          <img
            src={displayUrl}
            alt={alt}
            className={`w-full ${maxHeightClass} object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.01]`}
            loading="lazy"
            onError={(e) => {
              // Fallback to original URL
              (e.target as HTMLImageElement).src = imageUrl;
            }}
          />
        </div>

        {/* Hover overlay with zoom button */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 transition-opacity">
          {isCloudinary && (
            <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-sm shadow-sm hidden sm:inline-flex">
              HD
            </Badge>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2.5 text-xs bg-background/90 hover:bg-background backdrop-blur-sm shadow-sm font-medium"
            onClick={() => setZoomOpen(true)}
          >
            <ZoomIn className="h-3.5 w-3.5 mr-1 text-primary" />
            Enlarge
          </Button>
        </div>
      </div>

      {/* Lightbox / Zoom Dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-5xl p-4 sm:p-6 bg-card">
          <DialogHeader className="pb-2 border-b flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              {alt}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 flex items-center justify-center rounded-lg bg-black/5 dark:bg-black/40 p-2 overflow-auto max-h-[80vh]">
            <img
              src={imageUrl}
              alt={alt}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
