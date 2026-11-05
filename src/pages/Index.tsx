import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  ArrowRight,
  CheckCircle,
  Zap,
  Shield,
  TrendingUp,
  Users,
  Award,
  Download,
  Smartphone,
  Monitor,
  Share,
  CheckCircle2,
  Sparkles,
  Layers,
  BookOpen,
  Brain,
  ClipboardList,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { PwaInstallDialog } from "@/components/ui/pwa-install-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EthioSmartLogo } from "@/components/ui/EthioSmartLogo";
import { EthioAccentBar } from "@/components/ui/EthioAccentBar";
import { LiquidBackdrop } from "@/components/ui/LiquidBackdrop";
import { LiquidTiltCard } from "@/components/ui/LiquidTiltCard";

const Index = () => {
  const navigate = useNavigate();
  const { user, role, loading, isGuest, requireStudentLogin, continueAsGuest } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();

  const {
    isStandalone,
    canInstall,
    isIOS,
    deferredPrompt,
    promptInstall,
    installModalOpen,
    setInstallModalOpen,
    isDismissed,
    dismissInstall,
  } = usePWAInstall();

  useEffect(() => {
    if (!loading) {
      // Auto-redirect ONLY signed-in admin/staff users to their dashboard
      // Guest students and regular visitors MUST see the first page by default
      if (user && !isGuest && role === "admin") {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, role, isGuest, loading, navigate]);

  return (
    <div className="min-h-screen sm:h-[100dvh] sm:max-h-[100dvh] bg-background font-sans selection:bg-sky-500/20 overflow-x-hidden sm:overflow-hidden flex flex-col justify-between">
      {/* Dynamic Liquid Glass Canvas with Interactive Cursor Spotlight & Ripples */}
      <LiquidBackdrop showDroplets={true} showSplash={true} showRipples={true} interactive={true} variant="hero" />

      {/* TOP INSTALL BANNER - Prominently placed at the very top of the first page */}
      {!isStandalone && !isDismissed && (
        <div className="relative z-30 w-full bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 text-white px-3 sm:px-6 py-2 shadow-md flex items-center justify-between text-xs sm:text-sm font-medium shrink-0 animate-fade-in border-b border-white/20">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <div className="flex items-center gap-1.5 truncate">
              <Smartphone className="h-4 w-4 shrink-0 text-sky-200" />
              <span className="font-extrabold truncate text-xs sm:text-sm tracking-wide">Install EthioSmart App</span>
              <span className="hidden md:inline opacity-90 text-xs font-normal">• Offline textbooks, notes & exams</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              type="button"
              onClick={promptInstall}
              className="h-7 sm:h-8 px-3.5 sm:px-4 rounded-full bg-white text-blue-700 hover:bg-sky-50 font-extrabold text-xs shadow-sm flex items-center gap-1.5 transition-transform active:scale-95 hover:scale-105 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install as App</span>
            </button>
            <button
              type="button"
              onClick={dismissInstall}
              aria-label="Dismiss install prompt"
              className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Sleek Navigation Bar with Prominent Brand Logo */}
      <header className="relative z-20 px-3 sm:px-8 py-2 sm:py-3 flex items-center justify-between shrink-0">
        {/* Logo - Increased size */}
        <div
          className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
          onClick={() => navigate("/")}
        >
          <EthioSmartLogo variant="full" size="lg" textColor="auto" showTagline={true} />
        </div>

        {/* Navigation Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Prominent Install Button in Top Nav */}
          {!isStandalone && (
            <button
              type="button"
              onClick={promptInstall}
              className="rounded-full h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-md bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white hover:opacity-95 shrink-0 border border-white/20"
              title="Install EthioSmart as an app on your device"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
              <span>Install App</span>
            </button>
          )}

          <div className="[&_button]:liquid-glass-squircle [&_button]:rounded-xl [&_button]:h-8 [&_button]:w-8">
            <LanguageToggle />
          </div>

          <div className="[&_button]:liquid-glass-squircle [&_button]:rounded-xl [&_button]:h-8 [&_button]:w-8">
            <ThemeToggle />
          </div>

          {user && !isGuest ? (
            <button
              type="button"
              className="liquid-glass-button rounded-full h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
              onClick={() => navigate(role === "admin" ? "/dashboard" : "/dashboard/exams")}
            >
              Dashboard
            </button>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                className="liquid-glass-button-secondary rounded-full h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                onClick={() => navigate("/auth")}
                title="Sign in to your account"
              >
                {t("common.signIn")}
              </button>
              <button
                type="button"
                className="hidden md:inline-flex text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs px-1.5"
                onClick={() => navigate("/admin/login")}
                title="Staff sign in"
              >
                Admin
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Hero Center Card - Full Height on Screen, Reduced Width, Increased Logo */}
      <div className="flex-1 flex items-center justify-center px-3 sm:px-6 py-2 sm:py-3 relative z-10 min-h-0">
        <LiquidTiltCard
          maxTilt={3}
          glareOpacity={0.15}
          className="w-[88%] xs:w-[86%] max-w-[340px] xs:max-w-[365px] sm:max-w-xl md:max-w-2xl h-full max-h-[calc(100dvh-5.5rem)] mx-auto text-center flex flex-col justify-between py-5 sm:py-7 px-4 sm:px-8 liquid-glass-card rounded-[32px] sm:rounded-[40px] shadow-2xl relative overflow-hidden"
        >
          {/* Primary Visual Logo Showcase - Increased Logo Size */}
          <div className="flex justify-center shrink-0">
            <div className="relative group">
              {/* Luminous blue/cyan aura behind the primary logo */}
              <div className="absolute -inset-3 bg-gradient-to-r from-blue-500/30 via-sky-400/25 to-cyan-400/30 rounded-[34px] blur-xl opacity-85 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative liquid-glass-squircle w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-[28px] sm:rounded-[32px] p-2.5 sm:p-3 flex items-center justify-center shadow-2xl shadow-blue-500/20 group-hover:scale-105 transition-all duration-300">
                <img
                  src="/EthioSmart.png"
                  alt="EthioSmart"
                  className="w-full h-full object-contain drop-shadow-md rounded-2xl"
                  loading="eager"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== "/EthioSmart-512.png") target.src = "/EthioSmart-512.png";
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tagline Badge */}
          <div className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-blue-800 shadow-xs cursor-default mx-auto shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span>
              {t("hero.badge", "EthioSmart • Learn • Practice • Grow")}
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white shrink-0">
            <span>{t("hero.titlePre")}</span>{" "}
            <span className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 dark:from-sky-400 dark:via-cyan-300 dark:to-blue-400 bg-clip-text text-transparent">
              {t("hero.titleHighlight")}
            </span>
          </h1>

          {/* High-Contrast Description */}
          <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-md mx-auto font-medium leading-relaxed shrink-0">
            {t("hero.description")}
          </p>

          {/* Responsive Action Buttons (Touch-Optimized for Mobile) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 max-w-sm mx-auto w-full shrink-0">
            {/* Primary Get Started Button */}
            <button
              type="button"
              className="liquid-glass-button h-11 sm:h-12 px-6 sm:px-8 text-xs sm:text-sm font-bold rounded-full flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/25 active:scale-95 transition-all w-full sm:w-auto sm:flex-1"
              onClick={() => navigate("/auth")}
            >
              <span>{t("common.getStarted", "Get Started Now")}</span>
              <ArrowRight className="h-4 w-4 text-white shrink-0" />
            </button>

            {/* Continue as Guest Button */}
            {!requireStudentLogin && (
              <button
                type="button"
                className="liquid-glass-button-secondary h-11 sm:h-12 px-5 sm:px-6 text-xs sm:text-sm font-bold rounded-full flex items-center justify-center gap-2 text-sky-700 dark:text-sky-300 hover:text-sky-800 dark:hover:text-white border border-sky-400/40 dark:border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 active:scale-95 transition-all w-full sm:w-auto sm:flex-1 shadow-sm"
                onClick={async () => {
                  try {
                    if (continueAsGuest) await continueAsGuest();
                  } catch {}
                  navigate("/dashboard/exams");
                }}
              >
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                <span>{t("auth.signInAsGuest", "Sign in as Guest")}</span>
              </button>
            )}
          </div>

          {/* Trust Indicators in Frosted Glass Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Works 100% Offline</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Curriculum Aligned</span>
            </div>
          </div>
        </LiquidTiltCard>
      </div>

      {/* Bottom Accent Bar */}
      <EthioAccentBar className="relative z-20 shrink-0" size="xs" />

      {/* Cross-Device PWA Installation Instructions Modal */}
      <PwaInstallDialog
        open={installModalOpen}
        onOpenChange={setInstallModalOpen}
        isIOS={isIOS}
        isStandalone={isStandalone}
        deferredPrompt={deferredPrompt}
        onInstallClick={promptInstall}
      />
    </div>
  );
};

export default Index;
