import { forwardRef, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { SearchField } from './SearchField';
import { useDismissable } from '../../hooks/useDismissable';
import { useOutsideClose } from '../../hooks/useOutsideClose';
import { useScrollShadow } from '../../hooks/useScrollShadow';
import {
  HINT_MIN_CHARS,
  type SearchHint,
  type SearchHintFetcher,
} from '../../lib/searchHints';

const HINT_DELAY_MS = 300;

const SEARCH_PLACEHOLDER = 'Name, REQ-1042, company, deal or ticket';

interface SearchBoxProps {
  value: string;
  onValueChange: (next: string) => void;
  onSubmitTerm?: ((term: string) => void) | undefined;
  submitLabel?: string | undefined;
  placeholder?: string | undefined;
  autoFocus?: boolean | undefined;
  ariaLabel?: string | undefined;
  className?: string | undefined;
  type?: 'text' | 'search' | undefined;
  fetchHints?: SearchHintFetcher | undefined;
  onHintSelect?: ((hint: SearchHint) => void) | undefined;
  hideAllButton?: boolean | undefined;
  allLabel?: ((term: string, total: number) => string) | undefined;
  onClear?: (() => void) | undefined;
}

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(function SearchBox(
  {
    value,
    onValueChange,
    onSubmitTerm,
    submitLabel,
    placeholder = SEARCH_PLACEHOLDER,
    autoFocus = false,
    ariaLabel = 'Search everything',
    className,
    type,
    fetchHints,
    onHintSelect,
    hideAllButton = false,
    allLabel,
    onClear,
  },
  ref,
) {
  const hintListRef = useScrollShadow<HTMLUListElement>();
  const hintListId = useId();
  const navigate = useNavigate();
  const [hints, setHints] = useState<SearchHint[]>([]);
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
    if (!fetchHints) return undefined;
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
      void fetchHints(typed).then((result) => {
        if (stale()) return;
        setHints(result.hints);
        setHintTotal(result.total);
        setHintsOpen(result.hints.length > 0);
      });
    }, HINT_DELAY_MS);
    hintTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (hintTimer.current === timer) hintTimer.current = null;
    };
  }, [draft, fetchHints]);

  const selectMode = onHintSelect !== undefined;
  const listOpen = hintsOpen && hints.length > 0;
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setActiveIndex(-1);
  }, [hints]);

  const chooseHint = (hint: SearchHint) => {
    cancelPendingHints();
    onHintSelect?.(hint);
  };

  const onComboKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!listOpen) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + step + hints.length) % hints.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const hint = hints[activeIndex];
      if (hint) chooseHint(hint);
    }
  };

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
        ref={ref}
        value={draft}
        type={type}
        onValueChange={(next) => {
          userTyped.current = true;
          onValueChange(next);
        }}
        onSubmitTerm={searchAll}
        {...(onClear
          ? {
              onClear: () => {
                cancelPendingHints();
                onClear();
              },
            }
          : {})}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        autoFocus={autoFocus}
        combobox={selectMode ? {
          expanded: listOpen,
          controls: hintListId,
          activeDescendant: listOpen && activeIndex >= 0 ? `${hintListId}-${activeIndex}` : undefined,
          onKeyDown: onComboKeyDown,
        } : undefined}
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
            <ul
              id={hintListId}
              className="fo-hint-list fo-scroll-shade"
              ref={hintListRef}
              role={selectMode ? 'listbox' : undefined}
              aria-label="Suggested results"
            >
              {hints.map((hint, index) => selectMode ? (
                <li
                  key={hint.key}
                  id={`${hintListId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className="fo-hint fo-hint-select"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => chooseHint(hint)}
                >
                  <SearchIcon size={20} className="fo-hint-icon" aria-hidden="true" />
                  <span className="fo-hint-primary">{hint.primary}</span>
                  <span className="fo-hint-meta">{hint.meta}</span>
                </li>
              ) : (
                <li key={hint.key}>
                  <Link className="fo-hint" to={hint.href} onClick={closeHints}>
                    <SearchIcon size={20} className="fo-hint-icon" aria-hidden="true" />
                    <span className="fo-hint-primary">{hint.primary}</span>
                    <span className="fo-hint-meta">{hint.meta}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {!hideAllButton && <button
              type="button"
              className="fo-hint-all-btn"
              onClick={() => searchAll(draft.trim())}
            >
              {allLabel
                ? allLabel(draft.trim(), hintTotal)
                : `Search everything for “${draft.trim()}” · About ${hintTotal.toLocaleString()} results`}
            </button>}
          </div>
        )}
      </SearchField>
    </div>
  );
});
