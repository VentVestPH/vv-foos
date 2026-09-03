import type { Database, PersonEmail } from '../../../lib/database.types';
import type { Application } from '../lib';
import { personName } from '../lib';

export type CandidateListRow = Omit<
  Database['public']['Views']['candidate_list']['Row'],
  'search_text'
>;

export const SORT_COLUMNS: Record<string, string> = {
  name: 'last_name',
  updated_at: 'person_updated_at',
  has_resume: 'has_resume',
  location: 'city',
  source: 'source_name',
  initial_date: 'initial_date',
  star_grade: 'star_grade',
  grade_comment: 'grade_comment',
  status: 'status_label',
  current_title: 'current_title',
  current_employer: 'current_employer',
  sourcer: 'sourcer_name',
  flags: 'do_not_contact',
};

function rowEmails(row: CandidateListRow): PersonEmail[] {
  return Array.isArray(row.emails) ? (row.emails as unknown as PersonEmail[]) : [];
}

export interface CandFilters {
  statusId: string;
  starGrade: string;
  sourceId: string;
  sourcerId: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: CandFilters = {
  statusId: '',
  starGrade: '',
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
  star_grade: number | null;
  grade_comment: string;
  current_title: string;
  current_employer: string;
  status: string;
  source: string;
  initial_date: string;
  sourcer: string;
  requisitions: string;
  flags: string;
  emails: string;
}

export const COLUMN_DEFS: { key: keyof CandRow & string; header: string }[] = [
  { key: 'name', header: 'Name' },
  { key: 'updated_at', header: 'Last updated' },
  { key: 'has_resume', header: 'Resume' },
  { key: 'location', header: 'Location' },
  { key: 'source', header: 'Source' },
  { key: 'initial_date', header: 'Initial date' },
  { key: 'star_grade', header: 'Grade' },
  { key: 'grade_comment', header: 'Grade comment' },
  { key: 'status', header: 'Main status' },
  { key: 'requisitions', header: 'Requisitions' },
  { key: 'current_title', header: 'Current title' },
  { key: 'current_employer', header: 'Current employer' },
  { key: 'sourcer', header: 'Sourcer' },
  { key: 'flags', header: 'Flags' },
];

export const ALL_COLUMN_KEYS = COLUMN_DEFS.map((c) => c.key);

export interface CandidateRowInput {
  rows: CandidateListRow[];
  apps: Application[];
  reqCode: Map<string, string>;
}

export function buildCandidateRows({ rows, apps, reqCode }: CandidateRowInput): CandRow[] {
  const appsByPerson = new Map<string, Application[]>();
  for (const a of apps) {
    const list = appsByPerson.get(a.person_id) ?? [];
    list.push(a);
    appsByPerson.set(a.person_id, list);
  }
  return rows.map((row) => {
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
      star_grade: row.star_grade,
      grade_comment: row.grade_comment ?? '',
      current_title: row.current_title ?? '',
      current_employer: row.current_employer ?? '',
      status: row.status_label ?? '',
      source: row.source_name ?? '',
      initial_date: row.initial_date ?? '',
      sourcer: row.sourcer_name ?? '',
      requisitions: (appsByPerson.get(row.person_id) ?? [])
        .map((a) => reqCode.get(a.requisition_id) ?? '')
        .filter(Boolean)
        .join(', '),
      flags: flags.join(' \u00b7 '),
      emails: rowEmails(row)
        .map((e) => e.address)
        .join(' '),
    };
  });
}
