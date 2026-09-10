import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { SearchField } from './SearchField';
import { supabase } from '../../lib/supabase';
import { useDismissable } from '../../hooks/useDismissable';
import { useOutsideClose } from '../../hooks/useOutsideClose';
import { useScrollShadow } from '../../hooks/useScrollShadow';

const HINT_DELAY_MS = 300;
const HINT_MIN_CHARS = 3;
const HINT_LIMIT = 10;
const HINT_PER_TABLE = 10;

const SEARCH_PLACEHOLDER = 'Name, REQ-1042, company, deal or ticket';

interface Hint {
  key: string;
  primary: string;
  meta: string;
  href: string;
}

function pattern(term: string): string {
  return `%${term}%`;
}

interface SearchBoxProps {
  value: string;
  onValueChange: (next: string) => void;
  onSubmitTerm?: ((term: string) => void) | undefined;
  submitLabel?: string | undefined;
  placeholder?: string | undefined;
  autoFocus?: boolean | undefined;
  ariaLabel?: string | undefined;
  className?: string | undefined;
}

export function SearchBox({
  value,
  onValueChange,
  onSubmitTerm,
  submitLabel,
  placeholder = SEARCH_PLACEHOLDER,
  autoFocus = false,
  ariaLabel = 'Search everything',
  className,
}: SearchBoxProps) {
  const hintListRef = useScrollShadow<HTMLUListElement>();
  const navigate = useNavigate();
  const [hints, setHints] = useState<Hint[]>([]);
  const [hintTotal, setHintTotal] = useState(0);
  const [hintsOpen, setHintsOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  const closeHints = useCallback(() => setHintsOpen(false), []);
  const hintBox = useDismissable(hintsOpen, closeHints, scopeRef);
  useOutsideClose(hintsOpen, hintBox.requestClose, scopeRef);
  const hintRun = useRef(0);
  const hintTimer = useRef<number | null>(null);
  const userTyped = useRef(false);
  const draft = value;

  const cancelPendingHints = useCallback(() => {
    userTyped.current = false;
    hintRun.current += 1;
    if (hintTimer.current !== null) {
      window.clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
    setHints([]);
    setHintTotal(0);
    setHintsOpen(false);
  }, []);

  useEffect(() => {
    const typed = draft.trim();
    if (!userTyped.current) return undefined;
    if (typed.length < HINT_MIN_CHARS) {
      setHints([]);
      setHintTotal(0);
      setHintsOpen(false);
      return undefined;
    }
    const runId = hintRun.current + 1;
    hintRun.current = runId;
    const stale = () => hintRun.current !== runId;
    const timer = window.setTimeout(() => {
      const like = pattern(typed);
      void Promise.all([
        supabase
          .from('candidate_list')
          .select('person_id, full_name, current_title', { count: 'exact' })
          .or(`full_name.ilike.${like},current_title.ilike.${like},current_employer.ilike.${like}`)
          .limit(HINT_PER_TABLE),
        supabase
          .from('requisition_list')
          .select('id, display_code, title, company_name', { count: 'exact' })
          .or(`title.ilike.${like},display_code.ilike.${like}`)
          .limit(HINT_PER_TABLE),
        supabase
          .from('contact_list')
          .select('person_id, full_name, title, company_name', { count: 'exact' })
          .or(`full_name.ilike.${like},title.ilike.${like},company_name.ilike.${like}`)
          .limit(HINT_PER_TABLE),
        supabase
          .from('companies')
          .select('id, name, city', { count: 'exact' })
          .or(`name.ilike.${like},city.ilike.${like},country.ilike.${like}`)
          .limit(HINT_PER_TABLE),
        supabase
          .from('deal_list')
          .select('id, display_code, name, company_name', { count: 'exact' })
          .or(`name.ilike.${like},display_code.ilike.${like}`)
          .limit(HINT_PER_TABLE),
        supabase
          .from('tickets')
          .select('id, display_code, subject, status', { count: 'exact' })
          .or(`subject.ilike.${like},display_code.ilike.${like}`)
          .limit(HINT_PER_TABLE),
      ]).then(([people, reqs, contacts, companies, deals, tickets]) => {
        if (stale()) return;
        const lists: Hint[][] = [
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
        const capped: Hint[] = [];
        for (let round = 0; capped.length < HINT_LIMIT && round < HINT_PER_TABLE; round += 1) {
          for (const list of lists) {
            const entry = list[round];
            if (entry) capped.push(entry);
            if (capped.length === HINT_LIMIT) break;
          }
        }
        setHints(capped);
        setHintTotal(
          [people, reqs, contacts, companies, deals, tickets].reduce(
            (sum, result) => sum + (result.count ?? 0),
            0,
          ),
        );
        setHintsOpen(capped.length > 0);
      });
    }, HINT_DELAY_MS);
    hintTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (hintTimer.current === timer) hintTimer.current = null;
    };
  }, [draft]);

  const searchAll = useCallback(
    (term: string) => {
      cancelPendingHints();
      if (onSubmitTerm) {
        onSubmitTerm(term);
        return;
      }
      navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
    },
    [cancelPendingHints, navigate, onSubmitTerm],
  );

  return (
    <div className={className ? `fo-searchbox ${className}` : 'fo-searchbox'} ref={scopeRef}>
      <SearchField
        value={draft}
        onValueChange={(next) => {
          userTyped.current = true;
          onValueChange(next);
        }}
        onSubmitTerm={searchAll}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setHintsOpen(hints.length > 0)}
        trailing={
          submitLabel ? (
            <button type="submit" className="btn btn-primary btn-sm fo-go-btn">
              {submitLabel}
            </button>
          ) : undefined
        }
      >
        {hintsOpen && hints.length > 0 && (
          <div className="fo-hint-pop" data-closing={hintBox.closing ? 'true' : undefined}>
            <ul className="fo-hint-list fo-scroll-shade" ref={hintListRef} aria-label="Suggested results">
                {hints.map((hint) => (
                  <li key={hint.key}>
                    <Link className="fo-hint" to={hint.href} onClick={closeHints}>
                      <SearchIcon size={20} className="fo-hint-icon" aria-hidden="true" />
                      <span className="fo-hint-primary">{hint.primary}</span>
                      <span className="fo-hint-meta">{hint.meta}</span>
                    </Link>
                  </li>
                ))}
            </ul>
            <button
              type="button"
              className="fo-hint-all-btn"
              onClick={() => searchAll(draft.trim())}
            >
              Search everything for “{draft.trim()}” · About{' '}
              {hintTotal.toLocaleString()} results
            </button>
          </div>
        )}
      </SearchField>
    </div>
  );
}
