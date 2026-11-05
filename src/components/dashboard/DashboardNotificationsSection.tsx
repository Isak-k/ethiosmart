import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Sparkles,
  ClipboardList,
  BookOpen,
  FileText,
  Megaphone,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  AppNotification,
  fetchRecentNotifications,
  markNotificationAsRead,
} from '@/lib/live-notifications';

interface DashboardNotificationsSectionProps {
  userDepartmentId?: string;
}

export function DashboardNotificationsSection({ userDepartmentId }: DashboardNotificationsSectionProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const list = await fetchRecentNotifications(userDepartmentId);
      setNotifications(list.slice(0, 5));
    } catch (err) {
      console.warn('Error loading dashboard notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    const handleRefresh = () => {
      loadNotifications();
    };
    window.addEventListener('exampro-manual-refresh', handleRefresh);
    return () => window.removeEventListener('exampro-manual-refresh', handleRefresh);
  }, [userDepartmentId]);

  const getBadge = (type: AppNotification['type']) => {
    switch (type) {
      case 'exam':
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] font-bold py-0.5">
            <ClipboardList className="h-3 w-3 mr-1" /> Exam
          </Badge>
        );
      case 'book':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold py-0.5">
            <BookOpen className="h-3 w-3 mr-1" /> Textbook
          </Badge>
        );
      case 'short_note':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-bold py-0.5">
            <FileText className="h-3 w-3 mr-1" /> Study Note
          </Badge>
        );
      case 'announcement':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] font-bold py-0.5">
            <Megaphone className="h-3 w-3 mr-1" /> Notice
          </Badge>
        );
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

  if (!loading && notifications.length === 0) {
    return null; // Don't take up space if nothing has been published yet
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <Bell className="h-4 w-4" />
          </div>
          <h2 className="text-base sm:text-lg font-display font-bold text-foreground">
            Latest Updates & Announcements
          </h2>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <button
          type="button"
          onClick={loadNotifications}
          className="text-xs font-semibold text-muted-foreground hover:text-sky-600 transition-colors flex items-center gap-1"
          title="Refresh updates"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-sky-500' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl border border-border/60 bg-card p-4 animate-pulse space-y-2"
              >
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-4 w-44 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            ))
          : notifications.map((item) => (
              <Card
                key={item.id}
                onClick={() => {
                  markNotificationAsRead(item.id);
                  navigate(item.link);
                }}
                className="group relative flex flex-col justify-between p-4 rounded-2xl border border-border/70 bg-card/90 hover:border-sky-400/50 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    {getBadge(item.type)}
                    <span className="text-[10px] font-medium text-muted-foreground/80">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-bold text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 line-clamp-1 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-sky-600 dark:text-sky-400 mt-2">
                  <span>
                    {item.type === 'exam'
                      ? 'Practice Exam'
                      : item.type === 'book' || item.type === 'short_note'
                      ? 'Read Material'
                      : 'View Notice'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}
