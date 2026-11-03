import { AuthForm } from "@/components/auth/AuthForm";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, BookOpen, Brain, ClipboardList, Shield, Award, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useTranslation } from "react-i18next";
import { EthioSmartLogo } from "@/components/ui/EthioSmartLogo";
import { EthioAccentBar } from "@/components/ui/EthioAccentBar";
import { LiquidBackdrop } from "@/components/ui/LiquidBackdrop";

const Auth = () => {
  const { t } = useTranslation();

  return (
    <div className="h-[100dvh] max-h-[100dvh] flex flex-col lg:flex-row bg-background relative overflow-hidden">
      {/* Left Side - Premium Educational Showcase (Responsive Light/Dark Mode) */}
      <div className="hidden lg:flex lg:w-1/2 h-full relative overflow-hidden bg-gradient-to-br from-[#ebf3fc] via-[#f3f7fd] to-[#e4effc] dark:from-[#070c18] dark:via-[#0c162d] dark:to-[#050811] transition-colors duration-500 border-r border-slate-200/70 dark:border-slate-800/70">
        {/* Animated fluid caustic orbs matching theme */}
        <div className="absolute top-16 left-12 w-80 h-80 bg-blue-400/20 dark:bg-sky-500/20 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-16 right-10 w-96 h-96 bg-cyan-400/20 dark:bg-blue-600/20 rounded-full blur-3xl animate-float delay-300 pointer-events-none" />
        
        {/* Liquid backdrop waves on the brand panel */}
        <LiquidBackdrop showDroplets={true} showSplash={true} showRipples={true} interactive={true} className="opacity-60 dark:opacity-40" />

        {/* Content Showcase */}
        <div className="relative z-10 flex flex-col justify-between p-8 xl:p-14 text-slate-900 dark:text-white h-full w-full">
          {/* Top Brand & Header - Clean & Minimal */}
          <div className="space-y-3 animate-slide-up">
            <div className="flex items-center gap-2.5">
              <EthioSmartLogo variant="full" size="md" textColor="auto" showTagline={true} />
            </div>
            
            <h1 className="text-2xl xl:text-3xl font-display font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
              Smart Learning for{" "}
              <span className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 dark:from-sky-400 dark:via-cyan-300 dark:to-blue-400 bg-clip-text text-transparent">
                Every Student
              </span>
            </h1>
          </div>

          {/* Centerpiece: Clean, Concise Feature Showcase (Minimal Text) */}
          <div className="my-auto py-2 animate-scale-in">
            <div className="relative rounded-3xl p-4 xl:p-5 bg-white/85 dark:bg-slate-900/80 backdrop-blur-xl border border-white/80 dark:border-slate-800 shadow-xl shadow-blue-500/5 space-y-3 max-w-md">
              {/* Feature 1: Digital Textbooks */}
              <div className="flex items-center gap-3 group">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                  <BookOpen className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs xl:text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors">
                    Curriculum Textbooks & Notes
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Grades 7–12 • 100% Offline
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200/80 dark:border-slate-800/80" />

              {/* Feature 2: AI Study Assistant */}
              <div className="flex items-center gap-3 group">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                  <Brain className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs xl:text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      24/7 AI Study Assistant
                    </h4>
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                      AI
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Instant step-by-step explanations
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200/80 dark:border-slate-800/80" />

              {/* Feature 3: Timed Practice & National Exams */}
              <div className="flex items-center gap-3 group">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                  <ClipboardList className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs xl:text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    National Practice Exams
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Timed mock tests & analytics
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust Indicators - Concise */}
          <div className="flex flex-wrap items-center gap-2 pt-1 animate-slide-up">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-[10px] xl:text-[11px] font-semibold text-slate-700 dark:text-slate-300 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Offline Ready</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-[10px] xl:text-[11px] font-semibold text-slate-700 dark:text-slate-300 shadow-xs">
              <CheckCircle2 className="h-3 w-3 text-blue-600 dark:text-sky-400" />
              <span>Curriculum Aligned</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-[10px] xl:text-[11px] font-semibold text-slate-700 dark:text-slate-300 shadow-xs">
              <Shield className="h-3 w-3 text-purple-600 dark:text-purple-400" />
              <span>Cloud Sync</span>
            </div>
          </div>
        </div>
        <EthioAccentBar className="absolute bottom-0 left-0 right-0" size="xs" />
      </div>

      {/* Right Side - Liquid Glass Auth Viewport (Guaranteed to Fit Screen with Zero Cut-off) */}
      <div className="flex-1 flex flex-col h-full max-h-[100dvh] relative overflow-hidden justify-between">
        {/* Full Liquid Glass Backdrop with fluid ripples and subtle droplets */}
        <LiquidBackdrop showDroplets={true} showSplash={true} showRipples={true} interactive={true} />

        {/* Top Header Bar */}
        <header className="relative z-10 px-4 py-2 sm:px-6 sm:py-2.5 flex justify-between items-center shrink-0">
          <Link
            to="/"
            className="liquid-glass-button-secondary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-foreground transition-all group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
            {t("common.back")}
          </Link>
          <div className="flex items-center gap-2 [&_button]:liquid-glass-squircle [&_button]:rounded-xl [&_button]:h-7.5 [&_button]:w-7.5">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        {/* Form Container - Centered and Perfectly Sized with Smooth Overflow Handling */}
        <div className="flex-1 flex items-center justify-center px-3 py-1 sm:px-6 relative z-10 min-h-0 overflow-y-auto scrollbar-none">
          <div className="w-full max-w-sm sm:max-w-md my-auto">
            {/* Auth Form with Liquid Glass styling */}
            <div className="animate-scale-in">
              <AuthForm />
            </div>
          </div>
        </div>

        {/* EthioSmart Tagline & Footer (Fixed Bottom within Viewport) */}
        <footer className="relative z-10 text-center py-1 px-4 shrink-0">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            EthioSmart • Learn • Practice • Grow
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Auth;
