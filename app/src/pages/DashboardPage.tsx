import { CalendarViewIcons } from './CalendarViewIcons';
import { MiniCalendar } from './MiniCalendar';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { RecordSection } from '../components/ui/RecordPage';
import { PlaceholderAction, usePlaceholder } from '../shell/Placeholder';
import {
  ChartPie as PieChartIcon,
  Funnel as PipelineIcon,
  House as HomeIcon,
  Settings as GearIcon,
} from 'lucide-react';
import { DashboardWidgetsPanel } from '../modules/dashboards';
import { MyReminders } from './MyReminders';
import { MyTasks } from './MyTasks';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function DashboardPage() {
  const [params] = useSearchParams();
  const tab = params.get('tab');
  useDocumentTitle(tab === 'pipeline' ? 'Pipeline' : tab === 'reports' ? 'Run Report' : 'My View');

  if (tab === 'pipeline') return <PipelineTab />;
  if (tab === 'reports') return <ReportsTab />;
  return <MyViewTab />;
}

function MyViewTab() {
  const { staff, role } = useSession();
  const { show } = usePlaceholder();
  const staffName = staff?.full_name ?? 'there';
  const roleLabel = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : 'Staff';

  const today = new Date();
  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="list-page">
      <div className="fo-page-header">
        <span className="fo-page-icon">
          <HomeIcon size={40} />
        </span>
        <div className="fo-page-header-text">
          <div className="fo-page-header-title-row">
            <h1>
              My View: {staffName} ({roleLabel} at VentVest)
            </h1>
            <PlaceholderAction
              label="Switch to My Dashboard"
              variant="ghost"
              className="fo-switch-dashboard-link"
              detail="Front Office OS currently has a single dashboard view."
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        className="fo-gear-btn is-placeholder"
        aria-label="Dashboard settings"
        onClick={() => show('Dashboard settings')}
      >
        <GearIcon size={16} />
      </button>

      <RecordSection title="My Calendar" defaultOpen>
        <div className="record-section-inline-actions">
          <PlaceholderAction label="New Event" variant="ghost" size="sm" />
          <span className="record-section-divider" aria-hidden="true">|</span>
          <PlaceholderAction label="Schedule interview" variant="ghost" size="sm" />
        </div>
        <div className="fo-calendar-body">
          <div className="fo-calendar-main">
            <div className="fo-calendar-toolbar">
              <span>Today {todayLabel}.</span>
              <CalendarViewIcons />
            </div>
            <p>No events scheduled.</p>
          </div>
          <MiniCalendar />
        </div>
      </RecordSection>

      <RecordSection title="My Reminders" defaultOpen>
        <MyReminders />
      </RecordSection>

      <RecordSection title="My Tasks" defaultOpen>
        <div className="record-section-inline-actions">
          <PlaceholderAction label="New Task" variant="ghost" size="sm" />
          <label className="fo-disabled-checkbox">
            <input type="checkbox" disabled aria-disabled="true" />
            Include Onboarding/Offboarding Tasks
          </label>
        </div>
        <MyTasks />
      </RecordSection>

      <RecordSection title="Onboarding Employees" defaultOpen={false}>
        <p>There are currently no onboarding employees.</p>
      </RecordSection>

      <RecordSection title="Offboarding Employees" defaultOpen={false}>
        <p>There are currently no offboarding employees.</p>
      </RecordSection>

      <RecordSection title="My Interviews" defaultOpen={false}>
        <div className="record-section-inline-actions">
          <PlaceholderAction label="Schedule interview" variant="ghost" size="sm" />
        </div>
        <p>There are currently no interviews scheduled.</p>
      </RecordSection>

      <RecordSection title="Awaiting My Action - Recruit" defaultOpen={false}>
        <p>There is nothing awaiting your action.</p>
      </RecordSection>
    </div>
  );
}

function PipelineTab() {
  return (
    <div className="list-page">
      <div className="fo-page-header">
        <span className="fo-page-icon">
          <PipelineIcon size={40} />
        </span>
        <div className="fo-page-header-text">
          <div className="fo-page-header-title-row">
            <h1>Pipeline: Home</h1>
          </div>
          <p className="fo-page-desc">
            The Pipeline page provides an overall summary of your
            organization's current and upcoming staffing activities including
            interview schedules, pending feedback, approved requisitions, and
            active candidates for each open requisition.
          </p>
        </div>
      </div>

      <DashboardWidgetsPanel />
    </div>
  );
}

function ReportsTab() {
  return (
    <div className="list-page">
      <div className="fo-page-header">
        <span className="fo-page-icon">
          <PieChartIcon size={40} />
        </span>
        <div className="fo-page-header-text">
          <div className="fo-page-header-title-row">
            <h1>Run Report</h1>
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
        <PlaceholderActionGear />
      </div>

      <DashboardWidgetsPanel />
    </div>
  );
}

function PlaceholderActionGear() {
  const { show } = usePlaceholder();
  return (
    <button
      type="button"
      className="fo-gear-btn fo-report-tab-gear is-placeholder"
      aria-label="Configure report categories"
      onClick={() => show('Configure report categories')}
    >
      <GearIcon size={16} />
    </button>
  );
}
