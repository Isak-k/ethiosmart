import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Monitor, Share, CheckCircle2 } from 'lucide-react';

interface PwaInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isIOS: boolean;
  isStandalone: boolean;
  deferredPrompt?: any;
  onInstallClick?: () => void;
}

export function PwaInstallDialog({
  open,
  onOpenChange,
  isIOS,
  isStandalone,
  deferredPrompt,
  onInstallClick,
}: PwaInstallDialogProps) {
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && typeof window !== 'undefined') {
      sessionStorage.setItem('pwa_install_dismissed', 'true');
      window.dispatchEvent(new CustomEvent('pwa-install-dismissed'));
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7 z-50">
        <DialogHeader className="space-y-2 text-center sm:text-left">
          <div className="h-12 w-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto sm:mx-0">
            {isIOS ? <Smartphone className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
          </div>
          <DialogTitle className="text-xl font-bold font-display">
            {isStandalone
              ? 'EthioSmart is Installed'
              : isIOS
              ? 'Install EthioSmart on iPhone / iPad'
              : 'Install EthioSmart as an App'}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            {isStandalone
              ? 'You are already running EthioSmart as an installed app.'
              : 'Install EthioSmart to enable 100% offline study access for textbooks, notes, and exams without needing internet.'}
          </DialogDescription>
        </DialogHeader>

        {isStandalone ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
            <p className="text-xs font-semibold">
              EthioSmart is already installed and ready to use offline!
            </p>
          </div>
        ) : isIOS ? (
          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-2xl bg-muted/50 border space-y-3 text-xs sm:text-sm">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <span>
                  Tap the <b>Share</b> button in Safari&apos;s bottom toolbar (<Share className="h-3.5 w-3.5 inline mx-1 text-sky-600" />).
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <span>
                  Scroll down and tap <b>&ldquo;Add to Home Screen&rdquo;</b>.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <span>
                  Tap <b>Add</b> in the top-right corner to install on your home screen.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {onInstallClick && (
              <Button
                onClick={onInstallClick}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:opacity-95 text-white font-bold shadow-md flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span>Install EthioSmart App</span>
              </Button>
            )}

            <div className="p-4 rounded-2xl bg-muted/50 border space-y-2 text-xs sm:text-sm">
              <p className="font-semibold text-foreground">
                In Microsoft Edge, Chrome, Brave, or Android:
              </p>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>
                  <b>Desktop (Edge / Chrome):</b> Click the <b>App Install icon</b> in the right side of your browser&apos;s address bar (next to the URL / favorite ⭐ star).
                </li>
                <li>
                  <b>Mobile (Android):</b> Tap the browser menu (<b>⋮</b>) and select <b>&ldquo;Install app&rdquo;</b> or <b>&ldquo;Add to Home screen&rdquo;</b>.
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
            aria-label="Close installation guidance"
            className="rounded-xl text-xs text-muted-foreground hover:text-foreground"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
