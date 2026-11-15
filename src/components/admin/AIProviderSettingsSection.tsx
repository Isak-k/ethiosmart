import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import type { AIProviderId } from '@/lib/ai-engine/types.ts';
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
  SlidersHorizontal,
  ClipboardPaste,
  X,
  Check,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIProviderSettingsSectionProps {
  onSaved?: () => void;
  showSaveButton?: boolean;
}

function getApiKeyFormatHint(providerId: AIProviderId, key: string): { type: 'warning' | 'info'; text: string } | null {
  const trimmed = (key || '').trim();
  if (!trimmed) return null;

  if (providerId === 'gemini') {
    if (trimmed.startsWith('gsk_')) return { type: 'warning', text: 'This looks like a Groq key (starts with gsk_).' };
    if (trimmed.startsWith('sk-or-')) return { type: 'warning', text: 'This looks like an OpenRouter key (starts with sk-or-).' };
    if (trimmed.startsWith('hf_')) return { type: 'warning', text: 'This looks like a Hugging Face token (starts with hf_).' };
    if (!trimmed.startsWith('AIzaSy')) return { type: 'info', text: 'Standard Google Gemini keys usually begin with "AIzaSy".' };
  } else if (providerId === 'groq') {
    if (trimmed.startsWith('AIzaSy')) return { type: 'warning', text: 'This looks like a Google Gemini key (starts with AIzaSy).' };
    if (trimmed.startsWith('sk-or-')) return { type: 'warning', text: 'This looks like an OpenRouter key (starts with sk-or-).' };
    if (trimmed.startsWith('hf_')) return { type: 'warning', text: 'This looks like a Hugging Face token (starts with hf_).' };
    if (!trimmed.startsWith('gsk_')) return { type: 'info', text: 'Standard Groq keys usually begin with "gsk_".' };
  } else if (providerId === 'openrouter') {
    if (trimmed.startsWith('AIzaSy')) return { type: 'warning', text: 'This looks like a Google Gemini key.' };
    if (trimmed.startsWith('gsk_')) return { type: 'warning', text: 'This looks like a Groq key.' };
    if (trimmed.startsWith('hf_')) return { type: 'warning', text: 'This looks like a Hugging Face token.' };
    if (!trimmed.startsWith('sk-or-')) return { type: 'info', text: 'Standard OpenRouter keys usually begin with "sk-or-".' };
  } else if (providerId === 'huggingface') {
    if (trimmed.startsWith('AIzaSy')) return { type: 'warning', text: 'This looks like a Google Gemini key.' };
    if (trimmed.startsWith('gsk_')) return { type: 'warning', text: 'This looks like a Groq key.' };
    if (trimmed.startsWith('sk-or-')) return { type: 'warning', text: 'This looks like an OpenRouter key.' };
    if (!trimmed.startsWith('hf_')) return { type: 'info', text: 'Standard Hugging Face access tokens begin with "hf_".' };
  }
  return null;
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
  const [customModelInputs, setCustomModelInputs] = useState<Record<string, boolean>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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
          // Check if any provider has custom model active
          const customActive: Record<string, boolean> = {};
          (['gemini', 'groq', 'openrouter', 'huggingface'] as AIProviderId[]).forEach(id => {
            const p = loaded.providers[id];
            if (p && !p.recommendedModels.includes(p.model)) {
              customActive[id] = true;
            }
          });
          setCustomModelInputs(customActive);
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
    setHasUnsavedChanges(true);
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

  const handlePasteKey = async (providerId: AIProviderId) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          updateProviderField(providerId, 'apiKey', text.trim());
          toast({ description: `Pasted API key for ${settings.providers[providerId].name}` });
        }
      }
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleClearKey = (providerId: AIProviderId) => {
    updateProviderField(providerId, 'apiKey', '');
    setTestResults((prev) => ({
      ...prev,
      [providerId]: { testing: false },
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
          title: `${config.name} Verified ✓`,
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
      setHasUnsavedChanges(false);
      toast({
        title: 'AI Provider Settings Saved ✓',
        description: 'AI engine credentials, active models, and fallback priorities updated successfully.',
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
      setHasUnsavedChanges(true);
      toast({
        title: 'Defaults Restored',
        description: 'Standard model presets and priorities loaded. Click "Save AI Settings" to apply.',
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

  const configuredCount = providerList.filter(p => Boolean(p.apiKey && p.apiKey.trim().length > 5)).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Overview & Quick Diagnostics Header */}
      <Card className="border-border shadow-xs overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader className="pb-3 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-md shadow-purple-500/10 shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">AI Provider Engine Settings</CardTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-2 py-0 font-medium",
                      configuredCount > 0
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                        : "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                    )}
                  >
                    {configuredCount}/4 Engines Configured
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-0.5 line-clamp-1 sm:line-clamp-none">
                  Configure API keys, preferred models, and failover priority. Run Test All to verify credentials and model access.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestAll}
                disabled={testingAll || configuredCount === 0}
                className="rounded-xl text-xs h-8 px-2.5 sm:px-3"
                title="Send a quick diagnostic ping to all providers with configured API keys"
              >
                {testingAll ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Test All
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetDefaults}
                className="rounded-xl text-xs h-8 px-2 sm:px-2.5 text-muted-foreground hover:text-foreground"
                title="Restore default model presets"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Defaults
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Engine Status Grid */}
        <CardContent className="px-4 sm:px-5 pb-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            {providerList.map((p) => {
              const hasKey = Boolean(p.apiKey && p.apiKey.trim().length > 5);
              const test = testResults[p.id];
              return (
                <div
                  key={p.id}
                  className={cn(
                    "p-2.5 sm:p-3 rounded-xl border transition-all",
                    hasKey
                      ? "bg-emerald-500/5 border-emerald-500/30"
                      : "bg-muted/40 border-border opacity-75"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-xs truncate">{p.name.split(' ')[0]}</span>
                    {hasKey ? (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        Missing
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate font-mono">
                    {p.model}
                  </div>
                  {test?.success != null && (
                    <div className={cn("mt-1 text-[10px] flex items-center gap-1 font-medium", test.success ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                      {test.success ? (
                        <>
                          <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{test.latencyMs}ms</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">Failed</span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {providerList.map((provider) => {
          const isKeyVisible = showKeys[provider.id] || false;
          const isCustomModel = customModelInputs[provider.id] || false;
          const test = testResults[provider.id];
          const hasKey = Boolean(provider.apiKey && provider.apiKey.trim().length > 0);
          const formatHint = getApiKeyFormatHint(provider.id, provider.apiKey);

          return (
            <Card
              key={provider.id}
              className={cn(
                "border-border transition-all",
                provider.enabled
                  ? "shadow-xs border-border/80"
                  : "opacity-60 bg-muted/20 border-dashed"
              )}
            >
              <CardHeader className="pb-2.5 pt-3.5 px-4 sm:px-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {provider.priority}
                      </div>
                      <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-1.5">
                        {provider.name}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs line-clamp-2">
                      {provider.description}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                      checked={provider.enabled}
                      onCheckedChange={(checked) => updateProviderField(provider.id, 'enabled', checked)}
                      aria-label={`Enable ${provider.name}`}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 px-4 sm:px-5 pb-4">
                {/* API Key Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <KeyRound className="h-3.5 w-3.5 text-primary" />
                      API Key
                    </Label>
                    <a
                      href={provider.consoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-0.5 font-medium"
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
                      className={cn(
                        "pr-24 text-xs font-mono h-9 rounded-xl",
                        formatHint?.type === 'warning' && "border-amber-500/60 focus-visible:ring-amber-500"
                      )}
                    />
                    <div className="absolute right-1 flex items-center gap-0.5">
                      {hasKey && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClearKey(provider.id)}
                          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                          title="Clear API Key"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!hasKey && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePasteKey(provider.id)}
                          className="h-7 px-2 text-[10px] rounded-lg text-muted-foreground hover:text-foreground flex items-center gap-1"
                          title="Paste from clipboard"
                        >
                          <ClipboardPaste className="h-3 w-3" />
                          <span>Paste</span>
                        </Button>
                      )}
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

                  {/* Format warning hint if wrong key pattern was pasted */}
                  {formatHint && (
                    <p className={cn(
                      "text-[10.5px] leading-tight flex items-center gap-1 pt-0.5",
                      formatHint.type === 'warning' ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"
                    )}>
                      {formatHint.type === 'warning' && <AlertCircle className="h-3 w-3 shrink-0" />}
                      <span>{formatHint.text}</span>
                    </p>
                  )}
                </div>

                {/* Model Selector & Priority */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-muted-foreground font-medium">Model</Label>
                      <button
                        type="button"
                        onClick={() => setCustomModelInputs(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                        className="text-[10px] text-primary hover:underline font-medium cursor-pointer"
                      >
                        {isCustomModel ? 'Preset Models' : 'Custom Model'}
                      </button>
                    </div>

                    {isCustomModel ? (
                      <Input
                        type="text"
                        value={provider.model}
                        onChange={(e) => updateProviderField(provider.id, 'model', e.target.value)}
                        placeholder="e.g. gemini-2.0-flash"
                        className="h-8 rounded-xl text-xs font-mono bg-background"
                      />
                    ) : (
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
                    )}
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
                <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasKey || test?.testing}
                    onClick={() => handleTestKey(provider.id)}
                    className="h-8 text-xs rounded-xl flex items-center gap-1.5 shadow-2xs"
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
                      className={cn(
                        "text-[11px] font-medium truncate max-w-[210px]",
                        test.success ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      )}
                      title={test.message}
                    >
                      {test.success ? `✓ Ready (${test.latencyMs}ms)` : '✕ Test Failed'}
                    </span>
                  )}
                </div>

                {/* Detailed Test Failure Message */}
                {test && test.success === false && test.message && (
                  <Alert variant="destructive" className="py-2 px-3 rounded-xl mt-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <AlertDescription className="text-[11px] leading-tight break-words">
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
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3 p-4 sm:p-5">
          <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Generation & Orchestration Behavior
          </CardTitle>
          <CardDescription className="text-xs">
            Configure how the failover system prioritizes engines during automated generation batches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Preferred Primary Engine</Label>
              <Select
                value={settings.defaultProvider}
                onValueChange={(val: AIProviderId) => {
                  setHasUnsavedChanges(true);
                  setSettings((prev) => ({ ...prev, defaultProvider: val }));
                }}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini (Recommended)</SelectItem>
                  <SelectItem value="groq">Groq (Ultra-Fast LPU)</SelectItem>
                  <SelectItem value="openrouter">OpenRouter Gateway</SelectItem>
                  <SelectItem value="huggingface">Hugging Face</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Engine invoked first before fallback triggers.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Max Batch Size</Label>
              <Select
                value={String(settings.maxBatchSize || 10)}
                onValueChange={(val) => {
                  setHasUnsavedChanges(true);
                  setSettings((prev) => ({ ...prev, maxBatchSize: Number(val) }));
                }}
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
                Number of questions generated per request batch.
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
                  onCheckedChange={(checked) => {
                    setHasUnsavedChanges(true);
                    setSettings((prev) => ({ ...prev, autoFallback: checked }));
                  }}
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 pb-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {hasUnsavedChanges ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                You have unsaved changes. Remember to click Save.
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Settings saved and synchronized.
              </span>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "rounded-xl px-5 h-9 sm:h-10 text-xs sm:text-sm font-semibold shadow-md transition-all w-full sm:w-auto",
              hasUnsavedChanges
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white animate-pulse"
                : "bg-gradient-to-r from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-700 text-white"
            )}
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
