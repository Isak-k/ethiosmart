import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  AISystemSettings,
  AIProviderConfig,
  DEFAULT_AI_SETTINGS,
  getAISettings,
  saveAISettings,
  testAIProviderConnection,
} from '@/lib/ai-settings';
import { AIProviderId } from '../../../functions/src/ai-generator/types';
import {
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  RotateCcw,
  Zap,
  Cpu,
  ShieldCheck,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';

interface AIProviderSettingsSectionProps {
  onSaved?: () => void;
  showSaveButton?: boolean;
}

export function AIProviderSettingsSection({
  onSaved,
  showSaveButton = true,
}: AIProviderSettingsSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<AISystemSettings>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<
    Record<string, { testing: boolean; success?: boolean; message?: string; latencyMs?: number }>
  >({});
  const [testingAll, setTestingAll] = useState(false);

  // Load active AI settings
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const loaded = await getAISettings();
        if (isMounted) {
          setSettings(loaded);
        }
      } catch (err: any) {
        console.error('Error loading AI settings:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleShowKey = (providerId: string) => {
    setShowKeys((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const updateProviderField = (
    providerId: AIProviderId,
    field: keyof AIProviderConfig,
    value: any
  ) => {
    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          [field]: value,
        },
      },
    }));
  };

  const handleTestKey = async (providerId: AIProviderId) => {
    const config = settings.providers[providerId];
    if (!config.apiKey || !config.apiKey.trim()) {
      toast({
        title: 'API Key Required',
        description: `Please enter an API key for ${config.name} before testing.`,
        variant: 'destructive',
      });
      return;
    }

    setTestResults((prev) => ({
      ...prev,
      [providerId]: { testing: true },
    }));

    try {
      const result = await testAIProviderConnection(providerId, config.apiKey, config.model);
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          testing: false,
          success: result.success,
          message: result.message,
          latencyMs: result.latencyMs,
        },
      }));

      if (result.success) {
        toast({
          title: `${config.name} Verified`,
          description: result.message,
        });
      } else {
        toast({
          title: `${config.name} Verification Failed`,
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          testing: false,
          success: false,
          message: err.message || 'Verification request failed',
        },
      }));
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    const providers: AIProviderId[] = ['gemini', 'groq', 'openrouter', 'huggingface'];

    for (const p of providers) {
      if (settings.providers[p].apiKey && settings.providers[p].apiKey.trim()) {
        await handleTestKey(p);
      }
    }
    setTestingAll(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAISettings(settings, user?.uid || 'admin');
      toast({
        title: 'AI Provider Settings Saved',
        description: 'All AI engine credentials and fallback rules updated successfully.',
      });
      onSaved?.();
    } catch (err: any) {
      toast({
        title: 'Error Saving Settings',
        description: err.message || 'Could not save AI provider settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all AI provider models, fallback rules, and defaults? (Existing API keys will be preserved)')) {
      setSettings((prev) => ({
        ...DEFAULT_AI_SETTINGS,
        providers: {
          gemini: { ...DEFAULT_AI_SETTINGS.providers.gemini, apiKey: prev.providers.gemini.apiKey },
          groq: { ...DEFAULT_AI_SETTINGS.providers.groq, apiKey: prev.providers.groq.apiKey },
          openrouter: { ...DEFAULT_AI_SETTINGS.providers.openrouter, apiKey: prev.providers.openrouter.apiKey },
          huggingface: { ...DEFAULT_AI_SETTINGS.providers.huggingface, apiKey: prev.providers.huggingface.apiKey },
        },
      }));
      toast({
        title: 'Defaults Restored',
        description: 'Standard model presets and priorities loaded. Remember to click Save Settings.',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading AI Provider configuration...</p>
      </div>
    );
  }

  const providerList: AIProviderConfig[] = [
    settings.providers.gemini,
    settings.providers.groq,
    settings.providers.openrouter,
    settings.providers.huggingface,
  ];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border-border shadow-sm overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-cyan-500 text-primary-foreground flex items-center justify-center shadow-md">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-display font-bold">AI Provider Engine Settings</CardTitle>
                <CardDescription>
                  Configure AI providers, API keys, fallback priorities, and models for automated exam generation.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestAll}
                disabled={testingAll}
                className="rounded-xl text-xs h-8"
              >
                {testingAll ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Test All Configured
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetDefaults}
                className="rounded-xl text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset Defaults
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {providerList.map((p) => {
              const hasKey = Boolean(p.apiKey && p.apiKey.trim().length > 5);
              const test = testResults[p.id];
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border transition-all ${
                    hasKey
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'bg-muted/40 border-border opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-semibold text-xs truncate">{p.name.split(' ')[0]}</span>
                    {hasKey ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Missing Key
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate font-mono">
                    {p.model}
                  </div>
                  {test?.success != null && (
                    <div className={`mt-1.5 text-[10px] flex items-center gap-1 font-medium ${test.success ? 'text-emerald-500' : 'text-red-500'}`}>
                      {test.success ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Tested ({test.latencyMs}ms)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          <span>Test Failed</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Provider Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providerList.map((provider) => {
          const isKeyVisible = showKeys[provider.id] || false;
          const test = testResults[provider.id];
          const hasKey = Boolean(provider.apiKey && provider.apiKey.trim().length > 0);

          return (
            <Card
              key={provider.id}
              className={`border-border transition-all ${
                provider.enabled
                  ? 'border-border/80 shadow-xs'
                  : 'opacity-60 bg-muted/20 border-dashed'
              }`}
            >
              <CardHeader className="pb-3 pt-4 px-4 sm:px-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {provider.priority}
                      </div>
                      <CardTitle className="text-base font-bold flex items-center gap-1.5">
                        {provider.name}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs line-clamp-2">
                      {provider.description}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={provider.enabled}
                      onCheckedChange={(checked) => updateProviderField(provider.id, 'enabled', checked)}
                      aria-label={`Enable ${provider.name}`}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3.5 px-4 sm:px-5 pb-5">
                {/* API Key Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <KeyRound className="h-3.5 w-3.5 text-primary" />
                      API Key
                    </Label>
                    <a
                      href={provider.consoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      Get Free Key <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                    </a>
                  </div>

                  <div className="relative flex items-center">
                    <Input
                      type={isKeyVisible ? 'text' : 'password'}
                      value={provider.apiKey}
                      onChange={(e) => updateProviderField(provider.id, 'apiKey', e.target.value)}
                      placeholder={`Paste your ${provider.name} key...`}
                      className="pr-20 text-xs font-mono h-9 rounded-xl"
                    />
                    <div className="absolute right-1 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleShowKey(provider.id)}
                        className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                        title={isKeyVisible ? 'Hide Key' : 'Show Key'}
                      >
                        {isKeyVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Model Selector & Priority */}
                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground font-medium">Model Preset</Label>
                    <Select
                      value={provider.model}
                      onValueChange={(val) => updateProviderField(provider.id, 'model', val)}
                    >
                      <SelectTrigger className="h-8 rounded-xl text-xs bg-background">
                        <SelectValue placeholder="Select model..." />
                      </SelectTrigger>
                      <SelectContent>
                        {provider.recommendedModels.map((m) => (
                          <SelectItem key={m} value={m} className="text-xs font-mono">
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground font-medium">Fallback Priority</Label>
                    <Select
                      value={String(provider.priority)}
                      onValueChange={(val) => updateProviderField(provider.id, 'priority', Number(val))}
                    >
                      <SelectTrigger className="h-8 rounded-xl text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className="text-xs">1st (Highest)</SelectItem>
                        <SelectItem value="2" className="text-xs">2nd</SelectItem>
                        <SelectItem value="3" className="text-xs">3rd</SelectItem>
                        <SelectItem value="4" className="text-xs">4th (Lowest)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Test Connection Button & Status */}
                <div className="pt-1 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasKey || test?.testing}
                    onClick={() => handleTestKey(provider.id)}
                    className="h-8 text-xs rounded-xl flex items-center gap-1.5"
                  >
                    {test?.testing ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-3 w-3 text-amber-500" />
                        Test Connection
                      </>
                    )}
                  </Button>

                  {test?.message && (
                    <span
                      className={`text-[11px] font-medium truncate max-w-[200px] ${
                        test.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                      }`}
                      title={test.message}
                    >
                      {test.success ? `✓ Ready (${test.latencyMs}ms)` : '✕ Test Failed'}
                    </span>
                  )}
                </div>

                {/* Test error alert box if failed */}
                {test && test.success === false && test.message && (
                  <Alert variant="destructive" className="py-2 px-3 rounded-xl">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <AlertDescription className="text-[11px] leading-tight">
                      {test.message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Global Orchestration Settings */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Generation & Orchestration Behavior
          </CardTitle>
          <CardDescription className="text-xs">
            Fine-tune how the automatic fallback system handles multiple engines and batches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Preferred Primary Engine</Label>
              <Select
                value={settings.defaultProvider}
                onValueChange={(val: AIProviderId) => setSettings((prev) => ({ ...prev, defaultProvider: val }))}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini (Recommended)</SelectItem>
                  <SelectItem value="groq">Groq (Ultra-Fast)</SelectItem>
                  <SelectItem value="openrouter">OpenRouter Gateway</SelectItem>
                  <SelectItem value="huggingface">Hugging Face</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Engine called first before engaging fallbacks.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Max Batch Size</Label>
              <Select
                value={String(settings.maxBatchSize || 10)}
                onValueChange={(val) => setSettings((prev) => ({ ...prev, maxBatchSize: Number(val) }))}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 Questions / Batch (High Reliability)</SelectItem>
                  <SelectItem value="10">10 Questions / Batch (Standard)</SelectItem>
                  <SelectItem value="15">15 Questions / Batch (Fast)</SelectItem>
                  <SelectItem value="20">20 Questions / Batch (High Throughput)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Questions generated per single API call.
              </p>
            </div>

            <div className="space-y-1.5 flex flex-col justify-between">
              <div>
                <Label className="text-xs font-semibold">Auto-Failover On Errors</Label>
                <p className="text-[10px] text-muted-foreground">
                  Switch automatically if primary hits quota or 429 rate limit.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={settings.autoFallback}
                  onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, autoFallback: checked }))}
                  id="auto-fallback-switch"
                />
                <Label htmlFor="auto-fallback-switch" className="text-xs font-medium cursor-pointer">
                  {settings.autoFallback ? 'Enabled (Recommended)' : 'Disabled'}
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Action Footer */}
      {showSaveButton && (
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Settings are stored securely in Firestore and synchronized for all admin exam generations.
          </p>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl px-5 h-10 font-semibold bg-gradient-to-r from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-700 shadow-md shadow-primary/20"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save AI Settings
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
export default AIProviderSettingsSection;
