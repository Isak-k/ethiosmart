import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Wallet } from "lucide-react";

interface PaymentPriceCardProps {
  price: number;
  enabled: boolean;
  onPriceChange: (price: number) => void;
  onEnabledChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function PaymentPriceCard({
  price,
  enabled,
  onPriceChange,
  onEnabledChange,
  disabled,
}: PaymentPriceCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" /> Payment price
        </CardTitle>
        <CardDescription>The fixed one-time amount in Ethiopian Birr.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment-price">Fixed price (ETB)</Label>
            <Input
              id="payment-price"
              type="number"
              min="0"
              step="1"
              value={String(price)}
              disabled={disabled}
              onChange={(event) => onPriceChange(Math.max(0, Number(event.target.value) || 0))}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/50 px-4 py-3 sm:mt-6">
            <div className="pr-3">
              <Label htmlFor="accept-payments" className="cursor-pointer">Accept new payments</Label>
              <p className="text-xs text-muted-foreground">When off, students cannot submit new receipts.</p>
            </div>
            <Switch id="accept-payments" checked={enabled} disabled={disabled} onCheckedChange={onEnabledChange} />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How the price is applied</p>
          <p className="mt-1">
            A new price affects <span className="font-medium">newly submitted payments only</span>. Payments already
            submitted keep the amount that was recorded at the time of submission, and the price shown to a student
            is always the value in effect when they open the payment page. Changing the price never revokes existing
            lifetime access.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
