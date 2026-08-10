/**
 * Image Handler for Questions
 * Manages image upload, storage, and retrieval
 *
 * Dual-backend design:
 *  - If Cloudinary env vars are configured → routes uploads/delete to Cloudinary
 *    via @/lib/cloudinary.ts (auto-optimized delivery, CDN, no Firebase quota).
 *  - Otherwise → falls back to Firebase Storage (the original path).
 *  UI code never needs to know which backend is active.
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/integrations/firebase/client";
import {
  isCloudinaryEnabled,
  isCloudinaryUrl,
  uploadImageToCloudinary,
  deleteCloudinaryImage,
  buildOptimizedUrl,
} from "@/lib/cloudinary";

export type ImageDisplayMode = "inline" | "background" | "main";

/**
 * Comprehensive image validation result
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Image dimension info
 */
export interface ImageDimensionInfo {
  width: number;
  height: number;
}

/**
 * Validate image file before upload
 * Checks: MIME type, file extension, file size
 * Returns: Comprehensive validation result with clear error messages
 */
export function validateImageFile(file: File): ImageValidationResult {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

  if (!file) {
    return { valid: false, error: "No file selected" };
  }

  // File type validation (MIME type)
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "File type not supported. Please use JPEG, PNG, WebP, or GIF",
    };
  }

  // File extension validation - ensure extension matches MIME type
  const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: "File extension does not match allowed types. Please use JPEG, PNG, WebP, or GIF",
    };
  }

  // Validate extension matches MIME type
  const mimeToExtensions: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
  };

  const validExtensions = mimeToExtensions[file.type] || [];
  if (!validExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `File extension .${fileExtension} does not match MIME type ${file.type}. Please ensure your file is saved in the correct format`,
    };
  }

  // File size validation
  if (file.size > MAX_SIZE) {
    const sizeInMB = formatFileSize(file.size);
    return {
      valid: false,
      error: `File size exceeds 5MB limit (current: ${sizeInMB}). Please use a smaller image`,
    };
  }

  return { valid: true };
}

/**
 * Get image dimensions asynchronously
 * Returns dimensions or null if unable to determine
 */
export async function getImageDimensions(file: File): Promise<ImageDimensionInfo | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      
      img.onerror = () => {
        console.error("Unable to determine image dimensions");
        resolve(null);
      };
      
      img.src = event.target?.result as string;
    };
    
    reader.onerror = () => {
      console.error("Unable to read image file");
      resolve(null);
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Validate image dimensions (optional)
 * Minimum: 200x200px, Maximum: 4000x4000px
 */
export function validateImageDimensions(
  dimensions: ImageDimensionInfo
): { valid: boolean; error?: string } {
  const MIN_DIMENSION = 200;
  const MAX_DIMENSION = 4000;

  if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) {
    return {
      valid: false,
      error: `Image dimensions must be at least ${MIN_DIMENSION}x${MIN_DIMENSION}px (current: ${dimensions.width}x${dimensions.height}px)`,
    };
  }

  if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
    return {
      valid: false,
      error: `Image dimensions must not exceed ${MAX_DIMENSION}x${MAX_DIMENSION}px (current: ${dimensions.width}x${dimensions.height}px)`,
    };
  }

  return { valid: true };
}

/**
 * Upload image to Firebase Storage
 * Path: exams/{examId}/questions/{questionId}/{filename}
 * Validates: file type, size, extension match, and optionally dimensions
 *
 * @param file - Image file to upload
 * @param examId - Exam ID
 * @param questionId - Question ID
 * @param validateDimensions - Whether to validate image dimensions (default: true)
 * @returns Object with download URL and optional dimensions
 * @throws Error if validation fails or upload fails
 */
export async function uploadQuestionImage(
  file: File,
  examId: string,
  questionId: string,
  validateDimensions: boolean = true
): Promise<{ url: string; dimensions?: ImageDimensionInfo }> {
  try {
    // Validate file first
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || "Image validation failed");
    }

    // Optional: Validate dimensions
    if (validateDimensions) {
      try {
        const dimensions = await getImageDimensions(file);
        if (dimensions) {
          const dimensionValidation = validateImageDimensions(dimensions);
          if (!dimensionValidation.valid) {
            throw new Error(dimensionValidation.error || "Image dimensions validation failed");
          }
        }
      } catch (dimensionError) {
        // Log but don't fail upload if dimension check fails
        console.warn("Image dimension validation failed:", dimensionError);
      }
    }

    // Get dimensions for reference (do this once before any upload)
    let dimensions: ImageDimensionInfo | undefined;
    try {
      const dims = await getImageDimensions(file);
      if (dims) dimensions = dims;
    } catch (error) {
      console.warn("Could not retrieve image dimensions:", error);
    }

    // ----- CLOUDINARY PATH (if enabled) -----
    if (isCloudinaryEnabled()) {
      const result = await uploadImageToCloudinary(file, { examId, questionId });
      return { url: result.secureUrl || result.url, dimensions };
    }

    // ----- FIREBASE STORAGE FALLBACK -----
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop() || "jpg";
    const storagePath = `exams/${examId}/questions/${questionId}/${timestamp}.${fileExtension}`;
    const imageRef = ref(storage, storagePath);

    // Upload file with metadata
    const snapshot = await uploadBytes(imageRef, file, {
      contentType: file.type,
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        originalName: file.name,
      },
    });

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    if (!downloadURL) {
      throw new Error("Failed to retrieve download URL after upload");
    }

    return { url: downloadURL, dimensions };
  } catch (error) {
    console.error("Error uploading image:", error);

    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes("Permission denied")) {
        throw new Error("Permission denied: Unable to upload image. Please check storage permissions.");
      }
      if (error.message.includes("Network")) {
        throw new Error("Network error: Please check your connection and try again.");
      }
      if (error.message.includes("Cloudinary")) {
        throw error;
      }
      // Re-throw validation errors with original message
      throw error;
    }

    throw new Error("Failed to upload image. Please try again.");
  }
}

/**
 * Upload image with automatic retry logic
 * Useful for handling transient network failures
 *
 * @param file - Image file to upload
 * @param examId - Exam ID
 * @param questionId - Question ID
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param validateDimensions - Whether to validate image dimensions (default: true)
 * @returns Object with download URL and optional dimensions
 * @throws Error if all retry attempts fail
 */
export async function uploadQuestionImageWithRetry(
  file: File,
  examId: string,
  questionId: string,
  maxRetries: number = 3,
  validateDimensions: boolean = true
): Promise<{ url: string; dimensions?: ImageDimensionInfo }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Image upload attempt ${attempt}/${maxRetries}`);
      return await uploadQuestionImage(file, examId, questionId, validateDimensions);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Upload attempt ${attempt} failed: ${lastError.message}`);

      // Don't retry on validation errors
      if (
        lastError.message.includes("File type") ||
        lastError.message.includes("File size") ||
        lastError.message.includes("File extension") ||
        lastError.message.includes("Image dimensions") ||
        lastError.message.includes("No file selected")
      ) {
        throw lastError;
      }

      // Don't retry on permission errors
      if (lastError.message.includes("Permission denied")) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Failed to upload image after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`
  );
}

/**
 * Delete image from Cloudinary (if URL is a Cloudinary one) or Firebase Storage.
 * Silently ignores deletion failures; we log warnings but never block the caller.
 */
export async function deleteQuestionImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;

  try {
    // ----- CLOUDINARY PATH -----
    if (isCloudinaryUrl(imageUrl)) {
      await deleteCloudinaryImage(imageUrl);
      return;
    }

    // ----- FIREBASE STORAGE FALLBACK -----
    // Extract storage path from download URL
    const decodedUrl = decodeURIComponent(imageUrl);
    const pathMatch = decodedUrl.match(/\/o\/([^?]+)/);

    if (!pathMatch) {
      console.warn("Could not extract path from image URL:", imageUrl);
      return;
    }

    const storagePath = pathMatch[1];
    const imageRef = ref(storage, storagePath);

    await deleteObject(imageRef);
  } catch (error) {
    console.error("Error deleting image:", error);
    // Don't throw - deleting might fail due to permissions, but shouldn't block
  }
}

/**
 * Return an optimized delivery URL for question images.
 *  - Cloudinary URLs: passes through buildOptimizedUrl() → f_auto, q_auto + optional resize
 *  - Firebase / other URLs: returned as-is (no transformation applied)
 *
 * Use this wherever images are rendered to students (QuestionRenderer, QuestionCard, etc.)
 * so that Cloudinary-hosted images get auto-compression and format conversion.
 */
export function optimizeImageUrl(
  source: string,
  opts?: { maxWidth?: number; maxHeight?: number; quality?: string | number; format?: string }
): string {
  if (!source) return source;
  if (!isCloudinaryUrl(source)) return source;
  try {
    return buildOptimizedUrl(source, opts);
  } catch (err) {
    console.warn("buildOptimizedUrl failed, returning original", err);
    return source;
  }
}

/**
 * Get file size in MB
 */
export function getFileSizeMB(file: File): number {
  return file.size / (1024 * 1024);
}

/**
 * Check if image URL is valid and accessible
 */
export async function validateImageUrl(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.error("Error validating image URL:", error);
    return false;
  }
}

/**
 * Get display mode label
 */
export function getDisplayModeLabel(mode?: ImageDisplayMode): string {
  switch (mode) {
    case "inline":
      return "Inline with question text";
    case "background":
      return "Background image";
    case "main":
      return "Main content (image-focused)";
    default:
      return "Inline with question text";
  }
}

/**
 * Get CSS classes for image display
 */
export function getImageDisplayClasses(mode?: ImageDisplayMode): string {
  switch (mode) {
    case "inline":
      return "max-w-md h-auto";
    case "background":
      return "w-full h-64 object-cover";
    case "main":
      return "w-full h-96 object-contain";
    default:
      return "max-w-md h-auto";
  }
}

/**
 * Image upload progress tracker
 */
export interface ImageUploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

