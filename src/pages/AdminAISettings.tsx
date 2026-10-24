import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { AIProviderSettingsSection } from '@/components/admin/AIProviderSettingsSection';

export default function AdminAISettings() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
        {/* Header navigation */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/admin/ai-generator')}
              className="rounded-xl h-9"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              AI Generator
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold">AI Provider Settings</h1>
              <p className="text-sm text-muted-foreground">
                Set up API keys, default engine, models, and fallback order for automated question generation.
              </p>
            </div>
          </div>
        </div>

        <AIProviderSettingsSection
          onSaved={() => {
            // Optional callback after save
          }}
          showSaveButton={true}
        />
      </div>
    </DashboardLayout>
  );
}
