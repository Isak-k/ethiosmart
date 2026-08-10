/**
 * Practice Exam Configuration Component
 * Admin UI to configure practice exam settings
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import type { PracticeExamConfig as PracticeExamConfigType, PracticeModeType, Exam } from '@/integrations/firebase/types';

export interface PracticeExamConfigProps {
  exam: Exam;
  onSave: (config: PracticeExamConfigType) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function PracticeExamConfig({
  exam,
  onSave,
  onCancel,
  loading = false,
}: PracticeExamConfigProps) {
  const [isPracticeExam, setIsPracticeExam] = useState(exam.examType === 'practice');
  const [practiceMode, setPracticeMode] = useState<PracticeModeType>(exam.practiceMode || 'practice');
  const [showFeedback, setShowFeedback] = useState(exam.practiceConfig?.showFeedback ?? true);
  const [showExplanations, setShowExplanations] = useState(exam.practiceConfig?.showExplanations ?? true);
  const [timerEnabled, setTimerEnabled] = useState(exam.practiceConfig?.timerEnabled ?? false);
  const [timeLimit, setTimeLimit] = useState(exam.practiceConfig?.timeLimit ?? exam.durationMinutes * 60);
  const [passingScore, setPassingScore] = useState(exam.practiceConfig?.passingScore ?? 50);
  const [allowOfflineDownload, setAllowOfflineDownload] = useState(exam.allowOfflineDownload ?? false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    try {
      const config: PracticeExamConfigType = {
        mode: isPracticeExam ? 'practice' : practiceMode,
        showFeedback: isPracticeExam ? showFeedback : false,
        showExplanations: isPracticeExam ? showExplanations : false,
        timerEnabled: isPracticeExam && practiceMode === 'exam' ? true : (timerEnabled && practiceMode === 'exam'),
        timeLimit: timerEnabled ? timeLimit : undefined,
        passingScore,
      };

      await onSave(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Practice Exam Configuration</CardTitle>
            <CardDescription>{exam.title}</CardDescription>
          </div>
          {saved && (
            <Badge className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Exam Type Selection */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Exam Type</Label>
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Switch
              id="practice-exam"
              checked={isPracticeExam}
              onCheckedChange={setIsPracticeExam}
            />
            <Label htmlFor="practice-exam" className="flex-1 cursor-pointer">
              <span className="font-medium">Practice Exam</span>
              <p className="text-sm text-gray-600">
                {isPracticeExam
                  ? 'Offline-capable exam with selected mode'
                  : 'Standard online exam'}
              </p>
            </Label>
          </div>
        </div>

        {/* Practice Mode Selection (only if practice exam) */}
        {isPracticeExam && (
          <div className="space-y-3">
            <Label className="text-base font-semibold">Practice Mode</Label>
            <RadioGroup value={practiceMode} onValueChange={(v) => setPracticeMode(v as PracticeModeType)}>
              <div className="space-y-3">
                {/* Practice Mode - Instant Feedback */}
                <div className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer">
                  <RadioGroupItem value="practice" id="mode-practice" className="mt-1" />
                  <Label htmlFor="mode-practice" className="flex-1 cursor-pointer">
                    <span className="font-medium">Practice Mode (Learning)</span>
                    <p className="text-sm text-gray-600">
                      Instant feedback, show explanations, no timer. Best for learning.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        ✓ Instant Feedback
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        ✓ Explanations
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        ✗ No Timer
                      </Badge>
                    </div>
                  </Label>
                </div>

                {/* Exam Mode - Timed, No Feedback */}
                <div className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-amber-300 cursor-pointer">
                  <RadioGroupItem value="exam" id="mode-exam" className="mt-1" />
                  <Label htmlFor="mode-exam" className="flex-1 cursor-pointer">
                    <span className="font-medium">Exam Mode (Assessment)</span>
                    <p className="text-sm text-gray-600">
                      Timed exam, no feedback, summary results only. Best for assessment.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        ⏱ Timer
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        ✗ No Feedback
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        📊 Summary Only
                      </Badge>
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Feedback Settings (Practice Mode Only) */}
        {isPracticeExam && practiceMode === 'practice' && (
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Label className="text-base font-semibold">Feedback Settings</Label>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-feedback" className="flex-1">
                <span className="font-medium">Show Instant Feedback</span>
                <p className="text-sm text-gray-600">Show if answer is correct/incorrect immediately</p>
              </Label>
              <Switch id="show-feedback" checked={showFeedback} onCheckedChange={setShowFeedback} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-explanations" className="flex-1">
                <span className="font-medium">Show Explanations</span>
                <p className="text-sm text-gray-600">Display explanation text after answering</p>
              </Label>
              <Switch id="show-explanations" checked={showExplanations} onCheckedChange={setShowExplanations} />
            </div>
          </div>
        )}

        {/* Timer Settings (Exam Mode Only) */}
        {isPracticeExam && practiceMode === 'exam' && (
          <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <Label className="text-base font-semibold">Timer Settings</Label>

            <div className="flex items-center justify-between">
              <Label htmlFor="timer-enabled" className="flex-1">
                <span className="font-medium">Enable Countdown Timer</span>
                <p className="text-sm text-gray-600">Show countdown timer during exam</p>
              </Label>
              <Switch id="timer-enabled" checked={timerEnabled} onCheckedChange={setTimerEnabled} />
            </div>

            {timerEnabled && (
              <div className="space-y-2">
                <Label htmlFor="time-limit">
                  <span className="font-medium">Time Limit: {Math.floor(timeLimit / 60)} minutes</span>
                </Label>
                <Slider
                  id="time-limit"
                  min={60}
                  max={300}
                  step={60}
                  value={[timeLimit]}
                  onValueChange={(v) => setTimeLimit(v[0])}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">Range: 1-5 minutes</p>
              </div>
            )}
          </div>
        )}

        {/* Passing Score */}
        <div className="space-y-3">
          <Label htmlFor="passing-score">
            <span className="font-medium">Passing Score: {passingScore}%</span>
          </Label>
          <Slider
            id="passing-score"
            min={10}
            max={100}
            step={5}
            value={[passingScore]}
            onValueChange={(v) => setPassingScore(v[0])}
            className="w-full"
          />
          <p className="text-sm text-gray-600">Score needed to pass the exam</p>
        </div>

        {/* Offline Download */}
        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
          <Label htmlFor="offline-download" className="flex-1">
            <span className="font-medium">Allow Offline Download</span>
            <p className="text-sm text-gray-600">Students can download this exam for offline use</p>
          </Label>
          <Switch id="offline-download" checked={allowOfflineDownload} onCheckedChange={setAllowOfflineDownload} />
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Note:</strong> Practice exams require students to choose a mode (Practice or Exam) before taking the exam.
            Results will be displayed differently based on the selected mode.
          </AlertDescription>
        </Alert>

        {/* Summary */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="font-semibold mb-2">Configuration Summary:</p>
          <ul className="text-sm space-y-1 text-gray-700">
            <li>• Exam Type: {isPracticeExam ? 'Practice (Offline-capable)' : 'Normal (Online)'}</li>
            {isPracticeExam && (
              <>
                <li>
                  • Mode: {practiceMode === 'practice' ? 'Learning (Instant Feedback)' : 'Assessment (Timed)'}
                </li>
                {practiceMode === 'practice' && (
                  <>
                    <li>• Feedback: {showFeedback ? 'Shown' : 'Hidden'}</li>
                    <li>• Explanations: {showExplanations ? 'Shown' : 'Hidden'}</li>
                  </>
                )}
                {practiceMode === 'exam' && (
                  <li>• Timer: {timerEnabled ? `${Math.floor(timeLimit / 60)} minutes` : 'Disabled'}</li>
                )}
              </>
            )}
            <li>• Passing Score: {passingScore}%</li>
            <li>• Offline Download: {allowOfflineDownload ? 'Enabled' : 'Disabled'}</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
