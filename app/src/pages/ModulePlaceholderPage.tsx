import {
  BookOpen as BookIcon,
  ClipboardCheck as ChecklistPersonIcon,
  IdCard as IdBadgeIcon,
  Lock as LockIcon,
  Settings,
} from 'lucide-react';
import { Table } from '../components/ui/Table';
import { PlaceholderAction, usePlaceholder } from '../shell/Placeholder';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

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
  useDocumentTitle(config.title);

  return (
    <div className="list-page">
      <div className="fo-page-header">
        <span className="fo-page-icon">{config.icon}</span>
        <div className="fo-page-header-text">
          <div className="fo-page-header-title-row">
            <h1>{config.title}</h1>
          </div>
          {config.description && (
            <p className="fo-page-desc">{config.description}</p>
          )}
        </div>
      </div>

      {module !== 'onboard' && (
        <div className="fo-search-row">
          <span className="fo-search-label">Search:</span>
          <input type="text" aria-label={`Search ${config.title}`} disabled />
          <PlaceholderAction label="Go!" size="sm" className="fo-go-btn" />
        </div>
      )}

      <button
        type="button"
        className="fo-gear-btn is-placeholder"
        aria-label="Configure this list"
        onClick={() => show('Configure this list')}
      >
        <Settings size={16} aria-hidden="true" />
      </button>

      <div className="list-page-toolbar">
        {module === 'employees' && (
          <>
            <PlaceholderAction label="Send Email" />
            <PlaceholderAction label="Onboard" />
            <PlaceholderAction label="Assign Course" />
            <PlaceholderAction label="More" caret />
            <PlaceholderAction label="Change Status to…" caret />
          </>
        )}
        {module === 'onboard' && (
          <>
            <PlaceholderAction label="Delete" />
            <PlaceholderAction label="New Packet" />
            <PlaceholderAction label="Print Forms" />
            <select aria-label="Filter" disabled defaultValue="all">
              <option value="all">- All -</option>
            </select>
          </>
        )}
        {module === 'users' && (
          <>
            <PlaceholderAction label="Send Email" />
            <PlaceholderAction label="Assign Course" />
          </>
        )}
        {module === 'courses' && <PlaceholderAction label="New Course" />}
      </div>

      {module === 'employees' && <EmployeesTable />}
      {module === 'users' && <UsersTable />}
      {module === 'courses' && <CoursesTable />}
      {module === 'onboard' && (
        <p className="fo-module-placeholder-note">
          No onboarding or offboarding packets yet. This module isn't built in the
          current FOOS MVP. The page shell is in place so it is ready when it is.
        </p>
      )}
    </div>
  );
}
