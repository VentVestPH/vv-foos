import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashDb } from './db';
import { Widget } from './components/Widget';
import { KpiCard, KpiRow } from './components/Kpi';
import { Table, type TableColumn } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { useOutboxRefresh } from './hooks';
import { exportFilename, type DateRange, type RequisitionAgingRow, type Threshold } from './lib';
import { EMPTY_CELL } from '../../lib/format';

export function RequisitionAging({ range }: { range: DateRange }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RequisitionAgingRow[]>([]);
  const [thresholdDays, setThresholdDays] = useState(14);
  const [refreshed, setRefreshed] = useState<Date | null>(null);

  const load = useCallback(() => {
    void dashDb
      .from('vw_requisition_aging')
      .select('*')
      .gte('opened_date', range.from)
      .lte('opened_date', range.to)
      .then(({ data }) => {
        setRows((data as unknown as RequisitionAgingRow[]) ?? []);
        setRefreshed(new Date());
      });
    void dashDb
      .from('thresholds')
      .select('*')
      .eq('metric', 'requisition_aging_days')
      .maybeSingle()
      .then(({ data }) => {
        const t = data as unknown as Threshold | null;
        if (t) setThresholdDays(t.days);
      });
  }, [range.from, range.to]);

  useEffect(load, [load]);
  useOutboxRefresh(load);

  const open = rows.filter((r) => r.status !== 'filled' && r.status !== 'closed');
  const overThreshold = open.filter((r) => r.days_open > thresholdDays);
  const unviewedTotal = open.reduce((s, r) => s + r.unviewed_applications, 0);

  const columns: TableColumn<RequisitionAgingRow>[] = [
    { key: 'display_code', header: 'Code' },
    { key: 'title', header: 'Title' },
    { key: 'company_name', header: 'Company' },
    { key: 'status', header: 'Status' },
    {
      key: 'days_open',
      header: 'Days open',
      sortValue: (r) => r.days_open,
      render: (r) => (
        <span>
          {r.days_open}
          {r.days_open > thresholdDays && (
            <>
              {' '}
              <Badge tone="warning">aging</Badge>
            </>
          )}
        </span>
      ),
    },
    { key: 'open_applications', header: 'Open apps' },
    {
      key: 'unviewed_applications',
      header: 'Unviewed (me)',
      render: (r) => (r.i_am_owner ? r.unviewed_applications : EMPTY_CELL),
    },
  ];

  return (
    <Widget
      title="Requisition aging"
      lastRefreshed={refreshed}
        loading={refreshed === null}
      excludesTestRecords
      exportRows={open as unknown as Record<string, unknown>[]}
      exportFilename={exportFilename('requisition-aging', 'requisitions', range)}
    >
      <KpiRow>
        <KpiCard label="Open requisitions" value={open.length} />
        <KpiCard
          label={`Over ${thresholdDays}d threshold`}
          value={overThreshold.length}
          hint="Admin can change this in Settings"
        />
        <KpiCard label="Unviewed applications (mine)" value={unviewedTotal} />
      </KpiRow>
      <Table
        pageSize={10}
        columns={columns}
        rows={open}
        rowKey={(r) => r.requisition_id}
        onRowClick={(r) => navigate(`/recruit/requisitions/${r.requisition_id}`)}
        emptyText="No open requisitions in range."
      />
    </Widget>
  );
}
