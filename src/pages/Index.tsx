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
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
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

  // PWA Install States - Visible before installed, hidden immediately once installed
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      document.referrer.startsWith("android-app://");
    const storedInstalled = localStorage.getItem("pwa_installed") === "true";
    return Boolean(standaloneMode || storedInstalled);
  });
  const [isIOS, setIsIOS] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      // Only auto-redirect signed-in staff/admin to admin dashboard
      if (user && !isGuest && role === "admin") {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, role, isGuest, loading, navigate]);

  useEffect(() => {
    const checkStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      document.referrer.startsWith("android-app://");

    if (checkStandalone() || localStorage.getItem("pwa_installed") === "true") {
      setIsInstalled(true);
    }

    // Check modern browser installed apps API
    if ("getInstalledRelatedApps" in navigator) {
      (navigator as any).getInstalledRelatedApps().then((apps: any[]) => {
        if (apps && apps.length > 0) {
          setIsInstalled(true);
          localStorage.setItem("pwa_installed", "true");
        }
      }).catch(() => {});
    }

    // Check if iOS device
    const iOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(Boolean(iOSDevice));

    // Listen to standalone display mode change
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem("pwa_installed", "true");
      }
    };
    mediaQuery.addEventListener?.("change", handleDisplayChange);

    // Capture PWA install prompt
    const beforeInstallHandler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // If already installed on this device (standalone or in localStorage), keep it hidden
      const alreadyInstalled = checkStandalone() || localStorage.getItem("pwa_installed") === "true";
      if (!alreadyInstalled) {
        setIsInstalled(false);
      }
    };

    // Listen for device app installation event (fires immediately when user installs)
    const appInstalledHandler = () => {
      setIsInstalled(true);
      localStorage.setItem("pwa_installed", "true");
      setDeferredPrompt(null);
      setInstallModalOpen(false);
      toast({
        title: "EthioSmart Installed!",
        description: "The application is now installed on your device and ready to use offline.",
      });
    };

    window.addEventListener("beforeinstallprompt", beforeInstallHandler);
    window.addEventListener("appinstalled", appInstalledHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstallHandler);
      window.removeEventListener("appinstalled", appInstalledHandler);
      mediaQuery.removeEventListener?.("change", handleDisplayChange);
    };
  }, [toast]);

  // Handle Install Action across both Desktop and Mobile devices
  const handleInstallClick = async () => {
    if (isInstalled) {
      toast({
        title: "App Already Installed",
        description: "EthioSmart is already installed on this device.",
      });
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === "accepted") {
          setIsInstalled(true);
          localStorage.setItem("pwa_installed", "true");
          setInstallModalOpen(false);
          toast({
            title: "Installation Started",
            description: "EthioSmart is being installed on your device.",
          });
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("PWA prompt trigger notice:", err);
        setInstallModalOpen(true);
      }
    } else {
      // If native prompt is not directly available (e.g. iOS Safari, or desktop Chrome after dismissed), open helpful modal
      setInstallModalOpen(true);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-background font-sans selection:bg-sky-500/20 overflow-hidden flex flex-col justify-between">
      {/* Dynamic Liquid Glass Canvas with Interactive Cursor Spotlight & Ripples */}
      <LiquidBackdrop showDroplets={true} showSplash={true} showRipples={true} interactive={true} variant="hero" />

      {/* 1. Sleek Navigation Bar with Prominent Brand Logo */}
      <header className="relative z-20 px-3 sm:px-8 py-2 sm:py-3.5 flex items-center justify-between shrink-0">
        {/* Logo - Increased size */}
        <div
          className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
          onClick={() => navigate("/")}
        >
          <EthioSmartLogo variant="full" size="lg" textColor="auto" showTagline={true} />
        </div>

        {/* Navigation Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Install Button in Top Nav - Only place on screen, visible until installed */}
          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="liquid-glass-button-secondary rounded-full h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-md bg-gradient-to-r from-sky-500/15 via-blue-500/10 to-cyan-500/15 border border-sky-400/40 text-sky-700 dark:text-sky-300 hover:border-sky-500"
              title="Install EthioSmart on your device"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 dark:text-sky-400" />
              <span className="inline font-bold">Install App</span>
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
          ) : requireStudentLogin ? (
            <button
              type="button"
              className="liquid-glass-button-secondary rounded-full h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95"
              onClick={() => navigate("/auth")}
            >
              {t("common.signIn")}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                className="liquid-glass-button rounded-full h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-bold shadow-sm flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:opacity-95 text-white active:scale-95 transition-transform"
                onClick={async () => {
                  try {
                    if (continueAsGuest) await continueAsGuest();
                    navigate("/dashboard/exams");
                  } catch {
                    navigate("/dashboard/exams");
                  }
                }}
                title="Explore curriculum as a guest"
              >
                <Sparkles className="h-3 w-3 text-amber-300 shrink-0" />
                <span>Continue as Guest</span>
              </button>
              <button
                type="button"
                className="liquid-glass-button-secondary rounded-full h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95"
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

          {/* Responsive Action Buttons */}
          <div className="flex flex-row items-center justify-center gap-2 sm:gap-3 max-w-sm mx-auto w-full shrink-0">
            {/* Primary Start Learning Button */}
            <button
              type="button"
              className="liquid-glass-button h-11 sm:h-12 px-6 sm:px-8 text-xs sm:text-sm font-bold rounded-full flex items-center justify-center gap-2 shadow-md flex-1"
              onClick={async () => {
                if (requireStudentLogin) {
                  navigate("/auth");
                } else {
                  try {
                    if (continueAsGuest) await continueAsGuest();
                  } catch {}
                  navigate("/dashboard/exams");
                }
              }}
            >
              <span>{requireStudentLogin ? t("common.getStarted") : "Continue as Guest"}</span>
              <ArrowRight className="h-4 w-4 text-white" />
            </button>

            {/* Learn More */}
            <button
              type="button"
              className="liquid-glass-button-secondary h-11 sm:h-12 px-5 sm:px-6 text-xs sm:text-sm font-semibold rounded-full items-center justify-center text-slate-700 dark:text-slate-200"
              onClick={() => navigate("/about")}
            >
              {t("common.learnMore")}
            </button>
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
      <Dialog open={installModalOpen} onOpenChange={setInstallModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7">
          <DialogHeader className="space-y-2 text-center sm:text-left">
            <div className="h-12 w-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto sm:mx-0">
              {isIOS ? <Smartphone className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
            </div>
            <DialogTitle className="text-xl font-bold font-display">
              {isInstalled ? "EthioSmart is Installed" : isIOS ? "Install EthioSmart on iPhone / iPad" : "Install EthioSmart on Your Device"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              {isInstalled
                ? "You already have EthioSmart installed as an application. You can launch it directly from your home screen or apps menu."
                : "Install EthioSmart for fast 1-click access, full-screen reading, and 100% offline study capability."}
            </DialogDescription>
          </DialogHeader>

          {isInstalled ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
              <p className="text-xs font-semibold">
                EthioSmart is installed and ready to use offline!
              </p>
            </div>
          ) : isIOS ? (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-muted/50 border space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <span>
                    Tap the <b>Share</b> button in Safari&apos;s bottom toolbar (<Share className="h-3.5 w-3.5 inline mx-1 text-sky-600" />).
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <span>
                    Scroll down and tap <b>&ldquo;Add to Home Screen&rdquo;</b>.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <span>
                    Tap <b>Add</b> in the top right to complete installation.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-muted/50 border space-y-2 text-xs sm:text-sm">
                <p className="font-semibold text-foreground">
                  To install in Chrome, Edge, or Android:
                </p>
                <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
                  <li>Click the <b>Install icon</b> (<Download className="h-3.5 w-3.5 inline mx-0.5 text-sky-600" />) in your browser&apos;s address bar.</li>
                  <li>Or open the browser menu (<b>⋮</b>) and select <b>&ldquo;Install EthioSmart&rdquo;</b> or <b>&ldquo;Add to Home screen&rdquo;</b>.</li>
                </ul>
              </div>

              {deferredPrompt && (
                <Button
                  onClick={async () => {
                    try {
                      deferredPrompt.prompt();
                      const choice = await deferredPrompt.userChoice;
                      if (choice && choice.outcome === "accepted") {
                        setIsInstalled(true);
                        localStorage.setItem("pwa_installed", "true");
                      }
                      setDeferredPrompt(null);
                      setInstallModalOpen(false);
                    } catch {}
                  }}
                  className="w-full rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Install Now
                </Button>
              )}
            </div>
          )}

          {!isInstalled && (
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsInstalled(true);
                  localStorage.setItem("pwa_installed", "true");
                  setDeferredPrompt(null);
                  setInstallModalOpen(false);
                  toast({
                    title: "Status Updated",
                    description: "EthioSmart is marked as installed on this device.",
                  });
                }}
                className="w-full rounded-xl text-xs font-semibold border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-500" />
                I Have Installed It on This Device
              </Button>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInstallModalOpen(false)}
              className="rounded-xl text-xs text-muted-foreground"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
