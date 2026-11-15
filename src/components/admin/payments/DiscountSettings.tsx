import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BadgePercent, Plus, Trash2 } from "lucide-react";
import type { DiscountKind, DiscountsConfig } from "./types";

interface DiscountSettingsProps {
  value: DiscountsConfig;
  onChange: (discounts: DiscountsConfig) => void;
  disabled?: boolean;
}

type Category = "codes" | "promotions" | "selectedUsers";

const KIND_LABELS: { value: DiscountKind; label: string }[] = [
  { value: "percentage", label: "Percentage (%)" },
  { value: "fixed", label: "Fixed amount (ETB)" },
];

export function DiscountSettings({ value, onChange, disabled }: DiscountSettingsProps) {
  const [pendingRemoval, setPendingRemoval] = useState<{ category: Category; index: number; label: string } | null>(null);

  const setCategory = (category: Category, items: unknown[]) => {
    onChange({ ...value, [category]: items } as DiscountsConfig);
  };

  const confirmRemove = () => {
    if (!pendingRemoval) return;
    const { category, index } = pendingRemoval;
    setCategory(category, value[category].filter((_, i) => i !== index));
    setPendingRemoval(null);
  };

  const kindSelect = (kind: DiscountKind, onKindChange: (kind: DiscountKind) => void, id: string) => (
    <Select value={kind} disabled={disabled} onValueChange={(next) => onKindChange(next as DiscountKind)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {KIND_LABELS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgePercent className="h-5 w-5" /> Discounts
        </CardTitle>
        <CardDescription>Define discount codes, automatic promotions and per-user discounts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Valid discounts are checked by the payment server. Only the single best eligible discount is applied;
          discounts are not stacked. Percentage values must be between 0 and 100.
        </p>

        {/* Discount codes */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Discount codes</h4>
              <p className="text-xs text-muted-foreground">Codes a student can enter themselves.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setCategory("codes", [...value.codes, { code: "", kind: "percentage", value: 0, enabled: true }])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add code
            </Button>
          </div>
          {value.codes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 py-4 text-center text-xs text-muted-foreground">
              No discount codes yet.
            </p>
          ) : (
            value.codes.map((entry, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor={`code-${index}`}>Code</Label>
                  <Input
                    id={`code-${index}`}
                    value={entry.code}
                    disabled={disabled}
                    placeholder="e.g. FRESH20"
                    onChange={(event) =>
                      setCategory("codes", value.codes.map((c, i) => (i === index ? { ...c, code: event.target.value.toUpperCase() } : c)))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`code-kind-${index}`}>Type</Label>
                  {kindSelect(entry.kind, (kind) => setCategory("codes", value.codes.map((c, i) => (i === index ? { ...c, kind } : c))), `code-kind-${index}`)}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`code-value-${index}`}>Value</Label>
                  <Input
                    id={`code-value-${index}`}
                    type="number"
                    min="0"
                    className="w-24"
                    value={String(entry.value)}
                    disabled={disabled}
                    onChange={(event) =>
                      setCategory("codes", value.codes.map((c, i) => (i === index ? { ...c, value: Math.max(0, Number(event.target.value) || 0) } : c)))
                    }
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch
                    checked={entry.enabled}
                    disabled={disabled}
                    onCheckedChange={(checked) => setCategory("codes", value.codes.map((c, i) => (i === index ? { ...c, enabled: checked } : c)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label="Remove discount code"
                    onClick={() => setPendingRemoval({ category: "codes", index, label: entry.code || "this code" })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Automatic promotions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Automatic promotions</h4>
              <p className="text-xs text-muted-foreground">Offers applied automatically when active.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setCategory("promotions", [...value.promotions, { label: "", kind: "percentage", value: 0, active: true }])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add promotion
            </Button>
          </div>
          {value.promotions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 py-4 text-center text-xs text-muted-foreground">
              No automatic promotions yet.
            </p>
          ) : (
            value.promotions.map((entry, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor={`promo-${index}`}>Label</Label>
                  <Input
                    id={`promo-${index}`}
                    value={entry.label}
                    disabled={disabled}
                    placeholder="e.g. New year offer"
                    onChange={(event) =>
                      setCategory("promotions", value.promotions.map((p, i) => (i === index ? { ...p, label: event.target.value } : p)))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`promo-kind-${index}`}>Type</Label>
                  {kindSelect(entry.kind, (kind) => setCategory("promotions", value.promotions.map((p, i) => (i === index ? { ...p, kind } : p))), `promo-kind-${index}`)}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`promo-value-${index}`}>Value</Label>
                  <Input
                    id={`promo-value-${index}`}
                    type="number"
                    min="0"
                    className="w-24"
                    value={String(entry.value)}
                    disabled={disabled}
                    onChange={(event) =>
                      setCategory("promotions", value.promotions.map((p, i) => (i === index ? { ...p, value: Math.max(0, Number(event.target.value) || 0) } : p)))
                    }
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch
                    checked={entry.active}
                    disabled={disabled}
                    onCheckedChange={(checked) => setCategory("promotions", value.promotions.map((p, i) => (i === index ? { ...p, active: checked } : p)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label="Remove promotion"
                    onClick={() => setPendingRemoval({ category: "promotions", index, label: entry.label || "this promotion" })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Selected users */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Discounts for selected users</h4>
              <p className="text-xs text-muted-foreground">A specific discount for an individual account.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setCategory("selectedUsers", [...value.selectedUsers, { identifier: "", kind: "percentage", value: 0 }])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add user
            </Button>
          </div>
          {value.selectedUsers.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 py-4 text-center text-xs text-muted-foreground">
              No per-user discounts yet.
            </p>
          ) : (
            value.selectedUsers.map((entry, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor={`user-${index}`}>User ID or email</Label>
                  <Input
                    id={`user-${index}`}
                    value={entry.identifier}
                    disabled={disabled}
                    placeholder="User ID or email"
                    onChange={(event) =>
                      setCategory("selectedUsers", value.selectedUsers.map((u, i) => (i === index ? { ...u, identifier: event.target.value } : u)))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`user-kind-${index}`}>Type</Label>
                  {kindSelect(entry.kind, (kind) => setCategory("selectedUsers", value.selectedUsers.map((u, i) => (i === index ? { ...u, kind } : u))), `user-kind-${index}`)}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`user-value-${index}`}>Value</Label>
                  <Input
                    id={`user-value-${index}`}
                    type="number"
                    min="0"
                    className="w-24"
                    value={String(entry.value)}
                    disabled={disabled}
                    onChange={(event) =>
                      setCategory("selectedUsers", value.selectedUsers.map((u, i) => (i === index ? { ...u, value: Math.max(0, Number(event.target.value) || 0) } : u)))
                    }
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label="Remove user discount"
                    onClick={() => setPendingRemoval({ category: "selectedUsers", index, label: entry.identifier || "this user" })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>
      </CardContent>

      <ConfirmDialog
        open={!!pendingRemoval}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        variant="destructive"
        title="Remove discount?"
        description={`"${pendingRemoval?.label ?? ""}" will be removed from the discount list.`}
        confirmLabel="Remove"
        onConfirm={confirmRemove}
      />
    </Card>
  );
}
