import { useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { RecordSection } from '../components/ui/RecordPage';
import { TaleoPlaceholderAction, usePlaceholder } from '../shell/TaleoPlaceholder';
import { HomeIcon, PipelineIcon, PieChartIcon, GearIcon } from '../shell/icons';
import { DashboardWidgetsPanel } from '../modules/dashboards';

/**
 * Home route ("/") — Taleo-exact dashboard shell (redesign prompt section
 * 8.1). navConfig.ts already routes Home/Pipeline/Reports here with a `tab`
 * query param; this component switches on that param to render one of three
 * Taleo states while staying a single component tree/route:
 *
 *   - no tab / tab=home  -> "My View" — Taleo accordion empty-states for
 *     features FOOS doesn't implement yet (calendar, tasks, onboarding,
 *     interviews). These are legitimate Taleo empty panels per instruction
 *     3 ("every visible section must appear"), not deletions.
 *   - tab=pipeline        -> Agent 7's five live dashboards + admin-gated
 *     Experiment metrics, each in its own RecordSection accordion instead
 *     of the former modern dashboard-card grid. Same Supabase queries,
 *     drill-through, CSV export, and Realtime refresh as before.
 *   - tab=reports         -> decorative Taleo "Run Report" chrome (category
 *     toggles/tabs are all FOOS-TBD placeholders) followed by the *same*
 *     real widgets panel, so the executive dashboards stay reachable from
 *     the Reports primary-nav tab per the prompt's explicit instruction.
 */
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
            {/* FOOS has a single dashboard, so this is a decorative Taleo
                control — FOOS-TBD if a second dashboard view is ever built. */}
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
        {/* FOOS-TBD: no configurable dashboard-panel layout yet. */}
        <GearIcon size={16} />
      </button>

      <RecordSection title="My Calendar" defaultOpen>
        <div className="record-section-inline-actions">
          {/* FOOS-TBD: no calendar/event module yet. */}
          <TaleoPlaceholderAction label="New Event" variant="ghost" size="sm" />
          <span className="record-section-divider" aria-hidden="true">|</span>
          {/* FOOS-TBD: interview scheduling isn't reachable from the dashboard yet. */}
          <TaleoPlaceholderAction label="Schedule interview" variant="ghost" size="sm" />
        </div>
        <p>Today {todayLabel}.</p>
        <p>No events scheduled.</p>
      </RecordSection>

      <RecordSection title="My Tasks" defaultOpen>
        <div className="record-section-inline-actions">
          {/* FOOS-TBD: no task-list module yet. */}
          <TaleoPlaceholderAction label="New Task" variant="ghost" size="sm" />
          <label className="taleo-disabled-checkbox">
            <input type="checkbox" disabled aria-disabled="true" />
            Include Onboarding/Offboarding Tasks
          </label>
        </div>
        <p>Task list is empty.</p>
      </RecordSection>

      <RecordSection title="Onboarding Employees" defaultOpen={false}>
        <p>There are currently no onboarding employees.</p>
      </RecordSection>

      <RecordSection title="Offboarding Employees" defaultOpen={false}>
        <p>There are currently no offboarding employees.</p>
      </RecordSection>

      <RecordSection title="My Interviews" defaultOpen={false}>
        <div className="record-section-inline-actions">
          {/* FOOS-TBD: no interview-scheduling module yet. */}
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
        {/* FOOS-TBD: FOOS has one report surface today; these toggles are
            decorative Taleo chrome matching 14_Taleo_Reports_Home.png. */}
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
        {/* FOOS-TBD: no per-category report navigation yet. */}
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
      {/* FOOS-TBD: no configurable report-category list yet. */}
      <GearIcon size={16} />
    </button>
  );
}
