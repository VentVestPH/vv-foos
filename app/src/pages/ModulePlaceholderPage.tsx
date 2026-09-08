import { useEffect, useState } from 'react';
import {
  BookOpen as BookIcon,
  ClipboardCheck as ChecklistPersonIcon,
  IdCard as IdBadgeIcon,
  Lock as LockIcon,
} from 'lucide-react';
import { Select } from '../components/ui/Select';
import { Table } from '../components/ui/Table';
import { PlaceholderAction } from '../shell/Placeholder';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { supabase } from '../lib/supabase';
import { EMPTY_CELL } from '../lib/format';
import type { StaffRole } from '../lib/database.types';

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
    icon: <IdBadgeIcon size={32} />,
    title: 'Employees: Home',
    description:
      'Employees are all the people employed by the company and can be managed by Front Office OS.',
  },
  onboard: {
    icon: <ChecklistPersonIcon size={32} />,
    title: 'Onboard/Offboard: Home',
  },
  users: {
    icon: <LockIcon size={32} />,
    title: 'Users: Home',
    description:
      'Users are all the people with access to your Front Office OS system including hiring managers, recruiters, interviewers, staffing agencies, etc.',
  },
  courses: {
    icon: <BookIcon size={32} />,
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

interface StaffRow {
  id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  title: string | null;
  manager_id: string | null;
  is_active: boolean;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Administrator',
  recruiter: 'Recruiter',
  sourcer: 'Sourcer',
  bd: 'Business Development',
};

function UsersTable() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from('staff')
      .select('id, full_name, email, role, title, manager_id, is_active')
      .order('full_name')
      .then(({ data }) => {
        if (cancelled) return;
        setRows((data ?? []) as StaffRow[]);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nameById = new Map(rows.map((r) => [r.id, r.full_name]));

  return (
    <Table
      columns={[
        { key: 'full_name', header: 'Name', sortable: true },
        { key: 'email', header: 'Email' },
        {
          key: 'title',
          header: 'Title',
          render: (r: StaffRow) => r.title || EMPTY_CELL,
        },
        {
          key: 'role',
          header: 'Role',
          sortable: true,
          sortValue: (r: StaffRow) => ROLE_LABELS[r.role],
          render: (r: StaffRow) => ROLE_LABELS[r.role],
        },
        {
          key: 'manager',
          header: 'Manager',
          sortValue: (r: StaffRow) =>
            r.manager_id ? nameById.get(r.manager_id) ?? '' : '',
          render: (r: StaffRow) =>
            (r.manager_id ? nameById.get(r.manager_id) : null) ?? EMPTY_CELL,
        },
        {
          key: 'is_active',
          header: 'Status',
          sortable: true,
          sortValue: (r: StaffRow) => (r.is_active ? 'Active' : 'Inactive'),
          render: (r: StaffRow) => (r.is_active ? 'Active' : 'Inactive'),
        },
      ]}
      rows={rows}
      rowKey={(r: StaffRow) => r.id}
      busy={!loaded}
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
          <input
            type="text"
            aria-label={`Search ${config.title}`}
            title="Searching is not available yet"
            disabled
          />
          <PlaceholderAction label="Search" size="sm" className="fo-go-btn" />
        </div>
      )}

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
            <Select
              aria-label="Filter"
              disabled
              value="all"
              options={[{ value: 'all', label: '- All -' }]}
            />
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
          Onboarding is not available yet.
        </p>
      )}
    </div>
  );
}
