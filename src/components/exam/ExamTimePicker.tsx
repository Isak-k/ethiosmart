/**
 * Exam Time Picker Component
 * Allows users to set custom time limit in minutes for exam mode
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Set Time Limit
        </CardTitle>
        <CardDescription>
          How many minutes do you want for this exam?
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Preset Options */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quick Select</Label>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_TIMES.map((minutes) => (
              <Button
                key={minutes}
                variant={customMinutes === minutes && !useCustom ? 'default' : 'outline'}
                onClick={() => handlePresetClick(minutes)}
                className="w-full"
              >
                {minutes}m
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Input */}
        <div className="space-y-2">
          <Label htmlFor="custom-time" className="text-sm font-medium">
            Or Enter Custom Time
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
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">minutes</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum: 1 minute, Maximum: 480 minutes (8 hours)
          </p>
        </div>

        {/* Selected Time Display */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-center">
            <span className="font-semibold text-blue-900">
              Selected time: {customMinutes} minutes
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={customMinutes <= 0}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
