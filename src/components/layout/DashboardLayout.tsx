import React, { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useSectionPermissions } from "@/hooks/useSectionPermissions";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  GraduationCap,
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ClipboardList,
  Trophy,
  Menu,
  X,
  Shield,
  UserCog,
  Building,
  User,
  MessageSquare,
  Brain,
  BookOpen,
  Library,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { syncAllDeviceData } from "@/lib/device-storage-sync";
import { GuestSetupDialog } from "@/components/auth/GuestSetupDialog";
import { EthioSmartLogo } from "@/components/ui/EthioSmartLogo";
import { EthioAccentBar } from "@/components/ui/EthioAccentBar";
import { LiquidBackdrop } from "@/components/ui/LiquidBackdrop";

interface DashboardLayoutProps {
  children: ReactNode;
  contentClassName?: string;
}

export function DashboardLayout({ children, contentClassName }: DashboardLayoutProps) {
  const { profile, role, isGuest, updateGuestProfile } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { canView } = useSectionPermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [showGuestEditDialog, setShowGuestEditDialog] = useState(false);
  const { t } = useTranslation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Background auto-sync of critical subjects, chapters, exams, books and notes to device storage
  React.useEffect(() => {
    const runSync = () => {
      if (typeof window !== "undefined" && navigator.onLine) {
        syncAllDeviceData(profile?.departmentId).catch(() => {});
      }
    };

    // Stagger slightly by 1.2s so initial page mount is instantaneous
    const timer = setTimeout(runSync, 1200);
    window.addEventListener("online", runSync);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", runSync);
    };
  }, [profile?.departmentId]);

  const studentLinks = React.useMemo(() => [
    { href: "/dashboard", label: t("dashboard.menu.dashboard", "Home"), icon: LayoutDashboard },
    { href: "/dashboard/books", label: "Study", icon: BookOpen },
    { href: "/dashboard/exams", label: "Exams", icon: ClipboardList },
    { href: "/dashboard/ai-assistant", label: "AI Tutor", icon: Brain, permission: 'viewAIAssistant' },
    { href: "/dashboard/results", label: t("dashboard.menu.myResults", "Results"), icon: Trophy },
    { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  ], [t]);

  const allAdminLinks = React.useMemo(() => [
    { href: "/dashboard", label: t("dashboard.menu.dashboard"), icon: LayoutDashboard, permission: 'viewDashboard' },
    { href: "/dashboard/admin/exams", label: t("dashboard.menu.manageExams"), icon: FileText, permission: 'viewAllExams' },
    { href: "/dashboard/admin/ai-generator", label: "AI Exam Generator", icon: Sparkles, permission: 'viewAllExams' },
    { href: "/dashboard/admin/books", label: "Books", icon: Library, permission: 'viewAllExams' },
    { href: "/dashboard/all-results", label: t("dashboard.menu.allResults"), icon: Trophy, permission: 'viewAllResults' },
    { href: "/dashboard/students", label: t("dashboard.menu.students"), icon: Users, permission: 'viewStudents' },
    { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquare, permission: 'viewStudents' },
    { href: "/dashboard/ai-assistant", label: t("aiAssistant.title", "AI Study Assistant"), icon: Brain, permission: 'viewAIAssistant' },
    { href: "/dashboard/leaderboard-admin", label: "Leaderboard Admin", icon: Trophy, permission: 'viewLeaderboard' },
    { href: "/dashboard/admin/subjects", label: "Subjects", icon: BookOpen },
    { href: "/dashboard/departments", label: t("dashboard.menu.departments", "Departments"), icon: Building, permission: 'viewDepartments' },
    { href: "/settings", label: t("common.settings", "Settings"), icon: Settings, permission: 'viewDashboard' },
    ...(isSuperAdmin ? [{ href: "/dashboard/super-admin", label: "Super Admin", icon: Shield, permission: 'viewExaminers' }] : []),
  ], [t, isSuperAdmin]);

  const adminLinks = React.useMemo(() => allAdminLinks.filter(link => 
    !link.permission || hasPermission(link.permission as any)
  ), [allAdminLinks, hasPermission]);

  const links = role === "admin" ? adminLinks : studentLinks;

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#f2f7fe] via-[#f8fbff] to-[#e8f2fe] dark:from-[#050b16] dark:via-[#09152b] dark:to-[#040812] transition-colors duration-500">
      {/* Ambient Liquid Glass Backdrop Canvas with Interactive Ripples */}
      <LiquidBackdrop showDroplets={true} showSplash={false} showRipples={true} interactive={true} className="fixed inset-0 opacity-80 dark:opacity-40" />

      {/* Desktop header - Translucent Frosted Glass */}
      <header className="hidden lg:block fixed top-0 left-64 right-0 z-40 h-16 border-b border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl">
        <div className="h-full px-6 flex items-center justify-end gap-4">
          <div className="[&_button]:liquid-glass-squircle [&_button]:rounded-2xl">
            <LanguageToggle />
          </div>
          <div className="[&_button]:liquid-glass-squircle [&_button]:rounded-2xl">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile header - Translucent Frosted Glass with Liquid Toggles */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/60 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl flex items-center justify-between px-3 sm:px-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-10 w-10 rounded-2xl liquid-glass-squircle"
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link to={role === "admin" ? "/dashboard" : "/dashboard"} className="flex items-center">
            <EthioSmartLogo variant="compact" size="xs" textColor="auto" />
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="[&_button]:liquid-glass-squircle [&_button]:rounded-2xl">
            <LanguageToggle />
          </div>
          <div className="[&_button]:liquid-glass-squircle [&_button]:rounded-2xl">
            <ThemeToggle />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0" aria-label="Open Profile Menu">
                <Avatar className="h-9 w-9 ring-1 ring-sky-400/30">
                  <AvatarFallback className="bg-sky-600/30 backdrop-blur-md text-foreground dark:text-white text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-2xl shadow-xl liquid-glass-card">
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                {t("common.settings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {t("common.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-64 bg-sidebar/95 backdrop-blur-sm border-r border-sidebar-border/50 shadow-lg transform transition-transform duration-300 ease-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <Link
            to={role === "admin" ? "/dashboard" : "/dashboard"}
            className="relative h-20 flex flex-col justify-center px-5 border-b border-white/10 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 hover:opacity-95 transition-opacity"
          >
            <EthioSmartLogo variant="compact" size="sm" textColor="light" />
            <div className="flex items-center justify-between mt-1 pl-12 pr-1">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-sky-300">
                {role === "admin" ? "Admin Portal" : "Student Platform"}
              </span>
              <span className="text-[9px] font-medium text-slate-400">
                EthioSmart
              </span>
            </div>
            <EthioAccentBar className="absolute bottom-0 left-0 right-0" size="sm" />
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
            {links.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium",
                    isActive
                      ? "bg-white/20 text-white font-semibold shadow-md backdrop-blur-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <link.icon className={cn(
                    "h-5 w-5 transition-transform group-hover:scale-110", 
                    isActive ? "text-white" : "text-white/70 group-hover:text-white"
                  )} />
                  <span className="text-sm">{link.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-3.5 border-t border-white/10 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 transition-all border border-transparent hover:border-white/15">
                  <Avatar className="h-9 w-9 ring-2 ring-sky-400/30 shadow-sm shrink-0">
                    <AvatarFallback className="bg-sky-600/30 backdrop-blur-sm text-white text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {profile?.full_name || (isGuest ? "Guest Student" : "User")}
                    </p>
                    <p className="text-[11px] text-sky-200/80 capitalize truncate">
                      {isGuest ? "Guest Access" : role ? t(`common.${role}`) : ""}
                    </p>
                  </div>
                  <Settings className="h-4 w-4 text-white/70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {isGuest ? (
                  <>
                    <DropdownMenuItem onClick={() => setShowGuestEditDialog(true)}>
                      <User className="mr-2 h-4 w-4" />
                      Edit Name & Department
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/auth?role=admin")}>
                      <Shield className="mr-2 h-4 w-4" />
                      Staff / Admin Sign In
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/settings")}>
                      <Settings className="mr-2 h-4 w-4" />
                      {t("common.settings")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      {t("common.signOut")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="relative z-10 lg:ml-64 min-h-screen pt-16 lg:pt-16 pb-20 lg:pb-0">
        <div className={cn("p-6 lg:p-8", contentClassName)}>{children}</div>
      </main>

      {/* Mobile Bottom Navigation - Liquid Glass Floating Dock (Optimized for 98% mobile user base) */}
      <nav className="liquid-glass-dock lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className={cn("grid gap-1 px-2 py-1.5", role === "admin" ? "grid-cols-4" : "grid-cols-5")}>
          {role === "admin" ? (
            <>
              {links.slice(0, 3).map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all min-h-[50px] active:scale-95",
                      isActive
                        ? "bg-sky-500/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold border border-sky-400/30 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-foreground"
                    )}
                  >
                    <link.icon className={cn(
                      "h-5 w-5 transition-transform",
                      isActive && "scale-110 text-sky-600 dark:text-sky-400"
                    )} />
                    <span className="text-[10px] font-medium truncate max-w-full">
                      {link.label}
                    </span>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_#0ea5e9]" />
                    )}
                  </Link>
                );
              })}
              
              <Link
                to="/dashboard/students"
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all min-h-[50px] active:scale-95",
                  location.pathname === "/dashboard/students"
                    ? "bg-sky-500/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold border border-sky-400/30 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-foreground"
                )}
              >
                <Users className={cn(
                  "h-5 w-5 transition-transform",
                  location.pathname === "/dashboard/students" && "scale-110 text-sky-600 dark:text-sky-400"
                )} />
                <span className="text-[10px] font-medium truncate max-w-full">
                  {t("dashboard.menu.students")}
                </span>
                {location.pathname === "/dashboard/students" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_#0ea5e9]" />
                )}
              </Link>
            </>
          ) : (
            links.slice(0, 5).map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-2xl transition-all min-h-[50px] active:scale-95",
                    isActive
                      ? "bg-sky-500/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold border border-sky-400/30 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-foreground"
                  )}
                >
                  <link.icon className={cn(
                    "h-5 w-5 transition-transform",
                    isActive && "scale-110 text-sky-600 dark:text-sky-400"
                  )} />
                  <span className="text-[10px] font-medium truncate max-w-full">
                    {link.label}
                  </span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_#0ea5e9]" />
                  )}
                </Link>
              );
            })
          )}
        </div>
      </nav>

      {/* Mobile Profile Sheet */}
      <Sheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
        <SheetContent side="bottom" className="h-auto rounded-t-3xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Profile Menu</SheetTitle>
          </SheetHeader>
          
          {/* User Info Section */}
          <div className="relative bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 -mx-6 -mt-6 px-6 py-6 rounded-t-3xl mb-4 overflow-hidden">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-4 ring-white/20 shadow-lg">
                <AvatarFallback className="bg-sky-600/30 backdrop-blur-sm text-white text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white truncate">
                  {profile?.full_name || (isGuest ? "Guest Student" : "User")}
                </h3>
                <p className="text-xs text-sky-300 font-medium capitalize flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                  {isGuest ? "Guest Access" : role ? t(`common.${role}`) : ""}
                </p>
              </div>
              <button
                onClick={() => setProfileSheetOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                aria-label="Close Profile Menu"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
            <EthioAccentBar className="absolute bottom-0 left-0 right-0" size="sm" />
          </div>

          {/* Menu Items */}
          <div className="space-y-2 pb-4">
            {isGuest ? (
              <>
                <button
                  onClick={() => {
                    setShowGuestEditDialog(true);
                    setProfileSheetOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                  <span className="text-base font-medium">Edit Name & Department</span>
                </button>

                <button
                  onClick={() => {
                    navigate("/auth?role=admin");
                    setProfileSheetOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                    <Shield className="h-5 w-5" />
                  </div>
                  <span className="text-base font-medium">Staff / Admin Sign In</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  navigate("/settings");
                  setProfileSheetOpen(false);
                }}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Settings className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-base font-medium">{t("common.settings")}</span>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Guest setup/edit dialog */}
      <GuestSetupDialog
        open={showGuestEditDialog}
        onOpenChange={setShowGuestEditDialog}
        onCompleted={(p) => {
          updateGuestProfile({
            full_name: p.full_name,
            departmentId: p.departmentId,
            departmentName: p.departmentName,
          });
          setShowGuestEditDialog(false);
        }}
        allowCloseWithoutSave={true}
      />
    </div>
  );
}
