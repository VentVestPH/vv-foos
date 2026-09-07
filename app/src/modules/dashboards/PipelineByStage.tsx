import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashDb } from './db';
import { Widget } from './components/Widget';
import { BarList } from './components/BarList';
import { KpiCard, KpiRow } from './components/Kpi';
import { useOutboxRefresh } from './hooks';
import { APPLICATION_STAGES, DEAL_STAGES } from '../../lib/database.types';
import {
  countBy,
  exportFilename,
  fmtMoney,
  type AtsFunnelRow,
  type CrmFunnelRow,
  type DateRange,
} from './lib';

export function PipelineByStage({ range }: { range: DateRange }) {
  const navigate = useNavigate();
  const [ats, setAts] = useState<AtsFunnelRow[]>([]);
  const [crm, setCrm] = useState<CrmFunnelRow[]>([]);
  const [refreshed, setRefreshed] = useState<Date | null>(null);

  const load = useCallback(() => {
    void dashDb
      .from('vw_ats_funnel')
      .select('*')
      .gte('applied_at', range.from)
      .lte('applied_at', `${range.to}T23:59:59`)
      .then(({ data }) => setAts((data as unknown as AtsFunnelRow[]) ?? []));
    void dashDb
      .from('vw_crm_funnel')
      .select('*')
      .gte('created_at', range.from)
      .lte('created_at', `${range.to}T23:59:59`)
      .then(({ data }) => {
        setCrm((data as unknown as CrmFunnelRow[]) ?? []);
        setRefreshed(new Date());
      });
  }, [range.from, range.to]);

  useEffect(load, [load]);
  useOutboxRefresh(load);

  const atsCounts = countBy(ats, (r) => r.stage, APPLICATION_STAGES);
  const crmCounts = countBy(crm, (r) => r.stage, DEAL_STAGES);
  const openValue = crm
    .filter((d) => d.stage !== 'won' && d.stage !== 'lost')
    .reduce((sum, d) => sum + (d.value ?? 0), 0);
  const wonValue = crm
    .filter((d) => d.stage === 'won')
    .reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <div className="dash-grid-2">
      <Widget
        title="ATS pipeline by stage"
        lastRefreshed={refreshed}
        exportRows={atsCounts}
        exportFilename={exportFilename('pipeline-by-stage', 'ats', range)}
      >
        <BarList items={atsCounts} />
        <p className="dash-widget-note">
          Stage bars aren't clickable yet — no application-level list view
          exists in the app today (candidate and requisition lists don't
          filter by application stage). Open a requisition's pipeline board
          to see individual applications at a stage.
        </p>
      </Widget>
      <Widget
        title="CRM pipeline by stage"
        lastRefreshed={refreshed}
        exportRows={crmCounts}
        exportFilename={exportFilename('pipeline-by-stage', 'crm', range)}
      >
        <KpiRow>
          <KpiCard label="Open pipeline value" value={fmtMoney(openValue)} />
          <KpiCard label="Won this range" value={fmtMoney(wonValue)} />
        </KpiRow>
        <BarList
          items={crmCounts.map((c) => ({
            ...c,
            tone: c.label === 'won' ? 'success' : c.label === 'lost' ? 'danger' : 'primary',
          }))}
          onBarClick={(stage) => navigate(`/sales/deals?stage=${stage}`)}
        />
      </Widget>
    </div>
  );
}
