/**
 * Cloudinary Integration for ExamPro question-image uploads.
 *
 * Design:
 * - Backend-agnostic: if Cloudinary env vars are present, image-handler.ts
 *   routes uploads/delete to this module. Otherwise falls back to Firebase
 *   Storage (the existing path). No UI code needs to change.
 *
 * Setup — set any one of:
 *   (a) VITE_CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@cloud_name
 *   (b) VITE_CLOUDINARY_CLOUD_NAME + VITE_CLOUDINARY_UPLOAD_PRESET
 *       → unsigned uploads (recommended for browser; create the unsigned
 *       upload preset in your Cloudinary dashboard).
 *   (c) additionally VITE_CLOUDINARY_API_KEY / VITE_CLOUDINARY_API_SECRET
 *       for signed URLs (delete by token; only used server-like or if you
 *       accept exposing the secret in a limited, behind-gateway bundle).
 *
 * Upload folder defaults to `exams/{examId}/questions/{questionId}` matching
 * the existing Firebase storage path, so URLs are consistent and deletes by
 * public_id work.
 */

import { Cloudinary } from "@cloudinary/url-gen";
import { auto } from "@cloudinary/url-gen/actions/resize";
import { autoGravity } from "@cloudinary/url-gen/qualifiers/gravity";
import { format, quality } from "@cloudinary/url-gen/actions/delivery";

// ---- Public types shared with image-handler.ts ----
export interface CloudinaryUploadResult {
  url: string;                // delivery URL (can be run through optimize())
  publicId: string;           // for deletion
  secureUrl: string;          // https:// URL
  assetId?: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  originalFilename?: string;
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey?: string;
  apiSecret?: string;          // Prefer unsigned preset from browser
  uploadPreset?: string;       // unsigned
  baseDeliveryType: string;    // default "upload"
  privateCdn?: boolean;
  secure?: boolean;            // default true
}

// ---- Environment helpers ----------------------------------------------------

export function readCloudinaryConfig(): CloudinaryConfig | null {
  const env = (import.meta as any).env || {};
  const cloudUrl = env.VITE_CLOUDINARY_URL as string | undefined;

  let cloudName = (env.VITE_CLOUDINARY_CLOUD_NAME as string) || "";
  let apiKey: string | undefined = env.VITE_CLOUDINARY_API_KEY as string | undefined;
  let apiSecret: string | undefined = env.VITE_CLOUDINARY_API_SECRET as string | undefined;

  if (cloudUrl) {
    try {
      // cloudinary://<key>:<secret>@<cloud>
      const m = cloudUrl.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
      if (m) {
        apiKey = apiKey || m[1];
        apiSecret = apiSecret || m[2];
        cloudName = cloudName || m[3];
      }
    } catch {
      // ignore malformed URL, fall back to individual vars
    }
  }

  const uploadPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

  if (!cloudName) {
    return null;
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    uploadPreset,
    baseDeliveryType: "upload",
    privateCdn: false,
    secure: true,
  };
}

export function isCloudinaryEnabled(): boolean {
  return readCloudinaryConfig() !== null;
}

export function isCloudinaryUrl(url: string): boolean {
  return typeof url === "string" && url.includes("cloudinary.com");
}

// ---- Cloudinary instance + URL generation ------------------------------------

let cldInstance: Cloudinary | null = null;

export function getCloudinaryInstance(): Cloudinary | null {
  const cfg = readCloudinaryConfig();
  if (!cfg) return null;
  if (!cldInstance) {
    cldInstance = new Cloudinary({
      cloud: {
        cloudName: cfg.cloudName,
        apiKey: cfg.apiKey,
        apiSecret: cfg.apiSecret,
      },
      url: {
        secure: cfg.secure !== false,
        privateCdn: !!cfg.privateCdn,
      },
    });
  }
  return cldInstance;
}

/**
 * Build an optimized delivery URL from a Cloudinary URL or publicId.
 * Applies: f_auto, q_auto, auto-crop to maxWidth (if set).
 */
export function buildOptimizedUrl(
  source: string,
  opts?: { maxWidth?: number; maxHeight?: number; quality?: string | number; format?: string }
): string {
  if (!source) return source;
  const cld = getCloudinaryInstance();
  if (!cld) {
    console.log("buildOptimizedUrl: Cloudinary not configured, returning source URL as-is");
    return source;
  }

  let img: any;

  if (isCloudinaryUrl(source)) {
    // Extract public_id from https://res.cloudinary.com/.../image/upload/.../publicId.ext
    // Fall back to returning the source if parse fails.
    try {
      const publicId = extractPublicId(source);
      console.log("buildOptimizedUrl: Extracted publicId:", publicId, "from URL:", source);
      if (publicId) {
        img = cld.image(publicId);
      } else {
        console.warn("buildOptimizedUrl: Could not extract publicId, returning source URL");
        return source;
      }
    } catch (err) {
      console.error("buildOptimizedUrl: Error extracting publicId:", err);
      return source;
    }
  } else {
    console.log("buildOptimizedUrl: Not a Cloudinary URL, using source as publicId");
    img = cld.image(source);
  }

  img = img.delivery(format(opts?.format || "auto")).delivery(quality(opts?.quality || "auto"));
  if (opts?.maxWidth || opts?.maxHeight) {
    img = img.resize(auto().width(opts?.maxWidth as any).height(opts?.maxHeight as any).gravity(autoGravity()));
  }

  const optimizedUrl = img.toURL();
  console.log("buildOptimizedUrl: Generated optimized URL:", optimizedUrl);
  return optimizedUrl;
}

export function extractPublicId(cloudinaryUrl: string): string | null {
  try {
    // Handle various Cloudinary URL formats:
    // https://res.cloudinary.com/<cloud>/image/upload/v<ver>/<folder>/<file>.<ext>
    // https://res.cloudinary.com/<cloud>/image/upload/<folder>/<file>.<ext>
    // https://res.cloudinary.com/<cloud>/image/upload/w_<width>,h_<height>/<folder>/<file>.<ext>
    
    const url = new URL(cloudinaryUrl);
    const pathParts = url.pathname.split('/');
    
    // Find 'upload' index and get everything after it
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1) {
      console.warn("extractPublicId: No 'upload' segment found in URL:", cloudinaryUrl);
      return null;
    }
    
    // Get all parts after 'upload'
    const afterUpload = pathParts.slice(uploadIndex + 1);
    if (afterUpload.length === 0) {
      console.warn("extractPublicId: No public_id after upload segment");
      return null;
    }
    
    // Remove version segment if present (e.g., 'v1234')
    let idParts = afterUpload.filter(p => p && !p.match(/^v\d+$/));
    
    // Join and remove file extension if present
    let publicId = idParts.join('/').split('.')[0];
    console.log("extractPublicId: Extracted from URL:", cloudinaryUrl, "Result:", publicId);
    return publicId || null;
  } catch (err) {
    console.error("extractPublicId: Error parsing URL:", err);
    return null;
  }
}

// ---- Uploads ----------------------------------------------------------------
// Two modes:
//  - UNsigned upload (preferred from browser) requires VITE_CLOUDINARY_UPLOAD_PRESET.
//  - Signed upload requires VITE_CLOUDINARY_API_KEY + secret.  ⚠️  Exposing a
//    secret in a public bundle is NOT generally safe. Use this ONLY when your
//    app runs behind an auth wall and you accept the risk; otherwise route
//    through your own signing backend.

export async function uploadImageToCloudinary(
  file: File,
  params: {
    examId: string;
    questionId: string;
    timestamp?: number;
    tags?: string[];
  },
  signal?: AbortSignal
): Promise<CloudinaryUploadResult> {
  const cfg = readCloudinaryConfig();
  if (!cfg) throw new Error("Cloudinary is not configured");

  const ts = params.timestamp || Date.now();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const folder = `exams/${params.examId}/questions/${params.questionId}`;
  const publicId = `${ts}`;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  fd.append("public_id", publicId);
  if (params.tags && params.tags.length > 0) fd.append("tags", params.tags.join(","));
  fd.append("context", `original_filename=${encodeURIComponent(file.name)}`);

  if (cfg.uploadPreset) {
    fd.append("upload_preset", cfg.uploadPreset);
  } else if (cfg.apiKey && cfg.apiSecret) {
    const payload: Record<string, string> = {
      folder,
      public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const signature = await signCloudinaryParams(payload, cfg.apiSecret);
    fd.append("timestamp", payload.timestamp);
    fd.append("signature", signature);
    fd.append("api_key", cfg.apiKey);
  } else {
    throw new Error(
      "Cloudinary needs either VITE_CLOUDINARY_UPLOAD_PRESET (unsigned, recommended) or VITE_CLOUDINARY_API_KEY+VITE_CLOUDINARY_API_SECRET."
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cfg.cloudName}/auto/upload`;

  let resp: Response;
  try {
    resp = await fetch(endpoint, { method: "POST", body: fd, signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error("Upload was cancelled or timed out. Please try again.");
    }
    throw new Error(`Network error uploading to Cloudinary: ${err?.message || String(err)}`);
  }

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = body?.error?.message || `HTTP ${resp.status}`;
    throw new Error(`Cloudinary upload failed: ${msg}`);
  }

  return {
    url: body.secure_url || body.url || "",
    publicId: body.public_id || `${folder}/${publicId}`,
    secureUrl: body.secure_url || body.url || "",
    assetId: body.asset_id,
    width: typeof body.width === "number" ? body.width : undefined,
    height: typeof body.height === "number" ? body.height : undefined,
    bytes: typeof body.bytes === "number" ? body.bytes : undefined,
    format: body.format,
    originalFilename: file.name,
  };
}

export async function deleteCloudinaryImage(cloudinaryUrlOrPublicId: string): Promise<void> {
  const cfg = readCloudinaryConfig();
  if (!cfg) {
    console.warn("Cloudinary not configured; ignoring delete for", cloudinaryUrlOrPublicId);
    return;
  }

  const publicId = isCloudinaryUrl(cloudinaryUrlOrPublicId)
    ? extractPublicId(cloudinaryUrlOrPublicId)
    : cloudinaryUrlOrPublicId;

  if (!publicId) {
    console.warn("Could not determine Cloudinary public_id for delete");
    return;
  }

  if (!cfg.apiKey || !cfg.apiSecret) {
    console.warn(
      "Cloudinary delete requires VITE_CLOUDINARY_API_KEY + SECRET to sign delete request. Skipping (recommend cleanup via Cloudinary dashboard)."
    );
    return;
  }

  const payload: Record<string, string> = {
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const signature = await signCloudinaryParams(payload, cfg.apiSecret);
  const fd = new FormData();
  fd.append("public_id", publicId);
  fd.append("timestamp", payload.timestamp);
  fd.append("signature", signature);
  fd.append("api_key", cfg.apiKey);

  try {
    const endpoint = `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/destroy`;
    const resp = await fetch(endpoint, { method: "POST", body: fd });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      console.warn("Cloudinary delete non-ok response:", data);
    }
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}

/**
 * Serverless-friendly SHA-1 signature helper.
 * NOTE: SHA-1 via Web Crypto works in modern browsers + Node 18+.
 */
async function signCloudinaryParams(params: Record<string, string>, apiSecret: string): Promise<string> {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => `${k}=${params[k]}`).join("&") + apiSecret;
  const enc = new TextEncoder().encode(toSign);
  const buf = await crypto.subtle.digest("SHA-1", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
