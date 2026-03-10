/**
 * Permission Middleware for Backend Validation
 * Ensures all sensitive operations are protected by permission checks
 */

import { UserProfile } from '@/integrations/firebase/types';
import { UserPermissions, PermissionKey, SUPER_ADMIN_EMAIL } from '@/types/permissions';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if user has a specific permission
 */
export function checkUserPermission(
  user: UserProfile | null | undefined,
  permission: PermissionKey
): PermissionCheckResult {
  if (!user) {
    return { allowed: false, reason: 'User not authenticated' };
  }

  if (user.disabled === true) {
    return { allowed: false, reason: 'User account is disabled' };
  }

  // Super admin has all permissions (check by email)
  if (user.email === SUPER_ADMIN_EMAIL) {
    return { allowed: true };
  }

  // Super admin has all permissions (check by role for backward compatibility)
  if (user.role === 'superadmin') {
    return { allowed: true };
  }

  // Only admins can have granular permissions
  if (user.role !== 'admin') {
    return { allowed: false, reason: 'User is not an admin' };
  }

  // Check if user has the permission
  const userPermissions = user.permissions as UserPermissions | undefined;
  if (!userPermissions) {
    return { allowed: false, reason: 'User has no permissions assigned' };
  }

  const hasPermission = userPermissions[permission] === true;
  if (!hasPermission) {
    return { allowed: false, reason: `User lacks permission: ${permission}` };
  }

  return { allowed: true };
}

/**
 * Check if user has any of the specified permissions
 */
export function checkUserAnyPermission(
  user: UserProfile | null | undefined,
  permissions: PermissionKey[]
): PermissionCheckResult {
  if (!user) {
    return { allowed: false, reason: 'User not authenticated' };
  }

  if (user.disabled === true) {
    return { allowed: false, reason: 'User account is disabled' };
  }

  // Super admin has all permissions (check by email)
  if (user.email === SUPER_ADMIN_EMAIL) {
    return { allowed: true };
  }

  // Super admin has all permissions (check by role for backward compatibility)
  if (user.role === 'superadmin') {
    return { allowed: true };
  }

  if (user.role !== 'admin') {
    return { allowed: false, reason: 'User is not an admin' };
  }

  const userPermissions = user.permissions as UserPermissions | undefined;
  if (!userPermissions) {
    return { allowed: false, reason: 'User has no permissions assigned' };
  }

  const hasAny = permissions.some(p => userPermissions[p] === true);
  if (!hasAny) {
    return { allowed: false, reason: `User lacks any of permissions: ${permissions.join(', ')}` };
  }

  return { allowed: true };
}

/**
 * Check if user has all of the specified permissions
 */
export function checkUserAllPermissions(
  user: UserProfile | null | undefined,
  permissions: PermissionKey[]
): PermissionCheckResult {
  if (!user) {
    return { allowed: false, reason: 'User not authenticated' };
  }

  if (user.disabled === true) {
    return { allowed: false, reason: 'User account is disabled' };
  }

  // Super admin has all permissions (check by email)
  if (user.email === SUPER_ADMIN_EMAIL) {
    return { allowed: true };
  }

  // Super admin has all permissions (check by role for backward compatibility)
  if (user.role === 'superadmin') {
    return { allowed: true };
  }

  if (user.role !== 'admin') {
    return { allowed: false, reason: 'User is not an admin' };
  }

  const userPermissions = user.permissions as UserPermissions | undefined;
  if (!userPermissions) {
    return { allowed: false, reason: 'User has no permissions assigned' };
  }

  const hasAll = permissions.every(p => userPermissions[p] === true);
  if (!hasAll) {
    return { allowed: false, reason: `User lacks all permissions: ${permissions.join(', ')}` };
  }

  return { allowed: true };
}

/**
 * Throw error if permission check fails
 */
export function enforcePermission(
  user: UserProfile | null | undefined,
  permission: PermissionKey
): void {
  const result = checkUserPermission(user, permission);
  if (!result.allowed) {
    throw new Error(`Permission denied: ${result.reason}`);
  }
}

/**
 * Throw error if any permission check fails
 */
export function enforceAnyPermission(
  user: UserProfile | null | undefined,
  permissions: PermissionKey[]
): void {
  const result = checkUserAnyPermission(user, permissions);
  if (!result.allowed) {
    throw new Error(`Permission denied: ${result.reason}`);
  }
}

/**
 * Throw error if all permissions check fails
 */
export function enforceAllPermissions(
  user: UserProfile | null | undefined,
  permissions: PermissionKey[]
): void {
  const result = checkUserAllPermissions(user, permissions);
  if (!result.allowed) {
    throw new Error(`Permission denied: ${result.reason}`);
  }
}
