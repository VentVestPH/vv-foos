import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { RecordSection } from '../components/ui/RecordPage';
import { CollapseAllButton } from '../components/ui/SectionCollapse';
import { PlaceholderAction } from '../shell/Placeholder';
import { Button } from '../components/ui/Button';
import {
  ChartPie as PieChartIcon,
  Funnel as PipelineIcon,
  House as HomeIcon,
  Settings as GearIcon,
} from 'lucide-react';
import { DashboardWidgetsPanel, useDashboardWidgetSections } from '../modules/dashboards';
import { DateRangeFilter } from '../modules/dashboards/components/DateRangeFilter';
import { DEFAULT_RANGE, type DateRange } from '../modules/dashboards/lib';
import { SectionSettingsDialog } from '../components/ui/SectionSettingsDialog';
import { useSectionPrefs } from '../hooks/useSectionPrefs';
import { MyCalendar } from './MyCalendar';
import { MyInterviews } from './MyInterviews';
import { TaskGroupPanel } from './TaskGroupPanel';
import { NewCalendarEntryDialog } from './NewCalendarEntryDialog';
import { MyReminders } from './MyReminders';
import { MyTasks } from './MyTasks';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export type DashboardView = 'myview' | 'pipeline' | 'reports';

export function DashboardPage({ view = 'myview' }: { view?: DashboardView }) {
  useDocumentTitle(view === 'pipeline' ? 'Pipeline' : view === 'reports' ? 'Run Report' : 'My View');

  if (view === 'pipeline') return <PipelineTab />;
  if (view === 'reports') return <ReportsTab />;
  return <MyViewTab />;
}

const MY_VIEW_SECTIONS = [
  'My Calendar',
  'My Reminders',
  'My Tasks',
  'Onboarding Employees',
  'Offboarding Employees',
  'My Interviews',
  'Awaiting My Action - Recruit',
];

function MyViewTab() {
  const { staff, role } = useSession();
  const prefs = useSectionPrefs('dashboard.myview');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const staffName = staff?.full_name ?? 'there';
  const roleLabel = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : 'Staff';

  return (
    <div className="list-page">
      <div className="fo-page-header">
        <span className="fo-page-icon">
          <HomeIcon size={32} />
        </span>
        <div className="fo-page-header-text">
          <div className="fo-page-header-title-row">
            <h1>
              My View: {staffName} ({roleLabel} at VentVest)
            </h1>
            <div className="fo-page-header-actions">
              <Link to="/pipeline" className="fo-switch-dashboard-link">
                <Button size="sm" variant="secondary">
                  Switch to My Dashboard
                </Button>
              </Link>
              <CollapseAllButton />
              <button
                type="button"
                className="fo-gear-btn"
                aria-label="Dashboard settings"
                onClick={() => setSettingsOpen(true)}
              >
                <GearIcon size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <SectionSettingsDialog
          title="Dashboard settings"
          hint="Choose which sections appear on My View. The choice is saved to your account."
          sections={MY_VIEW_SECTIONS}
          prefs={prefs}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {!prefs.isHidden('My Calendar') && (
        <RecordSection title="My Calendar" defaultOpen>
          <MyCalendar />
        </RecordSection>
      )}

      {!prefs.isHidden('My Reminders') && (
        <RecordSection title="My Reminders" defaultOpen>
          <MyReminders />
        </RecordSection>
      )}

      {!prefs.isHidden('My Tasks') && (
        <RecordSection title="My Tasks" defaultOpen>
          <div className="record-section-inline-actions">
            <Button size="sm" variant="primary" onClick={() => setTaskOpen(true)}>
              New Task
            </Button>
            <label className="fo-disabled-checkbox" title="Onboarding is not available yet">
              <input
                type="checkbox"
                disabled
                aria-disabled="true"
                title="Onboarding is not available yet"
              />
              Include Onboarding/Offboarding Tasks
            </label>
          </div>
          {taskOpen && (
            <NewCalendarEntryDialog
              mode="task"
              staffId={staff?.id ?? null}
              onClose={() => setTaskOpen(false)}
              onSaved={() => setTaskOpen(false)}
            />
          )}
          <MyTasks />
        </RecordSection>
      )}

      {!prefs.isHidden('Onboarding Employees') && (
        <RecordSection title="Onboarding Employees" defaultOpen={false}>
          <TaskGroupPanel relatedType="onboarding" emptyText="There are currently no onboarding employees." />
        </RecordSection>
      )}

      {!prefs.isHidden('Offboarding Employees') && (
        <RecordSection title="Offboarding Employees" defaultOpen={false}>
          <TaskGroupPanel relatedType="offboarding" emptyText="There are currently no offboarding employees." />
        </RecordSection>
      )}

      {!prefs.isHidden('My Interviews') && (
        <RecordSection title="My Interviews" defaultOpen={false}>
          <MyInterviews />
        </RecordSection>
      )}

      {!prefs.isHidden('Awaiting My Action - Recruit') && (
        <RecordSection title="Awaiting My Action - Recruit" defaultOpen={false}>
          <TaskGroupPanel
            relatedType="awaiting_action"
            emptyText="There is nothing awaiting your action."
          />
        </RecordSection>
      )}
    </div>
  );
}

function PipelineTab() {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  return (
    <div className="list-page">
      <div className="fo-page-header">
        <span className="fo-page-icon">
          <PipelineIcon size={32} />
        </span>
        <div className="fo-page-header-text">
          <div className="fo-page-header-title-row">
            <h1>Pipeline: Home</h1>
            <div className="fo-page-header-actions">
              <Link to="/" className="fo-switch-dashboard-link">
                <Button size="sm" variant="secondary">
                  Switch to My View
                </Button>
              </Link>
              <CollapseAllButton />
            </div>
          </div>
          <p className="fo-page-desc">
            The Pipeline page provides an overall summary of your
            organization's current and upcoming staffing activities including
            interview schedules, pending feedback, approved requisitions, and
            active candidates for each open requisition.
          </p>
          <div className="dash-home-head">
            <DateRangeFilter range={range} onChange={setRange} />
          </div>
        </div>
      </div>

      <DashboardWidgetsPanel range={range} onRangeChange={setRange} />
    </div>
  );
}

function ReportsTab() {
  const sections = useDashboardWidgetSections();
  const prefs = useSectionPrefs('dashboard.reports');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="list-page">
      <div className="fo-page-header">
        <span className="fo-page-icon">
          <PieChartIcon size={32} />
        </span>
        <div className="fo-page-header-text">
          <div className="fo-page-header-title-row">
            <h1>Run Report</h1>
            <div className="fo-page-header-actions">
              <Link to="/" className="fo-switch-dashboard-link">
                <Button size="sm" variant="secondary">
                  Switch to My View
                </Button>
              </Link>
              <CollapseAllButton />
            </div>
          </div>
        </div>
      </div>

      <div className="fo-report-toggle-row">
        <PlaceholderAction
          label="Recruit"
          variant="secondary"
          className="fo-report-toggle fo-report-toggle-active"
        />
        <PlaceholderAction
          label="Onboard"
          variant="primary"
          className="fo-report-toggle"
        />
      </div>

      <div className="fo-report-tab-row">
        <PlaceholderAction
          label="Candidate"
          variant="ghost"
          className="fo-report-tab fo-report-tab-active"
        />
        <PlaceholderAction label="Requisition" variant="ghost" className="fo-report-tab" />
        <PlaceholderAction label="Compliance" variant="ghost" className="fo-report-tab" />
        <PlaceholderAction label="More" variant="ghost" caret className="fo-report-tab" />
        <button
          type="button"
          className="fo-gear-btn fo-report-tab-gear"
          aria-label="Configure report categories"
          onClick={() => setSettingsOpen(true)}
        >
          <GearIcon size={20} />
        </button>
      </div>

      {settingsOpen && (
        <SectionSettingsDialog
          title="Report categories"
          hint="Choose which report categories appear below. The choice is saved to your account."
          sections={sections}
          prefs={prefs}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <DashboardWidgetsPanel isSectionHidden={prefs.isHidden} />
    </div>
  );
}

