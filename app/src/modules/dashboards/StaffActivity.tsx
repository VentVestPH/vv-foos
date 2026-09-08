import { useCallback, useEffect, useState } from 'react';
import { dashDb } from './db';
import { Widget } from './components/Widget';
import { BarList } from './components/BarList';
import { Table, type TableColumn } from '../../components/ui/Table';
import { useOutboxRefresh, useStaffNames } from './hooks';
import {
  exportFilename,
  type DateRange,
  type StaffActivityRow,
  type StaffGradingRow,
  type StaffStageAdvanceRow,
} from './lib';

function countByStaff(
  rows: { by: string | null }[],
  nameOf: (id: string | null | undefined) => string,
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.by) continue;
    counts.set(r.by, (counts.get(r.by) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ label: nameOf(id), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, TOP_N);
}

const TOP_N = 10;

interface GradeSplitRow {
  staff: string;
  one: number;
  two: number;
  three: number;
  total: number;
}

function gradeSplit(
  rows: StaffGradingRow[],
  nameOf: (id: string | null | undefined) => string,
): GradeSplitRow[] {
  const byStaff = new Map<string, GradeSplitRow>();
  for (const row of rows) {
    if (!row.submitted_by) continue;
    const staff = nameOf(row.submitted_by);
    const entry =
      byStaff.get(staff) ?? { staff, one: 0, two: 0, three: 0, total: 0 };
    if (row.star_grade === 1) entry.one += 1;
    if (row.star_grade === 2) entry.two += 1;
    if (row.star_grade === 3) entry.three += 1;
    entry.total += 1;
    byStaff.set(staff, entry);
  }
  return [...byStaff.values()]
    .sort((a, b) => b.total - a.total || a.staff.localeCompare(b.staff))
    .slice(0, TOP_N);
}

const GRADE_COLUMNS: TableColumn<GradeSplitRow>[] = [
  { key: 'staff', header: 'Staff' },
  { key: 'one', header: '1 star' },
  { key: 'two', header: '2 stars' },
  { key: 'three', header: '3 stars' },
  { key: 'total', header: 'Total' },
];

export function StaffActivity({ range }: { range: DateRange }) {
  const nameOf = useStaffNames();
  const [activities, setActivities] = useState<StaffActivityRow[]>([]);
  const [grading, setGrading] = useState<StaffGradingRow[]>([]);
  const [advances, setAdvances] = useState<StaffStageAdvanceRow[]>([]);
  const [refreshed, setRefreshed] = useState<Date | null>(null);

  const load = useCallback(() => {
    void dashDb
      .from('vw_staff_activities')
      .select('*')
      .gte('occurred_at', range.from)
      .lte('occurred_at', `${range.to}T23:59:59`)
      .then(({ data }) => setActivities((data as unknown as StaffActivityRow[]) ?? []));
    void dashDb
      .from('vw_staff_grading')
      .select('*')
      .gte('created_at', range.from)
      .lte('created_at', `${range.to}T23:59:59`)
      .then(({ data }) => setGrading((data as unknown as StaffGradingRow[]) ?? []));
    void dashDb
      .from('mv_staff_stage_advances')
      .select('*')
      .then(({ data }) => {
        setAdvances((data as unknown as StaffStageAdvanceRow[]) ?? []);
        setRefreshed(new Date());
      });
  }, [range.from, range.to]);

  useEffect(load, [load]);
  useOutboxRefresh(load);

  const activityCounts = countByStaff(
    activities.map((a) => ({ by: a.created_by })),
    nameOf,
  );
  const gradingCounts = countByStaff(
    grading.map((g) => ({ by: g.submitted_by })),
    nameOf,
  );
  const splitRows = gradeSplit(grading, nameOf);
  const advanceCounts = advances
    .map((a) => ({ label: nameOf(a.staff_id), count: a.advances_count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, TOP_N);

  return (
    <div className="dash-grid-2">
      <Widget
        title="Logged activity per staff member"
        lastRefreshed={refreshed}
        loading={refreshed === null}
        excludesTestRecords
        exportRows={activityCounts}
        exportFilename={exportFilename('staff-activity', 'activity', range)}
      >
        <BarList items={activityCounts} />
      </Widget>
      <Widget
        title="Applications advanced (90-day window)"
        lastRefreshed={refreshed}
        loading={refreshed === null}
        exportRows={advanceCounts}
        exportFilename={exportFilename('staff-activity', 'advances', range)}
      >
        <BarList items={advanceCounts} />
        <p className="dash-widget-note">
          Always the last 90 days, updated every 15 minutes. The range picker above does not
          apply to this panel.
        </p>
      </Widget>
      <Widget
        title="Grading volume per staff member"
        lastRefreshed={refreshed}
        loading={refreshed === null}
        excludesTestRecords
        exportRows={gradingCounts}
        exportFilename={exportFilename('staff-activity', 'grading', range)}
      >
        <BarList items={gradingCounts} />
      </Widget>
      <Widget
        title="Grading split by star"
        bars={0}
        kpis={0}
        lastRefreshed={refreshed}
        loading={refreshed === null}
        excludesTestRecords
        exportRows={splitRows as unknown as Record<string, unknown>[]}
        exportFilename={exportFilename('staff-activity', 'grade-split', range)}
      >
        <Table
          columns={GRADE_COLUMNS}
          rows={splitRows}
          rowKey={(r) => r.staff}
          emptyText="No grading in range."
        />
      </Widget>
    </div>
  );
}
