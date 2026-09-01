import { useCallback, useEffect, useState } from 'react';
import { dashDb } from './db';
import { Widget } from './components/Widget';
import { BarList } from './components/BarList';
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
    .sort((a, b) => a.label.localeCompare(b.label));
}

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
  const grade1 = countByStaff(
    grading.filter((g) => g.star_grade === 1).map((g) => ({ by: g.submitted_by })),
    nameOf,
  );
  const grade2 = countByStaff(
    grading.filter((g) => g.star_grade === 2).map((g) => ({ by: g.submitted_by })),
    nameOf,
  );
  const grade3 = countByStaff(
    grading.filter((g) => g.star_grade === 3).map((g) => ({ by: g.submitted_by })),
    nameOf,
  );
  const advanceCounts = advances
    .map((a) => ({ label: nameOf(a.staff_id), count: a.advances_count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="dash-grid-2">
      <Widget
        title="Logged activity per staff member"
        lastRefreshed={refreshed}
        exportRows={activityCounts}
        exportFilename={exportFilename('staff-activity', 'activity', range)}
      >
        <BarList items={activityCounts} />
      </Widget>
      <Widget
        title="Applications advanced (90-day window)"
        lastRefreshed={refreshed}
        exportRows={advanceCounts}
        exportFilename={exportFilename('staff-activity', 'advances', range)}
      >
        <BarList items={advanceCounts} />
        <p className="dash-widget-note">
          Sourced from a definer-refreshed materialized view (audit_log is
          admin-read only) — updates every 15 minutes, not live with the date
          filter above; fixed 90-day window regardless of the range picker.
        </p>
      </Widget>
      <Widget
        title="Grading volume per staff member"
        lastRefreshed={refreshed}
        exportRows={gradingCounts}
        exportFilename={exportFilename('staff-activity', 'grading', range)}
      >
        <BarList items={gradingCounts} />
      </Widget>
      <Widget
        title="Grading split (1★ / 2★ / 3★)"
        lastRefreshed={refreshed}
        exportRows={[
          ...grade1.map((r) => ({ ...r, stars: 1 })),
          ...grade2.map((r) => ({ ...r, stars: 2 })),
          ...grade3.map((r) => ({ ...r, stars: 3 })),
        ]}
        exportFilename={exportFilename('staff-activity', 'grade-split', range)}
      >
        <p className="dash-widget-note">1★</p>
        <BarList items={grade1} />
        <p className="dash-widget-note">2★</p>
        <BarList items={grade2} />
        <p className="dash-widget-note">3★</p>
        <BarList items={grade3} />
      </Widget>
    </div>
  );
}
