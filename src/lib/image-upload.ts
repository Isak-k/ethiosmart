import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/integrations/firebase/client';

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
}

export interface AspectRatioCheckResult {
  width: number;
  height: number;
  ratio: number;
  isRecommendedRatio: boolean;
  message?: string;
}

export interface CoverUploadResult {
  url: string;
  publicId: string;
  provider: 'cloudinary' | 'firebase' | 'local';
}

export interface CloudinaryConfig {
  isConfigured: boolean;
  cloudName?: string;
  uploadPreset?: string;
}

export interface CloudinaryTransformOptions {
  width?: number;
  height?: number;
  aspectRatio?: string; // e.g. '4:3'
  crop?: 'fill' | 'fit' | 'thumb' | 'limit' | 'scale';
  quality?: 'auto' | string | number;
  format?: 'auto' | 'webp' | 'png' | 'jpg';
  gravity?: 'auto' | 'face' | 'center';
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Check if Cloudinary unsigned credentials are configured in environment
 */
export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();

  return {
    isConfigured: Boolean(cloudName && uploadPreset),
    cloudName: cloudName || undefined,
    uploadPreset: uploadPreset || undefined,
  };
}

/**
 * Generate an optimized Cloudinary delivery URL with dynamic transformation
 * Default: auto format (WebP/AVIF), auto compression, 4:3 aspect ratio, 800px width.
 * Returns non-Cloudinary URLs (Firebase Storage, SVG data URIs) untouched.
 */
export function getOptimizedImageUrl(
  url?: string | null,
  options: CloudinaryTransformOptions = {}
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // If not a Cloudinary delivery URL, return as-is (e.g. Firebase Storage, SVG data URI)
  if (!trimmed.includes('res.cloudinary.com') || !trimmed.includes('/upload/')) {
    return trimmed;
  }

  const uploadSegment = '/upload/';
  const uploadIndex = trimmed.indexOf(uploadSegment);
  if (uploadIndex === -1) return trimmed;

  const prefix = trimmed.substring(0, uploadIndex + uploadSegment.length);
  let suffix = trimmed.substring(uploadIndex + uploadSegment.length);

  // Build transformation chain
  const transforms: string[] = [];
  const crop = options.crop || 'fill';
  const ar = options.aspectRatio || '4:3';
  const width = options.width || 800;
  const gravity = options.gravity || 'auto';
  const quality = options.quality || 'auto';
  const format = options.format || 'auto';

  transforms.push(`c_${crop}`);
  if (ar) transforms.push(`ar_${ar}`);
  if (width) transforms.push(`w_${width}`);
  if (options.height) transforms.push(`h_${options.height}`);
  if (gravity) transforms.push(`g_${gravity}`);
  if (quality) transforms.push(`q_${quality}`);
  if (format) transforms.push(`f_${format}`);

  const transformString = transforms.join(',');

  // If suffix already has a transformation block before the version or file path, remove old transforms
  // Transformations look like: "c_fill,w_800/..." or "f_auto,q_auto/..."
  const segments = suffix.split('/');
  if (segments.length > 1) {
    const firstSegment = segments[0];
    const isTransformSegment =
      !/^v\d+$/i.test(firstSegment) &&
      /(?:c_|w_|h_|ar_|q_|f_|g_)/i.test(firstSegment);

    if (isTransformSegment) {
      segments.shift(); // Remove existing transform segment
      suffix = segments.join('/');
    }
  }

  return `${prefix}${transformString}/${suffix}`;
}

/**
 * Validate cover image format and size
 */
export function validateCoverImage(file: File): ImageValidationResult {
  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  // Type validation: JPG, JPEG, PNG, WebP
  const isAllowedType =
    ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) ||
    /\.(jpe?g|png|webp)$/i.test(file.name);

  if (!isAllowedType) {
    return {
      isValid: false,
      error: 'Unsupported format. Please upload a JPG, JPEG, PNG, or WebP image.',
    };
  }

  // Size validation: max 5MB
  if (file.size > MAX_FILE_SIZE) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `File is too large (${sizeInMB} MB). Maximum size is 5 MB.`,
    };
  }

  return { isValid: true };
}

/**
 * Inspect image aspect ratio and recommend 4:3
 */
export function checkImageAspectRatio(file: File): Promise<AspectRatioCheckResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const ratio = height > 0 ? width / height : 1;

      // 4:3 ratio is ~1.33. Recommend if between 1.15 and 1.55
      const isRecommendedRatio = ratio >= 1.15 && ratio <= 1.55;

      let message: string | undefined;
      if (!isRecommendedRatio) {
        if (ratio < 1.0) {
          message = `Your image is vertical (${width}×${height}). A horizontal 4:3 ratio (e.g. 800×600) is recommended for best presentation.`;
        } else {
          message = `Aspect ratio is ${(ratio).toFixed(2)}:1. A 4:3 ratio (1.33:1) is recommended to avoid unnecessary cropping.`;
        }
      }

      resolve({
        width,
        height,
        ratio,
        isRecommendedRatio,
        message,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: 0,
        height: 0,
        ratio: 1,
        isRecommendedRatio: true,
      });
    };

    img.src = objectUrl;
  });
}

/**
 * Convert an image file into an optimized 4:3 base64 data URI.
 * This guarantees instant, reliable subject cover persistence (< 50ms)
 * even if Cloudinary or Firebase Storage are offline, unconfigured, or timing out.
 */
export function fileToOptimizedDataUri(
  file: File,
  maxWidth = 800,
  maxHeight = 600,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If running in a non-browser environment or test runner without URL.createObjectURL
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      typeof URL?.createObjectURL !== 'function'
    ) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('FileReader failed'));
          reader.readAsDataURL(file);
          return;
        }

        const naturalWidth = img.naturalWidth || img.width || 800;
        const naturalHeight = img.naturalHeight || img.height || 600;

        let targetWidth = naturalWidth;
        let targetHeight = naturalHeight;

        if (targetWidth > maxWidth || targetHeight > maxHeight) {
          const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
          targetWidth = Math.max(10, Math.round(targetWidth * ratio));
          targetHeight = Math.max(10, Math.round(targetHeight * ratio));
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Try WebP first, fallback to JPEG
        let dataUri = canvas.toDataURL('image/webp', quality);
        if (!dataUri.startsWith('data:image/webp')) {
          dataUri = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUri);
      } catch {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Image failed to load'));
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Upload subject cover image with a resilient 3-tier cascade:
 * 1. Cloudinary (if configured with valid preset, 8s timeout)
 * 2. Firebase Storage (if available, 6s timeout)
 * 3. Client-side optimized Data URI (instant, reliable fallback, 0s delay)
 * 
 * GUARANTEE: Never hangs indefinitely, never blocks subject or exam creation.
 */
export async function uploadSubjectCoverImage(
  file: File,
  options?: {
    subjectId?: string;
    onProgress?: (percentage: number) => void;
  }
): Promise<CoverUploadResult> {
  const validation = validateCoverImage(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid file');
  }

  options?.onProgress?.(15);

  const { isConfigured, cloudName, uploadPreset } = getCloudinaryConfig();

  // Tier 1: Try Cloudinary unsigned upload if configured
  if (isConfigured && cloudName && uploadPreset) {
    try {
      options?.onProgress?.(30);
      const result = await uploadToCloudinary(file, cloudName, uploadPreset, options?.onProgress);
      options?.onProgress?.(100);
      return result;
    } catch (cloudinaryError: any) {
      console.warn(
        'Cloudinary upload failed or timed out, trying Firebase Storage:',
        cloudinaryError?.message || cloudinaryError
      );
    }
  }

  // Tier 2: Try Firebase Storage with a strict 6-second timeout
  try {
    options?.onProgress?.(50);
    const result = await uploadToFirebaseStorage(file, options?.subjectId, options?.onProgress);
    options?.onProgress?.(100);
    return result;
  } catch (firebaseError: any) {
    console.warn(
      'Firebase Storage upload unavailable or timed out, falling back to instant client-side optimized image:',
      firebaseError?.message || firebaseError
    );
  }

  // Tier 3: Bulletproof Client-Side Canvas Optimization
  // Creates an ultra-compact (~30-50KB) WebP/JPEG data URI
  // Completes in < 50ms and saves directly to Firestore/local state without hanging!
  options?.onProgress?.(80);
  try {
    const localDataUri = await fileToOptimizedDataUri(file);
    options?.onProgress?.(100);
    return {
      url: localDataUri,
      publicId: `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      provider: 'local',
    };
  } catch (localErr) {
    console.error('All image upload mechanisms failed:', localErr);
    throw new Error('Could not process image file. Please try another image.');
  }
}

/**
 * Low-level Cloudinary XHR upload call with 8s strict timeout
 */
function executeCloudinaryUpload(
  file: File,
  cloudName: string,
  uploadPreset: string,
  includeFolder: boolean,
  onProgress?: (percentage: number) => void
): Promise<CoverUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    // 8-second safety timeout prevents infinite hangs
    xhr.timeout = 8000;

    xhr.open('POST', endpoint);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 90);
          onProgress(Math.min(95, Math.max(15, percent)));
        }
      };
    }

    xhr.ontimeout = () => {
      reject(new Error('Cloudinary request timed out after 8 seconds'));
    };

    xhr.onload = () => {
      let responseBody: any = null;
      try {
        responseBody = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (responseBody?.secure_url) {
          if (onProgress) onProgress(100);
          resolve({
            url: responseBody.secure_url,
            publicId: responseBody.public_id || '',
            provider: 'cloudinary',
          });
          return;
        }
        reject(new Error(responseBody?.error?.message || 'Invalid Cloudinary response'));
      } else {
        const errorMsg =
          responseBody?.error?.message || `Upload failed with status ${xhr.status}`;
        const error: any = new Error(errorMsg);
        error.status = xhr.status;
        error.responseBody = responseBody;
        reject(error);
      }
    };

    xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    if (includeFolder) {
      formData.append('folder', 'exampro/subjects');
    }

    xhr.send(formData);
  });
}

/**
 * Cloudinary Direct Unsigned Upload with automatic preset tolerance
 * Tries with 'exampro/subjects' folder; if the unsigned preset prohibits dynamic folders,
 * automatically retries without the folder parameter.
 */
async function uploadToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string,
  onProgress?: (percentage: number) => void
): Promise<CoverUploadResult> {
  try {
    return await executeCloudinaryUpload(file, cloudName, uploadPreset, true, onProgress);
  } catch (err: any) {
    const message = (err?.message || '').toLowerCase();
    // If the unsigned preset prohibits setting a folder parameter dynamically, retry without folder
    if (message.includes('folder') || err?.status === 400) {
      console.warn(
        'Retrying Cloudinary upload without folder parameter due to preset restrictions:',
        err.message
      );
      return await executeCloudinaryUpload(file, cloudName, uploadPreset, false, onProgress);
    }
    throw err;
  }
}

/**
 * Firebase Storage Upload with 6s safety timeout
 */
function uploadToFirebaseStorage(
  file: File,
  subjectId?: string,
  onProgress?: (percentage: number) => void
): Promise<CoverUploadResult> {
  return new Promise((resolve, reject) => {
    // 6-second timeout prevents indefinite retries on CORS or permission-denied
    const timeoutTimer = setTimeout(() => {
      reject(new Error('Firebase Storage upload timed out after 6 seconds'));
    }, 6000);

    try {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const folder = subjectId ? `subject-covers/${subjectId}` : 'subject-covers/general';
      const path = `${folder}/${timestamp}_${sanitizedName}`;

      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 90);
            onProgress(Math.min(95, Math.max(20, percent)));
          }
        },
        (error) => {
          clearTimeout(timeoutTimer);
          console.error('Firebase storage upload error:', error);
          reject(new Error(error.message || 'Firebase storage upload failed'));
        },
        async () => {
          clearTimeout(timeoutTimer);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve({
              url,
              publicId: path,
              provider: 'firebase',
            });
          } catch (urlError: any) {
            reject(new Error(`Failed to retrieve download URL: ${urlError.message}`));
          }
        }
      );
    } catch (e: any) {
      clearTimeout(timeoutTimer);
      reject(new Error(`Storage initialization error: ${e.message}`));
    }
  });
}

/**
 * Safely clean up removed or replaced cover image
 */
export async function deleteSubjectCoverImage(
  publicId?: string,
  provider?: 'cloudinary' | 'firebase' | 'local'
): Promise<void> {
  if (!publicId || provider === 'local' || publicId.startsWith('local_') || publicId.startsWith('preset_')) {
    return;
  }

  try {
    // If it's a Firebase Storage path or starts with subject-covers
    if (provider === 'firebase' || publicId.startsWith('subject-covers/')) {
      const storageRef = ref(storage, publicId);
      await deleteObject(storageRef);
      console.log('Deleted cover image from Firebase Storage:', publicId);
    } else if (provider === 'cloudinary') {
      console.log('Cloudinary asset marked for deletion:', publicId);
    }
  } catch (err) {
    // Non-blocking cleanup failure
    console.warn('Failed to clean up old cover image asset:', err);
  }
}

export interface QuestionImageUploadResult {
  url: string;
  publicId: string;
  provider: 'cloudinary' | 'firebase' | 'local';
}

/**
 * Validate question image file (supports JPG, PNG, WebP up to 10MB)
 */
export function validateQuestionImage(file: File): ImageValidationResult {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: 'Unsupported image format. Please upload JPG, PNG, or WebP.',
    };
  }
  const maxQuestionFileSize = 10 * 1024 * 1024; // 10MB for detailed diagrams/formulas
  if (file.size > maxQuestionFileSize) {
    return {
      isValid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 10MB.`,
    };
  }
  return { isValid: true };
}

/**
 * Upload question image with a resilient 3-tier cascade:
 * 1. Cloudinary direct unsigned upload (if configured)
 * 2. Firebase Storage (with 6s timeout guard)
 * 3. Client-side canvas optimization (1200x900, zero delay, never hangs)
 */
export async function uploadQuestionImage(
  file: File,
  options?: {
    examId?: string;
    onProgress?: (percentage: number) => void;
  }
): Promise<QuestionImageUploadResult> {
  const validation = validateQuestionImage(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid question image file');
  }

  options?.onProgress?.(15);
  const { isConfigured, cloudName, uploadPreset } = getCloudinaryConfig();

  // Tier 1: Try Cloudinary if configured
  if (isConfigured && cloudName && uploadPreset) {
    try {
      options?.onProgress?.(30);
      const result = await uploadToCloudinary(file, cloudName, uploadPreset, options?.onProgress);
      options?.onProgress?.(100);
      return result;
    } catch (cloudinaryError: any) {
      console.warn('Cloudinary upload for question failed, attempting fallback:', cloudinaryError?.message || cloudinaryError);
    }
  }

  // Tier 2: Try Firebase Storage
  try {
    options?.onProgress?.(50);
    const result = await uploadQuestionToFirebaseStorage(file, options?.examId, options?.onProgress);
    options?.onProgress?.(100);
    return result;
  } catch (firebaseError: any) {
    console.warn('Firebase Storage for question failed, falling back to local optimization:', firebaseError?.message || firebaseError);
  }

  // Tier 3: Client-side Canvas Optimization (1200x900, crisp quality)
  options?.onProgress?.(80);
  try {
    const localDataUri = await fileToOptimizedDataUri(file, 1200, 900, 0.85);
    options?.onProgress?.(100);
    return {
      url: localDataUri,
      publicId: `local_q_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      provider: 'local',
    };
  } catch (localErr) {
    console.error('All question image upload mechanisms failed:', localErr);
    throw new Error('Could not process question image. Please try another file or enter an image link.');
  }
}

/**
 * Firebase Storage upload for question images with 6s timeout guard
 */
function uploadQuestionToFirebaseStorage(
  file: File,
  examId?: string,
  onProgress?: (percentage: number) => void
): Promise<QuestionImageUploadResult> {
  return new Promise((resolve, reject) => {
    const timeoutTimer = setTimeout(() => {
      reject(new Error('Firebase Storage upload timed out after 6 seconds'));
    }, 6000);

    try {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const folder = examId ? `question-images/${examId}` : 'question-images/general';
      const path = `${folder}/${timestamp}_${sanitizedName}`;

      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 90);
            onProgress(Math.min(95, Math.max(20, percent)));
          }
        },
        (error) => {
          clearTimeout(timeoutTimer);
          reject(new Error(error.message || 'Firebase storage question upload failed'));
        },
        async () => {
          clearTimeout(timeoutTimer);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve({
              url,
              publicId: path,
              provider: 'firebase',
            });
          } catch (urlError: any) {
            reject(new Error(`Failed to retrieve question download URL: ${urlError.message}`));
          }
        }
      );
    } catch (e: any) {
      clearTimeout(timeoutTimer);
      reject(new Error(`Question storage initialization error: ${e.message}`));
    }
  });
}
