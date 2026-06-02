/**
 * Practice Exam Configuration Management
 * Handles saving and retrieving practice exam configurations
 */

import { updateExam } from '@/lib/firebase-exams';
import { PracticeExamConfig, ExamType, PracticeModeType } from '@/integrations/firebase/types';

export interface PracticeExamConfigUpdate {
  examType: ExamType;
  practiceMode: PracticeModeType;
  practiceConfig: PracticeExamConfig;
  allowOfflineDownload: boolean;
}

/**
 * Save practice exam configuration
 */
export async function savePracticeExamConfig(
  examId: string,
  config: PracticeExamConfigUpdate
): Promise<void> {
  try {
    await updateExam(examId, {
      examType: config.examType,
      practiceMode: config.practiceMode,
      practiceConfig: config.practiceConfig,
      allowOfflineDownload: config.allowOfflineDownload,
    });
  } catch (error) {
    console.error('Error saving practice exam config:', error);
    throw error;
  }
}

/**
 * Enable practice mode on an exam
 */
export async function enablePracticeMode(
  examId: string,
  mode: PracticeModeType = 'practice'
): Promise<void> {
  try {
    await updateExam(examId, {
      examType: 'practice',
      practiceMode: mode,
      allowOfflineDownload: true,
    });
  } catch (error) {
    console.error('Error enabling practice mode:', error);
    throw error;
  }
}

/**
 * Disable practice mode on an exam
 */
export async function disablePracticeMode(examId: string): Promise<void> {
  try {
    await updateExam(examId, {
      examType: 'normal',
      practiceMode: undefined,
      practiceConfig: undefined,
      allowOfflineDownload: false,
    });
  } catch (error) {
    console.error('Error disabling practice mode:', error);
    throw error;
  }
}

/**
 * Toggle offline download for an exam
 */
export async function toggleOfflineDownload(
  examId: string,
  enabled: boolean
): Promise<void> {
  try {
    await updateExam(examId, {
      allowOfflineDownload: enabled,
    });
  } catch (error) {
    console.error('Error toggling offline download:', error);
    throw error;
  }
}

/**
 * Update practice config only (keep exam type and mode)
 */
export async function updatePracticeConfig(
  examId: string,
  config: Partial<PracticeExamConfig>
): Promise<void> {
  try {
    await updateExam(examId, {
      practiceConfig: config as PracticeExamConfig,
    });
  } catch (error) {
    console.error('Error updating practice config:', error);
    throw error;
  }
}
