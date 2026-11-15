import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquareText } from "lucide-react";

interface InstructionsCardProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function InstructionsCard({ value, onChange, disabled }: InstructionsCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5" /> Payment instructions
        </CardTitle>
        <CardDescription>General guidance shown to students on the payment page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="payment-instructions">Instructions</Label>
          <Textarea
            id="payment-instructions"
            rows={4}
            maxLength={3000}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Choose a payment method, transfer the displayed amount, and upload a clear receipt."
          />
          <p className="text-xs text-muted-foreground">
            These instructions appear when a student selects a payment method. Each payment method can also carry
            its own method-specific instructions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
