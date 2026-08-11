/**
 * ImagePreview Component
 * Display uploaded images with different display modes (inline, background, main)
 */

import React from "react";
import { X } from "lucide-react";
import { ImageDisplayMode, getImageDisplayClasses, optimizeImageUrl } from "@/lib/image-handler";

export interface ImagePreviewProps {
  imageUrl: string;
  displayMode?: ImageDisplayMode;
  onRemove?: () => void;
  onModeChange?: (mode: ImageDisplayMode) => void;
  showModeSelector?: boolean;
  questionText?: string;
}

export function ImagePreview({
  imageUrl,
  displayMode = "inline",
  onRemove,
  onModeChange,
  showModeSelector = false,
  questionText,
}: ImagePreviewProps) {
  const [imageError, setImageError] = React.useState(false);
  const displayClasses = getImageDisplayClasses(displayMode);
  
  // CRITICAL: Try to optimize, but if it fails, use original URL
  let optimizedUrl = imageUrl;
  try {
    const optUrl = optimizeImageUrl(imageUrl, {
      maxWidth: displayMode === "main" ? 1200 : 800,
      quality: "auto",
      format: "auto",
    });
    // Only use optimized if it's different and looks valid
    if (optUrl && optUrl !== imageUrl && optUrl.length > 10) {
      optimizedUrl = optUrl;
    }
  } catch (err) {
    console.warn("[IMAGE-PREVIEW] Failed to optimize URL, using original:", err);
    optimizedUrl = imageUrl;
  }

  // Log for debugging
  React.useEffect(() => {
    console.log("[IMAGE-PREVIEW] ImagePreview received:", {
      imageUrl: imageUrl?.substring(0, 80) + "...",
      displayMode,
      optimizedUrl: optimizedUrl?.substring(0, 80) + "...",
      isImageUrlEmpty: !imageUrl,
    });
    
    // Test if URL is valid by trying to fetch it
    if (imageUrl) {
      fetch(imageUrl, { method: 'HEAD' })
        .then(() => console.log("[IMAGE-PREVIEW] Original URL is accessible (HTTP 200)"))
        .catch((err) => console.error("[IMAGE-PREVIEW] Original URL NOT accessible:", err.message));
    }
  }, [imageUrl, displayMode]);

  const displayModeOptions: { value: ImageDisplayMode; label: string }[] = [
    { value: "inline", label: "Inline with text" },
    { value: "background", label: "Background" },
    { value: "main", label: "Main content" },
  ];

  return (
    <div className="space-y-3">
      {/* Display Mode Selector */}
      {showModeSelector && onModeChange && (
        <div className="flex gap-2">
          {displayModeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onModeChange(option.value)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                displayMode === option.value
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Image Preview Container */}
      <div className={`relative rounded border border-gray-300 overflow-hidden ${
        displayMode === "background" ? "bg-gray-100" : ""
      }`}>
        {displayMode === "inline" && (
          <div className="flex flex-col gap-2 p-3">
            {imageError ? (
              <div className="flex items-center justify-center p-6 bg-red-50 border border-red-300 rounded">
                <span className="text-red-700 font-medium">Image failed to load. Check the URL or try re-uploading.</span>
              </div>
            ) : (
              <img
                src={optimizedUrl}
                alt="Question preview"
                className="max-w-full h-auto max-h-96 object-contain mx-auto rounded"
                crossOrigin="anonymous"
                loading="eager"
                onError={(e) => {
                  setImageError(true);
                  console.error("[IMAGE-PREVIEW] Image failed to load:", {
                    imageUrl: imageUrl?.substring(0, 80) + "...",
                    optimizedUrl: optimizedUrl?.substring(0, 80) + "...",
                  });
                }}
                onLoad={() => {
                  setImageError(false);
                  console.log("[IMAGE-PREVIEW] Image loaded successfully");
                }}
              />
            )}
            {questionText && (
              <p className="text-sm text-gray-700 mt-2">{questionText}</p>
            )}
          </div>
        )}

        {displayMode === "background" && (
          <div className="p-6 relative overflow-hidden rounded" style={{ minHeight: "300px" }}>
            {imageError ? (
              <div className="flex items-center justify-center h-full bg-red-50 border border-red-300 rounded">
                <span className="text-red-700 font-medium">Image failed to load</span>
              </div>
            ) : (
              <img
                src={optimizedUrl}
                alt="Background"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.3 }}
                crossOrigin="anonymous"
                loading="eager"
                onError={(e) => {
                  setImageError(true);
                  console.error("[IMAGE-PREVIEW] Background image failed to load:", {
                    imageUrl: imageUrl?.substring(0, 80) + "...",
                  });
                }}
                onLoad={() => {
                  setImageError(false);
                  console.log("[IMAGE-PREVIEW] Background image loaded successfully");
                }}
              />
            )}
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative z-10">
              {questionText && (
                <p className="text-gray-900 font-medium text-lg">{questionText}</p>
              )}
            </div>
          </div>
        )}

        {displayMode === "main" && (
          <div className="space-y-3 p-3">
            {imageError ? (
              <div className="flex items-center justify-center p-6 bg-red-50 border border-red-300 rounded">
                <span className="text-red-700 font-medium">Image failed to load. Check the URL or try re-uploading.</span>
              </div>
            ) : (
              <img
                src={optimizedUrl}
                alt="Question preview"
                className="max-w-full h-auto object-contain rounded"
                crossOrigin="anonymous"
                loading="eager"
                onError={(e) => {
                  setImageError(true);
                  console.error("[IMAGE-PREVIEW] Main image failed to load:", {
                    imageUrl: imageUrl?.substring(0, 80) + "...",
                  });
                }}
                onLoad={() => {
                  setImageError(false);
                  console.log("[IMAGE-PREVIEW] Main image loaded successfully");
                }}
              />
            )}
            {questionText && (
              <p className="text-sm text-gray-700">{questionText}</p>
            )}
          </div>
        )}

        {/* Remove Button */}
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded z-20"
            title="Remove image"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Image Info */}
      <div className="text-xs text-gray-500">
        <p>Display mode: <span className="font-semibold">{displayMode}</span></p>
      </div>
    </div>
  );
}

export default ImagePreview;
