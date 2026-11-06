import { AuthForm } from "@/components/auth/AuthForm";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useTranslation } from "react-i18next";
import { EthioAccentBar } from "@/components/ui/EthioAccentBar";
import { useAuth } from "@/contexts/AuthContext";

const Auth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { requireStudentLogin, continueAsGuest } = useAuth();

  return (
    <div className="h-[100dvh] max-h-[100dvh] flex flex-col lg:flex-row bg-background relative overflow-hidden">
      {/* Left Side - Student Study Showcase */}
      <div className="hidden lg:flex lg:w-1/2 h-full relative overflow-hidden bg-[#b4d8fd] dark:bg-[#070c18] border-r border-slate-200/70 dark:border-slate-800/70 select-none">
        <img
          src="/images/auth-student-showcase.jpg"
          srcSet="/images/auth-student-showcase.jpg 1024w, /images/auth-student-showcase-2x.jpg 2048w"
          sizes="(min-width: 1024px) 50vw, 100vw"
          alt="EthioSmart - Smart Learning for Every Student"
          className="w-full h-full object-cover object-center select-none"
          draggable={false}
        />
        <EthioAccentBar className="absolute bottom-0 left-0 right-0 z-10" size="xs" />
      </div>

      {/* Right Side - Full-Height Edge-to-Edge Login Surface (Touches upper and lower height) */}
      <div className="flex-1 flex flex-col h-full max-h-[100dvh] relative overflow-hidden justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-slate-200/80 dark:border-slate-800/80 shadow-2xl">
        {/* Soft liquid caustic orbs for refraction */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/10 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-400/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Bar - Touches upper screen edge */}
        <header className="relative z-10 px-5 py-3 sm:px-8 flex justify-between items-center shrink-0 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <Link
            to="/"
            className="liquid-glass-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-foreground transition-all group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
            {t("common.back")}
          </Link>
          <div className="flex items-center gap-2 [&_button]:liquid-glass-squircle [&_button]:rounded-xl [&_button]:h-8 [&_button]:w-8">
            {!requireStudentLogin && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (continueAsGuest) await continueAsGuest();
                    navigate("/dashboard/exams");
                  } catch {
                    navigate("/dashboard/exams");
                  }
                }}
                className="!h-auto !w-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 transition-all shadow-xs mr-1 active:scale-95 cursor-pointer"
                title="Enter directly as guest without signing in"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="hidden sm:inline">Guest Access</span>
                <span className="sm:hidden">Guest</span>
              </button>
            )}
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        {/* Form Container - Fills the screen gracefully on mobile */}
        <div className="flex-1 flex flex-col justify-between px-3 sm:px-8 py-2 sm:py-4 relative z-10 min-h-0 overflow-y-auto scrollbar-none">
          <div className="w-full max-w-sm sm:max-w-md mx-auto flex-1 flex flex-col justify-center py-2 sm:py-4">
            <div className="animate-scale-in w-full">
              <AuthForm />
            </div>
          </div>
        </div>

        {/* EthioSmart Footer - Touches lower screen edge */}
        <footer className="relative z-10 text-center py-2.5 px-4 shrink-0 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">
            EthioSmart • Learn • Practice • Grow
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Auth;
