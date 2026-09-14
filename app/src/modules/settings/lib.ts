export type GoogleTier = 'base' | 'send' | 'calendar';

export interface GoogleTokensSummary {
  scopes: string[];
  connected_at?: string;
  updated_at?: string;
  tier_last_connected?: string;
}

const SCOPE_LABEL: Record<string, string> = {
  'https://www.googleapis.com/auth/gmail.readonly': 'Read Gmail (sync)',
  'https://www.googleapis.com/auth/gmail.send': 'Send Gmail',
  'https://www.googleapis.com/auth/calendar.events': 'Create Calendar events',
};

export function scopeLabel(scope: string): string {
  return SCOPE_LABEL[scope] ?? scope;
}

export function hasScope(tokens: GoogleTokensSummary | null, tier: GoogleTier): boolean {
  if (!tokens) return false;
  const needed =
    tier === 'base'
      ? 'https://www.googleapis.com/auth/gmail.readonly'
      : tier === 'send'
        ? 'https://www.googleapis.com/auth/gmail.send'
        : 'https://www.googleapis.com/auth/calendar.events';
  return tokens.scopes?.includes(needed) ?? false;
}

export const EXPORT_PAGE_SIZE = 1000;
export const EXPORT_ROW_CAP = 100000;

export interface ExportableModule {
  key: string;
  label: string;
  view: 'candidate_list' | 'requisition_list' | 'deal_list' | 'contact_list' | 'company_list' | 'ticket_list';
  orderBy: string;
  columns: { key: string; header: string }[];
}

export const EXPORTABLE_MODULES: ExportableModule[] = [
  {
    key: 'candidates',
    label: 'Candidates',
    view: 'candidate_list',
    orderBy: 'person_id',
    columns: [
      { key: 'person_id', header: 'Person Id' },
      { key: 'first_name', header: 'First Name' },
      { key: 'last_name', header: 'Last Name' },
      { key: 'city', header: 'City' },
      { key: 'country', header: 'Country' },
      { key: 'status_label', header: 'Status' },
      { key: 'source_name', header: 'Source' },
      { key: 'star_grade', header: 'Star Grade' },
      { key: 'initial_date', header: 'Initial Date' },
      { key: 'person_updated_at', header: 'Updated At' },
    ],
  },
  {
    key: 'requisitions',
    label: 'Requisitions',
    view: 'requisition_list',
    orderBy: 'id',
    columns: [
      { key: 'display_code', header: 'Code' },
      { key: 'job_code', header: 'Job Code' },
      { key: 'title', header: 'Title' },
      { key: 'company_name', header: 'Company' },
      { key: 'status', header: 'Status' },
      { key: 'location', header: 'Location' },
      { key: 'num_openings', header: 'Openings' },
      { key: 'application_count', header: 'Applications' },
      { key: 'opened_date', header: 'Opened' },
      { key: 'updated_at', header: 'Updated At' },
    ],
  },
  {
    key: 'companies',
    label: 'Accounts',
    view: 'company_list',
    orderBy: 'id',
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'location_text', header: 'Location' },
      { key: 'website', header: 'Website' },
      { key: 'phone', header: 'Phone' },
      { key: 'owner_name', header: 'Owner' },
      { key: 'updated_at', header: 'Updated At' },
    ],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    view: 'contact_list',
    orderBy: 'person_id',
    columns: [
      { key: 'first_name', header: 'First Name' },
      { key: 'last_name', header: 'Last Name' },
      { key: 'title', header: 'Title' },
      { key: 'company_name', header: 'Company' },
      { key: 'person_updated_at', header: 'Updated At' },
    ],
  },
  {
    key: 'deals',
    label: 'Deals',
    view: 'deal_list',
    orderBy: 'id',
    columns: [
      { key: 'display_code', header: 'Code' },
      { key: 'name', header: 'Name' },
      { key: 'company_name', header: 'Company' },
      { key: 'stage', header: 'Stage' },
      { key: 'value', header: 'Value' },
      { key: 'currency', header: 'Currency' },
      { key: 'expected_close', header: 'Expected Close' },
      { key: 'updated_at', header: 'Updated At' },
    ],
  },
  {
    key: 'tickets',
    label: 'Tickets',
    view: 'ticket_list',
    orderBy: 'id',
    columns: [
      { key: 'display_code', header: 'Code' },
      { key: 'subject', header: 'Subject' },
      { key: 'company_name', header: 'Company' },
      { key: 'status', header: 'Status' },
      { key: 'priority', header: 'Priority' },
      { key: 'assignee_name', header: 'Assignee' },
      { key: 'sla_due_at', header: 'SLA Due' },
    ],
  },
];
