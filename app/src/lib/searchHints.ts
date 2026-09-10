import { supabase } from './supabase';
import { searchWords } from './quickSearch';

export const HINT_MIN_CHARS = 3;
const HINT_LIMIT = 10;

const HINT_PER_TABLE = 10;

export interface SearchHint {
  key: string;
  primary: string;
  meta: string;
  href: string;
}

export interface SearchHintResult {
  hints: SearchHint[];
  total: number;
}

export type SearchHintFetcher = (term: string) => Promise<SearchHintResult>;

function like(term: string): string {
  return `%${term}%`;
}

export async function globalSearchHints(term: string): Promise<SearchHintResult> {
  const pattern = like(term);
  const [people, reqs, contacts, companies, deals, tickets] = await Promise.all([
    supabase
      .from('candidate_list')
      .select('person_id, full_name, current_title', { count: 'exact' })
      .or(
        `full_name.ilike.${pattern},current_title.ilike.${pattern},current_employer.ilike.${pattern}`,
      )
      .limit(HINT_PER_TABLE),
    supabase
      .from('requisition_list')
      .select('id, display_code, title, company_name', { count: 'exact' })
      .or(`title.ilike.${pattern},display_code.ilike.${pattern}`)
      .limit(HINT_PER_TABLE),
    supabase
      .from('contact_list')
      .select('person_id, full_name, title, company_name', { count: 'exact' })
      .or(
        `full_name.ilike.${pattern},title.ilike.${pattern},company_name.ilike.${pattern}`,
      )
      .limit(HINT_PER_TABLE),
    supabase
      .from('companies')
      .select('id, name, city', { count: 'exact' })
      .or(`name.ilike.${pattern},city.ilike.${pattern},country.ilike.${pattern}`)
      .limit(HINT_PER_TABLE),
    supabase
      .from('deal_list')
      .select('id, display_code, name, company_name', { count: 'exact' })
      .or(`name.ilike.${pattern},display_code.ilike.${pattern}`)
      .limit(HINT_PER_TABLE),
    supabase
      .from('tickets')
      .select('id, display_code, subject, status', { count: 'exact' })
      .or(`subject.ilike.${pattern},display_code.ilike.${pattern}`)
      .limit(HINT_PER_TABLE),
  ]);

  const lists: SearchHint[][] = [
    (people.data ?? []).map((r) => ({
      key: `candidate:${r.person_id as string}`,
      primary: (r.full_name as string) ?? 'Unnamed',
      meta: (r.current_title as string | null) ?? 'Candidate',
      href: `/recruit/candidates/${r.person_id as string}`,
    })),
    (reqs.data ?? []).map((r) => ({
      key: `requisition:${r.id as string}`,
      primary: `${r.display_code as string} ${r.title as string}`,
      meta: (r.company_name as string | null) ?? 'Requisition',
      href: `/recruit/requisitions/${r.id as string}`,
    })),
    (contacts.data ?? []).map((r) => ({
      key: `contact:${r.person_id as string}`,
      primary: (r.full_name as string) ?? 'Unnamed',
      meta: (r.company_name as string | null) ?? 'Contact',
      href: `/sales/contacts/${r.person_id as string}`,
    })),
    (companies.data ?? []).map((r) => ({
      key: `company:${r.id as string}`,
      primary: r.name as string,
      meta: (r.city as string | null) ?? 'Account',
      href: `/sales/companies/${r.id as string}`,
    })),
    (deals.data ?? []).map((r) => ({
      key: `deal:${r.id as string}`,
      primary: `${r.display_code as string} ${r.name as string}`,
      meta: (r.company_name as string | null) ?? 'Deal',
      href: `/sales/deals/${r.id as string}`,
    })),
    (tickets.data ?? []).map((r) => ({
      key: `ticket:${r.id as string}`,
      primary: `${r.display_code as string} ${r.subject as string}`,
      meta: (r.status as string | null) ?? 'Ticket',
      href: `/sales/tickets/${r.id as string}`,
    })),
  ];

  const capped: SearchHint[] = [];
  for (let round = 0; capped.length < HINT_LIMIT && round < HINT_PER_TABLE; round += 1) {
    for (const list of lists) {
      const entry = list[round];
      if (entry) capped.push(entry);
      if (capped.length === HINT_LIMIT) break;
    }
  }

  return {
    hints: capped,
    total: [people, reqs, contacts, companies, deals, tickets].reduce(
      (sum, result) => sum + (result.count ?? 0),
      0,
    ),
  };
}

export async function requisitionSearchHints(term: string): Promise<SearchHintResult> {
  let query = supabase
    .from('requisition_list')
    .select('id, display_code, title, company_name, location, status', { count: 'exact' })
    .limit(HINT_LIMIT)
    .order('display_code', { ascending: false });
  for (const word of searchWords(term)) query = query.ilike('search_text', like(word));
  const { data, count } = await query;

  return {
    hints: (data ?? []).map((r) => ({
      key: `requisition:${r.id}`,
      primary: `${r.display_code} ${r.title}`,
      meta: [r.company_name, r.location].filter(Boolean).join(' · ') || 'Requisition',
      href: `/recruit/requisitions/${r.id}`,
    })),
    total: count ?? 0,
  };
}

export async function candidateSearchHints(term: string): Promise<SearchHintResult> {
  let query = supabase
    .from('candidate_list')
    .select('person_id, full_name, current_title, current_employer', { count: 'exact' })
    .limit(HINT_LIMIT)
    .order('last_name', { ascending: true })
    .order('person_id', { ascending: true });
  for (const word of searchWords(term)) query = query.ilike('search_text', like(word));
  const { data, count } = await query;

  return {
    hints: (data ?? []).map((r) => ({
      key: `candidate:${r.person_id}`,
      primary: r.full_name ?? 'Unnamed',
      meta:
        [r.current_title, r.current_employer].filter(Boolean).join(' · ') || 'Candidate',
      href: `/recruit/candidates/${r.person_id}`,
    })),
    total: count ?? 0,
  };
}
