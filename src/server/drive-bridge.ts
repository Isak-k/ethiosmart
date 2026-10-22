import https from 'https';
import http from 'http';
import { URL } from 'url';
import zlib from 'zlib';

export interface DriveValidationResult {
  accessible: boolean;
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  webViewLink?: string;
  previewUrl: string;
  downloadUrl?: string;
  canDownload: boolean;
  error?: string;
}

/**
 * Fetch a URL following redirects up to maxRedirects
 */
function fetchWithRedirects(
  targetUrl: string,
  options: { method?: string; headers?: Record<string, string>; maxRedirects?: number } = {}
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const maxRedirects = options.maxRedirects ?? 5;
  const method = options.method || 'GET';
  const customHeaders = options.headers || {};

  return new Promise((resolve, reject) => {
    function doRequest(currentUrl: string, redirectsRemaining: number) {
      if (redirectsRemaining < 0) {
        return reject(new Error('Too many redirects'));
      }

      const parsed = new URL(currentUrl);
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;

      const req = transport.request(
        parsed,
        {
          method,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            ...customHeaders,
          },
        },
        (res) => {
          // Handle HTTP redirect (301, 302, 303, 307, 308)
          if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
            const nextUrl = new URL(res.headers.location, currentUrl).toString();
            res.resume(); // consume stream
            return doRequest(nextUrl, redirectsRemaining - 1);
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 200,
              headers: res.headers,
              body: Buffer.concat(chunks),
            });
          });
        }
      );

      req.on('error', reject);
      req.end();
    }

    doRequest(targetUrl, maxRedirects);
  });
}

/**
 * Validate Google Drive resource access and extract metadata
 */
export async function validateGoogleDriveFile(
  fileId: string,
  apiKey?: string
): Promise<DriveValidationResult> {
  const previewUrl = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
  const webViewLink = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;

  // Option A: If an authorized Google Drive API Key is configured
  if (apiKey && apiKey.trim().length > 0) {
    try {
      const apiUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,capabilities,webViewLink&key=${apiKey.trim()}`;
      const { statusCode, body } = await fetchWithRedirects(apiUrl);

      if (statusCode === 200) {
        const json = JSON.parse(body.toString('utf8'));
        return {
          accessible: true,
          fileId: json.id || fileId,
          fileName: json.name || 'Google Drive Document',
          mimeType: json.mimeType || 'application/pdf',
          fileSizeBytes: json.size ? Number(json.size) : undefined,
          webViewLink: json.webViewLink || webViewLink,
          previewUrl,
          downloadUrl,
          canDownload: json.capabilities?.canDownload ?? true,
        };
      }

      if (statusCode === 404) {
        return {
          accessible: false,
          fileId,
          fileName: '',
          mimeType: '',
          previewUrl,
          canDownload: false,
          error: 'File not found on Google Drive. Please verify the URL and file ID.',
        };
      }

      if (statusCode === 403) {
        return {
          accessible: false,
          fileId,
          fileName: '',
          mimeType: '',
          previewUrl,
          canDownload: false,
          error: 'Access denied. The file is private or restricted. In Google Drive, click Share and set General Access to "Anyone with the link can view".',
        };
      }
    } catch (err: any) {
      console.warn('[Drive Validator] API key lookup failed, trying direct public verification:', err.message);
    }
  }

  // Option B: Public link verification
  try {
    const viewUrl = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
    const res = await fetchWithRedirects(viewUrl, { method: 'GET' });

    // Check if it was redirected to a login page (private file)
    const bodyStr = res.body.toString('utf8');
    const isLoginPage =
      bodyStr.includes('ServiceLogin') ||
      bodyStr.includes('accounts.google.com') ||
      bodyStr.includes('Sign in to continue');

    if (isLoginPage || res.statusCode === 403) {
      return {
        accessible: false,
        fileId,
        fileName: '',
        mimeType: '',
        previewUrl,
        canDownload: false,
        error: 'The Google Drive document is private or requires sign-in. Please update sharing settings to "Anyone with the link can view".',
      };
    }

    if (res.statusCode === 404) {
      return {
        accessible: false,
        fileId,
        fileName: '',
        mimeType: '',
        previewUrl,
        canDownload: false,
        error: 'File not found. Please ensure the link is correct.',
      };
    }

    // Extract title from og:title or title tag if available
    let fileName = `Drive Document (${fileId.slice(0, 8)}...)`;
    const ogTitleMatch = bodyStr.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      fileName = ogTitleMatch[1].replace(/ - Google Drive$/, '').trim();
    } else {
      const titleMatch = bodyStr.match(/<title>(.*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        fileName = titleMatch[1].replace(/ - Google Drive$/, '').trim();
      }
    }

    // Determine MIME type
    let mimeType = 'application/pdf';
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (lower.endsWith('.txt')) mimeType = 'text/plain';
    else if (lower.endsWith('.docx') || lower.endsWith('.doc')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (lower.endsWith('.epub')) mimeType = 'application/epub+zip';

    return {
      accessible: true,
      fileId,
      fileName,
      mimeType,
      previewUrl,
      downloadUrl,
      webViewLink,
      canDownload: true,
    };
  } catch (err: any) {
    return {
      accessible: false,
      fileId,
      fileName: '',
      mimeType: '',
      previewUrl,
      canDownload: false,
      error: `Could not connect to Google Drive: ${err.message}`,
    };
  }
}

/**
 * Extract plain text content from a Google Drive file for AI Exam generation
 */
export async function extractGoogleDriveContent(
  fileId: string,
  options?: { pageRange?: string; chapter?: string }
): Promise<{ text: string; totalPages?: number; chunks: Array<{ pageNumber?: number; text: string }> }> {
  // 1. Try Google Docs text export if applicable
  try {
    const docsExportUrl = `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/export?format=txt`;
    const docsRes = await fetchWithRedirects(docsExportUrl);
    if (docsRes.statusCode === 200 && docsRes.body.length > 50) {
      const fullText = docsRes.body.toString('utf8').replace(/\r\n/g, '\n').trim();
      const chunks = splitTextIntoSemanticChunks(fullText, 1500);
      return {
        text: fullText,
        chunks,
      };
    }
  } catch (e) {
    // Continue to standard download
  }

  // 2. Fetch using downloadGoogleDriveBuffer (handles virus scan warning pages & redirects)
  const downloaded = await downloadGoogleDriveBuffer(fileId);
  const body = downloaded.buffer;

  // Check if response is plain text
  const isLikelyPdf = body.slice(0, 5).toString('ascii').startsWith('%PDF') || downloaded.fileName.toLowerCase().endsWith('.pdf');

  if (!isLikelyPdf) {
    const textStr = body.toString('utf8');
    if (!textStr.includes('<!DOCTYPE html>')) {
      const cleaned = textStr.replace(/\r\n/g, '\n').trim();
      const chunks = splitTextIntoSemanticChunks(cleaned, 1500);
      return { text: cleaned, chunks };
    }
  }

  // Extract from PDF (supports both direct stream objects and FlateDecode compressed streams)
  const extractedText = extractTextFromPdfBuffer(body);

  if (!extractedText || extractedText.trim().length < 50) {
    console.warn('[Drive Bridge] Insufficient text extracted from PDF, returning empty for client outline fallback.');
    return {
      text: '',
      totalPages: 0,
      chunks: [],
    };
  }

  const chunks = splitTextIntoSemanticChunks(extractedText, 1500);

  // If a page range was requested (e.g. "1-10"), slice the chunks accordingly
  let filteredChunks = chunks;
  if (options?.pageRange) {
    const rangeMatch = options.pageRange.match(/(\d+)\s*[-–to]+\s*(\d+)/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      filteredChunks = chunks.filter((c) => {
        const page = c.pageNumber ?? 1;
        return page >= start && page <= end;
      });
      if (filteredChunks.length === 0) {
        filteredChunks = chunks.slice(0, Math.min(chunks.length, end - start + 1));
      }
    }
  }

  const finalText = filteredChunks.map((c) => c.text).join('\n\n');

  return {
    text: finalText,
    totalPages: chunks.length,
    chunks: filteredChunks,
  };
}

/**
 * Robust extraction of text streams from PDF buffer (uncompressed and flate-compressed streams)
 */
function extractTextFromPdfBuffer(pdfBuffer: Buffer): string {
  const pieces: string[] = [];

  // Pass 1: Direct extraction from raw latin1 string
  const rawString = pdfBuffer.toString('latin1');
  const directText = extractTextFromRawPdfString(rawString);
  if (directText && directText.length > 50) {
    pieces.push(directText);
  }

  // Pass 2: Inflate and extract from FlateDecode compressed streams (standard in modern PDFs)
  const streamMarker = Buffer.from('stream');
  const endStreamMarker = Buffer.from('endstream');
  let searchIdx = 0;

  while (searchIdx < pdfBuffer.length && pieces.join(' ').length < 50000) {
    const streamStart = pdfBuffer.indexOf(streamMarker, searchIdx);
    if (streamStart === -1) break;

    let dataStart = streamStart + 6;
    if (pdfBuffer[dataStart] === 0x0d) dataStart++; // \r
    if (pdfBuffer[dataStart] === 0x0a) dataStart++; // \n

    const streamEnd = pdfBuffer.indexOf(endStreamMarker, dataStart);
    if (streamEnd === -1) break;

    let dataEnd = streamEnd;
    if (dataEnd > dataStart && pdfBuffer[dataEnd - 1] === 0x0a) dataEnd--;
    if (dataEnd > dataStart && pdfBuffer[dataEnd - 1] === 0x0d) dataEnd--;

    const streamData = pdfBuffer.slice(dataStart, dataEnd);
    if (streamData.length > 0) {
      try {
        const decompressed = zlib.inflateSync(streamData);
        const textFromStream = extractTextFromRawPdfString(decompressed.toString('latin1'));
        if (textFromStream && textFromStream.trim().length > 10) {
          pieces.push(textFromStream);
        }
      } catch {
        // Not a zlib compressed stream, skip
      }
    }

    searchIdx = streamEnd + 9;
  }

  return pieces.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract BT ... ET text blocks and Tj/TJ strings from a PDF string
 */
function extractTextFromRawPdfString(pdfRaw: string): string {
  const textPieces: string[] = [];
  
  // Extract BT ... ET blocks (PDF text objects)
  const btRegex = /BT[\s\S]*?ET/g;
  let match: RegExpExecArray | null;

  while ((match = btRegex.exec(pdfRaw)) !== null) {
    const block = match[0];
    // Extract strings inside parentheses (Tj or TJ operators)
    const stringRegex = /\((.*?)\)\s*(?:Tj|'|")/g;
    let strMatch: RegExpExecArray | null;
    while ((strMatch = stringRegex.exec(block)) !== null) {
      const decoded = decodePdfEscapedString(strMatch[1]);
      if (decoded.trim().length > 0) {
        textPieces.push(decoded);
      }
    }

    // Extract TJ array syntax: [(string) -10 (string)] TJ
    const tjRegex = /\[(.*?)\]\s*TJ/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const arrayContent = tjMatch[1];
      const itemRegex = /\((.*?)\)/g;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemRegex.exec(arrayContent)) !== null) {
        const decoded = decodePdfEscapedString(itemMatch[1]);
        if (decoded.trim().length > 0) {
          textPieces.push(decoded);
        }
      }
    }
  }

  const combined = textPieces.join(' ').replace(/\s+/g, ' ').trim();
  return combined;
}

function decodePdfEscapedString(input: string): string {
  return input
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\[0-7]{1,3}/g, (oct) => String.fromCharCode(parseInt(oct.slice(1), 8)));
}

function splitTextIntoSemanticChunks(
  text: string,
  targetChunkChars = 2000
): Array<{ pageNumber: number; text: string }> {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: Array<{ pageNumber: number; text: string }> = [];
  let currentChunk = '';
  let pageCounter = 1;

  for (const para of paragraphs) {
    if ((currentChunk.length + para.length > targetChunkChars) && currentChunk.length > 0) {
      chunks.push({ pageNumber: pageCounter++, text: currentChunk.trim() });
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({ pageNumber: pageCounter, text: currentChunk.trim() });
  }

  return chunks;
}

/**
 * Download raw binary buffer of a Google Drive file for in-app offline caching
 */
export async function downloadGoogleDriveBuffer(
  fileId: string
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  // 1. Try Google Docs export first if it's a doc
  try {
    const docsExportUrl = `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/export?format=pdf`;
    const docsRes = await fetchWithRedirects(docsExportUrl);
    if (
      docsRes.statusCode === 200 &&
      docsRes.body.length > 50 &&
      docsRes.body.slice(0, 5).toString('ascii').startsWith('%PDF')
    ) {
      return {
        buffer: docsRes.body,
        contentType: 'application/pdf',
        fileName: `${fileId}.pdf`,
      };
    }
  } catch (e) {
    // Continue to standard export
  }

  // 2. Direct Google Drive uc download link
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  let res = await fetchWithRedirects(downloadUrl);

  // If Google Drive shows the "virus scan warning" confirmation page:
  if (res.statusCode === 200) {
    const textSample = res.body.slice(0, 2000).toString('utf8');
    if (textSample.includes('uc-download-link') || textSample.includes('export=download')) {
      const confirmMatch =
        textSample.match(/href="(\/uc\?export=download[^"]+)"/i) ||
        textSample.match(/action="([^"]+)"/i);
      if (confirmMatch && confirmMatch[1]) {
        const confirmUrl = confirmMatch[1].startsWith('http')
          ? confirmMatch[1]
          : `https://drive.google.com${confirmMatch[1].replace(/&amp;/g, '&')}`;
        res = await fetchWithRedirects(confirmUrl);
      }
    }
  }

  if (res.statusCode !== 200 || res.body.length === 0) {
    throw new Error('Failed to download document from Google Drive. Please verify the file is shared publicly.');
  }

  let fileName = `${fileId}.pdf`;
  const disposition = res.headers['content-disposition'] as string;
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (match && match[1]) {
      fileName = decodeURIComponent(match[1]);
    }
  }

  let contentType = (res.headers['content-type'] as string) || 'application/pdf';
  // Force correct MIME type for PDF if detected by header magic bytes or filename
  const isPdf = res.body.slice(0, 5).toString('ascii').startsWith('%PDF') || fileName.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    contentType = 'application/pdf';
  }

  return {
    buffer: res.body,
    contentType,
    fileName,
  };
}
