import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/lib/firebase-admin';

export type SectionName = 
  | 'dashboard' 
  | 'manageExams' 
  | 'allResults' 
  | 'students' 
  | 'analytics' 
  | 'leaderboard' 
  | 'examiners' 
  | 'departments';

export type PermissionType = 'view' | 'edit' | 'delete';

interface SectionPermission {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

const DEFAULT_PERMISSIONS: Record<SectionName, SectionPermission> = {
  // Deny-by-default for all permissions - users must be explicitly granted access
  dashboard:   { view: false, edit: false, delete: false },
  manageExams: { view: false, edit: false, delete: false },
  allResults:  { view: false, edit: false, delete: false },
  students:    { view: false, edit: false, delete: false },
  analytics:   { view: false, edit: false, delete: false },
  leaderboard: { view: false, edit: false, delete: false },
  examiners:   { view: false, edit: false, delete: false },
  departments: { view: false, edit: false, delete: false },
};

export function useSectionPermissions() {
  const { profile, user } = useAuth();

  // Check if user is super admin
  const isSuper = React.useMemo(() => 
    user?.email ? isSuperAdmin(user.email) : false
  , [user?.email]);

  // Get section permissions from profile
  const sectionPermissions = React.useMemo(() => 
    (profile as any)?.sectionPermissions || DEFAULT_PERMISSIONS
  , [profile]);

  /**
   * Check if user has permission for a specific section and action
   */
  const hasPermission = React.useCallback((section: SectionName, type: PermissionType): boolean => {
    // Super admin has all permissions
    if (isSuper) return true;

    // Get permissions for this section
    const permissions = sectionPermissions[section] || DEFAULT_PERMISSIONS[section];
    
    return permissions[type] === true;
  }, [isSuper, sectionPermissions]);

  /**
   * Check if user can view a section
   */
  const canView = React.useCallback((section: SectionName): boolean => {
    return hasPermission(section, 'view');
  }, [hasPermission]);

  /**
   * Check if user can edit in a section
   */
  const canEdit = React.useCallback((section: SectionName): boolean => {
    return hasPermission(section, 'edit');
  }, [hasPermission]);

  /**
   * Check if user can delete in a section
   */
  const canDelete = React.useCallback((section: SectionName): boolean => {
    return hasPermission(section, 'delete');
  }, [hasPermission]);

  /**
   * Get all permissions for a section
   */
  const getSectionPermissions = React.useCallback((section: SectionName): SectionPermission => {
    if (isSuper) {
      return { view: true, edit: true, delete: true };
    }
    return sectionPermissions[section] || DEFAULT_PERMISSIONS[section];
  }, [isSuper, sectionPermissions]);

  return {
    hasPermission,
    canView,
    canEdit,
    canDelete,
    getSectionPermissions,
    isSuperAdmin: isSuper,
  };
}
