import React, { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useSectionPermissions } from "@/hooks/useSectionPermissions";
import { signOut } from "@/lib/auth";
import { clearGuestProfile } from "@/lib/guest-session";
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
  Home,
  ArrowLeft,
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
  Video,
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

export interface CategoryTheme {
  category: string;
  label: string;
  colorName: string;
  accentHex: string;
  sidebarGradient: string;
  headerGradient: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  activeIndicator: string;
  iconBgActive: string;
  iconBgInactive: string;
  iconColorActive: string;
  iconColorInactive: string;
  hoverBg: string;
  hoverText: string;
  badgeStyle: string;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  "/": {
    category: "home",
    label: "First Page",
    colorName: "sky",
    accentHex: "#0ea5e9",
    sidebarGradient: "bg-gradient-to-b from-[#0b2447] via-[#081b36] to-[#040d1c]",
    headerGradient: "from-sky-950 via-blue-950 to-slate-950",
    activeBg: "bg-sky-500/20 shadow-md shadow-sky-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-sky-400/40",
    activeIndicator: "bg-sky-400 shadow-[0_0_10px_#38bdf8]",
    iconBgActive: "bg-sky-500 text-white shadow-md shadow-sky-500/30",
    iconBgInactive: "bg-sky-500/15 text-sky-300 group-hover:bg-sky-500/25 group-hover:text-sky-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-sky-300",
    hoverBg: "hover:bg-sky-500/10",
    hoverText: "hover:text-sky-100",
    badgeStyle: "bg-sky-500/20 text-sky-300 border-sky-400/30",
  },
  "/dashboard": {
    category: "home",
    label: "Home",
    colorName: "sky",
    accentHex: "#0ea5e9",
    sidebarGradient: "bg-gradient-to-b from-[#0b2447] via-[#081b36] to-[#040d1c]",
    headerGradient: "from-sky-950 via-blue-950 to-slate-950",
    activeBg: "bg-sky-500/20 shadow-md shadow-sky-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-sky-400/40",
    activeIndicator: "bg-sky-400 shadow-[0_0_10px_#38bdf8]",
    iconBgActive: "bg-sky-500 text-white shadow-md shadow-sky-500/30",
    iconBgInactive: "bg-sky-500/15 text-sky-300 group-hover:bg-sky-500/25 group-hover:text-sky-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-sky-300",
    hoverBg: "hover:bg-sky-500/10",
    hoverText: "hover:text-sky-100",
    badgeStyle: "bg-sky-500/20 text-sky-300 border-sky-400/30",
  },
  "/dashboard/books": {
    category: "study",
    label: "Study",
    colorName: "emerald",
    accentHex: "#10b981",
    sidebarGradient: "bg-gradient-to-b from-[#063024] via-[#05241b] to-[#02130e]",
    headerGradient: "from-emerald-950 via-teal-950 to-slate-950",
    activeBg: "bg-emerald-500/20 shadow-md shadow-emerald-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-emerald-400/40",
    activeIndicator: "bg-emerald-400 shadow-[0_0_10px_#34d399]",
    iconBgActive: "bg-emerald-500 text-white shadow-md shadow-emerald-500/30",
    iconBgInactive: "bg-emerald-500/15 text-emerald-300 group-hover:bg-emerald-500/25 group-hover:text-emerald-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-emerald-300",
    hoverBg: "hover:bg-emerald-500/10",
    hoverText: "hover:text-emerald-100",
    badgeStyle: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  },
  "/dashboard/exams": {
    category: "exams",
    label: "Exams",
    colorName: "purple",
    accentHex: "#a855f7",
    sidebarGradient: "bg-gradient-to-b from-[#1e0f3d] via-[#160a2f] to-[#0a0317]",
    headerGradient: "from-purple-950 via-indigo-950 to-slate-950",
    activeBg: "bg-purple-500/20 shadow-md shadow-purple-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-purple-400/40",
    activeIndicator: "bg-purple-400 shadow-[0_0_10px_#c084fc]",
    iconBgActive: "bg-purple-500 text-white shadow-md shadow-purple-500/30",
    iconBgInactive: "bg-purple-500/15 text-purple-300 group-hover:bg-purple-500/25 group-hover:text-purple-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-purple-300",
    hoverBg: "hover:bg-purple-500/10",
    hoverText: "hover:text-purple-100",
    badgeStyle: "bg-purple-500/20 text-purple-300 border-purple-400/30",
  },
  "/dashboard/admin/exams": {
    category: "exams",
    label: "Manage Exams",
    colorName: "purple",
    accentHex: "#a855f7",
    sidebarGradient: "bg-gradient-to-b from-[#1e0f3d] via-[#160a2f] to-[#0a0317]",
    headerGradient: "from-purple-950 via-indigo-950 to-slate-950",
    activeBg: "bg-purple-500/20 shadow-md shadow-purple-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-purple-400/40",
    activeIndicator: "bg-purple-400 shadow-[0_0_10px_#c084fc]",
    iconBgActive: "bg-purple-500 text-white shadow-md shadow-purple-500/30",
    iconBgInactive: "bg-purple-500/15 text-purple-300 group-hover:bg-purple-500/25 group-hover:text-purple-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-purple-300",
    hoverBg: "hover:bg-purple-500/10",
    hoverText: "hover:text-purple-100",
    badgeStyle: "bg-purple-500/20 text-purple-300 border-purple-400/30",
  },
  "/dashboard/ai-assistant": {
    category: "ai",
    label: "AI Tutor",
    colorName: "fuchsia",
    accentHex: "#d946ef",
    sidebarGradient: "bg-gradient-to-b from-[#2d0933] via-[#210526] to-[#110114]",
    headerGradient: "from-fuchsia-950 via-pink-950 to-slate-950",
    activeBg: "bg-fuchsia-500/20 shadow-md shadow-fuchsia-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-fuchsia-400/40",
    activeIndicator: "bg-fuchsia-400 shadow-[0_0_10px_#f472b6]",
    iconBgActive: "bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/30",
    iconBgInactive: "bg-fuchsia-500/15 text-fuchsia-300 group-hover:bg-fuchsia-500/25 group-hover:text-fuchsia-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-fuchsia-300",
    hoverBg: "hover:bg-fuchsia-500/10",
    hoverText: "hover:text-fuchsia-100",
    badgeStyle: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30",
  },
  "/dashboard/video-tutorials": {
    category: "video",
    label: "Video Tutorials",
    colorName: "rose",
    accentHex: "#f43f5e",
    sidebarGradient: "bg-gradient-to-b from-[#2e0915] via-[#220610] to-[#120208]",
    headerGradient: "from-rose-950 via-pink-950 to-slate-950",
    activeBg: "bg-rose-500/20 shadow-md shadow-rose-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-rose-400/40",
    activeIndicator: "bg-rose-400 shadow-[0_0_10px_#fb7185]",
    iconBgActive: "bg-rose-500 text-white shadow-md shadow-rose-500/30",
    iconBgInactive: "bg-rose-500/15 text-rose-300 group-hover:bg-rose-500/25 group-hover:text-rose-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-rose-300",
    hoverBg: "hover:bg-rose-500/10",
    hoverText: "hover:text-rose-100",
    badgeStyle: "bg-rose-500/20 text-rose-300 border-rose-400/30",
  },
  "/dashboard/admin/ai-generator": {
    category: "ai",
    label: "AI Generator",
    colorName: "fuchsia",
    accentHex: "#d946ef",
    sidebarGradient: "bg-gradient-to-b from-[#2d0933] via-[#210526] to-[#110114]",
    headerGradient: "from-fuchsia-950 via-pink-950 to-slate-950",
    activeBg: "bg-fuchsia-500/20 shadow-md shadow-fuchsia-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-fuchsia-400/40",
    activeIndicator: "bg-fuchsia-400 shadow-[0_0_10px_#f472b6]",
    iconBgActive: "bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/30",
    iconBgInactive: "bg-fuchsia-500/15 text-fuchsia-300 group-hover:bg-fuchsia-500/25 group-hover:text-fuchsia-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-fuchsia-300",
    hoverBg: "hover:bg-fuchsia-500/10",
    hoverText: "hover:text-fuchsia-100",
    badgeStyle: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30",
  },
  "/dashboard/results": {
    category: "results",
    label: "Results",
    colorName: "amber",
    accentHex: "#f59e0b",
    sidebarGradient: "bg-gradient-to-b from-[#2e1903] via-[#221201] to-[#120900]",
    headerGradient: "from-amber-950 via-orange-950 to-slate-950",
    activeBg: "bg-amber-500/20 shadow-md shadow-amber-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-amber-400/40",
    activeIndicator: "bg-amber-400 shadow-[0_0_10px_#fbbf24]",
    iconBgActive: "bg-amber-500 text-white shadow-md shadow-amber-500/30",
    iconBgInactive: "bg-amber-500/15 text-amber-300 group-hover:bg-amber-500/25 group-hover:text-amber-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-amber-300",
    hoverBg: "hover:bg-amber-500/10",
    hoverText: "hover:text-amber-100",
    badgeStyle: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  },
  "/dashboard/all-results": {
    category: "results",
    label: "All Results",
    colorName: "amber",
    accentHex: "#f59e0b",
    sidebarGradient: "bg-gradient-to-b from-[#2e1903] via-[#221201] to-[#120900]",
    headerGradient: "from-amber-950 via-orange-950 to-slate-950",
    activeBg: "bg-amber-500/20 shadow-md shadow-amber-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-amber-400/40",
    activeIndicator: "bg-amber-400 shadow-[0_0_10px_#fbbf24]",
    iconBgActive: "bg-amber-500 text-white shadow-md shadow-amber-500/30",
    iconBgInactive: "bg-amber-500/15 text-amber-300 group-hover:bg-amber-500/25 group-hover:text-amber-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-amber-300",
    hoverBg: "hover:bg-amber-500/10",
    hoverText: "hover:text-amber-100",
    badgeStyle: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  },
  "/dashboard/leaderboard-admin": {
    category: "results",
    label: "Leaderboard",
    colorName: "amber",
    accentHex: "#f59e0b",
    sidebarGradient: "bg-gradient-to-b from-[#2e1903] via-[#221201] to-[#120900]",
    headerGradient: "from-amber-950 via-orange-950 to-slate-950",
    activeBg: "bg-amber-500/20 shadow-md shadow-amber-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-amber-400/40",
    activeIndicator: "bg-amber-400 shadow-[0_0_10px_#fbbf24]",
    iconBgActive: "bg-amber-500 text-white shadow-md shadow-amber-500/30",
    iconBgInactive: "bg-amber-500/15 text-amber-300 group-hover:bg-amber-500/25 group-hover:text-amber-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-amber-300",
    hoverBg: "hover:bg-amber-500/10",
    hoverText: "hover:text-amber-100",
    badgeStyle: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  },
  "/dashboard/messages": {
    category: "messages",
    label: "Messages",
    colorName: "cyan",
    accentHex: "#06b6d4",
    sidebarGradient: "bg-gradient-to-b from-[#062933] via-[#041d24] to-[#020e12]",
    headerGradient: "from-cyan-950 via-teal-950 to-slate-950",
    activeBg: "bg-cyan-500/20 shadow-md shadow-cyan-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-cyan-400/40",
    activeIndicator: "bg-cyan-400 shadow-[0_0_10px_#22d3ee]",
    iconBgActive: "bg-cyan-500 text-white shadow-md shadow-cyan-500/30",
    iconBgInactive: "bg-cyan-500/15 text-cyan-300 group-hover:bg-cyan-500/25 group-hover:text-cyan-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-cyan-300",
    hoverBg: "hover:bg-cyan-500/10",
    hoverText: "hover:text-cyan-100",
    badgeStyle: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
  },
  "/dashboard/feedback": {
    category: "messages",
    label: "Feedback",
    colorName: "cyan",
    accentHex: "#06b6d4",
    sidebarGradient: "bg-gradient-to-b from-[#062933] via-[#041d24] to-[#020e12]",
    headerGradient: "from-cyan-950 via-teal-950 to-slate-950",
    activeBg: "bg-cyan-500/20 shadow-md shadow-cyan-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-cyan-400/40",
    activeIndicator: "bg-cyan-400 shadow-[0_0_10px_#22d3ee]",
    iconBgActive: "bg-cyan-500 text-white shadow-md shadow-cyan-500/30",
    iconBgInactive: "bg-cyan-500/15 text-cyan-300 group-hover:bg-cyan-500/25 group-hover:text-cyan-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-cyan-300",
    hoverBg: "hover:bg-cyan-500/10",
    hoverText: "hover:text-cyan-100",
    badgeStyle: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
  },
  "/dashboard/admin/books": {
    category: "books",
    label: "Books",
    colorName: "emerald",
    accentHex: "#10b981",
    sidebarGradient: "bg-gradient-to-b from-[#063024] via-[#05241b] to-[#02130e]",
    headerGradient: "from-emerald-950 via-teal-950 to-slate-950",
    activeBg: "bg-emerald-500/20 shadow-md shadow-emerald-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-emerald-400/40",
    activeIndicator: "bg-emerald-400 shadow-[0_0_10px_#34d399]",
    iconBgActive: "bg-emerald-500 text-white shadow-md shadow-emerald-500/30",
    iconBgInactive: "bg-emerald-500/15 text-emerald-300 group-hover:bg-emerald-500/25 group-hover:text-emerald-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-emerald-300",
    hoverBg: "hover:bg-emerald-500/10",
    hoverText: "hover:text-emerald-100",
    badgeStyle: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  },
  "/dashboard/students": {
    category: "students",
    label: "Students",
    colorName: "blue",
    accentHex: "#3b82f6",
    sidebarGradient: "bg-gradient-to-b from-[#0b2447] via-[#081b36] to-[#040d1c]",
    headerGradient: "from-blue-950 via-sky-950 to-slate-950",
    activeBg: "bg-blue-500/20 shadow-md shadow-blue-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-blue-400/40",
    activeIndicator: "bg-blue-400 shadow-[0_0_10px_#60a5fa]",
    iconBgActive: "bg-blue-500 text-white shadow-md shadow-blue-500/30",
    iconBgInactive: "bg-blue-500/15 text-blue-300 group-hover:bg-blue-500/25 group-hover:text-blue-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-blue-300",
    hoverBg: "hover:bg-blue-500/10",
    hoverText: "hover:text-blue-100",
    badgeStyle: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  },
  "/dashboard/admin/subjects": {
    category: "subjects",
    label: "Subjects",
    colorName: "teal",
    accentHex: "#14b8a6",
    sidebarGradient: "bg-gradient-to-b from-[#052b27] via-[#041f1c] to-[#02100e]",
    headerGradient: "from-teal-950 via-emerald-950 to-slate-950",
    activeBg: "bg-teal-500/20 shadow-md shadow-teal-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-teal-400/40",
    activeIndicator: "bg-teal-400 shadow-[0_0_10px_#2dd4bf]",
    iconBgActive: "bg-teal-500 text-white shadow-md shadow-teal-500/30",
    iconBgInactive: "bg-teal-500/15 text-teal-300 group-hover:bg-teal-500/25 group-hover:text-teal-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-teal-300",
    hoverBg: "hover:bg-teal-500/10",
    hoverText: "hover:text-teal-100",
    badgeStyle: "bg-teal-500/20 text-teal-300 border-teal-400/30",
  },
  "/dashboard/departments": {
    category: "departments",
    label: "Departments",
    colorName: "indigo",
    accentHex: "#6366f1",
    sidebarGradient: "bg-gradient-to-b from-[#18123d] via-[#110c2c] to-[#070518]",
    headerGradient: "from-indigo-950 via-purple-950 to-slate-950",
    activeBg: "bg-indigo-500/20 shadow-md shadow-indigo-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-indigo-400/40",
    activeIndicator: "bg-indigo-400 shadow-[0_0_10px_#818cf8]",
    iconBgActive: "bg-indigo-500 text-white shadow-md shadow-indigo-500/30",
    iconBgInactive: "bg-indigo-500/15 text-indigo-300 group-hover:bg-indigo-500/25 group-hover:text-indigo-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-indigo-300",
    hoverBg: "hover:bg-indigo-500/10",
    hoverText: "hover:text-indigo-100",
    badgeStyle: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
  },
  "/settings": {
    category: "settings",
    label: "Settings",
    colorName: "slate",
    accentHex: "#94a3b8",
    sidebarGradient: "bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617]",
    headerGradient: "from-slate-900 via-slate-950 to-black",
    activeBg: "bg-slate-500/25 shadow-md shadow-slate-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-slate-400/40",
    activeIndicator: "bg-slate-300 shadow-[0_0_10px_#cbd5e1]",
    iconBgActive: "bg-slate-600 text-white shadow-md shadow-slate-600/30",
    iconBgInactive: "bg-slate-500/20 text-slate-300 group-hover:bg-slate-500/30 group-hover:text-slate-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-slate-300",
    hoverBg: "hover:bg-slate-500/10",
    hoverText: "hover:text-slate-100",
    badgeStyle: "bg-slate-500/20 text-slate-300 border-slate-400/30",
  },
  "/dashboard/super-admin": {
    category: "super-admin",
    label: "Super Admin",
    colorName: "rose",
    accentHex: "#f43f5e",
    sidebarGradient: "bg-gradient-to-b from-[#330814] via-[#24040c] to-[#120105]",
    headerGradient: "from-rose-950 via-red-950 to-slate-950",
    activeBg: "bg-rose-500/20 shadow-md shadow-rose-500/15",
    activeText: "text-white font-bold",
    activeBorder: "border-rose-400/40",
    activeIndicator: "bg-rose-400 shadow-[0_0_10px_#fb7185]",
    iconBgActive: "bg-rose-500 text-white shadow-md shadow-rose-500/30",
    iconBgInactive: "bg-rose-500/15 text-rose-300 group-hover:bg-rose-500/25 group-hover:text-rose-200",
    iconColorActive: "text-white",
    iconColorInactive: "text-rose-300",
    hoverBg: "hover:bg-rose-500/10",
    hoverText: "hover:text-rose-100",
    badgeStyle: "bg-rose-500/20 text-rose-300 border-rose-400/30",
  },
};

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
    try {
      clearGuestProfile();
    } catch {}
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

  const studentLinks = React.useMemo(() => {
    if (isGuest) {
      return [
        { href: "/dashboard/exams", label: "Exams", icon: ClipboardList },
        { href: "/dashboard/books", label: "Study", icon: BookOpen },
        { href: "/dashboard/video-tutorials", label: "Videos", icon: Video, badge: "Soon" },
        { href: "/dashboard/ai-assistant", label: "AI Tutor", icon: Brain, badge: "Soon" },
        { href: "/dashboard/results", label: t("dashboard.menu.myResults", "Results"), icon: Trophy },
        { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
      ];
    }
    return [
      { href: "/dashboard", label: t("dashboard.menu.dashboard", "Home"), icon: LayoutDashboard },
      { href: "/dashboard/books", label: "Study", icon: BookOpen },
      { href: "/dashboard/exams", label: "Exams", icon: ClipboardList },
      { href: "/dashboard/video-tutorials", label: "Video Tutorials", icon: Video, badge: "Soon" },
      { href: "/dashboard/ai-assistant", label: "AI Tutor", icon: Brain, badge: "Soon" },
      { href: "/dashboard/results", label: t("dashboard.menu.myResults", "Results"), icon: Trophy },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    ];
  }, [t, isGuest]);

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

  const currentPath = location.pathname;
  const activeCategoryTheme = React.useMemo(() => {
    if (CATEGORY_THEMES[currentPath]) return CATEGORY_THEMES[currentPath];
    const match = Object.entries(CATEGORY_THEMES).find(
      ([prefix]) => prefix !== "/dashboard" && prefix !== "/" && currentPath.startsWith(prefix)
    );
    return match ? match[1] : CATEGORY_THEMES["/dashboard"];
  }, [currentPath]);

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
        <div className="h-full px-6 flex items-center justify-between">
          <div>
            {isGuest && (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="liquid-glass-button-secondary rounded-full h-9 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 text-sky-700 dark:text-sky-300 border border-sky-400/40 bg-sky-500/10 hover:bg-sky-500/20 active:scale-95 transition-all shadow-xs"
                title="Back to First Page"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span>Back to First Page</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="[&_button]:liquid-glass-squircle [&_button]:rounded-2xl">
              <LanguageToggle />
            </div>
            <div className="[&_button]:liquid-glass-squircle [&_button]:rounded-2xl">
              <ThemeToggle />
            </div>
            {isGuest && (
              <button
                type="button"
                onClick={handleSignOut}
                className="liquid-glass-button-secondary rounded-full h-9 px-3.5 text-xs font-bold flex items-center gap-1.5 text-red-600 dark:text-red-400 border border-red-400/30 bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all shadow-xs"
                title="Exit guest mode and return to first page"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t("common.signOut", "Sign Out")}</span>
              </button>
            )}
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
          <Link to={role === "admin" ? "/dashboard" : "/dashboard/exams"} className="flex items-center">
            <EthioSmartLogo variant="compact" size="xs" textColor="auto" />
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isGuest && (
            <button
              type="button"
              onClick={() => navigate("/")}
              className="liquid-glass-button-secondary rounded-full h-8 px-2.5 text-[11px] sm:text-xs font-bold flex items-center gap-1 text-sky-700 dark:text-sky-300 border border-sky-400/40 bg-sky-500/10 hover:bg-sky-500/20 active:scale-95 transition-all shadow-xs"
              title="Back to First Page"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              <span>First Page</span>
            </button>
          )}

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
            <DropdownMenuContent align="end" className="w-52 rounded-2xl shadow-xl liquid-glass-card">
              <div className="px-3 py-2 text-xs border-b border-border/50">
                <p className="font-semibold text-foreground truncate">{profile?.full_name || (isGuest ? "Guest Student" : "User")}</p>
                <p className="text-[10px] text-muted-foreground">{isGuest ? "Guest Access" : role ? t(`common.${role}`) : ""}</p>
              </div>
              {isGuest && (
                <>
                  <DropdownMenuItem onClick={() => navigate("/")} className="font-semibold text-sky-600 dark:text-sky-400">
                    <Home className="mr-2 h-4 w-4" />
                    First Page
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {!isGuest && (
                <>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    {t("common.settings")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive font-semibold">
                <LogOut className="mr-2 h-4 w-4" />
                {t("common.signOut", "Sign Out")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar - The Left Bar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-64 shadow-2xl transform transition-all duration-500 ease-out lg:translate-x-0 border-r border-white/10",
          activeCategoryTheme.sidebarGradient,
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full relative overflow-hidden">
          {/* Subtle Ambient Radial Glow of the Active Category */}
          <div 
            className="absolute top-0 left-0 right-0 h-80 opacity-40 pointer-events-none transition-all duration-700 blur-3xl"
            style={{
              background: `radial-gradient(circle at 50% 15%, ${activeCategoryTheme.accentHex}, transparent 70%)`
            }}
          />

          {/* Logo */}
          <Link
            to={role === "admin" ? "/dashboard" : "/dashboard/exams"}
            className="relative h-20 flex flex-col justify-center px-5 border-b border-white/10 bg-black/30 backdrop-blur-md hover:opacity-95 transition-all shrink-0"
          >
            <EthioSmartLogo variant="compact" size="sm" textColor="light" />
            <div className="flex items-center justify-between mt-1 pl-12 pr-1">
              <span className={cn(
                "text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border transition-all duration-300 shadow-xs",
                activeCategoryTheme.badgeStyle
              )}>
                {activeCategoryTheme.label}
              </span>
              <span className="text-[9px] font-medium text-slate-300">
                EthioSmart
              </span>
            </div>
            <EthioAccentBar className="absolute bottom-0 left-0 right-0" size="sm" />
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto relative z-10">
            {links.map((link) => {
              const isActive = location.pathname === link.href || (link.href !== "/dashboard" && location.pathname.startsWith(link.href));
              const theme = CATEGORY_THEMES[link.href] || CATEGORY_THEMES["/dashboard"];

              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-300 font-medium",
                    isActive
                      ? cn("backdrop-blur-md border", theme.activeBg, theme.activeText, theme.activeBorder)
                      : cn("text-white/80 hover:text-white", theme.hoverBg, theme.hoverText)
                  )}
                >
                  {/* Left Bar Glowing Indicator */}
                  {isActive && (
                    <div className={cn("absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full transition-all duration-300", theme.activeIndicator)} />
                  )}

                  {/* Category-Colored Icon Container */}
                  <div className={cn(
                    "p-2 rounded-xl transition-all duration-300 shrink-0",
                    isActive ? theme.iconBgActive : theme.iconBgInactive,
                    isActive ? "ml-1" : ""
                  )}>
                    <link.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive ? theme.iconColorActive : theme.iconColorInactive)} />
                  </div>

                  {/* Category Label */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className={cn("text-xs sm:text-sm tracking-wide truncate", isActive ? "font-bold text-white" : "font-medium")}>
                      {link.label}
                    </span>
                    {(link as any).badge && (
                      <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-white/20 text-white tracking-wider uppercase shrink-0">
                        {(link as any).badge}
                      </span>
                    )}
                  </div>

                  {/* Right Glowing Pill for Active Category */}
                  {isActive && (
                    <div className={cn("ml-auto w-2 h-2 rounded-full animate-pulse", theme.activeIndicator)} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-white/10 bg-black/35 backdrop-blur-md relative z-10 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 transition-all border border-transparent hover:border-white/15">
                  <Avatar className="h-9 w-9 ring-2 ring-white/20 shadow-sm shrink-0">
                    <AvatarFallback className={cn("backdrop-blur-sm text-white text-xs font-bold transition-colors", activeCategoryTheme.iconBgActive)}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {profile?.full_name || (isGuest ? "Guest Student" : "User")}
                    </p>
                    <p className="text-[11px] text-white/70 capitalize truncate">
                      {isGuest ? "Guest Access" : role ? t(`common.${role}`) : ""}
                    </p>
                  </div>
                  <Settings className="h-4 w-4 text-white/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {isGuest ? (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/")} className="font-semibold text-sky-600 dark:text-sky-400">
                      <Home className="mr-2 h-4 w-4" />
                      First Page
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive font-semibold">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t("common.signOut", "Sign Out")}
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
        <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
          {role === "admin" ? (
            <>
              {links.slice(0, 3).map((link) => {
                const isActive = location.pathname === link.href || (link.href !== "/dashboard" && location.pathname.startsWith(link.href));
                const theme = CATEGORY_THEMES[link.href] || CATEGORY_THEMES["/dashboard"];
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all min-h-[50px] active:scale-95",
                      isActive
                        ? cn("backdrop-blur-md shadow-xs font-bold border", theme.activeBg, theme.activeText, theme.activeBorder)
                        : "text-slate-600 dark:text-slate-400 hover:text-foreground"
                    )}
                  >
                    <link.icon className={cn(
                      "h-5 w-5 transition-transform",
                      isActive ? cn("scale-110", theme.iconColorInactive) : "text-slate-500"
                    )} />
                    <span className="text-[10px] font-medium truncate max-w-full">
                      {link.label}
                    </span>
                    {isActive && (
                      <div className={cn("w-1.5 h-1.5 rounded-full", theme.activeIndicator)} />
                    )}
                  </Link>
                );
              })}
              
              <Link
                to="/dashboard/students"
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-2xl transition-all min-h-[50px] active:scale-95",
                  location.pathname === "/dashboard/students"
                    ? "bg-blue-500/20 text-blue-300 font-bold border border-blue-400/40 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-foreground"
                )}
              >
                <Users className={cn(
                  "h-5 w-5 transition-transform",
                  location.pathname === "/dashboard/students" && "scale-110 text-blue-400"
                )} />
                <span className="text-[10px] font-medium truncate max-w-full">
                  {t("dashboard.menu.students")}
                </span>
                {location.pathname === "/dashboard/students" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
                )}
              </Link>
            </>
          ) : (
            [
              {
                href: "/dashboard",
                label: "Dashboard",
                icon: LayoutDashboard,
                activeBg: "bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/35 border-sky-300/40",
                inactiveBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
                activeText: "text-sky-600 dark:text-sky-400 font-bold",
                inactiveText: "text-slate-600 dark:text-slate-400 font-semibold",
                dot: "bg-sky-500 shadow-[0_0_8px_#38bdf8]",
              },
              {
                href: "/dashboard/books",
                label: "Study",
                icon: BookOpen,
                activeBg: "bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/35 border-emerald-300/40",
                inactiveBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                activeText: "text-emerald-600 dark:text-emerald-400 font-bold",
                inactiveText: "text-slate-600 dark:text-slate-400 font-semibold",
                dot: "bg-emerald-500 shadow-[0_0_8px_#34d399]",
              },
              {
                href: "/dashboard/exams",
                label: "Exam",
                icon: ClipboardList,
                activeBg: "bg-gradient-to-tr from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/35 border-purple-300/40",
                inactiveBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
                activeText: "text-purple-600 dark:text-purple-400 font-bold",
                inactiveText: "text-slate-600 dark:text-slate-400 font-semibold",
                dot: "bg-purple-500 shadow-[0_0_8px_#a855f7]",
              },
              {
                href: "/dashboard/messages",
                label: "Message",
                icon: MessageSquare,
                activeBg: "bg-gradient-to-tr from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/35 border-cyan-300/40",
                inactiveBg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
                activeText: "text-cyan-600 dark:text-cyan-400 font-bold",
                inactiveText: "text-slate-600 dark:text-slate-400 font-semibold",
                dot: "bg-cyan-500 shadow-[0_0_8px_#22d3ee]",
              },
            ].map((item) => {
              const isActive = location.pathname === item.href || (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "group relative flex flex-col items-center justify-center py-1 px-0.5 rounded-2xl transition-all duration-300 min-h-[54px] active:scale-95",
                    isActive ? "bg-white/50 dark:bg-slate-800/50 shadow-xs backdrop-blur-md" : "hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  <div
                    className={cn(
                      "w-11 h-7.5 rounded-xl flex items-center justify-center transition-all duration-300 border",
                      isActive
                        ? cn(item.activeBg, "scale-105")
                        : item.inactiveBg
                    )}
                  >
                    <item.icon className="h-5 w-5 transition-transform" />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] sm:text-[11px] mt-0.5 tracking-tight transition-colors truncate max-w-full",
                      isActive ? item.activeText : item.inactiveText
                    )}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5", item.dot)} />
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
          <div className={cn("relative -mx-6 -mt-6 px-6 py-6 rounded-t-3xl mb-4 overflow-hidden", activeCategoryTheme.sidebarGradient)}>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-4 ring-white/20 shadow-lg">
                <AvatarFallback className={cn("backdrop-blur-sm text-white text-xl font-bold", activeCategoryTheme.iconBgActive)}>
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
                    setProfileSheetOpen(false);
                    navigate("/");
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-sky-50 dark:hover:bg-sky-950/30 text-sky-600 dark:text-sky-400 border border-sky-200/50 dark:border-sky-900/40 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Home className="h-5 w-5" />
                  </div>
                  <span className="text-base font-semibold">First Page</span>
                </button>

                <button
                  onClick={() => {
                    setProfileSheetOpen(false);
                    handleSignOut();
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/40 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <span className="text-base font-semibold">{t("common.signOut", "Sign Out")}</span>
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
