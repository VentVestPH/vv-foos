import { useCallback, useEffect, useState } from 'react';
import { dashDb } from './db';
import { Widget } from './components/Widget';
import { BarList } from './components/BarList';
import { KpiRow, KpiCard } from './components/Kpi';
import { useOutboxRefresh } from './hooks';
import {
  countBy,
  exportFilename,
  fmtPct,
  type AtsFunnelRow,
  type DateRange,
  type SourceEffectivenessRow,
} from './lib';

export function SourceEffectiveness({ range }: { range: DateRange }) {
  const [intake, setIntake] = useState<SourceEffectivenessRow[]>([]);
  const [ats, setAts] = useState<AtsFunnelRow[]>([]);
  const [refreshed, setRefreshed] = useState<Date | null>(null);

  const load = useCallback(() => {
    void dashDb
      .from('vw_source_effectiveness')
      .select('*')
      .gte('created_at', range.from)
      .lte('created_at', `${range.to}T23:59:59`)
      .then(({ data }) => setIntake((data as unknown as SourceEffectivenessRow[]) ?? []));
    void dashDb
      .from('vw_ats_funnel')
      .select('*')
      .gte('applied_at', range.from)
      .lte('applied_at', `${range.to}T23:59:59`)
      .then(({ data }) => {
        setAts((data as unknown as AtsFunnelRow[]) ?? []);
        setRefreshed(new Date());
      });
  }, [range.from, range.to]);

  useEffect(load, [load]);
  useOutboxRefresh(load);

  const byChannel = countBy(intake, (r) => r.channel);
  const hiredByChannel = intake.filter((r) => r.reached_hired || r.reached_won);
  const overallConversion =
    intake.length > 0 ? hiredByChannel.length / intake.length : 0;

  const bySource = countBy(
    ats.filter((r) => r.source_name),
    (r) => r.source_name as string,
  );
  const hiredBySourceCount = ats.filter((r) => r.source_name && r.stage === 'hired').length;

  return (
    <div className="dash-grid-2">
      <Widget
        title="Intake volume by channel"
        lastRefreshed={refreshed}
        exportRows={byChannel}
        exportFilename={exportFilename('source-effectiveness', 'by-channel', range)}
      >
        <KpiRow>
          <KpiCard label="Reached hire/won" value={fmtPct(overallConversion)} />
        </KpiRow>
        <BarList items={byChannel} />
        <p className="dash-widget-note">
          Channel bars aren't clickable — the intake queue page filters by
          channel through local component state, not a published URL
          contract yet. Add `useSearchParams` support there (same pattern as
          `/recruit/requisitions`) to wire this up.
        </p>
      </Widget>
      <Widget
        title="Applications by named source"
        lastRefreshed={refreshed}
        exportRows={bySource}
        exportFilename={exportFilename('source-effectiveness', 'by-source', range)}
      >
        <KpiRow>
          <KpiCard label="Hired from a named source" value={hiredBySourceCount} />
        </KpiRow>
        <BarList items={bySource} />
        <p className="dash-widget-note">
          Named-source bars aren't clickable — /recruit/candidates filters by
          source_id (a uuid), and this view only carries the resolved name.
          Use the intake-channel lens above for drill-through, or add
          source_id to the export for a manual lookup.
        </p>
      </Widget>
    </div>
  );
}
