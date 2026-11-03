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
  const { user, role, loading, isGuest, requireStudentLogin } = useAuth();
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

  const features = [
    {
      icon: BookOpen,
      title: "Digital Curriculum Library",
      description: "Complete textbooks and high-yield chapter notes accessible online and 100% offline.",
      gradient: "from-blue-600 to-indigo-700",
    },
    {
      icon: Brain,
      title: "AI Study Assistant",
      description: "Smart 24/7 AI tutor to explain complex topics, answer doubts, and generate practice questions.",
      gradient: "from-purple-600 to-pink-600",
    },
    {
      icon: ClipboardList,
      title: "Practice & Examination",
      description: "Timed examinations, practice mode with instant explanations, and verified questions.",
      gradient: "from-emerald-500 to-teal-700",
    },
    {
      icon: TrendingUp,
      title: "Academic Growth",
      description: "Detailed progress tracking, subject mastery, and department leaderboards.",
      gradient: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-sky-500/20 overflow-x-hidden">
      {/* Hero Section - Strictly Constrained to 100dvh Viewport (Zero Overflow) */}
      <section className="relative h-[100dvh] max-h-[100dvh] flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] dark:from-[#070c18] dark:via-[#0c162d] dark:to-[#050811] transition-colors duration-500">
        {/* Dynamic Liquid Glass Canvas with Interactive Cursor Spotlight & Ripples */}
        <LiquidBackdrop showDroplets={true} showSplash={true} showRipples={true} interactive={true} variant="hero" />

        {/* 1. Sleek Navigation Bar */}
        <header className="relative z-20 px-4 py-2.5 sm:px-8 sm:py-3.5 flex items-center justify-between shrink-0">
          {/* Logo */}
          <div
            className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
            onClick={() => navigate("/")}
          >
            <EthioSmartLogo variant="compact" size="sm" textColor="auto" />
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

            {requireStudentLogin ? (
              <button
                type="button"
                className="hidden sm:inline-flex liquid-glass-button-secondary rounded-full h-9 px-4 text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                onClick={() => navigate("/auth")}
              >
                {t("common.signIn")}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="hidden sm:inline-flex liquid-glass-button rounded-full h-9 px-4 text-xs sm:text-sm font-semibold shadow-sm"
                  onClick={() => navigate("/dashboard/exams")}
                >
                  Enter App
                </button>
                <button
                  type="button"
                  className="hidden sm:inline-flex text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs px-2"
                  onClick={() => navigate("/admin/login")}
                  title="Staff sign in"
                >
                  Admin
                </button>
              </div>
            )}
          </div>
        </header>

        {/* 2. Hero Center Card - Perfectly Proportionate to Fit Screen */}
        <div className="flex-1 flex items-center justify-center px-3 sm:px-6 py-1 sm:py-2 relative z-10 min-h-0">
          <LiquidTiltCard
            maxTilt={3}
            glareOpacity={0.15}
            className="max-w-2xl lg:max-w-3xl w-full mx-auto text-center space-y-2.5 sm:space-y-4 p-4 sm:p-7 md:p-8 liquid-glass-card rounded-3xl sm:rounded-[36px] shadow-xl relative overflow-hidden"
          >
            {/* Floating EthioSmart Liquid Emblem Squircle */}
            <div className="flex justify-center -mt-1 sm:-mt-2">
              <div className="liquid-glass-squircle w-12 h-12 sm:w-14 sm:h-14 p-1.5 flex items-center justify-center shadow-md shadow-blue-500/10 group hover:scale-105 transition-transform duration-300">
                <img
                  src="/EthioSmart-192.png"
                  alt="EthioSmart"
                  className="w-full h-full object-contain drop-shadow-sm rounded-xl"
                />
              </div>
            </div>

            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-blue-800 shadow-xs cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              <span>
                {t("hero.badge", "EthioSmart • Learn • Practice • Grow")}
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-display font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
              <span>{t("hero.titlePre")}</span>{" "}
              <span className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 dark:from-sky-400 dark:via-cyan-300 dark:to-blue-400 bg-clip-text text-transparent">
                {t("hero.titleHighlight")}
              </span>
            </h1>

            {/* High-Contrast Description */}
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-lg mx-auto font-medium line-clamp-2 sm:line-clamp-none leading-relaxed">
              {t("hero.description")}
            </p>

            {/* Responsive Action Buttons (Always fits within view) */}
            <div className="flex flex-row items-center justify-center gap-2 sm:gap-3 pt-1 max-w-md mx-auto w-full">
              {/* Primary Start Learning Button */}
              <button
                type="button"
                className="liquid-glass-button h-10 sm:h-11 px-6 sm:px-8 text-xs sm:text-sm font-bold rounded-full flex items-center justify-center gap-2 shadow-md flex-1 sm:flex-initial"
                onClick={() => navigate(requireStudentLogin ? "/auth" : "/dashboard/exams")}
              >
                <span>{requireStudentLogin ? t("common.getStarted") : "Start Learning"}</span>
                <ArrowRight className="h-4 w-4 text-white" />
              </button>

              {/* Learn More */}
              <button
                type="button"
                className="liquid-glass-button-secondary h-10 sm:h-11 px-5 sm:px-6 text-xs sm:text-sm font-semibold rounded-full items-center justify-center text-slate-700 dark:text-slate-200"
                onClick={() => navigate("/about")}
              >
                {t("common.learnMore")}
              </button>
            </div>

            {/* Trust Indicators in Frosted Glass Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-0.5 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Works 100% Offline</span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Curriculum Aligned</span>
              </div>
            </div>
          </LiquidTiltCard>
        </div>

        {/* 3. Subtle Bottom Cue inside 100dvh Viewport */}
        <div className="relative z-20 flex justify-center pb-2 shrink-0">
          <a
            href="#features"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-sky-300 px-3 py-1 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 backdrop-blur-md shadow-xs transition-colors"
          >
            <span>Explore Platform</span>
            <span className="text-xs">↓</span>
          </a>
        </div>
        <EthioAccentBar className="absolute bottom-0 left-0 right-0" size="xs" />
      </section>

      {/* Features Section - Interactive High-Visibility Liquid Glass Cards */}
      <div id="features" className="relative py-14 sm:py-20 bg-gradient-to-b from-[#eaf2fd] via-background to-background dark:from-[#060c18] dark:via-background dark:to-background transition-colors duration-500">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-14 animate-slide-up">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-display font-bold mb-2.5 sm:mb-3 text-slate-900 dark:text-white">
              Why Choose <span className="bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-600 dark:from-sky-400 dark:to-cyan-400 bg-clip-text text-transparent">EthioSmart</span>
            </h2>
            <p className="text-xs sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-medium">
              Everything you need to learn curriculum topics, practice questions, and achieve academic excellence
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <LiquidTiltCard
                key={index}
                maxTilt={6}
                className="liquid-glass-card group relative p-5 sm:p-6 rounded-3xl hover:border-blue-400 dark:hover:border-sky-500 shadow-md hover:shadow-xl transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div
                  className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3.5 shadow-md group-hover:scale-105 transition-transform duration-300`}
                >
                  <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-display font-bold mb-1.5 text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {feature.description}
                </p>
              </LiquidTiltCard>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive Liquid Glass Call-To-Action Banner */}
      <div className="relative py-16 sm:py-24 overflow-hidden bg-gradient-to-br from-[#0c244d] via-[#091b3b] to-[#040d1f] text-white">
        <LiquidBackdrop showDroplets={true} showSplash={false} className="opacity-30" />
        <div className="relative container mx-auto px-4 text-center z-10">
          <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-slide-up">
            <Award className="h-12 w-12 sm:h-16 sm:w-16 text-sky-400 mx-auto animate-float" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white">
              Ready to Accelerate Your Academic Growth?
            </h2>
            <p className="text-base sm:text-xl text-sky-100/90 max-w-xl mx-auto font-normal">
              Join thousands of students and educators across Ethiopia using EthioSmart to learn, practice, and excel.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-2">
              <button
                type="button"
                className="liquid-glass-button w-full sm:w-auto h-13 sm:h-14 px-9 text-base sm:text-lg font-bold rounded-full shadow-2xl flex items-center justify-center gap-2"
                onClick={() => navigate(requireStudentLogin ? "/auth" : "/dashboard/exams")}
              >
                <span>{requireStudentLogin ? "Get Started Free" : "Start Learning"}</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        <EthioAccentBar className="absolute bottom-0 left-0 right-0" size="sm" />
      </div>

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
