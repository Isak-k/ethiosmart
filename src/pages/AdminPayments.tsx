import { useCallback, useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import app from "@/integrations/firebase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { PaymentModeCard } from "@/components/admin/payments/PaymentModeCard";
import { PaymentPriceCard } from "@/components/admin/payments/PaymentPriceCard";
import { PaymentMethodsEditor } from "@/components/admin/payments/PaymentMethodsEditor";
import { InstructionsCard } from "@/components/admin/payments/InstructionsCard";
import { FreeAccessSettings } from "@/components/admin/payments/FreeAccessSettings";
import { DiscountSettings } from "@/components/admin/payments/DiscountSettings";
import {
  defaultPaymentSettings,
  normalizePaymentSettings,
  type PaymentSettingsConfig,
} from "@/components/admin/payments/types";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Search,
  Save,
  Undo2,
  Lock,
  AlertTriangle,
} from "lucide-react";

const functions = getFunctions(app);
const getPaymentAdminData = httpsCallable(functions, "getPaymentAdminData");
const reviewPayment = httpsCallable(functions, "reviewPayment");
const savePaymentSettings = httpsCallable(functions, "savePaymentSettings");

type Payment = {
  id: string;
  paymentId: string;
  userId: string;
  userName?: string;
  email?: string;
  phone?: string;
  status: "Pending" | "Approved" | "Rejected";
  methodName: string;
  expectedAmountEtb: number;
  amountPaidEtb: number;
  receiptUrl: string;
  submittedAt?: { seconds?: number };
  rejectionReason?: string | null;
};

export default function AdminPayments() {
  const { toast } = useToast();
  const { isSuperAdmin } = usePermissions();
  const canManageSettings = isSuperAdmin;

  const [tab, setTab] = useState<"review" | "settings">("review");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totals, setTotals] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, revenueEtb: 0 });
  const [settings, setSettings] = useState<PaymentSettingsConfig>(defaultPaymentSettings());
  const [savedSettings, setSavedSettings] = useState<PaymentSettingsConfig>(defaultPaymentSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Pending");
  const [rejectTarget, setRejectTarget] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveTarget, setApproveTarget] = useState<Payment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getPaymentAdminData({ limit: 300, status: status === "All" ? "" : status });
      const data = response.data as any;
      setPayments(data.payments || []);
      setTotals(data.totals || { total: 0, pending: 0, approved: 0, rejected: 0, revenueEtb: 0 });
      const normalized = normalizePaymentSettings(data.settings);
      setSettings(normalized);
      setSavedSettings(normalized);
    } catch (error: any) {
      toast({
        title: "Could not load payment records",
        description: error?.message || "Check your administrator permissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings],
  );

  const enabledMethodCount = settings.paymentMethods.filter((method) => method.enabled && method.name.trim()).length;

  const decide = async (payment: Payment, decision: "Approved" | "Rejected", reason = "") => {
    setBusyId(payment.id);
    try {
      await reviewPayment({ paymentId: payment.paymentId || payment.id, decision, reason });
      toast({
        title: decision === "Approved" ? "Payment approved" : "Payment rejected",
        description:
          decision === "Approved"
            ? settings.mode === "sandbox"
              ? "Sandbox approval recorded. No real access was granted."
              : "Lifetime access has been granted."
            : "The rejection reason has been saved.",
      });
      setApproveTarget(null);
      setRejectTarget(null);
      setRejectReason("");
      await load();
    } catch (error: any) {
      toast({
        title: "Could not review payment",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId("");
    }
  };

  const submitRejection = () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast({ title: "A reason is required", variant: "destructive" });
      return;
    }
    decide(rejectTarget, "Rejected", reason);
  };

  const saveSettings = async () => {
    if (!Number.isFinite(settings.priceEtb) || settings.priceEtb < 0) {
      toast({ title: "Enter a valid ETB price", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await savePaymentSettings({
        priceEtb: settings.priceEtb,
        enabled: settings.enabled,
        mode: settings.mode,
        instructions: settings.instructions,
        paymentMethods: settings.paymentMethods,
        freeAccess: settings.freeAccess,
        discounts: settings.discounts,
      });
      setSavedSettings(settings);
      toast({
        title: "Payment settings saved",
        description: "The changes are now live. A new price applies to new submissions only.",
      });
      await load();
    } catch (error: any) {
      toast({
        title: "Settings could not be saved",
        description: error?.message || "Only the main administrator can change payment settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const patchSettings = (patch: Partial<PaymentSettingsConfig>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const filtered = payments.filter((payment) => {
    const q = search.toLowerCase();
    return (
      !q ||
      [payment.userName, payment.email, payment.phone, payment.userId, payment.paymentId].some((value) =>
        String(value || "").toLowerCase().includes(q),
      )
    );
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payment Management</h1>
            <p className="text-sm text-muted-foreground">
              Review manual transfers, manage lifetime access approvals and configure the payment system.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={settings.mode === "sandbox" ? "secondary" : "default"}>
              {settings.mode === "sandbox" ? "Sandbox mode" : "Production mode"}
            </Badge>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="mt-1 text-2xl font-bold">{totals.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="mt-1 text-2xl font-bold">{totals.approved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Rejected</p>
              <p className="mt-1 text-2xl font-bold">{totals.rejected}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Recorded revenue</p>
              <p className="mt-1 text-2xl font-bold">{Number(totals.revenueEtb || 0).toLocaleString()} ETB</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "review" | "settings")}>
          <TabsList className="grid w-full grid-cols-2 sm:w-80">
            <TabsTrigger value="review">Review payments</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Review queue */}
          <TabsContent value="review" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Payment submissions</CardTitle>
                <Badge variant={settings.mode === "sandbox" ? "secondary" : "default"}>
                  {settings.mode === "sandbox" ? "Sandbox queue" : "Production queue"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid w-full grid-cols-4 gap-1 rounded-lg bg-muted p-1">
                  {(["Pending", "Approved", "Rejected", "All"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatus(value)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        status === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search name, email, phone or user ID"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">No payment submissions found.</div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((payment) => (
                      <div key={payment.id} className="space-y-3 rounded-xl border border-border/60 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{payment.userName || "Student"}</p>
                            <p className="text-xs text-muted-foreground">{payment.email || payment.userId}</p>
                            <p className="text-xs text-muted-foreground">{payment.phone || ""}</p>
                          </div>
                          <Badge
                            variant={
                              payment.status === "Approved"
                                ? "default"
                                : payment.status === "Rejected"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {payment.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Payment method</p>
                            <p>{payment.methodName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Expected</p>
                            <p>{Number(payment.expectedAmountEtb || 0).toLocaleString()} ETB</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Transferred</p>
                            <p>{Number(payment.amountPaidEtb || 0).toLocaleString()} ETB</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">User ID</p>
                            <p className="truncate">{payment.userId}</p>
                          </div>
                        </div>
                        {payment.receiptUrl && (
                          <a
                            className="inline-flex items-center gap-2 text-sm font-medium text-primary underline"
                            href={payment.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View receipt <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {payment.rejectionReason && (
                          <p className="text-sm text-destructive">Reason: {payment.rejectionReason}</p>
                        )}
                        {payment.status === "Pending" && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              className="btn-primary"
                              disabled={!!busyId}
                              onClick={() => setApproveTarget(payment)}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              disabled={!!busyId}
                              onClick={() => {
                                setRejectTarget(payment);
                                setRejectReason("");
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                            {busyId === payment.id && <Loader2 className="h-5 w-5 animate-spin" />}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-5">
            {!canManageSettings ? (
              <Alert className="border-border/60">
                <Lock className="h-4 w-4" />
                <AlertTitle>Read-only</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  You can review payments, but only the main administrator can change payment settings or grant
                  lifetime access.
                </AlertDescription>
              </Alert>
            ) : null}

            {settings.enabled && enabledMethodCount === 0 ? (
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No enabled payment methods</AlertTitle>
                <AlertDescription className="text-amber-900/80 dark:text-amber-200/80">
                  Payments are accepted but no method is enabled, so students cannot submit a receipt. Enable at least
                  one payment method below.
                </AlertDescription>
              </Alert>
            ) : null}

            <PaymentModeCard value={settings.mode} onChange={(mode) => patchSettings({ mode })} disabled={!canManageSettings} />

            <PaymentPriceCard
              price={settings.priceEtb}
              enabled={settings.enabled}
              onPriceChange={(priceEtb) => patchSettings({ priceEtb })}
              onEnabledChange={(enabled) => patchSettings({ enabled })}
              disabled={!canManageSettings}
            />

            <PaymentMethodsEditor
              value={settings.paymentMethods}
              onChange={(paymentMethods) => patchSettings({ paymentMethods })}
              disabled={!canManageSettings}
            />

            <InstructionsCard
              value={settings.instructions}
              onChange={(instructions) => patchSettings({ instructions })}
              disabled={!canManageSettings}
            />

            <FreeAccessSettings
              value={settings.freeAccess}
              onChange={(freeAccess) => patchSettings({ freeAccess })}
              disabled={!canManageSettings}
            />

            <DiscountSettings
              value={settings.discounts}
              onChange={(discounts) => patchSettings({ discounts })}
              disabled={!canManageSettings}
            />

            {canManageSettings ? (
              <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur">
                <p className="text-sm text-muted-foreground">
                  {dirty ? "You have unsaved changes." : "All changes are saved."}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setSettings(savedSettings)} disabled={!dirty || saving}>
                    <Undo2 className="mr-2 h-4 w-4" /> Reset
                  </Button>
                  <Button className="btn-primary" onClick={saveSettings} disabled={!dirty || saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save settings
                  </Button>
                </div>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve confirmation */}
      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve this payment?"
        description={
          settings.mode === "sandbox"
            ? "This is a sandbox approval. It records the review only and never grants real lifetime access."
            : "Approving grants permanent lifetime access to this student. This cannot be undone by changing settings later."
        }
        confirmLabel="Approve payment"
        loading={busyId === approveTarget?.id}
        onConfirm={() => approveTarget && decide(approveTarget, "Approved")}
      />

      {/* Reject reason dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this payment</DialogTitle>
            <DialogDescription>
              A rejection reason is required. The student will see it with their payment status.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            maxLength={500}
            value={rejectReason}
            placeholder="e.g. The receipt is unreadable or the amount does not match."
            onChange={(event) => setRejectReason(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={!!busyId}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitRejection}
              disabled={!!busyId || !rejectReason.trim()}
            >
              {busyId === rejectTarget?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Reject payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
