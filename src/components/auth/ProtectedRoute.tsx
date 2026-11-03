import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/contexts/PermissionsContext";
import { GuestSetupDialog } from "@/components/auth/GuestSetupDialog";
import { getStoredGuestProfile, isGuestProfileComplete } from "@/lib/guest-session";
import type { PermissionKey } from "@/types/permissions";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ("admin" | "student")[];
  requireAnyPermissions?: PermissionKey[];
  requireAllPermissions?: PermissionKey[];
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, requireAnyPermissions, requireAllPermissions, requireSuperAdmin }: ProtectedRouteProps) {
  const { user, role, loading, isGuest, requireStudentLogin, updateGuestProfile } = useAuth();
  const { hasAnyPermission, hasAllPermissions, isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  // Dialog state for guest students when profile is incomplete
  const [showGuestDialog, setShowGuestDialog] = useState(false);

  // Check if current route is student-accessible
  const isStudentAccessible = !allowedRoles || allowedRoles.includes("student");

  useEffect(() => {
    if (!loading) {
      // 1. Unauthenticated case
      if (!user) {
        // If Open Access (student login is not required) and this is a student route, allow guest
        if (!requireStudentLogin && isStudentAccessible) {
          const stored = getStoredGuestProfile();
          if (!isGuestProfileComplete(stored)) {
            setShowGuestDialog(true);
          }
          return;
        }

        // Otherwise redirect to auth (direct admins to admin login)
        if (allowedRoles && !allowedRoles.includes("student")) {
          navigate("/auth?role=admin", { replace: true });
        } else {
          navigate("/auth", { replace: true });
        }
        return;
      }

      // 2. Guest user trying to access admin route
      if (isGuest && allowedRoles && !allowedRoles.includes("student")) {
        navigate("/auth?role=admin", { replace: true });
        return;
      }

      // 3. Check guest profile completeness on student routes
      if (isGuest && isStudentAccessible) {
        const stored = getStoredGuestProfile();
        if (!isGuestProfileComplete(stored)) {
          setShowGuestDialog(true);
        }
      }

      // 4. Standard role verification for authenticated users
      if (allowedRoles && role && !allowedRoles.includes(role)) {
        navigate(role === "admin" ? "/dashboard" : "/dashboard/exams", { replace: true });
        return;
      }

      // 5. Super admin gate
      if (requireSuperAdmin && !isSuperAdmin) {
        navigate(role === "admin" ? "/dashboard" : "/dashboard/exams", { replace: true });
        return;
      }

      // 6. Permission gates (admins only unless super admin)
      if ((requireAnyPermissions && requireAnyPermissions.length > 0) || (requireAllPermissions && requireAllPermissions.length > 0)) {
        // Students never pass permission checks
        if (role !== "admin") {
          navigate("/dashboard/exams", { replace: true });
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
  }, [
    user,
    role,
    loading,
    isGuest,
    requireStudentLogin,
    isStudentAccessible,
    allowedRoles,
    requireAnyPermissions,
    requireAllPermissions,
    requireSuperAdmin,
    navigate,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin
  ]);

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

  // If user is absent, only allow if student login is not required and route is student-accessible
  if (!user && (requireStudentLogin || !isStudentAccessible)) {
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
          <Button onClick={() => navigate(role === "admin" ? "/dashboard" : "/dashboard/exams")} className="rounded-xl">
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

  return (
    <>
      {children}
      {/* Guest setup prompt if in open access mode and guest has not selected name/department */}
      <GuestSetupDialog
        open={showGuestDialog}
        onOpenChange={setShowGuestDialog}
        onCompleted={(profile) => {
          updateGuestProfile({
            full_name: profile.full_name,
            departmentId: profile.departmentId,
            departmentName: profile.departmentName,
          });
          setShowGuestDialog(false);
        }}
        allowCloseWithoutSave={false}
      />
    </>
  );
}
