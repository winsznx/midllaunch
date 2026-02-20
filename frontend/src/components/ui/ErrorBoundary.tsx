'use client';
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="glass p-8 text-center">
          <div className="text-3xl mb-3">⚠</div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Something went wrong.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="btn-ghost mt-4 text-sm"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
