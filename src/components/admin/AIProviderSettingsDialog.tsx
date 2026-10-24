import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AIProviderSettingsSection } from './AIProviderSettingsSection';
import { Sparkles } from 'lucide-react';

interface AIProviderSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function AIProviderSettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: AIProviderSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-cyan-500 text-primary-foreground flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-display font-bold">
                AI Provider Setup & Keys
              </DialogTitle>
              <DialogDescription className="text-xs">
                Manage your API keys, fallback priority, and models for automated question generation.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <AIProviderSettingsSection
          onSaved={() => {
            onSaved?.();
            onOpenChange(false);
          }}
          showSaveButton={true}
        />
      </DialogContent>
    </Dialog>
  );
}

export default AIProviderSettingsDialog;
