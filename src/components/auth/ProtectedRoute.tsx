import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/contexts/PermissionsContext";
import type { PermissionKey } from "@/types/permissions";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ("admin" | "student")[];
  requireAnyPermissions?: PermissionKey[];
  requireAllPermissions?: PermissionKey[];
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, requireAnyPermissions, requireAllPermissions, requireSuperAdmin }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const { hasAnyPermission, hasAllPermissions, isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }

      if (allowedRoles && role && !allowedRoles.includes(role)) {
        navigate("/dashboard", { replace: true });
        return;
      }

      // Super admin gate
      if (requireSuperAdmin && !isSuperAdmin) {
        navigate("/dashboard", { replace: true });
        return;
      }

      // Permission gates (admins only unless super admin)
      if ((requireAnyPermissions && requireAnyPermissions.length > 0) || (requireAllPermissions && requireAllPermissions.length > 0)) {
        // Students never pass permission checks
        if (role !== "admin") {
          navigate("/dashboard", { replace: true });
          return;
        }
        // Super admin bypass
        if (!isSuperAdmin) {
          if (requireAllPermissions && !hasAllPermissions(requireAllPermissions)) {
            navigate("/dashboard", { replace: true });
            return;
          }
          if (requireAnyPermissions && !hasAnyPermission(requireAnyPermissions)) {
            navigate("/dashboard", { replace: true });
            return;
          }
        }
      }
    }
  }, [user, role, loading, allowedRoles, requireAnyPermissions, requireAllPermissions, requireSuperAdmin, navigate, hasAnyPermission, hasAllPermissions, isSuperAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl border bg-card text-center space-y-4 shadow-sm animate-fade-in">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold font-display">Access Restricted</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your current account role does not have permission to access this page.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="rounded-xl">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl border bg-card text-center space-y-4 shadow-sm animate-fade-in">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold font-display">Super Admin Required</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This administration section requires super admin privileges.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="rounded-xl">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Permission checks for render path as well
  if ((requireAnyPermissions && requireAnyPermissions.length > 0) || (requireAllPermissions && requireAllPermissions.length > 0)) {
    if (role !== "admin") return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full p-6 rounded-2xl border text-center space-y-3">
          <p className="text-sm text-muted-foreground">Admin permissions required.</p>
          <Button onClick={() => navigate("/dashboard")} className="rounded-xl">Go to Dashboard</Button>
        </div>
      </div>
    );
    if (!isSuperAdmin) {
      if (requireAllPermissions && !hasAllPermissions(requireAllPermissions)) return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full p-6 rounded-2xl border text-center space-y-3">
            <p className="text-sm text-muted-foreground">Additional permissions required.</p>
            <Button onClick={() => navigate("/dashboard")} className="rounded-xl">Go to Dashboard</Button>
          </div>
        </div>
      );
      if (requireAnyPermissions && !hasAnyPermission(requireAnyPermissions)) return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full p-6 rounded-2xl border text-center space-y-3">
            <p className="text-sm text-muted-foreground">Additional permissions required.</p>
            <Button onClick={() => navigate("/dashboard")} className="rounded-xl">Go to Dashboard</Button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
