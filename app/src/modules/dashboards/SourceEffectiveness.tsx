import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
        loading={refreshed === null}
        excludesTestRecords
        exportRows={byChannel}
        exportFilename={exportFilename('source-effectiveness', 'by-channel', range)}
      >
        <KpiRow>
          <KpiCard label="Reached hire/won" value={fmtPct(overallConversion)} />
        </KpiRow>
        <BarList
          items={byChannel}
          onBarClick={(channel) => navigate(`/intake?channel=${channel}`)}
        />
        <p className="dash-widget-note">Pick a channel to open its intake queue.</p>
      </Widget>
      <Widget
        title="Applications by named source"
        lastRefreshed={refreshed}
        loading={refreshed === null}
        excludesTestRecords
        exportRows={bySource}
        exportFilename={exportFilename('source-effectiveness', 'by-source', range)}
      >
        <KpiRow>
          <KpiCard label="Hired from a named source" value={hiredBySourceCount} />
        </KpiRow>
        <BarList items={bySource} />
        <p className="dash-widget-note">
          Use the channel panel to open the intake queue, or filter the candidate list by
          source.
        </p>
      </Widget>
    </div>
  );
}
