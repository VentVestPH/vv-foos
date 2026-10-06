import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen as BookIcon,
  ClipboardCheck as ChecklistPersonIcon,
  GraduationCap as AssignIcon,
  IdCard as IdBadgeIcon,
  Plus,
  UserPlus,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ListPage } from '../components/ui/ListPage';
import { Pager } from '../components/ui/Pager';
import { RecordEditDialog, type EditField, type EditValue } from '../components/ui/RecordEditDialog';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/ui/Badge';
import { Table, type TableColumn } from '../components/ui/Table';
import { PlaceholderAction } from '../shell/Placeholder';
import { useRole, useSession } from '../auth/SessionProvider';
import { useMinimumVisible } from '../hooks/useMinimumVisible';
import { EMPTY_CELL, formatDate } from '../lib/format';
import { EMAIL_PATTERN } from '../lib/personValidation';
import { useSubmittedSearch } from '../lib/quickSearch';
import { supabase } from '../lib/supabase';
import { useLatestOnly } from '../lib/useLatestOnly';
import type { Database, EmployeeStatus } from '../lib/database.types';

type ModuleKey = 'employees' | 'onboard' | 'courses';
type EmployeeRow = Database['public']['Views']['employee_list']['Row'];
type CourseRow = Database['public']['Views']['course_list']['Row'];
type Option = { value: string; label: string };

const PAGE_SIZE = 20;
const EMPLOYEE_COLUMNS_SELECT =
  'id, display_code, person_id, full_name, email, job_title, department, location, start_date, status, manager_id, manager_name, updated_at, course_count, open_course_count';
const COURSE_COLUMNS_SELECT = 'id, display_code, title, description, status, updated_at, assigned_count, completed_count';

const MODULES: Record<ModuleKey, { icon: JSX.Element; title: string; description: string }> = {
  employees: {
    icon: <IdBadgeIcon size={32} />,
    title: 'Employees',
    description: 'Employee records for people working at your organization.',
  },
  onboard: {
    icon: <ChecklistPersonIcon size={32} />,
    title: 'Onboard/Offboard',
    description: 'Employees who are being onboarded or offboarded, with their open course assignments.',
  },
  courses: {
    icon: <BookIcon size={32} />,
    title: 'Courses',
    description: 'Training courses assigned to employees and tracked by your team.',
  },
};

const EMPLOYEE_SORT: Record<string, string> = {
  display_code: 'display_code',
  full_name: 'full_name',
  status: 'status',
  job_title: 'job_title',
  department: 'department',
  location: 'location',
  manager_name: 'manager_name',
  courses: 'open_course_count',
  start_date: 'start_date',
  updated_at: 'updated_at',
};

const COURSE_SORT: Record<string, string> = {
  title: 'title',
  display_code: 'display_code',
  status: 'status',
  assigned_count: 'assigned_count',
  completed_count: 'completed_count',
  updated_at: 'updated_at',
};

function localDate(value: string | null): string {
  return value ? formatDate(`${value}T00:00:00`) : EMPTY_CELL;
}

function likeTerm(word: string): string {
  return `%${word.replace(/([\\%_])/g, '\\$1')}%`;
}

function useStaffOptions(): Option[] {
  const [options, setOptions] = useState<Option[]>([]);
  useEffect(() => {
    let cancelled = false;
    void supabase.from('staff').select('id, full_name').eq('is_active', true).order('full_name').then(({ data }) => {
      if (!cancelled) setOptions((data ?? []).map((row) => ({ value: row.id, label: row.full_name })));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}

function useHiredCandidates(enabled: boolean): Option[] {
  const [options, setOptions] = useState<Option[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void supabase
      .from('applications')
      .select('person_id, hired_at')
      .eq('stage', 'hired')
      .order('hired_at', { ascending: false })
      .order('id')
      .range(0, 199)
      .then(async ({ data }) => {
        const ids = [...new Set((data ?? []).map((row) => row.person_id))];
        if (!ids.length) return;
        const { data: people } = await supabase.from('people').select('id, first_name, last_name').in('id', ids);
        if (cancelled) return;
        const byId = new Map((people ?? []).map((row) => [row.id, [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed']));
        setOptions(ids.flatMap((id) => (byId.has(id) ? [{ value: id, label: byId.get(id) as string }] : [])));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return options;
}

function useServerList<T>(
  view: 'employee_list' | 'course_list',
  columns: string,
  sortMap: Record<string, string>,
  defaultSort: string,
  term: string,
  statuses: EmployeeStatus[] | null,
  refreshKey: number,
  enabled: boolean,
) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const beginLoad = useLatestOnly();

  useEffect(() => {
    setPage(0);
  }, [term, sort, statuses]);

  useEffect(() => {
    if (!enabled) return;
    const isCurrent = beginLoad();
    setLoading(true);
    let query = supabase.from(view).select(columns, { count: 'exact' });
    for (const word of term.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
      query = query.ilike('search_text', likeTerm(word));
    }
    if (statuses) query = query.in('status', statuses);
    const sortColumn = sort ? sortMap[sort.key] : undefined;
    query = sortColumn
      ? query.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false })
      : query.order(defaultSort, { ascending: true });
    void query
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      .then(({ data, count, error: queryError }) => {
        if (!isCurrent()) return;
        setError(queryError?.message ?? null);
        setRows((data ?? []) as T[]);
        setTotal(count ?? 0);
        setLoading(false);
      });
  }, [beginLoad, columns, defaultSort, enabled, page, refreshKey, sort, sortMap, statuses, term, view]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pager = (
    <Pager
      from={total === 0 ? 0 : page * PAGE_SIZE + 1}
      to={Math.min(total, (page + 1) * PAGE_SIZE)}
      total={total}
      page={page}
      pageCount={pageCount}
      onPage={setPage}
    />
  );
  return { rows, loading, error, sort, setSort, pager };
}

function OnboardEmployeeDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { staff } = useSession();
  const staffOptions = useStaffOptions();
  const hired = useHiredCandidates(true);
  const fields: EditField[] = [
    { kind: 'select', key: 'person_id', label: 'Hired candidate', options: hired, placeholder: 'Not linked to a candidate', span: true, section: 'Employee' },
    { kind: 'text', key: 'full_name', label: 'Full name', section: 'Employee' },
    { kind: 'email', key: 'email', label: 'Work email', section: 'Employee' },
    { kind: 'text', key: 'job_title', label: 'Job title', section: 'Role' },
    { kind: 'text', key: 'department', label: 'Department', section: 'Role' },
    { kind: 'text', key: 'location', label: 'Location', section: 'Role' },
    { kind: 'date', key: 'start_date', label: 'Start date', section: 'Role' },
    { kind: 'select', key: 'manager_id', label: 'Onboarding owner', options: staffOptions, placeholder: 'No owner', section: 'Role' },
  ];
  const values: Record<string, EditValue> = {
    person_id: '', full_name: '', email: '', job_title: '', department: '', location: '', start_date: '', manager_id: staff?.id ?? '',
  };

  const save = async (draft: Record<string, EditValue>) => {
    const text = (key: string) => (typeof draft[key] === 'string' ? (draft[key] as string).trim() : '');
    const personId = text('person_id');
    const fullName = text('full_name') || hired.find((option) => option.value === personId)?.label || '';
    if (!fullName) throw new Error('Enter the employee’s full name, or choose the hired candidate they came from.');
    const email = text('email');
    if (email && !EMAIL_PATTERN.test(email)) throw new Error('Enter a valid email address.');
    const { error } = await supabase.from('employees').insert({
      full_name: fullName,
      person_id: personId || null,
      email: email || null,
      job_title: text('job_title') || null,
      department: text('department') || null,
      location: text('location') || null,
      start_date: text('start_date') || null,
      manager_id: text('manager_id') || null,
      created_by: staff?.id ?? null,
    });
    if (error) throw new Error(error.message);
    onSaved();
    onClose();
  };

  return (
    <RecordEditDialog
      title="Onboard employee"
      fields={fields}
      values={values}
      onClose={onClose}
      onSave={save}
      footNote="The employee starts in onboarding and appears on the Onboard/Offboard tab until they are marked active."
    />
  );
}

function AssignCourseDialog({
  employeeIds,
  onClose,
  onSaved,
}: {
  employeeIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { staff } = useSession();
  const [employees, setEmployees] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      supabase.from('employees').select('id, full_name, display_code').neq('status', 'inactive').order('full_name').order('id').range(0, 999),
      supabase.from('courses').select('id, title, display_code').eq('status', 'active').order('title').order('id').range(0, 999),
    ]).then(([employeeResult, courseResult]) => {
      if (cancelled) return;
      setEmployees((employeeResult.data ?? []).map((row) => ({ value: row.id, label: `${row.full_name} · ${row.display_code}` })));
      setCourses((courseResult.data ?? []).map((row) => ({ value: row.id, label: `${row.title} · ${row.display_code}` })));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const preselected = employeeIds.length === 1 ? employeeIds[0] ?? '' : '';
  const fields: EditField[] = [
    ...(employeeIds.length > 1
      ? []
      : [{ kind: 'select' as const, key: 'employee_id', label: 'Employee', options: employees, placeholder: 'Choose an employee', span: true }]),
    { kind: 'select', key: 'course_id', label: 'Course', options: courses, placeholder: 'Create a new course instead', span: true },
    { kind: 'text', key: 'new_course', label: 'New course title', placeholder: 'Only when the course is not listed', span: true },
    { kind: 'date', key: 'due_date', label: 'Due date' },
  ];

  const save = async (draft: Record<string, EditValue>) => {
    const text = (key: string) => (typeof draft[key] === 'string' ? (draft[key] as string).trim() : '');
    const targets = employeeIds.length > 1 ? employeeIds : [text('employee_id')].filter(Boolean);
    if (!targets.length) throw new Error('Choose the employee to assign the course to.');
    let courseId = text('course_id');
    const newTitle = text('new_course');
    if (!courseId && !newTitle) throw new Error('Choose a course, or enter a title to create one.');
    if (!courseId) {
      const { data, error } = await supabase
        .from('courses')
        .insert({ title: newTitle, created_by: staff?.id ?? null })
        .select('id')
        .single();
      if (error || !data) {
        throw new Error(error?.code === '23505' ? `A course called “${newTitle}” already exists. Choose it from the list.` : error?.message ?? 'The course could not be created.');
      }
      courseId = data.id;
    }
    const { error } = await supabase.from('course_assignments').upsert(
      targets.map((employeeId) => ({
        course_id: courseId,
        employee_id: employeeId,
        due_date: text('due_date') || null,
        assigned_by: staff?.id ?? null,
      })),
      { onConflict: 'course_id,employee_id', ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    onSaved();
    onClose();
  };

  return (
    <RecordEditDialog
      title={employeeIds.length > 1 ? `Assign a course to ${employeeIds.length} employees` : 'Assign course'}
      fields={fields}
      values={{ employee_id: preselected, course_id: '', new_course: '', due_date: '' }}
      onClose={onClose}
      onSave={save}
      footNote="An employee who already has this course keeps their existing assignment and progress."
    />
  );
}

function NewCourseDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { staff } = useSession();
  const save = async (draft: Record<string, EditValue>) => {
    const title = typeof draft.title === 'string' ? draft.title.trim() : '';
    const description = typeof draft.description === 'string' ? draft.description.trim() : '';
    const { error } = await supabase.from('courses').insert({ title, description: description || null, created_by: staff?.id ?? null });
    if (error) throw new Error(error.code === '23505' ? `A course called “${title}” already exists.` : error.message);
    onSaved();
    onClose();
  };
  return (
    <RecordEditDialog
      title="New course"
      fields={[
        { kind: 'text', key: 'title', label: 'Title', span: true },
        { kind: 'textarea', key: 'description', label: 'Description', span: true },
      ]}
      values={{ title: '', description: '' }}
      required={['title']}
      onClose={onClose}
      onSave={save}
    />
  );
}

function ListBody({
  loading,
  error,
  pager,
  table,
}: {
  loading: boolean;
  error: string | null;
  pager: JSX.Element;
  table: (busy: boolean) => JSX.Element;
}) {
  const showSkeleton = useMinimumVisible(loading);
  return (
    <>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="fo-list-toolbar">{pager}</div>
      {showSkeleton ? (
        <div className="fo-skeleton-card">
          <Skeleton rows={8} label="Loading rows" />
        </div>
      ) : table(loading)}
      <div className="fo-list-toolbar">{pager}</div>
    </>
  );
}

export function WorkforceRoutes({ module }: { module: ModuleKey }) {
  const config = MODULES[module];
  const role = useRole();
  const canWrite = role === 'admin' || role === 'recruiter';
  const { input, setInput, term, submit } = useSubmittedSearch();
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState<'onboard' | 'assign' | 'course' | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const statuses = useMemo<EmployeeStatus[] | null>(
    () => (module === 'onboard' ? ['onboarding', 'offboarding'] : null),
    [module],
  );

  const employees = useServerList<EmployeeRow>('employee_list', EMPLOYEE_COLUMNS_SELECT, EMPLOYEE_SORT, 'display_code', term, statuses, refreshKey, module !== 'courses');
  const courses = useServerList<CourseRow>('course_list', COURSE_COLUMNS_SELECT, COURSE_SORT, 'title', term, null, refreshKey, module === 'courses');
  const searching = term.trim().length > 0;
  const writeTitle = canWrite ? undefined : 'Only an admin or recruiter can change employee records';

  const employeeColumns: TableColumn<EmployeeRow>[] = [
    { key: 'display_code', header: 'Employee ID', nowrap: true },
    { key: 'full_name', header: 'Name' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'job_title', header: 'Job Title', render: (row) => row.job_title ?? EMPTY_CELL },
    { key: 'department', header: 'Department', render: (row) => row.department ?? EMPTY_CELL },
    { key: 'location', header: 'Location', render: (row) => row.location ?? EMPTY_CELL },
    { key: 'manager_name', header: 'Owner', render: (row) => row.manager_name ?? EMPTY_CELL },
    { key: 'courses', header: 'Courses', render: (row) => (row.course_count ? `${row.course_count - row.open_course_count} of ${row.course_count} done` : EMPTY_CELL) },
    { key: 'start_date', header: 'Start Date', render: (row) => localDate(row.start_date), nowrap: true },
    { key: 'updated_at', header: 'Last Updated', render: (row) => formatDate(row.updated_at), nowrap: true },
  ];

  const processColumns: TableColumn<EmployeeRow>[] = [
    { key: 'full_name', header: 'Employee' },
    { key: 'status', header: 'Packet', render: (row) => (row.status === 'onboarding' ? 'Onboarding' : 'Offboarding') },
    { key: 'manager_name', header: 'Owner', render: (row) => row.manager_name ?? EMPTY_CELL },
    { key: 'courses', header: 'Status', render: (row) => (row.open_course_count ? `${row.open_course_count} course${row.open_course_count === 1 ? '' : 's'} open` : 'No open courses') },
    { key: 'start_date', header: 'Due Date', render: (row) => localDate(row.start_date), nowrap: true },
    { key: 'job_title', header: 'Role', render: (row) => row.job_title ?? EMPTY_CELL },
  ];

  const courseColumns: TableColumn<CourseRow>[] = [
    { key: 'title', header: 'Course' },
    { key: 'display_code', header: 'Course Code', nowrap: true },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'assigned_count', header: 'Assigned' },
    { key: 'completed_count', header: 'Completed' },
    { key: 'updated_at', header: 'Last Updated', render: (row) => formatDate(row.updated_at), nowrap: true },
  ];

  const list = module === 'courses' ? courses : employees;

  return (
    <ListPage
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: config.title }]}
      title={config.title}
      icon={config.icon}
      description={config.description}
      flush
      search={input}
      onSearchChange={setInput}
      onSearchSubmit={submit}
      searchPlaceholder={`Search ${config.title.toLowerCase()}…`}
      actions={
        <>
          {module === 'employees' && (
            <>
              <Button variant="primary" disabled={!canWrite} title={writeTitle} onClick={() => setDialog('onboard')}>
                <UserPlus size={20} aria-hidden="true" /> Onboard Employee
              </Button>
              <Button disabled={!canWrite} title={writeTitle} onClick={() => setDialog('assign')}>
                <AssignIcon size={20} aria-hidden="true" /> {selected.size > 1 ? `Assign Course (${selected.size})` : 'Assign Course'}
              </Button>
            </>
          )}
          {module === 'onboard' && (
            <PlaceholderAction label="New Packet" variant="primary" icon={<Plus size={20} aria-hidden="true" />} detail="Onboarding and offboarding packets are not available yet." />
          )}
          {module === 'courses' && (
            <Button variant="primary" disabled={!canWrite} title={writeTitle} onClick={() => setDialog('course')}>
              <Plus size={20} aria-hidden="true" /> New Course
            </Button>
          )}
        </>
      }
    >
      <ListBody
        loading={list.loading}
        error={list.error}
        pager={list.pager}
        table={(busy) => module === 'courses' ? (
          <Table
            className="module-list-table"
            busy={busy}
            columns={courseColumns}
            rows={courses.rows}
            rowKey={(row) => row.id}
            sortKey={courses.sort?.key ?? null}
            sortDir={courses.sort?.dir ?? 'asc'}
            onSortChange={(key, dir) => courses.setSort({ key, dir })}
            emptyIcon={<BookIcon size={32} />}
            emptyText={searching ? 'No courses match that search.' : 'No courses yet.'}
          />
        ) : (
          <Table
            className="module-list-table"
            busy={busy}
            columns={module === 'onboard' ? processColumns : employeeColumns}
            rows={employees.rows}
            rowKey={(row) => row.id}
            rowName={(row) => row.full_name}
            selectable={module === 'employees' && canWrite}
            selected={selected}
            onSelectionChange={setSelected}
            sortKey={employees.sort?.key ?? null}
            sortDir={employees.sort?.dir ?? 'asc'}
            onSortChange={(key, dir) => employees.setSort({ key, dir })}
            emptyIcon={module === 'onboard' ? <ChecklistPersonIcon size={32} /> : <IdBadgeIcon size={32} />}
            emptyText={
              module === 'onboard'
                ? searching ? 'No onboarding or offboarding employees match that search.' : 'No employees are being onboarded or offboarded.'
                : searching ? 'No employee records match that search.' : 'No employee records yet. Use Onboard Employee to add one.'
            }
          />
        )}
      />
      {dialog === 'onboard' && <OnboardEmployeeDialog onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog === 'assign' && (
        <AssignCourseDialog
          employeeIds={[...selected]}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setSelected(new Set());
            refresh();
          }}
        />
      )}
      {dialog === 'course' && <NewCourseDialog onClose={() => setDialog(null)} onSaved={refresh} />}
    </ListPage>
  );
}
