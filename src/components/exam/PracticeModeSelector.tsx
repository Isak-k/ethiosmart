/**
 * Practice Mode Selector Component
 * Allows user to choose between Practice mode and Exam mode
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
import { Lightbulb, Clock, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export type PracticeModeType = 'practice' | 'exam';

export interface PracticeModeOption {
  mode: PracticeModeType;
  title: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  color: string;
  badge?: string;
}

export const PRACTICE_MODE_OPTIONS: PracticeModeOption[] = [
  {
    mode: 'practice',
    title: 'Practice Mode',
    description: 'Get instant feedback on each answer with explanations',
    features: [
      '✓ Instant feedback (correct/incorrect)',
      '✓ Show explanations',
      '✓ No time limit',
      '✓ Learn at your own pace',
    ],
    icon: <Lightbulb className="h-6 w-6" />,
    color: 'bg-blue-50',
    badge: 'Recommended for Learning',
  },
  {
    mode: 'exam',
    title: 'Exam Mode',
    description: 'Timed exam with no feedback until completion',
    features: [
      '⏱ Countdown timer',
      '✗ No instant feedback',
      '✗ No explanations shown',
      '✓ Summary on completion (Correct/Wrong/Skipped)',
    ],
    icon: <Clock className="h-6 w-6" />,
    color: 'bg-amber-50',
    badge: 'Test Your Knowledge',
  },
];

export interface PracticeModeDialogProps {
  open: boolean;
  examTitle?: string;
  durationMinutes?: number;
  onSelect: (mode: PracticeModeType) => void;
  onCancel: () => void;
}

/**
 * Practice Mode Selector Dialog
 */
export function PracticeModeDialog({
  open,
  examTitle = 'Exam',
  durationMinutes = 60,
  onSelect,
  onCancel,
}: PracticeModeDialogProps) {
  const [selectedMode, setSelectedMode] = React.useState<PracticeModeType>('practice');

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">
            Choose Exam Mode
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            Select how you want to take <strong>{examTitle}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          {PRACTICE_MODE_OPTIONS.map((option) => (
            <div
              key={option.mode}
              onClick={() => setSelectedMode(option.mode)}
              className="cursor-pointer"
            >
              <Card
                className={`transition-all ${
                  selectedMode === option.mode
                    ? 'ring-2 ring-primary border-primary'
                    : 'border-gray-200'
                } ${option.color}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-primary">{option.icon}</div>
                      <div>
                        <CardTitle className="text-lg">{option.title}</CardTitle>
                        {option.badge && (
                          <Badge variant="secondary" className="mt-1">
                            {option.badge}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <input
                        type="radio"
                        name="mode"
                        value={option.mode}
                        checked={selectedMode === option.mode}
                        onChange={() => setSelectedMode(option.mode)}
                        className="h-4 w-4 accent-primary"
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <CardDescription>{option.description}</CardDescription>

                  <ul className="space-y-2 text-sm">
                    {option.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-gray-400 flex-shrink-0">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {option.mode === 'exam' && durationMinutes && (
                    <div className="pt-2 px-3 py-2 bg-gray-100 rounded-lg text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="h-4 w-4" />
                        <span>Time limit: {durationMinutes} minutes</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        <AlertDialogDescription className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <strong>💡 Tip:</strong> You can always restart in a different mode if you change your mind.
        </AlertDialogDescription>

        <div className="flex gap-3 justify-end">
          <AlertDialogCancel onClick={onCancel} className="border-gray-300">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onSelect(selectedMode)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            Continue in {selectedMode === 'practice' ? 'Practice' : 'Exam'} Mode
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
          className="flex flex-col items-center gap-2 h-auto py-3"
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
