import { Spinner } from './Spinner';

interface LoadingPaneProps {
  what?: string;
}

export function LoadingPane({ what = 'this page' }: LoadingPaneProps) {
  return (
    <div className="full-center">
      <div className="loading-pane">
        <Spinner label={`Loading ${what}`} />
        <span className="loading-pane-text">Loading {what}…</span>
      </div>
    </div>
  );
}
