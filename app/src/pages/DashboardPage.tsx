import { useMemo, useState } from 'react';
import { useSession } from '../auth/SessionProvider';
import { RecordSection } from '../components/ui/RecordPage';
import { CollapseAllButton } from '../components/ui/SectionCollapse';
import { Button } from '../components/ui/Button';
import {
  ChartPie as PieChartIcon,
  Funnel as PipelineIcon,
  House as HomeIcon,
} from 'lucide-react';
import { DashboardWidgetsPanel, useDashboardWidgetSections } from '../modules/dashboards';
import { DateRangeFilter } from '../modules/dashboards/components/DateRangeFilter';
import { DEFAULT_RANGE, type DateRange } from '../modules/dashboards/lib';
import { SectionSettingsDialog } from '../components/ui/SectionSettingsDialog';
import { SettingsButton } from '../components/ui/SettingsButton';
import { useSectionPrefs } from '../hooks/useSectionPrefs';
import { MyCalendar } from './MyCalendar';
import { MyInterviews } from './MyInterviews';
import { TaskGroupPanel } from './TaskGroupPanel';
import { NewCalendarEntryDialog } from './NewCalendarEntryDialog';
import { MyReminders } from './MyReminders';
import { MyTasks } from './MyTasks';
import { MyTaskBoard } from './MyTaskBoard';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { ListPage } from '../components/ui/ListPage';
import { useSubmittedSearch } from '../lib/quickSearch';
import { localSearchHints } from '../lib/searchHints';
import { EmptyState } from '../components/ui/EmptyState';

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
  'My Task Board',
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
  const [taskTick, setTaskTick] = useState(0);
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
              <CollapseAllButton />
              <SettingsButton
                label="Dashboard settings"
                onClick={() => setSettingsOpen(true)}
              />
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
              onSaved={() => {
                setTaskOpen(false);
                setTaskTick((n) => n + 1);
              }}
            />
          )}
          <MyTasks />
        </RecordSection>
      )}

      {!prefs.isHidden('My Task Board') && (
        <RecordSection title="My Task Board" defaultOpen>
          <MyTaskBoard refreshKey={taskTick} />
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
  const sections = useDashboardWidgetSections();
  const prefs = useSectionPrefs('dashboard.pipeline');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  return (
    <div className="list-page">
      <div className="fo-page-head">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Pipeline' }]} />
        <div className="fo-page-header">
          <span className="fo-page-icon">
            <PipelineIcon size={32} />
          </span>
          <div className="fo-page-header-text">
            <div className="fo-page-header-title-row">
              <h1>Pipeline: Home</h1>
              <div className="fo-page-header-actions">
                <CollapseAllButton />
                <SettingsButton
                  label="Pipeline settings"
                  title="Choose which sections appear"
                  onClick={() => setSettingsOpen(true)}
                />
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
      </div>

      {settingsOpen && (
        <SectionSettingsDialog
          title="Pipeline settings"
          hint="Choose which sections appear on Pipeline. The choice is saved to your account."
          sections={sections}
          prefs={prefs}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <DashboardWidgetsPanel
        isSectionHidden={prefs.isHidden}
        range={range}
        onRangeChange={setRange}
      />
    </div>
  );
}

function ReportsTab() {
  const sections = useDashboardWidgetSections();
  const prefs = useSectionPrefs('dashboard.reports');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { input: searchInput, setInput: setSearchInput, term: submittedTerm, submit: submitSearch } = useSubmittedSearch();
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const term = submittedTerm.trim().toLocaleLowerCase();
  const visibleSections = sections.filter((section) =>
    !prefs.isHidden(section) && section.toLocaleLowerCase().includes(term),
  );
  const searchableKey = sections.filter((section) => !prefs.isHidden(section)).join('\n');
  const searchHints = useMemo(
    () =>
      localSearchHints(
        '/reports',
        searchableKey
          .split('\n')
          .filter(Boolean)
          .map((section) => ({ key: `report:${section}`, primary: section, meta: 'Report', text: [section] })),
      ),
    [searchableKey],
  );

  return (
    <ListPage
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Run Report' }]}
      title="Run Report"
      icon={<PieChartIcon size={32} />}
      description="Review recruiting activity across your open work."
      flush
      search={searchInput}
      onSearchChange={setSearchInput}
      onSearchSubmit={submitSearch}
      searchPlaceholder="Search reports…"
      searchHints={searchHints}
      actions={<>
        <CollapseAllButton />
        <SettingsButton label="Report settings" onClick={() => setSettingsOpen(true)} />
      </>}
      toolbarActions={<DateRangeFilter range={range} onChange={setRange} />}
    >
      {visibleSections.length ? <DashboardWidgetsPanel
        isSectionHidden={(section) => !visibleSections.includes(section)}
        range={range}
        onRangeChange={setRange}
      /> : <EmptyState
        icon={<PieChartIcon size={32} />}
        title={term ? 'No reports match that search' : 'No reports selected'}
        hint={term ? 'Try a different report name.' : 'Choose report sections in Report settings.'}
      />}
      {settingsOpen && <SectionSettingsDialog
        title="Report settings"
        hint="Choose which report sections appear here. The choice is saved to your account."
        sections={sections}
        prefs={prefs}
        onClose={() => setSettingsOpen(false)}
      />}
    </ListPage>
  );
}
