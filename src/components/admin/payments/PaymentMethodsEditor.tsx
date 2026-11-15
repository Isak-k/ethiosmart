import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Wallet, Plus, Trash2 } from "lucide-react";
import { PAYMENT_METHOD_TYPES, type PaymentMethodConfig } from "./types";

interface PaymentMethodsEditorProps {
  value: PaymentMethodConfig[];
  onChange: (methods: PaymentMethodConfig[]) => void;
  disabled?: boolean;
}

function newMethodId(): string {
  const suffix = (globalThis.crypto?.randomUUID?.() || String(Date.now())).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  return `method-${suffix}`;
}

export function PaymentMethodsEditor({ value, onChange, disabled }: PaymentMethodsEditorProps) {
  const [pendingRemoval, setPendingRemoval] = useState<{ index: number; name: string } | null>(null);

  const update = (index: number, patch: Partial<PaymentMethodConfig>) => {
    onChange(value.map((method, i) => (i === index ? { ...method, ...patch } : method)));
  };

  const addMethod = () => {
    onChange([
      ...value,
      {
        id: newMethodId(),
        name: "",
        type: "mobile_money",
        accountName: "",
        accountNumber: "",
        instructions: "",
        enabled: false,
      },
    ]);
  };

  const confirmRemove = () => {
    if (!pendingRemoval) return;
    onChange(value.filter((_, i) => i !== pendingRemoval.index));
    setPendingRemoval(null);
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" /> Payment methods
            </CardTitle>
            <CardDescription>
              Add, edit, enable or disable the accounts students can pay into. Only enabled methods are shown to
              students.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addMethod} disabled={disabled}>
            <Plus className="mr-1 h-4 w-4" /> Add method
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {value.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
            No payment methods configured. Add at least one so students can pay.
          </div>
        ) : (
          value.map((method, index) => (
            <div key={method.id || index} className="space-y-4 rounded-xl border border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{method.name?.trim() || "Untitled method"}</span>
                  <Badge variant={method.enabled ? "default" : "secondary"}>
                    {method.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`method-enabled-${index}`}
                      checked={method.enabled}
                      disabled={disabled}
                      onCheckedChange={(checked) => update(index, { enabled: checked })}
                    />
                    <Label htmlFor={`method-enabled-${index}`} className="text-xs text-muted-foreground">
                      Enabled
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={() => setPendingRemoval({ index, name: method.name?.trim() || "this method" })}
                    aria-label="Remove payment method"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`method-name-${index}`}>Method name</Label>
                  <Input
                    id={`method-name-${index}`}
                    value={method.name}
                    disabled={disabled}
                    placeholder="e.g. CBE Birr"
                    onChange={(event) => update(index, { name: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`method-type-${index}`}>Type</Label>
                  <Select
                    value={PAYMENT_METHOD_TYPES.some((t) => t.value === method.type) ? method.type : "other"}
                    disabled={disabled}
                    onValueChange={(next) => update(index, { type: next })}
                  >
                    <SelectTrigger id={`method-type-${index}`}>
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`method-account-name-${index}`}>Account name</Label>
                  <Input
                    id={`method-account-name-${index}`}
                    value={method.accountName}
                    disabled={disabled}
                    placeholder="Name on the account"
                    onChange={(event) => update(index, { accountName: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`method-account-number-${index}`}>Account number</Label>
                  <Input
                    id={`method-account-number-${index}`}
                    value={method.accountNumber}
                    disabled={disabled}
                    placeholder="Account or phone number"
                    onChange={(event) => update(index, { accountNumber: event.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`method-instructions-${index}`}>Method instructions</Label>
                <Textarea
                  id={`method-instructions-${index}`}
                  rows={2}
                  maxLength={1000}
                  value={method.instructions}
                  disabled={disabled}
                  placeholder="Shown when the student selects this method."
                  onChange={(event) => update(index, { instructions: event.target.value })}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>

      <ConfirmDialog
        open={!!pendingRemoval}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        variant="destructive"
        title="Remove payment method?"
        description={`"${pendingRemoval?.name ?? ""}" will be removed. Students will no longer see it when paying.`}
        confirmLabel="Remove"
        onConfirm={confirmRemove}
      />
    </Card>
  );
}
