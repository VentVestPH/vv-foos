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
  adoption_rate: 'Adoption: active staff share',
  adoption_active_staff: 'Adoption: staff active this week',
  adoption_total_staff: 'Adoption: active staff on roll',
  cycle_time_intake_to_submitted_days: 'Cycle time: intake to submitted (median)',
  cycle_time_deal_created_to_won_days: 'Cycle time: deal created to won (median)',
  cost_monthly_total: 'Cost: monthly total of systems being replaced',
  data_quality_dedup_rate: 'Data quality: intake dedup rate',
  data_quality_contact_completeness: 'Data quality: contact completeness',
  data_quality_grading_preserved: 'Data quality: grading preserved',
};

const GATE_METRICS = new Set([
  'adoption_rate',
  'cycle_time_intake_to_submitted_days',
  'cycle_time_deal_created_to_won_days',
  'cost_monthly_total',
  'data_quality_dedup_rate',
  'data_quality_contact_completeness',
  'data_quality_grading_preserved',
]);

function formatValue(row: SuccessMetricRow): string {
  if (row.value === null) return 'Not measured';
  switch (row.unit) {
    case 'currency':
      return `$${row.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    case 'ratio':
      return `${(row.value * 100).toFixed(1)}%`;
    case 'days':
      return `${row.value.toFixed(1)} days`;
    default:
      return row.value.toLocaleString();
  }
}

export function ExperimentMetrics({ range }: { range: DateRange }) {
  const [rows, setRows] = useState<SuccessMetricRow[]>([]);
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(() => {
    void dashDb
      .from('vw_success_metrics')
      .select('*')
      .gte('week_start', range.from)
      .lte('week_start', range.to)
      .order('week_start', { ascending: false })
      .then(({ data }) => {
        const next = (data as unknown as SuccessMetricRow[]) ?? [];
        setRows(next);
        setRefreshed(new Date());
        setStatus(`${next.length} metric ${next.length === 1 ? 'row' : 'rows'} loaded.`);
      });
  }, [range.from, range.to]);

  useEffect(load, [load]);

  const refreshNow = async () => {
    setRefreshing(true);
    setStatus('Refreshing metrics…');
    const { error } = await dashDb.rpc('refresh_materialized_views');
    setRefreshing(false);
    if (error) {
      setStatus('Refresh failed. The previous figures are still shown.');
      return;
    }
    load();
  };

  const columns: TableColumn<SuccessMetricRow>[] = [
    {
      key: 'metric_key',
      header: 'Metric',
      sortable: true,
      render: (r) => (
        <span>
          {METRIC_LABELS[r.metric_key] ?? r.metric_key}
          {GATE_METRICS.has(r.metric_key) ? (
            <span className="dash-gate-tag" title="Gates cancellation of the Taleo and Zoho subscriptions">
              gate
            </span>
          ) : null}
        </span>
      ),
    },
    { key: 'week_start', header: 'Week of', sortable: true },
    {
      key: 'value',
      header: 'Value',
      sortable: true,
      sortValue: (r) => r.value ?? 0,
      render: formatValue,
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
        A weekly rollup for tracking whether recent product and process changes
        are moving the numbers that matter, per the project&rsquo;s &ldquo;treat
        changes as experiments&rdquo; working rule. Rows tagged{' '}
        <span className="dash-gate-tag">gate</span> are the four committed
        success metrics that gate cancelling the Taleo and Zoho subscriptions.
        Cost reads &ldquo;Not measured&rdquo; until <code>dash.cost_inputs</code>{' '}
        carries a monthly figure for each system.
      </p>
      <Button size="sm" onClick={refreshNow} disabled={refreshing}>
        {refreshing ? 'Refreshing…' : 'Refresh now'}
      </Button>
      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
      <Table
        columns={columns}
        rows={rows}
        busy={refreshing}
        rowKey={(r) => `${r.metric_key}-${r.week_start}`}
        emptyText="No metrics in range yet."
      />
    </Widget>
  );
}
