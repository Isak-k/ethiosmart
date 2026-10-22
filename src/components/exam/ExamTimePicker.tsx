/**
 * Exam Time Picker Component
 * Allows users to set custom time limit in minutes for exam mode
 * Fully responsive and theme-aware (works cleanly in light and dark mode)
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Timer } from 'lucide-react';

interface ExamTimePickerProps {
  defaultMinutes?: number;
  onConfirm: (minutes: number) => void;
  onCancel: () => void;
}

const PRESET_TIMES = [15, 30, 45, 60, 90, 120];

export function ExamTimePicker({ defaultMinutes = 60, onConfirm, onCancel }: ExamTimePickerProps) {
  const [customMinutes, setCustomMinutes] = useState<number>(defaultMinutes);
  const [useCustom, setUseCustom] = useState(false);

  const handlePresetClick = (minutes: number) => {
    setCustomMinutes(minutes);
    setUseCustom(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    if (value > 0) {
      setCustomMinutes(value);
      setUseCustom(true);
    }
  };

  const handleConfirm = () => {
    if (customMinutes > 0) {
      onConfirm(customMinutes);
    }
  };

  return (
    <Card className="w-full border border-border/80 bg-card rounded-2xl shadow-none">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-5">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-display font-bold text-foreground">
          <Clock className="h-5 w-5 text-primary" />
          Set Exam Time Limit
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground">
          Choose a preset or enter custom minutes for this assessment
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 px-4 sm:px-6 pb-5">
        {/* Preset Options */}
        <div className="space-y-2">
          <Label className="text-xs sm:text-sm font-semibold text-foreground">Quick Presets</Label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PRESET_TIMES.map((minutes) => (
              <Button
                key={minutes}
                type="button"
                variant={customMinutes === minutes && !useCustom ? 'default' : 'outline'}
                onClick={() => handlePresetClick(minutes)}
                className={`w-full rounded-xl text-xs sm:text-sm font-semibold h-9 ${
                  customMinutes === minutes && !useCustom
                    ? 'shadow-xs'
                    : 'border-border/80 hover:bg-accent'
                }`}
              >
                {minutes}m
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Input */}
        <div className="space-y-2">
          <Label htmlFor="custom-time" className="text-xs sm:text-sm font-semibold text-foreground">
            Or Custom Minutes
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="custom-time"
              type="number"
              min="1"
              max="480"
              value={customMinutes}
              onChange={handleCustomChange}
              placeholder="Enter minutes"
              className="flex-1 rounded-xl bg-card border-border/80 h-10 text-sm"
            />
            <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">
              minutes
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Allowable duration: 1 to 480 minutes (8 hours)
          </p>
        </div>

        {/* Selected Time Display (theme-aware) */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center justify-center gap-2 text-primary">
          <Timer className="w-4 h-4 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">
            Timer set to {customMinutes} {customMinutes === 1 ? 'minute' : 'minutes'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 justify-end pt-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl border-border/80 text-xs sm:text-sm">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={customMinutes <= 0}
            className="rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs text-xs sm:text-sm px-4"
          >
            Start Exam Mode
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
