import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RecordSection } from '../components/ui/RecordPage';
import { EmptyState } from '../components/ui/EmptyState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Search as SearchIcon, SearchX as NoResultsIcon } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { SearchBox } from '../components/ui/SearchBox';
import { globalSearchHints } from '../lib/searchHints';
import { useMinimumVisible } from '../hooks/useMinimumVisible';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';

const LIMIT = 25;
const MORE_STEP = 50;

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
  listHref?: string;
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

interface GroupPage {
  hits: SearchHit[];
  total: number;
  error?: string;
}

interface GroupQuery {
  key: string;
  title: string;
  listHref: string;
  href: (id: string) => string;
  page: (needle: string, from: number, to: number) => Promise<GroupPage>;
}

const GROUP_QUERIES: GroupQuery[] = [
  {
    key: 'candidates',
    title: 'Candidates',
    listHref: '/recruit/candidates',
    href: (id) => `/recruit/candidates/${id}`,
    page: async (needle, from, to) => {
      const like = pattern(needle);
      const { data, count, error } = await supabase
        .from('candidate_list')
        .select('person_id, full_name, current_title, city, country', { count: 'exact' })
        .or(`full_name.ilike.${like},current_title.ilike.${like},current_employer.ilike.${like}`)
        .order('full_name')
        .order('person_id')
        .range(from, to);
      return {
        hits: (data ?? []).map((r) => ({
          id: r.person_id as string,
          primary: (r.full_name as string) ?? 'Unnamed',
          secondary: joined(r.current_title, r.city, r.country),
        })),
        total: count ?? 0,
        ...(error ? { error: error.message } : {}),
      };
    },
  },
  {
    key: 'requisitions',
    title: 'Requisitions',
    listHref: '/recruit/requisitions',
    href: (id) => `/recruit/requisitions/${id}`,
    page: async (needle, from, to) => {
      const like = pattern(needle);
      const { data, count, error } = await supabase
        .from('requisitions')
        .select('id, display_code, title, location, status', { count: 'exact' })
        .or(
          `title.ilike.${like},display_code.ilike.${like},job_code.ilike.${like},location.ilike.${like}`,
        )
        .order('display_code', { ascending: false })
        .range(from, to);
      return {
        hits: (data ?? []).map((r) => ({
          id: r.id,
          primary: `${r.display_code} ${r.title}`,
          secondary: joined(r.location, r.status),
        })),
        total: count ?? 0,
        ...(error ? { error: error.message } : {}),
      };
    },
  },
  {
    key: 'contacts',
    title: 'Contacts',
    listHref: '/sales/contacts',
    href: (id) => `/sales/contacts/${id}`,
    page: async (needle, from, to) => {
      const like = pattern(needle);
      const { data, count, error } = await supabase
        .from('contact_list')
        .select('person_id, full_name, title, company_name, city, country', { count: 'exact' })
        .or(`full_name.ilike.${like},title.ilike.${like},company_name.ilike.${like}`)
        .order('full_name')
        .order('person_id')
        .range(from, to);
      return {
        hits: (data ?? []).map((r) => ({
          id: r.person_id as string,
          primary: (r.full_name as string) ?? 'Unnamed',
          secondary: joined(r.title, r.company_name, r.city),
        })),
        total: count ?? 0,
        ...(error ? { error: error.message } : {}),
      };
    },
  },
  {
    key: 'companies',
    title: 'Accounts',
    listHref: '/sales/companies',
    href: (id) => `/sales/companies/${id}`,
    page: async (needle, from, to) => {
      const like = pattern(needle);
      const { data, count, error } = await supabase
        .from('companies')
        .select('id, name, city, country', { count: 'exact' })
        .or(`name.ilike.${like},city.ilike.${like},country.ilike.${like}`)
        .order('name')
        .order('id')
        .range(from, to);
      return {
        hits: (data ?? []).map((c) => ({
          id: c.id,
          primary: c.name,
          secondary: joined(c.city, c.country),
        })),
        total: count ?? 0,
        ...(error ? { error: error.message } : {}),
      };
    },
  },
  {
    key: 'deals',
    title: 'Deals',
    listHref: '/sales/deals',
    href: (id) => `/sales/deals/${id}`,
    page: async (needle, from, to) => {
      const like = pattern(needle);
      const { data, count, error } = await supabase
        .from('deals')
        .select('id, display_code, name, stage', { count: 'exact' })
        .or(`name.ilike.${like},display_code.ilike.${like}`)
        .order('display_code', { ascending: false })
        .range(from, to);
      return {
        hits: (data ?? []).map((d) => ({
          id: d.id,
          primary: `${d.display_code} ${d.name}`,
          secondary: d.stage,
        })),
        total: count ?? 0,
        ...(error ? { error: error.message } : {}),
      };
    },
  },
  {
    key: 'tickets',
    title: 'Tickets',
    listHref: '/sales/tickets',
    href: (id) => `/sales/tickets/${id}`,
    page: async (needle, from, to) => {
      const like = pattern(needle);
      const { data, count, error } = await supabase
        .from('tickets')
        .select('id, display_code, subject, status', { count: 'exact' })
        .or(`subject.ilike.${like},display_code.ilike.${like}`)
        .order('display_code', { ascending: false })
        .range(from, to);
      return {
        hits: (data ?? []).map((t) => ({
          id: t.id,
          primary: `${t.display_code} ${t.subject}`,
          secondary: t.status,
        })),
        total: count ?? 0,
        ...(error ? { error: error.message } : {}),
      };
    },
  },
];

export function GlobalSearchPage() {
  useDocumentTitle('Search everything');
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SearchGroup[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const showSuggestedSkeleton = useMinimumVisible(suggestedLoading);
  const [expanding, setExpanding] = useState<string | null>(null);

  const [draft, setDraft] = useState(query);
  const term = useMemo(() => searchTerm(query), [query]);

  const run = useCallback(async (needle: string) => {
    setLoading(true);
    setError(null);
    try {
      const pages = await Promise.all(
        GROUP_QUERIES.map((group) => group.page(needle, 0, LIMIT - 1)),
      );
      const failed = pages.find((page) => page.error);
      if (failed?.error) throw new Error(failed.error);
      setGroups(
        GROUP_QUERIES.map((group, index) => ({
          key: group.key,
          title: group.title,
          href: group.href,
          listHref: group.listHref,
          hits: pages[index]?.hits ?? [],
          total: pages[index]?.total ?? 0,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(
    async (key: string) => {
      const group = GROUP_QUERIES.find((entry) => entry.key === key);
      const current = groups.find((entry) => entry.key === key);
      if (!group || !current) return;
      setExpanding(key);
      const from = current.hits.length;
      const page = await group.page(term, from, from + MORE_STEP - 1);
      setExpanding(null);
      if (page.error) {
        setError(page.error);
        return;
      }
      setGroups((prev) =>
        prev.map((entry) =>
          entry.key === key
            ? { ...entry, hits: [...entry.hits, ...page.hits], total: page.total }
            : entry,
        ),
      );
    },
    [groups, term],
  );

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    const submitted = query.trim();
    if (submitted.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void run(submitted);
  }, [query, run]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [people, reqs, contacts, deals] = await Promise.all([
        supabase
          .from('candidate_list')
          .select('person_id, full_name, current_title')
          .order('person_updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('requisition_list')
          .select('id, display_code, title, company_name')
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('contact_list')
          .select('person_id, full_name, company_name')
          .order('person_updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('deal_list')
          .select('id, display_code, name, company_name')
          .order('updated_at', { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;
      setSuggested([
        {
          key: 'candidates',
          title: 'Candidates',
          hits: (people.data ?? []).map((r) => ({
            id: r.person_id as string,
            primary: (r.full_name as string) ?? 'Unnamed',
            secondary: (r.current_title as string | null) ?? '',
          })),
          total: (people.data ?? []).length,
          href: (id) => `/recruit/candidates/${id}`,
        },
        {
          key: 'requisitions',
          title: 'Requisitions',
          hits: (reqs.data ?? []).map((r) => ({
            id: r.id as string,
            primary: `${r.display_code as string} ${r.title as string}`,
            secondary: (r.company_name as string | null) ?? '',
          })),
          total: (reqs.data ?? []).length,
          href: (id) => `/recruit/requisitions/${id}`,
        },
        {
          key: 'contacts',
          title: 'Contacts',
          hits: (contacts.data ?? []).map((r) => ({
            id: r.person_id as string,
            primary: (r.full_name as string) ?? 'Unnamed',
            secondary: (r.company_name as string | null) ?? '',
          })),
          total: (contacts.data ?? []).length,
          href: (id) => `/sales/contacts/${id}`,
        },
        {
          key: 'deals',
          title: 'Deals',
          hits: (deals.data ?? []).map((r) => ({
            id: r.id as string,
            primary: `${r.display_code as string} ${r.name as string}`,
            secondary: (r.company_name as string | null) ?? '',
          })),
          total: (deals.data ?? []).length,
          href: (id) => `/sales/deals/${id}`,
        },
      ]);
      setSuggestedLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const found = groups.reduce((sum, g) => sum + g.hits.length, 0);
  const showSkeleton = useMinimumVisible(loading);

  return (
    <div className="record-page">
      <div className="fo-page-head">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Search' }]} />
        <div className="fo-page-header">
          <span className="fo-page-icon">
            <SearchIcon size={32} />
          </span>
          <div className="fo-page-header-text">
            <div className="fo-page-header-title-row">
              <h1>Search everything</h1>
            </div>
            <p className="fo-page-desc">
              Candidates, requisitions, contacts, accounts, deals and tickets you have access to.
            </p>
            <div className="fo-search-block">
              <SearchBox
                value={draft}
                onValueChange={setDraft}
                onSubmitTerm={(next) => setParams(next ? { q: next } : {})}
                submitLabel="Search"
                autoFocus
                fetchHints={globalSearchHints}
                onClear={() => {
                  setDraft('');
                  setParams({});
                }}
              />
              <p className="fo-search-status">
                {term.length === 0
                  ? draft.trim().length > 0
                    ? 'Press Enter, or use Search, to look through every record.'
                    : 'Start typing, or pick up with a recently updated record below.'
                  : term.length < 2
                    ? 'Type at least two characters.'
                    : showSkeleton
                      ? 'Searching every record you can see…'
                      : `Showing the top ${found} ${found === 1 ? 'match' : 'matches'} for “${term}”.`}
              </p>
            </div>
          </div>
        </div>
      </div>



      {error && <p className="form-error" role="alert">{error}</p>}
      {term.length < 2 && (
        <>
          {showSuggestedSkeleton ? (
            <Skeleton rows={4} />
          ) : (
            suggested
              .filter((group) => group.hits.length > 0)
              .map((group) => (
                <RecordSection
                  key={`suggested-${group.key}`}
                  title={`Recently updated ${group.title.toLowerCase()}`}
                  count={group.hits.length}
                  defaultOpen
                >
                  <ul className="fo-result-list">
                    {group.hits.map((hit) => (
                      <li key={hit.id} className="fo-result">
                        <Link className="fo-result-link" to={group.href(hit.id)}>
                          <span className="fo-result-crumb">
                            {group.title}
                            {hit.secondary ? ` › ${hit.secondary}` : ''}
                          </span>
                          <span className="fo-result-title">{hit.primary}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </RecordSection>
              ))
          )}
        </>
      )}
      {term.length >= 2 && showSkeleton && <Skeleton rows={6} label="Searching" />}
      {!showSkeleton && term.length >= 2 && found === 0 && !error && (
        <EmptyState
          icon={<NoResultsIcon size={64} />}
          title={`Nothing matches “${term}”.`}
          hint="Check the spelling, try a shorter term, or search for a code such as REQ-1042 or DEAL-0007."
        />
      )}

      {!showSkeleton &&
        groups
          .filter((group) => group.hits.length > 0)
          .map((group) => (
            <RecordSection
              key={group.key}
              title={`${group.title} (${group.total > group.hits.length ? `${group.hits.length} of ${group.total.toLocaleString()}` : group.hits.length})`}
              defaultOpen
            >
              <ul className="fo-result-list">
                {group.hits.map((hit) => (
                  <li key={hit.id} className="fo-result">
                    <Link className="fo-result-link" to={group.href(hit.id)}>
                      <span className="fo-result-crumb">
                        {group.title}
                        {hit.secondary ? ` › ${hit.secondary}` : ''}
                      </span>
                      <span className="fo-result-title">{hit.primary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {group.total > group.hits.length && (
                <div className="fo-result-more">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={expanding === group.key}
                    onClick={() => void loadMore(group.key)}
                  >
                    {expanding === group.key
                      ? 'Loading…'
                      : `Show ${Math.min(MORE_STEP, group.total - group.hits.length).toLocaleString()} more`}
                  </button>
                  {group.listHref && (
                    <Link
                      className="fo-result-all"
                      to={`${group.listHref}?search=${encodeURIComponent(term)}`}
                    >
                      Open all {group.total.toLocaleString()} in {group.title}
                    </Link>
                  )}
                </div>
              )}
            </RecordSection>
          ))}
    </div>
  );
}
