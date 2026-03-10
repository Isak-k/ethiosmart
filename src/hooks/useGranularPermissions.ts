import { useAuth } from '@/contexts/AuthContext';
import { PermissionKey, SUPER_ADMIN_EMAIL } from '@/types/permissions';
import { UserPermissions } from '@/types/permissions';

/**
 * Hook for checking granular permissions (viewExamResults, deleteExams, etc.)
 * These permissions are managed by Super Admin and can be granted/revoked per examiner
 */
export function useGranularPermissions() {
  const { profile, user } = useAuth();

  /**
   * Check if user has a specific granular permission
   */
  const hasPermission = (permission: PermissionKey): boolean => {
    // Super admin has all permissions
    if (user?.email === SUPER_ADMIN_EMAIL) {
      return true;
    }

    // Get permissions from profile
    const userPermissions = (profile as any)?.permissions as UserPermissions | undefined;
    if (!userPermissions) {
      return false;
    }

    return userPermissions[permission] === true;
  };

  /**
   * Check if user can view exam results
   */
  const canViewExamResults = (): boolean => {
    return hasPermission('viewExamResults');
  };

  /**
   * Check if user can delete exams
   */
  const canDeleteExams = (): boolean => {
    return hasPermission('deleteExams');
  };

  /**
   * Check if user can view all results
   */
  const canViewAllResults = (): boolean => {
    return hasPermission('viewAllResults');
  };

  /**
   * Check if user can export results
   */
  const canExportResults = (): boolean => {
    return hasPermission('exportResults');
  };

  /**
   * Check if user can view feedback
   */
  const canViewFeedback = (): boolean => {
    return hasPermission('viewFeedback');
  };

  /**
   * Check if user can view AI Assistant
   */
  const canViewAIAssistant = (): boolean => {
    return hasPermission('viewAIAssistant');
  };

  return {
    hasPermission,
    canViewExamResults,
    canDeleteExams,
    canViewAllResults,
    canExportResults,
    canViewFeedback,
    canViewAIAssistant,
  };
}
