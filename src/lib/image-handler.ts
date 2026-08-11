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

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

export interface ImageDimensionInfo {
  width: number;
  height: number;
}

const DEFAULT_TIMEOUT_MS = 30000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  errorMessage: string = "Operation timed out"
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function validateImageFile(file: File): ImageValidationResult {
  const MAX_SIZE = 5 * 1024 * 1024;
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

  if (!file) {
    return { valid: false, error: "No file selected" };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "File type not supported. Please use JPEG, PNG, WebP, or GIF",
    };
  }

  const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: "File extension does not match allowed types. Please use JPEG, PNG, WebP, or GIF",
    };
  }

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

  if (file.size > MAX_SIZE) {
    const sizeInMB = formatFileSize(file.size);
    return {
      valid: false,
      error: `File size exceeds 5MB limit (current: ${sizeInMB}). Please use a smaller image`,
    };
  }

  return { valid: true };
}

export async function getImageDimensions(file: File): Promise<ImageDimensionInfo | null> {
  return withTimeout<ImageDimensionInfo | null>(
    new Promise((resolve) => {
      const reader = new FileReader();
      let resolved = false;
      
      const cleanupAndResolve = (value: ImageDimensionInfo | null) => {
        if (resolved) return;
        resolved = true;
        try { reader.abort(); } catch (_) { /* noop */ }
        resolve(value);
      };
      
      reader.onload = (event) => {
        const img = new Image();
        
        img.onload = () => {
          cleanupAndResolve({
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        };
        
        img.onerror = () => {
          console.error("Unable to determine image dimensions: img.onerror");
          cleanupAndResolve(null);
        };
        
        img.src = event.target?.result as string;
      };
      
      reader.onerror = () => {
        console.error("Unable to read image file: reader.onerror");
        cleanupAndResolve(null);
      };
      
      try {
        reader.readAsDataURL(file);
      } catch (e) {
        console.error("readAsDataURL threw:", e);
        cleanupAndResolve(null);
      }
    }),
    15000,
    "Timed out while reading image dimensions"
  );
}

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

export async function uploadQuestionImage(
  file: File,
  examId: string,
  questionId: string,
  validateDimensions: boolean = true,
  signal?: AbortSignal
): Promise<{ url: string; dimensions?: ImageDimensionInfo }> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Image validation failed");
  }

  let dimensions: ImageDimensionInfo | undefined;
  try {
    const dims = await getImageDimensions(file);
    if (dims) {
      dimensions = dims;
      if (validateDimensions) {
        const dimValid = validateImageDimensions(dims);
        if (!dimValid.valid) {
          throw new Error(dimValid.error || "Image dimensions validation failed");
        }
      }
    }
  } catch (dimensionError) {
    if (validateDimensions && dimensionError instanceof Error && 
        dimensionError.message.includes("dimensions must be")) {
      throw dimensionError;
    }
    console.warn("Image dimension check skipped:", dimensionError instanceof Error ? dimensionError.message : dimensionError);
  }

  if (isCloudinaryEnabled()) {
    console.log("[IMAGE-HANDLER] Cloudinary is enabled, uploading...");
    const result = await withTimeout(
      uploadImageToCloudinary(file, { examId, questionId }, signal),
      DEFAULT_TIMEOUT_MS,
      "Image upload to Cloudinary timed out. Please check your connection and try again."
    );
    console.log("[IMAGE-HANDLER] Cloudinary response received:", {
      hasUrl: !!result.url,
      hasSecureUrl: !!result.secureUrl,
      url: result.url ? result.url.substring(0, 100) : null,
      secureUrl: result.secureUrl ? result.secureUrl.substring(0, 100) : null,
    });
    
    // Prefer secureUrl (https), fall back to url
    const finalUrl = result.secureUrl || result.url;
    console.log("[IMAGE-HANDLER] Using final URL:", finalUrl);
    
    if (!finalUrl) {
      console.error("[IMAGE-HANDLER] ERROR: No URL in cloudinary result!", result);
      throw new Error("Cloudinary upload returned no URL");
    }
    
    return { url: finalUrl, dimensions };
  }

  const timestamp = Date.now();
  const fileExtension = file.name.split(".").pop() || "jpg";
  const storagePath = `exam-images/${examId}/${timestamp}.${fileExtension}`;
  const imageRef = ref(storage, storagePath);

  const snapshot = await withTimeout(
    uploadBytes(imageRef, file, {
      contentType: file.type,
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        originalName: file.name,
      },
    }),
    DEFAULT_TIMEOUT_MS,
    "Image upload to Firebase Storage timed out. Please check your connection and try again."
  );

  const downloadURL = await withTimeout(
    getDownloadURL(snapshot.ref),
    15000,
    "Timed out retrieving image download URL."
  );

  if (!downloadURL) {
    throw new Error("Failed to retrieve download URL after upload");
  }

  return { url: downloadURL, dimensions };
}

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

      if (
        lastError.message.includes("File type") ||
        lastError.message.includes("File size") ||
        lastError.message.includes("File extension") ||
        lastError.message.includes("Image dimensions") ||
        lastError.message.includes("No file selected")
      ) {
        throw lastError;
      }

      if (lastError.message.includes("Permission denied")) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw new Error(
    `Failed to upload image after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`
  );
}

export async function deleteQuestionImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;

  try {
    if (isCloudinaryUrl(imageUrl)) {
      await deleteCloudinaryImage(imageUrl);
      return;
    }

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
  }
}

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

export function getFileSizeMB(file: File): number {
  return file.size / (1024 * 1024);
}

export async function validateImageUrl(imageUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(imageUrl, { method: "HEAD", signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error("Error validating image URL:", error);
    return false;
  }
}

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

export interface ImageUploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
