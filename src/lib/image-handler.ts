/**
 * Image Handler for Questions
 * Manages image upload, storage, and retrieval
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/integrations/firebase/client";

export type ImageDisplayMode = "inline" | "background" | "main";

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (!file) {
    return { valid: false, error: "No file selected" };
  }

  if (file.size > MAX_SIZE) {
    return { valid: false, error: "Image must be less than 5MB" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "Image must be JPEG, PNG, WebP, or GIF" };
  }

  return { valid: true };
}

/**
 * Upload image to Firebase Storage
 * Path: question-images/{examId}/{questionId}/{timestamp}
 */
export async function uploadQuestionImage(
  file: File,
  examId: string,
  questionId: string
): Promise<string> {
  try {
    // Validate file first
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Create storage reference
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop();
    const storagePath = `question-images/${examId}/${questionId}/${timestamp}.${fileExtension}`;
    const imageRef = ref(storage, storagePath);

    // Upload file
    const snapshot = await uploadBytes(imageRef, file);

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
}

/**
 * Delete image from Firebase Storage
 */
export async function deleteQuestionImage(imageUrl: string): Promise<void> {
  try {
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
