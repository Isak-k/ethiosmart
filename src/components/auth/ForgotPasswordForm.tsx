import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getPasswordResetSchema } from "@/lib/validations";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { getFriendlyAuthErrorMessage } from "@/lib/firebase-utils";

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        title: "You are currently offline",
        description: "You are offline. Please connect to the internet to request a password reset.",
        variant: "destructive",
      });
      return;
    }

    const result = getPasswordResetSchema(t).safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      await resetPassword(email);

      setSent(true);
      toast({
        title: t("common.resetPassword.sentTitle"),
        description: t("common.resetPassword.sentDesc"),
      });
    } catch (error: any) {
      const friendly = getFriendlyAuthErrorMessage(error, 'reset');
      toast({
        title: friendly.title,
        description: friendly.description || t("common.resetPassword.failedDesc"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center space-y-4 py-4 animate-scale-in">
        <div className="h-16 w-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
          <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="font-display font-bold text-xl">{t("common.resetPassword.checkEmail")}</h3>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          {t("common.resetPassword.sentTo")} <strong className="text-foreground">{email}</strong>
        </p>
        <button
          type="button"
          onClick={onBack}
          className="liquid-glass-button-secondary inline-flex items-center justify-center px-6 py-2.5 text-sm mt-3"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.resetPassword.backToSignIn")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-scale-in">
      <div className="text-center space-y-1.5 mb-6">
        <h3 className="font-display font-bold text-2xl">{t("common.resetPassword.title")}</h3>
        <p className="text-muted-foreground text-xs sm:text-sm">
          {t("common.resetPassword.subtitle")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-email" className="text-xs sm:text-sm font-semibold pl-1">
          {t("common.email")}
        </Label>
        <div className="relative group">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-sky-500 transition-colors z-10" />
          <Input
            id="reset-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            className={`pl-12 h-12 rounded-full liquid-glass-input text-sm ${error ? "border-red-500" : ""}`}
            required
          />
        </div>
        {error && <p className="text-xs text-red-500 pl-3">{error}</p>}
      </div>

      <button
        type="submit"
        className="w-full h-12 rounded-full liquid-glass-button text-sm sm:text-base font-semibold flex items-center justify-center shadow-lg"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          "Send Reset Link"
        )}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full h-11 rounded-full liquid-glass-button-secondary text-sm font-medium flex items-center justify-center transition-all"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to sign in
      </button>
    </form>
  );
}
