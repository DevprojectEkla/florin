import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-900">
          <div className="w-full max-w-md text-center">
            <div className="text-red-400 text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-slate-100 mb-2">
              Something went wrong
            </h1>
            <p className="text-slate-400 text-sm mb-6">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              className="btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '/dashboard';
                window.location.reload();
              }}
            >
              Restart the app
            </button>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 text-left text-xs text-slate-500 bg-slate-800 p-3 rounded-lg overflow-auto max-h-48">
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
