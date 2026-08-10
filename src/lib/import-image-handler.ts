/**
 * Import Image Handler
 * Manages downloading and uploading images during bulk import
 */

import { uploadQuestionImageWithRetry } from './image-handler';
import { NewQuestionInput } from './validations';

export interface ImageProcessingResult {
  successCount: number;
  failureCount: number;
  questionIds: Map<number, string>; // Maps question index to Firebase URL
  errors: Array<{ index: number; url: string; error: string }>;
}

/**
 * Download and upload images for imported questions
 * Handles missing/invalid images gracefully
 */
export async function downloadAndUploadImages(
  questions: NewQuestionInput[],
  examId: string,
  startingQuestionId = 'import-'
): Promise<ImageProcessingResult> {
  const result: ImageProcessingResult = {
    successCount: 0,
    failureCount: 0,
    questionIds: new Map(),
    errors: []
  };

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    // Skip if no image URL
    if (!question.imageUrl) {
      continue;
    }

    try {
      // Skip if already a Firebase Storage URL
      if (question.imageUrl.includes('firebasestorage.googleapis.com')) {
        result.questionIds.set(i, question.imageUrl);
        result.successCount++;
        continue;
      }

      // Download image from URL
      const imageData = await downloadImage(question.imageUrl);
      
      // Create temp file
      const tempFile = new File([imageData], `image-${i}.jpg`, { type: 'image/jpeg' });
      
      // Generate question ID for import
      const questionId = `${startingQuestionId}${i}`;
      
      // Upload to Firebase
      const uploadResult = await uploadQuestionImageWithRetry(
        tempFile,
        examId,
        questionId,
        3,
        false  // Don't validate dimensions for imported images
      );

      result.questionIds.set(i, uploadResult.url);
      question.imageUrl = uploadResult.url;
      result.successCount++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({
        index: i,
        url: question.imageUrl || '',
        error: errorMsg
      });
      result.failureCount++;
      
      // Log but don't fail - images are optional
      console.warn(`Failed to process image for question ${i + 1}: ${errorMsg}`);
    }
  }

  return result;
}

/**
 * Download image from external URL
 */
async function downloadImage(url: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/*'
      },
      // Add timeout
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      throw new Error('Image exceeds 5MB size limit');
    }

    return await response.arrayBuffer();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('timeout')) {
      throw new Error('Download timeout - image URL took too long to respond');
    }
    throw error;
  }
}

/**
 * Get summary of image processing results
 */
export function getImageProcessingSummary(result: ImageProcessingResult): string {
  const total = result.successCount + result.failureCount;
  const successRate = total > 0 ? Math.round((result.successCount / total) * 100) : 0;

  let summary = `Image Processing Results:\n`;
  summary += `  Successfully processed: ${result.successCount}/${total} (${successRate}%)\n`;
  
  if (result.failureCount > 0) {
    summary += `  Failed: ${result.failureCount}\n`;
    summary += `  Details:\n`;
    
    for (const error of result.errors.slice(0, 5)) {
      summary += `    - Question ${error.index + 1}: ${error.error}\n`;
    }
    
    if (result.errors.length > 5) {
      summary += `    ... and ${result.errors.length - 5} more\n`;
    }
  }

  return summary;
}

/**
 * Check if any images were successfully processed
 */
export function hasProcessedImages(result: ImageProcessingResult): boolean {
  return result.successCount > 0;
}

/**
 * Filter out questions without images
 */
export function getQuestionsWithImages(
  questions: NewQuestionInput[],
  imageMapping: Map<number, string>
): Array<{ index: number; question: NewQuestionInput; imageUrl: string }> {
  const result = [];
  
  for (const [index, imageUrl] of imageMapping.entries()) {
    if (index < questions.length && imageUrl) {
      result.push({
        index,
        question: questions[index],
        imageUrl
      });
    }
  }
  
  return result;
}
