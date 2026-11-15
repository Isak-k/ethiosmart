import { useEffect, useState, type FormEvent } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import app from "@/integrations/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, CheckCircle2, Clock3, ShieldCheck, CreditCard } from "lucide-react";

const functions = getFunctions(app);
const getPaymentSettings = httpsCallable(functions, "getPaymentSettings");
const createReceiptUploadSignature = httpsCallable(functions, "createReceiptUploadSignature");
const quotePaymentDiscount = httpsCallable(functions, "quotePaymentDiscount");
const submitPayment = httpsCallable(functions, "submitPayment");
const getMyPayment = httpsCallable(functions, "getMyPayment");

type Method = { id: string; name: string; accountName?: string; accountNumber?: string; instructions?: string; enabled: boolean };

export default function StudentPayment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [methods, setMethods] = useState<Method[]>([]);
  const [price, setPrice] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [discountQuote, setDiscountQuote] = useState<any>(null);
  const [quoteReady, setQuoteReady] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [payment, setPayment] = useState<any>(null);
  const [access, setAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [settingsResult, myResult] = await Promise.all([getPaymentSettings(), getMyPayment()]);
        if (!active) return;
        const settings = settingsResult.data as any;
        const mine = myResult.data as any;
        setMethods((settings.paymentMethods || []).filter((m: Method) => m.enabled));
        setPrice(Number(settings.priceEtb || 0));
        setInstructions(settings.instructions || "");
        try {
          const quoteResult = await quotePaymentDiscount({ discountCode: "" });
          if (!active) return;
          setDiscountQuote(quoteResult.data as any);
          setQuoteReady(true);
        } catch (quoteError: any) {
          setQuoteReady(false);
          toast({ title: "Could not calculate your current discount", description: quoteError?.message || "Refresh the payment page before submitting.", variant: "destructive" });
        }
        setPayment(mine.payment || null);
        setAccess(mine.paymentAccess?.lifetime === true);
        const first = (settings.paymentMethods || []).find((m: Method) => m.enabled);
        if (first) setSelectedMethod(first.id);
      } catch (error: any) {
        toast({ title: "Could not load payment information", description: error?.message || "Please try again online.", variant: "destructive" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [toast]);

  const applyDiscount = async () => {
    setQuoting(true);
    try {
      const result = await quotePaymentDiscount({ discountCode });
      setDiscountQuote(result.data as any);
      setQuoteReady(true);
      toast({ title: "Discount updated", description: "The payable amount was calculated by the server." });
    } catch (error: any) {
      setDiscountQuote(null);
      setQuoteReady(false);
      toast({ title: "Discount not applied", description: error?.message || "Check the code and try again.", variant: "destructive" });
    } finally {
      setQuoting(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !receipt || !selectedMethod) return;
    if (!quoteReady) {
      toast({ title: "Confirm your payment amount", description: "Apply your discount code (or refresh the quote) before submitting the receipt.", variant: "destructive" });
      return;
    }
    if (!["image/jpeg", "image/png"].includes(receipt.type) || receipt.size > 5 * 1024 * 1024) {
      toast({ title: "Invalid receipt", description: "Choose a JPG or PNG image up to 5 MB.", variant: "destructive" });
      return;
    }
    const paid = Number(amount);
    if (!Number.isFinite(paid) || paid <= 0) {
      toast({ title: "Enter the transferred amount", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const paymentId = (globalThis.crypto?.randomUUID?.() || `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`).replace(/[^a-zA-Z0-9_-]/g, "");
      const signatureResult = await createReceiptUploadSignature({ paymentId });
      const signature = signatureResult.data as any;
      const form = new FormData();
      form.append("file", receipt);
      form.append("api_key", signature.apiKey);
      form.append("timestamp", String(signature.timestamp));
      form.append("folder", signature.folder);
      form.append("public_id", signature.publicId);
      form.append("signature", signature.signature);
      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: "POST", body: form });
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok || !uploaded.secure_url) throw new Error(uploaded.error?.message || "Receipt upload failed.");
      const digest = await crypto.subtle.digest("SHA-256", await receipt.arrayBuffer());
      const fingerprint = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
      await submitPayment({
        paymentId, methodId: selectedMethod, receiptUrl: uploaded.secure_url,
        receiptPublicId: uploaded.public_id, receiptFingerprint: fingerprint, amountPaid: paid, discountCode: discountCode.trim(),
      });
      setPayment({ status: "Pending", expectedAmountEtb: discountQuote?.finalAmountEtb ?? price, amountPaidEtb: paid, methodName: methods.find((m) => m.id === selectedMethod)?.name });
      setReceipt(null);
      toast({ title: "Receipt submitted", description: "Your payment is pending administrator review." });
    } catch (error: any) {
      toast({ title: "Submission failed", description: error?.message || "Please try again when connected.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLayout><div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-5">
        <div><h1 className="text-2xl font-bold">Payment & Access</h1><p className="text-sm text-muted-foreground">Unlock lifetime access to all learning content.</p></div>
        {access ? <Card className="border-emerald-500/40"><CardContent className="flex items-center gap-3 p-5"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><div><p className="font-semibold">Lifetime access active</p><p className="text-sm text-muted-foreground">Your approved access does not expire.</p></div><Badge>Approved</Badge></CardContent></Card> :
          payment?.status === "Pending" ? <Card><CardContent className="flex items-center gap-3 p-5"><Clock3 className="h-8 w-8 text-amber-500" /><div><p className="font-semibold">Payment under review</p><p className="text-sm text-muted-foreground">Your receipt has been submitted. We will notify you after review.</p></div><Badge variant="secondary">Pending</Badge></CardContent></Card> :
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Lifetime access</CardTitle><CardDescription>One-time payment. No recurring subscription.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl bg-primary/5 p-4 space-y-2">
                <p className="text-sm text-muted-foreground">Payment price</p>
                <p className="text-3xl font-bold">{(discountQuote?.finalAmountEtb ?? price).toLocaleString()} ETB</p>
                {discountQuote && <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">Original price: {Number(discountQuote.originalPriceEtb).toLocaleString()} ETB</p>
                  <p className="text-emerald-600">Discount: −{Number(discountQuote.discountEtb).toLocaleString()} ETB</p>
                  <p className="font-semibold">You should transfer: {Number(discountQuote.finalAmountEtb).toLocaleString()} ETB</p>
                  {discountQuote.discount?.label && <p className="text-xs text-muted-foreground">Applied: {discountQuote.discount.label}</p>}
                </div>}
              </div>
              {methods.length === 0 ? <p className="text-sm text-muted-foreground">Payment methods are not available yet. Please contact the administrator.</p> :
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-2"><Label>Choose payment method</Label><div className="grid gap-2 sm:grid-cols-2">{methods.map((method) => <button type="button" key={method.id} onClick={() => setSelectedMethod(method.id)} className={`rounded-xl border p-3 text-left transition ${selectedMethod === method.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}><span className="font-semibold">{method.name}</span>{method.accountName && <span className="block text-xs text-muted-foreground">{method.accountName}</span>}{method.accountNumber && <span className="block text-sm font-medium">{method.accountNumber}</span>}{method.instructions && <span className="mt-1 block text-xs text-muted-foreground">{method.instructions}</span>}</button>)}</div></div>
                  {instructions && <div className="rounded-lg bg-muted p-3 text-sm">{instructions}</div>}
                  <div className="space-y-2">
                    <Label htmlFor="discount-code">Discount code (optional)</Label>
                    <div className="flex gap-2">
                      <Input id="discount-code" value={discountCode} onChange={(e) => { setDiscountCode(e.target.value.toUpperCase()); setDiscountQuote(null); setQuoteReady(false); }} placeholder="Enter discount code" />
                      <Button type="button" variant="outline" onClick={applyDiscount} disabled={quoting}>{quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Your final price is recalculated and validated securely when you submit.</p>
                  </div>
                  <div className="space-y-2"><Label htmlFor="amount-paid">Amount transferred (ETB)</Label><Input id="amount-paid" type="number" min="1" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="receipt-file">Payment receipt (JPG or PNG, max 5 MB)</Label><Input id="receipt-file" type="file" accept="image/jpeg,image/png" required onChange={(e) => setReceipt(e.target.files?.[0] || null)} />{receipt && <p className="text-xs text-muted-foreground">{receipt.name} · {(receipt.size / 1024).toFixed(0)} KB</p>}</div>
                  <Button className="w-full" type="submit" disabled={submitting || !receipt || !selectedMethod || price <= 0 || !quoteReady}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading and submitting…</> : <><Upload className="mr-2 h-4 w-4" />Submit receipt</>}</Button>
                </form>}
              {payment?.status === "Rejected" && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><p className="font-semibold text-destructive">Previous receipt rejected</p><p>{payment.rejectionReason || "Please upload a correct receipt."}</p></div>}
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Receipts are uploaded securely. Access is granted only after administrator approval.</p>
            </CardContent>
          </Card>}
      </div>
    </DashboardLayout>
  );
}
