import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Trash2,
  AlertTriangle,
  Database,
  CheckCircle2,
  Loader2,
  Calendar,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  CommunityChannel,
  clearChannelMessages,
  clearAllChannelsMessages,
  getChatStorageStats,
  ChatStorageStats,
} from '@/lib/community';

interface AdminChatCleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: CommunityChannel[];
  initialChannelId?: string;
  onSuccess?: (info: { totalDeleted: number; channelName: string }) => void;
}

export function AdminChatCleanupDialog({
  open,
  onOpenChange,
  channels,
  initialChannelId = 'all',
  onSuccess,
}: AdminChatCleanupDialogProps) {
  const { toast } = useToast();

  const [selectedChannelId, setSelectedChannelId] = useState<string>(initialChannelId);
  const [olderThanDays, setOlderThanDays] = useState<number>(30); // Default 30 days
  const [preservePinned, setPreservePinned] = useState<boolean>(true);
  const [permanentDelete, setPermanentDelete] = useState<boolean>(true);
  const [confirmInput, setConfirmInput] = useState<string>('');

  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [storageStats, setStorageStats] = useState<ChatStorageStats | null>(null);

  // Sync initialChannelId when modal opens
  useEffect(() => {
    if (open) {
      setSelectedChannelId(initialChannelId || 'all');
      setConfirmInput('');
      fetchStats();
    }
  }, [open, initialChannelId]);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const stats = await getChatStorageStats(channels);
      setStorageStats(stats);
    } catch (err) {
      console.warn('Failed to fetch storage stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const isCompleteWipe = olderThanDays === 0 || selectedChannelId === 'all';
  const confirmationNeeded = isCompleteWipe;
  const isConfirmValid = !confirmationNeeded || confirmInput.trim().toUpperCase() === 'CLEAR';

  const selectedChannelName =
    selectedChannelId === 'all'
      ? 'All Channels'
      : channels.find((c) => c.id === selectedChannelId)?.name || 'Selected Channel';

  const selectedChannelCount =
    selectedChannelId === 'all'
      ? storageStats?.totalMessages ?? 0
      : storageStats?.channels.find((c) => c.id === selectedChannelId)?.messageCount ?? 0;

  const handleExecuteCleanup = async () => {
    try {
      setIsDeleting(true);

      let totalDeleted = 0;

      if (selectedChannelId === 'all') {
        const result = await clearAllChannelsMessages({
          olderThanDays,
          preservePinned,
          softDelete: !permanentDelete,
        });
        totalDeleted = result.totalDeleted;
      } else {
        const result = await clearChannelMessages({
          channelId: selectedChannelId,
          olderThanDays,
          preservePinned,
          softDelete: !permanentDelete,
        });
        totalDeleted = result.deletedCount;
      }

      toast({
        title: 'Chat Storage Cleared! 🧹',
        description: `Successfully cleaned ${totalDeleted} message${
          totalDeleted === 1 ? '' : 's'
        } from ${selectedChannelName}.`,
      });

      if (onSuccess) {
        onSuccess({
          totalDeleted,
          channelName: selectedChannelName,
        });
      }

      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to clear chat storage:', err);
      toast({
        title: 'Cleanup Failed',
        description: err?.message || 'Could not clean chat messages from Firestore.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getRetentionLabel = (days: number) => {
    if (days === 0) return 'All messages (Complete Purge)';
    if (days === 7) return 'Older than 7 days (1 week)';
    if (days === 14) return 'Older than 14 days (2 weeks)';
    if (days === 30) return 'Older than 30 days (1 month) — Recommended';
    if (days === 60) return 'Older than 60 days (2 months)';
    if (days === 90) return 'Older than 90 days (3 months)';
    if (days === 180) return 'Older than 180 days (6 months)';
    return `Older than ${days} days`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                Clear Chat Storage & Messages
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Prune old student discussions from Firestore to reclaim storage and manage database growth.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Storage Stats Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-sky-500 shrink-0" />
            <div>
              <span className="font-semibold text-foreground">Current Database Usage: </span>
              <span className="text-muted-foreground">
                {loadingStats ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Counting...
                  </span>
                ) : (
                  <>
                    <strong className="text-foreground">{selectedChannelCount}</strong> messages in{' '}
                    <span className="font-medium text-sky-600 dark:text-sky-400">
                      {selectedChannelName}
                    </span>
                    {storageStats && selectedChannelId !== 'all' && (
                      <span className="text-[11px] text-muted-foreground ml-1">
                        ({storageStats.totalMessages} total platform-wide)
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchStats}
            disabled={loadingStats}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
          >
            Refresh
          </Button>
        </div>

        <div className="space-y-4 py-2 text-xs sm:text-sm">
          {/* Target Channel Picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Layers className="h-3.5 w-3.5 text-sky-500" />
              Target Channel Scope
            </Label>
            <Select
              value={selectedChannelId}
              onValueChange={(val) => {
                setSelectedChannelId(val);
                setConfirmInput('');
              }}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs sm:text-sm bg-background">
                <SelectValue placeholder="Select channel to clear..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="all" className="font-bold text-rose-600 dark:text-rose-400 text-xs">
                  ⚡ All Channels (Announcements, General, and all Departments)
                </SelectItem>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id} className="text-xs">
                    {ch.icon || '💬'} {ch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Choose whether to clean only this channel or run a global cleanup across all channels.
            </p>
          </div>

          {/* Time Retention Threshold */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              Retention Threshold (Delete Messages Older Than)
            </Label>
            <Select
              value={String(olderThanDays)}
              onValueChange={(val) => {
                setOlderThanDays(Number(val));
                setConfirmInput('');
              }}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs sm:text-sm bg-background">
                <SelectValue placeholder="Select retention cutoff..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7" className="text-xs">
                  {getRetentionLabel(7)}
                </SelectItem>
                <SelectItem value="14" className="text-xs">
                  {getRetentionLabel(14)}
                </SelectItem>
                <SelectItem value="30" className="text-xs font-medium text-sky-600 dark:text-sky-400">
                  {getRetentionLabel(30)}
                </SelectItem>
                <SelectItem value="60" className="text-xs">
                  {getRetentionLabel(60)}
                </SelectItem>
                <SelectItem value="90" className="text-xs">
                  {getRetentionLabel(90)}
                </SelectItem>
                <SelectItem value="180" className="text-xs">
                  {getRetentionLabel(180)}
                </SelectItem>
                <SelectItem value="0" className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  {getRetentionLabel(0)}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Only messages sent before this cutoff date will be removed. Newer recent conversations stay intact.
            </p>
          </div>

          {/* Options Toggles */}
          <div className="space-y-2.5 pt-1">
            {/* Preserve Pinned */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-border bg-background/50 hover:bg-muted/40 transition-colors">
              <Label htmlFor="preserve-pinned-toggle" className="cursor-pointer pr-3 flex-1">
                <span className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Preserve Pinned Announcements
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Keep instructor pinned notes and exam announcements safe from deletion.
                </p>
              </Label>
              <Switch
                id="preserve-pinned-toggle"
                checked={preservePinned}
                onCheckedChange={setPreservePinned}
              />
            </div>

            {/* Permanent vs Soft Delete */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-border bg-background/50 hover:bg-muted/40 transition-colors">
              <Label htmlFor="permanent-delete-toggle" className="cursor-pointer pr-3 flex-1">
                <span className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 text-foreground">
                  <Database className="h-3.5 w-3.5 text-rose-500" />
                  Hard Delete from Firestore (Reclaims Storage)
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Permanently deletes documents from Firestore to lower database usage and prevent quota buildup.
                </p>
              </Label>
              <Switch
                id="permanent-delete-toggle"
                checked={permanentDelete}
                onCheckedChange={setPermanentDelete}
              />
            </div>
          </div>

          {/* Warning Alert */}
          <Alert className="rounded-2xl border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <AlertDescription className="text-xs leading-relaxed">
              <strong>Caution: </strong>
              {permanentDelete ? 'Permanent deletion cannot be undone. ' : 'Messages will be cleared. '}
              {olderThanDays === 0 ? (
                <span className="font-bold underline text-rose-600 dark:text-rose-400">
                  ALL messages in {selectedChannelName} will be cleared.
                </span>
              ) : (
                <span>
                  Messages older than <strong>{olderThanDays} days</strong> in{' '}
                  <strong>{selectedChannelName}</strong> will be wiped.
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Confirmation Input Guard for Complete Wipe or All Channels */}
          {confirmationNeeded && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
              <Label className="text-xs font-bold text-rose-700 dark:text-rose-300">
                Confirm Execution: Type <span className="underline font-mono">CLEAR</span> below to proceed:
              </Label>
              <Input
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Type CLEAR to confirm..."
                className="h-8 rounded-xl font-mono text-xs bg-background uppercase border-rose-400/50"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="rounded-xl text-xs sm:text-sm h-9"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleExecuteCleanup}
            disabled={isDeleting || !isConfirmValid}
            className="rounded-xl text-xs sm:text-sm h-9 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-600/20 gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Purging Chat Storage...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Clear Chat Data Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
