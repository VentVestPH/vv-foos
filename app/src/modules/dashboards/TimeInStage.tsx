import { useCallback, useEffect, useState } from 'react';
import { dashDb } from './db';
import { Widget } from './components/Widget';
import { BarList } from './components/BarList';
import { KpiCard, KpiRow } from './components/Kpi';
import { Button } from '../../components/ui/Button';
import { useIsAdmin } from './hooks';
import { exportFilename, fmtDays, type DateRange, type StageDurationRow } from './lib';

function avgByStage(rows: StageDurationRow[]): { label: string; count: number }[] {
  const sums = new Map<string, { total: number; n: number }>();
  for (const r of rows) {
    if (r.duration_days === null) continue;
    const key = r.stage_to;
    const cur = sums.get(key) ?? { total: 0, n: 0 };
    cur.total += r.duration_days;
    cur.n += 1;
    sums.set(key, cur);
  }
  return [...sums.entries()]
    .map(([label, { total, n }]) => ({ label, count: Math.round((total / n) * 10) / 10 }))
    .sort((a, b) => b.count - a.count);
}

export function TimeInStage({ range }: { range: DateRange }) {
  const isAdmin = useIsAdmin();
  const [rows, setRows] = useState<StageDurationRow[]>([]);
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    void dashDb
      .from('mv_stage_durations')
      .select('*')
      .gte('changed_at', range.from)
      .lte('changed_at', `${range.to}T23:59:59`)
      .then(({ data }) => {
        setRows((data as unknown as StageDurationRow[]) ?? []);
        setRefreshed(new Date());
      });
  }, [range.from, range.to]);

  useEffect(load, [load]);

  const apps = rows.filter((r) => r.entity_type === 'application');
  const reqs = rows.filter((r) => r.entity_type === 'requisition');
  const overallAvg =
    apps.filter((r) => r.duration_days !== null).length > 0
      ? apps.reduce((s, r) => s + (r.duration_days ?? 0), 0) /
        apps.filter((r) => r.duration_days !== null).length
      : null;

  const refreshNow = async () => {
    setRefreshing(true);
    const { error } = await dashDb.rpc('refresh_materialized_views');
    setRefreshing(false);
    if (!error) load();
  };

  return (
    <div className="dash-grid-2">
      <Widget
        title="Time in stage — applications"
        lastRefreshed={refreshed}
        exportRows={avgByStage(apps)}
        exportFilename={exportFilename('time-in-stage', 'applications', range)}
      >
        <KpiRow>
          <KpiCard label="Avg. days per stage move" value={fmtDays(overallAvg)} />
          {isAdmin && (
            <Button size="sm" onClick={refreshNow} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </Button>
          )}
        </KpiRow>
        <BarList items={avgByStage(apps)} />
      </Widget>
      <Widget
        title="Time in stage — requisitions"
        lastRefreshed={refreshed}
        exportRows={avgByStage(reqs)}
        exportFilename={exportFilename('time-in-stage', 'requisitions', range)}
      >
        <BarList items={avgByStage(reqs)} />
        <p className="dash-widget-note">
          Refreshed every 15 minutes by a scheduled job (audit_log is
          admin-read only, so this is pre-aggregated server-side rather than
          queried live — see the brief's mv_stage_durations exception).
        </p>
      </Widget>
    </div>
  );
}
