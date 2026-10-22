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

const Index = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
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
    if (!loading && user && role) {
      navigate(role === "admin" ? "/dashboard" : "/dashboard/exams");
    }
  }, [user, role, loading, navigate]);

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
      // If beforeinstallprompt fired, the app is not currently running as an installed PWA
      if (!checkStandalone()) {
        setIsInstalled(false);
        localStorage.removeItem("pwa_installed");
      }
    };

    // Listen for device app installation event (fires immediately when user installs)
    const appInstalledHandler = () => {
      setIsInstalled(true);
      localStorage.setItem("pwa_installed", "true");
      setDeferredPrompt(null);
      setInstallModalOpen(false);
      toast({
        title: "ExamPro Installed!",
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
        description: "ExamPro is already installed on this device.",
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
            description: "ExamPro is being installed on your device.",
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
      icon: Zap,
      title: "Lightning Fast",
      description: "Instant exam loading and real-time results",
      gradient: "from-yellow-400 to-orange-500",
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Bank-level security for your exams",
      gradient: "from-green-400 to-cyan-500",
    },
    {
      icon: TrendingUp,
      title: "Advanced Analytics",
      description: "Track performance with detailed insights",
      gradient: "from-purple-400 to-pink-500",
    },
    {
      icon: Users,
      title: "Multi-User Support",
      description: "Manage students and examiners easily",
      gradient: "from-blue-400 to-indigo-500",
    },
  ];

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 overflow-hidden">
      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Modern gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-teal-500 to-blue-600 dark:from-cyan-600 dark:via-teal-600 dark:to-blue-700" />

        {/* Subtle animated overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />

        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]" />

        <div className="relative container mx-auto px-4 py-6 lg:py-8 flex-1 flex flex-col">
          {/* Navigation Bar */}
          <nav className="flex items-center justify-between animate-fade-in gap-2">
            {/* Logo */}
            <div
              className="flex items-center gap-2.5 sm:gap-3 group cursor-pointer"
              onClick={() => navigate("/")}
            >
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
                <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <span className="font-display font-bold text-xl sm:text-2xl tracking-tight text-white drop-shadow-lg">
                ExamPro
              </span>
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              {/* Install Button in Top Nav - Visible before installed, hidden immediately once installed */}
              {!isInstalled && (
                <Button
                  variant="ghost"
                  onClick={handleInstallClick}
                  className="text-white bg-white/15 backdrop-blur-md border border-white/30 hover:bg-white/25 shadow-md hover:shadow-lg rounded-xl h-9 px-2.5 sm:px-3.5 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
                  title="Install ExamPro on your device"
                >
                  <Download className="h-4 w-4" />
                  <span className="inline">Install App</span>
                </Button>
              )}

              <div className="[&_button]:text-white [&_button]:bg-white/10 [&_button]:backdrop-blur-sm [&_button]:border-white/20 [&_button]:hover:bg-white/20 [&_button]:shadow-lg">
                <LanguageToggle />
              </div>

              <div className="[&_button]:text-white [&_button]:bg-white/10 [&_button]:backdrop-blur-sm [&_button]:border-white/20 [&_button]:hover:bg-white/20 [&_button]:shadow-lg">
                <ThemeToggle />
              </div>

              <Button
                variant="ghost"
                className="hidden sm:flex text-white bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 shadow-lg rounded-xl font-semibold"
                onClick={() => navigate("/auth")}
              >
                {t("common.signIn")}
              </Button>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="flex-1 flex items-center justify-center py-8 sm:py-12">
            <div className="max-w-5xl mx-auto text-center space-y-6 sm:space-y-8 animate-slide-up px-4">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 cursor-default group">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white">
                  {t("hero.badge")}
                </span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-display font-bold leading-[1.1] tracking-tight">
                <span className="text-white drop-shadow-lg">{t("hero.titlePre")}</span>
                <br />
                <span className="text-white drop-shadow-lg">
                  {t("hero.titleHighlight")}
                </span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-xl lg:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed drop-shadow">
                {t("hero.description")}
              </p>

              {/* CTA Action Buttons - Prominent on BOTH Screens */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center pt-4 max-w-xl mx-auto w-full">
                {/* 1. Get Started Button (Navigates to /auth login page) */}
                <Button
                  size="lg"
                  className="group h-13 sm:h-14 px-8 text-base sm:text-lg font-bold rounded-2xl bg-white hover:bg-gray-50 text-cyan-700 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 active:scale-95 flex-1"
                  onClick={() => navigate("/auth")}
                >
                  {t("common.getStarted")}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>

                {/* 2. Primary Install App Button - Visible before installed, hidden immediately once installed */}
                {!isInstalled && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-13 sm:h-14 px-6 text-base sm:text-lg font-bold rounded-2xl bg-white/20 hover:bg-white/30 text-white border-2 border-white/60 backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl flex-1 flex items-center justify-center gap-2"
                    onClick={handleInstallClick}
                  >
                    <Download className="h-5 w-5 text-white" />
                    <span>Install App</span>
                  </Button>
                )}

                {/* 3. Learn More (Desktop & Mobile) */}
                <Button
                  size="lg"
                  variant="outline"
                  className="h-13 sm:h-14 px-6 text-base sm:text-lg font-semibold rounded-2xl border-2 border-white/60 bg-transparent hover:bg-white/10 text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg sm:flex-initial"
                  onClick={() => navigate("/about")}
                >
                  {t("common.learnMore")}
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-6 sm:pt-8 text-xs sm:text-sm text-white/90">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  <span>Works 100% Offline</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  <span>Free for All Students</span>
                </div>
                {!isInstalled && (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    <span>Fast 1-Click Install</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section - Responsive Grid */}
      <div className="relative py-16 sm:py-24 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16 animate-slide-up">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-3 sm:mb-4">
              Why Choose <span className="bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">ExamPro</span>
            </h2>
            <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to conduct secure, efficient online and offline examinations
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-cyan-300 dark:hover:border-cyan-700 shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div
                  className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-display font-bold mb-2 group-hover:bg-gradient-to-r group-hover:from-cyan-600 group-hover:to-teal-600 group-hover:bg-clip-text group-hover:text-transparent transition-all">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 dark:from-cyan-600 dark:via-teal-600 dark:to-blue-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]" />

        <div className="relative container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-slide-up">
            <Award className="h-12 w-12 sm:h-16 sm:w-16 text-white mx-auto animate-float" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white">
              Ready to Transform Your Exams?
            </h2>
            <p className="text-base sm:text-xl text-cyan-50 max-w-xl mx-auto">
              Join thousands of educators and students using ExamPro for seamless online and offline examinations
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-2">
              <Button
                size="lg"
                className="w-full sm:w-auto h-13 sm:h-14 px-9 text-base sm:text-lg font-bold rounded-2xl bg-white text-cyan-700 hover:bg-cyan-50 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 active:scale-95"
                onClick={() => navigate("/auth")}
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              {!isInstalled && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto h-13 sm:h-14 px-8 text-base sm:text-lg font-bold rounded-2xl border-2 border-white/80 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                  onClick={handleInstallClick}
                >
                  <Download className="h-5 w-5" />
                  <span>Install ExamPro</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Device PWA Installation Instructions Modal */}
      <Dialog open={installModalOpen} onOpenChange={setInstallModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7">
          <DialogHeader className="space-y-2 text-center sm:text-left">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto sm:mx-0">
              {isIOS ? <Smartphone className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
            </div>
            <DialogTitle className="text-xl font-bold font-display">
              {isInstalled ? "ExamPro is Installed" : isIOS ? "Install ExamPro on iPhone / iPad" : "Install ExamPro on Your Device"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              {isInstalled
                ? "You already have ExamPro installed as an application. You can launch it directly from your home screen or apps menu."
                : "Install ExamPro for fast 1-click access, full-screen reading, and 100% offline study capability."}
            </DialogDescription>
          </DialogHeader>

          {isInstalled ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
              <p className="text-xs font-semibold">
                ExamPro is installed and ready to use offline!
              </p>
            </div>
          ) : isIOS ? (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-muted/50 border space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <span>
                    Tap the <b>Share</b> button in Safari&apos;s bottom toolbar (<Share className="h-3.5 w-3.5 inline mx-1 text-cyan-600" />).
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <span>
                    Scroll down and tap <b>&ldquo;Add to Home Screen&rdquo;</b>.
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold text-xs shrink-0">
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
                  <li>Click the <b>Install icon</b> (<Download className="h-3.5 w-3.5 inline mx-0.5 text-cyan-600" />) in your browser&apos;s address bar.</li>
                  <li>Or open the browser menu (<b>⋮</b>) and select <b>&ldquo;Install ExamPro&rdquo;</b> or <b>&ldquo;Add to Home screen&rdquo;</b>.</li>
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
                  className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Install Now
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInstallModalOpen(false)}
              className="rounded-xl text-xs"
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
