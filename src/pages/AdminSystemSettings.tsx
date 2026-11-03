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
import { Loader2, AlertCircle, Check, Building } from 'lucide-react';
import { getSystemSettings, updateSystemSettings } from '@/lib/system-settings';
import { getDepartments } from '@/lib/departments';
import { Department } from '@/integrations/firebase/types';
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
            <Label htmlFor="require-login" className="flex-1">
              <span className="font-medium">Require Student Login</span>
              <p className="text-sm text-gray-600">
                When enabled, students must sign in. When disabled, students can access exams and study notes directly as guests without logging in.
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
    </div>
  );
}

export default AdminSystemSettings;
