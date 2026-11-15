import { useCallback, useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import app from "@/integrations/firebase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Wallet, ExternalLink, Search } from "lucide-react";

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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totals, setTotals] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, revenueEtb: 0 });
  const [price, setPrice] = useState("0");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getPaymentAdminData({ limit: 300, status: status === "All" ? "" : status });
      const data = response.data as any;
      setPayments(data.payments || []);
      setTotals(data.totals || { total: 0, pending: 0, approved: 0, rejected: 0, revenueEtb: 0 });
      setPrice(String(data.settings?.priceEtb ?? 0));
      setEnabled(data.settings?.enabled !== false);
    } catch (error: any) {
      toast({ title: "Could not load payment records", description: error?.message || "Check your administrator permissions.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => { load(); }, [load]);

  const decide = async (payment: Payment, decision: "Approved" | "Rejected") => {
    let reason = "";
    if (decision === "Rejected") {
      const value = window.prompt("Enter the reason for rejecting this receipt:");
      if (value === null) return;
      reason = value.trim();
      if (!reason) {
        toast({ title: "A reason is required", variant: "destructive" });
        return;
      }
    }
    setBusyId(payment.id);
    try {
      await reviewPayment({ paymentId: payment.paymentId || payment.id, decision, reason });
      toast({ title: decision === "Approved" ? "Payment approved" : "Payment rejected", description: decision === "Approved" ? "Lifetime access has been granted." : "The rejection reason has been saved." });
      await load();
    } catch (error: any) {
      toast({ title: "Could not review payment", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusyId("");
    }
  };

  const savePrice = async () => {
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: "Enter a valid ETB amount", variant: "destructive" });
      return;
    }
    try {
      await savePaymentSettings({ priceEtb: amount, enabled });
      toast({ title: "Payment settings saved", description: "The new price applies to new payment submissions." });
      await load();
    } catch (error: any) {
      toast({ title: "Settings could not be saved", description: error?.message || "Only the main administrator can change these settings.", variant: "destructive" });
    }
  };

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    return !q || [p.userName, p.email, p.phone, p.userId, p.paymentId].some((v) => String(v || "").toLowerCase().includes(q));
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payment Management</h1>
            <p className="text-sm text-muted-foreground">Review manual transfers and manage lifetime access approvals.</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="mt-1 text-2xl font-bold">{totals.pending}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Approved</p><p className="mt-1 text-2xl font-bold">{totals.approved}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Rejected</p><p className="mt-1 text-2xl font-bold">{totals.rejected}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recorded revenue</p><p className="mt-1 text-2xl font-bold">{totals.revenueEtb.toLocaleString()} ETB</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Payment price</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2"><label className="text-sm font-medium">Fixed price (ETB)</label><Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Accept new payments</label>
            <Button onClick={savePrice}>Save price</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment submissions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={status} onValueChange={setStatus}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="Pending">Pending</TabsTrigger>
                <TabsTrigger value="Approved">Approved</TabsTrigger>
                <TabsTrigger value="Rejected">Rejected</TabsTrigger>
                <TabsTrigger value="All">All</TabsTrigger>
              </TabsList>
              <TabsContent value={status} className="space-y-4">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search name, email, phone or user ID" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                {loading ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin" /></div> : filtered.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No payment submissions found.</div> : (
                  <div className="space-y-3">
                    {filtered.map((payment) => (
                      <div key={payment.id} className="rounded-xl border p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div><p className="font-semibold">{payment.userName || "Student"}</p><p className="text-xs text-muted-foreground">{payment.email || payment.userId}</p><p className="text-xs text-muted-foreground">{payment.phone || ""}</p></div>
                          <Badge variant={payment.status === "Approved" ? "default" : payment.status === "Rejected" ? "destructive" : "secondary"}>{payment.status}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                          <div><p className="text-xs text-muted-foreground">Payment method</p><p>{payment.methodName}</p></div>
                          <div><p className="text-xs text-muted-foreground">Expected</p><p>{Number(payment.expectedAmountEtb || 0).toLocaleString()} ETB</p></div>
                          <div><p className="text-xs text-muted-foreground">Transferred</p><p>{Number(payment.amountPaidEtb || 0).toLocaleString()} ETB</p></div>
                          <div><p className="text-xs text-muted-foreground">User ID</p><p className="truncate">{payment.userId}</p></div>
                        </div>
                        {payment.receiptUrl && <a className="inline-flex items-center gap-2 text-sm font-medium text-primary underline" href={payment.receiptUrl} target="_blank" rel="noreferrer">View receipt <ExternalLink className="h-3.5 w-3.5" /></a>}
                        {payment.rejectionReason && <p className="text-sm text-destructive">Reason: {payment.rejectionReason}</p>}
                        {payment.status === "Pending" && <div className="flex flex-wrap gap-2"><Button disabled={!!busyId} onClick={() => decide(payment, "Approved")}><CheckCircle2 className="mr-2 h-4 w-4" />Approve</Button><Button variant="destructive" disabled={!!busyId} onClick={() => decide(payment, "Rejected")}><XCircle className="mr-2 h-4 w-4" />Reject</Button>{busyId === payment.id && <Loader2 className="h-5 w-5 animate-spin" />}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
