import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Brain, Sparkles, BookOpen, ClipboardList, CheckCircle2, Bot, Lightbulb, Zap, Rocket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LiquidTiltCard } from "@/components/ui/LiquidTiltCard";

export default function AIStudyAssistant() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const plannedFeatures = [
    {
      icon: Bot,
      title: "Step-by-Step Problem Solver",
      description: "Ask tough physics, math, or chemistry questions and get clear step-by-step derivations with worked examples.",
      color: "from-fuchsia-600 to-pink-600",
    },
    {
      icon: BookOpen,
      title: "Curriculum-Trained Intelligence",
      description: "Trained directly on national curriculum textbooks and past matriculation exams for exact syllabus relevance.",
      color: "from-purple-600 to-indigo-600",
    },
    {
      icon: Zap,
      title: "Instant Exam Doubt Clearing",
      description: "Stuck on a tricky practice exam question? Get instant conceptual explanations and alternate solving methods.",
      color: "from-amber-500 to-orange-600",
    },
    {
      icon: Lightbulb,
      title: "Personalized Recall Flashcards",
      description: "AI automatically identifies your weak topics and generates targeted active recall flashcards.",
      color: "from-emerald-500 to-teal-600",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
        {/* Header Navigation */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="shrink-0 rounded-2xl liquid-glass-squircle"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{t("aiAssistant.title", "AI Tutor")}</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/30">
                Coming Soon
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Your 24/7 personalized academic AI study companion is currently under active development.
            </p>
          </div>
        </div>

        {/* Hero Showcase Card */}
        <LiquidTiltCard
          maxTilt={4}
          glareOpacity={0.15}
          className="relative overflow-hidden p-6 sm:p-10 rounded-3xl sm:rounded-[36px] liquid-glass-card border border-fuchsia-400/30 shadow-2xl text-center space-y-5 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-pink-500/10"
        >
          {/* Ambient Caustic Glow */}
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Animated AI Brain Emblem */}
          <div className="flex justify-center pt-2">
            <div className="relative group">
              <div className="absolute -inset-3 bg-gradient-to-r from-fuchsia-500/35 via-pink-400/30 to-purple-500/35 rounded-[34px] blur-xl opacity-90 group-hover:opacity-100 transition-opacity animate-pulse" />
              <div className="relative liquid-glass-squircle w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-3 flex items-center justify-center shadow-2xl shadow-fuchsia-500/25 bg-gradient-to-br from-fuchsia-600 via-pink-600 to-purple-700 text-white animate-float">
                <Brain className="h-12 w-12 sm:h-14 sm:w-14 text-white drop-shadow-md" />
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-fuchsia-100 dark:bg-fuchsia-950/70 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-800 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-600 dark:text-fuchsia-400 animate-spin" style={{ animationDuration: "6s" }} />
            <span>Full AI Tutor Experience Coming Soon</span>
          </div>

          {/* Main Title & Description */}
          <div className="max-w-2xl mx-auto space-y-2.5">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold text-slate-900 dark:text-white leading-tight">
              Interactive 24/7 AI Tutor For All Subjects
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              We are building a full-featured, syllabus-aligned AI tutor dedicated to Ethiopian students.
              Soon you will be able to ask any textbook problem, receive step-by-step guidance, and practice concepts interactively anytime, anywhere.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => navigate("/dashboard/books")}
              className="h-11 px-6 rounded-full font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              <span>Browse Study Notes & Books</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard/exams")}
              className="h-11 px-6 rounded-full font-bold text-xs sm:text-sm liquid-glass-button-secondary border-purple-400/40"
            >
              <ClipboardList className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />
              <span>Practice Exams</span>
            </Button>
          </div>
        </LiquidTiltCard>

        {/* Feature Roadmap Showcase */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <Rocket className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400" />
            <h3 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white">
              What&apos;s Coming in the Full AI Tutor
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plannedFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl liquid-glass-card border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-4 hover:border-fuchsia-400/50 transition-all duration-300 shadow-sm"
              >
                <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${feat.color} text-white flex items-center justify-center shrink-0 shadow-md`}>
                  <feat.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {feat.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
