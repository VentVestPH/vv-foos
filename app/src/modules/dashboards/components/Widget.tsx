import type { ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { ErrorBoundary } from '../../../components/ui/ErrorBoundary';
import { downloadCsv } from '../../../lib/csv';

export function Widget({
  title,
  lastRefreshed,
  exportRows,
  exportFilename,
  children,
}: {
  title: string;
  lastRefreshed: Date | null;
  exportRows?: Record<string, unknown>[];
  exportFilename?: string;
  children: ReactNode;
}) {
  return (
    <section className="dash-widget">
      <header className="dash-widget-head">
        <h3>{title}</h3>
        <div className="dash-widget-actions">
          {lastRefreshed && (
            <span className="dash-widget-refreshed">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          {exportRows && (
            <Button
              size="sm"
              onClick={() => downloadCsv(exportFilename ?? `${title}.csv`, exportRows)}
              disabled={exportRows.length === 0}
            >
              Export CSV
            </Button>
          )}
        </div>
      </header>
      <ErrorBoundary label={title}>{children}</ErrorBoundary>
    </section>
  );
}
