/**
 * Admin Guard Component
 * Protects admin routes by checking user permissions
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export interface AdminGuardProps {
  isAdmin: boolean;
  hasPermission?: boolean;
  requiredPermission?: string;
  children: React.ReactNode;
}

/**
 * Guard component to protect admin pages
 * Shows permission denied message if user doesn't have access
 */
export function AdminGuard({
  isAdmin,
  hasPermission = true,
  requiredPermission,
  children,
}: AdminGuardProps) {
  // Redirect non-admins to home
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show permission denied for missing specific permission
  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Access Denied
            </CardTitle>
            <CardDescription>You don't have permission to access this page</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {requiredPermission
                  ? `Required permission: ${requiredPermission}`
                  : 'This page requires elevated permissions.'}
              </p>
              <a
                href="/dashboard"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to Dashboard
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is admin with required permissions
  return <>{children}</>;
}

export default AdminGuard;
