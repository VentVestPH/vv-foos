// Agent 7 — dashboards module root. Mounted at "/" (replaces the Agent-7
// placeholder in src/pages/DashboardPage.tsx) rather than a new top-level
// route, since navConfig.ts's "Dashboards" nav item already points at "/".
// One shared date-range filter drives all five dashboards; tabs switch which
// one renders rather than five separate routes, matching the brief's
// "global date-range filter... shared across all dashboards" instruction.

import { useState } from 'react';
import { useSession } from '../../auth/SessionProvider';
import { DateRangeFilter } from './components/DateRangeFilter';
import { useIsAdmin } from './hooks';
import { DEFAULT_RANGE, type DateRange } from './lib';
import { PipelineByStage } from './PipelineByStage';
import { TimeInStage } from './TimeInStage';
import { SourceEffectiveness } from './SourceEffectiveness';
import { StaffActivity } from './StaffActivity';
import { RequisitionAging } from './RequisitionAging';
import { ExperimentMetrics } from './ExperimentMetrics';

type TabKey =
  | 'pipeline'
  | 'time-in-stage'
  | 'source'
  | 'activity'
  | 'aging'
  | 'experiments';

const TABS: { key: TabKey; label: string; adminOnly?: boolean }[] = [
  { key: 'pipeline', label: '1 · Pipeline by stage' },
  { key: 'time-in-stage', label: '2 · Time in stage' },
  { key: 'source', label: '3 · Source effectiveness' },
  { key: 'activity', label: '4 · Recruiter/sourcer activity' },
  { key: 'aging', label: '5 · Requisition aging' },
  { key: 'experiments', label: 'Experiment metrics', adminOnly: true },
];

export function DashboardsHome() {
  const { staff } = useSession();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<TabKey>('pipeline');
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const firstName = staff?.full_name?.split(' ')[0] ?? 'there';

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="dash-home">
      <div className="dash-home-head">
        <h1>Welcome back, {firstName}</h1>
        <DateRangeFilter range={range} onChange={setRange} />
      </div>
      <div className="dash-tabs" role="tablist">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'dash-tab active' : 'dash-tab'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="dash-tab-panel">
        {tab === 'pipeline' && <PipelineByStage range={range} />}
        {tab === 'time-in-stage' && <TimeInStage range={range} />}
        {tab === 'source' && <SourceEffectiveness range={range} />}
        {tab === 'activity' && <StaffActivity range={range} />}
        {tab === 'aging' && <RequisitionAging range={range} />}
        {tab === 'experiments' && isAdmin && <ExperimentMetrics range={range} />}
      </div>
    </div>
  );
}
