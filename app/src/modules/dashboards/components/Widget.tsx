import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ErrorBoundary } from '../../../components/ui/ErrorBoundary';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { downloadCsv } from '../../../lib/csv';

export function Widget({
  title,
  lastRefreshed,
  exportRows,
  exportFilename,
  excludesTestRecords = false,
  loading = false,
  kpis = 2,
  bars = 5,
  children,
}: {
  title: string;
  lastRefreshed: Date | null;
  exportRows?: Record<string, unknown>[];
  exportFilename?: string;
  excludesTestRecords?: boolean;
  loading?: boolean;
  kpis?: number;
  bars?: number;
  children: ReactNode;
}) {
  const showSkeleton = useMinimumVisible(loading);
  return (
    <section className="dash-widget">
      <header className="dash-widget-head">
        <h3>{title}</h3>
        <div className="dash-widget-actions">
          {excludesTestRecords && (
            <span className="dash-widget-scope">Excludes test records</span>
          )}
          {lastRefreshed && !showSkeleton && (
            <span className="dash-widget-refreshed">
              Updated{' '}
              {lastRefreshed.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
          {exportRows && (
            <Button
              size="sm"
              onClick={() => downloadCsv(exportFilename ?? `${title}.csv`, exportRows)}
              disabled={exportRows.length === 0}
              title={exportRows.length === 0 ? 'There is nothing in this panel to export' : undefined}
            >
              <Download size={20} aria-hidden="true" />
              Export CSV
            </Button>
          )}
        </div>
      </header>
      <ErrorBoundary label={title}>
        {showSkeleton ? (
          <div className="dash-widget-loading">
            {kpis > 0 && <Skeleton variant="card" rows={kpis} label={`Loading ${title}`} />}
            {bars > 0 && <Skeleton rows={bars} label={`Loading ${title}`} />}
          </div>
        ) : (
          children
        )}
      </ErrorBoundary>
    </section>
  );
}
