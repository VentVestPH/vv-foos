import { CalendarViewIcons } from './CalendarViewIcons';
import { MiniCalendar } from './MiniCalendar';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { RecordSection } from '../components/ui/RecordPage';
import { TaleoPlaceholderAction, usePlaceholder } from '../shell/TaleoPlaceholder';
import {
  ChartPie as PieChartIcon,
  Funnel as PipelineIcon,
  House as HomeIcon,
  Settings as GearIcon,
} from 'lucide-react';
import { DashboardWidgetsPanel } from '../modules/dashboards';
import { MyReminders } from './MyReminders';
import { MyTasks } from './MyTasks';

export function DashboardPage() {
  const [params] = useSearchParams();
  const tab = params.get('tab');

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
      <div className="taleo-page-header">
        <span className="taleo-page-icon">
          <HomeIcon size={40} />
        </span>
        <div className="taleo-page-header-text">
          <div className="taleo-page-header-title-row">
            <h1>
              My View: {staffName} ({roleLabel} at VentVest)
            </h1>
            {}
            <TaleoPlaceholderAction
              label="Switch to My Dashboard"
              variant="ghost"
              className="taleo-switch-dashboard-link"
              detail="Front Office OS currently has a single dashboard view."
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        className="taleo-gear-btn"
        aria-label="Dashboard settings"
        aria-disabled
        onClick={() => show('Dashboard settings')}
      >
        {}
        <GearIcon size={16} />
      </button>

      <RecordSection title="My Calendar" defaultOpen>
        <div className="record-section-inline-actions">
          {}
          <TaleoPlaceholderAction label="New Event" variant="ghost" size="sm" />
          <span className="record-section-divider" aria-hidden="true">|</span>
          {}
          <TaleoPlaceholderAction label="Schedule interview" variant="ghost" size="sm" />
        </div>
        <div className="taleo-calendar-body">
          <div className="taleo-calendar-main">
            <div className="taleo-calendar-toolbar">
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
          {}
          <TaleoPlaceholderAction label="New Task" variant="ghost" size="sm" />
          <label className="taleo-disabled-checkbox">
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
          {}
          <TaleoPlaceholderAction label="Schedule interview" variant="ghost" size="sm" />
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
      <div className="taleo-page-header">
        <span className="taleo-page-icon">
          <PipelineIcon size={40} />
        </span>
        <div className="taleo-page-header-text">
          <div className="taleo-page-header-title-row">
            <h1>Pipeline: Home</h1>
          </div>
          <p className="taleo-page-desc">
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
      <div className="taleo-page-header">
        <span className="taleo-page-icon">
          <PieChartIcon size={40} />
        </span>
        <div className="taleo-page-header-text">
          <div className="taleo-page-header-title-row">
            <h1>Run Report</h1>
          </div>
        </div>
      </div>

      <div className="taleo-report-toggle-row">
        <TaleoPlaceholderAction
          label="Recruit"
          variant="secondary"
          className="taleo-report-toggle taleo-report-toggle-active"
        />
        <TaleoPlaceholderAction
          label="Onboard"
          variant="primary"
          className="taleo-report-toggle"
        />
      </div>

      <div className="taleo-report-tab-row">
        <TaleoPlaceholderAction
          label="Candidate"
          variant="ghost"
          className="taleo-report-tab taleo-report-tab-active"
        />
        <TaleoPlaceholderAction label="Requisition" variant="ghost" className="taleo-report-tab" />
        <TaleoPlaceholderAction label="Compliance" variant="ghost" className="taleo-report-tab" />
        <TaleoPlaceholderAction label="More" variant="ghost" caret className="taleo-report-tab" />
        <TaleoPlaceholderActionGear />
      </div>

      <DashboardWidgetsPanel />
    </div>
  );
}

function TaleoPlaceholderActionGear() {
  const { show } = usePlaceholder();
  return (
    <button
      type="button"
      className="taleo-gear-btn taleo-report-tab-gear"
      aria-label="Configure report categories"
      aria-disabled
      onClick={() => show('Configure report categories')}
    >
      <GearIcon size={16} />
    </button>
  );
}
