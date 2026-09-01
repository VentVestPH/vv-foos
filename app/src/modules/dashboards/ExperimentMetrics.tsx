import { useCallback, useEffect, useState } from 'react';
import { dashDb } from './db';
import { Widget } from './components/Widget';
import { Table, type TableColumn } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { exportFilename, type DateRange, type SuccessMetricRow } from './lib';

const METRIC_LABELS: Record<string, string> = {
  requisitions_opened: 'Requisitions opened',
  requisitions_filled: 'Requisitions filled',
  applications_received: 'Applications received',
  applications_hired: 'Applications hired',
  deals_won: 'Deals won',
  deals_lost: 'Deals lost',
  pipeline_value_open: 'Open pipeline value',
};

export function ExperimentMetrics({ range }: { range: DateRange }) {
  const [rows, setRows] = useState<SuccessMetricRow[]>([]);
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    void dashDb
      .from('vw_success_metrics')
      .select('*')
      .gte('week_start', range.from)
      .lte('week_start', range.to)
      .order('week_start', { ascending: false })
      .then(({ data }) => {
        setRows((data as unknown as SuccessMetricRow[]) ?? []);
        setRefreshed(new Date());
      });
  }, [range.from, range.to]);

  useEffect(load, [load]);

  const refreshNow = async () => {
    setRefreshing(true);
    const { error } = await dashDb.rpc('refresh_materialized_views');
    setRefreshing(false);
    if (!error) load();
  };

  const columns: TableColumn<SuccessMetricRow>[] = [
    {
      key: 'metric_key',
      header: 'Metric',
      sortable: true,
      render: (r) => METRIC_LABELS[r.metric_key] ?? r.metric_key,
    },
    { key: 'week_start', header: 'Week of', sortable: true },
    {
      key: 'value',
      header: 'Value',
      sortable: true,
      sortValue: (r) => r.value ?? 0,
      render: (r) => (r.unit === 'currency' ? `$${(r.value ?? 0).toLocaleString()}` : r.value),
    },
  ];

  return (
    <Widget
      title="Experiment metrics (admin only)"
      lastRefreshed={refreshed}
      exportRows={rows as unknown as Record<string, unknown>[]}
      exportFilename={exportFilename('experiment-metrics', 'weekly', range)}
    >
      <p className="dash-widget-note">
        Not one of the five numbered dashboards — a weekly rollup for
        tracking whether recent product/process changes are moving the
        numbers that matter, per the project's "treat changes as
        experiments" working rule. Empty until dash.cost_inputs is populated
        for cost-based metrics.
      </p>
      <Button size="sm" onClick={refreshNow} disabled={refreshing}>
        {refreshing ? 'Refreshing…' : 'Refresh now'}
      </Button>
      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => `${r.metric_key}-${r.week_start}`}
        emptyText="No metrics in range yet."
      />
    </Widget>
  );
}
