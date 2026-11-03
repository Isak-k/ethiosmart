import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signUp, getUserRole, AppRole } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { loginSchema, signupSchema, getLoginSchema, getSignupSchema } from "@/lib/validations";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { GoogleProfileSetup } from "./GoogleProfileSetup";
import { GraduationCap, Loader2, Mail, Lock, User, Eye, EyeOff, Building, WifiOff, ArrowRight, Sparkles, Check, BookOpen } from "lucide-react";
import { getDepartments } from "@/lib/departments";
import { Department } from "@/integrations/firebase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { signInWithGoogle, completeGoogleSignUpProfile } from "@/lib/firebase-auth";
import { getFriendlyAuthErrorMessage } from "@/lib/firebase-utils";
import { LiquidTiltCard } from "@/components/ui/LiquidTiltCard";

export function AuthForm() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGoogleProfileSetup, setShowGoogleProfileSetup] = useState(false);
  const [googleUserData, setGoogleUserData] = useState<{ userId: string; email: string; displayName: string } | null>(null);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});

  // Signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  // Always default to student for self-signup
  const signupRole: AppRole = "student";
  const [signupErrors, setSignupErrors] = useState<{ name?: string; email?: string; password?: string; department?: string }>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const data = await getDepartments();
        setDepartments(data);
      } catch (error) {
        console.error("Failed to fetch departments", error);
      } finally {
        setLoadingDepts(false);
      }
    };
    fetchDepts();
  }, []);

  // Check for password reset redirect
  useEffect(() => {
    if (searchParams.get("reset") === "true") {
      toast({
        title: "Password reset",
        description: "Please enter your new password in the settings after signing in.",
      });
    }
  }, [searchParams, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        title: "You are currently offline",
        description: "You are offline. Please connect to the internet to sign in to your account.",
        variant: "destructive",
      });
      return;
    }

    const result = getLoginSchema(t).safeParse({
      email: loginEmail,
      password: loginPassword,
    });

    if (!result.success) {
      const errors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "email") errors.email = err.message;
        if (err.path[0] === "password") errors.password = err.message;
      });
      setLoginErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const { user } = await signIn(loginEmail, loginPassword);
      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      });
      const userRole = await getUserRole(user.uid);
      navigate(userRole === "admin" ? "/dashboard" : "/dashboard/exams");
    } catch (error: any) {
      const friendly = getFriendlyAuthErrorMessage(error, 'login');
      toast({
        title: friendly.title,
        description: friendly.description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErrors({});

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        title: "You are currently offline",
        description: "You are offline. Please connect to the internet to create an account.",
        variant: "destructive",
      });
      return;
    }

    const result = getSignupSchema(t).safeParse({
      name: signupName,
      email: signupEmail,
      password: signupPassword,
      role: signupRole,
    });

    if (!result.success) {
      const errors: { name?: string; email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "name") errors.name = err.message;
        if (err.path[0] === "email") errors.email = err.message;
        if (err.path[0] === "password") errors.password = err.message;
      });
      setSignupErrors(errors);
      return;
    }

    if (!selectedDept) {
      setSignupErrors(prev => ({ ...prev, department: t("common.selectDepartment") }));
      return;
    }

    setLoading(true);

    try {
      await signUp(signupEmail, signupPassword, signupName, signupRole, selectedDept);
      
      // Refresh profile to ensure the new role is loaded
      await refreshProfile();
      
      toast({
        title: "Account created!",
        description: "Welcome to EthioSmart!",
      });
      navigate(signupRole === "admin" ? "/dashboard" : "/dashboard/exams");
    } catch (error: any) {
      const friendly = getFriendlyAuthErrorMessage(error, 'signup');
      toast({
        title: friendly.title,
        description: friendly.description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        title: "You are currently offline",
        description: "You are offline. Please connect to the internet to sign in with Google.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await signInWithGoogle();
      
      if (result.needsProfileSetup) {
        // New user - show profile setup
        setGoogleUserData({
          userId: result.user.uid,
          email: result.user.email || "",
          displayName: result.user.displayName || ""
        });
        setShowGoogleProfileSetup(true);
        setLoading(false);
      } else {
        // Existing user - redirect to dashboard
        await refreshProfile();
        const userRole = await getUserRole(result.user.uid);
        toast({
          title: "Welcome back!",
          description: "You have been signed in with Google.",
        });
        navigate(userRole === "admin" ? "/dashboard" : "/dashboard/exams");
      }
    } catch (error: any) {
      setLoading(false);
      const friendly = getFriendlyAuthErrorMessage(error, 'google');
      toast({
        title: friendly.title,
        description: friendly.description,
        variant: "destructive",
      });
    }
  };

  const handleCompleteGoogleProfile = async (fullName: string, departmentId: string) => {
    if (!googleUserData) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        title: "You are currently offline",
        description: "You are offline. Please connect to the internet to complete profile setup.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      await completeGoogleSignUpProfile(
        googleUserData.userId,
        googleUserData.email,
        fullName, // Use the name provided by user (can be edited)
        departmentId,
        'student'
      );
      
      await refreshProfile();
      
      toast({
        title: "Profile completed!",
        description: "Welcome to EthioSmart!",
      });
      navigate("/dashboard/exams");
    } catch (error: any) {
      const friendly = getFriendlyAuthErrorMessage(error, 'signup');
      toast({
        title: friendly.title,
        description: friendly.description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <Card className="w-full max-w-md card-elevated animate-scale-in">
        <CardContent className="pt-6">
          <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
        </CardContent>
      </Card>
    );
  }

  if (showGoogleProfileSetup && googleUserData) {
    return (
      <div className="w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden p-8">
        <GoogleProfileSetup
          email={googleUserData.email}
          displayName={googleUserData.displayName}
          onComplete={handleCompleteGoogleProfile}
          loading={loading}
        />
      </div>
    );
  }

  return (
    <LiquidTiltCard maxTilt={3} glareOpacity={0.15} className="w-full liquid-glass-card rounded-3xl sm:rounded-[36px] overflow-hidden relative shadow-xl">
      <Tabs value={tab} onValueChange={setTab}>
        {/* Liquid Glass Header with Prominent High-Visibility Brand Emblem */}
        <div className="pt-3.5 pb-1 px-4 sm:px-6 text-center relative">
          <div className="flex justify-center mb-1.5">
            <div className="relative group">
              {/* Luminous blue/cyan halo */}
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/25 via-sky-400/20 to-cyan-400/25 rounded-[28px] blur-lg opacity-75 group-hover:opacity-100 transition-opacity" />
              <div className="relative liquid-glass-squircle w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[26px] p-2 sm:p-2.5 flex items-center justify-center shadow-xl shadow-blue-500/15 group-hover:scale-105 transition-all duration-300">
                <img
                  src="/EthioSmart.png"
                  alt="EthioSmart"
                  className="w-full h-full object-contain drop-shadow-md rounded-xl sm:rounded-2xl"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== "/EthioSmart-192.png") target.src = "/EthioSmart-192.png";
                  }}
                />
              </div>
            </div>
          </div>

          <h2 className="text-xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
            {tab === "login" ? t("common.welcomeBack") : "Create Account"}
          </h2>
        </div>

        {/* Liquid Segment Toggle */}
        <div className="px-4 sm:px-6 pt-1">
          <TabsList className="grid w-full grid-cols-2 h-8 sm:h-9 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-full p-0.5 backdrop-blur-md">
            <TabsTrigger 
              value="login" 
              className="font-semibold text-xs py-1 rounded-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              {t("common.signIn")}
            </TabsTrigger>
            <TabsTrigger 
              value="signup" 
              className="font-semibold text-xs py-1 rounded-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
            >
              {t("common.signup")}
            </TabsTrigger>
          </TabsList>
        </div>

        {!isOnline && (
          <div className="mx-4 sm:mx-6 mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs animate-fade-in">
            <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>You are offline.</span>
          </div>
        )}

        <div className="p-3.5 sm:p-5 pt-2">
          <TabsContent value="login" className="mt-0">
            <form onSubmit={handleLogin} className="space-y-2">
              {/* Email Input */}
              <div>
                <label htmlFor="login-email" className="sr-only">
                  {t("common.email")}
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors z-10" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="Email address"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      setLoginErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    className={cn(
                      "pl-10 h-10 rounded-full liquid-glass-input text-xs sm:text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      loginErrors.email && "border-red-500"
                    )}
                    required
                  />
                </div>
                {loginErrors.email && (
                  <p className="text-[11px] text-red-500 pl-3 pt-0.5 flex items-center gap-1">
                    <span>⚠</span> {loginErrors.email}
                  </p>
                )}
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="login-password" className="sr-only">
                  {t("common.password")}
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors z-10" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    className={cn(
                      "pl-10 pr-9 h-10 rounded-full liquid-glass-input text-xs sm:text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      loginErrors.password && "border-red-500"
                    )}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                    )}
                  </Button>
                </div>
                {loginErrors.password && (
                  <p className="text-[11px] text-red-500 pl-3 pt-0.5 flex items-center gap-1">
                    <span>⚠</span> {loginErrors.password}
                  </p>
                )}
              </div>

              {/* Options Row */}
              <div className="flex items-center justify-between text-[11px] sm:text-xs px-1 pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span>Remember Me</span>
                </label>

                <button
                  type="button"
                  className="font-semibold text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 transition-colors"
                  onClick={() => setShowForgotPassword(true)}
                >
                  {t("common.forgotPassword")}
                </button>
              </div>

              {/* 1. Primary Login Button - Fully Visible & Crisp */}
              <button
                type="submit"
                className="liquid-glass-button w-full h-10 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-2 group cursor-pointer shadow-md mt-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                    <span>{t("common.loading")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("common.login")}</span>
                    <span className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center ml-0.5 group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="h-3 w-3 text-white" />
                    </span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative my-2 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-2.5 bg-white dark:bg-slate-900 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Or
                  </span>
                </div>
              </div>

              {/* 2. Login with Google - Prominently Placed Underneath Login */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 shadow-xs flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold transition-all active:scale-[0.98]"
                title="Sign in with Google"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-0">
            <form onSubmit={handleSignup} className="space-y-2">
              {/* Full Name */}
              <div>
                <label htmlFor="signup-name" className="sr-only">
                  {t("common.fullName")}
                </label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors z-10" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Full name"
                    value={signupName}
                    onChange={(e) => {
                      setSignupName(e.target.value);
                      setSignupErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    className={cn(
                      "pl-10 h-10 rounded-full liquid-glass-input text-xs sm:text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      signupErrors.name && "border-red-500"
                    )}
                    required
                  />
                </div>
                {signupErrors.name && (
                  <p className="text-[11px] text-red-500 pl-3 pt-0.5">{signupErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="signup-email" className="sr-only">
                  {t("common.email")}
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors z-10" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Email address"
                    value={signupEmail}
                    onChange={(e) => {
                      setSignupEmail(e.target.value);
                      setSignupErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    className={cn(
                      "pl-10 h-10 rounded-full liquid-glass-input text-xs sm:text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      signupErrors.email && "border-red-500"
                    )}
                    required
                  />
                </div>
                {signupErrors.email && (
                  <p className="text-[11px] text-red-500 pl-3 pt-0.5">{signupErrors.email}</p>
                )}
              </div>

              {/* Department */}
              <div>
                <div className="relative group">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors z-10" />
                  <Select value={selectedDept} onValueChange={(v) => {
                    setSelectedDept(v);
                    setSignupErrors((prev) => ({ ...prev, department: undefined }));
                  }}>
                    <SelectTrigger className={cn(
                      "pl-10 h-10 rounded-full liquid-glass-input text-xs sm:text-sm text-slate-900 dark:text-slate-50",
                      signupErrors.department && "border-red-500"
                    )}>
                      <SelectValue placeholder={t("common.selectDepartment")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xl">
                      {loadingDepts ? (
                        <div className="p-2 text-xs text-slate-500 text-center">{t("common.loading")}</div>
                      ) : departments.length === 0 ? (
                        <div className="p-2 text-xs text-slate-500 text-center">{t("common.noDepartments")}</div>
                      ) : (
                        departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id} className="rounded-xl text-xs sm:text-sm">
                            {dept.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {signupErrors.department && (
                  <p className="text-[11px] text-red-500 pl-3 pt-0.5">{signupErrors.department}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="signup-password" className="sr-only">
                  {t("common.password")}
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors z-10" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create password"
                    value={signupPassword}
                    onChange={(e) => {
                      setSignupPassword(e.target.value);
                      setSignupErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    className={cn(
                      "pl-10 pr-9 h-10 rounded-full liquid-glass-input text-xs sm:text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      signupErrors.password && "border-red-500"
                    )}
                    minLength={6}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                    )}
                  </Button>
                </div>
                {signupErrors.password && (
                  <p className="text-[11px] text-red-500 pl-3 pt-0.5">{signupErrors.password}</p>
                )}
              </div>

              {/* 1. Primary Signup Button */}
              <button
                type="submit"
                className="liquid-glass-button w-full h-10 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-2 group cursor-pointer shadow-md mt-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                    <span>{t("common.loading")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("common.signup")}</span>
                    <span className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center ml-0.5 group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="h-3 w-3 text-white" />
                    </span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative my-2 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-2.5 bg-white dark:bg-slate-900 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Or
                  </span>
                </div>
              </div>

              {/* 2. Google Signup Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 shadow-xs flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold transition-all active:scale-[0.98]"
                title="Sign up with Google"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </form>
          </TabsContent>
        </div>
      </Tabs>
    </LiquidTiltCard>
  );
}
