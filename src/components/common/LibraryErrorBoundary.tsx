import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { BookOpen, RefreshCw, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LibraryErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface LibraryErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

export class LibraryErrorBoundary extends Component<LibraryErrorBoundaryProps, LibraryErrorBoundaryState> {
  state: LibraryErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): LibraryErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Library view encountered an unexpected error:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false });
    // Clear URL search params that might cause problems
    if (window.location.search) {
      window.location.href = window.location.pathname;
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6 bg-background text-foreground">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-xl text-center space-y-5 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <BookOpen className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold font-display">
                {this.props.fallbackTitle || 'Library Display Notice'}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {this.props.fallbackDescription ||
                  "The library resources view encountered a display issue while loading materials."}
              </p>
              {this.state.errorMessage && (
                <div className="text-xs font-mono text-muted-foreground bg-muted/60 p-3 rounded-xl border max-h-24 overflow-auto text-left">
                  {this.state.errorMessage}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="rounded-xl text-xs font-semibold h-9"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Go Back
              </Button>
              <Button
                variant="secondary"
                onClick={this.handleReset}
                className="rounded-xl text-xs font-semibold h-9"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Reset Library View
              </Button>
              <Button
                onClick={this.handleReload}
                className="rounded-xl text-xs font-semibold h-9 bg-primary text-primary-foreground"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
