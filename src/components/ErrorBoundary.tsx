import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.state = { ...this.state, error, errorInfo };
    try {
      this.setState({ error, errorInfo });
    } catch {}
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Something went wrong
            </h2>

            <p className="text-sm text-slate-600 mb-6">
              An unexpected error occurred while rendering this page. You can try refreshing or returning to the home screen.
            </p>

            {this.state.error && (
              <div className="mb-6 text-left">
                <details className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 cursor-pointer">
                  <summary className="font-medium text-slate-700 hover:text-slate-900 select-none">
                    Error details (Technical log)
                  </summary>
                  <pre className="mt-2 text-red-600 whitespace-pre-wrap break-all font-mono">
                    {this.state.error.message}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="mt-1 text-slate-400 whitespace-pre-wrap font-mono text-[10px]">
                      {this.state.errorInfo.componentStack.slice(0, 300)}...
                    </pre>
                  )}
                </details>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reload Page
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
