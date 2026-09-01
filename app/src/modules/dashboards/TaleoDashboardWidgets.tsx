// Shared "real widgets, Taleo chrome" panel used by both the Pipeline tab
// and the Reports tab of DashboardPage.tsx (redesign prompt section 8.1:
// "Existing FOOS executive widgets and drill-through links must remain
// available... Reports can be a dashboard state selected by the Reports
// primary tab"). Same five live Agent-7 dashboards + admin-gated Experiment
// metrics, each recomposed into a RecordSection accordion instead of the
// former dash-tabs/dash-grid layout — no query, drill-through, export, or
// Realtime behavior changes, only composition/chrome.

import { useState } from 'react';
import { RecordSection } from '../../components/ui/RecordPage';
import { DateRangeFilter } from './components/DateRangeFilter';
import { useIsAdmin } from './hooks';
import { DEFAULT_RANGE, type DateRange } from './lib';
import { PipelineByStage } from './PipelineByStage';
import { TimeInStage } from './TimeInStage';
import { SourceEffectiveness } from './SourceEffectiveness';
import { StaffActivity } from './StaffActivity';
import { RequisitionAging } from './RequisitionAging';
import { ExperimentMetrics } from './ExperimentMetrics';

export function DashboardWidgetsPanel() {
  const isAdmin = useIsAdmin();
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);

  return (
    <div className="dash-widgets-panel">
      <div className="dash-home-head">
        <DateRangeFilter range={range} onChange={setRange} />
      </div>

      <RecordSection title="Pipeline by Stage" defaultOpen>
        <PipelineByStage range={range} />
      </RecordSection>

      <RecordSection title="Requisition Aging" defaultOpen={false}>
        <RequisitionAging range={range} />
      </RecordSection>

      <RecordSection title="Recruiter/Sourcer Activity" defaultOpen={false}>
        <StaffActivity range={range} />
      </RecordSection>

      <RecordSection title="Time in Stage" defaultOpen={false}>
        <TimeInStage range={range} />
      </RecordSection>

      <RecordSection title="Source Effectiveness" defaultOpen={false}>
        <SourceEffectiveness range={range} />
      </RecordSection>

      {isAdmin && (
        <RecordSection title="Experiment Metrics" defaultOpen={false}>
          <ExperimentMetrics range={range} />
        </RecordSection>
      )}
    </div>
  );
}
