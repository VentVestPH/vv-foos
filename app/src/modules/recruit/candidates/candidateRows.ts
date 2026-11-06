import type { Database, PersonEmail } from '../../../lib/database.types';
import type { Application } from '../lib';
import { personName } from '../lib';

export type CandidateListRow = Omit<
  Database['public']['Views']['candidate_list']['Row'],
  'search_text' | 'requisition_codes' | 'requisition_search' | 'star_grade'
>;

export const SORT_COLUMNS: Record<string, string> = {
  name: 'last_name',
  updated_at: 'person_updated_at',
  has_resume: 'has_resume',
  location: 'city',
  source: 'source_name',
  initial_date: 'initial_date',
  sourcer_grade: 'sourcer_grade',
  manager_grade: 'manager_grade',
  sourcer_initials: 'sourcer_name',
  grade_comment: 'grade_comment',
  status: 'status_label',
  current_title: 'current_title',
  current_employer: 'current_employer',
  sourcer: 'sourcer_name',
  requisitions: 'requisition_codes',
  flags: 'do_not_contact',
};

function rowEmails(row: CandidateListRow): PersonEmail[] {
  return Array.isArray(row.emails) ? (row.emails as unknown as PersonEmail[]) : [];
}

export interface CandFilters {
  firstName: string;
  lastName: string;
  statusId: string;
  sourcerGrade: string;
  managerGrade: string;
  sourceId: string;
  sourcerId: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: CandFilters = {
  firstName: '',
  lastName: '',
  statusId: '',
  sourcerGrade: '',
  managerGrade: '',
  sourceId: '',
  sourcerId: '',
  dateFrom: '',
  dateTo: '',
};

export interface CandRow extends Record<string, unknown> {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  updated_at: string;
  has_resume: boolean;
  location: string;
  sourcer_grade: string;
  manager_grade: string;
  sourcer_initials: string;
  grade_comment: string;
  current_title: string;
  current_employer: string;
  status: string;
  source: string;
  initial_date: string;
  sourcer: string;
  requisitions: string;
  requisition_names: string[];
  flags: string;
  emails: string;
}

export const COLUMN_DEFS: { key: keyof CandRow & string; header: string }[] = [
  { key: 'flags', header: 'Flags' },
  { key: 'name', header: 'Name' },
  { key: 'location', header: 'Location' },
  { key: 'sourcer_grade', header: 'Sourcer grade' },
  { key: 'sourcer_initials', header: 'Sourcer initials' },
  { key: 'manager_grade', header: 'Manager grade' },
  { key: 'status', header: 'Main status' },
  { key: 'requisitions', header: 'Requisitions' },
  { key: 'initial_date', header: 'Initial date' },
  { key: 'updated_at', header: 'Last updated' },
  { key: 'has_resume', header: 'Resume' },
  { key: 'source', header: 'Source' },
  { key: 'grade_comment', header: 'Grade comment' },
  { key: 'current_title', header: 'Current title' },
  { key: 'current_employer', header: 'Current employer' },
  { key: 'sourcer', header: 'Sourcer' },
];

export const ALL_COLUMN_KEYS = COLUMN_DEFS.map((c) => c.key);

const OFF_BY_DEFAULT_COLUMN_KEYS = ['current_title', 'current_employer', 'sourcer'];

export const DEFAULT_COLUMN_KEYS = ALL_COLUMN_KEYS.filter(
  (k) => !OFF_BY_DEFAULT_COLUMN_KEYS.includes(k),
);

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export interface CandidateRowInput {
  rows: CandidateListRow[];
  apps: Application[];
  reqName: Map<string, string>;
}

export function buildCandidateRows({ rows, apps, reqName }: CandidateRowInput): CandRow[] {
  const appsByPerson = new Map<string, Application[]>();
  for (const a of apps) {
    const list = appsByPerson.get(a.person_id) ?? [];
    list.push(a);
    appsByPerson.set(a.person_id, list);
  }
  return rows.map((row) => {
    const requisitionNames = (appsByPerson.get(row.person_id) ?? [])
      .map((a) => reqName.get(a.requisition_id) ?? '')
      .filter(Boolean);
    const flags: string[] = [];
    if (row.do_not_contact) flags.push('Do not contact');
    return {
      id: row.person_id,
      name: personName({ ...row, headline: null }),
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? '',
      updated_at: row.person_updated_at,
      has_resume: row.has_resume,
      location: [row.city, row.state, row.country].filter(Boolean).join(', '),
      sourcer_grade: row.sourcer_grade ?? '',
      manager_grade: row.manager_grade ?? '',
      sourcer_initials: initialsOf(row.sourcer_name ?? ''),
      grade_comment: row.grade_comment ?? '',
      current_title: row.current_title ?? '',
      current_employer: row.current_employer ?? '',
      status: row.status_label ?? '',
      source: row.source_name ?? '',
      initial_date: row.initial_date ?? '',
      sourcer: row.sourcer_name ?? '',
      requisitions: requisitionNames.join(', '),
      requisition_names: requisitionNames,
      flags: flags.join(' \u00b7 '),
      emails: rowEmails(row)
        .map((e) => e.address)
        .join(' '),
    };
  });
}
