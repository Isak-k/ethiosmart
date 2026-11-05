/**
 * Admin System Settings Page
 * Configure system-wide settings for practice exams
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Loader2, AlertCircle, Check, Building, Trash2, Database, RefreshCw, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getSystemSettings, updateSystemSettings } from '@/lib/system-settings';
import { getDepartments } from '@/lib/departments';
import { Department } from '@/integrations/firebase/types';
import {
  buildCommunityChannels,
  getChatStorageStats,
  ChatStorageStats,
} from '@/lib/community';
import { AdminChatCleanupDialog } from '@/components/community/AdminChatCleanupDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Settings {
  requireStudentLogin: boolean;
  defaultDepartmentId?: string | null;
  defaultDepartmentName?: string | null;
  practiceExamsEnabled: boolean;
  defaultPassingScore: number;
  sessionDurationDays: number;
  storageQuotaMB: number;
  maxDownloads: number;
  offlineFeatureEnabled: boolean;
  analyticsTrackingEnabled: boolean;
}

export function AdminSystemSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Community Chat Retention & Storage Clean states
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [selectedCleanupChannel, setSelectedCleanupChannel] = useState<string>('all');
  const [chatStats, setChatStats] = useState<ChatStorageStats | null>(null);
  const [loadingChatStats, setLoadingChatStats] = useState(false);

  const fetchChatStats = async (deptsList: Department[]) => {
    try {
      setLoadingChatStats(true);
      const chs = buildCommunityChannels(deptsList, { userRole: 'admin' });
      const stats = await getChatStorageStats(chs);
      setChatStats(stats);
    } catch (err) {
      console.warn('Failed to fetch chat storage stats:', err);
    } finally {
      setLoadingChatStats(false);
    }
  };

  const [settings, setSettings] = useState<Settings>({
    requireStudentLogin: true,
    defaultDepartmentId: 'qzw7P8fCSFpnRGqdAgxW',
    defaultDepartmentName: 'Freshman',
    practiceExamsEnabled: true,
    defaultPassingScore: 50,
    sessionDurationDays: 30,
    storageQuotaMB: 500,
    maxDownloads: 10,
    offlineFeatureEnabled: true,
    analyticsTrackingEnabled: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const [loaded, depts] = await Promise.all([
          getSystemSettings(),
          getDepartments().catch(() => []),
        ]);
        if (loaded) {
          setSettings(loaded as Settings);
        }
        setDepartments(depts);
        fetchChatStats(depts);
      } catch (err) {
        console.error('Error loading settings:', err);
        setError('Failed to load system settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (key: keyof Settings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Using 'system' as userId for system-level settings
      await updateSystemSettings(settings, 'admin-panel');

      setSuccess('System settings saved successfully');
      setIsDirty(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save system settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    // Reload original settings
    const loadSettings = async () => {
      try {
        const loaded = await getSystemSettings();
        if (loaded) {
          setSettings(loaded as Settings);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };
    loadSettings();
    setIsDirty(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-gray-600">Configure system-wide practice exam settings</p>
      </div>

      {/* Success Alert */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>Enable or disable system features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <Label htmlFor="require-login" className="flex-1 cursor-pointer">
              <span className="font-medium">Require Student Login</span>
              <p className="text-sm text-gray-600">
                When enabled, students must sign in (guest access buttons are hidden). When disabled, a &quot;Continue as Guest&quot; button appears across the platform so students can access exams and study materials directly without signing in.
              </p>
            </Label>
            <Switch
              id="require-login"
              checked={settings.requireStudentLogin}
              onCheckedChange={(v) => handleChange('requireStudentLogin', v)}
            />
          </div>

          <div className="p-3 border rounded-lg hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <span className="font-medium text-sm">Default Department (Direct Open)</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically opens this department's curriculum for all guests and students without asking for department selection.
              </p>
            </div>
            <div className="w-full sm:w-64">
              <Select
                value={settings.defaultDepartmentId || "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    setSettings((prev) => ({
                      ...prev,
                      defaultDepartmentId: null,
                      defaultDepartmentName: null,
                    }));
                  } else {
                    const dept = departments.find((d) => d.id === val);
                    setSettings((prev) => ({
                      ...prev,
                      defaultDepartmentId: val,
                      defaultDepartmentName: dept?.name || null,
                    }));
                  }
                  setIsDirty(true);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose default department..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none">None (Per-user selection)</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id} className="text-xs">
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <Label htmlFor="practice-exams" className="flex-1">
              <span className="font-medium">Practice Exams</span>
              <p className="text-sm text-gray-600">Enable practice exam functionality system-wide</p>
            </Label>
            <Switch
              id="practice-exams"
              checked={settings.practiceExamsEnabled}
              onCheckedChange={(v) => handleChange('practiceExamsEnabled', v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <Label htmlFor="offline-features" className="flex-1">
              <span className="font-medium">Offline Features</span>
              <p className="text-sm text-gray-600">Allow students to download exams for offline use</p>
            </Label>
            <Switch
              id="offline-features"
              checked={settings.offlineFeatureEnabled}
              onCheckedChange={(v) => handleChange('offlineFeatureEnabled', v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <Label htmlFor="analytics" className="flex-1">
              <span className="font-medium">Analytics Tracking</span>
              <p className="text-sm text-gray-600">Track practice exam usage and results</p>
            </Label>
            <Switch
              id="analytics"
              checked={settings.analyticsTrackingEnabled}
              onCheckedChange={(v) => handleChange('analyticsTrackingEnabled', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Default Passing Score */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring</CardTitle>
          <CardDescription>Configure default scoring behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="passing-score">
              <span className="font-medium">Default Passing Score: {settings.defaultPassingScore}%</span>
            </Label>
            <Slider
              id="passing-score"
              min={10}
              max={100}
              step={5}
              value={[settings.defaultPassingScore]}
              onValueChange={(v) => handleChange('defaultPassingScore', v[0])}
              className="mt-2 w-full"
            />
            <p className="text-sm text-gray-600 mt-2">
              Default passing score for practice exams (can be overridden per exam)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Session & Storage */}
      <Card>
        <CardHeader>
          <CardTitle>Session & Storage</CardTitle>
          <CardDescription>Configure session and storage limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="session-duration">
              <span className="font-medium">Session Duration</span>
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="session-duration"
                type="number"
                min="1"
                max="365"
                value={settings.sessionDurationDays}
                onChange={(e) => handleChange('sessionDurationDays', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-gray-600 self-center">days</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              How long student exam sessions are stored offline (default: 30 days)
            </p>
          </div>

          <div>
            <Label htmlFor="storage-quota">
              <span className="font-medium">Storage Quota</span>
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="storage-quota"
                type="number"
                min="10"
                max="10000"
                value={settings.storageQuotaMB}
                onChange={(e) => handleChange('storageQuotaMB', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-gray-600 self-center">MB</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Maximum storage space for offline downloads per device
            </p>
          </div>

          <div>
            <Label htmlFor="max-downloads">
              <span className="font-medium">Maximum Downloads</span>
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="max-downloads"
                type="number"
                min="1"
                max="100"
                value={settings.maxDownloads}
                onChange={(e) => handleChange('maxDownloads', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-gray-600 self-center">exams</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Maximum number of exams a user can download (0 = unlimited)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Community Chat Storage & Data Retention */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-sky-500/5 via-indigo-500/5 to-transparent pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Community Chat Storage & Retention</CardTitle>
                <CardDescription className="text-xs">
                  Clean up and prune accumulated student messages to reclaim Firestore database storage as the student count increases.
                </CardDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchChatStats(departments)}
              disabled={loadingChatStats}
              className="h-8 text-xs gap-1.5 self-start sm:self-auto rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingChatStats ? 'animate-spin' : ''}`} />
              Refresh Count
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Storage Summary Bar */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Stored Chat Messages
              </span>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-bold font-display text-foreground">
                  {loadingChatStats ? (
                    <span className="inline-flex items-center gap-1.5 text-base font-normal text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Calculating...
                    </span>
                  ) : (
                    chatStats?.totalMessages ?? 0
                  )}
                </span>
                <Badge variant="secondary" className="text-xs font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-400/20">
                  {chatStats?.channels.length ?? 0} active channels
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Accumulated student conversations across Announcements, General Campus Lounge, and Department study halls.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => {
                setSelectedCleanupChannel('all');
                setCleanupDialogOpen(true);
              }}
              className="rounded-xl h-9 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-600/20 gap-2 shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              Manage & Clear Chat Data
            </Button>
          </div>

          {/* Quick Retention Prune Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl border border-border/70 bg-background/60 flex flex-col justify-between gap-3">
              <div>
                <span className="font-semibold text-xs text-foreground block">Prune 30+ Days Old</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Keep active recent conversations while removing older historical messages.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCleanupChannel('all');
                  setCleanupDialogOpen(true);
                }}
                className="h-8 text-xs rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              >
                Clear Older Than 30 Days
              </Button>
            </div>

            <div className="p-3.5 rounded-2xl border border-border/70 bg-background/60 flex flex-col justify-between gap-3">
              <div>
                <span className="font-semibold text-xs text-foreground block">Prune 90+ Days Old</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Clear messages from past academic quarters or older semesters.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCleanupChannel('all');
                  setCleanupDialogOpen(true);
                }}
                className="h-8 text-xs rounded-xl border-slate-300 dark:border-slate-700 text-foreground hover:bg-muted"
              >
                Clear Older Than 90 Days
              </Button>
            </div>

            <div className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/5 flex flex-col justify-between gap-3">
              <div>
                <span className="font-semibold text-xs text-rose-600 dark:text-rose-400 block">Complete Channel Wipe</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Completely reset all messages for a new semester or fresh start.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCleanupChannel('all');
                  setCleanupDialogOpen(true);
                }}
                className="h-8 text-xs rounded-xl border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              >
                Complete Wipe Options
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!isDirty || saving}
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Chat Cleanup Modal */}
      <AdminChatCleanupDialog
        open={cleanupDialogOpen}
        onOpenChange={setCleanupDialogOpen}
        channels={buildCommunityChannels(departments, { userRole: 'admin' })}
        initialChannelId={selectedCleanupChannel}
        onSuccess={() => {
          fetchChatStats(departments);
        }}
      />
    </div>
  );
}

export default AdminSystemSettings;
