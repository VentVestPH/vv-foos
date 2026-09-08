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

const BASE_SECTIONS = [
  'Pipeline by Stage',
  'Requisition Aging',
  'Recruiter/Sourcer Activity',
  'Time in Stage',
  'Source Effectiveness',
];

const ADMIN_SECTION = 'Experiment Metrics';

export function useDashboardWidgetSections(): string[] {
  const isAdmin = useIsAdmin();
  return isAdmin ? [...BASE_SECTIONS, ADMIN_SECTION] : BASE_SECTIONS;
}

interface DashboardWidgetsPanelProps {
  isSectionHidden?: (title: string) => boolean;
  range?: DateRange;
  onRangeChange?: (next: DateRange) => void;
}

export function DashboardWidgetsPanel({
  isSectionHidden,
  range: controlledRange,
  onRangeChange,
}: DashboardWidgetsPanelProps = {}) {
  const isAdmin = useIsAdmin();
  const [ownRange, setOwnRange] = useState<DateRange>(DEFAULT_RANGE);
  const range = controlledRange ?? ownRange;
  const ownsFilter = controlledRange === undefined;
  const visible = (title: string) => !isSectionHidden?.(title);

  return (
    <div className="dash-widgets-panel">
      {ownsFilter && (
        <div className="dash-home-head">
          <DateRangeFilter range={range} onChange={onRangeChange ?? setOwnRange} />
        </div>
      )}

      {visible('Pipeline by Stage') && (
        <RecordSection title="Pipeline by Stage" defaultOpen>
          <PipelineByStage range={range} />
        </RecordSection>
      )}

      {visible('Requisition Aging') && (
        <RecordSection title="Requisition Aging" defaultOpen={false}>
          <RequisitionAging range={range} />
        </RecordSection>
      )}

      {visible('Recruiter/Sourcer Activity') && (
        <RecordSection title="Recruiter/Sourcer Activity" defaultOpen={false}>
          <StaffActivity range={range} />
        </RecordSection>
      )}

      {visible('Time in Stage') && (
        <RecordSection title="Time in Stage" defaultOpen={false}>
          <TimeInStage range={range} />
        </RecordSection>
      )}

      {visible('Source Effectiveness') && (
        <RecordSection title="Source Effectiveness" defaultOpen={false}>
          <SourceEffectiveness range={range} />
        </RecordSection>
      )}

      {isAdmin && visible(ADMIN_SECTION) && (
        <RecordSection title="Experiment Metrics" defaultOpen={false}>
          <ExperimentMetrics range={range} />
        </RecordSection>
      )}
    </div>
  );
}
