/**
 * System Settings Management
 * Handles system-wide configuration for practice exams
 */

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';

export interface SystemSettings {
  settingKey: string;
  settings: {
    practiceExamsEnabled: boolean;
    defaultPassingScore: number;
    sessionDurationDays: number;
    storageQuotaMB: number;
    maxDownloads: number;
    offlineFeatureEnabled: boolean;
    analyticsTrackingEnabled: boolean;
    updatedAt: Timestamp;
    updatedBy: string;
  };
}

const SETTINGS_DOC = 'system_settings';

/**
 * Get system settings
 */
export async function getSystemSettings(): Promise<SystemSettings['settings'] | null> {
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return getDefaultSettings();
    }

    return docSnap.data().settings as SystemSettings['settings'];
  } catch (error) {
    console.error('Error getting system settings:', error);
    return getDefaultSettings();
  }
}

/**
 * Update system settings
 */
export async function updateSystemSettings(
  settings: Partial<SystemSettings['settings']>,
  userId: string
): Promise<void> {
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC);
    const current = await getSystemSettings();

    const updated: SystemSettings['settings'] = {
      practiceExamsEnabled: settings.practiceExamsEnabled ?? current?.practiceExamsEnabled ?? true,
      defaultPassingScore: settings.defaultPassingScore ?? current?.defaultPassingScore ?? 50,
      sessionDurationDays: settings.sessionDurationDays ?? current?.sessionDurationDays ?? 30,
      storageQuotaMB: settings.storageQuotaMB ?? current?.storageQuotaMB ?? 500,
      maxDownloads: settings.maxDownloads ?? current?.maxDownloads ?? 10,
      offlineFeatureEnabled: settings.offlineFeatureEnabled ?? current?.offlineFeatureEnabled ?? true,
      analyticsTrackingEnabled:
        settings.analyticsTrackingEnabled ?? current?.analyticsTrackingEnabled ?? true,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    await setDoc(docRef, { settings: updated });
  } catch (error) {
    console.error('Error updating system settings:', error);
    throw error;
  }
}

/**
 * Get default settings
 */
function getDefaultSettings(): SystemSettings['settings'] {
  return {
    practiceExamsEnabled: true,
    defaultPassingScore: 50,
    sessionDurationDays: 30,
    storageQuotaMB: 500,
    maxDownloads: 10,
    offlineFeatureEnabled: true,
    analyticsTrackingEnabled: true,
    updatedAt: Timestamp.now(),
    updatedBy: 'system',
  };
}

/**
 * Check if practice exams are enabled globally
 */
export async function arePracticeExamsEnabled(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings?.practiceExamsEnabled ?? true;
}

/**
 * Check if offline features are enabled
 */
export async function areOfflineFeaturesEnabled(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings?.offlineFeatureEnabled ?? true;
}
