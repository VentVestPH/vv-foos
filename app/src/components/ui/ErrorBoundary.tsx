import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../../lib/errorReporter';
import { isStaleBuildError, reloadForStaleBuild } from '../../lib/staleBuild';

interface ErrorBoundaryProps {
  children: ReactNode;
  label?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isStaleBuildError(error) && reloadForStaleBuild()) return;
    reportError(
      `boundary:${this.props.label ?? 'app'}`,
      error,
      `${error.stack ?? ''}${info.componentStack ?? ''}`,
    );
    console.error(
      `Unhandled error in ${this.props.label ?? 'the application'}:`,
      error,
      info.componentStack,
    );
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <h2 className="error-boundary-title">
          {this.props.label ? `${this.props.label} could not be displayed` : 'Something went wrong'}
        </h2>
        <p className="error-boundary-body">
          The rest of the application is still working. Nothing you had already saved is affected.
        </p>
        <p className="error-boundary-detail">{error.message}</p>
        <div className="error-boundary-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={this.reset}>
            Try again
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
