import { GoogleDriveFileInfo } from '@/types/book';

/**
 * Extracts a Google Drive File ID from standard Google Drive & Google Docs URLs,
 * or validates a direct File ID.
 */
export function extractDriveFileId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Pattern 1: https://drive.google.com/file/d/{fileId}/...
  const fileDPattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i;
  const matchFileD = trimmed.match(fileDPattern);
  if (matchFileD && matchFileD[1]) {
    return matchFileD[1];
  }

  // Pattern 2: https://drive.google.com/open?id={fileId} or uc?id={fileId}
  const idParamPattern = /drive\.google\.com\/(?:open|uc)\?(?:[a-zA-Z0-9_=&-]*&)?id=([a-zA-Z0-9_-]+)/i;
  const matchIdParam = trimmed.match(idParamPattern);
  if (matchIdParam && matchIdParam[1]) {
    return matchIdParam[1];
  }

  // Pattern 3: Google Docs / Slides / Sheets: https://docs.google.com/{type}/d/{fileId}/...
  const docsPattern = /docs\.google\.com\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/i;
  const matchDocs = trimmed.match(docsPattern);
  if (matchDocs && matchDocs[1]) {
    return matchDocs[1];
  }

  // Pattern 4: Bare Drive File ID (typically 25-50 characters of [a-zA-Z0-9_-])
  if (/^[a-zA-Z0-9_-]{15,60}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Construct an iframe-friendly Google Drive Preview URL
 */
export function buildDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

/**
 * Construct the standard Google Drive View URL
 */
export function buildDriveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view?usp=sharing`;
}

/**
 * Construct the direct Google Drive Download link
 */
export function buildDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

/**
 * Construct a high-resolution Google Drive Thumbnail URL
 */
export function buildDriveThumbnailUrl(fileId: string, size = 800): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
}

/**
 * Format bytes into readable format
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * Validates a Google Drive link by contacting the backend validation endpoint
 * or performing a client-side structural validation fallback.
 */
export async function validateDriveLink(urlOrId: string): Promise<GoogleDriveFileInfo> {
  const fileId = extractDriveFileId(urlOrId);

  if (!fileId) {
    return {
      fileId: '',
      fileName: '',
      mimeType: '',
      previewUrl: '',
      canDownload: false,
      accessible: false,
      error: 'Invalid Google Drive URL format. Please paste a standard sharing link (e.g. https://drive.google.com/file/d/...)',
    };
  }

  const previewUrl = buildDrivePreviewUrl(fileId);
  const downloadUrl = buildDriveDownloadUrl(fileId);
  const webViewLink = buildDriveViewUrl(fileId);

  try {
    const response = await fetch('/api/drive/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, url: urlOrId }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.success && data.info) {
        return {
          ...data.info,
          previewUrl: data.info.previewUrl || previewUrl,
          downloadUrl: data.info.downloadUrl || downloadUrl,
          webViewLink: data.info.webViewLink || webViewLink,
        };
      }
      if (data && data.error) {
        return {
          fileId,
          fileName: 'Google Drive Document',
          mimeType: 'application/pdf',
          previewUrl,
          downloadUrl,
          webViewLink,
          canDownload: true,
          accessible: false,
          error: data.error,
        };
      }
    }
  } catch (err) {
    console.warn('[Google Drive] Backend validation endpoint unreachable, using client verification:', err);
  }

  // Graceful client-side fallback if backend is offline/unreachable
  return {
    fileId,
    fileName: `Drive Document (${fileId.slice(0, 8)}...)`,
    mimeType: 'application/pdf',
    previewUrl,
    downloadUrl,
    webViewLink,
    canDownload: true,
    accessible: true,
  };
}
