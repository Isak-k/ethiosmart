import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Sparkles,
  ClipboardList,
  CreditCard,
  BookOpen,
  FileText,
  Megaphone,
  X,
  ExternalLink,
  CheckCheck,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuHeader,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AppNotification,
  fetchRecentNotifications,
  subscribeToLivePublications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/live-notifications';

interface NotificationCenterProps {
  userDepartmentId?: string;
  className?: string;
}

export function NotificationCenter({ userDepartmentId, className }: NotificationCenterProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeBanner, setActiveBanner] = useState<AppNotification | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Load initial notifications
  const loadNotifications = async () => {
    const list = await fetchRecentNotifications(userDepartmentId);
    setNotifications(list);
    const unread = list.filter((n) => !n.isRead).length;
    setUnreadCount(unread);
  };

  useEffect(() => {
    loadNotifications();

    // Listen for manual app refresh
    const handleRefresh = () => {
      loadNotifications();
    };
    window.addEventListener('exampro-manual-refresh', handleRefresh);

    // Subscribe to real-time live publications
    const unsub = subscribeToLivePublications(userDepartmentId, (newItem) => {
      setActiveBanner(newItem);
      setNotifications((prev) => [newItem, ...prev.filter((n) => n.id !== newItem.id)]);
      setUnreadCount((c) => c + 1);

      // Play soft notification sound if supported
      try {
        if (typeof window !== 'undefined' && 'AudioContext' in window) {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 587.33; // D5
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        }
      } catch {}
    });

    return () => {
      window.removeEventListener('exampro-manual-refresh', handleRefresh);
      unsub();
    };
  }, [userDepartmentId]);

  // Auto-dismiss top banner after 10 seconds
  useEffect(() => {
    if (activeBanner) {
      const timer = setTimeout(() => {
        setActiveBanner(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [activeBanner]);

  const handleNotificationClick = (n: AppNotification) => {
    markNotificationAsRead(n.id);
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    setIsOpen(false);
    navigate(n.link);
  };

  const handleMarkAllRead = () => {
    const ids = notifications.map((n) => n.id);
    markAllNotificationsAsRead(ids);
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'exam':
        return <ClipboardList className="h-4 w-4 text-purple-500" />;
      case 'book':
        return <BookOpen className="h-4 w-4 text-emerald-500" />;
      case 'short_note':
        return <FileText className="h-4 w-4 text-amber-500" />;
      case 'announcement':
        return <Megaphone className="h-4 w-4 text-blue-500" />;
      case 'payment':
        return <CreditCard className="h-4 w-4 text-emerald-500" />;
    }
  };

  const formatTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  return (
    <>
      {/* Live Real-Time Banner Alert at the Top of Screen */}
      {activeBanner && (
        <div className="fixed top-18 sm:top-20 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900/95 dark:bg-slate-900/95 text-white shadow-2xl border border-sky-400/40 backdrop-blur-xl">
            <div className="h-10 w-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              {getIcon(activeBanner.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  New Publication
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold truncate text-white">
                {activeBanner.title}
              </h4>
              <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">
                {activeBanner.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const b = activeBanner;
                    setActiveBanner(null);
                    handleNotificationClick(b);
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors"
                >
                  View Now
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBanner(null)}
                  className="px-2 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveBanner(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bell Icon Dropdown Trigger */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`relative h-9 w-9 sm:h-10 sm:w-10 rounded-2xl liquid-glass-squircle text-foreground hover:bg-sky-500/10 active:scale-95 transition-all ${className}`}
            title="Notifications & Updates"
            aria-label="Open Notifications"
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-foreground/80" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-80 sm:w-96 rounded-3xl p-2 bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl z-[80]"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-sky-500" />
              <h3 className="text-sm font-bold font-display">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-400/30">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-muted-foreground hover:text-sky-500 transition-colors flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y divide-border/40 py-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="h-10 w-10 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">You are all caught up!</p>
                <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">
                  New exams, books, notes, and announcements will appear here automatically.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${
                    !n.isRead
                      ? 'bg-sky-500/5 hover:bg-sky-500/10'
                      : 'hover:bg-muted/60 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="h-8 w-8 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {n.type === 'short_note' ? 'Study Note' : n.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 shrink-0">
                        {formatTime(n.timestamp)}
                      </span>
                    </div>
                    <h5 className={`text-xs font-semibold truncate ${!n.isRead ? 'text-foreground font-bold' : 'text-foreground/90'}`}>
                      {n.title}
                    </h5>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {n.description}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0 self-center" />
                  )}
                </div>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
