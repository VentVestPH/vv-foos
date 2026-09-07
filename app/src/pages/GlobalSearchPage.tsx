import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RecordSection } from '../components/ui/RecordPage';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const LIMIT = 25;

export interface SearchHit {
  id: string;
  primary: string;
  secondary: string;
}

export interface SearchGroup {
  key: string;
  title: string;
  hits: SearchHit[];
  total: number;
  href: (id: string) => string;
}

export function searchTerm(raw: string): string {
  return raw.replace(/[,()%_*]/g, ' ').replace(/\s+/g, ' ').trim();
}

function pattern(term: string): string {
  return `%${term}%`;
}

function joined(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' · ');
}

export function GlobalSearchPage() {
  useDocumentTitle('Search everything');
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const term = useMemo(() => searchTerm(query), [query]);

  const run = useCallback(async (needle: string) => {
    setLoading(true);
    setError(null);
    const like = pattern(needle);
    const tokens = needle.split(' ').filter(Boolean);

    try {
      const [people, extraPeople, reqs, companies, deals, tickets] = await Promise.all([
        supabase
          .from('people')
          .select('id, first_name, middle_name, last_name, headline, city, country', {
            count: 'exact',
          })
          .or(`first_name.ilike.${like},last_name.ilike.${like},headline.ilike.${like}`)
          .order('last_name')
          .limit(LIMIT),
        tokens.length === 2
          ? supabase
              .from('people')
              .select('id, first_name, middle_name, last_name, headline, city, country')
              .ilike('first_name', pattern(tokens[0] as string))
              .ilike('last_name', pattern(tokens[1] as string))
              .limit(LIMIT)
          : Promise.resolve({ data: [], error: null, count: 0 }),
        supabase
          .from('requisitions')
          .select('id, display_code, title, location, status', { count: 'exact' })
          .or(
            `title.ilike.${like},display_code.ilike.${like},job_code.ilike.${like},location.ilike.${like}`,
          )
          .order('opened_date', { ascending: false })
          .limit(LIMIT),
        supabase
          .from('companies')
          .select('id, name, city, country', { count: 'exact' })
          .or(`name.ilike.${like},city.ilike.${like},country.ilike.${like}`)
          .order('name')
          .limit(LIMIT),
        supabase
          .from('deals')
          .select('id, display_code, name, stage', { count: 'exact' })
          .or(`name.ilike.${like},display_code.ilike.${like}`)
          .order('created_at', { ascending: false })
          .limit(LIMIT),
        supabase
          .from('tickets')
          .select('id, display_code, subject, status', { count: 'exact' })
          .or(`subject.ilike.${like},display_code.ilike.${like}`)
          .order('display_code', { ascending: false })
          .limit(LIMIT),
      ]);

      const firstError =
        people.error ?? reqs.error ?? companies.error ?? deals.error ?? tickets.error ?? null;
      if (firstError) throw new Error(firstError.message);

      type PersonHit = {
        id: string;
        first_name: string | null;
        last_name: string | null;
        headline: string | null;
        city: string | null;
        country: string | null;
      };
      const byId = new Map<string, PersonHit>();
      for (const row of [...(people.data ?? []), ...(extraPeople.data ?? [])] as PersonHit[]) {
        byId.set(row.id, row);
      }
      const personIds = [...byId.keys()];

      const [candidateRows, contactRows] = personIds.length
        ? await Promise.all([
            supabase.from('candidate_profiles').select('person_id').in('person_id', personIds),
            supabase.from('contact_profiles').select('person_id, title').in('person_id', personIds),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
          ];

      const candidateIds = new Set((candidateRows.data ?? []).map((r) => r.person_id));
      const contactTitle = new Map(
        (contactRows.data ?? []).map((r) => [r.person_id, r.title ?? '']),
      );

      const personName = (row: { first_name: string | null; last_name: string | null }) =>
        [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed';

      const candidates = personIds
        .filter((id) => candidateIds.has(id))
        .map((id) => {
          const row = byId.get(id)!;
          return {
            id,
            primary: personName(row),
            secondary: joined(row.headline, row.city, row.country),
          };
        });

      const contacts = personIds
        .filter((id) => contactTitle.has(id))
        .map((id) => {
          const row = byId.get(id)!;
          return {
            id,
            primary: personName(row),
            secondary: joined(contactTitle.get(id), row.city, row.country),
          };
        });

      setGroups([
        {
          key: 'candidates',
          title: 'Candidates',
          hits: candidates,
          total: candidates.length,
          href: (id) => `/recruit/candidates/${id}`,
        },
        {
          key: 'requisitions',
          title: 'Requisitions',
          hits: (reqs.data ?? []).map((r) => ({
            id: r.id,
            primary: `${r.display_code} ${r.title}`,
            secondary: joined(r.location, r.status),
          })),
          total: reqs.count ?? (reqs.data ?? []).length,
          href: (id) => `/recruit/requisitions/${id}`,
        },
        {
          key: 'contacts',
          title: 'Contacts',
          hits: contacts,
          total: contacts.length,
          href: (id) => `/sales/contacts/${id}`,
        },
        {
          key: 'companies',
          title: 'Accounts',
          hits: (companies.data ?? []).map((c) => ({
            id: c.id,
            primary: c.name,
            secondary: joined(c.city, c.country),
          })),
          total: companies.count ?? (companies.data ?? []).length,
          href: (id) => `/sales/companies/${id}`,
        },
        {
          key: 'deals',
          title: 'Deals',
          hits: (deals.data ?? []).map((d) => ({
            id: d.id,
            primary: `${d.display_code} ${d.name}`,
            secondary: d.stage,
          })),
          total: deals.count ?? (deals.data ?? []).length,
          href: (id) => `/sales/deals/${id}`,
        },
        {
          key: 'tickets',
          title: 'Tickets',
          hits: (tickets.data ?? []).map((t) => ({
            id: t.id,
            primary: `${t.display_code} ${t.subject}`,
            secondary: t.status,
          })),
          total: tickets.count ?? (tickets.data ?? []).length,
          href: (id) => `/sales/tickets/${id}`,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDraft(query);
    if (term.length >= 2) void run(term);
    else setGroups([]);
  }, [query, term, run]);

  const found = groups.reduce((sum, g) => sum + g.hits.length, 0);

  return (
    <div className="record-page">
      <div className="fo-page-header">
        <div className="fo-page-header-text">
          <div className="fo-page-header-title-row">
            <h1>Search everything</h1>
          </div>
          <p className="fo-page-desc">
            Candidates, requisitions, contacts, accounts, deals and tickets you have access to.
          </p>
        </div>
      </div>

      <form
        className="fo-search-row"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(draft.trim() ? { q: draft.trim() } : {});
        }}
      >
        <span className="fo-search-label">Keywords:</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Search everything"
          autoFocus
        />
        <button type="submit" className="btn btn-secondary btn-sm fo-go-btn">
          Go!
        </button>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}
      {term.length > 0 && term.length < 2 && (
        <p className="text-secondary">Type at least two characters.</p>
      )}
      {loading && <p className="text-secondary">Searching…</p>}
      {!loading && term.length >= 2 && found === 0 && !error && (
        <p className="table-empty">Nothing matches “{term}”.</p>
      )}

      {!loading &&
        groups
          .filter((group) => group.hits.length > 0)
          .map((group) => (
            <RecordSection
              key={group.key}
              title={`${group.title} (${group.total > group.hits.length ? `${group.hits.length} of ${group.total}` : group.hits.length})`}
              defaultOpen
            >
              <ul className="search-hit-list">
                {group.hits.map((hit) => (
                  <li key={hit.id}>
                    <Link to={group.href(hit.id)}>{hit.primary}</Link>
                    {hit.secondary && <span className="text-secondary">{hit.secondary}</span>}
                  </li>
                ))}
              </ul>
            </RecordSection>
          ))}
    </div>
  );
}
