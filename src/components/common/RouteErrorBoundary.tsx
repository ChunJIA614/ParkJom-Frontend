import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface RouteErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
  onNavigateHome?: () => void;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Catches unexpected runtime or lazy-chunk load errors inside routed views so
 * users see a clear recovery screen instead of a blank page.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected error occurred while loading this page.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('RouteErrorBoundary caught error:', error, info);
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReturnHome = () => {
    this.setState({ hasError: false, errorMessage: null });
    if (this.props.onNavigateHome) {
      this.props.onNavigateHome();
    } else {
      window.location.assign('/');
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        role="alert"
        className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 py-12 text-[#1d1d1f] dark:bg-[#0e0e11] dark:text-white"
      >
        <div className="w-full max-w-md rounded-3xl border border-black/[0.08] bg-white p-6 text-center shadow-xl dark:border-white/10 dark:bg-[#18181C] sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <AlertTriangle size={24} aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-lg font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-xs leading-relaxed text-[#6e6e73] dark:text-[#A1A1AA]">
            {this.state.errorMessage || 'We hit an unexpected issue loading this view.'}
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-4 text-xs font-semibold text-white hover:bg-[#0066d6] cursor-pointer"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Reload page
            </button>
            <button
              type="button"
              onClick={this.handleReturnHome}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-black/10 px-4 text-xs font-semibold text-[#1d1d1f] hover:bg-black/[0.04] dark:border-white/15 dark:text-white dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <Home size={14} aria-hidden="true" />
              Return home
            </button>
          </div>
        </div>
      </main>
    );
  }
}
