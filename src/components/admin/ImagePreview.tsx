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
  const displayClasses = getImageDisplayClasses(displayMode);
  // For non-Cloudinary URLs (Firebase storage), use the URL directly
  // optimizeImageUrl will return the original URL if it's not Cloudinary
  const optimizedUrl = optimizeImageUrl(imageUrl, {
    maxWidth: displayMode === "main" ? 1200 : 800,
    quality: "auto",
    format: "auto",
  });

  // Log for debugging
  React.useEffect(() => {
    console.log("ImagePreview - Original URL:", imageUrl);
    console.log("ImagePreview - Optimized URL:", optimizedUrl);
    console.log("ImagePreview - Display Mode:", displayMode);
    
    // Test if URL is valid by trying to fetch it
    if (imageUrl) {
      fetch(imageUrl, { method: 'HEAD' })
        .then(() => console.log("Image URL is accessible"))
        .catch((err) => console.error("Image URL is NOT accessible:", err));
    }
  }, [imageUrl, optimizedUrl, displayMode]);

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
            <img
              src={optimizedUrl}
              alt="Question preview"
              className="max-w-full h-auto max-h-96 object-contain mx-auto rounded"
              crossOrigin="anonymous"
              loading="eager"
              onError={(e) => {
                console.error("Failed to load image:", {
                  imageUrl,
                  optimizedUrl,
                  error: e,
                  target: e.currentTarget,
                });
              }}
              onLoad={() => {
                console.log("Image loaded successfully:", optimizedUrl);
              }}
            />
            {questionText && (
              <p className="text-sm text-gray-700 mt-2">{questionText}</p>
            )}
          </div>
        )}

        {displayMode === "background" && (
          <div className="p-6 relative overflow-hidden rounded" style={{ minHeight: "300px" }}>
            <img
              src={optimizedUrl}
              alt="Background"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.3 }}
              crossOrigin="anonymous"
              loading="eager"
              onError={(e) => {
                console.error("Failed to load background image:", {
                  imageUrl,
                  optimizedUrl,
                  error: e,
                });
              }}
              onLoad={() => {
                console.log("Background image loaded successfully:", optimizedUrl);
              }}
            />
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
            <img
              src={optimizedUrl}
              alt="Question preview"
              className="max-w-full h-auto object-contain rounded"
              crossOrigin="anonymous"
              loading="eager"
              onError={(e) => {
                console.error("Failed to load image:", {
                  imageUrl,
                  optimizedUrl,
                  error: e,
                  target: e.currentTarget,
                });
              }}
              onLoad={() => {
                console.log("Image loaded successfully:", optimizedUrl);
              }}
            />
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
