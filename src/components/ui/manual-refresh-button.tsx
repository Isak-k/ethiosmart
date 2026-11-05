import React, { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { triggerManualAppRefresh } from '@/lib/app-cache';
import { useToast } from '@/hooks/use-toast';

interface ManualRefreshButtonProps {
  className?: string;
  variant?: 'icon' | 'labeled';
  size?: 'sm' | 'default' | 'lg';
}

export function ManualRefreshButton({
  className = '',
  variant = 'icon',
  size = 'default',
}: ManualRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    try {
      // Trigger global cache clear and data re-fetch event
      triggerManualAppRefresh();

      // Show brief feedback toast
      toast({
        title: 'Refreshing...',
        description: 'Updating application with the latest data.',
        duration: 2000,
      });

      // Keep animation spinning for 700ms so user clearly perceives the action
      setTimeout(() => {
        setIsRefreshing(false);
        toast({
          title: 'Updated',
          description: 'All content is now up to date.',
          duration: 2500,
        });
      }, 700);
    } catch (err: any) {
      console.error('Manual refresh error:', err);
      setIsRefreshing(false);
    }
  };

  if (variant === 'labeled') {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`min-h-[44px] h-10 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 border-sky-400/40 bg-sky-500/10 hover:bg-sky-500/20 active:scale-95 transition-all text-sky-700 dark:text-sky-300 ${className}`}
        title="Refresh application data"
      >
        <RotateCw className={`h-4 w-4 shrink-0 text-sky-500 ${isRefreshing ? 'animate-spin' : ''}`} />
        <span>{isRefreshing ? 'Refreshing...' : 'Refresh Content'}</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`relative min-h-[40px] min-w-[40px] h-9 w-9 sm:h-10 sm:w-10 rounded-2xl liquid-glass-squircle text-foreground hover:bg-sky-500/15 active:scale-95 transition-all ${className}`}
      title="Refresh application content"
      aria-label="Refresh content"
    >
      <RotateCw className={`h-4 w-4 sm:h-5 sm:w-5 text-foreground/80 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
    </Button>
  );
}
