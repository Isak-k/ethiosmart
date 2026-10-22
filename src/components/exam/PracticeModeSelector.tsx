/**
 * Practice Mode Selector Component
 * Allows user to choose between Practice mode and Exam mode
 * Fully responsive on mobile & desktop, and fully compatible with light/dark modes
 */

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Clock, CheckCircle2, Check, X, Sparkles, Info } from 'lucide-react';
import { ExamTimePicker } from './ExamTimePicker';

export type PracticeModeType = 'practice' | 'exam';

export interface PracticeModeFeature {
  text: string;
  type: 'check' | 'cross' | 'clock';
}

export interface PracticeModeOption {
  mode: PracticeModeType;
  title: string;
  tagline: string;
  description: string;
  features: PracticeModeFeature[];
  icon: React.ReactNode;
  badge: string;
}

export const PRACTICE_MODE_OPTIONS: PracticeModeOption[] = [
  {
    mode: 'practice',
    title: 'Practice Mode',
    tagline: 'Interactive Learning',
    description: 'Get instant feedback on each question with full explanations',
    features: [
      { text: 'Instant answer validation (Correct/Incorrect)', type: 'check' },
      { text: 'Comprehensive step-by-step explanations', type: 'check' },
      { text: 'Untimed session (learn at your own pace)', type: 'check' },
      { text: 'Review and correct mistakes immediately', type: 'check' },
    ],
    icon: <Lightbulb className="h-6 w-6" />,
    badge: 'Recommended for Study',
  },
  {
    mode: 'exam',
    title: 'Exam Mode',
    tagline: 'Real Assessment',
    description: 'Simulate a real test with a countdown timer and delayed results',
    features: [
      { text: 'Customizable countdown timer', type: 'clock' },
      { text: 'Strict exam simulation conditions', type: 'check' },
      { text: 'No instant answers or hints during test', type: 'cross' },
      { text: 'Detailed score summary upon final submission', type: 'check' },
    ],
    icon: <Clock className="h-6 w-6" />,
    badge: 'Test Your Knowledge',
  },
];

export interface PracticeModeDialogProps {
  open: boolean;
  examTitle?: string;
  durationMinutes?: number;
  onSelect: (mode: PracticeModeType, customTimeLimit?: number) => void;
  onCancel: () => void;
}

/**
 * Practice Mode Selector Dialog
 */
export function PracticeModeDialog({
  open,
  examTitle = 'Assessment',
  durationMinutes = 60,
  onSelect,
  onCancel,
}: PracticeModeDialogProps) {
  const [selectedMode, setSelectedMode] = React.useState<PracticeModeType>('practice');
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [customTimeLimit, setCustomTimeLimit] = React.useState<number>(durationMinutes || 60);

  const handleModeSelection = () => {
    if (selectedMode === 'exam') {
      setShowTimePicker(true);
    } else {
      onSelect(selectedMode);
    }
  };

  const handleTimeConfirm = (minutes: number) => {
    setCustomTimeLimit(minutes);
    onSelect(selectedMode, minutes);
    setShowTimePicker(false);
  };

  if (showTimePicker) {
    return (
      <AlertDialog open={open}>
        <AlertDialogContent className="w-[95vw] sm:max-w-md rounded-3xl p-5 sm:p-7 bg-card border border-border shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl sm:text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Exam Time Setup
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Configure your time limit for <strong className="text-foreground">{examTitle}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <ExamTimePicker
              defaultMinutes={customTimeLimit}
              onConfirm={handleTimeConfirm}
              onCancel={() => setShowTimePicker(false)}
            />
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="w-[95vw] sm:max-w-2xl max-h-[92vh] flex flex-col p-4 sm:p-7 rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden">
        <AlertDialogHeader className="space-y-1.5 pb-2 text-left">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <AlertDialogTitle className="text-xl sm:text-2xl font-display font-bold text-foreground">
              Choose Study Mode
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Select how you would like to tackle <strong className="text-foreground">{examTitle}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {PRACTICE_MODE_OPTIONS.map((option) => {
              const isSelected = selectedMode === option.mode;
              const isPractice = option.mode === 'practice';

              return (
                <div
                  key={option.mode}
                  onClick={() => setSelectedMode(option.mode)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedMode(option.mode);
                    }
                  }}
                  className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer text-left select-none outline-none ${
                    isSelected
                      ? isPractice
                        ? 'ring-2 ring-primary border-primary bg-primary/5 dark:bg-primary/10 shadow-md'
                        : 'ring-2 ring-amber-500 border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 shadow-md'
                      : 'border-border/80 bg-card hover:border-primary/40 hover:bg-muted/40 shadow-xs'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header: Icon, Title, and Radio pill */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-xl transition-colors shrink-0 ${
                            isPractice
                              ? isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-primary/10 text-primary group-hover:bg-primary/20'
                              : isSelected
                              ? 'bg-amber-500 text-white'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20'
                          }`}
                        >
                          {option.icon}
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-base sm:text-lg text-foreground leading-tight">
                            {option.title}
                          </h3>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold mt-0.5 px-1.5 py-0 border ${
                              isPractice
                                ? 'border-primary/30 text-primary bg-primary/5'
                                : 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                            }`}
                          >
                            {option.badge}
                          </Badge>
                        </div>
                      </div>

                      {/* Interactive Radio Pill */}
                      <div className="shrink-0 mt-0.5">
                        {isSelected ? (
                          <div
                            className={`h-5 w-5 rounded-full flex items-center justify-center text-white shadow-xs ${
                              isPractice ? 'bg-primary' : 'bg-amber-500'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 group-hover:border-primary/50 transition-colors" />
                        )}
                      </div>
                    </div>

                    {/* Tagline / Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {option.description}
                    </p>

                    {/* Feature bullet list */}
                    <ul className="space-y-2 pt-2 border-t border-border/60 text-xs sm:text-sm">
                      {option.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-foreground/80 leading-snug">
                          {feat.type === 'check' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          ) : feat.type === 'clock' ? (
                            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                          )}
                          <span className="text-xs text-muted-foreground">{feat.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Theme-neutral Information Tip */}
          <div className="bg-muted/50 border border-border/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">Pro-tip:</strong> Practice mode helps you learn course topics with explanations. Switch to Exam mode when you want to simulate real test timing.
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center gap-2.5 justify-end pt-3 border-t border-border/60 mt-1">
          <AlertDialogCancel
            onClick={onCancel}
            className="rounded-xl border-border/80 hover:bg-muted text-xs sm:text-sm font-medium"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleModeSelection}
            className={`rounded-xl font-semibold shadow-xs text-xs sm:text-sm px-4 sm:px-5 h-9 sm:h-10 ${
              selectedMode === 'practice'
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            {selectedMode === 'exam' ? 'Set Timer & Continue' : 'Continue in Practice Mode'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Compact mode selector (for inline use)
 */
export interface PracticeModeSelectorProps {
  onSelect: (mode: PracticeModeType) => void;
  selectedMode?: PracticeModeType;
}

export function PracticeModeSelector({ onSelect, selectedMode }: PracticeModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {PRACTICE_MODE_OPTIONS.map((option) => (
        <Button
          key={option.mode}
          variant={selectedMode === option.mode ? 'default' : 'outline'}
          onClick={() => onSelect(option.mode)}
          className="flex flex-col items-center gap-2 h-auto py-3 rounded-xl border-border/80"
        >
          {option.icon}
          <span className="text-sm font-medium">{option.title}</span>
        </Button>
      ))}
    </div>
  );
}

/**
 * Mode comparison table
 */
export function PracticeModeComparison() {
  const features = [
    { feature: 'Instant Feedback', practice: '✓', exam: '✗' },
    { feature: 'Show Explanations', practice: '✓', exam: '✗' },
    { feature: 'Timer', practice: '✗', exam: '✓' },
    { feature: 'No Time Limit', practice: '✓', exam: '✗' },
    { feature: 'Learn Mode', practice: '✓', exam: '✗' },
    { feature: 'Test Mode', practice: '✗', exam: '✓' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2">
            <th className="text-left py-2 px-3">Feature</th>
            <th className="text-center py-2 px-3">Practice Mode</th>
            <th className="text-center py-2 px-3">Exam Mode</th>
          </tr>
        </thead>
        <tbody>
          {features.map((row, idx) => (
            <tr key={idx} className="border-b">
              <td className="py-2 px-3">{row.feature}</td>
              <td className="text-center py-2 px-3">
                <span className={row.practice === '✓' ? 'text-green-600' : 'text-gray-400'}>
                  {row.practice}
                </span>
              </td>
              <td className="text-center py-2 px-3">
                <span className={row.exam === '✓' ? 'text-green-600' : 'text-gray-400'}>
                  {row.exam}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
