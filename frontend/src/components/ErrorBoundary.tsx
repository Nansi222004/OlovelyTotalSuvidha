import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export function extractErrorMessage(error: any): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.message && typeof error.message === 'string') return error.message;
  if (error.reason?.message && typeof error.reason.message === 'string') return error.reason.message;
  if (error.reason) return String(error.reason);
  if (error.stack) return String(error.stack);
  return String(error);
}

export function checkIsChunkError(error: any): boolean {
  const msg = extractErrorMessage(error).toLowerCase();
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('failed to load module script') ||
    msg.includes('error loading module')
  );
}

/**
 * Error boundary component to catch errors in lazy-loaded components
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);

    if (checkIsChunkError(error)) {
      const lastReload = Number(sessionStorage.getItem('chunk_reload_ts') || '0');
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem('chunk_reload_ts', String(Date.now()));
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    try {
      // Clear all reload markers on explicit user click
      Object.keys(sessionStorage).forEach((key) => {
        if (key.includes('retry') || key.includes('chunk') || key.includes('preload') || key.includes('reload')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {
      // Ignore sessionStorage access errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const rawError = this.state.error;
      const isChunkError = checkIsChunkError(rawError);
      const displayMessage = extractErrorMessage(rawError);

      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
            <div className="text-center p-6 sm:p-8 max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {isChunkError ? 'App Update Available' : 'Something went wrong'}
              </h2>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                {isChunkError
                  ? 'A new version of the app was deployed or your connection was briefly interrupted. Reloading will get you back on track.'
                  : displayMessage || 'An unexpected error occurred.'}
              </p>
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 cursor-pointer"
              >
                Reload Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

