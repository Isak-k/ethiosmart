import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface GradingErrorBoundaryProps {
  children: ReactNode;
}

interface GradingErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

export class GradingErrorBoundary extends Component<GradingErrorBoundaryProps, GradingErrorBoundaryState> {
  state: GradingErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): GradingErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Manual grading view failed to render:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6 bg-background text-foreground">
          <div className="w-full max-w-md p-6 rounded-2xl border border-border bg-card shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold">Grading Page Notice</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.errorMessage || "The grading view encountered a display error."}
            </p>
            <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg border">
              Any points you recently awarded were already saved to the database.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-accent text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Go Back
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}