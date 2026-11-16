import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { callBackend } from "@/lib/api/backend";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { EthioAccentBar } from "@/components/ui/EthioAccentBar";
import {
  Loader2,
  Upload,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  CreditCard,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  Building2,
  Smartphone,
  LockOpen,
  FileCheck,
  Flame,
  CheckCheck,
} from "lucide-react";

type Method = {
  id: string;
  name: string;
  accountName?: string;
  accountNumber?: string;
  instructions?: string;
  enabled: boolean;
  type?: string;
};

export default function StudentPayment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [methods, setMethods] = useState<Method[]>([]);
  const [price, setPrice] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [discountQuote, setDiscountQuote] = useState<any>(null);
  const [quoteReady, setQuoteReady] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [payment, setPayment] = useState<any>(null);
  const [access, setAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Auto-calculated payable amount
  const finalPayableAmount = discountQuote?.finalAmountEtb ?? price;
  const originalPrice = discountQuote?.originalPriceEtb ?? price;
  const discountSavings = discountQuote?.discountEtb ?? (originalPrice > finalPayableAmount ? originalPrice - finalPayableAmount : 0);
  const hasDiscount = discountSavings > 0;

  useEffect(() => {
    let active = true;
    (async () => {
      if (authLoading) return;

      try {
        const settings = await callBackend<any>('/api/payments/getPaymentSettings', {}, { optionalAuth: true });
        if (!active) return;
        const enabledMethods = (settings?.paymentMethods || []).filter((m: Method) => m.enabled);
        const configuredPrice = Number(settings?.priceEtb || 0);
        setMethods(enabledMethods);
        setPrice(configuredPrice);
        setInstructions(settings?.instructions || "");

        // Auto-select CBE first if available, else first enabled method
        const cbeMethod = enabledMethods.find((m: Method) =>
          m.id.toLowerCase().includes("cbe") || m.name.toLowerCase().includes("commercial")
        );
        const firstMethod = cbeMethod || enabledMethods[0];
        if (firstMethod && !selectedMethod) {
          setSelectedMethod(firstMethod.id);
        }

        if (user) {
          try {
            const mine = await callBackend<any>('/api/payments/getMyPayment');
            if (!active) return;
            setPayment(mine.payment || null);
            setAccess(mine.paymentAccess?.lifetime === true);
          } catch (paymentError: any) {
            console.error("Could not load student payment history:", paymentError);
          }

          if (settings?.enabled !== false && configuredPrice > 0) {
            try {
              const quoteResult = await callBackend<any>('/api/payments/quotePaymentDiscount', { discountCode: "" });
              if (!active) return;
              setDiscountQuote(quoteResult);
              setQuoteReady(true);
            } catch (quoteError: any) {
              if (!active) return;
              setQuoteReady(true);
            }
          } else {
            setDiscountQuote(null);
            setQuoteReady(true);
          }
        } else {
          setDiscountQuote(null);
          setQuoteReady(true);
        }
      } catch (error: any) {
        console.error("Could not load payment settings:", error);
        toast({
          title: "Could not load payment settings",
          description: error?.message || "Please refresh the page to retry.",
          variant: "destructive",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, authLoading, toast]);

  const applyDiscount = async () => {
    if (!user) {
      toast({ title: "Please sign in", description: "You must be signed in to apply a discount code.", variant: "destructive" });
      return;
    }
    if (!discountCode.trim()) {
      toast({ title: "Enter a code", description: "Please type your promo or discount code first.", variant: "destructive" });
      return;
    }
    setQuoting(true);
    try {
      const result = await callBackend<any>('/api/payments/quotePaymentDiscount', { discountCode: discountCode.trim() });
      setDiscountQuote(result);
      setQuoteReady(true);
      toast({
        title: "🎉 Promo Code Applied!",
        description: `You saved ${result.discountEtb} ETB! Your new total is ${result.finalAmountEtb} ETB.`,
      });
    } catch (error: any) {
      toast({
        title: "Invalid Promo Code",
        description: error?.message || "Check the code spelling and try again.",
        variant: "destructive",
      });
    } finally {
      setQuoting(false);
    }
  };

  const copyToClipboard = (text: string, fieldId: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast({
      title: "Copied!",
      description: `${label}: ${text}`,
    });
    setTimeout(() => {
      setCopiedField((curr) => (curr === fieldId ? null : curr));
    }, 2500);
  };

  const handleReceiptChange = (file: File | null) => {
    setReceipt(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ title: "Please sign in first", variant: "destructive" });
      return;
    }
    if (!receipt || !selectedMethod) {
      toast({ title: "Missing Receipt or Method", description: "Please pick your payment method and upload the transfer receipt screenshot.", variant: "destructive" });
      return;
    }
    if (!["image/jpeg", "image/png"].includes(receipt.type) || receipt.size > 5 * 1024 * 1024) {
      toast({ title: "Invalid receipt format", description: "Choose a JPG or PNG screenshot up to 5 MB.", variant: "destructive" });
      return;
    }

    const autoAmount = finalPayableAmount;
    if (!Number.isFinite(autoAmount) || autoAmount <= 0) {
      toast({ title: "Invalid amount", description: "Please wait for payment settings to finish loading.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const paymentId = (globalThis.crypto?.randomUUID?.() || `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`).replace(/[^a-zA-Z0-9_-]/g, "");
      const signature = await callBackend<any>('/api/payments/createReceiptUploadSignature', { paymentId });
      let uploadedUrl = "";
      let uploadedPublicId = signature.publicId;

      if (signature.isLocal) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(receipt);
        });

        const uploadResult = await callBackend<any>('/api/payments/uploadReceiptDev', {
          paymentId,
          publicId: signature.publicId,
          base64,
          contentType: receipt.type,
        });

        uploadedUrl = uploadResult.secure_url;
        uploadedPublicId = uploadResult.public_id || signature.publicId;
      } else {
        const form = new FormData();
        form.append("file", receipt);
        form.append("api_key", signature.apiKey);
        form.append("timestamp", String(signature.timestamp));
        form.append("folder", signature.folder);
        form.append("public_id", signature.publicId);
        form.append("signature", signature.signature);

        const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, {
          method: "POST",
          body: form,
        });
        const uploaded = await uploadResponse.json();
        if (!uploadResponse.ok || !uploaded.secure_url) {
          throw new Error(uploaded.error?.message || "Receipt upload failed.");
        }
        uploadedUrl = uploaded.secure_url;
        uploadedPublicId = uploaded.public_id;
      }

      const digest = await crypto.subtle.digest("SHA-256", await receipt.arrayBuffer());
      const fingerprint = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");

      await callBackend('/api/payments/submitPayment', {
        paymentId,
        methodId: selectedMethod,
        receiptUrl: uploadedUrl,
        receiptPublicId: uploadedPublicId,
        receiptFingerprint: fingerprint,
        amountPaid: autoAmount,
        discountCode: discountCode.trim(),
      });

      setPayment({
        status: "Pending",
        expectedAmountEtb: autoAmount,
        amountPaidEtb: autoAmount,
        methodName: methods.find((m) => m.id === selectedMethod)?.name,
      });
      setReceipt(null);
      setReceiptPreview(null);
      toast({
        title: "🎉 Receipt Submitted!",
        description: "Your payment is under fast review. You will receive full access right after approval!",
      });
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error?.message || "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activeMethod = methods.find((m) => m.id === selectedMethod) || methods[0];

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-xs font-medium animate-pulse">Loading payment methods...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-xl px-2 sm:px-0 space-y-4 sm:space-y-5 pb-10">
        {/* Ethio Accent Strip */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 to-amber-500 opacity-80" />

        {/* Compact Header matching App Theme */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-0.5 text-xs font-bold border border-primary/20">
              <Flame className="h-3.5 w-3.5" />
              Special Student Offer
            </span>
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 100% Genuine
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Upgrade to Lifetime Access
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              One-time payment. Unlock <strong>all subjects, chapters 2–12</strong>, and <strong>15,000+ past matric questions</strong> with instant step-by-step answers.
            </p>
          </div>
        </div>

        {/* Welcome Notification for New Signups */}
        {searchParams.get("welcome") === "true" && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 shadow-xs flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Free Trial Active (Chapter 1)</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                You can try Chapter 1 freely or upgrade now for all chapters.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-emerald-600 text-emerald-700 dark:text-emerald-300 shrink-0 font-semibold"
              onClick={() => navigate("/dashboard/exams")}
            >
              Try Free <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Status: Already Approved */}
        {access ? (
          <Card className="border-emerald-500/40 bg-emerald-500/5 shadow-xs">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/20 p-2.5 text-emerald-600">
                  <CheckCheck className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground">Lifetime Access Active</h3>
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] h-5">Approved</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All exams, notes, and questions are permanently unlocked.
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate("/dashboard/exams")} size="sm" className="w-full sm:w-auto font-semibold">
                Start Practicing <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : payment?.status === "Pending" ? (
          /* Status: Under Review */
          <Card className="border-amber-500/40 bg-amber-500/5 shadow-xs">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/20 p-2.5 text-amber-600 animate-pulse">
                  <Clock3 className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground">Receipt Under Review</h3>
                    <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    We received your transfer ({payment.amountPaidEtb || payment.expectedAmountEtb} ETB). You will be notified immediately upon approval.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/exams")} className="w-full sm:w-auto text-xs font-semibold">
                Explore Free Trial <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Main Checkout Form */
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3 border-b border-border/70 bg-gradient-to-r from-emerald-100 to-amber-100">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Fast Payment & Access
              </CardTitle>
              <CardDescription className="text-xs">
                Send the exact amount via your bank or Telebirr and submit your receipt screenshot.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-5">
              {/* STEP 1: Auto-Calculated Amount Box */}
              <div className="rounded-xl border border-border bg-muted/40 p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Step 1 • Transfer Amount
                  </span>
                  {hasDiscount && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold">
                      <Sparkles className="h-2.5 w-2.5" /> Save {discountSavings.toLocaleString()} ETB
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                    {finalPayableAmount.toLocaleString()} <span className="text-base font-bold text-primary">ETB</span>
                  </span>
                  {hasDiscount && (
                    <span className="text-sm text-muted-foreground line-through">
                      {originalPrice.toLocaleString()} ETB
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto font-medium">One-Time Only</span>
                </div>

                {/* Promo Code Input */}
                <div className="pt-2 border-t border-border/60 flex items-center gap-2">
                  <Input
                    id="discount-code"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="PROMO CODE (OPTIONAL)"
                    className="h-8 text-xs font-mono uppercase bg-background"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-bold px-3 shrink-0"
                    onClick={applyDiscount}
                    disabled={quoting}
                  >
                    {quoting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              </div>

              {/* STEP 2: Clickable Payment Method Selection */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Step 2 • Choose Payment Method
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Click to select</span>
                </div>

                {methods.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Loading payment options...</p>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {methods.map((method) => {
                      const isSelected = selectedMethod === method.id;
                      const isCBE = method.id.toLowerCase().includes("cbe") || method.name.toLowerCase().includes("commercial");
                      const isTelebirr = method.id.toLowerCase().includes("telebirr") || method.name.toLowerCase().includes("tele");

                      return (
                        <div
                          key={method.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedMethod(method.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              setSelectedMethod(method.id);
                            }
                          }}
                          className={`relative cursor-pointer rounded-xl border p-3 transition text-left outline-hidden ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1.5 ring-primary shadow-xs"
                              : "border-border bg-card hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              {isCBE ? (
                                <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                              ) : isTelebirr ? (
                                <Smartphone className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                              ) : (
                                <CreditCard className="h-4 w-4 text-primary shrink-0" />
                              )}
                              <span className="font-bold text-xs sm:text-sm text-foreground">{method.name}</span>
                            </div>
                            {isSelected ? (
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </span>
                            ) : (
                              <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
                            )}
                          </div>

                          {method.accountNumber && (
                            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 mt-2">
                              <span className="font-mono text-xs font-bold text-foreground">
                                {method.accountNumber}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 hover:bg-primary/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(method.accountNumber!, method.id, `${method.name} Account`);
                                }}
                              >
                                {copiedField === method.id ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          )}

                          {method.accountName && (
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">
                              Name: <strong className="text-foreground">{method.accountName}</strong>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Method Details & Quick Copy */}
              {activeMethod && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-primary font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Transfer via {activeMethod.name}
                    </span>
                    <span className="font-bold text-foreground">
                      Amount: <span className="text-primary">{finalPayableAmount} ETB</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-card rounded-lg p-2 border border-border">
                    <div className="truncate mr-2">
                      <span className="block text-[10px] text-muted-foreground uppercase">Recipient</span>
                      <span className="font-semibold text-xs truncate block">{activeMethod.accountName || "EthioSmart"}</span>
                    </div>
                    {activeMethod.accountNumber && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-bold shrink-0"
                        onClick={() => copyToClipboard(activeMethod.accountNumber!, "summary", "Account")}
                      >
                        {copiedField === "summary" ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Copied
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Copy className="h-3 w-3" /> Copy {activeMethod.accountNumber}
                          </span>
                        )}
                      </Button>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    {activeMethod.instructions || instructions || "Transfer the exact amount above and upload your receipt screenshot below."}
                  </p>
                </div>
              )}

              {/* STEP 3: Receipt Screenshot Upload */}
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="receipt-file" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Step 3 • Upload Receipt Screenshot</span>
                    <span className="text-[10px] text-muted-foreground font-normal">JPG/PNG, max 5 MB</span>
                  </Label>

                  <div className="relative rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition p-4 bg-muted/20 text-center">
                    <input
                      id="receipt-file"
                      type="file"
                      accept="image/jpeg,image/png"
                      required
                      onChange={(e) => handleReceiptChange(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />

                    {receiptPreview ? (
                      <div className="flex flex-col items-center justify-center space-y-1.5 py-1">
                        <img
                          src={receiptPreview}
                          alt="Receipt Preview"
                          className="h-28 object-contain rounded-md border shadow-xs"
                        />
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <FileCheck className="h-3.5 w-3.5" />
                          <span>{receipt?.name} ({(receipt?.size ? receipt.size / 1024 : 0).toFixed(0)} KB)</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Tap to replace image</span>
                      </div>
                    ) : (
                      <div className="py-3 space-y-1.5">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Upload className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-bold text-foreground">Tap here to choose receipt photo</p>
                        <p className="text-[11px] text-muted-foreground">Screenshot of CBE Birr or Telebirr transfer</p>
                      </div>
                    )}
                  </div>
                </div>

                {payment?.status === "Rejected" && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs">
                    <p className="font-semibold text-destructive">Previous receipt rejected:</p>
                    <p className="text-muted-foreground mt-0.5">{payment.rejectionReason || "Please upload a clear screenshot of your transaction."}</p>
                  </div>
                )}

                {/* Big Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-11 rounded-xl text-sm font-bold shadow-md transition hover:opacity-95"
                  disabled={submitting || !receipt || !selectedMethod || finalPayableAmount <= 0}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting Receipt...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Submit Receipt ({finalPayableAmount} ETB)
                    </>
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Verified by EthioSmart administration. Fast activation guaranteed.</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
