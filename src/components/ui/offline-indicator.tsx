import { useOffline } from '@/hooks/use-offline';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, CloudOff, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useOffline();
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const [showOnlineMessage, setShowOnlineMessage] = useState(false);

  // Handle offline notification
  useEffect(() => {
    if (!isOnline) {
      setShowOfflineMessage(true);
      const timer = setTimeout(() => {
        setShowOfflineMessage(false);
      }, 5000); // Auto-hide after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  // Handle back online notification
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowOnlineMessage(true);
      const timer = setTimeout(() => {
        setShowOnlineMessage(false);
      }, 5000); // Hide after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Don't show anything if online and no messages to display
  if (isOnline && !showOnlineMessage) {
    return null;
  }

  // Don't show offline message if it was dismissed or auto-hidden
  if (!isOnline && !showOfflineMessage) {
    return null;
  }

  return (
    <div className={`fixed ${!isOnline ? 'top-3 left-1/2 -translate-x-1/2' : 'bottom-4 right-4'} z-50 w-[calc(100%-1.5rem)] max-w-sm animate-slide-up`}>
      {!isOnline && showOfflineMessage ? (
        <Alert className="shadow-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 backdrop-blur-sm p-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <CloudOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <AlertDescription className="text-yellow-900 dark:text-yellow-100 flex-1 text-xs">
              <strong className="font-semibold">You're offline.</strong>
              <span className="ml-1">
                Download notes before opening them offline.
              </span>
            </AlertDescription>
            <Button
              variant="outline"
              size="sm"
              className="h-7 min-h-0 px-2.5 text-xs flex-shrink-0"
              onClick={() => setShowOfflineMessage(false)}
            >
              Got it
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss offline message"
              className="h-7 w-7 min-h-0 min-w-0 rounded-full flex-shrink-0"
              onClick={() => setShowOfflineMessage(false)}
            >
              <X className="h-4 w-4 text-yellow-700 dark:text-yellow-300" />
            </Button>
          </div>
        </Alert>
      ) : showOnlineMessage ? (
        <Alert className="shadow-2xl border-2 border-green-500 bg-green-50 dark:bg-green-950/30 backdrop-blur-sm animate-scale-in">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <AlertDescription className="text-green-900 dark:text-green-100 flex-1">
              <strong className="block text-base font-semibold mb-1">Back Online!</strong>
              <span className="text-sm">
                Syncing your data now...
              </span>
            </AlertDescription>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 flex-shrink-0"
              onClick={() => setShowOnlineMessage(false)}
            >
              <X className="h-4 w-4 text-green-700 dark:text-green-300" />
            </Button>
          </div>
        </Alert>
      ) : null}
    </div>
  );
}