import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';
import { Card } from './Card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Civora Uncaught Render Error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <Card className="max-w-lg w-full p-8 text-center space-y-5 shadow-lg">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-xl font-bold">
              !
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">Something went wrong</h2>
              <p className="text-sm text-[#4B5563] dark:text-[#D1D5DB]">
                An unexpected interface error occurred while rendering this section. Our team has been notified.
              </p>
              {this.state.error && (
                <div className="mt-3 p-3 bg-rose-50 dark:bg-[#182230] rounded-lg text-left text-xs font-mono text-rose-800 dark:text-[#FCA5A5] border border-rose-200 dark:border-rose-500/35 overflow-x-auto">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="primary" onClick={this.handleReset}>
                Reload Page
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = '/')}>
                Return to Home
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
