import type {
  Application,
  CandidateProfile,
  Person,
  SortState,
} from '../lib';
import { personEmails, personName, sortRows } from '../lib';

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
  profiles: CandidateProfile[];
  people: Map<string, Person>;
  apps: Application[];
  statusLabel: Map<string, string>;
  sourceName: Map<string, string>;
  staffName: Map<string, string>;
  reqCode: Map<string, string>;
  resumePersonIds: Set<string>;
}

export function buildCandidateRows({
  profiles,
  people,
  apps,
  statusLabel,
  sourceName,
  staffName,
  reqCode,
  resumePersonIds,
}: CandidateRowInput): CandRow[] {
  const appsByPerson = new Map<string, Application[]>();
  for (const a of apps) {
    const list = appsByPerson.get(a.person_id) ?? [];
    list.push(a);
    appsByPerson.set(a.person_id, list);
  }
  return profiles.map((prof) => {
    const p = people.get(prof.person_id);
    const flags: string[] = [];
    if (prof.do_not_contact) flags.push('Do not contact');
    return {
      id: prof.person_id,
      name: p ? personName(p) : '…',
      first_name: p?.first_name ?? '',
      last_name: p?.last_name ?? '',
      updated_at: p?.updated_at ?? '',
      has_resume: resumePersonIds.has(prof.person_id),
      location: p
        ? [p.city, p.state, p.country].filter(Boolean).join(', ')
        : '',
      star_grade: prof.star_grade,
      grade_comment: prof.grade_comment ?? '',
      current_title: prof.current_title ?? '',
      current_employer: prof.current_employer ?? '',

      status: prof.status_id ? (statusLabel.get(prof.status_id) ?? '') : '',
      source: prof.source_id ? (sourceName.get(prof.source_id) ?? '') : '',
      initial_date: prof.initial_date ?? '',
      sourcer: prof.sourcer_id ? (staffName.get(prof.sourcer_id) ?? '') : '',
      requisitions: (appsByPerson.get(prof.person_id) ?? [])
        .map((a) => reqCode.get(a.requisition_id) ?? '')
        .filter(Boolean)
        .join(', '),
      flags: flags.join(' · '),
      emails: p
        ? personEmails(p)
            .map((e) => e.address)
            .join(' ')
        : '',
    };
  });
}

export interface CandidateFilterInput {
  rows: CandRow[];
  profiles: CandidateProfile[];
  filters: CandFilters;
  search: string;
  firstName: string;
  lastName: string;
  sort: SortState | null;
}

export function filterCandidateRows({
  rows,
  profiles,
  filters,
  search,
  firstName,
  lastName,
  sort,
}: CandidateFilterInput): CandRow[] {
  const q = search.trim().toLowerCase();
  const base = rows.filter((r) => {
    const prof = profiles.find((p) => p.person_id === r.id);
    if (!prof) return false;
    if (filters.statusId && prof.status_id !== filters.statusId) return false;
    if (filters.starGrade && String(prof.star_grade ?? '') !== filters.starGrade) {
      return false;
    }
    if (filters.sourceId && prof.source_id !== filters.sourceId) return false;
    if (filters.sourcerId && prof.sourcer_id !== filters.sourcerId) return false;
    if (
      filters.dateFrom &&
      (!prof.initial_date || prof.initial_date < filters.dateFrom)
    ) {
      return false;
    }
    if (
      filters.dateTo &&
      (!prof.initial_date || prof.initial_date > filters.dateTo)
    ) {
      return false;
    }
    if (q) {
      const hay =
        `${r.name} ${r.emails} ${r.current_title} ${r.current_employer}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (
      firstName.trim() &&
      !r.first_name.toLowerCase().includes(firstName.trim().toLowerCase())
    ) {
      return false;
    }
    if (
      lastName.trim() &&
      !r.last_name.toLowerCase().includes(lastName.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });
  return sortRows(base, sort);
}
