import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FlaskConical, ShieldCheck, AlertTriangle } from "lucide-react";
import type { PaymentMode } from "./types";

interface PaymentModeCardProps {
  value: PaymentMode;
  onChange: (mode: PaymentMode) => void;
  disabled?: boolean;
}

const MODES: { id: PaymentMode; label: string; description: string; icon: typeof ShieldCheck }[] = [
  {
    id: "production",
    label: "Production",
    description: "Real payments. Approving a receipt grants permanent lifetime access.",
    icon: ShieldCheck,
  },
  {
    id: "sandbox",
    label: "Sandbox / test",
    description: "Test payments kept in a separate queue. Approvals never grant real access.",
    icon: FlaskConical,
  },
];

export function PaymentModeCard({ value, onChange, disabled }: PaymentModeCardProps) {
  const isSandbox = value === "sandbox";

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isSandbox ? <FlaskConical className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              Payment mode
            </CardTitle>
            <CardDescription>Choose whether the payment queue handles real or test payments.</CardDescription>
          </div>
          <Badge variant={isSandbox ? "secondary" : "default"}>
            {isSandbox ? "Sandbox" : "Production"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const selected = value === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(mode.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                  selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 hover:bg-muted/50",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", selected ? "text-primary" : "text-muted-foreground")} />
                  <span className="font-semibold">{mode.label}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{mode.description}</p>
              </button>
            );
          })}
        </div>

        {isSandbox ? (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sandbox mode is active</AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80">
              Approving a sandbox receipt records the review only — it never grants real lifetime access, and it
              never changes a student&apos;s production payment record. Students who already hold production
              lifetime access keep it while sandbox mode is active.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-border/60">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <AlertTitle>Production mode is active</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Approving a receipt here grants permanent lifetime access. That access can never be revoked by
              changing settings or switching to sandbox later.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
