import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { 
  UserPermissions, 
  PermissionKey, 
  SUPER_ADMIN_PERMISSIONS,
  DEFAULT_PERMISSIONS 
} from '@/types/permissions';
import { isSuperAdmin as checkIsSuperAdmin } from '@/lib/firebase-admin';

interface PermissionsContextType {
  permissions: UserPermissions;
  hasPermission: (permission: PermissionKey) => boolean;
  hasAnyPermission: (permissions: PermissionKey[]) => boolean;
  hasAllPermissions: (permissions: PermissionKey[]) => boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { profile, role, user } = useAuth();

  // Determine if user is super admin using the same function as everywhere else
  const isSuperAdmin = user?.email ? checkIsSuperAdmin(user.email) : false;

  // Determine if user is any type of admin
  const isAdmin = role === 'admin';

  // Get user permissions (not used for super admin)
  const permissions: UserPermissions = isSuperAdmin
    ? SUPER_ADMIN_PERMISSIONS
    : (profile?.permissions ?? DEFAULT_PERMISSIONS);

  // Check if user has a specific permission
  const hasPermission = React.useCallback((permission: PermissionKey): boolean => {
    if (isSuperAdmin) return true; // Super admin has all permissions
    if (!isAdmin) return false; // Students have no admin permissions
    return permissions[permission] === true;
  }, [isSuperAdmin, isAdmin, permissions]);

  // Check if user has any of the specified permissions
  const hasAnyPermission = React.useCallback((permissionKeys: PermissionKey[]): boolean => {
    if (isSuperAdmin) return true;
    if (!isAdmin) return false;
    return permissionKeys.some(key => permissions[key] === true);
  }, [isSuperAdmin, isAdmin, permissions]);

  // Check if user has all of the specified permissions
  const hasAllPermissions = React.useCallback((permissionKeys: PermissionKey[]): boolean => {
    if (isSuperAdmin) return true;
    if (!isAdmin) return false;
    return permissionKeys.every(key => permissions[key] === true);
  }, [isSuperAdmin, isAdmin, permissions]);

  const value = React.useMemo(() => ({
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin,
    isAdmin,
  }), [permissions, hasPermission, hasAnyPermission, hasAllPermissions, isSuperAdmin, isAdmin]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
