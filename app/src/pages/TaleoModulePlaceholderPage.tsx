import { Settings } from 'lucide-react';
import { Table } from '../components/ui/Table';
import { TaleoPlaceholderAction, usePlaceholder } from '../shell/TaleoPlaceholder';
import {
  ChecklistPersonIcon,
  IdBadgeIcon,
  LockIcon,
  BookIcon,
} from '../shell/icons';

/**
 * Taleo-complete static shells for the four primary-nav tabs FOOS doesn't
 * implement yet: Employees, Onboard/Offboard, Users, Courses (redesign
 * prompt section 8.10). Each reproduces its screenshot's title, icon,
 * description, action bar, and table/empty-state exactly, with every
 * action routed through the centralized TaleoPlaceholderAction so nothing
 * here pretends to work. Reports reuses the Dashboard route instead of a
 * page here (section 8.1/8.10).
 *
 * FOOS-TBD: replace with real modules if/when these tracks get built.
 */

type ModuleKey = 'employees' | 'onboard' | 'users' | 'courses';

const MODULES: Record<
  ModuleKey,
  {
    icon: JSX.Element;
    title: string;
    description?: string;
  }
> = {
  employees: {
    icon: <IdBadgeIcon size={40} />,
    title: 'Employees: Home',
    description:
      'Employees are all the people employed by the company and can be managed by Front Office OS.',
  },
  onboard: {
    icon: <ChecklistPersonIcon size={40} />,
    title: 'Onboard/Offboard: Home',
  },
  users: {
    icon: <LockIcon size={40} />,
    title: 'Users: Home',
    description:
      'Users are all the people with access to your Front Office OS system including hiring managers, recruiters, interviewers, staffing agencies, etc.',
  },
  courses: {
    icon: <BookIcon size={40} />,
    title: 'Courses: Home',
    description:
      'Courses represent training programs you want to assign and track in Front Office OS.',
  },
};

function EmployeesTable() {
  return (
    <Table
      columns={[
        { key: 'id', header: 'ID', sortable: true },
        { key: 'employee_code', header: 'Employee Code' },
        { key: 'name', header: 'Name' },
        { key: 'status', header: 'Status' },
        { key: 'job_title', header: 'Job Title' },
        { key: 'department', header: 'Department' },
        { key: 'location', header: 'Location' },
        { key: 'last_updated', header: 'Last updated' },
      ]}
      rows={[]}
      rowKey={(r: { id: string }) => r.id}
      selectable
      emptyText="There are currently no employees in your Front Office OS system."
    />
  );
}

function UsersTable() {
  return (
    <Table
      columns={[
        { key: 'name', header: 'Name' },
        { key: 'title', header: 'Title' },
        { key: 'role', header: 'Role' },
        { key: 'last_login', header: 'Last login', sortable: true },
        { key: 'location', header: 'Location' },
        { key: 'manager', header: 'Manager' },
      ]}
      rows={[]}
      rowKey={(r: { name: string }) => r.name}
      selectable
      emptyText="There are currently no users in your Front Office OS system."
    />
  );
}

function CoursesTable() {
  return (
    <Table
      columns={[
        { key: 'title', header: 'Title' },
        { key: 'code', header: 'Code' },
        { key: 'last_updated', header: 'Last Updated', sortable: true },
        { key: 'status', header: 'Status' },
        { key: 'actions', header: 'Actions' },
      ]}
      rows={[]}
      rowKey={(r: { title: string }) => r.title}
      emptyText="There are currently no courses in your Front Office OS system."
    />
  );
}

export function ModulePlaceholderRoutes({ module }: { module: ModuleKey }) {
  const { show } = usePlaceholder();
  const config = MODULES[module];

  return (
    <div className="list-page">
      <div className="taleo-page-header">
        <span className="taleo-page-icon">{config.icon}</span>
        <div className="taleo-page-header-text">
          <div className="taleo-page-header-title-row">
            <h1>{config.title}</h1>
          </div>
          {config.description && (
            <p className="taleo-page-desc">{config.description}</p>
          )}
        </div>
      </div>

      {module !== 'onboard' && (
        <div className="taleo-search-row">
          <span className="taleo-search-label">Search:</span>
          <input type="text" aria-label={`Search ${config.title}`} disabled />
          <TaleoPlaceholderAction label="Go!" size="sm" className="taleo-go-btn" />
        </div>
      )}

      {/* C7/D13: was a text gear glyph, and onClick={() => undefined} made this
          a dead control that bypassed the centralized placeholder entirely,
          which the redesign prompt forbids ("centralize the placeholder
          behavior rather than duplicating alerts throughout the app"). */}
      <button
        type="button"
        className="taleo-gear-btn"
        aria-label="Configure this list"
        aria-disabled
        onClick={() => show('Configure this list')}
      >
        <Settings size={16} strokeWidth={1.6} aria-hidden="true" />
      </button>

      <div className="list-page-toolbar">
        {module === 'employees' && (
          <>
            <TaleoPlaceholderAction label="Send Email" />
            <TaleoPlaceholderAction label="Onboard" />
            <TaleoPlaceholderAction label="Assign Course" />
            <TaleoPlaceholderAction label="More" caret />
            <TaleoPlaceholderAction label="Change Status to…" caret />
          </>
        )}
        {module === 'onboard' && (
          <>
            <TaleoPlaceholderAction label="Delete" />
            <TaleoPlaceholderAction label="New Packet" />
            <TaleoPlaceholderAction label="Print Forms" />
            <select aria-label="Filter" disabled defaultValue="all">
              <option value="all">- All -</option>
            </select>
          </>
        )}
        {module === 'users' && (
          <>
            <TaleoPlaceholderAction label="Send Email" />
            <TaleoPlaceholderAction label="Assign Course" />
          </>
        )}
        {module === 'courses' && <TaleoPlaceholderAction label="New Course" />}
      </div>

      {module === 'employees' && <EmployeesTable />}
      {module === 'users' && <UsersTable />}
      {module === 'courses' && <CoursesTable />}
      {module === 'onboard' && (
        <p className="taleo-module-placeholder-note">
          No onboarding or offboarding packets yet. This module isn't built in the
          current FOOS MVP — the page shell matches Front Office OS's Taleo
          reference exactly so it's ready when it is.
          {/* FOOS-TBD: build the real Onboard/Offboard module. */}
        </p>
      )}
    </div>
  );
}
